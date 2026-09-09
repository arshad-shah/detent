import { beforeEach, describe, expect, it } from 'vitest';
import { sortable } from '../../src/sortable/index';

function buildList(root: ParentNode) {
  const list = document.createElement('ul');
  list.style.cssText = 'margin:0;padding:0;list-style:none';
  for (const id of ['a', 'b', 'c']) {
    const li = document.createElement('li');
    li.dataset.id = id;
    li.tabIndex = 0;
    li.style.cssText = 'height:40px';
    list.appendChild(li);
  }
  root.appendChild(list);
  return list;
}

const order = (list: HTMLElement) =>
  Array.from(list.children).map((c) => (c as HTMLElement).dataset.id);

function key(target: HTMLElement, k: string) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }),
  );
}

describe('keyboard reordering', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reorders in the light DOM', () => {
    const list = buildList(document.body);
    sortable(list, { animation: 0 });
    const first = list.children[0] as HTMLElement;
    key(first, ' ');
    key(first, 'ArrowDown');
    key(first, ' ');
    expect(order(list)).toEqual(['b', 'a', 'c']);
  });

  it('reorders inside a shadow root', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const list = buildList(shadow);
    sortable(list, { animation: 0 });

    const first = list.children[0] as HTMLElement;
    first.focus();
    key(first, ' ');
    key(first, 'ArrowDown');
    key(first, ' ');

    expect(order(list)).toEqual(['b', 'a', 'c']);
  });
});
