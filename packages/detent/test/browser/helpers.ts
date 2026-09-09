import { flush } from '../../src/core/scheduler';
import type { Box } from '../../src/core/types';

let sheet: CSSStyleSheet | null = null;
let seq = 0;

function rule(css: string): string {
  if (!sheet) {
    const tag = document.createElement('style');
    tag.dataset.testLayout = '';
    document.head.appendChild(tag);
    sheet = tag.sheet;
  }
  const name = `t${seq++}`;
  sheet!.insertRule(`.${name}{${css}}`, sheet!.cssRules.length);
  return name;
}

/**
 * Place an element at a known box using real CSS.
 *
 * These helpers used to overwrite `getBoundingClientRect`, which meant no test
 * in the suite ever exercised a layout engine — and that is precisely why the
 * transform-scale, RTL and smooth-scroll defects survived.
 *
 * Positioning comes from a stylesheet rather than inline styles, so
 * `el.style.position` and `el.style.width` stay empty and tests can still
 * assert on what the library itself writes inline.
 */
export function layout(el: HTMLElement, box: Box): void {
  el.classList.add(
    rule(
      `position:absolute;margin:0;box-sizing:border-box;` +
        `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px`,
    ),
  );
}

/**
 * Lay a set of elements out as a single column, top to bottom.
 *
 * Normal flow, not absolute positioning: the items stay statically positioned
 * so the library's own position handling is exercised, and a reorder really
 * reflows.
 */
export function stack(elements: HTMLElement[], height = 50, gap = 0, left = 0, top = 0): void {
  const name = rule(
    `box-sizing:border-box;width:200px;height:${height}px;margin:0 0 ${gap}px 0`,
  );
  for (const el of elements) el.classList.add(name);
  const parent = elements[0]?.parentElement;
  if (parent) parent.classList.add(rule(`position:absolute;left:${left}px;top:${top}px;margin:0`));
}

/** Lay a set of elements out as a single row, left to right. */
export function row(elements: HTMLElement[], width = 50, gap = 0, left = 0, top = 0): void {
  const name = rule(
    `box-sizing:border-box;width:${width}px;height:60px;margin:0 ${gap}px 0 0;flex:0 0 auto`,
  );
  for (const el of elements) el.classList.add(name);
  const parent = elements[0]?.parentElement;
  if (parent) {
    parent.classList.add(
      rule(`position:absolute;display:flex;left:${left}px;top:${top}px;margin:0`),
    );
  }
}

/** Drop every layout rule between tests. */
export function resetLayout(): void {
  document.head.querySelectorAll('style[data-test-layout]').forEach((s) => s.remove());
  sheet = null;
}

function translateOf(el: HTMLElement): [number, number] {
  const match = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(el.style.transform || '');
  return match ? [parseFloat(match[1]), parseFloat(match[2])] : [0, 0];
}

function fire(target: EventTarget, type: string, init: Record<string, unknown>) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, ...init }));
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
  list.style.cssText = 'margin:0;padding:0;list-style:none';
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
