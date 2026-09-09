# detent-elements

## 0.2.0

### Minor Changes

- [#9](https://github.com/arshad-shah/detent/pull/9) [`cc1e16d`](https://github.com/arshad-shah/detent/commit/cc1e16d98d525d58fc315015a6ff12917114f14f) Thanks [@arshad-shah](https://github.com/arshad-shah)! - First release.
  
  Custom elements for `detent` — `<detent-draggable>`, `<detent-sortable>` and
  `<detent-resizable>`, configured by attributes and emitting `detent:*` custom
  events:
  
  ```html
  <detent-sortable animation="180" style="display:block">
    <div>first</div><div>second</div>
  </detent-sortable>
  ```
  
  Light DOM only, so host styling and slotted content behave normally. No peer
  dependencies — this is the supported path for Angular, Vue, Astro and plain
  HTML.
  
  Registration is an explicit `defineDetentElements()` call rather than a side
  effect of importing, so the package tree-shakes and two copies cannot fight
  over the same tag names.

### Patch Changes

- Updated dependencies [[`cc1e16d`](https://github.com/arshad-shah/detent/commit/cc1e16d98d525d58fc315015a6ff12917114f14f)]:
  - detent@0.2.0
