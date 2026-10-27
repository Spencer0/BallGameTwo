// Bundle the game.  node tools/build.mjs [--dev]
//   dist/index.html     full document (local testing; references game.js + assets/)
//   dist/artifact.html  page body fragment with JS + CSS inlined (published artifact)
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = process.env.DIST ? path.resolve(process.env.DIST) : path.join(ROOT, 'dist');
const dev = process.argv.includes('--dev');
fs.mkdirSync(DIST, { recursive: true });

const result = await esbuild.build({
  entryPoints: [path.join(ROOT, 'src', 'main.js')],
  bundle: true,
  format: 'iife',
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  target: ['safari15', 'chrome100'],
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const js = result.outputFiles[0].text;
const css = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'style.css'), 'utf8');
const tpl = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');

fs.writeFileSync(path.join(DIST, 'game.js'), js);
fs.writeFileSync(path.join(DIST, 'style.css'), css);
// web build only: the artifact page can't load third-party scripts
const CF_ANALYTICS = `<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "3b0ed9eb21f94100abdb68ef36c57014"}'></script><!-- End Cloudflare Web Analytics -->`;
const full = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n${tpl
  .replace('<!--STYLE-->', '<link rel="stylesheet" href="style.css">')
  .replace(/<div id="app">[\s\S]*<!--SCRIPT-->/, (m) => `</head><body>\n${m.replace('<!--SCRIPT-->', '<script src="game.js"></script>')}`)}\n${CF_ANALYTICS}\n</body></html>\n`;
fs.writeFileSync(path.join(DIST, 'index.html'), full);
// function replacements: the minified JS contains `$'`/`$&` sequences that string replacements would expand
const frag = tpl
  .replace('<!--STYLE-->', () => `<style>\n${css}</style>`)
  .replace('<!--SCRIPT-->', () => `<script>window.__PACKS_AS_TEXT = 1;</script>\n<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
fs.writeFileSync(path.join(DIST, 'artifact.html'), frag);

// assets
const copy = (src, dst) => {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
};
for (const f of ['catalog.json', 'icons.png', 'icons.json']) {
  const s = path.join(ROOT, 'assets', f);
  if (fs.existsSync(s)) copy(s, path.join(DIST, 'assets', f));
}
for (const dir of ['packs', 'packs_q', 'img']) {
  const d = path.join(ROOT, 'assets', dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    copy(path.join(d, f), path.join(DIST, 'assets', dir, f));
    // text copy for hosts that won't serve binary models (see ASSET_BASE.text)
    if (f.endsWith('.glb')) fs.writeFileSync(path.join(DIST, 'assets', dir, f + '.txt'), fs.readFileSync(path.join(d, f)).toString('base64'));
  }
}
console.log(`built ${dev ? 'dev' : 'release'}: game.js ${(js.length / 1024).toFixed(0)} KB, artifact.html ${(frag.length / 1024).toFixed(0)} KB`);
