# Security

## Reporting a vulnerability

Report privately through GitHub's advisory flow:

**<https://github.com/arshad-shah/detent/security/advisories/new>**

Please do not open a public issue for anything exploitable. Include what you
did, what happened, and which package and version — a reproduction in a
CodeSandbox or a failing test is ideal.

You should get an acknowledgement within a week. If a fix is warranted it ships
as a patch release with a GitHub Security Advisory and a CVE where one applies.

## What is in scope

`detent` runs entirely in the browser, has no network access, no storage, and
no runtime dependencies. The realistic attack surface is small but not empty:

| In scope | Why |
| --- | --- |
| DOM-based XSS through any API that accepts a selector or a node | `items`, `handle`, `cancel` and `handles` accept selectors |
| Prototype pollution through an options object | Options are merged and spread |
| A supply-chain compromise of a published tarball | See below |
| Anything that lets page content escape the library's own DOM writes | The library writes classes, attributes and inline styles |

Out of scope: denial of service by passing deliberately absurd values (a
100,000-item list is slow; that is not a vulnerability), and anything requiring
the attacker to already control the page's JavaScript.

## How releases are secured

- **No long-lived publish token exists.** Publishing authenticates over OIDC
  through npm Trusted Publishing, scoped to this repository and to
  `.github/workflows/main.yml`. There is no `NPM_TOKEN` secret to steal.
- **Every release carries a provenance attestation**, linking the tarball to
  the exact workflow run and commit that produced it. Verify with
  `npm audit signatures`.
- **GitHub Actions are pinned to commit SHAs**, not tags. A tag can be moved;
  a SHA cannot. Dependabot proposes updates weekly.
- **The default `GITHUB_TOKEN` is read-only.** Each workflow grants only the
  permissions it needs, and only the release job gets `id-token: write`.
- **`main` is protected**: pull requests only, required checks, no force
  pushes, enforced for admins too.
- **Secret scanning and push protection are on**, so a credential committed by
  accident is blocked at push time rather than found later.

## Verifying what you installed

```bash
npm audit signatures
```

For a specific version:

```bash
npm view detent dist.integrity
```

The provenance badge on <https://www.npmjs.com/package/detent> links to the
workflow run that built it, and that run's logs are public.

## Supported versions

Pre-1.0, only the latest minor receives fixes. That changes at 1.0.
