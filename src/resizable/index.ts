import { paint, resolveBounds, stateOf } from '../core/box';
import { ATTR, CLASS, DEFAULTS } from '../core/constants';
import { boxOf } from '../core/geometry';
import { invariant } from '../core/invariant';
import { normaliseGrid } from '../core/options';
import { bindPointer } from '../core/pointer';
import { computeResize, type HandleName, type ResizeLimits } from '../core/resize-math';
import { scaleOf, unscale, unscaleBox } from '../core/scale';
import type { Box, Handle, Point } from '../core/types';
import { resolveHandles, type ResolvedHandle } from './handles';
import type { ResizableHandle, ResizableOptions, ResizeEvent } from './types';

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

  const grid = normaliseGrid(options.grid);
  let disabled = options.disabled ?? false;

  const handles = resolveHandles(el, options.handles);
  const createdAny = handles.some((handle) => handle.created);

  // A positioning context is only needed for handles the library places
  // itself. Record what we changed so destroy can revert exactly that and
  // nothing else — writing el.style.position unconditionally used to wipe
  // whatever inline position the host page had.
  let restorePosition: string | null = null;
  if (createdAny && getComputedStyle(el).position === 'static') {
    restorePosition = el.style.position;
    el.style.position = 'relative';
  }
  el.classList.add(CLASS.resizable);

  function bindHandle({ node, name, direction: [dirX, dirY] }: ResolvedHandle): Handle {
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

  const bindings = handles.map(bindHandle);

  return {
    setDisabled(next) {
      disabled = next;
    },
    destroy() {
      for (const binding of bindings) binding.destroy();
      for (const handle of handles) {
        if (handle.created) {
          handle.node.remove();
        } else {
          // Elements you supplied are yours; give them back as we found them.
          handle.node.removeAttribute(ATTR.handle);
          handle.node.style.position = '';
          handle.node.style.touchAction = '';
        }
      }
      if (restorePosition !== null) el.style.position = restorePosition;
      el.classList.remove(CLASS.resizable, CLASS.resizing);
    },
  };
}

export type { ResizableOptions, ResizableHandle, ResizeEvent, HandleName };
