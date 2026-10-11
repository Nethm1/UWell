/**
 * socketService.ts
 * Manages a single shared Socket.io connection for the UWell app.
 * Used primarily by the video session screens to relay signaling events
 * between student and counselor.
 */
import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Derive the socket server base URL using the same IP-detection logic as api.js
const resolveSocketUrl = (): string => {
  if (Platform.OS === 'web') return 'http://127.0.0.1:8082';

  if (process.env.EXPO_PUBLIC_API_URL) {
    // Strip /api suffix if present
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/api$/, '');
  }

  const hostUri =
    (Constants as any)?.expoConfig?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost;

  const ip = hostUri ? hostUri.split(':')[0] : '192.168.1.12';
  return `http://${ip}:8082`;
};

export const SOCKET_URL = resolveSocketUrl();

let _socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!_socket || !_socket.connected) {
    _socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    });
  }
  return _socket;
};

export const connectSocket = (): Socket => {
  const socket = getSocket();
  if (!socket.connected) socket.connect();
  return socket;
};

export const disconnectSocket = () => {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
};
