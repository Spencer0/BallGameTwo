// Fast time-based balance model (no rendering): a greedy ball rolls over a level's real layout at
// game speed, collecting what it can reach. Predicts time-to-goal and the size curve for a timer.
//   node tools/sweep.mjs [level ...]
import fs from 'node:fs';
import { LEVELS, starRatios } from '../src/levels/index.js';
import * as R from '../src/game/rules.js';

const catalog = JSON.parse(fs.readFileSync(new URL('../assets/catalog.json', import.meta.url)));
const lib = { byId: new Map(catalog.map((t) => [t.id, t])), types: catalog };
const SPEED = 4.4; // radii per second (ball.js PHYS.speed)

export function sweep(levelIn, { efficiency = 0.75, seed = 3, k = +(process.env.K || 0) } = {}) {
  const level = { ...levelIn, start: +process.env['START' + levelIn.n] || levelIn.start, target: +process.env['GOAL' + levelIn.n] || levelIn.target };
  const L = level.mod.layout(lib);
  const items = L.items.map((it) => {
    const t = lib.byId.get(it.id);
    return { x: it.x, z: it.z, y: it.y, size: t.size * it.scale, vol: t.vol * it.scale ** 3, alive: true };
  });
  let rnd = seed;
  const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const sp = level.mod.spawn;
  let x = sp.x,
    z = sp.z,
    r = level.start / 2;
  const dt = 0.25;
  let t = 0,
    goalAt = null;
  const curve = [];
  let target = null,
    retarget = 0;
  while (t < level.time) {
    const D = 2 * r;
    // collect everything reachable around the ball
    for (const it of items) {
      if (!it.alive || !R.canPickUp(it.size, D)) continue;
      if (it.y > r * 2.0) continue;
      const dx = it.x - x,
        dz = it.z - z;
      if (dx * dx + dz * dz < (r + it.size * 0.5) ** 2) {
        it.alive = false;
        r = R.radiusFromVolume(R.sphereVolume(r) + R.gainVolume(r, it.vol, it.size) * (level.growth ?? 1) * (+process.env['G' + level.n] || 1));
      }
    }
    if (goalAt === null && 2 * r >= level.target) goalAt = t;
    // greedy target (bigger + closer), with some inefficiency
    retarget -= dt;
    if (!target || !target.alive || retarget <= 0) {
      retarget = 0.5;
      let best = null,
        bestS = 0;
      for (const it of items) {
        if (!it.alive || !R.canPickUp(it.size, 2 * r) || it.y > r * 2.0) continue;
        const d = Math.hypot(it.x - x, it.z - z) + r;
        const s = (it.size / (2 * r) + 0.05) / d;
        if (s > bestS) {
          bestS = s;
          best = it;
        }
      }
      target = best;
    }
    if (target) {
      const dx = target.x - x,
        dz = target.z - z,
        d = Math.hypot(dx, dz) || 1;
      const r0 = level.start / 2;
      const step = Math.min(d, SPEED * (level.speed ?? 1) * (+process.env['S' + level.n] || 1) * r * Math.pow(r0 / r, k) * dt * efficiency);
      x += (dx / d) * step;
      z += (dz / d) * step;
    }
    t += dt;
    if (Math.abs(t % (level.time / 4)) < dt) curve.push((2 * r).toFixed(1));
  }
  const ratios = starRatios(level);
  const D = 2 * r;
  return { goalAt, final: D, curve, stars: ratios.filter((k) => D >= level.target * k).length };
}

const only = process.argv.slice(2).map(Number);
for (const level of LEVELS) {
  if (only.length && !only.includes(level.n)) continue;
  const s = sweep(level);
  console.log(
    `L${level.n} ${level.name.padEnd(15)} goal ${R.formatSize(level.target).padStart(7)} at ${s.goalAt === null ? 'never' : ((s.goalAt / level.time) * 100).toFixed(0) + '%'} of ${level.time}s;` +
      ` size at 25/50/75%: ${s.curve.slice(0, 3).join(' / ')}; final ${R.formatSize(s.final)} -> ${s.stars}★`,
  );
}
