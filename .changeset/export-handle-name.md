---
'detent': minor
---

Export the `HandleName` and `HandleSpec` types.

`resizable`'s `handles` option could not be typed by a consumer without them —
writing a helper that returns a handle list meant redeclaring the eight names
by hand.
