import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sortable } from '../../src/sortable/index';
import { flush } from '../../src/core/scheduler';

function list(count: number) {
  const ul = document.createElement('ul');
  ul.style.cssText = 'margin:0;padding:0;list-style:none;width:200px';
  for (let i = 0; i < count; i++) {
    const li = document.createElement('li');
    li.dataset.id = String(i);
    li.style.cssText = 'height:50px';
    ul.appendChild(li);
  }
  document.body.appendChild(ul);
  return ul;
}

const base = {
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
  button: 0,
  bubbles: true,
  cancelable: true,
};

function press(el: HTMLElement, x: number, y: number) {
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: x, clientY: y }));
  window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: x, clientY: y + 5 }));
  flush();
}

function release(x: number, y: number) {
  window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: x, clientY: y }));
  flush();
}

describe('sortable lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('leaves the item untouched when onStart refuses the drag', () => {
    const ul = list(3);
    sortable(ul, { distance: 0, animation: 0, onStart: () => false });
    const item = ul.children[0] as HTMLElement;

    press(item, 10, 10);
    release(10, 15);

    expect(item.style.position).toBe('');
    expect(item.style.zIndex).toBe('');
    expect(item.className).toBe('');
  });

  it('removes its scroll listener when onStart refuses the drag', () => {
    const ul = list(3);
    sortable(ul, { distance: 0, animation: 0, onStart: () => false });
    const item = ul.children[0] as HTMLElement;

    let added = 0;
    let removed = 0;
    const originalAdd = window.addEventListener;
    const originalRemove = window.removeEventListener;
    vi.spyOn(window, 'addEventListener').mockImplementation(function (this: Window, ...args) {
      if (args[0] === 'scroll') added++;
      return originalAdd.apply(this, args as never);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation(function (this: Window, ...args) {
      if (args[0] === 'scroll') removed++;
      return originalRemove.apply(this, args as never);
    });

    press(item, 10, 10);
    release(10, 15);

    vi.restoreAllMocks();
    expect(removed).toBe(added);
  });

  it('measures each other container once per drag, not once per move', () => {
    const a = list(3);
    const b = list(3);
    // Side by side, with a gap the pointer can travel through.
    a.style.cssText += ';position:absolute;left:0;top:0';
    b.style.cssText += ';position:absolute;left:400px;top:0';
    sortable(a, { group: 'g', distance: 0, animation: 0 });
    sortable(b, { group: 'g', distance: 0, animation: 0 });

    const item = a.children[0] as HTMLElement;
    const spy = vi.spyOn(b, 'getBoundingClientRect');
    press(item, 10, 10);
    const afterStart = spy.mock.calls.length;

    // Travel through the gap between the lists, so the pointer is inside
    // neither and hostFor has to consider every candidate on every move.
    for (let i = 0; i < 20; i++) {
      window.dispatchEvent(
        new PointerEvent('pointermove', { ...base, clientX: 250 + i, clientY: 20 }),
      );
      flush();
    }
    release(270, 20);

    // Twenty moves must not add twenty measurements of the other container.
    expect(spy.mock.calls.length - afterStart).toBeLessThan(5);
    spy.mockRestore();
  });
});
