import { useCallback, useRef } from 'react';
import { draggable, type DraggableHandle, type DraggableOptions } from '@arshad-shah/detent';
import { useLatest } from './latest';

/**
 * Bind `draggable` to whatever element the returned ref is attached to.
 *
 * Options are read through a ref at call time, so passing an inline object or
 * arrow callback — which is the normal way to write React — never re-binds and
 * never interrupts a drag in progress. No useCallback or useMemo required.
 *
 * The getters matter: the core reads several options once per drag rather than
 * once at bind time, so a changed `bounds` or `disabled` takes effect on the
 * next drag without rebinding.
 */
export function useDraggable(options: DraggableOptions = {}) {
  const latest = useLatest(options);
  const handle = useRef<DraggableHandle | null>(null);

  return useCallback(
    (node: HTMLElement | null) => {
      handle.current?.destroy();
      handle.current = null;
      if (!node) return;

      handle.current = draggable(node, {
        get axis() { return latest.current.axis; },
        get bounds() { return latest.current.bounds; },
        get grid() { return latest.current.grid; },
        get gridOrigin() { return latest.current.gridOrigin; },
        get disabled() { return latest.current.disabled; },
        get handle() { return latest.current.handle; },
        get cancel() { return latest.current.cancel; },
        get distance() { return latest.current.distance; },
        get delay() { return latest.current.delay; },
        get tolerance() { return latest.current.tolerance; },
        get touchAction() { return latest.current.touchAction; },
        onStart: (event) => latest.current.onStart?.(event),
        onMove: (event) => latest.current.onMove?.(event),
        onEnd: (event, cancelled) => latest.current.onEnd?.(event, cancelled),
      });
    },
    [latest],
  );
}
