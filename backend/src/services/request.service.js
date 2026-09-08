const prisma = require('../config/db');
const { sendRideRequestEmail, sendRequestStatusEmail } = require('./email.service');
const { isRideExpired, hasChatDisappeared } = require('../utils/rideTime.utils');
const { SOCKET_EVENTS } = require('../config/constants');
const { sendPushToUser } = require('./push.service');

const appError = (msg, code = 400) => Object.assign(new Error(msg), { statusCode: code });

// â”€â”€â”€ Create Request â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Guard conditions:
 *  - Ride must exist and belong to the same domain (requesterDomain vs ride.domain
 *    is explicitly re-checked here — never trust that a caller-supplied rideId
 *    already belongs to the caller's domain)
 *  - Cannot request own ride
 *  - Ride must not be full
 *  - Ride departure must not have passed  â† KEY FIX
 *  - User cannot have an existing request for this ride
 */
const createRequest = async (requesterId, requesterDomain, rideId, io = null) => {
  const ride = await prisma.ride.findUnique({
    where  : { id: rideId },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });

  if (!ride)                          throw appError('Ride not found', 404);
  if (ride.domain !== requesterDomain) throw appError('Ride not found', 404);
  if (ride.createdById === requesterId) throw appError('You cannot request your own ride', 400);

  // â”€â”€ Expired ride check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (ride.isExpired || isRideExpired(ride.date, ride.time)) {
    throw appError('This ride has already departed. You cannot request it.', 400);
  }

  if (ride.isFull || ride.availableSeats === 0) {
    throw appError('This ride is fully booked', 400);
  }

  // â”€â”€ Duplicate request check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const existing = await prisma.request.findFirst({ where: { rideId, requesterId } });
  if (existing) {
    throw appError(
      `You have already ${existing.status === 'PENDING' ? 'sent a request' : existing.status.toLowerCase() + ' a request'} for this ride`,
      409
    );
  }

  const request = await prisma.request.create({
    data   : { rideId, requesterId, rideCreatorId: ride.createdById },
    include: {
      ride    : true,
      requester: { select: { id: true, name: true, email: true, identifier: true, identifierType: true, profilePic: true } },
    },
  });

  // â”€â”€ Real-time socket notification to ride owner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (io) {
    io.to(`user_${ride.createdById}`).emit(SOCKET_EVENTS.NEW_REQUEST, {
      request,
      message: `${request.requester.name} has requested to join your ride from ${ride.from} to ${ride.to}`,
    });
  }

  // â”€â”€ Email notification (non-blocking) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sendRideRequestEmail(
    ride.createdBy.email,
    ride.createdBy.name,
    request.requester.name,
    request.requester.identifier,
    ride
  ).catch((err) => console.error('Email notification failed:', err.message));

  // â”€â”€ Web push notification to ride owner (non-blocking) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sendPushToUser(ride.createdById, {
    title: 'New ride request',
    body : `${request.requester.name} (${request.requester.identifier}) wants to join your ride from ${ride.from} to ${ride.to}`,
    url  : '/request',
  }).catch((err) => console.error('Push notification failed:', err.message));

  return request;
};

// â”€â”€â”€ Get Requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Returns two arrays:
 *  - sent:     requests the current user sent as a requester
 *  - received: requests sent to rides the current user created
 */
const getRequests = async (userId) => {
  const [sent, received] = await Promise.all([
    prisma.request.findMany({
      where  : { requesterId: userId },
      include: {
        ride: {
          include: {
            createdBy: { select: { id: true, name: true, identifier: true, identifierType: true, phone: true, profilePic: true } },
          },
        },
        requester: {select: {id: true, name: true, identifier: true, identifierType: true, email: true, phone: true, profilePic: true}},
        rideCreator: {select: {id: true, name: true, identifier: true, identifierType: true, phone: true, profilePic: true}},
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.request.findMany({
      where  : { rideCreatorId: userId },
      include: {
        ride    : true,
        requester: { select: { id: true, name: true, identifier: true, identifierType: true, email: true, phone: true, profilePic: true } },
        rideCreator: { select: {id: true, name: true, identifier: true, identifierType: true, phone: true, profilePic: true}},
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // An ACCEPTED request's chat disappears CHAT_DISAPPEAR_DAYS after the ride
  // departed. Non-accepted requests (PENDING/REJECTED) aren't chats and are
  // unaffected â€” only filter the ones this actually applies to.
  const dropDisappearedChats = (r) =>
    r.status !== 'ACCEPTED' || !hasChatDisappeared(r.ride.date, r.ride.time);

  return {
    sent    : sent.filter(dropDisappearedChats),
    received: received.filter(dropDisappearedChats),
  };
};

// â”€â”€â”€ Update Request Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Accept / Reject a request.
 *  - Only ride creator can update
 *  - Request must still be PENDING
 *  - Accept: decrement seats, mark ride full if 0, create chat
 */
const updateRequestStatus = async (requestId, userId, status, io = null) => {
  const request = await prisma.request.findUnique({
    where  : { id: requestId },
    include: {
      ride    : { include: { createdBy: { select: { id: true, name: true } } } },
      requester: { select: { id: true, name: true, email: true } },
    },
  });

  if (!request)                         throw appError('Request not found', 404);
  if (request.rideCreatorId !== userId)   throw appError('Only the ride creator can accept or reject requests', 403);
  if (request.status !== 'PENDING')       throw appError(`Request is already ${request.status.toLowerCase()}`, 400);

  const updatedRequest = await prisma.$transaction(async (tx) => {
    if (status === 'ACCEPTED') {
      // â”€â”€ Atomic, race-safe seat decrement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Guard the decrement with a WHERE clause so two concurrent "accept"
      // calls on the same ride can't both succeed when only one seat is left
      // (a plain `update` with `decrement: 1` has no such guard and can drive
      // availableSeats negative under concurrent requests).
      const seatUpdateResult = await tx.ride.updateMany({
        where: { id: request.rideId, availableSeats: { gt: 0 } },
        data : { availableSeats: { decrement: 1 } },
      });
      if (seatUpdateResult.count === 0) {
        throw appError('This ride is fully booked. The seat was taken by someone else.', 409);
      }

      const updatedRide = await tx.ride.findUnique({ where: { id: request.rideId } });
      if (updatedRide.availableSeats <= 0) {
        await tx.ride.update({ where: { id: request.rideId }, data: { isFull: true } });
      }

      // Create chat room for the two participants
      await tx.chat.create({ data: { requestId } });
    }

    const updated = await tx.request.update({ where: { id: requestId }, data: { status } });
    return updated;
  });

  // â”€â”€ Real-time notification to requester â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (io) {
    io.to(`user_${request.requesterId}`).emit(SOCKET_EVENTS.REQUEST_STATUS, {
      requestId,
      status,
      ride   : request.ride,
      message: `Your ride request has been ${status.toLowerCase()} by ${request.ride.createdBy.name}`,
    });
  }

  // â”€â”€ Email notification (non-blocking) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sendRequestStatusEmail(
    request.requester.email,
    request.requester.name,
    status,
    request.ride,
    request.ride.createdBy.name
  ).catch((err) => console.error('Email notification failed:', err.message));

  // â”€â”€ Web push notification to requester (non-blocking) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sendPushToUser(request.requesterId, {
    title: `Request ${status.toLowerCase()}`,
    body : `Your request to join ${request.ride.from} â†’ ${request.ride.to} was ${status.toLowerCase()} by ${request.ride.createdBy.name}`,
    url  : '/request',
  }).catch((err) => console.error('Push notification failed:', err.message));

  return updatedRequest;
};

// â”€â”€â”€ Share Phone Number â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Both the ride creator AND the requester must individually confirm before
 * phone numbers are revealed. Uses two boolean columns on Request.
 *
 * Returns the phone numbers of BOTH parties only when both have confirmed.
 */
const sharePhone = async (requestId, userId) => {
  const request = await prisma.request.findUnique({
    where  : { id: requestId },
    include: {
      ride    : { include: { createdBy: { select: { id: true, phone: true, name: true } } } },
      requester: { select: { id: true, phone: true, name: true } },
    },
  });

  if (!request)                      throw appError('Request not found', 404);
  if (request.status !== 'ACCEPTED') throw appError('Phone sharing is only available for accepted requests', 400);

  const isCreator   = request.rideCreatorId === userId;
  const isRequester = request.requesterId   === userId;
  if (!isCreator && !isRequester)    throw appError('Unauthorized: not a participant of this request', 403);

  const updateData     = isCreator ? { creatorPhoneConfirmed: true } : { requesterPhoneConfirmed: true };
  const updatedRequest = await prisma.request.update({
    where: { id: requestId },
    data : updateData,
  });

  const bothConfirmed =
    updatedRequest.creatorPhoneConfirmed && updatedRequest.requesterPhoneConfirmed;

  if (bothConfirmed && !updatedRequest.phoneShared) {
    await prisma.request.update({ where: { id: requestId }, data: { phoneShared: true } });
  }

  const phones = bothConfirmed
    ? {
        creatorPhone  : request.ride.createdBy.phone   || 'Not provided',
        requesterPhone: request.requester.phone         || 'Not provided',
        creatorName   : request.ride.createdBy.name,
        requesterName : request.requester.name,
      }
    : null;

  return {
    message           : bothConfirmed
      ? 'Phone numbers shared successfully'
      : 'Your confirmation has been recorded. Waiting for the other person to confirm.',
    bothConfirmed,
    creatorConfirmed  : updatedRequest.creatorPhoneConfirmed,
    requesterConfirmed: updatedRequest.requesterPhoneConfirmed,
    phones,
  };
};

// â”€â”€â”€ Delete Request (and associated chat) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const deleteRequest = async (requestId, userId) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { ride: true },
  });

  if (!request) throw appError('Request not found', 404);

  // Only participants (requester or ride creator) can delete the request
  if (request.requesterId !== userId && request.rideCreatorId !== userId) {
    throw appError('Unauthorized to delete this request', 403);
  }

  // Remove chat messages and chat record if exists, then delete request
  await prisma.$transaction(async (tx) => {
    const chat = await tx.chat.findUnique({ where: { requestId } });
    if (chat) {
      await tx.message.deleteMany({ where: { chatId: chat.id } });
      await tx.chat.delete({ where: { id: chat.id } });
    }
    await tx.request.delete({ where: { id: requestId } });
  });

  return { message: 'Request and chat deleted' };
};

module.exports = { createRequest, getRequests, updateRequestStatus, sharePhone, deleteRequest };
