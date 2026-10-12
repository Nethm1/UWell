import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { View, StyleSheet } from 'react-native';
import FloatingTabBar from './FloatingTabBar';
import DashboardScreen from '../screens/counselor/DashboardScreen';
import AppointmentsScreen from '../screens/counselor/AppointmentsScreen';
import StudentListScreen from '../screens/counselor/StudentListScreen';
import StudentSessionScreen from '../screens/counselor/StudentSessionScreen';
import MessagesScreen from '../screens/counselor/MessagesScreen';
import StudentChatScreen from '../screens/counselor/StudentChatScreen';
import ProfileScreen from '../screens/counselor/ProfileScreen';
import EditProfileScreen from '../screens/counselor/EditProfileScreen';
import ChangePasswordScreen from '../screens/counselor/ChangePasswordScreen';
import ClinicalFocusAreasScreen from '../screens/counselor/ClinicalFocusAreasScreen';
import FocusAreaDetailScreen from '../screens/counselor/FocusAreaDetailScreen';
import CounselorSettingsScreen from '../screens/counselor/CounselorSettingsScreen';
import CounselorNotificationsScreen from '../screens/counselor/CounselorNotificationsScreen';
import VideoSessionScreen from '../screens/counselor/VideoSessionScreen';
import VideoCallScreen from '../screens/shared/VideoCallScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();
const AppointmentsStack = createNativeStackNavigator();
const StudentsStack = createNativeStackNavigator();
const MessagesStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const AppointmentsStackScreen = () => (
  <AppointmentsStack.Navigator screenOptions={{ headerShown: false }}>
    <AppointmentsStack.Screen name="AppointmentsList" component={AppointmentsScreen} />
    <AppointmentsStack.Screen name="VideoSession" component={VideoSessionScreen} />
    <AppointmentsStack.Screen name="VideoCall" component={VideoCallScreen} />
  </AppointmentsStack.Navigator>
);

const StudentsStackScreen = () => (
  <StudentsStack.Navigator screenOptions={{ headerShown: false }}>
    <StudentsStack.Screen name="StudentList" component={StudentListScreen} />
    <StudentsStack.Screen name="StudentSession" component={StudentSessionScreen} />
    <StudentsStack.Screen name="VideoSession" component={VideoSessionScreen} />
    <StudentsStack.Screen name="VideoCall" component={VideoCallScreen} />
  </StudentsStack.Navigator>
);

const MessagesStackScreen = () => (
  <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
    <MessagesStack.Screen name="MessagesList" component={MessagesScreen} />
    <MessagesStack.Screen name="StudentChat" component={StudentChatScreen} />
  </MessagesStack.Navigator>
);

const ProfileStackScreen = () => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
    <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
    <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    <ProfileStack.Screen name="ClinicalFocusAreas" component={ClinicalFocusAreasScreen} />
    <ProfileStack.Screen name="FocusAreaDetail" component={FocusAreaDetailScreen} />
    <ProfileStack.Screen name="CounselorSettings" component={CounselorSettingsScreen} />
    <ProfileStack.Screen name="CounselorNotifications" component={CounselorNotificationsScreen} />
  </ProfileStack.Navigator>
);

const CounselorNavigator = () => {
  return (
    <View style={styles.container}>
      <Tab.Navigator
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={() => ({
          headerShown: false,
          tabBarActiveTintColor: '#F46352',
          tabBarInactiveTintColor: '#8B7468',
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
        <Tab.Screen name="Appointments" component={AppointmentsStackScreen} />
        <Tab.Screen name="Students" component={StudentsStackScreen} />
        <Tab.Screen name="Messages" component={MessagesStackScreen} />
        <Tab.Screen
          name="Profile"
          component={ProfileStackScreen}
          options={({ route }) => {
            const childRoute = getFocusedRouteNameFromRoute(route) || 'ProfileMain';
            return childRoute === 'EditProfile' ? { tabBarStyle: { display: 'none' } } : {};
          }}
          listeners={({ navigation }) => ({
            tabPress: () => navigation.navigate('Profile', { screen: 'ProfileMain' }),
          })}
        />
      </Tab.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.creamBackground,
  },
});

export default CounselorNavigator;
