---
"@arshad-shah/detent": minor
---

Resize now honours its documented contract in every host layout.

**The edge you grab is the only one that moves.** Writing `width` re-runs
layout, and a centred, right-aligned, RTL or `right`/`bottom`-pinned element
shifts on its own when its size changes — so pulling one corner dragged the
whole box sideways. Dragging the `se` handle of a 190×110 element by +60,+40
used to move `left` by −60 under `justify-content: flex-end`, and by −30 under
`margin: 0 auto`. detent now measures how the layout responds once per gesture
and cancels it out. Nothing is measured per frame, so the per-frame cost is
unchanged.

**`aspectRatio` on an edge handle stays inside `bounds`.** Only the axis the
handle drove ever received a bounds-derived ceiling, so the axis the ratio
derived had none: an `n` handle in a 700×500 parent could put the right edge
229px outside it. A derived axis is now bounded too.

**A derived axis grows about its centre.** An axis no handle drives has no edge
you grabbed, and anchoring it to one side made the box lurch — pulling the top
edge up 40px threw the right edge out 69px. Pulling the top edge of a
ratio-locked box now scales it about its bottom-centre. One consequence worth
knowing: a derived axis flush against both edges of its bounds will not grow,
because growing it centred needs room on both sides.

**`grid` counts from the size the element started at.** Snapping the absolute
size meant an element whose size was not already a multiple of the step jumped
up to a whole step the instant you moved, sometimes against the pointer — a
190px element with `grid: 20` reached 180/200/220, never 190. It now reaches
190/210/230, and a movement under half a step changes nothing.

These are corrections toward the documented behaviour rather than changes to
what is promised, so code relying on the documentation is unaffected. If you
compensated for the sliding in your own CSS, remove that compensation — it will
now be applied twice.

Also documented: an element sized by its container (`flex: 1`, a stretched grid
item, `width: 100%`) cannot be resized, because writing `width` does nothing
there. See the limitations guide.

The gzip ceilings for `dist/index.js` and `dist/_size-resizable.js` rise by
200B and 250B to cover the anchoring measurement and the derived-axis bounds.
