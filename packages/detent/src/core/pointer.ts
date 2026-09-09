import { lockPage, unlockPage } from './body-state';
import { DEFAULTS } from './constants';
import type { Activation, Handle, Point } from './types';

export interface DragSession {
  pointerId: number;
  pointerType: string;
  /** Where the press began, in viewport coordinates. */
  origin: Point;
  /** Where the pointer is now, in viewport coordinates. */
  point: Point;
  /** How far the pointer has travelled since `origin`. */
  delta: Point;
  /** The event that produced the current position. */
  event: PointerEvent;
  /**
   * The composed path of the original press. Lets a delegating caller work out
   * which child was grabbed, and works through shadow roots where
   * `event.target` alone does not.
   */
  path: EventTarget[];
  /** Abort the drag; listeners get `onEnd(session, true)`. */
  cancel(): void;
}

export interface PointerOptions extends Activation {
  /** Return false to refuse the drag. */
  onStart?(session: DragSession): void | boolean;
  onMove?(session: DragSession): void;
  onEnd?(session: DragSession, cancelled: boolean): void;
  /**
   * Whether the library sets `touch-action: none` on the element.
   *
   * With 'none' a finger on the element always drags and never scrolls the
   * page. Leave it as 'none' unless the element sits in a scrolling list and
   * you have given it a `handle` — then 'auto' keeps swipe-to-scroll working.
   */
  touchAction?: 'none' | 'auto' | 'manipulation';
}

function matchesIn(path: EventTarget[], root: Element, selector: string): boolean {
  for (const node of path) {
    if (node === root) return false;
    if (node instanceof Element && node.matches(selector)) return true;
  }
  return false;
}

function pathOf(e: Event): EventTarget[] {
  return typeof e.composedPath === 'function' ? e.composedPath() : [e.target as EventTarget];
}

/**
 * Turn raw pointer input on `el` into a drag session.
 *
 * Movement is tracked on `window` rather than on the element, so the drag
 * survives the pointer leaving the element, entering an overlay, or the
 * element being moved in the DOM mid-drag.
 */
export function bindPointer(el: HTMLElement, opts: PointerOptions): Handle {
  const distanceThreshold = opts.distance ?? DEFAULTS.distance;
  const delay = opts.delay ?? DEFAULTS.delay;
  const tolerance = opts.tolerance ?? DEFAULTS.tolerance;

  let session: DragSession | null = null;
  let active = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const previousTouchAction = el.style.touchAction;
  el.style.touchAction = opts.touchAction ?? 'none';

  function update(e: PointerEvent) {
    if (!session) return;
    session.point = { x: e.clientX, y: e.clientY };
    session.delta = { x: e.clientX - session.origin.x, y: e.clientY - session.origin.y };
    session.event = e;
  }

  function activate() {
    if (!session || active) return;

    // onStart can re-enter: a consumer may call session.cancel() or the
    // handle's destroy() from inside it, both of which run teardown and null
    // the session. Without re-checking, we would go on to lock the page for a
    // drag that no longer exists, and never unlock it.
    const refused = opts.onStart?.(session) === false;
    if (refused) {
      teardown(true);
      return;
    }
    if (!session) return;

    active = true;
    lockPage();
  }

  function onMove(e: PointerEvent) {
    if (!session || e.pointerId !== session.pointerId) return;
    update(e);

    if (!active) {
      const travelled = Math.hypot(session.delta.x, session.delta.y);
      if (session.pointerType === 'touch') {
        // Still inside the press delay: a real swipe means the user wants to
        // scroll, so give the gesture back to the browser.
        if (travelled > tolerance) teardown(true);
      } else if (travelled >= distanceThreshold) {
        activate();
      }
      // Fall through when the drag just started, so the element responds on
      // this event rather than waiting for the next one.
      if (!active) return;
    }

    if (e.cancelable) e.preventDefault();
    opts.onMove?.(session);
  }

  function onUp(e: PointerEvent) {
    if (!session || e.pointerId !== session.pointerId) return;
    update(e);
    teardown(false);
  }

  function onCancel(e: PointerEvent) {
    if (!session || e.pointerId !== session.pointerId) return;
    teardown(true);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && session) {
      e.preventDefault();
      teardown(true);
    }
  }

  // A drag that finishes over a link or button must not also fire a click.
  function swallowNextClick() {
    const stop = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
  }

  function teardown(cancelled: boolean) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKeyDown);

    const finished = session;
    const wasActive = active;
    session = null;
    active = false;

    if (wasActive) {
      unlockPage();
      swallowNextClick();
    }
    if (finished && wasActive) opts.onEnd?.(finished, cancelled);
  }

  function onDown(e: PointerEvent) {
    if (session) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.isPrimary === false) return;

    const path = pathOf(e);
    if (opts.cancel && matchesIn(path, el, opts.cancel)) return;
    if (opts.handle && !matchesIn(path, el, opts.handle)) return;

    session = {
      pointerId: e.pointerId,
      pointerType: e.pointerType || 'mouse',
      origin: { x: e.clientX, y: e.clientY },
      point: { x: e.clientX, y: e.clientY },
      delta: { x: 0, y: 0 },
      event: e,
      path,
      cancel: () => teardown(true),
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKeyDown);

    if (session.pointerType === 'touch') {
      if (delay <= 0) activate();
      else timer = setTimeout(activate, delay);
    } else if (distanceThreshold <= 0) {
      activate();
    }
  }

  el.addEventListener('pointerdown', onDown);

  return {
    destroy() {
      teardown(true);
      el.removeEventListener('pointerdown', onDown);
      el.style.touchAction = previousTouchAction;
    },
  };
}
