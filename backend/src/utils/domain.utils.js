const prisma = require('../config/db');

/**
 * Allowed-domain source of truth = the `Domain` table (managed by Super Admin
 * via the admin panel), NOT a hardcoded list and NOT client-controlled input.
 *
 * GMAIL EXCEPTION: `gmail.com` is ALWAYS allowed regardless of the Domain
 * table — general users commonly sign up with gmail, and gmail accounts must
 * never be gated behind organization-domain registration.
 *
 * A short in-process cache avoids hitting the DB on every registration/OTP
 * request. `invalidateDomainCache()` is called by the admin service whenever
 * a domain is created/updated/deleted, so changes take effect immediately —
 * the cache TTL is just a safety net, not the primary invalidation path.
 */
const GMAIL_DOMAIN = 'gmail.com';
const CACHE_TTL_MS = 60 * 1000;
let _cache = { domains: null, expiresAt: 0 };

/**
 * Force the next call to isAllowedDomain/getActiveDomains to re-read the DB.
 * Call this after any create/update/delete on the Domain table.
 */
const invalidateDomainCache = () => {
  _cache = { domains: null, expiresAt: 0 };
};

/**
 * Return the current list of active allowed domain names (lowercased),
 * reading from cache when fresh. Only domains with status ACTIVE are usable
 * for organization-branch signup (PENDING ones are not yet approved).
 */
const getActiveDomains = async () => {
  const now = Date.now();
  if (_cache.domains && now < _cache.expiresAt) {
    return _cache.domains;
  }

  const rows = await prisma.domain.findMany({
    where : { status: 'ACTIVE', isActive: true },
    select: { name: true },
  });

  const domains = rows.map((d) => d.name.toLowerCase());
  _cache = { domains, expiresAt: now + CACHE_TTL_MS };
  return domains;
};

/**
 * Extract the domain part from an email address.
 * @param {string} email
 * @returns {string|null}
 */
const extractDomain = (email) => {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1].toLowerCase();
};

const isGmailEmail = (email) => extractDomain(email) === GMAIL_DOMAIN;

/**
 * Look up a domain in the Domain table (any status).
 * @param {string} domain lowercase domain name
 */
const findDomainRecord = async (domain) =>
  prisma.domain.findUnique({ where: { name: domain } });

/**
 * Create (or refresh) a PENDING Domain record for a domain a user tried to
 * sign up with, so admins can see and approve it. Never flips an existing
 * ACTIVE record back to pending. Returns the record.
 */
const upsertPendingDomain = async (domain) => {
  const existing = await prisma.domain.findUnique({ where: { name: domain } });
  if (existing) {
    if (existing.status === 'PENDING') {
      // Refresh the requestedAt timestamp so admins see fresh interest.
      return prisma.domain.update({
        where : { id: existing.id },
        data  : { requestedAt: new Date() },
      });
    }
    return existing;
  }
  return prisma.domain.create({
    data: {
      name        : domain,
      status      : 'PENDING',
      isActive    : false,
      requestedAt : new Date(),
    },
  });
};

/**
 * Return true if the email is allowed to register:
 * - gmail.com is ALWAYS allowed (general-user exception), OR
 * - the domain exists in the Domain table with status ACTIVE.
 * Async because it's DB-backed.
 */
const isAllowedDomain = async (email) => {
  const domain = extractDomain(email);
  if (!domain) return false;
  if (domain === GMAIL_DOMAIN) return true;

  const active = await getActiveDomains();
  return active.includes(domain);
};

module.exports = {
  GMAIL_DOMAIN,
  extractDomain,
  isGmailEmail,
  isAllowedDomain,
  getActiveDomains,
  findDomainRecord,
  upsertPendingDomain,
  invalidateDomainCache,
};
