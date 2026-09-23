import { EXPENSE_CATEGORIES } from '@travel-planner/shared';
import type { Expense } from '../api';
import { CATEGORICAL_HUES, NEUTRAL_HUE } from '../palette';
import { PieChart, type PieSlice } from './PieChart';

/** Matches EXPENSE_CATEGORIES' order 1:1 so a category always gets the same
 *  color regardless of which other categories are present. */
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

  return <PieChart title="By category" slices={slices} currency={currency} />;
}
