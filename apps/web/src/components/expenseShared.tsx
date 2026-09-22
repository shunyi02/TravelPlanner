import type { Expense } from '../api';
import { toDatetimeLocalValue } from '../format';

export type SplitMode = 'even' | 'custom';
/** 'base': the amount entered excludes tax, servicePct/taxPct compute the
 *  total. 'total': the amount entered already is the final, tax-included
 *  total (what most receipts show), so no tax fields apply. */
export type AmountMode = 'base' | 'total';

export const nowForInput = () => toDatetimeLocalValue(new Date().toISOString());

/** Clamps a datetime-local value into [min, max] (both datetime-local strings,
 *  which compare lexically like ISO since they share the yyyy-MM-ddTHH:mm shape). */
export function clampToRange(value: string, min?: string, max?: string): string {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

/** Bounds for an expense date picker, so logged expenses stay within the trip's travel dates. */
export function expenseDateBounds(
  tripStartDate?: string | null,
  tripEndDate?: string | null,
): { min?: string; max?: string } {
  return {
    min: tripStartDate ? `${tripStartDate.slice(0, 10)}T00:00` : undefined,
    max: tripEndDate ? `${tripEndDate.slice(0, 10)}T23:59` : undefined,
  };
}

export function evenAmounts(memberIds: string[], total: number): Record<string, string> {
  if (memberIds.length === 0) return {};
  const each = total / memberIds.length;
  return Object.fromEntries(memberIds.map((id) => [id, each ? each.toFixed(2) : '']));
}

/** Applies service charge then tax on top, both as percentages, compounding
 *  (tax is charged on the post-service-charge amount, matching how a
 *  restaurant bill actually adds them). Either can be 0. */
export function computeTotal(base: number, servicePct: number, taxPct: number): number {
  return base * (1 + servicePct / 100) * (1 + taxPct / 100);
}

export function sumAmounts(amounts: Record<string, string>): number {
  return Object.values(amounts).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

export function toShares(amounts: Record<string, string>): Array<{ userId: string; share: number }> {
  const entries = Object.entries(amounts)
    .map(([userId, val]) => [userId, Number(val) || 0] as const)
    .filter(([, val]) => val > 0);
  const total = entries.reduce((sum, [, val]) => sum + val, 0);
  if (total <= 0) return [];
  return entries.map(([userId, val]) => ({ userId, share: val / total }));
}

/** Splits are treated as "even" if every trip member owes an equal share. */
export function looksEven(expense: Expense, memberIds: string[]): boolean {
  if (expense.splits.length !== memberIds.length) return false;
  const values = expense.splits.map((s) => Number(s.amountOwed));
  return values.every((v) => Math.abs(v - values[0]) < 0.01);
}

export function SplitEditor({
  memberIds,
  memberNames,
  total,
  taxMultiplier = 1,
  currency,
  mode,
  onModeChange,
  amounts,
  onAmountsChange,
}: {
  memberIds: string[];
  memberNames: Record<string, string>;
  /** What custom amounts must sum to — the base fare when tax applies
   *  (taxMultiplier !== 1), otherwise the plain total. */
  total: number;
  /** (1 + service%)(1 + tax%). Each member's base share, once entered, is
   *  multiplied by this to show the final amount they actually owe. */
  taxMultiplier?: number;
  currency?: string;
  mode: SplitMode;
  onModeChange: (mode: SplitMode) => void;
  amounts: Record<string, string>;
  onAmountsChange: (amounts: Record<string, string>) => void;
}) {
  const diff = total - sumAmounts(amounts);
  const balanced = Math.abs(diff) < 0.01;
  const hasTax = Math.abs(taxMultiplier - 1) > 0.0001;

  return (
    <div>
      <div className="split-mode-row">
        <label>
          <input
            type="radio"
            checked={mode === 'even'}
            onChange={() => onModeChange('even')}
          />{' '}
          Split evenly
        </label>
        <label>
          <input
            type="radio"
            checked={mode === 'custom'}
            onChange={() => {
              onModeChange('custom');
              if (Object.keys(amounts).length === 0) onAmountsChange(evenAmounts(memberIds, total));
            }}
          />{' '}
          Custom amounts{hasTax ? ' (base fare, before tax)' : ''}
        </label>
      </div>
      {mode === 'custom' && (
        <div className="custom-split-grid">
          {memberIds.map((id) => {
            const val = Number(amounts[id]) || 0;
            return (
              <div className="custom-split-row" key={id}>
                <span>{memberNames[id] ?? id}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    inputMode="decimal"
                    value={amounts[id] ?? ''}
                    onChange={(e) => onAmountsChange({ ...amounts, [id]: e.target.value })}
                  />
                  {hasTax && val > 0 && (
                    <span style={{ color: 'var(--ink-soft)' }}>
                      → pays {currency} {(val * taxMultiplier).toFixed(2)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          <p className={`split-remaining ${balanced ? 'balanced' : 'unbalanced'}`}>
            {balanced
              ? hasTax
                ? 'Base fares add up.'
                : 'Splits add up.'
              : diff > 0
                ? `${diff.toFixed(2)} left to assign`
                : `${Math.abs(diff).toFixed(2)} over`}
          </p>
        </div>
      )}
    </div>
  );
}
