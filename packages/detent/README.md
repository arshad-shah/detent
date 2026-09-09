<img src="https://raw.githubusercontent.com/arshad-shah/detent/main/brand/logo/detent-lockup.svg" alt="@arshad-shah/detent" height="48">

Drag, reorder and resize for the web. No dependencies, no framework, one input
path for mouse, touch and pen.

A detent is the catch that holds a moving part at a set position — the click
you feel when a dial lands on a setting. Brand assets live in
[`brand/`](https://github.com/arshad-shah/detent/tree/main/brand).

| bundle | gzipped |
| --- | --- |
| `draggable` only | 2.35 KB |
| `resizable` only | 3.11 KB |
| `sortable` only | 4.62 KB |
| all three | 6.73 KB |

```bash
npm install @arshad-shah/detent
```

```js
import { draggable, sortable, resizable } from '@arshad-shah/detent';
import '@arshad-shah/detent/styles.css'; // required for resize handles; optional otherwise
```

## draggable

```js
const handle = draggable(element, {
  axis: 'both',        // 'x' | 'y' | 'both'
  bounds: 'parent',    // 'parent' | 'window' | Element | {left, top, width, height}
  grid: 20,            // number, or [x, y]
  gridOrigin: 'bounds',// where the grid counts from
  handle: '.grip',     // only start a drag from here
  cancel: 'button',    // never start a drag from here
  onStart(e) {},
  onMove(e) {},        // e.offset, e.point, e.delta
  onEnd(e, cancelled) {},
});

handle.moveTo(120, 40);
handle.reset();
handle.destroy();
```

Movement is applied as a transform. The element keeps its position between
drags, so a second drag carries on from where the first ended.

## sortable

```js
sortable(list, {
  group: 'board',   // lists sharing a name pass items to each other
  items: 'li',      // defaults to every element child
  direction: 'auto',// 'auto' | 'x' | 'y' | 'grid'
  animation: 180,   // reorder animation, 0 to turn it off
  autoScroll: true,
  keyboard: true,
  zIndex: 20,       // how high the item is lifted while it moves
  onSort({ item, from, to }) {},
});
```

`direction: 'auto'` reads the layout from where the items sit, so a row, a
column and a wrapping grid all work without configuration.

**Scrolling.** Cached measurements are corrected whenever anything scrolls
mid-drag, including the page itself. Auto-scroll re-runs the drop decision on
every step, so a finger held against the edge of a list keeps reordering
without moving.

**Keyboard.** Give the items `tabindex="0"` and they can be reordered with
space to lift, arrows to move, space to drop and escape to cancel. Each step is
announced to screen readers.

## resizable

```js
resizable(element, {
  handles: ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'],
  minWidth: 120,
  minHeight: 80,
  maxWidth: 600,
  aspectRatio: 16 / 9, // or true to keep the current ratio
  grid: 10,
  bounds: 'parent',
  onResize(e) {},      // e.width, e.height, e.handle
});
```

By default, handles are `<span>` elements appended to the target and styled by
`detent/styles.css`. They are invisible; give them whatever affordance suits
your design.

**Use your own handles instead** when appending children would break the
component — pass a selector or an element per position and nothing is injected:

```js
resizable(card, {
  handles: { se: '.card-corner', e: '.card-edge' },
});
```

This matters for anything with `:last-child`, `:nth-child` or `> *` selectors,
and for flex or grid layouts that count their children. With supplied handles
the library also leaves `position` alone.

`draggable` and `resizable` compose on the same element — resizing from the top
or left edge moves it as well as sizes it, and a following drag continues from
there.

## How it stays smooth

- **One input path.** Pointer events only, so mouse, touch and pen share the
  same code. No HTML5 drag and drop, which has no touch support.
- **Measure once.** Every rectangle is read at the start of a drag and cached.
  Nothing reads layout during a move, which is where frame drops come from.
- **Write once a frame.** Pointer events can fire faster than the screen
  redraws, so writes are queued and applied on the next frame.
- **Reorder with FLIP.** Items are moved in the DOM once, then animated from
  where they were with a transform. The browser lays out a single time no
  matter how many items shuffle.

## Documentation

Full documentation, with demos you can drag, lives at
**[detent.arshadshah.com](https://detent.arshadshah.com)**.

| | |
| --- | --- |
| [Getting started](https://detent.arshadshah.com/guides/getting-started/) | Install, the stylesheet, the three entry points |
| [draggable](https://detent.arshadshah.com/api/draggable/) · [sortable](https://detent.arshadshah.com/api/sortable/) · [resizable](https://detent.arshadshah.com/api/resizable/) | Every option, with live demos |
| [Styling](https://detent.arshadshah.com/guides/styling/) | The class contract, the cascade layer, what the library writes |
| [Limitations](https://detent.arshadshah.com/guides/limitations/) | Stacking contexts, scroll anchoring, large lists |

## Framework wrappers

| Package | What it gives you |
| --- | --- |
| [`@arshad-shah/detent-react`](https://www.npmjs.com/package/@arshad-shah/detent-react) | Hooks returning a callback ref. Re-rendering never re-binds. |
| [`@arshad-shah/detent-svelte`](https://www.npmjs.com/package/@arshad-shah/detent-svelte) | `use:` actions with reactive options. |
| [`@arshad-shah/detent-elements`](https://www.npmjs.com/package/@arshad-shah/detent-elements) | Custom elements. No peers — Angular, Vue, Astro, plain HTML. |

## Styling in one paragraph

Classes are prefixed `detent-`, and `detent/styles.css` ships inside
`@layer detent` — so an unlayered rule in your own stylesheet overrides it at
any specificity, with no `!important` anywhere. The declarations the library
cannot function without are written inline instead, beyond the reach of a host
CSS reset. Dragging, sorting and keyboard reordering all work with no
stylesheet at all; only library-created resize handles need it, because their
size is cosmetic. [Full details](https://detent.arshadshah.com/guides/styling/).

## Development

```bash
pnpm test          # unit (happy-dom) + browser (chromium, firefox, webkit)
pnpm test:unit     # pure functions only, fast
pnpm test:browser  # everything that touches layout, in a real engine
pnpm test:e2e      # the hostile host-page fixture
pnpm build         # bundles, types, size table
pnpm typecheck     # library and tests, separately
```

No test fakes layout. Anything whose result depends on a real box lives in the
browser tier, because the alternative hid four defects for a year.

`playground/index.html` is fully self-contained — open it straight from disk.

MIT.
