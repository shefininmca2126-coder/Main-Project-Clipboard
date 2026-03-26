const ALLOWED_DOMAIN = '@saintgits.org';

function isAllowedEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(ALLOWED_DOMAIN);
}

module.exports = { isAllowedEmail, ALLOWED_DOMAIN };
