const { verifyAccessToken } = require('../utils/jwt.utils');
const { SOCKET_EVENTS }     = require('../config/constants');
const prisma                = require('../config/db');
const { sendPushToUser }    = require('../services/push.service');

/**
 * Socket.io server initializer.
 *
 * Architecture:
 *  - Each authenticated user joins a personal room: `user_<userId>`
 *    â†’ used for push notifications (new request, request status change)
 *  - Chat rooms are: `chat_<requestId>`
 *    â†’ only accessible to the two participants of an accepted request
 */
const initSocket = (io) => {
  // â”€â”€ Authentication middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('Authentication token required'));

      const decoded = verifyAccessToken(token, 'user');
      const user    = await prisma.user.findUnique({
        where : { id: decoded.id },
        select: { id: true, name: true, identifier: true, identifierType: true, isVerified: true, isBanned: true, isSuspended: true },
      });

      if (!user || !user.isVerified) return next(new Error('Unauthorized'));
      if (user.isBanned || user.isSuspended) return next(new Error('Account is no longer active'));

      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`ðŸ”Œ [Socket] Connected: ${socket.user.name} (${socket.id})`);

    // â”€â”€ Join personal notification room â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    socket.join(`user_${socket.user.id}`);

    // â”€â”€ join_chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    socket.on(SOCKET_EVENTS.JOIN_CHAT, async ({ requestId }) => {
      try {
        if (!requestId) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'requestId is required' });
        }

        const request = await prisma.request.findUnique({
          where  : { id: requestId },
          include: { chat: { select: { id: true } } },
        });

        if (!request || request.status !== 'ACCEPTED') {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot join this chat' });
        }

        const isParticipant =
          request.requesterId === socket.user.id ||
          request.rideCreatorId === socket.user.id;

        if (!isParticipant) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized: not a participant' });
        }

        const room = `chat_${requestId}`;
        socket.join(room);
        socket.emit(SOCKET_EVENTS.JOINED_CHAT, {
          requestId,
          chatId: request.chat?.id,
          room,
        });
        console.log(`ðŸ’¬ [Socket] ${socket.user.name} joined ${room}`);
      } catch (err) {
        console.error('[Socket] join_chat error:', err.message);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join chat room' });
      }
    });

    // â”€â”€ send_message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async ({ requestId, text }) => {
      try {
        if (!text?.trim()) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Message cannot be empty' });
        }
        if (text.trim().length > 1000) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Message cannot exceed 1000 characters' });
        }

        // Re-check mute status from DB (not just the connection-time snapshot)
        // so a mute applied mid-session takes effect immediately, not just on reconnect.
        const currentUser = await prisma.user.findUnique({
          where : { id: socket.user.id },
          select: { isMuted: true, isBanned: true, isSuspended: true },
        });
        if (!currentUser || currentUser.isBanned || currentUser.isSuspended) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Your account is no longer active.' });
        }
        if (currentUser.isMuted) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'You have been muted by an admin and cannot send messages.' });
        }

        const request = await prisma.request.findUnique({
          where  : { id: requestId },
          include: { chat: true },
        });

        if (!request || request.status !== 'ACCEPTED' || !request.chat) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid chat session' });
        }

        const isParticipant =
          request.requesterId === socket.user.id ||
          request.rideCreatorId === socket.user.id;

        if (!isParticipant) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized' });
        }

        const message = await prisma.message.create({
          data   : { chatId: request.chat.id, senderId: socket.user.id, text: text.trim() },
          include: { sender: { select: { id: true, name: true, identifier: true, identifierType: true } } },
        });

        // Emit to all in the chat room (including sender for confirmation)
        io.to(`chat_${requestId}`).emit(SOCKET_EVENTS.NEW_MESSAGE, message);

        // â”€â”€ Web push notification to the other participant (non-blocking) â”€â”€â”€â”€â”€
        const recipientId =
          request.requesterId === socket.user.id
            ? request.rideCreatorId
            : request.requesterId;

        sendPushToUser(recipientId, {
          title: `New message from ${socket.user.name}`,
          body : text.trim().slice(0, 120),
          url  : '/chat',
        }).catch((err) => console.error('Push notification failed:', err.message));
      } catch (err) {
        console.error('[Socket] send_message error:', err.message);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to send message' });
      }
    });

    // â”€â”€ typing indicators â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // SECURITY: only broadcast if this socket has actually joined the room via
    // the participant-checked `join_chat` handler above â€” otherwise any
    // authenticated user who merely knows/guesses a requestId could spoof a
    // typing indicator into a chat they're not part of.
    socket.on(SOCKET_EVENTS.TYPING, ({ requestId }) => {
      const room = `chat_${requestId}`;
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit(SOCKET_EVENTS.USER_TYPING, {
        user: { id: socket.user.id, name: socket.user.name },
      });
    });

    socket.on(SOCKET_EVENTS.STOP_TYPING, ({ requestId }) => {
      const room = `chat_${requestId}`;
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
        userId: socket.user.id,
      });
    });

    // â”€â”€ leave_chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    socket.on(SOCKET_EVENTS.LEAVE_CHAT, ({ requestId }) => {
      const room = `chat_${requestId}`;
      socket.leave(room);
      console.log(`ðŸ’¬ [Socket] ${socket.user.name} left ${room}`);
    });

    // â”€â”€ disconnect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    socket.on('disconnect', (reason) => {
      console.log(`ðŸ”Œ [Socket] Disconnected: ${socket.user?.name} â€” ${reason}`);
    });
  });
};

module.exports = initSocket;
