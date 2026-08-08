module.exports = {
  // OTP
  OTP_EXPIRY_MINUTES       : 5,
  VERIFIED_EMAIL_EXPIRY_MIN: 30, // window to complete registration after OTP verify

  // Rides
  MAX_RIDE_DAYS_AHEAD: 7,

  // Ride departure times are entered by students in local (India) time.
  // Fixed offset — India does not observe DST, so this is safe to hardcode.
  RIDE_TIME_UTC_OFFSET: '+05:30',

  // Chat
  CHAT_EXPIRY_HOURS  : 2, // chat becomes read-only this many hours after ride departure
  CHAT_DISAPPEAR_DAYS: 5, // chat is removed entirely this many days after ride departure

  // Auth
  BCRYPT_ROUNDS: 12,

  // Request status enum mirrors Prisma
  REQUEST_STATUS: {
    PENDING : 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
  },

  // Vehicle types
  VEHICLE_TYPES: ['Car', 'Bike', 'Auto', 'Bus', 'Other'],

  // Pagination
  DEFAULT_PAGE : 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT    : 50,

  // Socket events
  SOCKET_EVENTS: {
    JOIN_CHAT        : 'join_chat',
    LEAVE_CHAT       : 'leave_chat',
    SEND_MESSAGE     : 'send_message',
    NEW_MESSAGE      : 'new_message',
    TYPING           : 'typing',
    STOP_TYPING      : 'stop_typing',
    USER_TYPING      : 'user_typing',
    USER_STOP_TYPING : 'user_stop_typing',
    JOINED_CHAT      : 'joined_chat',
    ERROR            : 'error',
    NEW_REQUEST      : 'new_request',    // notify ride owner of a new request
    REQUEST_STATUS   : 'request_status', // notify requester of status change
  },
};
