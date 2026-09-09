---
title: Styling
description: The class contract, the cascade layer, and what the library writes to your elements.
---

## The class contract

Every class the library writes is prefixed `detent-`:

| Class | On | When |
| --- | --- | --- |
| `detent-dragging` | a draggable element | during a drag |
| `detent-sorting` | a sortable item | while it moves, by pointer or keyboard |
| `detent-sortable` | a sortable container | for its lifetime |
| `detent-resizable` | a resizable element | for its lifetime |
| `detent-resizing` | a resizable element | during a resize |
| `detent-handle` | every handle the library creates | for its lifetime |
| `detent-handle-{n,e,s,w,ne,nw,se,sw}` | a handle, by direction | for its lifetime |

There is also `[data-detent-dragging]` on `<body>` for the duration of any
drag, which is useful for cursor and `pointer-events` rules.

## Overriding needs no `!important`

`detent/styles.css` ships inside `@layer detent`. Unlayered author CSS beats
layered author CSS **at any specificity**, so a plain rule in your own
stylesheet wins with no specificity war:

```css
/* This wins. */
.detent-handle {
  background: var(--brand);
  border-radius: 2px;
}
```

Handle size comes from a custom property:

```css
.detent-handle { --detent-handle-size: 20px; }
```

The library uses `!important` nowhere.

## What the stylesheet is not responsible for

Three declarations are written **inline** rather than left to the cascade,
because they are load-bearing and a host reset would otherwise break the
library outright:

- `position: absolute` on a library-created handle
- `touch-action: none` on a handle
- `position: relative` on a statically positioned target

Inline styles are beyond the reach of any stylesheet, so an aggressive reset
like `* { position: static }` cannot detach a handle.

The consequence is a guarantee: **dragging, sorting and keyboard reordering all
work with no stylesheet loaded at all.** The stylesheet governs appearance.

The exception is resize handles. Their size and placement are cosmetic, so
without `detent/styles.css` a library-created handle is correctly anchored but
has no dimensions — there is nothing to grab. Either load the stylesheet, or
supply your own handles and size them yourself.

## What the library writes to your elements

It writes as little as it can, but it does write:

| What | Where | Notes |
| --- | --- | --- |
| `transform` | inline, on the dragged element | Clobbers a transform you set yourself. Bind a wrapper if the element animates. |
| `touch-action` | inline, on the bound element | Set `touchAction` to change it. Restored on `destroy()`. |
| `position`, `z-index` | inline, only while sorting | `position` is set only if the item was static. Both restored on drop. |
| `user-select` | on `<body>`, only during a drag | Refcounted, so overlapping drags cannot leave the page unselectable. Restored on drop. |
| 8 handle children | inside a resizable target | Only with the array form of `handles`. Pass your own to avoid it. |

Reorder animations use `composite: 'add'`, so they stack on top of any
transform an item already has rather than replacing it.

## Using it on components you did not write

The safest approach with a third-party component is to **wrap it**: put your
own element around it, bind to the wrapper, and the component itself is never
touched.

Two behaviours are worth knowing rather than avoiding:

- A `transform` creates a new containing block, so `position: fixed`
  descendants — dropdowns, tooltips, popovers rendered inside a card — anchor
  to the card while it is being dragged.
- If the component sets its own inline transform, the two will fight.

## Reduced motion

Reorder animations are skipped entirely when the user has
`prefers-reduced-motion: reduce` set, and `will-change` is dropped so nothing
is promoted to its own layer unnecessarily.
