import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import ImagePlaceholder from '../../components/common/ImagePlaceholder';
import { counselorService } from '../../services/counselorService';

const FILTERS = ['Today', 'Upcoming', 'Past'];

const parseAppointmentDate = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (/^today$/i.test(text)) return new Date();
  if (/^yesterday$/i.test(text) || /^past$/i.test(text)) return new Date(Date.now() - 86400000);
  const hasYear = /\d{4}/.test(text);
  const parsed = new Date(hasYear ? text : `${text}, ${new Date().getFullYear()}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const AppointmentsScreen = ({ navigation }) => {
  const [activeFilter, setActiveFilter] = useState('Upcoming');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const fade = useRef(new Animated.Value(0)).current;

  const loadAppointments = useCallback(async () => {
    try {
      setLoadError('');
      const data = await counselorService.getAppointments();
      setAppointments(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not load appointments. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadAppointments();
    return undefined;
  }, [loadAppointments]));

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fade]);

  const updateStatus = async (appointment, nextStatus) => {
    const id = appointment.id || appointment._id;
    setUpdatingId(id);
    try {
      const updated = await counselorService.updateAppointmentStatus(id, nextStatus);
      setAppointments((current) => current.map((item) =>
        (item.id || item._id) === id ? { ...item, ...updated } : item
      ));
    } catch (error) {
      const message = error.response?.data?.message || `Could not ${nextStatus.toLowerCase()} this appointment.`;
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Appointment not updated', message);
    } finally {
      setUpdatingId('');
    }
  };

  const openChat = (item) => navigation.getParent()?.navigate('Messages', {
    screen: 'StudentChat',
    params: { studentId: item.studentId, studentName: item.studentName },
  });

  // Navigate to real video session (registered in AppointmentsStack)
  const handleStartVideo = (item) => {
    navigation.navigate('VideoSession', {
      appointmentId: item.id || item._id || '',
      studentId:     item.studentId    || '',
      studentName:   item.studentName  || 'Student',
      date:          item.date         || '',
      time:          item.time         || '',
    });
  };

  // Open counselor's own office location in Google Maps so student can find them
  const handleViewLocation = (item) => {
    const loc = item.location || '';
    if (!loc || loc === 'Online Session') {
      Alert.alert('No location set', 'No physical location has been recorded for this appointment.');
      return;
    }
    const url = `https://maps.google.com/?q=${encodeURIComponent(loc)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open maps', 'Your device could not open the maps application.')
    );
  };

  const today = startOfDay(new Date());
  const isPast = (appointment) => {
    if (['Completed', 'Cancelled'].includes(appointment.status)) return true;
    const date = parseAppointmentDate(appointment.date);
    return date ? startOfDay(date) < today : false;
  };

  const filteredAppointments = appointments.filter((appointment) => {
    const date = parseAppointmentDate(appointment.date);
    if (activeFilter === 'Today') {
      return !['Cancelled', 'Completed'].includes(appointment.status) && date && startOfDay(date) === today;
    }
    if (activeFilter === 'Upcoming') return !isPast(appointment);
    return isPast(appointment);
  });

  const renderItem = ({ item }) => {
    const id = item.id || item._id;
    const tone = item.status === 'Pending'
      ? { bg: '#FFF1D6', text: '#9A5B00', accent: '#F4A62A' }
      : item.status === 'Confirmed'
        ? { bg: '#DDF5EC', text: '#177957', accent: '#2BA77A' }
        : item.status === 'Completed'
          ? { bg: '#E9E7FF', text: '#5953AD', accent: '#7971D7' }
          : { bg: '#EEF0F5', text: '#687386', accent: '#94A0B2' };

    return (
      <View style={[styles.card, item.status === 'Pending' && styles.pendingCard]}>
        <View style={[styles.cardAccent, { backgroundColor: tone.accent }]} />
        <View style={styles.cardContent}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => navigation.navigate('Students', {
              screen: 'StudentSession',
              params: { studentId: item.studentId, appointment: item },
            })}
            style={styles.cardHeader}
            accessibilityLabel={`Open student record for ${item.studentName || 'student'}`}
          >
            <View style={styles.studentInfo}>
              <ImagePlaceholder initials={item.avatarInitials || item.studentName?.slice(0, 2) || 'ST'} size={46} />
              <View style={styles.nameBlock}>
                <Text style={styles.studentName}>{item.studentName || 'Student'}</Text>
                <Text style={styles.courseText}>{item.studentCourse || item.sessionType || 'Booked session'}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
              <Text style={[styles.statusText, { color: tone.text }]}>{item.status || 'Pending'}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.detailsRow}>
            <View style={styles.detailLine}><Feather name="calendar" size={13} color="#668095" /><Text style={styles.detailText}>{item.date || 'Date not set'} · {item.time || 'Time not set'}</Text></View>
            {!!item.location && <View style={styles.detailLine}><Feather name="map-pin" size={13} color="#668095" /><Text style={styles.detailText}>{item.location}</Text></View>}
            {!!item.notes && <Text style={styles.bookingNote} numberOfLines={2}>Student note: {item.notes}</Text>}
          </View>

          {item.status === 'Pending' && (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => updateStatus(item, 'Confirmed')} disabled={!!updatingId} accessibilityLabel="Accept booking request">
                {updatingId === id ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="check" size={14} color="#fff" /><Text style={styles.acceptBtnText}>Accept request</Text></>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => updateStatus(item, 'Cancelled')} disabled={!!updatingId} accessibilityLabel="Decline booking request">
                <Feather name="x" size={14} color="#A3444B" /><Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
          {item.status === 'Confirmed' && (
            <>
              {/* ── Video session (Online) or location link (In Person) ── */}
              {item.sessionType === 'Online' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.videoSessionBtn, { marginTop: 8 }]}
                  onPress={() => handleStartVideo(item)}
                  accessibilityLabel="Start video session"
                >
                  <Ionicons name="videocam-outline" size={15} color="#fff" />
                  <Text style={styles.videoSessionBtnText}>Start Video Session</Text>
                </TouchableOpacity>
              )}
              {item.sessionType === 'In Person' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.locationBtn, { marginTop: 8 }]}
                  onPress={() => handleViewLocation(item)}
                  accessibilityLabel="View meeting location"
                >
                  <Feather name="map-pin" size={14} color="#5A3E8A" />
                  <Text style={styles.locationBtnText}>
                    {item.location && item.location !== 'Online Session' ? `📍 ${item.location}` : '📍 View Location'}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.messageBtn]} onPress={() => openChat(item)} accessibilityLabel={`Message ${item.studentName}`}>
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color="#3973B9" /><Text style={styles.messageBtnText}>Message student</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.completeBtn]} onPress={() => updateStatus(item, 'Completed')} disabled={!!updatingId} accessibilityLabel="Mark session complete">
                  {updatingId === id ? <ActivityIndicator size="small" color="#177957" /> : <><Feather name="check-circle" size={14} color="#177957" /><Text style={styles.completeBtnText}>Complete</Text></>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FB" />
      <Animated.View style={[styles.container, { opacity: fade }]}>
        <View style={styles.headingRow}>
          <View style={styles.headingIcon}><Feather name="calendar" size={19} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Appointments</Text>
            <Text style={styles.headerSub}>Review requests and keep your sessions up to date.</Text>
          </View>
        </View>

        <View style={styles.tabsContainer}>
          {FILTERS.map((filter) => {
            const selected = activeFilter === filter;
            const count = appointments.filter((item) => {
              const date = parseAppointmentDate(item.date);
              if (filter === 'Today') return date && startOfDay(date) === today && !['Cancelled', 'Completed'].includes(item.status);
              if (filter === 'Upcoming') return !isPast(item);
              return isPast(item);
            }).length;
            return (
              <TouchableOpacity key={filter} style={[styles.tabBtn, selected && styles.tabBtnActive]} onPress={() => setActiveFilter(filter)} accessibilityRole="button" accessibilityState={{ selected }}>
                <Text style={[styles.tabText, selected && styles.tabTextActive]}>{filter}</Text>
                <Text style={[styles.tabCount, selected && styles.tabCountActive]}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => item.id || item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadAppointments}
          ListEmptyComponent={(
            <View style={styles.emptyCard}>
              {loading ? <ActivityIndicator color="#3973B9" /> : <View style={styles.emptyIcon}><Feather name={loadError ? 'cloud-off' : 'calendar'} size={24} color="#54728D" /></View>}
              <Text style={styles.emptyTitle}>{loading ? 'Loading appointments' : loadError ? 'Appointments unavailable' : `No ${activeFilter.toLowerCase()} appointments`}</Text>
              {!loading && <Text style={styles.emptyText}>{loadError || 'Student bookings appear here. Accept or decline pending requests; message confirmed students and mark sessions complete when finished.'}</Text>}
              {!!loadError && <TouchableOpacity style={styles.retryBtn} onPress={loadAppointments}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>}
            </View>
          )}
          ListFooterComponent={<View style={{ height: 30 }} />}
        />
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FB' },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 15 },
  headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headingIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#3973B9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 25, fontWeight: '800', color: '#203247' },
  headerSub: { color: '#748295', fontSize: 12, lineHeight: 17, marginTop: 2 },
  tabsContainer: { flexDirection: 'row', backgroundColor: '#E9EEF5', borderRadius: 14, padding: 4, marginBottom: 13 },
  tabBtn: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#253B50', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontSize: 12, fontWeight: '700', color: '#758397' },
  tabTextActive: { color: '#29475F' },
  tabCount: { color: '#8A96A5', fontSize: 10, fontWeight: '800' },
  tabCountActive: { color: '#3973B9' },
  listContent: { flexGrow: 1, paddingBottom: 10 },
  card: { flexDirection: 'row', overflow: 'hidden', backgroundColor: '#fff', borderRadius: 17, marginBottom: 11, borderWidth: 1, borderColor: '#E6EBF1', shadowColor: '#1D354C', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  pendingCard: { borderColor: '#F2D89F' },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, padding: 13 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  studentInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 6 },
  nameBlock: { flex: 1, marginLeft: 10 },
  studentName: { fontSize: 14, fontWeight: '800', color: '#26394D' },
  courseText: { fontSize: 11, color: '#788698', marginTop: 3 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14 },
  statusText: { fontSize: 10, fontWeight: '800' },
  detailsRow: { paddingTop: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: '#EFF2F5' },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  detailText: { fontSize: 11, color: '#687B8F' },
  bookingNote: { fontSize: 11, lineHeight: 16, color: '#687B8F', marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 11 },
  actionBtn: { flex: 1, minHeight: 36, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  acceptBtn: { backgroundColor: '#25836C' },
  acceptBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  declineBtn: { backgroundColor: '#FFF0EF', borderWidth: 1, borderColor: '#F5D0CC' },
  declineBtnText: { color: '#A3444B', fontSize: 11, fontWeight: '800' },
  messageBtn: { backgroundColor: '#EAF2FC' },
  messageBtnText: { color: '#3973B9', fontSize: 11, fontWeight: '800' },
  completeBtn: { backgroundColor: '#DDF5EC' },
  completeBtnText: { color: '#177957', fontSize: 11, fontWeight: '800' },
  videoSessionBtn: { backgroundColor: '#3973B9', marginBottom: 0 },
  videoSessionBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  locationBtn: { backgroundColor: '#F0EBFF', borderWidth: 1, borderColor: '#D4C5F5' },
  locationBtnText: { color: '#5A3E8A', fontSize: 11, fontWeight: '800', flexShrink: 1 },
  emptyCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E6EBF1', padding: 24, marginTop: 8 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EAF2FC', alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  emptyTitle: { color: '#26394D', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#788698', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  retryBtn: { backgroundColor: '#3973B9', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 10, marginTop: 12 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

export default AppointmentsScreen;
