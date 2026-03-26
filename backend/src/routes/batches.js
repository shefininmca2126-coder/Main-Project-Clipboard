const express = require('express');
const { pool } = require('../config/database');
const { verifyJWT, requireTeacher } = require('../middleware/auth');

const router = express.Router();
router.use(verifyJWT, requireTeacher);

// GET /api/batches - list batches assigned to this teacher
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.name, b.created_at
       FROM teacher_batches tb
       INNER JOIN batches b ON b.id = tb.batch_id
       WHERE tb.teacher_id = ?
       ORDER BY b.name`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// GET /api/batches/:batchId/students - list students in batch
router.get('/:batchId/students', async (req, res) => {
  try {
    const batchId = parseInt(req.params.batchId, 10);
    if (Number.isNaN(batchId)) {
      return res.status(400).json({ error: 'Invalid batch id' });
    }
    const [[assignment]] = await pool.query(
      'SELECT id FROM teacher_batches WHERE teacher_id = ? AND batch_id = ?',
      [req.user.id, batchId]
    );
    if (!assignment) {
      return res.status(403).json({ error: 'You are not assigned to this batch' });
    }
    const [rows] = await pool.query(
      `SELECT id, full_name, email, roll_number, created_at
       FROM users WHERE role = 'student' AND batch_id = ? ORDER BY roll_number`,
      [batchId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/batches/:batchId/question-sets
router.get('/:batchId/question-sets', async (req, res) => {
  try {
    const batchId = parseInt(req.params.batchId, 10);
    if (Number.isNaN(batchId)) {
      return res.status(400).json({ error: 'Invalid batch id' });
    }
    const [[assignment]] = await pool.query(
      'SELECT id FROM teacher_batches WHERE teacher_id = ? AND batch_id = ?',
      [req.user.id, batchId]
    );
    if (!assignment) {
      return res.status(403).json({ error: 'You are not assigned to this batch' });
    }
    const [rows] = await pool.query(
      'SELECT id, name, batch_id, created_by, created_at FROM question_sets WHERE batch_id = ? ORDER BY id',
      [batchId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch question sets' });
  }
});

// POST /api/batches/:batchId/question-sets
router.post('/:batchId/question-sets', async (req, res) => {
  try {
    const batchId = parseInt(req.params.batchId, 10);
    const { name } = req.body;
    if (Number.isNaN(batchId) || !name || !String(name).trim()) {
      return res.status(400).json({ error: 'Batch id and set name are required' });
    }
    const [[assignment]] = await pool.query(
      'SELECT id FROM teacher_batches WHERE teacher_id = ? AND batch_id = ?',
      [req.user.id, batchId]
    );
    if (!assignment) {
      return res.status(403).json({ error: 'You are not assigned to this batch' });
    }
    const [result] = await pool.query(
      'INSERT INTO question_sets (name, batch_id, created_by) VALUES (?, ?, ?)',
      [String(name).trim(), batchId, req.user.id]
    );
    const [rows] = await pool.query(
      'SELECT id, name, batch_id, created_by, created_at FROM question_sets WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create question set' });
  }
});

// DELETE /api/batches/:batchId/students/:studentId - delete student from batch
router.delete('/:batchId/students/:studentId', async (req, res) => {
  try {
    const batchId = parseInt(req.params.batchId, 10);
    const studentId = parseInt(req.params.studentId, 10);

    if (Number.isNaN(batchId) || Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid batch id or student id' });
    }

    // Check if teacher is assigned to this batch
    const [[assignment]] = await pool.query(
      'SELECT id FROM teacher_batches WHERE teacher_id = ? AND batch_id = ?',
      [req.user.id, batchId]
    );
    if (!assignment) {
      return res.status(403).json({ error: 'You are not assigned to this batch' });
    }

    // Check if student exists in this batch
    const [[student]] = await pool.query(
      'SELECT id, full_name FROM users WHERE id = ? AND batch_id = ? AND role = ?',
      [studentId, batchId, 'student']
    );
    if (!student) {
      return res.status(404).json({ error: 'Student not found in this batch' });
    }

    // Delete student (this will also delete related records due to foreign key constraints)
    await pool.query('DELETE FROM users WHERE id = ?', [studentId]);

    res.json({ message: `Student ${student.full_name} has been removed from the batch` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

module.exports = router;
