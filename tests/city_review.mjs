// Review renders for the outdoor levels (CITY.md §5): gameplay-camera views, aerial obliques, a top-down
// map and motion strips, HUD hidden, plus stats. Views come from each level module's `review` export.
//   node tests/city_review.mjs [levels=4,5,6] [outDir=build/review] [q=high]
import fs from 'node:fs';
import { serve, launch } from './harness.mjs';

const levels = (process.argv[2] || '4,5,6').split(',').map(Number);
const out = process.argv[3] || 'build/review';
const q = process.argv[4] || 'high';
const { srv, url } = await serve();

for (const n of levels) {
  const dir = `${out}/L${n}`;
  fs.mkdirSync(dir, { recursive: true });
  const { browser, page, errors } = await launch('iphone14');
  await page.goto(`${url}?level=${n}&mode=zen&q=${q}`);
  await page.waitForFunction(() => window.__game?.session && window.__game.session.time > 0.5, null, { timeout: 180000 });
  await page.waitForTimeout(3000); // intro swoop
  await page.addStyleTag({ content: '#hud, #ui, #stick { display: none !important; }' });
  const review = await page.evaluate(() => window.__game.session.level.mod.review || null);
  if (!review) {
    console.log(`L${n}: no review views exported`);
    await browser.close();
    continue;
  }
  const shots = [];
  const shot = async (name) => {
    const f = `${dir}/${name}.png`;
    await page.screenshot({ path: f });
    shots.push(f);
  };
  // gameplay views: put the ball somewhere at a given size, let the follow camera settle
  for (const v of review.play || []) {
    await page.evaluate((v) => {
      const g = window.__game,
        s = g.session;
      g.debugView = null;
      const r = (v.d ?? s.level.start) / 2;
      s.ball.reset(v.x, s.env.groundAt(v.x, v.z), v.z, r);
      s.rVis = r;
      s.cam.reset(s.ball, v.yaw ?? 0, 0);
    }, v);
    await page.waitForTimeout(1600);
    await shot(`play_${v.name}`);
  }
  // aerial and map views from fixed cameras
  for (const v of [...(review.aerial || []), ...(review.map ? [{ name: 'map', ...review.map }] : []), ...(review.maps || []).map((m) => ({ ...m, name: 'map_' + m.name }))]) {
    await page.evaluate((v) => {
      const g = window.__game;
      if (v.cx !== undefined) {
        const aspect = innerWidth / innerHeight; // portrait: fit the half-size horizontally
        const h = v.half / (Math.tan(((v.fov ?? 20) * Math.PI) / 360) * aspect);
        g.debugView = { pos: [v.cx, h, v.cz + 0.01], look: [v.cx, 0, v.cz], fov: v.fov ?? 20, near: h * 0.5, far: h * 2, noFog: true, hideAbove: 60 };
      } else g.debugView = { pos: v.pos, look: v.look, fov: v.fov ?? 55, near: v.near ?? 2, far: v.far ?? 20000, noFog: v.noFog ?? false };
    }, v);
    await page.waitForTimeout(900);
    await shot(v.name.startsWith('map') ? v.name : `aerial_${v.name}`);
  }
  // motion strips: 4 frames 0.5 s apart from a fixed camera
  for (const v of review.motion || []) {
    await page.evaluate((v) => {
      window.__game.debugView = { pos: v.pos, look: v.look, fov: v.fov ?? 50, near: 0.5, far: 5000, noFog: false };
    }, v);
    await page.waitForTimeout(800);
    if (v.waitTrain) {
      // time the strip to a train coming through (up to ~4 minutes of game time)
      await page
        .waitForFunction(
          ([x, z]) => {
            const life = window.__game.session.life,
              w = window.__game.session.world;
            return (life?.trains || []).some((m) => m.its.some((i) => i >= 0 && Math.hypot(w.x[i] - x, w.z[i] - z) < 45));
          },
          v.waitTrain,
          { timeout: 240000, polling: 250 },
        )
        .catch(() => console.log(`L${n}: no train reached ${v.name}`));
    }
    for (let k = 0; k < 4; k++) {
      await shot(`motion_${v.name}_${k}`);
      await page.waitForTimeout(500);
    }
  }
  const stats = await page.evaluate(() => {
    const g = window.__game,
      s = g.session,
      w = s.world;
    const byType = {};
    for (let i = 0; i < w.n; i++) byType[w.types[w.type[i]].id] = (byType[w.types[w.type[i]].id] || 0) + 1;
    const top = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    return {
      objects: w.n,
      kinds: top.length,
      top: top.slice(0, 25),
      network: s.level.mod.net ? s.level.mod.net.stats() : null,
      life: s.life ? s.life.stats() : null,
      streetTris: s.env.streetTris || 0,
      missing: s.layoutMissing,
    };
  });
  stats.errors = errors.slice(0, 10);
  fs.writeFileSync(`${dir}/stats.json`, JSON.stringify(stats, null, 1));
  console.log(`L${n}: ${shots.length} shots -> ${dir}; objects ${stats.objects}, kinds ${stats.kinds}, missing [${stats.missing.join(', ')}]${errors.length ? ', ERRORS ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
}
srv.close();
