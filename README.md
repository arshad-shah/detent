<img src="brand/logo/detent-lockup.svg" alt="detent" height="48">

Drag, reorder and resize for the web. No dependencies, no framework, one input
path for mouse, touch and pen.

A detent is the catch that holds a moving part at a set position — the click
you feel when a dial lands on a setting. Brand assets live in
[`brand/`](brand/).

| bundle | gzipped |
| --- | --- |
| `draggable` only | 2.35 KB |
| `resizable` only | 3.11 KB |
| `sortable` only | 4.62 KB |
| all three | 6.73 KB |

```bash
npm install detent
```

```js
import { draggable, sortable, resizable } from 'detent';
import 'detent/styles.css'; // required for resize handles; optional otherwise
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

## Living alongside your own styling

The library writes as little as it can get away with, but it does write.

| What it touches | Where | Notes |
| --- | --- | --- |
| `transform` | inline, on the dragged element | Clobbers a transform you set yourself. Use a wrapper if the element animates. |
| `touch-action` | inline, on the bound element | Set `touchAction` to change it. |
| `position`, `z-index` | inline, only while sorting | `position` is only set if the item was static, and both are restored on drop. |
| `user-select` | on `<body>`, only during a drag | Restored on drop. |
| `.detent-dragging`, `.detent-sorting`, `.detent-resizing` | classes | Style them however you like. |

Reorder animations use `composite: 'add'`, so they stack on top of any
transform an item already has rather than replacing it.

**Resize handles append children.** By default `resizable` puts eight `<span>`
elements inside the target. They are absolutely positioned, so flex and grid
layouts are unaffected — but they will break `:last-child` and `:nth-child`
rules, code that walks `element.children`, and framework rendering that owns
the child list. Give it your own handles instead:

```js
resizable(card, {
  handles: { se: '.card-corner', e: '.card-edge' },
});
```

Supplied handles are never created, never removed, and the target's `position`
is left alone — position them yourself. One more thing to watch: the default
handles sit 6px outside the element's edge, so `overflow: hidden` on the
component will clip them.

## Reordering large components

It works, and the mechanics do not care how big an item is. What matters is the
total amount of DOM in the list. Measured on a mid-range laptop, dragging one
row through a list:

| List | Median frame | Worst frame | Verdict |
| --- | --- | --- | --- |
| 30 rows × 220 elements | 16.7ms | 66ms | smooth |
| 150 rows × 60 elements | 16.7ms | 33ms | smooth |
| 80 rows × 400 elements | 16.7ms | 183ms | visibly janky |

The cliff is around 10,000 elements in one sortable list. Past that, drop
`animation` to `0` first — it roughly halves the worst frame — and virtualise
if that is not enough.

**What a reorder costs the item itself.** Sorting moves the real element in the
DOM, and the browser resets some things when a node is re-parented. Measured,
not guessed:

| | Survives a reorder |
| --- | --- |
| Input values, checkbox state | yes |
| Keyboard focus inside the item | **no** |
| Scroll position of a scrollable child | **no** |
| `<iframe>` content | **no** — the frame reloads |
| `<video>` / `<audio>` playback | no |
| Canvas pixels | yes |

If an item contains an iframe or an embedded player, reordering it will restart
that content. Nothing in the library can prevent this; it is what the browser
does when a node moves. Reorder a lightweight placeholder instead, or use
`onSort` to reorder your data and let your framework re-render.

**Anything `position: fixed` inside a dragged item stops being fixed.** A
transform makes its element the reference point for fixed descendants, so a
dropdown, tooltip or modal rendered inside the item will follow the item
instead of staying put. Render those into a portal at the document root.

## Touch

A finger gets a press delay (200ms by default) before a drag starts, so swiping
still scrolls the page. A mouse gets a small distance threshold instead, so
clicks still register. Both are tunable with `delay`, `distance` and
`tolerance`.

A sortable list that scrolls itself keeps its swipe gesture automatically —
press and hold to lift instead. Override with `touchAction` if you need to.

## Styling

Every class the library writes is prefixed `detent-`:

| Class | On | When |
| --- | --- | --- |
| `detent-dragging` | a draggable element | during a drag |
| `detent-sorting` | a sortable item | while it moves, by pointer or keyboard |
| `detent-sortable` | a sortable container | for its lifetime |
| `detent-resizable` | a resizable element | for its lifetime |
| `detent-resizing` | a resizable element | during a resize |
| `detent-handle`, `detent-handle-{n,e,s,w,ne,nw,se,sw}` | a created handle | for its lifetime |

There is also `[data-detent-dragging]` on `<body>` for the duration of any
drag, which is handy for cursor and pointer-events rules.

**Overriding is meant to be easy.** `detent/styles.css` ships inside
`@layer detent`. Unlayered CSS beats layered CSS at any specificity, so your
own rule wins without `!important` and without a specificity war:

```css
/* This wins. No !important needed. */
.detent-handle {
  background: var(--brand);
  border-radius: 2px;
}
```

Handle size comes from a custom property:

```css
.detent-handle { --detent-handle-size: 20px; }
```

**What the stylesheet is not responsible for.** Three declarations are written
inline instead — a handle's `position` and `touch-action`, and a static
target's `position` — because a host reset such as `* { position: static }`
would otherwise detach every handle. That means dragging, sorting and keyboard
reordering all work with no stylesheet loaded at all.

The exception is resize handles: their size and placement are cosmetic, so
without `detent/styles.css` a library-created handle has no dimensions and
nothing to grab. Either load the stylesheet, or pass your own `handles` and
size them yourself.

## Known limitations

**A dragged item cannot escape an ancestor's stacking context.** If a card
renders behind the next column no matter what `zIndex` you set, an ancestor has
a `transform`, `filter`, `opacity`, `contain` or `will-change` on it. This is
CSS, not detent, and it has two workarounds —
see [Stacking contexts](docs/superpowers/notes/stacking-contexts.md).

**Scroll anchoring can fight a reorder.** Chrome and Firefox adjust `scrollTop`
when content above the viewport changes, which a reorder does. If a scrolling
list jumps during a drag, set `overflow-anchor: none` on the container.

## Using it on components you did not write

The library writes to the elements you bind. On a third-party component that
can be a problem, so know what it touches:

| What | When | How to avoid it |
| --- | --- | --- |
| Appends 8 handle children | `resizable` | Pass your own `handles` |
| Sets `position: relative` if static | `resizable`, `sortable` | Pass your own handles; position the item yourself |
| Overwrites inline `transform` | during a drag | Bind a wrapper you own |
| Overwrites `touch-action` | on bind | Restored on `destroy()` |
| Sets `user-select: none` on `<body>` | during a drag | Restored on drop |
| Adds `detent-dragging` / `detent-sorting` classes | during a drag | Harmless; style or ignore |

Two behaviours are worth knowing rather than avoiding. A `transform` creates a
new containing block, so `position: fixed` descendants — dropdowns, tooltips,
popovers rendered inside a card — will anchor to the card while it is being
dragged. And if the component sets its own inline transform (an animation
library, for instance), the two will fight.

**When in doubt, wrap it.** Put your own element around the component, bind to
the wrapper, and the component itself is never touched.

## How big can the pieces be

Per-frame cost is constant: some pointer arithmetic and one transform write. A
2000px panel costs the same to move as a 40px row.

Per-swap cost is proportional to the number of items, not their size — every
sibling is re-measured, and FLIP measures them again and starts an animation
each. That is nothing at 20 items, noticeable around 200, and worth avoiding
above that. Set `animation: 0` or virtualise the list.

The real limit with large pieces is repainting. A big card with shadows, images
or a deep subtree gets re-rastered as it moves; `will-change: transform` on
`.detent-sorting` promotes it to its own layer and mostly solves this. A `filter`
or `backdrop-filter` on the dragged element defeats that and will stutter
regardless — drag a lightweight stand-in in that case.

## Browser extensions

- Any ancestor with a `transform` breaks `position: fixed`, which is common on
  real pages. Nothing here relies on a fixed drag layer.
- Pointer hit tests use `composedPath()`, so a grip inside a nested shadow
  root is still found.
- Keyboard reordering binds to the list itself, which sits in the same tree as
  its items, so it works inside a shadow root without special handling.

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
