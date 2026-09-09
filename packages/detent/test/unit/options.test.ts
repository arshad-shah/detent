import { describe, expect, it } from 'vitest';
import { normaliseGrid } from '../../src/core/options';

describe('normaliseGrid', () => {
  it('returns null when no grid is given', () => {
    expect(normaliseGrid(undefined)).toBeNull();
  });

  it('treats zero as no grid', () => {
    expect(normaliseGrid(0)).toBeNull();
  });

  it('applies a single number to both axes', () => {
    expect(normaliseGrid(20)).toEqual([20, 20]);
  });

  it('passes a pair through unchanged', () => {
    expect(normaliseGrid([10, 25])).toEqual([10, 25]);
  });

  it('copies the pair rather than aliasing the caller’s array', () => {
    const input: [number, number] = [10, 25];
    const result = normaliseGrid(input);
    input[0] = 999;
    expect(result).toEqual([10, 25]);
  });
});
