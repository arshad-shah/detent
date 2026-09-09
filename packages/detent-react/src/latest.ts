import { useRef } from 'react';

/**
 * Hold the most recent value in a ref, updated during render.
 *
 * This is what lets a binding read fresh options and callbacks without being
 * torn down and rebuilt. Assigning during render rather than in an effect
 * matters: an event can fire between render and effect flush, and the ref has
 * to be current by then.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
