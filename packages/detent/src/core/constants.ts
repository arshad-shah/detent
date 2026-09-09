/**
 * The prefix every class and attribute the library writes begins with.
 *
 * Deliberately unscoped and independent of the npm package name: this ends up
 * in `class="detent-dragging"` and `data-detent-handle`, where a scope would
 * be both ugly and, for an attribute, invalid.
 */
export const PREFIX = 'detent';

/** Class names the library adds to host elements. */
export const CLASS = {
  /** On a draggable element, for the duration of a drag. */
  dragging: `${PREFIX}-dragging`,
  /** On a sortable item, while it is being moved by pointer or keyboard. */
  sorting: `${PREFIX}-sorting`,
  /** On a sortable container, for its lifetime. */
  sortable: `${PREFIX}-sortable`,
  /** On a resizable element, for its lifetime. */
  resizable: `${PREFIX}-resizable`,
  /** On a resizable element, for the duration of a resize. */
  resizing: `${PREFIX}-resizing`,
  /** On every handle element the library creates. */
  handle: `${PREFIX}-handle`,
} as const;

/** Attribute names the library reads or writes. */
export const ATTR = {
  /** On `<body>`, while any drag is active. Refcounted. */
  dragging: `data-${PREFIX}-dragging`,
  /** On a handle element, naming its direction. */
  handle: `data-${PREFIX}-handle`,
  /** Read from a list child to exclude it from sorting. */
  ignore: `data-${PREFIX}-ignore`,
  /** On the screen-reader announcer element. */
  liveRegion: `data-${PREFIX}-live-region`,
} as const;

/** The per-direction handle class, e.g. `detent-handle-ne`. */
export function handleClass(name: string): string {
  return `${CLASS.handle}-${name}`;
}

/**
 * Every tunable default in the library.
 *
 * `handleSize` is duplicated as the `--detent-handle-size` custom property in
 * styles.css. A test asserts the two agree, so they cannot drift.
 */
export const DEFAULTS = {
  /** Pixels of travel before a mouse or pen drag starts. */
  distance: 4,
  /** Milliseconds of press before a touch drag starts. */
  delay: 200,
  /** How far a finger may drift during `delay` before we assume a scroll. */
  tolerance: 6,
  /** Reorder animation, in milliseconds. */
  animation: 180,
  /** Stacking order applied to a sortable item while it moves. */
  zIndex: 20,
  /** How close to an edge, in pixels, before auto-scrolling begins. */
  scrollThreshold: 60,
  /** Auto-scroll pixels per frame at full speed. */
  scrollSpeed: 14,
  /** Smallest width or height a resize will produce, in pixels. */
  minSize: 16,
  /** Edge length of a library-created resize handle, in pixels. */
  handleSize: 12,
} as const;
