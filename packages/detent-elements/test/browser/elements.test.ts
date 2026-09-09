import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { defineDetentElements } from '../../src/index';

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

beforeAll(() => {
  defineDetentElements();
});

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('defineDetentElements', () => {
  it('is safe to call twice', () => {
    expect(() => defineDetentElements()).not.toThrow();
  });

  it('registers the three elements', () => {
    expect(customElements.get('detent-draggable')).toBeTypeOf('function');
    expect(customElements.get('detent-sortable')).toBeTypeOf('function');
    expect(customElements.get('detent-resizable')).toBeTypeOf('function');
  });
});

describe('<detent-draggable>', () => {
  it('drags its own element', async () => {
    document.body.innerHTML =
      '<detent-draggable distance="0" style="display:block;width:100px;height:100px"></detent-draggable>';
    const el = document.querySelector<HTMLElement>('detent-draggable')!;

    drag(el, [10, 10], [60, 30]);
    await frame();

    expect(offsetOf(el)).toEqual({ x: 50, y: 20 });
  });

  it('reads options from attributes', async () => {
    document.body.innerHTML =
      '<detent-draggable distance="0" axis="x" style="display:block;width:100px;height:100px"></detent-draggable>';
    const el = document.querySelector<HTMLElement>('detent-draggable')!;

    drag(el, [10, 10], [60, 40]);
    await frame();

    expect(offsetOf(el)).toEqual({ x: 50, y: 0 });
  });

  it('applies an attribute change without a reload', async () => {
    document.body.innerHTML =
      '<detent-draggable distance="0" style="display:block;width:100px;height:100px"></detent-draggable>';
    const el = document.querySelector<HTMLElement>('detent-draggable')!;
    el.setAttribute('axis', 'y');

    drag(el, [10, 10], [60, 40]);
    await frame();

    expect(offsetOf(el)).toEqual({ x: 0, y: 30 });
  });

  it('unbinds when removed from the document', () => {
    document.body.innerHTML =
      '<detent-draggable distance="0" style="display:block;width:100px;height:100px"></detent-draggable>';
    const el = document.querySelector<HTMLElement>('detent-draggable')!;
    el.remove();
    drag(el, [10, 10], [60, 10]);
    expect(offsetOf(el)).toEqual({ x: 0, y: 0 });
  });
});

describe('<detent-sortable>', () => {
  it('reorders its children and emits detent:sort', async () => {
    document.body.innerHTML = `
      <detent-sortable distance="0" animation="0" keyboard="false"
        style="display:block;width:200px">
        <div data-id="a" style="height:50px"></div>
        <div data-id="b" style="height:50px"></div>
        <div data-id="c" style="height:50px"></div>
      </detent-sortable>`;
    const el = document.querySelector<HTMLElement>('detent-sortable')!;

    const events: CustomEvent[] = [];
    el.addEventListener('detent:sort', (e) => events.push(e as CustomEvent));

    const first = el.children[0] as HTMLElement;
    const box = first.getBoundingClientRect();
    drag(first, [box.left + 10, box.top + 25], [box.left + 10, box.top + 130]);
    await frame();

    expect(Array.from(el.children).map((c) => (c as HTMLElement).dataset.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].detail.to.index).toBe(2);
  });

  it('keeps its children in the light DOM so host styles apply', () => {
    document.body.innerHTML = '<detent-sortable><div data-id="a"></div></detent-sortable>';
    const el = document.querySelector<HTMLElement>('detent-sortable')!;
    expect(el.shadowRoot).toBeNull();
    expect(el.querySelector('[data-id="a"]')).not.toBeNull();
  });
});
