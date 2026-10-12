import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import ImagePlaceholder from '../../components/common/ImagePlaceholder';
import JoinVideoCallButton from '../../components/common/JoinVideoCallButton';
import CounselorBackButton from '../../components/navigation/CounselorBackButton';
import { counselorService } from '../../services/counselorService';
import { notificationService } from '../../services/notificationService';

const FILTERS = ['Today', 'Upcoming', 'Pending', 'Past', 'Cancelled'];
const STATUS_FILTERS = ['All statuses', 'Pending', 'Confirmed', 'Completed', 'Cancelled', 'Declined'];
const MODE_FILTERS = ['All modes', 'Online', 'In Person', 'Phone'];

const parseAppointmentDate = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (/^today$/i.test(text)) return new Date();
  if (/^yesterday$/i.test(text) || /^past$/i.test(text)) return new Date(Date.now() - 86400000);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const parsedIso = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return parsedIso.getFullYear() === Number(iso[1]) && parsedIso.getMonth() === Number(iso[2]) - 1 && parsedIso.getDate() === Number(iso[3]) ? parsedIso : null;
  }
  const hasYear = /\d{4}/.test(text);
  const parsed = new Date(hasYear ? text : `${text}, ${new Date().getFullYear()}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const sameDayKey = (value, date) => {
  const parsed = parseAppointmentDate(value);
  return !!parsed && startOfDay(parsed) === startOfDay(date);
};

const AppointmentsScreen = ({ navigation }) => {
  const [activeFilter, setActiveFilter] = useState('Upcoming');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [actionModal, setActionModal] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [availability, setAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [modeFilter, setModeFilter] = useState('All modes');
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const fade = useRef(new Animated.Value(0)).current;

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
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

    const unsub = notificationService.onAppointmentChange(
      () => loadAppointments(),
      () => loadAppointments()
    );
    return () => {
      if (unsub) unsub();
    };
  }, [fade, loadAppointments]);

  const updateStatus = async (appointment, changes, successMessage) => {
    const id = appointment.id || appointment._id;
    if (updatingId) return;
    setUpdatingId(id);
    try {
      const updated = await counselorService.updateAppointmentStatus(id, changes);
      setAppointments((current) => current.map((item) => (item.id || item._id) === id ? { ...item, ...updated } : item));
      await loadAppointments();
      setActionModal(null);
      setDeclineReason('');
      setRescheduleDate('');
      setRescheduleTime('');
      const feedback = updated.notificationWarning || successMessage;
      if (feedback) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(feedback);
        else Alert.alert(updated.notificationWarning ? 'Appointment saved' : 'Appointment updated', feedback);
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Could not update this appointment.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Appointment not updated', message);
    } finally {
      setUpdatingId('');
    }
  };

  const beginReschedule = async (appointment) => {
    setActionModal({ type: 'reschedule', appointment });
    setRescheduleDate('');
    setRescheduleTime('');
    setAvailability([]);
    setAvailabilityLoading(true);
    setAvailabilityError('');
    try {
      const data = await counselorService.getAvailability();
      setAvailability(Array.isArray(data) ? data : []);
    } catch (error) {
      setAvailabilityError(error.response?.data?.message || 'Could not load your availability. Try again.');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const dateChoices = (() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const candidates = new Set();
    for (let offset = 1; offset <= 42; offset += 1) {
      const date = new Date(todayDate);
      date.setDate(date.getDate() + offset);
      candidates.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    }
    availability.forEach((item) => {
      if (item.date && parseAppointmentDate(item.date) && item.date > `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`) candidates.add(item.date);
    });
    return [...candidates].sort().flatMap((date) => {
      const parsed = parseAppointmentDate(date);
      const day = parsed?.toLocaleDateString('en-US', { weekday: 'long' });
      const override = availability.find((item) => item.date === date);
      const schedule = override || availability.find((item) => !item.date && item.day === day);
      const taken = new Set(appointments
        .filter((item) => (item.id || item._id) !== (actionModal?.appointment?.id || actionModal?.appointment?._id)
          && item.date === date && !['Declined', 'Cancelled', 'Completed'].includes(item.status))
        .map((item) => String(item.time || '').trim().toUpperCase()));
      const slots = schedule?.active
        ? (schedule.slots || []).filter((slot) => !taken.has(String(slot).trim().toUpperCase()))
        : [];
      return slots.length ? [{ date, slots, label: parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) }] : [];
    });
  })();
  const availableTimes = (() => {
    if (!parseAppointmentDate(rescheduleDate) || !/^\d{4}-\d{2}-\d{2}$/.test(rescheduleDate)) return [];
    const choice = dateChoices.find((item) => item.date === rescheduleDate);
    return choice?.slots || [];
  })();

  const openChat = (item) => navigation.getParent()?.navigate('Messages', {
    screen: 'StudentChat',
    params: { studentId: item.studentId, studentName: item.studentName },
  });

  const handleAppointmentModalBack = () => {
    if (updatingId || !actionModal) return;
    if (['details', 'reschedule', 'decline'].includes(actionModal.type)) {
      setActionModal({ type: 'menu', appointment: actionModal.appointment });
    } else {
      setActionModal(null);
    }
  };

  const askConfirmation = (title, message, onConfirm, destructive = false) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) onConfirm();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Keep appointment', style: 'cancel' },
      { text: title, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  };

  const runMenuAction = (action, appointment) => {
    if (action === 'details') {
      setActionModal({ type: 'details', appointment });
      return;
    }
    if (action === 'message') {
      setActionModal(null);
      openChat(appointment);
      return;
    }
    if (action === 'reschedule') {
      void beginReschedule(appointment);
      return;
    }
    setActionModal(null);
    if (action === 'accept') {
      askConfirmation('Accept appointment', `Confirm ${appointment.studentName || 'this student'}’s request for ${appointment.date} at ${appointment.time}?`, () => {
        void updateStatus(appointment, { status: 'Confirmed' }, 'Appointment accepted. The student has been notified.');
      });
    } else if (action === 'decline') {
      setDeclineReason('');
      setActionModal({ type: 'decline', appointment });
    } else if (action === 'cancel') {
      askConfirmation('Cancel appointment', `Cancel the appointment with ${appointment.studentName || 'this student'}?`, () => {
        void updateStatus(appointment, { status: 'Cancelled' }, 'Appointment cancelled. The student has been notified.');
      }, true);
    } else if (action === 'complete') {
      askConfirmation('Complete appointment', 'Mark this session as completed?', () => {
        void updateStatus(appointment, { status: 'Completed' }, 'Appointment marked complete.');
      });
    }
  };

  const startVideoSession = (item) => {
    if (!item.studentId) {
      const message = 'This appointment is not linked to a student account, so a call invite cannot be sent.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Cannot start video session', message);
      return;
    }
    navigation.navigate('VideoSession', {
      appointmentId: item.id || item._id,
      studentId: item.studentId,
      studentName: item.studentName || 'Student',
      date: item.date || '',
      time: item.time || '',
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
    if (['Cancelled', 'Declined'].includes(appointment.status)) return false;
    if (appointment.status === 'Completed') return true;
    const date = parseAppointmentDate(appointment.date);
    return date ? startOfDay(date) < today : false;
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredAppointments = appointments.filter((appointment) => {
    const date = parseAppointmentDate(appointment.date);
    if (activeFilter === 'Today') {
      if (['Cancelled', 'Declined', 'Completed'].includes(appointment.status) || !date || startOfDay(date) !== today) return false;
    }
    if (activeFilter === 'Pending' && appointment.status !== 'Pending') return false;
    if (activeFilter === 'Upcoming' && (isPast(appointment) || ['Cancelled', 'Declined'].includes(appointment.status))) return false;
    if (activeFilter === 'Past' && !isPast(appointment)) return false;
    if (activeFilter === 'Cancelled' && !['Cancelled', 'Declined'].includes(appointment.status)) return false;
    if (selectedDate && !sameDayKey(appointment.date, selectedDate)) return false;
    if (statusFilter !== 'All statuses' && appointment.status !== statusFilter) return false;
    if (modeFilter !== 'All modes' && String(appointment.sessionType || '').toLowerCase() !== modeFilter.toLowerCase()) return false;
    if (normalizedSearch) {
      const searchable = [appointment.studentName, appointment.studentRegistrationId, appointment.studentId, appointment.notes, appointment.reason]
        .filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(normalizedSearch)) return false;
    }
    return true;
  });

  const calendarOffset = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const calendarDays = Array.from({ length: 42 }, (_, index) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index - calendarOffset + 1));
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All statuses');
    setModeFilter('All modes');
    setSelectedDate(null);
    setActiveFilter('Upcoming');
  };

  const renderItem = ({ item }) => {
    const cardId = item.id || item._id;
    const tone = item.status === 'Pending'
      ? { bg: '#FFF1D6', text: '#9A5B00', accent: '#F4A62A' }
      : item.status === 'Confirmed'
        ? { bg: '#DDF5EC', text: '#177957', accent: '#2BA77A' }
        : item.status === 'Completed'
          ? { bg: '#E9E7FF', text: '#5953AD', accent: '#7971D7' }
          : item.status === 'Declined'
            ? { bg: '#FFF0EF', text: '#A3444B', accent: '#C9553F' }
            : { bg: '#EEF0F5', text: '#687386', accent: '#94A0B2' };

    return (
      <View style={[styles.card, item.status === 'Pending' && styles.pendingCard]}>
        <View style={[styles.cardAccent, { backgroundColor: tone.accent }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => navigation.navigate('Students', {
                screen: 'StudentSession',
                params: { studentId: item.studentId, appointment: item },
              })}
              style={styles.studentInfo}
              accessibilityRole="button"
              accessibilityLabel={`Open student record for ${item.studentName || 'student'}`}
            >
              <ImagePlaceholder initials={item.avatarInitials || item.studentName?.slice(0, 2) || 'ST'} size={46} />
              <View style={styles.nameBlock}>
                <Text style={styles.studentName}>{item.studentName || 'Student'}</Text>
                <Text style={styles.courseText}>{item.studentCourse || 'Student'}</Text>
                {!!item.studentRegistrationId && <Text style={styles.studentIdText}>ID {item.studentRegistrationId}</Text>}
              </View>
            </TouchableOpacity>
            <View style={styles.cardHeaderActions}>
              <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                <Text style={[styles.statusText, { color: tone.text }]}>{item.status || 'Pending'}</Text>
              </View>
              {updatingId === cardId
                ? <View style={styles.moreButton}><ActivityIndicator size="small" color="#3973B9" /></View>
                : <TouchableOpacity style={styles.moreButton} onPress={() => setActionModal({ type: 'menu', appointment: item })} accessibilityRole="button" accessibilityLabel={`Appointment actions for ${item.studentName || 'student'}`}>
                  <Feather name="more-vertical" size={19} color="#62768B" />
                </TouchableOpacity>}
            </View>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailLine}><Feather name="calendar" size={13} color="#668095" /><Text style={styles.detailText}>{item.date || 'Date not set'} · {item.time || 'Time not set'}</Text></View>
            <View style={styles.detailLine}><Feather name="clock" size={13} color="#668095" /><Text style={styles.detailText}>{item.duration || 30} min · {item.sessionType || 'Mode not set'}</Text></View>
            <View style={styles.detailLine}><Feather name="map-pin" size={13} color="#668095" /><Text style={styles.detailText}>{item.location && item.location !== 'Online Session' ? item.location : item.sessionType === 'Online' ? 'Online session' : 'Location not specified'}</Text></View>
            {!!item.notes && <Text style={styles.bookingNote} numberOfLines={2}>Reason / notes: {item.notes}</Text>}
          </View>

          {item.status === 'Confirmed' && (
            <>
              {/* ── Video session (Online) or location link (In Person) ── */}
              {item.sessionType === 'Online' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.videoSessionBtn, { marginTop: 8 }, !item.studentId && styles.disabledVideoBtn]}
                    onPress={() => startVideoSession(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Start a video session with ${item.studentName || 'student'}`}
                  >
                    <Feather name="video" size={15} color="#fff" />
                    <Text style={styles.videoSessionBtnText}>Start video session · Call student</Text>
                  </TouchableOpacity>
                  <JoinVideoCallButton
                    appointmentId={item.id || item._id}
                    status={item.status}
                    sessionType={item.sessionType}
                    style={[styles.actionBtn, styles.scheduledJoinBtn, { marginTop: 7 }]}
                    textStyle={styles.scheduledJoinText}
                  />
                </>
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
            </>
          )}

          {item.status === 'Pending' && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn]}
                onPress={() => runMenuAction('decline', item)}
                activeOpacity={0.82}
                disabled={!!updatingId}
                accessibilityRole="button"
                accessibilityLabel={`Decline the request from ${item.studentName || 'this student'}`}
              >
                <Feather name="x" size={15} color="#A3444B" />
                <Text style={styles.declineBtnText}>Decline request</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => runMenuAction('accept', item)}
                activeOpacity={0.82}
                disabled={!!updatingId}
                accessibilityRole="button"
                accessibilityLabel={`Accept the request from ${item.studentName || 'this student'}`}
              >
                {updatingId === cardId
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <>
                      <Feather name="check" size={15} color="#fff" />
                      <Text style={styles.acceptBtnText}>Accept request</Text>
                    </>
                  )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FB" />
      <Animated.View style={[styles.container, { opacity: fade }]}>
        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => item.id || item._id}
          renderItem={renderItem}
          ListHeaderComponent={(
            <View>
        <CounselorBackButton navigation={navigation} style={styles.backButton} />
        <View style={styles.headingRow}>
          <View style={styles.headingIcon}><Feather name="calendar" size={19} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Appointments</Text>
            <Text style={styles.headerSub}>Review requests and keep your sessions up to date.</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContainer}>
          {FILTERS.map((filter) => {
            const selected = activeFilter === filter;
            const count = appointments.filter((item) => {
              const date = parseAppointmentDate(item.date);
              if (filter === 'Pending') return item.status === 'Pending';
              if (filter === 'Cancelled') return ['Cancelled', 'Declined'].includes(item.status);
              if (filter === 'Today') return date && startOfDay(date) === today && !['Cancelled', 'Declined', 'Completed'].includes(item.status);
              if (filter === 'Upcoming') return !isPast(item) && !['Cancelled', 'Declined'].includes(item.status);
              return item.status === 'Completed' || (!!date && startOfDay(date) < today && !['Cancelled', 'Declined'].includes(item.status));
            }).length;
            return (
              <TouchableOpacity key={filter} style={[styles.tabBtn, selected && styles.tabBtnActive]} onPress={() => { setActiveFilter(filter); setSelectedDate(null); }} accessibilityRole="button" accessibilityState={{ selected }}>
                <Text style={[styles.tabText, selected && styles.tabTextActive]}>{filter}</Text>
                <Text style={[styles.tabCount, selected && styles.tabCountActive]}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <View>
              <Text style={styles.calendarTitle}>{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
              <Text style={styles.calendarSubtitle}>Select a day to filter appointments</Text>
            </View>
            <View style={styles.calendarControls}>
              <TouchableOpacity style={styles.todayButton} onPress={() => { const now = new Date(); setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(now); setActiveFilter('Today'); }} accessibilityRole="button"><Text style={styles.todayButtonText}>Today</Text></TouchableOpacity>
              <TouchableOpacity style={styles.monthButton} onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} accessibilityLabel="Previous month"><Feather name="chevron-left" size={18} color="#51677D" /></TouchableOpacity>
              <TouchableOpacity style={styles.monthButton} onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} accessibilityLabel="Next month"><Feather name="chevron-right" size={18} color="#51677D" /></TouchableOpacity>
            </View>
          </View>
          <View style={styles.calendarGrid}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekdayLabel}>{day}</Text>)}
            {calendarDays.map((date) => {
              const inMonth = date.getMonth() === calendarMonth.getMonth();
              const isSelected = selectedDate && startOfDay(selectedDate) === startOfDay(date);
              const hasBooking = appointments.some((appointment) => sameDayKey(appointment.date, date));
              return <TouchableOpacity key={dateKey(date)} style={[styles.dayCell, !inMonth && styles.outsideDay, hasBooking && styles.dayWithBooking, isSelected && styles.selectedDay]} onPress={() => { setSelectedDate(date); setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setActiveFilter(startOfDay(date) === today ? 'Today' : startOfDay(date) < today ? 'Past' : 'Upcoming'); }} accessibilityLabel={`${date.toDateString()}${hasBooking ? ', appointments' : ''}`}><Text style={[styles.dayText, !inMonth && styles.outsideDayText, isSelected && styles.selectedDayText]}>{date.getDate()}</Text></TouchableOpacity>;
            })}
          </View>
        </View>

        <View style={styles.filtersCard}>
          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color="#8793A3" />
            <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search student, ID, or reason" placeholderTextColor="#97A1AF" style={styles.searchInput} accessibilityLabel="Search appointments" />
            {!!searchQuery && <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search"><Feather name="x-circle" size={16} color="#8793A3" /></TouchableOpacity>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRows}>
            {STATUS_FILTERS.map((filter) => <TouchableOpacity key={filter} style={[styles.filterChip, statusFilter === filter && styles.filterChipSelected]} onPress={() => setStatusFilter(filter)}><Text style={[styles.filterChipText, statusFilter === filter && styles.filterChipTextSelected]}>{filter}</Text></TouchableOpacity>)}
            <View style={styles.filterDivider} />
            {MODE_FILTERS.map((filter) => <TouchableOpacity key={filter} style={[styles.filterChip, modeFilter === filter && styles.filterChipSelected]} onPress={() => setModeFilter(filter)}><Text style={[styles.filterChipText, modeFilter === filter && styles.filterChipTextSelected]}>{filter}</Text></TouchableOpacity>)}
          </ScrollView>
          <View style={styles.filterFooter}>
            <Text style={styles.resultLabel}>{filteredAppointments.length} appointments</Text>
            <TouchableOpacity onPress={clearFilters} accessibilityRole="button"><Text style={styles.clearFiltersText}>Clear filters</Text></TouchableOpacity>
          </View>
        </View>
            </View>
          )}
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
        <Modal visible={!!actionModal} transparent animationType="slide" onRequestClose={() => !updatingId && setActionModal(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeadingRow}>
                <CounselorBackButton navigation={navigation} onPress={handleAppointmentModalBack} style={styles.modalBackButton} />
                <Text style={styles.modalTitle}>{actionModal?.type === 'decline' ? 'Decline appointment' : actionModal?.type === 'reschedule' ? 'Reschedule appointment' : actionModal?.type === 'details' ? 'Appointment details' : 'Appointment actions'}</Text>
                <TouchableOpacity onPress={() => !updatingId && setActionModal(null)} accessibilityLabel="Close dialog"><Feather name="x" size={20} color="#687B8F" /></TouchableOpacity>
              </View>
              {actionModal?.type === 'menu' && (
                <ScrollView style={styles.menuScroll}>
                  {[
                    ['details', 'View details', 'file-text'],
                    ...(actionModal.appointment.status === 'Pending' ? [['accept', 'Accept request', 'check'], ['decline', 'Decline request', 'x']] : []),
                    ...(['Pending', 'Confirmed'].includes(actionModal.appointment.status) ? [['reschedule', 'Reschedule', 'calendar']] : []),
                    ...(actionModal.appointment.status === 'Confirmed' && actionModal.appointment.sessionType === 'Online' ? [['call', 'Start video call', 'video']] : []),
                    ...(actionModal.appointment.status === 'Confirmed' ? [['complete', 'Mark complete', 'check-circle']] : []),
                    ...(['Pending', 'Confirmed'].includes(actionModal.appointment.status) ? [['cancel', 'Cancel appointment', 'slash']] : []),
                    ['message', 'Message student', 'message-circle'],
                  ].map(([action, label, icon]) => (
                    <TouchableOpacity key={action} style={styles.menuAction} onPress={() => action === 'call' ? (setActionModal(null), startVideoSession(actionModal.appointment)) : runMenuAction(action, actionModal.appointment)} disabled={!!updatingId}>
                      <Feather name={icon} size={16} color={action === 'decline' || action === 'cancel' ? '#A3444B' : '#3973B9'} />
                      <Text style={[styles.menuActionText, (action === 'decline' || action === 'cancel') && styles.menuDangerText]}>{label}</Text>
                      <Feather name="chevron-right" size={16} color="#98A5B3" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {actionModal?.type === 'details' && (
                <ScrollView style={styles.detailsModalBody}>
                  <Text style={styles.detailsStudentName}>{actionModal.appointment.studentName || 'Student'}</Text>
                  {!!actionModal.appointment.studentRegistrationId && <Text style={styles.modalHint}>Student ID: {actionModal.appointment.studentRegistrationId}</Text>}
                  {!!actionModal.appointment.studentEmail && <Text style={styles.modalHint}>{actionModal.appointment.studentEmail}</Text>}
                  <View style={styles.detailModalDivider} />
                  {[
                    ['calendar', 'Date', actionModal.appointment.date || 'Not set'],
                    ['clock', 'Time and duration', `${actionModal.appointment.time || 'Not set'} · ${actionModal.appointment.duration || 30} minutes`],
                    ['video', 'Mode', actionModal.appointment.sessionType || 'Not set'],
                    ['check-circle', 'Status', actionModal.appointment.status || 'Pending'],
                    ['map-pin', 'Location', actionModal.appointment.location || (actionModal.appointment.sessionType === 'Online' ? 'Online session' : 'Not set')],
                  ].map(([icon, label, value]) => <View key={label} style={styles.detailsModalRow}><Feather name={icon} size={15} color="#668095" /><View style={styles.detailsModalCopy}><Text style={styles.detailsModalLabel}>{label}</Text><Text style={styles.detailsModalValue}>{value}</Text></View></View>)}
                  <Text style={styles.detailsModalLabel}>Reason / notes</Text>
                  <Text style={styles.detailsModalValue}>{actionModal.appointment.notes || actionModal.appointment.reason || 'No notes provided.'}</Text>
                  <TouchableOpacity style={styles.modalSave} onPress={() => runMenuAction('message', actionModal.appointment)}><Text style={styles.modalSaveText}>Message student</Text></TouchableOpacity>
                </ScrollView>
              )}
              {actionModal?.type === 'decline' && (
                <>
                  <Text style={styles.modalHint}>Confirm that you want to decline {actionModal.appointment.studentName || 'this student'}’s request. You may include a reason.</Text>
                  <TextInput value={declineReason} onChangeText={setDeclineReason} placeholder="Optional reason" multiline maxLength={500} style={[styles.modalInput, styles.reasonInput]} />
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalCancel} onPress={() => setActionModal(null)} disabled={!!updatingId}><Text style={styles.modalCancelText}>Keep request</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.modalDecline} onPress={() => updateStatus(actionModal.appointment, { status: 'Declined', reason: declineReason }, 'Appointment declined. The student has been notified.')} disabled={!!updatingId}>
                      {updatingId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalDeclineText}>Confirm decline</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {actionModal?.type === 'reschedule' && (
                <>
                  <Text style={styles.modalHint}>Enter a date and choose one of your available, unbooked time slots.</Text>
                  {!!availabilityError && <Text style={styles.modalError}>{availabilityError}</Text>}
                  {availabilityLoading && <View style={styles.availabilityLoading}><ActivityIndicator size="small" color="#3973B9" /><Text style={styles.availabilityLoadingText}>Loading available dates…</Text></View>}
                  <Text style={styles.modalLabel}>Choose a date</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChoices}>
                    {dateChoices.map((choice) => <TouchableOpacity key={choice.date} style={[styles.timeChoice, rescheduleDate === choice.date && styles.timeChoiceSelected]} onPress={() => { setRescheduleDate(choice.date); setRescheduleTime(''); }}><Text style={[styles.timeChoiceText, rescheduleDate === choice.date && styles.timeChoiceTextSelected]}>{choice.label}</Text></TouchableOpacity>)}
                  </ScrollView>
                  {!availabilityError && availability.length > 0 && dateChoices.length === 0 && <Text style={styles.modalHint}>No available dates in the next six weeks. Update your availability to offer another time.</Text>}
                  <Text style={styles.modalLabel}>Available time</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChoices}>
                    {availableTimes.map((slot) => <TouchableOpacity key={slot} style={[styles.timeChoice, rescheduleTime === slot && styles.timeChoiceSelected]} onPress={() => setRescheduleTime(slot)}><Text style={[styles.timeChoiceText, rescheduleTime === slot && styles.timeChoiceTextSelected]}>{slot}</Text></TouchableOpacity>)}
                  </ScrollView>
                  {!!rescheduleDate && availableTimes.length === 0 && <Text style={styles.modalHint}>No available times for this date. Choose another date or update your availability.</Text>}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalCancel} onPress={() => setActionModal(null)} disabled={!!updatingId}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.modalSave, (!rescheduleDate || !rescheduleTime || !!updatingId) && styles.modalSaveDisabled]} onPress={() => updateStatus(actionModal.appointment, { date: rescheduleDate, time: rescheduleTime }, 'Appointment rescheduled. The student has been notified.')} disabled={!rescheduleDate || !rescheduleTime || !!updatingId}>
                      {updatingId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSaveText}>Save new time</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FB' },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 15 },
  backButton: { marginLeft: -6, marginBottom: 2 },
  headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headingIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#3973B9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 25, fontWeight: '800', color: '#203247' },
  headerSub: { color: '#748295', fontSize: 12, lineHeight: 17, marginTop: 2 },
  tabsScroll: { flexGrow: 0, marginBottom: 10 },
  tabsContainer: { flexDirection: 'row', backgroundColor: '#E9EEF5', borderRadius: 14, padding: 4, gap: 3 },
  tabBtn: { minWidth: 76, minHeight: 38, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#253B50', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontSize: 12, fontWeight: '700', color: '#758397' },
  tabTextActive: { color: '#29475F' },
  tabCount: { color: '#8A96A5', fontSize: 10, fontWeight: '800' },
  tabCountActive: { color: '#3973B9' },
  calendarCard: { backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#E6EBF1', padding: 13, marginBottom: 10 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calendarTitle: { color: '#26394D', fontWeight: '800', fontSize: 15 },
  calendarSubtitle: { color: '#8793A3', fontSize: 10, marginTop: 3 },
  calendarControls: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  todayButton: { backgroundColor: '#EAF2FC', paddingHorizontal: 10, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  todayButtonText: { color: '#3973B9', fontSize: 10, fontWeight: '800' },
  monthButton: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#F4F6F9', alignItems: 'center', justifyContent: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekdayLabel: { width: '14.2857%', textAlign: 'center', color: '#8A96A5', fontSize: 10, fontWeight: '800', paddingVertical: 6 },
  dayCell: { width: '14.2857%', height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9, marginVertical: 1 },
  dayText: { color: '#52677D', fontSize: 11, fontWeight: '600' },
  outsideDay: { opacity: 0.45 },
  outsideDayText: { color: '#9AA5B2' },
  dayWithBooking: { backgroundColor: '#EAF5F1' },
  selectedDay: { backgroundColor: '#3973B9' },
  selectedDayText: { color: '#fff', fontWeight: '800' },
  filtersCard: { backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#E6EBF1', padding: 10, marginBottom: 10 },
  searchWrap: { minHeight: 41, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F9FC', borderRadius: 11, borderWidth: 1, borderColor: '#E6EBF1', paddingHorizontal: 11, marginBottom: 8 },
  searchInput: { flex: 1, color: '#203247', fontSize: 12, paddingVertical: 8, marginLeft: 8, outlineStyle: 'none' },
  filterRows: { alignItems: 'center', gap: 6, paddingVertical: 2 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F0F3F7' },
  filterChipSelected: { backgroundColor: '#284A62' },
  filterChipText: { color: '#6E7D8E', fontSize: 10, fontWeight: '700' },
  filterChipTextSelected: { color: '#fff' },
  filterDivider: { width: 1, height: 22, backgroundColor: '#DCE3EA', marginHorizontal: 3 },
  filterFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 7 },
  resultLabel: { color: '#8A96A5', fontSize: 10, fontWeight: '600' },
  clearFiltersText: { color: '#3973B9', fontSize: 10, fontWeight: '800' },
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
  studentIdText: { fontSize: 10, color: '#8895A3', marginTop: 2 },
  cardHeaderActions: { alignItems: 'flex-end', gap: 3 },
  moreButton: { width: 30, height: 27, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
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
  rescheduleBtn: { backgroundColor: '#EAF2FC' },
  rescheduleBtnText: { color: '#3973B9', fontSize: 11, fontWeight: '800' },
  messageBtn: { backgroundColor: '#EAF2FC' },
  messageBtnText: { color: '#3973B9', fontSize: 11, fontWeight: '800' },
  completeBtn: { backgroundColor: '#DDF5EC' },
  completeBtnText: { color: '#177957', fontSize: 11, fontWeight: '800' },
  videoSessionBtn: { backgroundColor: '#3973B9', marginBottom: 0, minHeight: 40 },
  disabledVideoBtn: { opacity: 0.55 },
  videoSessionBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  scheduledJoinBtn: { backgroundColor: '#EAF2FC', minHeight: 36 },
  scheduledJoinText: { color: '#3973B9', fontSize: 10, fontWeight: '800' },
  locationBtn: { backgroundColor: '#F0EBFF', borderWidth: 1, borderColor: '#D4C5F5' },
  locationBtnText: { color: '#5A3E8A', fontSize: 11, fontWeight: '800', flexShrink: 1 },
  emptyCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E6EBF1', padding: 24, marginTop: 8 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EAF2FC', alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  emptyTitle: { color: '#26394D', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#788698', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  retryBtn: { backgroundColor: '#3973B9', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 10, marginTop: 12 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(22, 37, 52, 0.48)' },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 19, maxHeight: '85%' },
  modalHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalBackButton: { marginLeft: -8 },
  modalTitle: { flex: 1, color: '#203247', fontSize: 18, fontWeight: '800' },
  menuScroll: { marginTop: 12, maxHeight: 420 },
  menuAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#EEF1F4', paddingHorizontal: 4 },
  menuActionText: { flex: 1, color: '#40556C', fontSize: 13, fontWeight: '700' },
  menuDangerText: { color: '#A3444B' },
  detailsModalBody: { marginTop: 12 },
  detailsStudentName: { color: '#26394D', fontSize: 16, fontWeight: '800' },
  detailModalDivider: { height: 1, backgroundColor: '#E9EDF2', marginVertical: 13 },
  detailsModalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  detailsModalCopy: { flex: 1 },
  detailsModalLabel: { color: '#8793A3', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  detailsModalValue: { color: '#40556C', fontSize: 12, lineHeight: 17 },
  modalHint: { color: '#748295', fontSize: 12, lineHeight: 18, marginTop: 10 },
  modalLabel: { color: '#40556C', fontSize: 12, fontWeight: '700', marginTop: 15, marginBottom: 7 },
  modalInput: { minHeight: 44, borderWidth: 1, borderColor: '#DDE4EC', borderRadius: 11, paddingHorizontal: 12, color: '#203247', backgroundColor: '#FBFCFD' },
  reasonInput: { minHeight: 90, paddingTop: 11, textAlignVertical: 'top', marginTop: 14 },
  modalError: { color: '#A3444B', fontSize: 12, marginTop: 10 },
  availabilityLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  availabilityLoadingText: { color: '#748295', fontSize: 11 },
  timeChoices: { gap: 8, paddingVertical: 3 },
  timeChoice: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#DDE4EC', backgroundColor: '#F7F9FC' },
  timeChoiceSelected: { borderColor: '#3973B9', backgroundColor: '#EAF2FC' },
  timeChoiceText: { color: '#607286', fontSize: 11, fontWeight: '700' },
  timeChoiceTextSelected: { color: '#3973B9' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 19 },
  modalCancel: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#EEF2F6' },
  modalCancelText: { color: '#52657A', fontSize: 12, fontWeight: '800' },
  modalDecline: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#B84C54' },
  modalDeclineText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  modalSave: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#3973B9' },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

export default AppointmentsScreen;
