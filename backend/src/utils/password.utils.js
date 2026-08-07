const crypto = require('crypto');

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
const LOWER = 'abcdefghijkmnopqrstuvwxyz'; // no l
const DIGIT = '23456789'; // no 0/1
const SYMBOL = '!@#$%^&*-_=+';
const ALL = UPPER + LOWER + DIGIT + SYMBOL;

const randomChar = (charset) => charset[crypto.randomInt(charset.length)];

/**
 * Generate a cryptographically-random temporary password (CSPRNG via
 * crypto.randomInt, not Math.random()). Guarantees at least one uppercase,
 * one lowercase, one digit, and one symbol so it also satisfies the app's
 * own password-complexity Zod schema.
 *
 * @param {number} length
 * @returns {string}
 */
const generateSecurePassword = (length = 14) => {
  const required = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGIT), randomChar(SYMBOL)];
  const rest = Array.from({ length: Math.max(length - required.length, 0) }, () => randomChar(ALL));

  const chars = [...required, ...rest];

  // Fisher-Yates shuffle using a CSPRNG
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
};

module.exports = { generateSecurePassword };
