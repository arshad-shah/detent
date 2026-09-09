# detent-svelte

Svelte actions for [detent](https://www.npmjs.com/package/detent) — drag,
reorder and resize with no dependencies.

```bash
npm install detent detent-svelte
```

```svelte
<script>
  import { sortable } from 'detent-svelte';
  import 'detent/styles.css';

  let items = $state([
    { id: 1, label: 'first' },
    { id: 2, label: 'second' },
  ]);

  function handleSort({ from, to }) {
    const [moved] = items.splice(from.index, 1);
    items.splice(to.index, 0, moved);
  }
</script>

<ul use:sortable={{ animation: 180, onSort: handleSort }}>
  {#each items as item (item.id)}
    <li>{item.label}</li>
  {/each}
</ul>
```

| Action | Binds |
| --- | --- |
| `use:draggable` | `draggable` |
| `use:sortable` | `sortable` |
| `use:resizable` | `resizable` |

Options are the same as the core library's — see
[the documentation](https://detent.arshadshah.com).

## Reactive options

Changing the options object updates the live binding rather than rebinding it,
so a drag in progress is never interrupted and callbacks are always current.

Works with Svelte 4 and 5. The actions are plain functions, so there is no
Svelte compiler involved and `svelte` is a type-only peer.

MIT.
