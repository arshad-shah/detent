# detent — OSS hardening, monorepo, wrappers and docs

**Date:** 2026-09-09
**Status:** Approved, ready for planning

## Problem

`detent` is a ~1,500-line zero-dependency drag/sort/resize library with a good
core and no engineering scaffolding around it. It is not a git repository, has
no CI, no release process, no docs site, and no framework wrappers. Its test
suite hand-fakes layout, so a class of defects that only appear on real pages —
transformed ancestors, RTL, shadow DOM, host CSS resets — is invisible to it by
construction.

This document specifies turning it into a properly engineered open-source
project: a pnpm monorepo with Changesets-driven releases, GitHub CI, an Astro
Starlight documentation site, React/Svelte/Web Component wrappers, and a
hardened core validated against hostile host pages.

## Goals

1. The library survives being dropped into a hostile, complex host page.
2. Zero logic duplication; every constant has exactly one home.
3. Error handling that is necessary and no more — no swallowed host errors.
4. Framework wrappers that are discoverable and thin.
5. Every change arrives test-first.
6. A release you can cut by merging a PR.

## Non-goals

- Rewriting the core. The architecture is sound; this is repair and packaging.
- Drag-and-drop file uploads, virtualised lists, or a plugin system.
- Supporting frameworks beyond React, Svelte and Web Components.
- IE / non-Pointer-Events fallbacks.

---

## 1. Repository structure

```
detent/
├── packages/
│   ├── detent/            core. zero dependencies. all logic lives here.
│   ├── detent-react/      hooks + <Sortable>.  peer: react >= 18
│   ├── detent-svelte/     actions (use:draggable). peer: svelte >= 5
│   └── detent-elements/   <detent-sortable> custom elements. no peers.
├── apps/
│   └── docs/              Astro 7 + Starlight 0.42. private, not published.
├── e2e/                   Playwright specs incl. the hostile-page fixture.
├── docs/superpowers/      specs and plans (this file).
├── .changeset/
└── .github/workflows/     pr.yml, main.yml, docs.yml
```

**Package manager:** pnpm workspaces (`pnpm-workspace.yaml`). Node 24, pnpm 11.

**Naming:** unscoped (`detent`, `detent-react`, …). `detent` is confirmed
available on npm. Unscoped avoids a manual npm-org creation step.

**Dependency rule:** wrappers depend on core via `workspace:^`. Wrappers own
lifecycle and reactivity only — never geometry, never DOM measurement. A
wrapper file exceeding ~120 lines is a signal that logic belongs in core.

**Versioning:** Changesets in `linked` mode across all four packages, so a core
bump carries the wrappers with it and a user never has to reason about a
compatibility matrix.

---

## 2. Core hardening

Every item below is reproduced as a failing test before it is fixed. Line
references are to the pre-change source.

### 2.1 Correctness defects

**D1 — `paint()` defeats the scheduler.** `core/box.ts:38` passes a freshly
allocated closure to `scheduler.write()` on every call. The scheduler dedupes
its queue by function identity via a `Set`, so deduplication never occurs: a
120 Hz pointer stream queues 120 jobs per frame. The module's sole purpose is
defeated.
*Fix:* store one persistent painter function per element alongside its
`BoxState` in the existing `WeakMap`, and enqueue that.

**D2 — refused `onStart` leaks in `sortable`.** `sortable.ts:263–283` adds a
`window` scroll listener and mutates the item's `position`, `zIndex` and class
list *before* calling `options.onStart`. When a consumer returns `false`, the
pointer layer tears down its own session but nothing reverts any of this. The
result is a leaked capture-phase scroll listener on `window` and an item stuck
with a lifted z-index forever.
*Fix:* perform all consumer-visible mutation only after `onStart` has been
consulted, and route every mutation through a single `beginDrag` / `endDrag`
pair so there is exactly one teardown path.

**D3 — `resizable.destroy()` destroys host state.** `resizable.ts:225`
unconditionally assigns `el.style.position = restorePosition`. On the
supplied-handles path the library never set `position` in the first place, so
destroy writes an empty string over whatever inline `position` the host page
had. Same class of bug for the `dk-resizable` class, which is added
unconditionally but is only meaningful for library-created handles.
*Fix:* record what was actually mutated and revert only that.

**D4 — keyboard reordering is dead inside shadow DOM.** `sortable.ts:346` reads
`event.target`. Events crossing a shadow boundary retarget to the host element,
so `list.find(node => node === target || node.contains(target))` fails and
keyboard reorder silently does nothing on any web-component-based site.
*Fix:* use `event.composedPath()[0]`, consistent with how `pointer.ts` already
handles this correctly for pointer input.

**D5 — RTL is inverted.** `geometry.ts:96` resolves an `x`-axis insertion index
by walking left-to-right. Under `dir="rtl"` the visual order is reversed and
every horizontal reorder goes the wrong way.
*Fix:* detect the container's resolved `direction` once per drag and reverse
the comparison for `x` and for the horizontal component of `grid`.

**D6 — global page state is not refcounted.** `pointer.ts:87` saves
`document.body.style.userSelect` at activation and restores it at teardown;
`pointer.ts:89` sets `body[data-dragging]`. With two concurrent bindings the
second saves the already-clobbered value `'none'` and restores that, leaving
the page permanently unselectable. The `data-dragging` attribute is removed by
whichever drag ends first.
*Fix:* a single refcounted module owning all body-level state, incremented on
activate and decremented on teardown, restoring the original value only at zero.

### 2.2 Failures specific to complex host pages

**H1 — transformed ancestors.** `boxOf` reports post-transform viewport
coordinates, but pointer deltas are raw viewport pixels. Inside any
`transform: scale(k)` ancestor — modals, zoom canvases, presentation surfaces —
the element travels `1/k` times too far, drifting away from the cursor.
*Fix:* derive the effective scale per drag from
`rect.width / el.offsetWidth` (and the height equivalent), and divide incoming
deltas by it. Guard against a zero `offsetWidth` on hidden elements.

**H2 — `scroll-behavior: smooth`.** Widely set on `html` by modern sites. The
autoscroll loop's `scroller.scrollTop += dy` is then animated by the browser,
so each frame's read-modify-write fights the previous frame's in-flight
animation and autoscroll stutters or stalls.
*Fix:* use `scroller.scrollBy({ top, left, behavior: 'instant' })`.

**H3 — stacking context traps.** The lifted item gets `position: relative` and
`z-index: 20`. If any ancestor establishes a stacking context — `transform`,
`filter`, `contain`, `will-change`, `opacity < 1` — the item cannot paint above
siblings outside that context, so a dragged card disappears behind the next
column. This is not fixable from inside the library without portalling the item
to `document.body`, which breaks inherited styles.
*Fix:* not a code fix. Document it prominently with a diagnosis recipe and the
two workarounds (raise the trapping ancestor's own z-index, or drag a clone).
`zIndex` remains configurable.

**H4 — duplicate library copies break cross-list drag.** `sortable.ts:64`
holds `registry` as a module-level `Set`. Two bundled copies of detent — trivially
common with a mix of ESM and CJS consumers, or a host page plus a widget — get
two registries, and `group`-based transfer between lists silently no-ops.
*Fix:* store the registry on `globalThis` under `Symbol.for('detent.registry')`.

**H5 — host CSS resets.** Covered in §3.

### 2.3 Performance

**P1 — `hostFor` reflows per registered list per move.** `sortable.ts:142`
calls `boxOf` (→ `getBoundingClientRect`, a forced synchronous layout) for the
current host and then, on miss, for every other registered instance — on every
pointer move. A twenty-column board performs twenty forced reflows per move.
*Fix:* measure candidate container rects once at drag start into a local array;
invalidate on the same scroll/resize signals that already invalidate
`cachedRects`.

**P2 — duplicated `getComputedStyle`.** `sortable.ts:230` calls
`getComputedStyle(container)` twice within a single expression.

**P3 — `flip.play` double loop.** `flip.ts:33` iterates `before` solely to
cancel running animations, destructuring an unused `from` binding, then
iterates again. The two-pass structure is deliberate and correct — cancelling
mid-measure would corrupt later reads — but must be commented as such and the
unused binding removed, or a future reader will "optimise" it into a bug.

### 2.4 Duplication and scattered constants

**S1 — one scroll-ancestor walk, not two.** `geometry.ts:103`
(`scrollAncestorsOf`) and `geometry.ts:132` (`scrollParentOf`) are the same
ancestor walk with the same overflow regex, written twice.
*Fix:* one internal walk; `scrollParentOf` becomes its first result.

**S2 — `core/constants.ts` is the single home for every tunable.** Currently
scattered: `4 / 200 / 6` (pointer activation, `pointer.ts:39`), `180`
(animation, `sortable.ts:103`), `20` (z-index, `sortable.ts:271`), `60 / 14`
(autoscroll, `autoscroll.ts:24-25`), `16` (min resize size,
`resizable.ts:156-157`), `12px` (handle size, `styles.css:11`).
The CSS handle size becomes a custom property whose default is declared once;
the TypeScript constant and the CSS custom property are asserted equal by a
test so they cannot drift.

**S3 — class and attribute names are literals in five files.** `dk-dragging`,
`dk-sorting`, `dk-resizable`, `dk-resizing`, `dk-handle`, `dk-handle-${name}`,
`dk-sortable`, `data-dk-handle`, `data-dk-ignore`, `dk-live-region`.
*Fix:* a `CLASS` and `ATTR` map in `constants.ts`. No name appears as a literal
anywhere else, including the stylesheet (generated from the same source or
asserted against it by test).

**S4 — inline blocks that belong in their own functions.**
- `resizable.ts:59-60` — handle-source resolution as a triple-nested ternary
  with a cast. Extract `resolveHandles()`.
- `resize-math.ts:66-88` — 25 lines of aspect-ratio reconciliation inlined mid
  function. Extract `reconcileAspect()`.
- `draggable.ts:63-83` / `resizable.ts:61-65` — the same
  `number | [number, number] → [number, number]` grid normalisation twice.
  Extract `normaliseGrid()` to `constants.ts`' neighbour, `core/options.ts`.

### 2.5 Error handling

Principle: **necessary only.** The library never swallows a host page's error,
never try/catches around consumer callbacks, and adds no runtime cost to
production builds.

A `__DEV__`-gated `invariant(condition, message)` in `core/invariant.ts`,
replaced with `false` by esbuild's `define` in production so the entire call
and its message string are dead-code-eliminated. It guards exactly the mistakes
that currently fail cryptically and late:

| Guard | Currently fails as |
|---|---|
| target is an `HTMLElement` | `Cannot read properties of null (reading 'style')` |
| `maxWidth >= minWidth`, `maxHeight >= minHeight` | silently produces a garbage size |
| handle name is one of the eight | handle silently absent |
| `items` selector matches at least one child | list silently inert |
| at drag start, a `group` name is shared by ≥ 2 registered lists | cross-list drag silently does nothing |
| supplied handle selector resolves | handle silently absent |

Production builds keep exactly one runtime behaviour change: `resizable` clamps
`maxWidth`/`maxHeight` up to the corresponding minimum rather than producing
NaN geometry.

---

## 3. CSS isolation

The requirement is two-sided and the two sides need opposite treatments:
the library must not collide with the host, and the host must not be able to
break the library — while a consumer must still be able to theme it.

**Naming.** `dk-*` → `detent-*`, sourced from `constants.ts` (§S3). Prefix is
long enough to be collision-free in practice and short enough to type.

**Tier 1 — cosmetic, deliberately overridable.** Handle size, cursors, insets,
`will-change`. Shipped inside `@layer detent { … }`. Unlayered author CSS beats
layered author CSS at *any* specificity, so a consumer writes plain
`.detent-handle { background: red }` and wins with no specificity war and no
`!important`. The library uses `!important` nowhere.

**Tier 2 — load-bearing, not negotiable.** Three declarations break the library
outright if a host reset touches them:
- `position: absolute` on a library-created handle (a `* { position: static }`
  reset detaches every handle),
- `touch-action: none` on a handle (touch resize stops working),
- `position: relative` on a static target element.

These are written as **inline styles at element creation time**, where no host
stylesheet can reach them. Consequence: the library remains functionally
correct even if `styles.css` is never loaded — the stylesheet then only governs
appearance. This is a documented guarantee, and the hostile-page fixture
asserts it.

**Live region.** `#dk-live-region` is replaced. A global `id` is a collision
with any host page that happens to use it, and the current node is appended to
`document.body` and never removed. The replacement is module-owned, identified
by `data-detent-live-region`, carries its visually-hidden styles inline so a
host reset cannot reveal it, and is refcounted against live `sortable`
instances — created with the first, removed with the last.

**Body-level state.** `body[data-dragging]` → `body[data-detent-dragging]`,
refcounted per §D6.

---

## 4. Framework wrappers

### `detent-react`
`useDraggable(options)`, `useSortable(options)`, `useResizable(options)`, each
returning a callback ref. Options are held in a ref and read at call time so
that inline object literals and arrow callbacks do not re-bind on every render
— the single most common footgun in ref-based wrappers. A `<Sortable>`
component wraps `useSortable` for the controlled-list case, taking `items` and
`onReorder` and leaving rendering to the caller. Peer `react >= 18`, works with
19. No `react-dom` dependency.

### `detent-svelte`
Actions: `use:draggable`, `use:sortable`, `use:resizable`. Svelte actions are
plain TypeScript with an `update`/`destroy` contract — no `.svelte` files, so
no Svelte compiler in the build. Peer `svelte >= 5`; compatible with 4.

### `detent-elements`
`<detent-draggable>`, `<detent-sortable>`, `<detent-resizable>` custom elements
mapping attributes to options and emitting `detent:sort` etc. as
`CustomEvent`s. Light DOM only, so host styling and slotted content behave
normally. Zero peers — this is the supported path for Angular, Vue, Astro and
plain HTML. Registration is explicit (`defineDetentElements()`) rather than a
side effect on import, so it is tree-shakeable and cannot double-register.

**Discoverability**, per the "easier to get to" requirement: each wrapper is a
top-level Starlight section with a copy-pasteable first example above the fold,
cross-links from the core docs for each API, and a README on npm that is the
same first example.

---

## 5. Testing

### Tier 1 — unit, happy-dom
Pure functions: `geometry`, `resize-math`, `scheduler`, `constants`,
`options`, `invariant`. Fast, no layout required. The existing suite carries
over here.

### Tier 2 — browser, Vitest browser mode + Playwright
Everything that touches the DOM: `pointer`, `box`, `flip`, `autoscroll`,
`draggable`, `sortable`, `resizable`, and all three wrapper packages. Real
layout, real pointer events, real `Element.animate`, real `getComputedStyle`.
Chromium, WebKit and Firefox.

This tier exists because `test/helpers.ts:9` hand-assigns
`getBoundingClientRect` on every element under test. No test in the current
suite exercises a layout engine, which is precisely why H1, D5, H2 and H3
survived. Tests whose assertions depend on real geometry move to this tier;
the fake-layout helper is deleted rather than kept as a tempting shortcut.

### Tier 3 — the hostile-page fixture
One Playwright fixture that is deliberately an adversarial host page, with an
assertion per hazard:

| Hazard | Assertion |
|---|---|
| aggressive reset (`* { position: static; touch-action: auto; margin: 0 }`) | handles stay positioned; touch resize still works |
| `.detent-handle { display: none }` set by the host | documented as *host wins* — theming works |
| `transform: scale(0.75)` ancestor | dragged element tracks the cursor 1:1 |
| `dir="rtl"` | horizontal reorder goes the direction the user sees |
| `scroll-behavior: smooth` on `html` | autoscroll advances monotonically |
| shadow-DOM host | pointer drag and keyboard reorder both work |
| `z-index: 9999` sticky header | documented; item is above list siblings |
| two copies of the library loaded | cross-list `group` transfer still works |
| stylesheet never loaded | drag, sort and resize all still function |

### Process
Test-first for every item in §2. Coverage thresholds enforced in CI, set from
the post-hardening baseline and never lowered.

---

## 6. CI, Changesets and release

**`pr.yml`** — on pull request:
install (pnpm, `--frozen-lockfile`) → typecheck → lint → unit → browser tests
across three engines → build → **bundle-size budget** (a per-entry gzip ceiling;
exceeding it fails the PR, so the "tiny" claim in the README is enforced rather
than asserted) → docs build → `changeset status --since=origin/main`, which
fails a PR touching `packages/**` with no changeset.

**`main.yml`** — on push to main: the same gates, then the Changesets action
opens or updates the *Version Packages* PR. Merging that PR publishes.

**Publishing** uses npm provenance via **Trusted Publishing**:
`permissions: { id-token: write, contents: read }` and
`npm publish --provenance --access public`. No long-lived `NPM_TOKEN` is stored
in the repository at all.

*Manual step required from the repository owner:* after the first publish of
each package, register this repository as a trusted publisher for that package
on npmjs.com. Until that is done the release job is expected to fail at the
publish step; this is recorded in `CONTRIBUTING.md`.

**`docs.yml`** — Astro 7 + Starlight 0.42, built and deployed to Cloudflare
Workers static assets via `wrangler deploy`, serving `detent.arshadshah.com`.
Pull requests build the docs as a check without deploying.

*Repository secrets required:* `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

**Toolchain versions:** Astro 7.3, Starlight 0.42, Changesets 3.0, Vitest 5.0,
esbuild 0.28, Playwright 1.63, TypeScript 7.0. TypeScript 7 is the native
compiler and is a genuine behavioural change from 5.x; if it proves unstable
against this codebase the fallback is to pin 6.x and record why, not to work
around it silently.

---

## 7. Adversarial validation

After implementation, parallel adversarial agents review the source, one per
dimension — correctness, duplication and constants, error handling, file
decomposition, CSS collision, performance and forced reflow. Each is instructed
to argue the code is broken and to cite file and line.

Findings are then put through a verification pass whose job is to *disprove*
them. No finding is acted on until it is reproduced as a failing test. An
agent's assertion is not evidence.

---

## 8. Phases

Executed in order, with a review checkpoint at each boundary.

1. **Core hardening** — §2, §3, and the Tier 1/2/3 test infrastructure of §5.
   Everything downstream depends on a stable core API, so this is first.
   Still a single package at this point.
2. **Monorepo and CI** — §1 and §6. pnpm workspaces, Changesets, the three
   workflows, the GitHub repository, the first publish.
3. **Wrappers** — §4. Three packages, each test-first, each with browser tests.
4. **Docs** — `apps/docs`, Cloudflare deployment, `detent.arshadshah.com`.
5. **Adversarial validation** — §7, against the finished result.

## Success criteria

- Every defect in §2 has a test that failed before its fix and passes after.
- The hostile-page fixture passes on all three engines.
- No class or tunable value appears as a literal outside `constants.ts`.
- A PR touching `packages/**` without a changeset fails CI.
- `detent`, `detent-react`, `detent-svelte`, `detent-elements` are published
  with provenance attestations visible on npm.
- `https://detent.arshadshah.com` serves the Starlight site.
