// Level 4 — Cul-de-Sac: Maple Loop, a 1990s subdivision off Maple Avenue (CITY.md §2).
// Plan: Maple Avenue (arterial, strip mall + gas station) along the south edge; one entrance road into a
// collector loop; three cross streets and Elm St inside; cul-de-sac courts off the loop; Old Mill Rd
// leaving north. 20 m lots: lawn, driveway to the garage, mailbox and street tree in the verge, back yards
// behind continuous privacy fences. A park with a pond and the elementary school take a block each.
import { Layout } from './layout.js';
import { Network, arc } from './city/network.js';
import { paintNetwork } from './city/surface.js';
import { Occupancy, occupyNetwork, frameAt, local, fillFrontage, fenceLine } from './city/frontage.js';
import { SK } from '../render/streets.js';
import { suburbLot, pickId, woods, parkingLot, court } from './city/suburb.js';
import { lifeSpec, spawnTraffic, spawnWalkers, spawnLoopWalkers, trafficLights, stopSigns, flock } from './city/lifespec.js';

const S = 240;
const LOOP = { x0: -150, x1: 150, z0: -160, z1: 130, r: 40 };
const CROSS = [55, -20, -95]; // interior E-W streets
const PARK = { minX: -150, maxX: 0, minZ: -160, maxZ: -95 };
const SCHOOL = { minX: 0, maxX: 150, minZ: -160, maxZ: -95 };
const COURTS = [
  { name: 'Willow Ct', from: [LOOP.x0, 55], to: [-196, 55] },
  { name: 'Hazel Ct', from: [LOOP.x0, -95], to: [-196, -95] },
  { name: 'Oak Ct', from: [LOOP.x1, -20], to: [196, -20] },
  { name: 'Spruce Ct', from: [-80, LOOP.z0], to: [-80, -204] },
  { name: 'Pine Ct', from: [80, LOOP.z0], to: [80, -204] },
];
const BULB = 13;
const ART_Z = 200;

function buildNet() {
  const net = new Network();
  // Maple Avenue: through traffic in and out of the fog
  const aw = net.node(-S - 60, ART_Z, { exit: true }),
    ae = net.node(S + 60, ART_Z, { exit: true });
  const aEnt = net.node(0, ART_Z, { signal: true });
  net.edge(aw, aEnt, { cls: 'arterial', name: 'Maple Avenue' });
  net.edge(aEnt, ae, { cls: 'arterial', name: 'Maple Avenue' });
  // the loop, clockwise from the entrance, with junction stations
  const { x0, x1, z0, z1, r } = LOOP;
  const route = [];
  const J = (x, z) => route.push({ x, z, j: true });
  const P = (pts) => pts.forEach(([x, z]) => route.push({ x, z, j: false }));
  J(0, z1);
  P(arc(x0 + r, z1 - r, r, 0, -Math.PI / 2));
  for (const z of CROSS) J(x0, z);
  P(arc(x0 + r, z0 + r, r, -Math.PI / 2, -Math.PI));
  J(-80, z0);
  J(0, z0);
  J(80, z0);
  P(arc(x1 - r, z0 + r, r, Math.PI, Math.PI / 2));
  for (const z of [...CROSS].reverse()) J(x1, z);
  P(arc(x1 - r, z1 - r, r, Math.PI / 2, 0));
  route.push({ ...route[0] }); // close
  let prev = null,
    pts = [];
  for (const st of route) {
    if (!st.j) {
      pts.push([st.x, st.z]);
      continue;
    }
    const id = net.at(st.x, st.z);
    if (prev !== null) net.edge(prev, id, { cls: 'street', name: 'Maple Loop', pts });
    prev = id;
    pts = [];
  }
  // entrance road
  net.edge(aEnt, net.at(0, z1), { cls: 'street', name: 'Maple Loop Rd', w: 11 });
  // Elm St (north-south through the middle) and the cross streets
  const elm = [z1, ...CROSS, z0].map((z) => net.at(0, z));
  for (let k = 0; k < elm.length - 1; k++) net.edge(elm[k], elm[k + 1], { cls: 'street', name: 'Elm St' });
  const crossNames = ['Aspen St', 'Birch St', 'Cedar St'];
  CROSS.forEach((z, k) => {
    net.edge(net.at(x0, z), net.at(0, z), { cls: 'street', name: crossNames[k] });
    net.edge(net.at(0, z), net.at(x1, z), { cls: 'street', name: crossNames[k] });
  });
  // courts with turning circles
  for (const c of COURTS) {
    const a = net.at(c.from[0], c.from[1]);
    const b = net.node(c.to[0], c.to[1], { bulb: BULB });
    net.edge(a, b, { cls: 'street', name: c.name });
  }
  // Old Mill Rd leaves north into the countryside
  net.edge(net.at(0, z0), net.node(0, -S - 60, { exit: true }), { cls: 'street', name: 'Old Mill Rd' });
  return net.build();
}

export const net = buildNet();

export const env = {
  sky: [
    [0, 'sky'],
    [0.62, '#A9DDF8'],
    [1, 'butter'],
  ],
  fog: { near: 160, far: 420, k: 70, color: '#D9EEF0' },
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: 3000, d: 3000, y: -0.12, pattern: 'lawn', a: 'leaf', b: '#47B064', cell: 14 },
    { x: 0, z: 0, w: 2 * S + 120, d: 2 * S + 120, y: -0.08, pattern: 'lawn', a: 'lime', b: '#8DCE47', cell: 5 },
  ],
  streets: (b) => paintNetwork(b, net),
  blocks: [
    { min: [-S - 10, -1, -S - 10], max: [S + 10, 600, -S], visible: false },
    { min: [-S - 10, -1, S], max: [S + 10, 600, S + 10], visible: false },
    { min: [-S - 10, -1, -S], max: [-S, 600, S], visible: false },
    { min: [S, -1, -S], max: [S + 10, 600, S], visible: false },
  ],
};

// a giant Madame Prudence peers over the end of Old Mill Rd
env.decor = [{ id: 'char__prudence', x: 30, y: 0, z: -300, yaw: 0.15, scale: 22, size: 60 }];

export const bounds = { minX: -S, maxX: S, minZ: -S, maxZ: S };
export const spawn = { x: 0, z: 172, yaw: Math.PI };

const inRect = (R, x, z) => x > R.minX && x < R.maxX && z > R.minZ && z < R.maxZ;

export function layout(lib, seed = 404) {
  const L = new Layout(lib, seed, { minX: -S + 1, maxX: S - 1, minZ: -S + 1, maxZ: S - 1 });
  const rand = L.rand;
  const occ = new Occupancy(16);
  occupyNetwork(occ, net);
  L.clear(spawn.x, spawn.z, 6);
  const fences = new Set();
  const reserved = [PARK, SCHOOL, { minX: -S, maxX: S, minZ: ART_Z - 20, maxZ: S }];
  const ctx = { L, occ, fences, rand, lib, paint: L.paint };

  // ---- lots on every residential frontage
  // cross streets first so corner lots face them (as subdivisions are platted), then Elm, the loop, courts
  const prio = (f) => ({ 'Aspen St': 0, 'Birch St': 0, 'Cedar St': 0, 'Elm St': 1, 'Maple Loop': 2 })[net.edges[f.e].name] ?? 3;
  const order = [...net.frontages].sort((a, b) => prio(a) - prio(b));
  for (const f of order) {
    const e = net.edges[f.e];
    if (e.cls === 'arterial') continue;
    if (e.name === 'Maple Loop Rd') continue;
    const len = f.L[f.L.length - 1];
    const W = 20;
    const n = Math.floor((len - 6) / W);
    if (n < 1) continue;
    const pad = (len - n * W) / 2;
    for (let k = 0; k < n; k++) {
      const fr = frameAt(f, pad + W * (k + 0.5));
      const [ix, iz] = local(fr, 0, -14);
      if (reserved.some((R) => inRect(R, ix, iz))) continue;
      const outer = Math.abs(ix) > LOOP.x1 + 4 || iz < LOOP.z0 - 4 || iz > LOOP.z1 + 4;
      suburbLot(ctx, fr, e, { W, D: outer ? 34 : 29, first: k === 0, last: k === n - 1 });
    }
  }
  // pie lots around each turning circle
  for (const c of COURTS) {
    const [cx, cz] = c.to;
    const back = Math.atan2(c.from[0] - cx, c.from[1] - cz); // direction back up the court
    const e = net.edges.find((ed) => ed.name === c.name);
    const R = BULB + e.verge + e.walk;
    const span = Math.PI * 2 - 1.3;
    const lots = 4;
    for (let k = 0; k < lots; k++) {
      const a = back + 0.65 + (span * (k + 0.5)) / lots;
      const fr = { x: cx + Math.sin(a) * R, z: cz + Math.cos(a) * R, fx: -Math.sin(a), fz: -Math.cos(a), yaw: Math.atan2(-Math.sin(a), -Math.cos(a)) };
      suburbLot(ctx, fr, e, { W: 16, D: 30, pie: true, first: true, last: true });
    }
    L.put(pickId(L, ['street_tree', 'tree_round']), cx, cz, { scale: 1.15 });
  }

  maplePark(ctx);
  school(ctx);
  stripMall(ctx);

  // sound wall + trees along the back of the lots that face away from Maple Avenue
  const wallZ = ART_Z - (net.edges[0].w / 2 + net.edges[0].verge + net.edges[0].walk) - 0.6;
  fenceLine(L, pickId(L, ['privacy_fence', 'picket_fence']), -S, wallZ, -9, wallZ, { dedupe: fences, opts: { tint: 'sand' } });
  fenceLine(L, pickId(L, ['privacy_fence', 'picket_fence']), 9, wallZ, S, wallZ, { dedupe: fences, opts: { tint: 'sand' } });
  for (let x = -S + 8; x < S; x += 16) if (Math.abs(x) > 16) L.put(pickId(L, ['street_tree', 'tree_round']), x + L.range(-2, 2), wallZ - 3.5, { scale: L.range(0.9, 1.1) });
  // entrance monument + flower beds
  L.put('hedge', -9, ART_Z - 16, { yaw: Math.PI / 2 });
  L.put('hedge', 9, ART_Z - 16, { yaw: Math.PI / 2 });

  // ---- life: traffic, people, dogs, birds
  const life = (L.life = lifeSpec(net));
  trafficLights(L, life, net);
  stopSigns(L, net);
  const art = (l) => (net.edges[l.e].cls === 'arterial' ? 3 : 1);
  spawnTraffic(L, life, net, 46, [['car', 6], ['suv', 4], ['hatchback', 3], ['pickup_truck', 3], ['delivery_van', 1.5], ['mail_truck', 1], ['motorcycle', 1], ['police_car', 0.4], ['garbage_truck', 0.4], ['ice_cream_van', 0.4], ['school_bus', 0.3]], { laneWeight: art });
  spawnWalkers(L, life, net, 46, { dogs: 0.25, walkWeight: (w) => (net.edges[w.e].cls === 'arterial' ? 0.4 : 1) });
  if (ctx.park) {
    const { px, pz } = ctx.park;
    const ring = [];
    for (let k = 0; k < 24; k++) ring.push([px + Math.sin((k / 24) * Math.PI * 2) * 19.75, pz + Math.cos((k / 24) * Math.PI * 2) * 19.75]);
    spawnLoopWalkers(L, life, ring, 9);
    flock(L, life, px + 22, pz - 14, 7);
    flock(L, life, px - 4, pz + 24, 5);
  }
  flock(L, life, 50, SCHOOL.maxZ - 12, 6);
  flock(L, life, -60, ART_Z + 30, 6);
  flock(L, life, 40, ART_Z + 24, 5);
  for (const d of ctx.yardDogs || []) {
    const { fr, W, z0, z1 } = d;
    const [x, z] = local(fr, 0, (z0 + z1) / 2);
    life.grazers.push({ it: d.it, cx: x, cz: z, yaw: fr.yaw, hw: W / 2 - 1.2, hd: Math.max(1, (z0 - z1) / 2 - 1), speed: 1.4, still: 0.5 });
  }

  // woods filling the land beyond the back fences, to the map edge
  woods(ctx, { minX: -S, maxX: S, minZ: -S, maxZ: S }, { count: 700, ids: ['pine_tree', 'tree_round', 'pine_tree', 'bush'], minRoadDist: 48, net });
  // a few big old trees left standing in the gaps between lots
  woods(ctx, { minX: -S, maxX: S, minZ: -S, maxZ: S }, { count: 60, ids: ['tree_round'], scale: [0.9, 1.2], minRoadDist: 14, net });
  return L;
}

// ------------------------------------------------------------------ special blocks
function maplePark(ctx) {
  const { L, occ, paint } = ctx;
  const P = PARK;
  const cx = (P.minX + P.maxX) / 2,
    cz = (P.minZ + P.maxZ) / 2;
  // pond, loop path, playground, picnic lawn
  const px = cx - 25,
    pz = cz - 2;
  paint.push((b) => {
    b.disc(px, pz, 17, SK.water, { C: ['teal', 'sky'], segs: 40 });
    b.disc(px, pz, 21, SK.path, { r0: 18.5, P: [1.25], C: ['sand', 'caramel'], radialUV: true, segs: 48 });
    // spokes to the street sidewalks
    b.rect(px, pz + 31, 2.5, 20, 0, SK.path, { P: [1.25], C: ['sand', 'caramel'] });
    b.rect(px + 32, pz, 2.5, 22, Math.PI / 2, SK.path, { P: [1.25], C: ['sand', 'caramel'] });
    b.rect(cx + 40, cz + 6, 22, 16, 0, SK.plaza, { P: [1.0], C: ['sand', 'butter', 'caramel'] }); // playground mulch
  });
  occ.add({ x: px, z: pz, hw: 22, hd: 22, yaw: 0 }, 'park');
  L.put('playground_slide', cx + 36, cz + 4, { yaw: 0.3 });
  L.put('swing_set', cx + 45, cz + 9, { yaw: 0 });
  L.put('trampoline', cx + 44, cz - 1);
  for (const [dx, dz, yaw] of [[-2, 25, Math.PI], [12, 18, -2.4], [-18, -20, 0.6], [24, -12, -1.2], [-34, 8, 1.4]])
    L.put('park_bench', px + dx, pz + dz, { yaw });
  for (const [dx, dz] of [[36, -20], [46, -22], [56, -20]]) L.put('picnic_table', cx + dx, cz + dz, { yaw: 0.1 });
  L.put('lemonade_stand', cx + 30, cz + 22, { yaw: Math.PI });
  for (let k = 0; k < 26; k++) {
    const x = L.range(P.minX + 12, P.maxX - 12),
      z = L.range(P.minZ + 12, P.maxZ - 12);
    if (Math.hypot(x - px, z - pz) < 26 || (x > cx + 26 && x < cx + 60 && z > cz - 28 && z < cz + 18)) continue;
    L.put(L.rand() < 0.6 ? 'tree_round' : 'pine_tree', x, z, { scale: L.range(0.8, 1.15) });
  }
  ctx.park = { px, pz, P };
}

function school(ctx) {
  const { L, occ, paint } = ctx;
  const P = SCHOOL;
  const id = pickId(L, ['school_building', 'apartment_block']);
  // front on Cedar St (south edge of the block), facing +z
  const frontZ = P.maxZ - 8.8 - 6;
  const t = L.lib.byId.get(id);
  const bx = 45,
    bz = frontZ - t.dims[2] / 2;
  L.put(id, bx, bz, { yaw: 0 });
  occ.add({ x: bx, z: bz, hw: t.dims[0] / 2, hd: t.dims[2] / 2, yaw: 0 }, 'bld');
  L.put(pickId(L, ['flagpole', 'street_lamp']), bx - 8, frontZ + 3);
  // parking lot east of the school, a plaza at the door, a basketball court out back
  const lot = { x: 118, z: P.maxZ - 32, w: 34, d: 40 };
  parkingLot(ctx, lot.x, lot.z, lot.w, lot.d, 0, { fill: 0.55 });
  paint.push((b) => {
    b.rect(bx, frontZ + 2.5, 30, 5, 0, SK.plaza, { P: [1.2], C: ['concrete', 'cloud', 'stone'] });
    court(b, SK, 20, P.minZ + 22, 26, 16, 0, 'cobalt');
  });
  // the buses wait at the kerb on Cedar St's north side
  for (const x of [80, 96]) L.put('school_bus', x, P.maxZ - 8.8 - 2, { yaw: L.along('school_bus', Math.PI / 2) });
  L.put('basketball_hoop', 20 - 12, P.minZ + 22, { yaw: Math.PI / 2 });
  L.put('basketball_hoop', 20 + 12, P.minZ + 22, { yaw: -Math.PI / 2 });
  L.put('playground_slide', 70, P.minZ + 20, { yaw: 0 });
  L.put('swing_set', 82, P.minZ + 22, { yaw: 0 });
  for (let k = 0; k < 6; k++) L.put('tree_round', P.minX + 10 + k * 26, P.minZ + 7, { scale: 0.9 });
  occ.add({ x: (P.minX + P.maxX) / 2, z: (P.minZ + P.maxZ) / 2, hw: 75, hd: 32, yaw: 0 }, 'school');
}

function stripMall(ctx) {
  const { L, occ, paint } = ctx;
  const art = net.edges[0];
  const prop = ART_Z + art.w / 2 + art.verge + art.walk; // south property line of Maple Avenue
  const mid = pickId(L, ['strip_mall', 'shop_a']);
  const t = L.lib.byId.get(mid);
  const mz = prop + 13 + t.dims[2] / 2;
  L.put(mid, -70, mz, { yaw: Math.PI });
  if (mid !== 'strip_mall') for (const dx of [-24, 24]) L.put('shop_b', -70 + dx, mz, { yaw: Math.PI });
  L.put('petrol_station', 120, prop + 4 + 15 / 2 + 6, { yaw: Math.PI });
  L.put('cafe', 40, prop + 13 + 5.4, { yaw: Math.PI });
  L.put('bakery', 12, prop + 13 + 4.7, { yaw: Math.PI });
  // parking in front of the shops (stalls run across the lot, cars nose towards the shop fronts)
  parkingLot(ctx, -70, prop + 6.5, 13, 76, Math.PI / 2, { fill: 0.6 });
  parkingLot(ctx, 26, prop + 6.5, 13, 46, Math.PI / 2, { fill: 0.5 });
  paint.push((b) => b.rect(120, prop + 13, 36, 26, 0, SK.asphalt, { C: ['charcoal'] }));
  occ.add({ x: 0, z: (prop + S) / 2, hw: S, hd: (S - prop) / 2, yaw: 0 }, 'mall');
}

// review views (tests/city_review.mjs)
export const review = {
  play: [
    { name: 'entrance', x: 0, z: 168, yaw: Math.PI },
    { name: 'elm_aspen', x: -6, z: 72, yaw: Math.PI },
    { name: 'court', x: -168, z: 55, yaw: -Math.PI / 2 },
    { name: 'loop_corner', x: -128, z: 112, yaw: -Math.PI * 0.75, d: 14 },
    { name: 'school', x: 60, z: -86, yaw: Math.PI, d: 24 },
    { name: 'mall', x: -40, z: 196, yaw: Math.PI / 2, d: 30 },
  ],
  aerial: [
    { name: 'south', pos: [40, 140, 330], look: [0, 0, 60] },
    { name: 'west', pos: [-330, 160, -40], look: [-90, 0, -20] },
    { name: 'court', pos: [-150, 60, 120], look: [-185, 0, 55] },
  ],
  map: { cx: 0, cz: 0, half: 250 },
  motion: [{ name: 'elm_birch', pos: [30, 40, 20], look: [0, 0, -20] }],
};
