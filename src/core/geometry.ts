import type { Box, Point } from './types';

export function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export function centerOf(b: Box): Point {
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

export function contains(b: Box, p: Point): boolean {
  return p.x >= b.left && p.x <= b.left + b.width && p.y >= b.top && p.y <= b.top + b.height;
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Round a value to the nearest step, measured from `origin` rather than from
 * zero — so a box that starts at an odd offset still lands on tidy multiples
 * relative to where it began.
 */
export function snap(value: number, step: number, origin = 0): number {
  if (!step || step <= 1) return value;
  return origin + Math.round((value - origin) / step) * step;
}

/**
 * Limit a movement offset so the moving box stays inside `limit`.
 * Returns the adjusted offset, not the new position.
 */
export function clampOffset(start: Box, offset: Point, limit: Box | null): Point {
  if (!limit) return offset;
  return {
    x: clamp(offset.x, limit.left - start.left, limit.left + limit.width - (start.left + start.width)),
    y: clamp(offset.y, limit.top - start.top, limit.top + limit.height - (start.top + start.height)),
  };
}

export type ListAxis = 'x' | 'y' | 'grid';

/**
 * Work out how a list is laid out by looking at where its items actually sit.
 * A single row is horizontal, a single column is vertical, anything else is a
 * grid and gets handled by nearest-centre instead of a simple midpoint test.
 */
export function detectAxis(rects: Box[]): ListAxis {
  if (rects.length < 2) return 'y';
  let sameRow = true;
  let sameColumn = true;
  const first = rects[0];
  for (let i = 1; i < rects.length; i++) {
    const r = rects[i];
    if (Math.abs(r.top - first.top) > Math.min(first.height, r.height) / 2) sameRow = false;
    if (Math.abs(r.left - first.left) > Math.min(first.width, r.width) / 2) sameColumn = false;
  }
  if (sameRow && !sameColumn) return 'x';
  if (sameColumn && !sameRow) return 'y';
  return sameRow ? 'x' : 'grid';
}

/**
 * Given the boxes of every item in a list *except* the one being dragged, and
 * where the pointer is, return the position the dragged item should take.
 *
 * The answer is an insertion point: 0 means "before the first remaining item",
 * `rects.length` means "after the last one".
 */
export function resolveInsertIndex(rects: Box[], pointer: Point, axis: ListAxis): number {
  const count = rects.length;
  if (count === 0) return 0;

  if (axis === 'grid') {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < count; i++) {
      const d = distance(centerOf(rects[i]), pointer);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    const c = centerOf(rects[best]);
    const past = pointer.y > c.y + rects[best].height / 2 ? true : pointer.y < c.y - rects[best].height / 2 ? false : pointer.x > c.x;
    return past ? best + 1 : best;
  }

  const key = axis === 'x' ? 'x' : 'y';
  let index = 0;
  while (index < count && pointer[key] > centerOf(rects[index])[key]) index++;
  return index;
}
