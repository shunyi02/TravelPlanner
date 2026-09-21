import { useState } from 'react';
import { api } from '../api';

export function AuthPage({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
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

  return (
    <div className="main" style={{ maxWidth: 360, margin: '80px auto' }}>
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
        className="btn btn-outline"
        style={{ marginTop: 12, border: 'none' }}
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </button>
      {mode === 'login' && (
        <button
          className="btn btn-outline"
          style={{ marginTop: 4, border: 'none', fontSize: 13 }}
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
