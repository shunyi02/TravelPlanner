import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, MIN_SIGNUP_AGE, isOldEnoughToSignUp } from '@travel-planner/shared';
import { api } from '../api';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { BrandMark } from './BrandMark';
import { Button } from './Button';
import { DateField } from './DateField';
import { TextField } from './Field';

/** Pastes either a bare reset token or the whole emailed link (which points at
 *  the web app's `?token=...`) — mobile has no in-app way to auto-detect the
 *  token the way the web app does from its own URL, so the user brings it here. */
function extractToken(pasted: string): string {
  const match = pasted.match(/token=([^&\s]+)/);
  return (match ? match[1] : pasted).trim();
}

/** Where the birthday picker opens: 25 years back, so it's a few taps from most adults' year. */
function birthdayPickerStart(): string {
  const d = new Date();
  return `${d.getFullYear() - 25}-01-01`;
}

/** The dark banner and form sheet every auth screen shares. */
function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[styles.banner, { paddingTop: insets.top + 36 }]}>
          {/* The trip hero's ring, so signing in already looks like the app. */}
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Circle cx="100%" cy="0" r="210" stroke={colors.highlight} strokeOpacity={0.5} strokeWidth={1} fill="none" />
            <Circle cx="100%" cy="0" r="290" stroke={colors.highlight} strokeOpacity={0.22} strokeWidth={1} fill="none" />
          </Svg>
          <View style={styles.inner}>
            <BrandMark size="lg" tone="onHero" />
            <Text style={styles.tagline}>Plan the days, keep the bookings, and split the costs with the people you travel with.</Text>
          </View>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.inner}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {children}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
      setRequestMessage(err instanceof Error ? err.message : 'Something went wrong. Try again.');
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
      <AuthLayout title="Password reset" subtitle="You can log in with your new password now.">
        <Button label="Back to login" onPress={onBack} style={styles.submit} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link. Paste the link or its code below.">
      <Text style={styles.step}>Step 1 · Get a reset link</Text>
      <TextField
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Button
        label={requesting ? 'Sending…' : 'Send reset link'}
        variant="secondary"
        onPress={handleRequest}
        disabled={requesting || !email.trim()}
      />
      {requestMessage ? <Text style={styles.notice}>{requestMessage}</Text> : null}

      <Text style={[styles.step, { marginTop: 28 }]}>Step 2 · Choose a new password</Text>
      <TextField
        label="Reset code or link"
        autoCapitalize="none"
        value={tokenInput}
        onChangeText={setTokenInput}
      />
      <TextField
        label="New password"
        hint="At least 8 characters."
        secureTextEntry
        autoComplete="new-password"
        value={newPassword}
        onChangeText={setNewPassword}
        error={resetError}
      />
      <Button
        label={resetting ? 'Resetting…' : 'Reset password'}
        onPress={handleReset}
        disabled={resetting}
        style={styles.submit}
      />
      <Button label="Back to login" variant="text" onPress={onBack} style={styles.link} />
    </AuthLayout>
  );
}

export function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isLogin = mode === 'login';

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (isLogin) {
        await api.login({ email, password });
      } else {
        if (!dateOfBirth || !isOldEnoughToSignUp(dateOfBirth)) {
          throw new Error(`You must be at least ${MIN_SIGNUP_AGE} to create an account.`);
        }
        await api.register({ email, name, password, dateOfBirth });
      }
      onAuthed();
    } catch (err) {
      if (isLogin && err instanceof ApiError && err.status === 401) {
        // Same message for an unknown email and a wrong password, so the form
        // doesn't reveal which emails have accounts. Keep the email, retry the password.
        setError('Email or password is incorrect.');
        setPassword('');
        passwordRef.current?.focus();
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'forgot') {
    return <ForgotPasswordForm onBack={() => setMode('login')} />;
  }

  return (
    <AuthLayout
      title={isLogin ? 'Welcome back' : 'Create your account'}
      subtitle={isLogin ? 'Log in to see your trips.' : 'It takes a minute. Invite your travel group once you are in.'}
    >
      {!isLogin && <TextField label="Name" autoComplete="name" value={name} onChangeText={setName} />}
      <TextField
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        hint={isLogin ? undefined : 'At least 8 characters.'}
        secureTextEntry
        autoComplete={isLogin ? 'current-password' : 'new-password'}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={isLogin ? handleSubmit : undefined}
      />
      {!isLogin && (
        <DateField
          label="Date of birth"
          value={dateOfBirth}
          onChange={setDateOfBirth}
          defaultDay={birthdayPickerStart()}
          hint={`You need to be ${MIN_SIGNUP_AGE} or older.`}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={submitting ? (isLogin ? 'Logging in…' : 'Creating account…') : isLogin ? 'Log in' : 'Create account'}
        onPress={handleSubmit}
        disabled={submitting}
        style={styles.submit}
      />
      {isLogin && (
        <Button label="Forgot password?" variant="text" onPress={() => setMode('forgot')} style={styles.link} />
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>{isLogin ? 'New here?' : 'Already have an account?'}</Text>
        <Button
          label={isLogin ? 'Create an account' : 'Log in'}
          variant="text"
          onPress={() => {
            setError(null);
            setMode(isLogin ? 'register' : 'login');
          }}
        />
      </View>
    </AuthLayout>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.hero },
    scroll: { flexGrow: 1 },
    // Content keeps a readable width on tablets and the web build.
    inner: { width: '100%', maxWidth: 420, alignSelf: 'center' },
    banner: { backgroundColor: colors.hero, paddingHorizontal: 24, paddingBottom: 44, overflow: 'hidden' },
    tagline: {
      fontSize: typeScale.subhead,
      lineHeight: 22,
      color: colors.onHeroSoft,
      marginTop: 18,
      maxWidth: 320,
    },
    sheet: {
      flexGrow: 1,
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.lg + 8,
      borderTopRightRadius: radius.lg + 8,
      marginTop: -20,
      paddingHorizontal: 24,
      paddingTop: 32,
    },
    title: { fontSize: typeScale.title1, fontWeight: '700', letterSpacing: -0.5, color: colors.ink },
    subtitle: { fontSize: typeScale.subhead, lineHeight: 21, color: colors.inkSoft, marginTop: 6, marginBottom: 24 },
    step: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.heroText, marginBottom: 12 },
    notice: { fontSize: typeScale.footnote, lineHeight: 18, color: colors.inkSoft, marginTop: 10 },
    error: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.owe, marginBottom: 10 },
    submit: { marginTop: 6, minHeight: 50 },
    link: { alignSelf: 'center', marginTop: 14 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 28,
      paddingTop: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.rule,
    },
    switchText: { fontSize: typeScale.subhead, color: colors.inkSoft },
  });
}
