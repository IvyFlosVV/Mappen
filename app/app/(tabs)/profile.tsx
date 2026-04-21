import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/src/lib/auth';
import { Fonts, RC } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const EMOJIS = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨',
  '🐯','🦁','🐮','🐷','🐸','🐵','🐧','🐦','🐤','🦄',
  '🐺','🐴','🦋','🐝','🐬','🐟','🐍','🦀','🐳','🐙',
];

// 9 swatches that fit the cream/dark-green/dark-red palette
const COLORS = [
  '#F2A7BB',
  '#B8D0E8',
  '#A8DDD1',
  '#E8A48C',
  '#5B8F8A',
  '#9B7BBF',
  '#2E5490',
  '#7D2340',
  '#E87878',
  '#8DC56A',
  '#9E8880',
  '#8B6BAE',
  '#F0EFA0',
  '#9B9BC8',
  '#C47890',
];

const AVATAR_SIZE = 96;

// ─────────────────────────────────────────────────────────────────────────────
// Shared Avatar component (also exported for Friends screen)
// ─────────────────────────────────────────────────────────────────────────────

export function Avatar({
  emoji,
  color,
  size = 36,
}: {
  emoji?: string | null;
  color?: string | null;
  size?: number;
}) {
  const bg = color ?? '#9B9390';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.12)',
      }}
    >
      <Text style={{ fontSize: size * 0.48, lineHeight: size * 0.6 }}>
        {emoji ?? '?'}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  username: string;
  invite_code: string;
  avatar_emoji: string | null;
  avatar_color: string | null;
}

async function fetchProfile(token: string): Promise<ProfileData> {
  const res = await fetch(`${API_URL}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to load profile');
  return json as ProfileData;
}

async function patchProfile(
  token: string,
  emoji: string,
  color: string,
  username: string,
): Promise<ProfileData> {
  const res = await fetch(`${API_URL}/api/profile`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ avatar_emoji: emoji, avatar_color: color, username }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to save profile');
  return json as ProfileData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { session, signOut } = useAuth();

  // Keep a ref so the focus callback is always stable (empty dep array),
  // avoiding re-fires on every token refresh.
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState<string>(EMOJIS[0]);
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0]);
  const [draftUsername, setDraftUsername] = useState<string>('');
  const [usernameError, setUsernameError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const token = sessionRef.current?.access_token;
      if (!token) return;
      setLoading(true);
      fetchProfile(token)
        .then((data) => {
          setProfile(data);
          setSelectedEmoji(data.avatar_emoji ?? EMOJIS[0]);
          setSelectedColor(data.avatar_color ?? COLORS[0]);
          setDraftUsername(data.username ?? '');
          setUsernameError('');
          setDirty(false);
        })
        .catch((err: unknown) => {
          console.error('[ProfileScreen]', err);
        })
        .finally(() => setLoading(false));
    }, []), // stable — never re-runs due to token refresh
  );

  const handleUsernameChange = (text: string) => {
    const filtered = text.replace(/[^a-zA-Z0-9_]/g, '');
    setDraftUsername(filtered);
    if (filtered.length > 0 && filtered.length < 2) {
      setUsernameError('At least 2 characters required');
    } else {
      setUsernameError('');
    }
    setDirty(true);
  };

  const handleSelectEmoji = (e: string) => {
    setSelectedEmoji(e);
    setDirty(true);
  };

  const handleSelectColor = (c: string) => {
    setSelectedColor(c);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!session?.access_token) return;
    if (draftUsername.length < 2) {
      setUsernameError('At least 2 characters required');
      return;
    }
    setSaving(true);
    try {
      const updated = await patchProfile(session.access_token, selectedEmoji, selectedColor, draftUsername);
      setProfile(updated);
      setDraftUsername(updated.username ?? draftUsername);
      setDirty(false);
    } catch (err: unknown) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={RC.hunter} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── HEADER BAR ────────────────────────────────────────────────── */}
      <View style={styles.headerBar}>
        <View style={styles.headerRule} />
        <Text style={styles.headerLabel}>PROFILE</Text>
        <View style={styles.headerRule} />
      </View>

      {/* ── AVATAR DISPLAY ────────────────────────────────────────────── */}
      <View style={styles.avatarSection}>
        <View
          style={[
            styles.avatarCircle,
            { backgroundColor: selectedColor, width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
          ]}
        >
          <Text style={styles.avatarEmoji}>{selectedEmoji}</Text>
        </View>
        <View style={[styles.usernameRow, usernameError ? styles.usernameRowError : null]}>
          <TextInput
            style={styles.usernameInput}
            value={draftUsername}
            onChangeText={handleUsernameChange}
            placeholder="username"
            placeholderTextColor={RC.dust}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
          <IconSymbol name="pencil" size={14} color="#C8C4BE" />
        </View>
        {usernameError ? (
          <Text style={styles.usernameErrorText}>{usernameError}</Text>
        ) : null}
        <View style={styles.inviteCodeRow}>
          <Text style={styles.inviteLabel}>CODE</Text>
          <Text style={styles.inviteCode}>{profile?.invite_code?.toUpperCase() ?? '—'}</Text>
        </View>
      </View>

      {/* ── EMOJI PICKER ──────────────────────────────────────────────── */}
      <SectionHeader label="CHOOSE AVATAR" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.emojiStrip}
      >
        {EMOJIS.map((e) => (
          <TouchableOpacity
            key={e}
            style={[
              styles.emojiTile,
              selectedEmoji === e && styles.emojiTileSelected,
            ]}
            onPress={() => handleSelectEmoji(e)}
            activeOpacity={0.7}
          >
            <Text style={styles.emojiGlyph}>{e}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── COLOR PICKER ──────────────────────────────────────────────── */}
      <SectionHeader label="CHOOSE COLOR" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.colorStrip}
      >
        {COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              styles.colorSwatch,
              { backgroundColor: c },
              selectedColor === c && styles.colorSwatchSelected,
            ]}
            onPress={() => handleSelectColor(c)}
            activeOpacity={0.7}
          />
        ))}
      </ScrollView>

      {/* ── SAVE ──────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!dirty || saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator size="small" color={RC.parchment} />
        ) : (
          <Text style={styles.saveBtnText}>SAVE CHANGES</Text>
        )}
      </TouchableOpacity>

      {/* ── SIGN OUT ──────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Text style={styles.signOutBtnText}>SIGN OUT</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionRule} />
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const MONO = Fonts?.mono ?? 'Courier New';

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: RC.parchment,
    justifyContent: 'center',
    alignItems: 'center',
  },
  root: {
    flex: 1,
    backgroundColor: RC.parchment,
  },
  content: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Header bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  headerRule: {
    flex: 1,
    height: 2,
    backgroundColor: RC.heavyRule,
  },
  headerLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: RC.ink,
    letterSpacing: 5,
    fontFamily: MONO,
  },

  // Avatar section
  avatarSection: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  avatarCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 46,
    lineHeight: 58,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#C8C4BE',
    marginTop: 4,
    paddingBottom: 4,
    gap: 6,
    width: '100%',
  },
  usernameRowError: {
    borderBottomColor: RC.inkRed,
  },
  usernameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: RC.ink,
    letterSpacing: 2,
    fontFamily: Fonts?.serif ?? 'Georgia',
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
    flexShrink: 1,
    backgroundColor: 'transparent',
  },
  usernameErrorText: {
    fontSize: 11,
    color: RC.inkRed,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: MONO,
    marginTop: 2,
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: RC.rule,
    backgroundColor: RC.aged,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  inviteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: RC.dust,
    letterSpacing: 2,
    fontFamily: MONO,
  },
  inviteCode: {
    fontSize: 18,
    fontWeight: '700',
    color: RC.hunter,
    letterSpacing: 4,
    fontFamily: MONO,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 14,
  },
  sectionRule: {
    flex: 1,
    height: 1.5,
    backgroundColor: RC.heavyRule,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: RC.graphite,
    letterSpacing: 3,
    fontFamily: MONO,
  },

  // Emoji picker
  emojiStrip: {
    gap: 8,
    paddingBottom: 4,
  },
  emojiTile: {
    width: 52,
    height: 52,
    borderWidth: 1.5,
    borderColor: RC.rule,
    backgroundColor: RC.aged,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiTileSelected: {
    borderWidth: 2.5,
    borderColor: RC.hunter,
    backgroundColor: RC.vellum,
  },
  emojiGlyph: {
    fontSize: 26,
    lineHeight: 34,
  },

  // Color picker
  colorStrip: {
    gap: 10,
    paddingBottom: 4,
    alignItems: 'center',
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: RC.parchment,
    shadowColor: RC.ink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },

  // Save button
  saveBtn: {
    marginTop: 28,
    height: 50,
    backgroundColor: RC.hunter,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: RC.hunter,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: RC.parchment,
    letterSpacing: 3,
    fontFamily: MONO,
  },

  // Sign out button
  signOutBtn: {
    marginTop: 14,
    height: 50,
    borderWidth: 2,
    borderColor: RC.inkRed,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  signOutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: RC.inkRed,
    letterSpacing: 3,
    fontFamily: MONO,
  },

  bottomSpacer: { height: 20 },
});
