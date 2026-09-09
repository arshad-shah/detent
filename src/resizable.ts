import { paint, resolveBounds, stateOf } from './core/box';
import { boxOf } from './core/geometry';
import { bindPointer } from './core/pointer';
import {
  ALL_HANDLES,
  computeResize,
  directionOf,
  type HandleName,
  type ResizeLimits,
} from './core/resize-math';
import type { Activation, Bounds, Box, Handle } from './core/types';

export interface ResizeEvent {
  element: HTMLElement;
  width: number;
  height: number;
  handle: HandleName;
  event: PointerEvent;
  cancel(): void;
}

export interface ResizableOptions extends Omit<Activation, 'handle'> {
  /**
   * Which edges and corners can be grabbed. Defaults to all eight.
   *
   * As an array, the library creates its own handle elements inside the
   * target. As an object, it binds to elements you already have — pass a
   * selector or an element per direction. Use the object form when appending
   * children would disturb your component: framework rendering, `:last-child`
   * and `:nth-child` rules, or code that walks `element.children`.
   */
  handles?: HandleName[] | Partial<Record<HandleName, string | HTMLElement>>;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /**
   * Hold a width-to-height ratio. `true` keeps the element's starting ratio,
   * a number sets one explicitly (16 / 9).
   */
  aspectRatio?: boolean | number;
  /** Snap the size to a grid, in pixels. */
  grid?: number | [number, number];
  /** Keep the element inside this area. */
  bounds?: Bounds;
  disabled?: boolean;
  onStart?(event: ResizeEvent): void | boolean;
  onResize?(event: ResizeEvent): void;
  onEnd?(event: ResizeEvent, cancelled: boolean): void;
}

export interface ResizableHandle extends Handle {
  setDisabled(disabled: boolean): void;
}

const RESIZING_CLASS = 'dk-resizing';

export function resizable(el: HTMLElement, options: ResizableOptions = {}): ResizableHandle {
  const supplied = Array.isArray(options.handles) || !options.handles ? null : options.handles;
  const names = (supplied ? Object.keys(supplied) : (options.handles as HandleName[] | undefined) ?? ALL_HANDLES) as HandleName[];
  const grid: [number, number] | null = options.grid
    ? typeof options.grid === 'number'
      ? [options.grid, options.grid]
      : options.grid
    : null;

  let disabled = options.disabled ?? false;

  const restorePosition = el.style.position;
  // Only needed for handles the library positions itself.
  if (!supplied && getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.classList.add('dk-resizable');

  const bindings: Handle[] = [];
  const created: HTMLElement[] = [];

  for (const name of names) {
    const direction = directionOf(name);
    if (!direction) continue;

    let node: HTMLElement | null;
    if (supplied) {
      const target = supplied[name];
      node = typeof target === 'string' ? el.querySelector<HTMLElement>(target) : (target ?? null);
      if (!node) continue;
      node.setAttribute('data-dk-handle', name);
    } else {
      node = document.createElement('span');
      node.className = `dk-handle dk-handle-${name}`;
      node.setAttribute('data-dk-handle', name);
      node.setAttribute('aria-hidden', 'true');
      el.appendChild(node);
      created.push(node);
    }

    bindings.push(bindHandle(node, name, direction));
  }

  function bindHandle(
    node: HTMLElement,
    name: HandleName,
    [dirX, dirY]: [-1 | 0 | 1, -1 | 0 | 1],
  ): Handle {
    let startWidth = 0;
    let startHeight = 0;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let limits: ResizeLimits = {
      minWidth: 0,
      minHeight: 0,
      maxWidth: Infinity,
      maxHeight: Infinity,
    };
    let aspect: number | null = null;

    function payload(event: PointerEvent, cancel: () => void): ResizeEvent {
      const state = stateOf(el);
      return {
        element: el,
        width: state.width ?? startWidth,
        height: state.height ?? startHeight,
        handle: name,
        event,
        cancel,
      };
    }

    return bindPointer(node, {
      distance: options.distance,
      delay: options.delay,
      tolerance: options.tolerance,
      cancel: options.cancel,

      onStart(session) {
        if (disabled) return false;
        const state = stateOf(el);
        const visual = boxOf(el);

        startWidth = visual.width;
        startHeight = visual.height;
        startX = state.x;
        startY = state.y;
        originLeft = visual.left - state.x;
        originTop = visual.top - state.y;

        aspect =
          options.aspectRatio === true
            ? startWidth / startHeight
            : typeof options.aspectRatio === 'number'
              ? options.aspectRatio
              : null;

        limits = {
          minWidth: options.minWidth ?? 16,
          minHeight: options.minHeight ?? 16,
          maxWidth: options.maxWidth ?? Infinity,
          maxHeight: options.maxHeight ?? Infinity,
        };

        // Turn the containing area into a size ceiling for this handle, so the
        // element runs out of room instead of escaping its container.
        const area: Box | null = resolveBounds(el, options.bounds ?? null);
        if (area) {
          const left = originLeft + startX;
          const top = originTop + startY;
          if (dirX > 0) limits.maxWidth = Math.min(limits.maxWidth, area.left + area.width - left);
          if (dirX < 0) limits.maxWidth = Math.min(limits.maxWidth, left + startWidth - area.left);
          if (dirY > 0) limits.maxHeight = Math.min(limits.maxHeight, area.top + area.height - top);
          if (dirY < 0) limits.maxHeight = Math.min(limits.maxHeight, top + startHeight - area.top);
        }

        el.classList.add(RESIZING_CLASS);
        return options.onStart?.(payload(session.event, session.cancel));
      },

      onMove(session) {
        const result = computeResize({
          startWidth,
          startHeight,
          dirX,
          dirY,
          delta: session.delta,
          limits,
          aspect,
          grid,
        });

        const state = stateOf(el);
        state.width = result.width;
        state.height = result.height;
        state.x = startX + result.offsetX;
        state.y = startY + result.offsetY;
        paint(el);
        options.onResize?.(payload(session.event, session.cancel));
      },

      onEnd(session, cancelled) {
        if (cancelled) {
          const state = stateOf(el);
          state.width = startWidth;
          state.height = startHeight;
          state.x = startX;
          state.y = startY;
          paint(el);
        }
        el.classList.remove(RESIZING_CLASS);
        options.onEnd?.(payload(session.event, session.cancel), cancelled);
      },
    });
  }

  return {
    setDisabled(next) {
      disabled = next;
    },
    destroy() {
      for (const binding of bindings) binding.destroy();
      // Only remove handles the library made. Elements you supplied are yours.
      for (const node of created) node.remove();
      if (supplied) {
        for (const name of names) el.querySelector(`[data-dk-handle="${name}"]`)?.removeAttribute('data-dk-handle');
      }
      el.style.position = restorePosition;
      el.classList.remove('dk-resizable', RESIZING_CLASS);
    },
  };
}
