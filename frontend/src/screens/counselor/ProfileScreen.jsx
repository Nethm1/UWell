import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Animated,
  Dimensions,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import CounselorBackButton from '../../components/navigation/CounselorBackButton';
import { counselorService } from '../../services/counselorService';

const { width } = Dimensions.get('window');

// ─── Focus area config ────────────────────────────────────────────────────
const ProfileScreen = ({ navigation }) => {
  const [profile, setProfile]       = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [locationModal, setLocationModal] = useState(false);
  const [locationDraft, setLocationDraft] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadAll);
    loadAll();
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    return unsubscribe;
  }, [navigation]);

  const loadAll = async () => {
    setProfileLoading(true);
    setProfileError('');
    try {
      const data = await counselorService.getCounselorProfile();
      if (!data) throw new Error('Counselor profile is unavailable.');
      setProfile(data);
    } catch (error) {
      setProfile(null);
      setProfileError(error.response?.data?.message || 'Could not load your profile. Check your connection and try again.');
    } finally { setProfileLoading(false); }
  };

  const openLocationEditor = () => {
    setLocationDraft(profile?.officeLocation || '');
    setLocationError('');
    setLocationModal(true);
  };

  const saveOfficeLocation = async () => {
    const nextLocation = locationDraft.trim();
    if (nextLocation.length > 250) {
      setLocationError('Location must be 250 characters or fewer.');
      return;
    }
    setLocationSaving(true);
    setLocationError('');
    try {
      const updated = await counselorService.saveOfficeLocation(nextLocation);
      setProfile((current) => ({ ...current, ...updated, officeLocation: updated?.officeLocation ?? nextLocation }));
      setLocationModal(false);
    } catch (error) {
      setLocationError(error.response?.data?.message || 'Could not save the office location. Check your connection and try again.');
    } finally {
      setLocationSaving(false);
    }
  };

  const deleteOfficeLocation = () => {
    const remove = async () => {
      setLocationSaving(true);
      try {
        const updated = await counselorService.saveOfficeLocation('');
        setProfile((current) => ({ ...current, ...updated, officeLocation: '' }));
      } catch (error) {
        const message = error.response?.data?.message || 'Could not delete the office location. Check your connection and try again.';
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
        else Alert.alert('Delete failed', message);
      } finally {
        setLocationSaving(false);
      }
    };
    const message = 'Remove your saved office location?';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) void remove();
      return;
    }
    Alert.alert('Delete office location', message, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  };

  const focus = profile?.clinicalFocus || [];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Top bar ───────────────────────────────────────────── */}
      <View style={styles.referenceTopBar}>
        <CounselorBackButton navigation={navigation} />
        <Text style={styles.referenceTopTitle}>My Profile</Text>
        <TouchableOpacity
          style={styles.referenceGear}
          onPress={() => navigation.navigate('CounselorSettings')}
          accessibilityLabel="Open settings"
        >
          <Feather name="settings" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {profileLoading && <View style={styles.profileFeedback}><Text style={styles.profileFeedbackText}>Loading your profile...</Text></View>}
        {!!profileError && <View style={styles.profileErrorCard}><Text style={styles.profileErrorText}>{profileError}</Text><TouchableOpacity onPress={loadAll}><Text style={styles.profileRetry}>Try again</Text></TouchableOpacity></View>}

        <View style={styles.referenceProfileCard}>
          <View style={styles.referenceCover}>
            <Ionicons name="leaf" size={88} color="rgba(255,255,255,0.4)" style={styles.coverLeafLeft} />
            <Ionicons name="leaf" size={112} color="rgba(255,255,255,0.42)" style={styles.coverLeafRight} />
          </View>
          <View style={styles.referenceAvatarWrap}>
            {profile?.profileImage ? <Image source={{ uri: profile.profileImage }} style={styles.referenceAvatar} accessibilityLabel="Counselor profile photo" /> : <View style={[styles.referenceAvatar, styles.referenceAvatarFallback]}><Text style={styles.referenceAvatarText}>{profile?.avatarInitials || '?'}</Text></View>}
            <TouchableOpacity style={styles.referenceCamera} onPress={() => navigation.navigate('EditProfile')} accessibilityLabel="Change profile photo"><Feather name="camera" size={15} color="#fff" /></TouchableOpacity>
          </View>
          <Text style={styles.referenceName}>{profile?.name || (profileLoading ? 'Loading profile...' : 'Profile unavailable')}</Text>
          <Text style={styles.referenceRole}>{profile?.title || profile?.specialization || 'Counselor'}</Text>
          {!!profile?.status && <View style={styles.referenceStatus}><View style={styles.referenceStatusDot} /><Text style={styles.referenceStatusText}>{profile.status}</Text></View>}

          <View style={styles.referenceContactRow}>
            <View style={styles.referenceContactItem}><Feather name="mail" size={20} color="#71829D" /><Text style={styles.referenceContactValue} numberOfLines={2}>{profile?.email || 'Email not set'}</Text></View>
            <View style={styles.referenceContactItem}><Feather name="phone" size={20} color="#71829D" /><Text style={styles.referenceContactValue} numberOfLines={2}>{profile?.phone || 'Phone not set'}</Text></View>
            <View style={styles.referenceContactItem}><Feather name="map-pin" size={20} color="#71829D" /><Text style={styles.referenceContactValue} numberOfLines={2}>{profile?.officeLocation || 'Location not set'}</Text><View style={styles.referenceLocationActions}><TouchableOpacity onPress={openLocationEditor} accessibilityLabel={profile?.officeLocation ? 'Edit office location' : 'Add office location'}><Feather name={profile?.officeLocation ? 'edit-2' : 'plus'} size={13} color="#0865D9" /></TouchableOpacity>{!!profile?.officeLocation && <TouchableOpacity onPress={deleteOfficeLocation} disabled={locationSaving} accessibilityLabel="Delete office location"><Feather name="trash-2" size={13} color="#B42318" /></TouchableOpacity>}</View></View>
          </View>
        </View>

        <View style={styles.referenceInfoCard}>
          <View style={styles.referenceInfoIcon}><Feather name="award" size={22} color="#0875DA" /></View>
          <View style={styles.referenceInfoCopy}><Text style={styles.referenceInfoTitle}>Qualifications</Text><Text style={styles.referenceInfoText}>{profile?.qualification || 'Add your qualifications in Edit Profile'}</Text></View>
        </View>
        <View style={styles.referenceInfoCard}>
          <View style={[styles.referenceInfoIcon, { backgroundColor: '#FFF2E5' }]}><Feather name="book-open" size={22} color="#D78322" /></View>
          <View style={styles.referenceInfoCopy}><Text style={styles.referenceInfoTitle}>Specialization</Text><Text style={styles.referenceInfoText}>{profile?.specialization || 'Add your specialization in Edit Profile'}</Text>{!!focus.length && <Text style={styles.referenceInfoText}>{focus.join(', ')}</Text>}</View>
        </View>
        <View style={styles.referenceInfoCard}>
          <View style={[styles.referenceInfoIcon, { backgroundColor: '#F2ECFF' }]}><Feather name="file-text" size={22} color="#7952C5" /></View>
          <View style={styles.referenceInfoCopy}><Text style={styles.referenceInfoTitle}>Bio</Text><Text style={styles.referenceInfoText}>{profile?.bio || 'Add a short professional bio in Edit Profile'}</Text></View>
        </View>

        <TouchableOpacity style={styles.referenceEditButton} onPress={() => navigation.navigate('EditProfile')} accessibilityRole="button"><Feather name="edit-2" size={17} color="#fff" /><Text style={styles.referenceEditText}>Edit Profile</Text></TouchableOpacity>
        <View style={{ height: 20 }} />
      </Animated.ScrollView>
      <Modal visible={locationModal} transparent animationType="fade" onRequestClose={() => !locationSaving && setLocationModal(false)}>
        <View style={styles.locationModalBackdrop}>
          <View style={styles.locationModalCard}>
            <Text style={styles.locationModalTitle}>{profile?.officeLocation ? 'Edit office location' : 'Add office location'}</Text>
            <Text style={styles.locationModalHint}>Students will see this address for in-person appointments.</Text>
            <TextInput value={locationDraft} onChangeText={setLocationDraft} placeholder="Building, room, or campus address" placeholderTextColor="#98A1AC" style={styles.locationInput} maxLength={250} multiline accessibilityLabel="Office location" />
            {!!locationError && <Text style={styles.locationError}>{locationError}</Text>}
            <View style={styles.locationModalActions}>
              <TouchableOpacity onPress={() => setLocationModal(false)} disabled={locationSaving} style={styles.locationCancel}><Text style={styles.locationCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveOfficeLocation} disabled={locationSaving} style={styles.locationSave}>
                <Text style={styles.locationSaveText}>{locationSaving ? 'Saving…' : 'Save location'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────
const FOCUS_CARD_W = (width - spacing.md * 2 - spacing.sm) / 2;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFD',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFD',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  referenceTopBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#fff' },
  referenceTopTitle: { color: '#101B37', fontSize: 18, fontWeight: '800' },
  referenceGear: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  referenceProfileCard: { backgroundColor: '#fff', borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: '#EDF1F6', overflow: 'visible', alignItems: 'center', paddingBottom: 16, shadowColor: '#233B5C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  referenceCover: { height: 142, alignSelf: 'stretch', borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: '#CDEBFF', overflow: 'hidden', position: 'relative' },
  coverLeafLeft: { position: 'absolute', left: -8, bottom: -24, transform: [{ rotate: '-28deg' }] },
  coverLeafRight: { position: 'absolute', right: -8, top: 10, transform: [{ rotate: '35deg' }] },
  referenceAvatarWrap: { width: 108, height: 108, marginTop: -54, borderRadius: 54, borderWidth: 4, borderColor: '#fff', position: 'relative', backgroundColor: '#fff' },
  referenceAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EAF3FB' },
  referenceAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  referenceAvatarText: { color: '#1767C4', fontWeight: '800', fontSize: 28 },
  referenceCamera: { position: 'absolute', right: -3, bottom: 3, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0865D9', borderWidth: 2, borderColor: '#fff' },
  referenceName: { marginTop: 8, color: '#101B37', fontSize: 20, fontWeight: '800', textAlign: 'center', paddingHorizontal: 12 },
  referenceRole: { color: '#61728F', fontSize: 13, marginTop: 3 },
  referenceStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, backgroundColor: '#E4F8F1', paddingHorizontal: 11, paddingVertical: 5, marginTop: 9 },
  referenceStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#18B782' },
  referenceStatusText: { color: '#187A5A', fontSize: 11, fontWeight: '700' },
  referenceContactRow: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#EFF2F6' },
  referenceContactItem: { width: '33.333%', minHeight: 62, alignItems: 'center', paddingHorizontal: 5, gap: 6 },
  referenceContactValue: { color: '#293B5A', fontSize: 10, lineHeight: 14, textAlign: 'center' },
  referenceLocationActions: { flexDirection: 'row', gap: 12, marginTop: -2 },
  referenceInfoCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, marginBottom: 9, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EDF1F6', shadowColor: '#233B5C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  referenceInfoIcon: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F3FF' },
  referenceInfoCopy: { flex: 1 },
  referenceInfoTitle: { color: '#111C37', fontSize: 14, fontWeight: '800', marginBottom: 3 },
  referenceInfoText: { color: '#526483', fontSize: 12, lineHeight: 17 },
  referenceEditButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 12, backgroundColor: '#0865D9', marginTop: 4, shadowColor: '#0865D9', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 2 },
  referenceEditText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // ── Top bar ──────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.creamBackground,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.darkText,
    lineHeight: 32,
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDE8E8',
    borderColor: '#F9A8A8',
    borderWidth: 1,
    borderRadius: 14,
    marginTop: spacing.md,
  },
  logoutBtnText: {
    color: '#B42318',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Hero Card ────────────────────────────────────────────────
  heroCard: {
    backgroundColor: colors.softCoral,
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  blobTopRight: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(232,131,107,0.18)',
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: 40,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(232,131,107,0.12)',
  },
  heroLeft: {
    flex: 1,
    zIndex: 1,
  },
  avatarWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(232,131,107,0.25)',
    borderWidth: 3,
    borderColor: 'rgba(232,131,107,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: 'rgba(232,131,107,0.5)',
    backgroundColor: colors.softCoral,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.primary,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.darkText,
    lineHeight: 26,
  },
  heroTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingNum: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.darkText,
  },
  ratingMeta: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  miniStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  miniStatNum: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 20,
  },
  miniStatLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  miniStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  heroImageBox: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 110,
    alignItems: 'flex-end',
    zIndex: 2,
  },
  heroImageInner: {
    width: 100,
    height: 110,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heroQuoteBox: {
    width: 100,
  },
  heroQuoteText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 15,
    textAlign: 'right',
  },
  availBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    marginTop: 4,
    zIndex: 1,
  },
  availBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Section header ────────────────────────────────────────────
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.darkText,
    letterSpacing: 0.6,
  },
  sectionSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  seeAll: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },

  // ── Focus Areas grid ─────────────────────────────────────────
  focusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  emptyFocus: { width: '100%', color: colors.textSecondary, fontSize: 12, lineHeight: 18, paddingVertical: 10 },
  profileFeedback: { backgroundColor: colors.white, borderRadius: 12, padding: 12, marginBottom: spacing.sm },
  profileFeedbackText: { color: colors.textSecondary, fontSize: 12 },
  profileErrorCard: { backgroundColor: '#FFF1EF', borderRadius: 12, padding: 13, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#F4D0C9' },
  profileErrorText: { color: '#9B3125', fontSize: 12, lineHeight: 18 },
  profileRetry: { color: colors.primary, fontSize: 12, fontWeight: '800', marginTop: 8 },
  focusCard: {
    width: FOCUS_CARD_W,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#3D2C2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  focusIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  focusLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.darkText,
    lineHeight: 18,
  },
  focusChevron: {
    flexShrink: 0,
  },

  // ── Office & Contact ──────────────────────────────────────────
  officeCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
    flexDirection: 'row',
    shadowColor: '#3D2C2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  buildingImgBox: {
    width: 130,
    backgroundColor: colors.softCoral,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  buildingImgInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buildingLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(61,44,46,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    gap: 3,
  },
  buildingLabelText: {
    fontSize: 9,
    color: colors.white,
    fontWeight: '600',
    flex: 1,
  },
  contactDetails: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
  },
  contactIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  contactText: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 1,
  },
  contactVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.darkText,
    lineHeight: 16,
  },
  locationActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 7 },
  locationAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3 },
  locationActionText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  locationModalBackdrop: { flex: 1, backgroundColor: 'rgba(24,32,44,0.48)', justifyContent: 'center', padding: 22 },
  locationModalCard: { backgroundColor: colors.white, borderRadius: 18, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 8 },
  locationModalTitle: { color: colors.darkText, fontSize: 18, fontWeight: '800' },
  locationModalHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 14 },
  locationInput: { minHeight: 76, borderColor: colors.border, borderWidth: 1, borderRadius: 11, padding: 12, color: colors.darkText, textAlignVertical: 'top', fontSize: 14 },
  locationError: { color: '#B42318', fontSize: 12, marginTop: 8 },
  locationModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  locationCancel: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10, backgroundColor: '#F3F5F7' },
  locationCancelText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  locationSave: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, backgroundColor: colors.primary },
  locationSaveText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  contactDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
    marginLeft: 38,
  },
  bioSummary: { paddingVertical: 6, paddingLeft: 38 },

  // ── Office Hours ─────────────────────────────────────────────
  manageHoursBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.softCoral,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 2,
  },
  manageHoursText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  hoursCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: spacing.md,
    shadowColor: '#3D2C2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  hoursGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  hoursDayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  hoursDayName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  hoursTime: {
    fontSize: 9,
    color: colors.darkText,
    fontWeight: '500',
    textAlign: 'center',
  },
  hoursDivText: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  hoursClosed: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },

  // ── Edit Profile button ───────────────────────────────────────
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  editProfileBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default ProfileScreen;
