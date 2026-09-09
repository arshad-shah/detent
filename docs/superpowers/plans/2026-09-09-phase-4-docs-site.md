# detent Phase 4 — Documentation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `detent.arshadshah.com` — an Astro Starlight site where every API is documented beside a demo you can actually drag, deployed from `main` by CI.

**Architecture:** A private `apps/docs` workspace package holding a Starlight site. Demos are real: each one imports the library from the workspace and binds it to markup on the page, so a broken build or a broken API surfaces as a broken demo rather than a stale code block. A third CI workflow builds the site on every PR and deploys it to Cloudflare Workers static assets on merge to `main`.

**Tech Stack:** Astro 7.3, Starlight 0.42, Wrangler 4.130, `cloudflare/wrangler-action@v4`, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-09-detent-oss-hardening-design.md` — §1 (`apps/docs`) and §6 (`docs.yml`, Cloudflare deployment).

## Global Constraints

- **`apps/docs` is private** — `"private": true`, never published to npm.
- **Demos import the library through the workspace** (`detent: "workspace:^"`), never a copied snippet. A demo that no longer compiles is a build failure.
- **The site is fully static.** No SSR adapter, no server runtime — Astro's default static output, served as Workers static assets.
- **Deployment is `main`-only.** Pull requests build the site as a check and deploy nothing.
- **Two repository secrets**: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Until they exist the deploy step fails and everything before it passes — same designed sequence as npm Trusted Publishing.
- **Custom domain** `detent.arshadshah.com`, configured in `wrangler.toml` as a route.
- **No content duplicated from the READMEs by hand.** Where the same words serve both, the site is the source and the README links to it.
- Node 24, pnpm 11. Changesets are **not** required for `apps/docs` — it is private, so `changeset status` ignores it.

---

## Starting point

Phases 1–3 are merged. `main` has four packages at `0.2.0`, CI with `pr.yml`
and `main.yml`, and a release pipeline that publishes on merging a Version
Packages PR.

```bash
git checkout main && git pull
git checkout -b phase-4-docs
```

**Branch fresh from `main`, not from another phase branch.** Stacked PRs
auto-closed twice in earlier phases when their base was merged and deleted.

**One thing to know:** no package is on npm yet — the first publish is manual
and had not been done when this plan was written. The docs site is unaffected;
it resolves `detent` through the workspace. It only means install instructions
on the site describe something not yet installable, which is correct as soon as
you publish.

---

## File Structure

| Path | Responsibility |
|---|---|
| `apps/docs/package.json` | Private workspace package. Astro + Starlight. |
| `apps/docs/astro.config.mjs` | Starlight configuration: sidebar, site metadata, social links. |
| `apps/docs/wrangler.toml` | Cloudflare Workers static-assets config and the custom domain route. |
| `apps/docs/src/content.config.ts` | Astro content collections wiring for Starlight. |
| `apps/docs/src/content/docs/index.mdx` | Landing page: what it is, the hero demo, install. |
| `apps/docs/src/content/docs/guides/*.md` | Getting started, styling, limitations. |
| `apps/docs/src/content/docs/api/*.md` | One page per entry point. |
| `apps/docs/src/content/docs/frameworks/*.md` | One page per wrapper. |
| `apps/docs/src/components/Demo.astro` | The one wrapper every demo uses: a bordered stage plus a reset button. |
| `apps/docs/src/demos/*.ts` | One module per demo, each binding the real library. |
| `apps/docs/src/styles/custom.css` | Site theme overrides and demo styling. |
| `apps/docs/public/` | Favicon and social image, copied from `brand/`. |
| `.github/workflows/docs.yml` | Build on PR, deploy on `main`. |

Demos live in `src/demos/` as plain TypeScript rather than inline `<script>`
blocks, so they typecheck with the rest of the workspace and a change to the
library's API breaks the build rather than the page.

---

## Task 1: Scaffold the Starlight site

**Files:**
- Create: `apps/docs/package.json`, `apps/docs/astro.config.mjs`, `apps/docs/tsconfig.json`, `apps/docs/src/content.config.ts`, `apps/docs/src/content/docs/index.mdx`, `apps/docs/.gitignore`
- Modify: `pnpm-workspace.yaml`, `package.json` (root)

**Interfaces:**
- Consumes: `detent` via `workspace:^`.
- Produces: `pnpm -F docs dev` and `pnpm -F docs build`, and a root `pnpm docs` script.

- [ ] **Step 1: Add `apps/*` to the workspace**

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'

# esbuild fetches its platform binary in a postinstall script.
allowBuilds:
  esbuild: true
```

- [ ] **Step 2: Write the package manifest**

Named `docs` rather than `detent-docs`: it is private, so the name is only ever
a `pnpm -F` filter target, and the short one is what you will type.

```json
{
  "name": "docs",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "typecheck": "astro check",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "detent": "workspace:^"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.10",
    "@astrojs/starlight": "^0.42.0",
    "astro": "^7.3.2",
    "sharp": "^0.34.0",
    "typescript": "^7.0.2",
    "wrangler": "^4.130.0"
  }
}
```

`sharp` is Astro's image optimiser; without it the build warns and skips
optimisation.

- [ ] **Step 3: Write the Astro config**

```js
// apps/docs/astro.config.mjs
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://detent.arshadshah.com',
  integrations: [
    starlight({
      title: 'detent',
      description:
        'Tiny zero-dependency drag, reorder and resize for the web. ' +
        'Pointer-based, touch-ready, framework-free.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/arshad-shah/detent' },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/detent' },
      ],
      editLink: {
        baseUrl: 'https://github.com/arshad-shah/detent/edit/main/apps/docs/',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Guides',
          items: [
            { label: 'Getting started', slug: 'guides/getting-started' },
            { label: 'Styling', slug: 'guides/styling' },
            { label: 'Limitations', slug: 'guides/limitations' },
          ],
        },
        {
          label: 'API',
          items: [
            { label: 'draggable', slug: 'api/draggable' },
            { label: 'sortable', slug: 'api/sortable' },
            { label: 'resizable', slug: 'api/resizable' },
          ],
        },
        {
          label: 'Frameworks',
          items: [
            { label: 'React', slug: 'frameworks/react' },
            { label: 'Svelte', slug: 'frameworks/svelte' },
            { label: 'Web Components', slug: 'frameworks/web-components' },
          ],
        },
      ],
    }),
  ],
});
```

- [ ] **Step 4: Write the content collection config and tsconfig**

Starlight 0.42 requires an explicit content config; without it the build fails
with "no collections found".

```ts
// apps/docs/src/content.config.ts
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection } from 'astro:content';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
```

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

Save as `apps/docs/tsconfig.json`. It does **not** extend the repository's
root tsconfig: Astro's own preset carries the JSX and module settings the
framework needs, and mixing the two produces confusing errors.

```
# apps/docs/.gitignore
dist/
.astro/
.wrangler/
```

- [ ] **Step 5: Write a placeholder landing page**

Enough to prove the build works. Task 4 replaces it.

```mdx
---
title: detent
description: Tiny zero-dependency drag, reorder and resize for the web.
template: splash
hero:
  tagline: Drag, reorder and resize for the web. No dependencies, no framework, one input path for mouse, touch and pen.
  actions:
    - text: Getting started
      link: /guides/getting-started/
      icon: right-arrow
    - text: GitHub
      link: https://github.com/arshad-shah/detent
      icon: external
      variant: minimal
---

import { CardGrid, Card } from '@astrojs/starlight/components';

<CardGrid>
  <Card title="draggable" icon="seti:plan">Move an element with the pointer.</Card>
  <Card title="sortable" icon="list-format">Reorder a list, or several.</Card>
  <Card title="resizable" icon="seti:image">Eight handles, or your own.</Card>
</CardGrid>
```

Save as `apps/docs/src/content/docs/index.mdx`.

- [ ] **Step 6: Add stub pages so the sidebar resolves**

Starlight fails the build on a sidebar entry pointing at a missing slug, so
every page named in the config needs to exist before the first build. Create
each with real front matter and a one-line body; Tasks 3–5 fill them in.

```bash
cd apps/docs/src/content/docs
mkdir -p guides api frameworks

for entry in \
  "guides/getting-started:Getting started" \
  "guides/styling:Styling" \
  "guides/limitations:Limitations" \
  "api/draggable:draggable" \
  "api/sortable:sortable" \
  "api/resizable:resizable" \
  "frameworks/react:React" \
  "frameworks/svelte:Svelte" \
  "frameworks/web-components:Web Components"
do
  path="${entry%%:*}"
  title="${entry##*:}"
  printf -- '---\ntitle: %s\n---\n\nComing in the next task.\n' "$title" > "$path.md"
done
cd -
```

- [ ] **Step 7: Install and build**

```bash
pnpm install
pnpm -F docs build
```

Expected: a successful build writing `apps/docs/dist/`. If it complains about
`astro:content` types, run `pnpm -F docs exec astro sync` once — Astro
generates `.astro/types.d.ts` on first build and the typecheck needs it.

- [ ] **Step 8: Add a root convenience script**

In the root `package.json`:

```json
"docs": "pnpm -F docs dev",
"docs:build": "pnpm -F docs build"
```

`pnpm build` already reaches the site through `pnpm -r build`, so CI needs no
change for building — only for deploying, which is Task 6.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "docs: scaffold the Starlight site

apps/docs is private and resolves detent through the workspace, so a demo
that no longer compiles is a build failure rather than a stale snippet.
Static output only — the site is served as Cloudflare Workers static
assets, so there is no adapter and no server runtime."
```

---

## Task 2: The demo harness

**Files:**
- Create: `apps/docs/src/components/Demo.astro`, `apps/docs/src/styles/custom.css`, `apps/docs/src/demos/draggable-basic.ts`
- Modify: `apps/docs/src/content/docs/api/draggable.md`

**Interfaces:**
- Consumes: `draggable` from `detent`.
- Produces: `<Demo id="..." title="...">` — an Astro component rendering a bordered stage with a reset button, and the convention that `src/demos/<id>.ts` exports `default function mount(stage: HTMLElement): () => void`, returning a teardown function.

Documenting a drag library with static code blocks is most of the problem with
documenting a drag library. Every API page gets something you can grab.

- [ ] **Step 1: Write the demo component**

```astro
---
// apps/docs/src/components/Demo.astro
interface Props {
  /** Matches a module in src/demos/<id>.ts */
  id: string;
  title?: string;
  /** Height of the stage in pixels. */
  height?: number;
}

const { id, title, height = 220 } = Astro.props;
---

<figure class="demo" data-demo={id}>
  {title && <figcaption class="demo-title">{title}</figcaption>}
  <div class="demo-stage" style={`height:${height}px`} data-demo-stage>
    <slot />
  </div>
  <button class="demo-reset" type="button" data-demo-reset>Reset</button>
</figure>

<script>
  // Every demo module in the directory, resolved at build time. Vite needs a
  // literal glob here — a computed path would not be bundled.
  const modules = import.meta.glob<{
    default: (stage: HTMLElement) => () => void;
  }>('../demos/*.ts');

  for (const figure of document.querySelectorAll<HTMLElement>('[data-demo]')) {
    const id = figure.dataset.demo!;
    const load = modules[`../demos/${id}.ts`];
    if (!load) {
      console.error(`[docs] no demo module for "${id}"`);
      continue;
    }

    const stage = figure.querySelector<HTMLElement>('[data-demo-stage]')!;
    const reset = figure.querySelector<HTMLButtonElement>('[data-demo-reset]')!;
    const original = stage.innerHTML;

    let teardown: (() => void) | null = null;

    const mount = async () => {
      const { default: run } = await load();
      teardown = run(stage);
    };

    reset.addEventListener('click', async () => {
      teardown?.();
      stage.innerHTML = original;
      await mount();
    });

    void mount();
  }
</script>
```

Reset rebuilds the stage from its original markup rather than trying to undo
whatever the user did — simpler, and it also exercises `destroy()` on every
click, which is a small free test of teardown.

- [ ] **Step 2: Write the demo styling**

```css
/* apps/docs/src/styles/custom.css */

:root {
  --demo-surface: var(--sl-color-gray-6);
  --demo-line: var(--sl-color-gray-5);
  --demo-item: var(--sl-color-gray-7);
  --demo-accent: var(--sl-color-accent);
}

.demo {
  margin: 1.5rem 0;
  border: 1px solid var(--demo-line);
  border-radius: 0.5rem;
  overflow: hidden;
  background: var(--demo-surface);
}

.demo-title {
  padding: 0.5rem 0.75rem;
  font-size: var(--sl-text-sm);
  color: var(--sl-color-gray-2);
  border-bottom: 1px solid var(--demo-line);
}

.demo-stage {
  position: relative;
  padding: 1rem;
  overflow: hidden;
}

.demo-reset {
  display: block;
  width: 100%;
  padding: 0.4rem;
  font: inherit;
  font-size: var(--sl-text-xs);
  color: var(--sl-color-gray-2);
  background: none;
  border: 0;
  border-top: 1px solid var(--demo-line);
  cursor: pointer;
}

.demo-reset:hover {
  color: var(--sl-color-white);
  background: var(--demo-line);
}

/* Shared furniture for the demo contents themselves. */
.demo-box {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  background: var(--demo-accent);
  color: var(--sl-color-black);
  border-radius: 0.375rem;
  cursor: grab;
  user-select: none;
}

.demo-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.demo-list li {
  padding: 0.6rem 0.75rem;
  background: var(--demo-item);
  border: 1px solid var(--demo-line);
  border-radius: 0.375rem;
  cursor: grab;
  user-select: none;
}

.demo-panel {
  width: 180px;
  height: 120px;
  background: var(--demo-item);
  border: 1px solid var(--demo-line);
  border-radius: 0.375rem;
}
```

- [ ] **Step 3: Write the first demo**

```ts
// apps/docs/src/demos/draggable-basic.ts
import { draggable } from 'detent';

/**
 * Mount the demo into `stage` and return a teardown function.
 *
 * Every demo module follows this shape so the harness can rebuild any of them
 * on Reset without knowing what they contain.
 */
export default function mount(stage: HTMLElement): () => void {
  const box = stage.querySelector<HTMLElement>('.demo-box');
  if (!box) return () => {};

  const handle = draggable(box, { bounds: 'parent' });
  return () => handle.destroy();
}
```

- [ ] **Step 4: Use it on the draggable page**

```mdx
---
title: draggable
description: Move an element with the pointer.
---

import Demo from '../../../components/Demo.astro';

Drag the square. It cannot leave the box.

<Demo id="draggable-basic" title="bounds: 'parent'">
  <div class="demo-box">drag me</div>
</Demo>

```js
import { draggable } from 'detent';

draggable(element, { bounds: 'parent' });
```
```

Save as `apps/docs/src/content/docs/api/draggable.md` — and rename it to
`.mdx`, because a page importing a component must be MDX:

```bash
git mv apps/docs/src/content/docs/api/draggable.md \
       apps/docs/src/content/docs/api/draggable.mdx
```

- [ ] **Step 5: Build and check the demo is really wired**

```bash
pnpm -F docs build
grep -rl "draggable-basic" apps/docs/dist/ | head -3
```

Expected: the build succeeds and the emitted assets reference the demo module,
which proves the glob resolved rather than silently producing nothing.

- [ ] **Step 6: Verify it works in a browser**

```bash
pnpm -F docs preview &
sleep 4
node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await p.goto("http://localhost:4321/api/draggable/");
  await p.waitForTimeout(1200);

  const box = await p.locator(".demo-box").boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 10 });
  await p.mouse.up();

  const moved = await p.locator(".demo-box").evaluate((el) => el.style.transform);
  console.log("errors:", errors.length ? errors : "none");
  console.log("transform:", moved || "(none — demo did not bind)");
  await b.close();
})();
'
kill %1
```

Expected: no errors, and a `translate3d(...)` transform. An empty transform
means the demo module never mounted — check the glob path in `Demo.astro`
matches the directory depth.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: add the demo harness

Documenting a drag library with static code blocks is most of the problem
with documenting a drag library. Every demo binds the real library through
the workspace, so an API change breaks the build rather than leaving a
snippet quietly wrong.

Reset rebuilds the stage from its original markup, which also exercises
destroy() on every click."
```

---

## Task 3: The API pages

**Files:**
- Create: `apps/docs/src/demos/draggable-axis.ts`, `draggable-grid.ts`, `sortable-list.ts`, `sortable-groups.ts`, `sortable-keyboard.ts`, `resizable-basic.ts`, `resizable-aspect.ts`
- Modify: `apps/docs/src/content/docs/api/draggable.mdx`, and `api/sortable.md` → `.mdx`, `api/resizable.md` → `.mdx`

**Interfaces:**
- Consumes: `Demo.astro` and the module convention from Task 2.
- Produces: three complete API pages, each option documented in a table with a demo for anything whose behaviour is easier shown than described.

- [ ] **Step 1: Write the remaining demo modules**

```ts
// apps/docs/src/demos/draggable-axis.ts
import { draggable } from 'detent';

export default function mount(stage: HTMLElement): () => void {
  const handles = Array.from(stage.querySelectorAll<HTMLElement>('.demo-box')).map((box) =>
    draggable(box, { axis: box.dataset.axis === 'y' ? 'y' : 'x', bounds: 'parent' }),
  );
  return () => handles.forEach((handle) => handle.destroy());
}
```

```ts
// apps/docs/src/demos/draggable-grid.ts
import { draggable } from 'detent';

export default function mount(stage: HTMLElement): () => void {
  const box = stage.querySelector<HTMLElement>('.demo-box');
  if (!box) return () => {};
  const handle = draggable(box, { grid: 40, bounds: 'parent' });
  return () => handle.destroy();
}
```

```ts
// apps/docs/src/demos/sortable-list.ts
import { sortable } from 'detent';

export default function mount(stage: HTMLElement): () => void {
  const list = stage.querySelector<HTMLElement>('.demo-list');
  if (!list) return () => {};
  const handle = sortable(list, { animation: 180 });
  return () => handle.destroy();
}
```

```ts
// apps/docs/src/demos/sortable-groups.ts
import { sortable } from 'detent';

export default function mount(stage: HTMLElement): () => void {
  const handles = Array.from(stage.querySelectorAll<HTMLElement>('.demo-list')).map((list) =>
    sortable(list, { group: 'docs-demo', animation: 180 }),
  );
  return () => handles.forEach((handle) => handle.destroy());
}
```

```ts
// apps/docs/src/demos/sortable-keyboard.ts
import { sortable } from 'detent';

export default function mount(stage: HTMLElement): () => void {
  const list = stage.querySelector<HTMLElement>('.demo-list');
  if (!list) return () => {};
  for (const item of Array.from(list.children)) {
    (item as HTMLElement).tabIndex = 0;
  }
  const handle = sortable(list, { animation: 180 });
  return () => handle.destroy();
}
```

```ts
// apps/docs/src/demos/resizable-basic.ts
import { resizable } from 'detent';

export default function mount(stage: HTMLElement): () => void {
  const panel = stage.querySelector<HTMLElement>('.demo-panel');
  if (!panel) return () => {};
  const handle = resizable(panel, { minWidth: 80, minHeight: 60 });
  return () => handle.destroy();
}
```

```ts
// apps/docs/src/demos/resizable-aspect.ts
import { resizable } from 'detent';

export default function mount(stage: HTMLElement): () => void {
  const panel = stage.querySelector<HTMLElement>('.demo-panel');
  if (!panel) return () => {};
  const handle = resizable(panel, { aspectRatio: 16 / 9, handles: ['se'], minWidth: 80 });
  return () => handle.destroy();
}
```

- [ ] **Step 2: Import the stylesheet for resize handles**

The resizable demos need `detent/styles.css`, or the handles have no size.
Add it to the Starlight config's `customCss`, so it is loaded once site-wide:

```js
customCss: ['detent/styles.css', './src/styles/custom.css'],
```

Order matters. `detent/styles.css` is inside `@layer detent`, so the site's own
unlayered rules win regardless — but keeping the library first documents the
intent.

- [ ] **Step 3: Complete the draggable page**

Replace `apps/docs/src/content/docs/api/draggable.mdx` with the full page:
the intro and first demo from Task 2, then a demo for `axis` and one for
`grid`, then this options table.

```mdx
## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `axis` | `'x' \| 'y' \| 'both'` | `'both'` | Restrict movement to one axis. |
| `bounds` | `'parent' \| 'window' \| Element \| Box \| null` | `null` | Keep the element inside this area. |
| `grid` | `number \| [number, number]` | — | Snap to a grid, in pixels. |
| `gridOrigin` | `'bounds' \| 'viewport' \| Element` | `'bounds'` | Where the grid counts from. |
| `handle` | `string` | — | Only start a drag from a descendant matching this selector. |
| `cancel` | `string` | — | Never start a drag from a descendant matching this selector. |
| `disabled` | `boolean` | `false` | Keep the binding but stop responding. |
| `distance` | `number` | `4` | Pixels of travel before a mouse or pen drag starts. |
| `delay` | `number` | `200` | Milliseconds of press before a touch drag starts. |
| `tolerance` | `number` | `6` | How far a finger may drift during `delay` before it counts as a scroll. |
| `touchAction` | `'none' \| 'auto' \| 'manipulation'` | `'none'` | Whether the element claims touch gestures. |

### Callbacks

`onStart(event)` — return `false` to refuse the drag.
`onMove(event)`, `onEnd(event, cancelled)`.

Each receives `{ element, offset, point, delta, event, cancel() }`.

## Returns

```ts
handle.moveTo(x, y);       // move to an explicit offset
handle.reset();            // back to the natural position
handle.setDisabled(true);
handle.destroy();
```

Movement is applied as a transform, and the element keeps its offset between
drags — a second drag carries on from where the first ended.
```

- [ ] **Step 4: Complete the sortable page**

Rename and write `api/sortable.mdx` covering: a single list demo, a two-list
`group` demo, a keyboard demo with instructions, then the options table.

```bash
git mv apps/docs/src/content/docs/api/sortable.md \
       apps/docs/src/content/docs/api/sortable.mdx
```

```mdx
## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `group` | `string` | — | Lists sharing a name pass items to each other. |
| `items` | `string` | — | Which children are sortable. Defaults to every element child. |
| `direction` | `'auto' \| 'x' \| 'y' \| 'grid'` | `'auto'` | How the list reads. `auto` works it out from where the items sit. |
| `animation` | `number` | `180` | Reorder animation in milliseconds. `0` turns it off. |
| `autoScroll` | `boolean \| { threshold, speed }` | `true` | Scroll the list when the pointer nears its edges. |
| `keyboard` | `boolean` | `true` | Allow reordering with the keyboard. |
| `zIndex` | `number` | `20` | Stacking order for the item being moved. |
| `disabled` | `boolean` | `false` | Keep the binding but stop responding. |

Activation options (`distance`, `delay`, `tolerance`, `handle`, `cancel`,
`touchAction`) behave as they do for `draggable`.

### Callbacks

`onStart(item, from)` — return `false` to refuse.
`onMove(item, to)`, `onSort({ item, from, to })`, `onEnd(item, cancelled)`.

`onSort` fires once, on drop, and only when the item actually moved.

## Keyboard

Give the items `tabindex="0"` and they can be reordered without a pointer:
**space** to lift, **arrows** to move, **space** to drop, **escape** to cancel.
Each step is announced to screen readers.

## Reading the order

```js
import { orderOf } from 'detent';

orderOf(list);           // HTMLElement[] in current DOM order
orderOf(list, '.card');  // only children matching a selector
```
```

- [ ] **Step 5: Complete the resizable page**

```bash
git mv apps/docs/src/content/docs/api/resizable.md \
       apps/docs/src/content/docs/api/resizable.mdx
```

Cover: the eight-handle demo, the aspect-ratio demo, the options table, and
the supplied-handles form.

```mdx
## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `handles` | `HandleName[] \| Record<HandleName, string \| HTMLElement>` | all eight | Which edges and corners can be grabbed. |
| `minWidth`, `minHeight` | `number` | `16` | Smallest size a resize will produce. |
| `maxWidth`, `maxHeight` | `number` | `Infinity` | Largest size a resize will produce. |
| `aspectRatio` | `boolean \| number` | — | `true` keeps the starting ratio; a number sets one. |
| `grid` | `number \| [number, number]` | — | Snap the size to a grid. |
| `bounds` | `Bounds` | `null` | Keep the element inside this area. |
| `disabled` | `boolean` | `false` | Keep the binding but stop responding. |

`HandleName` is one of `'n'`, `'e'`, `'s'`, `'w'`, `'ne'`, `'nw'`, `'se'`, `'sw'`.

## Supplying your own handles

As an array, the library creates eight `<span>` children. As an object, it
binds to elements you already have:

```js
resizable(card, {
  handles: { se: '.card-corner', e: '.card-edge' },
});
```

Use the object form when appending children would disturb your component —
framework rendering, `:last-child` and `:nth-child` rules, or code that walks
`element.children`. The library also leaves `position` alone in that case.

:::caution
Library-created handles get their size from `detent/styles.css`. Without that
stylesheet they exist but have no dimensions, so there is nothing to grab.
Either load it, or supply your own handles and size them yourself.
:::
```

- [ ] **Step 6: Build and verify every demo mounts**

```bash
pnpm -F docs build && pnpm -F docs preview &
sleep 4
node -e '
const { chromium } = require("playwright");
const pages = ["/api/draggable/", "/api/sortable/", "/api/resizable/"];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const path of pages) {
    await p.goto("http://localhost:4321" + path);
    await p.waitForTimeout(900);
    const demos = await p.locator("[data-demo]").count();
    console.log(path, "demos:", demos);
  }
  console.log("errors:", errors.length ? errors : "none");
  await b.close();
})();
'
kill %1
```

Expected: 3 demos on draggable, 3 on sortable, 2 on resizable, and **no
errors**. A `no demo module for "..."` console error means a demo id does not
match its filename.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: complete the three API pages

Every option documented in a table, and a live demo for anything whose
behaviour is easier shown than described — axis locking, grid snapping,
cross-list groups, keyboard reordering, aspect ratio."
```

---

## Task 4: Guides and the landing page

**Files:**
- Create: `apps/docs/src/demos/hero.ts`
- Modify: `apps/docs/src/content/docs/index.mdx`, and `guides/getting-started.md` → `.mdx`, `guides/styling.md`, `guides/limitations.md`
- Modify: `packages/detent/README.md`

**Interfaces:**
- Consumes: `Demo.astro`, the demo module convention.
- Produces: the pages the sidebar promises, and a README that links to the site rather than duplicating it.

- [ ] **Step 1: Write the hero demo**

```ts
// apps/docs/src/demos/hero.ts
import { resizable, sortable } from 'detent';

/** All three ideas in one stage: a sortable list beside a resizable panel. */
export default function mount(stage: HTMLElement): () => void {
  const handles: Array<{ destroy(): void }> = [];

  const list = stage.querySelector<HTMLElement>('.demo-list');
  if (list) {
    for (const item of Array.from(list.children)) {
      (item as HTMLElement).tabIndex = 0;
    }
    handles.push(sortable(list, { animation: 180 }));
  }

  const panel = stage.querySelector<HTMLElement>('.demo-panel');
  if (panel) handles.push(resizable(panel, { minWidth: 100, minHeight: 80 }));

  return () => handles.forEach((handle) => handle.destroy());
}
```

- [ ] **Step 2: Finish the landing page**

Add to `index.mdx`, after the card grid:

```mdx
import Demo from '../../components/Demo.astro';
import { Tabs, TabItem } from '@astrojs/starlight/components';

<Demo id="hero" title="Reorder the list, resize the panel" height={260}>
  <div style="display:flex;gap:1.5rem;align-items:flex-start">
    <ul class="demo-list" style="flex:1">
      <li>first</li>
      <li>second</li>
      <li>third</li>
    </ul>
    <div class="demo-panel"></div>
  </div>
</Demo>

## Install

<Tabs syncKey="framework">
  <TabItem label="Vanilla">
    ```bash
    npm install detent
    ```
  </TabItem>
  <TabItem label="React">
    ```bash
    npm install detent detent-react
    ```
  </TabItem>
  <TabItem label="Svelte">
    ```bash
    npm install detent detent-svelte
    ```
  </TabItem>
  <TabItem label="Web Components">
    ```bash
    npm install detent detent-elements
    ```
  </TabItem>
</Tabs>
```

- [ ] **Step 3: Write the getting-started guide**

```bash
git mv apps/docs/src/content/docs/guides/getting-started.md \
       apps/docs/src/content/docs/guides/getting-started.mdx
```

Cover: install, the smallest working example of each entry point, when the
stylesheet is needed, and a pointer at the framework pages. Keep it short —
the API pages carry the detail.

- [ ] **Step 4: Write the styling guide**

Move the README's "Styling" section here as the canonical version: the class
table, the `@layer detent` explanation, the `--detent-handle-size` custom
property, and the guarantee that the library functions without the stylesheet
except for library-created resize handles.

Add the cascade-layer point as a callout, because it is the part people get
wrong:

```mdx
:::tip[Overriding needs no `!important`]
`detent/styles.css` ships inside `@layer detent`. Unlayered CSS beats layered
CSS at any specificity, so a plain rule in your own stylesheet wins:

```css
.detent-handle { background: var(--brand); }
```
:::
```

- [ ] **Step 5: Write the limitations guide**

Port `docs/superpowers/notes/stacking-contexts.md` — it is already written for
exactly this purpose. Add the scroll-anchoring note from the README, and the
resize-handles-need-the-stylesheet note.

- [ ] **Step 6: Point the README at the site**

`packages/detent/README.md` is the npm landing page and should stay useful
standalone, but the long-form sections now live on the site. Replace the
"Styling", "Known limitations", "Using it on components you did not write",
"How big can the pieces be" and "Browser extensions" sections with a short
"Documentation" section linking to the relevant pages, keeping the quick API
sketch and the size table.

Verify nothing links to a page that does not exist:

```bash
grep -o "https://detent.arshadshah.com[^)\" ]*" packages/detent/README.md | sort -u
```

Each path must correspond to a file under `apps/docs/src/content/docs/`.

- [ ] **Step 7: Build and check for broken internal links**

```bash
pnpm -F docs build 2>&1 | tee /tmp/docs-build.log
grep -i "warn\|invalid\|not found" /tmp/docs-build.log || echo "no warnings"
```

Expected: a clean build. Starlight reports invalid sidebar slugs and missing
pages as build errors, so a clean build is real evidence here.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "docs: landing page, guides, and a README that links rather than repeats

The long-form sections — styling, stacking contexts, host-page hazards —
now live on the site, and the npm readme links to them instead of
carrying a second copy that will drift."
```

---

## Task 5: Favicon, social image and metadata

**Files:**
- Create: `apps/docs/public/favicon.svg`, `apps/docs/public/og-image.png`, `apps/docs/public/icon-180.png`
- Modify: `apps/docs/astro.config.mjs`

**Interfaces:**
- Consumes: the existing assets in `brand/`.
- Produces: a site that looks right in a browser tab and when a link is pasted anywhere.

- [ ] **Step 1: Copy the brand assets**

They already exist and are already the right thing; this is a copy, not a
design task.

```bash
mkdir -p apps/docs/public
cp brand/favicon/favicon.svg apps/docs/public/favicon.svg
cp brand/favicon/icon-180.png apps/docs/public/icon-180.png
cp brand/social/og-image.png apps/docs/public/og-image.png
```

- [ ] **Step 2: Wire them into the Starlight config**

Add to the `starlight({ ... })` options:

```js
      favicon: '/favicon.svg',
      head: [
        {
          tag: 'link',
          attrs: { rel: 'apple-touch-icon', href: '/icon-180.png' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: 'https://detent.arshadshah.com/og-image.png' },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
        },
      ],
```

- [ ] **Step 3: Verify the tags are emitted**

```bash
pnpm -F docs build
grep -o 'og:image[^>]*' apps/docs/dist/index.html | head -1
grep -o 'apple-touch-icon[^>]*' apps/docs/dist/index.html | head -1
test -f apps/docs/dist/favicon.svg && echo "favicon copied"
```

Expected: all three present.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: favicon, apple touch icon and social preview

Reuses the existing brand assets rather than making new ones."
```

---

## Task 6: Deploy to Cloudflare

**Files:**
- Create: `apps/docs/wrangler.toml`, `.github/workflows/docs.yml`
- Modify: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: the built site in `apps/docs/dist`.
- Produces: a build check on every PR, and a deploy to `detent.arshadshah.com` on merge to `main`.

- [ ] **Step 1: Write the Wrangler config**

A fully static site needs no Worker code — Workers static assets serve
`dist/` directly, and the `not_found_handling` setting is what makes Astro's
directory-style URLs resolve.

```toml
# apps/docs/wrangler.toml
name = "detent-docs"
compatibility_date = "2026-09-01"

[assets]
directory = "./dist"
# Astro emits <page>/index.html, so a request for /api/draggable/ has to fall
# back to the directory's index rather than 404.
not_found_handling = "404-page"

[[routes]]
pattern = "detent.arshadshah.com"
custom_domain = true
```

- [ ] **Step 2: Write the workflow**

```yaml
# .github/workflows/docs.yml
name: docs

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: docs-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # The site imports the library, whose types come from its emitted
      # declarations, so the core has to be built first.
      - run: pnpm -F detent build

      - run: pnpm -F docs build

      - name: Check the site
        run: pnpm -F docs typecheck

      # Deploy only from main. Pull requests stop at a verified build.
      - name: Deploy to Cloudflare
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/docs
          command: deploy
```

- [ ] **Step 3: Confirm the build step works from a clean tree**

```bash
rm -rf packages/*/dist apps/docs/dist
pnpm -F detent build && pnpm -F docs build && pnpm -F docs typecheck
echo "exit=$?"
```

Expected: `exit=0`. If `astro check` reports errors in the demo modules, they
are real type errors against the library's public API — fix them rather than
loosening the check.

- [ ] **Step 4: Record the Cloudflare setup in CONTRIBUTING**

The secrets table already names both secrets. Add the one-time steps beneath
it:

```markdown
### Setting up the docs deployment, once

1. Create a Cloudflare API token with the **Edit Cloudflare Workers** template,
   scoped to the account that owns `arshadshah.com`.
2. Add it as the repository secret `CLOUDFLARE_API_TOKEN`, and the account id
   as `CLOUDFLARE_ACCOUNT_ID`.
3. The first `wrangler deploy` creates the `detent-docs` Worker and claims
   `detent.arshadshah.com` as a custom domain. That requires the zone for
   `arshadshah.com` to be on the same Cloudflare account.

Until the secrets exist the deploy step fails and everything before it — the
build and the type check — passes. Pull requests never deploy.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "ci: build the docs on every PR, deploy from main

Static output served as Cloudflare Workers static assets, so there is no
adapter and no server runtime. not_found_handling is set to the directory
index because Astro emits <page>/index.html and a bare 404 would break
every nested URL.

Deploy is guarded on main plus a push event, so a pull request stops at a
verified build."
```

---

## Task 7: Verify on a real pull request, then deploy

**Files:** none.

**Interfaces:**
- Consumes: everything above.
- Produces: evidence that the site builds in CI, and a live `detent.arshadshah.com`.

- [ ] **Step 1: Full local verification**

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm -F docs typecheck
```

Expected: all green. `pnpm test` still runs the four packages' suites; the
docs app has no tests of its own, and `pnpm -r` skips it.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin phase-4-docs
gh pr create --base main --head phase-4-docs \
  --title "Phase 4: documentation site" \
  --body "Implements sections 1 and 6 of the hardening spec. See docs/superpowers/plans/2026-09-09-phase-4-docs-site.md"
```

- [ ] **Step 3: Watch all three workflows**

```bash
gh pr checks --watch
```

Expected: `verify`, `changeset` and the new `build` job all pass. The docs job
must **not** attempt a deploy — confirm the Deploy step shows as skipped.

```bash
gh run view "$(gh run list --branch phase-4-docs --workflow docs.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --json jobs \
  --jq '.jobs[].steps[] | "\(.name): \(.conclusion)"'
```

Expected: `Deploy to Cloudflare: skipped`.

- [ ] **Step 4: Merge and watch the deploy**

```bash
gh pr merge --merge --delete-branch
gh run watch "$(gh run list --branch main --workflow docs.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

If `CLOUDFLARE_API_TOKEN` is not set yet, expect the deploy step to fail with
an authentication error while the build and check pass. That is the documented
sequence, not a defect — report it and stop.

- [ ] **Step 5: Verify the live site**

Once the secrets exist and a deploy succeeds:

```bash
for path in / /guides/getting-started/ /api/draggable/ /api/sortable/ /api/resizable/ /frameworks/react/; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://detent.arshadshah.com$path")
  echo "$path -> $code"
done
```

Expected: `200` for every path. A `404` on a nested path means
`not_found_handling` is wrong in `wrangler.toml`.

Then check a demo actually runs in production, not just in preview:

```bash
node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("https://detent.arshadshah.com/api/draggable/");
  await p.waitForTimeout(1500);
  const box = await p.locator(".demo-box").boundingBox();
  await p.mouse.move(box.x + 40, box.y + 40);
  await p.mouse.down();
  await p.mouse.move(box.x + 100, box.y + 40, { steps: 10 });
  await p.mouse.up();
  console.log("transform:", await p.locator(".demo-box").evaluate((el) => el.style.transform));
  console.log("errors:", errors.length ? errors : "none");
  await b.close();
})();
'
```

- [ ] **Step 6: Report**

Report to your human partner: the check results, whether the deploy ran or
stopped for want of secrets, and the live URL if it is up.

---

## Self-Review

**Spec coverage.** §1 `apps/docs` → Task 1. §6 `docs.yml`, built on PRs and
deployed to Cloudflare on `main` → Task 6, with the guard verified in Task 7
Step 3. §6 custom domain `detent.arshadshah.com` → Task 6's `wrangler.toml`
route. §6 required secrets → Task 6 Step 4, extending the table Phase 2
already put in `CONTRIBUTING.md`. §4's discoverability requirement — each
wrapper as a top-level section with a copy-pasteable first example — is served
by the `Frameworks` sidebar group, whose three pages are stubbed in Task 1 and
whose content is the wrapper READMEs written in Phase 3.

**One gap found and closed.** The framework pages were stubbed in Task 1 and
then never written: Tasks 3 and 4 covered API and guides only. Rather than add
a task that copies three READMEs verbatim into a second location — which is
exactly the drift Task 4 Step 6 exists to prevent — each framework page should
be a short intro plus the same first example, ending in a link to the package
README on npm for the full option list. Fold that into Task 4 as an extra step
before its commit; it is three short pages and does not warrant its own task.

**Placeholder scan.** No TBDs. Every code step carries the actual file
contents. Task 4 Steps 3–5 describe page content rather than reproducing whole
markdown files, which is deliberate — the source material is named exactly
(`docs/superpowers/notes/stacking-contexts.md`, named README sections), so
there is nothing for an implementer to invent.

**Type consistency.** The demo module contract —
`export default function mount(stage: HTMLElement): () => void` — is defined in
Task 2 Step 3 and used by all nine demo modules in Tasks 3 and 4. `<Demo id
title height>` is defined in Task 2 Step 1 and used in Tasks 2, 3 and 4. The
glob in `Demo.astro` (`../demos/*.ts`) is relative to
`src/components/`, which matches the file layout in the structure table.

**Known ordering constraint.** Task 1 must be first and Task 7 last. Task 2
must precede 3 and 4. Tasks 5 and 6 are independent of 2–4 and of each other.
