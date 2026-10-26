// node tests/soak.mjs "<query>" seconds out-prefix  -- autopilot play with periodic screenshots + stats
import { serve, launch } from './harness.mjs';
const [q = 'level=1', secs = '30', prefix = 'build/soak'] = process.argv.slice(2);
const { srv, url } = await serve();
const { browser, page, errors } = await launch('iphone14');
await page.goto(url + '?auto=1&' + q);
await page.waitForFunction(() => window.__game && window.__game.session, null, { timeout: 60000 });
const t0 = Date.now();
let k = 0;
while ((Date.now() - t0) / 1000 < +secs) {
  await page.waitForTimeout(Math.min(10000, +secs * 1000 / 3));
  const info = await page.evaluate(() => {
    const g = window.__game, s = g.session, r = g.renderer.info;
    return { t: s.time.toFixed(1), d: s.ball.diameter.toFixed(3), pickups: s.pickups, crust: s.crust.count, crustV: s.crust.vEnd, calls: r.render.calls, tris: r.render.triangles, visible: s.world.visibleCount, over: s.over, heap: performance.memory ? (performance.memory.usedJSHeapSize / 1e6).toFixed(1) : '?' };
  });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: `${prefix}_${k++}.png` });
}
console.log(errors.slice(0, 10).join('\n'));
await browser.close();
srv.close();
