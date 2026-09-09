/**
 * Turn the two accepted grid shapes into one.
 *
 * A falsy grid — including an explicit 0 — means no snapping, which is why
 * this returns null rather than [0, 0]: callers branch on presence, not value.
 */
export function normaliseGrid(
  grid: number | [number, number] | undefined | null,
): [number, number] | null {
  if (!grid) return null;
  if (typeof grid === 'number') return [grid, grid];
  return [grid[0], grid[1]];
}
