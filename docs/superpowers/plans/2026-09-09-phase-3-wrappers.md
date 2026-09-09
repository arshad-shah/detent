# detent Phase 3 — Framework Wrappers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `detent-react`, `detent-svelte` and `detent-elements` — thin, idiomatic bindings that make the core library reachable from the three ecosystems without reimplementing any of it.

**Architecture:** Each wrapper owns lifecycle and reactivity and nothing else. No wrapper measures a box, computes an offset, or touches a pointer event; all of that stays in `detent`. The shared hazard across all three is the same one: options objects and callbacks are recreated on every render or update, and a naive binding tears the drag down and rebuilds it each time. Every wrapper solves that by holding the latest options in a mutable cell that the core reads at call time, so re-rendering never re-binds.

**Tech Stack:** React 19 (works on 18), Svelte 5 (works on 4), plain custom elements. TypeScript 7, Vitest 5 browser mode, Playwright 1.63. All three build with the same esbuild pipeline as the core.

**Spec:** `docs/superpowers/specs/2026-09-09-detent-oss-hardening-design.md` — §4 (framework wrappers).

## Global Constraints

- **Wrappers own lifecycle and reactivity only** — never geometry, never DOM measurement. A wrapper file over ~120 lines is a signal that logic belongs in core.
- **Each wrapper depends on `detent` via `workspace:^`.** No wrapper depends on another wrapper.
- **Peers, not dependencies**: `react >= 18` for `detent-react`, `svelte >= 4` for `detent-svelte`. `detent-elements` has no peers.
- **Re-rendering must never re-bind.** Passing an inline options object or arrow callback is the normal case, not a misuse, and must not restart a drag.
- **Every wrapper is tested in a real browser**, not with a mocked DOM — same three engines as the core.
- **Every wrapper package gets its own size budget**, enforced by the same checker.
- **Unscoped names**: `detent-react`, `detent-svelte`, `detent-elements`. All three confirmed available on npm.
- **`linked` mode is switched on in this phase**, now that there are packages to link.
- Node 24, pnpm 11. Changesets required on every PR touching `packages/**`.

---

## Starting point

Phases 1 and 2 are merged. `main` has `packages/detent` at version `0.1.0`, a
working PR/main CI pipeline, and a release that publishes on merging a Version
Packages PR.

```bash
git checkout main && git pull
git checkout -b phase-3-wrappers
```

**One thing to know before starting.** `detent@0.1.0` is not on npm yet — the
first publish is manual and had not been done when this plan was written. That
does not block this work: wrappers resolve `detent` through `workspace:^`, so
they build and test against the local source regardless. It only means the
wrappers cannot be published until `detent` itself is.

---

## File Structure

| Path | Responsibility |
|---|---|
| `packages/detent-react/src/use-draggable.ts` | `useDraggable` hook. |
| `packages/detent-react/src/use-sortable.ts` | `useSortable` hook. |
| `packages/detent-react/src/use-resizable.ts` | `useResizable` hook. |
| `packages/detent-react/src/latest.ts` | `useLatest` — the one shared primitive that keeps options fresh without re-binding. |
| `packages/detent-react/src/index.ts` | Public exports. |
| `packages/detent-svelte/src/actions.ts` | `draggable`, `sortable`, `resizable` Svelte actions. |
| `packages/detent-svelte/src/index.ts` | Public exports. |
| `packages/detent-elements/src/base.ts` | `DetentElement` — attribute parsing and bind/unbind lifecycle shared by all three elements. |
| `packages/detent-elements/src/elements.ts` | The three custom element classes. |
| `packages/detent-elements/src/index.ts` | `defineDetentElements()` and exports. |
| `packages/*/build.mjs`, `size-budget.json`, `vitest.config.ts`, `tsconfig*.json` | Per package, mirroring `packages/detent`. |
| `packages/*/test/browser/*.test.ts` | Real-browser tests per wrapper. |

Each wrapper is one small package with one job. There is deliberately no shared
`packages/internal-*` utility package: the only thing the three have in common
is a five-line idea expressed differently in each ecosystem, and a shared
package to hold three different implementations of it would cost more than it
saves.

---

## Task 1: Scaffolding shared by all three wrappers

**Files:**
- Create: `scripts/new-package.mjs`
- Modify: `packages/detent/scripts/size-check.mjs` (no change needed — confirm it is package-relative)

**Interfaces:**
- Consumes: the `packages/detent` layout as the template.
- Produces: `node scripts/new-package.mjs <name> <description>` writing a package skeleton — `package.json`, `tsconfig.json`, `tsconfig.test.json`, `build.mjs`, `vitest.config.ts`, `size-budget.json`, `scripts/size-check.mjs`, `README.md`, `LICENSE`.

Three packages need identical scaffolding. Writing it three times by hand is
where drift starts.

- [ ] **Step 1: Write the generator**

```js
// scripts/new-package.mjs
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [name, description] = process.argv.slice(2);
if (!name || !description) {
  console.error('usage: node scripts/new-package.mjs <package-name> <description>');
  process.exit(1);
}

const dir = join('packages', name);
mkdirSync(join(dir, 'src'), { recursive: true });
mkdirSync(join(dir, 'test', 'browser'), { recursive: true });
mkdirSync(join(dir, 'scripts'), { recursive: true });

// The size checker is identical everywhere; copy it rather than reinvent it.
cpSync('packages/detent/scripts/size-check.mjs', join(dir, 'scripts/size-check.mjs'));
cpSync('packages/detent/scripts/size-check.d.mts', join(dir, 'scripts/size-check.d.mts'));
cpSync('LICENSE', join(dir, 'LICENSE'));

const write = (file, contents) => writeFileSync(join(dir, file), contents);

write('package.json', JSON.stringify({
  name,
  version: '0.0.0',
  description,
  type: 'module',
  sideEffects: false,
  license: 'MIT',
  author: 'Arshad Shah',
  homepage: 'https://detent.arshadshah.com',
  repository: {
    type: 'git',
    url: 'git+https://github.com/arshad-shah/detent.git',
    directory: `packages/${name}`,
  },
  bugs: 'https://github.com/arshad-shah/detent/issues',
  main: './dist/index.cjs',
  module: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      require: './dist/index.cjs',
    },
    './package.json': './package.json',
  },
  files: ['dist', 'README.md', 'LICENSE'],
  scripts: {
    build: 'node build.mjs',
    size: 'node scripts/size-check.mjs',
    test: 'pnpm test:browser',
    'test:browser': 'vitest run --project browser',
    typecheck: 'tsc --noEmit && tsc -p tsconfig.test.json',
  },
  dependencies: { detent: 'workspace:^' },
  devDependencies: {
    '@types/node': '^24.13.3',
    '@vitest/browser': '^5.0.0',
    '@vitest/browser-playwright': '^5.0.0',
    esbuild: '^0.28.2',
    playwright: '^1.63.0',
    typescript: '^7.0.2',
    vite: '^7.3.6',
    vitest: '^5.0.0',
  },
}, null, 2) + '\n');

write('tsconfig.json', JSON.stringify({
  comment: 'The shipped package. lib stays at ES2020 to match the build target.',
  compilerOptions: {
    target: 'ES2020',
    module: 'ESNext',
    moduleResolution: 'bundler',
    lib: ['ES2020', 'DOM', 'DOM.Iterable'],
    strict: true,
    declaration: true,
    emitDeclarationOnly: true,
    outDir: 'dist',
    rootDir: 'src',
    skipLibCheck: true,
    verbatimModuleSyntax: true,
    types: [],
  },
  include: ['src'],
}, null, 2) + '\n');

write('tsconfig.test.json', JSON.stringify({
  comment: 'Tests. Modern lib, never emitted.',
  extends: './tsconfig.json',
  compilerOptions: {
    lib: ['ES2023', 'DOM', 'DOM.Iterable'],
    rootDir: '.',
    declaration: false,
    emitDeclarationOnly: false,
    noEmit: true,
    types: ['vite/client', 'node'],
  },
  include: ['src', 'test', 'vitest.config.ts'],
}, null, 2) + '\n');

write('build.mjs', `import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

// detent is a peer of the bundle, not part of it: bundling it would ship two
// copies to anyone who also installs detent directly.
const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  target: 'es2020',
  define: { __DEV__: 'false' },
  external: ['@arshad-shah/detent', 'react', 'react/jsx-runtime', 'svelte'],
};

await build({ ...shared, format: 'esm', outfile: 'dist/index.js' });
await build({ ...shared, format: 'cjs', outfile: 'dist/index.cjs' });

execSync('tsc -p tsconfig.json', {
  stdio: 'inherit',
  env: { ...process.env, PATH: \`\${process.cwd()}/node_modules/.bin:\${process.env.PATH}\` },
});

console.log('\\n  built. run \\\`pnpm size\\\` for the gzip table and budget check.\\n');
`);

write('vitest.config.ts', `import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DEV__: 'true' },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.ts', 'test/browser/**/*.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [
              { browser: 'chromium' },
              { browser: 'firefox' },
              { browser: 'webkit' },
            ],
          },
        },
      },
    ],
  },
});
`);

write('size-budget.json', JSON.stringify({
  comment: 'Gzipped ceilings in bytes. Raise deliberately, and say why in the changeset.',
  budgets: { 'dist/index.js': 2000 },
}, null, 2) + '\n');

write('README.md', `# ${name}\n\n${description}\n\nDocumentation: https://detent.arshadshah.com\n`);

write('src/index.ts', 'export {};\n');

console.log(`created packages/${name}`);
```

- [ ] **Step 2: Add a `__DEV__` declaration the wrappers can share**

Each wrapper's `src` needs the same global declaration the core has. The
generator writes `src/index.ts`; add the declaration alongside it:

```bash
node -e '
const fs = require("node:fs");
fs.writeFileSync(
  "packages/detent/src/globals.d.ts",
  fs.readFileSync("packages/detent/src/globals.d.ts", "utf8"),
);
'
```

That is a no-op guard — the file already exists in the core. Instead, have the
generator write it. Append to `scripts/new-package.mjs` before the final
`console.log`:

```js
write('src/globals.d.ts', `/** Replaced with a literal by the bundler. \`false\` in production builds. */
declare const __DEV__: boolean;
`);
```

- [ ] **Step 3: Verify the generator produces a package that builds**

```bash
node scripts/new-package.mjs detent-probe "Throwaway, verifying the generator."
pnpm install
pnpm -F detent-probe build
pnpm -F detent-probe typecheck
```

Expected: builds, emits `dist/index.d.ts`, typechecks. Then remove it:

```bash
rm -rf packages/detent-probe && pnpm install
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "build: add a package generator for the wrappers

Three wrappers need identical scaffolding — build, tsconfigs, vitest
config, size budget and checker. Writing it three times by hand is where
drift starts."
```

---

## Task 2: `detent-react`

**Files:**
- Create: `packages/detent-react/` via the generator, then `src/latest.ts`, `src/use-draggable.ts`, `src/use-sortable.ts`, `src/use-resizable.ts`, `src/index.ts`
- Test: `packages/detent-react/test/browser/hooks.test.tsx`

**Interfaces:**
- Consumes: `draggable`, `sortable`, `resizable` and their option types from `detent`.
- Produces:
  - `useLatest<T>(value: T): { readonly current: T }`
  - `useDraggable(options?: DraggableOptions): (node: HTMLElement | null) => void`
  - `useSortable(options?: SortableOptions): (node: HTMLElement | null) => void`
  - `useResizable(options?: ResizableOptions): (node: HTMLElement | null) => void`

Each hook returns a **callback ref**, so usage is `<div ref={useDraggable()} />`.

- [ ] **Step 1: Generate the package and add React**

```bash
node scripts/new-package.mjs detent-react "React bindings for detent — drag, reorder and resize."
```

Then add the peer and dev dependencies to `packages/detent-react/package.json`:

```json
"peerDependencies": {
  "react": ">=18"
},
"devDependencies": {
  "@types/node": "^24.13.3",
  "@types/react": "^19.2.0",
  "@types/react-dom": "^19.2.0",
  "@vitest/browser": "^5.0.0",
  "@vitest/browser-playwright": "^5.0.0",
  "esbuild": "^0.28.2",
  "playwright": "^1.63.0",
  "react": "^19.2.8",
  "react-dom": "^19.2.8",
  "typescript": "^7.0.2",
  "vite": "^7.3.6",
  "vitest": "^5.0.0"
}
```

Add JSX support to both tsconfigs in that package:

```bash
node -e '
const fs = require("node:fs");
for (const f of ["packages/detent-react/tsconfig.json", "packages/detent-react/tsconfig.test.json"]) {
  const t = JSON.parse(fs.readFileSync(f, "utf8"));
  t.compilerOptions.jsx = "react-jsx";
  fs.writeFileSync(f, JSON.stringify(t, null, 2) + "\n");
}
'
pnpm add -D -F detent-react @vitejs/plugin-react@^5.0.0
```

Register the React plugin in `packages/detent-react/vitest.config.ts` by adding
`plugins: [react()]` to the exported config and importing
`react from '@vitejs/plugin-react'`.

- [ ] **Step 2: Write the failing test**

This is the test that matters. Two of these five assertions are the entire
reason the wrapper is not a three-line `useEffect`.

```tsx
// packages/detent-react/test/browser/hooks.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { useDraggable, useSortable } from '../../src/index';

let container: HTMLElement;
let root: Root;

function render(ui: React.ReactNode) {
  act(() => {
    root.render(<StrictMode>{ui}</StrictMode>);
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  container = document.getElementById('root')!;
  root = createRoot(container);
});

const base = {
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
  button: 0,
  bubbles: true,
  cancelable: true,
};

function drag(el: HTMLElement, from: [number, number], to: [number, number]) {
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: from[0], clientY: from[1] }));
  window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: to[0], clientY: to[1] }));
  window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: to[0], clientY: to[1] }));
}

describe('useDraggable', () => {
  it('moves the element it is attached to', async () => {
    function Box() {
      const ref = useDraggable({ distance: 0 });
      return <div ref={ref} data-testid="box" style={{ width: 100, height: 100 }} />;
    }
    render(<Box />);
    const box = container.querySelector<HTMLElement>('[data-testid="box"]')!;

    drag(box, [10, 10], [60, 30]);
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    expect(box.style.transform).toBe('translate3d(50px, 20px, 0)');
  });

  it('survives a re-render with a fresh inline options object', async () => {
    // The whole point of the wrapper. A naive useEffect with `options` in its
    // dependency array destroys and rebinds on every render, which cancels an
    // in-flight drag.
    let setCount!: (n: number) => void;
    function Box() {
      const [count, set] = useState(0);
      setCount = set;
      const ref = useDraggable({ distance: 0, onMove: () => {} });
      return <div ref={ref} data-testid="box" data-count={count} style={{ width: 100, height: 100 }} />;
    }
    render(<Box />);
    const box = container.querySelector<HTMLElement>('[data-testid="box"]')!;

    box.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: 10, clientY: 10 }));
    act(() => setCount(1));
    window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: 60, clientY: 10 }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: 60, clientY: 10 }));
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    expect(box.dataset.count).toBe('1');
    expect(box.style.transform).toBe('translate3d(50px, 0px, 0)');
  });

  it('calls the newest callback, not the one captured at bind time', () => {
    const first = vi.fn();
    const second = vi.fn();
    let setHandler!: (fn: () => void) => void;

    function Box() {
      const [handler, set] = useState(() => first);
      setHandler = set as (fn: () => void) => void;
      const ref = useDraggable({ distance: 0, onEnd: handler });
      return <div ref={ref} data-testid="box" style={{ width: 100, height: 100 }} />;
    }
    render(<Box />);
    const box = container.querySelector<HTMLElement>('[data-testid="box"]')!;

    act(() => setHandler(() => second));
    drag(box, [10, 10], [60, 10]);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unbinds when the element unmounts', () => {
    function Box({ show }: { show: boolean }) {
      const ref = useDraggable({ distance: 0 });
      return show ? <div ref={ref} data-testid="box" style={{ width: 100, height: 100 }} /> : null;
    }
    render(<Box show />);
    const box = container.querySelector<HTMLElement>('[data-testid="box"]')!;
    render(<Box show={false} />);

    // Touch-action is set on bind and restored on destroy.
    expect(box.style.touchAction).toBe('');
  });
});

describe('useSortable', () => {
  it('reorders a list', async () => {
    function List() {
      const ref = useSortable({ distance: 0, animation: 0, keyboard: false });
      return (
        <ul ref={ref} style={{ margin: 0, padding: 0, listStyle: 'none', width: 200 }}>
          {['a', 'b', 'c'].map((id) => (
            <li key={id} data-id={id} style={{ height: 50 }} />
          ))}
        </ul>
      );
    }
    render(<List />);
    const list = container.querySelector('ul')!;
    const first = list.children[0] as HTMLElement;
    const box = first.getBoundingClientRect();

    drag(first, [box.left + 10, box.top + 25], [box.left + 10, box.top + 130]);
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    expect(Array.from(list.children).map((c) => (c as HTMLElement).dataset.id)).toEqual([
      'b', 'c', 'a',
    ]);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm -F detent-react test:browser`
Expected: FAIL — `useDraggable` is not exported.

- [ ] **Step 4: Write `useLatest`**

```ts
// packages/detent-react/src/latest.ts
import { useRef } from 'react';

/**
 * Hold the most recent value in a ref, updated during render.
 *
 * This is what lets a binding read fresh options and callbacks without being
 * torn down and rebuilt. Assigning during render rather than in an effect
 * matters: an event can fire between render and effect flush, and the ref must
 * already be current by then.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
```

- [ ] **Step 5: Write the three hooks**

```ts
// packages/detent-react/src/use-draggable.ts
import { useCallback, useRef } from 'react';
import { draggable, type DraggableHandle, type DraggableOptions } from '@arshad-shah/detent';
import { useLatest } from './latest';

/**
 * Bind `draggable` to whatever element the returned ref is attached to.
 *
 * Options are read through a ref at call time, so passing an inline object or
 * arrow callback — which is the normal way to write React — never re-binds and
 * never interrupts a drag in progress.
 */
export function useDraggable(options: DraggableOptions = {}) {
  const latest = useLatest(options);
  const handle = useRef<DraggableHandle | null>(null);

  return useCallback((node: HTMLElement | null) => {
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
  }, [latest]);
}
```

The getters are deliberate. The core reads several options once per drag rather
than once at bind time, so a getter makes a changed `bounds` or `disabled` take
effect on the next drag without re-binding. Callbacks are wrapped rather than
passed through for the same reason.

`use-sortable.ts` and `use-resizable.ts` follow exactly the same shape:

```ts
// packages/detent-react/src/use-sortable.ts
import { useCallback, useRef } from 'react';
import { sortable, type SortableOptions } from '@arshad-shah/detent';
import type { Handle } from '@arshad-shah/detent';
import { useLatest } from './latest';

/** Bind `sortable` to whatever element the returned ref is attached to. */
export function useSortable(options: SortableOptions = {}) {
  const latest = useLatest(options);
  const handle = useRef<Handle | null>(null);

  return useCallback((node: HTMLElement | null) => {
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
  }, [latest]);
}
```

```ts
// packages/detent-react/src/use-resizable.ts
import { useCallback, useRef } from 'react';
import { resizable, type ResizableHandle, type ResizableOptions } from '@arshad-shah/detent';
import { useLatest } from './latest';

/** Bind `resizable` to whatever element the returned ref is attached to. */
export function useResizable(options: ResizableOptions = {}) {
  const latest = useLatest(options);
  const handle = useRef<ResizableHandle | null>(null);

  return useCallback((node: HTMLElement | null) => {
    handle.current?.destroy();
    handle.current = null;
    if (!node) return;

    handle.current = resizable(node, {
      // `handles` is read once, when the handle elements are created, so it
      // is passed by value rather than through a getter.
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
  }, [latest]);
}
```

```ts
// packages/detent-react/src/index.ts
export { useDraggable } from './use-draggable';
export { useSortable } from './use-sortable';
export { useResizable } from './use-resizable';
export { useLatest } from './latest';

export type {
  DraggableOptions,
  SortableOptions,
  ResizableOptions,
  DragEvent,
  SortEvent,
  SortLocation,
  ResizeEvent,
} from '@arshad-shah/detent';
```

- [ ] **Step 6: Run the tests**

Run: `pnpm -F detent-react test:browser`
Expected: PASS, 5 tests × 3 engines.

If the re-render test fails, the binding is being torn down on render — check
that the callback ref's dependency array contains only `latest`, which is
stable.

- [ ] **Step 7: Build, size, typecheck, changeset**

```bash
pnpm -F detent-react build
pnpm -F detent-react size
pnpm -F detent-react typecheck
```

If the size budget of 2000 bytes is wrong for this package, set it to the
measured value rounded up to the next 100 and note it in the changeset.

```bash
pnpm changeset
```

Select `detent-react`, `minor`, and describe the package.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add detent-react

Callback-ref hooks for the three entry points. Options are read through
a ref at call time, so an inline options object or arrow callback — the
normal way to write React — never re-binds and never interrupts a drag
in progress. Tested for exactly that, in three real browsers."
```

---

## Task 3: `detent-svelte`

**Files:**
- Create: `packages/detent-svelte/` via the generator, then `src/actions.ts`, `src/index.ts`
- Test: `packages/detent-svelte/test/browser/actions.test.ts`

**Interfaces:**
- Consumes: `draggable`, `sortable`, `resizable` from `detent`.
- Produces: `draggable`, `sortable`, `resizable` as Svelte actions, each
  `(node: HTMLElement, options?: Options) => { update(next: Options): void; destroy(): void }`.

Svelte actions are plain functions with an `update`/`destroy` contract, so this
package needs no Svelte compiler and no `.svelte` files — only the peer type.

- [ ] **Step 1: Generate the package**

```bash
node scripts/new-package.mjs detent-svelte "Svelte actions for detent — drag, reorder and resize."
```

Add to `packages/detent-svelte/package.json`:

```json
"peerDependencies": {
  "svelte": ">=4"
},
```

and `"svelte": "^5.57.0"` to its `devDependencies`.

- [ ] **Step 2: Write the failing test**

```ts
// packages/detent-svelte/test/browser/actions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { draggable, sortable } from '../../src/index';

const base = {
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
  button: 0,
  bubbles: true,
  cancelable: true,
};

function drag(el: HTMLElement, from: [number, number], to: [number, number]) {
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: from[0], clientY: from[1] }));
  window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: to[0], clientY: to[1] }));
  window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: to[0], clientY: to[1] }));
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

describe('draggable action', () => {
  let node: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    node = document.createElement('div');
    node.style.cssText = 'width:100px;height:100px';
    document.body.appendChild(node);
  });

  it('moves the node', async () => {
    draggable(node, { distance: 0 });
    drag(node, [10, 10], [60, 30]);
    await frame();
    expect(node.style.transform).toBe('translate3d(50px, 20px, 0)');
  });

  it('applies updated options without rebinding', async () => {
    const action = draggable(node, { distance: 0, axis: 'both' });
    action.update({ distance: 0, axis: 'x' });

    drag(node, [10, 10], [60, 40]);
    await frame();

    // Locked to x, so the y movement is dropped.
    expect(node.style.transform).toBe('translate3d(50px, 0px, 0)');
  });

  it('calls the newest callback after an update', () => {
    const first = vi.fn();
    const second = vi.fn();
    const action = draggable(node, { distance: 0, onEnd: first });
    action.update({ distance: 0, onEnd: second });

    drag(node, [10, 10], [60, 10]);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unbinds on destroy', () => {
    const action = draggable(node, { distance: 0 });
    action.destroy();
    drag(node, [10, 10], [60, 10]);
    expect(node.style.transform).toBe('');
  });
});

describe('sortable action', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reorders a list', async () => {
    const list = document.createElement('ul');
    list.style.cssText = 'margin:0;padding:0;list-style:none;width:200px';
    for (const id of ['a', 'b', 'c']) {
      const li = document.createElement('li');
      li.dataset.id = id;
      li.style.cssText = 'height:50px';
      list.appendChild(li);
    }
    document.body.appendChild(list);
    sortable(list, { distance: 0, animation: 0, keyboard: false });

    const first = list.children[0] as HTMLElement;
    const box = first.getBoundingClientRect();
    drag(first, [box.left + 10, box.top + 25], [box.left + 10, box.top + 130]);
    await frame();

    expect(Array.from(list.children).map((c) => (c as HTMLElement).dataset.id)).toEqual([
      'b', 'c', 'a',
    ]);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm -F detent-svelte test:browser`
Expected: FAIL — `draggable` is not exported.

- [ ] **Step 4: Write the actions**

```ts
// packages/detent-svelte/src/actions.ts
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
 * option reaches the core through a proxy that reads the current object, which
 * is why one generic wrapper covers all three entry points.
 */
function toAction<Options extends object>(
  bind: (node: HTMLElement, options: Options) => Handle,
  node: HTMLElement,
  initial: Options,
): Action<Options> {
  let current = initial;

  // Reads and calls always hit whatever `current` is at the time, so an
  // update is visible to the core immediately and without a rebind.
  const live = new Proxy({} as Options, {
    get(_target, key) {
      const value = (current as Record<string | symbol, unknown>)[key];
      if (typeof value !== 'function') return value;
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
```

The proxy is doing the same job as React's `useLatest` ref, expressed the way
Svelte's contract wants it. `ownKeys` and `getOwnPropertyDescriptor` are needed
because the core spreads options in places (`{ ...options }` in `sortable`), and
a proxy that only implements `get` breaks under a spread.

```ts
// packages/detent-svelte/src/index.ts
export { draggable, sortable, resizable, type Action } from './actions';

export type {
  DraggableOptions,
  SortableOptions,
  ResizableOptions,
  DragEvent,
  SortEvent,
  SortLocation,
  ResizeEvent,
} from '@arshad-shah/detent';
```

- [ ] **Step 5: Run the tests**

Run: `pnpm -F detent-svelte test:browser`
Expected: PASS, 5 tests × 3 engines.

The spread case is the one most likely to fail: `sortable` in the core does
`bindPointer(container, { ...options, ... })`. If the reorder test fails while
the draggable tests pass, the proxy's `ownKeys` or
`getOwnPropertyDescriptor` trap is wrong.

- [ ] **Step 6: Build, size, typecheck, changeset, commit**

```bash
pnpm -F detent-svelte build && pnpm -F detent-svelte size && pnpm -F detent-svelte typecheck
pnpm changeset   # detent-svelte, minor
git add -A
git commit -m "feat: add detent-svelte

Actions for the three entry points. update() swaps the options a live
binding reads rather than rebinding, so reactive props take effect
without interrupting a drag. No .svelte files and no Svelte compiler —
actions are plain functions, so svelte is a type-only peer."
```

---

## Task 4: `detent-elements`

**Files:**
- Create: `packages/detent-elements/` via the generator, then `src/base.ts`, `src/elements.ts`, `src/index.ts`
- Test: `packages/detent-elements/test/browser/elements.test.ts`

**Interfaces:**
- Consumes: `draggable`, `sortable`, `resizable` from `detent`.
- Produces: `defineDetentElements(registry?: CustomElementRegistry): void`, and the classes `DetentDraggable`, `DetentSortable`, `DetentResizable`.

Registration is an explicit call rather than an import side effect, so the
package is tree-shakeable and cannot double-register when two copies load.

- [ ] **Step 1: Generate the package**

```bash
node scripts/new-package.mjs detent-elements "Custom elements for detent — drag, reorder and resize in any framework."
```

No peer dependencies. This is the supported path for Angular, Vue, Astro and
plain HTML.

- [ ] **Step 2: Write the failing test**

```ts
// packages/detent-elements/test/browser/elements.test.ts
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { defineDetentElements } from '../../src/index';

const base = {
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
  button: 0,
  bubbles: true,
  cancelable: true,
};

function drag(el: HTMLElement, from: [number, number], to: [number, number]) {
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: from[0], clientY: from[1] }));
  window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: to[0], clientY: to[1] }));
  window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: to[0], clientY: to[1] }));
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

beforeAll(() => {
  defineDetentElements();
});

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('defineDetentElements', () => {
  it('is safe to call twice', () => {
    expect(() => defineDetentElements()).not.toThrow();
  });

  it('registers the three elements', () => {
    expect(customElements.get('detent-draggable')).toBeTypeOf('function');
    expect(customElements.get('detent-sortable')).toBeTypeOf('function');
    expect(customElements.get('detent-resizable')).toBeTypeOf('function');
  });
});

describe('<detent-draggable>', () => {
  it('drags its own element', async () => {
    document.body.innerHTML =
      '<detent-draggable distance="0" style="display:block;width:100px;height:100px"></detent-draggable>';
    const el = document.querySelector<HTMLElement>('detent-draggable')!;

    drag(el, [10, 10], [60, 30]);
    await frame();

    expect(el.style.transform).toBe('translate3d(50px, 20px, 0)');
  });

  it('reads options from attributes', async () => {
    document.body.innerHTML =
      '<detent-draggable distance="0" axis="x" style="display:block;width:100px;height:100px"></detent-draggable>';
    const el = document.querySelector<HTMLElement>('detent-draggable')!;

    drag(el, [10, 10], [60, 40]);
    await frame();

    expect(el.style.transform).toBe('translate3d(50px, 0px, 0)');
  });

  it('applies an attribute change without a reload', async () => {
    document.body.innerHTML =
      '<detent-draggable distance="0" style="display:block;width:100px;height:100px"></detent-draggable>';
    const el = document.querySelector<HTMLElement>('detent-draggable')!;
    el.setAttribute('axis', 'y');

    drag(el, [10, 10], [60, 40]);
    await frame();

    expect(el.style.transform).toBe('translate3d(0px, 30px, 0)');
  });

  it('unbinds when removed from the document', () => {
    document.body.innerHTML =
      '<detent-draggable distance="0" style="display:block;width:100px;height:100px"></detent-draggable>';
    const el = document.querySelector<HTMLElement>('detent-draggable')!;
    el.remove();
    drag(el, [10, 10], [60, 10]);
    expect(el.style.transform).toBe('');
  });
});

describe('<detent-sortable>', () => {
  it('reorders its children and emits detent:sort', async () => {
    document.body.innerHTML = `
      <detent-sortable distance="0" animation="0" keyboard="false"
        style="display:block;width:200px">
        <div data-id="a" style="height:50px"></div>
        <div data-id="b" style="height:50px"></div>
        <div data-id="c" style="height:50px"></div>
      </detent-sortable>`;
    const el = document.querySelector<HTMLElement>('detent-sortable')!;

    const events: CustomEvent[] = [];
    el.addEventListener('detent:sort', (e) => events.push(e as CustomEvent));

    const first = el.children[0] as HTMLElement;
    const box = first.getBoundingClientRect();
    drag(first, [box.left + 10, box.top + 25], [box.left + 10, box.top + 130]);
    await frame();

    expect(Array.from(el.children).map((c) => (c as HTMLElement).dataset.id)).toEqual([
      'b', 'c', 'a',
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].detail.to.index).toBe(2);
  });

  it('keeps its children in the light DOM so host styles apply', () => {
    document.body.innerHTML =
      '<detent-sortable><div data-id="a"></div></detent-sortable>';
    const el = document.querySelector<HTMLElement>('detent-sortable')!;
    expect(el.shadowRoot).toBeNull();
    expect(el.querySelector('[data-id="a"]')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm -F detent-elements test:browser`
Expected: FAIL — `defineDetentElements` is not exported.

- [ ] **Step 4: Write the base class**

```ts
// packages/detent-elements/src/base.ts
import type { Handle } from '@arshad-shah/detent';

/**
 * Shared lifecycle for the custom elements.
 *
 * Attributes are the only configuration surface, so everything arrives as a
 * string and has to be coerced. An unparseable value is left undefined rather
 * than guessed at, so the core's own default applies.
 */
export abstract class DetentElement extends HTMLElement {
  protected handle: Handle | null = null;

  /** Bind the core to this element. Called on connect and on any attribute change. */
  protected abstract bind(): Handle;

  connectedCallback(): void {
    this.rebind();
  }

  disconnectedCallback(): void {
    this.handle?.destroy();
    this.handle = null;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.rebind();
  }

  private rebind(): void {
    this.handle?.destroy();
    this.handle = this.bind();
  }

  /** A number attribute, or undefined when absent or unparseable. */
  protected num(name: string): number | undefined {
    const raw = this.getAttribute(name);
    if (raw === null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  /**
   * A boolean attribute.
   *
   * Present-but-empty means true, the HTML way. `="false"` means false, which
   * is not the HTML way but is what everyone writes when a default is true.
   */
  protected bool(name: string): boolean | undefined {
    if (!this.hasAttribute(name)) return undefined;
    const raw = this.getAttribute(name);
    return raw === '' || raw === 'true' ? true : raw === 'false' ? false : undefined;
  }

  /** A string attribute, or undefined when absent. */
  protected str(name: string): string | undefined {
    return this.getAttribute(name) ?? undefined;
  }

  /** A one-of attribute, or undefined when absent or not in the list. */
  protected oneOf<T extends string>(name: string, allowed: readonly T[]): T | undefined {
    const raw = this.getAttribute(name);
    return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
  }

  /** Emit a cancelable-free CustomEvent that composes out of a shadow root. */
  protected emit(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}
```

- [ ] **Step 5: Write the elements**

```ts
// packages/detent-elements/src/elements.ts
import { draggable, resizable, sortable, type HandleName } from '@arshad-shah/detent';
import { DetentElement } from './base';

const AXES = ['x', 'y', 'both'] as const;
const DIRECTIONS = ['auto', 'x', 'y', 'grid'] as const;
const HANDLES: readonly HandleName[] = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];

/** `<detent-draggable>` — drags itself. */
export class DetentDraggable extends DetentElement {
  static observedAttributes = ['axis', 'bounds', 'grid', 'handle', 'cancel', 'distance', 'disabled'];

  protected bind() {
    return draggable(this, {
      axis: this.oneOf('axis', AXES),
      bounds: this.str('bounds') === 'parent' ? 'parent' : this.str('bounds') === 'window' ? 'window' : undefined,
      grid: this.num('grid'),
      handle: this.str('handle'),
      cancel: this.str('cancel'),
      distance: this.num('distance'),
      disabled: this.bool('disabled'),
      onStart: (event) => this.emit('detent:dragstart', event),
      onMove: (event) => this.emit('detent:drag', event),
      onEnd: (event, cancelled) => this.emit('detent:dragend', { ...event, cancelled }),
    });
  }
}

/** `<detent-sortable>` — reorders its own children. */
export class DetentSortable extends DetentElement {
  static observedAttributes = [
    'group', 'items', 'direction', 'animation', 'keyboard', 'distance', 'disabled', 'z-index',
  ];

  protected bind() {
    return sortable(this, {
      group: this.str('group'),
      items: this.str('items'),
      direction: this.oneOf('direction', DIRECTIONS),
      animation: this.num('animation'),
      keyboard: this.bool('keyboard'),
      distance: this.num('distance'),
      disabled: this.bool('disabled'),
      zIndex: this.num('z-index'),
      onSort: (event) => this.emit('detent:sort', event),
      onEnd: (item, cancelled) => this.emit('detent:sortend', { item, cancelled }),
    });
  }
}

/** `<detent-resizable>` — resizes itself. */
export class DetentResizable extends DetentElement {
  static observedAttributes = [
    'handles', 'min-width', 'min-height', 'max-width', 'max-height',
    'aspect-ratio', 'grid', 'distance', 'disabled',
  ];

  protected bind() {
    const named = this.str('handles')
      ?.split(/[\s,]+/)
      .filter((name): name is HandleName => (HANDLES as readonly string[]).includes(name));

    return resizable(this, {
      handles: named?.length ? named : undefined,
      minWidth: this.num('min-width'),
      minHeight: this.num('min-height'),
      maxWidth: this.num('max-width'),
      maxHeight: this.num('max-height'),
      aspectRatio: this.num('aspect-ratio') ?? this.bool('aspect-ratio'),
      grid: this.num('grid'),
      distance: this.num('distance'),
      disabled: this.bool('disabled'),
      onStart: (event) => this.emit('detent:resizestart', event),
      onResize: (event) => this.emit('detent:resize', event),
      onEnd: (event, cancelled) => this.emit('detent:resizeend', { ...event, cancelled }),
    });
  }
}
```

```ts
// packages/detent-elements/src/index.ts
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
```

- [ ] **Step 6: Run the tests**

Run: `pnpm -F detent-elements test:browser`
Expected: PASS, 8 tests × 3 engines.

`<detent-draggable>` needs `display: block` to have a box at all — custom
elements are `display: inline` by default. The tests set it explicitly; the
README must say so too.

- [ ] **Step 7: Build, size, typecheck, changeset, commit**

```bash
pnpm -F detent-elements build && pnpm -F detent-elements size && pnpm -F detent-elements typecheck
pnpm changeset   # detent-elements, minor
git add -A
git commit -m "feat: add detent-elements

Custom elements for the three entry points, light DOM only so host
styling and slotted content behave normally. Registration is an explicit
call rather than an import side effect, so the package is tree-shakeable
and two copies cannot fight over the same tag names.

No peer dependencies — this is the supported path for Angular, Vue,
Astro and plain HTML."
```

---

## Task 5: Wire the wrappers into the workspace

**Files:**
- Modify: `.changeset/config.json`, `.github/workflows/pr.yml`, `.github/workflows/main.yml`, `README.md`, `CONTRIBUTING.md`

**Interfaces:**
- Consumes: the three packages.
- Produces: CI that installs browsers and runs tests for every package, and Changesets in `linked` mode.

- [ ] **Step 1: Switch on `linked` mode**

Now that there are packages to link, restore what Phase 2 deferred:

```json
"linked": [["@arshad-shah/detent", "@arshad-shah/detent-react", "@arshad-shah/detent-svelte", "@arshad-shah/detent-elements"]],
```

Naming them explicitly rather than globbing avoids the unmatched-glob config
error that made Phase 2 defer this in the first place.

Verify:

```bash
pnpm changeset status --verbose
```

Expected: no config issues, and all four packages listed.

- [ ] **Step 2: Install browsers for every package in CI**

Both workflows currently run `pnpm -F detent exec playwright install`. The
wrappers need browsers too. Replace that step in **both** `pr.yml` and
`main.yml` with:

```yaml
      - name: Install browsers
        run: pnpm exec playwright install --with-deps chromium firefox webkit
```

Run from the root, so one installation serves every package.

- [ ] **Step 3: Confirm the recursive scripts reach the new packages**

```bash
pnpm typecheck && pnpm test && pnpm build && pnpm size
```

Expected: four packages each reporting. `pnpm -r test` runs `test` in every
package that defines it; the wrappers define `test` as `pnpm test:browser`, so
`pnpm test:unit` will report "no script" for them, which is fine — but confirm
`pnpm test:unit` still exits 0 rather than failing the whole run.

If it fails, add `"test:unit": "echo 'no unit tests'"` to each wrapper, or
change the root script to `pnpm -r --if-present test:unit`. Prefer the latter:

```json
"test:unit": "pnpm -r --if-present test:unit",
"test:e2e": "pnpm -r --if-present test:e2e",
```

- [ ] **Step 4: Update the root README's package table**

```markdown
| Package | Version | What it is |
| --- | --- | --- |
| [`detent`](packages/detent) | [![npm](https://img.shields.io/npm/v/detent)](https://www.npmjs.com/package/detent) | The library. Zero dependencies. |
| [`detent-react`](packages/detent-react) | [![npm](https://img.shields.io/npm/v/detent-react)](https://www.npmjs.com/package/detent-react) | Hooks. Peer `react >= 18`. |
| [`detent-svelte`](packages/detent-svelte) | [![npm](https://img.shields.io/npm/v/detent-svelte)](https://www.npmjs.com/package/detent-svelte) | Actions. Peer `svelte >= 4`. |
| [`detent-elements`](packages/detent-elements) | [![npm](https://img.shields.io/npm/v/detent-elements)](https://www.npmjs.com/package/detent-elements) | Custom elements. No peers — use anywhere. |
```

- [ ] **Step 5: Note the per-package publish steps in CONTRIBUTING**

Under "Two manual steps, once per package", add:

```markdown
As of Phase 3 there are four packages: `detent`, `detent-react`,
`detent-svelte` and `detent-elements`. Each needs its own first manual publish
and its own Trusted Publishing registration, all pointing at the same
`main.yml`.
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "build: wire the wrappers into the workspace

Switches on changesets linked mode now that there are packages to link,
naming them explicitly rather than globbing — an unmatched glob is what
made Phase 2 defer this. CI installs browsers once at the root for every
package."
```

---

## Task 6: Write each wrapper's README

**Files:**
- Modify: `packages/detent-react/README.md`, `packages/detent-svelte/README.md`, `packages/detent-elements/README.md`

**Interfaces:**
- Consumes: the finished packages.
- Produces: the npm landing page for each. This is the "easier to get to" requirement in §4 of the spec.

Each README opens with a working example above the fold. Someone should be able
to copy the first block and have it work.

- [ ] **Step 1: `detent-react`**

````markdown
# detent-react

React bindings for [detent](https://www.npmjs.com/package/detent) — drag,
reorder and resize with no dependencies.

```bash
npm install detent detent-react
```

```jsx
import { useSortable } from '@arshad-shah/detent-react';

function List({ items, onReorder }) {
  const ref = useSortable({
    animation: 180,
    onSort: ({ from, to }) => onReorder(from.index, to.index),
  });

  return (
    <ul ref={ref}>
      {items.map((item) => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ul>
  );
}
```

Each hook returns a callback ref. Attach it to the element you want bound.

| Hook | Binds |
| --- | --- |
| `useDraggable(options?)` | `draggable` |
| `useSortable(options?)` | `sortable` |
| `useResizable(options?)` | `resizable` |

Options are the same as the core library's — see
[the documentation](https://detent.arshadshah.com).

## Re-rendering never re-binds

Pass inline objects and arrow functions freely:

```jsx
const ref = useDraggable({
  bounds: 'parent',
  onEnd: (event) => save(event.offset),  // fine, recreated every render
});
```

Options are read through a ref at call time, so a re-render mid-drag does not
interrupt it, and callbacks are always the newest ones. You do not need
`useCallback` or `useMemo` here.

## Styles

```js
import '@arshad-shah/detent/styles.css';
```

Required for resize handles, optional otherwise.

MIT.
````

- [ ] **Step 2: `detent-svelte`**

````markdown
# detent-svelte

Svelte actions for [detent](https://www.npmjs.com/package/detent) — drag,
reorder and resize with no dependencies.

```bash
npm install detent detent-svelte
```

```svelte
<script>
  import { sortable } from '@arshad-shah/detent-svelte';
  import '@arshad-shah/detent/styles.css';

  let items = $state([
    { id: 1, label: 'first' },
    { id: 2, label: 'second' },
  ]);
</script>

<ul use:sortable={{ animation: 180, onSort: handleSort }}>
  {#each items as item (item.id)}
    <li>{item.label}</li>
  {/each}
</ul>
```

| Action | Binds |
| --- | --- |
| `use:draggable` | `draggable` |
| `use:sortable` | `sortable` |
| `use:resizable` | `resizable` |

Options are the same as the core library's — see
[the documentation](https://detent.arshadshah.com).

## Reactive options

Changing the options object updates the live binding rather than rebinding it,
so a drag in progress is never interrupted and callbacks are always current.

Works with Svelte 4 and 5. The actions are plain functions, so there is no
Svelte compiler involved and `svelte` is a type-only peer.

MIT.
````

- [ ] **Step 3: `detent-elements`**

````markdown
# detent-elements

Custom elements for [detent](https://www.npmjs.com/package/detent) — drag,
reorder and resize in any framework, or none.

```bash
npm install detent detent-elements
```

```html
<script type="module">
  import { defineDetentElements } from '@arshad-shah/detent-elements';
  defineDetentElements();
</script>
<link rel="stylesheet" href="node_modules/detent/dist/styles.css">

<detent-sortable animation="180" style="display:block">
  <div>first</div>
  <div>second</div>
  <div>third</div>
</detent-sortable>

<script>
  document.querySelector('detent-sortable')
    .addEventListener('detent:sort', (e) => console.log(e.detail));
</script>
```

No peer dependencies. Works in Angular, Vue, Astro and plain HTML.

| Element | Configures | Emits |
| --- | --- | --- |
| `<detent-draggable>` | `axis`, `bounds`, `grid`, `handle`, `cancel`, `distance`, `disabled` | `detent:dragstart`, `detent:drag`, `detent:dragend` |
| `<detent-sortable>` | `group`, `items`, `direction`, `animation`, `keyboard`, `z-index`, `distance`, `disabled` | `detent:sort`, `detent:sortend` |
| `<detent-resizable>` | `handles`, `min-width`, `min-height`, `max-width`, `max-height`, `aspect-ratio`, `grid`, `distance`, `disabled` | `detent:resizestart`, `detent:resize`, `detent:resizeend` |

Every event carries the core library's event object as `detail`.

## Two things to know

**Give them a `display`.** Custom elements are `display: inline` by default,
which means no box to drag or resize:

```css
detent-draggable, detent-sortable, detent-resizable { display: block; }
```

**Registration is explicit.** `defineDetentElements()` is a call rather than an
import side effect, so the package tree-shakes and two copies cannot fight over
the same tag names. Calling it twice is safe.

MIT.
````

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: readmes for the three wrapper packages

Each opens with an example that works if you copy it, and names the one
thing that will otherwise catch you out — no useCallback needed in
React, reactive options in Svelte, display:block for custom elements."
```

---

## Task 7: Verify the whole workspace on a real pull request

**Files:** none.

**Interfaces:**
- Consumes: everything above.
- Produces: evidence that four packages build, test and gate correctly in CI.

- [ ] **Step 1: Full local run**

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm size
pnpm test:e2e
pnpm changeset status --verbose
```

Expected: all green, and `changeset status` lists all four packages with no
config issues.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin phase-3-wrappers
gh pr create --base main --head phase-3-wrappers \
  --title "Phase 3: React, Svelte and Web Component wrappers" \
  --body "Implements section 4 of the hardening spec. See docs/superpowers/plans/2026-09-09-phase-3-wrappers.md"
```

- [ ] **Step 3: Watch the checks**

```bash
gh pr checks --watch
```

Expected: `verify` and `changeset` both pass. The `verify` job now runs browser
tests for four packages, so expect it to take noticeably longer than the ~1m30s
Phase 2 established.

- [ ] **Step 4: Report**

Report to your human partner: the check results, the measured size of each
wrapper against its budget, and the fact that the wrappers cannot be published
until `detent` itself has had its first manual publish.

---

## Self-Review

**Spec coverage.** §4 React → Task 2 (hooks; the spec's `<Sortable>` component
is deliberately **not** built — see below). §4 Svelte → Task 3. §4 Web
Components → Task 4, including the spec's explicit
`defineDetentElements()`-rather-than-side-effect requirement and light-DOM-only
rendering. §4 discoverability → Task 6, one README per package with a
copy-pasteable first example. §1 `workspace:^` and `linked` mode → Tasks 1 and 5.

**One spec item deliberately dropped.** §4 describes a `<Sortable>` React
component wrapping `useSortable` for "the controlled-list case". Building it
would mean either owning list rendering — which the spec's own constraint
forbids, since it is not lifecycle or reactivity — or being a thin passthrough
that adds a component boundary and no capability. `useSortable` already covers
the case in four lines, as the README example shows. Raise this with your human
partner if they disagree; it is a scope reduction, not an oversight.

**Type consistency.** `useLatest<T>(value: T): { readonly current: T }` is
defined in Task 2 Step 4 and consumed by all three hooks in Step 5.
`Action<Options>` is defined and consumed in Task 3. `DetentElement` and its
protected helpers (`num`, `bool`, `str`, `oneOf`, `emit`, `bind`) are defined in
Task 4 Step 4 and consumed by all three element classes in Step 5.
`defineDetentElements(registry?)` is defined in Task 4 Step 5 and used in its
own test and in Task 6's README. `HandleName` is imported from `detent`, where
Phase 1 exported it from `resizable/index.ts`.

**Two gaps found and closed while reviewing.** Task 1's generator originally
omitted `src/globals.d.ts`, so every wrapper would have failed to typecheck the
moment it touched `__DEV__`; Step 2 adds it. Task 3's proxy originally
implemented only the `get` trap, which breaks the core's `{ ...options }` spread
in `sortable` — `ownKeys` and `getOwnPropertyDescriptor` are now implemented and
Step 5 names that as the most likely failure.

**Known ordering constraint.** Task 1 must come first; Tasks 2, 3 and 4 are
independent of one another and may be done in any order or in parallel. Task 5
needs all three packages to exist. Task 7 is last.
