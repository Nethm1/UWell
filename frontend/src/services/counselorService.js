import api from './api';
import {
  initialCounselorProfile,
  initialPerformanceStats,
} from '../data/counselorMockData';

// Local reactive storage for development & offline mode
let profileData = { ...initialCounselorProfile };

export const counselorService = {
  // Counselor Profile
  getCounselorProfile: async () => {
    try {
      const response = await api.get('/counselor/profile');
      return response.data;
    } catch (error) {
      return profileData;
    }
  },

  updateCounselorProfile: async (updatedData) => {
    try {
      const response = await api.put('/counselor/profile', updatedData);
      return response.data;
    } catch (error) {
      profileData = { ...profileData, ...updatedData };
      return profileData;
    }
  },

  // Performance Stats
  getPerformanceStats: async () => {
    try {
      const response = await api.get('/counselor/stats');
      return response.data;
    } catch (error) {
      return initialPerformanceStats;
    }
  },

  // Appointments
  getAppointments: async () => {
    const response = await api.get('/counselor/appointments');
    return response.data;
  },

  getAppointmentById: async (appointmentId) => {
    const response = await api.get(`/counselor/appointments/${appointmentId}`);
    return response.data;
  },

  updateAppointmentStatus: async (appointmentId, status) => {
    const response = await api.put(`/counselor/appointments/${appointmentId}`, { status });
    return response.data;
  },

  // Students
  getStudents: async () => {
    const response = await api.get('/counselor/students');
    return response.data;
  },

  getStudentById: async (studentId) => {
    const response = await api.get(`/counselor/students/${studentId}`);
    return response.data;
  },

  saveSessionNotes: async (studentId, notes) => {
    const response = await api.post(`/counselor/students/${studentId}/notes`, { notes });
    return response.data;
  },

  updateStudentStatus: async (studentId, status) => {
    const response = await api.patch(`/counselor/students/${studentId}/status`, { status });
    return response.data;
  },

  // Messages & Student Chat
  getMessages: async () => {
    const response = await api.get('/counselor/messages');
    return response.data;
  },

  getMessageByStudentId: async (studentId) => {
    const response = await api.get(`/counselor/messages/${studentId}`);
    return response.data;
  },

  sendMessage: async (studentId, text) => {
    const response = await api.post('/counselor/messages', { studentId, text });
    return response.data;
  },

  // Availability CRUD
  getAvailability: async () => {
    const response = await api.get('/counselor/availability');
    return response.data;
  },

  createAvailability: async (slotData) => {
    const response = await api.post('/counselor/availability', slotData);
    return response.data;
  },

  saveAvailability: async (schedule) => {
    const response = await api.put('/counselor/availability', { schedule });
    return response.data;
  },

  updateAvailability: async (id, updatedFields) => {
    const response = await api.put(`/counselor/availability/${id}`, updatedFields);
    return response.data;
  },

  deleteAvailability: async (id) => {
    const response = await api.delete(`/counselor/availability/${id}`);
    return response.data;
  },

  // Video Session placeholder launcher
  startVideoSession: async (appointmentId) => {
    try {
      const response = await api.post(`/counselor/video-session/start`, { appointmentId });
      return response.data;
    } catch (error) {
      return {
        sessionId: `vid-${Date.now()}`,
        status: 'active',
        joinUrl: 'uwell-video://session-placeholder'
      };
    }
  }
};
