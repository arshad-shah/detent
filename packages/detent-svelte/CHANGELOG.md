# detent-svelte

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
