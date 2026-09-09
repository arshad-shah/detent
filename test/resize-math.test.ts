import { describe, expect, it } from 'vitest';
import { ALL_HANDLES, computeResize, directionOf } from '../src/core/resize-math';

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
