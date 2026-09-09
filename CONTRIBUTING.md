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

## Size budget

`packages/detent/size-budget.json` sets a gzip ceiling per bundle, and CI fails
a PR that exceeds one. A budgeted bundle that was not built at all counts as
over, so renaming or dropping an entry fails too rather than quietly passing.

Raising a ceiling is fine when the change earns it. Do it in the same PR, and
say why in the changeset.

## Changesets

Every PR that changes `packages/**` needs one, and CI enforces it:

```bash
pnpm changeset
```

Pick the packages, pick the bump, and write the entry for someone reading a
changelog — what changed and what they have to do about it, not which files you
touched.

## Cutting a release

Releases are cut by merging a PR, not by running a command:

1. Merge your work to `main`. CI runs the full suite.
2. The `main` workflow opens or updates a **Version Packages** PR containing
   the version bumps and changelog entries from the accumulated changesets.
3. Review it. It is a normal PR — the changelog is editable.
4. Merge it. The `release` job publishes to npm with a provenance attestation.

### Two manual steps, once per package

**Before the very first publish of a package**, publish it by hand. npm Trusted
Publishing can only be configured for a package that already exists, so there
is a chicken-and-egg step:

```bash
npm login
pnpm -F detent build
cd packages/detent && npm publish --access public --provenance
```

**Then register this repository as a trusted publisher.** On npmjs.com → the
package → Settings → Trusted Publishing, add:

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

Repeat both steps for each new package.

## Repository secrets

| Secret | Used by | Needed for |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | `docs.yml` | Deploying the documentation site |
| `CLOUDFLARE_ACCOUNT_ID` | `docs.yml` | Deploying the documentation site |

There is deliberately no `NPM_TOKEN`. Publishing authenticates over OIDC.

## Design documents

`docs/superpowers/` holds the specs and implementation plans this repository
was built from, plus notes on behaviour that is documented rather than fixed —
see [stacking contexts](docs/superpowers/notes/stacking-contexts.md).
