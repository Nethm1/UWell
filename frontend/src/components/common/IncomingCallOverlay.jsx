import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Platform, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { connectSocket, disconnectSocket } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';

const CALL_TIMEOUT_MS = 30000;

export default function IncomingCallOverlay() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [callData, setCallData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [accepting, setAccepting] = useState(false);
  const [callNotice, setCallNotice] = useState('');
  const callDataRef = useRef(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef(null);
  const countdownRef = useRef(null);
  const pulseLoopRef = useRef(null);
  const socketRef = useRef(null);
  const userId = String(user?._id || user?.id || '');
  const userRole = user?.role;

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pulseLoopRef.current) pulseLoopRef.current.stop();
    timeoutRef.current = null;
    countdownRef.current = null;
    Vibration.cancel();
    callDataRef.current = null;
    setCallData(null);
    setTimeLeft(30);
  }, []);

  useEffect(() => {
    if (!userId || !['student', 'counselor'].includes(userRole)) return undefined;
    const socket = connectSocket();
    socketRef.current = socket;
    socket.emit('register-user', { userId, role: userRole });

    const onInvite = (data) => {
      if (!data?.roomId || !data?.callerId) return;
      dismiss();
      callDataRef.current = data;
      setCallData(data);
      setAccepting(false);
      setCallNotice('');
      setTimeLeft(30);
      pulseLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.14, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]));
      pulseLoopRef.current.start();
      if (Platform.OS !== 'web') Vibration.vibrate([500, 500, 500, 500], true);
      timeoutRef.current = setTimeout(() => {
        socket.emit('call-declined', {
          callerId: data.callerId, callerRole: data.callerRole, callId: data.callId,
          studentId: data.studentId, counselorId: data.counselorId, reason: 'timeout',
        });
        dismiss();
      }, CALL_TIMEOUT_MS);
      countdownRef.current = setInterval(() => setTimeLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    };
    const onCancelled = (data) => {
      if (data?.callId && data.callId === callDataRef.current?.callId) dismiss();
    };

    socket.on('call-invite', onInvite);
    socket.on('call-cancelled', onCancelled);
    return () => {
      socket.off('call-invite', onInvite);
      socket.off('call-cancelled', onCancelled);
      dismiss();
      disconnectSocket();
    };
  }, [userId, userRole, pulse, dismiss]);

  const accept = () => {
    if (!callData || accepting) return;
    const socket = socketRef.current;
    if (!socket?.connected) {
      setCallNotice('Connection lost. Reconnect to answer the call.');
      return;
    }
    setAccepting(true);
    const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || (user?.role === 'student' ? 'Student' : 'Counselor');
    socket.emit('call-accepted', {
      callerId: callData.callerId, callerRole: callData.callerRole, callId: callData.callId,
      roomId: callData.roomId, studentId: callData.studentId, counselorId: callData.counselorId,
      appointmentId: callData.appointmentId,
    }, (result) => {
      if (!result?.accepted) {
        setAccepting(false);
        setCallNotice('This call has already been answered or has expired.');
        return;
      }
      const params = {
        appointmentId: callData.appointmentId || '', roomId: callData.roomId,
        autoOpenInBrowser: true,
        role: user?.role, displayName,
        counselorName: callData.counselorName || 'Counselor',
        studentName: callData.studentName || 'Student', date: callData.date || '', time: callData.time || '',
      };
      dismiss();
      navigation.navigate('VideoCall', params);
    });
  };

  const decline = () => {
    if (callData) socketRef.current?.emit('call-declined', {
      callerId: callData.callerId, callerRole: callData.callerRole, callId: callData.callId,
      studentId: callData.studentId, counselorId: callData.counselorId, reason: 'declined',
    });
    dismiss();
  };

  if (!callData) return null;
  const callerName = callData.callerRole === 'student'
    ? (callData.studentName || 'Student')
    : (callData.counselorName || 'Counselor');
  const initials = callerName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent onRequestClose={decline}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulse }] }]}>
            <View style={styles.avatar}><Text style={styles.avatarInitials}>{initials || 'UW'}</Text></View>
          </Animated.View>
          <Text style={styles.callerLabel}>{callData.callerRole === 'student' ? 'INCOMING STUDENT CALL' : 'INCOMING COUNSELOR CALL'}</Text>
          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callerSub}>UWell video counseling session</Text>
          {(callData.date || callData.time) ? <Text style={styles.sessionMeta}>{[callData.date, callData.time].filter(Boolean).join(' · ')}</Text> : null}
          <Text style={styles.countdown}>Ringing · {timeLeft}s</Text>
          {callNotice ? <Text style={styles.countdown}>{callNotice}</Text> : null}
          {accepting ? <ActivityIndicator color="#73D996" /> : null}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={decline} disabled={accepting} accessibilityLabel="Decline call">
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={accept} disabled={accepting} accessibilityLabel="Answer call">
              <Text style={styles.acceptText}>Answer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,12,25,0.88)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#1A1A2E', borderRadius: 28, paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center', borderWidth: 1, borderColor: '#343453' },
  avatarRing: { width: 118, height: 118, borderRadius: 60, backgroundColor: '#EF806B20', borderWidth: 2, borderColor: '#EF806B70', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  avatar: { width: 92, height: 92, borderRadius: 48, backgroundColor: '#EF806B25', borderWidth: 2, borderColor: '#EF806B', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 30, fontWeight: '800', color: '#EF806B' },
  callerLabel: { color: '#9AB0CC', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 7 },
  callerName: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  callerSub: { color: '#9AB0CC', fontSize: 13, marginTop: 5 },
  sessionMeta: { color: '#D0E0F5', fontSize: 12, marginTop: 12 },
  countdown: { color: '#EF806B', fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 25 },
  actions: { flexDirection: 'row', gap: 14, width: '100%' },
  actionBtn: { flex: 1, minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { backgroundColor: '#321D25', borderWidth: 1, borderColor: '#C84D54' },
  acceptBtn: { backgroundColor: '#183A2A', borderWidth: 1, borderColor: '#43A96B' },
  declineText: { color: '#FF7F7F', fontSize: 14, fontWeight: '800' },
  acceptText: { color: '#73D996', fontSize: 14, fontWeight: '800' },
});
