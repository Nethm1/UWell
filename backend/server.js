const http = require('http');
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
const connectDB = require('./src/config/db');
const CounselorStudent = require('./src/models/counselor/CounselorStudent');
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

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id || !decoded?.role) return next(new Error('Invalid socket identity'));
    socket.data.userId = String(decoded.id);
    socket.data.role = String(decoded.role);
    next();
  } catch {
    next(new Error('Invalid or expired socket token'));
  }
});

// Track which sockets are in which room
const roomParticipants = new Map(); // roomId → Set<socketId>
const activeCalls = new Map(); // callId → authorized participant and room data
const pendingCallUsers = new Set(); // reserves participants while an invite resolves its student link
const counselorCallAvailability = new Map(); // userId → whether counselor accepts new video calls

const findCallForUser = (userId) => [...activeCalls.values()].find((call) => call.participants.has(String(userId)));
const finishCall = (call) => {
  if (call?.timeoutRef) clearTimeout(call.timeoutRef);
  if (call?.setupTimeoutRef) clearTimeout(call.setupTimeoutRef);
  if (call) activeCalls.delete(call.callId);
};

io.on('connection', (socket) => {
  if (socket.data.userId) socket.join('user:' + socket.data.userId);
  if (socket.data.role === 'counselor' && !counselorCallAvailability.has(socket.data.userId)) {
    counselorCallAvailability.set(socket.data.userId, true);
  }
  if (socket.data.role === 'counselor') {
    io.emit('counselor-call-availability', {
      counselorId: String(socket.data.userId),
      available: counselorCallAvailability.get(String(socket.data.userId)) !== false,
    });
  }
  console.log(`[Socket] connected: ${socket.id}`);

  // ── join-room ──────────────────────────────────────────────────────────────
  // payload: { roomId, userName, role ('student' | 'counselor') }
  socket.on('join-room', (payload = {}) => {
    const { roomId, userName } = payload || {};
    if (!roomId) return;
    const call = [...activeCalls.values()].find((activeCall) => activeCall.roomId === roomId);
    const userId = String(socket.data.userId);
    const isCaller = call?.callerId === userId && call.callerRole === socket.data.role && call.callerSocketId === socket.id;
    const isTarget = call?.targetUserId === userId && call.targetRole === socket.data.role && call.targetSocketId === socket.id;
    if (!call || !call.accepted || (!isCaller && !isTarget)) {
      socket.emit('call-room-unavailable', { roomId });
      return;
    }

    if (socket.rooms.has(roomId)) {
      socket.emit('room-joined', { roomId, participantCount: roomParticipants.get(roomId)?.size || 1 });
      return;
    }
    call.joinedParticipants ||= new Map();
    const existingSocketId = call.joinedParticipants.get(String(socket.data.userId));
    if (existingSocketId && existingSocketId !== socket.id && io.sockets.sockets.has(existingSocketId)) {
      socket.emit('call-room-unavailable', { roomId, reason: 'participant-already-joined' });
      return;
    }

    socket.join(roomId);
    call.joinedParticipants.set(String(socket.data.userId), socket.id);
    socket.data.roomId   = roomId;
    socket.data.userName = userName || 'Unknown';

    if (!roomParticipants.has(roomId)) roomParticipants.set(roomId, new Set());
    roomParticipants.get(roomId).add(socket.id);

    const count = roomParticipants.get(roomId).size;
    if (count >= 2 && call.setupTimeoutRef) {
      clearTimeout(call.setupTimeoutRef);
      call.setupTimeoutRef = null;
    }
    console.log(`[Socket] ${socket.id} (${socket.data.role}) joined room ${roomId}. Total: ${count}`);

    // Tell this socket how many others are already in the room
    socket.emit('room-joined', { roomId, participantCount: count });

    // Tell everyone else that a new participant arrived
    socket.to(roomId).emit('peer-joined', {
      socketId: socket.id,
      userName: socket.data.userName,
      role:     socket.data.role,
      roomId,
    });
  });

  // ── leave-room ─────────────────────────────────────────────────────────────
  socket.on('leave-room', (payload = {}) => {
    const { roomId } = payload || {};
    if (roomId && socket.rooms.has(roomId)) _leaveRoom(socket, roomId);
  });

  // ── WebRTC signaling relay ─────────────────────────────────────────────────
  // Forward offer/answer/ICE candidate to everyone else in the room
  const relayToAuthorizedPeer = (event, payload = {}) => {
    payload = payload || {};
    const call = [...activeCalls.values()].find((activeCall) => activeCall.roomId === payload.roomId);
    if (!call?.accepted || !call.participants.has(String(socket.data.userId)) || !socket.rooms.has(call.roomId)) return;
    socket.to(call.roomId).emit(event, { ...payload, from: socket.id });
  };
  socket.on('rtc-offer', (payload) => relayToAuthorizedPeer('rtc-offer', payload));
  socket.on('rtc-answer', (payload) => relayToAuthorizedPeer('rtc-answer', payload));
  socket.on('rtc-ice', (payload) => relayToAuthorizedPeer('rtc-ice', payload));

  // ── user registration ──────────────────────────────────────────────────────
  socket.on('register-user', (payload = {}, acknowledge) => {
    const { userId, role } = payload || {};
    const valid = String(userId || '') === String(socket.data.userId || '') && role === socket.data.role;
    if (typeof acknowledge === 'function') acknowledge({ registered: valid });
  });

  socket.on('check-user-online', (payload = {}, acknowledge) => {
    const { userId } = payload || {};
    const sockets = userId ? io.sockets.adapter.rooms.get('user:' + userId) : null;
    const clients = sockets ? [...sockets].map((id) => io.sockets.sockets.get(id)).filter(Boolean) : [];
    const matchingClients = clients.filter((client) => client.data.role === 'counselor');
    const online = matchingClients.length > 0 && counselorCallAvailability.get(String(userId)) !== false;
    if (typeof acknowledge === 'function') acknowledge({ online });
  });

  socket.on('check-call-availability', (acknowledge) => {
    if (typeof acknowledge !== 'function') return;
    if (socket.data.role !== 'counselor') return acknowledge({ available: false });
    acknowledge({ available: counselorCallAvailability.get(String(socket.data.userId)) !== false });
  });
  socket.on('set-call-availability', (payload = {}, acknowledge) => {
    const { available } = payload || {};
    if (socket.data.role !== 'counselor' || typeof available !== 'boolean') {
      if (typeof acknowledge === 'function') acknowledge({ ok: false });
      return;
    }
    counselorCallAvailability.set(String(socket.data.userId), available);
    io.emit('counselor-call-availability', { counselorId: String(socket.data.userId), available });
    if (typeof acknowledge === 'function') acknowledge({ ok: true, available });
  });

  // ── call-invite: Counselor -> Student ──────────────────────────────────────
  socket.on('call-invite', async (payload = {}, acknowledge) => {
    payload = payload || {};
    const callerId = String(socket.data.userId);
    if (!['student', 'counselor'].includes(socket.data.role)) {
      if (typeof acknowledge === 'function') acknowledge({ status: 'unavailable' });
      return;
    }
    if (pendingCallUsers.has(callerId) || findCallForUser(callerId)) {
      if (typeof acknowledge === 'function') acknowledge({ status: 'busy', reason: 'caller' });
      return;
    }

    pendingCallUsers.add(callerId);
    let reservedTargetId = null;
    try {
      const targetRole = payload.targetRole || (socket.data.role === 'student' ? 'counselor' : 'student');
      if (targetRole === socket.data.role || !['student', 'counselor'].includes(targetRole)) {
        if (typeof acknowledge === 'function') acknowledge({ status: 'unavailable' });
        return;
      }

      let targetUserId = String(payload.targetUserId || (socket.data.role === 'student' ? payload.counselorId : payload.studentId) || '');
      if (socket.data.role === 'counselor') {
        const linkedStudent = await CounselorStudent.findOne({
          counselorId: callerId,
          $or: [{ _id: targetUserId }, { sourceStudentId: targetUserId }],
        }).select('_id sourceStudentId');
        if (!linkedStudent) {
          if (typeof acknowledge === 'function') acknowledge({ status: 'unavailable' });
          return;
        }
        targetUserId = String(linkedStudent.sourceStudentId || '');
      }

      const callerBusy = !!findCallForUser(callerId);
      const targetBusy = !!findCallForUser(targetUserId) || pendingCallUsers.has(targetUserId);
      if (!targetUserId || targetUserId === callerId || callerBusy || targetBusy) {
        if (typeof acknowledge === 'function') acknowledge({ status: 'busy', reason: callerBusy ? 'caller' : 'target', targetUserId });
        return;
      }
      pendingCallUsers.add(targetUserId);
      reservedTargetId = targetUserId;

      const targetRoom = 'user:' + targetUserId;
      const targetSockets = io.sockets.adapter.rooms.get(targetRoom);
      const targetClients = targetSockets ? [...targetSockets].map((id) => io.sockets.sockets.get(id)).filter((client) => client?.data.role === targetRole) : [];
      const online = targetClients.length > 0 && (targetRole !== 'counselor' || counselorCallAvailability.get(targetUserId) !== false);
      if (!online) {
        if (typeof acknowledge === 'function') acknowledge({ status: 'offline', targetUserId });
        return;
      }
      if (!socket.connected) {
        if (typeof acknowledge === 'function') acknowledge({ status: 'unavailable' });
        return;
      }

      const callId = crypto.randomUUID();
      const roomId = 'uwell-' + crypto.randomUUID();
      const participants = new Set([callerId, targetUserId]);
      const call = { callId, roomId, callerId, callerRole: socket.data.role, callerSocketId: socket.id, targetUserId, targetRole, participants, accepted: false };
      activeCalls.set(callId, call);
      call.timeoutRef = setTimeout(() => {
        if (activeCalls.get(callId) !== call || call.accepted) return;
        finishCall(call);
        io.to(call.callerSocketId).emit('call-declined', { callId, reason: 'timeout' });
        io.to(targetRoom).emit('call-cancelled', { callId });
      }, 35000);
      io.to(targetRoom).emit('call-invite', {
        ...payload,
        callId,
        roomId,
        targetUserId,
        targetRole,
        callerId,
        callerRole: socket.data.role,
      });
      if (typeof acknowledge === 'function') acknowledge({ status: 'ringing', callId, roomId, targetUserId });
    } catch (error) {
      console.error('[Socket] Failed to create call invite:', error.message);
      if (typeof acknowledge === 'function') acknowledge({ status: 'unavailable' });
    } finally {
      pendingCallUsers.delete(callerId);
      if (reservedTargetId) pendingCallUsers.delete(reservedTargetId);
    }
  });

  // ── call-accepted: Student -> Counselor ────────────────────────────────────
  socket.on('call-accepted', (payload = {}, acknowledge) => {
    const call = activeCalls.get(payload?.callId);
    if (!call || call.targetUserId !== String(socket.data.userId) || socket.data.role !== call.targetRole || payload?.roomId !== call.roomId || call.accepted || !io.sockets.sockets.has(call.callerSocketId)) {
      if (call && !call.accepted && !io.sockets.sockets.has(call.callerSocketId)) {
        finishCall(call);
        io.to('user:' + call.targetUserId).emit('call-cancelled', { callId: call.callId });
      }
      if (typeof acknowledge === 'function') acknowledge({ accepted: false });
      return;
    }
    call.accepted = true;
    call.targetSocketId = socket.id;
    if (call.timeoutRef) clearTimeout(call.timeoutRef);
    call.setupTimeoutRef = setTimeout(() => {
      if (activeCalls.get(call.callId) !== call || !call.accepted) return;
      finishCall(call);
      io.to('user:' + call.callerId).emit('session-ended', { roomId: call.roomId, reason: 'participants-did-not-join' });
      io.to('user:' + call.targetUserId).emit('session-ended', { roomId: call.roomId, reason: 'participants-did-not-join' });
    }, 45000);
    io.to(call.callerSocketId).emit('call-accepted', { callId: call.callId, roomId: call.roomId, from: socket.id });
    io.to('user:' + call.targetUserId).except(socket.id).emit('call-cancelled', { callId: call.callId });
    if (typeof acknowledge === 'function') acknowledge({ accepted: true });
  });

  // ── call-declined: Student -> Counselor ────────────────────────────────────
  socket.on('call-declined', (payload) => {
    const call = activeCalls.get(payload?.callId);
    if (!call || call.accepted || call.targetUserId !== String(socket.data.userId) || socket.data.role !== call.targetRole) return;
    finishCall(call);
    io.to(call.callerSocketId).emit('call-declined', { callId: call.callId, reason: payload.reason || 'declined', from: socket.id });
    io.to('user:' + call.targetUserId).except(socket.id).emit('call-cancelled', { callId: call.callId });
  });
  socket.on('call-cancel', (payload) => {
    const call = activeCalls.get(payload?.callId);
    if (!call || call.callerId !== String(socket.data.userId) || call.callerRole !== socket.data.role || call.callerSocketId !== socket.id) return;
    finishCall(call);
    if (call.accepted) {
      const data = { roomId: call.roomId, reason: 'caller-cancelled' };
      io.to('user:' + call.callerId).emit('session-ended', data);
      io.to('user:' + call.targetUserId).emit('session-ended', data);
    } else {
      io.to('user:' + call.targetUserId).emit('call-cancelled', { callId: call.callId });
    }
  });
  // ── call-control signals ───────────────────────────────────────────────────
  // Forward mute/video toggle/end so the other side's UI updates
  socket.on('peer-muted', (payload) => relayToAuthorizedPeer('peer-muted', payload));
  socket.on('peer-video-off', (payload) => relayToAuthorizedPeer('peer-video-off', payload));
  socket.on('peer-video-on', (payload) => relayToAuthorizedPeer('peer-video-on', payload));
  socket.on('session-ended', (payload) => {
    const call = [...activeCalls.values()].find((activeCall) => activeCall.roomId === payload?.roomId);
    const isCaller = call?.callerSocketId === socket.id && call.callerId === String(socket.data.userId);
    const isTarget = call?.targetSocketId === socket.id && call.targetUserId === String(socket.data.userId);
    if (!call || !call.accepted || (!isCaller && !isTarget)) return;
    finishCall(call);
    io.to('user:' + call.callerId).emit('session-ended', { roomId: call.roomId, from: socket.id });
    io.to('user:' + call.targetUserId).emit('session-ended', { roomId: call.roomId, from: socket.id });
  });

  // ── disconnect cleanup ─────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId) _leaveRoom(socket, roomId);
    for (const call of [...activeCalls.values()]) {
      if (call.callerSocketId !== socket.id && call.targetSocketId !== socket.id) continue;
      finishCall(call);
      if (call.accepted) {
        io.to('user:' + call.callerId).emit('session-ended', { roomId: call.roomId, reason: 'participant-disconnected' });
        io.to('user:' + call.targetUserId).emit('session-ended', { roomId: call.roomId, reason: 'participant-disconnected' });
      } else if (call.callerSocketId === socket.id) {
        io.to('user:' + call.targetUserId).emit('call-cancelled', { callId: call.callId });
      } else {
        io.to('user:' + call.callerId).emit('call-declined', { callId: call.callId, reason: 'offline' });
      }
    }
    if (socket.data.role === 'counselor' && !(io.sockets.adapter.rooms.get('user:' + socket.data.userId)?.size)) {
      counselorCallAvailability.delete(String(socket.data.userId));
      io.emit('counselor-call-availability', { counselorId: String(socket.data.userId), available: false });
    }
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
  socket.to(roomId).emit('peer-left', { roomId, socketId: socket.id, userName: socket.data.userName });
  console.log(`[Socket] ${socket.id} left room ${roomId}`);
}


app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
// Profile photos are stored as compressed data images, so permit a modest
// payload while keeping request sizes bounded.
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

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

// Appointment-scoped Jitsi link, shared by the assigned student and counselor.
app.use('/api/appointments', require('./src/routes/appointmentVideoRoutes'));

// Private student-to-counselor conversations for booked sessions.
app.use('/api/student/messages', require('./src/routes/student/messageRoutes'));

// ─── Counselor Module Routes ──────────────────────────────────────────────────
// Profile, stats, appointments, students, messages, availability & video session
app.use('/api/counselor', require('./src/routes/counselor/counselorRoutes'));

// ─── Welfare Module Routes ────────────────────────────────────────────────────
// Profile, schedule, dashboard, appointments, counseling services & notifications
app.use('/api/welfare', require('./src/routes/welfare/welfareRoutes'));

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

// Avoid launching a second copy on the mobile-facing port. In dev, this can
// happen when a terminal loses track of the process that is already serving
// Expo devices. Only treat a listener as ours when it answers the UWell health
// endpoint; an unrelated service must still produce the normal port error.
function isUWellAlreadyRunning(port) {
  return new Promise((resolve) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/api/health', timeout: 1200 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const health = JSON.parse(body);
          resolve(response.statusCode === 200 && health.status === 'OK' && health.message === 'UWell Backend API is running');
        } catch {
          resolve(false);
        }
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

// ── listen helper ─────────────────────────────────────────────────────────────
// httpServer owns socket.io and listens on ALT_PORT (mobile-facing).
// PORT gets a separate plain server via app.listen().
function listen(port, label) {
  return new Promise((resolve, reject) => {
    // Attach socket.io to ALT_PORT; everything else uses app directly.
    const server = (port === ALT_PORT) ? httpServer.listen(port, '0.0.0.0') : app.listen(port, '0.0.0.0');

    server.once('listening', () => {
      console.log(`✅ ${label} listening on http://0.0.0.0:${port}`);
      resolve(server);
    });

    server.once('error', (error) => {
      const description = error.code === 'EADDRINUSE'
        ? `Port ${port} is already in use.`
        : `Failed to start on port ${port}.`;
      const startupError = new Error(`${label}: ${description} ${error.message}`);
      startupError.code = error.code;
      reject(startupError);
    });
  });
}

async function startServers() {
  try {
    if (ALT_PORT && await isUWellAlreadyRunning(ALT_PORT)) {
      console.log(`✅ UWell Backend is already responding on http://127.0.0.1:${ALT_PORT}; skipping duplicate startup.`);
      return;
    }

    await connectDB();

    // The mobile app uses ALT_PORT; PORT remains available for local/API clients.
    // A busy optional primary port must not prevent the mobile API/socket server
    // from starting on ALT_PORT.
    let primaryServer = null;
    try {
      primaryServer = await listen(PORT, 'UWell Backend');
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || PORT === ALT_PORT) throw error;
      console.warn(`⚠️ Port ${PORT} is already in use; continuing with port ${ALT_PORT}.`);
    }
    if (ALT_PORT && ALT_PORT !== PORT) {
      try {
        await listen(ALT_PORT, 'UWell Backend (Firewall-friendly port)');
      } catch (error) {
        // Another dev terminal may have started UWell after our health probe.
        if (error.code === 'EADDRINUSE' && await isUWellAlreadyRunning(ALT_PORT)) {
          if (primaryServer) await new Promise((resolve) => primaryServer.close(resolve));
          console.log(`✅ UWell Backend is already responding on http://127.0.0.1:${ALT_PORT}; skipping duplicate startup.`);
          return;
        }
        throw error;
      }
    }

    console.log('   Health → GET /api/health');
    console.log('   Auth   → POST /api/auth/student/register');
    console.log('            POST /api/auth/student/login');
    console.log('   Student→ GET/PUT /api/student/profile');
    console.log('   Socket → ws://0.0.0.0:' + ALT_PORT + ' (video signaling)');
  } catch (error) {
    console.error('❌ Backend startup failed:', error.message);
    process.exit(1);
  }
}

startServers();
