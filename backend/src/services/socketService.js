const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TEACHERS_ROOM = 'teachers';

let io = null;

function setIO(ioInstance) {
  io = ioInstance;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = { id: decoded.userId, email: decoded.email, role: decoded.role };
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 Socket connected:', socket.user.email, '- Role:', socket.user.role);
    if (socket.user.role === 'teacher') {
      socket.join(TEACHERS_ROOM);
      console.log('👨‍🏫 Teacher joined room:', socket.user.email);
    }
    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected:', socket.user.email);
    });
  });
}

function getIO() {
  return io;
}

function emitNewSubmission(payload) {
  if (io) {
    console.log('📡 Emitting new_submission to teachers room:', payload.studentName);
    io.to(TEACHERS_ROOM).emit('new_submission', payload);
  } else {
    console.warn('⚠️ Socket.io not initialized, cannot emit submission');
  }
}

function emitSubmissionOcrDone(submissionId, extractedText) {
  if (io) {
    io.to(TEACHERS_ROOM).emit('submission_ocr_done', { submissionId, extractedText });
  }
}

module.exports = { setIO, getIO, emitNewSubmission, emitSubmissionOcrDone };
