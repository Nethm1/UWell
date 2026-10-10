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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import ImagePlaceholder from '../../components/common/ImagePlaceholder';
import { counselorService } from '../../services/counselorService';

const StudentChatScreen = ({ route, navigation }) => {
  const studentId = route?.params?.studentId || 'stu-1';
  const studentName = route?.params?.studentName || 'Sarah Jenkins';

  const [chatData, setChatData] = useState(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    loadChat();
  }, [studentId]);

  const loadChat = async () => {
    try {
      setError('');
      const data = await counselorService.getMessageByStudentId(studentId);
      setChatData(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load this conversation.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending || !chatData) return;
    const textToSend = inputText.trim();
    setSending(true);
    try {
      await counselorService.sendMessage(studentId, textToSend);
      setInputText('');
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

  const displayTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const renderBubble = ({ item }) => {
    const isCounselor = item.sender === 'counselor';
    return (
      <View
        style={[
          styles.bubbleWrapper,
          isCounselor ? styles.counselorWrapper : styles.studentWrapper
        ]}
      >
        <View
          style={[
            styles.bubbleCard,
            isCounselor ? styles.counselorBubble : styles.studentBubble
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              isCounselor ? styles.counselorText : styles.studentText
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              styles.timeText,
              isCounselor ? styles.counselorTimeText : styles.studentTimeText
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
            <Text style={styles.onlineText}>Private chat · booked student</Text>
          </View>
        </View>

        <ImagePlaceholder
          initials={studentName.substring(0, 2)}
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
          <TouchableOpacity style={styles.attachBtn} accessibilityLabel="Attach file">
            <Text style={styles.attachIcon}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder={chatData ? 'Write a supportive reply…' : 'Open a booked student chat to reply'}
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            editable={!loading && !error && !!chatData && !sending}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || sending || !chatData || !!error) && styles.sendBtnDisabled
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending || !chatData || !!error}
            accessibilityLabel="Send message"
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
          </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  attachBtn: {
    padding: spacing.xs,
    marginRight: spacing.xs
  },
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
  }
});

export default StudentChatScreen;
