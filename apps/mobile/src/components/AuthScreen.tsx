import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { MIN_SIGNUP_AGE, isOldEnoughToSignUp } from '@travel-planner/shared';
import { api } from '../api';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';
import { Tappable } from './Tappable';

/** Pastes either a bare reset token or the whole emailed link (which points at
 *  the web app's `?token=...`) — mobile has no in-app way to auto-detect the
 *  token the way the web app does from its own URL, so the user brings it here. */
function extractToken(pasted: string): string {
  const match = pasted.match(/token=([^&\s]+)/);
  return (match ? match[1] : pasted).trim();
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [email, setEmail] = useState('');
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const [tokenInput, setTokenInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleRequest = async () => {
    if (!email.trim()) return;
    setRequesting(true);
    setRequestMessage(null);
    try {
      const { message } = await api.forgotPassword(email.trim());
      setRequestMessage(message);
    } catch (err) {
      setRequestMessage(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRequesting(false);
    }
  };

  const handleReset = async () => {
    setResetError(null);
    if (!tokenInput.trim() || newPassword.length < 8) {
      setResetError('Enter the reset code and a password of at least 8 characters.');
      return;
    }
    setResetting(true);
    try {
      await api.resetPassword(extractToken(tokenInput), newPassword);
      setResetDone(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Invalid or expired reset code');
    } finally {
      setResetting(false);
    }
  };

  if (resetDone) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Password reset</Text>
        <Text style={{ color: colors.ink }}>You can log in with your new password now.</Text>
        <Button label="Back to login" onPress={onBack} style={styles.submit} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot password</Text>

      <Text style={styles.sectionLabel}>1. Request a reset link</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.inkSoft}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Button
        label={requesting ? 'Sending…' : 'Send reset link'}
        onPress={handleRequest}
        disabled={requesting}
        style={styles.submit}
      />
      {requestMessage ? <Text style={{ color: colors.ink }}>{requestMessage}</Text> : null}

      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
        2. Paste the code or link from your email
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Reset code or link"
        placeholderTextColor={colors.inkSoft}
        autoCapitalize="none"
        value={tokenInput}
        onChangeText={setTokenInput}
      />
      <TextInput
        style={styles.input}
        placeholder="New password"
        placeholderTextColor={colors.inkSoft}
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      {resetError ? <Text style={styles.error}>{resetError}</Text> : null}
      <Button
        label={resetting ? 'Resetting…' : 'Reset password'}
        onPress={handleReset}
        disabled={resetting}
        style={styles.submit}
      />

      <Tappable onPress={onBack}>
        <Text style={styles.switchText}>Back to login</Text>
      </Tappable>
    </View>
  );
}

export function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await api.login({ email, password });
      } else {
        if (!isOldEnoughToSignUp(dateOfBirth.trim())) {
          throw new Error(`You must be at least ${MIN_SIGNUP_AGE} to create an account (date of birth as YYYY-MM-DD).`);
        }
        await api.register({ email, name, password, dateOfBirth: dateOfBirth.trim() });
      }
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'forgot') {
    return <ForgotPasswordForm onBack={() => setMode('login')} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{mode === 'login' ? 'Log in' : 'Create account'}</Text>

      {mode === 'register' && (
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor={colors.inkSoft}
          value={name}
          onChangeText={setName}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.inkSoft}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.inkSoft}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {mode === 'register' && (
        <TextInput
          style={styles.input}
          placeholder="Date of birth (YYYY-MM-DD)"
          placeholderTextColor={colors.inkSoft}
          keyboardType="numbers-and-punctuation"
          autoComplete="birthdate-full"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={submitting ? (mode === 'login' ? 'Logging in…' : 'Signing up…') : mode === 'login' ? 'Log in' : 'Sign up'}
        onPress={handleSubmit}
        disabled={submitting}
        style={styles.submit}
      />

      {mode === 'login' && (
        <Tappable onPress={() => setMode('forgot')}>
          <Text style={styles.switchText}>Forgot password?</Text>
        </Tappable>
      )}

      <Tappable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
        <Text style={styles.switchText}>
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </Text>
      </Tappable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24, gap: 12 },
    title: { fontSize: typeScale.title1, fontWeight: '600', color: colors.ink, marginBottom: 12 },
    sectionLabel: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.inkSoft },
    input: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      color: colors.ink,
    },
    error: { color: colors.owe },
    submit: { marginTop: 8, minHeight: 48 },
    switchText: { color: colors.route, textAlign: 'center', marginTop: 12 },
  });
}
