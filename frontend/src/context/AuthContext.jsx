import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_ROLES } from '../utils/constants';
import { notificationService } from '../services/notificationService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadUserFromStorage();
  }, []);

  useEffect(() => {
    if (user) {
      const uid = user._id || user.id;
      if (uid) {
        notificationService.registerSocketUser(uid, user.role || 'student');
      }
    }
  }, [user]);

  const loadUserFromStorage = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
      }

    } catch (error) {
      console.error('Error loading user from storage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData) => {
    try {
      setUser(userData);
      setIsAuthenticated(true);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      if (userData.token) {
        await AsyncStorage.setItem('token', userData.token);
        console.log('[Auth] Token saved:', userData.token.substring(0, 20) + '...');
      } else {
        console.warn('[Auth] No token in userData!');
      }
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(['user', 'token']);
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateUser = async (updatedData) => {
    try {
      const newUser = { ...user, ...updatedData };
      setUser(newUser);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    isStudent: user?.role === USER_ROLES.STUDENT,
    isCounselor: user?.role === USER_ROLES.COUNSELOR,
    isWelfare: user?.role === USER_ROLES.WELFARE,
    isManagement: user?.role === USER_ROLES.MANAGEMENT
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
