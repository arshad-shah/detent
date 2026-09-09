import { paint, resolveBounds, stateOf } from './core/box';
import { ATTR, CLASS, DEFAULTS, handleClass } from './core/constants';
import { invariant } from './core/invariant';
import { normaliseGrid } from './core/options';
import { boxOf } from './core/geometry';
import { bindPointer } from './core/pointer';
import { scaleOf, unscale, unscaleBox } from './core/scale';
import {
  ALL_HANDLES,
  computeResize,
  directionOf,
  type HandleName,
  type ResizeLimits,
} from './core/resize-math';
import type { Activation, Bounds, Box, Handle, Point } from './core/types';

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

export function resizable(el: HTMLElement, options: ResizableOptions = {}): ResizableHandle {
  invariant(el instanceof HTMLElement, `resizable() needs an HTMLElement, got ${typeof el}`);
  invariant(
    (options.maxWidth ?? Infinity) >= (options.minWidth ?? DEFAULTS.minSize),
    'resizable() maxWidth is below minWidth',
  );
  invariant(
    (options.maxHeight ?? Infinity) >= (options.minHeight ?? DEFAULTS.minSize),
    'resizable() maxHeight is below minHeight',
  );
  const supplied = Array.isArray(options.handles) || !options.handles ? null : options.handles;
  const names = (supplied ? Object.keys(supplied) : (options.handles as HandleName[] | undefined) ?? ALL_HANDLES) as HandleName[];
  const grid = normaliseGrid(options.grid);

  let disabled = options.disabled ?? false;

  const restorePosition = el.style.position;
  // Only needed for handles the library positions itself.
  if (!supplied && getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.classList.add(CLASS.resizable);

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
      node.setAttribute(ATTR.handle, name);
    } else {
      node = document.createElement('span');
      node.className = `${CLASS.handle} ${handleClass(name)}`;
      node.setAttribute(ATTR.handle, name);
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
    // Rendered pixels per layout pixel, from any transformed ancestor.
    let scale: Point = { x: 1, y: 1 };

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

        // Everything below is in layout pixels: state.width is written to CSS,
        // so the measured box and the bounds have to be converted out of the
        // rendered pixels getBoundingClientRect reports.
        scale = scaleOf(el);
        startWidth = visual.width / scale.x;
        startHeight = visual.height / scale.y;
        startX = state.x;
        startY = state.y;
        originLeft = visual.left / scale.x - state.x;
        originTop = visual.top / scale.y - state.y;

        aspect =
          options.aspectRatio === true
            ? startWidth / startHeight
            : typeof options.aspectRatio === 'number'
              ? options.aspectRatio
              : null;

        limits = {
          minWidth: options.minWidth ?? DEFAULTS.minSize,
          minHeight: options.minHeight ?? DEFAULTS.minSize,
          maxWidth: options.maxWidth ?? Infinity,
          maxHeight: options.maxHeight ?? Infinity,
        };

        // Turn the containing area into a size ceiling for this handle, so the
        // element runs out of room instead of escaping its container.
        const rendered: Box | null = resolveBounds(el, options.bounds ?? null);
        const area = rendered ? unscaleBox(rendered, scale) : null;
        if (area) {
          const left = originLeft + startX;
          const top = originTop + startY;
          if (dirX > 0) limits.maxWidth = Math.min(limits.maxWidth, area.left + area.width - left);
          if (dirX < 0) limits.maxWidth = Math.min(limits.maxWidth, left + startWidth - area.left);
          if (dirY > 0) limits.maxHeight = Math.min(limits.maxHeight, area.top + area.height - top);
          if (dirY < 0) limits.maxHeight = Math.min(limits.maxHeight, top + startHeight - area.top);
        }

        el.classList.add(CLASS.resizing);
        return options.onStart?.(payload(session.event, session.cancel));
      },

      onMove(session) {
        const result = computeResize({
          startWidth,
          startHeight,
          dirX,
          dirY,
          delta: unscale(session.delta, scale),
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
        el.classList.remove(CLASS.resizing);
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
        for (const name of names) el.querySelector(`[${ATTR.handle}="${name}"]`)?.removeAttribute(ATTR.handle);
      }
      el.style.position = restorePosition;
      el.classList.remove(CLASS.resizable, CLASS.resizing);
    },
  };
}
