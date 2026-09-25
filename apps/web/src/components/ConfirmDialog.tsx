import { useEffect, useRef } from 'react';

/** In-app replacement for window.confirm() on destructive actions: same modal
 *  look as the app's forms, Escape or the backdrop cancels, and focus starts
 *  on Cancel so a stray Enter never deletes. */
export function ConfirmDialog({
  message,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Callers pass inline handlers; read the latest one without re-subscribing.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="confirm-dialog-message" className="confirm-dialog-message">{message}</p>
        <div className="form-actions">
          <button ref={cancelRef} type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
