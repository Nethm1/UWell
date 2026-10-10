import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, typography } from '../../theme';
import ImagePlaceholder from '../../components/common/ImagePlaceholder';
import { counselorService } from '../../services/counselorService';
import { studentService } from '../../services/studentService';
import { useAuth } from '../../context/AuthContext';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = [
  'application/pdf', 'text/plain', 'text/csv', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const MIME_BY_EXTENSION = {
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
};
const ACCEPTED_ATTACHMENT_TYPES = new Set([
  ...ACCEPTED_DOCUMENT_TYPES, 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);

const showError = (message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
  else Alert.alert('Attachment unavailable', message);
};

const StudentChatScreen = ({ route, navigation }) => {
  const { isStudent } = useAuth();
  const studentId = route?.params?.studentId;
  const counselorId = route?.params?.counselorId;
  const [studentName, setStudentName] = useState(route?.params?.studentName || route?.params?.counselorName || 'Counselor');

  const [chatData, setChatData] = useState(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    loadChat();
  }, [studentId, counselorId, isStudent]);

  const loadChat = async () => {
    try {
      setError('');
      const data = isStudent
        ? await studentService.getCounselorConversation(counselorId)
        : await counselorService.getMessageByStudentId(studentId);
      setChatData(data);
      if (isStudent && data?.counselorName) setStudentName(data.counselorName);
      if (!isStudent && data?.studentName) setStudentName(data.studentName);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load this conversation.');
    } finally {
      setLoading(false);
    }
  };

  const toUploadAttachment = async (asset, fileData) => {
    if (!asset?.uri) return null;
    const assetType = String(asset.mimeType || asset.type || '').toLowerCase();
    const extension = String(asset.name || asset.fileName || '').split('.').pop().toLowerCase();
    const normalizedType = assetType.split(';')[0].trim();
    const mimeType = normalizedType === 'image' || normalizedType === 'image/jpg'
      ? (extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg')
      : ((!normalizedType || normalizedType === 'application/octet-stream')
        ? (MIME_BY_EXTENSION[extension] || normalizedType || 'application/octet-stream')
        : normalizedType);
    if (!ACCEPTED_ATTACHMENT_TYPES.has(mimeType)) {
      throw new Error('Choose an image, PDF, or common document file.');
    }
    let base64 = fileData || asset.base64;
    if (!base64) base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    // Expo's web document picker returns a complete data URL; the API stores raw base64.
    base64 = base64.replace(/^data:[^,]*;base64,/i, '').replace(/\s/g, '');
    const size = asset.fileSize || asset.size || Math.floor(base64.length * 0.75);
    if (size > MAX_ATTACHMENT_BYTES) throw new Error('Files must be 5 MB or smaller.');
    return {
      name: asset.name || asset.fileName || `image-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`,
      mimeType,
      size,
      data: base64,
    };
  };

  const chooseDocument = async () => {
    setAttachmentMenuOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_DOCUMENT_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setUploading(true);
      setAttachment(await toUploadAttachment(result.assets[0]));
    } catch (pickError) {
      showError(pickError.message || 'Could not read this file.');
    } finally {
      setUploading(false);
    }
  };

  const chooseImage = async (camera = false) => {
    setAttachmentMenuOpen(false);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return showError('Allow camera access to capture and send a photo.');
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75, base64: true });
      if (result.canceled || !result.assets?.[0]) return;
      setAttachment(await toUploadAttachment(result.assets[0]));
    } catch (pickError) {
      showError(pickError.message || 'Could not open the camera or photo library.');
    }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !attachment) || sending || !chatData) return;
    const message = { text: inputText.trim(), ...(attachment ? { attachment } : {}) };
    setSending(true);
    try {
      if (isStudent) await studentService.sendCounselorMessage(counselorId, message);
      else await counselorService.sendMessage(studentId, message);
      setInputText('');
      setAttachment(null);
      await loadChat();
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Message could not be sent. Please retry.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
      else Alert.alert('Message not sent', message);
    } finally {
      setSending(false);
    }
  };

  const openAttachment = async (file) => {
    if (!file?.data) return;
    const dataUri = `data:${file.mimeType};base64,${file.data}`;
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(dataUri, '_blank', 'noopener,noreferrer');
        return;
      }
      const path = `${FileSystem.cacheDirectory}${encodeURIComponent(file.name || 'uwell-attachment')}`;
      await FileSystem.writeAsStringAsync(path, file.data, { encoding: FileSystem.EncodingType.Base64 });
      const openUri = Platform.OS === 'android' ? await FileSystem.getContentUriAsync(path) : path;
      await Linking.openURL(openUri);
    } catch {
      showError('This attachment could not be opened on this device.');
    }
  };

  const displayTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const renderBubble = ({ item }) => {
      const isMine = item.sender === (isStudent ? 'student' : 'counselor');
      const attachmentUri = item.attachment?.data && item.attachment.mimeType?.startsWith('image/')
        ? `data:${item.attachment.mimeType};base64,${item.attachment.data}` : null;
    return (
      <View
        style={[
          styles.bubbleWrapper,
          isMine ? styles.counselorWrapper : styles.studentWrapper
        ]}
      >
        <View
          style={[
            styles.bubbleCard,
            isMine ? styles.counselorBubble : styles.studentBubble
          ]}
        >
          {!!item.text && <Text style={[styles.bubbleText, isMine ? styles.counselorText : styles.studentText]}>{item.text}</Text>}
          {item.attachment ? (
            <TouchableOpacity
              style={styles.attachmentCard}
              onPress={() => openAttachment(item.attachment)}
              activeOpacity={0.75}
            >
              {item.attachment.mimeType?.startsWith('image/') && attachmentUri
                ? <Image source={{ uri: attachmentUri }} style={styles.attachmentImage} resizeMode="cover" />
                : <Feather name="file-text" size={22} color={isMine ? '#fff' : colors.primary} />}
              <View style={styles.attachmentTextWrap}>
                <Text numberOfLines={1} style={[styles.attachmentName, isMine && styles.attachmentNameMine]}>{item.attachment.name}</Text>
                <Text style={[styles.attachmentHint, isMine && styles.attachmentNameMine]}>{item.attachment.mimeType === 'application/pdf' ? 'PDF · Tap to open' : 'Attachment · Tap to open'}</Text>
              </View>
            </TouchableOpacity>
          ) : null}
          <Text
            style={[
              styles.timeText,
              isMine ? styles.counselorTimeText : styles.studentTimeText
            ]}
          >
            {displayTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.creamBackground} />
      {/* Top Navigation Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={styles.studentNameText}>{studentName}</Text>
          <View style={styles.statusOnlineRow}>
            <Ionicons name="lock-closed" size={10} color="#3973B9" style={{ marginRight: 4 }} />
            <Text style={styles.onlineText}>{isStudent ? 'Private chat · your counselor' : 'Private chat · booked student'}</Text>
          </View>
        </View>

        <ImagePlaceholder
          initials={isStudent ? (chatData?.counselorAvatarInitials || studentName.substring(0, 2)) : (chatData?.avatarInitials || studentName.substring(0, 2))}
          size={36}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {error ? (
          <View style={styles.emptyConversation}>
            <Text style={styles.emptyTitle}>Conversation unavailable</Text>
            <Text style={styles.emptyDescription}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadChat}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.emptyConversation}><ActivityIndicator color={colors.primary} /><Text style={styles.emptyDescription}>Opening private chat…</Text></View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={chatData?.chatHistory || []}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={renderBubble}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<View style={styles.chatEmpty}><Text style={styles.chatEmptyText}>This is a private conversation with {studentName}. Say hello when you’re ready.</Text></View>}
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          {attachmentMenuOpen && (
            <View style={styles.attachmentMenu}>
              <TouchableOpacity style={styles.attachmentOption} onPress={() => chooseImage(false)}><Feather name="image" size={17} color={colors.primary} /><Text style={styles.attachmentOptionText}>Photos</Text></TouchableOpacity>
              <TouchableOpacity style={styles.attachmentOption} onPress={() => chooseImage(true)}><Feather name="camera" size={17} color={colors.primary} /><Text style={styles.attachmentOptionText}>Camera</Text></TouchableOpacity>
              <TouchableOpacity style={styles.attachmentOption} onPress={chooseDocument}><Feather name="file" size={17} color={colors.primary} /><Text style={styles.attachmentOptionText}>Files</Text></TouchableOpacity>
            </View>
          )}
          {attachment && (
            <View style={styles.pendingAttachment}>
              <Feather name={attachment.mimeType.startsWith('image/') ? 'image' : 'file-text'} size={16} color={colors.primary} />
              <Text numberOfLines={1} style={styles.pendingAttachmentText}>{attachment.name}</Text>
              <TouchableOpacity onPress={() => setAttachment(null)} accessibilityLabel="Remove attachment"><Ionicons name="close-circle" size={19} color={colors.textSecondary} /></TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.attachBtn} onPress={() => setAttachmentMenuOpen((open) => !open)} accessibilityLabel="Choose photo, camera, or file" disabled={loading || !!error || !chatData}>
              {uploading ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="paperclip" size={20} color={colors.primary} />}
            </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder={chatData ? 'Write a supportive reply…' : 'Open a booked student chat to reply'}
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            editable={!loading && !error && !!chatData && !sending && !uploading}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              ((!inputText.trim() && !attachment) || sending || uploading || !chatData || !!error) && styles.sendBtnDisabled
            ]}
            onPress={handleSend}
            disabled={(!inputText.trim() && !attachment) || sending || uploading || !chatData || !!error}
            accessibilityLabel="Send message"
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
          </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.creamBackground
  },
  keyboardContainer: {
    flex: 1
  },
  emptyConversation: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyTitle: { color: colors.darkText, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyDescription: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7 },
  retryButton: { backgroundColor: colors.primary, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 10, marginTop: 12 },
  retryText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  chatEmpty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  chatEmptyText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
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
  headerTitleCol: {
    alignItems: 'center'
  },
  studentNameText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.darkText
  },
  statusOnlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.statusGreenText,
    marginRight: 4
  },
  onlineText: {
    fontSize: typography.fontSize.xs - 1,
    color: colors.statusGreenText,
    fontWeight: typography.fontWeight.medium
  },
  chatContent: {
    padding: spacing.md,
    paddingBottom: spacing.md
  },
  bubbleWrapper: {
    marginBottom: spacing.md,
    maxWidth: '80%'
  },
  counselorWrapper: {
    alignSelf: 'flex-end'
  },
  studentWrapper: {
    alignSelf: 'flex-start'
  },
  bubbleCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 16
  },
  counselorBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 2
  },
  studentBubble: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 2
  },
  bubbleText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20
  },
  counselorText: {
    color: colors.white
  },
  studentText: {
    color: colors.darkText
  },
  timeText: {
    fontSize: typography.fontSize.xs - 2,
    marginTop: 4,
    textAlign: 'right'
  },
  counselorTimeText: {
    color: 'rgba(255, 255, 255, 0.8)'
  },
  studentTimeText: {
    color: colors.textSecondary
  },
  inputContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  attachBtn: {
    minWidth: 38,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  inputRow: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  attachIcon: {
    fontSize: 20
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.creamBackground,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    fontSize: typography.fontSize.sm,
    color: colors.darkText,
    maxHeight: 80
  },
  sendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
    borderRadius: 20,
    marginLeft: spacing.xs
  },
  sendBtnDisabled: {
    opacity: 0.5
  },
  sendBtnText: {
    color: colors.white,
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.bold
  },
  attachmentMenu: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, marginBottom: 7, backgroundColor: colors.creamBackground, borderRadius: 14 },
  attachmentOption: { minWidth: 86, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  attachmentOptionText: { color: colors.darkText, fontSize: 12, fontWeight: '600' },
  pendingAttachment: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.creamBackground, marginBottom: 7 },
  pendingAttachmentText: { flex: 1, color: colors.darkText, fontSize: 12 },
  attachmentCard: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 170, maxWidth: 250, padding: 8, marginTop: 5, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.18)' },
  attachmentImage: { width: 46, height: 46, borderRadius: 8 },
  attachmentTextWrap: { flex: 1, minWidth: 0 },
  attachmentName: { color: colors.darkText, fontSize: 12, fontWeight: '700' },
  attachmentNameMine: { color: '#fff' },
  attachmentHint: { color: colors.textSecondary, fontSize: 10, marginTop: 2 },
});

export default StudentChatScreen;
