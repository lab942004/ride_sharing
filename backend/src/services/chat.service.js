const prisma = require('../config/db');
const { sendPushToUser } = require('./push.service');

const appError = (msg, code = 400) => Object.assign(new Error(msg), { statusCode: code });

// ─── Internal helper ──────────────────────────────────────────────────────────
/**
 * Fetch the chat for a given requestId, verifying that userId is a participant
 * and the request is in ACCEPTED state.
 */
const getChatByRequestId = async (requestId, userId) => {
  const request = await prisma.request.findUnique({
    where  : { id: requestId },
    include: { chat: true },
  });

  if (!request)                    throw appError('Request not found', 404);
  if (request.status !== 'ACCEPTED') throw appError('Chat is only available for accepted ride requests', 403);

  const isParticipant =
    request.requesterId === userId || request.rideCreatorId === userId;
  if (!isParticipant)              throw appError('Unauthorized: you are not a participant of this chat', 403);

  if (!request.chat)               throw appError('Chat room not found for this request', 404);

  return request.chat;
};

// ─── Get Messages ─────────────────────────────────────────────────────────────
const getMessages = async (requestId, userId, page = 1, limit = 50) => {
  const chat = await getChatByRequestId(requestId, userId);
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where  : { chatId: chat.id },
      skip,
      take   : limit,
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, rollNo: true, profilePic: true } } },
    }),
    prisma.message.count({ where: { chatId: chat.id } }),
  ]);

  return {
    chatId    : chat.id,
    messages,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

// ─── Send Message (REST fallback — Socket.io is preferred) ────────────────────
const sendMessage = async (requestId, senderId, text) => {
  const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { isMuted: true } });
  if (sender?.isMuted) throw appError('You have been muted by an admin and cannot send messages.', 403);

  const chat = await getChatByRequestId(requestId, senderId);

  const message = await prisma.message.create({
    data   : { chatId: chat.id, senderId, text: text.trim() },
    include: { sender: { select: { id: true, name: true, rollNo: true, profilePic: true } } },
  });

  // ── Web push notification to the other participant (non-blocking) ─────────
  const request = await prisma.request.findUnique({
    where  : { id: requestId },
    select : { requesterId: true, rideCreatorId: true },
  });
  const recipientId =
    request.requesterId === senderId ? request.rideCreatorId : request.requesterId;

  sendPushToUser(recipientId, {
    title: `New message from ${message.sender.name}`,
    body : text.trim().slice(0, 120),
    url  : '/#/chat',
  }).catch((err) => console.error('Push notification failed:', err.message));

  return message;
};

// ─── Get Chat Info ────────────────────────────────────────────────────────────
/**
 * Returns chat metadata (participants, request info) — useful for the frontend
 * to render the chat header.
 */
const getChatInfo = async (requestId, userId) => {
  const request = await prisma.request.findUnique({
    where  : { id: requestId },
    include: {
      ride    : true,
      requester: { select: { id: true, name: true, rollNo: true, phone: true } },
      rideCreator: { select: { id: true, name: true, rollNo: true, phone: true } },
      chat    : { select: { id: true, createdAt: true } },
    },
  });

  if (!request)                    throw appError('Request not found', 404);
  if (request.status !== 'ACCEPTED') throw appError('Chat is only accessible for accepted requests', 403);

  const isParticipant =
    request.requesterId === userId || request.rideCreatorId === userId;
  if (!isParticipant)              throw appError('Unauthorized: not a participant', 403);

  if (!request.chat)               throw appError('Chat room not found', 404);

  return {
    chatId      : request.chat.id,
    createdAt   : request.chat.createdAt,
    ride        : request.ride,
    requester   : request.requester,
    rideCreator : request.rideCreator,
    phoneShared : request.phoneShared,
    currentUserId: userId,
  };
};

module.exports = { getChatByRequestId, getMessages, sendMessage, getChatInfo };
