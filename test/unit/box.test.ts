import { beforeEach, describe, expect, it } from 'vitest';
import { paint, paintNow, resetState, stateOf } from '../../src/core/box';
import { flush, queued } from '../../src/core/scheduler';

describe('paint batching', () => {
  let el: HTMLElement;

  beforeEach(() => {
    flush();
    document.body.innerHTML = '';
    el = document.createElement('div');
    document.body.appendChild(el);
    resetState(el);
  });

  it('queues one job no matter how many times the element is painted', () => {
    const state = stateOf(el);
    for (let i = 0; i < 50; i++) {
      state.x = i;
      paint(el);
    }
    expect(queued()).toBe(1);
  });

  it('queues one job per element, not one per call', () => {
    const other = document.createElement('div');
    document.body.appendChild(other);
    paint(el);
    paint(other);
    paint(el);
    expect(queued()).toBe(2);
  });

  it('paints the state as it stands when the frame lands, not when queued', () => {
    const state = stateOf(el);
    state.x = 10;
    paint(el);
    state.x = 90;
    flush();
    expect(el.style.transform).toBe('translate3d(90px, 0px, 0)');
  });

  it('clears the transform when the offset returns to zero', () => {
    const state = stateOf(el);
    state.x = 10;
    paintNow(el);
    state.x = 0;
    paintNow(el);
    expect(el.style.transform).toBe('');
  });

  it('does not let a queued paint land after an immediate one', () => {
    const state = stateOf(el);
    state.x = 10;
    paint(el);
    state.x = 50;
    paintNow(el);
    state.x = 999;
    flush();
    expect(el.style.transform).toBe('translate3d(50px, 0px, 0)');
  });
});
