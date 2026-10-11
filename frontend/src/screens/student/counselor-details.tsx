import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { studentService } from '../../services/studentService';
import { connectSocket } from '../../services/socketService';

type CounselorData = {
  _id?: string;
  name: string;
  specialization: string;
  experience: string;
  qualification: string;
  bio?: string;
  availability: string;
  avatarInitials?: string;
  profileImage?: string;
  officeLocation?: string;
  phone?: string;
  email?: string;
};

export default function CounselorDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as { counselorId?: string } || {};
  const { counselorId } = params;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CounselorData | null>(null);
  const [error, setError] = useState(false);
  const [counselorOnline, setCounselorOnline] = useState<boolean | null>(null);

  useEffect(() => {
    // counselorId must be a valid ObjectId — never fall back to 'c1'
    if (!counselorId) {
      setError(true);
      setLoading(false);
      return;
    }
    let active = true;
    studentService
      .getCounselorById(String(counselorId))
      .then((res: any) => {
        if (active) {
          const data = res?.data || res;
          setProfile(data || null);
          if (!data) setError(true);
        }
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [counselorId]);

  useEffect(() => {
    if (!counselorId) return undefined;
    const socket = connectSocket();
    const fallbackTimer = setTimeout(() => setCounselorOnline(false), 7000);
    const checkAvailability = () => socket.emit('check-user-online', { userId: String(counselorId), role: 'counselor' }, (result: { online?: boolean }) => {
      clearTimeout(fallbackTimer);
      setCounselorOnline(!!result?.online);
    });
    const onDisconnect = () => {
      clearTimeout(fallbackTimer);
      setCounselorOnline(false);
    };
    const onAvailability = (data: { counselorId?: string; available?: boolean }) => {
      if (String(data?.counselorId) === String(counselorId)) setCounselorOnline(!!data.available);
    };
    socket.on('connect', checkAvailability);
    socket.on('disconnect', onDisconnect);
    socket.on('counselor-call-availability', onAvailability);
    if (socket.connected) checkAvailability();
    return () => {
      clearTimeout(fallbackTimer);
      socket.off('connect', checkAvailability);
      socket.off('disconnect', onDisconnect);
      socket.off('counselor-call-availability', onAvailability);
    };
  }, [counselorId]);

  const handleViewAvailability = () => {
    navigation.navigate('Availability', {
      counselorId,
      counselorName:           profile?.name           || 'Counselor',
      counselorSpecialization: profile?.specialization || '',
      counselorExperience:     profile?.experience     || '',
    });
  };

  const handleMessageCounselor = () => {
    navigation.navigate('StudentChat', {
      counselorId,
      counselorName: profile?.name || 'Counselor',
    });
  };

  const handleVideoCounselor = () => {
    navigation.navigate('CallRequest', {
      counselorId: String(counselorId),
      counselorName: profile?.name || 'Counselor',
    });
  };

  const handleCallCounselor = () => {
    const phone = (profile?.phone || '').replace(/[^\d+]/g, '');
    if (!phone) {
      Alert.alert('No phone number', 'This counselor does not have a phone number listed.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Cannot dial', 'Your device could not open the phone dialer.'),
    );
  };

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#EF806B" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error / not found ──
  if (error || !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>Could not load counselor details.</Text>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Derive initials from name if avatarInitials missing
  const initials = profile.avatarInitials ||
    profile.name.split(' ').map((p: string) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >

        {/* Back */}
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        {/* Profile Header */}
        <View style={styles.profileSection}>
          <View style={styles.profileCircle}>
            {profile.profileImage ? (
              <Image
                source={{ uri: profile.profileImage }}
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.profileInitials}>{initials}</Text>
            )}
          </View>

          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.specialization}>{profile.specialization}</Text>

          <View style={styles.availableRow}>
            <View style={styles.availableDot} />
            <Text style={styles.availableText}>{profile.availability}</Text>
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>About the Counselor</Text>
        <View style={styles.card}>
          <Text style={styles.bio}>
            {profile.bio || 'Experienced counselor supporting university students with their wellbeing.'}
          </Text>
        </View>

        {/* Professional Details */}
        <Text style={styles.sectionTitle}>Professional Details</Text>
        <View style={styles.card}>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🎓</Text>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Qualification</Text>
              <Text style={styles.detailValue}>{profile.qualification || '—'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>💼</Text>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Experience</Text>
              <Text style={styles.detailValue}>{profile.experience || '—'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🧠</Text>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Specialization</Text>
              <Text style={styles.detailValue}>{profile.specialization}</Text>
            </View>
          </View>

          {!!profile.officeLocation && (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailIcon}>📍</Text>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Office Location</Text>
                  <Text style={styles.detailValue}>{profile.officeLocation}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Support Areas */}
        <Text style={styles.sectionTitle}>Support Areas</Text>
        <View style={styles.supportAreasCard}>
          {[
            'Academic and university-related concerns',
            'Stress and emotional wellbeing',
            'Personal challenges and wellbeing support',
          ].map((area, index, arr) => (
            <View
              key={area}
              style={[styles.supportItem, index === arr.length - 1 && styles.supportItemLast]}
            >
              <Text style={styles.supportBullet}>✓</Text>
              <Text style={styles.supportText}>{area}</Text>
            </View>
          ))}
        </View>

        {/* Confidentiality */}
        <View style={styles.confidentialCard}>
          <Text style={styles.confidentialIcon}>🔒</Text>
          <View style={styles.confidentialContent}>
            <Text style={styles.confidentialTitle}>Confidential Support</Text>
            <Text style={styles.confidentialText}>
              Your counseling information is treated with privacy and confidentiality within UWell.
            </Text>
          </View>
        </View>

        {/* ── Contact & Book Section ── */}
        <Text style={styles.sectionTitle}>Connect with Counselor</Text>
        <View style={styles.contactCard}>
          <View style={styles.presenceRow}>
            <View style={[styles.presenceDot, counselorOnline ? styles.presenceOnline : styles.presenceOffline]} />
            <Text style={styles.presenceText}>
              {counselorOnline === null ? 'Checking availability…' : counselorOnline ? 'Online now' : 'Offline right now'}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.contactRow, counselorOnline === false && styles.contactRowDisabled, pressed && counselorOnline !== false && { opacity: 0.82 }]}
            onPress={handleVideoCounselor}
            disabled={counselorOnline === false}
            accessibilityLabel={counselorOnline ? 'Start video call with counselor' : 'Counselor is offline'}
          >
            <View style={[styles.contactIconBox, { backgroundColor: '#EBF6F0' }]}>
              <Feather name="video" size={19} color="#25835B" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactTitle, counselorOnline === false && styles.disabledText]}>Video Call Counselor</Text>
              <Text style={styles.contactSub}>{counselorOnline === false ? 'The counselor is offline; try messaging instead' : 'Start a live video counseling call'}</Text>
            </View>
            {counselorOnline && <Text style={styles.contactArrow}>›</Text>}
          </Pressable>
          <View style={styles.divider} />
          {/* Message */}
          <Pressable
            style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.82 }]}
            onPress={handleMessageCounselor}
            accessibilityLabel="Message Counselor"
          >
            <View style={[styles.contactIconBox, { backgroundColor: '#FFF0EB' }]}>
              <Text style={styles.contactIcon}>💬</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Message Counselor</Text>
              <Text style={styles.contactSub}>Send a message directly through UWell chat</Text>
            </View>
            <Text style={styles.contactArrow}>›</Text>
          </Pressable>

          <View style={styles.divider} />

          {/* Phone call */}
          <Pressable
            style={({ pressed }) => [
              styles.contactRow,
              !profile?.phone && styles.contactRowDisabled,
              pressed && profile?.phone && { opacity: 0.82 },
            ]}
            onPress={handleCallCounselor}
            disabled={!profile?.phone}
            accessibilityLabel="Call Counselor"
          >
            <View style={[styles.contactIconBox, { backgroundColor: '#EBF3FF' }]}>
              <Text style={styles.contactIcon}>📞</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactTitle, !profile?.phone && styles.disabledText]}>
                Call Counselor
              </Text>
              <Text style={styles.contactSub}>
                {profile?.phone
                  ? `Phone: ${profile.phone}`
                  : 'No phone number on file'}
              </Text>
            </View>
            {!!profile?.phone && <Text style={styles.contactArrow}>›</Text>}
          </Pressable>

          {!!profile?.email && (
            <>
              <View style={styles.divider} />
              <View style={styles.contactRow}>
                <View style={[styles.contactIconBox, { backgroundColor: '#EBF6F0' }]}>
                  <Text style={styles.contactIcon}>✉️</Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactTitle}>Email</Text>
                  <Text style={styles.contactSub}>{profile.email}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Book Appointment */}
        <Pressable style={styles.availabilityButton} onPress={handleViewAvailability}>
          <Text style={styles.availabilityButtonText}>Book an Appointment</Text>
          <Text style={styles.arrow}>→</Text>
        </Pressable>

        {/* Back to Search */}
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Back to Counselors</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF9F3' },

  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  errorText: {
    fontSize: 14,
    color: '#8A7770',
    textAlign: 'center',
    marginBottom: 20,
  },

  container: { paddingHorizontal: 22, paddingBottom: 35 },

  backButton: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 20 },
  backArrow:  { color: '#3B2925', fontSize: 30, lineHeight: 30, marginRight: 5 },
  backText:   { color: '#6F5E58', fontSize: 13 },

  profileSection: { alignItems: 'center', marginBottom: 25 },

  profileCircle: {
    width: 105,
    height: 105,
    borderRadius: 53,
    backgroundColor: '#FCE3DD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    overflow: 'hidden',
  },

  profileInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#EF806B',
    letterSpacing: 1,
  },

  profileImage: {
    width: 105,
    height: 105,
    borderRadius: 53,
  },

  name:           { color: '#3B2925', fontSize: 23, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  specialization: { color: '#EF806B', fontSize: 13, fontWeight: '600', marginBottom: 9, textAlign: 'center' },

  availableRow: { flexDirection: 'row', alignItems: 'center' },
  availableDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#65B87A', marginRight: 6 },
  availableText:{ color: '#65A870', fontSize: 11, fontWeight: '600' },

  sectionTitle: { color: '#3B2925', fontSize: 18, fontWeight: '700', marginBottom: 11, marginTop: 5 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 17,
    borderWidth: 1,
    borderColor: '#F0E2DC',
    marginBottom: 20,
  },

  bio: { color: '#6F5E58', fontSize: 12, lineHeight: 19 },

  detailRow:    { flexDirection: 'row', alignItems: 'center' },
  detailIcon:   { fontSize: 23, marginRight: 12 },
  detailContent:{ flex: 1 },
  detailLabel:  { color: '#9A8982', fontSize: 10, marginBottom: 3 },
  detailValue:  { color: '#4A3833', fontSize: 12, fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#F1E7E2', marginVertical: 13 },

  supportAreasCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 17,
    borderWidth: 1,
    borderColor: '#F0E2DC',
    marginBottom: 20,
  },

  supportItem:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 11 },
  supportItemLast: { marginBottom: 0 },
  supportBullet: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#FCE0D9', color: '#C85F4E',
    textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '700', marginRight: 10,
  },
  supportText: { flex: 1, color: '#6F5E58', fontSize: 11, lineHeight: 18 },

  confidentialCard:   { backgroundColor: '#F5EFE9', borderRadius: 17, padding: 15, flexDirection: 'row', marginBottom: 20 },
  confidentialIcon:   { fontSize: 23, marginRight: 11 },
  confidentialContent:{ flex: 1 },
  confidentialTitle:  { color: '#3B2925', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  confidentialText:   { color: '#806F68', fontSize: 11, lineHeight: 17 },

  messageButton: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#EF806B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  messageButtonText: { color: '#C85F4E', fontSize: 14, fontWeight: '700' },

  availabilityButton: {
    height: 54,
    backgroundColor: '#EF806B',
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  availabilityButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  arrow: { color: '#FFFFFF', fontSize: 21, marginLeft: 9 },

  secondaryButton: {
    height: 48,
    backgroundColor: '#FCE0D9',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { color: '#C85F4E', fontSize: 13, fontWeight: '700' },

  // ── Contact card ──────────────────────────────────────────────────────────
  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    borderColor: '#F0E2DC',
    marginBottom: 20,
  },
  presenceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 11, paddingBottom: 4 },
  presenceDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  presenceOnline: { backgroundColor: '#2EAA68' },
  presenceOffline: { backgroundColor: '#A3A3A3' },
  presenceText: { color: '#748078', fontSize: 11, fontWeight: '600' },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 14,
  },
  contactRowDisabled: { opacity: 0.45 },
  contactIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  contactIcon: { fontSize: 20 },
  contactInfo: { flex: 1 },
  contactTitle: { color: '#3B2925', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  contactSub:   { color: '#8A7770', fontSize: 10, lineHeight: 14 },
  contactArrow: { color: '#C0A79F', fontSize: 20, marginLeft: 6 },
  disabledText: { color: '#B0A09A' },
});
