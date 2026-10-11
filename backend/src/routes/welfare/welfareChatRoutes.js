const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../../middleware/auth');
const {
  getAvailableOfficers,
  getOfficerProfile,
  getConversation,
  sendMessage,
  getOfficerInbox,
  resolveEmergencyAlert,
  markConversationRead,
} = require('../../controllers/welfare/welfareChatController');

// All routes require authentication
router.use(protect);

// ── Student & Welfare Shared Endpoints ─────────────────────────────────────────
// List available officers (for student discovery)
router.get('/officers', authorise('student', 'welfare'), getAvailableOfficers);

// Single officer profile details
router.get('/officer/:officerId', authorise('student', 'welfare'), getOfficerProfile);

// Get conversation thread (targetId is officerId for student, studentId for officer)
router.get('/conversation/:targetId', authorise('student', 'welfare'), getConversation);

// Send message (targetId is officerId for student, studentId for officer)
router.post('/message/:targetId', authorise('student', 'welfare'), sendMessage);

// Mark conversation read
router.put('/conversation/read/:conversationId', authorise('student', 'welfare'), markConversationRead);

// ── Welfare Officer Specific Endpoints ─────────────────────────────────────────
// Get officer inbox threads with emergency and unread filters
router.get('/inbox', authorise('welfare'), getOfficerInbox);

// Resolve emergency crisis alert
router.put('/emergency/resolve/:conversationId', authorise('welfare'), resolveEmergencyAlert);

module.exports = router;
