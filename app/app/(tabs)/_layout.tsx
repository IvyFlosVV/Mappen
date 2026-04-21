import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { RC } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: RC.inkRed,
        tabBarInactiveTintColor: RC.dust,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: RC.parchment,
          borderTopWidth: 2,
          borderTopColor: RC.hunter,
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.OS === 'ios' ? 84 : 62,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="map.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="new-entry"
        options={{
          title: 'New Entry',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="plus.circle.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
