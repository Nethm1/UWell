const express = require('express');
const { protect, authorise } = require('../middleware/auth');
const { createAppointmentVideoLink } = require('../controllers/appointmentVideoController');

const router = express.Router();

router.post(
  '/:appointmentId/video-link',
  protect,
  authorise('student', 'counselor'),
  createAppointmentVideoLink,
);

module.exports = router;
