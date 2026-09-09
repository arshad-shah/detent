# detent-elements

Custom elements for [detent](https://www.npmjs.com/package/@arshad-shah/detent) — drag,
reorder and resize in any framework, or none.

```bash
npm install @arshad-shah/detent @arshad-shah/detent-elements
```

```html
<script type="module">
  import { defineDetentElements } from '@arshad-shah/detent-elements';
  defineDetentElements();
</script>
<link rel="stylesheet" href="node_modules/detent/dist/styles.css">

<detent-sortable animation="180" style="display:block">
  <div>first</div>
  <div>second</div>
  <div>third</div>
</detent-sortable>

<script>
  document.querySelector('detent-sortable')
    .addEventListener('detent:sort', (e) => console.log(e.detail));
</script>
```

No peer dependencies. Works in Angular, Vue, Astro and plain HTML.

| Element | Attributes | Events |
| --- | --- | --- |
| `<detent-draggable>` | `axis`, `bounds`, `grid`, `handle`, `cancel`, `distance`, `disabled` | `detent:dragstart`, `detent:drag`, `detent:dragend` |
| `<detent-sortable>` | `group`, `items`, `direction`, `animation`, `keyboard`, `z-index`, `distance`, `disabled` | `detent:sort`, `detent:sortend` |
| `<detent-resizable>` | `handles`, `min-width`, `min-height`, `max-width`, `max-height`, `aspect-ratio`, `grid`, `distance`, `disabled` | `detent:resizestart`, `detent:resize`, `detent:resizeend` |

Every event carries the core library's event object as `detail`, and bubbles
out of a shadow root.

## Two things to know

**Give them a `display`.** Custom elements are `display: inline` by default,
which means no box to drag or resize:

```css
detent-draggable, detent-sortable, detent-resizable { display: block; }
```

**Registration is explicit.** `defineDetentElements()` is a call rather than an
import side effect, so the package tree-shakes and two copies cannot fight over
the same tag names. Calling it twice is safe.

MIT.
