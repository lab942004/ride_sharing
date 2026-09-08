const cron   = require('node-cron');
const prisma = require('../config/db');
const { isRideExpired, getRideDepartureDate, hasChatDisappeared } = require('../utils/rideTime.utils');
const { CHAT_DISAPPEAR_DAYS } = require('../config/constants');
const { sendPushToUser } = require('../services/push.service');

/**
 * node-cron does not prevent a scheduled job from starting again while the
 * previous run of the *same* job is still in flight. `sendRideReminders`
 * scans the whole ride table every minute and, under load (many rides,
 * slow DB), a run can take longer than a minute — at which point runs start
 * overlapping and each additional overlapping run makes the next tick
 * slower still. Wrap any job that could plausibly overlap with `withLock`
 * so a run that's still going simply skips the next tick instead of
 * stacking up.
 */
const withLock = (name, fn) => {
  let running = false;
  return async (...args) => {
    if (running) {
      console.warn(`⏭️  [Cleanup] Skipping "${name}" — previous run still in progress.`);
      return;
    }
    running = true;
    try {
      await fn(...args);
    } finally {
      running = false;
    }
  };
};

/**
 * JOB: Mark expired rides
 *
 * Runs every 5 minutes.
 * Finds rides whose departure has passed and marks them isExpired = true.
 * This is what the prompt requires:
 *   "remove ride from other user if posted ride time is over"
 * We mark instead of hard-delete to keep historical data / requests intact.
 * The GET /rides endpoint already filters these out from listings.
 *
 * Also: pending requests on expired rides are auto-rejected so requesters
 * are not left hanging.
 */
const markExpiredRides = async () => {
  try {
    // Find non-expired rides whose date is today or in the past
    const candidates = await prisma.ride.findMany({
      where: {
        isExpired: false,
        date     : { lte: new Date() }, // only look at rides from today backwards
      },
      select: { id: true, date: true, time: true },
    });

    const expiredIds = candidates
      .filter((r) => isRideExpired(r.date, r.time))
      .map((r) => r.id);

    if (expiredIds.length === 0) return;

    await prisma.$transaction([
      // Mark rides as expired
      prisma.ride.updateMany({
        where: { id: { in: expiredIds } },
        data : { isExpired: true, isFull: true },
      }),
      // Auto-reject all PENDING requests on expired rides
      prisma.request.updateMany({
        where: { rideId: { in: expiredIds }, status: 'PENDING' },
        data : { status: 'REJECTED' },
      }),
    ]);

    console.log(`🕐 [Cleanup] Marked ${expiredIds.length} ride(s) as expired and rejected pending requests.`);
  } catch (err) {
    console.error('❌ [Cleanup] markExpiredRides failed:', err.message);
  }
};

/**
 * JOB: Send 15-minute ride departure reminders
 *
 * Runs every minute.
 * Finds rides departing in ~15 minutes that haven't been reminded yet,
 * and pushes a notification to the ride creator + all ACCEPTED passengers.
 *
 * Uses a `reminderSent` flag on the Ride to avoid duplicate sends.
 */
const sendRideReminders = async () => {
  try {
    const now = new Date();
    const in15 = new Date(now.getTime() + 15 * 60 * 1000);

    // Rides departing within the next 15 minutes (and not yet reminded)
    const rides = await prisma.ride.findMany({
      where: {
        isExpired: false,
        reminderSent: false,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        requests: {
          where: { status: 'ACCEPTED' },
          select: { requesterId: true },
        },
      },
    });

    const due = rides.filter((r) => {
      const dep = getRideDepartureDate(r.date, r.time);
      return dep > now && dep <= in15;
    });

    if (due.length === 0) return;

    // -- Fan out push notifications -----------------------------------
    // Fire all pushes concurrently instead of `await`ing them one ride at a
    // time in a sequential for...of loop - under load (many due rides) that
    // loop got slower every tick and could start overlapping with the next
    // scheduled run. Push failures are logged but never block the DB update.
    for (const ride of due) {
      const body = `Your ride from ${ride.from} to ${ride.to} departs at ${ride.time}. Be ready!`;

      sendPushToUser(ride.createdById, {
        title: 'Ride departing in 15 minutes',
        body,
        url: '/',
      }).catch((err) => console.error('Push notification failed:', err.message));

      for (const req of ride.requests) {
        sendPushToUser(req.requesterId, {
          title: 'Ride departing in 15 minutes',
          body,
          url: '/',
        }).catch((err) => console.error('Push notification failed:', err.message));
      }
    }

    // -- Mark all due rides as reminded in a single batched write ------
    // A single updateMany instead of N sequential updates (one per ride).
    await prisma.ride.updateMany({
      where: { id: { in: due.map((r) => r.id) } },
      data : { reminderSent: true },
    });

    console.log(`⏰ [Reminder] Sent 15-min reminders for ${due.length} ride(s).`);
  } catch (err) {
    console.error('❌ [Reminder] sendRideReminders failed:', err.message);
  }
};

/**
 * JOB: Delete expired OTPs
 *
 * Runs every 10 minutes.
 * Removes OTP rows that are past their expiresAt timestamp.
 */
const purgeExpiredOTPs = async () => {
  try {
    const { count } = await prisma.oTP.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) console.log(`🗑️  [Cleanup] Purged ${count} expired OTP(s).`);
  } catch (err) {
    console.error('❌ [Cleanup] purgeExpiredOTPs failed:', err.message);
  }
};

/**
 * JOB: Delete expired VerifiedEmail proofs
 *
 * Runs every 30 minutes.
 */
const purgeExpiredVerifiedEmails = async () => {
  try {
    const { count } = await prisma.verifiedEmail.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) console.log(`🗑️  [Cleanup] Purged ${count} expired VerifiedEmail record(s).`);
  } catch (err) {
    console.error('❌ [Cleanup] purgeExpiredVerifiedEmails failed:', err.message);
  }
};

/**
 * JOB: Delete old revoked / expired refresh tokens
 *
 * Runs every day at 2 AM.
 * Keeps the refresh_tokens table lean.
 */
const purgeOldRefreshTokens = async () => {
  try {
    const { count } = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { isRevoked : true },
          { expiresAt : { lt: new Date() } },
        ],
      },
    });
    if (count > 0) console.log(`🗑️  [Cleanup] Purged ${count} old refresh token(s).`);
  } catch (err) {
    console.error('❌ [Cleanup] purgeOldRefreshTokens failed:', err.message);
  }
};

/**
 * JOB: Purge disappeared chats
 *
 * Runs every hour.
 * An accepted request's chat should disappear CHAT_DISAPPEAR_DAYS after the
 * ride departed (GET /requests already hides these — see request.service.js
 * getRequests — but this job actually deletes the underlying Chat, so it
 * doesn't just sit around in the DB forever). Deleting the Chat row cascades
 * to its Messages (schema.prisma: Message.chat has onDelete: Cascade).
 * The Request record itself is intentionally left alone — this only removes
 * the chat/messages, not request history.
 */
const purgeDisappearedChats = async () => {
  try {
    const candidates = await prisma.request.findMany({
      where: {
        status: 'ACCEPTED',
        chat  : { isNot: null },
      },
      select: {
        id  : true,
        ride: { select: { date: true, time: true } },
      },
    });

    const disappearedIds = candidates
      .filter((r) => hasChatDisappeared(r.ride.date, r.ride.time))
      .map((r) => r.id);

    if (disappearedIds.length === 0) return;

    const { count } = await prisma.chat.deleteMany({
      where: { requestId: { in: disappearedIds } },
    });

    console.log(`🗑️  [Cleanup] Purged ${count} chat(s) older than ${CHAT_DISAPPEAR_DAYS} days past ride departure.`);
  } catch (err) {
    console.error('❌ [Cleanup] purgeDisappearedChats failed:', err.message);
  }
};

/**
 * Register all cron jobs.
 * Call this once from server.js after DB is connected.
 */
const initCleanupJobs = () => {
  // Every minute — send 15-minute ride departure reminders.
  // Guarded: this job does a full table scan and, under load, a run can
  // outlast the 1-minute interval — without the guard, node-cron would
  // happily start a second overlapping run on top of it.
  cron.schedule('* * * * *', withLock('send-ride-reminders', sendRideReminders), { name: 'send-ride-reminders' });

  // Every 5 minutes — mark expired rides + reject pending requests
  cron.schedule('*/5 * * * *', withLock('mark-expired-rides', markExpiredRides), { name: 'mark-expired-rides' });

  // Every 10 minutes — purge expired OTPs
  cron.schedule('*/10 * * * *', purgeExpiredOTPs, { name: 'purge-otps' });

  // Every 30 minutes — purge expired VerifiedEmail records
  cron.schedule('*/30 * * * *', purgeExpiredVerifiedEmails, { name: 'purge-verified-emails' });

  // Every day at 2 AM — purge old refresh tokens
  cron.schedule('0 2 * * *', purgeOldRefreshTokens, { name: 'purge-refresh-tokens' });

  // Every hour — purge chats (and their messages) that disappeared
  cron.schedule('0 * * * *', purgeDisappearedChats, { name: 'purge-disappeared-chats' });

  console.log('⏰ [Cleanup] Cron jobs registered');
};

module.exports = {
  initCleanupJobs,
  markExpiredRides,
  purgeExpiredOTPs,
  sendRideReminders,
  purgeDisappearedChats,
};
