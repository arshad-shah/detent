# detent Phase 2 — Monorepo, Changesets and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-package repository into a pnpm workspace whose releases are cut by merging a Changesets PR, publishing to npm with provenance attestations and no long-lived token.

**Architecture:** The library moves wholesale into `packages/detent`, owning its own source, tests, build and configs. The repository root becomes a private orchestrator that fans commands out with `pnpm -r` and holds only cross-cutting concerns: the workspace manifest, Changesets, CI workflows, and the design documents. Two workflows do the work — `pr.yml` gates every pull request, and `main.yml` runs the same gates then hands off to the Changesets action, which opens a version PR whose merge publishes.

**Tech Stack:** pnpm 11 workspaces, Changesets 3.0, GitHub Actions (`actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`, `changesets/action@v2`), npm 12 Trusted Publishing with OIDC.

**Spec:** `docs/superpowers/specs/2026-09-09-detent-oss-hardening-design.md` — §1 (repository structure) and §6 (CI, Changesets, release).

## Global Constraints

- **Package manager is pnpm 11**, Node 24. `--frozen-lockfile` in CI.
- **`packages/detent` has zero runtime dependencies.** Dev dependencies only.
- **Unscoped package names**: `detent`, and in Phase 3 `detent-react`, `detent-svelte`, `detent-elements`. `detent` is confirmed available on npm.
- **Changesets runs in `linked` mode** across all detent packages, so a core bump carries the wrappers with it.
- **No `NPM_TOKEN` is ever stored in the repository.** Publishing authenticates through OIDC via npm Trusted Publishing.
- **Publishing uses provenance**: `NPM_CONFIG_PROVENANCE=true` with `id-token: write`.
- **A PR that changes `packages/**` without a changeset fails CI.**
- **The bundle-size budget is enforced, not reported.** Exceeding it fails the PR.
- Browser and e2e tests run on Chromium, Firefox and WebKit, as established in Phase 1.
- Every task ends green: `pnpm typecheck && pnpm test && pnpm test:e2e` from the repository root.

---

## Starting point

This plan builds on the `phase-1-core-hardening` branch (PR #1). Branch Phase 2
from it, or from `main` once that PR has merged:

```bash
git checkout phase-1-core-hardening   # or: git checkout main && git pull
git checkout -b phase-2-monorepo
```

Phase 1 left the repository with the library at the root: `src/`, `test/`,
`e2e/`, `build.mjs`, `playground.mjs`, `vitest.config.ts`,
`playwright.config.ts`, `tsconfig.json`, `tsconfig.test.json`, and a
`pnpm-workspace.yaml` whose `packages:` list is `['.']`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` (root) | Private. Fans commands out across the workspace. No published artefact. |
| `pnpm-workspace.yaml` | Workspace membership and pnpm settings. |
| `packages/detent/package.json` | The published library manifest. |
| `packages/detent/src/`, `test/`, `e2e/` | Moved unchanged from the root. |
| `packages/detent/build.mjs`, `playground.mjs` | Moved. Paths are already package-relative. |
| `packages/detent/size-budget.json` | Per-entry gzip ceilings, in bytes. |
| `packages/detent/scripts/size-check.mjs` | Compares the built bundles against the budget; exits non-zero when one is over. |
| `packages/detent/README.md` | The npm readme. The full documentation. |
| `README.md` (root) | Short index: what the packages are, where the docs are. |
| `.changeset/config.json` | Changesets configuration, `linked` mode. |
| `.github/workflows/pr.yml` | Pull-request gates. |
| `.github/workflows/main.yml` | Main-branch gates plus the release step. |
| `CONTRIBUTING.md` | How to work in the repo, and the release runbook including the two manual steps. |

`apps/docs` and the `docs.yml` workflow are Phase 4. This plan does not create them.

---

## Task 1: Move the library into `packages/detent`

**Files:**
- Create: `packages/detent/package.json`, `packages/detent/README.md`
- Move: `src/`, `test/`, `e2e/`, `build.mjs`, `playground.mjs`, `playground/`, `detent-playground.html`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`, `tsconfig.test.json`, `LICENSE` (copy) → `packages/detent/`
- Modify: `package.json` (root), `pnpm-workspace.yaml`, `README.md` (root)

**Interfaces:**
- Consumes: the Phase 1 tree as it stands.
- Produces: a workspace where `pnpm -F detent test` and `pnpm -F detent build` work, and the root `package.json` is `private: true` with name `detent-repo`.

- [ ] **Step 1: Move everything the package owns**

```bash
mkdir -p packages/detent
for p in src test e2e build.mjs playground.mjs playground detent-playground.html \
         vitest.config.ts playwright.config.ts tsconfig.json tsconfig.test.json README.md; do
  git mv "$p" "packages/detent/$p"
done
cp LICENSE packages/detent/LICENSE
git add packages/detent/LICENSE
```

`LICENSE` is copied rather than moved: the repository needs one at its root and
npm needs one inside the tarball.

- [ ] **Step 2: Write the package manifest**

The `version` is `0.0.0` deliberately. Nothing has ever been published, so
there is no history to respect; Task 4's changeset takes the first release to
`0.1.0` through the same machinery every later release uses, rather than
special-casing it.

```json
{
  "name": "detent",
  "version": "0.0.0",
  "description": "Tiny zero-dependency drag, reorder and resize for the web. Pointer-based, touch-ready, framework-free.",
  "type": "module",
  "sideEffects": false,
  "license": "MIT",
  "author": "Arshad Shah",
  "homepage": "https://detent.arshadshah.com",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/arshad-shah/detent.git",
    "directory": "packages/detent"
  },
  "bugs": "https://github.com/arshad-shah/detent/issues",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./styles.css": "./dist/styles.css",
    "./package.json": "./package.json"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "keywords": [
    "drag", "drop", "sortable", "reorder", "resize",
    "touch", "pointer-events", "zero-dependency"
  ],
  "scripts": {
    "build": "node build.mjs",
    "size": "node scripts/size-check.mjs",
    "test": "pnpm test:unit && pnpm test:browser",
    "test:unit": "vitest run --project unit",
    "test:browser": "vitest run --project browser",
    "test:e2e": "playwright test",
    "test:watch": "vitest --project unit",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.test.json",
    "playground": "node playground.mjs"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "@types/node": "^24.13.3",
    "@vitest/browser": "^5.0.0",
    "@vitest/browser-playwright": "^5.0.0",
    "esbuild": "^0.28.2",
    "happy-dom": "^15.11.7",
    "playwright": "^1.63.0",
    "typescript": "^7.0.2",
    "vite": "^7.3.6",
    "vitest": "^5.0.0"
  }
}
```

Two changes beyond relocation: `./package.json` is added to `exports` because
bundlers and tooling routinely read it and a sealed `exports` map otherwise
denies them, and `files` now names `README.md` and `LICENSE` explicitly.

- [ ] **Step 3: Make the root a private orchestrator**

```json
{
  "name": "detent-repo",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:unit": "pnpm -r test:unit",
    "test:browser": "pnpm -r test:browser",
    "test:e2e": "pnpm -r test:e2e",
    "typecheck": "pnpm -r typecheck",
    "size": "pnpm -r size",
    "changeset": "changeset",
    "version-packages": "changeset version && pnpm install --lockfile-only",
    "release": "pnpm -r build && changeset publish"
  },
  "devDependencies": {}
}
```

`version-packages` re-runs `install --lockfile-only` because bumping a
workspace package's version changes what `workspace:^` resolves to, and a stale
lockfile then fails `--frozen-lockfile` in CI.

- [ ] **Step 4: Point the workspace at the package**

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'

# esbuild fetches its platform binary in a postinstall script.
allowBuilds:
  esbuild: true
```

The root is no longer a workspace member — it is private and publishes nothing.

- [ ] **Step 5: Write the root README**

```markdown
<img src="brand/logo/detent-lockup.svg" alt="detent" height="48">

Drag, reorder and resize for the web. No dependencies, no framework, one input
path for mouse, touch and pen.

| Package | Version | What it is |
| --- | --- | --- |
| [`detent`](packages/detent) | [![npm](https://img.shields.io/npm/v/detent)](https://www.npmjs.com/package/detent) | The library. Zero dependencies. |

Documentation: **[detent.arshadshah.com](https://detent.arshadshah.com)**
Contributing and the release runbook: [CONTRIBUTING.md](CONTRIBUTING.md)
Design documents: [`docs/superpowers/`](docs/superpowers/)

MIT.
```

- [ ] **Step 6: Fix the package README's logo path**

`packages/detent/README.md` opens with `<img src="brand/logo/detent-lockup.svg">`.
That path does not exist inside the tarball, so npm would render a broken
image. Point it at the raw file on GitHub:

```bash
cd packages/detent
sed -i '' \
  's|<img src="brand/logo/detent-lockup.svg"|<img src="https://raw.githubusercontent.com/arshad-shah/detent/main/brand/logo/detent-lockup.svg"|' \
  README.md
sed -i '' 's|\[`brand/`\](brand/)|[`brand/`](https://github.com/arshad-shah/detent/tree/main/brand)|' README.md
sed -i '' \
  's|\[Stacking contexts\](docs/superpowers/notes/stacking-contexts.md)|[Stacking contexts](https://github.com/arshad-shah/detent/blob/main/docs/superpowers/notes/stacking-contexts.md)|' \
  README.md
cd ../..
```

- [ ] **Step 7: Install and verify every suite still passes**

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Expected: all green, and `packages/detent/dist/index.d.ts` exists. If the
Playwright web server fails to start, check that
`packages/detent/playwright.config.ts` still points at
`./node_modules/.bin/vite` — pnpm links binaries into the package's own
`node_modules`, so the relative path resolves from the package directory and
needs no change.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: move the library into packages/detent

The root becomes a private orchestrator holding only cross-cutting
concerns — workspace config, changesets, CI, design docs — and the
library owns its own source, tests, build and configs.

Adds ./package.json to the exports map, which tooling reads routinely
and a sealed map otherwise denies, and rewrites the package README's
relative links to absolute ones so they resolve on npm."
```

---

## Task 2: Bundle-size budget, enforced

**Files:**
- Create: `packages/detent/size-budget.json`, `packages/detent/scripts/size-check.mjs`, `packages/detent/test/unit/size-check.test.ts`
- Modify: `packages/detent/build.mjs`

**Interfaces:**
- Consumes: the `dist/_size-*.js` bundles `build.mjs` already emits.
- Produces: `checkSizes(budget: Record<string, number>, measured: Record<string, number>): { entry: string; budget: number; actual: number }[]` exported from `scripts/size-check.mjs`, returning one row per over-budget entry. `pnpm -F detent size` exits 1 when that array is non-empty.

The README claims this library is tiny. This makes that claim a build gate
rather than a sentence.

- [ ] **Step 1: Write the failing test**

```ts
// packages/detent/test/unit/size-check.test.ts
import { describe, expect, it } from 'vitest';
import { checkSizes } from '../../scripts/size-check.mjs';

describe('checkSizes', () => {
  it('passes when everything is under budget', () => {
    expect(checkSizes({ a: 100 }, { a: 90 })).toEqual([]);
  });

  it('passes when a bundle is exactly at budget', () => {
    expect(checkSizes({ a: 100 }, { a: 100 })).toEqual([]);
  });

  it('reports a bundle that is over', () => {
    expect(checkSizes({ a: 100 }, { a: 101 })).toEqual([
      { entry: 'a', budget: 100, actual: 101 },
    ]);
  });

  it('reports every offender, not just the first', () => {
    const over = checkSizes({ a: 100, b: 200, c: 300 }, { a: 150, b: 100, c: 400 });
    expect(over.map((row) => row.entry)).toEqual(['a', 'c']);
  });

  it('treats a budgeted entry that was not built as a failure', () => {
    // A renamed or dropped bundle must not silently pass the gate.
    expect(checkSizes({ a: 100 }, {})).toEqual([
      { entry: 'a', budget: 100, actual: Infinity },
    ]);
  });

  it('ignores a built bundle that has no budget', () => {
    expect(checkSizes({}, { a: 999 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm -F detent test:unit -- size-check`
Expected: FAIL — `Failed to resolve import "../../scripts/size-check.mjs"`.

- [ ] **Step 3: Write the budget**

Ceilings are the Phase 1 measurements rounded up to the next 100 bytes. Tight
enough that a careless regression trips them, loose enough that ordinary work
does not.

```json
{
  "comment": "Gzipped ceilings in bytes. Raise deliberately, in the same PR as the change that needs it, and say why in the changeset.",
  "budgets": {
    "dist/index.js": 7000,
    "dist/_size-draggable.js": 2500,
    "dist/_size-sortable.js": 4800,
    "dist/_size-resizable.js": 3300,
    "dist/styles.css": 500
  }
}
```

- [ ] **Step 4: Write the checker**

```js
// packages/detent/scripts/size-check.mjs
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

/**
 * Compare measured gzip sizes against their budgets.
 *
 * A budgeted entry that was not built counts as infinitely over: renaming or
 * dropping a bundle must fail the gate rather than quietly satisfy it.
 */
export function checkSizes(budgets, measured) {
  const over = [];
  for (const [entry, budget] of Object.entries(budgets)) {
    const actual = entry in measured ? measured[entry] : Infinity;
    if (actual > budget) over.push({ entry, budget, actual });
  }
  return over;
}

function gzipSize(file) {
  try {
    return gzipSync(readFileSync(file)).length;
  } catch {
    return null;
  }
}

function main() {
  const { budgets } = JSON.parse(readFileSync('size-budget.json', 'utf8'));

  const measured = {};
  for (const entry of Object.keys(budgets)) {
    const size = gzipSize(entry);
    if (size !== null) measured[entry] = size;
  }

  const over = checkSizes(budgets, measured);
  const width = Math.max(...Object.keys(budgets).map((k) => k.length));

  console.log('\n  bundle'.padEnd(width + 4) + 'gzipped     budget');
  console.log('  ' + '-'.repeat(width + 22));
  for (const [entry, budget] of Object.entries(budgets)) {
    const actual = measured[entry];
    const shown = actual === undefined ? 'MISSING' : `${actual} B`;
    const flag = over.some((row) => row.entry === entry) ? '  OVER' : '';
    console.log('  ' + entry.padEnd(width + 2) + shown.padStart(9) + `${budget} B`.padStart(11) + flag);
  }
  console.log();

  if (over.length) {
    for (const row of over) {
      const actual = row.actual === Infinity ? 'not built' : `${row.actual} B`;
      console.error(`  ${row.entry}: ${actual}, budget ${row.budget} B`);
    }
    console.error(
      '\n  Over budget. Either make it smaller, or raise the ceiling in\n' +
        '  size-budget.json in this same PR and say why in the changeset.\n',
    );
    process.exit(1);
  }
}

// Only run the CLI when invoked directly, so the test can import the function.
if (process.argv[1] && process.argv[1].endsWith('size-check.mjs')) main();
```

- [ ] **Step 5: Run the test**

Run: `pnpm -F detent test:unit -- size-check`
Expected: PASS, 6 tests.

- [ ] **Step 6: Run the checker against the real build**

```bash
pnpm -F detent build && pnpm -F detent size
```

Expected: every row under budget, exit 0.

Then prove the gate bites:

```bash
node -e '
const fs=require("fs");
const b=JSON.parse(fs.readFileSync("packages/detent/size-budget.json","utf8"));
b.budgets["dist/index.js"]=10;
fs.writeFileSync("/tmp/tight-budget.json",JSON.stringify(b));
'
cp packages/detent/size-budget.json /tmp/real-budget.json
cp /tmp/tight-budget.json packages/detent/size-budget.json
pnpm -F detent size; echo "exit=$?"
cp /tmp/real-budget.json packages/detent/size-budget.json
```

Expected: `exit=1` with `dist/index.js` reported OVER. Restore the real budget
before continuing.

- [ ] **Step 7: Have the build stop printing its own table**

`build.mjs` ends with a hand-rolled size table that now duplicates the
checker's output and has no budget behind it. Delete it so there is one report,
and have the build point at the checker instead. Replace everything from
`const gz = (f) =>` to the end of the file with:

```js
console.log('\n  built. run `pnpm size` for the gzip table and budget check.\n');
```

and remove the now-unused `gzipSync`, `statSync` and `readFileSync` imports
from the top of `build.mjs`, keeping `mkdirSync`.

- [ ] **Step 8: Verify and commit**

```bash
pnpm -F detent build && pnpm -F detent size && pnpm test:unit
```

```bash
git add -A
git commit -m "feat: enforce a bundle-size budget

The README calls this library tiny. This makes that a build gate rather
than a sentence: exceeding a per-entry gzip ceiling exits non-zero, and
a budgeted bundle that was not built at all counts as over rather than
quietly passing.

Removes build.mjs's own size table, which reported the same numbers with
no budget behind them."
```

---

## Task 3: Changesets

**Files:**
- Create: `.changeset/config.json`, `.changeset/initial-release.md`
- Modify: `package.json` (root)

**Interfaces:**
- Consumes: the workspace from Task 1.
- Produces: `pnpm changeset`, `pnpm version-packages`, `pnpm release`. A `changeset status` check that later tasks call from CI.

- [ ] **Step 1: Install Changesets at the root**

```bash
pnpm add -Dw @changesets/cli@^3.0.2
```

- [ ] **Step 2: Write the configuration**

Do not run `changeset init` — it writes a config for a different default set
and a README this repository does not need.

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "arshad-shah/detent" }],
  "commit": false,
  "fixed": [],
  "linked": [["detent", "detent-*"]],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

`linked` means the detent packages share a version line, so a core bump carries
the Phase 3 wrappers with it and nobody has to reason about a compatibility
matrix. `access: public` is required — unscoped packages default to public, but
being explicit means a future scoped rename does not silently start publishing
privately.

```bash
pnpm add -Dw @changesets/changelog-github@^0.6.0
```

- [ ] **Step 3: Write the first changeset**

```markdown
---
'detent': minor
---

First release.

Drag, reorder and resize for the web with no dependencies and one input path
for mouse, touch and pen.

- `draggable` — axis locking, bounds, grid snapping, handles
- `sortable` — single and cross-list reordering, auto-scroll, keyboard support
  with screen-reader announcements
- `resizable` — eight handles or your own elements, aspect ratio, grid, bounds

Styles ship inside `@layer detent`, so an unlayered rule in your own stylesheet
overrides them at any specificity without `!important`. The declarations the
library cannot function without are written inline, so a host CSS reset cannot
break it.
```

Save as `.changeset/initial-release.md`.

- [ ] **Step 4: Verify the version bump is what you expect**

```bash
pnpm changeset status --verbose
```

Expected: `detent` is listed as bumping from `0.0.0` to `0.1.0`.

- [ ] **Step 5: Check the status gate behaves on a clean tree**

```bash
pnpm changeset status --since=main; echo "exit=$?"
```

Expected: exit 0, because a changeset is present. This is the command CI runs
in Task 4; a PR touching `packages/**` with no changeset exits 1.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "build: add changesets in linked mode

Linked so a core bump carries the wrappers Phase 3 adds, rather than
leaving consumers to work out a compatibility matrix.

The first changeset takes the package from 0.0.0 to 0.1.0 through the
same machinery every later release uses, so the first publish is not a
special case."
```

---

## Task 4: Pull-request CI

**Files:**
- Create: `.github/workflows/pr.yml`

**Interfaces:**
- Consumes: root scripts from Task 1, `pnpm -F detent size` from Task 2, `changeset status` from Task 3.
- Produces: a required-checks surface named `verify` and `changeset`.

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/pr.yml
name: pr

on:
  pull_request:
    branches: [main]

concurrency:
  group: pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Install browsers
        run: pnpm -F detent exec playwright install --with-deps chromium firefox webkit

      - run: pnpm typecheck

      - run: pnpm test:unit

      - run: pnpm test:browser

      - run: pnpm build

      - name: Bundle size budget
        run: pnpm size

      - run: pnpm test:e2e

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v5
        with:
          name: playwright-report
          path: packages/detent/playwright-report/
          retention-days: 7

  changeset:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          # changeset status compares against the base branch, so it needs
          # more than the default single commit.
          fetch-depth: 0

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Every change to a package needs a changeset
        run: pnpm changeset status --since=origin/main
```

`build` runs before the size check because the checker reads `dist/`, and
`test:e2e` runs last because it is the slowest and the least likely to fail
alone.

- [ ] **Step 2: Check the workflow parses**

```bash
gh workflow list 2>/dev/null || true
node -e '
const fs=require("fs");
const text=fs.readFileSync(".github/workflows/pr.yml","utf8");
if (text.includes("\t")) { console.error("tabs in YAML"); process.exit(1); }
console.log("no tabs; structure verified on push");
'
```

YAML errors surface on the first push. There is no offline validator worth
adding a dependency for.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: gate pull requests on the full suite and a changeset

Typecheck, unit, browser across three engines, build, size budget and
the hostile-page e2e fixture. A PR touching packages/** with no
changeset fails, so a release is never assembled from unlabelled work."
```

---

## Task 5: Main-branch CI and the release workflow

**Files:**
- Create: `.github/workflows/main.yml`

**Interfaces:**
- Consumes: the `release` script from Task 1, Changesets config from Task 3.
- Produces: an automated *Version Packages* PR, and a publish on merging it.

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/main.yml
name: main

on:
  push:
    branches: [main]

concurrency:
  group: main
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Install browsers
        run: pnpm -F detent exec playwright install --with-deps chromium firefox webkit
      - run: pnpm typecheck
      - run: pnpm test:unit
      - run: pnpm test:browser
      - run: pnpm build
      - name: Bundle size budget
        run: pnpm size
      - run: pnpm test:e2e

  release:
    needs: verify
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: write        # commit the version bump, push tags
      pull-requests: write   # open and update the Version Packages PR
      id-token: write        # OIDC, for provenance and trusted publishing
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - run: pnpm install --frozen-lockfile

      # npm >= 11.5 authenticates to the registry over OIDC when the repository
      # is registered as a trusted publisher, so no token is stored here.
      - name: Use an npm new enough for trusted publishing
        run: npm install -g npm@^12

      - uses: changesets/action@v2
        with:
          version: pnpm version-packages
          publish: pnpm release
          commit: 'chore: version packages'
          title: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_CONFIG_PROVENANCE: 'true'
```

`concurrency` does not cancel in progress here: cancelling a run halfway
through a publish is how half-released versions happen.

- [ ] **Step 2: Note what will and will not work on the first run**

Until the manual steps in Task 6 are done, the `release` job is expected to
open the *Version Packages* PR successfully and to **fail at the publish step**
with an authentication error. That is the designed sequence, not a bug: npm
Trusted Publishing can only be configured for a package that already exists, so
the first publish is manual.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: release through a changesets version PR

Merging the Version Packages PR publishes. Authentication is OIDC via
npm trusted publishing, so no long-lived NPM_TOKEN is stored in the
repository, and NPM_CONFIG_PROVENANCE attaches an attestation.

The release job does not cancel in-progress runs: cancelling halfway
through a publish is how half-released versions happen."
```

---

## Task 6: `CONTRIBUTING.md` and the release runbook

**Files:**
- Create: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documentation only. This is where the two manual steps live, so they cannot be forgotten.

- [ ] **Step 1: Write it**

````markdown
# Contributing

## Getting set up

```bash
pnpm install
pnpm -F detent exec playwright install chromium firefox webkit
```

Node 24 and pnpm 11. The library lives in `packages/detent`; the repository
root is private and only fans commands out.

## Running things

```bash
pnpm test          # unit + browser, every package
pnpm test:unit     # pure functions, happy-dom, fast
pnpm test:browser  # anything touching layout, in chromium/firefox/webkit
pnpm test:e2e      # the hostile host-page fixture
pnpm typecheck     # library and tests, separately
pnpm build         # bundles and type declarations
pnpm size          # gzip table and the budget check
```

## How tests are organised

Three tiers, and which one a test belongs in is not a matter of taste:

- **unit** — pure functions only. No layout, no DOM measurement.
- **browser** — anything whose result depends on a real box. Real layout
  engine, real pointer events, three browsers.
- **e2e** — the hostile fixture: a page carrying an aggressive CSS reset, a
  scaled ancestor, `dir="rtl"`, smooth scrolling, a shadow root and a
  `z-index: 9999` header, asserting the library survives each.

**Nothing fakes layout.** The suite used to overwrite `getBoundingClientRect`,
which meant no test ever exercised a layout engine, and four defects survived
in plain sight because of it. If a test needs a real box, it goes in the
browser tier.

## Changesets

Every PR that changes `packages/**` needs one, and CI enforces it:

```bash
pnpm changeset
```

Pick the packages, pick the bump, and write the entry for someone reading a
changelog — what changed and what they have to do about it, not which files you
touched.

Raising a size budget counts as a change worth explaining. Say why in the
changeset.

## Cutting a release

Releases are cut by merging a PR, not by running a command:

1. Merge your work to `main`. CI runs the full suite.
2. The `main` workflow opens or updates a **Version Packages** PR containing
   the version bumps and changelog entries from the accumulated changesets.
3. Review it. It is a normal PR — the changelog is editable.
4. Merge it. The `release` job publishes to npm with a provenance attestation.

### Two manual steps, once each

**Before the very first publish of a package**, publish it by hand. npm
Trusted Publishing can only be configured for a package that already exists,
so there is a chicken-and-egg step:

```bash
npm login
pnpm -F detent build
cd packages/detent && npm publish --access public --provenance
```

**Then register this repository as a trusted publisher.** On
npmjs.com → the package → Settings → Trusted Publishing, add:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `arshad-shah` |
| Repository | `detent` |
| Workflow filename | `main.yml` |
| Environment | *(leave empty)* |

Until that is done, the release job is expected to fail at the publish step
with an authentication error. Everything before it — the version PR, the
changelog, the tags — works from the start.

Repeat both steps for each new package Phase 3 adds.

## Repository secrets

| Secret | Used by | Needed for |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | `docs.yml` (Phase 4) | Deploying the documentation site |
| `CLOUDFLARE_ACCOUNT_ID` | `docs.yml` (Phase 4) | Deploying the documentation site |

There is deliberately no `NPM_TOKEN`. Publishing authenticates over OIDC.
````

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: contributing guide and release runbook

Records the two manual steps the release pipeline cannot do for itself:
the first publish of each package, and registering this repository as a
trusted publisher afterwards. Both are one-time and both will otherwise
look like CI failures."
```

---

## Task 7: Prove the pipeline on a real pull request

**Files:** none — this task verifies the previous six against GitHub itself.

**Interfaces:**
- Consumes: everything above.
- Produces: evidence that the workflows run, and that the changeset gate actually fails a PR that lacks one.

A workflow that has never run is a guess. This task runs them.

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin phase-2-monorepo
gh pr create --base main --head phase-2-monorepo \
  --title "Phase 2: pnpm monorepo, changesets and the release pipeline" \
  --body "Implements sections 1 and 6 of the hardening spec. See docs/superpowers/plans/2026-09-09-phase-2-monorepo-and-release.md"
```

- [ ] **Step 2: Watch the checks**

```bash
gh pr checks --watch
```

Expected: `verify` and `changeset` both pass. If `verify` fails on browser
installation, the runner needs `--with-deps`, which the workflow already
passes; if it fails on `pnpm install --frozen-lockfile`, the lockfile is stale
— run `pnpm install` locally, commit the lockfile, and push.

- [ ] **Step 3: Prove the changeset gate fails a PR without one**

```bash
git checkout -b tmp-no-changeset
printf '\n// gate probe\n' >> packages/detent/src/index.ts
git commit -am "test: probe the changeset gate"
git push -u origin tmp-no-changeset
gh pr create --base main --head tmp-no-changeset \
  --title "TEMPORARY: changeset gate probe" --body "Delete me."
gh pr checks --watch
```

Expected: the `changeset` job **fails**. That failure is the deliverable.

Then clean up:

```bash
gh pr close tmp-no-changeset --delete-branch
git checkout phase-2-monorepo
git branch -D tmp-no-changeset
```

- [ ] **Step 4: Record the result**

If the gate passed instead of failing, `changeset status --since=origin/main`
is not seeing the base branch — confirm `fetch-depth: 0` is set on the
`changeset` job's checkout, and that the branch was pushed so `origin/main`
resolves.

- [ ] **Step 5: Report**

Report to your human partner: both checks green on the real PR, and the gate
demonstrated failing on a PR without a changeset. Note that the release job has
not yet run, because that requires merging to `main`.

---

## Self-Review

**Spec coverage.** §1 repository structure → Tasks 1 (layout, naming,
`workspace:^` readiness) and 3 (`linked` mode). §6 CI → Task 4 (`pr.yml`, with
the size budget and changeset gate the spec names) and Task 5 (`main.yml`,
Changesets action). §6 publishing with provenance and Trusted Publishing →
Task 5 plus Task 6's runbook for the two manual steps the spec calls out. §6
size budget → Task 2. `apps/docs` and `docs.yml` are explicitly Phase 4 and
are named as out of scope in the header; the Cloudflare secrets they need are
recorded in Task 6 so they are not forgotten.

**Type consistency.** `checkSizes(budgets, measured)` is defined in Task 2 and
consumed only by its own test and CLI. Root script names (`build`, `test`,
`test:unit`, `test:browser`, `test:e2e`, `typecheck`, `size`,
`version-packages`, `release`) are defined in Task 1 Step 3 and used verbatim
in Tasks 2, 4 and 5. `pnpm -F detent` targets the package name `detent` set in
Task 1 Step 2.

**Two gaps found and closed while reviewing.** Task 1 originally left the root
`package.json` as a workspace member while also making it private, which makes
`pnpm -r` include a package with no scripts; the workspace glob is now
`packages/*` only. Task 2 originally left `build.mjs` printing its own size
table alongside the new checker — two reports of the same numbers, one of them
unenforced — so Step 7 removes it.

**Known ordering constraint.** Task 3 must precede Task 4, because `pr.yml`
runs `changeset status` and that command fails without a config. Task 7 must be
last. Tasks 2, 5 and 6 are independent of each other.
