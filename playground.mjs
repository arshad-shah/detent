import { build } from 'esbuild';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// The playground ships as one file so it opens straight from disk, with no
// server and no module/CORS problems.
const bundle = await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'detent',
  target: 'es2020',
  // `var` at the top of an inline script is already global in a browser, but
  // being explicit keeps this working under headless DOM implementations too.
  footer: { js: 'globalThis.detent = detent;' },
  write: false,
});

const css = await build({
  entryPoints: ['src/styles.css'],
  minify: true,
  write: false,
});

const gz = (text) => (gzipSync(Buffer.from(text)).length / 1024).toFixed(2);
const min = (f) => (statSync(f).size / 1024).toFixed(2);

const sizes = [
  ['everything', 'dist/index.js'],
  ['draggable', 'dist/_size-draggable.js'],
  ['sortable', 'dist/_size-sortable.js'],
  ['resizable', 'dist/_size-resizable.js'],
]
  .map(([label, file]) => {
    const raw = readFileSync(file);
    return `<span>${label} <b>${(gzipSync(raw).length / 1024).toFixed(2)} KB</b> gzipped</span>`;
  })
  .join('');

const html = readFileSync('playground/template.html', 'utf8')
  .replace('/*__DRAGKIT__*/', bundle.outputFiles[0].text)
  .replace("/*__SIZES__*/''", JSON.stringify(sizes))
  .replace('</style>', css.outputFiles[0].text + '\n</style>');

writeFileSync('playground/index.html', html);
console.log(`playground/index.html  ${min('playground/index.html')} KB  (${gz(html)} KB gzipped)`);
