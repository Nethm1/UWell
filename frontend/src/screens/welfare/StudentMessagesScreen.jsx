import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { welfareChatService } from '../../services/welfareChatService';

const FILTER_TABS = ['All', '🚨 Emergency SOS', 'Unread'];

const initialsFor = (name = '') =>
  name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'ST';

export default function StudentMessagesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [emergencyCount, setEmergencyCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInbox = useCallback(async () => {
    try {
      let filterParam = undefined;
      if (activeTab === '🚨 Emergency SOS') filterParam = 'emergency';
      else if (activeTab === 'Unread') filterParam = 'unread';

      const res = await welfareChatService.getOfficerInbox(filterParam);
      if (res?.success) {
        setConversations(res.conversations || []);
        setEmergencyCount(res.emergencyCount || 0);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.warn('Error fetching officer inbox:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchInbox();
    }, [fetchInbox])
  );

  useEffect(() => {
    // ── Real-Time Sockets for Live Messages & Alarms ─────────────────────────
    const unsubNewMsg = welfareChatService.onNewMessage(() => {
      fetchInbox();
    });

    const unsubSos = welfareChatService.onEmergencySos((payload) => {
      fetchInbox();
      if (payload?.studentName) {
        Alert.alert(
          '🚨 EMERGENCY SOS ALERT',
          `Student ${payload.studentName} (${payload.studentRegNo || ''}) needs urgent crisis help:\n\n"${payload.message || 'Emergency reported'}"`,
          [
            { text: 'Dismiss', style: 'cancel' },
            {
              text: 'View & Respond',
              onPress: () => {
                navigation.navigate('StudentChat', {
                  studentId: payload.studentId,
                  studentName: payload.studentName,
                  studentRegNo: payload.studentRegNo,
                  studentPhone: payload.studentPhone,
                });
              },
            },
          ]
        );
      }
    });

    const unsubResolved = welfareChatService.onEmergencyResolved(() => {
      fetchInbox();
    });

    return () => {
      if (unsubNewMsg) unsubNewMsg();
      if (unsubSos) unsubSos();
      if (unsubResolved) unsubResolved();
    };
  }, [fetchInbox, navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInbox();
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (c.studentName || '').toLowerCase().includes(q) ||
        (c.studentRegNo || '').toLowerCase().includes(q) ||
        (c.studentFaculty || '').toLowerCase().includes(q) ||
        (c.lastMessage || '').toLowerCase().includes(q);

      return matchesSearch;
    });
  }, [conversations, searchQuery]);

  const renderConversationItem = ({ item }) => {
    const isEmergency = item.isEmergency;
    const hasUnread = (item.unreadCount || 0) > 0;

    return (
      <TouchableOpacity
        style={[
          styles.convCard,
          isEmergency && styles.convCardEmergency,
          hasUnread && !isEmergency && styles.convCardUnread,
        ]}
        onPress={() =>
          navigation.navigate('StudentChat', {
            studentId: item.studentId,
            studentName: item.studentName,
            studentRegNo: item.studentRegNo,
            studentPhone: item.studentPhone,
            studentFaculty: item.studentFaculty,
          })
        }
        activeOpacity={0.82}
      >
        {/* Avatar */}
        <View style={[styles.avatarBox, isEmergency && { backgroundColor: '#FBE1DE' }]}>
          <Text style={[styles.avatarInitials, isEmergency && { color: '#C0392B' }]}>
            {initialsFor(item.studentName)}
          </Text>
        </View>

        {/* Content */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.topRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text style={styles.studentName} numberOfLines={1}>
                {item.studentName}
              </Text>
              {isEmergency && (
                <View style={styles.emergencyTag}>
                  <Text style={styles.emergencyTagText}>🚨 SOS</Text>
                </View>
              )}
            </View>

            <Text style={styles.timestamp}>
              {item.lastMessageAt
                ? new Date(item.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ''}
            </Text>
          </View>

          <Text style={styles.studentMeta} numberOfLines={1}>
            {item.studentRegNo ? `${item.studentRegNo} • ` : ''}
            {item.studentFaculty || 'Student'}
          </Text>

          <View style={styles.bottomRow}>
            <Text
              style={[
                styles.lastMessage,
                isEmergency && styles.lastMessageEmergency,
                hasUnread && styles.lastMessageBold,
              ]}
              numberOfLines={2}
            >
              {item.lastMessage || 'No messages yet'}
            </Text>

            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 9 ? '9+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Student Messages</Text>
          <Text style={styles.headerSub}>Direct student triage & crisis communication</Text>
        </View>

        {emergencyCount > 0 && (
          <View style={styles.emergencyTotalPill}>
            <MaterialCommunityIcons name="shield-alert" size={16} color="#FFFFFF" />
            <Text style={styles.emergencyTotalText}>{emergencyCount} SOS</Text>
          </View>
        )}
      </View>

      {/* ── Active Crisis Alert Banner ────────────────────────────────────────── */}
      {emergencyCount > 0 && (
        <View style={styles.crisisAlertBox}>
          <Ionicons name="warning" size={20} color="#C0392B" />
          <View style={{ flex: 1 }}>
            <Text style={styles.crisisAlertTitle}>
              {emergencyCount} Urgent Student Crisis Alert{emergencyCount > 1 ? 's' : ''}
            </Text>
            <Text style={styles.crisisAlertSub}>
              Students have triggered high-priority Emergency SOS. Please respond immediately.
            </Text>
          </View>
        </View>
      )}

      {/* ── Search Bar ────────────────────────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={17} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search student name, registration number..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Filter Tabs ───────────────────────────────────────────────────────── */}
      <View style={styles.tabsRow}>
        {FILTER_TABS.map((tab) => {
          const active = activeTab === tab;
          const isSosTab = tab === '🚨 Emergency SOS';
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabChip,
                active && styles.tabChipActive,
                isSosTab && active && styles.tabChipActiveEmergency,
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabChipText,
                  active && styles.tabChipTextActive,
                  isSosTab && !active && { color: '#C0392B', fontWeight: '800' },
                ]}
              >
                {tab}
                {tab === 'Unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
                {isSosTab && emergencyCount > 0 ? ` (${emergencyCount})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Conversations List ────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading student messages...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="message-text-outline" size={46} color={colors.mutedRose} />
              <Text style={styles.emptyTitle}>No Messages Found</Text>
              <Text style={styles.emptySub}>
                {activeTab === '🚨 Emergency SOS'
                  ? 'No active student emergency alerts at this time.'
                  : 'Student inquiries and direct chat messages will appear here.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.creamBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.darkText },
  headerSub: { fontSize: 11.5, color: colors.textSecondary, marginTop: 1 },
  emergencyTotalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C0392B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  emergencyTotalText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  crisisAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEAE8',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F8C8C2',
    gap: 10,
  },
  crisisAlertTitle: { fontSize: 12.5, fontWeight: '800', color: '#C0392B' },
  crisisAlertSub: { fontSize: 11, color: '#663B37', marginTop: 1, lineHeight: 15 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabChipActiveEmergency: { backgroundColor: '#C0392B', borderColor: '#C0392B' },
  tabChipText: { fontSize: 11.5, fontWeight: '600', color: colors.textSecondary },
  tabChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: colors.textSecondary },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.darkText },
  emptySub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 17 },
  convCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0E5DF',
  },
  convCardEmergency: {
    backgroundColor: '#FFF5F3',
    borderColor: '#F8C8C2',
    borderWidth: 1.5,
  },
  convCardUnread: {
    backgroundColor: '#FFFAF7',
    borderColor: '#F5DDD5',
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 16, fontWeight: '800', color: colors.primaryDark },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  studentName: { fontSize: 14.5, fontWeight: '800', color: colors.darkText },
  emergencyTag: {
    backgroundColor: '#FBE1DE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  emergencyTagText: { fontSize: 9.5, fontWeight: '900', color: '#C0392B' },
  timestamp: { fontSize: 10.5, color: colors.textMuted },
  studentMeta: { fontSize: 11, color: colors.textSecondary, marginBottom: 5 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  lastMessage: { fontSize: 12, color: '#625855', lineHeight: 16, flex: 1 },
  lastMessageEmergency: { color: '#C0392B', fontWeight: '700' },
  lastMessageBold: { fontWeight: '700', color: colors.darkText },
  unreadBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
