const Notification = require('../../models/Notification');

/**
 * Helper: Send notification to a recipient
 */
const sendNotification = async (recipientId, recipientType, title, message, type, appointmentId = null) => {
  try {
    await Notification.create({ recipientId, recipientType, title, message, type, appointmentId });
  } catch (err) {
    console.error('❌ sendNotification error:', err.message);
  }
};

// GET /api/counselor/notifications - Get notifications for current counselor
const getCounselorNotifications = async (req, res) => {
  try {
    const counselorId = req.user.id;
    
    const notifications = await Notification.find({ 
      recipientId: counselorId,
      recipientType: 'counselor'
    })
    .sort({ createdAt: -1 })
    .limit(50);

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (error) {
    console.error('❌ getCounselorNotifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

// GET /api/counselor/notifications/unread-count - Get unread notification count
const getUnreadCount = async (req, res) => {
  try {
    const counselorId = req.user.id;
    
    const count = await Notification.countDocuments({
      recipientId: counselorId,
      recipientType: 'counselor',
      isRead: false
    });

    res.status(200).json({ success: true, count });
  } catch (error) {
    console.error('❌ getUnreadCount error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch unread count' });
  }
};

// PUT /api/counselor/notifications/:id/read - Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { isRead: true });
    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('❌ markAsRead error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};

// Export helper function for use in other controllers
module.exports = { sendNotification, getCounselorNotifications, getUnreadCount, markAsRead };