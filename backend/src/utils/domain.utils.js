const DEFAULT_ALLOWED_DOMAINS = ['nitkkr.ac.in', 'gmail.com'];

/**
 * Extract the domain part from an email address.
 * @param {string} email
 * @returns {string|null}
 */
const extractDomain = (email) => {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1].toLowerCase();
};

const normalizeAllowedDomains = () => {
  const configured = (process.env.ALLOWED_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set([...DEFAULT_ALLOWED_DOMAINS, ...configured])];
};

/**
 * Return true if the email belongs to one of the allowed domains.
 * Uses a default allowlist for Gmail and the college domain, and merges any
 * domains configured via ALLOWED_DOMAINS.
 */
const isAllowedDomain = (email) => {
  const domain = extractDomain(email);
  if (!domain) return false;

  return normalizeAllowedDomains().includes(domain);
};

module.exports = { extractDomain, isAllowedDomain };
