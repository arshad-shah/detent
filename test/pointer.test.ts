import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindPointer } from '../src/core/pointer';
import { press } from './helpers';

let el: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  el = document.createElement('div');
  document.body.appendChild(el);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('mouse activation', () => {
  it('ignores a press that never travels far enough', () => {
    const onStart = vi.fn();
    bindPointer(el, { onStart, distance: 10 });
    press(el, 0, 0).move(3, 3).up();
    expect(onStart).not.toHaveBeenCalled();
  });

  it('starts once the pointer clears the distance threshold', () => {
    const onStart = vi.fn();
    const onMove = vi.fn();
    bindPointer(el, { onStart, onMove, distance: 4 });
    press(el, 0, 0).move(2, 0).move(10, 0);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('reports travel relative to where the press began', () => {
    const onMove = vi.fn();
    bindPointer(el, { onMove, distance: 0 });
    press(el, 100, 100).move(150, 80);
    expect(onMove.mock.calls[0][0].delta).toEqual({ x: 50, y: -20 });
  });

  it('ignores a right-click', () => {
    const onStart = vi.fn();
    bindPointer(el, { onStart, distance: 0 });
    el.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 2,
        pointerType: 'mouse',
        pointerId: 1,
      } as any),
    );
    expect(onStart).not.toHaveBeenCalled();
  });
});

describe('touch activation', () => {
  it('waits for the press delay before starting', () => {
    const onStart = vi.fn();
    bindPointer(el, { onStart, delay: 200 });
    press(el, 0, 0, { pointerType: 'touch' });
    expect(onStart).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('gives the gesture back to the browser when the finger swipes', () => {
    const onStart = vi.fn();
    bindPointer(el, { onStart, delay: 200, tolerance: 6 });
    press(el, 0, 0, { pointerType: 'touch' }).move(0, 40);
    vi.advanceTimersByTime(500);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('keeps waiting through a small wobble', () => {
    const onStart = vi.fn();
    bindPointer(el, { onStart, delay: 200, tolerance: 10 });
    press(el, 0, 0, { pointerType: 'touch' }).move(0, 3);
    vi.advanceTimersByTime(200);
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe('handle and cancel selectors', () => {
  it('only starts from inside a handle', () => {
    el.innerHTML = '<span class="grip"></span><span class="body"></span>';
    const onStart = vi.fn();
    bindPointer(el, { onStart, distance: 0, handle: '.grip' });

    press(el.querySelector('.body')!, 0, 0).up();
    expect(onStart).not.toHaveBeenCalled();

    press(el.querySelector('.grip')!, 0, 0);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('refuses to start from a cancelled region', () => {
    el.innerHTML = '<button class="no-drag"></button>';
    const onStart = vi.fn();
    bindPointer(el, { onStart, distance: 0, cancel: '.no-drag' });
    press(el.querySelector('.no-drag')!, 0, 0);
    expect(onStart).not.toHaveBeenCalled();
  });
});

describe('ending a drag', () => {
  it('reports a clean finish', () => {
    const onEnd = vi.fn();
    bindPointer(el, { onEnd, distance: 0 });
    press(el, 0, 0).move(10, 10).up();
    expect(onEnd).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('reports Escape as a cancellation', () => {
    const onEnd = vi.fn();
    bindPointer(el, { onEnd, distance: 0 });
    press(el, 0, 0).move(10, 10).escape();
    expect(onEnd).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('reports pointercancel as a cancellation', () => {
    const onEnd = vi.fn();
    bindPointer(el, { onEnd, distance: 0 });
    press(el, 0, 0).move(10, 10).cancel();
    expect(onEnd).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('lets onStart refuse the drag outright', () => {
    const onMove = vi.fn();
    bindPointer(el, { onStart: () => false, onMove, distance: 0 });
    press(el, 0, 0).move(50, 50);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('stops listening after destroy', () => {
    const onStart = vi.fn();
    const handle = bindPointer(el, { onStart, distance: 0 });
    handle.destroy();
    press(el, 0, 0).move(50, 50);
    expect(onStart).not.toHaveBeenCalled();
  });
});
