import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ScrollView, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { studentService } from '../../services/studentService';
import { notificationService } from '../../services/notificationService';
import JoinVideoCallButton from '../../components/common/JoinVideoCallButton';

const CORAL = '#EF806B';
const CREAM = '#FFF9F3';
const DARK  = '#4A3833';
const MUTED = '#8A7770';
const WHITE = '#FFFFFF';

/* ── Inline Icons ─────────────────────────────────────────────────────────── */
function CalendarIcon({ color = CORAL }: { color?: string }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 16, height: 14, borderWidth: 1.5, borderColor: color, borderRadius: 3 }} />
      <View style={{ position: 'absolute', top: 1, width: 1.5, height: 5, backgroundColor: color, left: 5 }} />
      <View style={{ position: 'absolute', top: 1, width: 1.5, height: 5, backgroundColor: color, right: 5 }} />
    </View>
  );
}

function ClockIcon({ color = CORAL }: { color?: string }) {
  return (
    <View style={{ width: 18, height: 18, borderWidth: 1.5, borderColor: color, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 1.5, height: 5, backgroundColor: color, bottom: 9, right: 9 - 0.75 }} />
      <View style={{ position: 'absolute', width: 5, height: 1.5, backgroundColor: color, left: 9, top: 9 - 0.75 }} />
    </View>
  );
}

function MonitorIcon({ color = CORAL }: { color?: string }) {
  return (
    <View style={{ width: 20, height: 18, alignItems: 'center' }}>
      <View style={{ width: 18, height: 13, borderWidth: 1.5, borderColor: color, borderRadius: 3 }} />
      <View style={{ width: 8, height: 1.5, backgroundColor: color, marginTop: 1 }} />
      <View style={{ width: 12, height: 1.5, backgroundColor: color, marginTop: 1 }} />
    </View>
  );
}

function NoteIcon({ color = CORAL }: { color?: string }) {
  return (
    <View style={{ width: 16, height: 18 }}>
      <View style={{ width: 16, height: 18, borderWidth: 1.5, borderColor: color, borderRadius: 3 }} />
      <View style={{ position: 'absolute', width: 9, height: 1.5, backgroundColor: color, left: 3, top: 5 }} />
      <View style={{ position: 'absolute', width: 9, height: 1.5, backgroundColor: color, left: 3, top: 9 }} />
      <View style={{ position: 'absolute', width: 6, height: 1.5, backgroundColor: color, left: 3, top: 13 }} />
    </View>
  );
}

function PersonIcon({ color = CORAL }: { color?: string }) {
  return (
    <View style={{ width: 18, height: 20, alignItems: 'center' }}>
      <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: color }} />
      <View style={{ width: 16, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: color, marginTop: 1 }} />
    </View>
  );
}

function RefreshIcon({ color = WHITE }: { color?: string }) {
  return (
    <View style={{ width: 18, height: 18, borderWidth: 2, borderColor: color, borderRadius: 9, borderRightColor: 'transparent', transform: [{ rotate: '45deg' }] }} />
  );
}

function XIcon({ color = '#C94C4C' }: { color?: string }) {
  return (
    <View style={{ width: 14, height: 14 }}>
      <View style={{ position: 'absolute', width: 14, height: 1.5, backgroundColor: color, top: 6, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: 14, height: 1.5, backgroundColor: color, top: 6, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

function CheckIcon({ color = '#4E9B5C' }: { color?: string }) {
  return (
    <View style={{ width: 20, height: 20 }}>
      <View style={{ position: 'absolute', width: 7, height: 1.5, backgroundColor: color, bottom: 7, left: 3, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: 11, height: 1.5, backgroundColor: color, bottom: 9, left: 6, transform: [{ rotate: '-55deg' }] }} />
    </View>
  );
}

/* ── Main Screen ──────────────────────────────────────────────────────────── */
export default function AppointmentDetailsScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute();
  const { appointmentId } = (route.params as { appointmentId?: string }) || {};

  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [cancelling, setCancelling]   = useState(false);
  const [counselorPhone, setCounselorPhone]       = useState<string>('');
  const [counselorLocation, setCounselorLocation] = useState<string>('');

  useFocusEffect(
    React.useCallback(() => {
      if (!appointmentId) {
        setLoading(false);
        return;
      }
      loadAppointment();
    }, [appointmentId]),
  );

  useEffect(() => {
    const unsub = notificationService.onAppointmentChange(
      () => loadAppointment(),
      () => {
        Alert.alert('Appointment Cancelled', 'This appointment was removed by the Welfare Officer.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    );
    return () => {
      if (unsub) unsub();
    };
  }, [appointmentId]);

  const loadAppointment = async () => {
    try {
      const res = await studentService.getAppointmentById(appointmentId!);
      const data = res?.data;
      setAppointment(data);
      // Fetch counselor phone and location for session actions
      if (data?.counselorId) {
        try {
          const cRes = await studentService.getCounselorById(String(data.counselorId));
          const phone = (cRes?.data?.phone || '').replace(/[^\d+]/g, '');
          setCounselorPhone(phone);
          setCounselorLocation(cRes?.data?.officeLocation || '');
        } catch {
          // unavailable — buttons show disabled state
        }
      }
    } catch {
      // use fallback
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'Keep Appointment', style: 'cancel' },
        {
          text: 'Cancel Appointment',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              await studentService.cancelAppointment(appointmentId!);
              Alert.alert(
                'Appointment Cancelled',
                'Your appointment has been cancelled.',
                [{
                  text: 'OK',
                  onPress: () => {
                    const parent = navigation.getParent();
                    if (parent) {
                      parent.navigate('Sessions');
                    } else if (navigation.canGoBack()) {
                      navigation.goBack();
                    }
                  },
                }],
              );
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Could not cancel. Try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const handleReschedule = () => {
    if (!appointmentId) return;
    navigation.navigate('Availability', {
      counselorId: appt.counselorId || undefined,
      appointmentId,
      counselorName: appt.counselorName || '',
    });
  };

  const handleViewLocation = () => {
    if (!counselorLocation) {
      Alert.alert('Location unavailable', 'The office location has not been set for this counselor.');
      return;
    }
    // Open in Maps (Google Maps on Android, Apple Maps on iOS)
    const query = encodeURIComponent(counselorLocation);
    const url   = `https://maps.google.com/?q=${query}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open maps', 'Your device could not open the maps application.'),
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={CORAL} />
        </View>
      </SafeAreaView>
    );
  }

  const appt = appointment || {
    counselorName: '',
    counselorSpecialization: 'Student Counselling',
    date: '',
    time: '',
    sessionType: 'Online',
    status: 'upcoming',
    notes: '',
  };

  const isUpcoming    = appt.status === 'upcoming';
  const isConfirmed   = appt.status === 'confirmed';
  const isCancelled   = appt.status === 'cancelled';
  const isCompleted   = appt.status === 'completed';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Appointment Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* ── Status Banner ── */}
        <View style={[styles.statusBanner,
          isCancelled  ? styles.bannerCancelled :
          isCompleted  ? styles.bannerCompleted :
          isConfirmed  ? styles.bannerConfirmed :
          styles.bannerUpcoming
        ]}>
          <View style={styles.statusIconWrap}>
            {isCancelled
              ? <XIcon color="#C94C4C" />
              : isCompleted
                ? <CheckIcon color="#4E9B5C" />
                : <CheckIcon color="#4E9B5C" />
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {isCancelled ? 'Appointment Cancelled'
                : isCompleted ? 'Session Completed'
                : isConfirmed ? 'Appointment Confirmed'
                : 'Appointment Confirmed'}
            </Text>
            <Text style={styles.statusSub}>
              {isCancelled ? 'This appointment has been cancelled.'
                : isCompleted ? 'This session has been completed.'
                : isConfirmed ? 'Your counseling session is confirmed. Start video session with your counselor.'
                : 'Your counseling session is confirmed.'}
            </Text>
          </View>
        </View>

        {/* ── Counselor ── */}
        <Text style={styles.sectionTitle}>Counselor</Text>
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <PersonIcon color={CORAL} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.counselorName}>{appt.counselorName}</Text>
            <Text style={styles.counselorSpec}>{appt.counselorSpecialization}</Text>
          </View>
        </View>

        {!!appt.counselorId && !isCancelled && (
          <Pressable
            style={({ pressed }) => [styles.messageCounselorBtn, pressed && { opacity: 0.82 }]}
            onPress={() => navigation.navigate('StudentChat', {
              counselorId: String(appt.counselorId),
              counselorName: appt.counselorName,
            })}
          >
            <Text style={styles.messageCounselorText}>Message Counselor</Text>
          </Pressable>
        )}

        {/* ── Join Call Session — only for confirmed Online appointments ── */}
        {appt.sessionType === 'Online' && !isCancelled && !isCompleted && (
          <JoinVideoCallButton
            appointmentId={appointmentId}
            status={appt.status}
            sessionType={appt.sessionType}
            style={styles.callBtn}
          />
        )}

        {/* ── View Location — only for upcoming In Person appointments ── */}
        {isUpcoming && appt.sessionType === 'In Person' && !isCancelled && (
          <Pressable
            style={({ pressed }) => [
              styles.locationBtn,
              !counselorLocation && styles.locationBtnDisabled,
              pressed && counselorLocation && { opacity: 0.85 },
            ]}
            onPress={handleViewLocation}
          >
            <Text style={styles.locationBtnIcon}>📍</Text>
            <Text style={[styles.locationBtnText, !counselorLocation && styles.locationBtnTextDisabled]}>
              {counselorLocation ? `View Location: ${counselorLocation}` : 'Location Not Available'}
            </Text>
          </Pressable>
        )}

        {/* ── Details ── */}
        <Text style={styles.sectionTitle}>Appointment Details</Text>
        <View style={styles.detailCard}>

          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}><CalendarIcon /></View>
            <View>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{appt.date}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}><ClockIcon /></View>
            <View>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{appt.time}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}><MonitorIcon /></View>
            <View>
              <Text style={styles.detailLabel}>Session Type</Text>
              <Text style={styles.detailValue}>{appt.sessionType}</Text>
            </View>
          </View>

          {!!appt.notes && (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <View style={styles.detailIconBox}><NoteIcon /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>{appt.notes}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Actions ── */}
        {isUpcoming && (
          <>
            <Pressable
              style={({ pressed }) => [styles.rescheduleBtn, pressed && { opacity: 0.85 }]}
              onPress={handleReschedule}
            >
              <RefreshIcon />
              <Text style={styles.rescheduleBtnText}>Reschedule Appointment</Text>
            </Pressable>

            <Pressable
              style={[styles.cancelBtn, cancelling && { opacity: 0.7 }]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling
                ? <ActivityIndicator color="#C94C4C" />
                : (
                  <>
                    <XIcon />
                    <Text style={styles.cancelBtnText}>Cancel Appointment</Text>
                  </>
                )
              }
            </Pressable>
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.backSessionsBtn, pressed && { opacity: 0.8 }]}
          onPress={() => navigation.getParent()?.navigate('Sessions')}
        >
          <Text style={styles.backSessionsBtnText}>Back to My Appointments</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: CREAM },
  container:   { paddingHorizontal: 20, paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:      { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F0E4DE' },
  backArrow:   { fontSize: 28, color: MUTED, fontWeight: '400', marginTop: -2 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: DARK },
  headerSpacer:{ width: 40 },

  statusBanner:    { borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  bannerUpcoming:  { backgroundColor: '#EAF7EC' },
  bannerConfirmed: { backgroundColor: '#EAF7EC' },
  bannerCancelled: { backgroundColor: '#FBE1DE' },
  bannerCompleted: { backgroundColor: '#EAF7EC' },
  statusIconWrap:  { width: 40, height: 40, borderRadius: 20, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  statusTitle:     { fontSize: 14, fontWeight: '700', color: DARK, marginBottom: 3 },
  statusSub:       { fontSize: 11, color: MUTED },

  sectionTitle:    { fontSize: 15, fontWeight: '700', color: DARK, marginTop: 22, marginBottom: 10 },

  card:            { backgroundColor: WHITE, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F0E2DC' },
  avatarCircle:    { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF1EC', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  counselorName:   { fontSize: 15, fontWeight: '700', color: DARK, marginBottom: 3 },
  counselorSpec:   { fontSize: 12, color: CORAL },
  messageCounselorBtn: { height: 46, backgroundColor: '#FFF1EC', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderWidth: 1, borderColor: '#F4CFC5' },
  messageCounselorText: { fontSize: 13, fontWeight: '700', color: '#C85F4E' },

  callBtn: {
    height: 52,
    backgroundColor: '#EF806B',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    shadowColor: '#EF806B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  callBtnIcon: { fontSize: 20 },
  callBtnText: { fontSize: 15, fontWeight: '700', color: WHITE },

  locationBtn: {
    height: 52,
    backgroundColor: '#EAF3FF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#B8D4F0',
  },
  locationBtnDisabled: {
    backgroundColor: '#F0EBE6',
    borderColor: '#E3D8D2',
  },
  locationBtnIcon: { fontSize: 18 },
  locationBtnText: { fontSize: 13, fontWeight: '700', color: '#2D6FA8', flexShrink: 1 },
  locationBtnTextDisabled: { color: '#9A8982' },

  detailCard:      { backgroundColor: WHITE, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#F0E2DC' },
  detailRow:       { flexDirection: 'row', alignItems: 'center' },
  detailIconBox:   { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF1EC', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  detailLabel:     { fontSize: 10.5, color: MUTED, marginBottom: 2 },
  detailValue:     { fontSize: 13.5, fontWeight: '700', color: DARK },
  divider:         { height: 1, backgroundColor: '#F1E8E3', marginVertical: 14 },

  rescheduleBtn:   { height: 52, backgroundColor: CORAL, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, shadowColor: CORAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 3 },
  rescheduleBtnText: { fontSize: 14, fontWeight: '700', color: WHITE },

  cancelBtn:       { height: 52, backgroundColor: '#FFF0F0', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, borderWidth: 1, borderColor: '#F5C5C5' },
  cancelBtnText:   { fontSize: 14, fontWeight: '700', color: '#C94C4C' },

  backSessionsBtn: { height: 50, backgroundColor: WHITE, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderWidth: 1, borderColor: '#E9DDD7' },
  backSessionsBtnText: { fontSize: 13.5, fontWeight: '600', color: MUTED },
});
