import { boxOf } from './geometry';
import type { Box } from './types';

/**
 * Slide elements from where they were to where they now are.
 *
 * Nothing is animated through layout. We note each element's position, let the
 * browser lay the list out once, then play a transform from the old position
 * back to zero — so the browser only measures a single time no matter how many
 * items shuffle.
 */

const running = new WeakMap<HTMLElement, Animation>();

const canAnimate = () =>
  typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Snapshot where things are, including mid-animation. */
export function record(elements: Iterable<HTMLElement>): Map<HTMLElement, Box> {
  const map = new Map<HTMLElement, Box>();
  for (const el of elements) map.set(el, boxOf(el));
  return map;
}

/** Play everything back from the snapshot to wherever the DOM has put them. */
export function play(before: Map<HTMLElement, Box>, duration = 180): void {
  if (!canAnimate() || reducedMotion() || duration <= 0) return;

  for (const [el, from] of before) {
    running.get(el)?.cancel();
    running.delete(el);
  }

  for (const [el, from] of before) {
    if (!el.isConnected) continue;
    const to = boxOf(el);
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

    const animation = el.animate(
      [{ transform: `translate3d(${dx}px, ${dy}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
      { duration, easing: 'cubic-bezier(0.2, 0, 0, 1)', composite: 'add' },
    );
    running.set(el, animation);
    animation.finished.then(() => running.delete(el)).catch(() => running.delete(el));
  }
}

export function stopAll(elements: Iterable<HTMLElement>): void {
  for (const el of elements) {
    running.get(el)?.cancel();
    running.delete(el);
  }
}
