import { describe, expect, it } from 'vitest';
import { invariant } from '../../src/core/invariant';

describe('invariant', () => {
  it('does nothing when the condition holds', () => {
    expect(() => invariant(true, 'unused')).not.toThrow();
  });

  it('throws with a prefixed message when it does not', () => {
    expect(() => invariant(false, 'target must be an element')).toThrow(
      '[detent] target must be an element',
    );
  });

  it('narrows the type for the caller', () => {
    const value: string | null = 'present' as string | null;
    invariant(value, 'value is required');
    // Compiles only if `value` is narrowed to string.
    expect(value.length).toBe(7);
  });
});
