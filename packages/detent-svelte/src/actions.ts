import {
  draggable as bindDraggable,
  resizable as bindResizable,
  sortable as bindSortable,
  type DraggableOptions,
  type Handle,
  type ResizableOptions,
  type SortableOptions,
} from '@arshad-shah/detent';

/** The contract Svelte expects back from an action. */
export interface Action<Options> {
  update(options: Options): void;
  destroy(): void;
}

/**
 * Wrap a detent entry point as a Svelte action.
 *
 * `update` swaps the options a live binding reads rather than rebinding, so
 * reactive props take effect without interrupting a drag in progress. Every
 * option reaches the core through a proxy that reads whatever `current` is at
 * the time, which is why one wrapper covers all three entry points.
 *
 * The traps beyond `get` are not optional: the core spreads its options in
 * places (`{ ...options }` in sortable), and a spread consults `ownKeys` and
 * `getOwnPropertyDescriptor`. A proxy implementing only `get` looks correct
 * and silently loses every option there.
 */
function toAction<Options extends object>(
  bind: (node: HTMLElement, options: Options) => Handle,
  node: HTMLElement,
  initial: Options,
): Action<Options> {
  let current = initial;

  const live = new Proxy({} as Options, {
    get(_target, key) {
      const value = (current as Record<string | symbol, unknown>)[key];
      if (typeof value !== 'function') return value;
      // Look the function up again at call time, so an update between bind and
      // call reaches the newest one.
      return (...args: unknown[]) => {
        const fresh = (current as Record<string | symbol, unknown>)[key];
        return typeof fresh === 'function'
          ? (fresh as (...a: unknown[]) => unknown)(...args)
          : undefined;
      };
    },
    has(_target, key) {
      return key in (current as object);
    },
    ownKeys() {
      return Reflect.ownKeys(current as object);
    },
    getOwnPropertyDescriptor(_target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(current as object, key);
      // A spread only copies enumerable own properties, and a proxy must
      // report them as configurable or the invariant check throws.
      return descriptor && { ...descriptor, configurable: true };
    },
  });

  const handle = bind(node, live);

  return {
    update(next: Options) {
      current = next;
    },
    destroy() {
      handle.destroy();
    },
  };
}

/** `use:draggable` */
export function draggable(node: HTMLElement, options: DraggableOptions = {}) {
  return toAction(bindDraggable, node, options);
}

/** `use:sortable` */
export function sortable(node: HTMLElement, options: SortableOptions = {}) {
  return toAction(bindSortable, node, options);
}

/** `use:resizable` */
export function resizable(node: HTMLElement, options: ResizableOptions = {}) {
  return toAction(bindResizable, node, options);
}
