// Bundle the game.  node tools/build.mjs [--dev]
//   dist/index.html     full document (local testing; references game.js + assets/)
//   dist/artifact.html  page body fragment with JS + CSS inlined (published artifact)
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
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
const full = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n${tpl
  .replace('<!--STYLE-->', '<link rel="stylesheet" href="style.css">')
  .replace(/<div id="app">[\s\S]*<!--SCRIPT-->/, (m) => `</head><body>\n${m.replace('<!--SCRIPT-->', '<script src="game.js"></script>')}`)}\n</body></html>\n`;
fs.writeFileSync(path.join(DIST, 'index.html'), full);
const frag = tpl.replace('<!--STYLE-->', `<style>\n${css}</style>`).replace('<!--SCRIPT-->', `<script>${js.replace(/<\/script/g, '<\\/script')}</script>`);
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
  for (const f of fs.readdirSync(d)) copy(path.join(d, f), path.join(DIST, 'assets', dir, f));
}
console.log(`built ${dev ? 'dev' : 'release'}: game.js ${(js.length / 1024).toFixed(0)} KB, artifact.html ${(frag.length / 1024).toFixed(0)} KB`);
