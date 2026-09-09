import { paint, paintNow, resolveBounds, stateOf } from './core/box';
import { CLASS } from './core/constants';
import { invariant } from './core/invariant';
import { normaliseGrid } from './core/options';
import { boxOf, clampOffset, snap } from './core/geometry';
import { bindPointer, type DragSession } from './core/pointer';
import { scaleOf, unscale, unscaleBox } from './core/scale';
import type { Activation, Axis, Bounds, Box, Handle, Point } from './core/types';

export interface DragEvent {
  element: HTMLElement;
  /** Current offset from where the element sits in normal flow. */
  offset: Point;
  /** Pointer position in viewport coordinates. */
  point: Point;
  /** Pointer travel since the press began. */
  delta: Point;
  event: PointerEvent;
  cancel(): void;
}

export interface DraggableOptions extends Activation {
  /** Restrict movement to one axis. Default 'both'. */
  axis?: Axis;
  /** Keep the element inside this area. */
  bounds?: Bounds;
  /** Snap to a grid, in pixels. A single number applies to both axes. */
  grid?: number | [number, number];
  /**
   * Where the grid starts counting from. Defaults to the bounds area if there
   * is one, otherwise the element's containing block — so the element lands on
   * the lines you can actually see rather than on an invisible page-wide grid.
   */
  gridOrigin?: 'bounds' | 'viewport' | Element;
  /** Set true to keep the binding but stop responding. */
  disabled?: boolean;
  touchAction?: 'none' | 'auto' | 'manipulation';
  onStart?(event: DragEvent): void | boolean;
  onMove?(event: DragEvent): void;
  onEnd?(event: DragEvent, cancelled: boolean): void;
}

export interface DraggableHandle extends Handle {
  /** Move the element to an explicit offset. */
  moveTo(x: number, y: number): void;
  /** Return the element to its natural position. */
  reset(): void;
  setDisabled(disabled: boolean): void;
}

export function draggable(el: HTMLElement, options: DraggableOptions = {}): DraggableHandle {
  invariant(el instanceof HTMLElement, `draggable() needs an HTMLElement, got ${typeof el}`);
  const grid = normaliseGrid(options.grid);

  let disabled = options.disabled ?? false;

  // Measured once per drag. Nothing reads layout again until the drag ends.
  let origin: Box = { left: 0, top: 0, width: 0, height: 0 };
  let limit: Box | null = null;
  let startOffset: Point = { x: 0, y: 0 };
  let gridOrigin: Point = { x: 0, y: 0 };
  // Rendered pixels per layout pixel, from any transformed ancestor.
  let scale: Point = { x: 1, y: 1 };

  function resolveGridOrigin(area: Box | null): Point {
    if (options.gridOrigin === 'viewport') return { x: 0, y: 0 };

    // Prefer an element, because a grid you can see is almost always a
    // background on a container — and background grids start at the padding
    // edge, inside any border. Measuring to the border box instead would put
    // the element half a border off every line.
    const source =
      options.gridOrigin && typeof options.gridOrigin !== 'string'
        ? options.gridOrigin
        : options.bounds instanceof Element
          ? options.bounds
          : options.bounds === 'parent'
            ? el.parentElement
            : ((el.offsetParent as HTMLElement | null) ?? el.parentElement);

    if (source) {
      const b = boxOf(source);
      return { x: b.left + source.clientLeft, y: b.top + source.clientTop };
    }
    return area ? { x: area.left, y: area.top } : { x: 0, y: 0 };
  }

  function payload(session: DragSession): DragEvent {
    const state = stateOf(el);
    return {
      element: el,
      offset: { x: state.x, y: state.y },
      point: session.point,
      delta: session.delta,
      event: session.event,
      cancel: session.cancel,
    };
  }

  const pointer = bindPointer(el, {
    ...options,
    onStart(session) {
      if (disabled) return false;
      const state = stateOf(el);
      const visual = boxOf(el);

      scale = scaleOf(el);
      startOffset = { x: state.x, y: state.y };
      // Where the element would sit with no offset applied, in layout pixels.
      // The offset we compute is a CSS translate, so every box it is compared
      // against has to be in the same units.
      origin = unscaleBox(
        {
          left: visual.left - state.x * scale.x,
          top: visual.top - state.y * scale.y,
          width: visual.width,
          height: visual.height,
        },
        scale,
      );
      const area = resolveBounds(el, options.bounds ?? null);
      limit = area ? unscaleBox(area, scale) : null;
      gridOrigin = grid ? resolveGridOrigin(limit) : { x: 0, y: 0 };

      // Ask before marking. A refusal has to leave the element exactly as it
      // was; adding the class first left it permanently styled as dragging,
      // because the pointer layer skips onEnd for a refused start.
      if (options.onStart?.(payload(session)) === false) return false;
      el.classList.add(CLASS.dragging);
      return true;
    },

    onMove(session) {
      const state = stateOf(el);
      const delta = unscale(session.delta, scale);
      let x = options.axis === 'y' ? startOffset.x : startOffset.x + delta.x;
      let y = options.axis === 'x' ? startOffset.y : startOffset.y + delta.y;

      if (grid) {
        x = snap(origin.left + x, grid[0], gridOrigin.x) - origin.left;
        y = snap(origin.top + y, grid[1], gridOrigin.y) - origin.top;
      }

      ({ x, y } = clampOffset(origin, { x, y }, limit));

      if (x === state.x && y === state.y) return;
      state.x = x;
      state.y = y;
      paint(el);
      options.onMove?.(payload(session));
    },

    onEnd(session, cancelled) {
      if (cancelled) {
        const state = stateOf(el);
        state.x = startOffset.x;
        state.y = startOffset.y;
        paint(el);
      }
      el.classList.remove(CLASS.dragging);
      options.onEnd?.(payload(session), cancelled);
    },
  });

  return {
    moveTo(x, y) {
      const state = stateOf(el);
      state.x = x;
      state.y = y;
      paintNow(el);
    },
    reset() {
      const state = stateOf(el);
      state.x = 0;
      state.y = 0;
      paintNow(el);
    },
    setDisabled(next) {
      disabled = next;
    },
    destroy() {
      pointer.destroy();
      el.classList.remove(CLASS.dragging);
    },
  };
}
