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

/** How much to shrink the element by when measuring how its host anchors it. */
const ANCHOR_PROBE = 32;

/**
 * Turn a measured movement into a layout-response coefficient.
 *
 * Only `[-1, 0]` is physically meaningful: shrinking an element can leave its
 * start edge where it is (`0`), move it by half the change (`-0.5`, centred), or
 * by the whole change (`-1`, end-anchored). A number outside that band means the
 * element did not simply shift in response to its own size — a wrapping row can
 * pull an item up onto the previous line when it shrinks — and a wild
 * coefficient would be worse than none, so those fall back to no correction.
 *
 * The deadzone matters as much as the clamp. Sub-pixel layout would otherwise
 * hand back a coefficient like `-0.004` for an absolutely positioned element and
 * introduce a drift where today there is none.
 */
function coefficient(moved: number, probe: number): number {
  const k = moved / probe;
  if (k > -0.02 || k < -1.05) return 0;
  return k < -1 ? -1 : k;
}

/**
 * Measure how the host layout moves the element when its size changes.
 *
 * One synchronous write-read-restore, so the browser cannot paint the probed
 * size and there is nothing to see. Twice per gesture, never per frame: the
 * result is a pair of numbers the move handler then uses as pure arithmetic.
 *
 * It shrinks rather than grows on purpose. Growing an element by 32px can push a
 * flex or inline row past its wrap threshold and measure a wrap instead of an
 * anchor. Shrinking can only ever relieve that pressure, and the band check in
 * `coefficient` catches the case where it relieves it enough to un-wrap.
 */
function measureAnchor(
  el: HTMLElement,
  visual: Box,
  scale: Point,
  startWidth: number,
  startHeight: number,
): Point {
  const width = el.style.width;
  const height = el.style.height;
  // Never probe below 1px, or a min-width would swallow the whole measurement.
  const px = Math.min(ANCHOR_PROBE, Math.max(1, startWidth - 1));
  const py = Math.min(ANCHOR_PROBE, Math.max(1, startHeight - 1));

  el.style.width = `${startWidth - px}px`;
  el.style.height = `${startHeight - py}px`;
  const probed = boxOf(el);
  el.style.width = width;
  el.style.height = height;

  return {
    x: coefficient((visual.left - probed.left) / scale.x, px),
    y: coefficient((visual.top - probed.top) / scale.y, py),
  };
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
    // How the host layout repositions the element when its size changes.
    let anchor: Point = { x: 0, y: 0 };

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

        // Before anything else writes to the element, so the probe measures the
        // host's own layout rather than our own in-progress one.
        anchor = measureAnchor(el, visual, scale, startWidth, startHeight);

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

          // An axis the ratio derives needs a ceiling too. Only the axis the
          // handle drives used to get one, so an `n` handle holding a ratio grew
          // the width with nothing to stop it and walked straight out of the
          // container. A derived axis grows about its centre, so it runs into
          // both edges at once and the nearer one decides.
          if (aspect) {
            if (dirX === 0) {
              const room = Math.min(left - area.left, area.left + area.width - (left + startWidth));
              limits.maxWidth = Math.min(limits.maxWidth, startWidth + 2 * Math.max(0, room));
            }
            if (dirY === 0) {
              const room = Math.min(top - area.top, area.top + area.height - (top + startHeight));
              limits.maxHeight = Math.min(limits.maxHeight, startHeight + 2 * Math.max(0, room));
            }
          }
        }

        // Ask before marking, as draggable and sortable do. A refusal used to
        // leave the element permanently styled as resizing.
        if (options.onStart?.(payload(session.event, session.cancel)) === false) return false;
        el.classList.add(CLASS.resizing);
        return true;
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
          anchor,
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
