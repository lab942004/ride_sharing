const webpush = require('web-push');
const prisma = require('../config/db');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * Save (or update) a push subscription for a user.
 * Upserts by endpoint so re-subscribing doesn't create duplicates.
 */
const saveSubscription = async (userId, { endpoint, keys, userAgent }) => {
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw Object.assign(new Error('Invalid push subscription'), { statusCode: 400 });
  }

  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  if (existing) {
    return prisma.pushSubscription.update({
      where: { id: existing.id },
      data : { p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent || null },
    });
  }

  return prisma.pushSubscription.create({
    data: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent || null },
  });
};

/** Remove a push subscription (e.g. when the user unsubscribes). */
const deleteSubscription = async (userId, endpoint) => {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  return { success: true };
};

/**
 * Send a web push notification to a single user across all their
 * subscribed devices. Fail-open: a push failure (e.g. expired endpoint)
 * is logged and the dead subscription is cleaned up, but never throws.
 */
const sendPushToUser = async (userId, { title, body, url }) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[push] VAPID keys not configured — skipping push');
    return;
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url: url || '/' });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err) {
        // 404/410 = subscription expired — clean it up
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`[push] failed for ${sub.endpoint}:`, err.message);
        }
      }
    })
  );
};

/**
 * Send a web push notification to every subscribed user in a domain
 * (used when a new ride is published). Fail-open like sendPushToUser.
 */
const sendPushToDomain = async (domain, { title, body, url }) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[push] VAPID keys not configured — skipping push');
    return;
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { user: { domain } },
  });
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url: url || '/' });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`[push] failed for ${sub.endpoint}:`, err.message);
        }
      }
    })
  );
};

module.exports = { saveSubscription, deleteSubscription, sendPushToUser, sendPushToDomain, VAPID_PUBLIC_KEY };
