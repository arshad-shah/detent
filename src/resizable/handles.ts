import { ATTR, CLASS, handleClass } from '../core/constants';
import { invariant } from '../core/invariant';
import { ALL_HANDLES, directionOf, type HandleName } from '../core/resize-math';
import type { HandleSpec } from './types';

export interface ResolvedHandle {
  name: HandleName;
  node: HTMLElement;
  direction: [-1 | 0 | 1, -1 | 0 | 1];
  /** True when the library made this element and must therefore remove it. */
  created: boolean;
}

/**
 * `position` and `touch-action` are written inline rather than left to the
 * stylesheet because they are load-bearing: a host reset of
 * `* { position: static }` would detach every handle, and `touch-action: auto`
 * would stop touch resizing outright. Inline styles are beyond the reach of
 * any host stylesheet, so the library keeps working even when styles.css is
 * never loaded — at which point the stylesheet only governs appearance.
 *
 * This applies to caller-supplied handles too: a handle has to be positioned
 * against the target for the library's geometry to hold, so it is a
 * correctness requirement rather than a style preference.
 */
function anchor(node: HTMLElement): void {
  node.style.position = 'absolute';
  node.style.touchAction = 'none';
}

/**
 * Turn the two accepted `handles` shapes into one list.
 *
 * The array form asks the library to create elements; the object form binds to
 * elements the caller already has. Only the former may be removed on destroy.
 */
export function resolveHandles(el: HTMLElement, spec: HandleSpec | undefined): ResolvedHandle[] {
  const supplied = Array.isArray(spec) || !spec ? null : spec;
  const names = (
    supplied ? Object.keys(supplied) : ((spec as HandleName[] | undefined) ?? ALL_HANDLES)
  ) as HandleName[];

  const out: ResolvedHandle[] = [];
  for (const name of names) {
    const direction = directionOf(name);
    invariant(direction, `resizable() got an unknown handle name: ${String(name)}`);
    if (!direction) continue;

    if (supplied) {
      const target = supplied[name];
      const node =
        typeof target === 'string' ? el.querySelector<HTMLElement>(target) : (target ?? null);
      invariant(node, `resizable() could not find the handle element for "${name}"`);
      if (!node) continue;
      node.setAttribute(ATTR.handle, name);
      anchor(node);
      out.push({ name, node, direction, created: false });
    } else {
      const node = document.createElement('span');
      node.className = `${CLASS.handle} ${handleClass(name)}`;
      node.setAttribute(ATTR.handle, name);
      node.setAttribute('aria-hidden', 'true');
      anchor(node);
      el.appendChild(node);
      out.push({ name, node, direction, created: true });
    }
  }
  return out;
}
