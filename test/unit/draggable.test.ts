import { beforeEach, describe, expect, it, vi } from 'vitest';
import { draggable } from '../../src/draggable';
import { CLASS } from '../../src/core/constants';
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
  layout(parent, { left: 0, top: 0, width: 400, height: 400 });
  layout(el, { left: 100, top: 100, width: 50, height: 50 });
});

describe('draggable', () => {
  it('follows the pointer', () => {
    draggable(el, { distance: 0 });
    press(el, 0, 0).move(30, 40);
    expect(offsetOf(el)).toEqual({ x: 30, y: 40 });
  });

  it('carries on from where the last drag left off', () => {
    draggable(el, { distance: 0 });
    press(el, 0, 0).move(30, 40).up();
    press(el, 0, 0).move(10, 10).up();
    expect(offsetOf(el)).toEqual({ x: 40, y: 50 });
  });

  it('locks to a single axis', () => {
    draggable(el, { distance: 0, axis: 'x' });
    press(el, 0, 0).move(30, 40);
    expect(offsetOf(el)).toEqual({ x: 30, y: 0 });
  });

  it('snaps to a grid', () => {
    draggable(el, { distance: 0, grid: 20 });
    press(el, 0, 0).move(27, 33);
    // Absolute position 127/133 rounds to 120/140, so the offset is 20/40.
    expect(offsetOf(el)).toEqual({ x: 20, y: 40 });
  });

  it('counts the grid from its container, not from the viewport', () => {
    // A container that does not start on a round number: the element should
    // still land on lines drawn inside that container.
    layout(parent, { left: 7, top: 3, width: 400, height: 400 });
    layout(el, { left: 27, top: 23, width: 50, height: 50 });
    draggable(el, { distance: 0, grid: 20, bounds: 'parent' });
    press(el, 0, 0).move(9, 9);
    // 27 + 9 = 36, and 20px steps from 7 land on 27 and 47 — so it stays put.
    expect(offsetOf(el)).toEqual({ x: 0, y: 0 });

    press(el, 0, 0).move(14, 14);
    expect(offsetOf(el)).toEqual({ x: 20, y: 20 });
  });

  it('can count the grid from the viewport when asked', () => {
    layout(parent, { left: 7, top: 3, width: 400, height: 400 });
    layout(el, { left: 30, top: 30, width: 50, height: 50 });
    draggable(el, { distance: 0, grid: 20, gridOrigin: 'viewport' });
    press(el, 0, 0).move(14, 14);
    // 30 + 14 = 44, which rounds to 40 on a viewport-aligned grid.
    expect(offsetOf(el)).toEqual({ x: 10, y: 10 });
  });

  it('stays inside its parent', () => {
    draggable(el, { distance: 0, bounds: 'parent' });
    press(el, 0, 0).move(-500, -500);
    expect(offsetOf(el)).toEqual({ x: -100, y: -100 });

    press(el, 0, 0).move(500, 500).up();
    expect(offsetOf(el)).toEqual({ x: 250, y: 250 });
  });

  it('marks the element while it is moving', () => {
    draggable(el, { distance: 0 });
    const gesture = press(el, 0, 0);
    gesture.move(10, 10);
    expect(el.classList.contains(CLASS.dragging)).toBe(true);
    gesture.up();
    expect(el.classList.contains(CLASS.dragging)).toBe(false);
  });

  it('puts the element back when the drag is cancelled', () => {
    draggable(el, { distance: 0 });
    press(el, 0, 0).move(80, 80).escape();
    expect(offsetOf(el)).toEqual({ x: 0, y: 0 });
  });

  it('reports its position to callbacks', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    draggable(el, { distance: 0, onMove, onEnd });
    press(el, 0, 0).move(15, 25).up();
    expect(onMove.mock.calls[0][0].offset).toEqual({ x: 15, y: 25 });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', () => {
    const handle = draggable(el, { distance: 0 });
    handle.setDisabled(true);
    press(el, 0, 0).move(50, 50);
    expect(offsetOf(el)).toEqual({ x: 0, y: 0 });
  });

  it('can be positioned and reset from code', () => {
    const handle = draggable(el, { distance: 0 });
    handle.moveTo(70, 80);
    expect(offsetOf(el)).toEqual({ x: 70, y: 80 });
    handle.reset();
    expect(offsetOf(el)).toEqual({ x: 0, y: 0 });
  });

  it('stops responding after destroy', () => {
    const handle = draggable(el, { distance: 0 });
    handle.destroy();
    press(el, 0, 0).move(50, 50);
    expect(offsetOf(el)).toEqual({ x: 0, y: 0 });
  });
});
