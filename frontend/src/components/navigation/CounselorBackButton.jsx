import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

export const navigateBackSafely = (navigation, fallbackRoute = 'Dashboard') => {
  let current = navigation;

  while (current) {
    const state = current.getState?.();
    if (state?.type === 'stack' && state.index > 0 && typeof current.goBack === 'function') {
      current.goBack();
      return;
    }

    if (state?.type === 'tab' && state.routeNames?.includes(fallbackRoute) && typeof current.navigate === 'function') {
      current.navigate(fallbackRoute);
      return;
    }

    current = current.getParent?.();
  }
};

export default function CounselorBackButton({ navigation, onPress, style, fallbackRoute = 'Dashboard' }) {
  return (
    <TouchableOpacity
      onPress={onPress || (() => navigateBackSafely(navigation, fallbackRoute))}
      style={[styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={6}
    >
      <Feather name="arrow-left" size={21} color="#12203E" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
