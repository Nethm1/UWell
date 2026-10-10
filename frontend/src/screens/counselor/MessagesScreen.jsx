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
import { counselorService } from '../../services/counselorService';

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
        <Feather name="chevron-right" size={17} color="#A0AAB7" style={{ marginLeft: 8 }} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FB" />
      <Animated.View style={[styles.container, { opacity: fade }]}>
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
              <View style={styles.titleRow}>
                <View style={styles.titleIcon}><Ionicons name="chatbubbles" size={21} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerTitle}>Messages</Text>
                  <Text style={styles.subtitle}>Private conversations with students who booked you.</Text>
                </View>
                <View style={styles.clientCount}><Text style={styles.clientCountText}>{conversations.length}</Text></View>
              </View>
              <View style={styles.privacyNote}>
                <Ionicons name="shield-checkmark" size={16} color="#21816A" />
                <Text style={styles.privacyText}>Only your booked students appear in this list.</Text>
              </View>
              <View style={styles.searchWrap}>
                <Feather name="search" size={16} color="#8793A3" />
                <TextInput
                  placeholder="Find a student or message"
                  placeholderTextColor="#97A1AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                  accessibilityLabel="Search conversations"
                />
                {!!searchQuery && <TouchableOpacity onPress={() => setSearchQuery('')}><Feather name="x-circle" size={16} color="#8793A3" /></TouchableOpacity>}
              </View>
              <View style={styles.sectionLabelRow}><Text style={styles.sectionLabel}>BOOKED STUDENTS</Text><Text style={styles.resultText}>{filteredConversations.length} chats</Text></View>
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyCard}>
              {loading ? <ActivityIndicator color="#25836C" /> : <View style={styles.emptyIcon}><Ionicons name={error ? 'cloud-offline-outline' : 'chatbubble-ellipses-outline'} size={24} color="#25836C" /></View>}
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
  safeArea: { flex: 1, backgroundColor: '#F4F7FB' },
  container: { flex: 1 },
  listContent: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 17 },
  titleIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#7A69C8', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { color: '#24364A', fontSize: 25, fontWeight: '800' },
  subtitle: { color: '#748295', fontSize: 12, lineHeight: 17, marginTop: 2 },
  clientCount: { minWidth: 31, height: 31, borderRadius: 16, backgroundColor: '#E9E7FF', alignItems: 'center', justifyContent: 'center', marginLeft: 8, paddingHorizontal: 8 },
  clientCountText: { color: '#5953AD', fontSize: 12, fontWeight: '800' },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E5F4EF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 13 },
  privacyText: { flex: 1, color: '#29765F', fontSize: 11, fontWeight: '600' },
  searchWrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5EAF0', paddingHorizontal: 13, marginBottom: 17 },
  searchInput: { flex: 1, color: '#24364A', fontSize: 13, paddingVertical: 11, marginLeft: 9, outlineStyle: 'none' },
  sectionLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  sectionLabel: { color: '#7A8798', fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  resultText: { color: '#8995A4', fontSize: 11, fontWeight: '600' },
  chatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E7ECF1', borderRadius: 17, padding: 13, marginBottom: 10, shadowColor: '#1D354C', shadowOpacity: 0.045, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  unreadCard: { borderColor: '#D5CCFF', backgroundColor: '#FEFDFF' },
  avatarWrap: { position: 'relative' },
  privateBadge: { position: 'absolute', right: -2, bottom: -1, width: 18, height: 18, borderRadius: 9, backgroundColor: '#25836C', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  textMeta: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 },
  studentName: { flex: 1, color: '#24364A', fontSize: 14, fontWeight: '800' },
  timestampText: { color: '#94A0AE', fontSize: 10 },
  msgSnippetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMsgText: { flex: 1, color: '#778598', fontSize: 12, marginRight: 8 },
  unreadMsgText: { color: '#34485E', fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#796BD0' },
  emptyCard: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E7ECF1', borderRadius: 18, padding: 24, marginTop: 8 },
  emptyIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E5F4EF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: '#293B50', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#7A8797', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  retryButton: { backgroundColor: '#25836C', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 9, marginTop: 13 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

export default MessagesScreen;
