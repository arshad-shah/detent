import { describe, expect, it } from 'vitest';
import {
  ALL_HANDLES,
  computeResize,
  directionOf,
  reconcileAspect,
} from '../../src/core/resize-math';

const free = { minWidth: 0, minHeight: 0, maxWidth: Infinity, maxHeight: Infinity };

const base = {
  startWidth: 200,
  startHeight: 100,
  limits: free,
  aspect: null,
  grid: null,
} as const;

describe('directionOf', () => {
  it('maps every handle to a direction pair', () => {
    for (const name of ALL_HANDLES) expect(directionOf(name)).not.toBeNull();
  });

  it('gives corners a pull on both axes', () => {
    expect(directionOf('nw')).toEqual([-1, -1]);
    expect(directionOf('se')).toEqual([1, 1]);
  });

  it('rejects an unknown handle', () => {
    expect(directionOf('middle')).toBeNull();
  });
});

describe('computeResize', () => {
  it('grows from the bottom-right without moving the element', () => {
    const r = computeResize({ ...base, dirX: 1, dirY: 1, delta: { x: 50, y: 25 } });
    expect(r).toEqual({ width: 250, height: 125, offsetX: 0, offsetY: 0 });
  });

  it('grows from the top-left by moving the element the same amount', () => {
    const r = computeResize({ ...base, dirX: -1, dirY: -1, delta: { x: -50, y: -25 } });
    expect(r.width).toBe(250);
    expect(r.height).toBe(125);
    expect(r.offsetX).toBe(-50);
    expect(r.offsetY).toBe(-25);
  });

  it('leaves the untouched axis alone on an edge handle', () => {
    const r = computeResize({ ...base, dirX: 1, dirY: 0, delta: { x: 40, y: 999 } });
    expect(r.width).toBe(240);
    expect(r.height).toBe(100);
  });

  it('stops at the minimum size', () => {
    const r = computeResize({
      ...base,
      dirX: 1,
      dirY: 1,
      delta: { x: -500, y: -500 },
      limits: { ...free, minWidth: 80, minHeight: 40 },
    });
    expect(r.width).toBe(80);
    expect(r.height).toBe(40);
  });

  it('stops at the maximum size', () => {
    const r = computeResize({
      ...base,
      dirX: 1,
      dirY: 1,
      delta: { x: 500, y: 500 },
      limits: { ...free, maxWidth: 300, maxHeight: 150 },
    });
    expect(r.width).toBe(300);
    expect(r.height).toBe(150);
  });

  it('does not drift when a top-left drag hits the minimum', () => {
    // Once the width is pinned at 80, the element must sit exactly 120px right
    // of where it started, no matter how much further the pointer travels.
    const near = computeResize({
      ...base,
      dirX: -1,
      dirY: -1,
      delta: { x: 200, y: 200 },
      limits: { ...free, minWidth: 80, minHeight: 40 },
    });
    const far = computeResize({
      ...base,
      dirX: -1,
      dirY: -1,
      delta: { x: 900, y: 900 },
      limits: { ...free, minWidth: 80, minHeight: 40 },
    });
    expect(near.offsetX).toBe(120);
    expect(far.offsetX).toBe(120);
    expect(far.offsetY).toBe(60);
  });

  it('snaps the size to a grid', () => {
    const r = computeResize({ ...base, dirX: 1, dirY: 1, delta: { x: 23, y: 12 }, grid: [10, 10] });
    expect(r.width).toBe(220);
    expect(r.height).toBe(110);
  });

  // The grid counts from the size the element started at, not from zero. An
  // element whose size is not already a multiple of the step would otherwise
  // jump up to a full step on the first movement — see the tests below, which
  // all use a start size deliberately off the grid.
  const offGrid = { ...base, startWidth: 190, startHeight: 110 } as const;

  it('leaves an off-grid size untouched when nothing has moved', () => {
    const r = computeResize({ ...offGrid, dirX: -1, dirY: -1, delta: { x: 0, y: 0 }, grid: [20, 20] });
    expect(r.width).toBe(190);
    expect(r.height).toBe(110);
    expect(r.offsetX).toBe(0);
    expect(r.offsetY).toBe(0);
  });

  it('moves the grabbed edge by whole steps from an off-grid start', () => {
    const grid: [number, number] = [20, 20];
    // Half a step in: still rounds back to where it began.
    expect(computeResize({ ...offGrid, dirX: 1, dirY: 0, delta: { x: 9, y: 0 }, grid }).width).toBe(190);
    // Past half a step: exactly one step, never a fraction of the start size.
    expect(computeResize({ ...offGrid, dirX: 1, dirY: 0, delta: { x: 11, y: 0 }, grid }).width).toBe(210);
    expect(computeResize({ ...offGrid, dirX: 1, dirY: 0, delta: { x: 31, y: 0 }, grid }).width).toBe(230);
  });

  it('holds still until the pointer has travelled half a step', () => {
    const grid: [number, number] = [20, 20];
    // Under half a step in either direction, from either edge, nothing moves.
    for (const dirX of [1, -1] as const) {
      for (const dx of [-9, -5, -1, 1, 5, 9]) {
        const r = computeResize({ ...offGrid, dirX, dirY: 0, delta: { x: dx, y: 0 }, grid });
        expect(r.width).toBe(190);
        expect(r.offsetX).toBe(0);
      }
    }
  });

  it('changes the size by whole steps once it does move', () => {
    const grid: [number, number] = [20, 20];
    for (const dx of [11, 19, 21, 39, 41]) {
      const r = computeResize({ ...offGrid, dirX: 1, dirY: 0, delta: { x: dx, y: 0 }, grid });
      expect((r.width - 190) % 20).toBe(0);
    }
  });

  it('holds the ratio from an edge handle', () => {
    const r = computeResize({ ...base, dirX: 1, dirY: 0, delta: { x: 100, y: 0 }, aspect: 2 });
    expect(r.width).toBe(300);
    expect(r.height).toBe(150);
  });

  it('lets the dominant axis lead on a corner handle', () => {
    const wide = computeResize({
      ...base,
      dirX: 1,
      dirY: 1,
      delta: { x: 100, y: 5 },
      aspect: 2,
    });
    expect(wide.width).toBe(300);
    expect(wide.height).toBe(150);

    const tall = computeResize({
      ...base,
      dirX: 1,
      dirY: 1,
      delta: { x: 5, y: 100 },
      aspect: 2,
    });
    expect(tall.height).toBe(200);
    expect(tall.width).toBe(400);
  });

  it('keeps the ratio intact when a limit bites', () => {
    const r = computeResize({
      ...base,
      dirX: 1,
      dirY: 1,
      delta: { x: 400, y: 0 },
      aspect: 2,
      limits: { ...free, maxWidth: 300 },
    });
    expect(r.width).toBe(300);
    expect(r.height).toBe(150);
    expect(r.width / r.height).toBe(2);
  });
});

describe('reconcileAspect', () => {
  const limits = { minWidth: 50, minHeight: 50, maxWidth: 400, maxHeight: 200 };

  it('leaves a legal ratio alone', () => {
    expect(reconcileAspect(200, 100, 2, limits)).toEqual({ width: 200, height: 100 });
  });

  it('prefers the smaller box when both axes could lead', () => {
    const result = reconcileAspect(300, 100, 2, limits);
    expect(result.width / result.height).toBeCloseTo(2, 5);
    expect(result.width).toBeLessThanOrEqual(300);
  });

  it('leads with height when width would exceed the maximum', () => {
    const result = reconcileAspect(400, 100, 4, limits);
    expect(result.width).toBeLessThanOrEqual(limits.maxWidth);
    expect(result.height).toBeLessThanOrEqual(limits.maxHeight);
  });

  it('honours the limits rather than the ratio when they conflict', () => {
    const tight = { minWidth: 390, minHeight: 190, maxWidth: 400, maxHeight: 200 };
    const result = reconcileAspect(395, 195, 10, tight);
    expect(result.width).toBeGreaterThanOrEqual(tight.minWidth);
    expect(result.width).toBeLessThanOrEqual(tight.maxWidth);
  });
});
