---
'detent': minor
---

First release.

Drag, reorder and resize for the web with no dependencies and one input path
for mouse, touch and pen.

- `draggable` — axis locking, bounds, grid snapping, handles
- `sortable` — single and cross-list reordering, auto-scroll, keyboard support
  with screen-reader announcements
- `resizable` — eight handles or your own elements, aspect ratio, grid, bounds

Styles ship inside `@layer detent`, so an unlayered rule in your own stylesheet
overrides them at any specificity without `!important`. The declarations the
library cannot function without are written inline, so a host CSS reset cannot
break it.
