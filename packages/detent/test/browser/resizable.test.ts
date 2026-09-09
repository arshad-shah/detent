import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resizable } from '../../src/resizable/index';
import { ATTR, CLASS } from '../../src/core/constants';
import { resetState } from '../../src/core/box';
import { layout, offsetOf, press } from './helpers';

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
