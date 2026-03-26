require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const { Server } = require('socket.io');
const cors = require('cors');
const { authLimiter } = require('./middleware/rateLimit');
const { testConnection } = require('./config/database');
const { setIO } = require('./services/socketService');
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const adminBatchesRouter = require('./routes/adminBatches');
const adminUsersRouter = require('./routes/adminUsers');
const publicBatchesRouter = require('./routes/publicBatches');
const batchesRouter = require('./routes/batches');
const questionSetsRouter = require('./routes/questionSets');
const distributionRouter = require('./routes/distribution');
const studentRouter = require('./routes/student');
const submissionsRouter = require('./routes/submissions');
const examsRouter = require('./routes/exams');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure upload directory exists (for Phase 4 clipboard images)
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/admin', adminBatchesRouter);
app.use('/api/admin', adminUsersRouter);
app.use('/api', publicBatchesRouter);

// IMPORTANT: Mount specific routes BEFORE catch-all routes
app.use('/api/student', studentRouter);          // Student routes FIRST
app.use('/api/exams', examsRouter);              // Exam routes SECOND
app.use('/api/batches', batchesRouter);         // Batch routes
app.use('/api/batches', distributionRouter);    // Distribution
app.use('/api/submissions', submissionsRouter); // Submissions
app.use('/api', questionSetsRouter);             // Question sets LAST (catch-all)

console.log('✅ All routes registered');
console.log('   - /api/student → Student routes');
console.log('   - /api/exams → Teacher exam routes');
console.log('   - /api/batches → Batch routes');

app.get('/', (req, res) => {
  res.json({ message: 'AI Based Cross Platform Clipboard System API', version: '1.0.0' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
  path: '/socket.io',
  // Real-time optimization: Use WebSocket first, skip polling for faster connections
  transports: ['websocket', 'polling'],
  // Reduce ping interval for faster disconnect detection
  pingInterval: 10000,
  pingTimeout: 5000,
  // Allow upgrades but prefer websocket
  allowUpgrades: true,
  // Increase max payload for larger data if needed
  maxHttpBufferSize: 1e6,
});
setIO(io);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Upload directory: ${uploadDir}`);
  console.log('Socket.io enabled');
});
