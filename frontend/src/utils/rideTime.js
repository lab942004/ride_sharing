// Mirrors backend/src/utils/rideTime.utils.js — keep these in sync.
//
// Ride times are entered by students in local (India) time. Building the
// departure instant with Date#setHours() (as this used to do) applies the
// BROWSER's local timezone, which is fine for users physically in India but
// wrong the moment this is ever computed anywhere else (or if `ride.date`
// isn't in the exact shape assumed). We use a fixed IST offset instead, so
// the result is deterministic everywhere.
const RIDE_TIME_UTC_OFFSET = '+05:30'
const CHAT_EXPIRY_HOURS = 2
const CHAT_DISAPPEAR_DAYS = 5

/**
 * `date` can be a Date, or a full ISO string (as returned by the API, e.g.
 * "2026-08-10T00:00:00.000Z"), or a plain "YYYY-MM-DD" string. We only ever
 * need the calendar-date portion.
 */
export function getRideDepartureDate(date, time) {
  const dateStr = new Date(date).toISOString().slice(0, 10)
  const [hh, mm] = (time || '00:00').split(':')
  const hours = hh.padStart(2, '0')
  const minutes = mm.padStart(2, '0')
  return new Date(`${dateStr}T${hours}:${minutes}:00${RIDE_TIME_UTC_OFFSET}`)
}

export function getChatExpiryDate(date, time) {
  const departure = getRideDepartureDate(date, time)
  return new Date(departure.getTime() + CHAT_EXPIRY_HOURS * 60 * 60 * 1000)
}

export function isChatExpired(date, time) {
  return getChatExpiryDate(date, time) < new Date()
}

export function getChatDisappearDate(date, time) {
  const departure = getRideDepartureDate(date, time)
  return new Date(departure.getTime() + CHAT_DISAPPEAR_DAYS * 24 * 60 * 60 * 1000)
}

export function hasChatDisappeared(date, time) {
  return getChatDisappearDate(date, time) < new Date()
}
