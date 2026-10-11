/**
 * VideoCallScreen — shared by both Student and Counselor.
 *
 * Embeds Jitsi Meet in a WebView on iOS/Android and an iframe on web.
 *
 * The authenticated Socket.IO server issues a random room id when the invite is accepted.
 * Both participants receive that id and join the same Jitsi room.
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
  Linking,
  Animated,
  Platform,
  ActivityIndicator,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import WebView from 'react-native-webview';
import { connectSocket } from '../../services/socketService';

const JITSI_DOMAIN = (process.env.EXPO_PUBLIC_JITSI_DOMAIN || 'meet.jit.si').replace(/^https?:\/\//, '').replace(/\/$/, '');

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Params = {
  appointmentId?: string;
  roomId?:        string;      // override room name
  displayName?:   string;      // "Dr. Smith" or student name
  role?:          'student' | 'counselor';
  autoOpenInBrowser?: boolean;
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
  <script src="https://${JITSI_DOMAIN}/external_api.js"></script>
  <script>
    const api = new JitsiMeetExternalAPI(${JSON.stringify(JITSI_DOMAIN)}, {
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
        // Jitsi replaced prejoinPageEnabled with prejoinConfig.enabled.
        // Disabling prejoin makes the native WebView enter the session directly
        // instead of waiting for the counselor to press Jitsi's Join meeting button.
        prejoinConfig: { enabled: false },
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

    const notifyApp = (payload) => {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      if (window.parent && window.parent !== window) window.parent.postMessage(payload, '*');
    };
    api.addEventListener('audioMuteStatusChanged', (e) => notifyApp({ type: 'mute', muted: e.muted }));
    api.addEventListener('videoMuteStatusChanged', (e) => notifyApp({ type: 'video', muted: e.muted }));
    api.addEventListener('videoConferenceLeft', () => notifyApp({ type: 'ended' }));
    api.addEventListener('videoConferenceJoined', () => notifyApp({ type: 'joined' }));
    api.addEventListener('participantJoined', (e) => notifyApp({ type: 'peer-joined', id: e.id, displayName: e.displayName }));
    api.addEventListener('participantLeft', (e) => notifyApp({ type: 'peer-left', id: e.id }));

    // Expose hangup so React Native can end the call
    window.endCall = () => api.executeCommand('hangup');
    window.addEventListener('message', (event) => {
      if (event.data === 'uwell-hangup') window.endCall();
    });
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
    (role === 'counselor' ? (params.counselorName || 'Counselor') : (params.studentName || 'Student'));

  const fallbackRoomIdRef = useRef(`uwell-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const roomId = params.roomId || fallbackRoomIdRef.current;

  const webRef   = useRef<any>(null);
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
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [mediaPermissionReady, setMediaPermissionReady] = useState(Platform.OS !== 'android');
  const [roomUnavailable, setRoomUnavailable] = useState(false);
  const [callAccessFailed, setCallAccessFailed] = useState(false);
  const [socketRoomAuthorized, setSocketRoomAuthorized] = useState(false);
  const [externalBrowserOpened, setExternalBrowserOpened] = useState(false);
  const browserLaunchAttemptedRef = useRef(false);
  const endingRef = useRef(false);

  const requestAndroidMediaPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const permissions = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      const granted = Object.values(permissions).every((result) => result === PermissionsAndroid.RESULTS.GRANTED);
      setPermissionDenied(!granted);
      setMediaPermissionReady(true);
      setLoadError(!granted);
      return granted;
    } catch {
      setPermissionDenied(true);
      setMediaPermissionReady(true);
      setLoadError(true);
      return false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') requestAndroidMediaPermissions();
  }, [requestAndroidMediaPermissions]);

  useEffect(() => {
    if (!params.autoOpenInBrowser || Platform.OS === 'web' || !socketRoomAuthorized || browserLaunchAttemptedRef.current) return;
    browserLaunchAttemptedRef.current = true;
    const url = `https://${JITSI_DOMAIN}/${encodeURIComponent(roomId)}`;
    Linking.openURL(url)
      .then(() => setExternalBrowserOpened(true))
      .catch(() => {
        browserLaunchAttemptedRef.current = false;
        Alert.alert('Could not open video call', 'The call will stay open in UWell. Check that your device has a browser installed.');
      });
  }, [params.autoOpenInBrowser, roomId, socketRoomAuthorized]);

  /* ── socket ── */
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);
  const handleEndRef = useRef<((confirm?: boolean) => void) | null>(null);
  const roomAuthorizedRef = useRef(false);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;
    let active = true;
    roomAuthorizedRef.current = false;
    endingRef.current = false;
    setSocketRoomAuthorized(false);
    setRoomUnavailable(false);
    setCallAccessFailed(false);
    const joinRoom = () => socket.emit('join-room', { roomId, userName: displayName, role });

    const onCallRoomUnavailable = (data: { roomId?: string }) => {
      if (data?.roomId === roomId) {
        setRoomUnavailable(true);
        setLoadError(true);
      }
    };
    const onRoomJoined = (data: { roomId?: string; participantCount?: number }) => {
      if (data?.roomId !== roomId) return;
      roomAuthorizedRef.current = true;
      // A temporary socket failure may recover before this room is authorized.
      // Clear the loading error so the video frame can mount after recovery.
      setCallAccessFailed(false);
      setRoomUnavailable(false);
      setLoadError(false);
      setSocketRoomAuthorized(true);
      if ((data.participantCount || 0) > 1) setPeerConnected(true);
    };
    const onPeerJoined = ({ userName, roomId: eventRoomId }: { userName?: string; roomId?: string }) => {
      if (eventRoomId && eventRoomId !== roomId) return;
      setPeerConnected(true);
      setPeerName(userName || '');
    };
    const onPeerLeft = ({ roomId: eventRoomId }: { roomId?: string }) => {
      if (eventRoomId && eventRoomId !== roomId) return;
      setPeerConnected(false);
      setPeerName('');
    };
    const onSessionEnded = (data: { roomId?: string }) => {
      if (!data?.roomId || data.roomId === roomId) handleEndRef.current?.(false);
    };
    socket.on('call-room-unavailable', onCallRoomUnavailable);
    socket.on('room-joined', onRoomJoined);
    socket.on('peer-joined', onPeerJoined);
    socket.on('peer-left', onPeerLeft);
    socket.on('session-ended', onSessionEnded);
    if (socket.connected) joinRoom();
    socket.on('connect', joinRoom);

    const accessTimeout = setTimeout(() => {
      if (!active || roomAuthorizedRef.current) return;
      setCallAccessFailed(true);
      setLoadError(true);
    }, 15000);

    return () => {
      active = false;
      clearTimeout(accessTimeout);
      socket.emit('leave-room', { roomId });
      socket.off('connect', joinRoom);
      socket.off('room-joined', onRoomJoined);
      socket.off('peer-joined', onPeerJoined);
      socket.off('peer-left', onPeerLeft);
      socket.off('session-ended', onSessionEnded);
      socket.off('call-room-unavailable', onCallRoomUnavailable);
    };
  }, [roomId, displayName, role]);

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

  useEffect(() => navigation.addListener('beforeRemove', () => {
    if (endingRef.current) return;
    endingRef.current = true;
    socketRef.current?.emit('session-ended', { roomId });
    socketRef.current?.emit('leave-room', { roomId });
  }), [navigation, roomId]);

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
      const rawMessage = event?.nativeEvent?.data ?? event?.data;
      const msg = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
      if (!msg?.type) return;
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

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onJitsiMessage = (event: MessageEvent) => {
      if (event.source !== webRef.current?.contentWindow || event.origin !== window.location.origin) return;
      handleWebViewMessage(event);
    };
    window.addEventListener('message', onJitsiMessage);
    return () => window.removeEventListener('message', onJitsiMessage);
  }, [handleWebViewMessage]);

  /* ── End call ── */
  const handleEnd = useCallback((confirm = true) => {
    const doEnd = () => {
      if (endingRef.current) return;
      endingRef.current = true;
      // Tell WebView to hang up
      if (Platform.OS === 'web') webRef.current?.contentWindow?.postMessage('uwell-hangup', '*');
      else webRef.current?.injectJavaScript('window.endCall && window.endCall(); true;');
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
  handleEndRef.current = handleEnd;

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

  // Android WebView media capture can vary across Expo Go / System WebView
  // versions. Opening the same room in the installed browser lets its native
  // camera and microphone permission flow handle the session.
  const openCallInBrowser = useCallback(async () => {
    const url = `https://${JITSI_DOMAIN}/${encodeURIComponent(roomId)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open video call', 'Please install or enable a web browser, then try again.');
    }
  }, [roomId]);

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
            <Text style={styles.loadingText}>{socketRoomAuthorized ? 'Starting video session…' : 'Verifying call invitation…'}</Text>
            <Text style={styles.loadingSubText}>{socketRoomAuthorized ? 'Allow camera & microphone access when prompted' : 'Connecting securely to the UWell call service'}</Text>
          </View>
        )}

        {loadError && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.errorEmoji}>📡</Text>
            <Text style={styles.errorTitle}>{roomUnavailable ? 'This call is no longer available' : callAccessFailed ? 'Could not verify this call' : 'Could not load video session'}</Text>
            <Text style={styles.errorSub}>
              {roomUnavailable
                ? 'The call may have ended or the invitation expired. Return to the previous screen and start a new call.'
                : callAccessFailed
                ? 'The call server could not authorize this room. Check your connection and start a new call.'
                : permissionDenied
                ? 'Camera and microphone permissions are required. Allow them in device settings, then try again.'
                : 'Check your internet connection. Jitsi Meet requires an active connection.'}
            </Text>
            <TouchableOpacity
              style={styles.reloadBtn}
              onPress={() => {
                if (roomUnavailable || callAccessFailed) {
                  navigation.goBack();
                  return;
                }
                setLoadError(false);
                setWebViewLoaded(false);
                setMediaPermissionReady(Platform.OS !== 'android');
                if (Platform.OS === 'android') requestAndroidMediaPermissions();
              }}
            >
              <Text style={styles.reloadBtnText}>{roomUnavailable || callAccessFailed ? 'Return' : 'Try Again'}</Text>
            </TouchableOpacity>
          </View>
        )}

          {!loadError && socketRoomAuthorized && mediaPermissionReady && Platform.OS === 'web' && React.createElement('iframe', {
          ref: webRef,
          title: 'UWell video counseling session',
          srcDoc: html,
          allow: 'camera; microphone; display-capture; autoplay; fullscreen',
          allowFullScreen: true,
          onLoad: () => setWebViewLoaded(true),
          onError: () => setLoadError(true),
          style: { width: '100%', height: '100%', border: 0, backgroundColor: '#1A1A2E' },
        })}
        {externalBrowserOpened && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.errorTitle}>Call opened in your browser</Text>
            <Text style={styles.errorSub}>Use the browser for camera, microphone, and call controls. Return here when you finish to close the UWell call.</Text>
          </View>
        )}

        {!externalBrowserOpened && !loadError && socketRoomAuthorized && mediaPermissionReady && Platform.OS !== 'web' && (
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
      {Platform.OS !== 'web' && <View style={styles.controlsBar}>
        {externalBrowserOpened ? (
          <TouchableOpacity
            style={[styles.controlBtn, styles.endCallBtn]}
            onPress={() => handleEnd(true)}
            accessibilityLabel="End session"
          >
            <Text style={styles.controlIcon}>📵</Text>
            <Text style={styles.endCallLabel}>End</Text>
          </TouchableOpacity>
        ) : <>
        <TouchableOpacity
          style={styles.browserFallback}
          onPress={openCallInBrowser}
          accessibilityRole="button"
          accessibilityLabel="Open this video call in your browser"
        >
          <Text style={styles.browserFallbackText}>Video or audio not working? Open call in browser</Text>
        </TouchableOpacity>
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
        </>}
      </View>}
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
    flexWrap:         'wrap',
    justifyContent:   'space-around',
    alignItems:       'center',
    paddingVertical:  13,
    paddingHorizontal: 20,
    backgroundColor:  '#12122A',
    borderTopWidth:   1,
    borderTopColor:   '#252545',
  },
  browserFallback: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#242440',
  },
  browserFallbackText: { color: '#D0E0F5', fontSize: 11, fontWeight: '600' },
  controlBtn:       { alignItems: 'center', justifyContent: 'center', width: 62, height: 62, borderRadius: 31, backgroundColor: '#242440' },
  controlBtnActive: { backgroundColor: '#3D3D60' },
  controlIcon:      { fontSize: 22 },
  controlLabel:     { color: '#9AAABF', fontSize: 9, marginTop: 2 },
  endCallBtn:       { backgroundColor: '#C0392B' },
  endCallLabel:     { color: '#FFF', fontSize: 9, fontWeight: '700', marginTop: 2 },
});
