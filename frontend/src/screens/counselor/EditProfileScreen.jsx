import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import ImagePlaceholder from '../../components/common/ImagePlaceholder';
import CounselorBackButton, { navigateBackSafely } from '../../components/navigation/CounselorBackButton';
import { counselorService } from '../../services/counselorService';
import { useAuth } from '../../context/AuthContext';

const EditProfileScreen = ({ navigation }) => {
  const { updateUser } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [roleTitle, setRoleTitle] = useState('Counselor');
  const [qualification, setQualification] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [clinicalFocusText, setClinicalFocusText] = useState('');
  const [officeLocation, setOfficeLocation] = useState('');
  const [email, setEmail] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await counselorService.getCounselorProfile();
      if (!data) throw new Error('The server returned an empty counselor profile.');
      setName(data.name || '');
      setQualification(data.qualification || '');
      setSpecialization(data.specialization || '');
      setClinicalFocusText(data.clinicalFocus ? data.clinicalFocus.join(', ') : '');
      setOfficeLocation(data.officeLocation || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setRoleTitle(data.title || 'Counselor');
      setProfileImage(data.profileImage || '');
      setBio(data.bio || '');
    } catch (error) {
      setLoadError(error.response?.data?.message || error.message || 'Could not load your profile. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setFormError('');
    setSuccessMessage('');
    if (name.trim().split(/\s+/).filter(Boolean).length < 2) return setFormError('Enter your first and last name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setFormError('Enter a valid email address.');
    if (phone.trim().length < 7 || phone.trim().length > 25) return setFormError('Enter a valid phone number (7–25 characters).');
    if (!qualification.trim()) return setFormError('Qualification is required.');
    if (!specialization.trim()) return setFormError('Specialization is required.');
    if (bio.trim().length > 500) return setFormError('Bio must be 500 characters or fewer.');
    if (photoError) return setFormError(photoError);

    setIsSaving(true);

    const focusArray = clinicalFocusText
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const updatedData = {
      name: name.trim(),
      qualification: qualification.trim(),
      specialization: specialization.trim(),
      clinicalFocus: focusArray,
      officeLocation: officeLocation.trim(),
      email: email.trim(),
      phone: phone.trim(),
      profileImage,
      bio: bio.trim(),
    };

    try {
      const updated = await counselorService.updateCounselorProfile(updatedData);
      await updateUser({ name: updated.name, fullName: updated.name, email: updated.email, phone: updated.phone, profileImage: updated.profileImage });
      setSuccessMessage('Profile updated successfully.');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Profile updated successfully.');
        navigateBackSafely(navigation);
      } else {
        Alert.alert('Success', 'Profile updated successfully.', [{ text: 'OK', onPress: () => navigateBackSafely(navigation) }]);
      }
    } catch (error) {
      setFormError(error.response?.data?.message || 'Could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const applyImageFile = (file) => {
    if (!file || !/^image\/(jpeg|jpg|png|webp)$/i.test(file.type || '')) {
      setPhotoError('Choose an image file in JPG, PNG, or WebP format.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setPhotoError('Choose an image smaller than 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfileImage(typeof reader.result === 'string' ? reader.result : '');
      setPhotoError('');
    };
    reader.onerror = () => setPhotoError('Could not read this image. Please try another file.');
    reader.readAsDataURL(file);
  };

  const handleWebDrop = (event) => {
    event.preventDefault?.();
    const file = event?.nativeEvent?.dataTransfer?.files?.[0] || event?.dataTransfer?.files?.[0];
    applyImageFile(file);
  };

  const handlePickImage = async () => {
    if (Platform.OS === 'web') {
      // Expo opens the browser file chooser here; a photo can also be dropped on the card.
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo permission required', 'Allow photo access to select a profile picture.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 4 * 1024 * 1024) {
      setPhotoError('Choose an image smaller than 4 MB.');
      return;
    }
    if (!asset.base64) {
      setPhotoError('Could not prepare this image. Please choose another one.');
      return;
    }
    setProfileImage(`data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
    setPhotoError('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Top Header */}
      <View style={styles.topHeader}>
        <CounselorBackButton navigation={navigation} style={styles.backBtn} />
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <Card style={styles.formCard}><ActivityIndicator color={colors.primary} /><Text style={styles.feedbackText}>Loading your profile…</Text></Card> : loadError ? <Card style={styles.formCard}><Text style={styles.formError}>{loadError}</Text><TouchableOpacity style={styles.saveBtn} onPress={loadProfile}><Text style={styles.saveBtnText}>Try again</Text></TouchableOpacity></Card> : <>
        <Card style={styles.avatarCard}>
          <TouchableOpacity
            style={styles.photoDropZone}
            onPress={handlePickImage}
            onDrop={Platform.OS === 'web' ? handleWebDrop : undefined}
            onDragOver={Platform.OS === 'web' ? (event) => event.preventDefault?.() : undefined}
            activeOpacity={0.8}
            accessibilityLabel="Upload a profile picture"
          >
            <View style={styles.photoPreviewWrap}>
              <ImagePlaceholder
                source={profileImage ? { uri: profileImage } : undefined}
                initials={name ? name.substring(0, 2) : '—'}
                size={88}
                backgroundColor="#E7F2FE"
                textColor="#0865D9"
              />
              <View style={styles.photoCameraBadge}><Feather name="camera" size={14} color="#fff" /></View>
            </View>
            <Text style={styles.photoActionText}>Change Photo</Text>
            <Text style={styles.photoHint}>{Platform.OS === 'web' ? 'Choose a photo from your device' : 'Choose a photo from your library'}</Text>
          </TouchableOpacity>
          {!!profileImage && <TouchableOpacity onPress={() => setProfileImage('')}><Text style={styles.removePhotoText}>Remove photo</Text></TouchableOpacity>}
          {!!photoError && <Text style={styles.photoError}>{photoError}</Text>}
        </Card>

        <Card style={styles.formCard}>
          <View style={styles.fieldRow}><Feather name="user" size={20} color="#71829D" style={styles.fieldIcon} /><Input
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Dr. Evelyn Martinez, PhD"
          /></View>

          <View style={styles.fieldRow}><Feather name="mail" size={20} color="#71829D" style={styles.fieldIcon} /><Input
            label="Email *"
            value={email}
            onChangeText={setEmail}
            placeholder="name@university.edu"
            keyboardType="email-address"
            autoCapitalize="none"
          /></View>

          <View style={styles.fieldRow}><Feather name="phone" size={20} color="#71829D" style={styles.fieldIcon} /><Input
            label="Phone Number *"
            value={phone}
            onChangeText={setPhone}
            placeholder="+94 76 123 4567"
            keyboardType="phone-pad"
          /></View>

          <View style={styles.fieldRow}><Feather name="briefcase" size={20} color="#71829D" style={styles.fieldIcon} /><View style={styles.roleField}><Text style={styles.roleLabel}>Department / Role</Text><Text style={styles.roleValue}>{roleTitle}</Text></View></View>

          <View style={styles.fieldRow}><Feather name="award" size={20} color="#71829D" style={styles.fieldIcon} /><Input
            label="Qualifications *"
            value={qualification}
            onChangeText={setQualification}
            placeholder="Your counseling qualifications"
          /></View>

          <View style={styles.fieldRow}><Feather name="book-open" size={20} color="#71829D" style={styles.fieldIcon} /><Input
            label="Specialization *"
            value={specialization}
            onChangeText={setSpecialization}
            placeholder="Anxiety & Stress Management"
          /></View>

          <View style={styles.fieldRow}><Feather name="map-pin" size={20} color="#71829D" style={styles.fieldIcon} /><Input
            label="Office Location"
            value={officeLocation}
            onChangeText={setOfficeLocation}
            placeholder="Building, room, or campus address"
          /></View>

          <View style={styles.fieldRow}><Feather name="layers" size={20} color="#71829D" style={styles.fieldIcon} /><Input
            label="Clinical Focus Areas (comma-separated)"
            value={clinicalFocusText}
            onChangeText={setClinicalFocusText}
            placeholder="Academic Burnout, ADHD Management, Anxiety Disorder"
          /></View>

          <View style={styles.bioFieldRow}><Feather name="file-text" size={20} color="#71829D" style={styles.fieldIcon} /><View style={styles.bioField}><Text style={styles.bioLabel}>Bio</Text><TextInput value={bio} onChangeText={setBio} placeholder="A short introduction to your counseling approach" placeholderTextColor="#71829D" style={styles.bioInput} multiline maxLength={500} textAlignVertical="top" accessibilityLabel="Professional bio" /></View></View>
          <Text style={styles.bioCounter}>{bio.length}/500</Text>

          {!!formError && <Text style={styles.formError}>{formError}</Text>}
          {!!successMessage && <Text style={styles.formSuccess}>{successMessage}</Text>}

        </Card>
        </>}
      </ScrollView>
      {!loading && !loadError && <View style={styles.formFooter}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigateBackSafely(navigation)} disabled={isSaving}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.75 }]} onPress={handleSave} disabled={isSaving} accessibilityRole="button" accessibilityLabel="Save Changes">
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFD'
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFD'
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.md
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F6'
  },
  backBtn: {
    padding: spacing.xs
  },
  backBtnText: {
    fontSize: 22,
    color: '#0865D9',
    fontWeight: 'bold'
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#101B37'
  },
  avatarCard: {
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: 'transparent',
    marginBottom: spacing.sm,
    borderWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  photoDropZone: {
    alignItems: 'center',
    width: '100%',
    padding: spacing.sm,
    backgroundColor: 'transparent',
  },
  photoActionText: {
    color: '#0865D9',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
  },
  photoHint: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 17,
  },
  removePhotoText: {
    color: '#B42318',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
  },
  photoError: {
    color: '#B42318',
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderColor: '#EDF1F6',
    borderWidth: 1,
    borderRadius: 16,
  },
  saveBtn: {
    backgroundColor: '#0865D9',
    paddingVertical: 13,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    flex: 1,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  photoPreviewWrap: { position: 'relative', width: 90, height: 90 },
  photoCameraBadge: { position: 'absolute', width: 30, height: 30, borderRadius: 15, right: -2, bottom: 0, backgroundColor: '#0865D9', borderColor: '#fff', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldIcon: { width: 22, textAlign: 'center' },
  roleField: { flex: 1, minHeight: 58, justifyContent: 'center', marginBottom: spacing.md, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#F2F5F8', borderWidth: 1, borderColor: '#E7ECF2' },
  roleLabel: { color: '#15213C', fontSize: 12, fontWeight: '600', marginBottom: 5 },
  roleValue: { color: '#71829D', fontSize: 13 },
  bioFieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 2 },
  bioField: { flex: 1 },
  bioLabel: { fontSize: 12, fontWeight: '600', color: '#15213C', marginBottom: 6 },
  bioInput: { minHeight: 95, borderWidth: 1, borderColor: '#E1E7EF', borderRadius: 9, padding: 11, fontSize: 13, color: '#243653', backgroundColor: '#fff', marginBottom: 4 },
  bioCounter: { textAlign: 'right', color: '#71829D', fontSize: 11, marginBottom: spacing.md },
  formError: { color: '#B42318', fontSize: typography.fontSize.sm, lineHeight: 19, marginTop: spacing.sm },
  formSuccess: { color: '#287A4B', fontSize: typography.fontSize.sm, marginTop: spacing.sm },
  feedbackText: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.md },
  formFooter: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EDF1F6' },
  cancelBtn: { minHeight: 48, flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF1F5' },
  cancelBtnText: { color: '#61728F', fontSize: 14, fontWeight: '800' },
});

export default EditProfileScreen;
