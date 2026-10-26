// Level 4 — Cul-de-Sac: Maple Loop, a 1990s subdivision off Maple Avenue (CITY.md §2).
// Platted the way subdivisions were: one signalised entrance off the arterial (plus a secondary
// right-in), an elliptical collector loop, curvilinear local streets inside it (Aspen Way crescent,
// the Birch Circle lollipop, Cedar Court), and five cul-de-sac courts radiating out with pie lots round
// their bulbs. No through route. A greenbelt park with an irregular pond inside the loop, the elementary
// school on its own drive off Maple Avenue, a strip mall and gas station across the arterial, woods
// and fields beyond the back fences.
import { Layout } from './layout.js';
import { Network } from './city/network.js';
import { paintNetwork } from './city/surface.js';
import { Occupancy, occupyNetwork, frameAt, local, fenceLine } from './city/frontage.js';
import { SK } from '../render/streets.js';
import { suburbLot, closeFences, pickId, woods, parkingLot, court, countryside } from './city/suburb.js';
import { lifeSpec, spawnTraffic, spawnWalkers, spawnLoopWalkers, trafficLights, stopSigns, flock } from './city/lifespec.js';

const S = 240;
const ART_Z = 200;
const LOOP = { cx: 0, cz: -25, rx: 165, rz: 140 };
const BULB = 13;
const loopPt = (t) => [LOOP.cx + LOOP.rx * Math.sin(t), LOOP.cz + LOOP.rz * Math.cos(t)];
const loopOut = (t) => {
  const nx = Math.sin(t) / LOOP.rx,
    nz = Math.cos(t) / LOOP.rz;
  const l = Math.hypot(nx, nz);
  return [nx / l, nz / l];
};
// loop junctions (parameter t, 0 = south, increasing towards the east)
const T = { entrance: 0, birch: 0.27 * Math.PI, oak: 0.5 * Math.PI, aspenE: 0.63 * Math.PI, spruce: 0.79 * Math.PI, pine: Math.PI, hazel: 1.21 * Math.PI, aspenW: 1.37 * Math.PI, willow: 1.5 * Math.PI, cedar: 1.7 * Math.PI, willowRd: 1.86 * Math.PI };
// each court its own length and a bend, so they don't stick out like the hours on a clock
const COURTS = [
  { name: 'Oak Court', t: T.oak, stub: 34, bend: 0.35 },
  { name: 'Spruce Court', t: T.spruce, stub: 60, bend: -0.25 },
  { name: 'Pine Court', t: T.pine, stub: 40, bend: 0.5 },
  { name: 'Hazel Court', t: T.hazel, stub: 64, bend: 0.3 },
  { name: 'Willow Court', t: T.willow, stub: 46, bend: -0.45 },
];
const BIRCH = { cx: 52, cz: 28, r: 30 };
const CEDAR = { x: -62, z: 36 };
const PARK = { cx: 0, cz: -108, rx: 70, rz: 30 };
const SCHOOL = { x: 150, z: 152, bulb: 15 };

function curve(a, c, b, n = 16) {
  const out = [];
  for (let k = 1; k < n; k++) {
    const t = k / n,
      u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

function buildNet() {
  const net = new Network({ crosswalks: 'signals' });
  const N = (x, z, o) => net.at(x, z, 0.5, o);
  // Maple Avenue: through traffic in and out of the fog
  const artNodes = [[-S - 700, { exit: true }], [0, { signal: true }], [SCHOOL.x, {}], [S + 700, { exit: true }]];
  for (let k = 0; k < artNodes.length - 1; k++) net.edge(N(artNodes[k][0], ART_Z, artNodes[k][1]), N(artNodes[k + 1][0], ART_Z, artNodes[k + 1][1]), { cls: 'arterial', name: 'Maple Avenue' });
  // the collector loop through all its junctions
  const stops = Object.values(T).sort((a, b) => a - b);
  for (let k = 0; k < stops.length; k++) {
    const t0 = stops[k],
      t1 = k + 1 < stops.length ? stops[k + 1] : Math.PI * 2;
    const pts = [];
    const n = Math.max(2, Math.ceil(((t1 - t0) * 150) / 8));
    for (let j = 1; j < n; j++) pts.push(loopPt(t0 + ((t1 - t0) * j) / n));
    net.edge(N(...loopPt(t0)), N(...loopPt(t1 % (Math.PI * 2))), { cls: 'street', name: 'Maple Loop', w: 10, pts, draw: 2 });
  }
  // entrances
  // the one way in (Willow Road is only a footpath out to the avenue)
  net.edge(N(0, ART_Z), N(...loopPt(T.entrance)), { cls: 'street', name: 'Maple Loop Entrance', w: 12, draw: 3 });
  // Aspen Way: a crescent across the inside of the loop
  const aE = loopPt(T.aspenE),
    aW = loopPt(T.aspenW);
  const aMid = [0, -40];
  net.edge(N(...aE), N(...aMid), { cls: 'street', name: 'Aspen Way', pts: curve(aE, [90, -30], aMid, 10) });
  net.edge(N(...aMid), N(...aW), { cls: 'street', name: 'Aspen Way', pts: curve(aMid, [-90, -30], aW, 10) });
  // Birch Circle: a lollipop — stem in from the loop, a ring round a little green
  const bs = loopPt(T.birch);
  const ang = Math.atan2(bs[0] - BIRCH.cx, bs[1] - BIRCH.cz);
  const ringA = [BIRCH.cx + Math.sin(ang) * BIRCH.r, BIRCH.cz + Math.cos(ang) * BIRCH.r];
  const ringB = [BIRCH.cx - Math.sin(ang) * BIRCH.r, BIRCH.cz - Math.cos(ang) * BIRCH.r];
  net.edge(N(...bs), N(...ringA), { cls: 'street', name: 'Birch Circle' });
  const arcPts = (a0, a1) => {
    const p = [];
    for (let k = 1; k < 12; k++) {
      const a = a0 + ((a1 - a0) * k) / 12;
      p.push([BIRCH.cx + Math.sin(a) * BIRCH.r, BIRCH.cz + Math.cos(a) * BIRCH.r]);
    }
    return p;
  };
  net.edge(N(...ringA), N(...ringB), { cls: 'street', name: 'Birch Circle', pts: arcPts(ang, ang + Math.PI) });
  net.edge(N(...ringB), N(...ringA), { cls: 'street', name: 'Birch Circle', pts: arcPts(ang + Math.PI, ang + 2 * Math.PI) });
  // Cedar Court: an inward court off the south-west of the loop
  net.edge(N(...loopPt(T.cedar)), N(CEDAR.x, CEDAR.z, { bulb: BULB }), { cls: 'street', name: 'Cedar Court' });
  // the outward courts
  for (const c of COURTS) {
    const p = loopPt(c.t),
      n = loopOut(c.t);
    const tx = -n[1],
      tz = n[0]; // along the loop
    const end = [p[0] + n[0] * c.stub + tx * c.stub * c.bend, p[1] + n[1] * c.stub + tz * c.stub * c.bend];
    const mid = [p[0] + n[0] * c.stub * 0.55, p[1] + n[1] * c.stub * 0.55];
    net.edge(N(...p), N(...end, { bulb: BULB }), { cls: 'street', name: c.name, pts: curve(p, mid, end, 8) });
  }
  // School Drive: off Maple Avenue to the bus loop in front of the school
  net.edge(N(SCHOOL.x, ART_Z), N(SCHOOL.x, ART_Z - 48, { bulb: SCHOOL.bulb }), { cls: 'street', name: 'School Drive', w: 10 });
  return net.build();
}

export const net = buildNet();

function pondShape(cx, cz, rx, rz, seed = 3) {
  const pts = [];
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const w = 1 + 0.12 * Math.sin(a * 3 + seed) + 0.07 * Math.sin(a * 5 + seed * 2);
    pts.push([cx + Math.sin(a) * rx * w, cz + Math.cos(a) * rz * w]);
  }
  return pts;
}

export const env = {
  sky: [
    [0, 'sky'],
    [0.6, '#A9DDF8'],
  ],
  fog: { near: 160, far: 420, k: 70, color: '#F4EFC8' },
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: 3000, d: 3000, y: -0.12, pattern: 'solid', a: '#97D649' },
    { x: 0, z: 0, w: 2 * S + 120, d: 2 * S + 120, y: -0.08, pattern: 'lawn', a: 'lime', b: '#94D348', cell: 5 },
  ],
  streets: (b) => paintNetwork(b, net),
  blocks: [
    { min: [-S - 10, -1, -S - 10], max: [S + 10, 600, -S], visible: false },
    { min: [-S - 10, -1, S], max: [S + 10, 600, S + 10], visible: false },
    { min: [-S - 10, -1, -S], max: [-S, 600, S], visible: false },
    { min: [S, -1, -S], max: [S + 10, 600, S], visible: false },
  ],
};


export const bounds = { minX: -S, maxX: S, minZ: -S, maxZ: S };
export const spawn = { x: 0, z: 172, yaw: Math.PI };

export function layout(lib, seed = 404) {
  const L = new Layout(lib, seed, { minX: -S + 1, maxX: S - 1, minZ: -S + 1, maxZ: S - 1 });
  const rand = L.rand;
  const occ = new Occupancy(16);
  occupyNetwork(occ, net);
  L.clear(spawn.x, spawn.z, 6);
  const fences = new Set();
  const ctx = { L, occ, fences, rand, lib, paint: L.paint };

  // reserved land: the park, the school campus, the commercial strip, the green inside Birch Circle
  occ.add({ x: PARK.cx, z: PARK.cz, hw: PARK.rx + 6, hd: PARK.rz + 6, yaw: 0 }, 'park');
  occ.add({ x: SCHOOL.x, z: ART_Z - 45, hw: 75, hd: 34, yaw: 0 }, 'school');
  occ.add({ x: 0, z: ART_Z + 26, hw: S, hd: 26, yaw: 0 }, 'mall');
  occ.add({ x: BIRCH.cx, z: BIRCH.cz, hw: BIRCH.r - 9, hd: BIRCH.r - 9, yaw: 0 }, 'green');
  // Willow Walk: a footpath from the loop out to the avenue's sidewalk (kept clear of lots)
  const willow = (() => {
    const [wx, wz] = loopPt(T.willowRd);
    const art = net.edges.find((e) => e.cls === 'arterial');
    const z1 = ART_Z - art.w / 2 - art.verge - art.walk;
    const z0 = wz + loopOut(T.willowRd)[1] * 9;
    occ.add({ x: wx, z: (z0 + z1) / 2, hw: 3, hd: (z1 - z0) / 2, yaw: 0 }, 'path');
    ctx.paint.push((b) => b.rect(wx, (z0 + z1) / 2, 2.4, z1 - z0, 0, SK.path, { P: [1.2], C: ['sand', 'caramel'] }));
    return [[wx, z0], [wx, z1], [wx + 0.8, z1], [wx + 0.8, z0]];
  })();

  // pie lots all the way round each turning circle, houses and driveways facing the bulb
  for (const n of net.nodes) {
    if (!n.bulb || n.bulb === SCHOOL.bulb) continue;
    const e = net.edges[n.arms[0].e];
    const R = n.bulb + e.verge + e.walk;
    const mouth = n.arms[0].ang;
    const gap = 0.75;
    const span = Math.PI * 2 - 2 * gap;
    const lots = 6;
    for (let k = 0; k < lots; k++) {
      const a = mouth + gap + (span * (k + 0.5)) / lots;
      const fr = { x: n.x + Math.sin(a) * R, z: n.z + Math.cos(a) * R, fx: -Math.sin(a), fz: -Math.cos(a), yaw: Math.atan2(-Math.sin(a), -Math.cos(a)) };
      suburbLot(ctx, fr, e, { W: 14, D: 30, pie: { cx: n.x, cz: n.z, a, half: span / lots / 2, R }, first: true, last: true });
    }
    (ctx.courts || (ctx.courts = [])).push({ x: n.x, z: n.z, r: n.bulb });
    // a basketball hoop at the kerb of most courts
    if (L.rand() < 0.6) {
      const a = mouth + Math.PI + L.range(-0.5, 0.5);
      L.put('basketball_hoop', n.x + Math.sin(a) * (R - e.walk - 0.6), n.z + Math.cos(a) * (R - e.walk - 0.6), { yaw: a + Math.PI });
    }
  }

  // ---- lots: courts first (their stubs), then the inner streets, then the loop
  const prio = (f) => {
    const n = net.edges[f.e].name;
    return n.endsWith('Court') ? 0 : n === 'Birch Circle' ? 1 : n === 'Aspen Way' ? 2 : n === 'Maple Loop' ? 3 : 4;
  };
  const order = [...net.frontages].sort((a, b) => prio(a) - prio(b));
  for (const f of order) {
    const e = net.edges[f.e];
    if (e.cls === 'arterial' || e.name === 'Maple Loop Entrance' || e.name === 'School Drive' || e.name === 'Willow Road') continue;
    const len = f.L[f.L.length - 1];
    const W = e.name === 'Birch Circle' ? 17 : 20;
    const n = Math.floor((len - 4) / W);
    if (n < 1) continue;
    const pad = (len - n * W) / 2;
    for (let k = 0; k < n; k++) {
      const fr = frameAt(f, pad + W * (k + 0.5));
      const [ix, iz] = local(fr, 0, -6);
      const outside = ((ix - LOOP.cx) / LOOP.rx) ** 2 + ((iz - LOOP.cz) / LOOP.rz) ** 2 > 1;
      suburbLot(ctx, fr, e, { W, D: outside ? 36 : 30, first: k === 0, last: k === n - 1 });
    }
  }
  closeFences(ctx);
  birchGreen(ctx);
  greenbelt(ctx);
  school(ctx);
  stripMall(ctx);

  // sound wall + trees along the back of the lots that face away from Maple Avenue
  const art = net.edges.find((e) => e.cls === 'arterial');
  const wallZ = ART_Z - (art.w / 2 + art.verge + art.walk) - 0.6;
  const gaps = [];
  for (const n of net.nodes) if (Math.abs(n.z - ART_Z) < 1 && n.deg >= 3) gaps.push(n.x);
  gaps.sort((a, b) => a - b);
  const wallSegs = [-S, ...gaps.flatMap((x) => [x - 9, x + 9]), S];
  for (let k = 0; k < wallSegs.length; k += 2) {
    fenceLine(L, pickId(L, ['privacy_fence', 'picket_fence']), wallSegs[k], wallZ, wallSegs[k + 1], wallZ, { dedupe: fences, opts: { tint: 'sand' } });
  }
  for (let x = -S + 8; x < S; x += 16) {
    if (gaps.some((g) => Math.abs(x - g) < 14)) continue;
    const r = { x, z: wallZ - 3.5, hw: 1.5, hd: 1.5, yaw: 0 };
    if (occ.hits(r)) continue;
    occ.add(r, 'tree');
    L.put(pickId(L, ['street_tree', 'tree_round']), x + L.range(-2, 2), wallZ - 3.5, { scale: L.range(0.9, 1.1) });
  }
  // the entrance drive: a double row of street trees and a lamp-lit sidewalk up to the loop
  {
    const z0 = loopPt(T.entrance)[1] + 22,
      z1 = ART_Z - 24;
    for (let z = z0; z < z1; z += 11)
      for (const sx of [-1, 1]) {
        const x = sx * 14.5;
        const r = { x, z, hw: 1.6, hd: 1.6, yaw: 0 };
        if (occ.hits(r, new Set(['lot']))) continue;
        occ.add(r, 'tree');
        L.put(pickId(L, ['street_tree', 'tree_round']), x, z, { scale: 1.05, tint: 'leaf' });
      }
  }
  // entrance: hedges and flags either side of the Maple Loop entrance
  for (const sx of [-1, 1]) {
    L.put('hedge', sx * 12, ART_Z - 15, { yaw: 0 });
    L.put('hedge', sx * 15, ART_Z - 15, { yaw: 0 });
    L.put(pickId(L, ['flagpole', 'street_lamp']), sx * 10, ART_Z - 17);
  }

  // ---- life: traffic, people, dogs, birds
  const life = (L.life = lifeSpec(net));
  trafficLights(L, life, net);
  stopSigns(L, net);
  const artW = (l) => (net.edges[l.e].cls === 'arterial' ? 1.2 : net.edges[l.e].name === 'Maple Loop' ? 3 : 1.4);
  spawnTraffic(L, life, net, 120, [['car', 6], ['suv', 4], ['hatchback', 3], ['pickup_truck', 3], ['delivery_van', 1.5], ['mail_truck', 1], ['motorcycle', 1], ['police_car', 0.4], ['garbage_truck', 0.4], ['ice_cream_van', 0.4], ['school_bus', 0.3]], { laneWeight: artW });
  spawnWalkers(L, life, net, 110, { dogs: 0.3, walkWeight: (w) => (net.edges[w.e].cls === 'arterial' ? 0.4 : net.edges[w.e].name.endsWith('Court') ? 2 : 1) });
  if (ctx.pondPath) spawnLoopWalkers(L, life, ctx.pondPath, 10);
  spawnLoopWalkers(L, life, willow, 3);
  if (ctx.park) {
    flock(L, life, ctx.park.x + 30, ctx.park.z - 6, 7);
    flock(L, life, ctx.park.x - 40, ctx.park.z + 10, 5);
  }
  flock(L, life, SCHOOL.x - 30, ART_Z - 30, 6);
  flock(L, life, -60, ART_Z + 30, 6);
  flock(L, life, 40, ART_Z + 24, 5);
  for (const d of ctx.yardDogs || []) {
    const { fr, W, z0, z1 } = d;
    const [x, z] = local(fr, 0, (z0 + z1) / 2);
    life.grazers.push({ it: d.it, cx: x, cz: z, yaw: fr.yaw, hw: W / 2 - 1.2, hd: Math.max(1, (z0 - z1) / 2 - 1), speed: 1.4, still: 0.5 });
  }
  // kids riding and running round the turning circles; a parent watching from a driveway
  for (const c of ctx.courts || []) {
    const ring = [];
    for (let k = 0; k < 16; k++) ring.push([c.x + Math.sin((k / 16) * Math.PI * 2) * (c.r - 2.2), c.z + Math.cos((k / 16) * Math.PI * 2) * (c.r - 2.2)]);
    spawnLoopWalkers(L, life, ring, 2 + Math.floor(L.rand() * 2), ['person_kid', 'person_kid', 'person_teen'], { speed: [1.6, 2.8], dogs: 0.2 });
    if (L.rand() < 0.5) L.put(pickId(L, ['bicycle', 'tricycle']), c.x + L.range(-3, 3), c.z + L.range(-3, 3), { yaw: L.range(0, 6.28) });
  }
  // kids playing in a few front yards
  for (const lot of (ctx.lots || []).filter(() => L.rand() < 0.12)) {
    const [x, z] = local(lot.fr, -lot.gx * 0.5, -lot.setback * 0.5);
    const it = L.put(pickId(L, ['person_kid', 'person_teen']), x, z);
    if (it) life.grazers.push({ it, cx: x, cz: z, yaw: lot.fr.yaw, hw: 4, hd: lot.setback * 0.35, speed: 1.6, still: 0.3 });
  }

  // farmland and woodlots round the subdivision, out to the horizon
  countryside(ctx, net, { inner: S, outer: S + 780, cell: 120, trees: 0.3, y: -0.1 });
  // woods beyond the back fences, to the map edge (and beyond, in the fog)
  woods(ctx, { minX: -S, maxX: S, minZ: -S, maxZ: S }, { count: 900, ids: ['pine_tree', 'tree_round', 'pine_tree', 'bush'], minRoadDist: 46, net });
  return L;
}

// ------------------------------------------------------------------ special places
function birchGreen(ctx) {
  const { L } = ctx;
  // the little green inside Birch Circle: lawn, an oak, a bench, a swing
  L.put('tree_round', BIRCH.cx, BIRCH.cz, { scale: 1.6 });
  L.put('park_bench', BIRCH.cx + 8, BIRCH.cz + 4, { yaw: -2 });
  L.put('swing_set', BIRCH.cx - 9, BIRCH.cz - 3, { yaw: 0.6 });
}

function greenbelt(ctx) {
  const { L, paint } = ctx;
  const P = PARK;
  const pond = pondShape(P.cx - 25, P.cz + 2, 26, 16);
  const path = pondShape(P.cx - 25, P.cz + 2, 34, 23, 5);
  paint.push((b) => {
    const pl = [...path, path[0]];
    const Lp = [0];
    for (let k = 1; k < pl.length; k++) Lp.push(Lp[k - 1] + Math.hypot(pl[k][0] - pl[k - 1][0], pl[k][1] - pl[k - 1][1]));
    b.strip(pl, Lp, -1.3, 1.3, 0, Lp[Lp.length - 1], SK.path, { P: [1.3], C: ['sand', 'caramel'], y: 0 });
    // sandy bank under the water (the water polygon sits on top of it)
    // fan both from the pond's centre (the outline isn't convex)
    const bank = pondShape(P.cx - 25, P.cz + 2, 29, 18.5);
    b.poly([[P.cx - 25, P.cz + 2], ...bank, bank[0]], SK.solid, { C: ['sand'], y: -0.04, origin: [P.cx - 25, P.cz + 2] });
    b.poly([[P.cx - 25, P.cz + 2], ...pond, pond[0]], SK.water, { C: ['teal', 'sky'], y: -0.02, origin: [P.cx - 25, P.cz + 2] });
    // path out to Aspen Way and a playground of mulch
    b.rect(P.cx - 25, P.cz + 34, 2.4, 22, 0, SK.path, { P: [1.2], C: ['sand', 'caramel'] });
    // the playground: a timber edging round a bed of bark mulch
    b.rect(P.cx + 50, P.cz + 2, 26, 18, 0, SK.solid, { C: ['cocoa'], y: -0.01 });
    b.rect(P.cx + 50, P.cz + 2, 24.6, 16.6, 0, SK.dirt, { C: ['caramel', 'cocoa'], y: 0 });
  });
  ctx.pondPath = path;
  L.put('playground_slide', P.cx + 44, P.cz + 0, { yaw: 0.3 });
  L.put('swing_set', P.cx + 56, P.cz + 6, { yaw: 0 });
  for (const [dx, dz, yaw] of [[-25, 25, Math.PI], [5, 14, -2.4], [-55, -10, 1.4], [-25, -24, 0]]) L.put('park_bench', P.cx + dx, P.cz + dz, { yaw });
  for (const [dx, dz] of [[60, -22], [72, -16]]) L.put('picnic_table', P.cx + dx, P.cz + dz, { yaw: 0.1 });
  for (let k = 0; k < 30; k++) {
    const x = P.cx + L.range(-P.rx, P.rx),
      z = P.cz + L.range(-P.rz, P.rz);
    if (Math.hypot((x - P.cx + 25) / 38, (z - P.cz - 2) / 27) < 1 || (x > P.cx + 34 && x < P.cx + 66 && z > P.cz - 10 && z < P.cz + 14)) continue;
    L.put(L.rand() < 0.65 ? 'tree_round' : 'pine_tree', x, z, { scale: L.range(0.85, 1.25) });
  }
  ctx.park = { x: P.cx, z: P.cz };
}

function school(ctx) {
  const { L, paint } = ctx;
  const id = pickId(L, ['school_building', 'apartment_block']);
  const t = L.lib.byId.get(id);
  // the school faces its bus loop (the School Drive bulb), parking beside it, courts beside that
  const bx = SCHOOL.x,
    bz = ART_Z - 48 - SCHOOL.bulb - 8 - t.dims[2] / 2;
  L.put(id, bx, bz, { yaw: 0 });
  L.put(pickId(L, ['flagpole', 'street_lamp']), bx - 10, bz + t.dims[2] / 2 + 4);
  parkingLot(ctx, bx - 52, ART_Z - 50, 22, 36, 0, { fill: 0.6 });
  paint.push((b) => {
    b.rect(bx, bz + t.dims[2] / 2 + 3, 26, 5, 0, SK.plaza, { P: [1.2], C: ['concrete', 'cloud', 'stone'] });
    court(b, SK, bx + 52, ART_Z - 50, 22, 15, 0, 'cobalt');
  });
  for (const dx of [-8, 8]) L.put('school_bus', bx + dx, ART_Z - 48 + 2, { yaw: L.along('school_bus', Math.PI / 2) });
  L.put('basketball_hoop', bx + 52 - 10, ART_Z - 50, { yaw: Math.PI / 2 });
  L.put('basketball_hoop', bx + 52 + 10, ART_Z - 50, { yaw: -Math.PI / 2 });
  L.put('playground_slide', bx + 40, bz - 10, { yaw: 0 });
  L.put('swing_set', bx + 52, bz - 8, { yaw: 0 });
}

function stripMall(ctx) {
  const { L, paint } = ctx;
  const art = net.edges.find((e) => e.cls === 'arterial');
  const prop = ART_Z + art.w / 2 + art.verge + art.walk; // south property line of Maple Avenue
  // along the arterial: a shopping centre (two strip-mall wings behind one shared lot), a diner pad, the
  // gas station on the corner by the entrance light, a coffee pad and a second strip — each lot with a curb cut
  const pads = [
    { id: pickId(L, ['strip_mall', 'shop_a']), x: -150, lot: 45 },
    { id: pickId(L, ['strip_mall', 'shop_b']), x: -105, lot: 45 },
    { id: pickId(L, ['diner', 'cafe']), x: -45, lot: 26 },
    { id: 'petrol_station', x: 38, lot: 0 },
    { id: 'cafe', x: 100, lot: 24 },
    { id: pickId(L, ['strip_mall', 'shop_b']), x: 175, lot: 48 },
  ];
  for (const p of pads) {
    const t = L.lib.byId.get(p.id);
    if (!t) continue;
    const z = prop + (p.lot ? 14 : 4) + t.dims[2] / 2;
    L.put(p.id, p.x, z, { yaw: Math.PI });
    if (p.lot) parkingLot(ctx, p.x, prop + 6.5, 13, p.lot, Math.PI / 2, { fill: 0.5, tints: ['paper', 'cloud', 'stone', 'charcoal', 'slate', 'cocoa', 'tomato', 'sky'] });
    // curb cut: a driveway apron across the verge and sidewalk into the lot
    const apron = art.verge + art.walk;
    paint.push((b) => b.rect(p.x + (p.lot ? t.dims[0] / 2 - 2 : 0), prop - apron / 2, 6, apron, 0, SK.drive, { C: ['cloud', 'cloud', 'stone'], y: 0.01 }));
  }
}

// review views (tests/city_review.mjs)
export const review = {
  play: [
    { name: 'entrance', x: 0, z: 168, yaw: Math.PI },
    { name: 'loop', x: -60, z: 106, yaw: -Math.PI * 0.6 },
    { name: 'court', x: 205, z: -25, yaw: Math.PI / 2 },
    { name: 'birch', x: 100, z: 50, yaw: -Math.PI * 0.7, d: 14 },
    { name: 'park', x: 20, z: -60, yaw: Math.PI, d: 24 },
    { name: 'mall', x: -40, z: 196, yaw: Math.PI / 2, d: 30 },
  ],
  aerial: [
    { name: 'south', pos: [40, 160, 340], look: [0, 0, 40] },
    { name: 'west', pos: [-340, 170, -40], look: [-90, 0, -20] },
    { name: 'court', pos: [150, 70, 60], look: [200, 0, -25] },
  ],
  map: { cx: 0, cz: 0, half: 250 },
  motion: [
    { name: 'loop', pos: [-50, 38, 140], look: [-30, 0, 100] },
    { name: 'entrance_signal', pos: [45, 32, 232], look: [0, 0, 196] },
    { name: 'park', pos: [-20, 45, -50], look: [-25, 0, -110] },
  ],
};
