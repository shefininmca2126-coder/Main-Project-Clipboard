const rateLimit = require('express-rate-limit');

// Auth routes: limit login/register/OTP to reduce brute force and abuse
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter for sensitive auth actions (login + verify OTP)
const authStrictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, authStrictLimiter };
