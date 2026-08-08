const { RIDE_TIME_UTC_OFFSET, CHAT_EXPIRY_HOURS, CHAT_DISAPPEAR_DAYS } = require('../config/constants');

/**
 * Given a ride's date (Date | string) and time (string "HH:MM"),
 * return a Date representing the exact departure moment.
 *
 * IMPORTANT: this must NOT use Date#setHours() to build the departure
 * instant. setHours() applies the SERVER PROCESS's local timezone, which
 * is whatever `TZ` the host/container happens to have (often UTC in
 * production) — not the timezone the ride time was actually entered in.
 * That mismatch previously made rides expire (and disappear from the
 * home page) up to 5.5 hours later/earlier than intended, depending on
 * deployment.
 *
 * Instead we build the departure instant explicitly with a fixed IST
 * offset, so the result is identical regardless of the server's TZ.
 */
const getRideDepartureDate = (date, time) => {
  // `date` may be a Date object (from Prisma) or a "YYYY-MM-DD" string —
  // either way, take just the calendar date portion.
  const dateStr = new Date(date).toISOString().slice(0, 10);
  const [hh, mm] = (time || '00:00').split(':');
  const hours   = hh.padStart(2, '0');
  const minutes = mm.padStart(2, '0');

  return new Date(`${dateStr}T${hours}:${minutes}:00${RIDE_TIME_UTC_OFFSET}`);
};

/**
 * Return true if the ride departure has already passed.
 */
const isRideExpired = (date, time) => {
  return getRideDepartureDate(date, time) < new Date();
};

/**
 * Chat becomes read-only (existing messages visible, no new ones) this
 * many hours after the ride's departure.
 */
const getChatExpiryDate = (date, time) => {
  const departure = getRideDepartureDate(date, time);
  return new Date(departure.getTime() + CHAT_EXPIRY_HOURS * 60 * 60 * 1000);
};

const isChatExpired = (date, time) => getChatExpiryDate(date, time) < new Date();

/**
 * The chat disappears entirely this many days after the ride's departure.
 */
const getChatDisappearDate = (date, time) => {
  const departure = getRideDepartureDate(date, time);
  return new Date(departure.getTime() + CHAT_DISAPPEAR_DAYS * 24 * 60 * 60 * 1000);
};

const hasChatDisappeared = (date, time) => getChatDisappearDate(date, time) < new Date();

module.exports = {
  getRideDepartureDate,
  isRideExpired,
  getChatExpiryDate,
  isChatExpired,
  getChatDisappearDate,
  hasChatDisappeared,
};
