# Setup

One-time steps to make releases and the documentation site actually publish.
Everything else is already wired; these are the parts that need a human with
account access.

Do them in this order. npm first — the docs deploy is independent, but the
wrappers cannot publish until `detent` has.

---

## 1. Publish `detent` to npm by hand, once

npm Trusted Publishing can only be configured for a package that **already
exists**, so the first publish of each package has to be manual. After that CI
takes over.

```bash
cd ~/Downloads/detent
npm login                      # opens a browser
pnpm install
pnpm build
cd packages/detent
npm publish --access public
```

**No `--provenance` here.** Provenance is generated from a CI provider's OIDC
token, so it only works from GitHub Actions — locally npm fails with
`Automatic provenance generation not supported for provider: null`. Every
release after this one goes through CI and *is* attested; this first one is
the exception.

`--access public` is belt and braces: `publishConfig.access` in each manifest
already says public, which scoped packages need since they default to
restricted.

Expected output ends with `+ @arshad-shah/detent@0.2.1`.

If it fails with **`402 Payment Required`**, the scope is being treated as
private — check `publishConfig.access` is `public` in that package's
`package.json`.
If it fails with **`404 Not Found`** on a scoped name, the `arshad-shah` scope
does not exist yet on npm; it is created automatically the first time you
publish under it, provided your npm username is `arshad-shah`. If your npm
username differs, the scope must match an org you own — create one at
<https://www.npmjs.com/org/create>.

Repeat for each wrapper **after** the core is live — they depend on it, and
pnpm rewrites `workspace:^` to a real range at publish time:

```bash
cd ../detent-react    && npm publish --access public
cd ../detent-svelte   && npm publish --access public
cd ../detent-elements && npm publish --access public
```

---

## 2. Register this repo as a Trusted Publisher, per package

Do this **for each of the four packages**. There is no bulk option.

Go to `https://www.npmjs.com/package/<name>/access` → **Trusted Publisher** →
**GitHub Actions**, and enter exactly:

| Field | Value |
| --- | --- |
| Organization or user | `arshad-shah` |
| Repository | `detent` |
| Workflow filename | `main.yml` |
| Environment | *leave empty* |

The workflow filename is just the file name, **not** a path — `main.yml`, not
`.github/workflows/main.yml`.

The four package pages:

- <https://www.npmjs.com/package/@arshad-shah/detent/access>
- <https://www.npmjs.com/package/@arshad-shah/detent-react/access>
- <https://www.npmjs.com/package/@arshad-shah/detent-svelte/access>
- <https://www.npmjs.com/package/@arshad-shah/detent-elements/access>

Once this is done, **do not create an `NPM_TOKEN` secret.** The release
workflow authenticates over OIDC; a stored token would be a long-lived
credential with publish rights sitting in the repo, which is the thing trusted
publishing exists to avoid.

### Checking it worked

Merge any changeset to `main`. The `main` workflow opens a *Version Packages*
PR; merging that publishes. On success the package page shows a **Provenance**
badge linking back to the exact workflow run that built it.

---

## 3. Cloudflare: connect the repository

No API token, and no secret stored in GitHub. Cloudflare builds and deploys
directly from the repo through its own GitHub App.

Go to <https://dash.cloudflare.com> → **Compute (Workers)** → **Create** →
**Import a repository**, and enter exactly:

| Field | Value |
| --- | --- |
| Git account | `arshad-shah` — authorise the Cloudflare GitHub App if prompted |
| Repository | `detent` |
| Git branch | `main` |
| **Project name** | `detent-docs` |
| **Root directory** | `apps/docs` |
| **Build command** | `pnpm install --frozen-lockfile && pnpm -F @arshad-shah/detent build && pnpm -F docs build` |
| **Deploy command** | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |

Then add one build variable:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `24` |

Leave the optional **API token** field empty. It exists for people who want to
deploy with a scoped token; connecting through the dashboard does not need one.

### Why these exact values

**Project name must be `detent-docs`.** Cloudflare requires the Worker name in
the dashboard to match `name` in the Wrangler config it finds, and
[`apps/docs/wrangler.toml`](../apps/docs/wrangler.toml) says `detent-docs`. A
mismatch fails the build with a confusing error.

**Root directory is `apps/docs`**, because that is where `wrangler.toml` lives.
The build command still reaches the whole workspace: pnpm walks up to find
`pnpm-workspace.yaml`, so `pnpm install` from `apps/docs` installs everything.

**The build command builds the core first.** The site imports
`@arshad-shah/detent` and resolves its types from that package's emitted
declarations, which do not exist until it is built. Skip that step and the
docs build fails with `Cannot find module '@arshad-shah/detent'`.

**Non-production branches upload a version rather than deploying**, so every
pull request gets a preview URL without touching the live site.

## 4. Attach the custom domain

The first successful deploy creates the Worker. Then:

**Workers & Pages** → `detent-docs` → **Settings** → **Domains & Routes** →
**Add** → **Custom domain**, and enter:

```
detent.arshadshah.com
```

Cloudflare creates the DNS record itself; the zone for `arshadshah.com` must be
on the same account. `wrangler.toml` also declares this route, so once the
domain is attached it stays attached across deploys.

### Checking it worked

```bash
curl -sI https://detent.arshadshah.com | head -1     # HTTP/2 200
curl -sI https://detent.arshadshah.com/api/sortable/ | head -1   # HTTP/2 200
```

The second one matters: it proves `not_found_handling` is right. Astro emits
`<page>/index.html`, so without it every nested URL 404s while the home page
works.

If the build fails on **`Cannot find module '@arshad-shah/detent'`**, the build
command is missing the core build step.
If it fails on **`Worker name does not match`**, the project name is not
`detent-docs`.
If the domain never attaches, the zone for `arshadshah.com` is on a different
Cloudflare account than the one you connected.

## 5. What CI still does

`.github/workflows/docs.yml` builds the site and runs `astro check` on every
pull request, and deploys nothing. That keeps a broken site failing in the PR —
where you see it — while Cloudflare owns the deploy. There is deliberately no
`CLOUDFLARE_API_TOKEN` secret.

## 6. Protect `main`

Without this, anything with write access can push straight to `main` and
bypass every check in this repository. Run once:

```bash
gh api -X PUT repos/arshad-shah/detent/branches/main/protection \
  --input .github/branch-protection.json
```

The settings are in [`.github/branch-protection.json`](../.github/branch-protection.json)
so the intent is reviewable rather than buried in a dashboard. What it does:

- Pull requests only — no direct pushes, including for admins.
- `verify`, `changeset` and `build` must pass, against an up-to-date branch.
- Force pushes and branch deletion refused.
- Conversations must be resolved before merge.

Verify:

```bash
gh api repos/arshad-shah/detent/branches/main/protection --jq '.required_status_checks.contexts'
```

Should print `["verify","changeset","build"]`.

> **The Changesets bot needs to push.** The release workflow commits version
> bumps to a `changeset-release/main` branch and opens a PR — that is a branch
> push, not a `main` push, so protection does not block it. Merging that PR is
> a normal reviewed merge.

---

## How each system authenticates

**There are no repository secrets, and that is the point.**

| What | How it authenticates |
| --- | --- |
| npm publishing | OIDC, via npm Trusted Publishing scoped to this repo and `main.yml` |
| Docs deployment | Cloudflare's own GitHub App, configured in the Cloudflare dashboard |

Nothing long-lived is stored in GitHub, so there is nothing to leak or rotate
on a schedule.

`GITHUB_TOKEN` is provided automatically and scoped per job. The default for
this repo is read-only; each workflow grants only what it needs, and only
`main.yml`'s release job gets `id-token: write`.

## Revoking access

**Cloudflare** — Workers & Pages → `detent-docs` → Settings → Build →
Disconnect, and remove the Cloudflare app from
<https://github.com/settings/installations>.

**npm** — remove the trusted publisher on each package's Access page. CI can no
longer publish; local `npm publish` with your own login still works.
