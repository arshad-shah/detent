export interface Point {
  x: number;
  y: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type Axis = 'x' | 'y' | 'both';

/** Where a draggable is allowed to travel. */
export type Bounds = 'parent' | 'window' | Element | Box | null;

/** Returned by every entry point. Call destroy() to unbind everything. */
export interface Handle {
  destroy(): void;
}

/**
 * How much the user has to commit before a drag actually begins.
 *
 * A mouse only needs to travel a few pixels, otherwise ordinary clicks would
 * turn into drags. A finger needs a short press instead, otherwise the page
 * can never be scrolled by swiping over a draggable.
 */
export interface Activation {
  /** Pixels of travel before a mouse or pen drag starts. Default 4. */
  distance?: number;
  /** Milliseconds of press before a touch drag starts. Default 200. */
  delay?: number;
  /** How far a finger may drift during `delay` before we assume a scroll. Default 6. */
  tolerance?: number;
  /** Only start a drag from a descendant matching this selector. */
  handle?: string;
  /** Never start a drag from a descendant matching this selector. */
  cancel?: string;
}
