// Promo footage: steps the game a fixed 1/30 s per frame (?capture) and screenshots every frame, so the
// clips are smooth whatever the software renderer's speed. node tools/promo/capture.mjs outDir [shotName,...]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../../tests/harness.mjs';
import { SHOTS } from './shots.mjs';

const [out = 'build/promo', only] = process.argv.slice(2);
const pick = only ? SHOTS.filter((s) => only.split(',').includes(s.name)) : SHOTS;
const { srv, url } = await serve();
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const FPS = 30;

for (const shot of pick) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.goto(`${url}?level=${shot.level}&mode=zen&q=high&capture&auto=1`);
  await page.waitForFunction(() => window.__game?.step && window.__game.session, null, { timeout: 240000 });
  await page.addStyleTag({ content: shot.hud ? '#stick { display: none !important; }' : '#hud, #ui, #stick { display: none !important; }' });
  // place the ball, then let the autopilot roll it up for a while (fast-forward) so it carries a crust
  await page.evaluate((sh) => {
    const g = window.__game,
      s = g.session;
    if (sh.at) {
      const r = sh.at.d / 2;
      s.ball.reset(sh.at.x, s.env.groundAt(sh.at.x, sh.at.z), sh.at.z, r);
      s.rVis = r;
      s.cam.reset(s.ball, sh.at.yaw ?? 0, 0);
    }
    g.simSpeed = 8;
    const n = Math.round((sh.preroll || 0) * 60 / 8);
    for (let k = 0; k < n; k++) g.step(1 / 60);
    g.simSpeed = sh.sim || 1;
    s.particles.clear?.();
    for (let k = 0; k < 20; k++) g.step(1 / 60); // settle the follow camera at normal speed
  }, shot);
  const dir = `${out}/frames/${shot.name}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const N = Math.round(shot.dur * FPS);
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    await page.evaluate(([sh, t]) => {
      const g = window.__game;
      if (sh.cam) {
        const e = sh.cam.ease === false ? t : t * t * (3 - 2 * t);
        const lerp = (a, b) => a.map((v, i) => v + (b[i] - v) * e);
        g.debugView = { pos: lerp(sh.cam.from.pos, sh.cam.to.pos), look: lerp(sh.cam.from.look, sh.cam.to.look), fov: sh.cam.fov || 55, far: 20000 };
      }
      g.step(1 / 30);
    }, [shot, N > 1 ? f / (N - 1) : 0]);
    await page.screenshot({ path: `${dir}/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  console.log(`${shot.name}: ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await ctx.close();
}
await browser.close();
srv.close();
