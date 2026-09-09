---
title: Web Components
description: Custom elements that work in any framework, or none.
---

```bash
npm install detent detent-elements
```

```html
<script type="module">
  import { defineDetentElements } from 'detent-elements';
  defineDetentElements();
</script>
<link rel="stylesheet" href="/node_modules/detent/dist/styles.css">

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

**No peer dependencies.** This is the supported path for Angular, Vue, Astro
and plain HTML.

| Element | Attributes | Events |
| --- | --- | --- |
| `<detent-draggable>` | `axis`, `bounds`, `grid`, `handle`, `cancel`, `distance`, `disabled` | `detent:dragstart`, `detent:drag`, `detent:dragend` |
| `<detent-sortable>` | `group`, `items`, `direction`, `animation`, `keyboard`, `z-index`, `distance`, `disabled` | `detent:sort`, `detent:sortend` |
| `<detent-resizable>` | `handles`, `min-width`, `min-height`, `max-width`, `max-height`, `aspect-ratio`, `grid`, `distance`, `disabled` | `detent:resizestart`, `detent:resize`, `detent:resizeend` |

Attributes map to the core options documented under
[draggable](/api/draggable/), [sortable](/api/sortable/) and
[resizable](/api/resizable/). Every event carries the core library's event
object as `detail` and bubbles out of a shadow root.

Changing an attribute rebinds, so options are effectively reactive.

## Two things to know

**Give them a `display`.** Custom elements are `display: inline` by default,
which means no box to drag or resize:

```css
detent-draggable, detent-sortable, detent-resizable { display: block; }
```

**Registration is explicit.** `defineDetentElements()` is a call rather than a
side effect of importing, so the package tree-shakes and two copies cannot
fight over the same tag names. Calling it twice is safe.

Children stay in the light DOM, so your own styling and slotted content behave
normally.
