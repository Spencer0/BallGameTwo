// Long-session profile: autopilot plays for N minutes (restarting levels), sampling JS heap,
// renderer resources and CPU frame time. Flags memory growth.
//   node tests/profile.mjs [minutes] [levels]
import { serve, launch } from './harness.mjs';
const minutes = +(process.argv[2] || 5);
const levels = (process.argv[3] || '1').split(',').map(Number);
const { srv, url } = await serve();
const { browser, page, errors } = await launch('iphone14');
const cdp = await page.context().newCDPSession(page);
await page.goto(`${url}?level=${levels[0]}&mode=zen&auto=1&sim=4&q=medium`);
await page.waitForFunction(() => window.__game && window.__game.session, null, { timeout: 120000 });
const samples = [];
const t0 = Date.now();
let k = 0;
while ((Date.now() - t0) / 60000 < minutes) {
  await page.waitForTimeout(15000);
  k++;
  // every ~45 s restart on the next level in the list to exercise load/dispose
  if (k % 3 === 0) {
    const n = levels[(k / 3) % levels.length];
    await page.evaluate((n) => window.__game.startLevel(n - 1, 'zen', { skipStory: true }), n);
    await page.waitForTimeout(2000);
  }
  await cdp.send('HeapProfiler.collectGarbage');
  const s = await page.evaluate(() => {
    const g = window.__game, r = g.renderer.info;
    return { heapMB: +(performance.memory.usedJSHeapSize / 1e6).toFixed(1), geometries: r.memory.geometries, textures: r.memory.textures, programs: r.programs.length,
      calls: r.render.calls, tris: r.render.triangles, cpuMs: +g.stats.cpuMs.toFixed(2), cpuMax: +g.stats.cpuMax.toFixed(1), level: g.session.level.n, d: +g.session.ball.diameter.toFixed(2), crust: g.session.crust.count };
  });
  await page.evaluate(() => (window.__game.stats.cpuMax = 0));
  samples.push(s);
  console.log(`${((Date.now() - t0) / 60000).toFixed(1)}min`, JSON.stringify(s));
}
const first = samples[Math.min(2, samples.length - 1)], last = samples[samples.length - 1];
console.log(`heap ${first.heapMB} -> ${last.heapMB} MB, geometries ${first.geometries} -> ${last.geometries}, programs ${first.programs} -> ${last.programs}`);
console.log(errors.length ? 'errors:\n' + errors.slice(0, 10).join('\n') : 'no console errors');
await browser.close();
srv.close();
