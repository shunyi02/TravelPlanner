import { useState } from 'react';
import { api, getResetToken } from '../api';

/** Read once at module load — the value doesn't change during the page's life. */
const resetToken = getResetToken();

function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.resetPassword(resetToken!, newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="main auth-page">
      <div className="auth-brand">
        <span className="top-bar-logo" />
        <span className="auth-brand-name">Cuti</span>
      </div>
      {done ? (
        <div className="auth-form">
          <p className="auth-notice">Password reset. You can log in with your new password now.</p>
          <button className="btn" onClick={() => { window.location.href = '/'; }}>
            Go to login
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              autoFocus
            />
            <small>At least 8 characters.</small>
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="btn" type="submit" disabled={submitting}>
            Reset password
          </button>
        </form>
      )}
    </main>
  );
}

export function AuthPage({
  onAuthed,
  initialMode = 'login',
  onBack,
}: {
  onAuthed: () => void;
  initialMode?: 'login' | 'register';
  /** Shown as a "back" link above the form when set (e.g. returning to a landing page). */
  onBack?: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Non-error feedback, e.g. "check your inbox" after a reset request. */
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleForgotPassword = async () => {
    setNotice(null);
    if (!email) {
      setError('Enter your email above first');
      return;
    }
    setError(null);
    try {
      const { message } = await api.forgotPassword(email);
      setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a reset email');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
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

  if (resetToken) return <ResetPasswordForm />;

  return (
    <main className="main auth-page">
      {onBack && (
        <button type="button" className="back-link auth-back" onClick={onBack}>
          ← Back
        </button>
      )}
      <div className="auth-brand">
        <span className="top-bar-logo" />
        <span className="auth-brand-name">Cuti</span>
      </div>
      <form onSubmit={handleSubmit} className="auth-form">
        {mode === 'register' && (
          <label className="auth-field">
            <span>Name</span>
            <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {mode === 'register' && <small>At least 8 characters.</small>}
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <button className="btn" type="submit" disabled={submitting}>
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      <div className="auth-links">
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
            setNotice(null);
          }}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
        {mode === 'login' && (
          <button type="button" className="text-btn" onClick={handleForgotPassword}>
            Forgot password?
          </button>
        )}
      </div>
    </main>
  );
}
