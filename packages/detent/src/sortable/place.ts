import { ATTR } from '../core/constants';
import type { Instance } from './registry';

/** The sortable children of a list, in DOM order. */
export function childrenOf(instance: Instance): HTMLElement[] {
  const { container, options } = instance;
  const nodes = options.items
    ? container.querySelectorAll<HTMLElement>(options.items)
    : container.children;
  const out: HTMLElement[] = [];
  for (const node of Array.from(nodes)) {
    if (node instanceof HTMLElement && !node.hasAttribute(ATTR.ignore)) out.push(node);
  }
  return out;
}

/**
 * Put `item` at `index` among `siblings` inside `container`.
 *
 * Returns false when the item is already there, so callers can skip the
 * measure-and-animate work that would follow a real move.
 */
export function placeAt(
  container: HTMLElement,
  item: HTMLElement,
  siblings: HTMLElement[],
  index: number,
): boolean {
  const before = siblings[index] ?? null;
  if (before === item) return false;
  if (!before && item.parentElement === container && item.nextElementSibling === null) return false;
  container.insertBefore(item, before);
  return true;
}
