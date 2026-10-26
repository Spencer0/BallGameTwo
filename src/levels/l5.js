// Level 5 — Small Town: Puddleford, a Midwestern river town (CITY.md §2).
// Main Street of brick storefronts with angled parking runs north from the highway to the railroad depot;
// a town square (gazebo, fountain, church, town hall) sits beside it; a residential grid with big street
// trees fills the west side; the river meanders from the north edge into a lake in the south-east, crossed
// by the highway bridge, the Mill Road bridge and the rail bridge. East bank: the mill and its water
// wheel, a few streets of houses, the fairground; marina and lighthouse on the lake. Farms all round:
// fields in rows, fenced pastures, farmsteads, a combine at work, county roads.
import { Layout } from './layout.js';
import { Network } from './city/network.js';
import { paintNetwork } from './city/surface.js';
import { Occupancy, occupyNetwork, frameAt, local, fillFrontage, fenceLine } from './city/frontage.js';
import { SK } from '../render/streets.js';
import { suburbLot, pickId, woods, parkingLot, court } from './city/suburb.js';
import { lifeSpec, spawnTraffic, spawnWalkers, spawnLoopWalkers, trafficLights, stopSigns, flock } from './city/lifespec.js';

const S = 750;
const MAIN_X = -150;
const MAIN_Z = [-430, -300, -170, -40, 90, 220, 330]; // cross streets on Main (330 = the highway)
const HWY_Z = 330;
const WEST_X = [-280, -400, -520]; // residential avenues west of Main
const SQUARE = { minX: -280, maxX: MAIN_X, minZ: -40, maxZ: 90 };
const RAIL_Z = -470; // the railroad's east-west run north of downtown
// the river: north edge -> lake (south-east)
const RIVER = [[-130, -800], [-115, -620], [-60, -480], [10, -340], [80, -200], [120, -60], [150, 80], [190, 210], [250, 330], [330, 420], [420, 470]];
const RIVER_W = 64;
const LAKE = { x: 520, z: 560, r: 300 };
const EAST_X = [260, 380, 500]; // east-bank streets
const FAIR = { minX: 380, maxX: 720, minZ: -720, maxZ: -470 };

/** x of the river centreline at z (piecewise linear) */
function riverX(z) {
  for (let k = 1; k < RIVER.length; k++) {
    const [ax, az] = RIVER[k - 1],
      [bx, bz] = RIVER[k];
    if (z >= az && z <= bz) return ax + ((z - az) / (bz - az)) * (bx - ax);
  }
  return RIVER[RIVER.length - 1][0];
}

function buildNet() {
  const net = new Network();
  const N = (x, z, o) => net.at(x, z, 0.5, o);
  // --- Route 9: through the town from the west edge to the east edge, bridge over the river
  const rx = riverX(HWY_Z);
  const riverRoadX = (z) => Math.max(riverX(z) + RIVER_W / 2 + 40, EAST_X[0] - 80);
  const hwy = [[-S - 80, HWY_Z, { exit: true }], [-640, HWY_Z], ...WEST_X.slice().reverse().map((x) => [x, HWY_Z]), [MAIN_X, HWY_Z], [120, HWY_Z], [rx - RIVER_W / 2 - 14, HWY_Z], [rx + RIVER_W / 2 + 14, HWY_Z], [riverRoadX(HWY_Z), HWY_Z], [S + 80, HWY_Z, { exit: true }]];
  // keep west avenues in order west->east
  hwy.sort((a, b) => a[0] - b[0]);
  const hn = hwy.map(([x, z, o]) => N(x, z, o));
  for (let k = 0; k < hn.length - 1; k++) {
    const A = net.nodes[hn[k]],
      B = net.nodes[hn[k + 1]];
    const bridge = A.x === rx - RIVER_W / 2 - 14;
    net.edge(hn[k], hn[k + 1], bridge ? { cls: 'arterial', name: 'Route 9 Bridge', walk: 0, verge: 0, y: 0.5, paint: false } : { cls: 'arterial', name: 'Route 9' });
  }
  // --- Main Street: from the highway north to Depot Square at the railroad
  const mn = MAIN_Z.slice().sort((a, b) => a - b).map((z) => N(MAIN_X, z));
  for (let k = 0; k < mn.length - 1; k++) net.edge(mn[k], mn[k + 1], { cls: 'main', name: 'Main Street' });
  // --- cross streets west of Main into the residential grid; east of Main to Water Street by the river
  for (const z of MAIN_Z.filter((z) => z !== HWY_Z)) {
    const xs = [MAIN_X, ...WEST_X];
    for (let k = 0; k < xs.length - 1; k++) net.edge(N(xs[k], z), N(xs[k + 1], z), { cls: 'street', name: 'Cross St' });
    // east: to Water St (runs along the riverbank)
    const wx = riverX(z) - RIVER_W / 2 - 40;
    if (wx > MAIN_X + 40) net.edge(N(MAIN_X, z), N(wx, z), { cls: 'street', name: 'Cross St' });
  }
  // Water Street along the west bank
  const water = MAIN_Z.filter((z) => z !== HWY_Z && riverX(z) - RIVER_W / 2 - 40 > MAIN_X + 40).map((z) => N(riverX(z) - RIVER_W / 2 - 40, z));
  for (let k = 0; k < water.length - 1; k++) net.edge(water[k], water[k + 1], { cls: 'street', name: 'Water St', verge: 0 });
  // residential avenues: from the highway north to the railroad
  for (const x of WEST_X) {
    const zs = [...MAIN_Z.filter((z) => z !== HWY_Z), HWY_Z].sort((a, b) => a - b);
    const nodes = zs.map((z) => N(x, z));
    for (let k = 0; k < nodes.length - 1; k++) net.edge(nodes[k], nodes[k + 1], { cls: 'street', name: 'Elm Ave' });
  }
  // --- Mill Road: north of downtown, west edge -> river bridge -> east bank -> fairground
  const mz = -560;
  const mrx = riverX(mz);
  const mill = [[-S - 80, mz, { exit: true }], [-640, mz], [-520, mz], [MAIN_X, mz], [mrx - RIVER_W / 2 - 14, mz], [mrx + RIVER_W / 2 + 14, mz], [riverRoadX(mz), mz], ...EAST_X.map((x) => [x, mz]), [S + 80, mz, { exit: true }]];
  mill.sort((a, b) => a[0] - b[0]);
  const mm = mill.map(([x, z, o]) => N(x, z, o));
  for (let k = 0; k < mm.length - 1; k++) {
    const A = net.nodes[mm[k]];
    const bridge = A.x === mrx - RIVER_W / 2 - 14;
    net.edge(mm[k], mm[k + 1], bridge ? { cls: 'street', name: 'Mill Road Bridge', walk: 0, verge: 0, y: 0.5, paint: false } : { cls: 'street', name: 'Mill Road', verge: 0, walk: bridge ? 0 : 2 });
  }
  // Main St continues north over the tracks to Mill Road; west avenues too
  net.edge(N(MAIN_X, -430), N(MAIN_X, mz), { cls: 'street', name: 'Depot St' });
  net.edge(N(-520, -430), N(-520, mz), { cls: 'street', name: 'Elm Ave' });
  // --- east bank: River Road along the bank from Mill Road down to the highway; a little grid
  const eb = [];
  for (let z = mz; z <= HWY_Z; z += 130) eb.push(z);
  if (eb[eb.length - 1] !== HWY_Z) eb.push(HWY_Z);
  const rr = eb.map((z) => N(riverRoadX(z), z));
  // the highway east of the bridge passes River Road: split it
  for (let k = 0; k < rr.length - 1; k++) net.edge(rr[k], rr[k + 1], { cls: 'street', name: 'River Road', verge: 0 });
  for (const z of eb.slice(1, -1)) {
    const nodes = [N(riverRoadX(z), z), ...EAST_X.filter((x) => x > riverX(z) + RIVER_W / 2 + 60).map((x) => N(x, z))];
    for (let k = 0; k < nodes.length - 1; k++) net.edge(nodes[k], nodes[k + 1], { cls: 'street', name: 'Bank St' });
  }
  for (const x of EAST_X) {
    const zs = eb.filter((z) => x > riverX(z) + RIVER_W / 2 + 60 && z < HWY_Z && x !== riverRoadX(z));
    const nodes = zs.map((z) => N(x, z));
    for (let k = 0; k < nodes.length - 1; k++) net.edge(nodes[k], nodes[k + 1], { cls: 'street', name: 'East Ave' });
  }
  // --- county roads through the farms (narrow, no sidewalks)
  const lane = { cls: 'lane', name: 'County Road', w: 7 };
  net.edge(N(-640, -S - 80, { exit: true }), N(-640, mz), lane);
  net.edge(N(-640, mz), N(-640, HWY_Z), lane);
  net.edge(N(-640, HWY_Z), N(-640, 560), lane);
  net.edge(N(-640, 560), N(-640, S + 80, { exit: true }), lane);
  net.edge(N(-640, 560), N(120, 560, { bulb: 0 }), { ...lane, name: 'Lake Road' });
  net.edge(N(120, 560), N(120, HWY_Z), { ...lane, name: 'Lake Road' });
  // the railroad: west edge -> depot -> rail bridge -> east edge (its own edges; never joined to roads)
  const rails = [[-S - 120, RAIL_Z], [riverX(RAIL_Z) - RIVER_W / 2 - 10, RAIL_Z], [riverX(RAIL_Z) + RIVER_W / 2 + 10, RAIL_Z], [S + 120, RAIL_Z]];
  const rn = rails.map(([x, z], k) => net.node(x, z, { exit: true, rail: true }));
  for (let k = 0; k < rn.length - 1; k++) net.edge(rn[k], rn[k + 1], { cls: 'rail', name: 'Railroad', w: 4, traffic: false, sidewalks: 'none', paint: k !== 1 });
  return net.build();
}

export const net = buildNet();

function riverPoly() {
  const pts = [...RIVER, [LAKE.x - 40, LAKE.z - 60]];
  const L = [0];
  for (let k = 1; k < pts.length; k++) L.push(L[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  return { pts, L };
}

export const env = {
  sky: [
    [0, 'tangerine'],
    [0.55, '#FFC27A'],
    [1, 'butter'],
  ],
  fog: { near: 320, far: 900, k: 75, color: '#FFE0A8' },
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: 6000, d: 6000, y: -0.5, pattern: 'lawn', a: 'leaf', b: '#47B064', cell: 40 },
    { x: 0, z: 0, w: 2 * S + 200, d: 2 * S + 200, y: -0.45, pattern: 'lawn', a: 'lime', b: '#8DCE47', cell: 9 },
  ],
  streets: (b) => {
    const r = riverPoly();
    b.strip(r.pts, r.L, -RIVER_W / 2, RIVER_W / 2, 0, r.L[r.L.length - 1], SK.water, { C: ['teal', '#4FCBBE'], y: -0.25 });
    b.disc(LAKE.x, LAKE.z, LAKE.r, SK.water, { C: ['teal', '#4FCBBE'], y: -0.25, segs: 64 });
    paintNetwork(b, net);
  },
  blocks: [
    { min: [-S - 20, -5, -S - 20], max: [S + 20, 2000, -S], visible: false },
    { min: [-S - 20, -5, S], max: [S + 20, 2000, S + 20], visible: false },
    { min: [-S - 20, -5, -S], max: [-S, 2000, S], visible: false },
    { min: [S, -5, -S], max: [S + 20, 2000, S], visible: false },
  ],
};

// Madame Prudence, town-sized, on the horizon
env.decor = [{ id: 'char__prudence', x: -920, y: 0, z: -520, yaw: 1.05, scale: 80, size: 220 }];

export const bounds = { minX: -S, maxX: S, minZ: -S, maxZ: S };
export const spawn = { x: MAIN_X - 4, z: 160, yaw: Math.PI };

const STORES = ['storefront_a', 'storefront_b', 'storefront_c', 'storefront_a', 'storefront_b', 'storefront_c', 'shop_a', 'cafe', 'bakery'];

export function layout(lib, seed = 505) {
  const L = new Layout(lib, seed, { minX: -S + 2, maxX: S - 2, minZ: -S + 2, maxZ: S - 2 });
  L.setCell(20);
  const occ = new Occupancy(24);
  occupyNetwork(occ, net, 0.2);
  L.clear(spawn.x, spawn.z, 10);
  occ.add({ x: spawn.x, z: spawn.z, hw: 6, hd: 6, yaw: 0 }, 'spawn');
  // the river and lake are no-build zones
  const rv = riverPoly();
  for (let k = 1; k < rv.pts.length; k++) {
    const [ax, az] = rv.pts[k - 1],
      [bx, bz] = rv.pts[k];
    occ.add({ x: (ax + bx) / 2, z: (az + bz) / 2, hw: RIVER_W / 2 + 8, hd: Math.hypot(bx - ax, bz - az) / 2 + 10, yaw: Math.atan2(bx - ax, bz - az) }, 'water');
  }
  occ.add({ x: LAKE.x, z: LAKE.z, hw: LAKE.r * 0.95, hd: LAKE.r * 0.95, yaw: Math.PI / 4 }, 'water');
  occ.add({ x: LAKE.x, z: LAKE.z, hw: LAKE.r * 0.95, hd: LAKE.r * 0.95, yaw: 0 }, 'water');
  const ctx = { L, occ, paint: L.paint, rand: L.rand, lib, fences: new Set() };
  const life = (L.life = lifeSpec(net));
  const avail = (ids) => ids.filter((id) => lib.byId.has(id));

  townSquare(ctx, life);
  depot(ctx, life);

  // ---- Main Street: continuous storefronts both sides, angled parking full of cars
  const stores = avail(STORES);
  for (const f of net.frontages) {
    const e = net.edges[f.e];
    if (e.name !== 'Main Street') continue;
    fillFrontage(L, occ, f, {
      pick: (rem) => {
        const fit = stores.filter((id) => lib.byId.get(id).dims[0] <= rem + 0.3);
        return fit.length ? L.pick(fit) : null;
      },
      setback: 0.2,
      gap: () => 0.15,
      step: 3,
    });
  }
  angledParking(ctx);
  // the first half-block of each cross street off Main is commercial too
  for (const f of net.frontages) {
    const e = net.edges[f.e];
    if (e.name !== 'Cross St') continue;
    const A = net.nodes[e.a],
      B = net.nodes[e.b];
    if (A.x !== MAIN_X && B.x !== MAIN_X) continue;
    const fromMain = A.x === MAIN_X;
    const len = f.L[f.L.length - 1];
    fillFrontage(L, occ, f, { pick: (rem) => L.pick(stores.filter((id) => lib.byId.get(id).dims[0] <= rem + 0.3)) || null, setback: 0.2, gap: () => 0.2, s0: fromMain ? 0 : len - 50, s1: fromMain ? 50 : len, step: 3 });
  }

  // ---- houses on the residential frontages
  for (const f of net.frontages) {
    const e = net.edges[f.e];
    if (!['Cross St', 'Elm Ave', 'Bank St', 'East Ave', 'Water St', 'River Road', 'Depot St'].includes(e.name)) continue;
    const len = f.L[f.L.length - 1];
    const W = 24;
    const n = Math.floor((len - 4) / W);
    for (let k = 0; k < n; k++) {
      const fr = frameAt(f, (len - n * W) / 2 + W * (k + 0.5));
      suburbLot(ctx, fr, e, { W, D: 40, first: k === 0, last: k === n - 1 });
    }
  }

  highwayStrip(ctx, life);
  eastBank(ctx, life);
  farms(ctx, life);

  // ---- street furniture: lamps on Main, trees on residential streets are part of the lots
  for (const e of net.edges) {
    if (e.name !== 'Main Street') continue;
    for (let s = 12; s < e.len - 12; s += 24)
      for (const side of [1, -1]) {
        const q = { x: 0, z: 0 };
        const k = 1;
        const dx = (e.poly[1][0] - e.poly[0][0]) / e.len,
          dz = (e.poly[1][1] - e.poly[0][1]) / e.len;
        const off = side * (e.w / 2 + 0.9);
        L.put(pickId(L, ['town_lamp', 'street_lamp']), e.poly[0][0] + dx * s - dz * off, e.poly[0][1] + dz * s + dx * off, { yaw: Math.atan2(-dz * side, dx * side) });
        if (L.rand() < 0.3) L.put(pickId(L, ['planter', 'bush']), e.poly[0][0] + dx * (s + 6) - dz * off, e.poly[0][1] + dz * (s + 6) + dx * off, { scale: 0.6 });
      }
  }

  // ---- life
  trafficLights(L, life, net, { id: pickId(L, ['signal_post', 'traffic_light']) });
  stopSigns(L, net);
  const laneW = (l) => {
    const e = net.edges[l.e];
    return e.cls === 'arterial' ? 3 : e.cls === 'main' ? 2 : e.cls === 'lane' ? 0.5 : 1;
  };
  spawnTraffic(L, life, net, 110, [['car', 6], ['suv', 4], ['hatchback', 3], ['pickup_truck', 5], ['delivery_van', 1.5], ['mail_truck', 0.6], ['tractor', 0.8], ['school_bus', 0.4], ['city_bus', 0.4], ['police_car', 0.3], ['motorcycle', 0.8], ['garbage_truck', 0.3]], { laneWeight: laneW });
  spawnWalkers(L, life, net, 130, { dogs: 0.18, walkWeight: (w) => (net.edges[w.e].cls === 'main' ? 5 : net.edges[w.e].name === 'Cross St' ? 1.2 : 0.6) });
  // the train: locomotive + cars along the railroad, out of the fog and back
  const railE = net.edges.filter((e) => e.cls === 'rail');
  const route = [];
  for (const e of railE) for (const p of e.poly) if (!route.length || Math.hypot(route[route.length - 1][0] - p[0], route[route.length - 1][1] - p[1]) > 0.1) route.push([p[0], p[1]]);
  const back = route.slice().reverse().map(([x, z]) => [x, z + 0.01]);
  const consist = ['locomotive', 'freight_car', 'hopper_car', 'freight_car', 'tank_car', 'freight_car', 'caboose'].map((id) => pickId(L, [id, 'train_carriage']));
  const its = [],
    offs = [];
  let o = 0;
  for (const id of consist) {
    const t = lib.byId.get(id);
    if (!t) continue;
    its.push(L.put(id, route[0][0], route[0][1]));
    offs.push(o + t.dims[0] / 2);
    o += t.dims[0] + 0.6;
  }
  life.movers.push({ its, offs, route: [...route, ...back], speed: 13, loop: true, kind: 'train' });
  return L;
}

// ------------------------------------------------------------------ districts
function townSquare(ctx, life) {
  const { L, occ, paint } = ctx;
  const Q = SQUARE;
  const cx = (Q.minX + Q.maxX) / 2,
    cz = (Q.minZ + Q.maxZ) / 2;
  // the green inside the square's sidewalks, with diagonal paths to the fountain
  const inset = 11;
  const w = Q.maxX - Q.minX - 2 * inset,
    d = Q.maxZ - Q.minZ - 2 * inset;
  occ.add({ x: cx, z: cz, hw: w / 2, hd: d / 2, yaw: 0 }, 'square');
  paint.push((b) => {
    b.disc(cx, cz, 14, SK.plaza, { C: ['concrete', 'sand', 'stone'], P: [1.5] });
    for (const a of [0.785, 2.356, 3.927, 5.498]) {
      const r0 = 14,
        r1 = Math.hypot(w, d) / 2;
      const mx = cx + (Math.sin(a) * (r0 + r1)) / 2,
        mz = cz + (Math.cos(a) * (r0 + r1)) / 2;
      b.rect(mx, mz, 3, r1 - r0 - 1, a, SK.path, { P: [1.5], C: ['sand', 'caramel'] });
    }
  });
  L.put('town_fountain', cx, cz);
  L.put('gazebo', cx + 32, cz - 30);
  L.put('statue', cx - 34, cz + 30, { yaw: 0.8 });
  for (const [dx, dz] of [[-30, -32], [30, 30], [-44, 6], [44, -4]]) L.put('tree_round', cx + dx, cz + dz, { scale: 1.5 });
  for (const a of [0.4, 1.9, 3.5, 5.1]) L.put('park_bench', cx + Math.sin(a) * 20, cz + Math.cos(a) * 20, { yaw: a + Math.PI });
  flock(L, life, cx + 6, cz + 18, 7);
  const ring = [];
  for (let k = 0; k < 20; k++) ring.push([cx + Math.sin((k / 20) * 6.283) * 20, cz + Math.cos((k / 20) * 6.283) * 20]);
  spawnLoopWalkers(L, life, ring, 8);
  // church facing the square from the west, town hall from the north
  const church = L.lib.byId.get('church');
  L.put('church', Q.minX - 12 - church.dims[2] / 2, cz, { yaw: Math.PI / 2 });
  occ.add({ x: Q.minX - 12 - church.dims[2] / 2, z: cz, hw: church.dims[0] / 2, hd: church.dims[2] / 2, yaw: Math.PI / 2 }, 'bld');
  const th = pickId(L, ['town_hall', 'clock_tower']);
  const tt = L.lib.byId.get(th);
  L.put(th, cx, Q.minZ - 12 - tt.dims[2] / 2, { yaw: 0 });
  occ.add({ x: cx, z: Q.minZ - 12 - tt.dims[2] / 2, hw: tt.dims[0] / 2, hd: tt.dims[2] / 2, yaw: 0 }, 'bld');
  const lib2 = pickId(L, ['library', 'shop_b']);
  const lt = L.lib.byId.get(lib2);
  L.put(lib2, cx, Q.maxZ + 12 + lt.dims[2] / 2, { yaw: Math.PI });
  occ.add({ x: cx, z: Q.maxZ + 12 + lt.dims[2] / 2, hw: lt.dims[0] / 2, hd: lt.dims[2] / 2, yaw: Math.PI }, 'bld');
}

function depot(ctx, life) {
  const { L, occ, paint } = ctx;
  // the depot stands at the head of Main Street, its platform on the track side
  const id = pickId(L, ['depot_station', 'shop_b']);
  const t = L.lib.byId.get(id);
  const z = RAIL_Z + 4 + 6 + t.dims[2] / 2;
  L.put(id, MAIN_X + 40, z, { yaw: 0 });
  occ.add({ x: MAIN_X + 40, z, hw: t.dims[0] / 2, hd: t.dims[2] / 2, yaw: 0 }, 'bld');
  const ge = pickId(L, ['grain_elevator', 'grain_silo']);
  const gt = L.lib.byId.get(ge);
  const gz = RAIL_Z + 6 + gt.dims[2] / 2;
  L.put(ge, MAIN_X - 70, gz, { yaw: 0 });
  occ.add({ x: MAIN_X - 70, z: gz, hw: gt.dims[0] / 2, hd: gt.dims[2] / 2, yaw: 0 }, 'bld');
  for (const dx of [-90, -100]) L.put('grain_silo', MAIN_X + dx - 10, gz + 4, { scale: 0.8 });
  // crossing signals where Main/Depot St and Elm Ave cross the tracks
  for (const x of [MAIN_X, -520]) for (const side of [-1, 1]) L.put(pickId(L, ['crossing_signal', 'stop_sign']), x + side * 8, RAIL_Z + side * 9, { yaw: side > 0 ? 0 : Math.PI });
  parkingLot(ctx, MAIN_X + 90, z + 6, 30, 40, 0, { fill: 0.5 });
}

function angledParking(ctx) {
  const { L } = ctx;
  for (const e of net.edges) {
    if (e.parking !== 'angled') continue;
    const inner = e.w / 2 - 5.5;
    const dx = (e.poly[1][0] - e.poly[0][0]) / e.len,
      dz = (e.poly[1][1] - e.poly[0][1]) / e.len;
    for (const side of [1, -1]) {
      for (let v = (e.trimA || 0) + 6; v < e.len - (e.trimB || 0) - 6; v += 3.0) {
        if (L.rand() > 0.62) continue;
        // bay centre: matches the painted stripes (slope 0.8 across the bay)
        const u = inner + 2.75;
        const vc = v + 1.5 - 2.75 * 0.8;
        const x = e.poly[0][0] + dx * vc - dz * u * side,
          z = e.poly[0][1] + dz * vc + dx * u * side;
        // car axis along the stripe: (across 1, along -0.8)
        const ax = -dz * side * 1 + dx * -0.8,
          az = dx * side * 1 + dz * -0.8;
        const id = L.pick(['car', 'suv', 'pickup_truck', 'hatchback', 'car'].filter((i) => L.lib.byId.has(i)));
        L.put(id, x, z, { yaw: L.along(id, Math.atan2(ax, az)) + (L.rand() < 0.85 ? 0 : Math.PI) });
      }
    }
  }
}

function highwayStrip(ctx, life) {
  const { L, occ } = ctx;
  // west of town along Route 9: gas station, diner, motel, farm supply, water tower
  const place = (id, x, z, yaw) => {
    const t = L.lib.byId.get(id);
    if (!t) return null;
    const r = { x, z, hw: t.dims[0] / 2, hd: t.dims[2] / 2, yaw };
    if (occ.hits(r)) return null;
    occ.add(r, 'bld');
    return L.put(id, x, z, { yaw });
  };
  const north = HWY_Z - 12;
  place('petrol_station', -440, north - 12, Math.PI);
  place(pickId(L, ['diner', 'cafe']), -340, north - 8, Math.PI);
  place(pickId(L, ['motel', 'shop_a']), -460, HWY_Z + 12 + 10, 0);
  place('water_tower', -600, HWY_Z + 70, 0);
  place('billboard', -700, HWY_Z - 30, Math.PI / 2);
  parkingLot(ctx, -340, north - 32, 30, 20, 0, { fill: 0.5 });
}

function eastBank(ctx, life) {
  const { L, occ, paint } = ctx;
  // the mill on the bank with its water wheel turning in the race
  const millZ = -120;
  const mx = riverX(millZ) + RIVER_W / 2 + 22;
  const mid = pickId(L, ['mill', 'red_barn']);
  const mt = L.lib.byId.get(mid);
  L.put(mid, mx + mt.dims[0] / 2, millZ, { yaw: -Math.PI / 2 });
  occ.add({ x: mx + mt.dims[0] / 2, z: millZ, hw: mt.dims[0] / 2, hd: mt.dims[2] / 2, yaw: -Math.PI / 2 }, 'bld');
  if (L.lib.byId.has('water_wheel')) {
    const ww = L.lib.byId.get('water_wheel');
    const it = L.put('water_wheel', mx - 4, millZ, { yaw: Math.PI / 2, y: -1.5 });
    if (it) life.spinners.push({ it, axis: 'z', rate: -0.6 });
  }
  // the fairground: ferris wheel (turning), carousel, circus tent, stalls, crowds
  const F = FAIR;
  const fcx = (F.minX + F.maxX) / 2,
    fcz = (F.minZ + F.maxZ) / 2;
  occ.add({ x: fcx, z: fcz, hw: (F.maxX - F.minX) / 2, hd: (F.maxZ - F.minZ) / 2, yaw: 0 }, 'fair');
  paint.push((b) => b.rect(fcx, fcz, F.maxX - F.minX - 20, F.maxZ - F.minZ - 20, 0, SK.dirt, { C: ['sand', 'caramel'] }));
  if (L.lib.byId.has('ferris_wheel_frame') && L.lib.byId.has('ferris_wheel_ring')) {
    L.put('ferris_wheel_frame', fcx + 70, fcz, { yaw: 0.4 });
    const rt = L.lib.byId.get('ferris_wheel_ring');
    const axle = FERRIS_AXLE;
    const it = L.put('ferris_wheel_ring', fcx + 70, fcz, { yaw: 0.4, y: axle - rt.dims[1] / 2 });
    if (it) life.spinners.push({ it, axis: 'z', rate: 0.15 });
  } else L.put('ferris_wheel', fcx + 70, fcz, { yaw: 0.4 });
  const car = L.put('carousel', fcx - 50, fcz + 40);
  if (car) life.spinners.push({ it: car, axis: 'y', rate: 0.5 });
  L.put('circus_tent', fcx - 60, fcz - 50);
  for (let k = 0; k < 8; k++) L.put(pickId(L, ['lemonade_stand', 'ice_cream_van']), fcx - 20 + k * 14, fcz + 90, { yaw: Math.PI });
  for (let k = 0; k < 40; k++) {
    const id = L.pick(['person_adult', 'person_adult2', 'person_kid', 'person_teen'].filter((i) => L.lib.byId.has(i)));
    const it = L.put(id, fcx + L.range(-140, 140), fcz + L.range(-100, 100));
    if (it) life.grazers.push({ it, cx: fcx, cz: fcz, yaw: 0, hw: 150, hd: 110, speed: 1.1, still: 0.4 });
  }
  // marina and lighthouse on the lake
  L.put('lighthouse', LAKE.x + 160, LAKE.z - 30);
  L.put(pickId(L, ['boathouse', 'garden_shed']), LAKE.x - 230, LAKE.z - 150, { yaw: 2.4 });
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05;
    const cx = LAKE.x - 60 + Math.sin(a) * 90,
      cz = LAKE.z + Math.cos(a) * 90;
    const loop = [];
    for (let j = 0; j <= 16; j++) loop.push([cx + Math.sin((j / 16) * 6.283) * (40 + k * 6), cz + Math.cos((j / 16) * 6.283) * (25 + k * 4)]);
    const id = L.pick(['sailboat', 'fishing_boat', pickId(L, ['rowboat', 'sailboat']), pickId(L, ['canoe', 'sailboat'])]);
    const it = L.put(id, cx, cz);
    if (it) life.movers.push({ its: [it], offs: [0], route: loop, speed: 2 + (k % 3), kind: 'boat' });
  }
  // a barge and a tug working up and down the river
  const rp = riverPoly();
  const up = rp.pts.map(([x, z]) => [x - 10, z]);
  const down = rp.pts.slice().reverse().map(([x, z]) => [x + 10, z]);
  for (const [id, s0] of [[pickId(L, ['river_barge', 'fishing_boat']), 0], [pickId(L, ['tugboat', 'fishing_boat']), 700]]) {
    const it = L.put(id, up[0][0], up[0][1]);
    if (it) life.movers.push({ its: [it], offs: [0], route: [...up, ...down], speed: 4, s: s0, kind: 'boat' });
  }
  // the bridges
  const rb = pickId(L, ['road_bridge']);
  if (L.lib.byId.has('road_bridge')) {
    L.put('road_bridge', riverX(HWY_Z), HWY_Z, { yaw: 0, y: -4.05 });
    L.put('road_bridge', riverX(-560), -560, { yaw: 0, y: -4.05 });
  }
  if (L.lib.byId.has('rail_bridge')) L.put('rail_bridge', riverX(RAIL_Z), RAIL_Z, { yaw: 0, y: -4.05 });
  flock(L, ctx.life || life, LAKE.x - 200, LAKE.z - 200, 6, { id: pickId(L, ['pigeon']) });
}

const FERRIS_AXLE = 19;

function farms(ctx, life) {
  const { L, occ, paint, fences } = ctx;
  // fields in rows and fenced pastures in the farm belt (west edge and south)
  const plots = [];
  for (let x = -735; x < -560; x += 85) for (let z = -735; z < 735; z += 120) plots.push([x, z, 80, 112]);
  for (let x = -540; x < 100; x += 105) for (let z = 400; z < 735; z += 105) plots.push([x, z, 98, 98]);
  for (let x = -540; x < -60; x += 105) plots.push([x, -720, 98, 90]);
  // north of Mill Road and east of the fairground: more farms
  for (let x = -540; x < -150; x += 105) for (let z = -735; z < -600; z += 100) plots.push([x, z, 98, 92]);
  for (let x = 40; x < 370; x += 105) for (let z = -735; z < -600; z += 100) plots.push([x, z, 98, 92]);
  for (let x = 560; x < 735; x += 90) for (let z = -440; z < 230; z += 110) plots.push([x, z, 84, 102]);
  const crops = [['sun', 'butter'], ['leaf', 'lime'], ['caramel', 'sand'], ['pine', 'leaf'], ['lime', 'butter']];
  let farmstead = 0;
  for (const [x0, z0, w, d] of plots) {
    const cx = x0 + w / 2,
      cz = z0 + d / 2;
    const r = { x: cx, z: cz, hw: w / 2 - 1, hd: d / 2 - 1, yaw: 0 };
    if (occ.hits(r)) continue;
    occ.add(r, 'field');
    const kind = L.rand();
    if (kind < 0.55) {
      // crop field: rows painted, a scarecrow, sometimes the combine at work
      const [a, b] = L.pick(crops);
      paint.push((bb) => bb.rect(cx, cz, w - 4, d - 4, L.rand() < 0.5 ? 0 : Math.PI / 2, SK.field, { P: [2.2], C: [a, b], y: -0.15 }));
      if (L.rand() < 0.4) L.put('scarecrow', cx + L.range(-20, 20), cz + L.range(-20, 20), { yaw: L.range(0, 6) });
      if (L.rand() < 0.3 && L.lib.byId.has('combine_harvester')) {
        const route = [];
        for (let k = 0; k < 6; k++) {
          const x = cx - w / 2 + 10 + (k * (w - 20)) / 5;
          route.push(k % 2 ? [x, cz + d / 2 - 10] : [x, cz - d / 2 + 10]);
        }
        route.push(...route.slice().reverse());
        const it = L.put('combine_harvester', route[0][0], route[0][1]);
        if (it) life.movers.push({ its: [it], offs: [0], route, speed: 2.2, kind: 'combine' });
      }
    } else {
      // pasture: fenced, with animals grazing
      const f = pickId(L, ['ranch_fence', 'picket_fence']);
      const c = [[cx - w / 2 + 2, cz - d / 2 + 2], [cx + w / 2 - 2, cz - d / 2 + 2], [cx + w / 2 - 2, cz + d / 2 - 2], [cx - w / 2 + 2, cz + d / 2 - 2]];
      for (let k = 0; k < 4; k++) fenceLine(L, f, c[k][0], c[k][1], c[(k + 1) % 4][0], c[(k + 1) % 4][1], { dedupe: fences, gaps: k === 0 ? [[w / 2 - 4, w / 2 + 4]] : [] });
      const animal = L.pick(['cow', 'cow', 'sheep', 'horse']);
      for (let k = 0; k < 6 + Math.floor(L.rand() * 6); k++) {
        const it = L.put(animal, cx + L.range(-w / 2 + 6, w / 2 - 6), cz + L.range(-d / 2 + 6, d / 2 - 6));
        if (it) life.grazers.push({ it, cx, cz, yaw: 0, hw: w / 2 - 5, hd: d / 2 - 5, speed: animal === 'horse' ? 1.2 : 0.4, still: 0.7 });
      }
      if (L.rand() < 0.4) L.put('hay_bale', cx + L.range(-20, 20), cz + L.range(-20, 20));
    }
    // a farmstead every few plots, near a road
    if (farmstead++ % 4 === 0) {
      const fx = cx + w / 2 - 14,
        fz = cz - d / 2 + 14;
      L.put(pickId(L, ['farmhouse', 'house_c']), fx, fz, { yaw: L.rand() < 0.5 ? 0 : Math.PI / 2 });
      L.put('red_barn', fx - 30, fz + 20, { yaw: Math.PI / 2 });
      L.put('grain_silo', fx - 50, fz + 6);
      if (L.rand() < 0.6) L.put('tractor', fx - 10, fz + 30, { yaw: L.range(0, 6) });
    }
  }
  // a windmill with turning sails on the rise in the north-west
  if (L.lib.byId.has('windmill_tower') && L.lib.byId.has('windmill_sails')) {
    const wx = -660,
      wz = -620;
    L.put('windmill_tower', wx, wz, { yaw: 0.5 });
    const st = L.lib.byId.get('windmill_sails');
    const it = L.put('windmill_sails', wx + Math.sin(0.5) * WINDMILL_FWD, wz + Math.cos(0.5) * WINDMILL_FWD, { yaw: 0.5, y: WINDMILL_AXLE - st.dims[1] / 2 });
    if (it) life.spinners.push({ it, axis: 'z', rate: 0.5 });
  } else L.put('windmill', -660, -620, { yaw: 0.5 });
  // woods along the far north and east edges
  woods(ctx, { minX: -S, maxX: S, minZ: -S, maxZ: S }, { count: 500, ids: ['pine_tree', 'tree_round', 'pine_tree'], scale: [1, 1.6], minRoadDist: 60, net });
}
const WINDMILL_AXLE = 18,
  WINDMILL_FWD = 4;

// review views (tests/city_review.mjs)
export const review = {
  play: [
    { name: 'main_street', x: MAIN_X - 4, z: 160, yaw: Math.PI },
    { name: 'square', x: -200, z: 104, yaw: Math.PI, d: 16 },
    { name: 'residential', x: -400, z: 20, yaw: Math.PI, d: 14 },
    { name: 'depot', x: MAIN_X, z: -400, yaw: Math.PI, d: 30 },
    { name: 'bridge', x: 120, z: HWY_Z, yaw: Math.PI / 2, d: 40 },
    { name: 'farms', x: -640, z: 200, yaw: Math.PI, d: 60 },
  ],
  aerial: [
    { name: 'downtown', pos: [-20, 220, 420], look: [-180, 0, 0] },
    { name: 'river', pos: [500, 300, -300], look: [100, 0, 0] },
    { name: 'farms', pos: [-300, 260, 700], look: [-560, 0, 300] },
  ],
  map: { cx: 0, cz: 0, half: 760 },
  motion: [{ name: 'main_st', pos: [-120, 45, 60], look: [-150, 0, -10] }],
};
