# detent

## 0.2.1

### Patch Changes

- [#11](https://github.com/arshad-shah/detent/pull/11) [`a3de44b`](https://github.com/arshad-shah/detent/commit/a3de44b213fc4ec938170536513086643d6418d7) Thanks [@arshad-shah](https://github.com/arshad-shah)! - Trim the readme to link to the documentation site rather than duplicate it.
  
  The styling contract, stacking-context guidance and large-list notes now live
  at [detent.arshadshah.com](https://detent.arshadshah.com), where they sit
  beside demos you can actually drag. The readme keeps the quick API sketch, the
  size table and a one-paragraph styling summary, so it still stands alone on
  npm.
  
  No code changes.

## 0.2.0

### Minor Changes

- [#9](https://github.com/arshad-shah/detent/pull/9) [`cc1e16d`](https://github.com/arshad-shah/detent/commit/cc1e16d98d525d58fc315015a6ff12917114f14f) Thanks [@arshad-shah](https://github.com/arshad-shah)! - Export the `HandleName` and `HandleSpec` types.
  
  `resizable`'s `handles` option could not be typed by a consumer without them —
  writing a helper that returns a handle list meant redeclaring the eight names
  by hand.

## 0.1.0

### Minor Changes

- [#4](https://github.com/arshad-shah/detent/pull/4) [`7f0dceb`](https://github.com/arshad-shah/detent/commit/7f0dceb97f8edbad251e0cb745669aa9c5ede807) Thanks [@arshad-shah](https://github.com/arshad-shah)! - First release.
  
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
