import { describe, expect, it } from 'vitest';
import { checkSizes } from '../../scripts/size-check.mjs';

describe('checkSizes', () => {
  it('passes when everything is under budget', () => {
    expect(checkSizes({ a: 100 }, { a: 90 })).toEqual([]);
  });

  it('passes when a bundle is exactly at budget', () => {
    expect(checkSizes({ a: 100 }, { a: 100 })).toEqual([]);
  });

  it('reports a bundle that is over', () => {
    expect(checkSizes({ a: 100 }, { a: 101 })).toEqual([
      { entry: 'a', budget: 100, actual: 101 },
    ]);
  });

  it('reports every offender, not just the first', () => {
    const over = checkSizes({ a: 100, b: 200, c: 300 }, { a: 150, b: 100, c: 400 });
    expect(over.map((row) => row.entry)).toEqual(['a', 'c']);
  });

  it('treats a budgeted entry that was not built as a failure', () => {
    // A renamed or dropped bundle must not silently pass the gate.
    expect(checkSizes({ a: 100 }, {})).toEqual([
      { entry: 'a', budget: 100, actual: Infinity },
    ]);
  });

  it('ignores a built bundle that has no budget', () => {
    expect(checkSizes({}, { a: 999 })).toEqual([]);
  });
});
