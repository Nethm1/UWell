import api from './api';
import { getSocket, connectSocket } from './socketService';

export const notificationService = {
  /**
   * Fetch current user's notifications (works for student, counselor, and welfare officer).
   */
  getNotifications: async (params = {}) => {
    try {
      const response = await api.get('/notifications', { params });
      return response.data;
    } catch (error) {
      console.warn('[NotificationService] Fetch error:', error?.message);
      return { success: false, notifications: [], unreadCount: 0 };
    }
  },

  /**
   * Mark a specific notification as read.
   */
  markAsRead: async (id) => {
    try {
      const response = await api.put(`/notifications/${id}/read`);
      return response.data;
    } catch (error) {
      console.warn('[NotificationService] Mark read error:', error?.message);
      return { success: false };
    }
  },

  /**
   * Mark all notifications as read.
   */
  markAllAsRead: async () => {
    try {
      const response = await api.put('/notifications/read-all');
      return response.data;
    } catch (error) {
      console.warn('[NotificationService] Mark all read error:', error?.message);
      return { success: false };
    }
  },

  /**
   * Delete a notification.
   */
  deleteNotification: async (id) => {
    try {
      const response = await api.delete(`/notifications/${id}`);
      return response.data;
    } catch (error) {
      console.warn('[NotificationService] Delete error:', error?.message);
      return { success: false };
    }
  },

  /**
   * Register user with socket server so room `user:${userId}` receives events.
   */
  registerSocketUser: (userId, role = 'student') => {
    if (!userId) return;
    try {
      const socket = connectSocket();
      socket.emit('register-user', { userId: String(userId), role });
    } catch (err) {
      console.warn('[NotificationService] Socket register error:', err?.message);
    }
  },

  /**
   * Subscribe to real-time notification events.
   * Returns an unsubscribe cleanup function.
   */
  onNotificationReceived: (callback) => {
    try {
      const socket = connectSocket();
      const handler = (notif) => {
        if (typeof callback === 'function') {
          callback(notif);
        }
      };
      socket.on('notification', handler);
      return () => {
        socket.off('notification', handler);
      };
    } catch (err) {
      console.warn('[NotificationService] Subscribe error:', err?.message);
      return () => {};
    }
  },

  /**
   * Subscribe to real-time appointment changes (updates and deletes).
   * Returns an unsubscribe cleanup function.
   */
  onAppointmentChange: (onUpdate, onDelete) => {
    try {
      const socket = connectSocket();
      const updateHandler = (data) => {
        if (typeof onUpdate === 'function') onUpdate(data);
      };
      const deleteHandler = (data) => {
        if (typeof onDelete === 'function') onDelete(data);
      };
      socket.on('appointment:updated', updateHandler);
      socket.on('appointment:deleted', deleteHandler);
      return () => {
        socket.off('appointment:updated', updateHandler);
        socket.off('appointment:deleted', deleteHandler);
      };
    } catch (err) {
      console.warn('[NotificationService] Appointment change listener error:', err?.message);
      return () => {};
    }
  },
};

export default notificationService;
