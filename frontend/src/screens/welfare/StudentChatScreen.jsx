import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { welfareChatService } from '../../services/welfareChatService';

const QUICK_RESPONSES = [
  'I am at the Welfare Office right now, please come over.',
  'I am calling you on your phone immediately.',
  'Take deep breaths, you are safe. Let me help you.',
  'Let us schedule an in-person emergency session today.',
];

export default function StudentChatScreen({ route, navigation }) {
  const {
    studentId: paramStudentId,
    conversationId: paramConversationId,
    studentName: paramStudentName = 'Student',
    studentRegNo: paramStudentRegNo,
    studentPhone: paramStudentPhone,
    studentFaculty: paramStudentFaculty,
  } = route.params || {};
  const { user } = useAuth();

  const [studentId, setStudentId] = useState(paramStudentId || '');
  const [studentName, setStudentName] = useState(paramStudentName);
  const [studentRegNo, setStudentRegNo] = useState(paramStudentRegNo || '');
  const [studentPhone, setStudentPhone] = useState(paramStudentPhone || '');
  const [studentFaculty, setStudentFaculty] = useState(paramStudentFaculty || '');

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [studentDetails, setStudentDetails] = useState(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showStudentInfo, setShowStudentInfo] = useState(false);
  const [resolving, setResolving] = useState(false);
  const flatListRef = useRef(null);

  const loadConversation = useCallback(async () => {
    const target = studentId || paramConversationId;
    if (!target) {
      setLoading(false);
      return;
    }
    try {
      const data = await welfareChatService.getConversation(target);
      if (data?.conversation) {
        setConversation(data.conversation);

        const resolvedStudentId = data.conversation.studentId || data.student?.id || data.student?._id;
        if (resolvedStudentId) {
          setStudentId(String(resolvedStudentId));
        }
        if (data.student?.name) {
          setStudentName(data.student.name);
        } else if (data.conversation.studentName) {
          setStudentName(data.conversation.studentName);
        }
        if (data.student?.studentId || data.conversation.studentRegNo) {
          setStudentRegNo(data.student?.studentId || data.conversation.studentRegNo);
        }
        if (data.student?.phone || data.conversation.studentPhone) {
          setStudentPhone(data.student?.phone || data.conversation.studentPhone);
        }
        if (data.student?.faculty || data.conversation.studentFaculty) {
          setStudentFaculty(data.student?.faculty || data.conversation.studentFaculty);
        }

        const rawHistory = data.conversation.chatHistory || [];
        const seen = new Set();
        const uniqueHistory = [];
        for (const item of rawHistory) {
          const key = item.id || item._id;
          if (key && !seen.has(key)) {
            seen.add(key);
            uniqueHistory.push(item);
          } else if (!key) {
            uniqueHistory.push(item);
          }
        }
        setMessages(uniqueHistory);
        if (data.student) setStudentDetails(data.student);
        if (data.conversation.id) {
          welfareChatService.markConversationRead(data.conversation.id);
        }
      }
    } catch (err) {
      console.warn('Error loading student conversation:', err.message);
    } finally {
      setLoading(false);
    }
  }, [studentId, paramConversationId]);

  useEffect(() => {
    loadConversation();

    // ── Real-Time Sockets ────────────────────────────────────────────────────
    const unsubNewMsg = welfareChatService.onNewMessage((payload) => {
      if (payload?.message) {
        const incomingId = payload.message.id || payload.message._id;
        setMessages((prev) => {
          if (incomingId && prev.some((m) => m.id === incomingId || m._id === incomingId)) {
            return prev;
          }
          return [...prev, payload.message];
        });
        if (payload.isEmergency) {
          setConversation((prev) => (prev ? { ...prev, isEmergency: true } : prev));
        }
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
      }
    });

    const unsubResolved = welfareChatService.onEmergencyResolved(() => {
      setConversation((prev) => (prev ? { ...prev, isEmergency: false } : prev));
    });

    return () => {
      if (unsubNewMsg) unsubNewMsg();
      if (unsubResolved) unsubResolved();
    };
  }, [loadConversation]);

  const handleCall = () => {
    const phone = studentPhone || studentDetails?.phone || conversation?.studentPhone;
    if (!phone) {
      Alert.alert('Phone Not Available', 'Student has not registered a contact phone number.');
      return;
    }
    const cleaned = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      Alert.alert('Call Failed', `Could not dial ${phone}`);
    });
  };

  const handleSendMessage = async (textToSendOverride) => {
    const textToSend = (textToSendOverride || inputText).trim();
    if (!textToSend || sending) return;

    const targetStudentId = studentId || conversation?.studentId || paramConversationId;
    if (!targetStudentId) {
      Alert.alert('Unable to Send', 'Could not locate the student for this conversation.');
      return;
    }

    setSending(true);
    setInputText('');

    try {
      const res = await welfareChatService.sendMessage(targetStudentId, {
        text: textToSend,
        isEmergency: false,
      });

      if (res?.data) {
        const sentId = res.data.id || res.data._id;
        setMessages((prev) => {
          if (sentId && prev.some((m) => m.id === sentId || m._id === sentId)) {
            return prev;
          }
          return [...prev, res.data];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (err) {
      Alert.alert('Message Failed', err.response?.data?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const handleResolveEmergency = () => {
    Alert.prompt
      ? Alert.prompt(
          'Resolve Emergency',
          'Add triage resolution note for this student crisis:',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Resolve',
              onPress: async (notes) => {
                await executeResolve(notes || 'Handled by on-duty welfare officer');
              },
            },
          ],
          'plain-text',
          'Crisis de-escalated and student contacted'
        )
      : Alert.alert(
          'Resolve Emergency',
          'Mark this active crisis as resolved? The student will be notified.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Yes, Resolve',
              onPress: async () => {
                await executeResolve('Emergency handled and student contacted');
              },
            },
          ]
        );
  };

  const executeResolve = async (notes) => {
    if (!conversation?.id) return;
    setResolving(true);
    try {
      await welfareChatService.resolveEmergencyAlert(conversation.id, notes);
      setConversation((prev) => (prev ? { ...prev, isEmergency: false } : prev));
      Alert.alert('✅ Emergency Resolved', 'The emergency status has been updated and student notified.');
      loadConversation();
    } catch (err) {
      Alert.alert('Resolve Failed', err.response?.data?.message || 'Could not resolve emergency.');
    } finally {
      setResolving(false);
    }
  };

  const isEmergency = Boolean(conversation?.isEmergency);

  const renderMessageItem = ({ item }) => {
    const isOfficer = item.senderRole === 'welfare';
    const isSos = item.isEmergency;

    return (
      <View style={[styles.msgRow, isOfficer ? styles.msgRowRight : styles.msgRowLeft]}>
        <View
          style={[
            styles.bubble,
            isOfficer ? styles.bubbleRight : styles.bubbleLeft,
            isSos && styles.bubbleEmergency,
          ]}
        >
          {isSos && (
            <View style={styles.emergencyTagBadge}>
              <Ionicons name="warning" size={13} color="#FFFFFF" />
              <Text style={styles.emergencyTagText}>STUDENT EMERGENCY SOS</Text>
            </View>
          )}

          <Text
            style={[
              styles.bubbleText,
              isOfficer ? styles.bubbleTextRight : styles.bubbleTextLeft,
              isSos && styles.bubbleTextEmergency,
            ]}
          >
            {item.text}
          </Text>

          <Text
            style={[
              styles.bubbleTime,
              isOfficer ? styles.bubbleTimeRight : styles.bubbleTimeLeft,
              isSos && { color: '#FFE0DC' },
            ]}
          >
            {item.timestamp
              ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => setShowStudentInfo(!showStudentInfo)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.studentName} numberOfLines={1}>{studentName}</Text>
            <Feather name={showStudentInfo ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          </View>
          <Text style={styles.studentSub}>
            {studentRegNo || studentDetails?.studentId || 'Student'} • Tap for details
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.callButton} onPress={handleCall} activeOpacity={0.8}>
          <Ionicons name="call" size={17} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Active Crisis Triage Bar ─────────────────────────────────────────── */}
      {isEmergency && (
        <View style={styles.emergencyBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="warning" size={20} color="#C0392B" />
            <Text style={styles.emergencyBarTitle}>ACTIVE CRISIS ALERT</Text>
          </View>
          <Text style={styles.emergencyBarText}>
            Student reported an acute emergency. Respond promptly and prioritize intervention.
          </Text>

          <View style={styles.emergencyActionRow}>
            <TouchableOpacity style={styles.emergencyCallBtn} onPress={handleCall} activeOpacity={0.85}>
              <Ionicons name="call" size={14} color="#FFFFFF" />
              <Text style={styles.emergencyCallText}>Call Student Phone</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resolveBtn}
              onPress={handleResolveEmergency}
              disabled={resolving}
              activeOpacity={0.85}
            >
              {resolving ? (
                <ActivityIndicator size="small" color="#27AE60" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={14} color="#27AE60" />
                  <Text style={styles.resolveText}>Resolve Crisis</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Student Academic Profile Sheet (Collapsible) ──────────────────────── */}
      {showStudentInfo && (
        <View style={styles.studentInfoCard}>
          <Text style={styles.infoTitle}>Student Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>REGISTRATION NO:</Text>
            <Text style={styles.infoValue}>{studentRegNo || studentDetails?.studentId || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>FACULTY:</Text>
            <Text style={styles.infoValue}>{studentFaculty || studentDetails?.faculty || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PROGRAMME:</Text>
            <Text style={styles.infoValue}>{studentDetails?.degreeProgram || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PHONE NUMBER:</Text>
            <Text style={styles.infoValue}>{studentPhone || studentDetails?.phone || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>EMAIL:</Text>
            <Text style={styles.infoValue}>{studentDetails?.email || 'N/A'}</Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading conversation...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => `${item.id || item._id || 'msg'}-${index}`}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedRose} />
                <Text style={styles.emptyTitle}>Direct Student Channel</Text>
                <Text style={styles.emptySub}>
                  Send your reply to {studentName}. You can also use quick responses below.
                </Text>
              </View>
            }
          />
        )}

        {/* ── Quick Responses Bar ──────────────────────────────────────────────── */}
        <View style={styles.quickBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {QUICK_RESPONSES.map((chip, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickChip}
                onPress={() => handleSendMessage(chip)}
                activeOpacity={0.8}
              >
                <Text style={styles.quickChipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Input Bar ─────────────────────────────────────────────────────────── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Reply to student..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={(t) => {
              setInputText(t);
              welfareChatService.emitTyping(studentId, t.length > 0, conversation?.id);
            }}
            multiline
            maxLength={2000}
          />

          <TouchableOpacity
            style={[styles.sendButton, inputText.trim().length === 0 && styles.sendButtonDisabled]}
            onPress={() => handleSendMessage()}
            disabled={inputText.trim().length === 0 || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={17} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.creamBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.creamBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1, marginLeft: 12 },
  studentName: { fontSize: 16, fontWeight: '800', color: colors.darkText },
  studentSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27AE60',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyBar: {
    backgroundColor: '#FDEAE8',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8C8C2',
  },
  emergencyBarTitle: { fontSize: 12.5, fontWeight: '900', color: '#C0392B' },
  emergencyBarText: { fontSize: 11.5, color: '#684542', lineHeight: 16, marginBottom: 10 },
  emergencyActionRow: { flexDirection: 'row', gap: 10 },
  emergencyCallBtn: {
    flex: 1,
    backgroundColor: '#C0392B',
    borderRadius: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emergencyCallText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  resolveBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27AE60',
    gap: 6,
  },
  resolveText: { color: '#27AE60', fontSize: 12, fontWeight: '700' },
  studentInfoCard: {
    backgroundColor: colors.white,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoTitle: { fontSize: 12, fontWeight: '800', color: colors.darkText, marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  infoLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  infoValue: { fontSize: 11, color: colors.darkText, fontWeight: '600' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: colors.textSecondary },
  messagesList: { padding: 16, paddingBottom: 20 },
  emptyBox: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.darkText },
  emptySub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 17 },
  msgRow: { marginVertical: 4, flexDirection: 'row' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleRight: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleLeft: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#EFE7E2',
  },
  bubbleEmergency: {
    backgroundColor: '#C0392B',
    borderWidth: 1,
    borderColor: '#A93226',
  },
  emergencyTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
    gap: 4,
  },
  emergencyTagText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextRight: { color: '#FFFFFF' },
  bubbleTextLeft: { color: colors.darkText },
  bubbleTextEmergency: { color: '#FFFFFF', fontWeight: '700' },
  bubbleTime: { fontSize: 9.5, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeRight: { color: 'rgba(255,255,255,0.75)' },
  bubbleTimeLeft: { color: colors.textMuted },
  quickBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAF5F1',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickChip: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFE5DD',
  },
  quickChipText: { fontSize: 11, color: colors.darkText, fontWeight: '500' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.creamBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
});
