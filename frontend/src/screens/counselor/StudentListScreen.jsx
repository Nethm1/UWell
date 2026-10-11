import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../../theme';
import ImagePlaceholder from '../../components/common/ImagePlaceholder';
import { counselorService } from '../../services/counselorService';

const FILTERS = ['All', 'New', 'Active', 'Archived'];
const FILTER_TONES = {
  New: { bg: '#FFF1D6', text: '#9A5B00', accent: '#F4A62A' },
  Active: { bg: '#DDF5EC', text: '#177957', accent: '#2BA77A' },
  Archived: { bg: '#EEF0F5', text: '#687386', accent: '#94A0B2' },
  Completed: { bg: '#E9E7FF', text: '#5953AD', accent: '#7971D7' },
};

const StudentListScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;

  const loadStudents = useCallback(async () => {
    try {
      setLoadError('');
      const data = await counselorService.getStudents();
      setStudents(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not load your booked students. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadStudents();
    return undefined;
  }, [loadStudents]));

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, tension: 75, friction: 12, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredStudents = students.filter((student) => {
    const name = (student.name || '').toLowerCase();
    const course = (student.yearCourse || '').toLowerCase();
    const email = (student.email || '').toLowerCase();
    const matchesQuery = !normalizedSearch || `${name} ${course} ${email}`.includes(normalizedSearch);
    const matchesStatus = activeFilter === 'All' || (student.status || 'New') === activeFilter;
    return matchesQuery && matchesStatus;
  });

  const openChat = (student) => {
    navigation.getParent()?.navigate('Messages', {
      screen: 'StudentChat',
      params: { studentId: student.id, studentName: student.name },
    });
  };

  const changeStatus = (student) => {
    const nextStatus = student.status === 'Archived' ? 'Active' : 'Archived';
    const message = nextStatus === 'Archived'
      ? 'Archive this student record? Their notes and session history will be kept.'
      : 'Restore this student record to your active list?';
    const applyChange = async () => {
      setUpdatingId(student.id);
      try {
        await counselorService.updateStudentStatus(student.id, nextStatus);
        await loadStudents();
      } catch (error) {
        const details = error.response?.data?.message || 'Could not update student status. Please retry.';
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(details);
        else Alert.alert('Update failed', details);
      } finally {
        setUpdatingId('');
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) void applyChange();
    } else {
      Alert.alert(nextStatus === 'Archived' ? 'Archive student' : 'Restore student', message, [
        { text: 'Keep as is', style: 'cancel' },
        { text: nextStatus === 'Archived' ? 'Archive' : 'Restore', onPress: () => { void applyChange(); } },
      ]);
    }
  };

  const renderItem = ({ item, index }) => {
    const status = item.status || 'New';
    const tone = FILTER_TONES[status] || FILTER_TONES.New;

    return (
      <View style={styles.cardShell}>
        <View style={[styles.cardAccent, { backgroundColor: tone.accent }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <ImagePlaceholder initials={item.avatarInitials || item.name?.slice(0, 2) || 'ST'} size={48} />
            <View style={styles.studentMeta}>
              <Text style={styles.studentName} numberOfLines={1}>{item.name || 'Student'}</Text>
              <Text style={styles.courseText} numberOfLines={1}>{item.yearCourse || 'University student'}</Text>
              <Text style={styles.sessionsText}>{item.sessionsCompleted || 0} sessions completed</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
              <Text style={[styles.statusText, { color: tone.text }]}>{status}</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.recordButton}
              onPress={() => navigation.navigate('StudentSession', { studentId: item.id })}
              activeOpacity={0.78}
              accessibilityLabel={`Open ${item.name}'s student record`}
            >
              <Feather name="folder" size={15} color="#40556C" />
              <Text style={styles.recordButtonText}>Open record</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.messageButton, status === 'Archived' && styles.restoreMessageButton]}
              onPress={() => openChat(item)}
              activeOpacity={0.78}
              accessibilityLabel={`Message ${item.name}`}
            >
              <Ionicons name="chatbubble-ellipses" size={15} color="#fff" />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.archiveButton}
              onPress={() => changeStatus(item)}
              disabled={updatingId === item.id}
              accessibilityLabel={status === 'Archived' ? `Restore ${item.name}` : `Archive ${item.name}`}
            >
              {updatingId === item.id
                ? <ActivityIndicator size="small" color="#637184" />
                : <Feather name={status === 'Archived' ? 'rotate-ccw' : 'archive'} size={16} color="#637184" />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const emptyTitle = loadError ? 'Students unavailable' : normalizedSearch || activeFilter !== 'All' ? 'No matching students' : 'No bookings yet';
  const emptyDescription = loadError
    ? loadError
    : normalizedSearch || activeFilter !== 'All'
      ? 'Try changing your search or status filter.'
      : 'Students who book a session with you will appear here. You can open their record or start a private chat.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FB" />
      <Animated.View style={[styles.container, { opacity: fade, transform: [{ translateY: rise }] }]}>
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadStudents}
          ListHeaderComponent={(
            <View>
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.eyebrow}><View style={styles.eyebrowDot} /><Text style={styles.eyebrowText}>YOUR COUNSELING PRACTICE</Text></View>
                  <Text style={styles.headerTitle}>Students</Text>
                  <Text style={styles.headerSub}>Every student listed here has booked a session with you.</Text>
                </View>
                <View style={styles.countCard}>
                  <Text style={styles.countNumber}>{students.filter((student) => student.status !== 'Archived').length}</Text>
                  <Text style={styles.countLabel}>CLIENTS</Text>
                </View>
              </View>

              <View style={styles.searchWrap}>
                <Feather name="search" size={17} color="#8793A3" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search name, course, or email"
                  placeholderTextColor="#97A1AF"
                  style={styles.searchInput}
                  accessibilityLabel="Search students"
                />
                {!!searchQuery && <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search"><Feather name="x-circle" size={16} color="#8793A3" /></TouchableOpacity>}
              </View>

              <View style={styles.filtersRow}>
                {FILTERS.map((filter) => {
                  const selected = activeFilter === filter;
                  return (
                    <TouchableOpacity
                      key={filter}
                      style={[styles.filterPill, selected && styles.filterPillSelected]}
                      onPress={() => setActiveFilter(filter)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{filter}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>{activeFilter === 'All' ? 'BOOKED STUDENTS' : `${activeFilter.toUpperCase()} STUDENTS`}</Text>
                <Text style={styles.resultCount}>{filteredStudents.length} shown</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyCard}>
              {loading ? <ActivityIndicator size="small" color="#25836C" /> : <View style={styles.emptyIcon}><Ionicons name={loadError ? 'cloud-offline-outline' : 'people-outline'} size={25} color="#25836C" /></View>}
              <Text style={styles.emptyTitle}>{loading ? 'Loading your students' : emptyTitle}</Text>
              {!loading && <Text style={styles.emptyText}>{emptyDescription}</Text>}
              {loadError && <TouchableOpacity style={styles.retryButton} onPress={loadStudents}><Text style={styles.retryButtonText}>Try again</Text></TouchableOpacity>}
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
  container: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingTop: 14, flexGrow: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  eyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2BA77A', marginRight: 7 },
  eyebrowText: { color: '#248266', fontSize: 10, fontWeight: '800', letterSpacing: 1.05 },
  headerTitle: { color: '#203247', fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  headerSub: { color: '#728094', fontSize: 13, lineHeight: 19, marginTop: 4, maxWidth: 270 },
  countCard: { width: 68, height: 70, backgroundColor: '#E1F3ED', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  countNumber: { fontSize: 23, fontWeight: '800', color: '#20785F' },
  countLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: '#548B79', marginTop: 2 },
  searchWrap: { minHeight: 50, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#E5EAF0', paddingHorizontal: 14, marginBottom: 13, shadowColor: '#243B53', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  searchInput: { flex: 1, color: '#203247', fontSize: 14, paddingVertical: 12, marginLeft: 10, outlineStyle: 'none' },
  filtersRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E9EDF3' },
  filterPillSelected: { backgroundColor: '#284A62' },
  filterText: { fontSize: 12, fontWeight: '700', color: '#6E7D8E' },
  filterTextSelected: { color: '#fff' },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#7A8798' },
  resultCount: { fontSize: 11, color: '#8A96A5', fontWeight: '600' },
  cardShell: { flexDirection: 'row', overflow: 'hidden', borderRadius: 18, backgroundColor: '#fff', marginBottom: 11, borderWidth: 1, borderColor: '#E7ECF1', shadowColor: '#1D354C', shadowOpacity: 0.055, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, padding: 13 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  studentMeta: { flex: 1, marginLeft: 11, marginRight: 6 },
  studentName: { fontSize: 15, fontWeight: '800', color: '#24364A' },
  courseText: { color: '#748295', fontSize: 12, marginTop: 3 },
  sessionsText: { color: '#21816A', fontSize: 10, fontWeight: '700', marginTop: 5 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start' },
  statusText: { fontSize: 10, fontWeight: '800' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#F0F2F5' },
  recordButton: { flex: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: '#EEF2F6' },
  recordButtonText: { color: '#40556C', fontSize: 11, fontWeight: '700' },
  messageButton: { flex: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: '#25836C' },
  restoreMessageButton: { backgroundColor: '#5F6D80' },
  messageButtonText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  archiveButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  emptyCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E7ECF1', padding: 24, marginTop: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3F4EE', marginBottom: 12 },
  emptyTitle: { color: '#2C3E50', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  emptyText: { color: '#788698', textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 6 },
  retryButton: { backgroundColor: '#25836C', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, marginTop: 14 },
  retryButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});

export default StudentListScreen;
