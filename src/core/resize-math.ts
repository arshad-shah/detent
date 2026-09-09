import { clamp, snap } from './geometry';
import type { Point } from './types';

export interface ResizeLimits {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

export interface ResizeInput {
  startWidth: number;
  startHeight: number;
  /** -1 pulls the left edge, 1 pushes the right edge, 0 leaves width alone. */
  dirX: -1 | 0 | 1;
  /** -1 pulls the top edge, 1 pushes the bottom edge, 0 leaves height alone. */
  dirY: -1 | 0 | 1;
  delta: Point;
  limits: ResizeLimits;
  /** width / height to hold, or null for free resizing. */
  aspect: number | null;
  grid: [number, number] | null;
}

export interface ResizeResult {
  width: number;
  height: number;
  /** How far the left edge moved, so a caller can shift the element to match. */
  offsetX: number;
  offsetY: number;
}

/**
 * Restore a width-to-height ratio that clamping has broken.
 *
 * Clamping happens per axis, so a box that was on-ratio before it hit a limit
 * is off-ratio after. Rebuild from whichever axis still yields a legal box,
 * preferring the smaller of the two so a maximum is never exceeded.
 *
 * When neither axis yields a legal box the clamped size is returned unchanged:
 * the limits and the ratio are in genuine conflict, and honouring the limits
 * is the less surprising of the two failures.
 */
export function reconcileAspect(
  width: number,
  height: number,
  aspect: number,
  limits: ResizeLimits,
): { width: number; height: number } {
  const fromWidth = { width, height: width / aspect };
  const fromHeight = { width: height * aspect, height };

  const widthLegal = fromWidth.height >= limits.minHeight && fromWidth.height <= limits.maxHeight;
  const heightLegal = fromHeight.width >= limits.minWidth && fromHeight.width <= limits.maxWidth;

  if (widthLegal && heightLegal) {
    return fromWidth.width * fromWidth.height <= fromHeight.width * fromHeight.height
      ? fromWidth
      : fromHeight;
  }
  if (widthLegal) return fromWidth;
  if (heightLegal) return fromHeight;
  return { width, height };
}

/**
 * All eight handles are the same sum, expressed as a direction per axis. The
 * only extra work for the top and left handles is that shrinking has to move
 * the element as well as resize it — and that offset is derived from the final
 * clamped size, so hitting a minimum never causes the element to drift.
 */
export function computeResize(input: ResizeInput): ResizeResult {
  const { startWidth, startHeight, dirX, dirY, delta, limits, aspect, grid } = input;

  let width = dirX === 0 ? startWidth : startWidth + delta.x * dirX;
  let height = dirY === 0 ? startHeight : startHeight + delta.y * dirY;

  if (grid) {
    if (dirX !== 0 && grid[0] > 1) width = snap(width, grid[0]);
    if (dirY !== 0 && grid[1] > 1) height = snap(height, grid[1]);
  }

  if (aspect && aspect > 0) {
    if (dirX === 0) {
      width = height * aspect;
    } else if (dirY === 0) {
      height = width / aspect;
    } else {
      // Corner handle: let whichever axis the user pushed harder lead.
      const leadWithWidth = Math.abs(delta.x) >= Math.abs(delta.y);
      if (leadWithWidth) height = width / aspect;
      else width = height * aspect;
    }
  }

  width = clamp(width, limits.minWidth, limits.maxWidth);
  height = clamp(height, limits.minHeight, limits.maxHeight);

  if (aspect && aspect > 0) {
    ({ width, height } = reconcileAspect(width, height, aspect, limits));
  }

  return {
    width,
    height,
    offsetX: dirX < 0 ? startWidth - width : 0,
    offsetY: dirY < 0 ? startHeight - height : 0,
  };
}

const DIRECTIONS: Record<string, [-1 | 0 | 1, -1 | 0 | 1]> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
};

export type HandleName = keyof typeof DIRECTIONS;

export function directionOf(name: string): [-1 | 0 | 1, -1 | 0 | 1] | null {
  return DIRECTIONS[name] ?? null;
}

export const ALL_HANDLES: HandleName[] = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];
