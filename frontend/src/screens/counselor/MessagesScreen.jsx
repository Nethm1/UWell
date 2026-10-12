import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import ImagePlaceholder from '../../components/common/ImagePlaceholder';
import BouncingCirclesBackground from '../../components/common/BouncingCirclesBackground';
import CounselorBackButton from '../../components/navigation/CounselorBackButton';
import { counselorService } from '../../services/counselorService';

// Decorative field behind the list. Each circle drifts across the whole screen
// and bounces off the edges, in the app's coral/orange palette.
const BACKGROUND_CIRCLES = [
  { key: 'a', size: 190, left: 20, top: 60, color: '#F46352', opacity: 0.16, period: 9000, ratio: 0.63, xBounces: 2, yBounces: 3 },
  { key: 'b', size: 110, left: 210, top: 180, color: '#FCE3D9', opacity: 0.95, period: 11000, ratio: 0.47, xBounces: 3, yBounces: 2 },
  { key: 'c', size: 240, left: 90, top: 380, color: '#FCE3D9', opacity: 0.8, period: 13000, ratio: 0.71, xBounces: 2, yBounces: 4 },
  { key: 'd', size: 84, left: 30, top: 520, color: '#F46352', opacity: 0.22, period: 8000, ratio: 0.58, xBounces: 4, yBounces: 2 },
  { key: 'e', size: 150, left: 240, top: 700, color: '#F46352', opacity: 0.14, period: 10500, ratio: 0.66, xBounces: 3, yBounces: 3 },
  { key: 'f', size: 96, left: 140, top: 860, color: '#F5EDE6', opacity: 0.95, period: 12000, ratio: 0.54, xBounces: 2, yBounces: 3 },
];

const formatTimestamp = (value) => {
  if (!value) return 'New chat';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const MessagesScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fade = useRef(new Animated.Value(0)).current;

  const loadMessages = useCallback(async () => {
    try {
      setError('');
      const data = await counselorService.getMessages();
      setConversations(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load your conversations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadMessages();
    return undefined;
  }, [loadMessages]));

  React.useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [fade]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredConversations = conversations.filter((item) =>
    `${item.studentName || ''} ${item.lastMessage || ''}`.toLowerCase().includes(normalizedSearch)
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.76}
      onPress={() => navigation.navigate('StudentChat', {
        studentId: item.studentId,
        studentName: item.studentName,
      })}
      accessibilityLabel={`Open private chat with ${item.studentName}`}
    >
      <View style={[styles.chatCard, item.unread && styles.unreadCard]}>
        <View style={styles.avatarWrap}>
          <ImagePlaceholder initials={item.avatarInitials || item.studentName?.slice(0, 2) || 'ST'} size={49} />
          <View style={styles.privateBadge}><Ionicons name="lock-closed" size={9} color="#fff" /></View>
        </View>
        <View style={styles.textMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.studentName} numberOfLines={1}>{item.studentName || 'Student'}</Text>
            <Text style={styles.timestampText}>{formatTimestamp(item.timestamp)}</Text>
          </View>
          <View style={styles.msgSnippetRow}>
            <Text style={[styles.lastMsgText, item.unread && styles.unreadMsgText]} numberOfLines={1}>
              {item.lastMessage || 'Booked a session · Start a conversation'}
            </Text>
            {item.unread && <View style={styles.unreadDot} />}
          </View>
        </View>
        <Feather name="chevron-right" size={17} color="#9E908D" style={{ marginLeft: 8 }} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
      <Animated.View style={[styles.container, { opacity: fade }]}>
        <BouncingCirclesBackground circles={BACKGROUND_CIRCLES} />
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.studentId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadMessages}
          ListHeaderComponent={(
            <View>
              <CounselorBackButton navigation={navigation} style={styles.backButton} />
              <View style={styles.titleRow}>
                <View style={styles.titleIcon}><Ionicons name="chatbubbles" size={21} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerTitle}>Messages</Text>
                  <Text style={styles.subtitle}>Private conversations with students who booked you.</Text>
                </View>
                <View style={styles.clientCount}><Text style={styles.clientCountText}>{conversations.length}</Text></View>
              </View>
              <View style={styles.privacyNote}>
                <Ionicons name="shield-checkmark" size={16} color="#D66A51" />
                <Text style={styles.privacyText}>Only your booked students appear in this list.</Text>
              </View>
              <View style={styles.searchWrap}>
                <Feather name="search" size={16} color="#9E908D" />
                <TextInput
                  placeholder="Find a student or message"
                  placeholderTextColor="#B9AFA9"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                  accessibilityLabel="Search conversations"
                />
                {!!searchQuery && <TouchableOpacity onPress={() => setSearchQuery('')}><Feather name="x-circle" size={16} color="#9E908D" /></TouchableOpacity>}
              </View>
              <View style={styles.sectionLabelRow}><Text style={styles.sectionLabel}>BOOKED STUDENTS</Text><Text style={styles.resultText}>{filteredConversations.length} chats</Text></View>
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyCard}>
              {loading ? <ActivityIndicator color="#E8836B" /> : <View style={styles.emptyIcon}><Ionicons name={error ? 'cloud-offline-outline' : 'chatbubble-ellipses-outline'} size={24} color="#E8836B" /></View>}
              <Text style={styles.emptyTitle}>{loading ? 'Loading conversations' : error ? 'Messages unavailable' : normalizedSearch ? 'No matching chats' : 'No student chats yet'}</Text>
              {!loading && <Text style={styles.emptyText}>{error || (normalizedSearch ? 'Try another name or message.' : 'When a student books a session with you, you can start a private conversation here.')}</Text>}
              {!!error && <TouchableOpacity style={styles.retryButton} onPress={loadMessages}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>}
            </View>
          )}
          ListFooterComponent={<View style={{ height: 28 }} />}
        />
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF8F0' },
  container: { flex: 1 },
  listContent: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 16 },
  backButton: { marginLeft: -6, marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 17 },
  titleIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#E8836B', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { color: '#3D2C2E', fontSize: 25, fontWeight: '800' },
  subtitle: { color: '#756A67', fontSize: 12, lineHeight: 17, marginTop: 2 },
  clientCount: { minWidth: 31, height: 31, borderRadius: 16, backgroundColor: '#FDF1EC', alignItems: 'center', justifyContent: 'center', marginLeft: 8, paddingHorizontal: 8 },
  clientCountText: { color: '#D66A51', fontSize: 12, fontWeight: '800' },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FDF1EC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 13 },
  privacyText: { flex: 1, color: '#C25A43', fontSize: 11, fontWeight: '600' },
  searchWrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EDE3DA', paddingHorizontal: 13, marginBottom: 17 },
  searchInput: { flex: 1, color: '#3D2C2E', fontSize: 13, paddingVertical: 11, marginLeft: 9, outlineStyle: 'none' },
  sectionLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  sectionLabel: { color: '#9E908D', fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  resultText: { color: '#9E908D', fontSize: 11, fontWeight: '600' },
  chatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#EDE3DA', borderRadius: 17, padding: 13, marginBottom: 10, shadowColor: '#3D2C2E', shadowOpacity: 0.045, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  unreadCard: { borderColor: '#F3DCD3', backgroundColor: '#FFF8F0' },
  avatarWrap: { position: 'relative' },
  privateBadge: { position: 'absolute', right: -2, bottom: -1, width: 18, height: 18, borderRadius: 9, backgroundColor: '#E8836B', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  textMeta: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 },
  studentName: { flex: 1, color: '#3D2C2E', fontSize: 14, fontWeight: '800' },
  timestampText: { color: '#9E908D', fontSize: 10 },
  msgSnippetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMsgText: { flex: 1, color: '#756A67', fontSize: 12, marginRight: 8 },
  unreadMsgText: { color: '#3D2C2E', fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8836B' },
  emptyCard: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#EDE3DA', borderRadius: 18, padding: 24, marginTop: 8 },
  emptyIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FDF1EC', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: '#3D2C2E', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#9E908D', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  retryButton: { backgroundColor: '#E8836B', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 9, marginTop: 13 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

export default MessagesScreen;
