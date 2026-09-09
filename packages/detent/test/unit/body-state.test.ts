import { beforeEach, describe, expect, it } from 'vitest';
import { lockPage, pageLockDepth, unlockPage } from '../../src/core/body-state';
import { ATTR } from '../../src/core/constants';

describe('page lock', () => {
  beforeEach(() => {
    while (pageLockDepth() > 0) unlockPage();
    document.body.style.userSelect = '';
    document.body.removeAttribute(ATTR.dragging);
  });

  it('marks the body while a drag is active', () => {
    lockPage();
    expect(document.body.style.userSelect).toBe('none');
    expect(document.body.hasAttribute(ATTR.dragging)).toBe(true);
  });

  it('restores what the host page had', () => {
    document.body.style.userSelect = 'text';
    lockPage();
    unlockPage();
    expect(document.body.style.userSelect).toBe('text');
    expect(document.body.hasAttribute(ATTR.dragging)).toBe(false);
  });

  it('holds the lock until the last drag releases it', () => {
    document.body.style.userSelect = 'text';
    lockPage();
    lockPage();
    unlockPage();
    expect(document.body.style.userSelect).toBe('none');
    expect(document.body.hasAttribute(ATTR.dragging)).toBe(true);
    unlockPage();
    expect(document.body.style.userSelect).toBe('text');
  });

  it('ignores an unbalanced release', () => {
    unlockPage();
    expect(pageLockDepth()).toBe(0);
  });
});
