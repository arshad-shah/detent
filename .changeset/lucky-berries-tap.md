---
"@arshad-shah/detent-elements": patch
"@arshad-shah/detent-react": patch
"@arshad-shah/detent-svelte": patch
---

Release alongside `@arshad-shah/detent` so all four stay on one version line.

`@arshad-shah/detent-elements` earns it on its own: its README told you to load
the stylesheet from `node_modules/detent/dist/styles.css`, a path that has not
existed since the packages were scoped, and that README ships inside the
published tarball.

`detent-react` and `detent-svelte` had correct documentation already. They are
here because the four packages are `linked` in `.changeset/config.json` — they
are meant to share a version, and leaving two of them a patch behind makes
"which versions go together" a question a reader has to work out rather than
read.
