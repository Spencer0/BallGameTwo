// The single-page build as the artifact host serves it: the body fragment wrapped in a bare document,
// packs fetched as base64 text. Boots straight into the city (loads every pack) and checks for errors.
//   DIST=build/release node tools/build.mjs && node tests/artifact_page.mjs [build/release]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './harness.mjs';
const dir = path.resolve(process.argv[2] || 'build/release');
fs.writeFileSync(path.join(dir, 'wrapped.html'), `<!doctype html><html><head><meta charset="utf-8"></head><body>${fs.readFileSync(path.join(dir, 'artifact.html'), 'utf8')}</body></html>`);
const { srv, url } = await serve(dir);
const { browser, page, errors } = await launch('iphone14');
const reqs = [];
page.on('request', (r) => { if (r.url().includes('/assets/packs')) reqs.push(r.url().replace(/.*\/assets\//, '')); });
await page.goto(url + 'wrapped.html?level=6&mode=zen');
await page.waitForFunction(() => window.__game?.session, null, { timeout: 120000 });
await page.waitForTimeout(4000);
const types = await page.evaluate(() => window.__game.session.world.types.length);
const binary = reqs.filter((r) => r.endsWith('.glb'));
const ok = !errors.length && !binary.length && types > 200;
console.log(`${ok ? 'ok ' : 'BAD'} artifact page: ${reqs.length} text packs, ${types} types${binary.length ? ', binary fetches: ' + binary.join(' ') : ''}${errors.length ? ', errors: ' + errors.join(' | ') : ''}`);
fs.unlinkSync(path.join(dir, 'wrapped.html'));
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
