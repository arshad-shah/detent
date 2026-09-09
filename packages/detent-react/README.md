# detent-react

React bindings for [detent](https://www.npmjs.com/package/@arshad-shah/detent) — drag,
reorder and resize with no dependencies.

```bash
npm install @arshad-shah/detent @arshad-shah/detent-react
```

```jsx
import { useSortable } from '@arshad-shah/detent-react';

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

Each hook returns a callback ref. Attach it to the element you want bound.

| Hook | Binds |
| --- | --- |
| `useDraggable(options?)` | `draggable` |
| `useSortable(options?)` | `sortable` |
| `useResizable(options?)` | `resizable` |

Options are the same as the core library's — see
[the documentation](https://detent.arshadshah.com).

## Re-rendering never re-binds

Pass inline objects and arrow functions freely:

```jsx
const ref = useDraggable({
  bounds: 'parent',
  onEnd: (event) => save(event.offset),  // recreated every render, and fine
});
```

Options are read through a ref at call time, so a re-render mid-drag does not
interrupt it and callbacks are always the newest ones. You do not need
`useCallback` or `useMemo` here.

## Styles

```js
import '@arshad-shah/detent/styles.css';
```

Required for resize handles, optional otherwise.

Peer `react >= 18`; works with 19. No `react-dom` dependency.

MIT.
