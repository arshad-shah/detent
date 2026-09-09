import { beforeEach, describe, expect, it } from 'vitest';
import { sortable } from '../../src/sortable/index';
import { flush } from '../../src/core/scheduler';

const base = {
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
  button: 0,
  bubbles: true,
  cancelable: true,
};

function row(dir: 'ltr' | 'rtl') {
  const list = document.createElement('ul');
  list.dir = dir;
  list.style.cssText = 'display:flex;margin:0;padding:0;list-style:none;width:300px';
  for (const id of ['a', 'b', 'c']) {
    const li = document.createElement('li');
    li.dataset.id = id;
    li.style.cssText = 'width:100px;height:50px;flex:0 0 auto';
    list.appendChild(li);
  }
  document.body.appendChild(list);
  sortable(list, { distance: 0, animation: 0, keyboard: false });
  return list;
}

function dragFirstTo(list: HTMLElement, clientX: number) {
  const first = list.children[0] as HTMLElement;
  const start = first.getBoundingClientRect();
  const y = start.top + 25;
  first.dispatchEvent(
    new PointerEvent('pointerdown', { ...base, clientX: start.left + 50, clientY: y }),
  );
  window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX, clientY: y }));
  flush();
  window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX, clientY: y }));
  flush();
}

const order = (list: HTMLElement) =>
  Array.from(list.children).map((c) => (c as HTMLElement).dataset.id);

describe('sortable in a horizontal row', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('sends the first item to the end when dragged to the far LEFT under rtl', () => {
    const list = row('rtl');
    // Under rtl the first item sits on the right, so "further along the list"
    // is leftwards on screen.
    dragFirstTo(list, list.getBoundingClientRect().left + 5);
    expect(order(list)).toEqual(['b', 'c', 'a']);
  });

  it('sends the first item to the end when dragged to the far RIGHT under ltr', () => {
    const list = row('ltr');
    dragFirstTo(list, list.getBoundingClientRect().right - 5);
    expect(order(list)).toEqual(['b', 'c', 'a']);
  });

  it('moves one place, not to the end, at the neighbour’s midpoint under rtl', () => {
    const list = row('rtl');
    const second = list.children[1] as HTMLElement;
    const mid = second.getBoundingClientRect();
    dragFirstTo(list, mid.left + mid.width / 2 - 5);
    expect(order(list)).toEqual(['b', 'a', 'c']);
  });
});
