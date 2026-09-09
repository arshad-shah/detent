import { useCallback, useRef } from 'react';
import { sortable, type Handle, type SortableOptions } from 'detent';
import { useLatest } from './latest';

/**
 * Bind `sortable` to whatever element the returned ref is attached to.
 *
 * As with useDraggable, options are read at call time so re-rendering never
 * re-binds and callbacks are always the newest ones.
 */
export function useSortable(options: SortableOptions = {}) {
  const latest = useLatest(options);
  const handle = useRef<Handle | null>(null);

  return useCallback(
    (node: HTMLElement | null) => {
      handle.current?.destroy();
      handle.current = null;
      if (!node) return;

      handle.current = sortable(node, {
        get group() { return latest.current.group; },
        get items() { return latest.current.items; },
        get direction() { return latest.current.direction; },
        get animation() { return latest.current.animation; },
        get autoScroll() { return latest.current.autoScroll; },
        get keyboard() { return latest.current.keyboard; },
        get zIndex() { return latest.current.zIndex; },
        get disabled() { return latest.current.disabled; },
        get handle() { return latest.current.handle; },
        get cancel() { return latest.current.cancel; },
        get distance() { return latest.current.distance; },
        get delay() { return latest.current.delay; },
        get tolerance() { return latest.current.tolerance; },
        get touchAction() { return latest.current.touchAction; },
        onStart: (item, from) => latest.current.onStart?.(item, from),
        onMove: (item, to) => latest.current.onMove?.(item, to),
        onSort: (event) => latest.current.onSort?.(event),
        onEnd: (item, cancelled) => latest.current.onEnd?.(item, cancelled),
      });
    },
    [latest],
  );
}
