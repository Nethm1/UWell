import React from 'react';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import IncomingCallOverlay from './src/components/common/IncomingCallOverlay';

LogBox.ignoreLogs([
  '[UWell API Res',
  'Cannot connect to Expo CLI',
  'Request failed with status code 403',
  'Request failed with status code 401',
]);

// Inner component so it has access to both navigation and auth context
function AppInner() {
  const { user } = useAuth();
  return (
    <>
      <StatusBar style="auto" />
      <AuthNavigator />
      {/* Global incoming call overlay for students and counselors. */}
      {['student', 'counselor'].includes(user?.role) && <IncomingCallOverlay />}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AuthProvider>
          <NavigationContainer>
            <AppInner />
          </NavigationContainer>
        </AuthProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
