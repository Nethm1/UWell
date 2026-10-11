import api from './api';
import { getSocket } from './socketService';

export interface WelfareOfficerSummary {
  id: string;
  _id: string;
  staffId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  department: string;
  position: string;
  phone: string;
  email: string;
  officeLocation: string;
  profilePicture?: string | null;
  bio?: string;
  specializations: string[];
  officeHours: string;
  qualifications?: string;
  yearsOfExperience?: string;
  languages?: string[];
  emergencyContactPhone: string;
  emergencyAvailable: boolean;
  workingSchedule: string;
  availabilityStatus: string;
  consultationMode: string;
  workingDays: string[];
  availabilityNote?: string;
  conversationId?: string | null;
  lastMessage?: string;
  lastMessageAt?: string | null;
  unreadCount?: number;
  isEmergencyActive?: boolean;
}

export interface ChatMessageItem {
  id: string;
  senderId: string;
  senderRole: 'student' | 'welfare';
  senderName: string;
  text: string;
  isEmergency: boolean;
  attachment?: {
    name: string;
    url: string;
    type: string;
    size?: number;
  } | null;
  timestamp: string;
  read: boolean;
}

export interface WelfareConversation {
  id: string;
  _id: string;
  studentId: string;
  welfareId: string;
  studentName: string;
  studentRegNo?: string;
  studentPhone?: string;
  studentEmail?: string;
  studentFaculty?: string;
  officerName: string;
  officerStaffId?: string;
  officerPhone?: string;
  officerOfficeLocation?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadForOfficer: number;
  unreadForStudent: number;
  isEmergency: boolean;
  emergencyAlert?: {
    active: boolean;
    triggeredAt: string | null;
    message: string;
    resolved: boolean;
    resolvedAt: string | null;
  };
  chatHistory: ChatMessageItem[];
}

export const welfareChatService = {
  /**
   * Fetches all approved welfare officers with duty status
   */
  getAvailableOfficers: async (): Promise<WelfareOfficerSummary[]> => {
    const res = await api.get('/welfare-chat/officers');
    return res.data?.officers || [];
  },

  /**
   * Fetches single officer details
   */
  getOfficerProfile: async (officerId: string): Promise<WelfareOfficerSummary | null> => {
    const res = await api.get(`/welfare-chat/officer/${encodeURIComponent(officerId)}`);
    return res.data?.officer || null;
  },

  /**
   * Loads or creates 1-on-1 conversation
   */
  getConversation: async (targetId: string): Promise<{
    conversation: WelfareConversation;
    officer: Partial<WelfareOfficerSummary> | null;
    student: any | null;
  }> => {
    const res = await api.get(`/welfare-chat/conversation/${encodeURIComponent(targetId)}`);
    return res.data;
  },

  /**
   * Sends a message (optionally flagged with emergency SOS)
   */
  sendMessage: async (
    targetId: string,
    payload: {
      text: string;
      isEmergency?: boolean;
      attachment?: any;
    }
  ): Promise<{ success: boolean; data: ChatMessageItem; conversationId: string; isEmergency: boolean }> => {
    const res = await api.post(`/welfare-chat/message/${encodeURIComponent(targetId)}`, payload);
    return res.data;
  },

  /**
   * Marks conversation read
   */
  markConversationRead: async (conversationId: string): Promise<void> => {
    try {
      await api.put(`/welfare-chat/conversation/read/${encodeURIComponent(conversationId)}`);
    } catch (e) {
      console.warn('markConversationRead warning:', e);
    }
  },

  /**
   * For Welfare Officer: Fetch inbox
   */
  getOfficerInbox: async (filter?: 'all' | 'emergency' | 'unread') => {
    const q = filter ? `?filter=${filter}` : '';
    const res = await api.get(`/welfare-chat/inbox${q}`);
    return res.data;
  },

  /**
   * For Welfare Officer: Resolve emergency crisis
   */
  resolveEmergencyAlert: async (conversationId: string, resolutionNotes?: string) => {
    const res = await api.put(`/welfare-chat/emergency/resolve/${encodeURIComponent(conversationId)}`, {
      resolutionNotes,
    });
    return res.data;
  },

  // ── Real-Time Socket Listeners ──────────────────────────────────────────────
  onNewMessage: (callback: (payload: { conversationId: string; message: ChatMessageItem; isEmergency: boolean; unreadCount: number }) => void) => {
    const socket = getSocket();
    socket.on('welfare:new-message', callback);
    return () => {
      socket.off('welfare:new-message', callback);
    };
  },

  onEmergencySos: (callback: (payload: { conversationId: string; studentId: string; studentName: string; studentRegNo: string; studentPhone: string; message: string; triggeredAt: string }) => void) => {
    const socket = getSocket();
    socket.on('welfare:emergency-sos', callback);
    return () => {
      socket.off('welfare:emergency-sos', callback);
    };
  },

  onEmergencyResolved: (callback: (payload: { conversationId: string; resolvedAt: string }) => void) => {
    const socket = getSocket();
    socket.on('welfare:emergency-resolved', callback);
    return () => {
      socket.off('welfare:emergency-resolved', callback);
    };
  },

  onTyping: (callback: (payload: { senderId: string; isTyping: boolean; conversationId?: string }) => void) => {
    const socket = getSocket();
    socket.on('welfare:typing', callback);
    return () => {
      socket.off('welfare:typing', callback);
    };
  },

  emitTyping: (recipientId: string, isTyping: boolean, conversationId?: string) => {
    const socket = getSocket();
    socket.emit('welfare:typing', { recipientId, isTyping, conversationId });
  },

  emitEmergencyAlarm: (officerId: string, payload: any) => {
    const socket = getSocket();
    socket.emit('welfare:emergency-alarm', { officerId, ...payload });
  },
};
