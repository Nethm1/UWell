import { Platform } from 'react-native';

export const USER_ROLES = {
  STUDENT: 'student',
  COUNSELOR: 'counselor',
  WELFARE: 'welfare',
  MANAGEMENT: 'management'
};

export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

export const MOOD_LEVELS = {
  EXCELLENT: 5,
  GOOD: 4,
  FAIR: 3,
  POOR: 2,
  TERRIBLE: 1
};

export const SESSION_TYPES = {
  INDIVIDUAL: 'individual',
  GROUP: 'group',
  EMERGENCY: 'emergency'
};

import Constants from 'expo-constants';

// ── Dynamic API Base URL ──────────────────────────────────────────────────
// Automatically determines the correct IP address:
// 1. Web uses the backend's IPv4 listener, separate from Expo's IPv6 web server.
// 2. Native apps use EXPO_PUBLIC_API_URL when provided.
// 3. Otherwise, native apps use the Expo host IP or a local-network fallback.
const resolveApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    const configuredUrl = process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
    return configuredUrl.endsWith('/api') ? configuredUrl : `${configuredUrl}/api`;
  }

  if (Platform.OS === 'web') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${host}:8082/api`;
  }

  // Detect IP from Expo Go Metro connection
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants?.manifest?.debuggerHost;

  const detectedIp = hostUri ? hostUri.split(':')[0] : null;

  const targetIp = detectedIp || '192.168.1.12';
  return `http://${targetIp}:8082/api`;
};

export const API_BASE_URL = resolveApiBaseUrl();


