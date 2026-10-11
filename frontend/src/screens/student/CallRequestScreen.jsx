import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, SOCKET_URL } from '../../services/socketService';

const CALL_TIMEOUT_MS = 30000;

export default function CallRequestScreen({ route, navigation }) {
  const { user } = useAuth();
  const { counselorId, counselorName = 'Counselor', appointmentId = '', date = '', time = '' } = route.params || {};
  const studentId = String(user?._id || user?.id || '');
  const studentDisplayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'Student';
  const studentDisplayNameRef = useRef(studentDisplayName);
  studentDisplayNameRef.current = studentDisplayName;
  const [status, setStatus] = useState('connecting');
  const [callError, setCallError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(30);
  const socketRef = useRef(null);
  const callRef = useRef(null);
  const acceptedRef = useRef(false);
  const inviteFinishedRef = useRef(false);
  const mountedRef = useRef(false);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const connectWaitRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
  }, []);

  const clearConnectWait = useCallback(() => {
    if (connectWaitRef.current && socketRef.current) socketRef.current.off('connect', connectWaitRef.current);
    connectWaitRef.current = null;
  }, []);

  const placeCall = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !counselorId || !studentId) {
      setStatus('offline');
      return;
    }
    clearTimers();
    clearConnectWait();
    acceptedRef.current = false;
    inviteFinishedRef.current = false;
    callRef.current = null;
    setStatus('connecting');
    setCallError('');
    setSecondsLeft(30);
    timerRef.current = setTimeout(() => {
      inviteFinishedRef.current = true;
      clearConnectWait();
      setCallError(`Could not connect to ${SOCKET_URL}. Check the server address, Wi-Fi, and firewall.`);
      setStatus('error');
    }, 12000);
    const handleInviteResult = (result) => {
      if (!mountedRef.current || inviteFinishedRef.current) return;
      clearTimers();
      if (result?.status !== 'ringing') inviteFinishedRef.current = true;
      if (result?.status === 'offline') {
        setStatus('offline');
        return;
      }
      if (result?.status === 'busy') {
        setStatus(result.reason === 'caller' ? 'already-in-call' : 'busy');
        return;
      }
      if (result?.status !== 'ringing') {
        setCallError(result?.status === 'unavailable'
          ? 'The call server rejected this request. Confirm the counselor account is online and linked to your account.'
          : `No response from the call server at ${SOCKET_URL}.`);
        setStatus('error');
        return;
      }
      callRef.current = result;
      setStatus('calling');
      timerRef.current = setTimeout(() => {
        if (callRef.current?.callId) socket.emit('call-cancel', { callId: callRef.current.callId });
        callRef.current = null;
        inviteFinishedRef.current = true;
        setStatus('no-answer');
        clearTimers();
      }, CALL_TIMEOUT_MS);
      intervalRef.current = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    };
    const sendInvite = () => {
      clearConnectWait();
      if (!mountedRef.current || inviteFinishedRef.current) return;
      socket.emit('call-invite', {
        targetUserId: String(counselorId), targetRole: 'counselor',
        counselorId: String(counselorId), studentId,
        counselorName, studentName: studentDisplayNameRef.current, appointmentId, date, time,
      }, handleInviteResult);
    };
    if (socket.connected) sendInvite();
    else {
      connectWaitRef.current = sendInvite;
      socket.once('connect', sendInvite);
      socket.connect();
    }
  }, [appointmentId, clearConnectWait, clearTimers, counselorId, counselorName, date, time, studentId]);

  useEffect(() => {
    mountedRef.current = true;
    const socket = connectSocket();
    socketRef.current = socket;
    const onConnectError = (error) => {
      inviteFinishedRef.current = true;
      clearTimers();
      clearConnectWait();
      if (callRef.current?.callId) socket.emit('call-cancel', { callId: callRef.current.callId });
      callRef.current = null;
      setCallError(`Cannot connect to ${SOCKET_URL}: ${error?.message || 'connection failed'}. Check the server address, Wi-Fi, and firewall.`);
      setStatus('error');
    };
    const onAccepted = (data) => {
      if (!mountedRef.current || inviteFinishedRef.current) return;
      if (callRef.current?.callId && data?.callId !== callRef.current.callId) return;
      acceptedRef.current = true;
      inviteFinishedRef.current = true;
      clearTimers();
      setStatus('accepted');
      navigation.replace('VideoCall', {
        appointmentId, roomId: data.roomId || callRef.current?.roomId,
        autoOpenInBrowser: true,
        role: 'student', displayName: studentDisplayNameRef.current,
        counselorName, studentName: studentDisplayNameRef.current,
        date, time,
      });
    };
    const onDeclined = (data) => {
      if (!mountedRef.current || inviteFinishedRef.current) return;
      if (callRef.current?.callId && data?.callId !== callRef.current.callId) return;
      inviteFinishedRef.current = true;
      clearTimers();
      callRef.current = null;
      setStatus(data?.reason === 'timeout' || data?.reason === 'no-answer'
        ? 'no-answer'
        : data?.reason === 'offline' ? 'offline' : 'declined');
    };
    const onCancelled = (data) => {
      if (callRef.current?.callId && data?.callId === callRef.current.callId) {
        inviteFinishedRef.current = true;
        clearTimers();
        callRef.current = null;
        setStatus('cancelled');
      }
    };
    socket.on('call-accepted', onAccepted);
    socket.on('call-declined', onDeclined);
    socket.on('call-cancelled', onCancelled);
    socket.on('connect_error', onConnectError);
    placeCall();
    return () => {
      mountedRef.current = false;
      clearTimers();
      clearConnectWait();
      socket.off('call-accepted', onAccepted);
      socket.off('call-declined', onDeclined);
      socket.off('call-cancelled', onCancelled);
      socket.off('connect_error', onConnectError);
      if (!acceptedRef.current && callRef.current?.callId) {
        socket.emit('call-cancel', { targetUserId: String(counselorId), callId: callRef.current.callId });
      }
    };
  }, [appointmentId, clearConnectWait, clearTimers, counselorId, counselorName, date, placeCall, time, navigation]);

  const cancelCall = () => {
    clearTimers();
    clearConnectWait();
    inviteFinishedRef.current = true;
    if (callRef.current?.callId) socketRef.current?.emit('call-cancel', { targetUserId: String(counselorId), callId: callRef.current.callId });
    callRef.current = null;
    navigation.goBack();
  };

  const copy = {
    connecting: ['Connecting…', 'Checking the counselor’s availability.'],
    calling: [`Calling ${counselorName}…`, `Waiting for an answer · ${secondsLeft}s`],
    offline: ['Counselor is offline', 'Try again later or send a message through UWell chat.'],
    busy: ['Counselor is busy', 'The counselor is already handling another call. Try again shortly or send a message.'],
    'already-in-call': ['You are already in a call', 'End your current call before starting another one.'],
    'no-answer': ['No answer', 'The counselor did not answer this call. You can try again or send a message.'],
    declined: ['Call declined', `${counselorName} is unavailable right now. You can send a message instead.`],
    cancelled: ['Call ended', 'The call was cancelled.'],
    error: ['Call unavailable', callError || `Could not reach the call server at ${SOCKET_URL}. Check your connection and try again.`],
    accepted: ['Joining call…', 'Connecting your video session.'],
  }[status];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <View style={styles.avatar}><Feather name="video" size={34} color="#C85F4E" /></View>
        <Text style={styles.title}>{copy[0]}</Text>
        <Text style={styles.subtitle}>{copy[1]}</Text>
        {status === 'connecting' || status === 'calling' || status === 'accepted'
          ? <ActivityIndicator style={styles.spinner} color="#C85F4E" />
          : null}
        {status === 'calling' || status === 'connecting' || status === 'accepted' ? (
          <TouchableOpacity style={styles.secondary} onPress={cancelCall}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity>
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primary} onPress={placeCall}><Text style={styles.primaryText}>Try again</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => navigation.navigate('StudentChat', { counselorId, counselorName })}><Text style={styles.secondaryText}>Message counselor</Text></TouchableOpacity>
            <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}><Text style={styles.backText}>Back</Text></TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF8F2' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  avatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCE7DE', marginBottom: 22 },
  title: { color: '#24232A', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#6F737E', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9, maxWidth: 340 },
  spinner: { marginTop: 24 },
  actions: { width: '100%', maxWidth: 340, marginTop: 26, gap: 10 },
  primary: { minHeight: 48, borderRadius: 24, backgroundColor: '#EF6553', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondary: { minHeight: 46, paddingHorizontal: 22, borderRadius: 23, borderWidth: 1, borderColor: '#E8B6A8', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  secondaryText: { color: '#C85F4E', fontSize: 13, fontWeight: '700' },
  back: { alignItems: 'center', padding: 10 },
  backText: { color: '#6F737E', fontSize: 13 },
});
