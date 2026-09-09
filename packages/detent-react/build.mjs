import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

// detent is a peer of the bundle, not part of it: bundling it would ship two
// copies to anyone who also installs detent directly.
const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  target: 'es2020',
  define: { __DEV__: 'false' },
  external: ['detent', 'react', 'react/jsx-runtime', 'svelte'],
};

await build({ ...shared, format: 'esm', outfile: 'dist/index.js' });
await build({ ...shared, format: 'cjs', outfile: 'dist/index.cjs' });

execSync('tsc -p tsconfig.json', {
  stdio: 'inherit',
  env: { ...process.env, PATH: `${process.cwd()}/node_modules/.bin:${process.env.PATH}` },
});

console.log('\n  built. run \`pnpm size\` for the gzip table and budget check.\n');
