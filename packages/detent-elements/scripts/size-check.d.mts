/** One bundle that exceeded its ceiling. `actual` is Infinity if it was never built. */
export interface SizeOverage {
  entry: string;
  budget: number;
  actual: number;
}

/**
 * Compare measured gzip sizes against their budgets.
 *
 * Returns one row per entry that is over, in budget-declaration order, and an
 * empty array when everything fits.
 */
export declare function checkSizes(
  budgets: Record<string, number>,
  measured: Record<string, number>,
): SizeOverage[];
