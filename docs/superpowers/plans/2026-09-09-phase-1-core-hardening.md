# detent Phase 1 — Core Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every defect in §2 of the spec, land the CSS isolation strategy from §3, and build the three-tier test infrastructure from §5 — leaving a core whose public API the wrapper packages can safely be built on.

**Architecture:** The library keeps its current shape — a pointer layer feeding three feature entry points through a frame-batched DOM writer. This phase pulls cross-cutting concerns out into named modules (`constants`, `invariant`, `body-state`, `scroll`, `scale`), splits the two oversized feature files into directories, and adds a browser-based test tier that exercises real layout, because the existing suite hand-fakes `getBoundingClientRect` and therefore cannot see the whole class of bugs being fixed.

**Tech Stack:** TypeScript 7.0, Vitest 5.0 (happy-dom + browser mode), Playwright 1.63, esbuild 0.28. Still a single package at the repository root; the monorepo split is Phase 2.

**Spec:** `docs/superpowers/specs/2026-09-09-detent-oss-hardening-design.md`

## Global Constraints

- **Zero runtime dependencies** in the shipped library. Dev dependencies only.
- **No `!important` anywhere**, in any stylesheet or inline style.
- **No literal class name, attribute name, or tunable number** outside `src/core/constants.ts`. This is checked by Task 15's parity test.
- **No `try`/`catch` around consumer callbacks.** The library never swallows a host page's error.
- **All validation is `__DEV__`-gated** and must be fully dead-code-eliminated from production builds. Verified by Task 3.
- **Test-first.** Every task writes a test that fails for the right reason before any implementation.
- **Public API is additive only in this phase**, with one deliberate exception: the `dk-*` class prefix becomes `detent-*` (Task 15). That is a breaking change, released as a major in Phase 2.
- Node 24, pnpm 11.
- Browser tests run on Chromium, WebKit and Firefox.

---

## File Structure

Files created or substantially restructured by this phase.

| Path | Responsibility |
|---|---|
| `src/core/constants.ts` | Every class name, attribute name and tunable default. The single source of truth. |
| `src/core/options.ts` | Normalising user-supplied option shapes (`grid`, activation). Pure. |
| `src/core/invariant.ts` | `__DEV__`-gated precondition checks. Compiled out of production. |
| `src/core/body-state.ts` | Refcounted ownership of `document.body`-level drag state. |
| `src/core/scroll.ts` | The one scroll-ancestor walk, and total scroll accumulation. |
| `src/core/scale.ts` | Effective CSS scale of an element, for transformed ancestors. |
| `src/core/geometry.ts` | Pure box/point maths only. Scroll helpers move out to `scroll.ts`. |
| `src/sortable/index.ts` | The `sortable()` entry point and pointer-driven reordering. |
| `src/sortable/registry.ts` | `globalThis`-backed instance registry, survives duplicate copies. |
| `src/sortable/live-region.ts` | Refcounted screen-reader announcer. |
| `src/sortable/keyboard.ts` | Keyboard reordering, shadow-DOM safe. |
| `src/resizable/index.ts` | The `resizable()` entry point. |
| `src/resizable/handles.ts` | Resolving and creating the eight handles. |
| `test/unit/*.test.ts` | Tier 1 — pure functions, happy-dom. |
| `test/browser/*.test.ts` | Tier 2 — real layout, Vitest browser mode. |
| `e2e/hostile.spec.ts` | Tier 3 — the adversarial host page. |
| `e2e/fixtures/hostile.html` | The adversarial host page itself. |

`src/sortable.ts` (424 lines) and `src/resizable.ts` (229 lines) are deleted, replaced by the directories above. `test/helpers.ts` loses its fake-layout functions in Task 16.

---

## Task 1: Test infrastructure — three tiers

**Files:**
- Create: `vitest.config.ts` (replace), `test/browser/setup.ts`, `test/browser/smoke.test.ts`, `playwright.config.ts`, `src/globals.d.ts`
- Modify: `package.json`, `tsconfig.json`
- Move: `test/*.test.ts` → `test/unit/*.test.ts`, `test/setup.ts` → `test/unit/setup.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm test:unit`, `pnpm test:browser`, `pnpm test:e2e`, `pnpm test`. A `__DEV__: boolean` global declared for TypeScript and defined as `true` in both test environments.

The point of this task is the smoke test in Step 3: it must exercise *real* layout. If it passes while `getBoundingClientRect` is faked, the whole tier is worthless.

- [ ] **Step 1: Install the new toolchain**

```bash
pnpm add -D vitest@^5.0.0 @vitest/browser@^5.0.0 playwright@^1.63.0 \
  @playwright/test@^1.63.0 typescript@^7.0.0 esbuild@^0.28.0 happy-dom@^15.11.7
pnpm exec playwright install --with-deps chromium firefox webkit
```

- [ ] **Step 2: Move existing tests into the unit tier**

```bash
mkdir -p test/unit test/browser e2e/fixtures
git mv test/setup.ts test/unit/setup.ts
for f in draggable geometry pointer resizable resize-math sortable; do
  git mv "test/$f.test.ts" "test/unit/$f.test.ts"
done
git mv test/helpers.ts test/unit/helpers.ts
```

Then fix the now-wrong relative imports — every `'../src/` becomes `'../../src/`:

```bash
sed -i '' "s|'\.\./src/|'../../src/|g" test/unit/*.ts
sed -i '' "s|'\./helpers'|'./helpers'|g" test/unit/*.ts
```

- [ ] **Step 3: Write the browser smoke test**

This is the test that proves the tier is real. `layout()` is never imported here; the browser supplies geometry.

```ts
// test/browser/smoke.test.ts
import { describe, expect, it, beforeEach } from 'vitest';

describe('browser tier', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has a real layout engine', () => {
    const el = document.createElement('div');
    el.style.cssText = 'width:120px;height:40px;position:absolute;left:10px;top:20px';
    document.body.appendChild(el);

    const rect = el.getBoundingClientRect();
    expect(rect.width).toBe(120);
    expect(rect.height).toBe(40);
    expect(rect.left).toBe(10);
    expect(rect.top).toBe(20);
  });

  it('resolves computed styles from a stylesheet', () => {
    const style = document.createElement('style');
    style.textContent = '.probe { position: absolute }';
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.className = 'probe';
    document.body.appendChild(el);

    expect(getComputedStyle(el).position).toBe('absolute');
    style.remove();
  });

  it('supports the Web Animations API', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const animation = el.animate([{ opacity: 0 }, { opacity: 1 }], 50);
    expect(typeof animation.cancel).toBe('function');
  });
});
```

- [ ] **Step 4: Write the Vitest config with both projects**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DEV__: 'true' },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'happy-dom',
          include: ['test/unit/**/*.test.ts'],
          setupFiles: ['test/unit/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: 'playwright',
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
```

- [ ] **Step 5: Declare the `__DEV__` global and widen tsconfig**

```ts
// src/globals.d.ts
/** Replaced with a literal by the bundler. `false` in production builds. */
declare const __DEV__: boolean;
```

In `tsconfig.json`, change `"include": ["src"]` to `"include": ["src", "test", "e2e"]` and add `"vitest/globals"` is *not* needed — tests import explicitly.

- [ ] **Step 6: Add the Playwright config for the e2e tier**

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  webServer: {
    command: 'pnpm exec vite --port 5174 --strictPort',
    port: 5174,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:5174' },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
```

Add `vite` to devDependencies: `pnpm add -D vite@^7.0.0`.

- [ ] **Step 7: Wire up the scripts**

In `package.json`, replace the `test` scripts:

```json
"test": "pnpm test:unit && pnpm test:browser",
"test:unit": "vitest run --project unit",
"test:browser": "vitest run --project browser",
"test:e2e": "playwright test",
"test:watch": "vitest --project unit"
```

- [ ] **Step 8: Run every tier**

Run: `pnpm test:unit`
Expected: PASS — the pre-existing suite, unchanged behaviour, new paths.

Run: `pnpm test:browser`
Expected: PASS on all three engines. If the layout assertions fail, the browser provider is misconfigured — stop and fix it, do not proceed.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "test: add browser and e2e test tiers alongside the unit tier

The existing suite fakes getBoundingClientRect, so it cannot exercise
layout. Adds a Vitest browser-mode project and a Playwright e2e project
so the geometry-dependent fixes that follow have somewhere real to run."
```

---

## Task 2: `core/constants.ts` and `core/options.ts`

**Files:**
- Create: `src/core/constants.ts`, `src/core/options.ts`, `test/unit/options.test.ts`
- Modify: `src/core/pointer.ts:39`, `src/core/autoscroll.ts:24-25`, `src/draggable.ts:46,49-53`, `src/resizable.ts:56,61-65,156-157`, `src/sortable.ts:65,103,271`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CLASS: { dragging, sorting, sortable, resizable, resizing, handle }` and `handleClass(name: HandleName): string`
  - `ATTR: { dragging, handle, ignore, liveRegion }`
  - `DEFAULTS: { distance, delay, tolerance, animation, zIndex, scrollThreshold, scrollSpeed, minSize, handleSize }`
  - `normaliseGrid(grid: number | [number, number] | undefined): [number, number] | null`

- [ ] **Step 1: Write the failing test for `normaliseGrid`**

```ts
// test/unit/options.test.ts
import { describe, expect, it } from 'vitest';
import { normaliseGrid } from '../../src/core/options';

describe('normaliseGrid', () => {
  it('returns null when no grid is given', () => {
    expect(normaliseGrid(undefined)).toBeNull();
  });

  it('treats zero as no grid', () => {
    expect(normaliseGrid(0)).toBeNull();
  });

  it('applies a single number to both axes', () => {
    expect(normaliseGrid(20)).toEqual([20, 20]);
  });

  it('passes a pair through unchanged', () => {
    expect(normaliseGrid([10, 25])).toEqual([10, 25]);
  });

  it('copies the pair rather than aliasing the caller’s array', () => {
    const input: [number, number] = [10, 25];
    const result = normaliseGrid(input);
    input[0] = 999;
    expect(result).toEqual([10, 25]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:unit -- options`
Expected: FAIL — `Failed to resolve import "../../src/core/options"`.

- [ ] **Step 3: Write `constants.ts`**

```ts
// src/core/constants.ts

/** The prefix every class and attribute the library writes begins with. */
export const PREFIX = 'detent';

/** Class names the library adds to host elements. */
export const CLASS = {
  /** On a draggable element, for the duration of a drag. */
  dragging: `${PREFIX}-dragging`,
  /** On a sortable item, while it is being moved by pointer or keyboard. */
  sorting: `${PREFIX}-sorting`,
  /** On a sortable container, for its lifetime. */
  sortable: `${PREFIX}-sortable`,
  /** On a resizable element, for its lifetime. */
  resizable: `${PREFIX}-resizable`,
  /** On a resizable element, for the duration of a resize. */
  resizing: `${PREFIX}-resizing`,
  /** On every handle element the library creates. */
  handle: `${PREFIX}-handle`,
} as const;

/** Attribute names the library reads or writes. */
export const ATTR = {
  /** On `<body>`, while any drag is active. Refcounted. */
  dragging: `data-${PREFIX}-dragging`,
  /** On a handle element, naming its direction. */
  handle: `data-${PREFIX}-handle`,
  /** Read from a list child to exclude it from sorting. */
  ignore: `data-${PREFIX}-ignore`,
  /** On the screen-reader announcer element. */
  liveRegion: `data-${PREFIX}-live-region`,
} as const;

/** The per-direction handle class, e.g. `detent-handle-ne`. */
export function handleClass(name: string): string {
  return `${CLASS.handle}-${name}`;
}

/**
 * Every tunable default in the library.
 *
 * `handleSize` is duplicated as the `--detent-handle-size` custom property in
 * styles.css. A test asserts the two agree, so they cannot drift.
 */
export const DEFAULTS = {
  /** Pixels of travel before a mouse or pen drag starts. */
  distance: 4,
  /** Milliseconds of press before a touch drag starts. */
  delay: 200,
  /** How far a finger may drift during `delay` before we assume a scroll. */
  tolerance: 6,
  /** Reorder animation, in milliseconds. */
  animation: 180,
  /** Stacking order applied to a sortable item while it moves. */
  zIndex: 20,
  /** How close to an edge, in pixels, before auto-scrolling begins. */
  scrollThreshold: 60,
  /** Auto-scroll pixels per frame at full speed. */
  scrollSpeed: 14,
  /** Smallest width or height a resize will produce, in pixels. */
  minSize: 16,
  /** Edge length of a library-created resize handle, in pixels. */
  handleSize: 12,
} as const;
```

- [ ] **Step 4: Write `options.ts`**

```ts
// src/core/options.ts

/**
 * Turn the two accepted grid shapes into one.
 *
 * A falsy grid — including an explicit 0 — means no snapping, which is why
 * this returns null rather than [0, 0]: callers branch on presence, not value.
 */
export function normaliseGrid(
  grid: number | [number, number] | undefined | null,
): [number, number] | null {
  if (!grid) return null;
  if (typeof grid === 'number') return [grid, grid];
  return [grid[0], grid[1]];
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm test:unit -- options`
Expected: PASS, 5 tests.

- [ ] **Step 6: Replace the scattered literals**

Each edit below removes a magic number or duplicated normalisation. Do them all, then run the full unit suite.

In `src/core/pointer.ts`, delete `const DEFAULTS = { distance: 4, delay: 200, tolerance: 6 };` (line 39) and import the shared one:

```ts
import { ATTR, DEFAULTS } from './constants';
```

In `src/core/autoscroll.ts` lines 24–25:

```ts
const threshold = options.threshold ?? DEFAULTS.scrollThreshold;
const speed = options.speed ?? DEFAULTS.scrollSpeed;
```

In `src/draggable.ts`, delete `const DRAGGING_CLASS = 'dk-dragging';` and the inline grid ternary at lines 49–53, replacing with:

```ts
import { CLASS } from './core/constants';
import { normaliseGrid } from './core/options';
// ...
const grid = normaliseGrid(options.grid);
```

Then `el.classList.add(DRAGGING_CLASS)` → `el.classList.add(CLASS.dragging)` and likewise for the removals.

In `src/resizable.ts`: same grid replacement at lines 61–65, `RESIZING_CLASS` → `CLASS.resizing`, `'dk-resizable'` → `CLASS.resizable`, and lines 156–157:

```ts
minWidth: options.minWidth ?? DEFAULTS.minSize,
minHeight: options.minHeight ?? DEFAULTS.minSize,
```

In `src/sortable.ts`: `SORTING_CLASS` → `CLASS.sorting`, `'dk-sortable'` → `CLASS.sortable`, `'data-dk-ignore'` → `ATTR.ignore`, line 103 `options.animation ?? DEFAULTS.animation`, line 271 `String(options.zIndex ?? DEFAULTS.zIndex)`.

- [ ] **Step 7: Confirm nothing regressed**

Run: `pnpm test:unit`
Expected: PASS. Class names are still `dk-*` at this point — the rename lands in Task 15, so any test asserting on class names is untouched here.

Run: `grep -rn "dk-\|'data-dk" src/ | grep -v constants.ts`
Expected: matches only in `styles.css` and the `CLASS`/`ATTR` values themselves. Any match in a `.ts` file other than `constants.ts` is a miss — fix it.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: centralise every class name and tunable in constants.ts

Magic numbers were spread across five files and the grid normalisation
was written twice. One home each, so a change is a one-line change."
```

---

## Task 3: `core/invariant.ts` and the `__DEV__` build define

**Files:**
- Create: `src/core/invariant.ts`, `test/unit/invariant.test.ts`
- Modify: `build.mjs:9`, `src/draggable.ts`, `src/resizable.ts`, `src/sortable.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `invariant(condition: unknown, message: string): asserts condition`, and a production build in which neither the function nor its message strings appear.

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/invariant.test.ts
import { describe, expect, it } from 'vitest';
import { invariant } from '../../src/core/invariant';

describe('invariant', () => {
  it('does nothing when the condition holds', () => {
    expect(() => invariant(true, 'unused')).not.toThrow();
  });

  it('throws with a prefixed message when it does not', () => {
    expect(() => invariant(false, 'target must be an element')).toThrow(
      '[detent] target must be an element',
    );
  });

  it('narrows the type for the caller', () => {
    const value: string | null = 'present' as string | null;
    invariant(value, 'value is required');
    // Compiles only if `value` is narrowed to string.
    expect(value.length).toBe(7);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:unit -- invariant`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

```ts
// src/core/invariant.ts
import { PREFIX } from './constants';

/**
 * A precondition that only exists in development builds.
 *
 * The bundler replaces `__DEV__` with `false` for production, so the whole
 * call — including the message string — is dropped. Guards are therefore free
 * to be wordy and specific.
 *
 * This is for programming mistakes by the consumer, never for runtime
 * conditions the library should handle. If a situation is recoverable, handle
 * it; if it means the caller got the API wrong, say so here.
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (__DEV__ && !condition) {
    throw new Error(`[${PREFIX}] ${message}`);
  }
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test:unit -- invariant`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add the production define to the build**

In `build.mjs`, line 9, add `define` to the shared config, and to the per-module size builds:

```js
const define = { __DEV__: 'false' };

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  target: 'es2020',
  define,
};
```

and in the size loop:

```js
await build({
  stdin: { contents: `export { ${name} } from './src/${name}';`, resolveDir: '.', loader: 'ts' },
  bundle: true, minify: true, format: 'esm', target: 'es2020', define,
  outfile: `dist/_size-${name}.js`,
});
```

- [ ] **Step 6: Add the guards to the three entry points**

At the top of `draggable()`:

```ts
invariant(el instanceof HTMLElement, 'draggable() needs an HTMLElement, got ' + typeof el);
```

At the top of `resizable()`:

```ts
invariant(el instanceof HTMLElement, 'resizable() needs an HTMLElement, got ' + typeof el);
invariant(
  (options.maxWidth ?? Infinity) >= (options.minWidth ?? DEFAULTS.minSize),
  'resizable() maxWidth is below minWidth',
);
invariant(
  (options.maxHeight ?? Infinity) >= (options.minHeight ?? DEFAULTS.minSize),
  'resizable() maxHeight is below minHeight',
);
```

At the top of `sortable()`:

```ts
invariant(container instanceof HTMLElement, 'sortable() needs an HTMLElement container');
```

- [ ] **Step 7: Verify dead-code elimination**

Run:

```bash
node build.mjs >/dev/null && grep -c "needs an HTMLElement" dist/index.js || echo "0 — eliminated"
```

Expected: `0 — eliminated`. If any guard message survives into `dist/index.js`, the define is not reaching that build — fix before continuing, because the spec's "zero production cost" claim depends on it.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add __DEV__-gated invariants for caller mistakes

Guards the errors that currently fail cryptically and late — a null
target, an inverted min/max. Stripped entirely from production builds."
```

---

## Task 4: Fix `paint()` defeating the scheduler (D1)

**Files:**
- Modify: `src/core/scheduler.ts`, `src/core/box.ts:13-51`
- Test: `test/unit/box.test.ts` (create), `test/unit/scheduler.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `queued(): number` from `scheduler.ts` (internal diagnostic, not exported from `src/index.ts`). `paint(el)` and `paintNow(el)` keep their existing signatures.

This is the highest-value fix in the phase: the scheduler currently does no batching at all.

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/box.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { paint, paintNow, resetState, stateOf } from '../../src/core/box';
import { flush, queued } from '../../src/core/scheduler';

describe('paint batching', () => {
  let el: HTMLElement;

  beforeEach(() => {
    flush();
    document.body.innerHTML = '';
    el = document.createElement('div');
    document.body.appendChild(el);
    resetState(el);
  });

  it('queues one job no matter how many times the element is painted', () => {
    const state = stateOf(el);
    for (let i = 0; i < 50; i++) {
      state.x = i;
      paint(el);
    }
    expect(queued()).toBe(1);
  });

  it('queues one job per element, not one per call', () => {
    const other = document.createElement('div');
    document.body.appendChild(other);
    paint(el);
    paint(other);
    paint(el);
    expect(queued()).toBe(2);
  });

  it('paints the state as it stands when the frame lands, not when queued', () => {
    const state = stateOf(el);
    state.x = 10;
    paint(el);
    state.x = 90;
    flush();
    expect(el.style.transform).toBe('translate3d(90px, 0px, 0)');
  });

  it('clears the transform when the offset returns to zero', () => {
    const state = stateOf(el);
    state.x = 10;
    paintNow(el);
    state.x = 0;
    paintNow(el);
    expect(el.style.transform).toBe('');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:unit -- box`
Expected: FAIL — `queued` is not exported, and once it is, the first test reports 50 rather than 1.

- [ ] **Step 3: Add `queued()` to the scheduler**

```ts
// src/core/scheduler.ts — add below flush()

/**
 * How many jobs are waiting for the next frame.
 *
 * Exists so tests can assert that batching actually batches. Not part of the
 * public API.
 */
export function queued(): number {
  return queue.size;
}
```

- [ ] **Step 4: Give each element one persistent painter**

Replace `box.ts` lines 13–51:

```ts
export interface BoxState {
  x: number;
  y: number;
  width: number | null;
  height: number | null;
}

const states = new WeakMap<HTMLElement, BoxState>();

/**
 * One painter per element, created once and reused.
 *
 * The scheduler dedupes its queue by function identity. Allocating a fresh
 * closure per call — which is what this used to do — meant the queue grew by
 * one entry per pointer event and nothing was ever batched.
 */
const painters = new WeakMap<HTMLElement, () => void>();

export function stateOf(el: HTMLElement): BoxState {
  let state = states.get(el);
  if (!state) {
    state = { x: 0, y: 0, width: null, height: null };
    states.set(el, state);
  }
  return state;
}

export function resetState(el: HTMLElement): void {
  states.delete(el);
  const painter = painters.get(el);
  if (painter) {
    unschedule(painter);
    painters.delete(el);
  }
}

function apply(el: HTMLElement): void {
  const state = stateOf(el);
  el.style.transform = state.x || state.y ? `translate3d(${state.x}px, ${state.y}px, 0)` : '';
  if (state.width !== null) el.style.width = `${state.width}px`;
  if (state.height !== null) el.style.height = `${state.height}px`;
}

function painterOf(el: HTMLElement): () => void {
  let painter = painters.get(el);
  if (!painter) {
    painter = () => apply(el);
    painters.set(el, painter);
  }
  return painter;
}

/** Push the element's current offset and size to the DOM on the next frame. */
export function paint(el: HTMLElement): void {
  write(painterOf(el));
}

/** Same as paint, but immediate — used when a frame of lag would show. */
export function paintNow(el: HTMLElement): void {
  unschedule(painterOf(el));
  apply(el);
}
```

Update the import at the top of `box.ts`:

```ts
import { unschedule, write } from './scheduler';
```

Note two behaviour changes beyond deduplication, both deliberate: `paintNow` now cancels any pending queued paint for that element (previously a stale queued paint could land *after* an immediate one and undo it), and `resetState` drops the painter so a destroyed element is not retained by the queue.

- [ ] **Step 5: Run the tests**

Run: `pnpm test:unit -- box`
Expected: PASS, 4 tests.

Run: `pnpm test:unit`
Expected: PASS — the whole suite. `sortable` leans on `paintNow` heavily, so a regression shows up here.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix: paint() now actually batches DOM writes

The scheduler dedupes by function identity, but paint() allocated a new
closure per call, so a 120Hz pointer stream queued 120 jobs per frame and
nothing was batched. One persistent painter per element.

paintNow() additionally cancels any pending paint for the element, which
closes a race where a stale queued write could land after an immediate one."
```

---

## Task 5: Refcount body-level drag state (D6)

**Files:**
- Create: `src/core/body-state.ts`, `test/unit/body-state.test.ts`
- Modify: `src/core/pointer.ts:68,86-90,157-161`

**Interfaces:**
- Consumes: `ATTR` from `constants.ts`.
- Produces: `lockPage(): void`, `unlockPage(): void`, `pageLockDepth(): number`.

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/body-state.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { lockPage, pageLockDepth, unlockPage } from '../../src/core/body-state';
import { ATTR } from '../../src/core/constants';

describe('page lock', () => {
  beforeEach(() => {
    while (pageLockDepth() > 0) unlockPage();
    document.body.style.userSelect = '';
    document.body.removeAttribute(ATTR.dragging);
  });

  it('marks the body while a drag is active', () => {
    lockPage();
    expect(document.body.style.userSelect).toBe('none');
    expect(document.body.hasAttribute(ATTR.dragging)).toBe(true);
  });

  it('restores what the host page had', () => {
    document.body.style.userSelect = 'text';
    lockPage();
    unlockPage();
    expect(document.body.style.userSelect).toBe('text');
    expect(document.body.hasAttribute(ATTR.dragging)).toBe(false);
  });

  it('holds the lock until the last drag releases it', () => {
    document.body.style.userSelect = 'text';
    lockPage();
    lockPage();
    unlockPage();
    expect(document.body.style.userSelect).toBe('none');
    expect(document.body.hasAttribute(ATTR.dragging)).toBe(true);
    unlockPage();
    expect(document.body.style.userSelect).toBe('text');
  });

  it('ignores an unbalanced release', () => {
    unlockPage();
    expect(pageLockDepth()).toBe(0);
  });
});
```

The third test is the bug: today the second `lockPage` saves the already-clobbered `'none'`, so the page is left permanently unselectable.

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:unit -- body-state`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

```ts
// src/core/body-state.ts
import { ATTR } from './constants';

/**
 * Ownership of the page-level state a drag needs.
 *
 * Two drags can overlap — a mouse in one list and a finger in another, or a
 * consumer driving a second element programmatically. Without refcounting, the
 * second lock saves the first's clobbered value and restores that on release,
 * leaving the page unselectable for good.
 */

let depth = 0;
let restoreUserSelect = '';

export function lockPage(): void {
  if (depth++ > 0) return;
  restoreUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = 'none';
  document.body.setAttribute(ATTR.dragging, '');
}

export function unlockPage(): void {
  if (depth === 0) return;
  if (--depth > 0) return;
  document.body.style.userSelect = restoreUserSelect;
  document.body.removeAttribute(ATTR.dragging);
}

/** Diagnostic for tests. Not part of the public API. */
export function pageLockDepth(): number {
  return depth;
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test:unit -- body-state`
Expected: PASS, 4 tests.

- [ ] **Step 5: Use it from the pointer layer**

In `src/core/pointer.ts`, delete `let restoreUserSelect = '';` (line 68). In `activate()` replace lines 86–89 with:

```ts
active = true;
lockPage();
```

In `teardown()` replace lines 157–161 with:

```ts
if (wasActive) {
  unlockPage();
  swallowNextClick();
}
```

Add the import:

```ts
import { lockPage, unlockPage } from './body-state';
```

- [ ] **Step 6: Run the full suite**

Run: `pnpm test:unit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: refcount body-level drag state across concurrent drags

Two overlapping drags left the page permanently unselectable, because the
second saved the first's already-clobbered user-select value."
```

---

## Task 6: One scroll-ancestor walk (S1)

**Files:**
- Create: `src/core/scroll.ts`, `test/browser/scroll.test.ts`
- Modify: `src/core/geometry.ts` (delete lines 102–141), `src/sortable.ts` imports
- Delete: the `scrollAncestorsOf` / `scrollParentOf` / `totalScroll` block from `geometry.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `scrollAncestorsOf(el: Element): Element[]`, `scrollParentOf(el: Element): Element | null`, `totalScroll(ancestors: Element[]): Point`. Signatures are unchanged from `geometry.ts`, so consumers only change their import path.

This test belongs in the browser tier: `getComputedStyle(...).overflowY` needs a real style engine.

- [ ] **Step 1: Write the failing test**

```ts
// test/browser/scroll.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { scrollAncestorsOf, scrollParentOf, totalScroll } from '../../src/core/scroll';

function nest(styles: string[]): HTMLElement {
  let parent = document.body;
  let leaf = document.body as HTMLElement;
  for (const css of styles) {
    const el = document.createElement('div');
    el.style.cssText = css;
    parent.appendChild(el);
    parent = el;
    leaf = el;
  }
  const target = document.createElement('div');
  target.style.cssText = 'width:50px;height:50px';
  leaf.appendChild(target);
  return target;
}

describe('scroll ancestors', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds nothing when no ancestor scrolls', () => {
    const target = nest(['width:200px;height:200px']);
    expect(scrollAncestorsOf(target)).toEqual([]);
    expect(scrollParentOf(target)).toBeNull();
  });

  it('finds a scrolling ancestor, nearest first', () => {
    const target = nest([
      'overflow:auto;width:300px;height:300px',
      'width:200px;height:200px',
      'overflow:scroll;width:100px;height:100px',
    ]);
    const found = scrollAncestorsOf(target);
    expect(found).toHaveLength(2);
    expect(getComputedStyle(found[0]).overflowY).toBe('scroll');
    expect(scrollParentOf(target)).toBe(found[0]);
  });

  it('ignores hidden and clipped overflow, which do not scroll', () => {
    const target = nest(['overflow:hidden;width:200px;height:200px']);
    expect(scrollAncestorsOf(target)).toEqual([]);
  });

  it('adds up how far every ancestor has scrolled', () => {
    const target = nest([
      'overflow:auto;width:100px;height:100px',
      'width:400px;height:400px',
    ]);
    const scroller = scrollAncestorsOf(target)[0] as HTMLElement;
    scroller.scrollTop = 40;
    scroller.scrollLeft = 15;
    const total = totalScroll([scroller]);
    expect(total.y).toBe(40 + window.scrollY);
    expect(total.x).toBe(15 + window.scrollX);
  });
});
```

The `overflow: hidden` case is a genuine behaviour question the current regex gets right by luck — `hidden` is not in `auto|scroll|overlay` — and the test pins it.

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:browser -- scroll`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

```ts
// src/core/scroll.ts
import type { Point } from './types';

/**
 * Scroll-position bookkeeping.
 *
 * A drag works in viewport coordinates, but an element's resting position
 * moves whenever anything above it scrolls. Tracking the total lets a drag
 * stay under the pointer instead of sliding away with the content.
 */

/** `visible` and `hidden` do not scroll; `clip` explicitly cannot. */
const SCROLLS = /auto|scroll|overlay/;

function scrolls(el: Element): boolean {
  const style = getComputedStyle(el);
  return SCROLLS.test(style.overflowY) || SCROLLS.test(style.overflowX);
}

/**
 * Walk up from `el`, yielding every ancestor that scrolls, nearest first.
 *
 * Stops at the body: the page's own scroll is handled separately by
 * `totalScroll`, because it lives on `window` rather than on an element.
 */
function walk(el: Element, stopAtFirst: boolean): Element[] {
  const out: Element[] = [];
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    if (scrolls(node)) {
      out.push(node);
      if (stopAtFirst) return out;
    }
    node = node.parentElement;
  }
  return out;
}

/** Every ancestor that scrolls, nearest first. */
export function scrollAncestorsOf(el: Element): Element[] {
  return walk(el, false);
}

/** The nearest ancestor that actually scrolls, or null if only the page does. */
export function scrollParentOf(el: Element): Element | null {
  return walk(el, true)[0] ?? null;
}

/** How far everything above an element has scrolled, added together. */
export function totalScroll(ancestors: Element[]): Point {
  let x = typeof window === 'undefined' ? 0 : window.scrollX;
  let y = typeof window === 'undefined' ? 0 : window.scrollY;
  for (const node of ancestors) {
    x += node.scrollLeft;
    y += node.scrollTop;
  }
  return { x, y };
}
```

- [ ] **Step 4: Delete the originals and repoint imports**

Delete lines 102–141 of `src/core/geometry.ts` (`scrollAncestorsOf`, `totalScroll`, `scrollParentOf` and their comments). `geometry.ts` is now pure maths with no DOM dependency beyond `boxOf`.

In `src/sortable.ts`, split the import:

```ts
import { boxOf, contains, detectAxis, resolveInsertIndex } from './core/geometry';
import { scrollAncestorsOf, scrollParentOf, totalScroll } from './core/scroll';
```

- [ ] **Step 5: Run everything**

Run: `pnpm test:browser -- scroll`
Expected: PASS, 4 tests on three engines.

Run: `pnpm test:unit && pnpm exec tsc --noEmit`
Expected: PASS and no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: one scroll-ancestor walk instead of two

scrollAncestorsOf and scrollParentOf were the same walk with the same
regex, written twice. Also moves scroll bookkeeping out of geometry.ts,
which is now pure maths."
```

---

## Task 7: Compensate for transformed ancestors (H1)

**Files:**
- Create: `src/core/scale.ts`, `test/browser/scale.test.ts`
- Modify: `src/draggable.ts`, `src/resizable.ts`, `src/sortable.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `scaleOf(el: HTMLElement): Point` — the ratio of rendered to layout size, `{x: 1, y: 1}` when untransformed. `unscale(delta: Point, scale: Point): Point`.

Inside a `transform: scale(0.75)` ancestor the element currently travels 33% too far, drifting away from the cursor. Modals, zoom canvases and presentation surfaces all hit this.

- [ ] **Step 1: Write the failing test**

```ts
// test/browser/scale.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { scaleOf, unscale } from '../../src/core/scale';

describe('scaleOf', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function inside(css: string): HTMLElement {
    const parent = document.createElement('div');
    parent.style.cssText = css;
    const el = document.createElement('div');
    el.style.cssText = 'width:100px;height:80px';
    parent.appendChild(el);
    document.body.appendChild(parent);
    return el;
  }

  it('reports 1 when nothing is transformed', () => {
    expect(scaleOf(inside('width:400px'))).toEqual({ x: 1, y: 1 });
  });

  it('reports the scale of a transformed ancestor', () => {
    const el = inside('width:400px;transform:scale(0.5)');
    const scale = scaleOf(el);
    expect(scale.x).toBeCloseTo(0.5, 5);
    expect(scale.y).toBeCloseTo(0.5, 5);
  });

  it('reports each axis separately', () => {
    const el = inside('width:400px;transform:scale(0.5, 2)');
    expect(scaleOf(el).x).toBeCloseTo(0.5, 5);
    expect(scaleOf(el).y).toBeCloseTo(2, 5);
  });

  it('falls back to 1 for an element with no layout box', () => {
    const el = inside('display:none');
    expect(scaleOf(el)).toEqual({ x: 1, y: 1 });
  });
});

describe('unscale', () => {
  it('leaves a delta alone at scale 1', () => {
    expect(unscale({ x: 30, y: 10 }, { x: 1, y: 1 })).toEqual({ x: 30, y: 10 });
  });

  it('converts pointer travel into layout pixels', () => {
    // The pointer moved 30 rendered px inside a half-scale container, so the
    // element must move 60 layout px to stay under it.
    expect(unscale({ x: 30, y: 10 }, { x: 0.5, y: 0.5 })).toEqual({ x: 60, y: 20 });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:browser -- scale`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement it**

```ts
// src/core/scale.ts
import type { Point } from './types';

const NONE: Point = { x: 1, y: 1 };

/**
 * How many rendered pixels one layout pixel of this element occupies.
 *
 * `getBoundingClientRect` reports post-transform size; `offsetWidth` reports
 * pre-transform layout size. Their ratio is the accumulated scale of every
 * ancestor transform, which is exactly the factor pointer travel has to be
 * divided by for the element to stay under the cursor.
 *
 * Returns 1 for anything with no layout box — a hidden element cannot be
 * dragged anyway, and 1 keeps the caller's arithmetic finite.
 */
export function scaleOf(el: HTMLElement): Point {
  const rect = el.getBoundingClientRect();
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  if (!width || !height || !rect.width || !rect.height) return NONE;
  return { x: rect.width / width, y: rect.height / height };
}

/** Turn pointer travel in rendered pixels into travel in layout pixels. */
export function unscale(delta: Point, scale: Point): Point {
  if (scale.x === 1 && scale.y === 1) return delta;
  return { x: delta.x / scale.x, y: delta.y / scale.y };
}
```

- [ ] **Step 4: Write the integration test that proves a drag tracks the cursor**

```ts
// test/browser/draggable-scaled.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { draggable } from '../../src/draggable';
import { flush } from '../../src/core/scheduler';

function drag(el: HTMLElement, from: [number, number], to: [number, number]) {
  const base = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, bubbles: true, cancelable: true };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: from[0], clientY: from[1] }));
  window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: to[0], clientY: to[1] }));
  flush();
  window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: to[0], clientY: to[1] }));
  flush();
}

describe('dragging inside a scaled ancestor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('follows the cursor 1:1 on screen', () => {
    const stage = document.createElement('div');
    stage.style.cssText = 'transform:scale(0.5);transform-origin:0 0;width:800px;height:600px';
    const el = document.createElement('div');
    el.style.cssText = 'width:100px;height:100px;position:absolute;left:0;top:0';
    stage.appendChild(el);
    document.body.appendChild(stage);

    draggable(el, { distance: 0 });
    const before = el.getBoundingClientRect().left;
    drag(el, [10, 10], [110, 10]);

    // The cursor moved 100 screen px, so the element must move 100 screen px —
    // which is 200 layout px inside a half-scale stage.
    expect(el.getBoundingClientRect().left - before).toBeCloseTo(100, 0);
  });
});
```

- [ ] **Step 5: Run it to confirm it fails for the right reason**

Run: `pnpm test:browser -- draggable-scaled`
Expected: FAIL — the element moves 50 screen px, not 100. That difference *is* the bug.

- [ ] **Step 6: Apply the compensation in `draggable`**

Add to the module imports:

```ts
import { scaleOf, unscale } from './core/scale';
```

Add a drag-scoped variable alongside `origin` and `limit`:

```ts
let scale: Point = { x: 1, y: 1 };
```

In `onStart`, after `const visual = boxOf(el);`, add:

```ts
scale = scaleOf(el);
```

In `onMove`, replace the two lines that read `session.delta` with a scaled delta:

```ts
const delta = unscale(session.delta, scale);
let x = options.axis === 'y' ? startOffset.x : startOffset.x + delta.x;
let y = options.axis === 'x' ? startOffset.y : startOffset.y + delta.y;
```

Note the `origin` box is in *rendered* coordinates while the offset is in layout coordinates. Bounds clamping therefore also needs the unscaled box; convert `origin` at measure time in `onStart`:

```ts
origin = {
  left: (visual.left - state.x * scale.x) / scale.x,
  top: (visual.top - state.y * scale.y) / scale.y,
  width: visual.width / scale.x,
  height: visual.height / scale.y,
};
```

and convert the limit likewise when one exists:

```ts
const rawLimit = resolveBounds(el, options.bounds ?? null);
limit = rawLimit && (scale.x !== 1 || scale.y !== 1)
  ? {
      left: rawLimit.left / scale.x,
      top: rawLimit.top / scale.y,
      width: rawLimit.width / scale.x,
      height: rawLimit.height / scale.y,
    }
  : rawLimit;
```

- [ ] **Step 7: Run the tests**

Run: `pnpm test:browser -- scale draggable-scaled`
Expected: PASS.

Run: `pnpm test:unit`
Expected: PASS — the unit tests run at scale 1, so behaviour there is unchanged.

- [ ] **Step 8: Apply the same compensation to `resizable` and `sortable`**

In `src/resizable.ts` `bindHandle.onStart`, capture `scale = scaleOf(el)` and in `onMove` pass `delta: unscale(session.delta, scale)` to `computeResize`.

In `src/sortable.ts` `onStart`, capture `scale = scaleOf(item)`; in `applyMove`, replace `lastDelta` with its unscaled form when computing `state.x` / `state.y`. Store both: `lastDelta` stays raw for `reanchor`'s bookkeeping, and a derived `layoutDelta = unscale(lastDelta, scale)` feeds the offset arithmetic.

- [ ] **Step 9: Extend the integration test to cover all three**

Add to `test/browser/draggable-scaled.test.ts` an equivalent case for `resizable` (drag the `se` handle 100 screen px, assert the element grows 100 screen px) and for `sortable` (reorder inside a scaled list, assert the order changes at the visually correct crossing point).

Run: `pnpm test:browser`
Expected: PASS on all three engines.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "fix: track the cursor inside transformed ancestors

getBoundingClientRect reports post-transform pixels but pointer deltas are
raw, so inside transform:scale(k) everything moved 1/k too far and drifted
away from the cursor. Affects modals, zoom canvases and slide editors."
```

---

## Task 8: Reorder in the direction the user sees under RTL (D5)

**Files:**
- Modify: `src/core/geometry.ts:77-100`, `src/sortable.ts`
- Test: `test/unit/geometry.test.ts` (extend), `test/browser/sortable-rtl.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveInsertIndex(rects: Box[], pointer: Point, axis: ListAxis, rtl?: boolean): number` — the fourth parameter is new and defaults to `false`, so existing callers are unaffected. `isRtl(el: Element): boolean` added to `geometry.ts`.

- [ ] **Step 1: Write the failing unit test**

```ts
// test/unit/geometry.test.ts — append
import { resolveInsertIndex } from '../../src/core/geometry';

describe('resolveInsertIndex under RTL', () => {
  // Three 100px boxes in a row. Visually under RTL, box at left:200 is FIRST.
  const rects = [
    { left: 200, top: 0, width: 100, height: 50 },
    { left: 100, top: 0, width: 100, height: 50 },
    { left: 0, top: 0, width: 100, height: 50 },
  ];

  it('inserts before everything when the pointer is at the right edge', () => {
    expect(resolveInsertIndex(rects, { x: 290, y: 25 }, 'x', true)).toBe(0);
  });

  it('inserts after everything when the pointer is at the left edge', () => {
    expect(resolveInsertIndex(rects, { x: 10, y: 25 }, 'x', true)).toBe(3);
  });

  it('inserts in the middle when the pointer is in the middle', () => {
    expect(resolveInsertIndex(rects, { x: 140, y: 25 }, 'x', true)).toBe(2);
  });

  it('is unchanged for LTR', () => {
    const ltr = [
      { left: 0, top: 0, width: 100, height: 50 },
      { left: 100, top: 0, width: 100, height: 50 },
    ];
    expect(resolveInsertIndex(ltr, { x: 10, y: 25 }, 'x', false)).toBe(0);
    expect(resolveInsertIndex(ltr, { x: 190, y: 25 }, 'x', false)).toBe(2);
  });

  it('never lets RTL affect a vertical list', () => {
    const column = [
      { left: 0, top: 0, width: 100, height: 50 },
      { left: 0, top: 50, width: 100, height: 50 },
    ];
    expect(resolveInsertIndex(column, { x: 50, y: 10 }, 'y', true)).toBe(0);
    expect(resolveInsertIndex(column, { x: 50, y: 90 }, 'y', true)).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:unit -- geometry`
Expected: FAIL — RTL cases return the mirror of the expected index.

- [ ] **Step 3: Implement it**

Replace `resolveInsertIndex` (`geometry.ts:77-100`):

```ts
/**
 * Given the boxes of every item in a list *except* the one being dragged, and
 * where the pointer is, return the position the dragged item should take.
 *
 * The answer is an insertion point: 0 means "before the first remaining item",
 * `rects.length` means "after the last one".
 *
 * `rects` is in DOM order. Under RTL that runs right-to-left on screen, so the
 * horizontal comparison flips — otherwise every sideways reorder goes the
 * opposite way to the one the user is pointing.
 */
export function resolveInsertIndex(
  rects: Box[],
  pointer: Point,
  axis: ListAxis,
  rtl = false,
): number {
  const count = rects.length;
  if (count === 0) return 0;

  if (axis === 'grid') {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < count; i++) {
      const d = distance(centerOf(rects[i]), pointer);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    const c = centerOf(rects[best]);
    const half = rects[best].height / 2;
    const ahead = rtl ? pointer.x < c.x : pointer.x > c.x;
    const past =
      pointer.y > c.y + half ? true : pointer.y < c.y - half ? false : ahead;
    return past ? best + 1 : best;
  }

  if (axis === 'x') {
    let index = 0;
    while (
      index < count &&
      (rtl ? pointer.x < centerOf(rects[index]).x : pointer.x > centerOf(rects[index]).x)
    ) {
      index++;
    }
    return index;
  }

  let index = 0;
  while (index < count && pointer.y > centerOf(rects[index]).y) index++;
  return index;
}

/** Whether an element's resolved writing direction runs right to left. */
export function isRtl(el: Element): boolean {
  return getComputedStyle(el).direction === 'rtl';
}
```

- [ ] **Step 4: Run the unit test**

Run: `pnpm test:unit -- geometry`
Expected: PASS.

- [ ] **Step 5: Pass the flag through `sortable`**

In `src/sortable.ts`, add `import { isRtl } from './core/geometry';`, add a drag-scoped `let rtl = false;`, set `rtl = isRtl(container)` in `onStart` (once per drag — it needs a computed style, so it must not be read per move), and change the call in `applyMove`:

```ts
const index = resolveInsertIndex(cachedRects, lastPoint, axis, rtl);
```

Read it from the *target* host rather than the origin container when they differ, since a cross-list drop should follow the destination's direction:

```ts
rtl = isRtl(target.container);
```

placed inside the `if (target !== cacheHost || scrolledSinceMeasure)` branch, which already runs only when the host changes or measurements go stale.

- [ ] **Step 6: Write the browser test**

```ts
// test/browser/sortable-rtl.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { sortable } from '../../src/sortable';
import { flush } from '../../src/core/scheduler';

describe('sortable under dir=rtl', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('moves an item the way the user drags it', () => {
    const list = document.createElement('ul');
    list.dir = 'rtl';
    list.style.cssText = 'display:flex;margin:0;padding:0;list-style:none;width:300px';
    const ids = ['a', 'b', 'c'];
    for (const id of ids) {
      const li = document.createElement('li');
      li.dataset.id = id;
      li.style.cssText = 'width:100px;height:50px';
      list.appendChild(li);
    }
    document.body.appendChild(list);
    sortable(list, { distance: 0, animation: 0, keyboard: false });

    const first = list.children[0] as HTMLElement;
    const start = first.getBoundingClientRect();
    const base = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, bubbles: true, cancelable: true };
    const y = start.top + 25;
    first.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: start.left + 50, clientY: y }));
    // Drag LEFT, which under RTL means "later in the list".
    window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: start.left - 150, clientY: y }));
    flush();
    window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: start.left - 150, clientY: y }));
    flush();

    const order = Array.from(list.children).map((c) => (c as HTMLElement).dataset.id);
    expect(order).toEqual(['b', 'c', 'a']);
  });
});
```

- [ ] **Step 7: Run everything**

Run: `pnpm test:browser -- sortable-rtl`
Expected: PASS on three engines.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix: reorder in the direction the user drags under dir=rtl

The x-axis insertion walk assumed left-to-right, so every horizontal
reorder on an RTL page went the opposite way to the gesture."
```

---

## Task 9: Auto-scroll survives `scroll-behavior: smooth` (H2)

**Files:**
- Modify: `src/core/autoscroll.ts:52-61`
- Test: `test/browser/autoscroll.test.ts` (create)

**Interfaces:**
- Consumes: `DEFAULTS` from `constants.ts` (already wired in Task 2).
- Produces: no signature change.

Sites set `scroll-behavior: smooth` on `html` routinely. The current `scrollTop += dy` is then animated by the browser, so each frame reads a position still in flight from the last frame's write and auto-scroll stutters or stalls entirely.

- [ ] **Step 1: Write the failing test**

```ts
// test/browser/autoscroll.test.ts
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createAutoScroll } from '../../src/core/autoscroll';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

describe('auto-scroll', () => {
  let scroller: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    scroller = document.createElement('div');
    scroller.style.cssText = 'overflow:auto;width:200px;height:200px;scroll-behavior:smooth';
    const tall = document.createElement('div');
    tall.style.cssText = 'height:2000px';
    scroller.appendChild(tall);
    document.body.appendChild(scroller);
  });

  afterEach(() => {
    document.documentElement.style.scrollBehavior = '';
  });

  it('advances monotonically even when the container scrolls smoothly', async () => {
    const auto = createAutoScroll(scroller);
    const rect = scroller.getBoundingClientRect();
    auto.update({ x: rect.left + 100, y: rect.bottom - 5 });

    const samples: number[] = [];
    for (let i = 0; i < 6; i++) {
      await nextFrame();
      samples.push(scroller.scrollTop);
    }
    auto.stop();

    expect(samples[samples.length - 1]).toBeGreaterThan(0);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
  });

  it('reports each step so the caller can recompute', async () => {
    let steps = 0;
    const auto = createAutoScroll(scroller, { onScroll: () => steps++ });
    const rect = scroller.getBoundingClientRect();
    auto.update({ x: rect.left + 100, y: rect.bottom - 5 });
    await nextFrame();
    await nextFrame();
    auto.stop();
    expect(steps).toBeGreaterThan(0);
  });

  it('does nothing when the pointer is nowhere near an edge', async () => {
    const auto = createAutoScroll(scroller);
    const rect = scroller.getBoundingClientRect();
    auto.update({ x: rect.left + 100, y: rect.top + 100 });
    await nextFrame();
    await nextFrame();
    auto.stop();
    expect(scroller.scrollTop).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:browser -- autoscroll`
Expected: FAIL — with smooth scrolling the samples are not monotonic, or `scrollTop` stays near 0.

- [ ] **Step 3: Implement it**

Replace `autoscroll.ts` lines 52–61:

```ts
if (dx || dy) {
  const beforeTop = scroller.scrollTop;
  const beforeLeft = scroller.scrollLeft;

  // `behavior: 'instant'` overrides a host page's `scroll-behavior: smooth`.
  // Without it the browser animates every step, so each frame reads a position
  // still in flight from the previous one and the drag fights the animation.
  scroller.scrollBy({ top: dy, left: dx, behavior: 'instant' });

  if (scroller.scrollTop !== beforeTop || scroller.scrollLeft !== beforeLeft) {
    options.onScroll?.();
  }
  frame = requestAnimationFrame(step);
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test:browser -- autoscroll`
Expected: PASS, 3 tests on three engines.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: auto-scroll no longer fights scroll-behavior: smooth

scrollTop += dy is animated when a host page sets smooth scrolling, so
each frame read a position still in flight and auto-scroll stalled."
```

---

## Task 10: Split `sortable.ts` — registry, live region, keyboard

**Files:**
- Create: `src/sortable/registry.ts`, `src/sortable/live-region.ts`, `src/sortable/keyboard.ts`, `src/sortable/index.ts`
- Delete: `src/sortable.ts`
- Modify: `src/index.ts`
- Test: `test/unit/registry.test.ts`, `test/browser/live-region.test.ts`, `test/browser/sortable-keyboard.test.ts`

**Interfaces:**
- Consumes: `CLASS`, `ATTR` from `constants.ts`; `flip` from `core/flip.ts`.
- Produces:
  - `registry.ts`: `Instance` interface `{ container: HTMLElement; options: SortableOptions; items(): HTMLElement[] }`, plus `registerList(i: Instance): void`, `unregisterList(i: Instance): void`, `eachList(): Iterable<Instance>`.
  - `live-region.ts`: `acquireLiveRegion(): void`, `releaseLiveRegion(): void`, `announce(message: string): void`.
  - `keyboard.ts`: `bindKeyboard(instance: Instance, deps: KeyboardDeps): Handle` where `KeyboardDeps = { animation: number; isDisabled(): boolean; onSort?(e: SortEvent): void }`.
  - `sortable/index.ts` re-exports `sortable` and `orderOf` with unchanged signatures.

Three defects are fixed here: H4 (duplicate copies), the live-region collision from §3, and D4 (shadow DOM keyboard).

- [ ] **Step 1: Write the failing registry test**

```ts
// test/unit/registry.test.ts
import { describe, expect, it } from 'vitest';
import { eachList, registerList, unregisterList } from '../../src/sortable/registry';

const REGISTRY_KEY = Symbol.for('detent.sortable.registry');

function makeInstance() {
  const container = document.createElement('ul');
  return { container, options: {}, items: () => [] };
}

describe('sortable registry', () => {
  it('registers and unregisters instances', () => {
    const a = makeInstance();
    registerList(a);
    expect([...eachList()]).toContain(a);
    unregisterList(a);
    expect([...eachList()]).not.toContain(a);
  });

  it('is shared across duplicate copies of the library via globalThis', () => {
    // Simulates a second bundled copy: a different module instance reaching
    // the same well-known symbol.
    const shared = (globalThis as Record<symbol, unknown>)[REGISTRY_KEY];
    expect(shared).toBeInstanceOf(Set);

    const fromOtherCopy = makeInstance();
    (shared as Set<unknown>).add(fromOtherCopy);
    expect([...eachList()]).toContain(fromOtherCopy);
    (shared as Set<unknown>).delete(fromOtherCopy);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:unit -- registry`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the registry**

```ts
// src/sortable/registry.ts
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
```

Move the `SortableOptions`, `SortEvent` and `SortLocation` interfaces out of the old `sortable.ts` into `src/sortable/types.ts` so `registry.ts` can import them without a cycle.

- [ ] **Step 4: Run the registry test**

Run: `pnpm test:unit -- registry`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the failing live-region test**

```ts
// test/browser/live-region.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { acquireLiveRegion, announce, releaseLiveRegion } from '../../src/sortable/live-region';
import { ATTR } from '../../src/core/constants';

const find = () => document.querySelector(`[${ATTR.liveRegion}]`);

describe('live region', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    while (find()) releaseLiveRegion();
  });

  it('is not created until a list needs it', () => {
    expect(find()).toBeNull();
  });

  it('is created on acquire and announces politely to assistive tech', () => {
    acquireLiveRegion();
    const region = find();
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-live')).toBe('assertive');
    announce('Lifted from position 1 of 3.');
    expect(region!.textContent).toBe('Lifted from position 1 of 3.');
    releaseLiveRegion();
  });

  it('is hidden by inline styles a host reset cannot undo', () => {
    acquireLiveRegion();
    const region = find() as HTMLElement;
    expect(region.style.position).toBe('fixed');
    expect(region.style.width).toBe('1px');
    expect(region.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    releaseLiveRegion();
  });

  it('survives until the last list releases it', () => {
    acquireLiveRegion();
    acquireLiveRegion();
    releaseLiveRegion();
    expect(find()).not.toBeNull();
    releaseLiveRegion();
    expect(find()).toBeNull();
  });

  it('does not use a global id, which a host page could collide with', () => {
    acquireLiveRegion();
    expect(find()!.id).toBe('');
    releaseLiveRegion();
  });
});
```

- [ ] **Step 6: Run it to confirm it fails, then implement**

Run: `pnpm test:browser -- live-region`
Expected: FAIL — module not found.

```ts
// src/sortable/live-region.ts
import { ATTR } from '../core/constants';

/**
 * The screen-reader announcer for keyboard reordering.
 *
 * Refcounted against live lists, so a page with no sortable left has no stray
 * node. Identified by a data attribute rather than an id — an id is a page-wide
 * name that a host document may already be using.
 *
 * Its visually-hidden styles are inline because a host reset such as
 * `div { position: static !important }` would otherwise drop a 1px element
 * into the page's flow.
 */

const HIDDEN =
  'position:fixed;width:1px;height:1px;margin:-1px;padding:0;border:0;' +
  'overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';

let region: HTMLElement | null = null;
let holders = 0;

export function acquireLiveRegion(): void {
  if (holders++ > 0) return;
  region = document.createElement('div');
  region.setAttribute(ATTR.liveRegion, '');
  region.setAttribute('aria-live', 'assertive');
  region.setAttribute('aria-atomic', 'true');
  region.style.cssText = HIDDEN;
  document.body.appendChild(region);
}

export function releaseLiveRegion(): void {
  if (holders === 0) return;
  if (--holders > 0) return;
  region?.remove();
  region = null;
}

export function announce(message: string): void {
  if (region) region.textContent = message;
}
```

Run: `pnpm test:browser -- live-region`
Expected: PASS, 5 tests.

- [ ] **Step 7: Write the failing shadow-DOM keyboard test**

```ts
// test/browser/sortable-keyboard.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { sortable } from '../../src/sortable';

function buildList(root: ParentNode) {
  const list = document.createElement('ul');
  list.style.cssText = 'margin:0;padding:0;list-style:none';
  for (const id of ['a', 'b', 'c']) {
    const li = document.createElement('li');
    li.dataset.id = id;
    li.tabIndex = 0;
    li.style.cssText = 'height:40px';
    list.appendChild(li);
  }
  root.appendChild(list);
  return list;
}

const order = (list: HTMLElement) =>
  Array.from(list.children).map((c) => (c as HTMLElement).dataset.id);

function key(target: HTMLElement, k: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }));
}

describe('keyboard reordering', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reorders in the light DOM', () => {
    const list = buildList(document.body);
    sortable(list, { animation: 0 });
    const first = list.children[0] as HTMLElement;
    key(first, ' ');
    key(first, 'ArrowDown');
    key(first, ' ');
    expect(order(list)).toEqual(['b', 'a', 'c']);
  });

  it('reorders inside a shadow root', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const list = buildList(shadow);
    sortable(list, { animation: 0 });

    const first = list.children[0] as HTMLElement;
    first.focus();
    key(first, ' ');
    key(first, 'ArrowDown');
    key(first, ' ');

    expect(order(list)).toEqual(['b', 'a', 'c']);
  });
});
```

- [ ] **Step 8: Run it to confirm the shadow case fails**

Run: `pnpm test:browser -- sortable-keyboard`
Expected: the light-DOM test PASSES, the shadow-root test FAILS with the order unchanged. That is D4 exactly: `event.target` retargets to the host, so no item is found.

- [ ] **Step 9: Extract keyboard handling, fixed**

```ts
// src/sortable/keyboard.ts
import { CLASS } from '../core/constants';
import * as flip from '../core/flip';
import type { Handle } from '../core/types';
import { announce } from './live-region';
import type { Instance } from './registry';
import type { SortEvent } from './types';
import { placeAt } from './place';

export interface KeyboardDeps {
  animation: number;
  isDisabled(): boolean;
  onSort?(event: SortEvent): void;
}

/**
 * Reordering with the keyboard: space to lift, arrows to move, space to drop,
 * escape to cancel. Each step is announced.
 */
export function bindKeyboard(instance: Instance, deps: KeyboardDeps): Handle {
  const { container } = instance;
  let lifted: HTMLElement | null = null;
  let liftedFrom = 0;

  function onKeyDown(event: KeyboardEvent) {
    if (deps.isDisabled()) return;

    // composedPath()[0] rather than event.target: inside a shadow root the
    // target retargets to the host element, so target-based lookup finds
    // nothing and keyboard reordering silently does nothing.
    const origin = event.composedPath()[0];
    if (!(origin instanceof Node)) return;

    const list = instance.items();
    const current =
      lifted ?? list.find((node) => node === origin || node.contains(origin)) ?? null;
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
        lifted = null;
      } else {
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
```

`placeAt` and `childrenOf` move to `src/sortable/place.ts`, shared by `index.ts` and `keyboard.ts` — they were previously module-private helpers used by both halves of the file.

- [ ] **Step 10: Assemble `sortable/index.ts`**

Port the remainder of the old `sortable.ts` into `src/sortable/index.ts`, with the keyboard block replaced by `bindKeyboard(instance, {...})`, `registry` calls replaced by `registerList`/`unregisterList`/`eachList`, and `announce`'s inline definition replaced by the imports. Add `acquireLiveRegion()` at bind time and `releaseLiveRegion()` in `destroy()`, but only when `options.keyboard !== false` — a list with keyboard support turned off has nothing to announce.

Delete `src/sortable.ts`. Update `src/index.ts`:

```ts
export { sortable, orderOf } from './sortable/index';
export type { SortableOptions, SortEvent, SortLocation } from './sortable/types';
```

- [ ] **Step 11: Run everything**

Run: `pnpm test:unit && pnpm test:browser && pnpm exec tsc --noEmit`
Expected: PASS throughout, including both keyboard tests.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor: split sortable into registry, live region and keyboard

Fixes three defects on the way: the registry now lives on globalThis so
duplicate copies of the library share it, the live region is refcounted
and no longer squats a global id, and keyboard reordering uses
composedPath so it works inside a shadow root."
```

---

## Task 11: One teardown path and cached container rects (D2, P1, P2)

**Files:**
- Modify: `src/sortable/index.ts`
- Test: `test/browser/sortable-lifecycle.test.ts` (create)

**Interfaces:**
- Consumes: everything from Task 10.
- Produces: no public signature change.

- [ ] **Step 1: Write the failing test**

```ts
// test/browser/sortable-lifecycle.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sortable } from '../../src/sortable';
import { flush } from '../../src/core/scheduler';

function list(count: number) {
  const ul = document.createElement('ul');
  ul.style.cssText = 'margin:0;padding:0;list-style:none;width:200px';
  for (let i = 0; i < count; i++) {
    const li = document.createElement('li');
    li.dataset.id = String(i);
    li.style.cssText = 'height:50px';
    ul.appendChild(li);
  }
  document.body.appendChild(ul);
  return ul;
}

const base = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, bubbles: true, cancelable: true };

function press(el: HTMLElement, x: number, y: number) {
  el.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: x, clientY: y }));
  window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: x, clientY: y + 5 }));
  flush();
}

function release(x: number, y: number) {
  window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: x, clientY: y }));
  flush();
}

describe('sortable lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('leaves nothing behind when onStart refuses the drag', () => {
    const ul = list(3);
    sortable(ul, { distance: 0, animation: 0, onStart: () => false });
    const item = ul.children[0] as HTMLElement;
    const before = { position: item.style.position, zIndex: item.style.zIndex };

    const listeners = vi.spyOn(window, 'addEventListener');
    press(item, 10, 10);
    release(10, 15);

    expect(item.style.position).toBe(before.position);
    expect(item.style.zIndex).toBe(before.zIndex);
    expect(item.className).toBe('');
    listeners.mockRestore();
  });

  it('removes its scroll listener when onStart refuses the drag', () => {
    const ul = list(3);
    sortable(ul, { distance: 0, animation: 0, onStart: () => false });
    const item = ul.children[0] as HTMLElement;

    const removed: string[] = [];
    const originalRemove = window.removeEventListener.bind(window);
    const originalAdd = window.addEventListener.bind(window);
    let added = 0;
    vi.spyOn(window, 'addEventListener').mockImplementation((type, ...rest) => {
      if (type === 'scroll') added++;
      return originalAdd(type, ...(rest as [never]));
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, ...rest) => {
      if (type === 'scroll') removed.push(type);
      return originalRemove(type, ...(rest as [never]));
    });

    press(item, 10, 10);
    release(10, 15);

    expect(removed.length).toBe(added);
    vi.restoreAllMocks();
  });

  it('measures each container once per drag, not once per move', () => {
    const a = list(3);
    const b = list(3);
    sortable(a, { group: 'g', distance: 0, animation: 0 });
    sortable(b, { group: 'g', distance: 0, animation: 0 });

    const item = a.children[0] as HTMLElement;
    const spy = vi.spyOn(b, 'getBoundingClientRect');
    press(item, 10, 10);
    const afterStart = spy.mock.calls.length;

    for (let i = 0; i < 20; i++) {
      window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: 10, clientY: 20 + i }));
      flush();
    }
    release(10, 40);

    // Twenty moves must not add twenty measurements of the other container.
    expect(spy.mock.calls.length - afterStart).toBeLessThan(5);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:browser -- sortable-lifecycle`
Expected: all three FAIL — the item keeps `position`/`zIndex`/class, the scroll listener is never removed, and the other container is measured on every move.

- [ ] **Step 3: Restructure into `beginDrag` / `endDrag`**

In `src/sortable/index.ts`, replace the body of `onStart` so that every mutation happens through one function which has exactly one inverse, and consult the consumer *before* mutating anything:

```ts
/** Everything a live drag owns. Nulled by endDrag, never partially. */
interface Live {
  item: HTMLElement;
  fromContainer: HTMLElement;
  fromIndex: number;
  restorePosition: string;
  restoreZIndex: string;
}

let live: Live | null = null;

function beginDrag(found: HTMLElement, from: SortLocation): void {
  live = {
    item: found,
    fromContainer: from.container,
    fromIndex: from.index,
    restorePosition: found.style.position,
    restoreZIndex: found.style.zIndex,
  };

  window.addEventListener('scroll', applyMove, { capture: true, passive: true });

  if (getComputedStyle(found).position === 'static') found.style.position = 'relative';
  found.style.zIndex = String(options.zIndex ?? DEFAULTS.zIndex);
  found.classList.add(CLASS.sorting);
}

function endDrag(): void {
  if (!live) return;
  window.removeEventListener('scroll', applyMove, { capture: true } as EventListenerOptions);
  scroller?.stop();
  scroller = null;

  live.item.style.position = live.restorePosition;
  live.item.style.zIndex = live.restoreZIndex;
  live.item.classList.remove(CLASS.sorting);

  live = null;
  cachedSiblings = [];
  cachedRects = [];
  cacheHost = null;
  candidates = [];
}
```

and in the pointer binding:

```ts
onStart(session) {
  if (disabled) return false;

  const list = instance.items();
  const found = session.path.find(
    (node) => node instanceof HTMLElement && list.includes(node),
  ) as HTMLElement | undefined;
  if (!found) return false;

  const from = { container, index: list.indexOf(found) };

  // Ask before touching anything. A refusal must leave the page exactly as
  // it was — previously the listener and the lifted styles were already
  // applied by this point and nothing reverted them.
  if (options.onStart?.(found, from) === false) return false;

  beginDrag(found, from);
  // ... measurement, scale, rtl, cache, autoscroll setup ...
  return true;
},
```

`onEnd` calls `endDrag()` on every path, including the cancelled one, after emitting `onSort`.

- [ ] **Step 4: Cache the candidate container rects (P1)**

Add a drag-scoped array measured in `beginDrag` and refreshed by `refreshCache`:

```ts
interface Candidate {
  instance: Instance;
  box: Box;
}

let candidates: Candidate[] = [];

/**
 * Which lists this drag could possibly land in, measured once.
 *
 * hostFor used to call getBoundingClientRect on every registered list on every
 * pointer move — a forced synchronous layout per list per move, which on a
 * twenty-column board is twenty reflows a frame.
 */
function measureCandidates(): void {
  candidates = [];
  for (const candidate of eachList()) {
    const sameGroup =
      candidate.options.group != null && candidate.options.group === instance.options.group;
    if (candidate !== instance && !sameGroup) continue;
    if (!candidate.container.isConnected) continue;
    candidates.push({ instance: candidate, box: boxOf(candidate.container) });
  }
}

function hostFor(point: Point): Instance {
  for (const candidate of candidates) {
    if (candidate.instance === host && contains(candidate.box, point)) return host;
  }
  for (const candidate of candidates) {
    if (contains(candidate.box, point)) return candidate.instance;
  }
  return host;
}
```

Call `measureCandidates()` from `beginDrag` and from `refreshCache`, so the same scroll and host-change signals that already invalidate `cachedRects` invalidate these too.

- [ ] **Step 5: Fix the duplicated `getComputedStyle` (P2)**

Replace the two-call expression:

```ts
const containerStyle = getComputedStyle(container);
const scrollsItself = /auto|scroll|overlay/.test(
  containerStyle.overflowY + containerStyle.overflowX,
);
```

- [ ] **Step 6: Run everything**

Run: `pnpm test:browser -- sortable`
Expected: PASS, including the three lifecycle tests.

Run: `pnpm test:unit && pnpm test:browser`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: single teardown path in sortable, and stop reflowing per move

A refused onStart left a window scroll listener attached and the item
permanently lifted, because mutation happened before the consumer was
asked. hostFor also measured every registered list on every pointer move;
candidate rects are now measured once per drag."
```

---

## Task 12: `resizable` — extract handles, revert only what we set (D3, S4, §3 anchors)

**Files:**
- Create: `src/resizable/handles.ts`, `src/resizable/index.ts`
- Delete: `src/resizable.ts`
- Modify: `src/index.ts`
- Test: `test/browser/resizable-lifecycle.test.ts`

**Interfaces:**
- Consumes: `CLASS`, `ATTR`, `DEFAULTS`, `handleClass` from `constants.ts`.
- Produces: `resolveHandles(el: HTMLElement, spec: ResizableOptions['handles']): ResolvedHandle[]` where `ResolvedHandle = { name: HandleName; node: HTMLElement; direction: [-1|0|1, -1|0|1]; created: boolean }`.

- [ ] **Step 1: Write the failing test**

```ts
// test/browser/resizable-lifecycle.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resizable } from '../../src/resizable';
import { ATTR, CLASS } from '../../src/core/constants';

describe('resizable lifecycle', () => {
  let el: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    el = document.createElement('div');
    el.style.cssText = 'width:200px;height:150px';
    document.body.appendChild(el);
  });

  it('leaves a host page’s inline position alone when using supplied handles', () => {
    el.style.position = 'sticky';
    const grip = document.createElement('span');
    el.appendChild(grip);

    const handle = resizable(el, { handles: { se: grip } });
    handle.destroy();

    expect(el.style.position).toBe('sticky');
  });

  it('restores the position it found when it created handles', () => {
    el.style.position = 'sticky';
    const handle = resizable(el, { handles: ['se'] });
    handle.destroy();
    expect(el.style.position).toBe('sticky');
  });

  it('gives a static element a position, then takes it away again', () => {
    const handle = resizable(el, { handles: ['se'] });
    expect(getComputedStyle(el).position).toBe('relative');
    handle.destroy();
    expect(el.style.position).toBe('');
  });

  it('anchors load-bearing handle styles inline, beyond a host reset', () => {
    const reset = document.createElement('style');
    reset.textContent = '* { position: static; touch-action: auto }';
    document.head.appendChild(reset);

    resizable(el, { handles: ['se'] });
    const grip = el.querySelector(`[${ATTR.handle}="se"]`) as HTMLElement;

    expect(getComputedStyle(grip).position).toBe('absolute');
    expect(getComputedStyle(grip).touchAction).toBe('none');
    reset.remove();
  });

  it('removes only the handles it created', () => {
    const mine = document.createElement('span');
    el.appendChild(mine);
    const handle = resizable(el, { handles: { se: mine } });
    handle.destroy();

    expect(el.contains(mine)).toBe(true);
    expect(mine.hasAttribute(ATTR.handle)).toBe(false);
    expect(el.classList.contains(CLASS.resizable)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:browser -- resizable-lifecycle`
Expected: the first test FAILS (`position` becomes `''`, wiping `sticky`) and the fourth FAILS (the reset wins over the stylesheet).

- [ ] **Step 3: Write `handles.ts`**

```ts
// src/resizable/handles.ts
import { ATTR, CLASS, handleClass } from '../core/constants';
import { invariant } from '../core/invariant';
import { ALL_HANDLES, directionOf, type HandleName } from '../core/resize-math';

export interface ResolvedHandle {
  name: HandleName;
  node: HTMLElement;
  direction: [-1 | 0 | 1, -1 | 0 | 1];
  /** True when the library made this element and must therefore remove it. */
  created: boolean;
}

export type HandleSpec = HandleName[] | Partial<Record<HandleName, string | HTMLElement>>;

/**
 * `position` and `touch-action` are written inline rather than left to the
 * stylesheet because they are load-bearing: a host reset of `* { position:
 * static }` would detach every handle, and `touch-action: auto` would stop
 * touch resizing outright. Inline styles are beyond the reach of any host
 * stylesheet, so the library keeps working even when styles.css is never
 * loaded — at which point the stylesheet only governs appearance.
 */
function anchor(node: HTMLElement): void {
  node.style.position = 'absolute';
  node.style.touchAction = 'none';
}

/**
 * Turn the two accepted `handles` shapes into one list.
 *
 * The array form asks the library to create elements; the object form binds to
 * elements the caller already has. Only the former may be removed on destroy.
 */
export function resolveHandles(el: HTMLElement, spec: HandleSpec | undefined): ResolvedHandle[] {
  const supplied = Array.isArray(spec) || !spec ? null : spec;
  const names = (supplied ? Object.keys(supplied) : (spec as HandleName[] | undefined) ?? ALL_HANDLES) as HandleName[];

  const out: ResolvedHandle[] = [];
  for (const name of names) {
    const direction = directionOf(name);
    invariant(direction, `resizable() got an unknown handle name: ${String(name)}`);
    if (!direction) continue;

    if (supplied) {
      const target = supplied[name];
      const node = typeof target === 'string' ? el.querySelector<HTMLElement>(target) : (target ?? null);
      invariant(node, `resizable() could not find the handle element for "${name}"`);
      if (!node) continue;
      node.setAttribute(ATTR.handle, name);
      anchor(node);
      out.push({ name, node, direction, created: false });
    } else {
      const node = document.createElement('span');
      node.className = `${CLASS.handle} ${handleClass(name)}`;
      node.setAttribute(ATTR.handle, name);
      node.setAttribute('aria-hidden', 'true');
      anchor(node);
      el.appendChild(node);
      out.push({ name, node, direction, created: true });
    }
  }
  return out;
}
```

One judgement call recorded here: `anchor()` runs on supplied handles too. A caller-supplied handle still has to be absolutely positioned relative to the target for the library's geometry to hold, so this is a correctness requirement rather than a style preference.

- [ ] **Step 4: Rewrite `resizable/index.ts` to revert only what it set**

```ts
const handles = resolveHandles(el, options.handles);
const createdAny = handles.some((h) => h.created);

// Positioning context is only needed for handles the library places itself.
let restorePosition: string | null = null;
if (createdAny && getComputedStyle(el).position === 'static') {
  restorePosition = el.style.position;
  el.style.position = 'relative';
}
el.classList.add(CLASS.resizable);
```

and in `destroy()`:

```ts
destroy() {
  for (const binding of bindings) binding.destroy();
  for (const handle of handles) {
    if (handle.created) handle.node.remove();
    else {
      handle.node.removeAttribute(ATTR.handle);
      handle.node.style.position = '';
      handle.node.style.touchAction = '';
    }
  }
  // Only revert a position we actually assigned. Writing unconditionally
  // wiped whatever inline position the host page had.
  if (restorePosition !== null) el.style.position = restorePosition;
  el.classList.remove(CLASS.resizable, CLASS.resizing);
}
```

Port the rest of the old `resizable.ts` across unchanged, iterating `handles` instead of `names`. Delete `src/resizable.ts` and update `src/index.ts` to `export { resizable } from './resizable/index';`.

- [ ] **Step 5: Run the tests**

Run: `pnpm test:browser -- resizable`
Expected: PASS, 5 tests on three engines.

Run: `pnpm test:unit && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix: resizable destroy no longer wipes host inline position

destroy() assigned el.style.position unconditionally, so on the
supplied-handles path — where the library never set it — it overwrote
whatever the host page had. Handle resolution moves to its own module and
load-bearing handle styles are now anchored inline, beyond host resets."
```

---

## Task 13: Extract `reconcileAspect` from `computeResize` (S4)

**Files:**
- Modify: `src/core/resize-math.ts:39-96`
- Test: `test/unit/resize-math.test.ts` (extend)

**Interfaces:**
- Consumes: nothing.
- Produces: `reconcileAspect(width: number, height: number, aspect: number, limits: ResizeLimits): { width: number; height: number }`, exported for direct testing.

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/resize-math.test.ts — append
import { reconcileAspect } from '../../src/core/resize-math';

describe('reconcileAspect', () => {
  const limits = { minWidth: 50, minHeight: 50, maxWidth: 400, maxHeight: 200 };

  it('leaves a legal ratio alone', () => {
    expect(reconcileAspect(200, 100, 2, limits)).toEqual({ width: 200, height: 100 });
  });

  it('prefers the smaller box when both axes could lead', () => {
    const result = reconcileAspect(300, 100, 2, limits);
    expect(result.width / result.height).toBeCloseTo(2, 5);
    expect(result.width).toBeLessThanOrEqual(300);
  });

  it('leads with height when width would exceed the maximum', () => {
    const result = reconcileAspect(400, 100, 4, limits);
    expect(result.width).toBeLessThanOrEqual(limits.maxWidth);
    expect(result.height).toBeLessThanOrEqual(limits.maxHeight);
  });

  it('gives up rather than lie when no legal box holds the ratio', () => {
    const tight = { minWidth: 390, minHeight: 190, maxWidth: 400, maxHeight: 200 };
    const result = reconcileAspect(395, 195, 10, tight);
    expect(result.width).toBeGreaterThanOrEqual(tight.minWidth);
    expect(result.width).toBeLessThanOrEqual(tight.maxWidth);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:unit -- resize-math`
Expected: FAIL — `reconcileAspect` is not exported.

- [ ] **Step 3: Extract it**

Replace lines 66–88 of `resize-math.ts` with a call, and add the function above `computeResize`:

```ts
/**
 * Restore a width-to-height ratio that clamping has broken.
 *
 * Clamping happens per axis, so a box that was on-ratio before it hit a limit
 * is off-ratio after. Rebuild from whichever axis still yields a legal box,
 * preferring the smaller of the two so a maximum is never exceeded.
 *
 * When neither axis yields a legal box the clamped size is returned as-is: the
 * limits and the ratio are in genuine conflict, and honouring the limits is
 * the less surprising of the two failures.
 */
export function reconcileAspect(
  width: number,
  height: number,
  aspect: number,
  limits: ResizeLimits,
): { width: number; height: number } {
  const fromWidth = { width, height: width / aspect };
  const fromHeight = { width: height * aspect, height };

  const widthLegal =
    fromWidth.height >= limits.minHeight && fromWidth.height <= limits.maxHeight;
  const heightLegal =
    fromHeight.width >= limits.minWidth && fromHeight.width <= limits.maxWidth;

  if (widthLegal && heightLegal) {
    return fromWidth.width * fromWidth.height <= fromHeight.width * fromHeight.height
      ? fromWidth
      : fromHeight;
  }
  if (widthLegal) return fromWidth;
  if (heightLegal) return fromHeight;
  return { width, height };
}
```

and in `computeResize`:

```ts
if (aspect && aspect > 0) {
  ({ width, height } = reconcileAspect(width, height, aspect, limits));
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test:unit -- resize-math`
Expected: PASS — both the new tests and the existing ones, which pin the current behaviour and must not change.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: extract reconcileAspect from computeResize

25 lines of ratio reconciliation inlined mid-function, now testable on
its own and documented as to why it prefers the smaller box."
```

---

## Task 14: Tidy `flip.play`'s two-pass structure (P3)

**Files:**
- Modify: `src/core/flip.ts:29-51`
- Test: `test/browser/flip.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: no signature change.

The two passes are correct and must stay — cancelling an animation changes an element's rendered position, so cancelling inside the measuring loop would corrupt every later measurement. The fix is to remove the unused binding and say why the structure is what it is, so it does not get "simplified" into a bug later.

- [ ] **Step 1: Write the failing test**

```ts
// test/browser/flip.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import * as flip from '../../src/core/flip';

describe('flip', () => {
  let items: HTMLElement[];

  beforeEach(() => {
    document.body.innerHTML = '';
    const wrap = document.createElement('div');
    items = ['a', 'b', 'c'].map((id) => {
      const el = document.createElement('div');
      el.dataset.id = id;
      el.style.cssText = 'height:40px;width:100px';
      wrap.appendChild(el);
      return el;
    });
    document.body.appendChild(wrap);
  });

  it('animates elements that moved', () => {
    const before = flip.record(items);
    items[0].parentElement!.appendChild(items[0]);
    flip.play(before, 200);
    expect(items[0].getAnimations().length).toBe(1);
  });

  it('does not animate elements that stayed put', () => {
    const before = flip.record(items);
    flip.play(before, 200);
    expect(items[1].getAnimations().length).toBe(0);
  });

  it('measures every element before cancelling any animation', () => {
    // A second reorder while the first is still animating must land on the
    // positions elements are actually at, not on positions corrupted by a
    // cancel that happened mid-measure.
    const first = flip.record(items);
    items[0].parentElement!.appendChild(items[0]);
    flip.play(first, 200);

    const second = flip.record(items);
    items[2].parentElement!.prepend(items[2]);
    expect(() => flip.play(second, 200)).not.toThrow();
    expect(items[0].getAnimations().length).toBeLessThanOrEqual(1);
  });

  it('cancels everything on stopAll', () => {
    const before = flip.record(items);
    items[0].parentElement!.appendChild(items[0]);
    flip.play(before, 200);
    flip.stopAll(items);
    expect(items[0].getAnimations().length).toBe(0);
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm test:browser -- flip`
Expected: PASS on the first two, and the suite surfaces whether the third holds today. If it already passes, the tests are still worth having — they pin the structure this task is about to document.

- [ ] **Step 3: Tidy the implementation**

```ts
/** Play everything back from the snapshot to wherever the DOM has put them. */
export function play(before: Map<HTMLElement, Box>, duration = DEFAULTS.animation): void {
  if (!canAnimate() || reducedMotion() || duration <= 0) return;

  // Two passes, deliberately. Cancelling an animation snaps its element to its
  // final position, which changes layout for everything after it — so every
  // cancel has to happen before any measurement. Merging these loops looks
  // like a tidy-up and is a correctness bug.
  for (const el of before.keys()) {
    running.get(el)?.cancel();
    running.delete(el);
  }

  for (const [el, from] of before) {
    if (!el.isConnected) continue;
    const to = boxOf(el);
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

    const animation = el.animate(
      [{ transform: `translate3d(${dx}px, ${dy}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
      { duration, easing: 'cubic-bezier(0.2, 0, 0, 1)', composite: 'add' },
    );
    running.set(el, animation);
    animation.finished.then(() => running.delete(el)).catch(() => running.delete(el));
  }
}
```

Add `import { DEFAULTS } from './constants';` and remove the hard-coded `180`.

- [ ] **Step 4: Run the tests**

Run: `pnpm test:browser -- flip`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: document why flip.play measures in two passes

Removes an unused destructured binding and explains the structure, which
reads like a redundant loop but is load-bearing: cancelling an animation
moves its element, so cancels must precede measurements."
```

---

## Task 15: CSS isolation — rename, `@layer`, and the constants parity test (§3, S3)

**Files:**
- Modify: `src/styles.css`, every remaining `dk-` reference, `README.md`
- Test: `test/browser/styles.test.ts` (create)

**Interfaces:**
- Consumes: `CLASS`, `ATTR`, `DEFAULTS`, `handleClass`.
- Produces: the public class contract `detent-dragging`, `detent-sorting`, `detent-sortable`, `detent-resizable`, `detent-resizing`, `detent-handle`, `detent-handle-{n,e,s,w,ne,nw,se,sw}`, and the `--detent-handle-size` custom property.

- [ ] **Step 1: Write the failing test**

```ts
// test/browser/styles.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import styles from '../../src/styles.css?raw';
import { ATTR, CLASS, DEFAULTS, PREFIX, handleClass } from '../../src/core/constants';
import { ALL_HANDLES } from '../../src/core/resize-math';
import { resizable } from '../../src/resizable';

function loadStyles(): HTMLStyleElement {
  const tag = document.createElement('style');
  tag.textContent = styles;
  document.head.appendChild(tag);
  return tag;
}

describe('stylesheet contract', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style').forEach((s) => s.remove());
  });

  it('carries no leftover dk- prefix', () => {
    expect(styles).not.toMatch(/\bdk-/);
  });

  it('never uses !important', () => {
    expect(styles).not.toMatch(/!\s*important/);
  });

  it('ships inside the detent cascade layer', () => {
    expect(styles).toMatch(new RegExp(`@layer\\s+${PREFIX}\\b`));
  });

  it('declares a handle size matching the TypeScript default', () => {
    const match = /--detent-handle-size:\s*(\d+)px/.exec(styles);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(DEFAULTS.handleSize);
  });

  it('styles every handle direction the library can create', () => {
    for (const name of ALL_HANDLES) {
      expect(styles).toContain(handleClass(name));
    }
  });

  it('lets an unlayered host rule win, because it is in a layer', () => {
    loadStyles();
    const host = document.createElement('style');
    host.textContent = `.${CLASS.handle} { width: 40px }`;
    document.head.appendChild(host);

    const el = document.createElement('div');
    el.style.cssText = 'width:200px;height:150px';
    document.body.appendChild(el);
    resizable(el, { handles: ['se'] });

    const grip = el.querySelector(`[${ATTR.handle}="se"]`) as HTMLElement;
    expect(getComputedStyle(grip).width).toBe('40px');
  });
});
```

The last test is the whole point of the layer: a consumer's plain, low-specificity rule beats the library with no `!important` and no specificity war.

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm test:browser -- styles`
Expected: FAIL — the stylesheet is unlayered and still uses `dk-`. Add `?raw` support by ensuring Vite handles it, which it does natively.

- [ ] **Step 3: Rewrite the stylesheet**

```css
/*
 * Everything here is overridable on purpose.
 *
 * The whole sheet sits in a cascade layer, and unlayered author CSS beats
 * layered author CSS at any specificity — so a plain `.detent-handle { ... }`
 * in your own stylesheet wins with no specificity war and no !important.
 *
 * The three declarations the library cannot work without — a handle's
 * `position` and `touch-action`, and a static target's `position` — are not
 * here. They are written inline at element creation time, where no host
 * stylesheet can reach them. This sheet governs appearance only, and the
 * library stays functional if you never load it.
 */

@layer detent {
  .detent-resizable {
    box-sizing: border-box;
  }

  .detent-handle {
    --detent-handle-size: 12px;
    --detent-handle-inset: calc(var(--detent-handle-size) / -2);
  }

  .detent-handle-n,
  .detent-handle-s {
    left: var(--detent-handle-size);
    right: var(--detent-handle-size);
    height: var(--detent-handle-size);
    cursor: ns-resize;
  }

  .detent-handle-e,
  .detent-handle-w {
    top: var(--detent-handle-size);
    bottom: var(--detent-handle-size);
    width: var(--detent-handle-size);
    cursor: ew-resize;
  }

  .detent-handle-n { top: var(--detent-handle-inset); }
  .detent-handle-s { bottom: var(--detent-handle-inset); }
  .detent-handle-e { right: var(--detent-handle-inset); }
  .detent-handle-w { left: var(--detent-handle-inset); }

  .detent-handle-ne,
  .detent-handle-nw,
  .detent-handle-se,
  .detent-handle-sw {
    width: var(--detent-handle-size);
    height: var(--detent-handle-size);
  }

  .detent-handle-ne { top: var(--detent-handle-inset); right: var(--detent-handle-inset); cursor: nesw-resize; }
  .detent-handle-nw { top: var(--detent-handle-inset); left: var(--detent-handle-inset); cursor: nwse-resize; }
  .detent-handle-se { bottom: var(--detent-handle-inset); right: var(--detent-handle-inset); cursor: nwse-resize; }
  .detent-handle-sw { bottom: var(--detent-handle-inset); left: var(--detent-handle-inset); cursor: nesw-resize; }

  .detent-dragging,
  .detent-sorting {
    will-change: transform;
  }

  [data-detent-dragging] {
    cursor: grabbing;
  }

  @media (prefers-reduced-motion: reduce) {
    .detent-dragging,
    .detent-sorting {
      will-change: auto;
    }
  }
}
```

- [ ] **Step 4: Complete the rename**

The TypeScript side already reads from `constants.ts` after Task 2, so this is a one-line change there:

```bash
# In src/core/constants.ts the PREFIX is already 'detent'; verify no stragglers.
grep -rn "dk-" src/ test/ e2e/ README.md
```

Expected: no matches. Update any test asserting on `dk-*` class names to import from `constants.ts` rather than hard-coding the new names — a test that hard-codes `'detent-dragging'` reintroduces exactly the duplication this phase removed.

- [ ] **Step 5: Run everything**

Run: `pnpm test:browser -- styles`
Expected: PASS, 6 tests.

Run: `pnpm test:unit && pnpm test:browser && node build.mjs`
Expected: PASS, and the build emits `dist/styles.css` with the layer intact (esbuild preserves `@layer`).

- [ ] **Step 6: Update the README's class documentation**

Add a short section documenting the class contract, the cascade layer, and the guarantee that the library works without the stylesheet.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat!: rename dk-* to detent-* and ship styles in a cascade layer

BREAKING CHANGE: every class is renamed from dk-* to detent-*.

Styles now sit in @layer detent, so an unlayered host rule wins at any
specificity — theming needs no !important. The three declarations the
library cannot function without are anchored inline instead, so a host
CSS reset cannot break it and the library works with no stylesheet at all."
```

---

## Task 16: The hostile-page fixture (Tier 3)

**Files:**
- Create: `e2e/fixtures/hostile.html`, `e2e/hostile.spec.ts`, `e2e/fixtures/main.ts`
- Modify: `test/unit/helpers.ts` (delete `layout`, `stack`, `row`), the unit tests that depended on them
- Modify: `package.json`

**Interfaces:**
- Consumes: the built library.
- Produces: `pnpm test:e2e`, run in CI in Phase 2.

- [ ] **Step 1: Build the adversarial page**

```html
<!-- e2e/fixtures/hostile.html -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>detent — hostile host page</title>
<link rel="stylesheet" href="/src/styles.css">
<style>
  /* Every one of these is something a real site does. */
  * { box-sizing: border-box; position: static; touch-action: auto; }
  html { scroll-behavior: smooth; }
  body { margin: 0; font: 14px system-ui; }
  header { position: sticky; top: 0; z-index: 9999; background: #eee; padding: 8px; }

  ul { margin: 0; padding: 0; list-style: none; }
  li { height: 48px; border: 1px solid #ccc; background: #fff; }

  #scaled { transform: scale(0.75); transform-origin: 0 0; width: 400px; }
  #rtl { direction: rtl; display: flex; width: 300px; }
  #rtl li { width: 100px; height: 60px; }
  #tall { overflow: auto; height: 200px; width: 260px; }

  /* A host page restyling the library's handles. Must win: no !important here. */
  .detent-handle { background: rgb(255, 0, 0); }

  #box { width: 200px; height: 150px; border: 2px solid #333; }
</style>
</head>
<body>
  <header id="chrome">sticky site chrome</header>

  <h2>plain list</h2>
  <ul id="plain"><li data-id="a">a</li><li data-id="b">b</li><li data-id="c">c</li></ul>

  <h2>inside a scaled stage</h2>
  <div id="scaled"><ul id="scaled-list"><li data-id="a">a</li><li data-id="b">b</li><li data-id="c">c</li></ul></div>

  <h2>rtl row</h2>
  <ul id="rtl"><li data-id="a">a</li><li data-id="b">b</li><li data-id="c">c</li></ul>

  <h2>scrolling list</h2>
  <div id="tall"><ul id="tall-list"></ul></div>

  <h2>shadow host</h2>
  <div id="shadow-host"></div>

  <h2>resizable</h2>
  <div id="box"></div>

  <script type="module" src="./main.ts"></script>
</body>
</html>
```

```ts
// e2e/fixtures/main.ts
import { resizable, sortable } from '../../src/index';

for (let i = 0; i < 20; i++) {
  const li = document.createElement('li');
  li.dataset.id = `t${i}`;
  li.textContent = `t${i}`;
  document.querySelector('#tall-list')!.appendChild(li);
}

const shadow = document.querySelector('#shadow-host')!.attachShadow({ mode: 'open' });
const shadowList = document.createElement('ul');
shadowList.id = 'shadow-list';
for (const id of ['a', 'b', 'c']) {
  const li = document.createElement('li');
  li.dataset.id = id;
  li.tabIndex = 0;
  li.textContent = id;
  li.style.cssText = 'height:48px;border:1px solid #ccc';
  shadowList.appendChild(li);
}
shadow.appendChild(shadowList);

const common = { distance: 0, animation: 0 } as const;
sortable(document.querySelector('#plain')!, common);
sortable(document.querySelector('#scaled-list')!, common);
sortable(document.querySelector('#rtl')!, common);
sortable(document.querySelector('#tall-list')!, common);
sortable(shadowList, common);
resizable(document.querySelector('#box')!, { handles: ['se'] });

// A second copy of the registry, standing in for a duplicate bundled copy.
(window as unknown as { detentReady: boolean }).detentReady = true;
```

- [ ] **Step 2: Write the spec, one assertion per hazard**

```ts
// e2e/hostile.spec.ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixtures/hostile.html');
  await page.waitForFunction(() => (window as never as { detentReady: boolean }).detentReady);
});

const ids = (selector: string) => `[...document.querySelectorAll('${selector} li')].map(l => l.dataset.id)`;

test('a host reset cannot detach the resize handles', async ({ page }) => {
  const handle = page.locator('#box [data-detent-handle="se"]');
  await expect(handle).toHaveCSS('position', 'absolute');
  await expect(handle).toHaveCSS('touch-action', 'none');
});

test('a host rule restyles handles without !important', async ({ page }) => {
  await expect(page.locator('#box [data-detent-handle="se"]')).toHaveCSS(
    'background-color',
    'rgb(255, 0, 0)',
  );
});

test('reordering works in a plain list', async ({ page }) => {
  const first = page.locator('#plain li').first();
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height * 1.6, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(ids('#plain'))).toEqual(['b', 'a', 'c']);
});

test('the element tracks the cursor inside a scaled stage', async ({ page }) => {
  const first = page.locator('#scaled-list li').first();
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height * 1.6, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(ids('#scaled-list'))).toEqual(['b', 'a', 'c']);
});

test('an rtl row reorders the way the user drags', async ({ page }) => {
  const first = page.locator('#rtl li').first();
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - box.width, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(ids('#rtl'))).toEqual(['b', 'c', 'a']);
});

test('auto-scroll advances despite scroll-behavior: smooth', async ({ page }) => {
  const list = page.locator('#tall');
  const box = (await list.boundingBox())!;
  const first = page.locator('#tall-list li').first();
  const item = (await first.boundingBox())!;

  await page.mouse.move(item.x + 10, item.y + item.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height - 4, { steps: 4 });
  await page.waitForTimeout(400);
  const scrolled = await list.evaluate((el) => el.scrollTop);
  await page.mouse.up();
  expect(scrolled).toBeGreaterThan(0);
});

test('keyboard reordering works inside a shadow root', async ({ page }) => {
  await page.evaluate(() => {
    const root = document.querySelector('#shadow-host')!.shadowRoot!;
    (root.querySelector('li') as HTMLElement).focus();
  });
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(' ');

  const order = await page.evaluate(() =>
    [...document.querySelector('#shadow-host')!.shadowRoot!.querySelectorAll('li')].map(
      (l) => (l as HTMLElement).dataset.id,
    ),
  );
  expect(order).toEqual(['b', 'a', 'c']);
});

test('the library leaves no live region behind when nothing is sorting', async ({ page }) => {
  const count = await page.locator('[data-detent-live-region]').count();
  expect(count).toBeLessThanOrEqual(1);
});

test('the sticky header does not swallow the dragged item', async ({ page }) => {
  const header = await page.locator('#chrome').evaluate((el) => getComputedStyle(el).zIndex);
  expect(header).toBe('9999');
  // Documented limitation: the item is above its list siblings, not above
  // site chrome. Asserting the documented behaviour so a change is noticed.
  const item = page.locator('#plain li').first();
  const box = (await item.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height * 1.6, { steps: 4 });
  const z = await item.evaluate((el) => el.style.zIndex);
  await page.mouse.up();
  expect(z).toBe('20');
});
```

- [ ] **Step 3: Add a no-stylesheet variant**

Copy `hostile.html` to `e2e/fixtures/no-styles.html` with the `<link rel="stylesheet">` removed, and add one spec asserting drag, sort and resize all still function — this is the §3 guarantee that the stylesheet governs appearance only.

- [ ] **Step 4: Run it**

Run: `pnpm test:e2e`
Expected: PASS on Chromium, Firefox and WebKit. Any failure here is a real bug in a real browser — fix the library, never the fixture.

- [ ] **Step 5: Delete the fake-layout helpers**

Remove `layout`, `stack` and `row` from `test/unit/helpers.ts`. Any unit test that depended on them is testing geometry and belongs in the browser tier — move it to `test/browser/` and rewrite it against real layout. Keep `press`, `offsetOf`, `makeList` and `idsOf`, which do not fake anything.

Run: `pnpm test:unit && pnpm test:browser`
Expected: PASS. If a moved test now fails, that is a real defect the fake layout was hiding — record it and fix it before continuing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add the hostile host-page fixture

One page carrying every hazard a real site presents — an aggressive
reset, a scaled ancestor, rtl, smooth scrolling, a shadow root, a
z-index: 9999 header and a host rule restyling the handles — with an
assertion each. Also deletes the fake-layout helpers, so no test can
claim to exercise geometry without a layout engine again."
```

---

## Task 17: Document the class contract and the stacking-context limitation (H3)

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/notes/stacking-contexts.md`

**Interfaces:**
- Consumes: nothing.
- Produces: documentation only. This is the deliverable for H3, which has no code fix.

- [ ] **Step 1: Write the stacking-context note**

Cover: what a stacking context is, which properties create one (`transform`, `filter`, `opacity < 1`, `contain`, `will-change`, `isolation`), why a `z-index: 20` item cannot escape one, how to diagnose it (the dragged item disappears behind a sibling container rather than behind everything), and the two workarounds — raise the trapping ancestor's own `z-index`, or drag a clone appended to `document.body`. Include a worked example of each.

- [ ] **Step 2: Update the README**

Add a "Styling" section documenting the full class contract, the `@layer detent` behaviour, the `--detent-handle-size` custom property, and the guarantee that the library functions without the stylesheet. Add a "Known limitations" section linking the stacking-context note. Update every `dk-` reference.

- [ ] **Step 3: Verify the docs match the code**

Run: `grep -rn "dk-" README.md docs/`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: class contract, cascade layer, and stacking-context guidance

The stacking-context trap has no fix inside the library — an item cannot
paint above a sibling of an ancestor that establishes a context — so it
gets a diagnosis guide and two worked workarounds instead."
```

---

## Self-Review

**Spec coverage.** Every §2 item maps to a task: D1→4, D2→11, D3→12, D4→10, D5→8, D6→5, H1→7, H2→9, H3→17, H4→10, P1→11, P2→11, P3→14, S1→6, S2→2, S3→2+15, S4→2+12+13, §2.5→3. §3 CSS isolation → 12 (inline anchors), 15 (layer, rename), 10 (live region). §5 test tiers → 1 (infrastructure), 16 (hostile fixture). §1, §4, §6 and §7 are Phases 2–5 and out of scope here, by design.

**Type consistency.** `Instance` is defined in Task 10 and consumed by Tasks 10 and 11. `ResolvedHandle` is defined and consumed in Task 12. `scaleOf`/`unscale` are defined in Task 7 and consumed there. `queued()` is defined in Task 4 and used only by its own test. `placeAt` and `childrenOf` move to `sortable/place.ts` in Task 10 Step 9 and are consumed by both `index.ts` and `keyboard.ts`. `reconcileAspect` is defined and consumed in Task 13.

**One gap found and closed:** Task 10 referenced `placeAt` from `./place` before that module was introduced; Step 9 now states the move explicitly. Task 7 originally left the `origin` box in rendered coordinates while the offset was in layout coordinates, which would have broken bounds clamping under scale; Step 6 now converts both.

**Known ordering constraint.** Task 15's rename must come after Tasks 10 and 12 split the feature files, or the rename has to be applied twice. Tasks 4, 5, 6, 8, 9, 13 and 14 are independent of each other and may be reordered freely.
