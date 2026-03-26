const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// GET /api/public/batches - list all batches for public use (e.g. registration dropdown)
router.get('/public/batches', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, created_at FROM batches ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

module.exports = router;

