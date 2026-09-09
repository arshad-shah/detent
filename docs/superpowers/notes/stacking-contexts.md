# When the dragged item disappears behind something

The symptom: you lift a card and it renders *behind* the next column, or behind
a panel it should float over. Raising `zIndex` changes nothing.

This is not a bug in detent, and it cannot be fixed from inside the library.
It is how CSS stacking contexts work.

## What is happening

While an item is being sorted, detent gives it `position: relative` and
`z-index: 20`. That lifts it above its **siblings**.

A `z-index` only ever competes inside its own stacking context. If any ancestor
of the item establishes one, the item is sealed inside it — it can be the
topmost thing in that box and still paint below everything outside it, no
matter how large its `z-index` is.

These properties establish a stacking context on an ancestor:

- `transform`, `rotate`, `scale`, `translate`, `perspective`
- `filter`, `backdrop-filter`
- `opacity` less than 1
- `contain: layout`, `contain: paint`, `contain: strict`, `content-visibility`
- `will-change` naming any of the above
- `isolation: isolate`
- `mix-blend-mode` other than `normal`
- `position: fixed` or `sticky`

A kanban column with `will-change: transform`, a card grid with a hover
`filter`, or a panel that fades in with `opacity` are all enough.

## How to confirm it

1. Start a drag and leave the pointer held.
2. In devtools, select the dragged item. Its inline `z-index` is `20`.
3. Walk up its ancestors, checking computed styles for any property above.
4. The first ancestor that has one is the ceiling. The item cannot paint above
   that ancestor's siblings.

A quick check: if the item is drawn above everything *inside* its own container
but below things *outside* it, this is what you are looking at.

## The two fixes

**Raise the trapping ancestor.** Usually the smallest change. The ancestor is
already a stacking context, so give it a `z-index` while a drag is running:

```css
[data-detent-dragging] .board-column:has(.detent-sorting) {
  z-index: 10;
}
```

The column now floats above its siblings, and the item floats within it. Drop
the rule when the drag ends — which `[data-detent-dragging]` on `<body>`
handles for you.

**Drag a stand-in instead.** When the item genuinely has to escape its
container — dragging between panels, or over a fixed sidebar — move a clone
appended to `<body>` and hide the original:

```js
sortable(list, {
  onStart(item) {
    const ghost = item.cloneNode(true);
    const box = item.getBoundingClientRect();
    Object.assign(ghost.style, {
      position: 'fixed',
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      pointerEvents: 'none',
      zIndex: '9999',
    });
    document.body.appendChild(ghost);
    item.dataset.ghost = '';
    // Keep a reference however suits your app; move it in onMove.
  },
});
```

The clone is a child of `<body>`, so no ancestor can trap it. The cost is that
you now own its position, and any state inside the item (a focused input, a
playing video) is not carried across.

## Why detent does not do this for you

Portalling the dragged item to `<body>` would break inherited styles, CSS
custom properties scoped to a container, `:nth-child` rules, and framework
reconciliation. It is the right answer often enough to document and rarely
enough that it should be your choice, not a default.

## See also

- [`../specs/2026-09-09-detent-oss-hardening-design.md`](../specs/2026-09-09-detent-oss-hardening-design.md) — H3
