import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [name, description] = process.argv.slice(2);
if (!name || !description) {
  console.error('usage: node scripts/new-package.mjs <package-name> <description>');
  process.exit(1);
}

const dir = join('packages', name);
mkdirSync(join(dir, 'src'), { recursive: true });
mkdirSync(join(dir, 'test', 'browser'), { recursive: true });
mkdirSync(join(dir, 'scripts'), { recursive: true });

// The size checker is identical everywhere; copy it rather than reinvent it.
cpSync('packages/detent/scripts/size-check.mjs', join(dir, 'scripts/size-check.mjs'));
cpSync('packages/detent/scripts/size-check.d.mts', join(dir, 'scripts/size-check.d.mts'));
cpSync('LICENSE', join(dir, 'LICENSE'));

const write = (file, contents) => writeFileSync(join(dir, file), contents);

write('package.json', JSON.stringify({
  name,
  version: '0.0.0',
  description,
  type: 'module',
  sideEffects: false,
  license: 'MIT',
  author: 'Arshad Shah',
  homepage: 'https://detent.arshadshah.com',
  repository: {
    type: 'git',
    url: 'git+https://github.com/arshad-shah/detent.git',
    directory: `packages/${name}`,
  },
  bugs: 'https://github.com/arshad-shah/detent/issues',
  main: './dist/index.cjs',
  module: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      require: './dist/index.cjs',
    },
    './package.json': './package.json',
  },
  files: ['dist', 'README.md', 'LICENSE'],
  scripts: {
    build: 'node build.mjs',
    size: 'node scripts/size-check.mjs',
    test: 'pnpm test:browser',
    'test:browser': 'vitest run --project browser',
    typecheck: 'tsc --noEmit && tsc -p tsconfig.test.json',
  },
  dependencies: { detent: 'workspace:^' },
  devDependencies: {
    '@types/node': '^24.13.3',
    '@vitest/browser': '^5.0.0',
    '@vitest/browser-playwright': '^5.0.0',
    esbuild: '^0.28.2',
    playwright: '^1.63.0',
    typescript: '^7.0.2',
    vite: '^7.3.6',
    vitest: '^5.0.0',
  },
}, null, 2) + '\n');

write('tsconfig.json', JSON.stringify({
  comment: 'The shipped package. lib stays at ES2020 to match the build target.',
  compilerOptions: {
    target: 'ES2020',
    module: 'ESNext',
    moduleResolution: 'bundler',
    lib: ['ES2020', 'DOM', 'DOM.Iterable'],
    strict: true,
    declaration: true,
    emitDeclarationOnly: true,
    outDir: 'dist',
    rootDir: 'src',
    skipLibCheck: true,
    verbatimModuleSyntax: true,
    types: [],
  },
  include: ['src'],
}, null, 2) + '\n');

write('tsconfig.test.json', JSON.stringify({
  comment: 'Tests. Modern lib, never emitted.',
  extends: './tsconfig.json',
  compilerOptions: {
    lib: ['ES2023', 'DOM', 'DOM.Iterable'],
    rootDir: '.',
    declaration: false,
    emitDeclarationOnly: false,
    noEmit: true,
    types: ['vite/client', 'node'],
  },
  include: ['src', 'test', 'vitest.config.ts'],
}, null, 2) + '\n');

write('build.mjs', `import { build } from 'esbuild';
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
  env: { ...process.env, PATH: \`\${process.cwd()}/node_modules/.bin:\${process.env.PATH}\` },
});

console.log('\\n  built. run \\\`pnpm size\\\` for the gzip table and budget check.\\n');
`);

write('vitest.config.ts', `import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DEV__: 'true' },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.ts', 'test/browser/**/*.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [
              { browser: 'chromium' },
              { browser: 'firefox' },
              { browser: 'webkit' },
            ],
          },
        },
      },
    ],
  },
});
`);

write('size-budget.json', JSON.stringify({
  comment: 'Gzipped ceilings in bytes. Raise deliberately, and say why in the changeset.',
  budgets: { 'dist/index.js': 2000 },
}, null, 2) + '\n');

write('README.md', `# ${name}\n\n${description}\n\nDocumentation: https://detent.arshadshah.com\n`);

write('src/index.ts', 'export {};\n');

write('src/globals.d.ts', `/** Replaced with a literal by the bundler. \`false\` in production builds. */
declare const __DEV__: boolean;
`);

console.log(`created packages/${name}`);
