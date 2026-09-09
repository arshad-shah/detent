# Contributing

## Getting set up

```bash
pnpm install
pnpm -F @arshad-shah/detent exec playwright install chromium firefox webkit
```

Node 24 and pnpm 11. The library lives in `packages/detent`; the repository
root is private and only fans commands out.

## Running things

```bash
pnpm test          # unit + browser, every package
pnpm test:unit     # pure functions, happy-dom, fast
pnpm test:browser  # anything touching layout, in chromium/firefox/webkit
pnpm test:e2e      # the hostile host-page fixture
pnpm typecheck     # library and tests, separately — run `pnpm build` first
pnpm build         # bundles and type declarations
pnpm size          # gzip table and the budget check
```

**Build before you typecheck.** The wrapper packages resolve `detent`'s types
through its emitted declarations, so `pnpm typecheck` fails with
`Cannot find module 'detent'` on a clean checkout until `pnpm build` has run.
CI runs them in that order for the same reason.

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
pnpm -F @arshad-shah/detent build
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

There are four packages — `detent`, `detent-react`, `detent-svelte` and
`detent-elements` — and each needs its own first manual publish and its own
Trusted Publishing registration, all pointing at the same `main.yml`.

The wrappers depend on `detent` through `workspace:^`, so publish `detent`
first; changesets rewrites those to real version ranges at publish time.

## Repository secrets

**There are none, deliberately.**

npm publishing authenticates over OIDC through Trusted Publishing, scoped to
this repository and `main.yml`. The documentation site is built and deployed by
Cloudflare Workers Builds, connected to this repository through Cloudflare's
own GitHub App — `docs.yml` only builds it as a pull-request check.

So there is no long-lived credential in this repository to leak or rotate. If
you are about to add one, check first whether OIDC or a provider-side Git
integration can do the same job.

> The full one-time setup — npm publishing, Trusted Publishing, Cloudflare
> tokens and branch protection, with the exact values to enter — is in
> [docs/SETUP.md](docs/SETUP.md).

### The docs deployment

Cloudflare Workers Builds is connected to this repository from the Cloudflare
dashboard and deploys `main` on push; pull requests get a preview URL. No API
token is stored here — Cloudflare authenticates through its own GitHub App.
`docs.yml` only builds the site as a pull-request check.

## The documentation site

`apps/docs` is a private Astro Starlight site.

```bash
pnpm docs          # dev server
pnpm docs:build    # production build
```

**Demos are real.** Each lives in `apps/docs/src/demos/<id>.ts`, imports the
library through the workspace, and exports
`default function mount(stage: HTMLElement): () => void`. A change to the
library's public API breaks the docs build rather than leaving a code block
quietly wrong. Add one by dropping a module in that directory and referencing
it as `<Demo id="<id>">`.

The docs app pins **TypeScript 6** while the packages use 7: `astro check`
needs TypeScript's programmatic API, which the native 7.x compiler does not
expose yet. Nothing published is affected.

## Design documents

`docs/superpowers/` holds the specs and implementation plans this repository
was built from, plus notes on behaviour that is documented rather than fixed —
see [stacking contexts](docs/superpowers/notes/stacking-contexts.md).

## Security

GitHub Actions are pinned to commit SHAs rather than tags, because a tag can be
moved and a SHA cannot. Dependabot proposes updates weekly; do not replace a
SHA with a tag when resolving a conflict.

`main` is protected: pull requests only, required checks, no force pushes,
enforced for admins. The settings live in
[`.github/branch-protection.json`](.github/branch-protection.json) so they are
reviewable in a diff rather than buried in a dashboard.

Reporting a vulnerability: [SECURITY.md](SECURITY.md).
