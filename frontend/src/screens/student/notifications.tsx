import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  const fetchNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get(
        'http://localhost:5000/api/welfare/notifications',
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setNotifications(response.data.notifications || response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/api/welfare/notifications/${notificationId}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleNotificationPress = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
      );
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.notification,
        item.isRead ? styles.read : styles.unread
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.title}>{item.title}</Text>
          {!item.isRead && <View style={styles.badge} />}
        </View>
        <Text style={styles.message}>{item.message}</Text>
        <View style={styles.footer}>
          <Text style={styles.type}>{item.type}</Text>
          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const EmptyListMessage = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No notifications yet</Text>
      <Text style={styles.emptySubText}>
        Appointments and messages will appear here
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4A90A4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            setRefreshing(true);
            fetchNotifications();
          }}
        >
          <Text style={styles.refreshText}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id}
        ListEmptyComponent={EmptyListMessage}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchNotifications} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA'
  },
  header: {
    padding: 16,
    backgroundColor: '#4A90A4',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF'
  },
  refreshButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8
  },
  refreshText: {
    color: '#FFF',
    fontSize: 12
  },
  notification: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  read: {
    opacity: 0.7
  },
  unread: {
    borderLeftWidth: 4,
    borderLeftColor: '#4A90A4'
  },
  notificationContent: {
    flex: 1
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E'
  },
  badge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A90A4'
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  type: {
    fontSize: 12,
    color: '#999',
    textTransform: 'capitalize'
  },
  date: {
    fontSize: 12,
    color: '#999'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8
  },
  emptySubText: {
    fontSize: 14,
    color: '#999'
  }
});

export default NotificationsScreen;