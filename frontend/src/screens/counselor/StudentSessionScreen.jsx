import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../theme';
import Card from '../../components/common/Card';
import ImagePlaceholder from '../../components/common/ImagePlaceholder';
import { counselorService } from '../../services/counselorService';

const StudentSessionScreen = ({ route, navigation }) => {
  const studentId = route?.params?.studentId || 'stu-1';
  const appointment = route?.params?.appointment || null;
  const [student, setStudent] = useState(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadStudentDetails();
  }, [studentId]);

  const loadStudentDetails = async () => {
    try {
      setLoadError('');
      const data = await counselorService.getStudentById(studentId);
      setStudent(data);
      setSessionNotes(data?.sessionNotesHistory || '');
      setHasUnsavedChanges(false);
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not load this student record.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!hasUnsavedChanges || isSaving) return;
    setIsSaving(true);
    try {
      const updated = await counselorService.saveSessionNotes(studentId, sessionNotes);
      setStudent((prev) => prev ? { ...prev, sessionNotesHistory: updated.sessionNotesHistory ?? sessionNotes } : prev);
      setHasUnsavedChanges(false);
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert('Private session notes saved.');
      else Alert.alert('Saved', 'Private session notes saved successfully.');
    } catch (error) {
      const message = error.response?.data?.message || 'Could not save notes. Please try again.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <View style={styles.loadingState}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading student record…</Text></View>;
  }
  if (!student) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.unavailableState}>
          <Text style={styles.unavailableTitle}>Student record unavailable</Text>
          <Text style={styles.unavailableText}>{loadError || 'This student may not be linked to your account.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadStudentDetails}><Text style={styles.retryButtonText}>Try again</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const studentPhone = (student.phone || '').replace(/[^\d+]/g, '');
  const hasPhone = studentPhone.length > 0;

  const isOnlineSession = appointment?.sessionType === 'Online';

  const handleStartCall = () => {
    if (isOnlineSession) {
      // Navigate to real video session screen
      navigation.navigate('VideoSession', {
        appointmentId: appointment?.id || appointment?._id || '',
        studentId:     student.sourceStudentId || student.id || student._id || '',
        studentName:   student.name,
        date:          appointment?.date || '',
        time:          appointment?.time || '',
      });
      return;
    }
    // In Person or Phone — dial student directly
    if (!hasPhone) {
      Alert.alert(
        'No number on file',
        'This student does not have a mobile number saved in their profile.'
      );
      return;
    }
    Linking.openURL(`tel:${studentPhone}`).catch(() =>
      Alert.alert('Unable to start call', 'Your device could not open the phone dialer.')
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.creamBackground} />
      {/* Header bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Card style={styles.profileHeaderCard}>
          <ImagePlaceholder
            initials={student.avatarInitials || student.name.substring(0, 2)}
            size={64}
          />
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentSub}>{student.yearCourse}</Text>
          <Text style={styles.sessionBadge}>
            {student.sessionsCompleted} Sessions Completed
          </Text>
        </Card>

        {/* Confidentiality Notice */}
        <View style={styles.confidentialityBanner}>
          <Text style={styles.confidentialityText}>
            🔒 All session information is strictly confidential.
          </Text>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.primaryActionBtn, styles.videoBtn, !isOnlineSession && !hasPhone && styles.disabledActionBtn]}
            onPress={handleStartCall}
            disabled={!isOnlineSession && !hasPhone}
            accessibilityLabel={isOnlineSession ? 'Start Video Session' : 'Start Call Session'}
          >
            <Text style={[styles.videoBtnText, !isOnlineSession && !hasPhone && styles.disabledActionBtnText]}>
              {isOnlineSession ? '🎥 Start Video Session' : '📞 Start Call Session'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryActionBtn, styles.messageBtn]}
            onPress={() => navigation.getParent()?.navigate('Messages', {
              screen: 'StudentChat',
              params: { studentId: student.id, studentName: student.name },
            })}
            accessibilityLabel="Message Student"
          >
            <Text style={styles.messageBtnText}>💬 Message Student</Text>
          </TouchableOpacity>
        </View>

        {!isOnlineSession && !hasPhone && (
          <Text style={styles.noPhoneText}>
            No phone number on file for this student.
          </Text>
        )}

        {/* Weekly Mood History Chart */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>WEEKLY MOOD CHECK-IN HISTORY</Text>
        </View>

        <Card style={styles.chartCard}>
          <View style={styles.chartContainer}>
            {student.moodHistory?.map((item, idx) => (
              <View key={idx} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${(item.level / 5) * 100}%` }
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{item.day}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Active Treatment Notes */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ACTIVE TREATMENT NOTES</Text>
        </View>
        <Card style={styles.treatmentCard}>
          <Text style={styles.treatmentSubtitle}>Diagnosis / Clinical Notes:</Text>
          <Text style={styles.treatmentBody}>{student.diagnosisNotes}</Text>
        </Card>

        {/* Private Session Notes Input */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PRIVATE SESSION NOTES</Text>
        </View>
        <Card style={styles.notesCard}>
          <TextInput
            style={styles.notesInput}
            multiline
            numberOfLines={4}
            placeholder="Type confidential session notes here..."
            placeholderTextColor={colors.textSecondary}
            value={sessionNotes}
            onChangeText={(value) => { setSessionNotes(value); setHasUnsavedChanges(true); }}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={styles.saveNotesBtn}
            onPress={handleSaveNotes}
            disabled={isSaving || !hasUnsavedChanges}
            accessibilityLabel="Save Notes"
          >
            <Text style={styles.saveNotesText}>
              {isSaving ? 'Saving…' : hasUnsavedChanges ? 'Save Notes' : 'All changes saved'}
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.creamBackground,
  },
  loadingText: { marginTop: 10, color: colors.textSecondary, fontSize: 13 },
  unavailableState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.creamBackground },
  unavailableTitle: { fontSize: 18, fontWeight: '700', color: colors.darkText, textAlign: 'center' },
  unavailableText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 7, lineHeight: 19 },
  retryButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 16 },
  retryButtonText: { color: colors.white, fontSize: 13, fontWeight: '700' },
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
  profileHeaderCard: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.white,
    marginBottom: spacing.sm
  },
  studentName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.darkText,
    marginTop: spacing.xs
  },
  studentSub: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2
  },
  sessionBadge: {
    fontSize: typography.fontSize.xs,
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
    backgroundColor: colors.softCoral,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: spacing.xs
  },
  confidentialityBanner: {
    backgroundColor: colors.statusYellowBg,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.md,
    alignItems: 'center'
  },
  confidentialityText: {
    fontSize: typography.fontSize.xs,
    color: colors.statusYellowText,
    fontWeight: typography.fontWeight.medium
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  primaryActionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  videoBtn: {
    backgroundColor: colors.primary
  },
  videoBtnText: {
    color: colors.white,
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.bold
  },
  disabledActionBtn: {
    backgroundColor: colors.border,
    opacity: 0.7
  },
  disabledActionBtnText: {
    color: colors.textSecondary
  },
  noPhoneText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: -spacing.xs,
    marginBottom: spacing.md
  },
  messageBtn: {
    backgroundColor: colors.softCoral,
    borderWidth: 1,
    borderColor: colors.border
  },
  messageBtnText: {
    color: colors.darkText,
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.bold
  },
  sectionHeader: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
    letterSpacing: 1
  },
  chartCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
    paddingTop: spacing.xs
  },
  barCol: {
    alignItems: 'center',
    flex: 1
  },
  barTrack: {
    height: 70,
    width: 14,
    backgroundColor: colors.softCoral,
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  barFill: {
    backgroundColor: colors.primary,
    borderRadius: 7
  },
  barLabel: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.textSecondary,
    marginTop: 6
  },
  treatmentCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  treatmentSubtitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginBottom: 4
  },
  treatmentBody: {
    fontSize: typography.fontSize.sm,
    color: colors.darkText,
    lineHeight: 20
  },
  notesCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.lg
  },
  notesInput: {
    backgroundColor: colors.creamBackground,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.darkText,
    minHeight: 90,
    marginBottom: spacing.sm
  },
  saveNotesBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center'
  },
  saveNotesText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold
  }
});

export default StudentSessionScreen;
