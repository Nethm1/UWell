const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./src/config/db');

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

const PORT = parseInt(process.env.PORT, 10) || 5000;
const ALT_PORT = parseInt(process.env.ALT_PORT, 10) || 8082;

function listen(port, label) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0');

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
  } catch (error) {
    console.error('❌ Backend startup failed:', error.message);
    process.exit(1);
  }
}

startServers();
