<img src="brand/logo/detent-lockup.svg" alt="detent" height="48">

Drag, reorder and resize for the web. No dependencies, no framework, one input
path for mouse, touch and pen.

[![npm](https://img.shields.io/npm/v/detent?color=A82A57&label=detent)](https://www.npmjs.com/package/detent)
[![pr](https://github.com/arshad-shah/detent/actions/workflows/pr.yml/badge.svg)](https://github.com/arshad-shah/detent/actions/workflows/pr.yml)
[![license](https://img.shields.io/npm/l/detent?color=A82A57)](LICENSE)

**[detent.arshadshah.com](https://detent.arshadshah.com)** — documentation with
demos you can actually drag.

```bash
npm install detent
```

```js
import { draggable, sortable, resizable } from 'detent';
import 'detent/styles.css'; // required for resize handles, optional otherwise

draggable(box, { bounds: 'parent' });
sortable(list, { animation: 180, onSort: ({ from, to }) => reorder(from, to) });
resizable(panel, { minWidth: 120, aspectRatio: 16 / 9 });
```

Each returns a handle with `destroy()`.

---

## Packages

| Package | Size | What it gives you |
| --- | --- | --- |
| [`detent`](packages/detent) | 6.9 KB | The library. Zero dependencies. |
| [`detent-react`](packages/detent-react) | 0.6 KB | Hooks returning a callback ref. Re-rendering never re-binds. |
| [`detent-svelte`](packages/detent-svelte) | 0.3 KB | `use:` actions with reactive options. |
| [`detent-elements`](packages/detent-elements) | 1.0 KB | Custom elements. No peers — Angular, Vue, Astro, plain HTML. |

Gzipped. `draggable` alone is 2.4 KB, `sortable` 4.8 KB, `resizable` 3.2 KB —
they tree-shake independently.

## What it does

**`draggable`** — move an element. Axis locking, bounds, grid snapping that
counts from the container rather than the page, drag handles.

**`sortable`** — reorder a list, or pass items between lists sharing a group.
`direction: 'auto'` reads the layout from where the items sit, so a row, a
column and a wrapping grid all work unconfigured. Auto-scroll, and full
keyboard reordering with screen-reader announcements.

**`resizable`** — eight handles, or elements you supply yourself. Aspect ratio,
grid, bounds as a size ceiling.

## Why it stays smooth

- **One input path.** Pointer events only, so mouse, touch and pen share the
  same code. No HTML5 drag and drop, which has no touch support.
- **Measure once.** Every rectangle is read at the start of a drag and cached.
- **Write once a frame.** Pointer events fire faster than the screen redraws,
  so writes are queued and applied on the next frame.
- **Reorder with FLIP.** Items move in the DOM once, then animate from where
  they were with a transform.

## It survives real pages

Most drag libraries are tested on a clean page. This one is tested on a
deliberately hostile one — an aggressive CSS reset, a `transform: scale()`
ancestor, `dir="rtl"`, `scroll-behavior: smooth`, a shadow root, a
`z-index: 9999` sticky header, a host rule restyling the handles, and a second
copy of the library loaded alongside.

Styles ship inside `@layer detent`, so an unlayered rule in your own stylesheet
overrides them at any specificity — no `!important` anywhere. The declarations
the library cannot function without are written inline instead, beyond the
reach of a host CSS reset. See
[Styling](https://detent.arshadshah.com/guides/styling/).

## Documentation

| | |
| --- | --- |
| [Getting started](https://detent.arshadshah.com/guides/getting-started/) | Install, the stylesheet, the three entry points |
| [draggable](https://detent.arshadshah.com/api/draggable/) · [sortable](https://detent.arshadshah.com/api/sortable/) · [resizable](https://detent.arshadshah.com/api/resizable/) | Every option, with live demos |
| [Styling](https://detent.arshadshah.com/guides/styling/) | The class contract and how to override it |
| [Limitations](https://detent.arshadshah.com/guides/limitations/) | Stacking contexts, scroll anchoring, large lists |
| [React](https://detent.arshadshah.com/frameworks/react/) · [Svelte](https://detent.arshadshah.com/frameworks/svelte/) · [Web Components](https://detent.arshadshah.com/frameworks/web-components/) | The wrappers |

## Browser support

Anything with Pointer Events and `Element.animate` — Chrome, Edge, Firefox and
Safari, current and one back. Tested against all three engines on every commit.
Reduced motion is respected; reorder animations are skipped entirely.

## Development

```bash
pnpm install
pnpm build       # must run before typecheck: wrappers resolve types from dist
pnpm test        # unit + browser, three engines
pnpm test:e2e    # the hostile host-page fixture
pnpm docs        # the documentation site
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers the test tiers, changesets and the
release flow. [docs/SETUP.md](docs/SETUP.md) has the one-time npm and
Cloudflare steps. [SECURITY.md](SECURITY.md) covers reporting and how releases
are secured.

Design documents and audits are in [`docs/superpowers/`](docs/superpowers/) —
including the [adversarial reviews](docs/superpowers/audits/) and what each
claim turned out to be.

A detent is the catch that holds a moving part at a set position — the click
you feel when a dial lands on a setting.

MIT.
