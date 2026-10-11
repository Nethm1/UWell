/**
 * VideoCallScreen — shared by both Student and Counselor.
 *
 * Embeds a Jitsi Meet room in a full-screen WebView so both parties get
 * real camera + microphone with no extra SDK or native modules required.
 *
 * Room name is deterministic:  uwell-<appointmentId>  (or a random ID as fallback)
 * Both sides navigate here with the same appointmentId → they land in the same room.
 *
 * Socket.io is used to:
 *   • Notify the peer that you have joined / left
 *   • Relay mute/video-off signals so the native UI (outside WebView) updates
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import WebView from 'react-native-webview';
import { connectSocket, disconnectSocket } from '../../services/socketService';

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Params = {
  appointmentId?: string;
  roomId?:        string;      // override room name
  displayName?:   string;      // "Dr. Smith" or student name
  role?:          'student' | 'counselor';
  // legacy props forwarded from old screens
  counselorName?:  string;
  counselorPhone?: string;
  date?:           string;
  time?:           string;
  sessionType?:    string;
  studentName?:    string;
};

/* ─── Jitsi HTML template ─────────────────────────────────────────────────── */
const buildJitsiHtml = (roomName: string, displayName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
  <title>UWell Session</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #jitsi-container { width:100%; height:100%; overflow:hidden; background:#1A1A2E; }
  </style>
</head>
<body>
  <div id="jitsi-container"></div>
  <script src="https://meet.jit.si/external_api.js"></script>
  <script>
    const api = new JitsiMeetExternalAPI('meet.jit.si', {
      roomName: ${JSON.stringify(roomName)},
      parentNode: document.querySelector('#jitsi-container'),
      width: '100%',
      height: '100%',
      userInfo: { displayName: ${JSON.stringify(displayName)} },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        enableWelcomePage: false,
        prejoinPageEnabled: false,
        disableInviteFunctions: true,
        toolbarButtons: [
          'microphone', 'camera', 'desktop', 'fullscreen',
          'fodeviceselection', 'hangup', 'chat', 'settings',
          'raisehand', 'videoquality', 'tileview', 'closedcaptions'
        ],
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
        APP_NAME: 'UWell',
        NATIVE_APP_NAME: 'UWell',
        PROVIDER_NAME: 'UWell',
        LANG_DETECTION: false,
        HIDE_INVITE_MORE_HEADER: true,
      },
    });

    // Relay events to React Native via window.ReactNativeWebView.postMessage
    api.addEventListener('audioMuteStatusChanged',  (e) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mute',     muted: e.muted })));
    api.addEventListener('videoMuteStatusChanged',  (e) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'video',    muted: e.muted })));
    api.addEventListener('videoConferenceLeft',      ()  => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' })));
    api.addEventListener('videoConferenceJoined',    ()  => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'joined' })));
    api.addEventListener('participantJoined',        (e) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'peer-joined', id: e.id, displayName: e.displayName })));
    api.addEventListener('participantLeft',          (e) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'peer-left',   id: e.id })));

    // Expose hangup so React Native can end the call
    window.endCall = () => api.executeCommand('hangup');
  </script>
</body>
</html>
`;

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function VideoCallScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute();
  const params     = (route.params as Params) || {};

  const {
    appointmentId = '',
    role          = 'student',
    date          = '',
    time          = '',
  } = params;

  // Derive display name and room
  const displayName = params.displayName ||
    (role === 'counselor' ? (params.studentName || 'Counselor') : (params.counselorName || 'Student'));

  const roomId = params.roomId ||
    (appointmentId ? `uwell-${appointmentId}` : `uwell-${Date.now()}`);

  const webRef   = useRef<WebView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [sessionJoined,   setSessionJoined]   = useState(false);
  const [peerConnected,   setPeerConnected]    = useState(false);
  const [peerName,        setPeerName]         = useState('');
  const [elapsed,         setElapsed]          = useState(0);
  const [isMuted,         setIsMuted]          = useState(false);
  const [isVideoOff,      setIsVideoOff]       = useState(false);
  const [webViewLoaded,   setWebViewLoaded]    = useState(false);
  const [loadError,       setLoadError]        = useState(false);

  /* ── socket ── */
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    socket.emit('join-room', { roomId, userName: displayName, role });

    socket.on('room-joined',  ({ participantCount }) => {
      if (participantCount > 1) setPeerConnected(true);
    });
    socket.on('peer-joined',  ({ userName }) => {
      setPeerConnected(true);
      setPeerName(userName || '');
    });
    socket.on('peer-left',    () => { setPeerConnected(false); setPeerName(''); });
    socket.on('session-ended', () => handleEnd(false));

    return () => {
      socket.emit('leave-room', { roomId });
      socket.off('room-joined');
      socket.off('peer-joined');
      socket.off('peer-left');
      socket.off('session-ended');
    };
  }, [roomId]);

  /* ── pulse animation ── */
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  /* ── timer ── */
  useEffect(() => {
    if (sessionJoined) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionJoined]);

  const formatElapsed = (s: number) => {
    const m   = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  /* ── WebView message handler ── */
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      const socket = socketRef.current;

      if (msg.type === 'joined') {
        setSessionJoined(true);
      }
      if (msg.type === 'ended') {
        handleEnd(false);
      }
      if (msg.type === 'mute') {
        setIsMuted(msg.muted);
        if (socket) socket.emit('peer-muted', { roomId, muted: msg.muted });
      }
      if (msg.type === 'video') {
        setIsVideoOff(msg.muted);
        if (socket) {
          socket.emit(msg.muted ? 'peer-video-off' : 'peer-video-on', { roomId });
        }
      }
      if (msg.type === 'peer-joined') {
        setPeerConnected(true);
        if (msg.displayName) setPeerName(msg.displayName);
      }
      if (msg.type === 'peer-left') {
        setPeerConnected(false);
      }
    } catch { /* ignore parse errors */ }
  }, [roomId]);

  /* ── End call ── */
  const handleEnd = useCallback((confirm = true) => {
    const doEnd = () => {
      // Tell WebView to hang up
      webRef.current?.injectJavaScript('window.endCall && window.endCall(); true;');
      // Notify peers via socket
      if (socketRef.current) {
        socketRef.current.emit('session-ended', { roomId });
        socketRef.current.emit('leave-room', { roomId });
      }
      if (timerRef.current) clearInterval(timerRef.current);
      navigation.goBack();
    };

    if (!confirm) { doEnd(); return; }

    Alert.alert(
      'End Session?',
      'Are you sure you want to end this counseling session?',
      [
        { text: 'Continue Session', style: 'cancel' },
        { text: 'End Session', style: 'destructive', onPress: doEnd },
      ],
    );
  }, [roomId, navigation]);

  /* ── Mute toggle (via WebView injection) ── */
  const toggleMute = () => {
    webRef.current?.injectJavaScript(`
      (function() {
        var btns = document.querySelectorAll('[aria-label*="mute"], [aria-label*="Mute"], [data-testid="toolbar.audio"]');
        if (btns.length) btns[0].click();
      })(); true;
    `);
  };

  const toggleVideo = () => {
    webRef.current?.injectJavaScript(`
      (function() {
        var btns = document.querySelectorAll('[aria-label*="camera"], [aria-label*="Camera"], [data-testid="toolbar.video"]');
        if (btns.length) btns[0].click();
      })(); true;
    `);
  };

  const html = buildJitsiHtml(roomId, displayName);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D1E" />

      {/* ── Top status bar ── */}
      <View style={styles.topBar}>
        <View style={styles.liveRow}>
          <Animated.View
            style={[
              styles.liveDot,
              {
                opacity:          sessionJoined ? pulseAnim : 0.3,
                backgroundColor:  sessionJoined ? '#E74C3C' : '#666',
              },
            ]}
          />
          <Text style={styles.liveText}>
            {sessionJoined
              ? `LIVE · ${formatElapsed(elapsed)}`
              : webViewLoaded ? 'JOINING…' : 'CONNECTING…'}
          </Text>
        </View>

        <View style={styles.peerStatus}>
          {peerConnected ? (
            <>
              <View style={styles.peerDot} />
              <Text style={styles.peerText}>{peerName || 'Peer'} connected</Text>
            </>
          ) : (
            <Text style={styles.peerTextWaiting}>Waiting for other participant…</Text>
          )}
        </View>

        <Text style={styles.encryptedTag}>🔒</Text>
      </View>

      {/* Session info strip */}
      {(!!date || !!time) && (
        <View style={styles.sessionStrip}>
          {!!date && <Text style={styles.sessionStripText}>📅 {date}</Text>}
          {!!time && <Text style={styles.sessionStripText}>🕐 {time}</Text>}
          <Text style={styles.sessionStripText}>UWell Counseling Session</Text>
        </View>
      )}

      {/* ── WebView — Jitsi Meet ── */}
      <View style={styles.webViewWrapper}>
        {!webViewLoaded && !loadError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#EF806B" />
            <Text style={styles.loadingText}>Starting video session…</Text>
            <Text style={styles.loadingSubText}>Allow camera & microphone access when prompted</Text>
          </View>
        )}

        {loadError && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.errorEmoji}>📡</Text>
            <Text style={styles.errorTitle}>Could not load video session</Text>
            <Text style={styles.errorSub}>
              Check your internet connection. Jitsi Meet requires an active connection.
            </Text>
            <TouchableOpacity
              style={styles.reloadBtn}
              onPress={() => { setLoadError(false); setWebViewLoaded(false); }}
            >
              <Text style={styles.reloadBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loadError && (
          <WebView
            ref={webRef}
            source={{ html }}
            style={styles.webView}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState={false}
            originWhitelist={['*']}
            onLoad={() => setWebViewLoaded(true)}
            onError={() => setLoadError(true)}
            onMessage={handleWebViewMessage}
            // iOS: grant camera/mic permissions automatically inside WebView
            // @ts-ignore — iOS-only prop, valid in react-native-webview ≥ 11
            mediaCapturePermissionGrantType="grant"
            allowsFullscreenVideo
            userAgent="Mozilla/5.0 (Linux; Android 11; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36"
          />
        )}
      </View>

      {/* ── Native control bar (mirrors Jitsi controls for quick access) ── */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={toggleMute}
          accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
          <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isVideoOff && styles.controlBtnActive]}
          onPress={toggleVideo}
          accessibilityLabel={isVideoOff ? 'Start camera' : 'Stop camera'}
        >
          <Text style={styles.controlIcon}>{isVideoOff ? '🚫' : '📹'}</Text>
          <Text style={styles.controlLabel}>{isVideoOff ? 'Camera Off' : 'Camera'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => webRef.current?.injectJavaScript(`
            var b = document.querySelector('[aria-label*="chat"], [aria-label*="Chat"]');
            if(b) b.click(); true;
          `)}
          accessibilityLabel="Open chat"
        >
          <Text style={styles.controlIcon}>💬</Text>
          <Text style={styles.controlLabel}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.endCallBtn]}
          onPress={() => handleEnd(true)}
          accessibilityLabel="End session"
        >
          <Text style={styles.controlIcon}>📵</Text>
          <Text style={styles.endCallLabel}>End</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1E' },

  topBar: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 14,
    paddingVertical:    10,
    backgroundColor:  '#12122A',
    gap: 8,
  },
  liveRow:      { flexDirection: 'row', alignItems: 'center', minWidth: 120 },
  liveDot:      { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  liveText:     { color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  peerStatus:      { flex: 1, alignItems: 'center' },
  peerDot:         { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4EC994', marginBottom: 2, alignSelf: 'center' },
  peerText:        { color: '#4EC994', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  peerTextWaiting: { color: '#8AAACC', fontSize: 10, fontStyle: 'italic', textAlign: 'center' },
  encryptedTag:    { color: '#8AAACC', fontSize: 16 },

  sessionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#1A1A34',
    borderBottomWidth: 1,
    borderBottomColor: '#252545',
  },
  sessionStripText: { color: '#8AAACC', fontSize: 11 },

  webViewWrapper: { flex: 1, backgroundColor: '#141430', position: 'relative' },
  webView:        { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#141430',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    paddingHorizontal: 30,
  },
  loadingText:    { color: '#D0E0F5', fontSize: 15, fontWeight: '700', marginTop: 16 },
  loadingSubText: { color: '#7A9CC8', fontSize: 12, marginTop: 8, textAlign: 'center', lineHeight: 18 },

  errorEmoji:  { fontSize: 40, marginBottom: 14 },
  errorTitle:  { color: '#EF806B', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  errorSub:    { color: '#8AAACC', fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  reloadBtn:   { marginTop: 20, backgroundColor: '#EF806B', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20 },
  reloadBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  controlsBar: {
    flexDirection:    'row',
    justifyContent:   'space-around',
    alignItems:       'center',
    paddingVertical:  13,
    paddingHorizontal: 20,
    backgroundColor:  '#12122A',
    borderTopWidth:   1,
    borderTopColor:   '#252545',
  },
  controlBtn:       { alignItems: 'center', justifyContent: 'center', width: 62, height: 62, borderRadius: 31, backgroundColor: '#242440' },
  controlBtnActive: { backgroundColor: '#3D3D60' },
  controlIcon:      { fontSize: 22 },
  controlLabel:     { color: '#9AAABF', fontSize: 9, marginTop: 2 },
  endCallBtn:       { backgroundColor: '#C0392B' },
  endCallLabel:     { color: '#FFF', fontSize: 9, fontWeight: '700', marginTop: 2 },
});
