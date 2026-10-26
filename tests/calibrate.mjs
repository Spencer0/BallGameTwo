// Timer/star calibration: the autopilot plays a timed level until the clock runs out.
// Reports when the goal was reached (as a fraction of the limit) and the final size vs star thresholds.
//   node tests/calibrate.mjs 4 [5 6]
import { serve, launch } from './harness.mjs';
const levels = process.argv.slice(2).map(Number);
const { srv, url } = await serve();
for (const n of levels) {
  const { browser, page, errors } = await launch('iphone14');
  await page.goto(`${url}?level=${n}&mode=timed&auto=1&sim=16&q=low`);
  await page.waitForFunction(() => window.__game?.session, null, { timeout: 120000 });
  let goalAt = null;
  const marks = [];
  for (;;) {
    await page.waitForTimeout(2000);
    const s = await page.evaluate(() => {
      const g = window.__game, s = g.session;
      return { t: s.time, d: s.ball.diameter, reached: s.reachedTarget, over: s.over, limit: s.level.time, target: s.level.target, stars: (s.level.stars || [1, 1.4, 1.9]).map((r) => r * s.level.target) };
    });
    if (s.reached && goalAt === null) goalAt = s.t;
    if (marks.length < 4 && s.t > s.limit * (marks.length + 1) * 0.25) marks.push(s.d.toFixed(1));
    if (s.over) {
      const st = s.stars.filter((x) => s.d >= x).length;
      console.log(`L${n}: goal ${s.target} m reached at ${goalAt ? ((goalAt / s.limit) * 100).toFixed(0) + '%' : 'never'} of ${s.limit}s; size at 25/50/75%: ${marks.slice(0, 3).join(' / ')} m; final ${s.d.toFixed(1)} m; stars at ${s.stars.map((x) => x.toFixed(0)).join('/')} -> ${st}★` + (errors.length ? ` errors: ${errors.length}` : ''));
      break;
    }
  }
  await browser.close();
}
srv.close();
