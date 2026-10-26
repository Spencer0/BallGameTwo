// Suburban building blocks: a full residential lot (house, driveway, garage, yard, fences), parking lots
// with cars in their stalls, and woods filling leftover land.
import { SK } from '../../render/streets.js';
import { local } from './frontage.js';

/** first id in the list that exists in the asset library */
const local2 = (fr, r, f) => {
  const [x, z] = local(fr, r, f);
  return { x, z };
};

export function pickId(L, ids) {
  for (const id of ids) if (L.lib.byId.has(id)) return id;
  return ids[ids.length - 1];
}

// house id -> where the driveway meets the house (local x of the garage door, null = beside the house)
const HOUSES = {
  house_a: { drive: 'side' },
  house_b: { drive: 'side' },
  house_c: { drive: 'side' },
  house_d: { drive: 4.6 },
  house_e: { drive: -4.8 },
  house_f: { drive: 'side' },
};
const SIDING = new Set(['paper', 'sand', 'cloud', 'concrete', 'stone', 'butter', 'mint', 'brick', 'snow', 'caramel']);
const HOUSE_POOL = ['house_d', 'house_e', 'house_f', 'house_a', 'house_c', 'house_d', 'house_e', 'house_f'];

/**
 * One suburban lot. fr = frame on the property line at the lot's centre (yaw faces the road).
 * e = the street edge (for verge/walk widths). opts: W (frontage), D (depth), first/last (fence ends), pie.
 */
export function suburbLot(ctx, fr, e, { W = 20, D = 30, first = false, last = false, pie = false, setback: sb = null, pool: poolIds = null, fenceP = 1, fenceIds = null, fenceTint: ft = 'sand', fenceMode = 'lot' } = {}) {
  const { L, occ, fences, paint } = ctx;
  const pool = (poolIds || HOUSE_POOL).filter((id) => L.lib.byId.has(id));
  if (!pool.length) return false;
  // reserve the whole lot first: skip it if it would overlap a road, another lot or a building
  // pie lots widen away from the bulb: reserve the rectangle that fits inside the wedge's middle
  const lotW = pie ? Math.min(W * 1.6, 2 * (pie.R + D * 0.4) * Math.sin(pie.half) * 0.92) : W;
  let lotRect = null;
  for (const dd of [D, D - 4, D - 8, D - 12, D - 16].filter((d) => d >= 17)) {
    // shallower lots squeeze in where blocks end or curve
    // start a little behind the property line and a little narrower than the lot, so curved
    // frontages (where a straight rectangle's front corners swing back into the road) still fit
    const [lx, lz] = local(fr, 0, -(1.8 + (dd - 1.8) / 2));
    const r = { x: lx, z: lz, hw: lotW * 0.38, hd: (dd - 1.8) / 2, yaw: fr.yaw };
    if (!occ.hits(r)) {
      lotRect = r;
      D = dd;
      break;
    }
  }
  if (!lotRect) {
    if (ctx.debugLots) ctx.debugLots.push({ x: fr.x, z: fr.z, why: occ.hits({ ...local2(fr, 0, -10), hw: lotW * 0.38, hd: 8, yaw: fr.yaw })?.tag || '?', e: e.name });
    return false;
  }
  occ.add(lotRect, 'lot');
  const IN_LOT = ctx.inLot || (ctx.inLot = new Set(['lot']));
  const house = L.pick(pool);
  const t = L.lib.byId.get(house);
  const hw = t.dims[0] / 2,
    hd = t.dims[2] / 2;
  const setback = sb ? sb[0] + L.rand() * (sb[1] - sb[0]) : 7.5 + L.rand() * 2;
  const mirror = L.rand() < 0.5 ? -1 : 1; // flip the plan so the street isn't a copy-paste
  const info = HOUSES[house] || { drive: 'side' };
  // the house: front facade at `setback` behind the property line, facing the road
  const [hx, hz] = local(fr, 0, -(setback + hd));
  const rect = { x: hx, z: hz, hw: hw + 0.4, hd: hd + 0.4, yaw: fr.yaw };
  if (occ.hits(rect, IN_LOT)) return false;
  occ.add(rect, 'bld');
  // garage-door houses can't be mirrored without moving the door: keep their native side
  const flip = typeof info.drive === 'number' ? 1 : mirror;
  // siding in the narrow range real streets have (white, cream, beige, grey, a little sage); colour goes on
  // the doors, cars and toys
  const t0 = L.lib.byId.get(house);
  const siding = (t0.variants || []).filter((c) => SIDING.has(c));
  L.put(house, hx, hz, { yaw: fr.yaw, tint: siding.length ? L.pick(siding) : L.pick(['paper', 'sand', 'cloud']) });
  // driveway: from the property line to the garage door (or alongside the house)
  // local() measures r to the right of the facing direction, which is the model's -x: negate the door offset
  const gx = typeof info.drive === 'number' ? -info.drive : flip * (hw + 2.2);
  const driveLen = typeof info.drive === 'number' ? setback : setback + hd * 1.3;
  const [dx, dz] = local(fr, gx, -driveLen / 2);
  const apronLen = Math.max(0, e.verge - 0.3);
  const [ax, az] = local(fr, gx, e.walk + apronLen / 2);
  paint.push((b) => {
    b.rect(dx, dz, 3.4, driveLen, fr.yaw, SK.drive, { C: ['cloud', 'cloud', 'stone'] });
    if (apronLen > 0.2) b.rect(ax, az, 3.4, apronLen, fr.yaw, SK.drive, { C: ['cloud', 'cloud', 'stone'] });
    // front path from the sidewalk to the door
    const [px, pz] = local(fr, -gx * 0.25, -setback / 2);
    b.rect(px, pz, 1.2, setback, fr.yaw, SK.drive, { C: ['concrete', 'concrete', 'stone'] });
  });
  occ.add({ x: dx, z: dz, hw: 1.9, hd: driveLen / 2, yaw: fr.yaw }, 'drive');
  // a car or two in the driveway
  if (L.rand() < 0.7) {
    const id = L.pick(['car', 'suv', 'hatchback', 'pickup_truck', 'car', 'suv'].filter((i) => L.lib.byId.has(i)));
    const [cx, cz] = local(fr, gx, -Math.min(driveLen - 3, setback * 0.55));
    L.put(id, cx, cz, { yaw: L.along(id, fr.yaw + (L.rand() < 0.75 ? Math.PI : 0)) });
  }
  // detached garage at the back for houses without one
  if (typeof info.drive !== 'number' && L.rand() < 0.45 && D > 26) {
    const gt = L.lib.byId.get('garage');
    if (gt) {
      const [gx2, gz2] = local(fr, gx, -(setback + hd * 2 + 1 + gt.dims[2] / 2));
      const gr = { x: gx2, z: gz2, hw: gt.dims[0] / 2, hd: gt.dims[2] / 2, yaw: fr.yaw };
      if (!occ.hits(gr, IN_LOT) && setback + hd * 2 + gt.dims[2] + 2 < D) {
        occ.add(gr, 'bld');
        L.put('garage', gx2, gz2, { yaw: fr.yaw });
        // the driveway runs on past the house to the garage door
        const d0 = driveLen,
          d1 = setback + hd * 2 + 1;
        if (d1 > d0 + 0.5) {
          const [ex, ez] = local(fr, gx, -(d0 + d1) / 2);
          paint.push((b) => b.rect(ex, ez, 3.4, d1 - d0, fr.yaw, SK.drive, { C: ['cloud', 'cloud', 'stone'] }));
          occ.add({ x: ex, z: ez, hw: 1.9, hd: (d1 - d0) / 2, yaw: fr.yaw }, 'drive');
        }
      }
    }
  }
  // curb: mailbox and street tree in the verge (or at the back of the sidewalk)
  const vergeMid = e.verge > 0.8 ? e.walk + e.verge / 2 : -0.6;
  {
    const [mx, mz] = local(fr, gx - flip * 2.4, vergeMid);
    L.put('mailbox', mx, mz, { yaw: fr.yaw });
    const tree = pickId(L, ['street_tree', 'tree_round']);
    const [tx, tz] = local(fr, -gx * 0.7 + (pie ? 0 : -flip * 3), vergeMid);
    L.put(tree, tx, tz, { scale: L.range(0.85, 1.1) });
    if (L.rand() < 0.3) {
      const [bx, bz] = local(fr, gx + flip * 2.4, vergeMid);
      L.put('wheelie_bin', bx, bz, { yaw: fr.yaw });
    }
  }
  // front garden: foundation bushes, a bed of flowers, the odd ornament or bike
  for (let k = 0; k < 3; k++) {
    const [bx, bz] = local(fr, -gx * 0.15 + (k - 1) * hw * 0.55, -(setback - 1.3));
    if (L.rand() < 0.8) L.put('bush', bx, bz, { scale: L.range(0.5, 0.7) });
  }
  if (L.rand() < 0.3) {
    const id = L.pick(['garden_gnome', 'flamingo_ornament', 'sunflower', 'birdbath']);
    const [ox, oz] = local(fr, -gx * 0.6, -setback * 0.45);
    L.put(id, ox, oz);
  }
  if (L.rand() < 0.18) {
    const id = L.pick(['bicycle', 'tricycle', 'lawn_mower', 'wheelbarrow']);
    const [ox, oz] = local(fr, gx * 0.55, -setback * 0.6);
    L.put(id, ox, oz, { yaw: fr.yaw + L.range(-0.6, 0.6) });
  }
  // back yard: fence the sides behind the house and the rear line; fill with the family's stuff
  const fence = pickId(L, fenceIds || ['privacy_fence', 'picket_fence']);
  const backStart = -(setback + hd * 2 + 0.8);
  const fenceTint = ft;
  const fenced = L.rand() < fenceP;
  occ.add({ ...local2(fr, 0, -setback / 2), hw: W / 2 - 0.5, hd: setback / 2 - 0.3, yaw: fr.yaw }, 'front');
  if (fenced && !pie) {
    const [yx, yz] = local(fr, 0, (backStart - D) / 2);
    paint.push((b) => b.rect(yx, yz, W - 0.4, D + backStart, fr.yaw, SK.solid, { C: ['lime'], y: -0.06 }));
  }
  let rightRun = null;
  const sideDriveGate = (sg) => typeof info.drive !== 'number' && Math.sign(gx) === sg;
  if (fenced && !pie && fenceMode === 'frontage') {
    // the block's fences are drawn once all its lots are down (frontageFences); here just the returns from
    // the back corners of the house to the lot lines
    for (const sg of [-1, 1]) if (!sideDriveGate(sg)) fenceLine2(L, fence, local(fr, sg * (hw + 0.2), backStart), local(fr, sg * W / 2, backStart), fences, fenceTint, occ);
  } else if (!fenced) {
    // an open back yard
  } else if (!pie) {
    // side fences run the whole lot line from just behind the house front, so whatever depth the
    // neighbour's house is, its return meets this run (one continuous fence per shared lot line)
    const sideStart = -(setback + 1.2);
    rightRun = [local(fr, W / 2, sideStart), local(fr, W / 2, -D)];
    const left = local(fr, -W / 2, sideStart),
      leftEnd = local(fr, -W / 2, -D),
      right = local(fr, W / 2, sideStart),
      rightEnd = local(fr, W / 2, -D);
    fenceLine2(L, fence, left, leftEnd, fences, fenceTint, occ);
    if (last) {
      fenceLine2(L, fence, right, rightEnd, fences, fenceTint, occ);
      rightRun = null;
    }
    fenceLine2(L, fence, leftEnd, rightEnd, fences, fenceTint, occ);
    // returns from the back corners of the house out to the lot lines, so the yard is closed against the
    // house (left open on the driveway side when the drive runs back past the house: that's the gate)
    const sideDrive = typeof info.drive !== 'number';
    for (const sg of [-1, 1]) {
      if (sideDrive && Math.sign(gx) === sg) continue;
      fenceLine2(L, fence, local(fr, sg * (hw + 0.2), backStart), local(fr, sg * W / 2, backStart), fences, fenceTint, occ);
    }
  } else {
    // pie lot: radial side fences along the wedge edges, the rear line across the wide end
    const { cx, cz, a, half, R } = pie;
    const r0 = R - backStart,
      r1 = R + D;
    const P = (ang, r) => [cx + Math.sin(ang) * r, cz + Math.cos(ang) * r];
    if (fenced) {
      const wedge = [];
      for (let k = 0; k <= 6; k++) wedge.push(P(a - half + (2 * half * k) / 6, r0));
      for (let k = 6; k >= 0; k--) wedge.push(P(a - half + (2 * half * k) / 6, r1));
      paint.push((b) => b.poly(wedge, SK.solid, { C: ['lime'], y: -0.06, origin: [cx, cz] }));
    }
    const rs = r0; // from the back of the house
    fenceLine2(L, fence, P(a - half, rs), P(a - half, r1), fences, fenceTint, occ);
    fenceLine2(L, fence, P(a + half, rs), P(a + half, r1), fences, fenceTint, occ);
    fenceLine2(L, fence, P(a - half, r1), P(a + half, r1), fences, fenceTint, occ);
    // returns from the house's back corners to the wedge sides (local right is towards increasing angle)
    for (const sg of [-1, 1]) {
      if (typeof info.drive !== 'number' && Math.sign(gx) === sg) continue;
      fenceLine2(L, fence, local(fr, sg * (hw + 0.2), backStart), P(a + sg * half, r0), fences, fenceTint, occ);
    }
  }
  // each family's yard has a character, not the same kit everywhere
  const THEMES = [
    ['above_ground_pool', 'bbq_grill', 'picnic_table'],
    ['trampoline', 'swing_set'],
    ['garden_shed', 'wheelbarrow', 'hose_reel', 'sunflower', 'sunflower'],
    ['doghouse', 'picnic_table'],
    ['bbq_grill'],
    ['pingpong_table', 'picnic_table'],
    ['treehouse', 'kiddie_pool'],
    ['garden_shed', 'bbq_grill'],
    ['swing_set', 'kiddie_pool', 'picnic_table'],
    [],
  ];
  const yard = L.pick(THEMES).filter((id) => L.lib.byId.has(id));
  const n = yard.length;
  const depth = D + backStart;
  for (let k = 0; k < n && depth > 6; k++) {
    for (let tries = 0; tries < 6; tries++) {
      const id = yard[k];
      const yt = L.lib.byId.get(id);
      if (!yt) break;
      const yw = yt.dims[0] / 2 + 0.4,
        yd = yt.dims[2] / 2 + 0.4;
      if (yd * 2 > depth - 1 || yw * 2 > W - 2) continue;
      // keep play things well off the fence lines
      const rx = L.range(-W / 2 + yw + 1.6, W / 2 - yw - 1.6);
      const rz = L.range(backStart - yd - 1.2, -D + yd + 1.8);
      const [x, z] = local(fr, rx, rz);
      const yaw = fr.yaw + (L.rand() < 0.5 ? 0 : Math.PI / 2);
      const r = { x, z, hw: yw, hd: yd, yaw };
      if (occ.hits(r, IN_LOT)) continue;
      occ.add(r, 'yard');
      L.put(id, x, z, { yaw });
      break;
    }
  }
  // a shade tree in many back yards
  if (L.rand() < 0.55 && depth > 8) {
    const [x, z] = local(fr, L.range(-W / 3, W / 3), -D + 3.5);
    const r = { x, z, hw: 1.2, hd: 1.2, yaw: 0 };
    if (!occ.hits(r, IN_LOT)) {
      occ.add(r, 'yard');
      L.put(L.pick(['tree_round', 'tree_round', 'pine_tree']), x, z, { scale: L.range(0.7, 0.95) });
    }
  }
  // the family dog lives in the back yard
  if (L.rand() < 0.3) {
    const [x, z] = local(fr, L.range(-W / 3, W / 3), (backStart - D) / 2);
    const dog = L.put('dog', x, z);
    if (dog) (ctx.yardDogs || (ctx.yardDogs = [])).push({ it: dog, fr, W, z0: backStart, z1: -D });
  }
  if (fenceMode === 'frontage' && !pie) {
    if (fenced) rightRun = null;
    return { fr, W, D, backStart, fenced, fence, fenceTint };
  }
  (ctx.lots || (ctx.lots = [])).push({ fr, W, D, setback, gx, driveLen, house, fence, fenceTint, leftAt: fenced && !pie ? local(fr, -W / 2, -(setback + 1.2)) : null, rightRun, rearL: local(fr, -W / 2, -D), rearR: local(fr, W / 2, -D), fenced: fenced && !pie });
  return true;
}

/** After all lots are down: close the right-hand side fence of any lot whose neighbour never got built. */
export function closeFences(ctx) {
  const lots = ctx.lots || [];
  for (const a of lots) {
    if (!a.rightRun) continue;
    const [r0, r1] = a.rightRun;
    const nb = lots.find((b) => b !== a && b.leftAt && Math.hypot(b.leftAt[0] - r0[0], b.leftAt[1] - r0[1]) < 3);
    if (!nb) fenceLine2(ctx.L, a.fence, r0, r1, ctx.fences, a.fenceTint, ctx.occ);
    // neighbours of different depth: carry the shared side fence on to the deeper rear corner
    // neighbours of different depth, or fanning apart round a curve: close the gap between rear corners
    else if (Math.hypot(nb.rearL[0] - a.rearR[0], nb.rearL[1] - a.rearR[1]) > 0.8 && Math.hypot(nb.rearL[0] - a.rearR[0], nb.rearL[1] - a.rearR[1]) < 16) fenceLine2(ctx.L, a.fence, a.rearR, nb.rearL, ctx.fences, a.fenceTint, ctx.occ);
    a.rightRun = null;
  }
}

const FENCE_PASS = new Set(['lot', 'yard', 'tree', 'green', 'park', 'path']);
function fenceLine2(L, id, [x0, z0], [x1, z1], dedupe, tint, occ = null) {
  const t = L.lib.byId.get(id);
  if (!t) return;
  const panel = Math.max(t.dims[0], t.dims[2]);
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < panel * 0.5) return;
  const n = Math.max(1, Math.round(len / panel));
  const s = Math.min(1.1, Math.max(0.9, len / (n * panel)));
  const ux = (x1 - x0) / len,
    uz = (z1 - z0) / len;
  const yaw = L.along(id, Math.atan2(ux, uz));
  const log = L.fenceLog ? { x0, z0, x1, z1, n, dup: 0, blocked: [] } : null;
  if (log) L.fenceLog.push(log);
  for (let k = 0; k < n; k++) {
    const c = (k + 0.5) * (len / n);
    const x = x0 + ux * c,
      z = z0 + uz * c;
    const key = Math.round(x) + ',' + Math.round(z);
    if (dedupe.has(key)) {
      if (log) log.dup++;
      continue;
    }
    // never through a house, garage, driveway, road or somebody's front garden
    const hit = occ && occ.hits({ x, z, hw: 0.3, hd: 0.3, yaw: 0 }, FENCE_PASS);
    if (hit) {
      if (log) log.blocked.push(hit.tag);
      continue;
    }
    dedupe.add(key);
    L.put(id, x, z, { yaw, scale: s, tint });
  }
}

/** A parking lot: stalls painted and filled. Local frame: u across the rows (local x), v along them (local z). */
export function parkingLot(ctx, cx, cz, w, d, yaw, { fill = 0.6, ids = ['car', 'suv', 'hatchback', 'pickup_truck'], stall = 2.7, depth = 5.4, tints = null } = {}) {
  const { L, paint } = ctx;
  paint.push((b) => b.rect(cx, cz, w, d, yaw, SK.parking, { P: [stall, depth], C: ['charcoal', 'paper'], uv0: [w / 2, d / 2] }));
  const period = 2 * depth + 6;
  const have = ids.filter((i) => L.lib.byId.has(i));
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const cars = [];
  for (let u0 = 0; u0 < w; u0 += period) {
    for (const uc of [u0 + depth / 2, u0 + depth + 6 + depth / 2]) {
      if (uc + depth / 2 > w + 0.01) continue;
      for (let v = stall / 2; v < d; v += stall) {
        if (L.rand() > fill) continue;
        const id = L.pick(have);
        const lx = uc - w / 2,
          lz = v - d / 2;
        const x = cx + c * lx + s * lz,
          z = cz - s * lx + c * lz;
        // car long axis along the stall (local x); nose in or out
        cars.push(L.put(id, x, z, { yaw: L.along(id, yaw + Math.PI / 2) + (L.rand() < 0.5 ? Math.PI : 0), tint: tints ? L.pick(tints) : undefined }));
      }
    }
  }
  return cars;
}

/** Fill land nobody uses with woods, keeping off everything in the occupancy map. */
export function woods(ctx, R, { count = 400, ids = ['pine_tree', 'tree_round'], scale = [0.85, 1.3], minRoadDist = 0, net = null } = {}) {
  const { L, occ } = ctx;
  let placed = 0;
  for (let k = 0; k < count * 4 && placed < count; k++) {
    const x = L.range(R.minX, R.maxX),
      z = L.range(R.minZ, R.maxZ);
    if (minRoadDist && net && roadDistance(net, x, z) < minRoadDist) continue;
    const id = L.pick(ids);
    const t = L.lib.byId.get(id);
    if (!t) continue;
    const sc = L.range(scale[0], scale[1]);
    const r = { x, z, hw: t.dims[0] * 0.3 * sc, hd: t.dims[2] * 0.3 * sc, yaw: 0 };
    if (occ.hits(r)) continue;
    occ.add({ ...r, hw: r.hw * 0.7, hd: r.hd * 0.7 }, 'tree');
    L.put(id, x, z, { scale: sc });
    placed++;
  }
  return placed;
}

/** distance from (x,z) to the nearest road centreline of the network */
export function roadDistance(net, x, z) {
  let best = Infinity;
  for (const e of net.edges) {
    if (e.cls === 'path' || e.cls === 'rail') continue;
    const p = e.poly;
    for (let k = 1; k < p.length; k++) {
      const ax = p[k - 1][0],
        az = p[k - 1][1];
      const dx = p[k][0] - ax,
        dz = p[k][1] - az;
      const l2 = dx * dx + dz * dz || 1e-9;
      let t = ((x - ax) * dx + (z - az) * dz) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ax + dx * t - x,
        ez = az + dz * t - z;
      const d = Math.sqrt(ex * ex + ez * ez);
      if (d < best) best = d;
    }
  }
  return best;
}

/** a painted sports court: solid surface with a border line, no overlapping pieces */
export function court(b, SKk, x, z, w, d, yaw, col, line = 'paper') {
  const lw = 0.35;
  b.rect(x, z, w - 2 * lw, d - 2 * lw, yaw, SKk.solid, { C: [col] });
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const at = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
  for (const [lx, lz, rw, rd] of [[0, -d / 2 + lw / 2, w, lw], [0, d / 2 - lw / 2, w, lw], [-w / 2 + lw / 2, 0, lw, d - 2 * lw], [w / 2 - lw / 2, 0, lw, d - 2 * lw], [0, 0, w - 2 * lw, lw * 0.6]]) {
    const [px, pz] = at(lx, lz);
    b.rect(px, pz, rw, rd, yaw, SKk.solid, { C: [line] });
  }
}

const FARM_CROPS = [['leaf', 'lime'], ['sand', 'butter'], ['pine', 'leaf'], ['lime', 'leaf'], ['caramel', 'sand'], ['butter', 'sand']];

/**
 * Farmland beyond the play area, out to the horizon: a grid of fields (painted), hedgerows and woodlots,
 * clear of the roads that leave the map. avoid(x, z, half) -> true skips a cell (rivers, lakes).
 */
export function countryside(ctx, net, { inner, outer, cell = 130, trees = 0.18, avoid = null, y = -0.15 } = {}) {
  const { L, paint } = ctx;
  for (let x = -outer; x < outer; x += cell)
    for (let z = -outer; z < outer; z += cell) {
      if (!(x + cell <= -inner || x >= inner || z + cell <= -inner || z >= inner)) continue;
      const cx = x + cell / 2,
        cz = z + cell / 2;
      if (roadDistance(net, cx, cz) < cell * 0.72) continue;
      if (avoid && avoid(cx, cz, cell / 2)) continue;
      const r = L.rand();
      const w = cell - 3;
      if (r < 0.1) {
        // a woodlot
        for (let k = 0; k < 14; k++) L.put(L.pick(['pine_tree', 'tree_round', 'pine_tree']), cx + L.range(-w / 2.5, w / 2.5), cz + L.range(-w / 2.5, w / 2.5), { scale: L.range(1.1, 1.6), tint: L.pick(['leaf', 'pine']) });
        continue;
      }
      if (r > 0.2) {
        const [a, b] = L.pick(FARM_CROPS);
        paint.push((bb) => bb.rect(cx, cz, w, w, L.rand() < 0.5 ? 0 : Math.PI / 2, SK.field, { P: [2.4], C: [a, b], y }));
      }
      if (L.rand() < trees) {
        const along = L.rand() < 0.5;
        for (let t = -w / 2 + 5; t < w / 2 - 4; t += 13) L.put(L.rand() < 0.7 ? 'tree_round' : 'pine_tree', cx + (along ? t : -w / 2), cz + (along ? -w / 2 : t), { scale: L.range(1, 1.4), tint: L.pick(['leaf', 'pine', 'lime']) });
      }
    }
}

/**
 * Fences for a run of lots along one frontage (fenceMode 'frontage'): one continuous rear fence following
 * the street's curve, a fence down every shared lot line from the nearer house's back to the rear line,
 * and the two outer sides. recs: [{ s, rec }] where rec is what suburbLot returned and s the lot centre.
 */
export function frontageFences(ctx, f, recs, frameAt) {
  const { L, occ, fences } = ctx;
  const lots = recs.filter((r) => r.rec && r.rec.fenced).sort((a, b) => a.s - b.s);
  // split into runs of neighbouring lots
  const runs = [];
  for (const r of lots) {
    const last = runs[runs.length - 1];
    if (last && r.s - last[last.length - 1].s < r.rec.W * 1.2) last.push(r);
    else runs.push([r]);
  }
  for (const run of runs) {
    const a = run[0],
      z = run[run.length - 1];
    const D = Math.min(...run.map((r) => r.rec.D));
    const { fence, fenceTint } = a.rec;
    const at = (s, depth) => local(frameAt(f, s), 0, depth);
    // rear line, panel by panel along the curve
    const s0 = a.s - a.rec.W / 2,
      s1 = z.s + z.rec.W / 2;
    const n = Math.max(1, Math.round((s1 - s0) / 2.4));
    for (let k = 0; k < n; k++) fenceLine2(L, fence, at(s0 + ((s1 - s0) * k) / n, -D), at(s0 + ((s1 - s0) * (k + 1)) / n, -D), fences, fenceTint, occ);
    // the outer sides and every shared lot line
    fenceLine2(L, fence, at(s0, a.rec.backStart), at(s0, -D), fences, fenceTint, occ);
    fenceLine2(L, fence, at(s1, z.rec.backStart), at(s1, -D), fences, fenceTint, occ);
    for (let k = 0; k < run.length - 1; k++) {
      const sb = (run[k].s + run[k].rec.W / 2 + run[k + 1].s - run[k + 1].rec.W / 2) / 2;
      fenceLine2(L, fence, at(sb, Math.max(run[k].rec.backStart, run[k + 1].rec.backStart)), at(sb, -D), fences, fenceTint, occ);
    }
  }
}
