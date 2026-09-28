import { useEffect, useRef, type ReactNode } from 'react';
import { Check, PencilSimple, X } from '@phosphor-icons/react';
import type { Expense } from '../api';
import { categoryColor, categoryIcon } from '../expenseCategoryStyle';
import { formatMoney, initials } from '../format';

/** A right-hand slide-over (a bottom sheet on narrow screens) for one expense
 *  or the expense form. Esc and the backdrop close it; focus returns to
 *  whatever opened it. */
export function ExpensePanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Let a field with autoFocus keep focus; otherwise start on the panel itself.
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <aside
        ref={panelRef}
        className="expense-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-panel-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <header className="expense-panel-head">
          <h2 className="modal-title" id="expense-panel-title">
            {title}
          </h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="expense-panel-body">{children}</div>
      </aside>
    </div>
  );
}

/** Read-only view of one expense: amount, receipt, and who owes the payer what. */
export function ExpenseDetail({
  expense,
  memberNames,
  currentUserId,
  onToggleSettled,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  memberNames: Record<string, string>;
  currentUserId?: string;
  onToggleSettled: (splitUserId: string, settled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const CategoryIcon = categoryIcon(expense.category);
  const name = (id: string) => (id === currentUserId ? 'You' : (memberNames[id] ?? 'Former member'));
  const money = (value: string | number) => formatMoney(Number(value), expense.currency);
  const owing = expense.splits.filter((s) => s.userId !== expense.paidById);
  const when = new Date(expense.expenseDate).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="expense-detail">
      <div className="expense-detail-hero">
        <span className="expense-cat-icon expense-cat-icon-lg" style={{ color: categoryColor(expense.category) }} aria-hidden="true">
          <CategoryIcon size={22} weight="duotone" />
        </span>
        <p className="expense-detail-amount amount">{money(expense.amount)}</p>
        {expense.subtotal != null && (
          <p className="amount-note">
            {money(expense.subtotal)} before
            {expense.servicePct != null && ` ${expense.servicePct}% service`}
            {expense.servicePct != null && expense.taxPct != null && ' and'}
            {expense.taxPct != null && ` ${expense.taxPct}% tax`}
          </p>
        )}
      </div>

      <dl className="expense-detail-facts">
        <div>
          <dt>Category</dt>
          <dd>{expense.category}</dd>
        </div>
        <div>
          <dt>Paid by</dt>
          <dd>{name(expense.paidById)}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{when}</dd>
        </div>
      </dl>

      {expense.receiptPhoto && (
        <a href={expense.receiptPhoto} target="_blank" rel="noreferrer" className="expense-receipt">
          <img className="receipt-photo-preview" src={expense.receiptPhoto} alt={`Receipt for ${expense.description}`} />
        </a>
      )}

      <section aria-labelledby="expense-split-heading">
        <h3 className="expense-detail-heading" id="expense-split-heading">
          Who owes {name(expense.paidById) === 'You' ? 'you' : name(expense.paidById)}
        </h3>
        {owing.length === 0 ? (
          <p className="expense-detail-empty">Nobody else owes anything on this one.</p>
        ) : (
          <ul className="expense-split-list">
            {owing.map((s) => (
              <li key={s.userId} className="expense-split-row">
                <span className="expense-avatar" aria-hidden="true">
                  {initials(memberNames[s.userId] ?? '?')}
                </span>
                <span className="expense-split-name">{name(s.userId)}</span>
                <span className="amount">{money(s.amountOwed)}</span>
                <button
                  type="button"
                  className={`settle-btn${s.settled ? ' settle-btn-settled' : ''}`}
                  aria-pressed={s.settled}
                  aria-label={`${name(s.userId)} settled`}
                  onClick={() => onToggleSettled(s.userId, !s.settled)}
                >
                  {s.settled && <Check size={12} weight="bold" aria-hidden />}
                  {s.settled ? 'Settled' : 'Mark settled'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="form-actions expense-detail-actions">
        <button type="button" className="text-btn text-btn-danger" onClick={onDelete}>
          Delete
        </button>
        <button type="button" className="btn" onClick={onEdit}>
          <PencilSimple size={15} aria-hidden /> Edit
        </button>
      </div>
    </div>
  );
}
