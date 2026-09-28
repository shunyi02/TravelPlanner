import {
  Bed,
  Compass,
  ForkKnife,
  Receipt,
  ShoppingBag,
  Ticket,
  Train,
  type Icon,
} from '@phosphor-icons/react';
import { CATEGORICAL_HUES, EXPENSE_CATEGORIES, NEUTRAL_HUE } from '@travel-planner/shared';

/** One glyph per expense category; anything unknown falls back to a receipt. */
const ICONS: Record<string, Icon> = {
  Food: ForkKnife,
  Transport: Train,
  Accommodation: Bed,
  Activities: Compass,
  Shopping: ShoppingBag,
  Tickets: Ticket,
};

/**
 * Matches EXPENSE_CATEGORIES' order 1:1, so a category always gets the same
 * color whichever others are present. The palette ring is CVD-checked for
 * neighbors only, so every use pairs the color with a visible label.
 */
const COLORS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((cat, i) => [cat, CATEGORICAL_HUES[i] ?? NEUTRAL_HUE]),
);

export const categoryIcon = (category: string): Icon => ICONS[category] ?? Receipt;
export const categoryColor = (category: string): string => COLORS[category] ?? NEUTRAL_HUE;
