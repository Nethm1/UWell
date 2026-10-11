const Notification = require('../models/Notification');

let _globalIo = null;

const setGlobalIo = (ioInstance) => {
  _globalIo = ioInstance;
};

const getGlobalIo = () => {
  return _globalIo;
};

/**
 * Dispatches an in-app and real-time push notification to a recipient.
 *
 * @param {string|Object} recipientId - User ID, Counselor ID (e.g. 'c1'), or Welfare ID
 * @param {'student'|'counselor'|'welfare'} recipientType
 * @param {string} title - Notification title
 * @param {string} message - Notification text
 * @param {string} type - 'appointment_updated' | 'appointment_rescheduled' | 'appointment_cancelled' | 'appointment_deleted' | 'general'
 * @param {string|null} appointmentId - Linked appointment ID (optional)
 * @param {Object|null} io - Socket.io server instance (optional)
 */
const sendNotification = async (
  recipientId,
  recipientType,
  title,
  message,
  type = 'general',
  appointmentId = null,
  io = null,
  metadata = {}
) => {
  try {
    const rawRecipient = recipientId ? recipientId.toString() : '';
    if (!rawRecipient) return null;

    const notif = await Notification.create({
      recipientId: rawRecipient,
      recipientType,
      title,
      message,
      type,
      appointmentId: appointmentId ? appointmentId.toString() : null,
      metadata: metadata || {},
      isRead: false,
    });

    const activeIo = io || _globalIo;
    if (activeIo) {
      const payload = notif.toJSON();
      
      // Emit to targeted room
      activeIo.to('user:' + rawRecipient).emit('notification', payload);
      console.log(`[Notification] Emitted to room "user:${rawRecipient}" -> "${title}"`);

      // If counselor is 'c1' or has custom ID, ensure both rooms receive it if needed
      if (recipientType === 'counselor' && rawRecipient !== 'c1') {
        activeIo.to('user:c1').emit('notification', payload);
      }
    }

    return notif;
  } catch (error) {
    console.error('❌ sendNotification error:', error.message);
    return null;
  }
};

/**
 * Broadcasts an appointment update or deletion event to all connected sockets
 * so live dashboards and schedule views instantly reflect changes without a manual refresh.
 */
const broadcastAppointmentChange = (action, appointmentData, io = null) => {
  const activeIo = io || _globalIo;
  if (!activeIo) return;

  const eventName = action === 'delete' ? 'appointment:deleted' : 'appointment:updated';
  activeIo.emit(eventName, appointmentData);
  console.log(`[Socket] Broadcasted "${eventName}" for appointment ${appointmentData?._id || appointmentData?.id}`);
};

module.exports = {
  setGlobalIo,
  getGlobalIo,
  sendNotification,
  broadcastAppointmentChange,
};
