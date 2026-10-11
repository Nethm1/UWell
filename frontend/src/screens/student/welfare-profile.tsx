import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { welfareChatService, WelfareOfficerSummary } from '../../services/welfareChatService';

const initialsFor = (name: string = '') =>
  name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'WO';

export default function WelfareProfileScreen({ route, navigation }: any) {
  const { officerId } = route.params || {};
  const [officer, setOfficer] = useState<WelfareOfficerSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async () => {
    if (!officerId) return;
    try {
      const data = await welfareChatService.getOfficerProfile(officerId);
      setOfficer(data);
    } catch (err: any) {
      console.warn('Error fetching officer profile:', err.message);
    } finally {
      setLoading(false);
    }
  }, [officerId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleCall = (number: string) => {
    const cleaned = (number || '').replace(/[^0-9+]/g, '');
    if (!cleaned) {
      Alert.alert('Phone Unavailable', 'No valid contact number registered.');
      return;
    }
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      Alert.alert('Call Failed', `Could not place call to ${number}`);
    });
  };

  const handleEmail = (emailAddress: string) => {
    if (!emailAddress) return;
    Linking.openURL(`mailto:${emailAddress}`).catch(() => {
      Alert.alert('Email Failed', `Could not open mail client for ${emailAddress}`);
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading officer profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!officer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Officer Profile</Text>
        </View>
        <View style={styles.centerBox}>
          <Text style={styles.loadingText}>Officer profile could not be loaded.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAvailable = (officer.availabilityStatus || '').toLowerCase().includes('available');
  const emergencyPhone = officer.emergencyContactPhone || officer.phone;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Officer Profile</Text>
        <TouchableOpacity
          style={styles.sosPill}
          onPress={() => handleCall(emergencyPhone)}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={14} color="#FFFFFF" />
          <Text style={styles.sosPillText}>Emergency Call</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Hero Profile Card ───────────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            {officer.profilePicture ? (
              <Image source={{ uri: officer.profilePicture }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{initialsFor(officer.name)}</Text>
              </View>
            )}
            {isAvailable && <View style={styles.onlineDot} />}
          </View>

          <Text style={styles.officerName}>{officer.name}</Text>
          <Text style={styles.officerRole}>
            {officer.position} • {officer.department}
          </Text>

          {officer.staffId && (
            <View style={styles.staffBadge}>
              <Text style={styles.staffBadgeText}>STAFF ID: {officer.staffId}</Text>
            </View>
          )}

          {/* Quick Contact Buttons */}
          <View style={styles.quickContactRow}>
            <TouchableOpacity
              style={styles.quickContactBtn}
              onPress={() => handleCall(officer.phone)}
              activeOpacity={0.7}
            >
              <Feather name="phone" size={16} color={colors.primary} />
              <Text style={styles.quickContactText}>Office Phone</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickContactBtn}
              onPress={() => handleEmail(officer.email)}
              activeOpacity={0.7}
            >
              <Feather name="mail" size={16} color={colors.primary} />
              <Text style={styles.quickContactText}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickContactBtn, { backgroundColor: '#FBE1DE' }]}
              onPress={() => handleCall(emergencyPhone)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="phone-alert" size={18} color="#C0392B" />
              <Text style={[styles.quickContactText, { color: '#C0392B', fontWeight: '800' }]}>
                Hotline
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Emergency Standby Card ────────────────────────────────────────── */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyIconWrap}>
            <Ionicons name="shield-checkmark" size={22} color="#C0392B" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.emergencyCardTitle}>Crisis & Emergency Standby</Text>
              <View style={[styles.standbyPill, officer.emergencyAvailable ? styles.standbyActive : styles.standbyInactive]}>
                <Text style={[styles.standbyPillText, officer.emergencyAvailable ? { color: '#C0392B' } : { color: colors.textSecondary }]}>
                  {officer.emergencyAvailable ? 'ON STANDBY' : 'OFFLINE'}
                </Text>
              </View>
            </View>
            <Text style={styles.emergencyCardDesc}>
              This officer is designated to assist students in acute distress, accommodation crises, and urgent safety situations.
            </Text>
            <TouchableOpacity
              style={styles.callHotlineButton}
              onPress={() => handleCall(emergencyPhone)}
              activeOpacity={0.85}
            >
              <Feather name="phone-call" size={15} color="#FFFFFF" />
              <Text style={styles.callHotlineText}>Call Emergency: {emergencyPhone}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Office Schedule & Location ────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Working Schedule & Office</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>OFFICE LOCATION</Text>
              <Text style={styles.infoValue}>{officer.officeLocation || 'Main Welfare Centre'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>OFFICE HOURS</Text>
              <Text style={styles.infoValue}>{officer.officeHours || 'Monday – Friday, 8:30 AM – 4:30 PM'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <MaterialCommunityIcons name="laptop" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>CONSULTATION MODE</Text>
              <Text style={styles.infoValue}>{officer.consultationMode || 'In-Person & Online'}</Text>
            </View>
          </View>

          {officer.availabilityNote ? (
            <View style={styles.noteBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.noteText}>{officer.availabilityNote}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Specializations & Support Areas ───────────────────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Areas of Support</Text>
          <View style={styles.specChipsRow}>
            {(officer.specializations || ['Student Wellbeing', 'Financial Aid', 'Housing Support']).map((spec, i) => (
              <View key={i} style={styles.specChip}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                <Text style={styles.specChipText}>{spec}</Text>
              </View>
            ))}
          </View>

          {officer.bio ? (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.infoLabel}>ABOUT THIS OFFICER</Text>
              <Text style={styles.bioText}>{officer.bio}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── Fixed Bottom Actions ──────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.chatActionBtn}
          onPress={() =>
            navigation.navigate('WelfareChat', {
              officerId: officer.id || officer._id,
              officerName: officer.name,
              officerRole: officer.position,
              officeLocation: officer.officeLocation,
              emergencyPhone,
            })
          }
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubbles" size={18} color="#FFFFFF" />
          <Text style={styles.chatActionText}>Chat with Officer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.creamBackground },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: colors.textSecondary },
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
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.creamBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.darkText },
  sosPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C0392B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 5,
  },
  sosPillText: { fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' },
  content: { padding: 16 },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0E6DE',
  },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatarImage: { width: 84, height: 84, borderRadius: 42 },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FDEAE5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarInitials: { fontSize: 28, fontWeight: '800', color: colors.primaryDark },
  onlineDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#27AE60',
    borderWidth: 3,
    borderColor: colors.white,
  },
  officerName: { fontSize: 20, fontWeight: '800', color: colors.darkText, marginBottom: 2 },
  officerRole: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  staffBadge: {
    backgroundColor: colors.creamBackground,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  staffBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  quickContactRow: { flexDirection: 'row', gap: 10, width: '100%' },
  quickContactBtn: {
    flex: 1,
    backgroundColor: colors.creamBackground,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFE5DD',
    gap: 4,
  },
  quickContactText: { fontSize: 11, fontWeight: '700', color: colors.darkText },
  emergencyCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF4F2',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F8C8C2',
    marginBottom: 16,
    gap: 12,
  },
  emergencyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FBE1DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyCardTitle: { fontSize: 14, fontWeight: '800', color: '#C0392B' },
  standbyPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  standbyActive: { backgroundColor: '#FBE1DE' },
  standbyInactive: { backgroundColor: '#ECE7E4' },
  standbyPillText: { fontSize: 9.5, fontWeight: '800' },
  emergencyCardDesc: { fontSize: 11.5, color: '#684542', lineHeight: 16, marginVertical: 8 },
  callHotlineButton: {
    backgroundColor: '#C0392B',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  callHotlineText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0E6DE',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.darkText, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  infoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.creamBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontSize: 9.5, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.darkText, marginTop: 1 },
  noteBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8F4',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FBE7DE',
    gap: 8,
    alignItems: 'center',
  },
  noteText: { fontSize: 11.5, color: colors.textSecondary, flex: 1, lineHeight: 16 },
  specChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 5,
  },
  specChipText: { fontSize: 11.5, color: colors.darkText, fontWeight: '600' },
  bioText: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  chatActionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chatActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
