# detent

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
