import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

// __DEV__ is false for every shipped bundle, so invariant() calls and their
// message strings are dead-code-eliminated entirely.
const define = { __DEV__: 'false' };

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  target: 'es2020',
  define,
};

await build({ ...shared, format: 'esm', outfile: 'dist/index.js' });
await build({ ...shared, format: 'cjs', outfile: 'dist/index.cjs' });
await build({ entryPoints: ['src/styles.css'], minify: true, outfile: 'dist/styles.css' });

// Per-module bundles, so a tree-shaking check is honest about what each costs.
for (const name of ['draggable', 'sortable', 'resizable']) {
  await build({
    stdin: { contents: `export { ${name} } from './src/${name}';`, resolveDir: '.', loader: 'ts' },
    bundle: true, minify: true, format: 'esm', target: 'es2020', define,
    outfile: `dist/_size-${name}.js`,
  });
}

// Declarations. Never swallow a failure here: a silent miss ships a package
// whose "types" field points at a file that was never emitted.
execSync('tsc -p tsconfig.json', { stdio: 'inherit', env: { ...process.env, PATH: `${process.cwd()}/node_modules/.bin:${process.env.PATH}` } });

console.log('\n  built. run `pnpm size` for the gzip table and budget check.\n');
