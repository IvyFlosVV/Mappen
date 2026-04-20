import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/lib/auth';

// Matches the shape of the `entries` table rows we need for rendering pins.
interface EntryPin {
  id: string;
  latitude: number;
  longitude: number;
  title: string | null;
}

const PITTSBURGH = {
  latitude: 40.4406,
  longitude: -79.9959,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

export default function MapScreen() {
  const { session, signOut } = useAuth();
  const [region, setRegion] = useState(PITTSBURGH);
  const [pins, setPins] = useState<EntryPin[]>([]);

  // Request location and center the map on the user's position.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Permission denied — Pittsburgh fallback is already set as initial region.
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    })();
  }, []);

  // Fetch the signed-in user's own entries from Supabase.
  useEffect(() => {
    if (!session) return;

    (async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('id, latitude, longitude, title')
        // RLS already restricts to own rows; .eq is defense-in-depth.
        .eq('user_id', session.user.id);

      if (error) {
        console.error('[MapScreen] failed to fetch entries:', error.message);
        return;
      }

      setPins((data as EntryPin[]) ?? []);
    })();
  }, [session]);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region} region={region}>
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            title={pin.title ?? 'Untitled entry'}
          />
        ))}
      </MapView>

      <TouchableOpacity
        style={[styles.signOutButton, Platform.OS === 'ios' && styles.signOutButtonIos]}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  signOutButton: {
    position: 'absolute',
    top: 52,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  signOutButtonIos: {
    top: 60,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
});
