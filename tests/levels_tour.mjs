// Gameplay screenshots for every level: just after the intro, and once the ball has grown.
//   node tests/levels_tour.mjs [levels]
import fs from 'node:fs';
import { serve, launch } from './harness.mjs';
const levels = (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number);
fs.mkdirSync('build/levels', { recursive: true });
const { srv, url } = await serve();
for (const n of levels) {
  const { browser, page, errors } = await launch('iphone14');
  await page.goto(`${url}?level=${n}&mode=timed&auto=1&sim=6&q=high`);
  await page.waitForFunction(() => window.__game?.session, null, { timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `build/levels/L${n}_a.png` });
  await page.waitForFunction(() => { const s = window.__game.session; return s.ball.diameter > s.level.target * 0.8 || s.over; }, null, { timeout: 900000, polling: 1000 });
  await page.evaluate(() => { window.__game.simSpeed = 1; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `build/levels/L${n}_b.png` });
  const info = await page.evaluate(() => { const g = window.__game, r = g.renderer.info.render; return { calls: r.calls, tris: r.triangles, cpu: g.stats.cpuMs.toFixed(1), d: g.session.ball.diameter.toFixed(2) }; });
  console.log(`L${n}`, JSON.stringify(info), errors.length ? 'errors: ' + errors.join(' | ') : '');
  await browser.close();
}
srv.close();
