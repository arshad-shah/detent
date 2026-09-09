---
title: Svelte
description: Actions that bind detent to an element, with reactive options.
---

```bash
npm install @arshad-shah/detent @arshad-shah/detent-svelte
```

```svelte
<script>
  import { sortable } from '@arshad-shah/detent-svelte';
  import '@arshad-shah/detent/styles.css';

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
| `use:draggable` | [`draggable`](/api/draggable/) |
| `use:sortable` | [`sortable`](/api/sortable/) |
| `use:resizable` | [`resizable`](/api/resizable/) |

Options are the core library's — follow the links above for every one.

## Reactive options

Changing the options object **updates the live binding** rather than rebinding
it, so a drag in progress is never interrupted and callbacks are always
current. That is what an action's `update` contract is for, and it is the
reason to use this package rather than calling the library from `onMount`.

## No compiler involved

Svelte actions are plain functions, so this package contains no `.svelte`
files and needs no Svelte compiler — `svelte` is a type-only peer. Works with
Svelte 4 and 5.

Cleanup happens through the action's `destroy`, which Svelte calls when the
element is removed.
