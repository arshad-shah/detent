import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode, act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useDraggable, useSortable } from '../../src/index';

let container: HTMLElement;
let root: Root;

function render(ui: ReactNode) {
  act(() => {
    root.render(<StrictMode>{ui}</StrictMode>);
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  container = document.getElementById('root')!;
  root = createRoot(container);
});

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

/** Parse the applied translate. Browsers normalise the third argument, so the
 *  raw string is not stable to assert on. */
function offsetOf(el: HTMLElement): { x: number; y: number } {
  const match = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el.style.transform || '');
  return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : { x: 0, y: 0 };
}

describe('useDraggable', () => {
  it('moves the element it is attached to', async () => {
    function Box() {
      const ref = useDraggable({ distance: 0 });
      return <div ref={ref} data-testid="box" style={{ width: 100, height: 100 }} />;
    }
    render(<Box />);
    const box = container.querySelector<HTMLElement>('[data-testid="box"]')!;

    drag(box, [10, 10], [60, 30]);
    await frame();

    expect(offsetOf(box)).toEqual({ x: 50, y: 20 });
  });

  it('survives a re-render with a fresh inline options object', async () => {
    // The whole point of the wrapper. A naive useEffect with `options` in its
    // dependency array destroys and rebinds on every render, cancelling an
    // in-flight drag.
    let setCount!: (n: number) => void;
    function Box() {
      const [count, set] = useState(0);
      setCount = set;
      const ref = useDraggable({ distance: 0, onMove: () => {} });
      return (
        <div ref={ref} data-testid="box" data-count={count} style={{ width: 100, height: 100 }} />
      );
    }
    render(<Box />);
    const box = container.querySelector<HTMLElement>('[data-testid="box"]')!;

    box.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: 10, clientY: 10 }));
    act(() => setCount(1));
    window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: 60, clientY: 10 }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: 60, clientY: 10 }));
    await frame();

    expect(box.dataset.count).toBe('1');
    expect(offsetOf(box)).toEqual({ x: 50, y: 0 });
  });

  it('calls the newest callback, not the one captured at bind time', () => {
    const first = vi.fn();
    const second = vi.fn();
    let swap!: () => void;

    function Box() {
      const [handler, set] = useState(() => first);
      swap = () => set(() => second);
      const ref = useDraggable({ distance: 0, onEnd: handler });
      return <div ref={ref} data-testid="box" style={{ width: 100, height: 100 }} />;
    }
    render(<Box />);
    const box = container.querySelector<HTMLElement>('[data-testid="box"]')!;

    act(() => swap());
    drag(box, [10, 10], [60, 10]);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unbinds when the element unmounts', () => {
    function Box({ show }: { show: boolean }) {
      const ref = useDraggable({ distance: 0 });
      return show ? (
        <div ref={ref} data-testid="box" style={{ width: 100, height: 100 }} />
      ) : null;
    }
    render(<Box show />);
    const box = container.querySelector<HTMLElement>('[data-testid="box"]')!;
    render(<Box show={false} />);

    // touch-action is set on bind and restored on destroy.
    expect(box.style.touchAction).toBe('');
  });
});

describe('useSortable', () => {
  it('reorders a list', async () => {
    function List() {
      const ref = useSortable({ distance: 0, animation: 0, keyboard: false });
      return (
        <ul ref={ref} style={{ margin: 0, padding: 0, listStyle: 'none', width: 200 }}>
          {['a', 'b', 'c'].map((id) => (
            <li key={id} data-id={id} style={{ height: 50 }} />
          ))}
        </ul>
      );
    }
    render(<List />);
    const list = container.querySelector('ul')!;
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
