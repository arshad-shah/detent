# Audits

Adversarial reviews of the source, and what came of them.

| Date | Scope | Claims | Reproduced | Disproved |
| --- | --- | --- | --- | --- |
| 2026-09-09 | All four packages, post-Phase-4 | 8 behavioural + 6 structural | 7 + 6 | 1 |

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

## The brief

Every agent gets this, with only the **Dimension** paragraph differing.

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

The last two rules matter more than the rest. Without explicit permission to
find nothing, an agent will invent something; without a demanded failure mode,
it will report vibes.
