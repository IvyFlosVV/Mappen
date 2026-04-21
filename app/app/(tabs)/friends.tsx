import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
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
import { supabase } from '@/src/lib/supabase';
import { Fonts, RC } from '@/constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FriendProfile {
  id: string;
  username: string;
  invite_code?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API helper
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function friendsApi(
  path: string,
  method: 'GET' | 'POST',
  accessToken: string,
  body?: object,
): Promise<unknown> {
  const url = `${API_URL}${path}`;
  console.log('[friendsApi] fetching:', url);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Request failed');
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function FriendsScreen() {
  const { session } = useAuth();

  const [myCode, setMyCode] = useState<string>('');
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pending, setPending] = useState<FriendProfile[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch current user's invite code
  const fetchMyCode = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('profiles')
      .select('invite_code')
      .eq('id', session.user.id)
      .single();
    if (data?.invite_code) setMyCode(data.invite_code.toUpperCase());
  }, [session]);

  // Fetch accepted friends and pending requests
  const fetchFriendsData = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const [friendsData, pendingData] = await Promise.all([
        friendsApi('/api/friends', 'GET', session.access_token),
        friendsApi('/api/friends/pending', 'GET', session.access_token),
      ]);
      setFriends(friendsData as FriendProfile[]);
      setPending(pendingData as FriendProfile[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load friends';
      console.error('[FriendsScreen]', msg);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([fetchMyCode(), fetchFriendsData()]).finally(() =>
        setLoading(false),
      );
    }, [fetchMyCode, fetchFriendsData]),
  );

  const handleCopy = () => {
    Clipboard.setString(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddFriend = async () => {
    const code = codeInput.trim().toLowerCase();
    if (!code || !session?.access_token) return;
    setAdding(true);
    try {
      const result = await friendsApi(
        '/api/friends/request',
        'POST',
        session.access_token,
        { invite_code: code },
      );
      const msg = (result as { message?: string }).message ?? 'Request sent';
      Alert.alert('Request Sent', msg);
      setCodeInput('');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAdding(false);
    }
  };

  const handleAccept = async (requesterId: string) => {
    if (!session?.access_token) return;
    setAccepting(requesterId);
    try {
      await friendsApi('/api/friends/accept', 'POST', session.access_token, {
        user_id: requesterId,
      });
      // Optimistically move from pending → friends
      const accepted = pending.find((p) => p.id === requesterId);
      if (accepted) {
        setPending((prev) => prev.filter((p) => p.id !== requesterId));
        setFriends((prev) => [...prev, accepted]);
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not accept request');
    } finally {
      setAccepting(null);
    }
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
      keyboardShouldPersistTaps="handled"
    >
      {/* ── YOUR CODE ─────────────────────────────────────────────── */}
      <SectionHeader label="YOUR CODE" />
      <View style={styles.codeBox}>
        <Text style={styles.codeText}>{myCode || '--------'}</Text>
        <TouchableOpacity
          style={[styles.copyBtn, copied && styles.copyBtnActive]}
          onPress={handleCopy}
          activeOpacity={0.75}
        >
          <Text style={styles.copyBtnText}>{copied ? 'COPIED ✓' : 'COPY'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── ADD FRIEND ────────────────────────────────────────────── */}
      <SectionHeader label="ADD FRIEND" />
      <View style={styles.addRow}>
        <TextInput
          style={styles.codeInput}
          value={codeInput}
          onChangeText={setCodeInput}
          placeholder="ENTER INVITE CODE"
          placeholderTextColor={RC.dust}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={8}
        />
        <TouchableOpacity
          style={[styles.addBtn, (adding || !codeInput.trim()) && styles.addBtnDisabled]}
          onPress={handleAddFriend}
          disabled={adding || !codeInput.trim()}
          activeOpacity={0.75}
        >
          {adding ? (
            <ActivityIndicator size="small" color={RC.parchment} />
          ) : (
            <Text style={styles.addBtnText}>ADD</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── PENDING ───────────────────────────────────────────────── */}
      <SectionHeader label="PENDING" />
      {pending.length === 0 ? (
        <EmptyNote text="No incoming requests" />
      ) : (
        <View style={styles.listBlock}>
          {pending.map((person) => (
            <View key={person.id} style={styles.listRow}>
              <View style={styles.listRowLeft}>
                <View style={styles.avatarDot} />
                <Text style={styles.listRowName}>{person.username}</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.acceptBtn,
                  accepting === person.id && styles.acceptBtnDisabled,
                ]}
                onPress={() => handleAccept(person.id)}
                disabled={accepting === person.id}
                activeOpacity={0.75}
              >
                {accepting === person.id ? (
                  <ActivityIndicator size="small" color={RC.parchment} />
                ) : (
                  <Text style={styles.acceptBtnText}>ACCEPT</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ── FRIENDS ───────────────────────────────────────────────── */}
      <SectionHeader label="FRIENDS" />
      {friends.length === 0 ? (
        <EmptyNote text="No friends yet" />
      ) : (
        <View style={styles.listBlock}>
          {friends.map((friend) => (
            <View key={friend.id} style={[styles.listRow, styles.listRowFriend]}>
              <View style={styles.listRowLeft}>
                <View style={[styles.avatarDot, styles.avatarDotFriend]} />
                <Text style={styles.listRowName}>{friend.username}</Text>
              </View>
              {friend.invite_code ? (
                <Text style={styles.friendCode}>
                  {friend.invite_code.toUpperCase()}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

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

function EmptyNote({ text }: { text: string }) {
  return (
    <View style={styles.emptyNote}>
      <Text style={styles.emptyNoteText}>{text}</Text>
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
    gap: 0,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionRule: {
    flex: 1,
    height: 1.5,
    backgroundColor: RC.heavyRule,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: RC.graphite,
    letterSpacing: 3,
    fontFamily: MONO,
  },

  // Your code box
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: RC.hunter,
    backgroundColor: RC.aged,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  codeText: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: RC.hunter,
    letterSpacing: 6,
    fontFamily: MONO,
  },
  copyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: RC.hunter,
    backgroundColor: RC.parchment,
  },
  copyBtnActive: {
    backgroundColor: RC.hunter,
  },
  copyBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: RC.hunter,
    letterSpacing: 1.5,
    fontFamily: MONO,
  },

  // Add friend row
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    height: 46,
    borderWidth: 1.5,
    borderColor: RC.rule,
    backgroundColor: RC.aged,
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: '700',
    color: RC.ink,
    letterSpacing: 2,
    fontFamily: MONO,
  },
  addBtn: {
    height: 46,
    paddingHorizontal: 18,
    backgroundColor: RC.hunter,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
  },
  addBtnDisabled: {
    opacity: 0.45,
  },
  addBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: RC.parchment,
    letterSpacing: 2,
    fontFamily: MONO,
  },

  // List
  listBlock: {
    gap: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 3,
    borderLeftColor: RC.rule,
    borderBottomWidth: 1,
    borderBottomColor: RC.vellum,
    backgroundColor: RC.linen,
    marginBottom: 2,
  },
  listRowFriend: {
    borderLeftColor: RC.hunter,
  },
  listRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RC.inkRed,
  },
  avatarDotFriend: {
    backgroundColor: RC.hunter,
  },
  listRowName: {
    fontSize: 13,
    fontWeight: '700',
    color: RC.ink,
    letterSpacing: 0.5,
    fontFamily: MONO,
    flex: 1,
  },
  friendCode: {
    fontSize: 9,
    color: RC.dust,
    letterSpacing: 2,
    fontFamily: MONO,
    fontWeight: '700',
  },

  // Accept button
  acceptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: RC.inkRed,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
  },
  acceptBtnDisabled: {
    opacity: 0.5,
  },
  acceptBtnText: {
    fontSize: 9,
    fontWeight: '700',
    color: RC.parchment,
    letterSpacing: 1.5,
    fontFamily: MONO,
  },

  // Empty state
  emptyNote: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderLeftWidth: 2,
    borderLeftColor: RC.rule,
    backgroundColor: RC.aged,
  },
  emptyNoteText: {
    fontSize: 11,
    color: RC.dust,
    letterSpacing: 1,
    fontFamily: MONO,
    fontWeight: '700',
  },

  bottomSpacer: { height: 20 },
});
