const Notification = require('../models/Notification');

/**
 * GET /api/notifications
 * Retrieves notifications for the currently logged-in user.
 * Supports students, counselors (matches user id or 'c1'), and welfare officers.
 */
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.id ? req.user.id.toString() : '';
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Build recipient filter: counselors can receive under their user ID, staff ID, or demo 'c1'
    let recipientFilter = { recipientId: userId };
    if (req.user?.role === 'counselor') {
      const counselorIds = [userId, req.user._id?.toString(), req.user.staffId, 'c1'].filter(Boolean);
      recipientFilter = { recipientId: { $in: Array.from(new Set(counselorIds)) } };
    }

    const { unreadOnly } = req.query;
    if (unreadOnly === 'true') {
      recipientFilter.isRead = false;
    }

    const notifications = await Notification.find(recipientFilter)
      .sort({ createdAt: -1 })
      .limit(60);

    const unreadCount = await Notification.countDocuments({
      ...recipientFilter,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error('❌ getMyNotifications error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching notifications' });
  }
};

/**
 * PUT /api/notifications/:id/read
 * Marks a single notification as read.
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    console.error('❌ markAsRead error:', error);
    res.status(500).json({ success: false, message: 'Server error marking notification as read' });
  }
};

/**
 * PUT /api/notifications/read-all
 * Marks all notifications for the current user as read.
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id ? req.user.id.toString() : '';
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let recipientFilter = { recipientId: userId };
    if (req.user?.role === 'counselor') {
      const counselorIds = [userId, req.user._id?.toString(), req.user.staffId, 'c1'].filter(Boolean);
      recipientFilter = { recipientId: { $in: Array.from(new Set(counselorIds)) } };
    }

    await Notification.updateMany(recipientFilter, { $set: { isRead: true } });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('❌ markAllAsRead error:', error);
    res.status(500).json({ success: false, message: 'Server error marking all notifications as read' });
  }
};

/**
 * DELETE /api/notifications/:id
 * Deletes a notification by ID.
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('❌ deleteNotification error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting notification' });
  }
};
