// node tests/shot.mjs "<query>" out.png [roll-ms]
import { serve, launch, drag } from './harness.mjs';
const [q = '', out = 'build/shot.png', rollMs = '0'] = process.argv.slice(2);
const { srv, url } = await serve();
const { browser, page, errors } = await launch('iphone14');
await page.goto(url + '?' + q);
await page.waitForFunction(() => window.__game && window.__game.session, null, { timeout: 60000 });
await page.waitForTimeout(1500);
if (+rollMs > 0) await drag(page, 195, 600, 0, -60, +rollMs);
await page.screenshot({ path: out });
const info = await page.evaluate(() => {
  const g = window.__game, s = g.session, r = g.renderer.info;
  return { d: s.ball.diameter, pickups: s.pickups, calls: r.render.calls, tris: r.render.triangles, visible: s.world.visibleCount, missing: s.layoutMissing.length, frameMs: g.stats.frameMs.toFixed(1) };
});
console.log(JSON.stringify(info));
console.log(errors.slice(0, 10).join('\n'));
await browser.close();
srv.close();
