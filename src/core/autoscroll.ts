import { DEFAULTS } from './constants';
import { boxOf } from './geometry';
import type { Point } from './types';

export interface AutoScrollOptions {
  /** How close to an edge, in pixels, before scrolling kicks in. Default 60. */
  threshold?: number;
  /** Pixels per frame at full speed. Default 14. */
  speed?: number;
  /**
   * Called after each scroll step. A held pointer sends no events, so whoever
   * is dragging has to be told to recompute itself.
   */
  onScroll?(): void;
}

/**
 * Scrolls a container (and the page) when the pointer nears its edges, so a
 * list taller than the viewport can still be reordered end to end.
 *
 * Speed ramps up as the pointer gets closer to the edge rather than switching
 * on abruptly, which makes long drags controllable.
 */
export function createAutoScroll(target: Element | null, options: AutoScrollOptions = {}) {
  const threshold = options.threshold ?? DEFAULTS.scrollThreshold;
  const speed = options.speed ?? DEFAULTS.scrollSpeed;

  let pointer: Point | null = null;
  let frame = 0;

  function ramp(gap: number): number {
    if (gap >= threshold) return 0;
    return ((threshold - Math.max(gap, 0)) / threshold) ** 2;
  }

  function step() {
    frame = 0;
    if (!pointer) return;

    const scroller = target ?? document.scrollingElement ?? document.documentElement;
    const view = target
      ? boxOf(target)
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    const up = ramp(pointer.y - view.top);
    const down = ramp(view.top + view.height - pointer.y);
    const left = ramp(pointer.x - view.left);
    const right = ramp(view.left + view.width - pointer.x);

    const dy = (down - up) * speed;
    const dx = (right - left) * speed;

    if (dx || dy) {
      const beforeTop = scroller.scrollTop;
      const beforeLeft = scroller.scrollLeft;
      scroller.scrollTop += dy;
      scroller.scrollLeft += dx;
      if (scroller.scrollTop !== beforeTop || scroller.scrollLeft !== beforeLeft) {
        options.onScroll?.();
      }
      frame = requestAnimationFrame(step);
    }
  }

  return {
    update(point: Point) {
      pointer = point;
      if (!frame) frame = requestAnimationFrame(step);
    },
    stop() {
      pointer = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
