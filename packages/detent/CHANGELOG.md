# detent

## 0.2.3

### Patch Changes

- [#27](https://github.com/arshad-shah/detent/pull/27) [`d8c567a`](https://github.com/arshad-shah/detent/commit/d8c567a823df7b7f1b34b06dc0edf452480223d1) Thanks [@arshad-shah](https://github.com/arshad-shah)! - Fix `InvalidCharacterError` on bind — 0.2.1 is broken, upgrade.
  
  **0.2.1 shipped with the DOM prefix set to the npm package name.** Because the
  package is scoped, every attribute it wrote contained `@` and `/`:
  
  ```
  data-@arshad-shah/detent-live-region
  ```
  
  Neither character is legal in an attribute name, so `setAttribute` threw. The
  visible effect was that `sortable()` failed to bind at all with the default
  `keyboard: true` — the live region is created before the handlers, so the throw
  escaped `sortable()` and the list silently never became sortable.
  
  It was also non-deterministic within a page: the live region's reference count
  is incremented before the throw, so the *first* `sortable()` threw and every
  later one skipped creation and appeared to work, minus the screen-reader
  announcements.
  
  The DOM prefix is `detent` again and is now independent of the package name by
  design — they are two different names that happen to share a word. Tests assert
  every class and attribute name is legal against the DOM itself rather than
  against a regex.
  
  No API change. If you are on 0.2.1, upgrade.

## 0.2.2

### Patch Changes

- [#15](https://github.com/arshad-shah/detent/pull/15) [`21bf492`](https://github.com/arshad-shah/detent/commit/21bf492380f057e16b99659eb2313793fc1bd5eb) Thanks [@arshad-shah](https://github.com/arshad-shah)! - Six defects found by an adversarial review and reproduced as failing tests.
  
  - **A refused `onStart` left the element permanently styled as active.**
    `draggable` and `resizable` added `detent-dragging` / `detent-resizing`
    before asking, and the pointer layer skips `onEnd` for a refused start, so
    the class was never removed. They now ask first, as `sortable` already did.
  
  - **Calling `cancel()` or `destroy()` from inside `onStart` locked the page.**
    Both tear the session down re-entrantly, but activation carried on and called
    `lockPage()` for a drag that no longer existed — leaving `user-select: none`
    and `[data-detent-dragging]` on `<body>` with nothing to remove them.
  
  - **Keyboard reordering fired only `onSort`.** `onStart`, `onMove` and `onEnd`
    were never wired through, so anyone using `onEnd` to persist state got
    nothing from the keyboard path — the accessibility path the feature exists
    for. `onStart` returning `false` is now honoured there too.
  
  - **A two-item horizontal list could not be reordered.** The axis is detected
    from the *remaining* siblings, which for two items is a single box, and a
    single box defaults to vertical. The axis measured at lift is now the
    fallback whenever too few siblings remain to tell.
  
  - **A cross-list drop reported the index using the source list's `items`
    selector.** Dropping into a list with different rules gave an index counted
    over the wrong subset, or `-1`.
  
  The sortable size ceiling rises from 4800 to 5000 bytes to carry the keyboard
  callbacks and the axis fallback.

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
