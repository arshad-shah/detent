# detent-svelte

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

- [#9](https://github.com/arshad-shah/detent/pull/9) [`4a936b8`](https://github.com/arshad-shah/detent/commit/4a936b840f87c61bd77c0af7e1d3b9d6d9cf0eee) Thanks [@arshad-shah](https://github.com/arshad-shah)! - First release.
  
  Svelte actions for `detent` — `use:draggable`, `use:sortable` and
  `use:resizable`:
  
  ```svelte
  <ul use:sortable={{ animation: 180, onSort: handleSort }}>
    {#each items as item (item.id)}<li>{item.label}</li>{/each}
  </ul>
  ```
  
  Changing the options object updates the live binding rather than rebinding it,
  so reactive props take effect without interrupting a drag in progress and
  callbacks are always current.
  
  Actions are plain functions, so there are no `.svelte` files and no Svelte
  compiler involved — `svelte` is a type-only peer. Works with 4 and 5.

### Patch Changes

- Updated dependencies [[`cc1e16d`](https://github.com/arshad-shah/detent/commit/cc1e16d98d525d58fc315015a6ff12917114f14f)]:
  - detent@0.2.0
