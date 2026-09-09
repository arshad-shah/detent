import { flush } from '../../src/core/scheduler';
import type { Box } from '../../src/core/types';

/**
 * happy-dom has no layout engine, so every element in a test is told where it
 * is. Anything reading `getBoundingClientRect` sees the box given here plus
 * whatever translate the library has applied.
 */
export function layout(el: HTMLElement, box: Box): void {
  (el as any).__box = box;
  el.getBoundingClientRect = function () {
    const own = (this as any).__box as Box;
    const [tx, ty] = translateOf(this as HTMLElement);
    const width = parseFloat(this.style.width) || own.width;
    const height = parseFloat(this.style.height) || own.height;
    return {
      left: own.left + tx,
      top: own.top + ty,
      width,
      height,
      right: own.left + tx + width,
      bottom: own.top + ty + height,
      x: own.left + tx,
      y: own.top + ty,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

function translateOf(el: HTMLElement): [number, number] {
  const match = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el.style.transform || '');
  return match ? [parseFloat(match[1]), parseFloat(match[2])] : [0, 0];
}

/** Lay a set of elements out as a single column, top to bottom. */
export function stack(elements: HTMLElement[], height = 50, gap = 0, left = 0, top = 0): void {
  elements.forEach((el, i) => {
    layout(el, { left, top: top + i * (height + gap), width: 200, height });
  });
}

/** Lay a set of elements out as a single row, left to right. */
export function row(elements: HTMLElement[], width = 50, gap = 0, left = 0, top = 0): void {
  elements.forEach((el, i) => {
    layout(el, { left: left + i * (width + gap), top, width, height: 60 });
  });
}

function fire(target: EventTarget, type: string, init: Record<string, unknown>) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, ...init } as any));
}

export interface PointerDriverOptions {
  pointerType?: 'mouse' | 'touch' | 'pen';
  pointerId?: number;
}

/** Drive a whole gesture: press, move through each point, release. */
export function press(
  target: EventTarget,
  x: number,
  y: number,
  options: PointerDriverOptions = {},
) {
  const pointerType = options.pointerType ?? 'mouse';
  const pointerId = options.pointerId ?? 1;
  const base = { pointerType, pointerId, isPrimary: true, button: 0 };

  fire(target, 'pointerdown', { ...base, clientX: x, clientY: y });

  return {
    move(nx: number, ny: number) {
      fire(window, 'pointermove', { ...base, clientX: nx, clientY: ny });
      flush();
      return this;
    },
    up(nx = x, ny = y) {
      fire(window, 'pointerup', { ...base, clientX: nx, clientY: ny });
      flush();
    },
    cancel() {
      fire(window, 'pointercancel', { ...base, clientX: x, clientY: y });
      flush();
    },
    escape() {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      flush();
    },
  };
}

export function offsetOf(el: HTMLElement): { x: number; y: number } {
  const [x, y] = translateOf(el);
  return { x, y };
}

export function makeList(count: number, tag = 'li'): { list: HTMLElement; items: HTMLElement[] } {
  const list = document.createElement('ul');
  const items: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement(tag);
    el.textContent = String(i);
    el.dataset.id = String(i);
    list.appendChild(el);
    items.push(el);
  }
  document.body.appendChild(list);
  return { list, items };
}

export function idsOf(list: HTMLElement): string[] {
  return Array.from(list.children).map((c) => (c as HTMLElement).dataset.id ?? '');
}
