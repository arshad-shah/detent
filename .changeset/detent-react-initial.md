---
'detent-react': minor
---

First release.

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
