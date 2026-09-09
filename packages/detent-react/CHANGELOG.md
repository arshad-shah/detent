# detent-react

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
