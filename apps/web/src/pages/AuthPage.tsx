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
    <div className="main" style={{ maxWidth: 360, margin: '80px auto' }}>
      <div className="auth-brand">
        <span className="top-bar-logo auth-logo-flipped" />
        <span className="auth-brand-name">Cuti</span>
      </div>
      {done ? (
        <>
          <p style={{ marginTop: 20 }}>Password reset. You can log in with your new password now.</p>
          <button className="btn" style={{ marginTop: 8 }} onClick={() => { window.location.href = '/'; }}>
            Go to login
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 13 }}>Set a new password.</p>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
            autoFocus
          />
          {error && <p style={{ color: 'var(--owe)', margin: 0 }}>{error}</p>}
          <button className="btn" type="submit" disabled={submitting}>
            Reset password
          </button>
        </form>
      )}
    </div>
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
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  if (resetToken) return <ResetPasswordForm />;

  return (
    <div className="main" style={{ maxWidth: 360, margin: '80px auto' }}>
      {onBack && (
        <button type="button" className="back-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={onBack}>
          ← Back
        </button>
      )}
      <div className="auth-brand">
        <span className="top-bar-logo auth-logo-flipped" />
        <span className="auth-brand-name">Cuti</span>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
        {mode === 'register' && (
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {error && <p style={{ color: 'var(--owe)', margin: 0 }}>{error}</p>}
        <button className="btn" type="submit" disabled={submitting}>
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      <button
        className="text-btn"
        style={{ display: 'block', marginTop: 16 }}
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </button>
      {mode === 'login' && (
        <button
          className="text-btn"
          style={{ display: 'block', marginTop: 8 }}
          onClick={async () => {
            if (!email) {
              setError('Enter your email above first');
              return;
            }
            const { message } = await api.forgotPassword(email);
            setError(message);
          }}
        >
          Forgot password?
        </button>
      )}
    </div>
  );
}
