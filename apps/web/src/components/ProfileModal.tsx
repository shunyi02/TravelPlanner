import type { CurrentUser } from '../api';

export function ProfileModal({
  currentUser,
  onClose,
}: {
  currentUser: CurrentUser;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="page-title" style={{ fontSize: 22 }}>Profile</h2>
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{currentUser.name}</p>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)' }}>{currentUser.email}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
