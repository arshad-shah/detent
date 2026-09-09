import { CLASS } from '../core/constants';
import * as flip from '../core/flip';
import type { Handle } from '../core/types';
import { announce } from './live-region';
import { placeAt } from './place';
import type { Instance } from './registry';
import type { SortEvent, SortLocation } from './types';

export interface KeyboardDeps {
  animation: number;
  isDisabled(): boolean;
  /** Return false to refuse the lift, exactly as on the pointer path. */
  onStart?(item: HTMLElement, from: SortLocation): void | boolean;
  onMove?(item: HTMLElement, to: SortLocation): void;
  onSort?(event: SortEvent): void;
  onEnd?(item: HTMLElement, cancelled: boolean): void;
}

/**
 * Reordering with the keyboard: space to lift, arrows to move, space to drop,
 * escape to cancel. Each step is announced.
 *
 * `event.target` is correct even inside a shadow root: retargeting only
 * applies to listeners outside the boundary, and this one is bound to the
 * container, which sits in the same tree as the items.
 */
export function bindKeyboard(instance: Instance, deps: KeyboardDeps): Handle {
  const { container } = instance;
  let lifted: HTMLElement | null = null;
  let liftedFrom = 0;

  function onKeyDown(event: KeyboardEvent) {
    if (deps.isDisabled()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const list = instance.items();
    const current = lifted ?? list.find((node) => node === target || node.contains(target)) ?? null;
    if (!current) return;

    const index = list.indexOf(current);

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (lifted) {
        const to = list.indexOf(lifted);
        lifted.classList.remove(CLASS.sorting);
        announce(`Dropped at position ${to + 1} of ${list.length}.`);
        if (to !== liftedFrom) {
          deps.onSort?.({
            item: lifted,
            from: { container, index: liftedFrom },
            to: { container, index: to },
          });
        }
        deps.onEnd?.(lifted, false);
        lifted = null;
      } else {
        if (deps.onStart?.(current, { container, index }) === false) return;
        lifted = current;
        liftedFrom = index;
        current.classList.add(CLASS.sorting);
        announce(
          `Lifted from position ${index + 1} of ${list.length}. Use the arrow keys to move.`,
        );
      }
      return;
    }

    if (event.key === 'Escape' && lifted) {
      event.preventDefault();
      const siblings = list.filter((node) => node !== lifted);
      const snapshot = flip.record(list);
      placeAt(container, lifted, siblings, liftedFrom);
      flip.play(snapshot, deps.animation);
      lifted.classList.remove(CLASS.sorting);
      announce('Move cancelled.');
      deps.onEnd?.(lifted, true);
      lifted = null;
      return;
    }

    if (!lifted) return;
    const step =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!step) return;

    event.preventDefault();
    const next = Math.max(0, Math.min(list.length - 1, index + step));
    if (next === index) return;

    const siblings = list.filter((node) => node !== lifted);
    const snapshot = flip.record(list);
    placeAt(container, lifted, siblings, next);
    flip.play(snapshot, deps.animation);
    lifted.focus?.();
    deps.onMove?.(lifted, { container, index: next });
    announce(`Position ${next + 1} of ${list.length}.`);
  }

  container.addEventListener('keydown', onKeyDown);

  return {
    destroy() {
      container.removeEventListener('keydown', onKeyDown);
      lifted?.classList.remove(CLASS.sorting);
      lifted = null;
    },
  };
}
