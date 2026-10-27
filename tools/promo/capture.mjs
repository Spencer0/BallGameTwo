// Promo footage: steps the game a fixed 1/30 s per frame (?capture) and screenshots every frame, so the
// clips are smooth whatever the software renderer's speed; the game's own audio is rendered on the same
// clock (an offline context) and saved beside the frames.
//   node tools/promo/capture.mjs outDir [shotName,...|music]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { serve } from '../../tests/harness.mjs';
import { SHOTS, MUSIC } from './shots.mjs';

const [out = 'build/promo', only] = process.argv.slice(2);
const { srv, url } = await serve();
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const FPS = 30;
const TIMES = { 1: 240, 2: 360, 3: 480, 4: 300, 5: 270, 6: 360 }; // level timers (src/levels/index.js)

async function open(level, hud) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.goto(`${url}?level=${level}&mode=zen&q=high&capture&auto=1`);
  await page.waitForFunction(() => window.__game?.step && window.__game.session, null, { timeout: 240000 });
  await page.addStyleTag({ content: hud ? '#stick, #hud-hint { display: none !important; }' : '#hud, #ui, #stick { display: none !important; }' });
  return { ctx, page };
}

if (only === 'music') {
  // one continuous music bed for the whole cut
  const { ctx, page } = await open(1, false);
  await page.evaluate((m) => window.__game.audioCapture({ seconds: m.seconds, song: m.song }), MUSIC);
  for (let f = 0; f < MUSIC.seconds * FPS; f++) {
    await page.evaluate(() => (window.__game.vclock.t += 1 / 30));
    await page.waitForTimeout(30);
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(`${out}/music.wav`, Buffer.from(await page.evaluate(() => window.__game.audioRender()), 'base64'));
  console.log('music.wav');
  await ctx.close();
} else {
  const pick = only ? SHOTS.filter((s) => only.split(',').includes(s.name)) : SHOTS;
  for (const shot of pick) {
    const { ctx, page } = await open(shot.level, shot.hud);
    // place the ball (optional), then let the autopilot play the opening fifth of the level, fast-forwarded
    await page.evaluate(
      ([sh, preroll]) => {
        const g = window.__game,
          s = g.session;
        if (sh.at) {
          const r = sh.at.d / 2;
          s.ball.reset(sh.at.x, s.env.groundAt(sh.at.x, sh.at.z), sh.at.z, r);
          s.rVis = r;
          s.cam.reset(s.ball, sh.at.yaw ?? 0, 0);
        }
        if (sh.push) {
          // steer by hand instead of the autopilot: straight ahead, a touch to one side
          g.autopilot = null;
          g.input.override = { x: sh.push[0], y: sh.push[1] };
        }
        g.simSpeed = 12;
        for (let k = 0, n = Math.round((preroll * 60) / 12); k < n; k++) g.step(1 / 60);
        g.simSpeed = 1;
        for (let k = 0; k < 20; k++) g.step(1 / 60);
        // start recording once the ball is properly rolling, not pressed against something
        for (let k = 0; k < 240 && Math.hypot(s.ball.vel.x, s.ball.vel.z) < s.ball.r * 2; k++) g.step(1 / 60);
        s.particles.clear?.();
      },
      [shot, shot.preroll ?? TIMES[shot.level] * 0.015],
    );
    const N = Math.round(shot.dur * FPS);
    // QA: a take where the ball stalls or grinds against a wall is thrown away and re-shot a little later
    const dir = `${out}/frames/${shot.name}`;
    const t0 = Date.now();
    // one audio clock across every take; the good take's slice is cut out at the end
    const AUDIO = 6 * (shot.dur + 4) + 10;
    await page.evaluate((sec) => window.__game.audioCapture({ seconds: sec, music: false }), AUDIO);
    let keepAt = 0;
    let take = 0,
      ok = false,
      speeds;
    while (!ok) {
      take++;
      speeds = [];
      const tStart = await page.evaluate(() => window.__game.vclock.t);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      for (let f = 0; f < N; f++) {
        const v = await page.evaluate(
          ([sh, f, N]) => {
            const g = window.__game,
              s = g.session,
              b = s.ball,
              r = b.r;
            const t = f / 30;
            if (sh.cam) {
              const u = N > 1 ? f / (N - 1) : 0;
              const e = u * u * (3 - 2 * u);
              const lerp = (a, c) => a.map((v, i) => v + (c[i] - v) * e);
              g.debugView = { pos: lerp(sh.cam.from.pos, sh.cam.to.pos), look: lerp(sh.cam.from.look, sh.cam.to.look), fov: sh.cam.fov || 55, far: 20000 };
            } else if (sh.mode && sh.mode !== 'follow') {
              // a camera that moves with the ball: low tracking shot, orbit, or high chase
              const st = (window.__cam ||= { h: Math.atan2(b.vel.x, b.vel.z) || 0, a0: sh.a0 ?? 0.6 });
              if (Math.hypot(b.vel.x, b.vel.z) > r * 0.3) {
                let d = Math.atan2(b.vel.x, b.vel.z) - st.h;
                d = Math.atan2(Math.sin(d), Math.cos(d));
                st.h += d * 0.06;
              }
              const fx = Math.sin(st.h),
                fz = Math.cos(st.h);
              const P = b.pos;
              let pos, look;
              if (sh.mode === 'low') {
                const side = sh.side ?? 1;
                pos = [P.x - fx * r * 4.6 + fz * r * 3.4 * side, P.y + r * 0.7, P.z - fz * r * 4.6 - fx * r * 3.4 * side];
                look = [P.x + fx * r * 1.5, P.y + r * 0.2, P.z + fz * r * 1.5];
              } else if (sh.mode === 'orbit') {
                const a = st.a0 + t * (sh.spin ?? 0.5);
                pos = [P.x + Math.sin(a) * r * 6, P.y + r * 2.8, P.z + Math.cos(a) * r * 6];
                look = [P.x, P.y, P.z];
              } else {
                pos = [P.x - fx * r * 6, P.y + r * 6.5, P.z - fz * r * 6];
                look = [P.x + fx * r * 4, P.y, P.z + fz * r * 4];
              }
              const k = st.p ? 0.18 : 1;
              st.p = st.p ? st.p.map((v, i) => v + (pos[i] - v) * k) : pos;
              st.l = st.l ? st.l.map((v, i) => v + (look[i] - v) * k) : look;
              g.debugView = { pos: st.p, look: st.l, fov: 60, near: r * 0.05, far: Math.max(r * 3000, 400), focus: true };
            }
            g.step(1 / 30);
            return Math.hypot(b.vel.x, b.vel.z) / b.r; // rolling speed in radii per second
          },
          [shot, f, N],
        );
        speeds.push(v);
        await page.screenshot({ path: `${dir}/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
      }
      const sorted = [...speeds].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)],
        slow = speeds.filter((v) => v < 1.2).length / speeds.length;
      ok = !!shot.cam || (median > 2.5 && slow < 0.06) || take >= 6;
      keepAt = tStart;
      console.log(`  ${shot.name} take ${take}: median ${median.toFixed(1)} r/s, slow ${(slow * 100).toFixed(0)}%${ok ? '' : ' -> retake'}`);
      if (!ok)
        await page.evaluate(() => {
          window.__cam = null;
          for (let k = 0; k < 45; k++) window.__game.step(1 / 30); // roll on a bit and try again
          const s = window.__game.session;
          for (let k = 0; k < 240 && Math.hypot(s.ball.vel.x, s.ball.vel.z) < s.ball.r * 2; k++) window.__game.step(1 / 60);
        });
    }
    fs.writeFileSync(`${dir}.all.wav`, Buffer.from(await page.evaluate(() => window.__game.audioRender()), 'base64'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(keepAt), '-t', String(shot.dur + 1), '-i', `${dir}.all.wav`, `${dir}.wav`]);
    fs.rmSync(`${dir}.all.wav`);
    console.log(`${shot.name}: ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    await ctx.close();
  }
}
await browser.close();
srv.close();
