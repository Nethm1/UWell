import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import CounselorBackButton from '../../components/navigation/CounselorBackButton';
import { counselorService } from '../../services/counselorService';

const ITEMS = [
  { label: 'Edit Profile', detail: 'Update your personal information', icon: 'user', screen: 'EditProfile', color: '#0875DA', tint: '#E5F3FF' },
  { label: 'Change Password', detail: 'Keep your account secure', icon: 'lock', screen: 'ChangePassword', color: '#8050C8', tint: '#F0E8FF' },
  { label: 'Notification Settings', detail: 'Upcoming sessions and appointment updates', icon: 'bell', screen: 'CounselorNotifications', color: '#16A779', tint: '#E3F8F0' },
  { label: 'Availability', detail: 'Manage your working hours', icon: 'calendar', screen: 'Availability', root: true, color: '#0875DA', tint: '#E5F3FF' },
  { label: 'Clinical Focus Areas', detail: 'Manage your areas of support', icon: 'heart', screen: 'ClinicalFocusAreas', color: '#D78322', tint: '#FFF2E5' },
  { label: 'Appearance', detail: 'Light / Dark mode, theme', icon: 'sliders', info: 'Appearance preferences are not available yet.', color: '#E34E65', tint: '#FFECEF' },
  { label: 'About UWell', detail: 'App version and information', icon: 'info', info: 'UWell Counselor App\nVersion 1.0.0', color: '#71829D', tint: '#EEF1F5' },
];

export default function CounselorSettingsScreen({ navigation }) {
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadProfile = () => {
      setLoading(true);
      counselorService.getCounselorProfile().then((data) => {
        if (active) { setProfile(data); setError(''); }
      }).catch((e) => {
        if (active) setError(e.response?.data?.message || 'Could not load your profile.');
      }).finally(() => { if (active) setLoading(false); });
    };
    const unsubscribe = navigation.addListener('focus', loadProfile);
    loadProfile();
    return () => { active = false; unsubscribe(); };
  }, [navigation]);

  const openItem = (item) => {
    if (item.info) {
      const show = () => Platform.OS === 'web' && typeof window !== 'undefined' ? window.alert(item.info) : Alert.alert(item.label, item.info);
      show();
    } else if (item.root) navigation.getParent()?.getParent()?.navigate(item.screen);
    else navigation.navigate(item.screen);
  };

  const confirmLogout = () => {
    const doLogout = () => { void logout(); };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to log out?')) doLogout();
      return;
    }
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: doLogout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFD" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <CounselorBackButton navigation={navigation} style={styles.back} />
          <Text style={styles.headingTitle}>Profile Settings</Text>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.identity}>
          <View style={styles.avatarWrap}>{loading ? <ActivityIndicator color="#0875DA" /> : profile?.profileImage ? <Image source={{ uri: profile.profileImage }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitials}>{profile?.avatarInitials || '—'}</Text></View>}</View>
          <Text style={styles.name}>{profile?.name || (error ? 'Profile unavailable' : '')}</Text>
          <Text style={styles.role}>{profile?.title || profile?.specialization || 'Counselor'}</Text>
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>

        <View style={styles.menu}>
          {ITEMS.map((item) => <TouchableOpacity key={item.label} style={styles.menuRow} onPress={() => openItem(item)} accessibilityRole="button">
            <View style={[styles.menuIcon, { backgroundColor: item.tint }]}><Feather name={item.icon} size={19} color={item.color} /></View>
            <View style={styles.menuCopy}><Text style={styles.menuTitle}>{item.label}</Text><Text style={styles.menuDetail}>{item.detail}</Text></View>
            <Feather name="chevron-right" size={19} color="#8290A8" />
          </TouchableOpacity>)}
        </View>

        <TouchableOpacity style={styles.logout} onPress={confirmLogout} accessibilityRole="button">
          <Feather name="log-out" size={19} color="#E13A37" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <View style={{ height: 18 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFD' },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  heading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 34, height: 38 },
  headingTitle: { color: '#101B37', fontSize: 18, fontWeight: '800' },
  identity: { alignItems: 'center', paddingTop: 18, paddingBottom: 22 },
  avatarWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E9F2FC', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 27, fontWeight: '800', color: '#0865D9' },
  name: { color: '#101B37', fontSize: 18, fontWeight: '800', marginTop: 9 },
  role: { color: '#61728F', fontSize: 13, marginTop: 3 },
  error: { color: '#B42318', fontSize: 12, marginTop: 7 },
  menu: { gap: 8 },
  menuRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EFF2F6', shadowColor: '#233B5C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.035, shadowRadius: 5, elevation: 1 },
  menuIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuCopy: { flex: 1 },
  menuTitle: { color: '#101B37', fontSize: 14, fontWeight: '800' },
  menuDetail: { color: '#61728F', fontSize: 11, lineHeight: 16, marginTop: 3 },
  logout: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 13, backgroundColor: '#FFF0F0', marginTop: 18 },
  logoutText: { color: '#E13A37', fontSize: 14, fontWeight: '800' },
});
