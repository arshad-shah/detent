# detent-elements

## 0.3.1

### Patch Changes

- [#57](https://github.com/arshad-shah/detent/pull/57) [`0bf9c7f`](https://github.com/arshad-shah/detent/commit/0bf9c7f3a4399a8897b3b58dc075f5b223857bc3) Thanks [@arshad-shah](https://github.com/arshad-shah)! - Release alongside `@arshad-shah/detent` so all four stay on one version line.
  
  `@arshad-shah/detent-elements` earns it on its own: its README told you to load
  the stylesheet from `node_modules/detent/dist/styles.css`, a path that has not
  existed since the packages were scoped, and that README ships inside the
  published tarball.
  
  `detent-react` and `detent-svelte` had correct documentation already. They are
  here because the four packages are `linked` in `.changeset/config.json` — they
  are meant to share a version, and leaving two of them a patch behind makes
  "which versions go together" a question a reader has to work out rather than
  read.
- Updated dependencies [[`d91c542`](https://github.com/arshad-shah/detent/commit/d91c542d064d2465efd3acddc1f4994d9c236581)]:
  - @arshad-shah/detent@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [[`024b500`](https://github.com/arshad-shah/detent/commit/024b50044ac3e0528493cc08a3503e8ffd875997)]:
  - @arshad-shah/detent@0.3.0

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
