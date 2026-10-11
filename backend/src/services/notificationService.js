const Notification = require('../models/Notification');

/**
 * Send a notification to a student
 * @param {string} studentId - Student's ObjectId as string
 * @param {string} title - Notification title
 * @param {string} message - Notification body
 * @param {string} type - Notification type (e.g., 'appointment_updated', 'general')
 * @param {string} appointmentId - Optional Appointment ObjectId
 */
const sendStudentNotification = async (studentId, title, message, type, appointmentId = null) => {
  try {
    await Notification.create({
      recipientId: studentId,
      recipientType: 'student',
      title,
      message,
      type,
      appointmentId
    });
  } catch (err) {
    console.error('❌ sendStudentNotification error:', err.message);
    throw err;
  }
};

module.exports = { sendStudentNotification };