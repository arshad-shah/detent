import type { HandleName } from '../core/resize-math';

/** The eight edge and corner names a resize handle can take. */
export type { HandleName } from '../core/resize-math';
import type { Activation, Bounds } from '../core/types';

export interface ResizeEvent {
  element: HTMLElement;
  width: number;
  height: number;
  handle: HandleName;
  event: PointerEvent;
  cancel(): void;
}

export type HandleSpec = HandleName[] | Partial<Record<HandleName, string | HTMLElement>>;

export interface ResizableOptions extends Omit<Activation, 'handle'> {
  /**
   * Which edges and corners can be grabbed. Defaults to all eight.
   *
   * As an array, the library creates its own handle elements inside the
   * target. As an object, it binds to elements you already have — pass a
   * selector or an element per direction. Use the object form when appending
   * children would disturb your component: framework rendering, `:last-child`
   * and `:nth-child` rules, or code that walks `element.children`.
   */
  handles?: HandleSpec;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /**
   * Hold a width-to-height ratio. `true` keeps the element's starting ratio,
   * a number sets one explicitly (16 / 9).
   */
  aspectRatio?: boolean | number;
  /** Snap the size to a grid, in pixels. */
  grid?: number | [number, number];
  /** Keep the element inside this area. */
  bounds?: Bounds;
  disabled?: boolean;
  onStart?(event: ResizeEvent): void | boolean;
  onResize?(event: ResizeEvent): void;
  onEnd?(event: ResizeEvent, cancelled: boolean): void;
}

export interface ResizableHandle {
  setDisabled(disabled: boolean): void;
  destroy(): void;
}
