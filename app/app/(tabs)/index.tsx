import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect } from 'expo-router';

import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/lib/auth';
import { Fonts, RC } from '@/constants/theme';

interface EntryPin {
  id: string;
  latitude: number;
  longitude: number;
  title: string | null;
  body: string | null;
  photo_url: string | null;
  photos: string[];
  created_at: string;
}

const PITTSBURGH = {
  latitude: 40.4406,
  longitude: -79.9959,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.5);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    '  ·  ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

function formatCoords(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}° ${latDir},  ${Math.abs(lon).toFixed(5)}° ${lonDir}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom marker — Retro Constructivist style
// ─────────────────────────────────────────────────────────────────────────────

function EntryMarker({
  pin,
  onPress,
}: {
  pin: EntryPin;
  onPress: (pin: EntryPin) => void;
}) {
  const [tracksViews, setTracksViews] = useState(!!pin.photo_url);
  const handleImageSettled = () => {
    setTimeout(() => setTracksViews(false), 100);
  };

  return (
    <Marker
      coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
      tracksViewChanges={tracksViews}
      onPress={() => onPress(pin)}
    >
      {pin.photo_url ? (
        // Photo marker: square frame with hunter-green border
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderWidth: 3,
              borderColor: RC.hunter,
              overflow: 'hidden',
              backgroundColor: RC.parchment,
            }}
          >
            <Image
              source={{ uri: pin.photo_url }}
              style={{ width: '100%', height: '100%' }}
              onLoad={handleImageSettled}
              onError={handleImageSettled}
            />
          </View>
          {/* Precise connector shaft */}
          <View style={{ width: 3, height: 7, backgroundColor: RC.hunter }} />
          {pin.title ? (
            <View style={{
              backgroundColor: RC.hunter,
              paddingHorizontal: 6,
              paddingVertical: 2,
              maxWidth: 120,
            }}>
              <Text
                style={{ fontSize: 9, fontWeight: '700', color: RC.parchment, letterSpacing: 0.8 }}
                numberOfLines={1}
              >{pin.title}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        // Text-only marker: ink-red teardrop with parchment border
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: RC.inkRed,
              borderWidth: 2.5,
              borderColor: RC.parchment,
              shadowColor: RC.ink,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 2,
            }}
          />
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 5,
              borderRightWidth: 5,
              borderTopWidth: 8,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: RC.inkRed,
              marginTop: -1,
            }}
          />
          {pin.title ? (
            <View style={{
              marginTop: 2,
              backgroundColor: RC.inkRed,
              paddingHorizontal: 6,
              paddingVertical: 2,
              maxWidth: 120,
            }}>
              <Text
                style={{ fontSize: 9, fontWeight: '700', color: RC.parchment, letterSpacing: 0.8 }}
                numberOfLines={1}
              >{pin.title}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Marker>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-screen photo viewer
// ─────────────────────────────────────────────────────────────────────────────

function allPhotosForPin(pin: EntryPin): string[] {
  if (pin.photos && pin.photos.length > 0) return pin.photos;
  if (pin.photo_url) return [pin.photo_url];
  return [];
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function PhotoViewer({
  photos,
  initialIndex,
  onClose,
}: {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [saving, setSaving] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  const handleDownload = async () => {
    const url = photos[currentIndex];
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        setSavedLabel('Permission denied');
        return;
      }
      const downloaded = await File.downloadFileAsync(url, Paths.cache);
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);
      setSavedLabel('Saved to Photos ✓');
    } catch {
      setSavedLabel('Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSavedLabel(null), 2200);
    }
  };

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={viewerStyles.root}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_W,
            offset: SCREEN_W * index,
            index,
          })}
          keyExtractor={(item, i) => `${i}-${item}`}
          renderItem={({ item }) => (
            <View style={viewerStyles.page}>
              <Image source={{ uri: item }} style={viewerStyles.photo} resizeMode="contain" />
            </View>
          )}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setCurrentIndex(idx);
          }}
        />

        <View style={viewerStyles.topBar}>
          <TouchableOpacity
            style={viewerStyles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={viewerStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          {photos.length > 1 && (
            <View style={viewerStyles.counter}>
              <Text style={viewerStyles.counterText}>
                {currentIndex + 1} / {photos.length}
              </Text>
            </View>
          )}
        </View>

        <View style={viewerStyles.bottomBar}>
          {savedLabel ? (
            <Text style={viewerStyles.savedLabel}>{savedLabel}</Text>
          ) : (
            <View />
          )}
          <TouchableOpacity
            style={viewerStyles.downloadBtn}
            onPress={handleDownload}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={RC.parchment} size="small" />
            ) : (
              <View style={viewerStyles.downloadIcon}>
                <View style={viewerStyles.downloadArrowShaft} />
                <View style={viewerStyles.downloadArrowHead} />
                <View style={viewerStyles.downloadTray} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const viewerStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  page: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: { width: SCREEN_W, height: SCREEN_H },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: 'rgba(244,237,216,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { color: RC.parchment, fontSize: 13, fontWeight: '700' },
  counter: {
    borderWidth: 1,
    borderColor: 'rgba(244,237,216,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    color: RC.parchment,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  savedLabel: {
    color: RC.parchment,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingBottom: 6,
  },
  downloadBtn: {
    width: 46,
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(244,237,216,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadIcon: { alignItems: 'center', gap: 1 },
  downloadArrowShaft: { width: 2.5, height: 10, backgroundColor: RC.parchment, borderRadius: 1 },
  downloadArrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: RC.parchment,
    marginTop: -1,
  },
  downloadTray: {
    width: 18,
    height: 3,
    backgroundColor: RC.parchment,
    marginTop: 3,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Bottom sheet — journal detail panel
// ─────────────────────────────────────────────────────────────────────────────

function PinSheet({
  pin,
  onClose,
  onDelete,
  onSave,
}: {
  pin: EntryPin;
  onClose: () => void;
  onDelete: (pin: EntryPin) => void;
  onSave: (updated: EntryPin) => void;
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(pin.title ?? '');
  const [draftBody, setDraftBody] = useState(pin.body ?? '');
  const [draftPhotos, setDraftPhotos] = useState<string[]>(allPhotosForPin(pin));
  const [draftCover, setDraftCover] = useState<string | null>(pin.photo_url);
  const [pendingUploads, setPendingUploads] = useState<Array<{ localUri: string; uploading: boolean }>>([]);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraftTitle(pin.title ?? '');
    setDraftBody(pin.body ?? '');
    setDraftPhotos(allPhotosForPin(pin));
    setDraftCover(pin.photo_url);
    setPendingUploads([]);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setPendingUploads([]);
  };

  const handleAddPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setPendingUploads((prev) => [
      ...prev,
      ...result.assets.map((a) => ({ localUri: a.uri, uploading: false })),
    ]);
  };

  const handleRemoveExistingPhoto = (url: string) => {
    setDraftPhotos((prev) => prev.filter((u) => u !== url));
    if (draftCover === url) {
      const remaining = draftPhotos.filter((u) => u !== url);
      setDraftCover(remaining[0] ?? null);
    }
  };

  const handleRemovePending = (localUri: string) => {
    setPendingUploads((prev) => prev.filter((p) => p.localUri !== localUri));
  };

  const handleSetCover = (url: string) => setDraftCover(url);

  const handleSave = async () => {
    setSaving(true);
    try {
      const uploadedUrls: string[] = [];
      const updatedPending = [...pendingUploads];

      for (let i = 0; i < updatedPending.length; i++) {
        updatedPending[i] = { ...updatedPending[i], uploading: true };
        setPendingUploads([...updatedPending]);

        const { localUri } = updatedPending[i];
        const fileName = `${Date.now()}_${i}.jpg`;
        const buffer = await new File(localUri).arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const { error } = await supabase.storage
          .from('entry-photos')
          .upload(fileName, bytes, { contentType: 'image/jpeg' });

        if (!error) {
          const { data } = supabase.storage.from('entry-photos').getPublicUrl(fileName);
          uploadedUrls.push(data.publicUrl);
        }
        updatedPending[i] = { ...updatedPending[i], uploading: false };
      }

      const finalPhotos = [...draftPhotos, ...uploadedUrls];
      let finalCover = draftCover;
      if (finalCover && !finalPhotos.includes(finalCover)) finalCover = finalPhotos[0] ?? null;
      if (!finalCover && finalPhotos.length > 0) finalCover = finalPhotos[0];

      const { error } = await supabase
        .from('entries')
        .update({
          title: draftTitle.trim() || null,
          body: draftBody.trim() || null,
          photo_url: finalCover,
          photos: finalPhotos,
        })
        .eq('id', pin.id);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      onSave({
        ...pin,
        title: draftTitle.trim() || null,
        body: draftBody.trim() || null,
        photo_url: finalCover,
        photos: finalPhotos,
      });
      setEditing(false);
      setPendingUploads([]);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete this entry?', 'This action is irreversible.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(pin) },
    ]);
  };

  const viewPhotos = allPhotosForPin(pin);

  return (
    <View style={sheetStyles.container}>
      {/* Drag handle */}
      <View style={sheetStyles.handleRow}>
        <View style={sheetStyles.handle} />
      </View>

      {/* ── Header row ── */}
      <View style={sheetStyles.headerRow}>
        {editing ? (
          <TouchableOpacity
            style={sheetStyles.headerCancelBtn}
            onPress={cancelEdit}
            disabled={saving}
          >
            <Text style={sheetStyles.headerBtnText}>CANCEL</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={sheetStyles.iconBtn} onPress={onClose}>
            <Text style={sheetStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}

        <Text style={sheetStyles.headerLabel}>FIELD ENTRY</Text>

        <View style={sheetStyles.headerRight}>
          {editing ? (
            <TouchableOpacity
              style={[sheetStyles.headerSaveBtn, saving && sheetStyles.headerBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={sheetStyles.headerBtnText}>
                {saving ? 'SAVING…' : 'SAVE'}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={sheetStyles.iconBtn} onPress={startEdit}>
                <Text style={sheetStyles.editBtnText}>EDIT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sheetStyles.iconBtn, sheetStyles.deleteBtn]} onPress={confirmDelete}>
                <Text style={sheetStyles.deleteBtnText}>DEL</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Keyboard-aware content area */}
      <KeyboardAvoidingView
        style={sheetStyles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 76 : 0}
      >
      <ScrollView
        style={sheetStyles.scroll}
        contentContainerStyle={sheetStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        {/* ── Metadata block ── */}
        <View style={sheetStyles.metaBlock}>
          <Text style={sheetStyles.meta}>{formatDate(pin.created_at)}</Text>
          <Text style={sheetStyles.meta}>{formatCoords(pin.latitude, pin.longitude)}</Text>
        </View>

        {/* ── Divider ── */}
        <View style={sheetStyles.divider} />

        {/* ── Title ── */}
        {editing ? (
          <TextInput
            style={sheetStyles.titleInput}
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="TITLE"
            placeholderTextColor={RC.rule}
            returnKeyType="next"
          />
        ) : (
          <Text style={sheetStyles.title}>{pin.title ?? 'Untitled Entry'}</Text>
        )}

        {/* ── Body ── */}
        {editing ? (
          <TextInput
            style={sheetStyles.bodyInput}
            value={draftBody}
            onChangeText={setDraftBody}
            placeholder="Add field notes…"
            placeholderTextColor={RC.dust}
            multiline
          />
        ) : (
          pin.body ? <Text style={sheetStyles.body}>{pin.body}</Text> : null
        )}

        {/* ── Divider before photos ── */}
        {(viewPhotos.length > 0 || editing) && <View style={sheetStyles.divider} />}

        {/* ── Photo gallery ── */}
        {editing ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sheetStyles.galleryStrip}
          >
            {draftPhotos.map((url) => {
              const isCover = url === draftCover;
              return (
                <View key={url} style={[sheetStyles.galleryThumb, isCover && sheetStyles.galleryThumbCover]}>
                  <Image source={{ uri: url }} style={sheetStyles.galleryThumbImg} resizeMode="cover" />
                  {isCover && (
                    <View style={sheetStyles.coverBadge}>
                      <Text style={sheetStyles.coverBadgeText}>COVER</Text>
                    </View>
                  )}
                  {!isCover && (
                    <TouchableOpacity style={sheetStyles.setCoverBtn} onPress={() => handleSetCover(url)}>
                      <Text style={sheetStyles.setCoverText}>SET</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={sheetStyles.galleryRemove}
                    onPress={() => handleRemoveExistingPhoto(url)}
                  >
                    <Text style={sheetStyles.galleryRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {pendingUploads.map((p) => (
              <View key={p.localUri} style={sheetStyles.galleryThumb}>
                <Image source={{ uri: p.localUri }} style={sheetStyles.galleryThumbImg} resizeMode="cover" />
                {p.uploading && (
                  <View style={sheetStyles.thumbUploadOverlay}>
                    <ActivityIndicator color={RC.parchment} size="small" />
                  </View>
                )}
                {!p.uploading && (
                  <TouchableOpacity
                    style={sheetStyles.galleryRemove}
                    onPress={() => handleRemovePending(p.localUri)}
                  >
                    <Text style={sheetStyles.galleryRemoveText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity style={sheetStyles.galleryAddTile} onPress={handleAddPhotos}>
              <Text style={sheetStyles.galleryAddIcon}>+</Text>
              <Text style={sheetStyles.galleryAddLabel}>ADD{'\n'}PHOTO</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : viewPhotos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sheetStyles.galleryStrip}
          >
            {viewPhotos.map((url, idx) => {
              const isCover = url === pin.photo_url;
              return (
                <TouchableOpacity
                  key={url}
                  style={[sheetStyles.galleryThumb, isCover && sheetStyles.galleryThumbCover]}
                  onPress={() => setViewerIndex(idx)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: url }} style={sheetStyles.galleryThumbImg} resizeMode="cover" />
                  {isCover && (
                    <View style={sheetStyles.coverBadge}>
                      <Text style={sheetStyles.coverBadgeText}>COVER</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {viewerIndex !== null && (
          <PhotoViewer
            photos={viewPhotos}
            initialIndex={viewerIndex}
            onClose={() => setViewerIndex(null)}
          />
        )}

        {editing && draftPhotos.length === 0 && pendingUploads.length === 0 && (
          <TouchableOpacity onPress={handleAddPhotos} style={sheetStyles.addPhotoBtn}>
            <Text style={sheetStyles.addPhotoBtnText}>+ ADD PHOTOS</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RC.parchment,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 3,
    borderTopColor: RC.hunter,
    paddingTop: 0,
  },
  handleRow: {
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 3,
    backgroundColor: RC.rule,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: RC.heavyRule,
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: RC.dust,
    letterSpacing: 3,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerCancelBtn: {
    height: 34,
    paddingHorizontal: 14,
    backgroundColor: RC.inkRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSaveBtn: {
    height: 34,
    paddingHorizontal: 14,
    backgroundColor: RC.hunter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {
    fontSize: 10,
    color: '#F5F2E7',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  headerBtnDisabled: {
    opacity: 0.55,
  },
  // kept for non-edit close button fallback
  headerAction: {
    fontSize: 10,
    color: RC.dust,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  saveAction: {
    fontSize: 10,
    color: RC.hunter,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  iconBtn: {
    width: 44,
    height: 34,
    backgroundColor: RC.aged,
    borderWidth: 1,
    borderColor: RC.rule,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnWide: {
    height: 34,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnWide: {
    borderColor: RC.hunter,
  },
  closeBtnText: {
    fontSize: 11,
    color: RC.graphite,
    fontWeight: '700',
  },
  editBtnText: {
    fontSize: 10,
    color: RC.graphite,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  deleteBtn: {
    borderColor: RC.inkRed,
    borderLeftWidth: 2.5,
  },
  deleteBtnText: {
    fontSize: 10,
    color: RC.inkRed,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 10,
  },
  metaBlock: {
    borderLeftWidth: 2,
    borderLeftColor: RC.rule,
    paddingLeft: 10,
    gap: 2,
  },
  meta: {
    fontSize: 14,
    color: RC.graphite,
    fontFamily: Fonts?.mono ?? 'Courier New',
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 21,
  },
  divider: {
    height: 1,
    backgroundColor: RC.rule,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: RC.ink,
    fontFamily: Fonts?.serif ?? 'Georgia',
    lineHeight: 28,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '700',
    color: RC.ink,
    fontFamily: Fonts?.serif ?? 'Georgia',
    borderBottomWidth: 2,
    borderBottomColor: RC.graphite,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  body: {
    fontSize: 15,
    color: RC.graphite,
    lineHeight: 24,
    fontFamily: Fonts?.serif ?? 'Georgia',
  },
  bodyInput: {
    fontSize: 15,
    color: RC.graphite,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: RC.graphite,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: RC.aged,
    fontFamily: Fonts?.serif ?? 'Georgia',
  },
  addPhotoBtn: {
    borderWidth: 1.5,
    borderColor: RC.hunter,
    borderStyle: 'dashed',
    paddingVertical: 20,
    alignItems: 'center',
  },
  addPhotoBtnText: {
    fontSize: 11,
    color: RC.hunter,
    fontWeight: '700',
    letterSpacing: 2,
  },
  galleryStrip: {
    gap: 8,
    paddingVertical: 2,
  },
  galleryThumb: {
    width: 110,
    height: 110,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RC.rule,
  },
  galleryThumbCover: {
    borderWidth: 2,
    borderColor: RC.hunter,
  },
  galleryThumbImg: { width: '100%', height: '100%' },
  coverBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: RC.hunter,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  coverBadgeText: {
    color: RC.parchment,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  setCoverBtn: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(28,56,41,0.68)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  setCoverText: {
    color: RC.parchment,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  galleryRemove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 22,
    height: 22,
    backgroundColor: 'rgba(140,26,16,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryRemoveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  thumbUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryAddTile: {
    width: 110,
    height: 110,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: RC.hunter,
    backgroundColor: RC.aged,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  galleryAddIcon: {
    fontSize: 20,
    color: RC.hunter,
    fontWeight: '700',
  },
  galleryAddLabel: {
    fontSize: 9,
    color: RC.dust,
    textAlign: 'center',
    lineHeight: 12,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Map screen
// ─────────────────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const { session, signOut } = useAuth();
  const mapRef = useRef<MapView>(null);
  const [pins, setPins] = useState<EntryPin[]>([]);
  const [locating, setLocating] = useState(false);
  const [selectedPin, setSelectedPin] = useState<EntryPin | null>(null);

  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: selectedPin ? 1 : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 60,
    }).start();
  }, [selectedPin, sheetAnim]);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_HEIGHT, 0],
  });

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      (async () => {
        const { data, error } = await supabase
          .from('entries')
          .select('id, latitude, longitude, title, body, photo_url, photos, created_at')
          .eq('user_id', session.user.id);

        if (error) {
          console.error('[MapScreen] failed to fetch entries:', error.message);
          return;
        }
        setPins((data as EntryPin[]) ?? []);
      })();
    }, [session]),
  );

  const handleLocateMe = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        600,
      );
    } finally {
      setLocating(false);
    }
  };

  const closeSheet = () => setSelectedPin(null);

  const handleDeletePin = async (pin: EntryPin) => {
    const { error } = await supabase.from('entries').delete().eq('id', pin.id);
    if (error) { Alert.alert('Delete failed', error.message); return; }
    setPins((prev) => prev.filter((p) => p.id !== pin.id));
    closeSheet();
  };

  const handleSavePin = (updated: EntryPin) => {
    setPins((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setSelectedPin(updated);
  };

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={PITTSBURGH} showsUserLocation>
        {pins.map((pin) => (
          <EntryMarker key={pin.id} pin={pin} onPress={setSelectedPin} />
        ))}
      </MapView>

      {/* Semi-transparent backdrop */}
      <Animated.View
        pointerEvents={selectedPin ? 'auto' : 'none'}
        style={[
          styles.backdrop,
          { opacity: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) },
        ]}
      >
        <TouchableWithoutFeedback onPress={closeSheet}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        pointerEvents={selectedPin ? 'box-none' : 'none'}
        style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}
      >
        {selectedPin && (
          <PinSheet
            key={selectedPin.id}
            pin={selectedPin}
            onClose={closeSheet}
            onDelete={handleDeletePin}
            onSave={handleSavePin}
          />
        )}
      </Animated.View>

      {/* Locate-me FAB */}
      {!selectedPin && (
        <TouchableOpacity
          style={[styles.fab, Platform.OS === 'ios' && styles.fabIos]}
          onPress={handleLocateMe}
          disabled={locating}
        >
          <Text style={styles.fabText}>{locating ? '…' : '⊕'}</Text>
        </TouchableOpacity>
      )}

      {/* Sign-out — top right */}
      <TouchableOpacity
        style={[styles.signOutButton, Platform.OS === 'ios' && styles.signOutButtonIos]}
        onPress={() => signOut()}
      >
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: RC.ink,
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    shadowColor: RC.ink,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },

  fab: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    width: 48,
    height: 48,
    backgroundColor: RC.hunter,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: RC.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  fabIos: { bottom: 40 },
  fabText: { fontSize: 22, color: RC.parchment, lineHeight: 26 },

  signOutButton: {
    position: 'absolute',
    top: 52,
    right: 16,
    backgroundColor: 'rgba(244,237,216,0.96)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: RC.hunter,
  },
  signOutButtonIos: { top: 60 },
  signOutText: {
    fontSize: 10,
    fontWeight: '700',
    color: RC.hunter,
    letterSpacing: 1.5,
  },
});
