import { DetentDraggable, DetentResizable, DetentSortable } from './elements';

export { DetentDraggable, DetentResizable, DetentSortable } from './elements';
export { DetentElement } from './base';

const ELEMENTS = [
  ['detent-draggable', DetentDraggable],
  ['detent-sortable', DetentSortable],
  ['detent-resizable', DetentResizable],
] as const;

/**
 * Register the custom elements.
 *
 * Explicit rather than a side effect of importing, so the package stays
 * tree-shakeable and two copies of it cannot fight over the same tag names.
 * Re-registering an existing name throws, so each is checked first.
 */
export function defineDetentElements(registry: CustomElementRegistry = customElements): void {
  for (const [name, ctor] of ELEMENTS) {
    if (!registry.get(name)) registry.define(name, ctor);
  }
}
