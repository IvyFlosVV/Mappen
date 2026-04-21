import React, { useEffect, useReducer, useRef } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';
import { File as ExpoFile } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { Fonts, RC } from '@/constants/theme';

// ============================================
// STATE MACHINE — I will write this section myself.
// Leave this block exactly as-is. Do not modify.
// ============================================

// One photo in the multi-photo array.  `id` is a client-side UUID so uploads
// can run in parallel and be identified on completion.
type PhotoItem =
  | { id: string; phase: 'uploading'; localUri: string }
  | { id: string; phase: 'uploaded'; localUri: string; publicUrl: string }
  | { id: string; phase: 'error'; localUri: string; errorMessage: string };

type State =
  | { status: 'idle' }
  | { status: 'fetching_gps' }
  | { status: 'gps_error'; message: string }
  | { status: 'ready'; latitude: number; longitude: number; title: string; body: string; photos: PhotoItem[] }
  | { status: 'refreshing_gps'; latitude: number; longitude: number; title: string; body: string; photos: PhotoItem[] }
  | { status: 'checking_duplicate'; latitude: number; longitude: number; title: string; body: string; photos: PhotoItem[] }
  | { status: 'duplicate_warning'; latitude: number; longitude: number; title: string; body: string; photos: PhotoItem[]; nearbyTitle: string | null }
  | { status: 'submitting'; latitude: number; longitude: number; title: string; body: string; photos: PhotoItem[] }
  | { status: 'submit_error'; latitude: number; longitude: number; title: string; body: string; message: string; photos: PhotoItem[] }
  | { status: 'success' };

type Action =
  | { type: 'START_GPS_FETCH' }
  | { type: 'GPS_SUCCESS'; latitude: number; longitude: number }
  | { type: 'GPS_FAIL'; message: string }
  | { type: 'RETRY_GPS' }
  | { type: 'REFRESH_GPS' }
  | { type: 'EDIT_TITLE'; value: string }
  | { type: 'EDIT_BODY'; value: string }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_FAIL'; message: string }
  | { type: 'RETRY_SUBMIT' }
  | { type: 'PHOTOS_PICKED'; items: Array<{ id: string; localUri: string }> }
  | { type: 'PHOTO_UPLOAD_SUCCESS'; id: string; publicUrl: string }
  | { type: 'PHOTO_UPLOAD_FAIL'; id: string; errorMessage: string }
  | { type: 'REMOVE_PHOTO'; id: string }
  | { type: 'RESET' }
  | { type: 'DUPLICATE_FOUND'; nearbyTitle: string | null }
  | { type: 'NO_DUPLICATE' }
  | { type: 'CONFIRM_DUPLICATE' }
  | { type: 'CANCEL_DUPLICATE' };

// ============================================
// STATE MACHINE — Hand-written by me.
// ============================================

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_GPS_FETCH': {
      if (state.status !== 'idle' && state.status !== 'gps_error') {
        return state;
      }
      return { status: 'fetching_gps' };
    }

    case 'GPS_SUCCESS': {
      if (state.status !== 'fetching_gps' && state.status !== 'refreshing_gps') {
        return state;
      }
      if (state.status === 'refreshing_gps') {
        return { ...state, status: 'ready', latitude: action.latitude, longitude: action.longitude };
      }
      return {
        status: 'ready',
        latitude: action.latitude,
        longitude: action.longitude,
        title: '',
        body: '',
        photos: [],
      };
    }

    case 'GPS_FAIL': {
      if (state.status !== 'fetching_gps' && state.status !== 'refreshing_gps') {
        return state;
      }
      if (state.status === 'refreshing_gps') {
        return { ...state, status: 'ready' };
      }
      return { status: 'gps_error', message: action.message };
    }

    case 'RETRY_GPS': {
      if (state.status !== 'gps_error') { return state; }
      return { status: 'fetching_gps' };
    }

    case 'REFRESH_GPS': {
      if (state.status !== 'ready' && state.status !== 'submit_error') return state;
      return { ...state, status: 'refreshing_gps' };
    }

    case 'EDIT_TITLE': {
      if (state.status !== 'ready' && state.status !== 'submit_error') { return state; }
      return { ...state, title: action.value };
    }

    case 'EDIT_BODY': {
      if (state.status !== 'ready' && state.status !== 'submit_error') { return state; }
      return { ...state, body: action.value };
    }

    case 'SUBMIT': {
      if (state.status !== 'ready') { return state; }
      return {
        status: 'checking_duplicate',
        latitude: state.latitude,
        longitude: state.longitude,
        title: state.title,
        body: state.body,
        photos: state.photos,
      };
    }

    case 'DUPLICATE_FOUND': {
      if (state.status !== 'checking_duplicate') return state;
      return { ...state, status: 'duplicate_warning', nearbyTitle: action.nearbyTitle };
    }

    case 'NO_DUPLICATE': {
      if (state.status !== 'checking_duplicate') return state;
      return { ...state, status: 'submitting' };
    }

    case 'CONFIRM_DUPLICATE': {
      if (state.status !== 'duplicate_warning') return state;
      return {
        status: 'submitting',
        latitude: state.latitude,
        longitude: state.longitude,
        title: state.title,
        body: state.body,
        photos: state.photos,
      };
    }

    case 'CANCEL_DUPLICATE': {
      if (state.status !== 'duplicate_warning') return state;
      return {
        status: 'ready',
        latitude: state.latitude,
        longitude: state.longitude,
        title: state.title,
        body: state.body,
        photos: state.photos,
      };
    }

    case 'RETRY_SUBMIT': {
      if (state.status !== 'submit_error') { return state; }
      return {
        status: 'submitting',
        latitude: state.latitude,
        longitude: state.longitude,
        title: state.title,
        body: state.body,
        photos: state.photos,
      };
    }

    case 'SUBMIT_SUCCESS': {
      if (state.status !== 'submitting') { return state; }
      return { status: 'success' };
    }

    case 'SUBMIT_FAIL': {
      if (state.status !== 'submitting') { return state; }
      return {
        status: 'submit_error',
        latitude: state.latitude,
        longitude: state.longitude,
        title: state.title,
        body: state.body,
        message: action.message,
        photos: state.photos,
      };
    }

    case 'PHOTOS_PICKED': {
      if (state.status !== 'ready' && state.status !== 'submit_error') { return state; }
      const newItems: PhotoItem[] = action.items.map((item) => ({
        id: item.id,
        phase: 'uploading',
        localUri: item.localUri,
      }));
      return { ...state, photos: [...state.photos, ...newItems] };
    }

    case 'PHOTO_UPLOAD_SUCCESS': {
      if (
        state.status !== 'ready' &&
        state.status !== 'submit_error' &&
        state.status !== 'submitting'
      ) { return state; }
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id
            ? { id: p.id, phase: 'uploaded', localUri: p.localUri, publicUrl: action.publicUrl }
            : p,
        ),
      };
    }

    case 'PHOTO_UPLOAD_FAIL': {
      if (
        state.status !== 'ready' &&
        state.status !== 'submit_error' &&
        state.status !== 'submitting'
      ) { return state; }
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id
            ? { id: p.id, phase: 'error', localUri: p.localUri, errorMessage: action.errorMessage }
            : p,
        ),
      };
    }

    case 'REMOVE_PHOTO': {
      if (state.status !== 'ready' && state.status !== 'submit_error') { return state; }
      return { ...state, photos: state.photos.filter((p) => p.id !== action.id) };
    }

    case 'RESET':
      return { status: 'fetching_gps' };
  }
}

// ============================================
// END of hand-written section (reducer part)
// ============================================

// ─────────────────────────────────────────────────────────────────────────────
// renderScreen — maps every state variant to its UI. Machine-written.
// ─────────────────────────────────────────────────────────────────────────────

type FormState =
  | { status: 'ready'; latitude: number; longitude: number; title: string; body: string; photos: PhotoItem[] }
  | { status: 'refreshing_gps'; latitude: number; longitude: number; title: string; body: string; photos: PhotoItem[] }
  | { status: 'checking_duplicate'; latitude: number; longitude: number; title: string; body: string; photos: PhotoItem[] }
  | { status: 'submitting'; latitude: number; longitude: number; title: string; body: string; photos: PhotoItem[] }
  | {
      status: 'submit_error';
      latitude: number;
      longitude: number;
      title: string;
      body: string;
      message: string;
      photos: PhotoItem[];
    };

// ── Photo strip ──────────────────────────────────────────────────────────────

function renderPhotoStrip(
  photos: PhotoItem[],
  dispatch: React.Dispatch<Action>,
  disabled: boolean,
  onPickPhotos: () => void,
): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.photoStrip}
      keyboardShouldPersistTaps="handled"
    >
      {photos.map((photo) => (
        <View key={photo.id} style={styles.photoThumb}>
          <Image source={{ uri: photo.localUri }} style={styles.photoThumbImg} resizeMode="cover" />

          {photo.phase === 'uploading' && (
            <View style={styles.thumbOverlay}>
              <ActivityIndicator color={RC.parchment} size="small" />
            </View>
          )}
          {photo.phase === 'uploaded' && (
            <View style={[styles.thumbOverlay, styles.thumbOverlaySuccess]}>
              <Text style={styles.thumbOverlayIcon}>✓</Text>
            </View>
          )}
          {photo.phase === 'error' && (
            <View style={[styles.thumbOverlay, styles.thumbOverlayError]}>
              <Text style={styles.thumbOverlayIcon}>!</Text>
            </View>
          )}

          {!disabled && photo.phase !== 'uploading' && (
            <TouchableOpacity
              style={styles.thumbRemove}
              onPress={() => dispatch({ type: 'REMOVE_PHOTO', id: photo.id })}
            >
              <Text style={styles.thumbRemoveText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {!disabled && (
        <TouchableOpacity style={styles.photoAddTile} onPress={onPickPhotos}>
          <Text style={styles.photoAddIcon}>+</Text>
          <Text style={styles.photoAddLabel}>ADD{'\n'}PHOTO</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function renderForm(
  state: FormState,
  dispatch: React.Dispatch<Action>,
  onPickPhotos: () => void,
): React.JSX.Element {
  const isRefreshing = state.status === 'refreshing_gps';
  const isSubmitting = state.status === 'submitting' || state.status === 'checking_duplicate';
  const errorBanner = state.status === 'submit_error' ? state.message : null;
  const coords = `${Math.abs(state.latitude).toFixed(5)}° ${state.latitude >= 0 ? 'N' : 'S'}   ${Math.abs(state.longitude).toFixed(5)}° ${state.longitude >= 0 ? 'E' : 'W'}`;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionHeaderText}>NEW LOG ENTRY</Text>
        </View>
        <View style={styles.sectionDivider} />

        {errorBanner !== null && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorBanner}</Text>
          </View>
        )}

        {/* Coordinates row */}
        <View style={styles.coordsRow}>
          <Text style={styles.coordsText}>{coords}</Text>
          {isRefreshing ? (
            <ActivityIndicator size="small" color={RC.hunter} style={styles.refreshSpinner} />
          ) : (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => dispatch({ type: 'REFRESH_GPS' })}
              disabled={isSubmitting}
            >
              <Text style={styles.refreshButtonText}>↻</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sectionDivider} />

        <TextInput
          style={styles.input}
          placeholder="TITLE (OPTIONAL)"
          placeholderTextColor={RC.rule}
          value={state.title}
          onChangeText={(value) => dispatch({ type: 'EDIT_TITLE', value })}
          editable={!isSubmitting}
          returnKeyType="next"
          maxLength={120}
        />

        <TextInput
          style={[styles.input, styles.bodyInput]}
          placeholder="What happened here?"
          placeholderTextColor={RC.dust}
          value={state.body}
          onChangeText={(value) => dispatch({ type: 'EDIT_BODY', value })}
          editable={!isSubmitting}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.sectionDivider} />

        {renderPhotoStrip(state.photos, dispatch, isSubmitting, onPickPhotos)}

        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
          onPress={() =>
            dispatch(
              state.status === 'submit_error' ? { type: 'RETRY_SUBMIT' } : { type: 'SUBMIT' },
            )
          }
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={RC.parchment} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {state.status === 'submit_error' ? 'RETRY' : 'LOG ENTRY'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
          disabled={isSubmitting}
        >
          <Text style={[styles.secondaryButtonText, isSubmitting && styles.textDisabled]}>
            CANCEL
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const DUPLICATE_THRESHOLD_METERS = 75;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function renderScreen(
  state: State,
  dispatch: React.Dispatch<Action>,
  onPickPhotos: () => void,
): React.JSX.Element {
  switch (state.status) {
    case 'idle':
      return (
        <View style={styles.centered}>
          <Text style={styles.mutedText}>ACQUIRING POSITION…</Text>
        </View>
      );

    case 'fetching_gps':
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={RC.hunter} />
          <Text style={[styles.mutedText, styles.spacingTop]}>ACQUIRING POSITION…</Text>
        </View>
      );

    case 'gps_error':
      return (
        <View style={styles.centered}>
          <View style={styles.warningBadge}>
            <Text style={styles.warningBadgeText}>!</Text>
          </View>
          <Text style={styles.errorMessage}>{state.message}</Text>
          <View style={styles.warnButtonStack}>
            <TouchableOpacity
              style={styles.warnPrimaryButton}
              onPress={() => dispatch({ type: 'RETRY_GPS' })}
            >
              <Text style={styles.warnButtonText}>RETRY</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.warnCancelButton} onPress={() => router.back()}>
              <Text style={styles.warnButtonText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      );

    case 'ready':
    case 'refreshing_gps':
    case 'checking_duplicate':
    case 'submitting':
    case 'submit_error':
      return renderForm(state, dispatch, onPickPhotos);

    case 'duplicate_warning':
      return (
        <View style={styles.centered}>
          <View style={styles.warningBadge}>
            <Text style={styles.warningBadgeText}>!</Text>
          </View>
          <Text style={styles.warningTitle}>ALREADY PINNED HERE?</Text>
          <Text style={styles.warningBody}>
            {state.nearbyTitle
              ? `"${state.nearbyTitle}" is already pinned nearby.`
              : 'You already have an entry pinned nearby.'}
            {'\n'}Still proceed?
          </Text>
          <View style={styles.warnButtonStack}>
            <TouchableOpacity
              style={styles.warnPrimaryButton}
              onPress={() => dispatch({ type: 'CONFIRM_DUPLICATE' })}
            >
              <Text style={styles.warnButtonText}>YES, LOG ANYWAY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.warnCancelButton}
              onPress={() => dispatch({ type: 'CANCEL_DUPLICATE' })}
            >
              <Text style={styles.warnButtonText}>GO BACK</Text>
            </TouchableOpacity>
          </View>
        </View>
      );

    case 'success':
      return (
        <View style={styles.centered}>
          {/* Constructivist success mark */}
          <View style={styles.successMark}>
            <View style={styles.successMarkBar} />
            <View style={[styles.successMarkBar, styles.successMarkBarShort]} />
          </View>
          <Text style={styles.successText}>ENTRY LOGGED</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.navigate('/(tabs)')}
          >
            <Text style={styles.primaryButtonText}>RETURN TO MAP</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => dispatch({ type: 'RESET' })}
          >
            <Text style={styles.secondaryButtonText}>LOG ANOTHER ENTRY</Text>
          </TouchableOpacity>
        </View>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen component
// ─────────────────────────────────────────────────────────────────────────────

export default function NewEntryScreen() {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });
  const confettiRef = useRef<ConfettiCannon>(null);
  const inFlightUploads = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (state.status === 'success') {
      confettiRef.current?.start();
    }
  }, [state.status]);

  useEffect(() => {
    dispatch({ type: 'START_GPS_FETCH' });
  }, []);

  useEffect(() => {
    if (state.status !== 'fetching_gps' && state.status !== 'refreshing_gps') return;

    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== 'granted') {
        dispatch({ type: 'GPS_FAIL', message: 'Location permission denied.' });
        return;
      }

      try {
        const loc = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        dispatch({
          type: 'GPS_SUCCESS',
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch (e) {
        if (cancelled) return;
        dispatch({
          type: 'GPS_FAIL',
          message: e instanceof Error ? e.message : 'Could not get location.',
        });
      }
    })();

    return () => { cancelled = true; };
  }, [state.status]);

  useEffect(() => {
    if (state.status !== 'checking_duplicate') return;

    let cancelled = false;
    const { latitude, longitude } = state;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const { data, error } = await supabase
        .from('entries')
        .select('latitude, longitude, title')
        .eq('user_id', user.id);

      if (cancelled) return;

      if (error || !data) {
        dispatch({ type: 'NO_DUPLICATE' });
        return;
      }

      const nearby = data.find(
        (entry) =>
          haversineMeters(latitude, longitude, entry.latitude, entry.longitude) <=
          DUPLICATE_THRESHOLD_METERS,
      );

      if (nearby) {
        dispatch({ type: 'DUPLICATE_FOUND', nearbyTitle: nearby.title ?? null });
      } else {
        dispatch({ type: 'NO_DUPLICATE' });
      }
    })();

    return () => { cancelled = true; };
  }, [state.status]);

  const isFormState =
    state.status === 'ready' ||
    state.status === 'refreshing_gps' ||
    state.status === 'submit_error' ||
    state.status === 'submitting';
  const allPhotos: PhotoItem[] = isFormState ? state.photos : [];
  const uploadingIds = allPhotos
    .filter((p) => p.phase === 'uploading')
    .map((p) => p.id)
    .join(',');

  useEffect(() => {
    if (!uploadingIds) return;

    const toUpload = allPhotos.filter(
      (p) => p.phase === 'uploading' && !inFlightUploads.current.has(p.id),
    );

    for (const photo of toUpload) {
      inFlightUploads.current.add(photo.id);
      (async () => {
        try {
          const fileName = `${photo.id}.jpg`;
          const buffer = await new ExpoFile(photo.localUri).arrayBuffer();
          const bytes = new Uint8Array(buffer);

          const { error } = await supabase.storage
            .from('entry-photos')
            .upload(fileName, bytes, { contentType: 'image/jpeg' });

          if (error) {
            dispatch({ type: 'PHOTO_UPLOAD_FAIL', id: photo.id, errorMessage: error.message });
          } else {
            const { data } = supabase.storage.from('entry-photos').getPublicUrl(fileName);
            dispatch({ type: 'PHOTO_UPLOAD_SUCCESS', id: photo.id, publicUrl: data.publicUrl });
          }
        } finally {
          inFlightUploads.current.delete(photo.id);
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadingIds]);

  useEffect(() => {
    if (state.status !== 'submitting') return;

    let cancelled = false;
    const { latitude, longitude, title, body, photos } = state;

    (async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (cancelled) return;
      if (userError || !user) {
        dispatch({ type: 'SUBMIT_FAIL', message: 'Not authenticated.' });
        return;
      }

      const uploadedUrls = photos
        .filter((p): p is Extract<PhotoItem, { phase: 'uploaded' }> => p.phase === 'uploaded')
        .map((p) => p.publicUrl);

      const { error } = await supabase.from('entries').insert({
        user_id: user.id,
        latitude,
        longitude,
        title: title.trim() || null,
        body: body.trim() || null,
        photo_url: uploadedUrls[0] ?? null,
        photos: uploadedUrls,
        visibility: 'private',
      });

      if (cancelled) return;

      if (error) {
        dispatch({ type: 'SUBMIT_FAIL', message: error.message });
        return;
      }

      dispatch({ type: 'SUBMIT_SUCCESS' });
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
      if (cancelled) return;
      router.navigate('/(tabs)');
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const handlePickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;

    const items = result.assets.map((asset) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      localUri: asset.uri,
    }));
    dispatch({ type: 'PHOTOS_PICKED', items });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderScreen(state, dispatch, handlePickPhotos)}
      <ConfettiCannon
        ref={confettiRef}
        count={180}
        origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
        autoStart={false}
        fadeOut
        fallSpeed={2800}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const THUMB_SIZE = 90;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: RC.parchment },
  flex: { flex: 1 },

  // ── centered states ──
  centered: {
    flex: 1,
    backgroundColor: RC.parchment,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 22,
  },
  mutedText: {
    fontSize: 11,
    color: RC.dust,
    letterSpacing: 2,
    fontWeight: '700',
    fontFamily: Fonts?.mono ?? 'Courier New',
  },
  spacingTop: { marginTop: 12 },

  // ── warning / error badge ──
  warningBadge: {
    width: 52,
    height: 52,
    borderWidth: 2.5,
    borderColor: RC.inkRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningBadgeText: {
    fontSize: 24,
    fontWeight: '800',
    color: RC.inkRed,
  },
  errorMessage: {
    fontSize: 13,
    color: RC.inkRed,
    textAlign: 'center',
    fontFamily: Fonts?.mono ?? 'Courier New',
    letterSpacing: 0.3,
    lineHeight: 20,
  },

  // ── success mark ──
  successMark: {
    width: 52,
    height: 52,
    borderWidth: 2.5,
    borderColor: RC.hunter,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    transform: [{ rotate: '-15deg' }],
  },
  successMarkBar: {
    width: 24,
    height: 3,
    backgroundColor: RC.hunter,
  },
  successMarkBarShort: {
    width: 14,
  },
  successText: {
    fontSize: 14,
    fontWeight: '700',
    color: RC.ink,
    letterSpacing: 3,
  },

  // ── form ──
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    backgroundColor: RC.inkRed,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: RC.ink,
    letterSpacing: 3,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: RC.rule,
  },
  errorBanner: {
    borderLeftWidth: 3,
    borderLeftColor: RC.inkRed,
    backgroundColor: 'rgba(140,26,16,0.07)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorBannerText: {
    fontSize: 12,
    color: RC.inkRed,
    fontFamily: Fonts?.mono ?? 'Courier New',
    letterSpacing: 0.3,
  },

  // ── coordinates row ──
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: RC.rule,
    backgroundColor: RC.aged,
    gap: 8,
  },
  coordsText: {
    fontSize: 15,
    color: RC.graphite,
    flex: 1,
    fontFamily: Fonts?.mono ?? 'Courier New',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  refreshButton: {
    width: 28,
    height: 28,
    borderWidth: 1.5,
    borderColor: RC.hunter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 16,
    color: RC.hunter,
    lineHeight: 20,
  },
  refreshSpinner: { width: 28, height: 28 },

  // ── inputs ──
  input: {
    borderWidth: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: RC.rule,
    paddingHorizontal: 0,
    paddingVertical: 10,
    fontSize: 16,
    color: RC.ink,
    backgroundColor: 'transparent',
    fontFamily: Fonts?.serif ?? 'Georgia',
  },
  bodyInput: {
    borderWidth: 1,
    borderColor: RC.rule,
    borderBottomWidth: 1,
    borderBottomColor: RC.rule,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 120,
    paddingTop: 12,
    backgroundColor: RC.aged,
  },

  // ── buttons ──
  primaryButton: {
    height: 54,
    backgroundColor: RC.hunter,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: {
    color: '#F5F2E7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  secondaryButton: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: RC.inkRed,
    marginTop: 0,
  },
  secondaryButtonText: {
    color: '#F5F2E7',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  textDisabled: { opacity: 0.4 },

  // ── duplicate warning ──
  warningTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: RC.ink,
    textAlign: 'center',
    letterSpacing: 2,
  },
  warningBody: {
    fontSize: 16,
    color: RC.graphite,
    textAlign: 'center',
    lineHeight: 26,
    fontFamily: Fonts?.serif ?? 'Georgia',
    fontWeight: '500',
  },
  warnButtonStack: {
    width: '80%',
    gap: 10,
    alignItems: 'stretch',
  },
  warnPrimaryButton: {
    height: 56,
    backgroundColor: RC.hunter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warnCancelButton: {
    height: 56,
    backgroundColor: RC.inkRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warnButtonText: {
    color: '#F5F2E7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.5,
  },

  // ── photo strip ──
  photoStrip: {
    gap: 10,
    paddingVertical: 4,
    minHeight: THUMB_SIZE + 8,
  },
  photoThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RC.rule,
  },
  photoThumbImg: { width: '100%', height: '100%' },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbOverlaySuccess: { backgroundColor: 'rgba(28,56,41,0.5)' },
  thumbOverlayError: { backgroundColor: 'rgba(140,26,16,0.6)' },
  thumbOverlayIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
  thumbRemove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 22,
    height: 22,
    backgroundColor: 'rgba(140,26,16,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbRemoveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  photoAddTile: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: RC.hunter,
    backgroundColor: RC.aged,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  photoAddIcon: {
    fontSize: 20,
    color: RC.hunter,
    fontWeight: '700',
  },
  photoAddLabel: {
    fontSize: 9,
    color: RC.dust,
    textAlign: 'center',
    lineHeight: 13,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
});
