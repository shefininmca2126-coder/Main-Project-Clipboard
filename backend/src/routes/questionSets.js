const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const { pool } = require('../config/database');
const { verifyJWT, requireTeacher } = require('../middleware/auth');

const router = express.Router();
router.use(verifyJWT, requireTeacher);

// Configure multer for PDF uploads
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB

const pdfStorage = multer.memoryStorage(); // Store in memory for processing
const pdfUpload = multer({
  storage: pdfStorage,
  limits: { fileSize: MAX_PDF_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
});

// Helper function to parse questions from extracted PDF text
function parseQuestionsFromText(text) {
  // Clean up the text by removing extra whitespace and normalizing line breaks
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split by common question patterns
  const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const questions = [];
  let currentQuestion = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line starts with a number (like "1.", "2)", "Q1.", etc.)
    const questionNumberPattern = /^(\d+[\.\)]|Q\d+[\.\:]|Question\s+\d+[\.\:])/i;

    if (questionNumberPattern.test(line)) {
      // If we have a current question, save it
      if (currentQuestion.trim()) {
        questions.push(currentQuestion.trim());
      }
      // Start new question (remove the number prefix)
      currentQuestion = line.replace(questionNumberPattern, '').trim();
    } else if (line.endsWith('?') && currentQuestion) {
      // If line ends with question mark and we have a current question, complete it
      currentQuestion += ' ' + line;
      questions.push(currentQuestion.trim());
      currentQuestion = '';
    } else if (line.endsWith('?') && !currentQuestion) {
      // Single line question
      questions.push(line.trim());
    } else if (currentQuestion) {
      // Continue building current question
      currentQuestion += ' ' + line;
    } else {
      // Check if line looks like a standalone question (has question words)
      const questionWords = /^(what|who|when|where|why|how|which|can|do|does|did|is|are|was|were|will|would|could|should|explain|define|describe|calculate|find|determine)/i;
      if (questionWords.test(line) || line.endsWith('?')) {
        questions.push(line.trim());
      }
    }
  }

  // Add any remaining question
  if (currentQuestion.trim()) {
    questions.push(currentQuestion.trim());
  }

  // Filter out very short or empty questions
  return questions.filter(q => q.length > 10);
}

// PUT /api/question-sets/:setId - update question set name
router.put('/question-sets/:setId', async (req, res) => {
  try {
    const setId = parseInt(req.params.setId, 10);
    const { name } = req.body;
    if (Number.isNaN(setId) || !name || !String(name).trim()) {
      return res.status(400).json({ error: 'Set id and name are required' });
    }
    await pool.query('UPDATE question_sets SET name = ? WHERE id = ? AND created_by = ?', [
      String(name).trim(),
      setId,
      req.user.id,
    ]);
    const [rows] = await pool.query(
      'SELECT id, name, batch_id, created_by, created_at FROM question_sets WHERE id = ?',
      [setId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Question set not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update question set' });
  }
});

// DELETE /api/question-sets/:setId
router.delete('/question-sets/:setId', async (req, res) => {
  try {
    const setId = parseInt(req.params.setId, 10);
    if (Number.isNaN(setId)) return res.status(400).json({ error: 'Invalid set id' });
    const [result] = await pool.query('DELETE FROM question_sets WHERE id = ? AND created_by = ?', [
      setId,
      req.user.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Question set not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete question set' });
  }
});

// POST /api/question-sets/:setId/upload-pdf - upload PDF and extract questions
router.post('/question-sets/:setId/upload-pdf', (req, res, next) => {
  const single = pdfUpload.single('pdf');
  single(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'PDF file too large. Maximum size is 10 MB.' });
      }
      return res.status(400).json({ error: err.message || 'Invalid PDF file' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const setId = parseInt(req.params.setId, 10);
    if (Number.isNaN(setId)) {
      return res.status(400).json({ error: 'Invalid set id' });
    }

    // Verify the question set exists and user has permission
    const [setRows] = await pool.query('SELECT id FROM question_sets WHERE id = ? AND created_by = ?', [
      setId,
      req.user.id,
    ]);
    if (setRows.length === 0) {
      return res.status(404).json({ error: 'Question set not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Extract text from PDF using pdf-parse v2
    // Convert Buffer to Uint8Array as required by pdf-parse v2
    const uint8Array = new Uint8Array(req.file.buffer);
    const pdfParser = new PDFParse(uint8Array);
    await pdfParser.load();

    // getText() returns an object with a 'text' property in v2
    const result = await pdfParser.getText();
    const extractedText = result.text || '';

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from PDF. The PDF may be empty or contain only images.' });
    }

    // Parse questions from the extracted text
    const questions = parseQuestionsFromText(extractedText);

    if (questions.length === 0) {
      return res.status(400).json({
        error: 'No questions could be identified in the PDF. Please ensure questions are numbered (1., 2., etc.) or end with a question mark (?)',
        extractedTextPreview: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : '')
      });
    }

    // Add each question to the database
    const addedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const questionText = questions[i];
      const [result] = await pool.query(
        'INSERT INTO questions (question_set_id, question_text, order_index) VALUES (?, ?, ?)',
        [setId, questionText, i]
      );
      addedQuestions.push({
        id: result.insertId,
        question_text: questionText,
        order_index: i
      });
    }

    res.json({
      message: `Successfully extracted and added ${addedQuestions.length} questions from PDF`,
      questionsAdded: addedQuestions.length,
      questions: addedQuestions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

// GET /api/question-sets/:setId/questions
router.get('/question-sets/:setId/questions', async (req, res) => {
  try {
    const setId = parseInt(req.params.setId, 10);
    if (Number.isNaN(setId)) return res.status(400).json({ error: 'Invalid set id' });
    const [rows] = await pool.query(
      'SELECT id, question_set_id, question_text, order_index, created_at FROM questions WHERE question_set_id = ? ORDER BY order_index, id',
      [setId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// POST /api/question-sets/:setId/questions
router.post('/question-sets/:setId/questions', async (req, res) => {
  try {
    const setId = parseInt(req.params.setId, 10);
    const { questionText, orderIndex } = req.body;
    if (Number.isNaN(setId) || !questionText || !String(questionText).trim()) {
      return res.status(400).json({ error: 'Set id and question text are required' });
    }
    const [setRows] = await pool.query('SELECT id FROM question_sets WHERE id = ? AND created_by = ?', [
      setId,
      req.user.id,
    ]);
    if (setRows.length === 0) return res.status(404).json({ error: 'Question set not found' });

    const order = orderIndex != null ? parseInt(orderIndex, 10) : 0;
    const [result] = await pool.query(
      'INSERT INTO questions (question_set_id, question_text, order_index) VALUES (?, ?, ?)',
      [setId, String(questionText).trim(), Number.isNaN(order) ? 0 : order]
    );
    const [rows] = await pool.query(
      'SELECT id, question_set_id, question_text, order_index, created_at FROM questions WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// PUT /api/questions/:questionId
router.put('/questions/:questionId', async (req, res) => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
    const { questionText, orderIndex } = req.body;
    if (Number.isNaN(questionId)) return res.status(400).json({ error: 'Invalid question id' });
    const updates = [];
    const values = [];
    if (questionText !== undefined) {
      updates.push('q.question_text = ?');
      values.push(String(questionText).trim());
    }
    if (orderIndex !== undefined) {
      updates.push('q.order_index = ?');
      values.push(parseInt(orderIndex, 10));
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    await pool.query(
      `UPDATE questions q
       INNER JOIN question_sets qs ON q.question_set_id = qs.id
       SET ${updates.join(', ')} WHERE q.id = ? AND qs.created_by = ?`,
      [...values, questionId, req.user.id]
    );
    const [rows] = await pool.query(
      'SELECT id, question_set_id, question_text, order_index, created_at FROM questions WHERE id = ?',
      [questionId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// DELETE /api/questions/:questionId
router.delete('/questions/:questionId', async (req, res) => {
  try {
    const questionId = parseInt(req.params.questionId, 10);
    if (Number.isNaN(questionId)) return res.status(400).json({ error: 'Invalid question id' });
    const [result] = await pool.query(
      `DELETE q FROM questions q
       INNER JOIN question_sets qs ON q.question_set_id = qs.id
       WHERE q.id = ? AND qs.created_by = ?`,
      [questionId, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Question not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

module.exports = router;
