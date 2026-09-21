import { useAuth } from '../authContext';

export function ProfilePage() {
  const { currentUser } = useAuth();

  return (
    <div className="main main-centered">
      <h1 className="page-title">Profile</h1>

      {currentUser && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{currentUser.name}</p>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)' }}>{currentUser.email}</p>
        </div>
      )}
    </div>
  );
}
