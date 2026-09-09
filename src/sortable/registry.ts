import type { SortableOptions } from './types';

export interface Instance {
  container: HTMLElement;
  options: SortableOptions;
  items(): HTMLElement[];
}

/**
 * Every live sortable list, keyed off globalThis rather than module scope.
 *
 * Two bundled copies of detent — an ESM app plus a CJS widget, say — would
 * otherwise get one registry each, and `group` transfers between lists owned
 * by different copies would silently do nothing. A well-known symbol makes the
 * copies agree.
 */
const REGISTRY_KEY = Symbol.for('detent.sortable.registry');

type Global = typeof globalThis & { [REGISTRY_KEY]?: Set<Instance> };

function store(): Set<Instance> {
  const g = globalThis as Global;
  return (g[REGISTRY_KEY] ??= new Set<Instance>());
}

export function registerList(instance: Instance): void {
  store().add(instance);
}

export function unregisterList(instance: Instance): void {
  store().delete(instance);
}

export function eachList(): Iterable<Instance> {
  return store();
}
