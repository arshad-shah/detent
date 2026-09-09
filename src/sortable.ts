import { paintNow, stateOf } from './core/box';
import { createAutoScroll, type AutoScrollOptions } from './core/autoscroll';
import * as flip from './core/flip';
import {
  boxOf,
  contains,
  detectAxis,
  resolveInsertIndex,
  scrollAncestorsOf,
  scrollParentOf,
  totalScroll,
} from './core/geometry';
import { bindPointer } from './core/pointer';
import type { Activation, Box, Handle, Point } from './core/types';

export interface SortLocation {
  container: HTMLElement;
  index: number;
}

export interface SortEvent {
  item: HTMLElement;
  from: SortLocation;
  to: SortLocation;
}

export interface SortableOptions extends Activation {
  /**
   * Lists sharing a group name can pass items between each other. Leave it
   * unset to keep a list self-contained.
   */
  group?: string;
  /** Which children are sortable. Defaults to every element child. */
  items?: string;
  /** How the list reads. 'auto' works it out from where the items sit. */
  direction?: 'auto' | 'x' | 'y' | 'grid';
  /** Reorder animation in milliseconds. 0 turns it off. Default 180. */
  animation?: number;
  /** Scroll the list when the pointer nears its edges. Default true. */
  autoScroll?: boolean | AutoScrollOptions;
  /** Allow reordering with the keyboard. Default true. */
  keyboard?: boolean;
  /** Stacking order for the item being moved. Default 20. */
  zIndex?: number;
  /**
   * Whether the list claims touch gestures. Defaults to 'none', or 'auto' when
   * the list scrolls itself so that swiping still works.
   */
  touchAction?: 'none' | 'auto' | 'manipulation';
  disabled?: boolean;
  onStart?(item: HTMLElement, from: SortLocation): void | boolean;
  onMove?(item: HTMLElement, to: SortLocation): void;
  /** Fires once, on drop, only when the item actually moved. */
  onSort?(event: SortEvent): void;
  onEnd?(item: HTMLElement, cancelled: boolean): void;
}

interface Instance {
  container: HTMLElement;
  options: SortableOptions;
  items(): HTMLElement[];
}

const registry = new Set<Instance>();
const SORTING_CLASS = 'dk-sorting';

function childrenOf(instance: Instance): HTMLElement[] {
  const { container, options } = instance;
  const nodes = options.items
    ? container.querySelectorAll<HTMLElement>(options.items)
    : container.children;
  const out: HTMLElement[] = [];
  for (const node of Array.from(nodes)) {
    if (node instanceof HTMLElement && !node.hasAttribute('data-dk-ignore')) out.push(node);
  }
  return out;
}

function announce(message: string) {
  let region = document.getElementById('dk-live-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'dk-live-region';
    region.setAttribute('aria-live', 'assertive');
    region.setAttribute('aria-atomic', 'true');
    region.style.cssText =
      'position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
    document.body.appendChild(region);
  }
  region.textContent = message;
}

/** Put `item` at `index` among `siblings` inside `container`. */
function placeAt(container: HTMLElement, item: HTMLElement, siblings: HTMLElement[], index: number) {
  const before = siblings[index] ?? null;
  if (before === item) return false;
  if (!before && item.parentElement === container && item.nextElementSibling === null) return false;
  container.insertBefore(item, before);
  return true;
}

export function sortable(container: HTMLElement, options: SortableOptions = {}): Handle {
  const animation = options.animation ?? 180;
  const useKeyboard = options.keyboard !== false;
  let disabled = options.disabled ?? false;

  const instance: Instance = { container, options, items: () => childrenOf(instance) };
  registry.add(instance);
  container.classList.add('dk-sortable');

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

  // Sibling positions are measured once and reused until something moves.
  let cachedSiblings: HTMLElement[] = [];
  let cachedRects: Box[] = [];
  let cacheHost: Instance | null = null;

  function refreshCache(target: Instance) {
    cacheHost = target;
    cachedSiblings = target.items().filter((node) => node !== item);
    cachedRects = cachedSiblings.map(boxOf);
    measuredScroll = totalScroll(scrollAncestors);
  }

  function hostFor(point: Point): Instance {
    if (contains(boxOf(host.container), point)) return host;
    for (const candidate of registry) {
      if (candidate === host) continue;
      const sameGroup =
        candidate.options.group != null && candidate.options.group === instance.options.group;
      const sameList = candidate === instance;
      if (!sameGroup && !sameList) continue;
      if (!candidate.container.isConnected) continue;
      if (contains(boxOf(candidate.container), point)) return candidate;
    }
    return host;
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
    state.x = visual.left - base.left;
    state.y = visual.top - base.top;
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
    // the scroll back to keep the item under the pointer.
    state.x = anchorOffset.x + (lastDelta.x - anchorDelta.x) + (scroll.x - anchorScroll.x);
    state.y = anchorOffset.y + (lastDelta.y - anchorDelta.y) + (scroll.y - anchorScroll.y);
    paintNow(item);

    const target = hostFor(lastPoint);
    const scrolledSinceMeasure = scroll.x !== measuredScroll.x || scroll.y !== measuredScroll.y;
    if (target !== cacheHost || scrolledSinceMeasure) {
      host = target;
      refreshCache(target);
    }
    if (!cachedRects.length && !contains(boxOf(target.container), lastPoint)) return;

    const axis =
      !target.options.direction || target.options.direction === 'auto'
        ? detectAxis(cachedRects)
        : target.options.direction;
    const index = resolveInsertIndex(cachedRects, lastPoint, axis);

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

  // A list that scrolls itself must keep its swipe gesture, or a finger can
  // never reach the items further down. The press delay is what separates a
  // scroll from a lift in that case.
  const scrollsItself = /auto|scroll|overlay/.test(
    getComputedStyle(container).overflowY + getComputedStyle(container).overflowX,
  );

  const pointer = bindPointer(container, {
    ...options,
    touchAction: options.touchAction ?? (scrollsItself ? 'auto' : 'none'),
    onStart(session) {
      if (disabled) return false;

      const candidates = instance.items();
      const found = session.path.find(
        (node) => node instanceof HTMLElement && candidates.includes(node),
      ) as HTMLElement | undefined;
      if (!found) return false;

      item = found;
      host = instance;
      fromContainer = container;
      fromIndex = candidates.indexOf(item);

      const state = stateOf(item);
      anchorOffset = { x: state.x, y: state.y };
      anchorDelta = { x: 0, y: 0 };
      scrollAncestors = scrollAncestorsOf(item);
      anchorScroll = totalScroll(scrollAncestors);
      lastPoint = session.point;
      lastDelta = session.delta;

      // Scroll events do not bubble, but they do pass through the capture
      // phase — so one listener on the window catches the page scrolling, any
      // container scrolling, and a wheel or trackpad while the pointer is held
      // perfectly still.
      window.addEventListener('scroll', applyMove, { capture: true, passive: true });

      // Lift the item above its neighbours without disturbing how it is
      // positioned. Only a statically positioned item needs a position at all,
      // and anything already positioned keeps whatever it had.
      restorePosition = item.style.position;
      restoreZIndex = item.style.zIndex;
      if (getComputedStyle(item).position === 'static') item.style.position = 'relative';
      item.style.zIndex = String(options.zIndex ?? 20);

      item.classList.add(SORTING_CLASS);
      refreshCache(instance);

      if (options.autoScroll !== false) {
        scroller = createAutoScroll(scrollParentOf(item), {
          ...(typeof options.autoScroll === 'object' ? options.autoScroll : {}),
          onScroll: applyMove,
        });
      }

      return options.onStart?.(item, { container: fromContainer, index: fromIndex });
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
      window.removeEventListener('scroll', applyMove, { capture: true } as EventListenerOptions);
      scroller?.stop();
      scroller = null;

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

      dragged.style.position = restorePosition;
      dragged.style.zIndex = restoreZIndex;
      dragged.classList.remove(SORTING_CLASS);

      const toContainer = dragged.parentElement as HTMLElement;
      const toIndex = childrenOf({ ...instance, container: toContainer }).indexOf(dragged);
      const moved = !cancelled && (toContainer !== fromContainer || toIndex !== fromIndex);

      item = null;
      cachedSiblings = [];
      cachedRects = [];
      cacheHost = null;

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

  // --- Keyboard reordering -------------------------------------------------
  let lifted: HTMLElement | null = null;
  let liftedFrom = 0;

  function onKeyDown(event: KeyboardEvent) {
    if (!useKeyboard || disabled) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const list = instance.items();
    const current = lifted ?? list.find((node) => node === target || node.contains(target)) ?? null;
    if (!current) return;

    const index = list.indexOf(current);

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (lifted) {
        const to = list.indexOf(lifted);
        lifted.classList.remove(SORTING_CLASS);
        announce(`Dropped at position ${to + 1} of ${list.length}.`);
        if (to !== liftedFrom) {
          options.onSort?.({
            item: lifted,
            from: { container, index: liftedFrom },
            to: { container, index: to },
          });
        }
        lifted = null;
      } else {
        lifted = current;
        liftedFrom = index;
        current.classList.add(SORTING_CLASS);
        announce(`Lifted from position ${index + 1} of ${list.length}. Use the arrow keys to move.`);
      }
      return;
    }

    if (event.key === 'Escape' && lifted) {
      event.preventDefault();
      const siblings = list.filter((node) => node !== lifted);
      const snapshot = flip.record(list);
      placeAt(container, lifted, siblings, liftedFrom);
      flip.play(snapshot, animation);
      lifted.classList.remove(SORTING_CLASS);
      announce('Move cancelled.');
      lifted = null;
      return;
    }

    if (!lifted) return;
    const step =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!step) return;

    event.preventDefault();
    const next = Math.max(0, Math.min(list.length - 1, index + step));
    if (next === index) return;

    const siblings = list.filter((node) => node !== lifted);
    const snapshot = flip.record(list);
    placeAt(container, lifted, siblings, next);
    flip.play(snapshot, animation);
    lifted.focus?.();
    announce(`Position ${next + 1} of ${list.length}.`);
  }

  container.addEventListener('keydown', onKeyDown);

  return {
    destroy() {
      pointer.destroy();
      container.removeEventListener('keydown', onKeyDown);
      container.classList.remove('dk-sortable');
      registry.delete(instance);
    },
  };
}

/** Read the current order of a sortable list. Handy for saving. */
export function orderOf(container: HTMLElement, items?: string): HTMLElement[] {
  return childrenOf({ container, options: { items }, items: () => [] });
}
