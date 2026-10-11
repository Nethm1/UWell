import api from './api';

export const videoCallService = {
  getAppointmentMeetingLink: async (appointmentId) => {
    const response = await api.post(
      `/appointments/${encodeURIComponent(appointmentId)}/video-link`,
    );
    return response.data;
  },
};
