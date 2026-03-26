const express = require('express');
const { pool } = require('../config/database');
const { verifyJWT, requireStudent } = require('../middleware/auth');

const router = express.Router();

console.log('📚 Student router module loaded');

router.use(verifyJWT, requireStudent);

// GET /api/student/assigned-set - returns the question set and questions for the current context.
// If there is an active exam session for the student's batch, we use that session's question set.
// Auto-distributes if distributionConfig is set and not yet distributed.
router.get('/assigned-set', async (req, res) => {
  try {
    const studentId = req.user.id;
    const batchId = req.user.batchId;
    if (!batchId) {
      return res.json({ assignment: null, questionSet: null, questions: [] });
    }

    // Check for active exam session for this batch
    const [sessionRows] = await pool.query(
      `SELECT e.id, e.question_set_id, e.distribution_config, e.auto_distributed, qs.name AS set_name
       FROM exam_sessions e
       INNER JOIN question_sets qs ON qs.id = e.question_set_id
       WHERE e.batch_id = ?
         AND e.start_time <= NOW() AND e.end_time >= NOW()
         AND e.status IN ('scheduled', 'running')
       ORDER BY e.start_time DESC
       LIMIT 1`,
      [batchId]
    );

    let questionSetId;
    let setName;

    if (sessionRows.length > 0) {
      const examSession = sessionRows[0];
      const distConfig = examSession.distribution_config;
      const autoDistributed = examSession.auto_distributed;

      if (distConfig) {
        // Distribution mode: run auto-distribution if needed, then use assignment
        if (!autoDistributed) {
          await runAutoDistribution(examSession.id, batchId, distConfig);
        }

        // Check if this student has an assignment for this batch
        const [assignments] = await pool.query(
          `SELECT a.question_set_id, qs.name as set_name
           FROM assignments a
           INNER JOIN question_sets qs ON qs.id = a.question_set_id
           WHERE a.student_id = ? AND a.batch_id = ?`,
          [studentId, batchId]
        );

        if (assignments.length > 0) {
          questionSetId = assignments[0].question_set_id;
          setName = assignments[0].set_name;
        } else {
          // Fallback to exam's primary question set
          questionSetId = examSession.question_set_id;
          setName = examSession.set_name;
        }
      } else {
        // Single set mode: use exam's primary question set directly
        questionSetId = examSession.question_set_id;
        setName = examSession.set_name;
      }
    } else {
      // No active exam session; fall back to per-student assignment
      const [assignments] = await pool.query(
        `SELECT a.question_set_id, qs.name as set_name
         FROM assignments a
         INNER JOIN question_sets qs ON qs.id = a.question_set_id
         WHERE a.student_id = ? AND a.batch_id = ?`,
        [studentId, batchId]
      );

      if (assignments.length === 0) {
        return res.json({ assignment: null, questionSet: null, questions: [] });
      }

      questionSetId = assignments[0].question_set_id;
      setName = assignments[0].set_name;
    }

    const [questions] = await pool.query(
      'SELECT id, question_text, order_index FROM questions WHERE question_set_id = ? ORDER BY order_index, id',
      [questionSetId]
    );

    res.json({
      assignment: { questionSetId },
      questionSet: { id: questionSetId, name: setName },
      questions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assigned set' });
  }
});

// Helper: Run auto-distribution for an exam session
async function runAutoDistribution(examId, batchId, distConfigRaw) {
  const conn = await pool.getConnection();
  try {
    const distConfig = typeof distConfigRaw === 'string' ? JSON.parse(distConfigRaw) : distConfigRaw;
    const { strategy, config } = distConfig;

    // Get all students in this batch
    const [students] = await conn.query(
      "SELECT id, roll_number FROM users WHERE role = 'student' AND batch_id = ? ORDER BY roll_number ASC",
      [batchId]
    );

    if (students.length === 0) {
      await conn.query('UPDATE exam_sessions SET auto_distributed = TRUE WHERE id = ?', [examId]);
      return;
    }

    // Determine assignments based on strategy
    const assignments = [];

    if (strategy === 'random' && config.questionSetIds) {
      const setIds = config.questionSetIds;
      for (const student of students) {
        const randomSetId = setIds[Math.floor(Math.random() * setIds.length)];
        assignments.push([student.id, batchId, randomSetId]);
      }
    } else if (strategy === 'oddEven' && config.oddSetId && config.evenSetId) {
      for (const student of students) {
        const rollNum = parseInt(student.roll_number, 10) || 0;
        const setId = rollNum % 2 === 1 ? config.oddSetId : config.evenSetId;
        assignments.push([student.id, batchId, setId]);
      }
    } else if (strategy === 'rollRange' && config.ranges) {
      for (const student of students) {
        const rollNum = parseInt(student.roll_number, 10) || 0;
        let assignedSetId = null;
        for (const range of config.ranges) {
          if (rollNum >= range.min && rollNum <= range.max) {
            assignedSetId = range.questionSetId;
            break;
          }
        }
        if (assignedSetId) {
          assignments.push([student.id, batchId, assignedSetId]);
        }
      }
    } else if (strategy === 'manual' && config.assignments) {
      // Manual strategy: use the pre-defined assignments from config
      for (const assignment of config.assignments) {
        const studentId = assignment.studentId;
        const questionSetId = assignment.questionSetId;
        if (studentId && questionSetId) {
          assignments.push([studentId, batchId, questionSetId]);
        }
      }
    }

    // Insert assignments (upsert)
    await conn.beginTransaction();
    for (const [studentId, bId, setId] of assignments) {
      await conn.query(
        `INSERT INTO assignments (student_id, batch_id, question_set_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE question_set_id = VALUES(question_set_id)`,
        [studentId, bId, setId]
      );
    }

    // Mark as distributed
    await conn.query('UPDATE exam_sessions SET auto_distributed = TRUE WHERE id = ?', [examId]);
    await conn.commit();

    console.log(`✅ Auto-distributed exam ${examId}: ${assignments.length} students assigned`);
  } catch (err) {
    await conn.rollback();
    console.error('Auto-distribution failed:', err);
  } finally {
    conn.release();
  }
}

function mapExamSession(row) {
  return {
    id: row.id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    questionSetId: row.question_set_id,
  };
}

// GET /api/student/exams/ongoing - active exams for the student's batch
router.get('/exams/ongoing', async (req, res) => {
  console.log('📝 /exams/ongoing hit - User:', req.user);
  try {
    const batchId = req.user.batchId;
    if (!batchId) return res.json([]);
    const [rows] = await pool.query(
      `SELECT * FROM exam_sessions
       WHERE batch_id = ? AND start_time <= NOW() AND end_time >= NOW()
         AND status IN ('scheduled', 'running')
       ORDER BY start_time ASC`,
      [batchId]
    );
    res.json(rows.map(mapExamSession));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ongoing exams' });
  }
});

// GET /api/student/exams/upcoming - future exams for the student's batch
router.get('/exams/upcoming', async (req, res) => {
  try {
    const batchId = req.user.batchId;
    if (!batchId) return res.json([]);
    const [rows] = await pool.query(
      `SELECT * FROM exam_sessions
       WHERE batch_id = ? AND start_time > NOW()
         AND status IN ('scheduled', 'running')
       ORDER BY start_time ASC`,
      [batchId]
    );
    res.json(rows.map(mapExamSession));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch upcoming exams' });
  }
});

// GET /api/student/exams/past - completed exams for the student's batch
router.get('/exams/past', async (req, res) => {
  try {
    const batchId = req.user.batchId;
    if (!batchId) return res.json([]);
    const [rows] = await pool.query(
      `SELECT * FROM exam_sessions
       WHERE batch_id = ? AND end_time < NOW()
       ORDER BY end_time DESC`,
      [batchId]
    );
    res.json(rows.map(mapExamSession));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch past exams' });
  }
});

module.exports = router;
