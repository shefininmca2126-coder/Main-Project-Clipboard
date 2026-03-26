const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { isAllowedEmail } = require('../utils/domainCheck');
const { sendOTPEmail } = require('../services/emailService');
const { verifyJWT } = require('../middleware/auth');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;
const OTP_EXIRY_MINUTES = 10;
const UNVERIFIED_USER_EXPIRY_MINUTES = 5;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const ADMIN_BOOTSTRAP_SECRET = process.env.ADMIN_BOOTSTRAP_SECRET || null;

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/register/student
router.post('/register/student', async (req, res) => {
  try {
    const { fullName, email, password, batchId, rollNumber } = req.body;
    if (!fullName || !email || !password || !batchId || !rollNumber) {
      return res
        .status(400)
        .json({ error: 'Full name, email, password, batch and roll number are required' });
    }
    if (!isAllowedEmail(email)) {
      return res.status(400).json({ error: 'Only @saintgits.org email addresses are allowed' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await pool.query('SELECT id, email_verified, created_at FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      if (existing[0].email_verified) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      const createdAt = new Date(existing[0].created_at).getTime();
      const expiryMs = UNVERIFIED_USER_EXPIRY_MINUTES * 60 * 1000;
      if (Date.now() - createdAt < expiryMs) {
        return res.status(409).json({
          error: 'This email is pending verification. Check your inbox for the OTP, or try again after 5 minutes to register again.',
        });
      }
      await pool.query('DELETE FROM users WHERE id = ?', [existing[0].id]);
    }

    const numericBatchId = parseInt(batchId, 10);
    if (Number.isNaN(numericBatchId)) {
      return res.status(400).json({ error: 'Invalid batch id' });
    }
    const [batches] = await pool.query('SELECT id FROM batches WHERE id = ?', [numericBatchId]);
    if (batches.length === 0) {
      return res.status(400).json({
        error: 'Selected batch does not exist. Please contact your admin if you cannot find your batch.',
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role, email_verified, batch_id, roll_number) VALUES (?, ?, ?, ?, 0, ?, ?)',
      [normalizedEmail, passwordHash, (fullName || '').trim(), 'student', numericBatchId, (rollNumber || '').trim()]
    );
    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    const userId = users[0].id;

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXIRY_MINUTES * 60 * 1000);
    await pool.query('INSERT INTO otp_verifications (user_id, otp_code, expires_at) VALUES (?, ?, ?)', [userId, otp, expiresAt]);

    const mailResult = await sendOTPEmail(normalizedEmail, otp);
    if (!mailResult.sent) {
      console.warn('OTP email failed:', mailResult.error);
    }

    res.status(201).json({
      message: 'Registration successful. Check your email for OTP to verify your account.',
      email: normalizedEmail,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/register/teacher
router.post('/register/teacher', async (req, res) => {
  try {
    const { fullName, email, password, department } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email and password are required' });
    }
    if (!isAllowedEmail(email)) {
      return res.status(400).json({ error: 'Only @saintgits.org email addresses are allowed' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await pool.query('SELECT id, email_verified, created_at FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      if (existing[0].email_verified) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      const createdAt = new Date(existing[0].created_at).getTime();
      const expiryMs = UNVERIFIED_USER_EXPIRY_MINUTES * 60 * 1000;
      if (Date.now() - createdAt < expiryMs) {
        return res.status(409).json({
          error: 'This email is pending verification. Check your inbox for the OTP, or try again after 5 minutes to register again.',
        });
      }
      await pool.query('DELETE FROM users WHERE id = ?', [existing[0].id]);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role, email_verified, department) VALUES (?, ?, ?, ?, 0, ?)',
      [normalizedEmail, passwordHash, (fullName || '').trim(), 'teacher', (department || '').trim() || null]
    );
    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    const userId = users[0].id;

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXIRY_MINUTES * 60 * 1000);
    await pool.query('INSERT INTO otp_verifications (user_id, otp_code, expires_at) VALUES (?, ?, ?)', [userId, otp, expiresAt]);

    const mailResult = await sendOTPEmail(normalizedEmail, otp);
    if (!mailResult.sent) {
      console.warn('OTP email failed:', mailResult.error);
    }

    res.status(201).json({
      message: 'Registration successful. Check your email for OTP to verify your account.',
      email: normalizedEmail,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const [users] = await pool.query('SELECT id, email_verified FROM users WHERE email = ?', [normalizedEmail]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (users[0].email_verified) {
      return res.json({ message: 'Account already verified. You can log in.' });
    }

    const [otps] = await pool.query(
      'SELECT id FROM otp_verifications WHERE user_id = ? AND otp_code = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [users[0].id, String(otp).trim()]
    );
    if (otps.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    await pool.query('UPDATE users SET email_verified = 1 WHERE id = ?', [users[0].id]);
    await pool.query('DELETE FROM otp_verifications WHERE user_id = ?', [users[0].id]);

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!isAllowedEmail(email)) {
      return res.status(400).json({ error: 'Only @saintgits.org email addresses are allowed' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [users] = await pool.query(
      'SELECT id, email, password_hash, full_name, role, email_verified, batch_id, department FROM users WHERE email = ?',
      [normalizedEmail]
    );
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = users[0];
    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email with the OTP sent to your inbox before logging in.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    if (user.role === 'student' && user.batch_id) payload.batchId = user.batch_id;
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        batchId: user.batch_id || undefined,
        department: user.department || undefined,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me (protected)
router.get('/me', verifyJWT, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, email, full_name, role, batch_id, department FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const u = users[0];
    res.json({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      role: u.role,
      batchId: u.batch_id || undefined,
      department: u.department || undefined,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/auth/bootstrap-admin
// One-time helper to create the first admin account.
// Protected by ADMIN_BOOTSTRAP_SECRET and disabled once an admin exists.
router.post('/bootstrap-admin', async (req, res) => {
  try {
    if (!ADMIN_BOOTSTRAP_SECRET) {
      return res.status(400).json({ error: 'ADMIN_BOOTSTRAP_SECRET is not configured on the server' });
    }

    const { secret, email, password, fullName } = req.body || {};
    if (!secret || !email || !password || !fullName) {
      return res
        .status(400)
        .json({ error: 'secret, fullName, email and password are required to bootstrap admin' });
    }
    if (secret !== ADMIN_BOOTSTRAP_SECRET) {
      return res.status(403).json({ error: 'Invalid bootstrap secret' });
    }

    const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (admins.length > 0) {
      return res.status(409).json({ error: 'An admin user already exists' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      "INSERT INTO users (email, password_hash, full_name, role, email_verified) VALUES (?, ?, ?, 'admin', 1)",
      [normalizedEmail, passwordHash, (fullName || '').trim()]
    );

    res.status(201).json({ message: 'Admin user created successfully', email: normalizedEmail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to bootstrap admin' });
  }
});

module.exports = router;
