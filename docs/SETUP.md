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

## 3. Cloudflare: create an API token

You need the zone for `arshadshah.com` to be on the same Cloudflare account.

1. Go to <https://dash.cloudflare.com/profile/api-tokens> → **Create Token**.
2. Use the **Edit Cloudflare Workers** template.
3. Set the permissions to exactly these — the template gives you most of them;
   add the last one, which the template omits and the custom domain needs:

| Type | Resource | Permission |
| --- | --- | --- |
| Account | Workers Scripts | Edit |
| Account | Workers KV Storage | Edit |
| Account | Account Settings | Read |
| Zone | Workers Routes | Edit |
| Zone | DNS | Edit |

4. **Account Resources**: Include → the account that owns `arshadshah.com`.
5. **Zone Resources**: Include → Specific zone → `arshadshah.com`.
6. Leave the IP filter and TTL empty unless you have a reason.
7. **Continue to summary** → **Create Token** → copy it now. It is shown once.

The **DNS: Edit** permission is what lets the first deploy create the
`detent.arshadshah.com` record. Without it the deploy succeeds but the custom
domain never attaches, and the site is reachable only at
`detent-docs.<subdomain>.workers.dev`.

## 4. Find your account ID

<https://dash.cloudflare.com> → pick the account → the **Account ID** is in the
right-hand sidebar of the overview page, and in the URL:

```
https://dash.cloudflare.com/<THIS IS THE ACCOUNT ID>/workers
```

It is a 32-character hex string.

## 5. Add both as repository secrets

<https://github.com/arshad-shah/detent/settings/secrets/actions> → **New
repository secret**, twice:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | the token from step 3 |
| `CLOUDFLARE_ACCOUNT_ID` | the 32-char hex id from step 4 |

Names are case-sensitive and must match exactly — `.github/workflows/docs.yml`
reads them literally.

### Checking it worked

Push anything to `main`. The `docs` workflow builds, then runs
`wrangler deploy` from `apps/docs`. On success:

```bash
curl -sI https://detent.arshadshah.com | head -1     # HTTP/2 200
```

The first deploy also creates the Worker (`detent-docs`) and claims the custom
domain. Later deploys just replace the assets.

If the deploy fails with **`Authentication error [code: 10000]`**, the token
lacks a permission from step 3 — most often `Account Settings: Read`.
If it fails on the route with **`workers.api.error.zone_not_found`**, the zone
for `arshadshah.com` is on a different account than the token's.

---

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

## Where each secret is used

| Secret | Used by | Scope |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | `.github/workflows/docs.yml` | Deploy the docs site |
| `CLOUDFLARE_ACCOUNT_ID` | `.github/workflows/docs.yml` | Deploy the docs site |
| *(none for npm)* | `.github/workflows/main.yml` | Publishing uses OIDC |

`GITHUB_TOKEN` is provided automatically and scoped per job. The default for
this repo is read-only; each workflow grants only what it needs, and only
`main.yml`'s release job gets `id-token: write`.

## Rotating the Cloudflare token

Tokens do not expire unless you set a TTL. To rotate: create a new token with
the same permissions, update the repository secret, confirm one deploy
succeeds, then delete the old token from the Cloudflare dashboard. There is no
window where both must be valid.
