import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sortable } from '../../src/sortable/index';
import { CLASS } from '../../src/core/constants';
import { idsOf, layout, makeList, offsetOf, press, stack } from './helpers';
import { flush } from '../../src/core/scheduler';

beforeEach(() => {
  document.body.innerHTML = '';
});

function column(count: number) {
  const { list, items } = makeList(count);
  layout(list, { left: 0, top: 0, width: 200, height: count * 50 });
  stack(items, 50);
  return { list, items };
}

describe('sortable within one list', () => {
  it('leaves the order alone when nothing crosses a midpoint', () => {
    const { list, items } = column(4);
    sortable(list, { distance: 0, animation: 0 });
    press(items[0], 10, 25).move(10, 30).up();
    expect(idsOf(list)).toEqual(['0', '1', '2', '3']);
  });

  it('moves an item down past its neighbours', () => {
    const { list, items } = column(4);
    sortable(list, { distance: 0, animation: 0 });
    // From the middle of row 0 down past the middle of row 2.
    press(items[0], 10, 25).move(10, 130).up();
    expect(idsOf(list)).toEqual(['1', '2', '0', '3']);
  });

  it('moves an item up past its neighbours', () => {
    const { list, items } = column(4);
    sortable(list, { distance: 0, animation: 0 });
    press(items[3], 10, 175).move(10, 10).up();
    expect(idsOf(list)).toEqual(['3', '0', '1', '2']);
  });

  it('sends an item to the end', () => {
    const { list, items } = column(4);
    sortable(list, { distance: 0, animation: 0 });
    press(items[0], 10, 25).move(10, 190).up();
    expect(idsOf(list)).toEqual(['1', '2', '3', '0']);
  });

  it('reports the move once, with both positions', () => {
    const { list, items } = column(4);
    const onSort = vi.fn();
    sortable(list, { distance: 0, animation: 0, onSort });
    press(items[0], 10, 25).move(10, 130).up();

    expect(onSort).toHaveBeenCalledTimes(1);
    const event = onSort.mock.calls[0][0];
    expect(event.item).toBe(items[0]);
    expect(event.from.index).toBe(0);
    expect(event.to.index).toBe(2);
  });

  it('stays quiet when the item lands back where it started', () => {
    const { list, items } = column(4);
    const onSort = vi.fn();
    sortable(list, { distance: 0, animation: 0, onSort });
    press(items[0], 10, 25).move(10, 130).move(10, 25).up();
    expect(idsOf(list)).toEqual(['0', '1', '2', '3']);
    expect(onSort).not.toHaveBeenCalled();
  });

  it('restores the original order when the drag is cancelled', () => {
    const { list, items } = column(4);
    const onSort = vi.fn();
    sortable(list, { distance: 0, animation: 0, onSort });
    press(items[0], 10, 25).move(10, 130).escape();
    expect(idsOf(list)).toEqual(['0', '1', '2', '3']);
    expect(onSort).not.toHaveBeenCalled();
  });

  it('clears the item transform on drop', () => {
    const { list, items } = column(4);
    sortable(list, { distance: 0, animation: 0 });
    press(items[0], 10, 25).move(10, 130).up();
    expect(items[0].style.transform).toBe('');
  });

  it('marks the item while it moves', () => {
    const { list, items } = column(3);
    sortable(list, { distance: 0, animation: 0 });
    const gesture = press(items[0], 10, 25);
    gesture.move(10, 60);
    expect(items[0].classList.contains(CLASS.sorting)).toBe(true);
    gesture.up();
    expect(items[0].classList.contains(CLASS.sorting)).toBe(false);
  });

  it('ignores a press that lands on the list but not on an item', () => {
    const { list } = column(3);
    const onStart = vi.fn();
    sortable(list, { distance: 0, animation: 0, onStart });
    press(list, 10, 25).move(10, 100).up();
    expect(onStart).not.toHaveBeenCalled();
  });

  it('stops responding after destroy', () => {
    const { list, items } = column(4);
    const handle = sortable(list, { distance: 0, animation: 0 });
    handle.destroy();
    press(items[0], 10, 25).move(10, 130).up();
    expect(idsOf(list)).toEqual(['0', '1', '2', '3']);
  });
});

describe('sortable across lists', () => {
  function twoLists() {
    const a = makeList(3);
    const b = makeList(3);
    a.items.forEach((el, i) => (el.dataset.id = `a${i}`));
    b.items.forEach((el, i) => (el.dataset.id = `b${i}`));

    layout(a.list, { left: 0, top: 0, width: 200, height: 150 });
    layout(b.list, { left: 300, top: 0, width: 200, height: 150 });
    stack(a.items, 50, 0, 0, 0);
    stack(b.items, 50, 0, 300, 0);
    return { a, b };
  }

  it('moves an item into another list in the same group', () => {
    const { a, b } = twoLists();
    sortable(a.list, { group: 'shared', distance: 0, animation: 0 });
    sortable(b.list, { group: 'shared', distance: 0, animation: 0 });

    press(a.items[0], 10, 25).move(350, 25).up();

    expect(idsOf(a.list)).toEqual(['a1', 'a2']);
    expect(idsOf(b.list)).toEqual(['a0', 'b0', 'b1', 'b2']);
  });

  it('reports the destination list in onSort', () => {
    const { a, b } = twoLists();
    const onSort = vi.fn();
    sortable(a.list, { group: 'shared', distance: 0, animation: 0, onSort });
    sortable(b.list, { group: 'shared', distance: 0, animation: 0 });

    // Past the middle of b1 but not b2, so it lands between them.
    press(a.items[0], 10, 25).move(350, 110).up();

    const event = onSort.mock.calls[0][0];
    expect(event.from.container).toBe(a.list);
    expect(event.to.container).toBe(b.list);
    expect(event.to.index).toBe(2);
  });

  it('refuses to cross into a list in a different group', () => {
    const { a, b } = twoLists();
    sortable(a.list, { group: 'left', distance: 0, animation: 0 });
    sortable(b.list, { group: 'right', distance: 0, animation: 0 });

    press(a.items[0], 10, 25).move(350, 25).up();

    expect(idsOf(a.list)).toEqual(['a0', 'a1', 'a2']);
    expect(idsOf(b.list)).toEqual(['b0', 'b1', 'b2']);
  });

  it('accepts a drop into an empty list', () => {
    const { a } = twoLists();
    const empty = document.createElement('ul');
    document.body.appendChild(empty);
    layout(empty, { left: 300, top: 0, width: 200, height: 150 });

    sortable(a.list, { group: 'shared', distance: 0, animation: 0 });
    sortable(empty, { group: 'shared', distance: 0, animation: 0 });

    press(a.items[0], 10, 25).move(350, 75).up();

    expect(idsOf(a.list)).toEqual(['a1', 'a2']);
    expect(idsOf(empty)).toEqual(['a0']);
  });
});

describe('sortable inside something that scrolls', () => {
  /** A real scrolling list: 8 rows of 50px inside a 200px viewport. */
  function scrollingColumn(count = 8) {
    const { list, items } = makeList(count);
    layout(list, { left: 0, top: 0, width: 200, height: 200 });
    stack(items, 50);
    list.style.overflowY = 'auto';
    // Chrome and Firefox implement scroll anchoring: when a reorder shifts
    // content above the viewport they compensate by moving scrollTop, which
    // makes an assertion about scroll position non-deterministic. Turned off
    // so these tests measure the library, not the browser's compensation.
    list.style.overflowAnchor = 'none';
    return { list, items };
  }

  /** Scroll for real and let the scroll event reach the library. */
  async function scrollBy(list: HTMLElement, amount: number) {
    list.scrollTop += amount;
    for (let i = 0; i < 2; i++) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    flush();
  }

  it('keeps the item under the pointer when the list scrolls beneath it', async () => {
    const { list, items } = scrollingColumn();
    sortable(list, { distance: 0, animation: 0, autoScroll: false });

    press(items[0], 10, 25).move(10, 40);
    // Where it sits on screen — the invariant the user actually sees. Its
    // offset is not the right measure, because scrolling can also trigger a
    // reorder, and re-anchoring after a move changes the offset by design.
    const before = items[0].getBoundingClientRect().top;

    await scrollBy(list, 100);
    expect(list.scrollTop).toBe(100);

    // The pointer has not moved, so neither should the item.
    expect(items[0].getBoundingClientRect().top).toBeCloseTo(before, 0);
  });

  it('reorders against where the rows are now, not where they were', async () => {
    const { list, items } = scrollingColumn();
    sortable(list, { distance: 0, animation: 0, autoScroll: false });

    const gesture = press(items[0], 10, 25);
    await scrollBy(list, 100);
    // With the content scrolled up 100, viewport y=130 sits over what was
    // row 4. Measuring against the stale boxes would land it two rows short.
    gesture.move(10, 130);
    gesture.up();

    expect(idsOf(list)).toEqual(['1', '2', '3', '4', '0', '5', '6', '7']);
  });

  it('stops listening for scrolls once the drag ends', async () => {
    const { list, items } = scrollingColumn();
    sortable(list, { distance: 0, animation: 0, autoScroll: false });

    press(items[0], 10, 25).move(10, 40).up();
    const settled = offsetOf(items[0]);

    await scrollBy(list, 100);

    expect(offsetOf(items[0])).toEqual(settled);
  });
});

describe('sortable with a horizontal list', () => {
  it('reads left-to-right layouts on its own', () => {
    const { list, items } = makeList(3, 'div');
    layout(list, { left: 0, top: 0, width: 300, height: 60 });
    items.forEach((el, i) => layout(el, { left: i * 100, top: 0, width: 100, height: 60 }));

    sortable(list, { distance: 0, animation: 0 });
    press(items[0], 50, 30).move(280, 30).up();
    expect(idsOf(list)).toEqual(['1', '2', '0']);
  });
});

describe('sortable with the keyboard', () => {
  function keydown(el: HTMLElement, key: string) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  }

  it('lifts, moves and drops with space and the arrow keys', () => {
    const { list, items } = column(4);
    const onSort = vi.fn();
    sortable(list, { distance: 0, animation: 0, onSort });

    keydown(items[0], ' ');
    keydown(items[0], 'ArrowDown');
    keydown(items[0], 'ArrowDown');
    keydown(items[0], ' ');

    expect(idsOf(list)).toEqual(['1', '2', '0', '3']);
    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSort.mock.calls[0][0].to.index).toBe(2);
  });

  it('puts the item back on Escape', () => {
    const { list, items } = column(4);
    const onSort = vi.fn();
    sortable(list, { distance: 0, animation: 0, onSort });

    keydown(items[0], ' ');
    keydown(items[0], 'ArrowDown');
    keydown(items[0], 'Escape');

    expect(idsOf(list)).toEqual(['0', '1', '2', '3']);
    expect(onSort).not.toHaveBeenCalled();
  });

  it('will not move past the ends of the list', () => {
    const { list, items } = column(3);
    sortable(list, { distance: 0, animation: 0 });

    keydown(items[0], ' ');
    keydown(items[0], 'ArrowUp');
    keydown(items[0], ' ');
    expect(idsOf(list)).toEqual(['0', '1', '2']);
  });

  it('stays out of the way when keyboard support is off', () => {
    const { list, items } = column(3);
    sortable(list, { distance: 0, animation: 0, keyboard: false });
    keydown(items[0], ' ');
    keydown(items[0], 'ArrowDown');
    keydown(items[0], ' ');
    expect(idsOf(list)).toEqual(['0', '1', '2']);
  });
});

describe('sortable and your own styling', () => {
  it('leaves an already-positioned item positioned as it was', () => {
    const { list, items } = column(4);
    items[0].style.position = 'absolute';
    sortable(list, { distance: 0, animation: 0 });

    const gesture = press(items[0], 10, 25);
    gesture.move(10, 60);
    expect(items[0].style.position).toBe('absolute');
    gesture.up();
    expect(items[0].style.position).toBe('absolute');
  });

  it('puts a static item back to no inline position afterwards', () => {
    const { list, items } = column(4);
    sortable(list, { distance: 0, animation: 0 });

    press(items[0], 10, 25).move(10, 130).up();
    expect(items[0].style.position).toBe('');
    expect(items[0].style.zIndex).toBe('');
  });
});
