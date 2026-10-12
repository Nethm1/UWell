/**
 * Student Video Session Screen
 * Shows session info (counselor name, date, time) and a Join Session button.
 * Uses tel: link for the actual call while showing a live session timer.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Linking,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function StudentVideoSessionScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute();
  const params     = (route.params as {
    counselorName?:  string;
    counselorPhone?: string;
    appointmentId?:  string;
    sessionType?:    string;
    date?:           string;
    time?:           string;
  }) || {};

  const {
    counselorName  = 'Counselor',
    counselorPhone = '',
    date           = '',
    time           = '',
  } = params;

  const [isMuted,     setIsMuted]     = useState(false);
  const [isVideoOff,  setIsVideoOff]  = useState(false);
  const [callStarted, setCallStarted] = useState(false);
  const [elapsed,     setElapsed]     = useState(0);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initials from counselor name
  const initials = counselorName
    .split(' ')
    .map((p: string) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => {
      pulse.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatElapsed = (s: number) => {
    const m   = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const handleJoin = () => {
    if (!counselorPhone) {
      Alert.alert(
        'No phone number',
        'The counselor does not have a contact number on file. Please message them via chat to arrange the call.',
        [
          { text: 'OK' },
          {
            text: 'Message Counselor',
            onPress: () => navigation.goBack(),
          },
        ],
      );
      return;
    }
    Linking.openURL(`tel:${counselorPhone}`).catch(() =>
      Alert.alert('Unable to dial', 'Your device could not open the phone dialer.'),
    );
    setCallStarted(true);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const handleEndCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.liveRow}>
          <Animated.View
            style={[
              styles.liveDot,
              { opacity: callStarted ? pulseAnim : 0.35, backgroundColor: callStarted ? '#E74C3C' : '#888' },
            ]}
          />
          <Text style={styles.liveText}>
            {callStarted ? `SESSION · ${formatElapsed(elapsed)}` : 'READY TO JOIN'}
          </Text>
        </View>
        <Text style={styles.encryptedTag}>🔒 Confidential</Text>
      </View>

      {/* ── Main stage ── */}
      <ScrollView
        contentContainerStyle={styles.stageScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Session info card */}
        <View style={styles.sessionInfoCard}>
          <Text style={styles.sessionInfoLabel}>COUNSELING SESSION</Text>

          {!!date && (
            <View style={styles.sessionInfoRow}>
              <Text style={styles.sessionInfoIcon}>📅</Text>
              <Text style={styles.sessionInfoText}>{date}</Text>
            </View>
          )}
          {!!time && (
            <View style={styles.sessionInfoRow}>
              <Text style={styles.sessionInfoIcon}>🕐</Text>
              <Text style={styles.sessionInfoText}>{time}</Text>
            </View>
          )}
          <View style={styles.sessionInfoRow}>
            <Text style={styles.sessionInfoIcon}>🎥</Text>
            <Text style={styles.sessionInfoText}>Online Video Session</Text>
          </View>
        </View>

        {/* Counselor avatar */}
        <View style={styles.counselorAvatar}>
          <Text style={styles.counselorInitials}>{initials}</Text>
        </View>
        <Text style={styles.counselorNameText}>{counselorName}</Text>
        <Text style={styles.sessionSubText}>UWell Counseling Session</Text>

        {/* Status / Join button */}
        {!callStarted ? (
          <>
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={handleJoin}
              accessibilityLabel="Join session"
            >
              <Text style={styles.joinBtnIcon}>📞</Text>
              <Text style={styles.joinBtnText}>Join Session</Text>
            </TouchableOpacity>

            {!counselorPhone && (
              <Text style={styles.noPhoneHint}>
                No phone number on file — contact via chat
              </Text>
            )}
          </>
        ) : (
          <View style={styles.callActiveBox}>
            <Animated.View style={[styles.callPulseDot, { opacity: pulseAnim }]} />
            <Text style={styles.callActiveText}>
              Session in progress · {formatElapsed(elapsed)}
            </Text>
          </View>
        )}

        {/* Self view */}
        <View style={styles.selfView}>
          <Text style={styles.selfViewText}>You</Text>
        </View>
      </ScrollView>

      {/* ── Controls ── */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={() => setIsMuted(v => !v)}
          accessibilityLabel="Toggle mute"
        >
          <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
          <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isVideoOff && styles.controlBtnActive]}
          onPress={() => setIsVideoOff(v => !v)}
          accessibilityLabel="Toggle camera"
        >
          <Text style={styles.controlIcon}>{isVideoOff ? '🚫' : '📹'}</Text>
          <Text style={styles.controlLabel}>{isVideoOff ? 'Start Video' : 'Camera'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          accessibilityLabel="Share screen"
        >
          <Text style={styles.controlIcon}>🖥️</Text>
          <Text style={styles.controlLabel}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.endCallBtn]}
          onPress={handleEndCall}
          accessibilityLabel="End Session"
        >
          <Text style={styles.controlIcon}>📵</Text>
          <Text style={styles.endCallLabel}>End</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: '#12122A',
  },
  liveRow:       { flexDirection: 'row', alignItems: 'center' },
  liveDot:       { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  liveText:      { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  encryptedTag:  { color: '#8AAACC', fontSize: 11 },

  stageScroll: {
    paddingBottom: 30,
    alignItems: 'center',
    paddingTop: 20,
  },

  /* Session info card */
  sessionInfoCard: {
    backgroundColor: '#242440',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: '88%',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#353560',
  },
  sessionInfoLabel: {
    color: '#7A9CC8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sessionInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sessionInfoIcon: { fontSize: 15, marginRight: 10, width: 22 },
  sessionInfoText: { color: '#D0E0F5', fontSize: 13, fontWeight: '600' },

  /* Avatar */
  counselorAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#EF806B22',
    borderWidth: 2.5,
    borderColor: '#EF806B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  counselorInitials:  { fontSize: 36, fontWeight: '700', color: '#EF806B' },
  counselorNameText:  { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 5 },
  sessionSubText:     { color: '#8AAACC', fontSize: 13, marginBottom: 28 },

  /* Join button */
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF806B',
    paddingHorizontal: 36,
    paddingVertical: 15,
    borderRadius: 32,
    gap: 10,
    marginBottom: 12,
    shadowColor: '#EF806B',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  joinBtnIcon: { fontSize: 22 },
  joinBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  noPhoneHint: {
    color: '#8AAACC',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 30,
    marginTop: 4,
  },

  /* Call active */
  callActiveBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A3A28',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  callPulseDot:   { width: 9, height: 9, borderRadius: 5, backgroundColor: '#65B87A' },
  callActiveText: { color: '#65B87A', fontSize: 13, fontWeight: '600' },

  /* Self view */
  selfView: {
    width: 100,
    height: 130,
    backgroundColor: '#2D3050',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#EF806B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  selfViewText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  /* Controls */
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#12122A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A4A',
  },
  controlBtn:      { alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 30, backgroundColor: '#2A2A4A' },
  controlBtnActive:{ backgroundColor: '#3D3D60' },
  controlIcon:     { fontSize: 22 },
  controlLabel:    { color: '#9AAABF', fontSize: 9, marginTop: 2 },
  endCallBtn:      { backgroundColor: '#C0392B' },
  endCallLabel:    { color: '#FFFFFF', fontSize: 9, fontWeight: '700', marginTop: 2 },
});
