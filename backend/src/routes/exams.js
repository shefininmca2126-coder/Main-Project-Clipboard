const express = require('express');
const { pool } = require('../config/database');
const { verifyJWT, requireTeacher } = require('../middleware/auth');

const router = express.Router();

// All /api/exams routes are teacher-only
router.use(verifyJWT, requireTeacher);

// POST /api/exams - create new exam session with optional distribution config
router.post('/', async (req, res) => {
  try {
    const { name, batchId, questionSetId, startTime, endTime, distributionConfig } = req.body;

    // distributionConfig is optional; if provided, it contains:
    // { strategy: 'random'|'oddEven'|'rollRange', config: {...} }

    if (!name || !batchId || !startTime || !endTime) {
      return res
        .status(400)
        .json({ error: 'Name, batch, start time and end time are required' });
    }

    const numericBatchId = parseInt(batchId, 10);
    if (Number.isNaN(numericBatchId)) {
      return res.status(400).json({ error: 'Invalid batch id' });
    }

    // Ensure teacher is assigned to this batch
    const [assignRows] = await pool.query(
      'SELECT id FROM teacher_batches WHERE teacher_id = ? AND batch_id = ?',
      [req.user.id, numericBatchId]
    );
    if (assignRows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this batch' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid start or end time' });
    }
    if (start >= end) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    // Batch existence check
    const [batchRows] = await pool.query('SELECT id FROM batches WHERE id = ?', [numericBatchId]);
    if (batchRows.length === 0) {
      return res.status(400).json({ error: 'Invalid batch' });
    }

    // Determine the primary question set ID (first one from distribution config, or the provided one)
    let primarySetId = questionSetId;
    if (distributionConfig && distributionConfig.config) {
      const cfg = distributionConfig.config;
      if (cfg.questionSetIds && cfg.questionSetIds.length > 0) {
        primarySetId = cfg.questionSetIds[0];
      } else if (cfg.oddSetId) {
        primarySetId = cfg.oddSetId;
      } else if (cfg.ranges && cfg.ranges.length > 0) {
        primarySetId = cfg.ranges[0].questionSetId;
      }
    }

    if (!primarySetId) {
      return res.status(400).json({ error: 'At least one question set is required' });
    }

    // Validate the primary question set
    const [setRows] = await pool.query('SELECT id, batch_id FROM question_sets WHERE id = ?', [primarySetId]);
    if (setRows.length === 0) {
      return res.status(400).json({ error: 'Invalid question set' });
    }
    if (setRows[0].batch_id !== numericBatchId) {
      return res.status(400).json({ error: 'Question set does not belong to this batch' });
    }

    // Insert with distribution_config
    const distConfigJson = distributionConfig ? JSON.stringify(distributionConfig) : null;
    const [result] = await pool.query(
      `INSERT INTO exam_sessions (name, batch_id, question_set_id, start_time, end_time, status, created_by, distribution_config, auto_distributed)
       VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, FALSE)`,
      [String(name).trim(), numericBatchId, primarySetId, start, end, req.user.id, distConfigJson]
    );

    const [rows] = await pool.query('SELECT * FROM exam_sessions WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create exam session' });
  }
});

// GET /api/exams - list teacher's exam sessions
router.get('/', async (req, res) => {
  try {
    const batchId = req.query.batchId ? parseInt(req.query.batchId, 10) : null;
    const status = req.query.status || null;
    const upcomingOnly = req.query.upcomingOnly === 'true';

    let sql = `SELECT e.*, b.name AS batch_name, qs.name AS question_set_name
               FROM exam_sessions e
               INNER JOIN batches b ON b.id = e.batch_id
               INNER JOIN question_sets qs ON qs.id = e.question_set_id
               WHERE e.created_by = ?`;
    const params = [req.user.id];

    if (batchId && !Number.isNaN(batchId)) {
      sql += ' AND e.batch_id = ?';
      params.push(batchId);
    }
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }
    if (upcomingOnly) {
      sql += ' AND e.start_time > NOW()';
    }
    sql += ' ORDER BY e.start_time DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list exam sessions' });
  }
});

// GET /api/exams/:id - one exam session
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid exam id' });

    const [rows] = await pool.query(
      `SELECT e.*, b.name AS batch_name, qs.name AS question_set_name
       FROM exam_sessions e
       INNER JOIN batches b ON b.id = e.batch_id
       INNER JOIN question_sets qs ON qs.id = e.question_set_id
       WHERE e.id = ? AND e.created_by = ?`,
      [id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Exam session not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load exam session' });
  }
});

// PUT /api/exams/:id - update exam session
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid exam id' });

    const fields = [];
    const values = [];
    const { name, startTime, endTime, status } = req.body;

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(String(name).trim());
    }
    if (startTime !== undefined) {
      fields.push('start_time = ?');
      values.push(new Date(startTime));
    }
    if (endTime !== undefined) {
      fields.push('end_time = ?');
      values.push(new Date(endTime));
    }
    if (status !== undefined) {
      fields.push('status = ?');
      values.push(status);
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, req.user.id);
    const [result] = await pool.query(
      `UPDATE exam_sessions SET ${fields.join(', ')} WHERE id = ? AND created_by = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Exam session not found' });
    }
    const [rows] = await pool.query('SELECT * FROM exam_sessions WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update exam session' });
  }
});

// GET /api/exams/:id/stats - basic stats for session
router.get('/:id/stats', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid exam id' });

    const [sessions] = await pool.query(
      'SELECT batch_id FROM exam_sessions WHERE id = ? AND created_by = ?',
      [id, req.user.id]
    );
    if (sessions.length === 0) return res.status(404).json({ error: 'Exam session not found' });
    const batchId = sessions[0].batch_id;

    const [[studentsRow]] = await pool.query(
      "SELECT COUNT(*) AS total_students FROM users WHERE role = 'student' AND batch_id = ?",
      [batchId]
    );
    const [[submittedRow]] = await pool.query(
      'SELECT COUNT(DISTINCT student_id) AS submitted_students FROM submissions WHERE exam_session_id = ?',
      [id]
    );

    res.json({
      totalStudents: studentsRow.total_students || 0,
      submittedStudents: submittedRow.submitted_students || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load exam stats' });
  }
});

module.exports = router;

