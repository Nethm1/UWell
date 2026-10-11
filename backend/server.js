const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./src/config/db');
const { Server: SocketServer } = require('socket.io');

// Always load this backend's environment, including when npm is run from the
// repository root rather than from the backend directory.
dotenv.config({ path: path.resolve(__dirname, '.env') });

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const app = express();
const httpServer = http.createServer(app);

// ─── Socket.io — Video Session Signaling ─────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

app.set('io', io);
const { setGlobalIo } = require('./src/utils/notificationHelper');
setGlobalIo(io);

// Track which sockets are in which room
const roomParticipants = new Map(); // roomId → Set<socketId>

io.on('connection', (socket) => {
  console.log(`[Socket] connected: ${socket.id}`);

  // ── join-room ──────────────────────────────────────────────────────────────
  // payload: { roomId, userName, role ('student' | 'counselor') }
  socket.on('join-room', ({ roomId, userName, role }) => {
    if (!roomId) return;

    socket.join(roomId);
    socket.data.roomId   = roomId;
    socket.data.userName = userName || 'Unknown';
    socket.data.role     = role     || 'student';

    if (!roomParticipants.has(roomId)) roomParticipants.set(roomId, new Set());
    roomParticipants.get(roomId).add(socket.id);

    const count = roomParticipants.get(roomId).size;
    console.log(`[Socket] ${socket.id} (${role}) joined room ${roomId}. Total: ${count}`);

    // Tell this socket how many others are already in the room
    socket.emit('room-joined', { roomId, participantCount: count });

    // Tell everyone else that a new participant arrived
    socket.to(roomId).emit('peer-joined', {
      socketId: socket.id,
      userName: socket.data.userName,
      role:     socket.data.role,
    });
  });

  // ── leave-room ─────────────────────────────────────────────────────────────
  socket.on('leave-room', ({ roomId }) => {
    _leaveRoom(socket, roomId);
  });

  // ── WebRTC signaling relay ─────────────────────────────────────────────────
  // Forward offer/answer/ICE candidate to everyone else in the room
  socket.on('rtc-offer',     (payload) => socket.to(payload.roomId).emit('rtc-offer',     { ...payload, from: socket.id }));
  socket.on('rtc-answer',    (payload) => socket.to(payload.roomId).emit('rtc-answer',    { ...payload, from: socket.id }));
  socket.on('rtc-ice',       (payload) => socket.to(payload.roomId).emit('rtc-ice',       { ...payload, from: socket.id }));

  // ── user registration ──────────────────────────────────────────────────────
  socket.on('register-user', ({ userId, role }) => {
    if (!userId) return;
    if (socket.data.userId && socket.data.userId !== userId) {
      socket.leave('user:' + socket.data.userId);
      console.log('[Socket] user switch: left user:' + socket.data.userId);
    }
    socket.data.userId = userId;
    socket.data.role   = role || 'student';
    socket.join('user:' + userId);
    console.log('[Socket] registered user ' + userId + ' (' + role + ') -> socket ' + socket.id);
  });

  // ── call-invite: Counselor -> Student ──────────────────────────────────────
  socket.on('call-invite', (payload) => {
    const { studentId } = payload;
    if (!studentId) return;
    console.log('[Socket] call-invite from ' + socket.id + ' -> user:' + studentId);
    io.to('user:' + studentId).emit('call-invite', Object.assign({}, payload, { from: socket.id }));
  });

  // ── call-accepted: Student -> Counselor ────────────────────────────────────
  socket.on('call-accepted', (payload) => {
    const { counselorId } = payload;
    if (!counselorId) return;
    console.log('[Socket] call-accepted from ' + socket.id + ' -> user:' + counselorId);
    io.to('user:' + counselorId).emit('call-accepted', Object.assign({}, payload, { from: socket.id }));
  });

  // ── call-declined: Student -> Counselor ────────────────────────────────────
  socket.on('call-declined', (payload) => {
    const { counselorId } = payload;
    if (!counselorId) return;
    console.log('[Socket] call-declined from ' + socket.id + ' -> user:' + counselorId);
    io.to('user:' + counselorId).emit('call-declined', Object.assign({}, payload, { from: socket.id }));
  });
  // ── call-control signals ───────────────────────────────────────────────────
  // Forward mute/video toggle/end so the other side's UI updates
  socket.on('peer-muted',       (p) => socket.to(p.roomId).emit('peer-muted',       { ...p, from: socket.id }));
  socket.on('peer-video-off',   (p) => socket.to(p.roomId).emit('peer-video-off',   { ...p, from: socket.id }));
  socket.on('peer-video-on',    (p) => socket.to(p.roomId).emit('peer-video-on',    { ...p, from: socket.id }));
  socket.on('session-ended',    (p) => socket.to(p.roomId).emit('session-ended',    { from: socket.id }));

  // ── Welfare Chat & Emergency Real-time Signals ─────────────────────────────
  socket.on('welfare:typing', ({ recipientId, isTyping, conversationId }) => {
    if (!recipientId) return;
    io.to('user:' + recipientId).emit('welfare:typing', {
      senderId: socket.data.userId,
      isTyping: Boolean(isTyping),
      conversationId,
    });
  });

  socket.on('welfare:emergency-alarm', (payload) => {
    const { officerId } = payload || {};
    if (!officerId) return;
    console.log(`[Socket] 🚨 Emergency alarm from ${socket.id} -> user:${officerId}`);
    io.to('user:' + officerId).emit('welfare:emergency-sos', payload);
  });

  // ── disconnect cleanup ─────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId) _leaveRoom(socket, roomId);
    console.log(`[Socket] disconnected: ${socket.id}`);
  });
});

function _leaveRoom(socket, roomId) {
  socket.leave(roomId);
  const set = roomParticipants.get(roomId);
  if (set) {
    set.delete(socket.id);
    if (set.size === 0) roomParticipants.delete(roomId);
  }
  socket.to(roomId).emit('peer-left', { socketId: socket.id, userName: socket.data.userName });
  console.log(`[Socket] ${socket.id} left room ${roomId}`);
}

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Static Files for Uploads ───────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Request Logger Middleware ───────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[REQ] ${new Date().toLocaleTimeString()} ${req.method} ${req.originalUrl}`);
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get(['/', '/api/health'], (req, res) => {
  res.json({
    status: 'OK',
    message: 'UWell Backend API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Role Routes ──────────────────────────────────────────────────────────────
const studentAuthRoutes = require('./src/routes/student/authRoutes');
const counselorAuthRoutes = require('./src/routes/counselor/authRoutes');
const welfareAuthRoutes = require('./src/routes/welfare/authRoutes');
const managementRoutes = require('./src/routes/management/managementRoutes');

app.use('/api/auth/student', studentAuthRoutes);
app.use('/api/auth/counselor', counselorAuthRoutes);
app.use('/api/auth/welfare', welfareAuthRoutes);
app.use('/api/auth/management', managementRoutes);

// ─── Manager Workflow Routes ──────────────────────────────────────────────────
// Pending requests, approval, rejection, and dashboard stats
app.use('/api/management', managementRoutes);

// ─── Unified Auth Endpoints ───────────────────────────────────────────────────
app.post('/api/auth/login', (req, res, next) => {
  const role = req.body.role || 'student';
  if (role === 'counselor') {
    return require('./src/controllers/counselor/authController').loginCounselor(req, res, next);
  }
  if (role === 'welfare') {
    return require('./src/controllers/welfare/authController').loginWelfare(req, res, next);
  }
  if (role === 'management') {
    return require('./src/controllers/management/managementController').loginManagement(req, res, next);
  }
  return require('./src/controllers/student/authController').loginStudent(req, res, next);
});

// Mood: CRUD /api/student/mood  — must be before studentRoutes (:studentId wildcard)
app.use('/api/student/mood', require('./src/routes/student/moodRoutes'));

// Appointments: CRUD /api/student/appointments — must be before studentRoutes
app.use('/api/student/appointments', require('./src/routes/student/appointmentRoutes'));

// Private student-to-counselor conversations for booked sessions.
app.use('/api/student/messages', require('./src/routes/student/messageRoutes'));

// ─── Counselor Module Routes ──────────────────────────────────────────────────
// Profile, stats, appointments, students, messages, availability & video session
app.use('/api/counselor', require('./src/routes/counselor/counselorRoutes'));


// ─── Welfare Module Routes ────────────────────────────────────────────────────
// Profile, schedule, dashboard, appointments, counseling services & notifications
app.use('/api/welfare', require('./src/routes/welfare/welfareRoutes'));

// ─── Welfare Chat & Emergency SOS Routes ──────────────────────────────────────
app.use('/api/welfare-chat', require('./src/routes/welfare/welfareChatRoutes'));

// ─── Notifications (All Roles) ────────────────────────────────────────────────
const notificationRoutes = require('./src/routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);
app.use('/api/student/notifications', notificationRoutes);
app.use('/api/counselor/notifications', notificationRoutes);

// Counselors: read-only list + availability for students
app.use('/api/student/counselors', (() => {
  const r = require('express').Router();
  const { protect, authorise } = require('./src/middleware/auth');
  const { getCounselors, getCounselorById } = require('./src/controllers/student/counselorController');
  r.use(protect);
  r.use(authorise('student'));
  r.get('/', getCounselors);
  r.get('/:id', getCounselorById);
  return r;
})());

// Counselor availability readable by students (used for slot picker)
app.use('/api/student/counselor-availability', (() => {
  const r = require('express').Router();
  const { protect, authorise } = require('./src/middleware/auth');
  r.use(protect);
  r.use(authorise('student'));
  r.get('/', async (req, res) => {
    try {
      const CounselorAvailability = require('./src/models/counselor/CounselorAvailability');
      const { counselorId } = req.query;

      // If a specific counselorId is requested, try that first.
      // Fall back to the shared 'c1' slots if no records exist for that ID.
      let data = [];
      if (counselorId) {
        data = await CounselorAvailability.find({ counselorId: String(counselorId), active: true });
        if (data.length === 0) {
          // No per-counselor slots found — return shared c1 slots so screen is never empty
          data = await CounselorAvailability.find({ counselorId: 'c1', active: true });
        }
      } else {
        data = await CounselorAvailability.find({ active: true });
      }

      res.status(200).json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Failed to fetch availability' });
    }
  });
  return r;
})());

// Resources — static wellness content readable by authenticated students
app.use('/api/student/resources', (() => {
  const r = require('express').Router();
  const { protect, authorise } = require('./src/middleware/auth');
  r.use(protect);
  r.use(authorise('student'));

  const RESOURCES = [
    { id: '1', title: 'Stress Management', category: 'Stress & Relaxation', description: 'Simple techniques to manage academic and everyday stress.' },
    { id: '2', title: 'Better Sleep', category: 'Sleep & Rest', description: 'Helpful habits and tips for improving your sleep routine.' },
    { id: '3', title: 'Deep Breathing', category: 'Relaxation', description: 'Practice simple breathing exercises to feel calmer.' },
    { id: '4', title: 'Mental Health Tips', category: 'Mental Wellbeing', description: 'Learn simple ways to support your mental wellbeing.' },
    { id: '5', title: 'Managing Academic Pressure', category: 'Student Life', description: 'Practical ideas for handling study pressure and workload.' },
    { id: '6', title: 'Talk to Someone', category: 'Support', description: 'Understand when and how to reach out for emotional support.' },
  ];

  r.get('/', (req, res) => {
    res.status(200).json({ success: true, count: RESOURCES.length, data: RESOURCES });
  });

  r.get('/:id', (req, res) => {
    const item = RESOURCES.find(r => r.id === req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Resource not found' });
    res.status(200).json({ success: true, data: item });
  });

  return r;
})());

// Consent — records student's privacy consent acknowledgement
app.use('/api/student/consent', (() => {
  const r = require('express').Router();
  const { protect, authorise } = require('./src/middleware/auth');
  r.use(protect);
  r.use(authorise('student'));

  r.post('/', (req, res) => {
    // Consent is captured on the client; acknowledge receipt without persisting PII.
    res.status(200).json({ success: true, message: 'Consent recorded' });
  });

  return r;
})());

// Student Profile & CRUD — registered last to avoid :studentId wildcard intercepting sub-paths
app.use('/api/student', require('./src/routes/student/studentRoutes'));


// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ─── 404 Catch-all ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

const PORT     = parseInt(process.env.PORT, 10)     || 5000;
const ALT_PORT = parseInt(process.env.ALT_PORT, 10) || 8082;

// ── listen helper ─────────────────────────────────────────────────────────────
// httpServer owns socket.io and listens on ALT_PORT (mobile-facing).
// PORT gets a separate plain server via app.listen().
function listen(port, label) {
  return new Promise((resolve, reject) => {
    // Attach socket.io to ALT_PORT; everything else uses app directly.
    const server = (port === ALT_PORT) ? httpServer.listen(port, '0.0.0.0') : app.listen(port, '0.0.0.0');
    if (port !== ALT_PORT) {
      try { io.attach(server); } catch (e) {}
    }

    server.once('listening', () => {
      console.log(`✅ ${label} listening on http://0.0.0.0:${port}`);
      resolve(server);
    });

    server.once('error', (error) => {
      const description = error.code === 'EADDRINUSE'
        ? `Port ${port} is already in use.`
        : `Failed to start on port ${port}.`;
      reject(new Error(`${label}: ${description} ${error.message}`));
    });
  });
}

async function startServers() {
  try {
    await connectDB();

    // The mobile app uses ALT_PORT; PORT remains available for local/API clients.
    await listen(PORT, 'UWell Backend');
    if (ALT_PORT && ALT_PORT !== PORT) {
      await listen(ALT_PORT, 'UWell Backend (Firewall-friendly port)');
    }

    console.log('   Health → GET /api/health');
    console.log('   Auth   → POST /api/auth/student/register');
    console.log('            POST /api/auth/student/login');
    console.log('   Student→ GET/PUT /api/student/profile');
    console.log('   Socket → ws://0.0.0.0:' + PORT + ' (video signaling)');
  } catch (error) {
    console.error('❌ Backend startup failed:', error.message);
    process.exit(1);
  }
}

startServers();

module.exports = { app, io, httpServer };
