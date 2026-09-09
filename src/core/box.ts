import { boxOf } from './geometry';
import { write } from './scheduler';
import type { Box, Bounds } from './types';

/**
 * The offset and size the library has applied to an element.
 *
 * Kept here rather than read back off the DOM so that dragging and resizing
 * the same element compose instead of fighting: resizing from the left edge
 * changes both the width and the offset, and a following drag continues from
 * that offset.
 */
export interface BoxState {
  x: number;
  y: number;
  width: number | null;
  height: number | null;
}

const states = new WeakMap<HTMLElement, BoxState>();

export function stateOf(el: HTMLElement): BoxState {
  let state = states.get(el);
  if (!state) {
    state = { x: 0, y: 0, width: null, height: null };
    states.set(el, state);
  }
  return state;
}

export function resetState(el: HTMLElement): void {
  states.delete(el);
}

/** Push the element's current offset and size to the DOM on the next frame. */
export function paint(el: HTMLElement): void {
  const state = stateOf(el);
  write(() => {
    el.style.transform = state.x || state.y ? `translate3d(${state.x}px, ${state.y}px, 0)` : '';
    if (state.width !== null) el.style.width = `${state.width}px`;
    if (state.height !== null) el.style.height = `${state.height}px`;
  });
}

/** Same as paint, but immediate — used when a frame of lag would show. */
export function paintNow(el: HTMLElement): void {
  const state = stateOf(el);
  el.style.transform = state.x || state.y ? `translate3d(${state.x}px, ${state.y}px, 0)` : '';
  if (state.width !== null) el.style.width = `${state.width}px`;
  if (state.height !== null) el.style.height = `${state.height}px`;
}

export function resolveBounds(el: HTMLElement, bounds: Bounds): Box | null {
  if (!bounds) return null;
  if (bounds === 'window') {
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }
  if (bounds === 'parent') {
    return el.parentElement ? boxOf(el.parentElement) : null;
  }
  if (typeof (bounds as Element).getBoundingClientRect === 'function') {
    return boxOf(bounds as Element);
  }
  return bounds as Box;
}
