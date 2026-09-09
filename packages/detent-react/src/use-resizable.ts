import { useCallback, useRef } from 'react';
import { resizable, type ResizableHandle, type ResizableOptions } from '@arshad-shah/detent';
import { useLatest } from './latest';

/**
 * Bind `resizable` to whatever element the returned ref is attached to.
 *
 * As with useDraggable, options are read at call time so re-rendering never
 * re-binds and callbacks are always the newest ones.
 */
export function useResizable(options: ResizableOptions = {}) {
  const latest = useLatest(options);
  const handle = useRef<ResizableHandle | null>(null);

  return useCallback(
    (node: HTMLElement | null) => {
      handle.current?.destroy();
      handle.current = null;
      if (!node) return;

      handle.current = resizable(node, {
        // Read once, when the handle elements are created, so it is passed by
        // value rather than through a getter.
        handles: latest.current.handles,
        get minWidth() { return latest.current.minWidth; },
        get minHeight() { return latest.current.minHeight; },
        get maxWidth() { return latest.current.maxWidth; },
        get maxHeight() { return latest.current.maxHeight; },
        get aspectRatio() { return latest.current.aspectRatio; },
        get grid() { return latest.current.grid; },
        get bounds() { return latest.current.bounds; },
        get disabled() { return latest.current.disabled; },
        get cancel() { return latest.current.cancel; },
        get distance() { return latest.current.distance; },
        get delay() { return latest.current.delay; },
        get tolerance() { return latest.current.tolerance; },
        onStart: (event) => latest.current.onStart?.(event),
        onResize: (event) => latest.current.onResize?.(event),
        onEnd: (event, cancelled) => latest.current.onEnd?.(event, cancelled),
      });
    },
    [latest],
  );
}
