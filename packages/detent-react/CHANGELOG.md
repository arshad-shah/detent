# detent-react

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

- [#9](https://github.com/arshad-shah/detent/pull/9) [`92aeb59`](https://github.com/arshad-shah/detent/commit/92aeb596dd3c3080a519419dd9d7834771752752) Thanks [@arshad-shah](https://github.com/arshad-shah)! - First release.
  
  React hooks for `detent` — `useDraggable`, `useSortable` and `useResizable`,
  each returning a callback ref:
  
  ```jsx
  const ref = useSortable({ onSort: ({ from, to }) => reorder(from.index, to.index) });
  return <ul ref={ref}>{items.map(...)}</ul>;
  ```
  
  Options are read through a ref at call time, so inline option objects and arrow
  callbacks — the normal way to write React — never re-bind and never interrupt a
  drag in progress. No `useCallback` or `useMemo` needed.
  
  Peer `react >= 18`; works with 19. No `react-dom` dependency.

### Patch Changes

- Updated dependencies [[`cc1e16d`](https://github.com/arshad-shah/detent/commit/cc1e16d98d525d58fc315015a6ff12917114f14f)]:
  - detent@0.2.0
