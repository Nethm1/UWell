/**
 * VideoSessionScreen (Counselor) - invite flow
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import ImagePlaceholder from '../../components/common/ImagePlaceholder';
import { connectSocket } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';

const TIMEOUT_MS = 30000;
const S = { IDLE: 'idle', CALLING: 'calling', ACCEPTED: 'accepted', DECLINED: 'declined', TIMEOUT: 'timeout' };

const VideoSessionScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const studentName   = route?.params?.studentName   || 'Student';
  const studentId     = route?.params?.studentId     || '';
  const appointmentId = route?.params?.appointmentId || '';
  const date          = route?.params?.date          || '';
  const time          = route?.params?.time          || '';
  const roomId = appointmentId ? ('uwell-' + appointmentId) : ('uwell-' + Date.now());

  const [callState, setCallState] = useState(S.IDLE);
  const [countdown, setCountdown] = useState(30);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tRef      = useRef(null);
  const cRef      = useRef(null);
  const socketRef = useRef(null);

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
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;
    const cId = user?._id || user?.id || '';
    if (cId) socket.emit('register-user', { userId: cId, role: 'counselor' });
    const onAccepted = () => {
      clearTimers();
      setCallState(S.ACCEPTED);
      navigation.replace('VideoCall', {
        appointmentId, roomId, role: 'counselor',
        displayName: user?.firstName ? (user.firstName + ' ' + (user.lastName || '')).trim() : 'Counselor',
        studentName, date, time,
      });
    };
    const onDeclined = (data) => {
      clearTimers();
      setCallState(data && data.reason === 'timeout' ? S.TIMEOUT : S.DECLINED);
      setCountdown(30);
    };
    socket.on('call-accepted', onAccepted);
    socket.on('call-declined', onDeclined);
    return () => {
      clearTimers();
      socket.off('call-accepted', onAccepted);
      socket.off('call-declined', onDeclined);
    };
  }, [appointmentId, roomId, studentName, date, time, clearTimers, navigation, user]);

  const handleInvite = useCallback(() => {
    if (!studentId) { Alert.alert('Cannot start call', 'Student ID not available. Try from Appointments.'); return; }
    const socket = socketRef.current;
    const cId = user?._id || user?.id || '';
    const cName = user?.firstName ? (user.firstName + ' ' + (user.lastName || '')).trim() : 'Counselor';
    if (socket) socket.emit('call-invite', { studentId, counselorId: cId, counselorName: cName, studentName, appointmentId, roomId, date, time });
    setCallState(S.CALLING);
    setCountdown(30);
    tRef.current = setTimeout(() => { setCallState(S.TIMEOUT); setCountdown(0); }, TIMEOUT_MS);
    cRef.current = setInterval(() => setCountdown((c) => { if (c <= 1) { clearInterval(cRef.current); return 0; } return c - 1; }), 1000);
  }, [studentId, appointmentId, roomId, studentName, date, time, user]);

  const handleCancel = useCallback(() => { clearTimers(); setCallState(S.IDLE); setCountdown(30); }, [clearTimers]);
  const handleBack = () => { clearTimers(); navigation.goBack(); };
  const initials = studentName.split(' ').map((p) => p[0]).filter(Boolean).slice(0,2).join('').toUpperCase() || 'ST';
  const statusLabel = callState === S.CALLING ? ('CALLING... ' + countdown + 's') :
    callState === S.ACCEPTED ? 'CONNECTING...' : callState === S.DECLINED ? 'CALL DECLINED' :
    callState === S.TIMEOUT ? 'NO ANSWER' : 'VIDEO SESSION';

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
        {(callState === S.DECLINED || callState === S.TIMEOUT) && (
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setCallState(S.IDLE); setCountdown(30); }} accessibilityLabel={'Try again'}>
            <Text style={styles.retryTxt}>{'🔄  Try Again'}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.selfView}>
          <Text style={styles.selfTxt}>You (Counselor)</Text>
        </View>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.ctrl}><Text style={styles.ctrlIcon}>{'🎙️'}</Text><Text style={styles.ctrlLbl}>Mute</Text></TouchableOpacity>
        <TouchableOpacity style={styles.ctrl}><Text style={styles.ctrlIcon}>{'📹'}</Text><Text style={styles.ctrlLbl}>Camera</Text></TouchableOpacity>
        <TouchableOpacity style={styles.ctrl}><Text style={styles.ctrlIcon}>{'🖥️'}</Text><Text style={styles.ctrlLbl}>Share</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.ctrl, styles.endBtn]} onPress={handleBack}>
          <Text style={styles.ctrlIcon}>{'📵'}</Text>
          <Text style={styles.endLbl}>End</Text>
        </TouchableOpacity>
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
  selfView:    { position: 'absolute', bottom: 24, right: 20, width: 90, height: 120, backgroundColor: '#2D3050', borderRadius: 12, borderWidth: 2, borderColor: '#EF806B', alignItems: 'center', justifyContent: 'center' },
  selfTxt:     { color: '#FFF', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  controls:    { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: '#12122A', borderTopWidth: 1, borderTopColor: '#2A2A4A' },
  ctrl:        { alignItems: 'center', width: 60, height: 60, borderRadius: 30, backgroundColor: '#242440', justifyContent: 'center' },
  ctrlIcon:    { fontSize: 20 },
  ctrlLbl:     { color: '#9AAABF', fontSize: 9, marginTop: 2 },
  endBtn:      { backgroundColor: '#C0392B' },
  endLbl:      { color: '#FFF', fontSize: 9, fontWeight: '700', marginTop: 2 },
});

export default VideoSessionScreen;