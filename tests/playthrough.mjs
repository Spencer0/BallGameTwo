// Scripted playthrough: every level, both modes, autopilot until the goal is reached
// (then finish), checking the level completes and the next unlocks.
//   node tests/playthrough.mjs [levels=1,2,..] [modes=zen,timed]
import { serve, launch } from './harness.mjs';
const levels = (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number);
const modes = (process.argv[3] || 'zen,timed').split(',');
const { srv, url } = await serve();
let failures = 0;
for (const n of levels) {
  for (const mode of modes) {
    const { browser, page, errors } = await launch('iphone14');
    const t0 = Date.now();
    await page.goto(`${url}?level=${n}&mode=${mode}&auto=1&sim=12&q=low`);
    await page.waitForFunction(() => window.__game && window.__game.session, null, { timeout: 120000 });
    let res = null;
    for (;;) {
      await page.waitForTimeout(3000);
      res = await page.evaluate(() => {
        const g = window.__game, s = g.session;
        return { t: s.time, d: s.ball.diameter, target: s.level.target, reached: s.reachedTarget, over: s.over, left: s.timeLeft, pickups: s.pickups, cpu: g.stats.cpuMs };
      });
      if (res.reached || res.over) break;
      if ((Date.now() - t0) / 1000 > 900) break; // safety
    }
    if (res.reached && !res.over) await page.evaluate(() => window.__game.finish());
    await page.waitForTimeout(1500);
    const save = await page.evaluate(() => window.__game.save.data);
    const lvlId = ['crumb', 'bedroom', 'house', 'culdesac', 'town', 'city'][n - 1];
    const done = save.levels[lvlId] && save.levels[lvlId][mode].done;
    const ok = res.reached && done && (n === 6 || save.unlocked >= n + 1) && errors.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? 'ok ' : 'BAD'} L${n} ${mode.padEnd(5)} goal reached at ${res.t.toFixed(0)}s game time (${mode === 'timed' ? `limit ${(res.t + res.left).toFixed(0)}s` : 'no limit'}), ` +
      `size ${res.d.toFixed(3)} m / goal ${res.target} m, ${res.pickups} pickups, real ${((Date.now() - t0) / 1000).toFixed(0)}s` + (errors.length ? `\n   errors: ${errors.slice(0, 5).join(' | ')}` : ''));
    await browser.close();
  }
}
srv.close();
process.exit(failures ? 1 : 0);
