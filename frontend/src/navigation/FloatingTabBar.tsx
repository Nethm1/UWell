import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { counselorService } from '../services/counselorService';

const CORAL = '#F46352';
const SOFT_PEACH = '#FCE3D9';
const BURGUNDY = '#481B25';
const MUTED = '#8B7468';
const PILL_BG = '#FFFFFF';

// Outline icons are used for every state so the row reads consistently.
const OUTLINE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home-outline',
  Appointments: 'calendar-outline',
  Students: 'people-outline',
  Messages: 'chatbubble-ellipses-outline',
  Profile: 'person-outline',
};

type BadgeCounts = { Appointments: number; Messages: number };

const FloatingTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const [counts, setCounts] = useState<BadgeCounts>({ Appointments: 0, Messages: 0 });

  const refreshCounts = useCallback(async () => {
    try {
      const [appointments, conversations] = await Promise.all([
        counselorService.getAppointments(),
        counselorService.getMessages(),
      ]);
      setCounts({
        Appointments: (Array.isArray(appointments) ? appointments : []).filter(
          (item) => item?.status === 'Pending'
        ).length,
        Messages: (Array.isArray(conversations) ? conversations : []).filter((item) => item?.unread).length,
      });
    } catch (error) {
      // Badges are cosmetic. Keep the last known counts rather than breaking the bar.
    }
  }, []);

  // Re-read on first paint, whenever the active tab changes, and on return to the app.
  useEffect(() => {
    void refreshCounts();
  }, [state.index, refreshCounts]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshCounts();
    });
    return () => subscription.remove();
  }, [refreshCounts]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoider}
    >
      {/* This wrapper still occupies layout space, so screens keep their bottom padding
          and scrollable content is never hidden behind the floating pill. */}
      <View
        style={[
          styles.band,
          { paddingBottom: Math.max(insets.bottom, 10), paddingTop: 10 },
        ]}
      >
        <View style={[styles.pill, { marginHorizontal: narrow ? 12 : 18 }]}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label =
              typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : options.title ?? route.name;
            const isFocused = state.index === index;
            const iconName = OUTLINE_ICONS[route.name] ?? 'ellipse-outline';
            const badge = counts[route.name as keyof BadgeCounts] ?? 0;

            const onPress = () => {
              // Emit first so screen-level tabPress listeners still run.
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={typeof label === 'string' ? label : route.name}
                android_ripple={{ color: SOFT_PEACH, borderless: true }}
                onPress={onPress}
                style={styles.item}
              >
                <View style={[styles.itemInner, isFocused && styles.itemInnerActive]}>
                  <View>
                    <Ionicons
                      name={iconName}
                      size={narrow ? 20 : 22}
                      color={isFocused ? CORAL : MUTED}
                    />
                    {badge > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText} numberOfLines={1}>
                          {badge > 99 ? '99+' : badge}
                        </Text>
                      </View>
                    )}
                  </View>
                  {typeof label === 'string' && (
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.label,
                        { fontSize: narrow ? 9 : 10 },
                        isFocused ? styles.labelActive : styles.labelInactive,
                      ]}
                    >
                      {label}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoider: { width: '100%' },
  band: { backgroundColor: 'transparent' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PILL_BG,
    borderRadius: 32,
    height: 62,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(72, 27, 37, 0.05)',
    shadowColor: BURGUNDY,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  item: { flex: 1 },
  itemInner: {
    flex: 1,
    marginVertical: 6,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInnerActive: { backgroundColor: SOFT_PEACH },
  label: { marginTop: 3, fontWeight: '700', textAlign: 'center' },
  labelActive: { color: CORAL },
  labelInactive: { color: MUTED },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: CORAL,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: PILL_BG,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});

export default FloatingTabBar;