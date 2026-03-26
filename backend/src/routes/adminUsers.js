const express = require('express');
const { pool } = require('../config/database');
const { verifyJWT, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(verifyJWT, requireAdmin);

// GET /api/admin/teachers - list all teachers
router.get('/teachers', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, full_name, email, department, created_at FROM users WHERE role = 'teacher' ORDER BY full_name"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

module.exports = router;

