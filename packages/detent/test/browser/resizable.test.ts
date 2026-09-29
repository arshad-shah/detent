import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resizable } from '../../src/resizable/index';
import { ATTR, CLASS } from '../../src/core/constants';
import { resetState } from '../../src/core/box';
import { edgesOf, host, layout, offsetOf, press, resetLayout, type HostAnchor } from './helpers';

let el: HTMLElement;
let parent: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  parent = document.createElement('div');
  el = document.createElement('div');
  parent.appendChild(el);
  document.body.appendChild(parent);
  resetState(el);
  layout(parent, { left: 0, top: 0, width: 600, height: 600 });
  layout(el, { left: 100, top: 100, width: 200, height: 100 });
});

const grip = (name: string) => el.querySelector<HTMLElement>(`[${ATTR.handle}="${name}"]`)!;

describe('resizable setup', () => {
  it('adds all eight handles by default', () => {
    resizable(el);
    expect(el.querySelectorAll(`[${ATTR.handle}]`)).toHaveLength(8);
  });

  it('adds only the handles asked for', () => {
    resizable(el, { handles: ['se', 'e'] });
    expect(el.querySelectorAll(`[${ATTR.handle}]`)).toHaveLength(2);
    expect(grip('se')).toBeTruthy();
    expect(el.querySelector(`[${ATTR.handle}="nw"]`)).toBeNull();
  });

  it('hides handles from assistive technology', () => {
    resizable(el, { handles: ['se'] });
    expect(grip('se').getAttribute('aria-hidden')).toBe('true');
  });

  it('removes its handles on destroy', () => {
    const handle = resizable(el);
    handle.destroy();
    expect(el.querySelectorAll(`[${ATTR.handle}]`)).toHaveLength(0);
  });
});

describe('binding to handles you already have', () => {
  it('adds no children of its own', () => {
    el.innerHTML = '<div class="content"></div><i class="corner"></i>';
    layout(el.querySelector('.corner')!, { left: 290, top: 190, width: 10, height: 10 });
    const before = el.children.length;
    resizable(el, { handles: { se: '.corner' } });
    expect(el.children.length).toBe(before);
    expect(el.querySelector(`.${CLASS.handle}`)).toBeNull();
  });

  it('resizes from a supplied handle', () => {
    el.innerHTML = '<i class="corner"></i>';
    const corner = el.querySelector<HTMLElement>('.corner')!;
    layout(corner, { left: 290, top: 190, width: 10, height: 10 });
    resizable(el, { distance: 0, handles: { se: '.corner' } });
    press(corner, 300, 200).move(360, 250);
    expect(el.style.width).toBe('260px');
    expect(el.style.height).toBe('150px');
  });

  it('leaves supplied handles in place on destroy', () => {
    el.innerHTML = '<i class="corner"></i>';
    const handle = resizable(el, { handles: { se: '.corner' } });
    handle.destroy();
    expect(el.querySelector('.corner')).not.toBeNull();
    expect(el.querySelector(`[${ATTR.handle}]`)).toBeNull();
  });

  it('does not touch the element position when handles are supplied', () => {
    el.innerHTML = '<i class="corner"></i>';
    resizable(el, { handles: { se: '.corner' } });
    expect(el.style.position).toBe('');
  });
});

describe('resizing', () => {
  it('grows from the bottom-right corner', () => {
    resizable(el, { distance: 0 });
    press(grip('se'), 300, 200).move(360, 240);
    expect(el.style.width).toBe('260px');
    expect(el.style.height).toBe('140px');
    expect(offsetOf(el)).toEqual({ x: 0, y: 0 });
  });

  it('grows from the top-left corner and moves to match', () => {
    resizable(el, { distance: 0 });
    press(grip('nw'), 100, 100).move(60, 80);
    expect(el.style.width).toBe('240px');
    expect(el.style.height).toBe('120px');
    expect(offsetOf(el)).toEqual({ x: -40, y: -20 });
  });

  it('changes one axis only from an edge handle', () => {
    resizable(el, { distance: 0 });
    press(grip('e'), 300, 150).move(350, 400);
    expect(el.style.width).toBe('250px');
    expect(el.style.height).toBe('100px');
  });

  it('respects a minimum size', () => {
    resizable(el, { distance: 0, minWidth: 120, minHeight: 60 });
    press(grip('se'), 300, 200).move(0, 0);
    expect(el.style.width).toBe('120px');
    expect(el.style.height).toBe('60px');
  });

  it('holds an explicit aspect ratio', () => {
    resizable(el, { distance: 0, aspectRatio: 2 });
    press(grip('e'), 300, 150).move(400, 150);
    expect(el.style.width).toBe('300px');
    expect(el.style.height).toBe('150px');
  });

  it('will not grow past its container', () => {
    resizable(el, { distance: 0, bounds: 'parent' });
    // The element starts at x=100 and the parent ends at 600, so 500 is the cap.
    press(grip('e'), 300, 150).move(2000, 150);
    expect(el.style.width).toBe('500px');
  });

  it('restores the original size when cancelled', () => {
    resizable(el, { distance: 0 });
    press(grip('se'), 300, 200).move(400, 300).escape();
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('100px');
  });

  it('reports each step to onResize', () => {
    const onResize = vi.fn();
    const onEnd = vi.fn();
    resizable(el, { distance: 0, onResize, onEnd });
    press(grip('se'), 300, 200).move(350, 250).up();
    expect(onResize.mock.calls.at(-1)![0].width).toBe(250);
    expect(onResize.mock.calls.at(-1)![0].handle).toBe('se');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', () => {
    const handle = resizable(el, { distance: 0 });
    handle.setDisabled(true);
    press(grip('se'), 300, 200).move(400, 300);
    expect(el.style.width).toBe('');
  });
});

/**
 * The documented contract: "the edge you grabbed follows the pointer, so the
 * opposite edge stays put."
 *
 * That held only for an element anchored to its top-left corner, which is the
 * one layout the tests above use. In every other host layout, changing the
 * width re-runs layout and moves the element — so resizing from a single corner
 * slid the whole element sideways.
 */
describe('anchoring across host layouts', () => {
  const anchors: HostAnchor[] = [
    'absolute',
    'absolute-end',
    'margin-auto',
    'flex-center',
    'flex-end',
    'flex-rtl',
  ];

  /** Rebuild the fixture without the default absolute layout from beforeEach. */
  function place(anchor: HostAnchor) {
    document.body.innerHTML = '';
    resetLayout();
    parent = document.createElement('div');
    el = document.createElement('div');
    parent.appendChild(el);
    document.body.appendChild(parent);
    resetState(el);
    host(parent, el, anchor);
    return edgesOf(el);
  }

  for (const anchor of anchors) {
    it(`keeps the left and top still when growing from se — ${anchor}`, () => {
      const before = place(anchor);
      resizable(el, { distance: 0 });
      const g = grip('se');
      press(g, before.right, before.bottom).move(before.right + 60, before.bottom + 40).up();

      const after = edgesOf(el);
      expect(after.left).toBe(before.left);
      expect(after.top).toBe(before.top);
      expect(after.right).toBe(before.right + 60);
      expect(after.bottom).toBe(before.bottom + 40);
    });

    it(`keeps the right and bottom still when shrinking from nw — ${anchor}`, () => {
      const before = place(anchor);
      resizable(el, { distance: 0 });
      const g = grip('nw');
      press(g, before.left, before.top).move(before.left + 50, before.top + 30).up();

      const after = edgesOf(el);
      expect(after.right).toBe(before.right);
      expect(after.bottom).toBe(before.bottom);
      expect(after.left).toBe(before.left + 50);
      expect(after.top).toBe(before.top + 30);
    });
  }

  it('leaves the element inline width and height as it found them', () => {
    place('flex-center');
    el.style.width = '200px';
    el.style.height = '100px';
    const handle = resizable(el, { distance: 0 });
    handle.destroy();
    // The probe writes and restores a width; a botched restore shows up here.
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('100px');
  });

  it('writes no inline width or height when the host set none', () => {
    place('flex-center');
    const handle = resizable(el, { distance: 0 });
    expect(el.style.width).toBe('');
    expect(el.style.height).toBe('');
    handle.destroy();
    expect(el.style.width).toBe('');
    expect(el.style.height).toBe('');
  });
});

/**
 * The documented contract: "Bounds become a size ceiling. With `bounds` set, the
 * element runs out of room rather than escaping its container."
 *
 * With `aspectRatio` on an edge handle, only the axis the handle drives ever got
 * a bounds-derived ceiling. The axis the ratio derives got none, so the element
 * grew straight out of its container.
 */
describe('aspect ratio inside bounds', () => {
  /** Place the element at a known spot in the 600x600 parent from beforeEach. */
  function at(left: number, top: number, width = 200, height = 100) {
    document.body.innerHTML = '';
    resetLayout();
    parent = document.createElement('div');
    el = document.createElement('div');
    parent.appendChild(el);
    document.body.appendChild(parent);
    resetState(el);
    layout(parent, { left: 0, top: 0, width: 600, height: 600 });
    layout(el, { left, top, width, height });
    return edgesOf(el);
  }

  it('does not escape sideways when the top edge drives the width', () => {
    const before = at(380, 200);
    resizable(el, { distance: 0, aspectRatio: true, bounds: 'parent' });
    press(grip('n'), before.left + 100, before.top).move(before.left + 100, before.top - 400).up();

    const after = edgesOf(el);
    expect(after.right).toBeLessThanOrEqual(600);
    expect(after.left).toBeGreaterThanOrEqual(0);
    expect(after.top).toBeGreaterThanOrEqual(0);
  });

  it('does not escape downwards when the left edge drives the height', () => {
    const before = at(300, 440);
    resizable(el, { distance: 0, aspectRatio: true, bounds: 'parent' });
    press(grip('w'), before.left, before.top + 50).move(before.left - 400, before.top + 50).up();

    const after = edgesOf(el);
    expect(after.bottom).toBeLessThanOrEqual(600);
    expect(after.top).toBeGreaterThanOrEqual(0);
    expect(after.left).toBeGreaterThanOrEqual(0);
  });

  it('holds the ratio while it runs out of room', () => {
    const before = at(380, 200);
    resizable(el, { distance: 0, aspectRatio: 2, bounds: 'parent' });
    press(grip('n'), before.left + 100, before.top).move(before.left + 100, before.top - 400).up();

    const after = edgesOf(el);
    const ratio = (after.right - after.left) / (after.bottom - after.top);
    expect(ratio).toBeCloseTo(2, 1);
    expect(after.right).toBeLessThanOrEqual(600);
  });

  it('grows the derived axis about the centre, not off to one side', () => {
    const before = at(200, 300);
    resizable(el, { distance: 0, aspectRatio: true });
    press(grip('n'), before.left + 100, before.top).move(before.left + 100, before.top - 50).up();

    const after = edgesOf(el);
    // The bottom edge is the one that was not grabbed, so it holds.
    expect(after.bottom).toBe(before.bottom);
    // The width grew, and it grew equally on both sides.
    expect(after.right - after.left).toBeGreaterThan(before.right - before.left);
    expect(before.left - after.left).toBe(after.right - before.right);
  });

  it('still lets a corner handle anchor the opposite corner', () => {
    const before = at(200, 300);
    resizable(el, { distance: 0, aspectRatio: true });
    press(grip('se'), before.right, before.bottom).move(before.right + 80, before.bottom + 40).up();

    const after = edgesOf(el);
    expect(after.left).toBe(before.left);
    expect(after.top).toBe(before.top);
  });
});
