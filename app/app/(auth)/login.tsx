import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/src/lib/auth';
import { Fonts, RC } from '@/constants/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) setError(error);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top rule */}
      <View style={styles.topRule} />

      <View style={styles.form}>
        {/* Title block */}
        <View style={styles.titleBlock}>
          <View style={styles.titleAccentBar} />
          <Text style={styles.title}>MAPPEN</Text>
        </View>

        <Text style={styles.subtitle}>FIELD ARCHIVIST PORTAL</Text>

        <View style={styles.divider} />

        <TextInput
          style={styles.input}
          placeholder="EMAIL ADDRESS"
          placeholderTextColor={RC.rule}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!submitting}
        />
        <TextInput
          style={styles.input}
          placeholder="PASSWORD"
          placeholderTextColor={RC.rule}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
        />

        {error !== null && (
          <View style={styles.errorRow}>
            <View style={styles.errorAccent} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={RC.parchment} />
          ) : (
            <Text style={styles.buttonText}>ENTER ARCHIVE</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        <Link href="/(auth)/signup" asChild>
          <TouchableOpacity style={styles.linkContainer}>
            <Text style={styles.linkText}>NEW ARCHIVIST?  CREATE ACCOUNT →</Text>
          </TouchableOpacity>
        </Link>
      </View>

      {/* Bottom rule */}
      <View style={styles.topRule} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RC.parchment,
    justifyContent: 'center',
  },
  topRule: {
    height: 3,
    backgroundColor: RC.hunter,
  },
  form: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 48,
    gap: 16,
    justifyContent: 'center',
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 2,
  },
  titleAccentBar: {
    width: 6,
    height: 46,
    backgroundColor: RC.inkRed,
  },
  title: {
    fontSize: 44,
    fontWeight: '700',
    color: RC.ink,
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 13,
    color: RC.dust,
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: RC.rule,
  },
  input: {
    height: 50,
    borderBottomWidth: 1.5,
    borderBottomColor: RC.rule,
    paddingHorizontal: 0,
    fontSize: 14,
    color: RC.ink,
    backgroundColor: 'transparent',
    letterSpacing: 0.5,
    fontFamily: Fonts?.mono ?? 'Courier New',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  errorAccent: {
    width: 3,
    height: '100%',
    backgroundColor: RC.inkRed,
    minHeight: 16,
  },
  errorText: {
    color: RC.inkRed,
    fontSize: 13,
    fontFamily: Fonts?.mono ?? 'Courier New',
    flex: 1,
    letterSpacing: 0.3,
  },
  button: {
    height: 50,
    backgroundColor: RC.hunter,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: RC.parchment,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },
  linkContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  linkText: {
    color: RC.dust,
    fontSize: 13,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
});
