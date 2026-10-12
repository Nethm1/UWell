/**
 * VideoSessionScreen (Counselor) - invite flow
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import ImagePlaceholder from '../../components/common/ImagePlaceholder';
import { navigateBackSafely } from '../../components/navigation/CounselorBackButton';
import { connectSocket } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';

const TIMEOUT_MS = 30000;
const S = { IDLE: 'idle', CALLING: 'calling', ACCEPTED: 'accepted', DECLINED: 'declined', TIMEOUT: 'timeout', OFFLINE: 'offline', BUSY: 'busy', ERROR: 'error' };

const VideoSessionScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const studentName   = route?.params?.studentName   || 'Student';
  const studentId     = route?.params?.studentId     || '';
  const appointmentId = route?.params?.appointmentId || '';
  const date          = route?.params?.date          || '';
  const time          = route?.params?.time          || '';
  const counselorId = String(user?._id || user?.id || '');
  const counselorName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Counselor';
  const counselorNameRef = useRef(counselorName);
  counselorNameRef.current = counselorName;
  const roomId = useMemo(() => appointmentId ? ('uwell-' + appointmentId) : ('uwell-' + Date.now()), [appointmentId]);

  const [callState, setCallState] = useState(S.IDLE);
  const [countdown, setCountdown] = useState(30);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tRef      = useRef(null);
  const cRef      = useRef(null);
  const socketRef = useRef(null);
  const callRef = useRef(null);
  const attemptActiveRef = useRef(false);

  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, []);

  const clearTimers = useCallback(() => {
    if (tRef.current) clearTimeout(tRef.current);
    if (cRef.current) clearInterval(cRef.current);
    tRef.current = null;
    cRef.current = null;
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;
    if (counselorId) socket.emit('register-user', { userId: counselorId, role: 'counselor' });
    const onAccepted = (data = {}) => {
      if (!attemptActiveRef.current || callRef.current?.callId && data.callId !== callRef.current.callId) return;
      attemptActiveRef.current = false;
      callRef.current = null;
      clearTimers();
      setCallState(S.ACCEPTED);
      navigation.replace('VideoCall', {
        appointmentId, roomId: data.roomId || roomId, autoOpenInBrowser: true, role: 'counselor',
        displayName: counselorNameRef.current,
        studentName, date, time,
      });
    };
    const onDeclined = (data) => {
      if (!attemptActiveRef.current || callRef.current?.callId && data?.callId !== callRef.current.callId) return;
      attemptActiveRef.current = false;
      clearTimers();
      callRef.current = null;
      setCallState(data && data.reason === 'offline' ? S.OFFLINE : data && data.reason === 'timeout' ? S.TIMEOUT : S.DECLINED);
      setCountdown(30);
    };
    const onConnectError = () => {
      if (!attemptActiveRef.current) return;
      attemptActiveRef.current = false;
      clearTimers();
      callRef.current = null;
      setCallState(S.ERROR);
    };
    socket.on('call-accepted', onAccepted);
    socket.on('call-declined', onDeclined);
    socket.on('connect_error', onConnectError);
    return () => {
      clearTimers();
      if (attemptActiveRef.current && callRef.current?.callId) socket.emit('call-cancel', { callId: callRef.current.callId });
      attemptActiveRef.current = false;
      socket.off('call-accepted', onAccepted);
      socket.off('call-declined', onDeclined);
      socket.off('connect_error', onConnectError);
    };
  }, [appointmentId, roomId, studentName, date, time, clearTimers, navigation, counselorId]);

  const handleInvite = useCallback(() => {
    if (!studentId) { Alert.alert('Cannot start call', 'Student ID not available. Try from Appointments.'); return; }
    const socket = socketRef.current;
    const cId = counselorId;
    const cName = counselorNameRef.current;
    if (!socket?.connected) {
      socket?.connect();
      setCallState(S.ERROR);
      return;
    }
    clearTimers();
    attemptActiveRef.current = true;
    callRef.current = null;
    socket.emit('call-invite', { targetUserId: String(studentId), targetRole: 'student', studentId, counselorId: cId, counselorName: cName, studentName, appointmentId, roomId, date, time }, (result) => {
      if (!attemptActiveRef.current) return;
      if (result?.status === 'ringing') callRef.current = result;
      else {
        attemptActiveRef.current = false;
        clearTimers();
        callRef.current = null;
        setCallState(result?.status === 'offline' ? S.OFFLINE : result?.status === 'busy' ? S.BUSY : S.ERROR);
        setCountdown(30);
      }
    });
    setCallState(S.CALLING);
    setCountdown(30);
    tRef.current = setTimeout(() => {
      if (callRef.current?.callId) socket.emit('call-cancel', { callId: callRef.current.callId });
      attemptActiveRef.current = false;
      callRef.current = null;
      setCallState(S.TIMEOUT);
      setCountdown(0);
    }, TIMEOUT_MS);
    cRef.current = setInterval(() => setCountdown((c) => { if (c <= 1) { clearInterval(cRef.current); return 0; } return c - 1; }), 1000);
  }, [studentId, appointmentId, roomId, studentName, date, time, counselorId, clearTimers]);

  const handleCancel = useCallback(() => {
    clearTimers();
    if (callRef.current?.callId) socketRef.current?.emit('call-cancel', { callId: callRef.current.callId });
    attemptActiveRef.current = false;
    callRef.current = null;
    setCallState(S.IDLE);
    setCountdown(30);
  }, [clearTimers]);
  const handleBack = () => {
    clearTimers();
    if (attemptActiveRef.current && callRef.current?.callId) socketRef.current?.emit('call-cancel', { callId: callRef.current.callId });
    attemptActiveRef.current = false;
    callRef.current = null;
    navigateBackSafely(navigation);
  };
  const initials = studentName.split(' ').map((p) => p[0]).filter(Boolean).slice(0,2).join('').toUpperCase() || 'ST';
  const statusLabel = callState === S.CALLING ? ('CALLING... ' + countdown + 's') :
    callState === S.ACCEPTED ? 'CONNECTING...' : callState === S.DECLINED ? 'CALL DECLINED' :
    callState === S.TIMEOUT ? 'NO ANSWER' : callState === S.OFFLINE ? 'STUDENT OFFLINE' : callState === S.BUSY ? 'STUDENT IS BUSY' : callState === S.ERROR ? 'CALL UNAVAILABLE' : 'VIDEO SESSION';

  return (
    <SafeAreaView style={styles.wrap}>
      <StatusBar barStyle={'light-content'} backgroundColor={'#1A1A2E'} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backTxt}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.midRow}>
          <Animated.View style={[styles.dot, {
            backgroundColor: callState === S.CALLING ? '#E74C3C' : '#555',
            opacity: callState === S.CALLING ? pulseAnim : 0.4,
          }]} />
          <Text style={styles.statusTxt}>{statusLabel}</Text>
        </View>
        <Text style={styles.lock}>{'🔒'}</Text>
      </View>
      <View style={styles.stage}>
        <Animated.View style={callState === S.CALLING ? [styles.avatarWrap, { transform: [{ scale: pulseAnim }] }] : styles.avatarWrap}>
          <ImagePlaceholder initials={initials} size={110} backgroundColor={colors.softCoral} textColor={colors.primary} />
        </Animated.View>
        <Text style={styles.nameTxt}>{studentName}</Text>
        {callState === S.IDLE && <Text style={styles.subTxt}>{'Tap below to invite ' + studentName.split(' ')[0] + ' to a video session'}</Text>}
        {callState === S.CALLING && <Text style={styles.callingTxt}>{'Waiting for ' + studentName.split(' ')[0] + ' to join...'}</Text>}
        {callState === S.DECLINED && <Text style={styles.declinedTxt}>{studentName.split(' ')[0] + ' declined the call'}</Text>}
        {callState === S.TIMEOUT && <Text style={styles.declinedTxt}>{'No answer from ' + studentName.split(' ')[0]}</Text>}
        {callState === S.OFFLINE && <Text style={styles.declinedTxt}>{studentName.split(' ')[0] + ' is offline right now'}</Text>}
        {callState === S.BUSY && <Text style={styles.declinedTxt}>{studentName.split(' ')[0] + ' is already in another call'}</Text>}
        {callState === S.ERROR && <Text style={styles.declinedTxt}>Could not connect to the call service. Check your connection and try again.</Text>}
        {(!!date || !!time) && (
          <View style={styles.metaRow}>
            {!!date && <Text style={styles.metaTxt}>{'\uD83D\uDCC5 ' + date}</Text>}
            {!!time && <Text style={styles.metaTxt}>{'\uD83D\uDD50 ' + time}</Text>}
          </View>
        )}
        {callState === S.IDLE && (
          <TouchableOpacity style={styles.inviteBtn} onPress={handleInvite} accessibilityLabel={'Invite student'}>
            <Text style={styles.inviteIcon}>{'📹'}</Text>
            <Text style={styles.inviteTxt}>Invite to Video Session</Text>
          </TouchableOpacity>
        )}
        {callState === S.CALLING && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} accessibilityLabel={'Cancel call'}>
            <Text style={styles.cancelTxt}>{'📵  Cancel'}</Text>
          </TouchableOpacity>
        )}
        {(callState === S.DECLINED || callState === S.TIMEOUT || callState === S.OFFLINE || callState === S.BUSY || callState === S.ERROR) && (
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setCallState(S.IDLE); setCountdown(30); }} accessibilityLabel={'Try again'}>
            <Text style={styles.retryTxt}>{'🔄  Try Again'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  wrap:        { flex: 1, backgroundColor: '#1A1A2E' },
  topBar:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#12122A', gap: 8 },
  backBtn:     { padding: 6 },
  backTxt:     { color: '#EF806B', fontSize: 22, fontWeight: '700' },
  midRow:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dot:         { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusTxt:   { color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  lock:        { color: '#8AAACC', fontSize: 14 },
  stage:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#141430', paddingBottom: 20 },
  avatarWrap:  { marginBottom: 18 },
  nameTxt:     { color: '#FFF', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subTxt:      { color: '#8AAACC', fontSize: 13, textAlign: 'center', paddingHorizontal: 30, marginBottom: 24, lineHeight: 20 },
  callingTxt:  { color: '#A0C8FF', fontSize: 14, marginBottom: 24, fontStyle: 'italic' },
  declinedTxt: { color: '#E74C3C', fontSize: 14, fontWeight: '600', marginBottom: 24 },
  metaRow:     { flexDirection: 'row', gap: 14, marginBottom: 24, backgroundColor: '#242440', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  metaTxt:     { color: '#D0E0F5', fontSize: 12 },
  inviteBtn:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3973B9', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 32, gap: 10, elevation: 4 },
  inviteIcon:  { fontSize: 22 },
  inviteTxt:   { color: '#FFF', fontSize: 15, fontWeight: '700' },
  cancelBtn:   { backgroundColor: '#2A0A0A', borderWidth: 1.5, borderColor: '#C0392B', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28 },
  cancelTxt:   { color: '#E74C3C', fontSize: 14, fontWeight: '700' },
  retryBtn:    { backgroundColor: '#0A1A2A', borderWidth: 1.5, borderColor: '#3973B9', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28 },
  retryTxt:    { color: '#7AB3FF', fontSize: 14, fontWeight: '700' },
});

export default VideoSessionScreen;
