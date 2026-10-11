import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { videoCallService } from '../../services/videoCallService';

const CORAL = '#EF806B';

function showError(message) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message);
    return;
  }
  Alert.alert('Unable to join video call', message);
}

/**
 * @param {{
 *   appointmentId?: any;
 *   status?: any;
 *   sessionType?: any;
 *   style?: any;
 *   textStyle?: any;
 * }} props
 */
export default function JoinVideoCallButton({
  appointmentId,
  status,
  sessionType,
  style,
  textStyle,
}) {
  const [loading, setLoading] = useState(false);
  const eligible = String(status || '').toLowerCase() === 'confirmed'
    && String(sessionType || '').toLowerCase() === 'online'
    && Boolean(appointmentId);

  const handlePress = async () => {
    if (!eligible || loading) return;
    setLoading(true);
    try {
      const result = await videoCallService.getAppointmentMeetingLink(appointmentId);
      const url = result?.meetingUrl;
      if (typeof url !== 'string' || !/^https:\/\/[a-z0-9.-]+(?::\d{1,5})?\/[a-z0-9_-]+$/i.test(url)) {
        throw new Error('The server returned an invalid meeting link. Please try again.');
      }
      await Linking.openURL(url);
    } catch (error) {
      const serverMessage = error?.response?.data?.message;
      const message = serverMessage
        || (error?.response
          ? 'The video meeting could not be prepared. Please try again.'
          : 'Could not connect to UWell. Check your internet connection and try again.');
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const disabledLabel = !appointmentId
    ? 'Video call unavailable'
    : String(sessionType || '').toLowerCase() !== 'online'
      ? 'Online appointments only'
      : 'Available after counselor confirmation';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={eligible ? 'Join Video Call' : disabledLabel}
      accessibilityState={{ disabled: !eligible || loading, busy: loading }}
      disabled={!eligible || loading}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        style,
        !eligible && styles.disabledButton,
        pressed && eligible && !loading && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
      <Text style={[styles.label, !eligible && styles.disabledLabel, textStyle]}>
        {loading ? 'Preparing video call…' : eligible ? 'Join Video Call' : disabledLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CORAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  disabledButton: { backgroundColor: '#E8DDD8' },
  pressed: { opacity: 0.84 },
  label: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  disabledLabel: { color: '#806E68' },
});
