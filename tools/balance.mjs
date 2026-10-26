// Level balance check: simulate greedy rolling over each level's real layout.
//   node tools/balance.mjs [level]
// For each level reports: objects, start-collectible count, the max size reachable by collecting
// everything reachable in size order, and the size reached at partial efficiency (a "typical player").
import fs from 'node:fs';
import { LEVELS } from '../src/levels/index.js';
import * as R from '../src/game/rules.js';

const catalog = JSON.parse(fs.readFileSync(new URL('../assets/catalog.json', import.meta.url)));
const lib = { byId: new Map(catalog.map((t) => [t.id, t])), types: catalog };

export function simulate(level, efficiency = 1, seed = 1) {
  const L = level.mod.layout(lib);
  const items = L.items.map((it) => {
    const t = lib.byId.get(it.id);
    return { size: t.size * it.scale, vol: t.vol * it.scale ** 3 };
  });
  items.sort((a, b) => a.size - b.size);
  let r = level.start / 2;
  let k = 0;
  let rnd = seed;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  let taken = 0;
  while (k < items.length && R.canPickUp(items[k].size, 2 * r)) {
    if (rand() < efficiency) {
      r = R.grow(r, items[k].vol, items[k].size);
      taken++;
    }
    k++;
  }
  return { d: 2 * r, taken, total: items.length, startCollectible: items.filter((i) => R.canPickUp(i.size, level.start)).length, missing: [...L.missing] };
}

const only = process.argv[2] ? [parseInt(process.argv[2])] : null;
let fail = 0;
for (const level of LEVELS) {
  if (!level.mod || (only && !only.includes(level.n))) continue;
  const full = simulate(level, 1);
  const typical = simulate(level, 0.55, 7);
  const three = level.target * R.STAR_RATIOS[2];
  const ok = full.d >= three * 1.3 && typical.d >= level.target && full.startCollectible >= 40;
  if (!ok) fail++;
  console.log(
    `${ok ? 'ok ' : 'BAD'} L${level.n} ${level.name.padEnd(15)} objects ${String(full.total).padStart(5)}  start-collectible ${String(full.startCollectible).padStart(4)}  ` +
      `max ${R.formatSize(full.d).padStart(8)} (3★ ${R.formatSize(three)})  55%-player ${R.formatSize(typical.d).padStart(8)} (goal ${R.formatSize(level.target)})` +
      (full.missing.length ? `  missing types: ${full.missing.length}` : ''),
  );
}
process.exit(fail ? 1 : 0);
