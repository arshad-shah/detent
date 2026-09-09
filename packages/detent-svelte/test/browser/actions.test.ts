import { beforeEach, describe, expect, it, vi } from 'vitest';
import { draggable, sortable } from '../../src/index';

const base = {
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
  button: 0,
  bubbles: true,
  cancelable: true,
};

function drag(el: HTMLElement, from: [number, number], to: [number, number]) {
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: from[0], clientY: from[1] }));
  window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: to[0], clientY: to[1] }));
  window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: to[0], clientY: to[1] }));
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

function offsetOf(el: HTMLElement): { x: number; y: number } {
  const match = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el.style.transform || '');
  return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : { x: 0, y: 0 };
}

describe('draggable action', () => {
  let node: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    node = document.createElement('div');
    node.style.cssText = 'width:100px;height:100px';
    document.body.appendChild(node);
  });

  it('moves the node', async () => {
    draggable(node, { distance: 0 });
    drag(node, [10, 10], [60, 30]);
    await frame();
    expect(offsetOf(node)).toEqual({ x: 50, y: 20 });
  });

  it('applies updated options without rebinding', async () => {
    const action = draggable(node, { distance: 0, axis: 'both' });
    action.update({ distance: 0, axis: 'x' });

    drag(node, [10, 10], [60, 40]);
    await frame();

    // Locked to x, so the y movement is dropped.
    expect(offsetOf(node)).toEqual({ x: 50, y: 0 });
  });

  it('calls the newest callback after an update', () => {
    const first = vi.fn();
    const second = vi.fn();
    const action = draggable(node, { distance: 0, onEnd: first });
    action.update({ distance: 0, onEnd: second });

    drag(node, [10, 10], [60, 10]);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unbinds on destroy', () => {
    const action = draggable(node, { distance: 0 });
    action.destroy();
    drag(node, [10, 10], [60, 10]);
    expect(offsetOf(node)).toEqual({ x: 0, y: 0 });
  });
});

describe('sortable action', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reorders a list', async () => {
    const list = document.createElement('ul');
    list.style.cssText = 'margin:0;padding:0;list-style:none;width:200px';
    for (const id of ['a', 'b', 'c']) {
      const li = document.createElement('li');
      li.dataset.id = id;
      li.style.cssText = 'height:50px';
      list.appendChild(li);
    }
    document.body.appendChild(list);
    sortable(list, { distance: 0, animation: 0, keyboard: false });

    const first = list.children[0] as HTMLElement;
    const box = first.getBoundingClientRect();
    drag(first, [box.left + 10, box.top + 25], [box.left + 10, box.top + 130]);
    await frame();

    expect(Array.from(list.children).map((c) => (c as HTMLElement).dataset.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });
});

describe('options that reach the core through a spread', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  /**
   * sortable passes its options to the pointer layer with `{ ...options }`.
   * A spread consults ownKeys and getOwnPropertyDescriptor, which on a proxy
   * without those traps fall through to the empty target — so every option
   * carried that way is silently lost. `handle` is one of them, and losing it
   * means the whole item becomes draggable instead of just the grip.
   */
  it('honours `handle`, which arrives via a spread', async () => {
    const list = document.createElement('ul');
    list.style.cssText = 'margin:0;padding:0;list-style:none;width:200px';
    for (const id of ['a', 'b', 'c']) {
      const li = document.createElement('li');
      li.dataset.id = id;
      li.style.cssText = 'height:50px';
      const grip = document.createElement('span');
      grip.className = 'grip';
      grip.style.cssText = 'display:block;width:20px;height:20px';
      li.appendChild(grip);
      list.appendChild(li);
    }
    document.body.appendChild(list);
    sortable(list, { distance: 0, animation: 0, keyboard: false, handle: '.grip' });

    const first = list.children[0] as HTMLElement;
    const box = first.getBoundingClientRect();

    // Press well clear of the grip: nothing should move.
    drag(first, [box.left + 150, box.top + 40], [box.left + 150, box.top + 130]);
    await frame();

    expect(Array.from(list.children).map((c) => (c as HTMLElement).dataset.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
