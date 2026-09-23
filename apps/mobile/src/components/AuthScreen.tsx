import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { useTheme, type ThemeColors } from '../theme';

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
        <Pressable style={styles.button} onPress={onBack}>
          <Text style={styles.buttonText}>Back to login</Text>
        </Pressable>
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
      <Pressable style={styles.button} onPress={handleRequest} disabled={requesting}>
        <Text style={styles.buttonText}>{requesting ? 'Sending…' : 'Send reset link'}</Text>
      </Pressable>
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
      <Pressable style={styles.button} onPress={handleReset} disabled={resetting}>
        <Text style={styles.buttonText}>{resetting ? 'Resetting…' : 'Reset password'}</Text>
      </Pressable>

      <Pressable onPress={onBack}>
        <Text style={styles.switchText}>Back to login</Text>
      </Pressable>
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await api.login({ email, password });
      } else {
        await api.register({ email, name, password });
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{mode === 'login' ? 'Log in' : 'Sign up'}</Text>
      </Pressable>

      {mode === 'login' && (
        <Pressable onPress={() => setMode('forgot')}>
          <Text style={styles.switchText}>Forgot password?</Text>
        </Pressable>
      )}

      <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
        <Text style={styles.switchText}>
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24, gap: 12 },
    title: { fontSize: 26, fontWeight: '600', color: colors.ink, marginBottom: 12 },
    sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
    input: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      color: colors.ink,
    },
    error: { color: colors.owe },
    button: {
      backgroundColor: colors.route,
      borderRadius: 6,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: { color: '#fff', fontWeight: '600' },
    switchText: { color: colors.route, textAlign: 'center', marginTop: 12 },
  });
}
