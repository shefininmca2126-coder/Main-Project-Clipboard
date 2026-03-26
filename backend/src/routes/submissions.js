const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const { pool } = require('../config/database');
const { verifyJWT, requireStudent, requireTeacher } = require('../middleware/auth');
const { emitNewSubmission, emitSubmissionOcrDone } = require('../services/socketService');

const router = express.Router();

const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = (file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/gif' ? '.gif' : file.mimetype === 'image/webp' ? '.webp' : '.jpg');
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only image files are allowed (PNG, JPEG, GIF, WebP)'));
    }
    cb(null, true);
  },
});

// POST /api/submissions/clipboard - student only; single image file
router.post('/clipboard', verifyJWT, requireStudent, (req, res, next) => {
  const single = upload.single('image');
  single(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5 MB.' });
      }
      return res.status(400).json({ error: err.message || 'Invalid file' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Paste an image (Ctrl+V) in the question area.' });
    }

    const studentId = req.user.id;
    const storedPath = req.file.filename;

    let questionSetId = null;
    let examSessionId = null;
    const batchId = req.user.batchId;
    if (batchId) {
      const [rows] = await pool.query(
        'SELECT question_set_id FROM assignments WHERE student_id = ? AND batch_id = ?',
        [studentId, batchId]
      );
      if (rows.length > 0) {
        questionSetId = rows[0].question_set_id;
      }

      // Try to find an active exam session for this batch (and optionally this question set)
      const [sessionRows] = await pool.query(
        `SELECT id
         FROM exam_sessions
         WHERE batch_id = ?
           AND start_time <= NOW() AND end_time >= NOW()
           AND status IN ('scheduled', 'running')
         ORDER BY start_time DESC
         LIMIT 1`,
        [batchId]
      );
      if (sessionRows.length > 0) {
        examSessionId = sessionRows[0].id;
      }
    }

    const [result] = await pool.query(
      'INSERT INTO submissions (student_id, image_path, extracted_text, question_set_id, exam_session_id) VALUES (?, ?, NULL, ?, ?)',
      [studentId, storedPath, questionSetId, examSessionId]
    );
    const submissionId = result.insertId;

    res.status(201).json({
      id: submissionId,
      message: 'Screenshot captured.',
      imagePath: storedPath,
    });

    // Emit to teachers immediately so they see the paste in real time (before OCR)
    console.log('📤 Preparing to emit submission:', submissionId);
    try {
      const [rows] = await pool.query(
        `SELECT s.id, s.submitted_at, s.exam_session_id,
                u.full_name AS student_name, u.roll_number,
                b.name AS batch_name
         FROM submissions s
         INNER JOIN users u ON u.id = s.student_id
         LEFT JOIN batches b ON b.id = u.batch_id
         WHERE s.id = ?`,
        [submissionId]
      );
      if (rows.length > 0) {
        const r = rows[0];
        console.log('✅ Submission data ready, emitting:', r.student_name);
        emitNewSubmission({
          submissionId: r.id,
          examSessionId: r.exam_session_id || null,
          studentName: r.student_name,
          rollNumber: r.roll_number || '',
          batchName: r.batch_name || '',
          timestamp: r.submitted_at,
          extractedText: null,
        });
      }
    } catch (emitErr) {
      console.error('❌ Emit new submission failed', emitErr);
    }

    // OCR in background; when done, emit update so teacher sees extracted text
    setImmediate(async () => {
      let extractedText = null;
      const fullPath = path.join(uploadDir, storedPath);
      try {
        const worker = await createWorker('eng');
        const { data } = await worker.recognize(fullPath);
        await worker.terminate();
        extractedText = (data?.text || '').trim() || null;
        if (extractedText) {
          await pool.query('UPDATE submissions SET extracted_text = ? WHERE id = ?', [extractedText, submissionId]);
        }
      } catch (ocrErr) {
        console.warn('OCR failed for submission', submissionId, ocrErr.message);
      }
      emitSubmissionOcrDone(submissionId, extractedText);
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

// GET /api/submissions - list submissions (teacher), optional ?batchId=
router.get('/', verifyJWT, requireTeacher, async (req, res) => {
  try {
    const batchId = req.query.batchId ? parseInt(req.query.batchId, 10) : null;
    const examSessionId = req.query.examSessionId ? parseInt(req.query.examSessionId, 10) : null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    let sql = `SELECT s.id, s.student_id, s.image_path, s.extracted_text, s.question_set_id, s.exam_session_id, s.submitted_at, s.marks, s.feedback,
                u.full_name AS student_name, u.roll_number, b.name AS batch_name
               FROM submissions s
               INNER JOIN users u ON u.id = s.student_id
               LEFT JOIN batches b ON b.id = u.batch_id
               WHERE 1=1`;
    const params = [];
    if (batchId && !Number.isNaN(batchId)) {
      sql += ' AND u.batch_id = ?';
      params.push(batchId);
    }
    if (examSessionId && !Number.isNaN(examSessionId)) {
      sql += ' AND s.exam_session_id = ?';
      params.push(examSessionId);
    }
    sql += ' ORDER BY s.submitted_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// PUT /api/submissions/:id/marks - update marks and feedback (teacher only)
router.put('/:id/marks', verifyJWT, requireTeacher, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid submission id' });

    const { marks, feedback } = req.body;

    // Validate marks if provided
    if (marks !== null && marks !== undefined) {
      const marksNum = Number(marks);
      if (Number.isNaN(marksNum) || marksNum < 0) {
        return res.status(400).json({ error: 'Marks must be a non-negative number' });
      }
    }

    // Check if submission exists
    const [rows] = await pool.query('SELECT id FROM submissions WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Update marks and feedback
    await pool.query(
      'UPDATE submissions SET marks = ?, feedback = ? WHERE id = ?',
      [marks !== null && marks !== undefined ? Number(marks) : null, feedback || null, id]
    );

    res.json({
      success: true,
      message: 'Marks and feedback updated successfully',
      marks: marks !== null && marks !== undefined ? Number(marks) : null,
      feedback: feedback || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update marks' });
  }
});

// GET /api/submissions/my - student's own submissions with marks and feedback
router.get('/my', verifyJWT, requireStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const sql = `SELECT s.id, s.image_path, s.extracted_text, s.question_set_id, s.exam_session_id,
                        s.submitted_at, s.marks, s.feedback,
                        es.name AS exam_name, es.start_time, es.end_time
                 FROM submissions s
                 LEFT JOIN exam_sessions es ON es.id = s.exam_session_id
                 WHERE s.student_id = ?
                 ORDER BY s.submitted_at DESC
                 LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(sql, [studentId, limit, offset]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /api/submissions/:id/image - serve image file (teacher or student for their own); token in query for img src
router.get('/:id/image', (req, res, next) => {
  const token = req.query.token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (token) req.headers.authorization = `Bearer ${token}`;
  next();
}, verifyJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid submission id' });

    const [rows] = await pool.query('SELECT image_path, student_id FROM submissions WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

    // Check authorization: teachers can view all, students can only view their own
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      if (req.user.role === 'student' && rows[0].student_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only view your own submissions' });
      }
      if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const filePath = path.join(uploadDir, rows[0].image_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Image file not found' });
    res.sendFile(path.resolve(filePath), { headers: { 'Cache-Control': 'private, max-age=3600' } }, (err) => {
      if (err && !res.headersSent) res.status(500).send('Error sending file');
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load image' });
  }
});
module.exports = router;