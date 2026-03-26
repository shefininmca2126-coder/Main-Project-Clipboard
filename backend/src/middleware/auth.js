const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, email: decoded.email, role: decoded.role, batchId: decoded.batchId };
    console.log('🔐 JWT verified:', req.user);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireStudent(req, res, next) {
  console.log('🎓 Student middleware - User role:', req.user?.role);
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Student access only' });
  }
  next();
}

function requireTeacher(req, res, next) {
  console.log('👨‍🏫 Teacher middleware - User role:', req.user?.role);
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access only' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }
  next();
}

module.exports = { verifyJWT, requireStudent, requireTeacher, requireAdmin, JWT_SECRET };
