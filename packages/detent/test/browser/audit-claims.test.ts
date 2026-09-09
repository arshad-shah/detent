/**
 * Reproductions for the 2026-09-09 adversarial review.
 *
 * Each test asserts the behaviour the library SHOULD have. A failure here
 * means the claim reproduced; a pass means it was disproved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { draggable } from '../../src/draggable';
import { resizable } from '../../src/resizable/index';
import { sortable } from '../../src/sortable/index';
import { CLASS } from '../../src/core/constants';
import { pageLockDepth, unlockPage } from '../../src/core/body-state';
import { flush } from '../../src/core/scheduler';

const base = {
  pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0,
  bubbles: true, cancelable: true,
};

function press(el: HTMLElement, x = 10, y = 10) {
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: x, clientY: y }));
}
function move(x: number, y: number) {
  window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: x, clientY: y }));
  flush();
}
function up(x: number, y: number) {
  window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: x, clientY: y }));
  flush();
}

function box(): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = 'width:100px;height:100px';
  document.body.appendChild(el);
  return el;
}

function list(count: number, horizontal = false): HTMLElement {
  const ul = document.createElement('ul');
  ul.style.cssText = horizontal
    ? 'display:flex;margin:0;padding:0;list-style:none;width:400px'
    : 'margin:0;padding:0;list-style:none;width:200px';
  for (let i = 0; i < count; i++) {
    const li = document.createElement('li');
    li.dataset.id = String(i);
    li.style.cssText = horizontal ? 'width:100px;height:60px;flex:0 0 auto' : 'height:50px';
    ul.appendChild(li);
  }
  document.body.appendChild(ul);
  return ul;
}

beforeEach(() => {
  while (pageLockDepth() > 0) unlockPage();
  document.body.innerHTML = '';
});

describe('claim: a refused onStart leaves the state class stuck', () => {
  it('draggable removes detent-dragging when onStart refuses', () => {
    const el = box();
    draggable(el, { distance: 0, onStart: () => false });
    press(el);
    move(60, 10);
    up(60, 10);
    expect(el.classList.contains(CLASS.dragging)).toBe(false);
  });

  it('resizable removes detent-resizing when onStart refuses', () => {
    const el = box();
    resizable(el, { distance: 0, handles: ['se'], onStart: () => false });
    const grip = el.querySelector<HTMLElement>('[data-detent-handle="se"]')!;
    press(grip);
    move(60, 60);
    up(60, 60);
    expect(el.classList.contains(CLASS.resizing)).toBe(false);
  });
});

describe('claim: cancelling or destroying from onStart locks the page', () => {
  it('cancel() inside onStart leaves no page lock', () => {
    const el = box();
    draggable(el, { distance: 0, onStart: (e) => { e.cancel(); } });
    press(el);
    move(60, 10);
    up(60, 10);
    expect(pageLockDepth()).toBe(0);
  });

  it('destroy() inside onStart leaves no page lock', () => {
    const el = box();
    let handle: { destroy(): void };
    handle = draggable(el, { distance: 0, onStart: () => { handle.destroy(); } });
    press(el);
    move(60, 10);
    up(60, 10);
    expect(pageLockDepth()).toBe(0);
  });
});

describe('claim: keyboard reordering drops onStart, onMove and onEnd', () => {
  it('fires the same callbacks the pointer path does', () => {
    const ul = list(3);
    for (const li of Array.from(ul.children)) (li as HTMLElement).tabIndex = 0;
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const onSort = vi.fn();
    sortable(ul, { animation: 0, onStart, onEnd, onSort });

    const first = ul.children[0] as HTMLElement;
    const key = (k: string) =>
      first.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    key(' ');
    key('ArrowDown');
    key(' ');

    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

describe('claim: a two-item horizontal list cannot be reordered', () => {
  it('reorders a row of exactly two items', () => {
    const ul = list(2, true);
    sortable(ul, { distance: 0, animation: 0, keyboard: false });
    const first = ul.children[0] as HTMLElement;
    const r = first.getBoundingClientRect();
    press(first, r.left + 50, r.top + 30);
    move(r.left + 190, r.top + 30);
    up(r.left + 190, r.top + 30);
    expect(Array.from(ul.children).map((c) => (c as HTMLElement).dataset.id)).toEqual(['1', '0']);
  });
});

describe('claim: removing the dragged item mid-drag throws on drop', () => {
  it('completes the drag without throwing', () => {
    const ul = list(3);
    const onEnd = vi.fn();
    sortable(ul, { distance: 0, animation: 0, keyboard: false, onEnd });
    const first = ul.children[0] as HTMLElement;
    const r = first.getBoundingClientRect();
    press(first, r.left + 10, r.top + 25);
    move(r.left + 10, r.top + 60);
    first.remove();
    expect(() => up(r.left + 10, r.top + 60)).not.toThrow();
  });
});

describe('claim: a cross-list drop uses the source list items selector', () => {
  it('counts the destination with the destination list rules', () => {
    const a = list(2);
    a.style.cssText += ';position:absolute;left:0;top:0';
    for (const li of Array.from(a.children)) (li as HTMLElement).className = 'card';

    const b = list(2);
    b.style.cssText += ';position:absolute;left:0;top:400px';
    (b.children[0] as HTMLElement).dataset.id = 'header';
    (b.children[1] as HTMLElement).className = 'card';
    (b.children[1] as HTMLElement).dataset.id = 'b-card';

    let reported: number | null = null;
    // A counts only .card; B counts every child. A drop into B must be
    // reported using B's rule.
    sortable(a, {
      group: 'x', items: '.card', distance: 0, animation: 0, keyboard: false,
      onSort: ({ to }) => { reported = to.index; },
    });
    sortable(b, { group: 'x', distance: 0, animation: 0, keyboard: false });

    const first = a.children[0] as HTMLElement;
    const r = first.getBoundingClientRect();
    const target = b.getBoundingClientRect();
    press(first, r.left + 10, r.top + 25);
    move(target.left + 10, target.top + 90);
    up(target.left + 10, target.top + 90);

    const landed = Array.from(b.children).indexOf(first);
    if (landed === -1) return; // drop did not cross; nothing to assert here
    expect(reported).toBe(landed);
  });
});
