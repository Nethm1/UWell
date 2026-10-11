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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  welfareChatService,
  ChatMessageItem,
  WelfareConversation,
} from '../../services/welfareChatService';

export default function WelfareChatScreen({ route, navigation }: any) {
  const {
    officerId: paramOfficerId,
    conversationId: paramConversationId,
    officerName: paramOfficerName = 'Welfare Officer',
    emergencyPhone: paramEmergencyPhone,
  } = route.params || {};
  const { user } = useAuth();

  const [officerId, setOfficerId] = useState<string>(paramOfficerId || '');
  const [officerName, setOfficerName] = useState<string>(paramOfficerName);
  const [emergencyPhone, setEmergencyPhone] = useState<string>(paramEmergencyPhone || '');
  const [conversation, setConversation] = useState<WelfareConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(false);
  const [officerTyping, setOfficerTyping] = useState<boolean>(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for Emergency SOS mode
  useEffect(() => {
    if (isEmergencyMode) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isEmergencyMode, pulseAnim]);

  const loadConversation = useCallback(async () => {
    const targetId = officerId || paramConversationId;
    if (!targetId) {
      setLoading(false);
      return;
    }
    try {
      const data = await welfareChatService.getConversation(targetId);
      if (data?.conversation) {
        setConversation(data.conversation);
        const resolvedOfficerId = data.conversation.welfareId || data.officer?.id || (data.officer as any)?._id;
        if (resolvedOfficerId) {
          setOfficerId(String(resolvedOfficerId));
        }
        if (data.officer?.name) {
          setOfficerName(data.officer.name);
        } else if (data.conversation.officerName) {
          setOfficerName(data.conversation.officerName);
        }
        if (data.officer?.emergencyContactPhone || data.officer?.phone) {
          setEmergencyPhone(data.officer.emergencyContactPhone || data.officer.phone || '');
        } else if (data.conversation.officerPhone) {
          setEmergencyPhone(data.conversation.officerPhone);
        }

        const rawHistory = data.conversation.chatHistory || [];
        const seen = new Set<string>();
        const uniqueHistory: ChatMessageItem[] = [];
        for (const item of rawHistory) {
          const key = item.id || (item as any)._id;
          if (key && !seen.has(key)) {
            seen.add(key);
            uniqueHistory.push(item);
          } else if (!key) {
            uniqueHistory.push(item);
          }
        }
        setMessages(uniqueHistory);
        if (data.conversation.id) {
          welfareChatService.markConversationRead(data.conversation.id);
        }
      }
    } catch (err: any) {
      console.warn('Error loading conversation:', err.message);
    } finally {
      setLoading(false);
    }
  }, [officerId, paramConversationId]);

  useEffect(() => {
    loadConversation();

    // ── Real-Time Sockets Listeners ──────────────────────────────────────────
    const unsubNewMsg = welfareChatService.onNewMessage((payload) => {
      if (payload?.message) {
        const incomingId = payload.message.id || (payload.message as any)._id;
        setMessages((prev) => {
          if (incomingId && prev.some((m) => m.id === incomingId || (m as any)._id === incomingId)) {
            return prev;
          }
          return [...prev, payload.message];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
      }
    });

    const unsubTyping = welfareChatService.onTyping((payload) => {
      if (payload.isTyping) {
        setOfficerTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setOfficerTyping(false), 3000);
      } else {
        setOfficerTyping(false);
      }
    });

    const unsubResolved = welfareChatService.onEmergencyResolved(() => {
      setIsEmergencyMode(false);
      Alert.alert('Emergency Resolved', 'The Welfare Officer has marked the emergency status as resolved.');
    });

    return () => {
      if (unsubNewMsg) unsubNewMsg();
      if (unsubTyping) unsubTyping();
      if (unsubResolved) unsubResolved();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [loadConversation]);

  const handleCall = () => {
    const num = emergencyPhone || conversation?.officerPhone || '1990';
    Linking.openURL(`tel:${num}`).catch(() => {
      Alert.alert('Call Failed', `Could not place call to ${num}`);
    });
  };

  const handleSendMessage = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || sending) return;

    const targetOfficer = officerId || conversation?.welfareId || paramConversationId;
    if (!targetOfficer) {
      Alert.alert('Unable to Send', 'Could not locate the welfare officer for this conversation.');
      return;
    }

    setSending(true);
    setInputText('');
    const emergencyTriggered = isEmergencyMode;

    try {
      const res = await welfareChatService.sendMessage(targetOfficer, {
        text: textToSend,
        isEmergency: emergencyTriggered,
      });

      if (res?.data) {
        const sentId = res.data.id || (res.data as any)._id;
        setMessages((prev) => {
          if (sentId && prev.some((m) => m.id === sentId || (m as any)._id === sentId)) {
            return prev;
          }
          return [...prev, res.data];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        if (emergencyTriggered) {
          Alert.alert(
            '🚨 Emergency Alert Sent',
            `Your urgent crisis alert has been dispatched to ${officerName}. The officer has been alerted immediately.`
          );
        }
      }
    } catch (err: any) {
      Alert.alert('Message Failed', err.response?.data?.message || 'Could not send message.');
    } finally {
      setSending(false);
      setIsEmergencyMode(false);
    }
  };

  const renderMessageItem = ({ item }: { item: ChatMessageItem }) => {
    const isMe = item.senderRole === 'student';
    const isEmergency = item.isEmergency;

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        <View
          style={[
            styles.bubble,
            isMe ? styles.bubbleRight : styles.bubbleLeft,
            isEmergency && styles.bubbleEmergency,
          ]}
        >
          {isEmergency && (
            <View style={styles.emergencyTagBadge}>
              <Ionicons name="warning" size={13} color="#FFFFFF" />
              <Text style={styles.emergencyTagText}>EMERGENCY ALERT</Text>
            </View>
          )}

          <Text
            style={[
              styles.bubbleText,
              isMe ? styles.bubbleTextRight : styles.bubbleTextLeft,
              isEmergency && styles.bubbleTextEmergency,
            ]}
          >
            {item.text}
          </Text>

          <Text
            style={[
              styles.bubbleTime,
              isMe ? styles.bubbleTimeRight : styles.bubbleTimeLeft,
              isEmergency && { color: '#FFE0DC' },
            ]}
          >
            {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => navigation.navigate('WelfareProfile', { officerId })}
          activeOpacity={0.8}
        >
          <Text style={styles.officerName} numberOfLines={1}>{officerName}</Text>
          <Text style={styles.officerStatus}>
            {officerTyping ? 'Officer is typing...' : 'Welfare Officer • Tap for details'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.callButton} onPress={handleCall} activeOpacity={0.8}>
          <Ionicons name="call" size={17} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── Emergency SOS Mode Banner ─────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.sosBanner, isEmergencyMode ? styles.sosBannerActive : styles.sosBannerInactive]}
        onPress={() => setIsEmergencyMode(!isEmergencyMode)}
        activeOpacity={0.85}
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <MaterialCommunityIcons
            name={isEmergencyMode ? 'shield-alert' : 'shield-alert-outline'}
            size={22}
            color={isEmergencyMode ? '#C0392B' : colors.primaryDark}
          />
        </Animated.View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.sosBannerTitle, isEmergencyMode && { color: '#C0392B' }]}>
            {isEmergencyMode ? '🚨 Emergency Crisis Mode is ON' : 'Need urgent crisis help?'}
          </Text>
          <Text style={styles.sosBannerSub}>
            {isEmergencyMode
              ? 'Your next message will be flagged with high priority to alert the officer immediately.'
              : 'Tap to trigger high-priority Emergency SOS alert with your details.'}
          </Text>
        </View>
        <View style={[styles.sosTogglePill, isEmergencyMode && styles.sosTogglePillActive]}>
          <Text style={[styles.sosToggleText, isEmergencyMode && { color: '#FFFFFF' }]}>
            {isEmergencyMode ? 'ACTIVE' : 'ACTIVATE'}
          </Text>
        </View>
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Connecting to welfare officer...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => `${item.id || (item as any)._id || 'msg'}-${index}`}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={42} color={colors.mutedRose} />
                <Text style={styles.emptyTitle}>Start a Conversation</Text>
                <Text style={styles.emptySub}>
                  You are in a direct, confidential channel with {officerName}. You can ask about financial aid, housing, campus wellbeing, or trigger an emergency SOS alert.
                </Text>
              </View>
            }
          />
        )}

        {/* ── Input Bar ─────────────────────────────────────────────────────────── */}
        <View style={[styles.inputBar, isEmergencyMode && styles.inputBarEmergency]}>
          <TextInput
            style={styles.textInput}
            placeholder={
              isEmergencyMode
                ? '🚨 Type urgent emergency message...'
                : 'Message welfare officer...'
            }
            placeholderTextColor={isEmergencyMode ? '#C0392B' : colors.textMuted}
            value={inputText}
            onChangeText={(t) => {
              setInputText(t);
              welfareChatService.emitTyping(officerId, t.length > 0, conversation?.id);
            }}
            multiline
            maxLength={2000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              inputText.trim().length === 0 ? styles.sendButtonDisabled : null,
              isEmergencyMode ? styles.sendButtonEmergency : null,
            ]}
            onPress={handleSendMessage}
            disabled={inputText.trim().length === 0 || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name={isEmergencyMode ? 'alert' : 'send'}
                size={17}
                color="#FFFFFF"
              />
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
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.creamBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1, marginLeft: 12 },
  officerName: { fontSize: 16, fontWeight: '800', color: colors.darkText },
  officerStatus: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C0392B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sosBannerInactive: {
    backgroundColor: '#FFF4F0',
    borderBottomColor: '#FBE4DC',
  },
  sosBannerActive: {
    backgroundColor: '#FDEAE8',
    borderBottomColor: '#F8C8C2',
  },
  sosBannerTitle: { fontSize: 12.5, fontWeight: '800', color: colors.primaryDark },
  sosBannerSub: { fontSize: 10.5, color: colors.textSecondary, marginTop: 1, lineHeight: 14 },
  sosTogglePill: {
    backgroundColor: '#FFF0EA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sosTogglePillActive: {
    backgroundColor: '#C0392B',
    borderColor: '#C0392B',
  },
  sosToggleText: { fontSize: 10, fontWeight: '800', color: colors.primaryDark },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: colors.textSecondary },
  messagesList: { padding: 16, paddingBottom: 20 },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.darkText },
  emptySub: { fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
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
  emergencyTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextRight: { color: '#FFFFFF' },
  bubbleTextLeft: { color: colors.darkText },
  bubbleTextEmergency: { color: '#FFFFFF', fontWeight: '700' },
  bubbleTime: { fontSize: 9.5, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeRight: { color: 'rgba(255,255,255,0.75)' },
  bubbleTimeLeft: { color: colors.textMuted },
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
  inputBarEmergency: {
    backgroundColor: '#FDEAE8',
    borderTopColor: '#F8C8C2',
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
  sendButtonEmergency: { backgroundColor: '#C0392B' },
});
