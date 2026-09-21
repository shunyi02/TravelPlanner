import { EXPENSE_CATEGORIES } from '@travel-planner/shared';
import type { Expense } from '../api';
import { CATEGORICAL_HUES, NEUTRAL_HUE } from '../palette';
import { PieChart, type PieSlice } from './PieChart';

/**
 * Matches EXPENSE_CATEGORIES' order 1:1 (the ring is already ordered so
 * every consecutive pair — including the wrap from the last slice back to
 * the first — clears the CVD/contrast gates), so a category always gets
 * the same color regardless of which other categories are present.
 *
 * A pie's slice neighbors change with the data (which categories are
 * present), so not every possible pair of these 7 hues clears the stricter
 * all-pairs bar the skill uses for scatter/small-multiples — full CVD
 * safety across every possible subset isn't guaranteed by hue alone at 7
 * categories. The always-visible legend (name + amount + percent) is the
 * mitigation: nobody has to tell two categories apart by color alone.
 */
const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((cat, i) => [cat, CATEGORICAL_HUES[i] ?? NEUTRAL_HUE]),
);

export function CategoryPieChart({ expenses, currency }: { expenses: Expense[]; currency: string }) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + Number(expense.amount));
  }

  const slices: PieSlice[] = EXPENSE_CATEGORIES.filter((cat) => (totals.get(cat) ?? 0) > 0).map((cat) => ({
    key: cat,
    label: cat,
    amount: totals.get(cat)!,
    color: CATEGORY_COLORS[cat] ?? NEUTRAL_HUE,
  }));

  return <PieChart title="By category" ariaLabel="Expenses by category" slices={slices} currency={currency} />;
}
