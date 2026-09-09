---
'detent-elements': minor
---

First release.

Custom elements for `detent` — `<detent-draggable>`, `<detent-sortable>` and
`<detent-resizable>`, configured by attributes and emitting `detent:*` custom
events:

```html
<detent-sortable animation="180" style="display:block">
  <div>first</div><div>second</div>
</detent-sortable>
```

Light DOM only, so host styling and slotted content behave normally. No peer
dependencies — this is the supported path for Angular, Vue, Astro and plain
HTML.

Registration is an explicit `defineDetentElements()` call rather than a side
effect of importing, so the package tree-shakes and two copies cannot fight
over the same tag names.
