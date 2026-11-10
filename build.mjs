import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const t0 = Date.now();
const res = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  write: false,
  logLevel: 'info',
});

const js = res.outputFiles[0].text;
let html = readFileSync('src/index.html', 'utf8');
html = html.replace('<!--APP_SCRIPT-->', () => `<script>\n${js}\n</script>`);
writeFileSync('starforge-7.html', html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`\n✓ starforge-7.html  ${kb} KB  (${Date.now() - t0}ms)`);
