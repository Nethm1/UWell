import React, { useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CounselorBackButton from '../../components/navigation/CounselorBackButton';
import { counselorService } from '../../services/counselorService';

export default function ChangePasswordScreen({ navigation }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError('');
    setSuccess('');
    if (!currentPassword) return setError('Enter your current password.');
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (newPassword === currentPassword) return setError('Choose a password different from your current password.');
    if (newPassword !== confirmPassword) return setError('The new passwords do not match.');
    setSaving(true);
    try {
      const result = await counselorService.changePassword(currentPassword, newPassword);
      setSuccess(result.message || 'Password changed successfully.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not change your password. Please try again.');
    } finally { setSaving(false); }
  };

  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#F8FAFD" />
    <View style={styles.header}>
      <CounselorBackButton navigation={navigation} style={styles.back} />
      <Text style={styles.title}>Change Password</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.subtitle}>Verify your current password, then choose a new one with at least 8 characters.</Text>
      {[[currentPassword, setCurrentPassword, 'Current password'], [newPassword, setNewPassword, 'New password'], [confirmPassword, setConfirmPassword, 'Confirm new password']].map(([value, setter, label]) => <View key={label} style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput value={value} onChangeText={setter} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} accessibilityLabel={label} />
      </View>)}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!success && <Text style={styles.success}>{success}</Text>}
      <TouchableOpacity onPress={submit} disabled={saving} style={styles.submit} accessibilityRole="button">
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Update Password</Text>}
      </TouchableOpacity>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFD' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#EDF1F6', backgroundColor: '#fff' },
  back: { marginRight: 10 }, title: { fontSize: 20, fontWeight: '800', color: '#101B37' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, margin: 16, borderWidth: 1, borderColor: '#EDF1F6' },
  subtitle: { color: '#61728F', fontSize: 13, lineHeight: 19, marginBottom: 18 },
  field: { marginBottom: 14 }, label: { color: '#15213C', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#E1E7EF', borderRadius: 10, paddingHorizontal: 12, color: '#243653', backgroundColor: '#fff' },
  error: { color: '#B42318', fontSize: 12, lineHeight: 18 }, success: { color: '#287A4B', fontSize: 12, lineHeight: 18 },
  submit: { marginTop: 16, minHeight: 48, borderRadius: 10, backgroundColor: '#0865D9', alignItems: 'center', justifyContent: 'center' }, submitText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
