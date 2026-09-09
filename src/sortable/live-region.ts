import { ATTR } from '../core/constants';

/**
 * The screen-reader announcer for keyboard reordering.
 *
 * Refcounted against live lists, so a page with no sortable left has no stray
 * node. Identified by a data attribute rather than an id — an id is a
 * page-wide name that a host document may already be using.
 *
 * Its visually-hidden styles are inline because a host reset such as
 * `div { position: static }` would otherwise drop a 1px element into the
 * page's flow.
 */

const HIDDEN =
  'position:fixed;width:1px;height:1px;margin:-1px;padding:0;border:0;' +
  'overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';

let region: HTMLElement | null = null;
let holders = 0;

export function acquireLiveRegion(): void {
  if (holders++ > 0) return;
  region = document.createElement('div');
  region.setAttribute(ATTR.liveRegion, '');
  region.setAttribute('aria-live', 'assertive');
  region.setAttribute('aria-atomic', 'true');
  region.style.cssText = HIDDEN;
  document.body.appendChild(region);
}

export function releaseLiveRegion(): void {
  if (holders === 0) return;
  if (--holders > 0) return;
  region?.remove();
  region = null;
}

export function announce(message: string): void {
  if (region) region.textContent = message;
}
