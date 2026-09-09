import type { Point } from './types';

/**
 * Scroll-position bookkeeping.
 *
 * A drag works in viewport coordinates, but an element's resting position
 * moves whenever anything above it scrolls. Tracking the total lets a drag
 * stay under the pointer instead of sliding away with the content.
 */

/** `visible` and `hidden` do not scroll; `clip` explicitly cannot. */
const SCROLLS = /auto|scroll|overlay/;

function scrolls(el: Element): boolean {
  const style = getComputedStyle(el);
  return SCROLLS.test(style.overflowY) || SCROLLS.test(style.overflowX);
}

/**
 * Walk up from `el`, collecting every ancestor that scrolls, nearest first.
 *
 * Stops at the body: the page's own scroll is handled separately by
 * `totalScroll`, because it lives on `window` rather than on an element.
 */
function walk(el: Element, stopAtFirst: boolean): Element[] {
  const out: Element[] = [];
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    if (scrolls(node)) {
      out.push(node);
      if (stopAtFirst) return out;
    }
    node = node.parentElement;
  }
  return out;
}

/** Every ancestor that scrolls, nearest first. */
export function scrollAncestorsOf(el: Element): Element[] {
  return walk(el, false);
}

/** The nearest ancestor that actually scrolls, or null if only the page does. */
export function scrollParentOf(el: Element): Element | null {
  return walk(el, true)[0] ?? null;
}

/** How far everything above an element has scrolled, added together. */
export function totalScroll(ancestors: Element[]): Point {
  let x = typeof window === 'undefined' ? 0 : window.scrollX;
  let y = typeof window === 'undefined' ? 0 : window.scrollY;
  for (const node of ancestors) {
    x += node.scrollLeft;
    y += node.scrollTop;
  }
  return { x, y };
}
