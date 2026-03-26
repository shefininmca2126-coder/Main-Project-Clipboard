const express = require('express');
const { pool } = require('../config/database');
const { verifyJWT, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All /api/admin/batches routes require an authenticated admin
router.use(verifyJWT, requireAdmin);

// GET /api/admin/batches - list all batches
router.get('/batches', async (req, res) => {
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

// GET /api/admin/batches/:batchId/students - list students in a batch
router.get('/batches/:batchId/students', async (req, res) => {
  try {
    const batchId = parseInt(req.params.batchId, 10);
    if (Number.isNaN(batchId)) {
      return res.status(400).json({ error: 'Invalid batch id' });
    }
    const [rows] = await pool.query(
      `SELECT id, full_name, email, roll_number, created_at
       FROM users
       WHERE role = 'student' AND batch_id = ?
       ORDER BY roll_number`,
      [batchId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch batch students' });
  }
});

// POST /api/admin/batches - create a new batch
router.post('/batches', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Batch name is required' });
    }
    const trimmed = String(name).trim();

    const [existing] = await pool.query('SELECT id FROM batches WHERE LOWER(name) = LOWER(?)', [
      trimmed,
    ]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Batch with this name already exists' });
    }

    const [result] = await pool.query('INSERT INTO batches (name) VALUES (?)', [trimmed]);
    const [rows] = await pool.query(
      'SELECT id, name, created_at FROM batches WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// POST /api/admin/teachers/:teacherId/batches - assign teacher to a batch
router.post('/teachers/:teacherId/batches', async (req, res) => {
  try {
    const teacherId = parseInt(req.params.teacherId, 10);
    const { batchId } = req.body || {};
    const numericBatchId = parseInt(batchId, 10);
    if (Number.isNaN(teacherId) || Number.isNaN(numericBatchId)) {
      return res.status(400).json({ error: 'Valid teacherId and batchId are required' });
    }

    const [[teacher]] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? AND role = 'teacher'",
      [teacherId]
    );
    if (!teacher) {
      return res.status(400).json({ error: 'Teacher not found' });
    }

    const [[batch]] = await pool.query('SELECT id FROM batches WHERE id = ?', [numericBatchId]);
    if (!batch) {
      return res.status(400).json({ error: 'Batch not found' });
    }

    await pool.query(
      `INSERT INTO teacher_batches (teacher_id, batch_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE batch_id = VALUES(batch_id)`,
      [teacherId, numericBatchId]
    );

    res.status(201).json({ message: 'Teacher assigned to batch successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign teacher to batch' });
  }
});

// GET /api/admin/teachers/:teacherId/batches - list batches for a teacher
router.get('/teachers/:teacherId/batches', async (req, res) => {
  try {
    const teacherId = parseInt(req.params.teacherId, 10);
    if (Number.isNaN(teacherId)) {
      return res.status(400).json({ error: 'Invalid teacher id' });
    }
    const [rows] = await pool.query(
      `SELECT b.id, b.name, b.created_at
       FROM teacher_batches tb
       INNER JOIN batches b ON b.id = tb.batch_id
       WHERE tb.teacher_id = ?
       ORDER BY b.name`,
      [teacherId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teacher batches' });
  }
});

// DELETE /api/admin/teachers/:teacherId/batches/:batchId - remove assignment
router.delete('/teachers/:teacherId/batches/:batchId', async (req, res) => {
  try {
    const teacherId = parseInt(req.params.teacherId, 10);
    const batchId = parseInt(req.params.batchId, 10);
    if (Number.isNaN(teacherId) || Number.isNaN(batchId)) {
      return res.status(400).json({ error: 'Invalid teacher or batch id' });
    }
    await pool.query(
      'DELETE FROM teacher_batches WHERE teacher_id = ? AND batch_id = ?',
      [teacherId, batchId]
    );
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove assignment' });
  }
});

module.exports = router;

