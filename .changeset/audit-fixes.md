---
'detent': patch
---

Six defects found by an adversarial review and reproduced as failing tests.

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
