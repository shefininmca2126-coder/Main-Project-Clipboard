const express = require('express');
const { pool } = require('../config/database');
const { verifyJWT, requireTeacher } = require('../middleware/auth');

const router = express.Router();
router.use(verifyJWT, requireTeacher);

// POST /api/batches/:batchId/distribute
// Body: { strategy: 'rollRange'|'oddEven'|'random'|'manual', ... }
router.post('/:batchId/distribute', async (req, res) => {
  try {
    const batchId = parseInt(req.params.batchId, 10);
    const { strategy } = req.body;
    if (Number.isNaN(batchId) || !strategy) {
      return res.status(400).json({ error: 'Batch id and strategy are required' });
    }

    const [batchRows] = await pool.query('SELECT id FROM batches WHERE id = ?', [batchId]);
    if (batchRows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const [students] = await pool.query(
      'SELECT id, roll_number FROM users WHERE role = ? AND batch_id = ? ORDER BY id',
      ['student', batchId]
    );
    if (students.length === 0) {
      return res.status(400).json({ error: 'No students in this batch' });
    }

    const [sets] = await pool.query(
      'SELECT id FROM question_sets WHERE batch_id = ? ORDER BY id',
      [batchId]
    );
    const setIds = sets.map((s) => s.id);
    if (setIds.length === 0) {
      return res.status(400).json({ error: 'No question sets in this batch. Create at least one set.' });
    }

    let assignments; // array of { studentId, questionSetId }

    if (strategy === 'rollRange') {
      const { ranges } = req.body; // [{ min: 1, max: 5, questionSetId: 1 }, ...]
      if (!Array.isArray(ranges) || ranges.length === 0) {
        return res.status(400).json({ error: 'rollRange requires ranges array: [{ min, max, questionSetId }]' });
      }
      assignments = [];
      for (const stu of students) {
        const roll = parseInt(String(stu.roll_number).trim(), 10);
        let found = false;
        for (const r of ranges) {
          const min = parseInt(r.min, 10);
          const max = parseInt(r.max, 10);
          if (!Number.isNaN(min) && !Number.isNaN(max) && roll >= min && roll <= max && setIds.includes(r.questionSetId)) {
            assignments.push({ studentId: stu.id, questionSetId: r.questionSetId });
            found = true;
            break;
          }
        }
        if (!found) {
          assignments.push({ studentId: stu.id, questionSetId: setIds[0] });
        }
      }
    } else if (strategy === 'oddEven') {
      const { oddSetId, evenSetId } = req.body;
      const oddId = setIds.includes(oddSetId) ? oddSetId : setIds[0];
      const evenId = setIds.includes(evenSetId) ? evenSetId : (setIds[1] ?? setIds[0]);
      assignments = students.map((stu) => {
        const roll = parseInt(String(stu.roll_number).trim(), 10);
        const isOdd = Number.isNaN(roll) ? true : roll % 2 !== 0;
        return { studentId: stu.id, questionSetId: isOdd ? oddId : evenId };
      });
    } else if (strategy === 'random') {
      const shuffled = [...students].sort(() => Math.random() - 0.5);
      assignments = shuffled.map((stu, i) => ({
        studentId: stu.id,
        questionSetId: setIds[i % setIds.length],
      }));
    } else if (strategy === 'manual') {
      const { assignments: manualList } = req.body; // [{ studentId, questionSetId }, ...]
      if (!Array.isArray(manualList) || manualList.length === 0) {
        return res.status(400).json({ error: 'manual requires assignments array: [{ studentId, questionSetId }]' });
      }
      const studentIds = new Set(students.map((s) => s.id));
      assignments = manualList
        .filter((a) => studentIds.has(a.studentId) && setIds.includes(a.questionSetId))
        .map((a) => ({ studentId: a.studentId, questionSetId: a.questionSetId }));
      const assignedStudents = new Set(assignments.map((a) => a.studentId));
      for (const stu of students) {
        if (!assignedStudents.has(stu.id)) {
          assignments.push({ studentId: stu.id, questionSetId: setIds[0] });
        }
      }
    } else {
      return res.status(400).json({ error: 'Invalid strategy. Use rollRange, oddEven, random, or manual.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const a of assignments) {
        await conn.query(
          `INSERT INTO assignments (student_id, batch_id, question_set_id) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE question_set_id = VALUES(question_set_id)`,
          [a.studentId, batchId, a.questionSetId]
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    res.json({ message: 'Distribution completed', count: assignments.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Distribution failed' });
  }
});

module.exports = router;
