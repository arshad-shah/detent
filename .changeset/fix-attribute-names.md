---
'@arshad-shah/detent': patch
---

Fix `InvalidCharacterError` on bind — 0.2.1 is broken, upgrade.

**0.2.1 shipped with the DOM prefix set to the npm package name.** Because the
package is scoped, every attribute it wrote contained `@` and `/`:

```
data-@arshad-shah/detent-live-region
```

Neither character is legal in an attribute name, so `setAttribute` threw. The
visible effect was that `sortable()` failed to bind at all with the default
`keyboard: true` — the live region is created before the handlers, so the throw
escaped `sortable()` and the list silently never became sortable.

It was also non-deterministic within a page: the live region's reference count
is incremented before the throw, so the *first* `sortable()` threw and every
later one skipped creation and appeared to work, minus the screen-reader
announcements.

The DOM prefix is `detent` again and is now independent of the package name by
design — they are two different names that happen to share a word. Tests assert
every class and attribute name is legal against the DOM itself rather than
against a regex.

No API change. If you are on 0.2.1, upgrade.
