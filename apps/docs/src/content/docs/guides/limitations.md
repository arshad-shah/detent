---
title: Limitations
description: The things that will catch you out, why they happen, and what to do about them.
---

Three things are documented rather than fixed, because fixing them inside the
library would cost more than it is worth. Each has a workaround.

## A dragged item cannot escape an ancestor's stacking context

**The symptom.** You lift a card and it renders *behind* the next column, or
behind a panel it should float over. Raising `zIndex` changes nothing.

**Why.** While an item is being sorted, detent gives it `position: relative`
and `z-index: 20`. That lifts it above its **siblings**. A `z-index` only ever
competes inside its own stacking context — if any ancestor establishes one, the
item is sealed inside it, and can be the topmost thing in that box while still
painting below everything outside it.

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
`filter`, or a panel that fades in with `opacity` are each enough.

**How to confirm it.** Start a drag and hold. Select the dragged item in
devtools — its inline `z-index` is `20`. Walk up its ancestors checking
computed styles for any property above. The first one that has one is the
ceiling. A quick tell: the item is drawn above everything *inside* its own
container but below things *outside* it.

**Fix one — raise the trapping ancestor.** Usually the smallest change. The
ancestor is already a stacking context, so give it a `z-index` while a drag is
running:

```css
[data-detent-dragging] .board-column:has(.detent-sorting) {
  z-index: 10;
}
```

The `[data-detent-dragging]` attribute on `<body>` scopes this to an active
drag, so the rule stops applying on drop with no cleanup on your part.

**Fix two — drag a stand-in.** When the item genuinely has to escape its
container — between panels, or over a fixed sidebar — move a clone appended to
`<body>` and hide the original:

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
    // Keep a reference however suits your app, and move it in onMove.
  },
});
```

The clone is a child of `<body>`, so no ancestor can trap it. The cost is that
you now own its position, and state inside the item — a focused input, a
playing video — is not carried across.

**Why the library does not do this for you.** Portalling the dragged item to
`<body>` would break inherited styles, custom properties scoped to a container,
`:nth-child` rules, and framework reconciliation. It is the right answer often
enough to document and rarely enough that it should be your choice.

## Scroll anchoring can fight a reorder

Chrome and Firefox adjust `scrollTop` when content above the viewport changes,
which is exactly what a reorder does. In a scrolling list this shows up as the
list jumping during a drag.

```css
.scrolling-list { overflow-anchor: none; }
```

Safari does not implement scroll anchoring, so this only affects two of the
three engines.

## Resize handles need the stylesheet

Library-created handles get their size from `detent/styles.css`. Without it
they exist and are correctly anchored, but have no dimensions, so there is
nothing to grab.

Either load the stylesheet, or pass your own `handles` and size them yourself.
Everything else — dragging, sorting, keyboard reordering — works with no
stylesheet at all. See [Styling](/guides/styling/).

## How large the pieces can be

Per-frame cost is constant: some pointer arithmetic and one transform write. A
2000px panel costs the same to move as a 40px row.

Per-**swap** cost is proportional to the number of items, not their size —
every sibling is re-measured, and FLIP measures them again and starts an
animation each. That is nothing at 20 items, noticeable around 200, and worth
avoiding above that. Set `animation: 0` or virtualise the list.

The real limit with large pieces is repainting. A big card with shadows, images
or a deep subtree gets re-rastered as it moves; `will-change: transform` on
`.detent-sorting` promotes it to its own layer and mostly solves this. A
`filter` or `backdrop-filter` on the dragged element defeats that and will
stutter regardless — drag a lightweight stand-in in that case.
