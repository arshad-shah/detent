# detent — resize correctness and public lock-down

**Date:** 2026-09-29
**Status:** Approved, ready for planning
**Milestone:** [v0.3.0](https://github.com/arshad-shah/detent/milestone/1)
**Board:** [detent — resize correctness & public lock-down](https://github.com/users/arshad-shah/projects/4)

## Problem

`resizable` documents a precise contract:

> Pulling the top or left edge moves the element as well as sizing it — the edge
> you grabbed follows the pointer, so the opposite edge stays put.

and

> **Bounds become a size ceiling.** With `bounds` set, the element runs out of
> room rather than escaping its container.

Neither holds in general. Driving real pointer gestures through headless
Chromium across 24 scenarios found three defects, each a direct violation:

1. Resizing from any single handle **slides the whole element** whenever the
   host layout is not anchored to the element's top-left corner — centred,
   end-anchored, RTL, or pinned by `right`/`bottom`.
2. `aspectRatio` on an **edge** handle **escapes `bounds` entirely**, because
   only the axis the handle drives ever receives a bounds-derived ceiling.
3. `grid` makes the grabbed edge **lurch up to a full step**, sometimes against
   the pointer, whenever the element's start size is not already a multiple of
   the step.

A fourth defect explains why the first three survived two releases: the
playground — the only place a human looks at resize behaviour — **has not built
since the packages were scoped**, and the test suite only ever exercises
absolutely-positioned elements at grid-aligned start sizes.

Separately, the repository is being opened for outside contribution. Its CI is
already well hardened; what remains is one real credential-exposure gap and the
contributor-facing files that let strangers in cleanly.

## Goals

1. The documented resize contract is true for every host layout, not just the
   one the tests happen to use.
2. Each defect gets a test that fails first, in the tier `CONTRIBUTING.md`
   prescribes for it.
3. The playground can catch all three defects by eye, without a probe script.
4. No per-frame layout read is introduced. "Measure once, write once a frame" is
   the library's central claim and stays intact.
5. A contributor can file a useful bug report and open a mergeable PR without
   reading the source.

## Non-goals

- Reworking `draggable` or `sortable`. Both are correct here; `draggable` is in
  fact the reference implementation for the grid fix.
- Making `resizable` work on an element sized by `flex: 1`. That is documented
  as a limitation instead — see §3.4.
- `zizmor` workflow linting. Worth doing, not worth bundling into a release PR.
- Raising the required approving review count. See §5.2.

---

## 1. The anchoring fix

### 1.1 What is wrong

`computeResize` derives the corrective offset from the size change alone:

```ts
offsetX: dirX < 0 ? startWidth - width : 0,
offsetY: dirY < 0 ? startHeight - height : 0,
```

This is correct only if the element's **layout** position does not depend on its
size. The library writes `width`, the browser re-runs layout, and for most host
layouts the element's own position moves — with nothing compensating.

Measured, dragging the `se` handle **+60, +40** on a 190×110 element. Only the
bottom-right corner should move:

| Host layout | Δleft | Δtop | Δright | Δbottom |
| --- | --- | --- | --- | --- |
| `position: absolute; left; top` | 0 | 0 | +60 | +40 |
| `margin: 0 auto` | **−30** | 0 | +30 | +40 |
| flex, `justify-content: center` | **−30** | **−20** | +30 | +20 |
| flex, `justify-content: flex-end` | **−60** | 0 | 0 | +40 |
| `direction: rtl` | **−60** | 0 | 0 | +40 |
| `position: absolute; right; bottom` | **−60** | **−40** | 0 | 0 |

The first row is the only configuration any existing test uses.

### 1.2 The model

An element's layout left edge is an affine function of its width:

```
layoutLeft(w) = L₀ + kₓ·(w − startWidth)
```

`kₓ` is `0` when start-anchored, `−0.5` when centred, `−1` when end-anchored,
and can be fractional when a `flex-grow` sibling absorbs part of the change.

The library positions via `transform: translate3d(state.x, state.y, 0)`, so the
element's visual left edge is `layoutLeft(w) + state.x`. Requiring that to equal
the anchored-edge target gives:

```
state.x = startX + offsetX − kₓ·(width − startWidth)
```

where `offsetX` is the target displacement of the *left* edge — which is what
`computeResize` already returns, except that it currently has no term for `kₓ`.

**The correction belongs inside `computeResize`, not in `resizable`.**
`ResizeInput` gains an `anchor: Point` carrying the measured `k` per axis
(defaulting to `{ x: 0, y: 0 }`, which reproduces today's behaviour exactly), and
the returned `offsetX`/`offsetY` come back already corrected:

```ts
const targetX = dirX > 0 ? 0 : dirX < 0 ? startWidth - width : (startWidth - width) / 2;
offsetX: targetX - anchor.x * (width - startWidth),
```

The `dirX === 0` arm is §2.2's centred growth. Keeping every offset decision in
one pure function means all of it — the anchoring, the centring and their
interaction with clamping — is testable in the unit tier with no DOM, and
`resizable` is left doing nothing but measuring.

### 1.3 Measuring k

In `onStart`, after the existing measurement:

1. Save the exact inline `width` and `height` strings.
2. Write `startWidth − PROBE` to `el.style.width`; read `boxOf(el).left`.
3. Restore the saved inline strings.
4. `kₓ = (startLeft − probedLeft) / PROBE`, unscaled.

Both writes and both reads happen in one synchronous task, so the browser cannot
paint between them and there is no flicker. The cost is two forced layouts per
**gesture**, not per frame; `onStart` already calls `boxOf` and
`getComputedStyle`, so this does not add a new class of work.

**The probe shrinks rather than grows, and that choice matters.** Growing the
element by 32px can push a flex or inline row over its wrap threshold, move the
element onto a new line, and yield a `k` that describes a wrap rather than an
anchor. Shrinking cannot cause a wrap. It can collide with a `min-width`, so
`PROBE` is `min(32, max(1, startWidth − 1))` and a probe that produces no
measurable change is treated as `k = 0` — the correct answer for a start-anchored
element and a safe one for an element whose width the host refuses to honour.

`k` is clamped to `[−1, 0]` as a rail against a pathological measurement, and a
deadzone snaps `|k| < 0.02` to exactly `0`. The deadzone matters: without it,
sub-pixel layout noise on the common start-anchored path would introduce a small
drift where today there is none, which would be a regression.

`PROBE` is nominally `32px` — large enough that sub-pixel noise is a small
fraction of the measurement, small enough not to trip a host's own thresholds.

### 1.4 Rejected alternatives

**Classify from computed style.** Read `position`, `margin-*: auto`, the parent's
`justify-content`, `direction` and `text-align`, and derive `k` from rules. No
DOM write — but it is a lookup table that will never cover grid `justify-items`,
`place-self`, `space-evenly`, or `text-align` on an inline-block. It encodes a
guess where a measurement is available, and it fails silently when it guesses
wrong.

**Correct after each paint.** Measure the real left after each paint and add the
difference. Needs no model and self-corrects for any layout — but it forces a
layout read every frame, which is the precise guarantee the library sells, and
it lags one frame, so a fast drag visibly wobbles.

---

## 2. Aspect ratio

### 2.1 The escape

With `bounds: 'parent'` on a 700×500 parent and `aspectRatio: true`, dragging the
`n` handle up 150px:

```
before  left 480  top 200  right 670.0  bottom 310   190×110
after   left 480  top  50  right 929.1  bottom 310   449×260
```

229px outside the parent. Every bounds-derived limit in `onStart` is gated on the
handle's own direction, so an `n` handle (`dirX === 0`) leaves `maxWidth` at
`Infinity` — and `computeResize` then sets `width = height * aspect`, growing an
axis nothing constrains. The `w` handle does the same on the other axis.

### 2.2 Centred growth on the derived axis

Today the derived axis grows rightward or downward from the anchored edge, so
dragging the top edge up 40px throws the right edge out 69px. The box appears to
lurch sideways.

The derived axis has no edge the user grabbed, so it has no natural anchor.
Growing it **centred** makes an `n`-handle drag scale the box about its
bottom-centre, which is both what Figma does and what the §1.2 formula already
expresses: `offsetX = −(width − startWidth)/2` when `dirX === 0`.

This is a behaviour change beyond the escape itself, and it is included
deliberately: clamping the free axis without it leaves the box still visibly
shoving sideways when you drag the top edge, merely no longer out of its
container.

### 2.3 The derived-axis ceiling

With centred growth the element runs into both edges of the bounds area at once,
so:

```
maxWidth = startWidth + 2·min(startLeft − area.left, area.right − startRight)
```

and symmetrically for `maxHeight`. The driven-axis formulae are unchanged and
remain correct, because §1 makes the anchored edge genuinely stay where it
started.

`reconcileAspect` already prefers limits over the ratio, so the documented
"minimums win over ratios" behaviour carries through untouched.

---

## 3. Grid snapping

### 3.1 What is wrong

`computeResize` snaps the absolute size, counting from zero:

```ts
if (dirX !== 0 && grid[0] > 1) width = snap(width, grid[0]);
```

With `grid: 20` the reachable widths are 180 / 200 / 220, but the element starts
at 190 — exactly between two of them. The first move past the 4px distance
threshold therefore snaps 10px one way or the other. Measured: dragging the `w`
handle 6px left moves the left edge 10px left, overshooting the pointer by 4px.

### 3.2 The fix

`geometry.snap()` already takes an `origin` argument for precisely this, and says
so in its own docstring:

> Round a value to the nearest step, measured from `origin` rather than from
> zero — so a box that starts at an odd offset still lands on tidy multiples
> relative to where it began.

`draggable` passes it. `resizable` does not. Passing the start size:

```ts
if (dirX !== 0 && grid[0] > 1) width = snap(width, grid[0], startWidth);
if (dirY !== 0 && grid[1] > 1) height = snap(height, grid[1], startHeight);
```

A zero delta becomes a genuine no-op, and each grid step moves the grabbed edge
by exactly one step.

### 3.3 Why it survived

The existing unit test `snaps the size to a grid` starts at width 200 with
`grid: [10, 10]` — already aligned, so it passes identically before and after.
The new test starts deliberately off-grid.

### 3.4 The `flex: 1` no-op

An element sized by `flex: 1` ignores the width write entirely, so resize
silently does nothing. The §1.3 probe degrades correctly — it measures `kₓ = 0`
and applies no correction — but the underlying no-op remains, and fixing it would
mean writing `flex-basis` and guessing at the host's intent.

This becomes a fourth entry in `apps/docs/src/content/docs/guides/limitations.md`,
alongside the stacking-context and scroll-anchoring entries, with the workaround
(`flex: none`, or size the element by `width`).

---

## 4. The playground

Fix `globalName` back to `detent`, delete the stale 2,136-line
`detent-playground.html`, and add a build assertion to `scripts/size-check.mjs`
so a broken playground fails `pnpm size` — already run by both `pr.yml` and
`main.yml` — rather than going unnoticed for two releases.

Then four new bench groups (one issue each), targeting what is currently
invisible:

| Bench | Catches | Issue |
| --- | --- | --- |
| Anchoring: one card, six hosts, live Δ readouts | §1 | [#42](https://github.com/arshad-shah/detent/issues/42) |
| Aspect ratio in a visibly bordered cage | §2 | [#42](https://github.com/arshad-shah/detent/issues/42) |
| Off-grid start size, pointer Δ vs edge Δ | §3 | [#42](https://github.com/arshad-shah/detent/issues/42) |
| All eight handles, with live option toggles | untested handles | [#43](https://github.com/arshad-shah/detent/issues/43) |
| Hostile host: scaled ancestors, RTL, shadow root, reset | host interactions | [#44](https://github.com/arshad-shah/detent/issues/44) |
| Composition: shared `BoxState` across bindings | state conflicts | [#45](https://github.com/arshad-shah/detent/issues/45) |

The playground stays one self-contained file that opens from `file://`, and the
gzipped size stays under 40 KB.

---

## 5. Repository lock-down

### 5.1 Credentials in `.git/config`

`actions/checkout` defaults to `persist-credentials: true`, writing the job's
`GITHUB_TOKEN` into `.git/config` as an `http.extraheader` where any later step
can read it — including a `postinstall` from any transitive dependency.

It matters most in the one job that holds write access: `main.yml`'s `release`
job has `contents: write`, `pull-requests: write` and `id-token: write`, and runs
`pnpm install` before `changesets/action`. A compromised transitive dependency
there can read a token that pushes to `main` and mints an OIDC token for npm.

`persist-credentials: false` on all eight checkout steps. Two need verifying
rather than assuming:

- `main.yml`'s `release` job — `changesets/action` pushes commits and tags, but
  it authenticates through `GITHUB_TOKEN` in `env:`, which is the correct
  channel. The version PR must still open.
- `pr.yml`'s `changeset` job — `changeset status --since=origin/$BASE` needs the
  base ref, which `fetch-depth: 0` supplies without a stored credential.

Plus `actions/dependency-review-action` on pull requests, SHA-pinned, so a PR
introducing an advisory-carrying or badly-licensed dependency fails a check
rather than relying on a human reading a lockfile diff. This matters more now
that lockfile changes will arrive from people without write access.

### 5.2 Branch protection

Add codeql's `analyze` to `required_status_checks.contexts` — it runs on every
PR with `security-extended` but is not currently a gate. Turn on
`require_code_owner_reviews`, so `CODEOWNERS` becomes a gate rather than
documentation for the paths that reach publishing credentials.

**`required_approving_review_count` stays `0`.** GitHub does not allow approving
your own PR, so requiring one approval on a single-maintainer repository means
nothing can merge — including the automated Version Packages PR that cuts every
release. Zero approvals plus required checks plus code-owner review is the
strongest configuration that still functions, and it starts biting the moment a
second person gets write access, with no further change. The reasoning goes into
`CONTRIBUTING.md` so it does not read as an oversight.

### 5.3 Contributor on-ramp

`CODE_OF_CONDUCT.md` (Contributor Covenant 3.0), issue **forms** rather than
markdown templates so fields are required, and a PR template covering the three
things CI will fail on anyway.

The bug form's required fields are the ones that decide whether a detent report
is reproducible: package and version, which of the three APIs, browser engine,
**input device** (mouse / touch / pen — the commonest source of "works for me"),
and the host layout around the element, which is what both §1 and §2 turned on.

---

## 6. Testing

Every fix arrives test-first, in the tier `CONTRIBUTING.md` prescribes:

**Unit** (`test/unit/resize-math.test.ts`) — pure functions only:
- grid snapping from an off-grid start size, both axes, zero delta is a no-op
- each grid step moves the grabbed edge exactly one step
- the derived axis grows centred on an edge handle under `aspectRatio`
- the `anchor` correction at `k = 0`, `−0.5`, `−1`, and that `k = 0` reproduces
  today's offsets byte for byte

**Browser** (`test/browser/resizable.test.ts`) — anything depending on a real box:
- the unrelated edges hold still for `se` and `nw` across all six host layouts
- `n` and `w` handles with `aspectRatio` + `bounds: 'parent'` stay inside the
  parent on both axes, from starting positions near each edge
- the probe restores the element's inline `width`/`height` exactly, including
  when there was no inline style to begin with
- `destroy()` after a resize still returns the element as found

Non-negotiable per `CONTRIBUTING.md`: nothing fakes layout. The anchoring cases
cannot go in the unit tier, because a centred element's response to a width
change *is* the thing under test.

## 7. Release

One PR, commits separated by concern, one `minor` changeset on
`@arshad-shah/detent`. The `linked` config in `.changeset/config.json` bumps all
four packages together.

`minor` rather than `patch`: three observable behaviours change. All three move
the library *towards* its documented contract rather than away, so no consumer
relying on documented behaviour breaks — but a consumer who compensated for the
anchoring bug in their own CSS will see their compensation double-applied, and
that deserves a minor bump and an explicit changelog note.
