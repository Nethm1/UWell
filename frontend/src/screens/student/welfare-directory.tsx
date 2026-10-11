import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { welfareChatService, WelfareOfficerSummary } from '../../services/welfareChatService';

const FILTER_TABS = ['All', 'Available Today', 'Emergency Standby', 'On Campus'];

const initialsFor = (name: string = '') =>
  name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'WO';

export default function WelfareDirectoryScreen({ navigation }: any) {
  const [officers, setOfficers] = useState<WelfareOfficerSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('All');

  const fetchOfficers = useCallback(async () => {
    try {
      const data = await welfareChatService.getAvailableOfficers();
      setOfficers(data);
    } catch (err: any) {
      console.warn('Error fetching welfare officers:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOfficers();
  };

  const handleEmergencyCall = (phone: string) => {
    const cleaned = (phone || '').replace(/[^0-9+]/g, '');
    if (!cleaned) {
      Alert.alert('No Phone', 'No emergency contact phone registered for this officer.');
      return;
    }
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      Alert.alert('Call Failed', `Could not place call to ${phone}`);
    });
  };

  const filteredOfficers = useMemo(() => {
    return officers.filter((o) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (o.name || '').toLowerCase().includes(q) ||
        (o.department || '').toLowerCase().includes(q) ||
        (o.officeLocation || '').toLowerCase().includes(q) ||
        (o.specializations || []).some((s) => s.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeTab === 'Available Today') {
        return (o.availabilityStatus || '').toLowerCase().includes('available');
      }
      if (activeTab === 'Emergency Standby') {
        return Boolean(o.emergencyAvailable);
      }
      if (activeTab === 'On Campus') {
        return (o.workingSchedule || '').toLowerCase().includes('campus') || (o.consultationMode || '').toLowerCase().includes('person');
      }
      return true;
    });
  }, [officers, searchQuery, activeTab]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Student Welfare</Text>
          <Text style={styles.headerSub}>Dedicated student advocacy & emergency support</Text>
        </View>
        <TouchableOpacity
          style={styles.sosQuickBadge}
          onPress={() => handleEmergencyCall('1990')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="shield-alert" size={16} color="#C0392B" />
          <Text style={styles.sosQuickText}>SOS</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* ── 24/7 Crisis Help Banner ───────────────────────────────────────── */}
        <View style={styles.crisisBanner}>
          <View style={styles.crisisIconBox}>
            <Ionicons name="warning-outline" size={22} color="#C0392B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.crisisTitle}>Immediate Crisis Support</Text>
            <Text style={styles.crisisDesc}>
              Facing an urgent emergency or crisis? Reach on-duty welfare officers or 24/7 campus helpline.
            </Text>
            <View style={styles.crisisBtnRow}>
              <TouchableOpacity
                style={styles.crisisCallBtn}
                onPress={() => handleEmergencyCall('0112345678')}
                activeOpacity={0.85}
              >
                <Feather name="phone-call" size={13} color="#FFFFFF" />
                <Text style={styles.crisisCallBtnText}>Call Campus Security / Triage</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Search Bar ────────────────────────────────────────────────────── */}
        <View style={styles.searchWrap}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by officer name, bursaries, housing..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Filter Tabs ───────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {FILTER_TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabChip, active && styles.tabChipActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Officers List ─────────────────────────────────────────────────── */}
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>
            Available Officers ({filteredOfficers.length})
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading welfare officers...</Text>
          </View>
        ) : filteredOfficers.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="account-search-outline" size={48} color={colors.mutedRose} />
            <Text style={styles.emptyTitle}>No Officers Found</Text>
            <Text style={styles.emptySub}>
              No welfare officers match your filter criteria. Try searching with a different term.
            </Text>
          </View>
        ) : (
          filteredOfficers.map((officer) => {
            const isAvailable = (officer.availabilityStatus || '').toLowerCase().includes('available');
            return (
              <View key={officer.id || officer._id} style={styles.officerCard}>
                {/* Header Row with Avatar & Status */}
                <View style={styles.cardTopRow}>
                  <View style={styles.avatarWrap}>
                    {officer.profilePicture ? (
                      <Image source={{ uri: officer.profilePicture }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitials}>{initialsFor(officer.name)}</Text>
                      </View>
                    )}
                    {isAvailable && <View style={styles.onlineBadge} />}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={styles.officerName} numberOfLines={1}>{officer.name}</Text>
                      {officer.emergencyAvailable && (
                        <View style={styles.emergencyTag}>
                          <Text style={styles.emergencyTagText}>🚨 SOS On-Duty</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.officerRole} numberOfLines={1}>
                      {officer.position || 'Welfare Officer'} • {officer.department || 'Student Services'}
                    </Text>

                    <View style={styles.statusPillRow}>
                      <View style={[styles.statusPill, isAvailable ? styles.statusPillGreen : styles.statusPillAmber]}>
                        <View style={[styles.statusDot, isAvailable ? { backgroundColor: colors.statusGreenText } : { backgroundColor: colors.statusYellowText }]} />
                        <Text style={[styles.statusPillText, isAvailable ? { color: colors.statusGreenText } : { color: colors.statusYellowText }]}>
                          {officer.availabilityStatus || 'On Duty'}
                        </Text>
                      </View>
                      <View style={styles.locationPill}>
                        <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.locationPillText} numberOfLines={1}>
                          {officer.officeLocation || 'Campus Office'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Specialization Tags */}
                {officer.specializations && officer.specializations.length > 0 && (
                  <View style={styles.specChipsRow}>
                    {officer.specializations.slice(0, 3).map((spec, i) => (
                      <View key={i} style={styles.specChip}>
                        <Text style={styles.specChipText}>{spec}</Text>
                      </View>
                    ))}
                    {officer.specializations.length > 3 && (
                      <Text style={styles.specMoreText}>+{officer.specializations.length - 3} more</Text>
                    )}
                  </View>
                )}

                {/* Card Actions */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() =>
                      navigation.navigate('WelfareChat', {
                        officerId: officer.id || officer._id,
                        officerName: officer.name,
                        officerRole: officer.position,
                        officeLocation: officer.officeLocation,
                        emergencyPhone: officer.emergencyContactPhone || officer.phone,
                      })
                    }
                    activeOpacity={0.82}
                  >
                    <Ionicons name="chatbubble-ellipses" size={15} color="#FFFFFF" />
                    <Text style={styles.chatButtonText}>Direct Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() =>
                      navigation.navigate('WelfareProfile', {
                        officerId: officer.id || officer._id,
                      })
                    }
                    activeOpacity={0.82}
                  >
                    <Text style={styles.profileButtonText}>View Profile</Text>
                    <Feather name="chevron-right" size={15} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.creamBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.creamBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.darkText },
  headerSub: { fontSize: 11.5, color: colors.textSecondary, marginTop: 1 },
  sosQuickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBE1DE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  sosQuickText: { fontSize: 11, fontWeight: '800', color: '#C0392B' },
  content: { padding: 16 },
  crisisBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF4F2',
    borderWidth: 1,
    borderColor: '#F8C8C2',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  crisisIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FBE1DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crisisTitle: { fontSize: 14, fontWeight: '800', color: '#C0392B', marginBottom: 2 },
  crisisDesc: { fontSize: 11.5, color: '#684542', lineHeight: 16, marginBottom: 8 },
  crisisBtnRow: { flexDirection: 'row', alignItems: 'center' },
  crisisCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C0392B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  crisisCallBtnText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },
  tabScroll: { gap: 8, paddingBottom: 14 },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  tabChipTextActive: { color: colors.white },
  sectionHeadingRow: { marginBottom: 12, marginTop: 4 },
  sectionHeading: { fontSize: 15, fontWeight: '800', color: colors.darkText },
  loadingBox: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: colors.textSecondary },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.darkText },
  emptySub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 17 },
  officerCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0E6DE',
    shadowColor: '#C6AEA1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  avatarImage: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FDEAE5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F8C8C2',
  },
  avatarInitials: { fontSize: 17, fontWeight: '800', color: colors.primaryDark },
  onlineBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#27AE60',
    borderWidth: 2,
    borderColor: colors.white,
  },
  officerName: { fontSize: 15, fontWeight: '800', color: colors.darkText, flexShrink: 1 },
  emergencyTag: {
    backgroundColor: '#FBE1DE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  emergencyTagText: { fontSize: 9.5, fontWeight: '800', color: '#C0392B' },
  officerRole: { fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
  statusPillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
  statusPillGreen: { backgroundColor: colors.statusGreenBg },
  statusPillAmber: { backgroundColor: colors.statusYellowBg },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.creamBackground,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  locationPillText: { fontSize: 10, color: colors.textSecondary, fontWeight: '500' },
  specChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, alignItems: 'center' },
  specChip: {
    backgroundColor: '#F7EFEA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  specChipText: { fontSize: 10, color: '#554A46', fontWeight: '600' },
  specMoreText: { fontSize: 10, color: colors.textMuted },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5ECE6',
  },
  chatButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chatButtonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  profileButton: {
    flex: 1,
    backgroundColor: colors.creamBackground,
    borderRadius: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFE5DD',
    gap: 4,
  },
  profileButtonText: { color: colors.darkText, fontSize: 12.5, fontWeight: '700' },
});
