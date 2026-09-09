import { ATTR } from './constants';

/**
 * Ownership of the page-level state a drag needs.
 *
 * Two drags can overlap — a mouse in one list and a finger in another, or a
 * consumer driving a second element programmatically. Without refcounting, the
 * second lock saves the first's clobbered value and restores that on release,
 * leaving the page unselectable for good.
 */

let depth = 0;
let restoreUserSelect = '';

export function lockPage(): void {
  if (depth++ > 0) return;
  restoreUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = 'none';
  document.body.setAttribute(ATTR.dragging, '');
}

export function unlockPage(): void {
  if (depth === 0) return;
  if (--depth > 0) return;
  document.body.style.userSelect = restoreUserSelect;
  document.body.removeAttribute(ATTR.dragging);
}

/** Diagnostic for tests. Not part of the public API. */
export function pageLockDepth(): number {
  return depth;
}
