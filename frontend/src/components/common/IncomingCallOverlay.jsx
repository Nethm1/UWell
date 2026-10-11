/**
 * IncomingCallOverlay
 * Shown to the STUDENT when a counselor initiates a video call.
 * Rendered at root level in App.jsx so it appears over any screen.
 *
 * Flow:
 *  1. Student socket receives "call-invite"
 *  2. Full-screen modal appears with counselor name + ringing pulse
 *  3. Accept  -> emits "call-accepted" -> navigates to VideoCallScreen
 *  4. Decline -> emits "call-declined" -> overlay dismisses
 *  5. 30s timeout -> auto-dismiss + counselor notified
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { connectSocket } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';

const CALL_TIMEOUT_MS = 30000;

export default function IncomingCallOverlay() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [callData, setCallData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);

  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const pulseRef     = useRef(null);
  const timeoutRef   = useRef(null);
  const countdownRef = useRef(null);
  const socketRef    = useRef(null);

  const startPulse = useCallback(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    pulseRef.current = anim;
  }, [pulseAnim]);

  const dismiss = useCallback(() => {
    if (timeoutRef.current)   clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pulseRef.current)     pulseRef.current.stop();
    Vibration.cancel();
    setCallData(null);
    setTimeLeft(30);
  }, []);

  const handleAccept = useCallback((data) => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('call-accepted', {
        counselorId:   data.counselorId,
        appointmentId: data.appointmentId,
        roomId:        data.roomId,
      });
    }
    dismiss();
    navigation.navigate('VideoCall', {
      appointmentId: data.appointmentId || '',
      roomId:        data.roomId        || '',
      role:          'student',
      displayName:   user?.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : 'Student',
      counselorName: data.counselorName || 'Counselor',
      date:          data.date          || '',
      time:          data.time          || '',
    });
  }, [dismiss, navigation, user]);

  const handleDecline = useCallback((data) => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('call-declined', {
        counselorId:   data.counselorId,
        appointmentId: data.appointmentId,
      });
    }
    dismiss();
  }, [dismiss]);

  useEffect(() => {
    if (!user || user.role !== 'student') return;

    const socket = connectSocket();
    socketRef.current = socket;

    const userId = user._id || user.id;
    if (userId) {
      socket.emit('register-user', { userId, role: 'student' });
    }

    const handleInvite = (data) => {
      setCallData(data);
      setTimeLeft(30);
      startPulse();

      if (Platform.OS !== 'web') {
        Vibration.vibrate([500, 500, 500, 500, 500, 500], true);
      }

      timeoutRef.current = setTimeout(() => {
        socket.emit('call-declined', {
          counselorId:   data.counselorId,
          appointmentId: data.appointmentId,
          reason:        'timeout',
        });
        dismiss();
      }, CALL_TIMEOUT_MS);

      countdownRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) { clearInterval(countdownRef.current); return 0; }
          return t - 1;
        });
      }, 1000);
    };

    socket.on('call-invite', handleInvite);
    return () => { socket.off('call-invite', handleInvite); };
  }, [user, startPulse, dismiss]);

  if (!callData) return null;

  const initials = (callData.counselorName || 'C')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>

          <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          </Animated.View>

          <Text style={styles.callerLabel}>INCOMING SESSION</Text>
          <Text style={styles.callerName}>{callData.counselorName || 'Your Counselor'}</Text>
          <Text style={styles.callerSub}>UWell Video Counseling Session</Text>

          {(!!callData.date || !!callData.time) && (
            <View style={styles.sessionMeta}>
              {!!callData.date && <Text style={styles.sessionMetaText}>?? {callData.date}</Text>}
              {!!callData.time && <Text style={styles.sessionMetaText}>?? {callData.time}</Text>}
            </View>
          )}

          <Text style={styles.countdown}>Ringing… {timeLeft}s</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={() => handleDecline(callData)}
              accessibilityLabel="Decline call"
            >
              <Text style={styles.actionIcon}>??</Text>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => handleAccept(callData)}
              accessibilityLabel="Accept call"
            >
              <Text style={styles.actionIcon}>??</Text>
              <Text style={styles.acceptText}>Join Session</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#1A1A2E',
    borderRadius: 28,
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  avatarRing: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: '#EF806B1A',
    borderWidth: 3,
    borderColor: '#EF806B55',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: '#EF806B22',
    borderWidth: 2,
    borderColor: '#EF806B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 34, fontWeight: '700', color: '#EF806B' },
  callerLabel:    { color: '#8AAACC', fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 6 },
  callerName:     { color: '#FFFFFF', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  callerSub:      { color: '#8AAACC', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  sessionMeta:    { flexDirection: 'row', gap: 14, marginBottom: 14 },
  sessionMetaText:{ color: '#D0E0F5', fontSize: 12 },
  countdown:      { color: '#EF806B', fontSize: 13, fontWeight: '600', marginBottom: 30 },
  actions:        { flexDirection: 'row', gap: 16, width: '100%' },
  actionBtn:      { flex: 1, height: 66, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 4 },
  declineBtn:     { backgroundColor: '#2A0A0A', borderWidth: 1.5, borderColor: '#C0392B' },
  acceptBtn:      { backgroundColor: '#0A2A18', borderWidth: 1.5, borderColor: '#27AE60' },
  actionIcon:     { fontSize: 26 },
  declineText:    { color: '#E74C3C', fontSize: 12, fontWeight: '700' },
  acceptText:     { color: '#27AE60', fontSize: 12, fontWeight: '700' },
});