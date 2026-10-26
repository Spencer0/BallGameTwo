// Offline-render every song + the SFX reel; fail on clipping, NaNs, or dropouts.
import * as esbuild from 'esbuild';
import { launch } from './harness.mjs';
const r = await esbuild.build({ entryPoints: ['tests/audio_entry.js'], bundle: true, write: false, format: 'iife' });
const { browser, page, errors } = await launch('iphone14');
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: r.outputFiles[0].text });
let bad = 0;
for (const id of ['title', 'crumb', 'bedroom', 'house', 'culdesac', 'town', 'city']) {
  const s = await page.evaluate((id) => window.renderSong(id, 24), id);
  const ok = s.peak < 1.0 && s.nan === 0 && s.minSecRms > 0.005;
  if (!ok) bad++;
  console.log(ok ? 'ok ' : 'BAD', id.padEnd(9), JSON.stringify(s));
}
const sfx = await page.evaluate(() => window.renderSfx());
console.log(sfx.peak < 1 && sfx.nan === 0 ? 'ok ' : 'BAD', 'sfx      ', JSON.stringify(sfx));
console.log(errors.join('\n'));
await browser.close();
process.exit(bad ? 1 : 0);
