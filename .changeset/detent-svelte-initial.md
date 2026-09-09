---
'detent-svelte': minor
---

First release.

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
