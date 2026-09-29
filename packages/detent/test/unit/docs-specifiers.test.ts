import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The packages are published under the `@arshad-shah` scope, but the library's
 * own vocabulary — the `detent-` class prefix, the `@layer detent` cascade
 * layer, the `<detent-sortable>` custom elements — is deliberately unscoped.
 *
 * That overlap is why scoping the packages left the documentation telling people
 * to install `@arshad-shah/detent` and then import from `'detent'`: a global
 * rename would have broken the class names, so it was done by hand and missed
 * things. It also broke the playground's esbuild `globalName` in the same way.
 *
 * This walks the documentation and fails on any *module specifier* that is not
 * scoped, while leaving the unscoped vocabulary alone.
 */

// vitest serves test files over a /@fs/ URL, so import.meta.url is not a usable
// filesystem path here. The unit project runs with packages/detent as its cwd.
const ROOT = resolve(process.cwd(), '../..');

const SEARCH = ['README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'packages', 'apps/docs/src/content'];

// Dated records of what was planned before the packages were scoped. Rewriting
// them would falsify the history they exist to preserve.
const SKIP = /node_modules|[/\\]dist[/\\]|[/\\]\.astro[/\\]|docs[/\\]superpowers/;

function walk(path: string, out: string[] = []): string[] {
  if (SKIP.test(path)) return out;
  const stats = statSync(path, { throwIfNoEntry: false });
  if (!stats) return out;
  if (stats.isDirectory()) {
    for (const entry of readdirSync(path)) walk(join(path, entry), out);
  } else if (/\.(md|mdx)$/.test(path)) {
    out.push(path);
  }
  return out;
}

/**
 * A reference to the package rather than to the vocabulary.
 *
 * Each alternative is a place a bare name can only mean the npm package: an
 * import specifier, an install command, a subpath like `detent/styles.css`, a
 * registry URL, or a path under node_modules.
 */
const BAD = [
  /\bfrom\s+['"]detent(-react|-svelte|-elements)?(\/[^'"]*)?['"]/,
  /\brequire\(\s*['"]detent(-react|-svelte|-elements)?(\/[^'"]*)?['"]/,
  /\bimport\s+['"]detent(-react|-svelte|-elements)?(\/[^'"]*)?['"]/,
  /\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|i|view|uninstall)\s+(?:[^\n]*\s)?detent(?:-react|-svelte|-elements)?\b/,
  /`detent(-react|-svelte|-elements)?\/[a-z][\w.-]*`/,
  // Anchored to the scheme on purpose. Unanchored, this matches a registry URL
  // sitting inside some other host's path, which CodeQL is right to flag.
  /https?:\/\/(?:www\.)?npmjs\.com\/package\/detent(-react|-svelte|-elements)?\b/,
  /(?:^|[\s"'(/])node_modules\/detent(-react|-svelte|-elements)?\//,
];

describe('documentation names the published packages', () => {
  const files = SEARCH.flatMap((entry) => walk(join(ROOT, entry)));

  it('finds documentation to check', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it('never refers to a package by its pre-scope name', () => {
    const offences: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (BAD.some((pattern) => pattern.test(line))) {
          offences.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(offences).toEqual([]);
  });

  it('still leaves the unscoped vocabulary alone', () => {
    // These must never be scoped: they are class names, a cascade layer and
    // custom element names, none of which follow the npm package name.
    const readme = readFileSync(join(ROOT, 'packages/detent/README.md'), 'utf8');
    expect(readme).toContain('`detent-`');
    expect(readme).toContain('@layer detent');
    const elements = readFileSync(join(ROOT, 'packages/detent-elements/README.md'), 'utf8');
    expect(elements).toContain('<detent-sortable');
  });
});
