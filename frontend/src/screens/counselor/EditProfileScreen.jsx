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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography } from '../../theme';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import ImagePlaceholder from '../../components/common/ImagePlaceholder';
import { counselorService } from '../../services/counselorService';

const EditProfileScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [qualification, setQualification] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [clinicalFocusText, setClinicalFocusText] = useState('');
  const [officeLocation, setOfficeLocation] = useState('');
  const [email, setEmail] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const data = await counselorService.getCounselorProfile();
    if (data) {
      setName(data.name || '');
      setQualification(data.qualification || '');
      setSpecialization(data.specialization || '');
      setClinicalFocusText(data.clinicalFocus ? data.clinicalFocus.join(', ') : '');
      setOfficeLocation(data.officeLocation || '');
      setEmail(data.email || '');
      setProfileImage(data.profileImage || '');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Full name is required.');
      return;
    }
    if (!qualification.trim()) {
      Alert.alert('Validation Error', 'Qualification is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation Error', 'A valid contact email is required.');
      return;
    }

    setIsSaving(true);

    const focusArray = clinicalFocusText
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const updatedData = {
      name: name.trim(),
      qualification: qualification.trim(),
      specialization: specialization.trim(),
      clinicalFocus: focusArray.length > 0 ? focusArray : ['Academic Burnout', 'Anxiety Disorder'],
      officeLocation: officeLocation.trim(),
      email: email.trim(),
      profileImage,
    };

    try {
      await counselorService.updateCounselorProfile(updatedData);
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Save failed', error.response?.data?.message || 'Could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const applyImageFile = (file) => {
    if (!file || !file.type?.startsWith('image/')) {
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.creamBackground} />
      
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.avatarCard}>
          <TouchableOpacity
            style={styles.photoDropZone}
            onPress={handlePickImage}
            onDrop={Platform.OS === 'web' ? handleWebDrop : undefined}
            onDragOver={Platform.OS === 'web' ? (event) => event.preventDefault?.() : undefined}
            activeOpacity={0.8}
            accessibilityLabel="Upload a profile picture"
          >
            <ImagePlaceholder
              source={profileImage ? { uri: profileImage } : undefined}
              initials={name ? name.substring(0, 2) : 'EM'}
              size={74}
              backgroundColor={colors.softCoral}
              textColor={colors.primary}
            />
            <Text style={styles.photoActionText}>{profileImage ? 'Replace photo' : 'Upload profile photo'}</Text>
            <Text style={styles.photoHint}>{Platform.OS === 'web' ? 'Click to choose or drag and drop an image here' : 'Choose an image from your photo library'}</Text>
          </TouchableOpacity>
          {!!profileImage && <TouchableOpacity onPress={() => setProfileImage('')}><Text style={styles.removePhotoText}>Remove photo</Text></TouchableOpacity>}
          {!!photoError && <Text style={styles.photoError}>{photoError}</Text>}
        </Card>

        <Card style={styles.formCard}>
          <Input
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Dr. Evelyn Martinez, PhD"
          />

          <Input
            label="Qualification"
            value={qualification}
            onChangeText={setQualification}
            placeholder="PhD in Clinical Psychology, Stanford"
          />

          <Input
            label="Specialization"
            value={specialization}
            onChangeText={setSpecialization}
            placeholder="Cognitive Behavioral Therapy (CBT)"
          />

          <Input
            label="Clinical Focus Areas (comma-separated)"
            value={clinicalFocusText}
            onChangeText={setClinicalFocusText}
            placeholder="Academic Burnout, ADHD Management, Anxiety Disorder"
          />

          <Input
            label="Office Location"
            value={officeLocation}
            onChangeText={setOfficeLocation}
            placeholder="Clinic Hall B, Room 302"
          />

          <Input
            label="Contact Email"
            value={email}
            onChangeText={setEmail}
            placeholder="e.martinez@university.edu"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityLabel="Save Changes"
          >
            <Text style={styles.saveBtnText}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.creamBackground
  },
  container: {
    flex: 1,
    backgroundColor: colors.creamBackground
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.creamBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backBtn: {
    padding: spacing.xs
  },
  backBtnText: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: 'bold'
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.darkText
  },
  avatarCard: {
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    marginBottom: spacing.md
  },
  photoDropZone: {
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: '#FFF8F5',
  },
  photoActionText: {
    color: colors.primary,
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
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.lg
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing.md
  },
  saveBtnText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  }
});

export default EditProfileScreen;
