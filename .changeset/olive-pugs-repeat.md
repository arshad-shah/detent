---
"@arshad-shah/detent": patch
---

Fix the package names in the documentation. Since the packages were scoped, the
docs told you to install `@arshad-shah/detent` and then import from `'detent'`,
which does not resolve:

```js
// what the README said
import { draggable } from 'detent';
import 'detent/styles.css';

// what actually works
import { draggable } from '@arshad-shah/detent';
import '@arshad-shah/detent/styles.css';
```

The same slip was in the stylesheet path throughout the guides and the API
reference, in the `<link>` tag in the web-components docs, and in `SECURITY.md`'s
verification commands. `packages/detent/README.md` ships inside the published
tarball, so the wrong instructions were on the npm page too.

A unit test now walks the documentation and fails on any pre-scope module
specifier, while deliberately leaving the library's unscoped vocabulary — the
`detent-` class prefix, the `@layer detent` cascade layer and the
`<detent-sortable>` custom elements — alone. That overlap is what made the
original rename miss things.
