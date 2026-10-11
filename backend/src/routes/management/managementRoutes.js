const express = require('express');
const router = express.Router();
const { protect, authorise } = require('../../middleware/auth');
const {
  registerManagement,
  loginManagement,
  getPendingRequests,
  getAllRequests,
  approveRequest,
  rejectRequest,
  getDashboardStats,
  getManagementProfile,
  updateManagementProfile,
  logoutManagement,
  getManagementDashboard,
  getManagementAppointments,
  getUsageDetails,
  generateUsageReport,
  getAllUsers,
  updateUser,
  deleteUser,
  getSystemSettings,
  updateSystemSettings,
} = require('../../controllers/management/managementController');

// Auth
router.post('/register', registerManagement);
router.post('/login', loginManagement);
router.post('/logout', logoutManagement);

// Manager approval workflows for counselors and welfare officers
router.get('/pending-requests', getPendingRequests);
router.get('/all-requests', getAllRequests);
router.post('/approve-request', approveRequest);
router.post('/reject-request', rejectRequest);
router.get('/dashboard-stats', getDashboardStats);

// Profile
router.get('/profile', getManagementProfile);
router.put('/profile', updateManagementProfile);

// ─── Dashboard, reporting & administration (management only) ──────────────────
// NOTE: applied per-route (not router.use) so the auth endpoints above stay public.
const managementOnly = [protect, authorise('management')];

router.get('/dashboard', managementOnly, getManagementDashboard);
router.get('/appointments', managementOnly, getManagementAppointments);
router.get('/usage-details', managementOnly, getUsageDetails);
router.post('/usage-report', managementOnly, generateUsageReport);

// User administration
router.get('/users', managementOnly, getAllUsers);
router.put('/users/:id', managementOnly, updateUser);
router.delete('/users/:id', managementOnly, deleteUser);

// System settings
router.get('/settings', managementOnly, getSystemSettings);
router.put('/settings', managementOnly, updateSystemSettings);

module.exports = router;
