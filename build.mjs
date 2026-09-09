import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

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

const gz = (f) => (gzipSync(readFileSync(f)).length / 1024).toFixed(2) + ' KB';
const raw = (f) => (statSync(f).size / 1024).toFixed(2) + ' KB';

console.log('\n  bundle             minified    gzipped');
console.log('  ' + '-'.repeat(42));
for (const [label, file] of [
  ['everything', 'dist/index.js'],
  ['draggable only', 'dist/_size-draggable.js'],
  ['sortable only', 'dist/_size-sortable.js'],
  ['resizable only', 'dist/_size-resizable.js'],
  ['styles.css', 'dist/styles.css'],
]) {
  console.log('  ' + label.padEnd(19) + raw(file).padStart(9) + gz(file).padStart(11));
}
console.log();
