import { describe, expect, it } from 'vitest';
import { eachList, registerList, unregisterList } from '../../src/sortable/registry';

const REGISTRY_KEY = Symbol.for('detent.sortable.registry');

function makeInstance() {
  const container = document.createElement('ul');
  return { container, options: {}, items: () => [] };
}

describe('sortable registry', () => {
  it('registers and unregisters instances', () => {
    const a = makeInstance();
    registerList(a);
    expect([...eachList()]).toContain(a);
    unregisterList(a);
    expect([...eachList()]).not.toContain(a);
  });

  it('is shared across duplicate copies of the library via globalThis', () => {
    // Simulates a second bundled copy: a different module instance reaching
    // the same well-known symbol.
    const shared = (globalThis as Record<symbol, unknown>)[REGISTRY_KEY];
    expect(shared).toBeInstanceOf(Set);

    const fromOtherCopy = makeInstance();
    (shared as Set<unknown>).add(fromOtherCopy);
    expect([...eachList()]).toContain(fromOtherCopy);
    (shared as Set<unknown>).delete(fromOtherCopy);
  });
});
