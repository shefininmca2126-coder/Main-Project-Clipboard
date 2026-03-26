const express = require('express');
const { testConnection } = require('../config/database');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/health/db', async (req, res) => {
  const result = await testConnection();
  if (result.ok) {
    res.json({ status: 'ok', database: 'connected' });
  } else {
    res.status(503).json({ status: 'error', database: 'disconnected', error: result.error });
  }
});

module.exports = router;
