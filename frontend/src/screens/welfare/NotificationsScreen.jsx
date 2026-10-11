import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import { useWelfare } from '../../context/WelfareContext';

const typeStyles = {
  request: { icon: 'alert-circle-outline', bg: '#FDF1EC', tint: '#E8836B' },
  completed: { icon: 'checkmark-circle-outline', bg: '#DDF3E4', tint: '#397052' },
  schedule: { icon: 'time-outline', bg: '#FFF0D6', tint: '#9A6818' },
  system: { icon: 'chatbubble-ellipses-outline', bg: '#E5EEFA', tint: '#4A90E2' },
  reminder: { icon: 'person-circle-outline', bg: '#F3E8FA', tint: '#7E57C2' },
  emergency_sos: { icon: 'warning', bg: '#FDEAE8', tint: '#C0392B' },
  student_message: { icon: 'chatbubble-ellipses', bg: '#EBF5FB', tint: '#2980B9' },
  welfare_message: { icon: 'chatbubble-ellipses', bg: '#EBF5FB', tint: '#2980B9' },
};

const FILTERS = ['All', 'Unread', 'Read'];

const NotificationsScreen = ({ navigation }) => {
  const { notifications, markNotificationRead, markAllNotificationsRead, deleteNotification } =
    useWelfare();

  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = notifications.filter((n) => {
    if (activeFilter === 'Unread') return n.unread;
    if (activeFilter === 'Read') return !n.unread;
    return true;
  });

  const unreadCount = notifications.filter((n) => n.unread).length;

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  // ---------- HANDLE NOTIFICATION CLICK ----------
  const handleNotificationClick = (item) => {
    if (item.unread) {
      markNotificationRead(item.id || item._id);
    }

    const isEmergency =
      item.type === 'emergency_sos' ||
      Boolean(item.metadata?.isEmergency) ||
      (typeof item.title === 'string' && /emergency/i.test(item.title));

    const isStudentChat =
      item.type === 'student_message' ||
      item.type === 'emergency_sos' ||
      item.type === 'welfare_message' ||
      Boolean(item.metadata?.studentId || item.metadata?.conversationId) ||
      (typeof item.title === 'string' && /message from|emergency/i.test(item.title));

    if (isStudentChat) {
      const studentId =
        item.metadata?.studentId ||
        item.studentId ||
        (item.appointmentId && !String(item.type).startsWith('appointment_') ? String(item.appointmentId) : '');
      const conversationId =
        item.metadata?.conversationId ||
        (item.appointmentId && !String(item.type).startsWith('appointment_') ? String(item.appointmentId) : '');
      const studentName =
        item.metadata?.studentName ||
        (item.title ? item.title.replace(/^🚨\s*EMERGENCY SOS ALERT:?\s*/i, '').replace(/^Message from\s*/i, '').trim() : '') ||
        'Student';
      const studentRegNo = item.metadata?.studentRegNo || '';
      const studentPhone = item.metadata?.studentPhone || '';
      const studentFaculty = item.metadata?.studentFaculty || '';

      navigation.navigate('StudentChat', {
        studentId,
        conversationId,
        studentName,
        studentRegNo,
        studentPhone,
        studentFaculty,
      });
      return;
    }

    // Appointment notifications
    if (item.appointmentId || (typeof item.type === 'string' && item.type.startsWith('appointment_'))) {
      const aptId = item.appointmentId || item.metadata?.appointmentId;
      if (aptId) {
        navigation.navigate('AppointmentDetails', {
          appointmentId: aptId,
        });
      }
    }
  };

  // ---------- UPDATE: mark all read ----------
  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;
    Alert.alert('Mark All as Read', `Mark ${unreadCount} notifications as read?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: () => {
          markAllNotificationsRead();
          Alert.alert('Done', 'All notifications marked as read.');
        }
      }
    ]);
  };

  // ---------- DELETE: remove one ----------
  const handleDelete = (item) => {
    Alert.alert('Delete Notification', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteNotification(item.id)
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ---------- Header ---------- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* ---------- Mark All Read ---------- */}
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
          <Ionicons name="checkmark-done-outline" size={16} color={colors.primary} />
          <Text style={styles.markAllText}>Mark All Read</Text>
        </TouchableOpacity>
      )}

      {/* ---------- Filter Tabs ---------- */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ---------- List ---------- */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={42} color={colors.textMuted} />
            <Text style={styles.emptyText}>No notifications here.</Text>
          </View>
        ) : (
          filtered.map((n) => {
            const t = typeStyles[n.type] || typeStyles.system;
            const isEmergency =
              n.type === 'emergency_sos' ||
              Boolean(n.metadata?.isEmergency) ||
              (typeof n.title === 'string' && /emergency/i.test(n.title));
            const isStudentChat =
              n.type === 'student_message' ||
              n.type === 'emergency_sos' ||
              n.type === 'welfare_message' ||
              Boolean(n.metadata?.studentId || n.metadata?.conversationId) ||
              (typeof n.title === 'string' && /message from|emergency/i.test(n.title));

            return (
              <TouchableOpacity
                key={n.id || n._id}
                style={[
                  styles.card,
                  n.unread && styles.cardUnread,
                  isEmergency && { borderColor: '#F5B7B1', backgroundColor: '#FDEDEC' },
                ]}
                activeOpacity={0.85}
                onPress={() => handleNotificationClick(n)}
              >
                <View style={[styles.iconWrap, { backgroundColor: t.bg }]}>
                  <Ionicons name={t.icon} size={20} color={t.tint} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        styles.title,
                        isEmergency && { color: '#C0392B' },
                      ]}
                      numberOfLines={1}
                    >
                      {n.title}
                    </Text>
                    {n.unread && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.message}>{n.message}</Text>
                  <Text style={styles.time}>{n.timestamp || (n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}</Text>

                  {isStudentChat && (
                    <View style={styles.chatActionRow}>
                      <Ionicons
                        name={isEmergency ? 'warning-outline' : 'chatbubble-ellipses-outline'}
                        size={14}
                        color={isEmergency ? '#C0392B' : colors.primary}
                      />
                      <Text style={[styles.chatActionText, isEmergency && { color: '#C0392B' }]}>
                        {isEmergency ? '🚨 Tap to view Emergency SOS chat' : '💬 Tap to open student chat & reply'}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={13}
                        color={isEmergency ? '#C0392B' : colors.primary}
                      />
                    </View>
                  )}
                </View>

                {/* DELETE button */}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(n)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#C0392B" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.creamBackground },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  backBtn: { padding: spacing.xs, marginRight: spacing.sm },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10
  },
  unreadBadgeText: {
    color: colors.textWhite,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  },

  // Mark All
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginRight: spacing.lg,
    marginBottom: spacing.sm
  },
  markAllText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginLeft: 4
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary
  },
  filterChipTextActive: {
    color: colors.textWhite,
    fontWeight: typography.fontWeight.bold
  },

  // List
  scrollContent: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl },

  emptyBox: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: {
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.md
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  cardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm
  },
  message: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18
  },
  time: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm
  },
  deleteBtn: {
    padding: spacing.xs,
    marginLeft: spacing.sm
  },
  chatActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F5ECE7',
  },
  chatActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default NotificationsScreen;