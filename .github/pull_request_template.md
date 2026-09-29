<!--
Thanks for contributing. Keep this short — the checklist below is only the
things CI will fail the pull request on anyway, so finding out here is faster
than finding out from a red tick.

Setup, the three test tiers and the release process are in CONTRIBUTING.md.
-->

## What this changes

<!--
And why. If it closes issues, give each one its own keyword:

    Closes #12, closes #13, closes #14

GitHub only acts on the first reference in a comma-separated list, so
"Closes #12, #13, #14" silently leaves #13 and #14 open.
-->

## How it was verified

<!--
Which tier the new tests are in, and why that one:

  unit     pure functions only. No layout, no DOM measurement.
  browser  anything whose result depends on a real box. Three engines.
  e2e      the hostile host-page fixture.

Nothing fakes layout — if a test needs a real box it belongs in the browser
tier. If the change is behavioural, a bench in packages/detent/playground is
worth more than a paragraph here.
-->

## Checklist

- [ ] `pnpm build && pnpm typecheck && pnpm test` passes locally
- [ ] Any change under `packages/**` has a changeset (`pnpm changeset`)
- [ ] `pnpm size` passes, or a ceiling was raised in this PR and the changeset says why
- [ ] Public behaviour that changed is reflected in the docs
