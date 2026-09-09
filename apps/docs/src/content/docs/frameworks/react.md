---
title: React
description: Hooks that bind detent to an element, without re-binding on every render.
---

```bash
npm install detent detent-react
```

Each hook returns a **callback ref**. Attach it to the element you want bound.

```jsx
import { useSortable } from 'detent-react';
import 'detent/styles.css';

function List({ items, onReorder }) {
  const ref = useSortable({
    animation: 180,
    onSort: ({ from, to }) => onReorder(from.index, to.index),
  });

  return (
    <ul ref={ref}>
      {items.map((item) => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ul>
  );
}
```

| Hook | Binds |
| --- | --- |
| `useDraggable(options?)` | [`draggable`](/api/draggable/) |
| `useSortable(options?)` | [`sortable`](/api/sortable/) |
| `useResizable(options?)` | [`resizable`](/api/resizable/) |

Options are the core library's — follow the links above for every one.

## Re-rendering never re-binds

Pass inline objects and arrow functions freely:

```jsx
const ref = useDraggable({
  bounds: 'parent',
  onEnd: (event) => save(event.offset),  // recreated every render, and fine
});
```

Options are read through a ref at call time, so a re-render mid-drag does not
interrupt it, and callbacks are always the newest ones. **You do not need
`useCallback` or `useMemo` here.**

This is the whole reason the package exists. A binding written the obvious way
— a `useEffect` with `options` in its dependency array — tears the drag down
and rebuilds it on every render, cancelling the gesture in progress.

## Cleanup

The hooks call `destroy()` when the element unmounts or the ref changes. You do
not need an effect for it.

Peer `react >= 18`; works with 19. No `react-dom` dependency.
