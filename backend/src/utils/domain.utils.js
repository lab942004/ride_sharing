const prisma = require('../config/db');

/**
 * Allowed-domain source of truth = the `Domain` table (managed by Super Admin
 * via the admin panel), NOT a hardcoded list and NOT client-controlled input.
 *
 * SECURITY NOTE: there is intentionally no hardcoded fallback allowlist here
 * (no 'gmail.com', no default college domain). Whatever the Super Admin has
 * marked `isActive: true` in the Domain table is what's allowed — nothing
 * more. On first deploy, seed exactly the domain(s) you want via the admin
 * panel or `prisma/seed.js`.
 *
 * A short in-process cache avoids hitting the DB on every registration/OTP
 * request. `invalidateDomainCache()` is called by the admin service whenever
 * a domain is created/updated/deleted, so changes take effect immediately —
 * the cache TTL is just a safety net, not the primary invalidation path.
 */
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
 * reading from cache when fresh.
 */
const getActiveDomains = async () => {
  const now = Date.now();
  if (_cache.domains && now < _cache.expiresAt) {
    return _cache.domains;
  }

  const rows = await prisma.domain.findMany({
    where : { isActive: true },
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

/**
 * Return true if the email belongs to one of the domains currently marked
 * active in the Domain table. Async because it's DB-backed.
 */
const isAllowedDomain = async (email) => {
  const domain = extractDomain(email);
  if (!domain) return false;

  const active = await getActiveDomains();
  return active.includes(domain);
};

module.exports = { extractDomain, isAllowedDomain, getActiveDomains, invalidateDomainCache };
