import React, { useEffect, useReducer } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { supabase } from '@/src/lib/supabase';

// ============================================
// STATE MACHINE — I will write this section myself.
// Leave this block exactly as-is. Do not modify.
// ============================================
type State =
  | { status: 'idle' }
  | { status: 'fetching_gps' }
  | { status: 'gps_error'; message: string }
  | { status: 'ready'; latitude: number; longitude: number; title: string; body: string }
  | { status: 'submitting'; latitude: number; longitude: number; title: string; body: string }
  | { status: 'submit_error'; latitude: number; longitude: number; title: string; body: string; message: string }
  | { status: 'success' };

type Action =
  | { type: 'START_GPS_FETCH' }
  | { type: 'GPS_SUCCESS'; latitude: number; longitude: number }
  | { type: 'GPS_FAIL'; message: string }
  | { type: 'RETRY_GPS' }
  | { type: 'EDIT_TITLE'; value: string }
  | { type: 'EDIT_BODY'; value: string }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_FAIL'; message: string }
  | { type: 'RETRY_SUBMIT' };

// ============================================
// STATE MACHINE — Hand-written by me.
// ============================================

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_GPS_FETCH': {
      // TODO 1: 只有在 idle 或 gps_error 状态下才允许开始 fetch。
      //         其他状态收到这个 action 应该忽略（return state）。
      //         合法时应该返回什么 state？
      return state;
    }

    case 'GPS_SUCCESS': {
      // TODO 2: 只有在 fetching_gps 状态下才接受这个结果。
      //         (为什么要检查？因为用户可能已经点了 Cancel / 或组件 unmount,
      //          这是一个晚到的异步结果。)
      //         合法时应该变成 ready 状态,title 和 body 初始化为空字符串。
      //         lat/lng 从 action 里读。
      return state;
    }

    case 'GPS_FAIL': {
      // TODO 3: 同样只在 fetching_gps 状态下接受。
      //         变成 gps_error,保存 message。
      return state;
    }

    case 'RETRY_GPS': {
      // TODO 4: 只在 gps_error 状态下允许 retry。
      //         应该回到哪个状态?(提示:让下一个 action 天然触发 GPS 重抓)
      return state;
    }

    case 'EDIT_TITLE': {
      // TODO 5: 只有 ready 和 submit_error 状态允许编辑 title。
      //         submitting 状态不允许编辑(UI 已经 disable 了,但 reducer 要 defensive)。
      //         合法时:返回一个新 state,状态不变,title 更新。
      //         注意 TypeScript:需要 spread state 并保留它的 status。
      return state;
    }

    case 'EDIT_BODY': {
      // TODO 6: 和 EDIT_TITLE 对称,只改 body。
      return state;
    }

    case 'SUBMIT': {
      // TODO 7: 只有 ready 状态允许 SUBMIT(submit_error 用 RETRY_SUBMIT)。
      //         变成 submitting,保留所有 form 字段(lat/lng/title/body)。
      return state;
    }

    case 'RETRY_SUBMIT': {
      // TODO 8: 只有 submit_error 状态允许 retry。
      //         变成 submitting,保留所有 form 字段。
      //         (和 SUBMIT 的目标 state 结构相同,但来源 state 不同。)
      return state;
    }

    case 'SUBMIT_SUCCESS': {
      // TODO 9: 只有 submitting 状态接受。
      //         变成 success。
      return state;
    }

    case 'SUBMIT_FAIL': {
      // TODO 10: 只有 submitting 状态接受。
      //          变成 submit_error,保留 form 字段,附上 message。
      return state;
    }
  }
}

// ============================================
// END of hand-written section (reducer part)
// ============================================

// ─────────────────────────────────────────────────────────────────────────────
// renderScreen — maps every state variant to its UI. Machine-written.
// ─────────────────────────────────────────────────────────────────────────────

// Shared state shape for states that own the entry form.
type FormState =
  | { status: 'ready'; latitude: number; longitude: number; title: string; body: string }
  | { status: 'submitting'; latitude: number; longitude: number; title: string; body: string }
  | {
      status: 'submit_error';
      latitude: number;
      longitude: number;
      title: string;
      body: string;
      message: string;
    };

function renderForm(
  state: FormState,
  dispatch: React.Dispatch<Action>,
): React.JSX.Element {
  const isSubmitting = state.status === 'submitting';
  const errorBanner = state.status === 'submit_error' ? state.message : null;
  const coords = `${state.latitude.toFixed(4)}, ${state.longitude.toFixed(4)}`;

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
        {errorBanner !== null && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorBanner}</Text>
          </View>
        )}

        <View style={styles.coordsRow}>
          <Text style={styles.coordsText}>📍 Pinned at {coords}</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Title (optional)"
          placeholderTextColor="#999"
          value={state.title}
          onChangeText={(value) => dispatch({ type: 'EDIT_TITLE', value })}
          editable={!isSubmitting}
          returnKeyType="next"
          maxLength={120}
        />

        <TextInput
          style={[styles.input, styles.bodyInput]}
          placeholder="What happened here?"
          placeholderTextColor="#999"
          value={state.body}
          onChangeText={(value) => dispatch({ type: 'EDIT_BODY', value })}
          editable={!isSubmitting}
          multiline
          textAlignVertical="top"
        />

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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {state.status === 'submit_error' ? 'Retry' : 'Save'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
          disabled={isSubmitting}
        >
          <Text style={[styles.secondaryButtonText, isSubmitting && styles.textDisabled]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function renderScreen(state: State, dispatch: React.Dispatch<Action>): React.JSX.Element {
  switch (state.status) {
    case 'idle':
      return (
        <View style={styles.centered}>
          <Text style={styles.mutedText}>Getting your location…</Text>
        </View>
      );

    case 'fetching_gps':
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={[styles.mutedText, styles.spacingTop]}>Finding your location…</Text>
        </View>
      );

    case 'gps_error':
      return (
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorMessage}>{state.message}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => dispatch({ type: 'RETRY_GPS' })}
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );

    case 'ready':
    case 'submitting':
    case 'submit_error':
      return renderForm(state, dispatch);

    case 'success':
      return (
        <View style={styles.centered}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>Saved!</Text>
        </View>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen component
// ─────────────────────────────────────────────────────────────────────────────

export default function NewEntryScreen() {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  // TODO: useEffect for initial GPS fetch — dispatches START_GPS_FETCH on mount,
  // then calls Location.requestForegroundPermissionsAsync() and
  // Location.getCurrentPositionAsync(). Dispatch GPS_SUCCESS / GPS_FAIL.

  // TODO: useEffect that watches for state.status === 'submitting' and inserts
  // to Supabase:
  //   const { data: { user } } = await supabase.auth.getUser();
  //   supabase.from('entries').insert({
  //     user_id: user.id,
  //     latitude: state.latitude,
  //     longitude: state.longitude,
  //     title: state.title.trim() || null,   // null when empty — matches schema
  //     body: state.body.trim() || null,
  //     visibility: 'private',
  //   })
  // On success: dispatch SUBMIT_SUCCESS then router.back().
  // On error: dispatch SUBMIT_FAIL with the error message.


  return renderScreen(state, dispatch);
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // ── centered (idle / fetching_gps / gps_error / success) ──
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  mutedText: {
    fontSize: 16,
    color: '#888',
  },
  spacingTop: {
    marginTop: 12,
  },
  errorIcon: {
    fontSize: 40,
    color: '#d32f2f',
  },
  errorMessage: {
    fontSize: 15,
    color: '#d32f2f',
    textAlign: 'center',
  },
  successIcon: {
    fontSize: 56,
    color: '#2563eb',
  },
  successText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
  },

  // ── form ──
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 14,
  },
  errorBanner: {
    backgroundColor: '#fdecea',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorBannerText: {
    fontSize: 14,
    color: '#d32f2f',
  },
  coordsRow: {
    paddingBottom: 4,
  },
  coordsText: {
    fontSize: 13,
    color: '#888',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fafafa',
  },
  bodyInput: {
    minHeight: 120,
    paddingTop: 12,
  },

  // ── buttons ──
  primaryButton: {
    height: 50,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 15,
  },
  textDisabled: {
    opacity: 0.4,
  },
});
