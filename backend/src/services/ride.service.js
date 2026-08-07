const prisma = require('../config/db');
const { MAX_RIDE_DAYS_AHEAD } = require('../config/constants');
const { getRideDepartureDate, isRideExpired } = require('../utils/rideTime.utils');
const { sendPushToDomain } = require('./push.service');

const appError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

// ─── Create Ride ──────────────────────────────────────────────────────────────
/**
 * Business rules:
 *  1. Combined date + time must be in the future (not just the date).
 *  2. Departure must be within MAX_RIDE_DAYS_AHEAD days from now.
 *  3. Seats > 0 (enforced by Zod schema too, double-checked here).
 *  4. Pickup and destination must not be the same place name.
 */
const createRide = async (userId, domain, data) => {
  const { from, to, date, time, vehicleType, availableSeats } = data;

  const departure = getRideDepartureDate(date, time);
  const now       = new Date();
  const maxDate   = new Date();
  maxDate.setDate(maxDate.getDate() + MAX_RIDE_DAYS_AHEAD);

  if (departure <= now) {
    throw appError('Ride date and time cannot be in the past', 400);
  }
  if (departure > maxDate) {
    throw appError(`Rides can only be scheduled up to ${MAX_RIDE_DAYS_AHEAD} days in advance`, 400);
  }
  if (availableSeats < 1) {
    throw appError('At least 1 seat must be available', 400);
  }

  // Reject rides where pickup and destination are the same place name.
  if (from.trim().toLowerCase() === to.trim().toLowerCase()) {
    throw appError('Pickup and destination cannot be the same place', 400);
  }

  const ride = await prisma.ride.create({
    data   : { from, to, date: new Date(date), time, vehicleType, availableSeats, domain, createdById: userId },
    include: { createdBy: { select: { id: true, name: true, rollNo: true, email: true } } },
  });

  // ── Web push notification to everyone in the domain (non-blocking) ────────
  sendPushToDomain(domain, {
    title: 'New ride available',
    body : `A new ride from ${from} to ${to} on ${date} at ${time} (${vehicleType}) has been published`,
    url  : '/#/',
  }).catch((err) => console.error('Push notification failed:', err.message));

  return ride;
};

// ─── Get Rides (with search + filters) ───────────────────────────────────────
/**
 * Only shows rides belonging to the same college domain.
 * Excludes rides whose departure has already passed (isExpired = false AND departure > now).
 * Supports filters: from, to, date, vehicleType.
 * Marks each ride with isOwner and userRequestStatus.
 */
const getRides = async (domain, filters = {}, userId) => {
  const { from, to, date, vehicleType, page = 1, limit = 10 } = filters;
  const skip = (Number(page) - 1) * Number(limit);
  const now  = new Date();

  // Base filter: same domain, not expired, departure in future
  const where = {
    domain,
    isExpired     : false,
    // We filter by the date column ≥ today; precise time filtering happens in-memory
    // via isRideExpired util, but DB-level we cut down rows efficiently:
    date          : { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
  };

  if (from)        where.from        = { contains: from, mode: 'insensitive' };
  if (to)          where.to          = { contains: to,   mode: 'insensitive' };
  if (vehicleType) where.vehicleType = vehicleType;

  if (date) {
    const searchDate = new Date(date);
    const nextDay    = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    // Override the date filter when a specific date is requested
    where.date = { gte: searchDate, lt: nextDay };
  }

  const [allRides, total] = await Promise.all([
    prisma.ride.findMany({
      where,
      skip,
      take   : Number(limit),
      orderBy: [{ date: 'asc' }],
      include: {
        createdBy: { select: { id: true, name: true, rollNo: true } },
        _count   : { select: { requests: { where: { status: 'ACCEPTED' } } } },
      },
    }),
    prisma.ride.count({ where }),
  ]);

  // Filter out rides whose exact departure time has passed
  const rides = allRides.filter((r) => !isRideExpired(r.date, r.time));

  // Enrich with current user's request status for each ride
  const userRequests = await prisma.request.findMany({
    where : { requesterId: userId },
    select: { rideId: true, status: true },
  });
  const requestMap = new Map(userRequests.map((r) => [r.rideId, r.status]));

  const enrichedRides = rides.map((ride) => ({
    ...ride,
    isFull           : ride.availableSeats === 0 || ride.isFull,
    isOwner          : ride.createdById === userId,
    userRequestStatus: requestMap.get(ride.id) || null,
  }));

  return {
    rides     : enrichedRides,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  };
};

// ─── Get Ride By ID ───────────────────────────────────────────────────────────
const getRideById = async (rideId, domain) => {
  const ride = await prisma.ride.findFirst({
    where  : { id: rideId, domain },
    include: {
      createdBy: { select: { id: true, name: true, rollNo: true } },
      requests : {
        where  : { status: 'ACCEPTED' },
        include: { requester: { select: { id: true, name: true, rollNo: true } } },
      },
    },
  });
  if (!ride) throw appError('Ride not found', 404);
  return { ...ride, isFull: ride.availableSeats === 0 || ride.isFull };
};

// ─── Delete Ride ──────────────────────────────────────────────────────────────
const deleteRide = async (rideId, userId) => {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride)                     throw appError('Ride not found', 404);
  if (ride.createdById !== userId) throw appError('You can only delete your own rides', 403);

  await prisma.ride.delete({ where: { id: rideId } });
  return { message: 'Ride deleted successfully' };
};

// ─── Get My Rides ─────────────────────────────────────────────────────────────
const getMyRides = async (userId) => {
  const rides = await prisma.ride.findMany({
    where  : { createdById: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count  : { select: { requests: true } },
      requests: {
        where  : { status: 'ACCEPTED' },
        include: { requester: { select: { id: true, name: true, rollNo: true } } },
      },
    },
  });

  return rides.map((r) => ({
    ...r,
    isFull   : r.availableSeats === 0 || r.isFull,
    isExpired: isRideExpired(r.date, r.time),
  }));
};

module.exports = { createRide, getRides, getRideById, deleteRide, getMyRides };