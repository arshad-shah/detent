import { paintNow, stateOf } from '../core/box';
import { createAutoScroll } from '../core/autoscroll';
import { CLASS, DEFAULTS } from '../core/constants';
import * as flip from '../core/flip';
import { boxOf, contains, detectAxis, isRtl, resolveInsertIndex } from '../core/geometry';
import { invariant } from '../core/invariant';
import { bindPointer } from '../core/pointer';
import { scaleOf, unscale } from '../core/scale';
import { scrollAncestorsOf, scrollParentOf, totalScroll } from '../core/scroll';
import type { Box, Handle, Point } from '../core/types';
import { bindKeyboard } from './keyboard';
import { acquireLiveRegion, releaseLiveRegion } from './live-region';
import { childrenOf, placeAt } from './place';
import { eachList, registerList, unregisterList, type Instance } from './registry';
import type { SortableOptions, SortLocation } from './types';

interface Candidate {
  instance: Instance;
  box: Box;
}

export function sortable(container: HTMLElement, options: SortableOptions = {}): Handle {
  invariant(container instanceof HTMLElement, 'sortable() needs an HTMLElement container');
  const animation = options.animation ?? DEFAULTS.animation;
  const useKeyboard = options.keyboard !== false;
  let disabled = options.disabled ?? false;

  const instance: Instance = { container, options, items: () => childrenOf(instance) };
  registerList(instance);
  container.classList.add(CLASS.sortable);
  if (useKeyboard) acquireLiveRegion();

  // --- Live drag state -----------------------------------------------------
  let item: HTMLElement | null = null;
  let fromContainer: HTMLElement = container;
  let fromIndex = 0;
  let host: Instance = instance;
  let anchorOffset: Point = { x: 0, y: 0 };
  let anchorDelta: Point = { x: 0, y: 0 };
  let scroller: ReturnType<typeof createAutoScroll> | null = null;

  // Scrolling moves every resting position under the drag, so both the item's
  // offset and the cached neighbour boxes have to be corrected when it happens.
  let scrollAncestors: Element[] = [];
  let anchorScroll: Point = { x: 0, y: 0 };
  let measuredScroll: Point = { x: 0, y: 0 };
  let lastPoint: Point = { x: 0, y: 0 };
  let lastDelta: Point = { x: 0, y: 0 };
  let restorePosition = '';
  let restoreZIndex = '';
  // Rendered pixels per layout pixel, from any transformed ancestor.
  let scale: Point = { x: 1, y: 1 };
  // Read once per host, not per move: it needs a computed style.
  let rtl = false;

  // Sibling positions are measured once and reused until something moves.
  let cachedSiblings: HTMLElement[] = [];
  let cachedRects: Box[] = [];
  let cacheHost: Instance | null = null;
  let candidates: Candidate[] = [];

  function refreshCache(target: Instance) {
    cacheHost = target;
    measureCandidates();
    cachedSiblings = target.items().filter((node) => node !== item);
    cachedRects = cachedSiblings.map(boxOf);
    measuredScroll = totalScroll(scrollAncestors);
  }

  /**
   * Which lists this drag could land in, measured once.
   *
   * hostFor used to call getBoundingClientRect on every registered list on
   * every pointer move — a forced synchronous layout per list per move, which
   * on a twenty-column board is twenty reflows a frame.
   */
  function measureCandidates() {
    candidates = [];
    for (const candidate of eachList()) {
      const sameGroup =
        candidate.options.group != null && candidate.options.group === instance.options.group;
      if (candidate !== instance && !sameGroup) continue;
      if (!candidate.container.isConnected) continue;
      candidates.push({ instance: candidate, box: boxOf(candidate.container) });
    }
  }

  function hostFor(point: Point): Instance {
    for (const candidate of candidates) {
      if (candidate.instance === host && contains(candidate.box, point)) return host;
    }
    for (const candidate of candidates) {
      if (contains(candidate.box, point)) return candidate.instance;
    }
    return host;
  }

  /** The measured box of a candidate list, falling back to a fresh measure. */
  function boxOfHost(target: Instance): Box {
    for (const candidate of candidates) {
      if (candidate.instance === target) return candidate.box;
    }
    return boxOf(target.container);
  }

  /**
   * Re-derive the item's offset after it has been moved in the DOM.
   *
   * Its resting place has changed, so the offset that used to hold it under the
   * pointer no longer does. `visual` is where it appeared just before the move;
   * measuring the new resting place tells us the offset that puts it back.
   */
  function reanchor(visual: Box, delta: Point) {
    if (!item) return;
    const state = stateOf(item);

    item.style.transform = '';
    const base = boxOf(item);
    state.x = (visual.left - base.left) / scale.x;
    state.y = (visual.top - base.top) / scale.y;
    paintNow(item);

    anchorOffset = { x: state.x, y: state.y };
    anchorDelta = { ...delta };
    anchorScroll = totalScroll(scrollAncestors);
  }

  /**
   * Reposition the item and work out where it now belongs.
   *
   * Called on every pointer move, and again on every auto-scroll step — a
   * pointer held still against the edge of a list sends no events, but the
   * content underneath it is still moving.
   */
  function applyMove() {
    if (!item) return;
    const state = stateOf(item);
    const scroll = totalScroll(scrollAncestors);

    // Scrolled content drags the item's resting position along with it, so add
    // the scroll back to keep the item under the pointer. Pointer travel is in
    // rendered pixels while the offset written is a CSS translate; scroll
    // positions are already in the scroller's own layout pixels.
    const travel = unscale(
      { x: lastDelta.x - anchorDelta.x, y: lastDelta.y - anchorDelta.y },
      scale,
    );
    state.x = anchorOffset.x + travel.x + (scroll.x - anchorScroll.x);
    state.y = anchorOffset.y + travel.y + (scroll.y - anchorScroll.y);
    paintNow(item);

    const target = hostFor(lastPoint);
    const scrolledSinceMeasure = scroll.x !== measuredScroll.x || scroll.y !== measuredScroll.y;
    if (target !== cacheHost || scrolledSinceMeasure) {
      host = target;
      // A cross-list drop follows the destination's writing direction.
      rtl = isRtl(target.container);
      refreshCache(target);
    }
    if (!cachedRects.length && !contains(boxOfHost(target), lastPoint)) return;

    const axis =
      !target.options.direction || target.options.direction === 'auto'
        ? detectAxis(cachedRects)
        : target.options.direction;
    const index = resolveInsertIndex(cachedRects, lastPoint, axis, rtl);

    const before = cachedSiblings[index] ?? null;
    const alreadyThere = before
      ? item.nextElementSibling === before && item.parentElement === target.container
      : item.parentElement === target.container && item.nextElementSibling === null;
    if (alreadyThere) return;

    // Where it looks right now, captured before the DOM move rearranges things.
    const visual = boxOf(item);
    const snapshot = flip.record(cachedSiblings);
    if (!placeAt(target.container, item, cachedSiblings, index)) return;
    reanchor(visual, lastDelta);
    flip.play(snapshot, animation);
    refreshCache(target);

    options.onMove?.(item, { container: target.container, index });
  }

  /**
   * Take ownership of the item: listeners, lifted styles, measurements.
   *
   * Every mutation a drag makes happens here and is undone by endDrag, so
   * there is exactly one teardown path however the drag finishes.
   */
  function beginDrag(found: HTMLElement, from: SortLocation, point: Point, delta: Point) {
    item = found;
    host = instance;
    fromContainer = from.container;
    fromIndex = from.index;

    const state = stateOf(found);
    anchorOffset = { x: state.x, y: state.y };
    anchorDelta = { x: 0, y: 0 };
    scale = scaleOf(found);
    rtl = isRtl(container);
    scrollAncestors = scrollAncestorsOf(found);
    anchorScroll = totalScroll(scrollAncestors);
    lastPoint = point;
    lastDelta = delta;

    // Scroll events do not bubble, but they do pass through the capture phase
    // — so one listener on the window catches the page scrolling, any
    // container scrolling, and a wheel or trackpad while the pointer is held
    // perfectly still.
    window.addEventListener('scroll', applyMove, { capture: true, passive: true });

    // Lift the item above its neighbours without disturbing how it is
    // positioned. Only a statically positioned item needs a position at all,
    // and anything already positioned keeps whatever it had.
    restorePosition = found.style.position;
    restoreZIndex = found.style.zIndex;
    if (getComputedStyle(found).position === 'static') found.style.position = 'relative';
    found.style.zIndex = String(options.zIndex ?? DEFAULTS.zIndex);

    found.classList.add(CLASS.sorting);
    refreshCache(instance);

    if (options.autoScroll !== false) {
      scroller = createAutoScroll(scrollParentOf(found), {
        ...(typeof options.autoScroll === 'object' ? options.autoScroll : {}),
        onScroll: applyMove,
      });
    }
  }

  /** The exact inverse of beginDrag. Safe to call when no drag is running. */
  function endDrag() {
    window.removeEventListener('scroll', applyMove, { capture: true } as EventListenerOptions);
    scroller?.stop();
    scroller = null;

    if (item) {
      item.style.position = restorePosition;
      item.style.zIndex = restoreZIndex;
      item.classList.remove(CLASS.sorting);
    }

    item = null;
    cachedSiblings = [];
    cachedRects = [];
    cacheHost = null;
    candidates = [];
  }

  // A list that scrolls itself must keep its swipe gesture, or a finger can
  // never reach the items further down. The press delay is what separates a
  // scroll from a lift in that case.
  const containerStyle = getComputedStyle(container);
  const scrollsItself = /auto|scroll|overlay/.test(
    containerStyle.overflowY + containerStyle.overflowX,
  );

  const pointer = bindPointer(container, {
    ...options,
    touchAction: options.touchAction ?? (scrollsItself ? 'auto' : 'none'),
    onStart(session) {
      if (disabled) return false;

      const siblings = instance.items();
      const found = session.path.find(
        (node) => node instanceof HTMLElement && siblings.includes(node),
      ) as HTMLElement | undefined;
      if (!found) return false;

      const from = { container, index: siblings.indexOf(found) };

      // Ask before touching anything. A refusal has to leave the page exactly
      // as it was; this used to add the scroll listener and lift the item
      // first, and nothing reverted either.
      if (options.onStart?.(found, from) === false) return false;

      beginDrag(found, from, session.point, session.delta);
      return true;
    },

    onMove(session) {
      lastPoint = session.point;
      lastDelta = session.delta;
      applyMove();
      scroller?.update(session.point);
    },

    onEnd(session, cancelled) {
      if (!item) return;
      const dragged = item;
      const state = stateOf(dragged);

      if (cancelled) {
        const siblings = childrenOf({ ...instance, container: fromContainer }).filter(
          (node) => node !== dragged,
        );
        placeAt(fromContainer, dragged, siblings, fromIndex);
      }

      // Settle the item into its slot rather than snapping there.
      const landing = flip.record([dragged]);
      state.x = 0;
      state.y = 0;
      paintNow(dragged);
      flip.play(landing, animation);

      const toContainer = dragged.parentElement as HTMLElement;
      const toIndex = childrenOf({ ...instance, container: toContainer }).indexOf(dragged);
      const moved = !cancelled && (toContainer !== fromContainer || toIndex !== fromIndex);

      endDrag();

      if (moved) {
        options.onSort?.({
          item: dragged,
          from: { container: fromContainer, index: fromIndex },
          to: { container: toContainer, index: toIndex },
        });
      }
      options.onEnd?.(dragged, cancelled);
    },
  });

  const keyboard = useKeyboard
    ? bindKeyboard(instance, {
        animation,
        isDisabled: () => disabled,
        onSort: options.onSort,
      })
    : null;

  return {
    destroy() {
      pointer.destroy();
      keyboard?.destroy();
      if (useKeyboard) releaseLiveRegion();
      container.classList.remove(CLASS.sortable);
      unregisterList(instance);
    },
  };
}

/** Read the current order of a sortable list. Handy for saving. */
export function orderOf(container: HTMLElement, items?: string): HTMLElement[] {
  return childrenOf({ container, options: { items }, items: () => [] });
}

export type { SortableOptions, SortEvent, SortLocation } from './types';
