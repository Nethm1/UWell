import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import CounselorBackButton from '../../components/navigation/CounselorBackButton';
import { useFocusEffect } from '@react-navigation/native';
import { counselorService } from '../../services/counselorService';
import { appointmentDateTime } from '../../utils/counselorAppointments';

const FILTERS = ['Upcoming', 'History', 'Updates'];

export default function CounselorNotificationsScreen({ navigation }) {
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('Upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await counselorService.getAppointments();
      setAppointments(Array.isArray(data) ? data : data?.appointments || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load your appointment activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const items = useMemo(() => {
    const now = new Date();
    const statusOf = (item) => String(item.status || '').toLowerCase();
    if (filter === 'Upcoming') return appointments
      .filter((item) => {
        const status = statusOf(item);
        if (!['pending', 'confirmed'].includes(status)) return false;
        const date = appointmentDateTime(item, now);
        return !date || date >= now;
      })
      .sort((a, b) => (appointmentDateTime(a, now)?.getTime() || Infinity) - (appointmentDateTime(b, now)?.getTime() || Infinity));
    if (filter === 'History') return appointments
      .filter((item) => ['completed', 'cancelled'].includes(statusOf(item)) || (appointmentDateTime(item, now) && appointmentDateTime(item, now) < now))
      .sort((a, b) => (appointmentDateTime(b, now)?.getTime() || 0) - (appointmentDateTime(a, now)?.getTime() || 0));
    return appointments
      .filter((item) => ['confirmed', 'completed', 'cancelled'].includes(statusOf(item)))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [appointments, filter]);

  const renderItem = ({ item }) => {
    const status = String(item.status || 'Pending').toLowerCase();
    const success = status === 'completed' || status === 'confirmed';
    const title = filter === 'Updates'
      ? status === 'completed' ? 'Session completed successfully' : status === 'confirmed' ? 'Appointment confirmed' : 'Appointment cancelled'
      : item.studentName || 'Student appointment';
    const description = filter === 'Updates'
      ? `${item.studentName || 'Student'} · ${item.date || 'Date not set'}${item.time ? ` at ${item.time}` : ''}`
      : `${item.sessionType || 'Counseling session'} · ${item.date || 'Date not set'}${item.time ? ` · ${item.time}` : ''}`;
    return (
      <View style={styles.card}>
        <View style={[styles.icon, success ? styles.successIcon : styles.neutralIcon]}>
          <Feather name={status === 'completed' ? 'check-circle' : status === 'cancelled' ? 'x-circle' : filter === 'Upcoming' ? 'clock' : 'calendar'} size={19} color={success ? '#267857' : '#6B7790'} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDescription}>{description}</Text>
          {item.notes ? <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text> : null}
        </View>
        <Text style={[styles.status, success ? styles.statusSuccess : styles.statusNeutral]}>{item.status || 'Pending'}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F2" />
      <CounselorBackButton navigation={navigation} style={styles.backButton} />
      <View style={styles.header}>
        <View style={styles.headerIcon}><Feather name="bell" size={20} color="#fff" /></View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Upcoming sessions, history, and appointment updates.</Text>
        </View>
      </View>
      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <TouchableOpacity key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]} accessibilityRole="button" accessibilityState={{ selected: filter === item }}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color="#EF6553" /><Text style={styles.emptyText}>Loading activity…</Text></View> : error ? (
        <View style={styles.center}>
          <Feather name="cloud-off" size={25} color="#748295" />
          <Text style={styles.emptyTitle}>Notifications unavailable</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => String(item.id || item._id || index)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={<View style={styles.emptyCard}><Feather name="check-circle" size={24} color="#4A9A74" /><Text style={styles.emptyTitle}>You’re all caught up</Text><Text style={styles.emptyText}>New appointment activity will appear here.</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF8F2' },
  backButton: { marginLeft: 12, marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 4, paddingBottom: 17 },
  headerIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EF6553', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerCopy: { flex: 1 }, title: { color: '#24232A', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#6F737E', fontSize: 12, lineHeight: 17, marginTop: 2 },
  filters: { flexDirection: 'row', marginHorizontal: 18, marginBottom: 14, backgroundColor: '#F0E9E5', borderRadius: 13, padding: 4 },
  filter: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  filterActive: { backgroundColor: '#fff' }, filterText: { color: '#78818C', fontSize: 12, fontWeight: '700' }, filterTextActive: { color: '#C85F4E' },
  list: { paddingHorizontal: 18, paddingBottom: 28, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0E7E1', borderRadius: 16, padding: 13, marginBottom: 10 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  successIcon: { backgroundColor: '#E5F5EC' }, neutralIcon: { backgroundColor: '#EEF2F7' },
  copy: { flex: 1 }, cardTitle: { color: '#2D3440', fontSize: 13, fontWeight: '800' },
  cardDescription: { color: '#727D8A', fontSize: 11, lineHeight: 16, marginTop: 4 }, notes: { color: '#687386', fontSize: 11, lineHeight: 16, marginTop: 6 },
  status: { overflow: 'hidden', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: '800', marginLeft: 6 },
  statusSuccess: { color: '#267857', backgroundColor: '#E5F5EC' }, statusNeutral: { color: '#6B7790', backgroundColor: '#EEF2F7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25 }, emptyCard: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center', padding: 22 },
  emptyTitle: { color: '#29394A', fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 10 }, emptyText: { color: '#788698', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  retry: { marginTop: 13, borderRadius: 10, backgroundColor: '#EF6553', paddingHorizontal: 16, paddingVertical: 9 }, retryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
