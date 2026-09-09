# detent Phase 5 — Adversarial Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Have parallel agents attack the finished source on six dimensions, disprove every claim they make, and fix only what survives — each fix reproduced as a failing test first.

**Architecture:** Two adversarial passes with opposite incentives. Six review agents are each told to argue the code is broken on one dimension and to cite file and line; their output is a claim list, not a defect list. A second pass takes each claim and tries to *disprove* it, because a reviewer looking for problems will find them whether or not they exist. Only a claim that survives disproof **and** can be reproduced as a failing test becomes a fix.

**Tech Stack:** The Agent tool for parallel review, the existing Vitest and Playwright tiers for reproduction, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-09-detent-oss-hardening-design.md` — §7 (adversarial validation).

## Global Constraints

- **An agent's assertion is not evidence.** No claim is acted on until it is reproduced as a test that fails on the current code.
- **A disproved claim is recorded, not deleted.** The audit's value is partly in what turned out to be fine, and why.
- **Fixes are test-first**, in the tier that can actually observe them — unit for pure functions, browser for anything touching layout, e2e for host-page hazards.
- **Every fix needs a changeset**; CI enforces it for `packages/**`.
- **Zero findings is a legitimate outcome.** Do not manufacture work to justify the phase.
- Review agents get **read-only** tools. They report; they do not edit.
- Node 24, pnpm 11. Build before typecheck.

---

## Starting point

Phases 1–4 are merged. `main` has four published-shape packages plus
`apps/docs`, 516 tests, and CI that gates every PR.

```bash
git checkout main && git pull
git checkout -b phase-5-audit
```

**The surface under audit** — 2,571 lines of TypeScript across 35 files:

| Package | Lines | Largest files |
|---|---|---|
| `detent` | 2,047 | `sortable/index.ts` 349, `core/pointer.ts` 203, `resizable/index.ts` 183, `draggable.ts` 182 |
| `detent-elements` | 177 | `elements.ts` 85, `base.ts` 69 |
| `detent-react` | 162 | three near-identical hooks, 44–45 each |
| `detent-svelte` | 100 | `actions.ts` 89 |

Two things to hold in mind while reading the findings:

**This code has already been audited once.** Phase 1 fixed 14 defects found by
reading. The cheap findings are gone; what remains will be subtler, and a
review agent under instruction to find problems will feel pressure to report
something. That pressure is exactly what Task 3 exists to counteract.

**One earlier finding did not reproduce.** The Phase 1 spec claimed keyboard
reordering broke inside shadow DOM. It did not — retargeting only applies to
listeners outside the boundary. That is the shape of error to expect, and the
reason the disproof pass is not optional.

---

## File Structure

| Path | Responsibility |
|---|---|
| `docs/superpowers/audits/2026-09-09-claims.md` | Raw claims from the six review agents, verbatim, before any judgement. |
| `docs/superpowers/audits/2026-09-09-verdicts.md` | One verdict per claim: reproduced, disproved, or accepted-as-documented. |
| `packages/*/test/**` | New tests reproducing each surviving claim. |
| `.changeset/*.md` | One per behavioural fix. |

Claims and verdicts are separate files on purpose. Keeping them together
invites editing a claim after seeing its verdict, which destroys the record of
what the review actually said.

---

## Task 1: Prepare the review packet

**Files:**
- Create: `docs/superpowers/audits/README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the exact prompt each review agent receives, and the report format they must return. Later tasks depend on that format being uniform.

Six agents reading the same code with six different briefs only produces
comparable output if the brief and the format are fixed in advance.

- [ ] **Step 1: Write the audit README**

```markdown
# Audits

Adversarial reviews of the source, and what came of them.

| Date | Scope | Claims | Reproduced | Disproved |
| --- | --- | --- | --- | --- |
| 2026-09-09 | All four packages, post-Phase-4 | — | — | — |

Fill the row in when the audit completes.

## How these run

Six agents review the source in parallel, one dimension each, instructed to
argue the code is broken and to cite file and line. Their output is a **claim
list, not a defect list**.

A second pass tries to disprove each claim, because a reviewer told to find
problems will find them whether or not they exist. Only a claim that survives
disproof *and* reproduces as a failing test becomes a fix.

Disproved claims are kept. Knowing that something was examined and found sound
is worth as much as the fixes, and it stops the same claim being re-litigated
by the next audit.
```

- [ ] **Step 2: Fix the review brief**

Every agent gets this preamble, with only the **Dimension** section differing.
Record it in the audit README under a `## The brief` heading so the next audit
uses the same one:

```
You are reviewing the detent library — a zero-dependency drag, reorder and
resize library for the web. Your job is to argue that this code is BROKEN on
one specific dimension. Be adversarial. Assume the author was careless.

Read these packages:
  packages/detent/src/          the core library
  packages/detent-react/src/    React hooks
  packages/detent-svelte/src/   Svelte actions
  packages/detent-elements/src/ custom elements

Dimension: <one of the six>

Rules:
- Cite file and line for every claim. A claim without a location is worthless.
- State the concrete failure: what input or state, what wrong result. "This
  could be a problem" is not a claim; "with two lists sharing a group, X
  returns Y instead of Z" is.
- Do NOT edit any file. You are reporting, not fixing.
- Rank claims by severity: BREAKS (wrong behaviour a user hits), RISKY
  (wrong only under conditions you name), SMELL (correct but poorly expressed).
- If you cannot find a real problem on your dimension, say so and stop. A short
  honest report is more useful than a padded one. You are not scored on volume.

Report format, one block per claim:

  ### <short title>
  Severity: BREAKS | RISKY | SMELL
  Location: <path>:<line>
  Claim: <what is wrong>
  Failure: <the exact input or state, and the wrong result>
  Why you think the author missed it: <one sentence>
```

The last two rules matter more than the rest. Without the permission to find
nothing, an agent will invent something; without a demanded failure mode, it
will report vibes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: fix the adversarial review brief

Six agents reading the same code with six briefs only produces comparable
output if the brief and format are fixed first. Includes explicit
permission to find nothing, because a reviewer told to find problems will
otherwise invent them."
```

---

## Task 2: Run the six reviews in parallel

**Files:**
- Create: `docs/superpowers/audits/2026-09-09-claims.md`

**Interfaces:**
- Consumes: the brief from Task 1.
- Produces: every claim, verbatim, grouped by dimension. No editing, no filtering, no judgement — Task 3 does that.

- [ ] **Step 1: Dispatch all six agents in one message**

Six `Agent` tool calls in a single message so they run concurrently. Each gets
the Task 1 preamble with its own **Dimension** paragraph:

**1 — Correctness.**
> Find cases where the library produces the wrong result. Focus on the state
> machine around a drag: what happens when a drag starts while another is
> running, when an element is removed mid-drag, when `destroy()` is called
> from inside a callback, when a callback throws, when the same element is
> bound twice, when a list is empty, when a pointer is cancelled by the OS.

**2 — Duplication and scattered constants.**
> Find logic written more than once, and values that live in more than one
> place. `packages/detent/src/core/constants.ts` is supposed to be the single
> home for every tunable and every class name — find anything that escaped it.
> The three React hooks are near-identical by design; argue whether that
> repetition is justified or hiding a missing abstraction.

**3 — Error handling.**
> The library uses `__DEV__`-gated invariants for caller mistakes and handles
> nothing else, deliberately. Find places where that is wrong: a recoverable
> condition treated as a programming error, a programming error that fails
> silently instead, a guard that would not fire when it should, or a
> production path that can throw a cryptic error a consumer cannot act on.

**4 — File decomposition.**
> Find code in the wrong file: logic inlined where it does not belong, a
> module doing two jobs, a function that should be extracted, an abstraction
> boundary that leaks. `sortable/index.ts` is 349 lines — argue whether it
> should be smaller and exactly where the seam is.

**5 — CSS and host-page collision.**
> The library must not clash with a host page and must not be overridable in
> ways that break it. Find any class, attribute, id or global the library
> writes that could collide; any load-bearing style that could be overridden
> by a host stylesheet; any assumption about the host's CSS that does not
> hold. Read `packages/detent/src/styles.css` and every place the source
> writes an inline style.

**6 — Performance and forced reflow.**
> Find layout thrashing: a read of `getBoundingClientRect`, `offsetWidth`,
> `scrollTop` or `getComputedStyle` in a hot path, a read interleaved with a
> write, work done per pointer event that could be done per drag, a listener
> that fires more often than it needs to. Pointer events can fire at 240Hz —
> anything per-event is a hot path.

- [ ] **Step 2: Collect the reports verbatim**

Write every claim into `docs/superpowers/audits/2026-09-09-claims.md`, grouped
by dimension, in the agents' own words. Do not correct, merge or drop any of
them at this stage — including ones you can already see are wrong. Task 3 needs
the unedited record.

Head the file:

```markdown
# Adversarial review — 2026-09-09

Raw claims from six parallel review agents. **Unverified.** Verdicts are in
`2026-09-09-verdicts.md`; do not act on anything here without reading that.
```

- [ ] **Step 3: Count and commit**

```bash
grep -c '^### ' docs/superpowers/audits/2026-09-09-claims.md
git add -A
git commit -m "docs: raw claims from six adversarial reviews

Unverified and unedited, including the ones that are visibly wrong — the
verdict pass needs the record of what the review actually said."
```

---

## Task 3: Disprove every claim

**Files:**
- Create: `docs/superpowers/audits/2026-09-09-verdicts.md`

**Interfaces:**
- Consumes: the claims from Task 2.
- Produces: one verdict per claim — `REPRODUCED`, `DISPROVED` or `DOCUMENTED` — each with the evidence that settled it.

This is the task that makes the phase worth running. Its incentive is the
opposite of Task 2's: for each claim, try to show the code is **right**.

- [ ] **Step 1: Triage by whether a test could exist**

For each claim, decide which kind it is before investigating:

| Kind | How it is settled |
|---|---|
| Behavioural (`BREAKS`, `RISKY`) | Write the test the claim implies. It fails → `REPRODUCED`. It passes → `DISPROVED`. |
| Structural (`SMELL`) | Judgement. Settle it by asking whether a specific future change becomes harder, and name that change. |
| Already known | Cross-check against `docs/superpowers/notes/` and the specs. If it is a documented limitation, verdict `DOCUMENTED` with the link. |

- [ ] **Step 2: Attack each behavioural claim**

For every `BREAKS` or `RISKY` claim, write the smallest test that would fail if
the claim is true, in the tier that can observe it:

- pure function → `packages/detent/test/unit/`
- anything touching layout → `packages/*/test/browser/`
- host-page hazard → `packages/detent/e2e/`

Run it. The result is the verdict — not your reading of the code, and not the
agent's.

Where the claim is too vague to test, that is itself the verdict: record
`DISPROVED — not specific enough to reproduce`, and quote the claim so a future
reader can see why.

- [ ] **Step 3: Write the verdicts file**

```markdown
# Adversarial review verdicts — 2026-09-09

Every claim from `2026-09-09-claims.md`, and what settled it.

| # | Claim | Severity | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| 1 | <short title> | BREAKS | REPRODUCED | `test/browser/x.test.ts` fails on current code |
| 2 | <short title> | RISKY | DISPROVED | test written and passes; the guard at `pointer.ts:93` already covers it |
| 3 | <short title> | SMELL | DOCUMENTED | see `notes/stacking-contexts.md` |

## Disproved in detail

For each DISPROVED claim, one paragraph: what the agent believed, what is
actually true, and where the misreading came from. This is the part that stops
the next audit re-litigating the same ground.
```

- [ ] **Step 4: Keep the tests that disprove things**

A test written to disprove a claim is a regression test for a property nobody
had asserted. Keep it, named for the property rather than the claim —
`it('ignores a second pointer while a drag is running')`, not
`it('claim 4 is wrong')`.

- [ ] **Step 5: Run the full suite and commit**

```bash
pnpm build && pnpm typecheck && pnpm test && pnpm test:e2e
```

Expected: green, with more tests than before. Reproduced claims will have
failing tests — do not commit those yet; they belong to Task 4. Comment them
out or hold them on a scratch branch and note which.

```bash
git add -A
git commit -m "test: verdicts on the adversarial review claims

Every behavioural claim settled by a test rather than by reading. The
tests that disproved claims are kept: each asserts a property nobody had
written down."
```

---

## Task 4: Fix what survived

**Files:** determined by the verdicts. Unknown when this plan is written, which
is the nature of an audit.

**Interfaces:**
- Consumes: the `REPRODUCED` rows from Task 3.
- Produces: a fix per reproduced claim, each with its failing test now passing.

- [ ] **Step 1: Order the reproduced claims**

`BREAKS` before `RISKY`, and within each, whatever a consumer hits soonest.
Work one at a time — a batch of fixes with one test run tells you nothing about
which fix did what.

- [ ] **Step 2: For each, in order**

1. Un-hold its failing test from Task 3. Run it. Confirm it fails, and read the
   failure — a test failing for the wrong reason proves nothing.
2. Make the smallest change that fixes it.
3. Run that test. It passes.
4. Run the full suite. Nothing else broke.
5. Commit, quoting the measured before-and-after in the message the way the
   Phase 1 commits do — `expected 50 to be close to 100` says more than "fixed
   a scaling bug".

- [ ] **Step 3: Write one changeset per behavioural fix**

```bash
pnpm changeset
```

`patch` for a fix, `minor` if the public API gained anything. Describe the
symptom a consumer would have seen, not the internal cause — they are reading a
changelog to find out whether this affected them.

- [ ] **Step 4: Verify the fixes did not move the size budget**

```bash
pnpm build && pnpm size
```

If a fix pushes a bundle over, raise that ceiling in the same PR and say why in
its changeset — that rule is in `CONTRIBUTING.md` and this is exactly the case
it exists for.

- [ ] **Step 5: If nothing reproduced, say so and stop**

An audit finding nothing is a result. Record it in the verdicts file, update
the audit README's table, and skip to Task 5. **Do not** invent refactors to
justify the phase — the spec's own words are that no finding is acted on until
it is reproduced as a failing test, and that cuts both ways.

---

## Task 5: Close out the audit

**Files:**
- Modify: `docs/superpowers/audits/README.md`, `README.md` (root), and
  `docs/superpowers/notes/` if a `DOCUMENTED` verdict produced new guidance

**Interfaces:**
- Consumes: everything above.
- Produces: a record a future maintainer can act on.

- [ ] **Step 1: Fill in the audit README table**

```markdown
| Date | Scope | Claims | Reproduced | Disproved |
| --- | --- | --- | --- | --- |
| 2026-09-09 | All four packages, post-Phase-4 | 17 | 3 | 14 |
```

Use the real numbers.

- [ ] **Step 2: Promote any DOCUMENTED verdict into real documentation**

If a claim turned out to be a genuine limitation rather than a bug, it belongs
in `apps/docs/src/content/docs/guides/limitations.md` beside the stacking
contexts and scroll anchoring entries — not buried in an audit file nobody will
read.

- [ ] **Step 3: Run everything**

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm size
pnpm -F docs build
```

Expected: all green.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin phase-5-audit
gh pr create --base main --head phase-5-audit \
  --title "Phase 5: adversarial validation" \
  --body "Implements section 7 of the hardening spec. See docs/superpowers/plans/2026-09-09-phase-5-adversarial-validation.md"
```

The PR body should lead with the claim/reproduced/disproved counts, then the
fixes, then a short note on the most interesting disproved claim. A reviewer
wants to know what was checked, not only what changed.

- [ ] **Step 5: Watch the checks and report**

```bash
gh pr checks --watch
```

Report to your human partner: the counts, each fix with its measured
before-and-after, and — honestly — whether the audit was worth running. If six
agents found three real defects in already-audited code, say so. If they found
none, say that too.

---

## Self-Review

**Spec coverage.** §7 has four requirements and each maps to a task: parallel
agents one per dimension → Task 2, all six dispatched in a single message;
instructed to argue the code is broken and cite file and line → Task 1's brief;
a verification pass whose job is to disprove → Task 3, with the inverted
incentive stated explicitly; no finding acted on until reproduced as a failing
test → Task 3 Step 2 settles verdicts by test, and Task 4 Step 2 re-confirms
the failure before each fix. The spec's closing line — "an agent's assertion is
not evidence" — is the first Global Constraint.

**Placeholder scan.** Task 4 has no file list and no code blocks, because its
content is determined by findings that do not exist yet. That is a genuine
property of an audit, not a placeholder: its *procedure* is fully specified,
and Step 5 states what to do when there is nothing to fix. Every other task
carries its actual content.

**Type consistency.** No new types. The three verdict values —
`REPRODUCED`, `DISPROVED`, `DOCUMENTED` — are defined in Task 3 Step 1 and used
in Steps 3 and 4, in Task 4 Step 1, and in Task 5 Step 2.

**One gap found and closed.** Task 3 originally had the disproving tests
committed alongside the reproducing ones, which would have left the branch red
between Tasks 3 and 4 and made it impossible to tell a held failing test from a
regression. Step 5 now separates them explicitly.

**A risk this plan cannot design away.** Six adversarial agents on
already-audited code will produce mostly noise, and the honest outcome may be
"14 disproved, 0 reproduced". That is a real result and Task 4 Step 5 protects
it — but it also means the phase's value is concentrated in Task 3, so if time
is short, cut the number of dimensions rather than the disproof pass.

**Known ordering constraint.** Tasks are strictly sequential; each consumes the
previous one's output. The only parallelism is inside Task 2, where all six
agents must be dispatched in one message to actually run concurrently.
