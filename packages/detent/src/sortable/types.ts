import type { AutoScrollOptions } from '../core/autoscroll';
import type { Activation } from '../core/types';

export interface SortLocation {
  container: HTMLElement;
  index: number;
}

export interface SortEvent {
  item: HTMLElement;
  from: SortLocation;
  to: SortLocation;
}

export interface SortableOptions extends Activation {
  /**
   * Lists sharing a group name can pass items between each other. Leave it
   * unset to keep a list self-contained.
   */
  group?: string;
  /** Which children are sortable. Defaults to every element child. */
  items?: string;
  /** How the list reads. 'auto' works it out from where the items sit. */
  direction?: 'auto' | 'x' | 'y' | 'grid';
  /** Reorder animation in milliseconds. 0 turns it off. Default 180. */
  animation?: number;
  /** Scroll the list when the pointer nears its edges. Default true. */
  autoScroll?: boolean | AutoScrollOptions;
  /** Allow reordering with the keyboard. Default true. */
  keyboard?: boolean;
  /** Stacking order for the item being moved. Default 20. */
  zIndex?: number;
  /**
   * Whether the list claims touch gestures. Defaults to 'none', or 'auto' when
   * the list scrolls itself so that swiping still works.
   */
  touchAction?: 'none' | 'auto' | 'manipulation';
  disabled?: boolean;
  onStart?(item: HTMLElement, from: SortLocation): void | boolean;
  onMove?(item: HTMLElement, to: SortLocation): void;
  /** Fires once, on drop, only when the item actually moved. */
  onSort?(event: SortEvent): void;
  onEnd?(item: HTMLElement, cancelled: boolean): void;
}
