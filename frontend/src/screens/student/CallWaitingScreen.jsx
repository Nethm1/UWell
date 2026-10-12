import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { connectSocket } from '../../services/socketService';

const CALL_TIMEOUT_MS = 30000;

export default function CallWaitingScreen({ route, navigation }) {
  const { user } = useAuth();
  const { counselorId, counselorName = 'Counselor', appointmentId = '', date = '', time = '' } = route.params || {};
  const studentId = String(user?._id || user?.id || '');
  const studentDisplayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'Student';
  const studentDisplayNameRef = useRef(studentDisplayName);
  studentDisplayNameRef.current = studentDisplayName;
  
  const [countdown, setCountdown] = useState(30);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callDeclined, setCallDeclined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [callError, setCallError] = useState('');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const socketRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const socket = connectSocket();
    socketRef.current = socket;

    // Check if we already have an active call invitation
    if (callRef.current?.callId) {
      setCallAccepted(false);
      setCallDeclined(false);
      setCountdown(30);
    }

    const handleAccepted = (data) => {
      if (!mountedRef.current) return;
      if (callRef.current?.callId && data?.callId !== callRef.current.callId) return;
      clearTimers();
      setCallAccepted(true);
      setCallDeclined(false);
      navigation.replace('VideoCall', {
        appointmentId,
        roomId: data.roomId || callRef.current?.roomId,
        autoOpenInBrowser: true,
        role: 'student',
        displayName: studentDisplayNameRef.current,
        counselorName,
        studentName: studentDisplayNameRef.current,
        date,
        time,
      });
    };

    const handleDeclined = (data) => {
      if (!mountedRef.current) return;
      if (callRef.current?.callId && data?.callId !== callRef.current.callId) return;
      clearTimers();
      setCallDeclined(true);
      setCallAccepted(false);
    };

    const handleCancelled = (data) => {
      if (!mountedRef.current) return;
      if (callRef.current?.callId && data?.callId === callRef.current.callId) {
        clearTimers();
        setCallDeclined(true);
        setCallAccepted(false);
      }
    };

    const handleConnectError = (error) => {
      if (!mountedRef.current) return;
      clearTimers();
      setCallError(`Cannot connect: ${error?.message || 'connection failed'}`);
    };

    socket.on('call-accepted', handleAccepted);
    socket.on('call-declined', handleDeclined);
    socket.on('call-cancelled', handleCancelled);
    socket.on('connect_error', handleConnectError);

    // Listen for incoming call invite from counselor
    const handleCallInvite = (data) => {
      if (!mountedRef.current) return;
      // Only accept invite if it's from the expected counselor
      if (data.counselorId !== counselorId) return;
      
      clearTimers();
      callRef.current = data;
      setCallAccepted(false);
      setCallDeclined(false);
      setCountdown(30);
      
      // Start countdown timer
      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Set timeout for the call
      timerRef.current = setTimeout(() => {
        if (callRef.current?.callId) {
          socket.emit('call-cancel', { callId: callRef.current.callId });
        }
        clearTimers();
        setCallError('Call timed out - counselor did not wait');
      }, CALL_TIMEOUT_MS);
    };

    socket.on('call-invite', handleCallInvite);

    setIsLoading(false);

    return () => {
      mountedRef.current = false;
      clearTimers();
      socket.off('call-accepted', handleAccepted);
      socket.off('call-declined', handleDeclined);
      socket.off('call-cancelled', handleCancelled);
      socket.off('call-invite', handleCallInvite);
      socket.off('connect_error', handleConnectError);
    };
  }, [appointmentId, counselorId, counselorName, date, navigation, studentDisplayNameRef, time]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => {
      pulse.stop();
      clearTimers();
    };
  }, []);

  const handleAccept = useCallback(() => {
    if (!socketRef.current?.connected || !callRef.current?.callId) return;
    
    clearTimers();
    callRef.current = null;
    setCallAccepted(true);
    setCallDeclined(false);
    
    // Accept the call on the counselor's side
    socketRef.current.emit('call-accept', { callId: callRef.current?.callId }, (result) => {
      if (result?.roomId) {
        navigation.replace('VideoCall', {
          appointmentId,
          roomId: result.roomId,
          autoOpenInBrowser: true,
          role: 'student',
          displayName: studentDisplayNameRef.current,
          counselorName,
          studentName: studentDisplayNameRef.current,
          date,
          time,
        });
      } else {
        setCallError('Failed to accept call');
      }
    });
  }, [appointmentId, counselorName, clearTimers, date, navigation, studentDisplayNameRef, time]);

  const handleDecline = useCallback(() => {
    if (!socketRef.current?.connected || !callRef.current?.callId) return;
    
    clearTimers();
    socketRef.current.emit('call-decline', {
      callId: callRef.current.callId,
      reason: 'declined',
    });
    callRef.current = null;
    setCallDeclined(true);
    setCallAccepted(false);
    
    // Show decline reason temporarily before going back
    setTimeout(() => {
      navigation.goBack();
    }, 2000);
  }, [navigation]);

  const handleCancel = useCallback(() => {
    clearTimers();
    if (callRef.current?.callId) {
      socketRef.current?.emit('call-cancel', { callId: callRef.current.callId });
    }
    callRef.current = null;
    navigation.goBack();
  }, [clearTimers, navigation]);

  const initials = counselorName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CC';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#EF6553" />
      </SafeAreaView>
    );
  }

  if (callDeclined) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.statusIcon}>
            <Feather name="phone-off" size={48} color="#EF6553" />
          </View>
          <Text style={styles.title}>Call Ended</Text>
          <Text style={styles.subtitle}>
            {callError || 'You declined the call or it timed out.'}
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (callAccepted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.statusIcon}>
            <Feather name="phone" size={48} color="#28734D" />
          </View>
          <Text style={styles.title}>Joining Call...</Text>
          <Text style={styles.subtitle}>Connecting to your counselor.</Text>
          <ActivityIndicator size="large" color="#28734D" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F2" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Incoming Call</Text>
      </View>

      <View style={styles.content}>
        <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.avatar, { backgroundColor: '#FCE7DE' }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </Animated.View>

        <Text style={styles.counselorName}>{counselorName}</Text>
        <Text style={styles.subtitle}>Counselor is inviting you to a video session</Text>

        <View style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>Call ends in:</Text>
          <Text style={styles.countdownNumber}>{countdown}s</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.acceptButton} 
            onPress={handleAccept}
            accessibilityLabel="Accept call"
          >
            <Feather name="phone" size={24} color="#FFFFFF" />
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.declineButton} 
            onPress={handleDecline}
            accessibilityLabel="Decline call"
          >
            <Feather name="phone-off" size={24} color="#FFFFFF" />
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelContainer} onPress={handleCancel}>
          <Text style={styles.cancelText}>Cancel Call</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F2',
  },
  header: {
    backgroundColor: '#EF6553',
    paddingTop: 20,
    paddingBottom: 15,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#EF6553',
  },
  counselorName: {
    color: '#24232A',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6F737E',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 32,
  },
  countdownContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1E8E2',
  },
  countdownLabel: {
    color: '#6F737E',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  countdownNumber: {
    color: '#EF6553',
    fontSize: 24,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28734D',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    gap: 10,
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  declineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF6553',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    gap: 10,
  },
  declineText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelContainer: {
    paddingVertical: 12,
  },
  cancelText: {
    color: '#6F737E',
    fontSize: 13,
    fontWeight: '700',
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1E8E2',
  },
  title: {
    color: '#24232A',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  backButton: {
    backgroundColor: '#EF6553',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
