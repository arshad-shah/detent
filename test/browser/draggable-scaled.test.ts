import { beforeEach, describe, expect, it } from 'vitest';
import { draggable } from '../../src/draggable';
import { resizable } from '../../src/resizable';
import { sortable } from '../../src/sortable/index';
import { ATTR } from '../../src/core/constants';
import { flush } from '../../src/core/scheduler';

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
  flush();
  window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: to[0], clientY: to[1] }));
  flush();
}

function stage(): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = 'transform:scale(0.5);transform-origin:0 0;width:800px;height:600px';
  document.body.appendChild(el);
  return el;
}

describe('inside a scaled ancestor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('a drag follows the cursor 1:1 on screen', () => {
    const el = document.createElement('div');
    el.style.cssText = 'width:100px;height:100px;position:absolute;left:0;top:0';
    stage().appendChild(el);

    draggable(el, { distance: 0 });
    const before = el.getBoundingClientRect().left;
    drag(el, [10, 10], [110, 10]);

    // The cursor moved 100 screen px, so the element must move 100 screen px —
    // which is 200 layout px inside a half-scale stage.
    expect(el.getBoundingClientRect().left - before).toBeCloseTo(100, 0);
  });

  it('a resize grows the element 1:1 on screen', () => {
    const el = document.createElement('div');
    el.style.cssText = 'width:100px;height:100px;position:absolute;left:0;top:0';
    stage().appendChild(el);

    resizable(el, { handles: ['se'], distance: 0 });
    const grip = el.querySelector<HTMLElement>(`[${ATTR.handle}="se"]`)!;
    const before = el.getBoundingClientRect().width;
    drag(grip, [50, 50], [150, 50]);

    expect(el.getBoundingClientRect().width - before).toBeCloseTo(100, 0);
  });
});

describe('sortable inside a scaled ancestor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reorders at the crossing point the user actually sees', () => {
    const host = stage();
    const list = document.createElement('ul');
    list.style.cssText = 'margin:0;padding:0;list-style:none;width:400px';
    for (const id of ['a', 'b', 'c']) {
      const li = document.createElement('li');
      li.dataset.id = id;
      li.style.cssText = 'height:100px';
      list.appendChild(li);
    }
    host.appendChild(list);
    sortable(list, { distance: 0, animation: 0, keyboard: false });

    const first = list.children[0] as HTMLElement;
    const rect = first.getBoundingClientRect();
    // Each row is 100 layout px, so 50 rendered px at half scale. Dragging
    // 60 rendered px down crosses the midpoint of the next row.
    drag(first, [rect.left + 10, rect.top + 25], [rect.left + 10, rect.top + 85]);

    expect(Array.from(list.children).map((c) => (c as HTMLElement).dataset.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });
});
