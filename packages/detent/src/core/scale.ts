import type { Box, Point } from './types';

const NONE: Point = { x: 1, y: 1 };

/**
 * How many rendered pixels one layout pixel of this element occupies.
 *
 * `getBoundingClientRect` reports post-transform size; `offsetWidth` reports
 * pre-transform layout size. Their ratio is the accumulated scale of every
 * ancestor transform, which is exactly the factor pointer travel has to be
 * divided by for the element to stay under the cursor.
 *
 * Returns 1 for anything with no layout box — a hidden element cannot be
 * dragged anyway, and 1 keeps the caller's arithmetic finite.
 */
export function scaleOf(el: HTMLElement): Point {
  const rect = el.getBoundingClientRect();
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  if (!width || !height || !rect.width || !rect.height) return NONE;
  return { x: rect.width / width, y: rect.height / height };
}

/** Turn pointer travel in rendered pixels into travel in layout pixels. */
export function unscale(delta: Point, scale: Point): Point {
  if (scale.x === 1 && scale.y === 1) return delta;
  return { x: delta.x / scale.x, y: delta.y / scale.y };
}

/**
 * Restate a rendered box in layout pixels.
 *
 * Only differences between boxes converted this way are meaningful — an
 * absolute position depends on where the transform's origin sits — and
 * differences are all the bounds and limit arithmetic uses.
 */
export function unscaleBox(box: Box, scale: Point): Box {
  if (scale.x === 1 && scale.y === 1) return box;
  return {
    left: box.left / scale.x,
    top: box.top / scale.y,
    width: box.width / scale.x,
    height: box.height / scale.y,
  };
}
