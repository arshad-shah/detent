import { describe, expect, it } from 'vitest';
import {
  clamp,
  clampOffset,
  contains,
  detectAxis,
  resolveInsertIndex,
  snap,
} from '../../src/core/geometry';
import type { Box } from '../../src/core/types';

const box = (left: number, top: number, width = 100, height = 40): Box => ({
  left,
  top,
  width,
  height,
});

describe('clamp and snap', () => {
  it('holds a value inside its limits', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it('rounds to the nearest step', () => {
    expect(snap(23, 10)).toBe(20);
    expect(snap(26, 10)).toBe(30);
  });

  it('measures the grid from an origin, not from zero', () => {
    expect(snap(27, 10, 5)).toBe(25);
    expect(snap(33, 10, 5)).toBe(35);
  });

  it('leaves the value alone when there is no meaningful step', () => {
    expect(snap(23, 0)).toBe(23);
    expect(snap(23, 1)).toBe(23);
  });
});

describe('contains', () => {
  it('includes the edges', () => {
    expect(contains(box(0, 0, 100, 100), { x: 0, y: 0 })).toBe(true);
    expect(contains(box(0, 0, 100, 100), { x: 100, y: 100 })).toBe(true);
    expect(contains(box(0, 0, 100, 100), { x: 101, y: 50 })).toBe(false);
  });
});

describe('clampOffset', () => {
  const area = box(0, 0, 500, 500);
  const start = box(100, 100, 50, 50);

  it('passes an offset through when it stays inside', () => {
    expect(clampOffset(start, { x: 10, y: 10 }, area)).toEqual({ x: 10, y: 10 });
  });

  it('stops the box at the near edges', () => {
    expect(clampOffset(start, { x: -400, y: -400 }, area)).toEqual({ x: -100, y: -100 });
  });

  it('stops the box at the far edges, accounting for its size', () => {
    expect(clampOffset(start, { x: 900, y: 900 }, area)).toEqual({ x: 350, y: 350 });
  });

  it('does nothing without an area', () => {
    expect(clampOffset(start, { x: 9999, y: 9999 }, null)).toEqual({ x: 9999, y: 9999 });
  });
});

describe('detectAxis', () => {
  it('reads a column as vertical', () => {
    expect(detectAxis([box(0, 0), box(0, 40), box(0, 80)])).toBe('y');
  });

  it('reads a row as horizontal', () => {
    expect(detectAxis([box(0, 0), box(100, 0), box(200, 0)])).toBe('x');
  });

  it('reads a wrapped layout as a grid', () => {
    expect(detectAxis([box(0, 0), box(100, 0), box(0, 40), box(100, 40)])).toBe('grid');
  });

  it('defaults to vertical when there is not enough to go on', () => {
    expect(detectAxis([])).toBe('y');
    expect(detectAxis([box(0, 0)])).toBe('y');
  });
});

describe('resolveInsertIndex', () => {
  // Three 40px-tall rows stacked from y=0.
  const column = [box(0, 0), box(0, 40), box(0, 80)];

  it('puts the pointer above everything at index 0', () => {
    expect(resolveInsertIndex(column, { x: 10, y: 5 }, 'y')).toBe(0);
  });

  it('crosses into the next slot at each midpoint', () => {
    expect(resolveInsertIndex(column, { x: 10, y: 19 }, 'y')).toBe(0);
    expect(resolveInsertIndex(column, { x: 10, y: 21 }, 'y')).toBe(1);
    expect(resolveInsertIndex(column, { x: 10, y: 61 }, 'y')).toBe(2);
  });

  it('puts the pointer past the last row at the end', () => {
    expect(resolveInsertIndex(column, { x: 10, y: 200 }, 'y')).toBe(3);
  });

  it('works the same way horizontally', () => {
    const rowRects = [box(0, 0, 50, 50), box(50, 0, 50, 50), box(100, 0, 50, 50)];
    expect(resolveInsertIndex(rowRects, { x: 10, y: 10 }, 'x')).toBe(0);
    expect(resolveInsertIndex(rowRects, { x: 80, y: 10 }, 'x')).toBe(2);
  });

  it('returns 0 for an empty list', () => {
    expect(resolveInsertIndex([], { x: 0, y: 0 }, 'y')).toBe(0);
  });

  it('uses the nearest tile in a grid', () => {
    const grid = [
      box(0, 0, 100, 100),
      box(100, 0, 100, 100),
      box(0, 100, 100, 100),
      box(100, 100, 100, 100),
    ];
    // Just left of the second tile's centre: insert before it.
    expect(resolveInsertIndex(grid, { x: 130, y: 50 }, 'grid')).toBe(1);
    // Right of the second tile's centre: insert after it.
    expect(resolveInsertIndex(grid, { x: 180, y: 50 }, 'grid')).toBe(2);
  });
});

describe('resolveInsertIndex under RTL', () => {
  // Three 100px boxes in a row. Visually under RTL, box at left:200 is FIRST.
  const rects = [
    { left: 200, top: 0, width: 100, height: 50 },
    { left: 100, top: 0, width: 100, height: 50 },
    { left: 0, top: 0, width: 100, height: 50 },
  ];

  it('inserts before everything when the pointer is at the right edge', () => {
    expect(resolveInsertIndex(rects, { x: 290, y: 25 }, 'x', true)).toBe(0);
  });

  it('inserts after everything when the pointer is at the left edge', () => {
    expect(resolveInsertIndex(rects, { x: 10, y: 25 }, 'x', true)).toBe(3);
  });

  it('inserts in the middle when the pointer is in the middle', () => {
    expect(resolveInsertIndex(rects, { x: 140, y: 25 }, 'x', true)).toBe(2);
  });

  it('is unchanged for LTR', () => {
    const ltr = [
      { left: 0, top: 0, width: 100, height: 50 },
      { left: 100, top: 0, width: 100, height: 50 },
    ];
    expect(resolveInsertIndex(ltr, { x: 10, y: 25 }, 'x', false)).toBe(0);
    expect(resolveInsertIndex(ltr, { x: 190, y: 25 }, 'x', false)).toBe(2);
  });

  it('never lets RTL affect a vertical list', () => {
    const column = [
      { left: 0, top: 0, width: 100, height: 50 },
      { left: 0, top: 50, width: 100, height: 50 },
    ];
    expect(resolveInsertIndex(column, { x: 50, y: 10 }, 'y', true)).toBe(0);
    expect(resolveInsertIndex(column, { x: 50, y: 90 }, 'y', true)).toBe(2);
  });
});
