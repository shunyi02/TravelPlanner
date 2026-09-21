/**
 * One validated ring of the dataviz skill's default categorical palette
 * (see palette.md): the 8-hue set minus violet, reordered so every
 * consecutive pair — including the wrap from the last color back to the
 * first — clears the CVD/contrast gates (checked with validate_palette.js).
 *
 * Used wherever the app needs to color N same-kind things distinctly
 * (expense categories, itinerary days). Past 7 items, colors repeat — full
 * pairwise CVD safety isn't guaranteed at that point; pair with a visible
 * label (legend, tooltip, order number) so identity never depends on hue
 * alone.
 */
export const CATEGORICAL_HUES = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#e34948', // red
] as const;

/** Muted neutral for "no real category" (e.g. an unscheduled stop). */
export const NEUTRAL_HUE = '#898781';

export function hueForIndex(index: number): string {
  return CATEGORICAL_HUES[index % CATEGORICAL_HUES.length];
}
