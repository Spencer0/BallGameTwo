// Level 5 — Small Town: Puddleford, a Midwestern river town (CITY.md §2; modelled on county seats like
// Galena IL / Stillwater MN). The town grew where Route 9 and the railroad cross the river:
//   - a courthouse square (the courthouse on its lawn, two-storey brick commerce facing it on all sides)
//     with Main Street's storefronts running north from Route 9 to the depot and the tracks;
//   - a grid of frame houses on deep lots west of Main, alleys down the middle of the blocks;
//   - Water Street along the west bank with a riverfront park and a boat landing;
//   - the river meanders south from the northern woods, narrows under three bridges (Mill Road, the
//     railroad, Route 9) and spreads into Lake Puddle, with a beach and a marina at the end of Lake Road;
//   - the east bank: the old mill and its water wheel at the Mill Road bridge, the high school, more
//     streets of houses, the county fairground north of Mill Road;
//   - a double-track main line with level crossings (flashers, cars wait) and two trains;
//   - farms on every side, fields edge to edge with hedgerows and farm tracks, farmsteads in their
//     shelterbelts, pastures with stock, county roads on the section lines.
import { Layout } from './layout.js';
import { Network } from './city/network.js';
import { paintNetwork } from './city/surface.js';
import { Occupancy, occupyNetwork, frameAt, local, fillFrontage, fenceLine, tidyFences } from './city/frontage.js';
import { SK } from '../render/streets.js';
import { suburbLot, closeFences, frontageFences, pickId, woods, parkingLot, countryside } from './city/suburb.js';
import { lifeSpec, spawnTraffic, spawnWalkers, spawnLoopWalkers, trafficLights, stopSigns, flock, ducks } from './city/lifespec.js';

// buildings a fence may stop against (a yard fence returns to the house; a paddock ends at the barn)
const FENCE_STOPS = /^(house_|garage$|garden_shed$|farmhouse$|red_barn$|barn|apartment_block$|bakery$|boathouse$|cafe$|church$|clock_tower$|depot_station$|diner$|grain_elevator$|library$|mill$|motel$|petrol_station$|post_office$|school_building$|shop_|storefront|strip_mall$|supermarket$|town_hall$|grain_silo$|doghouse$|treehouse$)/;

const S = 750;
const MAIN_X = -150;
const MAIN_Z = [-430, -300, -170, -40, 90, 220]; // cross streets on Main (Route 9 is at HWY_Z)
const CROSS_NAMES = ['Front Street', 'First Street', 'Second Street', 'Court Street', 'Third Street', 'Fourth Street'];
const HWY_Z = 330;
const WEST_X = [-280, -400, -520];
const WEST_NAMES = ['Elm Avenue', 'Oak Avenue', 'Ash Avenue'];
const SQUARE = { minX: -280, maxX: MAIN_X, minZ: -40, maxZ: 90 };
const RAIL_Z = -470;
const TRACK = 3.2; // double track: eastbound on +z, westbound on -z
const MILL_Z = -560;
const EAST_X = [300, 410, 520];
const EAST_NAMES = ['Pine Street', 'Cedar Street', 'Birch Street'];
const LAKE_RD_X = 60;
const FAIR = { minX: 300, maxX: 700, minZ: -742, maxZ: -578 };
const LAKE = { x: 495, z: 565, rx: 185, rz: 140 };
const BANK = 6; // mud-and-sand margin between the water and the grass
const PARK_W = 30; // riverfront park between the bank and the riverside street's centreline

// the river: control points [x, z, width], north (beyond the map, in the woods) -> the lake.
// It narrows and runs nearly north-south where the three bridges cross it.
const RIVER_CTRL = [
  [-240, -1900, 70],
  [-110, -1520, 95],
  [-240, -1180, 80],
  [-110, -880, 110],
  [-165, -720, 85],
  [-98, -615, 56],
  [-95, -560, 44], // Mill Road bridge
  [-90, -515, 50],
  [-73, -490, 48],
  [-69, -470, 44], // rail bridge
  [-55, -425, 60],
  [10, -360, 100],
  [45, -265, 125],
  [15, -170, 85],
  [70, -70, 75],
  [160, 10, 115],
  [150, 130, 80],
  [192, 272, 50],
  [199, 330, 44], // Route 9 bridge
  [212, 385, 54],
  [255, 432, 70],
  [350, 492, 90], // into the lake
];

/** Catmull-Rom through [x, z, w] control points, resampled every ~step metres (w eased linearly) */
function spline(ctrl, step) {
  const out = [];
  for (let k = 0; k < ctrl.length - 1; k++) {
    const p0 = ctrl[Math.max(0, k - 1)],
      p1 = ctrl[k],
      p2 = ctrl[k + 1],
      p3 = ctrl[Math.min(ctrl.length - 1, k + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n,
        t2 = t * t,
        t3 = t2 * t;
      const f = (i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
      const e = t * t * (3 - 2 * t);
      out.push([f(0), f(1), p1[2] + (p2[2] - p1[2]) * e]);
    }
  }
  out.push(ctrl[ctrl.length - 1].slice());
  return out;
}
const RIVER = spline(RIVER_CTRL, 6);

/** the river at z: centre x and half-width */
function riverAt(z) {
  if (z <= RIVER[0][1]) return { x: RIVER[0][0], hw: RIVER[0][2] / 2 };
  for (let k = 1; k < RIVER.length; k++) {
    const a = RIVER[k - 1],
      b = RIVER[k];
    if (z <= b[1]) {
      const t = (z - a[1]) / (b[1] - a[1] || 1);
      return { x: a[0] + t * (b[0] - a[0]), hw: (a[2] + t * (b[2] - a[2])) / 2 };
    }
  }
  const l = RIVER[RIVER.length - 1];
  return { x: l[0], hw: l[2] / 2 };
}
const waterX = (z) => {
  const r = riverAt(z);
  return r.x - r.hw - BANK - PARK_W;
};
const riverRoadX = (z) => {
  const r = riverAt(z);
  return r.x + r.hw + BANK + PARK_W;
};
/** interior points for a road that follows the river between z0 and z1 */
const follow = (fx, z0, z1, step = 12) => {
  const pts = [];
  const n = Math.max(1, Math.round(Math.abs(z1 - z0) / step));
  for (let k = 1; k < n; k++) {
    const z = z0 + ((z1 - z0) * k) / n;
    pts.push([fx(z), z]);
  }
  return pts;
};

// the lake: a lobed ellipse
const lakeF = (a) => 1 + 0.1 * Math.sin(3 * a + 0.7) + 0.06 * Math.sin(5 * a + 2.1) + 0.04 * Math.sin(7 * a + 0.3);
function lakePts(grow = 0, n = 96) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const f = lakeF(a);
    pts.push([LAKE.x + Math.sin(a) * (LAKE.rx * f + grow), LAKE.z + Math.cos(a) * (LAKE.rz * f + grow)]);
  }
  return pts;
}
const lakeAt = (a, grow = 0) => [LAKE.x + Math.sin(a) * (LAKE.rx * lakeF(a) + grow), LAKE.z + Math.cos(a) * (LAKE.rz * lakeF(a) + grow)];

function buildNet() {
  const net = new Network({ crosswalks: 'signals' });
  const N = (x, z, o) => net.at(x, z, 0.5, o);
  // --- Route 9: west edge -> town -> river bridge -> east edge
  const hb = riverAt(HWY_Z);
  const bW = hb.x - hb.hw - 14;
  const hx = [-S - 450, -640, ...WEST_X, MAIN_X, LAKE_RD_X, bW, hb.x + hb.hw + 14, riverRoadX(HWY_Z), ...EAST_X, S + 450].sort((a, b) => a - b);
  for (let k = 0; k < hx.length - 1; k++) {
    const bridge = Math.abs(hx[k] - bW) < 0.01;
    net.edge(N(hx[k], HWY_Z, k === 0 ? { exit: true } : {}), N(hx[k + 1], HWY_Z, k + 1 === hx.length - 1 ? { exit: true } : {}), bridge ? { cls: 'arterial', name: 'Route 9 Bridge', tag: 'hwy', walk: 0, verge: 0, y: 0.5, paint: false } : { cls: 'arterial', name: 'Route 9', tag: 'hwy', draw: 1.5 });
  }
  // --- Main Street: Route 9 north to Front Street and the depot. One traffic light (at the square);
  // four-way stops and painted crosswalks at the other corners
  const mainNode = (z) => (z === HWY_Z ? {} : z === -40 ? { signal: true, crosswalks: true } : { signal: 'none', crosswalks: true });
  const mzs = [...MAIN_Z, HWY_Z];
  for (let k = 0; k < mzs.length - 1; k++) {
    const core = mzs[k + 1] <= 220;
    net.edge(N(MAIN_X, mzs[k], mainNode(mzs[k])), N(MAIN_X, mzs[k + 1], mainNode(mzs[k + 1])), core ? { cls: 'main', name: 'Main Street', tag: 'main', draw: 11 } : { cls: 'street', name: 'Main Street', tag: 'mainS', w: 11 });
  }
  net.edge(N(MAIN_X, -430), N(MAIN_X, MILL_Z), { cls: 'street', name: 'Depot Street', tag: 'depot' });
  // --- the west grid: cross streets from Main to Ash Avenue, avenues from Front Street to Route 9
  MAIN_Z.forEach((z, i) => {
    const xs = [MAIN_X, ...WEST_X];
    for (let k = 0; k < xs.length - 1; k++) net.edge(N(xs[k], z), N(xs[k + 1], z), { cls: 'street', name: CROSS_NAMES[i], tag: 'cross' });
  });
  WEST_X.forEach((x, i) => {
    const zs = [...MAIN_Z, HWY_Z];
    for (let k = 0; k < zs.length - 1; k++) net.edge(N(x, zs[k]), N(x, zs[k + 1]), { cls: 'street', name: WEST_NAMES[i], tag: 'ave' });
  });
  net.edge(N(-520, -430), N(-520, MILL_Z), { cls: 'street', name: 'Ash Avenue', tag: 'ave' });
  // --- east of Main: cross streets to Water Street, which follows the west bank
  const wz = MAIN_Z.filter((z) => waterX(z) > MAIN_X + 60);
  MAIN_Z.forEach((z, i) => {
    if (wz.includes(z)) net.edge(N(MAIN_X, z), N(waterX(z), z), { cls: 'street', name: CROSS_NAMES[i], tag: 'cross' });
  });
  for (let k = 0; k < wz.length - 1; k++) net.edge(N(waterX(wz[k]), wz[k]), N(waterX(wz[k + 1]), wz[k + 1]), { cls: 'street', name: 'Water Street', tag: 'water', pts: follow(waterX, wz[k], wz[k + 1]) });
  // --- Mill Road: the county road north of town, over the Mill Road bridge, past the fairground
  const mb = riverAt(MILL_Z);
  const mW = mb.x - mb.hw - 14;
  const mx = [-S - 450, -640, -520, MAIN_X, mW, mb.x + mb.hw + 14, riverRoadX(MILL_Z), ...EAST_X, S + 450].sort((a, b) => a - b);
  for (let k = 0; k < mx.length - 1; k++) {
    const bridge = Math.abs(mx[k] - mW) < 0.01;
    net.edge(N(mx[k], MILL_Z, k === 0 ? { exit: true } : {}), N(mx[k + 1], MILL_Z, k + 1 === mx.length - 1 ? { exit: true } : {}), bridge ? { cls: 'street', name: 'Mill Road Bridge', tag: 'mill', walk: 0, verge: 0, y: 0.5, paint: false } : { cls: 'street', name: 'Mill Road', tag: 'mill', verge: 0, walk: 2, draw: 0.6 });
  }
  // --- the east bank: River Road along the bank from Mill Road to Route 9; a grid east of it
  const EZ = [MILL_Z, ...MAIN_Z, HWY_Z];
  for (let k = 0; k < EZ.length - 1; k++) net.edge(N(riverRoadX(EZ[k]), EZ[k]), N(riverRoadX(EZ[k + 1]), EZ[k + 1]), { cls: 'street', name: 'River Road', tag: 'river', pts: follow(riverRoadX, EZ[k], EZ[k + 1]) });
  for (const z of MAIN_Z) {
    const xs = [riverRoadX(z), ...EAST_X.filter((x) => x > riverRoadX(z) + 60)];
    for (let k = 0; k < xs.length - 1; k++) net.edge(N(xs[k], z), N(xs[k + 1], z), { cls: 'street', name: 'Bank Street', tag: 'bank' });
  }
  EAST_X.forEach((x, i) => {
    for (let k = 0; k < EZ.length - 1; k++) net.edge(N(x, EZ[k]), N(x, EZ[k + 1]), { cls: 'street', name: EAST_NAMES[i], tag: 'eastave' });
  });
  // --- county roads through the farms (narrow, no sidewalks)
  const lane = { cls: 'lane', name: 'County Road 12', tag: 'county', w: 7, draw: 0.4 };
  net.edge(N(-640, -S - 450, { exit: true }), N(-640, MILL_Z), lane);
  net.edge(N(-640, MILL_Z), N(-640, HWY_Z), lane);
  net.edge(N(-640, HWY_Z), N(-640, 560), lane);
  net.edge(N(-640, 560), N(-640, S + 450, { exit: true }), lane);
  net.edge(N(-640, 560), N(LAKE_RD_X, 560), { ...lane, name: 'Lake Road' });
  net.edge(N(LAKE_RD_X, 560), N(LAKE_RD_X, HWY_Z), { ...lane, name: 'Lake Road' });
  net.edge(N(LAKE_RD_X, 560), N(232, 560, { bulb: 14 }), { ...lane, name: 'Lake Road', w: 8 });
  // --- the railroad: two tracks, west edge -> depot -> rail bridge -> east edge (never joined to roads)
  const rb = riverAt(RAIL_Z);
  for (const dz of [-TRACK, TRACK]) {
    const z = RAIL_Z + dz;
    const xs = [-S - 140, rb.x - rb.hw - 10, rb.x + rb.hw + 10, S + 140];
    const ids = xs.map((x) => net.node(x, z, { exit: true, rail: true }));
    for (let k = 0; k < ids.length - 1; k++) net.edge(ids[k], ids[k + 1], { cls: 'rail', name: 'Railroad', tag: 'rail', w: 4, traffic: false, sidewalks: 'none', paint: k !== 1 });
  }
  return net.build();
}

export const net = buildNet();

export const env = {
  sky: [
    [0, 'tangerine'],
    [0.55, '#FFC27A'],
    [1, 'butter'],
  ],
  fog: { near: 320, far: 900, k: 75, color: '#FFE0A8' },
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: 6000, d: 6000, y: -0.5, pattern: 'solid', a: '#62B851' },
    { x: 0, z: 0, w: 2 * S + 200, d: 2 * S + 200, y: -0.45, pattern: 'solid', a: '#62B851' }, // leaf-green fields (STYLE.md)
  ],
  streets: (b) => {
    // river: muddy banks under the water ribbon, both following the meander
    // river: grassy, wooded banks (dark), gravel bars on the inside of the bends, then the water
    const pts = RIVER.map((p) => [p[0], p[1]]);
    b.ribbon(pts, RIVER.map((p) => p[2] / 2 + BANK), SK.solid, { C: ['pine'], y: -0.33 });
    b.ribbon(pts, RIVER.map((p) => p[2] / 2), SK.water, { C: ['teal', 'sky'], y: -0.2 });
    for (const [z, side] of [[-265, -1], [10, -1], [-880, 1], [-1180, -1], [130, 1]]) {
      const r = riverAt(z);
      const bar = [];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        bar.push([r.x + side * r.hw * 0.62 + Math.sin(a) * r.hw * 0.28, z + Math.cos(a) * 30]);
      }
      b.poly([[r.x + side * r.hw * 0.62, z], ...bar, bar[0]], SK.solid, { C: ['sand'], y: -0.17 });
    }
    // the lake: grassy shore all round, a sand beach on the north side, then the water
    const shore = lakePts(14);
    b.poly([[LAKE.x, LAKE.z], ...shore, shore[0]], SK.solid, { C: ['pine'], y: -0.34 });
    const beachArc = [];
    for (let k = 0; k <= 16; k++) beachArc.push(lakeAt(Math.PI * (0.72 + (0.36 * k) / 16), 22));
    for (let k = 16; k >= 0; k--) beachArc.push(lakeAt(Math.PI * (0.72 + (0.36 * k) / 16), -6));
    b.poly([[LAKE.x, LAKE.z], ...beachArc], SK.solid, { C: ['sand'], y: -0.33 });
    const lake = lakePts(0);
    b.poly([[LAKE.x, LAKE.z], ...lake, lake[0]], SK.water, { C: ['teal', 'sky'], y: -0.2, origin: [0, 0] });
    paintNetwork(b, net);
  },
  blocks: [
    { min: [-S - 20, -5, -S - 20], max: [S + 20, 2000, -S], visible: false },
    { min: [-S - 20, -5, S], max: [S + 20, 2000, S + 20], visible: false },
    { min: [-S - 20, -5, -S], max: [-S, 2000, S], visible: false },
    { min: [S, -5, -S], max: [S + 20, 2000, S], visible: false },
  ],
};


export const bounds = { minX: -S, maxX: S, minZ: -S, maxZ: S };
export const spawn = { x: MAIN_X - 4, z: 160, yaw: Math.PI };

const STORES = ['storefront_a', 'storefront_b', 'storefront_c', 'storefront_a', 'storefront_b', 'storefront_c', 'shop_a', 'cafe', 'shop_b'];
const CIVIC = ['post_office', 'library', 'shop_b', 'cafe', 'shop_a', 'diner'];
const TOWN_HOUSES = ['house_c', 'house_f', 'house_a', 'house_d', 'house_e', 'house_c', 'house_f', 'house_a'];
const PARKED = ['car', 'suv', 'pickup_truck', 'hatchback', 'car', 'pickup_truck'];
const PARKED_TINTS = ['paper', 'cloud', 'stone', 'slate', 'concrete', 'cocoa', 'tomato', 'sky', 'pine', 'paper', 'stone'];

export function layout(lib, seed = 505) {
  const L = new Layout(lib, seed, { minX: -S + 2, maxX: S - 2, minZ: -S + 2, maxZ: S - 2 });
  L.setCell(20);
  const occ = new Occupancy(24);
  occupyNetwork(occ, net, 0.2);
  L.clear(spawn.x, spawn.z, 10);
  occ.add({ x: spawn.x, z: spawn.z, hw: 6, hd: 6, yaw: 0 }, 'spawn');
  // the river (with its banks) and the lake are no-build zones
  for (let k = 1; k < RIVER.length; k++) {
    const [ax, az, aw] = RIVER[k - 1],
      [bx, bz, bw] = RIVER[k];
    occ.add({ x: (ax + bx) / 2, z: (az + bz) / 2, hw: Math.max(aw, bw) / 2 + BANK + 1, hd: Math.hypot(bx - ax, bz - az) / 2 + 1, yaw: Math.atan2(bx - ax, bz - az) }, 'water');
  }
  for (let k = 0; k < 48; k++) {
    const a = ((k + 0.5) / 48) * Math.PI * 2;
    const [ex, ez] = lakeAt(a, 16);
    const r = Math.hypot(ex - LAKE.x, ez - LAKE.z);
    occ.add({ x: (LAKE.x + ex) / 2, z: (LAKE.z + ez) / 2, hw: r * Math.tan(Math.PI / 48) * 1.1 + 1, hd: r / 2, yaw: Math.atan2(ex - LAKE.x, ez - LAKE.z) }, 'water');
  }
  const ctx = { L, occ, paint: L.paint, rand: L.rand, lib, fences: new Set() };
  const life = (L.life = lifeSpec(net));
  ctx.life = life;
  const avail = (ids) => ids.filter((id) => lib.byId.has(id));
  const stores = avail(STORES);
  const fitStore = (rem) => {
    const fit = stores.filter((id) => lib.byId.get(id).dims[0] <= rem + 0.3);
    return fit.length ? L.pick(fit) : null;
  };

  courthouseSquare(ctx, life);
  depot(ctx, life);
  riverfront(ctx, life);
  mill(ctx, life);
  landmarks(ctx);

  // ---- downtown: storefronts wall to wall on Main, round the square, and half a block up each cross street
  const facesSquare = (f) => {
    const fr = frameAt(f, f.L[f.L.length - 1] / 2);
    const [x, z] = local(fr, 0, 24);
    return x > SQUARE.minX && x < SQUARE.maxX && z > SQUARE.minZ && z < SQUARE.maxZ;
  };
  for (const f of net.frontages) {
    const e = net.edges[f.e];
    if (e.tag === 'main' || ((e.tag === 'cross' || e.tag === 'ave') && facesSquare(f))) fillFrontage(L, occ, f, { pick: fitStore, setback: 0.2, gap: () => 0.15, step: 3, tint: storeTint(L) });
  }
  for (const f of net.frontages) {
    const e = net.edges[f.e];
    if (e.tag !== 'cross') continue;
    const A = net.nodes[e.a],
      B = net.nodes[e.b];
    if (A.x !== MAIN_X && B.x !== MAIN_X) continue;
    const len = f.L[f.L.length - 1];
    const fromMain = A.x === MAIN_X;
    fillFrontage(L, occ, f, { pick: fitStore, setback: 0.2, gap: () => 0.2, s0: fromMain ? 0 : len - 48, s1: fromMain ? 48 : len, step: 3, tint: storeTint(L) });
  }
  angledParking(ctx);
  mainStreetFurniture(ctx);

  // ---- alleys down the middle of the residential blocks (garages open onto them)
  alleys(ctx);

  // ---- houses: avenue lots are deep (the houses face the avenues), then whatever fits elsewhere
  const RES = { ave: 46, eastave: 46, water: 34, river: 40, depot: 40, cross: 50, bank: 44, mainS: 34 }; // deep enough that back yards meet mid-block
  const riverside = (f, e) => {
    if (e.tag !== 'water' && e.tag !== 'river') return false;
    const fr = frameAt(f, f.L[f.L.length - 1] / 2);
    return e.tag === 'water' ? -fr.fx > 0 : -fr.fx < 0;
  };
  const order = net.frontages.filter((f) => RES[net.edges[f.e].tag] && !riverside(f, net.edges[f.e]));
  const PRIO = { ave: 0, eastave: 0, river: 1, water: 2, cross: 3, bank: 3, depot: 3, mainS: 4 }; // the avenues' house rows first
  order.sort((a, b) => PRIO[net.edges[a.e].tag] - PRIO[net.edges[b.e].tag]);
  const pool = avail(TOWN_HOUSES);
  for (const f of order) {
    const e = net.edges[f.e];
    const len = f.L[f.L.length - 1];
    const W = 18;
    const n = Math.floor((len - 2) / W);
    if (n < 1) continue;
    const pad = (len - n * W) / 2;
    const recs = [];
    for (let k = 0; k < n; k++) {
      const s = pad + W * (k + 0.5);
      const fr = frameAt(f, s);
      recs.push({ s, rec: suburbLot(ctx, fr, e, { W, D: RES[e.tag], first: k === 0, last: k === n - 1, setback: [4.5, 6.5], pool, fenceP: 0.3, fenceIds: ['picket_fence', 'privacy_fence'], fenceTint: 'paper', fenceMode: 'frontage', yardPaint: false }) });
    }
    // fenced back yards close on the lot lines and return to the house corners
    frontageFences(ctx, f, recs, frameAt);
  }
  closeFences(ctx);
  // old towns are full of big trees: one more in most back yards
  const inLot = new Set(['lot']);
  for (const lot of ctx.lots || []) {
    if (lot.D < 34) continue;
    // a big shade tree near the back line, and on a deep lot often a second one halfway down the yard
    for (const back of lot.D >= 44 ? [L.range(5, 9), L.range(16, 22)] : [L.range(5, 9)]) {
      if (L.rand() < 0.2) continue;
      const [x, z] = local(lot.fr, L.range(-lot.W / 3, lot.W / 3), -lot.D + back);
      const r = { x, z, hw: 2, hd: 2, yaw: 0 };
      if (occ.hits(r, inLot)) continue;
      occ.add(r, 'yard');
      L.put('tree_round', x, z, { scale: L.range(1.1, 1.5), tint: L.pick(['leaf', 'leaf', 'pine', 'lime']) });
    }
  }

  // ---- leftover downtown frontage: civic buildings; leftover block interiors: parking behind the stores
  const civic = avail(CIVIC);
  for (const f of net.frontages) {
    const e = net.edges[f.e];
    if (e.tag !== 'cross' && e.tag !== 'water') continue;
    const fr = frameAt(f, f.L[f.L.length - 1] / 2);
    if (fr.x > MAIN_X + 160 || fr.x < SQUARE.minX - 10) continue;
    fillFrontage(L, occ, f, { pick: (rem) => L.pick(civic.filter((id) => lib.byId.get(id).dims[0] <= rem + 0.3)) || null, setback: 3, gap: () => 6 + L.rand() * 6, step: 6 });
  }
  rearParking(ctx);

  highwayStrip(ctx, life);
  eastBank(ctx, life);
  lake(ctx, life);
  farms(ctx, life);

  // ---- life
  trafficLights(L, life, net, { id: pickId(L, ['signal_post', 'traffic_light']) });
  stopSigns(L, net);
  // the streets round the courthouse square carry traffic circling the square, as they would on a court day
  const bySquare = (e) => {
    const [ax, az] = e.poly[0],
      [bx, bz] = e.poly[e.poly.length - 1];
    const mx = (ax + bx) / 2,
      mz = (az + bz) / 2;
    return mx >= SQUARE.minX - 1 && mx <= SQUARE.maxX + 1 && mz >= SQUARE.minZ - 1 && mz <= SQUARE.maxZ + 1 && e.tag !== 'main';
  };
  for (const e of net.edges) if (bySquare(e)) e.draw = 5;
  const laneW = (l) => {
    const e = net.edges[l.e];
    if (bySquare(e)) return 9;
    return e.cls === 'arterial' ? 2 : e.cls === 'main' ? 6 : e.cls === 'lane' ? 0.35 : e.tag === 'river' || e.tag === 'water' ? 1.4 : 1;
  };
  spawnTraffic(L, life, net, 260, [['car', 6], ['suv', 4], ['hatchback', 3], ['pickup_truck', 6], ['delivery_van', 1.5], ['mail_truck', 0.6], ['tractor', 0.6], ['school_bus', 0.4], ['police_car', 0.3], ['motorcycle', 0.8], ['garbage_truck', 0.3], ['fire_truck', 0.15]], { laneWeight: laneW });
  spawnWalkers(L, life, net, 280, {
    dogs: 0.2,
    walkWeight: (w) => {
      const e = net.edges[w.e];
      if (e.tag === 'main') return 7;
      if (e.tag === 'cross') return Math.abs(net.nodes[e.a].x - MAIN_X) < 1 || Math.abs(net.nodes[e.b].x - MAIN_X) < 1 ? 3 : 0.8;
      if (e.tag === 'water') return 1.5;
      return e.tag === 'ave' || e.tag === 'eastave' || e.tag === 'river' ? 0.6 : e.tag === 'hwy' ? 0.3 : 0.4;
    },
  });
  for (const d of ctx.yardDogs || []) {
    const { fr, W, z0, z1 } = d;
    const [x, z] = local(fr, 0, (z0 + z1) / 2);
    life.grazers.push({ it: d.it, cx: x, cz: z, yaw: fr.yaw, hw: W / 2 - 1.2, hd: Math.max(1, (z0 - z1) / 2 - 1), speed: 1.4, still: 0.5 });
  }
  for (const lot of (ctx.lots || []).filter(() => L.rand() < 0.1)) {
    const [x, z] = local(lot.fr, -lot.gx * 0.5, -lot.setback * 0.5);
    const it = L.put(pickId(L, ['person_kid', 'person_teen']), x, z);
    if (it) life.grazers.push({ it, cx: x, cz: z, yaw: lot.fr.yaw, hw: 4, hd: lot.setback * 0.35, speed: 1.6, still: 0.3 });
  }
  trains(ctx, life);
  life.crossings = ctx.crossings || [];
  // last of all: no fence run may end in the air
  L.fenceTidy = tidyFences(L, (id) => FENCE_STOPS.test(id));
  return L;
}

// ------------------------------------------------------------------ downtown
function storeTint(L) {
  // brick, painted brick and stone: the warm range of a Main Street, not a candy shop
  const T = ['tomato', 'brick', 'caramel', 'cocoa', 'sand', 'stone', 'paper', 'tomato', 'brick'];
  return () => {
    const t = L.pick(T);
    return t;
  };
}

function courthouseSquare(ctx, life) {
  const { L, occ, paint } = ctx;
  const Q = SQUARE;
  // the lawn inside the square's sidewalks (Main is wider than the side streets)
  const x0 = Q.minX + 8.3,
    x1 = Q.maxX - 14,
    z0 = Q.minZ + 8.3,
    z1 = Q.maxZ - 8.3;
  const cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2;
  occ.add({ x: cx, z: cz, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, yaw: 0 }, 'square');
  // the courthouse in the middle, facing Main Street
  const th = pickId(L, ['town_hall', 'clock_tower']);
  const tt = L.lib.byId.get(th);
  const hx = cx - 4;
  L.put(th, hx, cz, { yaw: Math.PI / 2 });
  const front = hx + tt.dims[2] / 2; // its east face
  paint.push((b) => {
    // front plaza from the courthouse steps to the Main Street sidewalk; walks from the corners and sides
    b.rect((front + x1) / 2, cz, x1 - front, 16, 0, SK.plaza, { P: [1.6], C: ['concrete', 'stone', 'ink_soft'], uv0: [0, 8] });
    const walk = (ax, az, bx, bz, w = 3) => b.rect((ax + bx) / 2, (az + bz) / 2, w, Math.hypot(bx - ax, bz - az), Math.atan2(bx - ax, bz - az), SK.drive, { C: ['concrete', 'concrete', 'stone'] });
    const hwz = tt.dims[0] / 2 + 3,
      hwx = tt.dims[2] / 2 + 3;
    walk(x0, z0, hx - hwx, cz - hwz);
    walk(x0, z1, hx - hwx, cz + hwz);
    walk(front, cz - 8, x1, z0, 3);
    walk(front, cz + 8, x1, z1, 3);
    walk(hx, z0, hx, cz - hwz);
    walk(hx, z1, hx, cz + hwz);
    walk(x0, cz, hx - hwx, cz);
    // a walk round the building
    b.rect(hx, cz - hwz, hwx * 2 + 3, 3, 0, SK.drive, { C: ['concrete', 'concrete', 'stone'] });
    b.rect(hx, cz + hwz, hwx * 2 + 3, 3, 0, SK.drive, { C: ['concrete', 'concrete', 'stone'] });
    b.rect(hx - hwx, cz, 3, hwz * 2 - 3, 0, SK.drive, { C: ['concrete', 'concrete', 'stone'] });
  });
  // the veterans' memorial and the flag in the front plaza, a fountain; the bandstand on the lawn
  L.put('statue', front + 14, cz, { yaw: Math.PI / 2, tint: 'caramel' }); // a bronze soldier
  L.put('gazebo', x0 + 20, z1 - 20, { yaw: 0.6 });
  L.put('town_fountain', x0 + 18, z0 + 18);
  // canopy trees round the lawn, clear of the walks
  for (let k = 0; k < 40; k++) {
    const t = k / 40;
    // perimeter walk at 6 m inside the sidewalk
    const per = 2 * (x1 - x0 + z1 - z0 - 24);
    let d = t * per;
    let x, z;
    const W = x1 - x0 - 12,
      D = z1 - z0 - 12;
    if (d < W) [x, z] = [x0 + 6 + d, z0 + 6];
    else if ((d -= W) < D) [x, z] = [x1 - 6, z0 + 6 + d];
    else if ((d -= D) < W) [x, z] = [x1 - 6 - d, z1 - 6];
    else [x, z] = [x0 + 6, z1 - 6 - (d - W)];
    if (Math.abs(z - cz) < 12 && x > front) continue;
    if (Math.abs(x - hx) < 6 || Math.abs(z - cz) < 5) continue;
    if (Math.hypot(x - x0, z - z0) < 8 || Math.hypot(x - x0, z - z1) < 8 || Math.hypot(x - x1, z - z0) < 8 || Math.hypot(x - x1, z - z1) < 8) continue;
    if (k % 3 === 1) continue;
    L.put('tree_round', x, z, { scale: L.range(1.35, 1.7) });
  }
  for (const [dx, dz, a] of [[10, -10, 0], [10, 10, Math.PI], [-24, -12, 0.4], [-24, 12, 2.7], [22, -18, 0], [22, 18, Math.PI]]) {
    L.put('park_bench', hx + dx, cz + dz, { yaw: a });
    // someone sitting on most of them
    if (L.rand() < 0.75) L.put(L.pick(['person_grandpa', 'person_adult', 'person_adult2']), hx + dx + Math.sin(a) * 0.4, cz + dz + Math.cos(a) * 0.4, { yaw: a });
  }
  flock(L, life, front + 10, cz + 4, 9);
  // people on the square: round the walk that rings the courthouse, and along the diagonals to the corners
  {
    const hwz = tt.dims[0] / 2 + 3,
      hwx = tt.dims[2] / 2 + 3;
    const ring = [[hx - hwx, cz - hwz], [hx + hwx, cz - hwz], [hx + hwx, cz + hwz], [hx - hwx, cz + hwz], [hx - hwx, cz - hwz]];
    spawnLoopWalkers(L, life, ring, 14);
    for (const [ax, az, bx2, bz2] of [[x0, z0, hx - hwx, cz - hwz], [x0, z1, hx - hwx, cz + hwz], [front, cz - 8, x1, z0], [front, cz + 8, x1, z1]])
      spawnLoopWalkers(L, life, [[ax, az], [bx2, bz2], [bx2 + 0.8, bz2], [ax + 0.8, az]], 4);
  }
  flock(L, life, x0 + 26, z0 + 26, 5);
  // people strolling the walks round the courthouse
  const hwz = tt.dims[0] / 2 + 3,
    hwx = tt.dims[2] / 2 + 3;
  spawnLoopWalkers(L, life, [[hx - hwx, cz - hwz], [front + 3, cz - hwz], [front + 3, cz + hwz], [hx - hwx, cz + hwz], [hx - hwx, cz - hwz]], 6);
  spawnLoopWalkers(L, life, [[x0 + 2, z0 + 2], [hx - hwx, cz - hwz], [hx - hwx, cz + hwz], [x0 + 2, z1 - 2], [x0 + 2, z0 + 2]], 4);
}

function depot(ctx, life) {
  const { L, occ } = ctx;
  // the depot faces Front Street with its platform on the eastbound track
  const id = pickId(L, ['depot_station', 'shop_b']);
  const t = L.lib.byId.get(id);
  const z = id === 'depot_station' ? RAIL_Z + TRACK + 6.35 : RAIL_Z + TRACK + 8 + t.dims[2] / 2;
  const x = MAIN_X + 34;
  L.put(id, x, z, { yaw: 0 });
  occ.add({ x, z, hw: t.dims[0] / 2, hd: t.dims[2] / 2, yaw: 0 }, 'bld');
  for (let k = 0; k < 6; k++) L.put(pickId(L, ['person_adult', 'person_business']), x - 12 + k * 4.5, RAIL_Z + TRACK + 2.6, { yaw: Math.PI + L.range(-0.4, 0.4) });
  // the co-op grain elevator and its bins on the siding across the tracks
  const ge = pickId(L, ['grain_elevator', 'grain_silo']);
  const gt = L.lib.byId.get(ge);
  const gz = RAIL_Z - TRACK - 7 - gt.dims[2] / 2;
  for (const [gx, id2] of [[MAIN_X - 60, ge], [MAIN_X - 80, 'grain_silo'], [MAIN_X - 94, 'grain_silo'], [MAIN_X - 108, 'grain_silo']]) {
    const tt = L.lib.byId.get(id2);
    const r = { x: gx, z: gz, hw: tt.dims[0] / 2, hd: tt.dims[2] / 2, yaw: 0 };
    if (occ.hits(r)) continue;
    occ.add(r, 'bld');
    L.put(id2, gx, gz, { yaw: 0 });
  }
  // level crossings: flashers both sides of every road over the tracks
  const crossings = (ctx.crossings = []);
  for (const e of net.edges) {
    if (e.cls === 'rail' || !e.paint) continue;
    for (let k = 1; k < e.poly.length; k++) {
      const [ax, az] = e.poly[k - 1],
        [bx, bz] = e.poly[k];
      if ((az - RAIL_Z) * (bz - RAIL_Z) >= 0) continue;
      const x = ax + ((RAIL_Z - az) / (bz - az)) * (bx - ax);
      const off = e.w / 2 + 1.4;
      const lights = [],
        gates = [];
      for (const side of [-1, 1]) {
        // flashers on the right of each approach, the gate arm reaching across that approach's lane
        const px = x + side * off,
          pz = RAIL_Z + side * (TRACK + 6);
        const it = L.put(pickId(L, ['crossing_signal', 'stop_sign']), px, pz, { yaw: side > 0 ? 0 : Math.PI });
        if (it) lights.push(it);
        const g = L.lib.byId.has('crossing_gate') ? L.put('crossing_gate', px, pz, { yaw: 0 }) : null;
        if (g) gates.push({ it: g, hx: px - side * 0.4, hy: 1.1, hz: pz, yaw: side > 0 ? Math.PI : 0 });
      }
      crossings.push({ x, z: RAIL_Z, lights, gates });
    }
  }
}

function angledParking(ctx) {
  const { L } = ctx;
  const ids = ['car', 'suv', 'hatchback', 'car'].filter((i) => L.lib.byId.has(i));
  for (const e of net.edges) {
    if (e.parking !== 'angled') continue;
    const inner = e.w / 2 - 5.5;
    const dx = (e.poly[1][0] - e.poly[0][0]) / e.len,
      dz = (e.poly[1][1] - e.poly[0][1]) / e.len;
    for (const side of [1, -1]) {
      // painted bays repeat every BAY m along the kerb (streets.js); a car sits centred in its bay
      const BAY = 4.2;
      for (let k = Math.ceil(((e.trimA || 0) + 6) / BAY); BAY * (k + 1) - 2.2 < e.len - (e.trimB || 0) - 4; k++) {
        // one car per bay, a bit under half the bays taken
        if (L.rand() > 0.45) continue;
        const u = inner + 2.75;
        const vc = BAY * (k + 1) - 2.75 * 0.8;
        const x = e.poly[0][0] + dx * vc - dz * u * side,
          z = e.poly[0][1] + dz * vc + dx * u * side;
        const ax = -dz * side * 1 + dx * -0.8,
          az = dx * side * 1 + dz * -0.8;
        const id = L.pick(ids);
        L.put(id, x, z, { yaw: L.along(id, Math.atan2(ax, az)) + (L.rand() < 0.9 ? 0 : Math.PI), tint: L.pick(PARKED_TINTS) });
      }
    }
  }
}

function mainStreetFurniture(ctx) {
  const { L } = ctx;
  for (const e of net.edges) {
    if (e.tag !== 'main') continue;
    const dx = (e.poly[1][0] - e.poly[0][0]) / e.len,
      dz = (e.poly[1][1] - e.poly[0][1]) / e.len;
    const s0 = (e.trimA || 0) + 4,
      s1 = e.len - (e.trimB || 0) - 4;
    for (const side of [1, -1]) {
      const at = (s, off) => [e.poly[0][0] + dx * s - dz * off * side, e.poly[0][1] + dz * s + dx * off * side];
      const yaw = Math.atan2(-dz * side, dx * side);
      for (let s = s0 + 4; s < s1; s += 22) {
        const [x, z] = at(s, e.w / 2 + 0.6);
        L.put(pickId(L, ['town_lamp', 'street_lamp']), x, z, { yaw });
      }
      for (let s = s0 + 13; s < s1 - 6; s += 22) {
        const [x, z] = at(s, e.w / 2 + 0.7);
        const r = L.rand();
        if (r < 0.35) L.put('planter', x, z, { scale: 0.8 });
        else if (r < 0.6) L.put('park_bench', x, z, { yaw: yaw + Math.PI / 2 });
        else if (r < 0.75) L.put(pickId(L, ['bike_rack', 'planter']), x, z, { yaw: yaw + Math.PI / 2 });
        else if (r < 0.85) L.put(pickId(L, ['newspaper_box', 'planter']), x, z, { yaw: yaw + Math.PI / 2 });
        else L.put(pickId(L, ['parking_meter', 'planter']), x, z);
      }
      // a fire hydrant and a mailbox near each corner
      L.put(pickId(L, ['fire_hydrant', 'planter']), ...at(s0 + 1.5, e.w / 2 + 0.6));
    }
  }
}

function alleys(ctx) {
  const { occ, paint } = ctx;
  const runs = [];
  const zs = [...MAIN_Z, HWY_Z];
  for (let i = 0; i < WEST_X.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) runs.push([(WEST_X[i] + WEST_X[i + 1]) / 2, zs[j] + 8.3, zs[j + 1] - 8.3]);
  const ez = [...MAIN_Z, HWY_Z];
  for (let i = 0; i < EAST_X.length - 1; i++) for (let j = 0; j < ez.length - 1; j++) runs.push([(EAST_X[i] + EAST_X[i + 1]) / 2, ez[j] + 8.3, ez[j + 1] - 8.3]);
  for (const [x, z0, z1] of runs) {
    occ.add({ x, z: (z0 + z1) / 2, hw: 2.2, hd: (z1 - z0) / 2, yaw: 0 }, 'alley');
    paint.push((b) => b.rect(x, (z0 + z1) / 2, 4, z1 - z0, 0, SK.solid, { C: ['stone'], y: -0.02 }));
  }
}

function rearParking(ctx) {
  const { occ, paint } = ctx;
  // municipal lots behind the Main Street stores, reached from the cross streets
  const zs = [...MAIN_Z, HWY_Z];
  for (let j = 0; j < zs.length - 2; j++) {
    if (zs[j] === SQUARE.minZ) continue;
    for (const [xa, xb] of [[MAIN_X - 14 - 17, SQUARE.minX + 8.3 + 1], [MAIN_X + 14 + 17, Math.min(waterX(zs[j]), waterX(zs[j + 1])) - 8.3 - 1]]) {
      const lo = Math.min(xa, xb),
        hi = Math.max(xa, xb);
      for (let w = Math.min(30, hi - lo); w >= 22; w -= 4) {
        let placed = false;
        for (let d = Math.min(70, zs[j + 1] - zs[j] - 26); d >= 36; d -= 12) {
          const cx = xa < xb ? xa + w / 2 : xa - w / 2,
            cz = (zs[j] + zs[j + 1]) / 2;
          const r = { x: cx, z: cz, hw: w / 2, hd: d / 2, yaw: 0 };
          if (occ.hits(r)) continue;
          occ.add(r, 'parking');
          parkingLot(ctx, cx, cz, w, d, 0, { fill: 0.45, tints: PARKED_TINTS });
          // driveway from the cross street
          const zA = zs[j] + 8.3;
          paint.push((b) => b.rect(cx, (zA + cz - d / 2) / 2, 6, cz - d / 2 - zA, 0, SK.drive, { C: ['charcoal', 'charcoal', 'stone'] }));
          placed = true;
          break;
        }
        if (placed) break;
      }
    }
  }
}

function riverfront(ctx, life) {
  const { L, occ, paint } = ctx;
  // Water Street's river side: a park along the bank with a path, trees, benches and a boat landing
  const zA = -290,
    zB = 210;
  const path = [];
  for (let z = zA; z <= zB; z += 6) {
    const r = riverAt(z);
    path.push([r.x - r.hw - BANK - 7, z]);
  }
  paint.push((b) => b.ribbon(path, path.map(() => 1.5), SK.path, { P: [1.5], C: ['sand', 'caramel'], y: -0.02 }));
  for (let k = 1; k < path.length; k++) {
    const [ax, az] = path[k - 1],
      [bx, bz] = path[k];
    occ.add({ x: (ax + bx) / 2 - 5, z: (az + bz) / 2, hw: 13, hd: 3.5, yaw: 0 }, 'park');
  }
  for (let z = zA + 8; z < zB; z += 17) {
    const r = riverAt(z);
    const edge = r.x - r.hw - BANK;
    L.put(L.rand() < 0.75 ? 'tree_round' : 'street_tree', edge - 14 - L.range(0, 5), z + L.range(-3, 3), { scale: L.range(1.1, 1.5) });
    if (L.rand() < 0.45) L.put('park_bench', edge - 4.5, z + 6, { yaw: Math.PI / 2 });
    if (L.rand() < 0.2) L.put(pickId(L, ['town_lamp', 'street_lamp']), edge - 9.5, z + 9);
  }
  // anglers on the bank
  for (const z of [-250, -120, 60, 150]) {
    const r = riverAt(z);
    L.put(pickId(L, ['person_grandpa', 'person_adult']), r.x - r.hw - 1, z, { yaw: Math.PI / 2 });
  }
  // the boat landing: a timber dock with rowboats tied up
  const lz = -60;
  const r = riverAt(lz);
  const dx0 = r.x - r.hw - BANK;
  paint.push((b) => {
    b.rect(dx0 + 10, lz, 20, 3, 0, SK.solid, { C: ['caramel'], y: 0.05 });
    b.rect(dx0 + 18.5, lz + 6, 3, 12, 0, SK.solid, { C: ['caramel'], y: 0.05 });
  });
  L.put(pickId(L, ['rowboat', 'canoe']), dx0 + 12, lz + 3.2, { yaw: Math.PI / 2 });
  L.put(pickId(L, ['canoe', 'rowboat']), dx0 + 16, lz + 10, { yaw: 0 });
  L.put(pickId(L, ['rowboat', 'canoe']), dx0 + 8, lz - 3.2, { yaw: Math.PI / 2 });
  spawnLoopWalkers(L, life, [...path, ...path.slice().reverse().map(([x, z]) => [x - 0.8, z])], 12);
  // canoes and a rowboat out on the town reach
  for (const [z, k] of [[-200, 0], [-20, 1], [150, 2]]) {
    const r = riverAt(z);
    const loop = [];
    for (let j = 0; j <= 16; j++) loop.push([r.x + Math.sin((j / 16) * Math.PI * 2) * r.hw * 0.45, z + Math.cos((j / 16) * Math.PI * 2) * 45]);
    const it = L.put(pickId(L, [k === 1 ? 'rowboat' : 'canoe', 'rowboat']), loop[0][0], loop[0][1]);
    if (it) life.movers.push({ its: [it], offs: [0], route: loop, speed: 1.4, s: k * 30, kind: 'boat' });
  }
  flock(L, life, dx0 - 10, 120, 6);
}

function mill(ctx, life) {
  const { L, occ, paint } = ctx;
  // the mill sits on the east bank just below the Mill Road bridge, its wheel turning in the current
  const z = -518;
  const r = riverAt(z);
  const edge = r.x + r.hw;
  const mid = pickId(L, ['mill', 'red_barn']);
  const mt = L.lib.byId.get(mid);
  const mx = edge + 3.5;
  L.put(mid, mx, z, { yaw: -Math.PI / 2 });
  occ.add({ x: mx + 2, z, hw: mt.dims[0] / 2, hd: mt.dims[2] / 2, yaw: -Math.PI / 2 }, 'bld');
  if (L.lib.byId.has('water_wheel')) {
    // wheel at mill-local (x -7, z +5.325); facing -x, local x -> world +z, local +z -> world -x
    const it = L.put('water_wheel', mx - 5.325, z - 7, { yaw: -Math.PI / 2, y: 0.5 });
    if (it) life.spinners.push({ it, axis: 'z', rate: -0.6 });
  }
  // the weir upstream that feeds it: a line of white water across the river
  const wz = -540;
  const wr = riverAt(wz);
  paint.push((b) => b.rect(wr.x, wz, wr.hw * 2, 2.4, 0.08, SK.solid, { C: ['cloud'], y: -0.15 }));
}

function landmarks(ctx) {
  const { L, occ } = ctx;
  const put = (id, x, z, yaw, tint) => {
    const t = L.lib.byId.get(id);
    if (!t) return null;
    const r = { x, z, hw: t.dims[0] / 2 + 1, hd: t.dims[2] / 2 + 1, yaw };
    if (occ.hits(r)) return null;
    occ.add(r, 'bld');
    return L.put(id, x, z, { yaw, tint });
  };
  const ch = L.lib.byId.get('church');
  // First Methodist faces Oak Avenue; St. Mary's faces Cedar Street on the east bank
  if (ch) {
    put('church', -400 + 8.3 + 4 + ch.dims[2] / 2, 155, -Math.PI / 2);
    put('church', 410 - 8.3 - 4 - ch.dims[2] / 2, -105, Math.PI / 2, 'brick');
  }
  const lb = L.lib.byId.get('library');
  if (lb) put('library', -280 - 8.3 - 4 - lb.dims[2] / 2, -105, Math.PI / 2);
  const po = L.lib.byId.get('post_office');
  if (po) put('post_office', -235, -170 - 8.3 - 3 - po.dims[2] / 2, 0);
}

function highwayStrip(ctx, life) {
  const { L, occ } = ctx;
  // Route 9 west of Main: the gas station at the corner, the diner, the motel, the farm co-op, the water tower
  const place = (id, x, z, yaw) => {
    const t = L.lib.byId.get(id);
    if (!t) return null;
    const r = { x, z, hw: t.dims[0] / 2, hd: t.dims[2] / 2, yaw };
    if (occ.hits(r)) return null;
    occ.add(r, 'bld');
    return L.put(id, x, z, { yaw });
  };
  const S1 = HWY_Z + 12.2; // south side property line
  place('petrol_station', MAIN_X - 30, S1 + 4 + 7.5, Math.PI);
  place(pickId(L, ['diner', 'cafe']), -250, S1 + 6 + 4.5, Math.PI);
  parkingLot(ctx, -250, S1 + 6 + 9 + 12, 30, 16, 0, { fill: 0.5, tints: PARKED_TINTS });
  place(pickId(L, ['motel', 'shop_a']), -400, S1 + 6 + 6, Math.PI);
  parkingLot(ctx, -400, S1 + 6 + 12 + 10, 40, 14, 0, { fill: 0.4, tints: PARKED_TINTS });
  place('water_tower', -520, S1 + 40, 0);
  place('billboard', -680, HWY_Z - 20, Math.PI / 2 + 0.55); // angled to face eastbound drivers
  place('billboard', 640, HWY_Z + 20, -Math.PI / 2 + 0.55);
  // the farm co-op and the feed store on the east edge of town
  place(pickId(L, ['red_barn', 'shop_b']), 600, S1 + 14, Math.PI);
  place('grain_silo', 625, S1 + 14);
  place('grain_silo', 640, S1 + 14);
}

function eastBank(ctx, life) {
  const { L, occ, paint } = ctx;
  // the high school on Second Street with its ball field behind it
  const sch = L.lib.byId.get('school_building');
  if (sch) {
    const sx = 205,
      sz = -170 - 8.3 - 8 - sch.dims[2] / 2;
    const r = { x: sx, z: sz, hw: sch.dims[0] / 2 + 2, hd: sch.dims[2] / 2 + 2, yaw: 0 };
    if (!occ.hits(r)) {
      occ.add(r, 'bld');
      L.put('school_building', sx, sz, { yaw: 0 });
      L.put(pickId(L, ['flagpole', 'street_lamp']), sx, sz + sch.dims[2] / 2 + 5);
      // ball diamond and outfield
      const fz = sz - sch.dims[2] / 2 - 46;
      const fr = { x: sx, z: fz, hw: 40, hd: 40, yaw: 0 };
      if (!occ.hits(fr)) {
        occ.add(fr, 'park');
        paint.push((b) => {
          b.rect(sx, fz + 14, 26, 26, Math.PI / 4, SK.dirt, { C: ['sand', 'caramel'] });
          b.rect(sx, fz + 14, 17, 17, Math.PI / 4, SK.solid, { C: ['leaf'], y: 0.01 });
        });
        for (let k = 0; k < 8; k++) {
          const it = L.put(pickId(L, ['person_teen', 'person_kid']), sx + L.range(-20, 20), fz + L.range(-10, 30));
          if (it) life.grazers.push({ it, cx: sx, cz: fz + 8, yaw: 0, hw: 24, hd: 22, speed: 2, still: 0.4 });
        }
        parkingLot(ctx, sx + 70, sz, 36, 30, 0, { fill: 0.6, tints: PARKED_TINTS });
        L.put(pickId(L, ['school_bus', 'city_bus']), sx - 34, sz + sch.dims[2] / 2 + 3, { yaw: Math.PI / 2 });
      }
    }
  }
  // the fairground north of Mill Road: midway, rides, the big top, 4-H barns, a crowd
  const F = FAIR;
  const fcx = (F.minX + F.maxX) / 2,
    fcz = (F.minZ + F.maxZ) / 2;
  occ.add({ x: fcx, z: fcz, hw: (F.maxX - F.minX) / 2, hd: (F.maxZ - F.minZ) / 2, yaw: 0 }, 'fair');
  const midZ = fcz + 10;
  paint.push((b) => {
    b.rect(fcx, midZ, F.maxX - F.minX - 40, 26, 0, SK.dirt, { C: ['sand', 'caramel'] });
    b.rect(F.minX + 30, F.maxZ - 30, 28, 52, 0, SK.dirt, { C: ['sand', 'caramel'] });
  });
  // fence along the front with the gate on Mill Road
  const fence = pickId(L, ['picket_fence', 'ranch_fence']);
  fenceLine(L, fence, F.minX + 5, F.maxZ - 3, F.minX + 16, F.maxZ - 3, { dedupe: ctx.fences });
  fenceLine(L, fence, F.minX + 44, F.maxZ - 3, F.maxX - 5, F.maxZ - 3, { dedupe: ctx.fences });
  if (L.lib.byId.has('ferris_wheel_frame') && L.lib.byId.has('ferris_wheel_ring')) {
    L.put('ferris_wheel_frame', F.maxX - 70, midZ - 34, { yaw: 0 });
    const rt = L.lib.byId.get('ferris_wheel_ring');
    const it = L.put('ferris_wheel_ring', F.maxX - 70, midZ - 34, { yaw: 0, y: FERRIS_AXLE - rt.dims[1] / 2 });
    if (it) life.spinners.push({ it, axis: 'z', rate: 0.15 });
  } else L.put('ferris_wheel', F.maxX - 70, midZ - 34, { yaw: 0 });
  const car = L.put('carousel', fcx - 30, midZ - 30);
  if (car) life.spinners.push({ it: car, axis: 'y', rate: 0.5 });
  L.put('circus_tent', F.minX + 70, midZ - 40);
  for (let k = 0; k < 4; k++) L.put(pickId(L, ['red_barn', 'garden_shed']), fcx + 30 + k * 20, F.minZ + 18, { yaw: 0 });
  for (let k = 0; k < 12; k++) L.put(pickId(L, ['lemonade_stand', 'ice_cream_van']), F.minX + 60 + k * 22, midZ + 17, { yaw: Math.PI });
  for (let k = 0; k < 6; k++) L.put('ice_cream_van', F.minX + 90 + k * 40, midZ - 17, { yaw: 0 });
  for (let k = 0; k < 50; k++) {
    const id = L.pick(['person_adult', 'person_adult2', 'person_kid', 'person_teen', 'person_grandpa'].filter((i) => L.lib.byId.has(i)));
    const it = L.put(id, fcx + L.range(-170, 170), midZ + L.range(-11, 11));
    if (it) life.grazers.push({ it, cx: fcx, cz: midZ, yaw: 0, hw: 175, hd: 11, speed: 1.1, still: 0.3 });
  }
  // fair parking: a grass lot full of pickups
  const lot = [];
  for (let x = F.minX + 70; x < F.maxX - 30; x += 6) if (L.rand() < 0.6) lot.push(x);
  for (const x of lot) {
    const id = L.pick(PARKED.filter((i) => L.lib.byId.has(i)));
    L.put(id, x, F.maxZ - 14, { yaw: L.along(id, 0), tint: L.pick(PARKED_TINTS) });
  }
}

const FERRIS_AXLE = 19;

function lake(ctx, life) {
  const { L, occ, paint } = ctx;
  // the marina at the end of Lake Road: boathouse, docks with boats, a lighthouse on the point
  const bulb = { x: 232, z: 560 };
  const shoreA = Math.atan2(-1, 0.08); // facing the lake from the marina
  const [sx, sz] = lakeAt(shoreA, 0);
  paint.push((b) => {
    b.rect((bulb.x + sx) / 2 + 6, sz, sx - bulb.x - 4, 4, 0, SK.drive, { C: ['caramel', 'caramel', 'cocoa'], y: -0.1 });
    // docks run from up on the bank out into the water, so none starts afloat where the shore curves away
    for (let k = 0; k < 3; k++) b.rect(sx + 12, sz - 24 + k * 22, 52, 3, 0, SK.solid, { C: ['caramel'], y: 0.05 });
  });
  for (let k = 0; k < 3; k++)
    for (let j = 0; j < 4; j++) {
      const id = L.pick(['sailboat', 'fishing_boat', pickId(L, ['rowboat', 'sailboat']), pickId(L, ['canoe', 'rowboat'])].filter((i) => L.lib.byId.has(i)));
      L.put(id, sx + 4 + j * 9, sz - 24 + k * 22 + (j % 2 ? 4 : -4), { yaw: Math.PI / 2 });
    }
  const bh = pickId(L, ['boathouse', 'garden_shed']);
  L.put(bh, bulb.x + 4, bulb.z - 34, { yaw: Math.PI / 2 });
  occ.add({ x: bulb.x + 4, z: bulb.z - 34, hw: 8, hd: 8, yaw: 0 }, 'bld');
  parkingLot(ctx, bulb.x - 30, bulb.z - 34, 30, 22, 0, { fill: 0.5, tints: PARKED_TINTS });
  // beachgoers on the north shore
  const [bx, bz] = lakeAt(Math.PI * 0.9, 7);
  for (let k = 0; k < 10; k++) {
    const it = L.put(L.pick(['person_kid', 'person_adult', 'person_teen', 'person_adult2'].filter((i) => L.lib.byId.has(i))), bx + L.range(-30, 30), bz + L.range(-3, 3));
    if (it) life.grazers.push({ it, cx: bx, cz: bz, yaw: 0, hw: 32, hd: 3, speed: 1, still: 0.5 });
  }
  // the lakeside park: shade trees and picnic tables round the shore, clear of the beach
  for (let k = 0; k < 110; k++) {
    const a = L.range(0, Math.PI * 2);
    const [x, z] = lakeAt(a, L.range(20, 60));
    const r = { x, z, hw: 1.8, hd: 1.8, yaw: 0 };
    if (occ.hits(r)) continue;
    occ.add(r, 'park');
    L.put(L.pick(['tree_round', 'tree_round', 'pine_tree']), x, z, { scale: L.range(1, 1.5), tint: L.pick(['leaf', 'pine', 'lime', 'leaf']) });
  }
  for (let k = 0; k < 14; k++) {
    const a = Math.PI * 0.75 + L.range(0, Math.PI * 0.5);
    const [x, z] = lakeAt(a, L.range(18, 26));
    const r = { x, z, hw: 1.5, hd: 1.5, yaw: 0 };
    if (occ.hits(r)) continue;
    occ.add(r, 'park');
    L.put(L.rand() < 0.7 ? 'picnic_table' : 'bbq_grill', x, z, { yaw: L.range(0, 3) });
  }
  // sailboats tacking about
  // (concentric loops, so boats on different loops never sail through each other)
  for (let k = 0; k < 7; k++) {
    const cx = LAKE.x + 30,
      cz = LAKE.z + 10;
    const loop = [];
    for (let j = 0; j <= 24; j++) loop.push([cx + Math.sin((j / 24) * 6.283) * (34 + k * 13), cz + Math.cos((j / 24) * 6.283) * (24 + k * 10)]);
    const id = L.pick(['sailboat', 'sailboat', 'fishing_boat', pickId(L, ['canoe', 'sailboat'])].filter((i) => L.lib.byId.has(i)));
    const it = L.put(id, loop[0][0], loop[0][1]);
    if (it) life.movers.push({ its: [it], offs: [0], route: loop, speed: 2 + (k % 3), s: k * 20, kind: 'boat' });
  }
  // a barge and a tug working the river from the north woods down to the lake and back
  const up = RIVER.map(([x, z, w]) => [x - w * 0.18, z]);
  const down = RIVER.slice().reverse().map(([x, z, w]) => [x + w * 0.18, z]);
  for (const [id, s0] of [[pickId(L, ['river_barge', 'fishing_boat']), 0], [pickId(L, ['tugboat', 'fishing_boat']), 1500]]) {
    const it = L.put(id, up[0][0], up[0][1]);
    if (it) life.movers.push({ its: [it], offs: [0], route: [...up, ...down], speed: 4, s: s0, kind: 'boat' });
  }
  // the bridges (if a bridge model is missing, pave the span so the road doesn't stop at the water)
  if (L.lib.byId.has('road_bridge')) {
    L.put('road_bridge', riverAt(HWY_Z).x, HWY_Z, { yaw: 0, y: -4.05 });
    L.put('road_bridge', riverAt(MILL_Z).x, MILL_Z, { yaw: 0, y: -4.05 });
  } else {
    for (const e of net.edges) if (!e.paint && e.cls !== 'rail') paint.push((b) => b.strip(e.poly, e.L, -e.w / 2, e.w / 2, 0, e.len, SK.road, { P: [e.w / 2, e.lanes, 1, 0], Q: [0, e.len, 0, 0], C: ['charcoal', 'paper', 'sun'], y: 0.05 }));
  }
  if (L.lib.byId.has('rail_bridge')) L.put('rail_bridge', riverAt(RAIL_Z).x, RAIL_Z, { yaw: 0, y: -4.05 });
  flock(L, life, bx + 40, bz - 10, 6, { id: pickId(L, ['pigeon']) });
  // ducks off the beach and in the marina's lee
  ducks(L, life, LAKE.x - 135, LAKE.z - 10, 12, 8, { n: 6, y: -0.2 });
  ducks(L, life, LAKE.x - 125, LAKE.z + 40, 9, 6, { n: 4, phase: 1.5, y: -0.2 });
  ducks(L, life, LAKE.x + 30, LAKE.z + 10, 12, 8, { n: 1, speed: 0.3, y: -0.2 });
}

function trains(ctx, life) {
  const { L, lib } = ctx;
  // a loop out along the eastbound track and back along the westbound one (the turn is off the map)
  const E = S + 140;
  const route = [[-E, RAIL_Z + TRACK], [E, RAIL_Z + TRACK], [E + 40, RAIL_Z], [E, RAIL_Z - TRACK], [-E, RAIL_Z - TRACK], [-E - 40, RAIL_Z], [-E, RAIL_Z + TRACK]];
  let len = 0;
  for (let k = 1; k < route.length; k++) len += Math.hypot(route[k][0] - route[k - 1][0], route[k][1] - route[k - 1][1]);
  const consists = [
    { cars: ['locomotive', 'hopper_car', 'hopper_car', 'hopper_car', 'freight_car', 'tank_car', 'tank_car', 'hopper_car', 'freight_car', 'freight_car', 'caboose'], s: 0, speed: 14 },
    { cars: ['locomotive', 'train_carriage', 'train_carriage', 'train_carriage', 'train_carriage'], s: len / 2, speed: 14 },
  ];
  for (const c of consists) {
    const its = [],
      offs = [];
    let o = 0;
    for (const id0 of c.cars) {
      const id = pickId(L, [id0, 'train_carriage']);
      const t = lib.byId.get(id);
      if (!t) continue;
      its.push(L.put(id, route[0][0], route[0][1]));
      offs.push(o + t.dims[0] / 2);
      o += t.dims[0] + 0.6;
    }
    life.movers.push({ its, offs, route, speed: c.speed, s: c.s + o, loop: true, kind: 'train' });
  }
}

// ------------------------------------------------------------------ farms
/** nearest point on a road centreline */
function nearestRoad(x, z) {
  let best = { d: Infinity, x: 0, z: 0 };
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
      const qx = ax + dx * t,
        qz = az + dz * t;
      const d = Math.hypot(qx - x, qz - z);
      if (d < best.d) best = { d, x: qx, z: qz, e };
    }
  }
  return best;
}

// low-contrast crops: corn, beans, wheat stubble, hay (no candy stripes)
const CROPS = [['leaf', 'lime'], ['sand', 'butter'], ['pine', 'leaf'], ['lime', 'leaf'], ['caramel', 'sand'], ['butter', 'sand']];

function farms(ctx, life) {
  const { L, occ } = ctx;
  // riparian woods along the river outside town
  for (const [x, z, w] of RIVER) {
    if (z > MILL_Z - 10 && z < HWY_Z + 16) continue;
    if (z < -S - 40 || z > S) continue;
    for (const side of [-1, 1]) {
      if (L.rand() < 0.35) continue;
      const tx = x + side * (w / 2 + BANK + L.range(3, 26)),
        tz = z + L.range(-3, 3);
      const r = { x: tx, z: tz, hw: 1.6, hd: 1.6, yaw: 0 };
      if (occ.hits(r)) continue;
      occ.add(r, 'tree');
      L.put(L.pick(['tree_round', 'tree_round', 'pine_tree']), tx, tz, { scale: L.range(1, 1.5) });
    }
  }
  // the farm belt, region by region (each one bounded by roads, the river or the town)
  const regions = [
    [-750, -644, -750, -568],
    [-750, -644, -552, -479],
    [-750, -644, -461, 318],
    [-750, -644, 343, 750],
    [-636, -578, -461, 318],
    [-636, -150, -750, -568],
    [-50, 296, -750, -568],
    [578, 750, -552, 318],
    [-636, 56, 343, 556],
    [-636, 270, 565, 750],
    [64, 250, 343, 556],
    [256, 750, 343, 750],
  ];
  ctx.farmsteads = 0;
  for (const [x0, x1, z0, z1] of regions) fieldRegion(ctx, life, x0, x1, z0, z1);
  // and beyond the map, the same countryside to the horizon (clear of the river)
  countryside(ctx, net, { inner: S, outer: S + 900, avoid: (x, z, h) => z < -S && Math.abs(x - riverAt(z).x) < riverAt(z).hw + h + 20 });
  // woods in the leftovers, away from the roads
  woods(ctx, { minX: -S, maxX: S, minZ: -S, maxZ: S }, { count: 260, ids: ['pine_tree', 'tree_round', 'pine_tree'], scale: [1, 1.5], minRoadDist: 40, net });
}

function fieldRegion(ctx, life, X0, X1, Z0, Z1) {
  const { L, occ, paint } = ctx;
  const W = X1 - X0,
    D = Z1 - Z0;
  // fields of uneven size (quarter sections split by inheritance and sales), not a checkerboard
  const edges = (a, b, base) => {
    const e = [a];
    while (b - e[e.length - 1] > base * 1.6) e.push(e[e.length - 1] + base * L.range(0.55, 1.45));
    e.push(b);
    return e;
  };
  const XS = edges(X0, X1, 105),
    ZS = edges(Z0, Z1, 115);
  const nx = XS.length - 1,
    nz = ZS.length - 1;
  // a dirt farm track down a column boundary of the wider regions
  let trackX = null;
  if (nx >= 2) {
    trackX = XS[Math.floor(nx / 2)];
    const runs = [];
    let a = null;
    for (let z = Z0 + 2; z <= Z1 - 2; z += 4) {
      const free = !occ.hits({ x: trackX, z, hw: 2.5, hd: 2, yaw: 0 });
      if (free && a === null) a = z;
      if ((!free || z + 4 > Z1 - 2) && a !== null) {
        if (z - a > 30) runs.push([a, z]);
        a = null;
      }
    }
    for (const [za, zb] of runs) {
      occ.add({ x: trackX, z: (za + zb) / 2, hw: 2.5, hd: (zb - za) / 2, yaw: 0 }, 'track');
      paint.push((b) => b.rect(trackX, (za + zb) / 2, 4, zb - za, 0, SK.dirt, { C: ['caramel', 'sand'], y: -0.12 }));
    }
  }
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      let x0 = XS[i] + 0.8,
        x1 = XS[i + 1] - 0.8,
        z0 = ZS[j] + 0.8,
        z1 = ZS[j + 1] - 0.8;
      if (trackX !== null && Math.abs(x0 - 0.8 - trackX) < 0.1) x0 += 2.2;
      if (trackX !== null && Math.abs(x1 + 0.8 - trackX) < 0.1) x1 -= 2.2;
      // a farmstead in some cells that front a road
      const cx = (x0 + x1) / 2,
        cz = (z0 + z1) / 2;
      const nr = nearestRoad(cx, cz);
      if (nr.d < Math.max(x1 - x0, z1 - z0) / 2 + 18 && ctx.farmsteads++ % 3 === 0 && farmstead(ctx, life, x0, x1, z0, z1, nr)) continue;
      // otherwise the biggest piece of the cell that's free: whole, halves, then quarters
      const hx = (x1 - x0) / 2,
        hz = (z1 - z0) / 2;
      const tries = [
        [x0, x1, z0, z1],
        [x0, cx - 0.8, z0, z1],
        [cx + 0.8, x1, z0, z1],
        [x0, x1, z0, cz - 0.8],
        [x0, x1, cz + 0.8, z1],
        [x0, cx - 0.8, z0, cz - 0.8],
        [cx + 0.8, x1, z0, cz - 0.8],
        [x0, cx - 0.8, cz + 0.8, z1],
        [cx + 0.8, x1, cz + 0.8, z1],
      ];
      const done = [];
      for (const t of tries) {
        if (t[1] - t[0] < 24 || t[3] - t[2] < 24) continue;
        if (done.some((d) => t[0] < d[1] && t[1] > d[0] && t[2] < d[3] && t[3] > d[2])) continue;
        const r = { x: (t[0] + t[1]) / 2, z: (t[2] + t[3]) / 2, hw: (t[1] - t[0]) / 2, hd: (t[3] - t[2]) / 2, yaw: 0 };
        if (occ.hits(r)) continue;
        occ.add(r, 'field');
        field(ctx, life, r.x, r.z, r.hw * 2, r.hd * 2);
        done.push(t);
        if (done.length && t === tries[0]) break;
      }
      void hx;
      void hz;
    }
}

function field(ctx, life, cx, cz, w, d) {
  const { L, paint, fences } = ctx;
  const kind = L.rand();
  // hedgerow along the west or north edge of some fields
  if (L.rand() < 0.4) {
    const along = L.rand() < 0.5;
    const n = Math.floor((along ? w : d) / 8);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = along ? cx - w / 2 + w * t : cx - w / 2;
      const z = along ? cz - d / 2 : cz - d / 2 + d * t;
      L.put(L.rand() < 0.65 ? 'tree_round' : 'pine_tree', x + L.range(-0.8, 0.8), z + L.range(-0.8, 0.8), { scale: L.range(0.9, 1.3) });
    }
  }
  if (kind < 0.66) {
    // crop rows; a combine working some of them
    const [a, b] = L.pick(CROPS);
    const rot = w > d ? Math.PI / 2 : 0;
    paint.push((bb) => bb.rect(cx, cz, w, d, rot, SK.field, { P: [2.2], C: [a, b], y: -0.15 }));
    if (L.rand() < 0.15) L.put('scarecrow', cx + L.range(-w / 4, w / 4), cz + L.range(-d / 4, d / 4), { yaw: L.range(0, 6) });
    if ((ctx.combines || 0) < 6 && L.rand() < 0.22 && L.lib.byId.has('combine_harvester')) {
      ctx.combines = (ctx.combines || 0) + 1;
      const route = [];
      const n = Math.max(3, Math.floor((w - 16) / 12));
      for (let k = 0; k <= n; k++) {
        const x = cx - w / 2 + 8 + (k * (w - 16)) / n;
        route.push(k % 2 ? [x, cz + d / 2 - 8] : [x, cz - d / 2 + 8]);
        route.push(k % 2 ? [x, cz - d / 2 + 8] : [x, cz + d / 2 - 8]);
      }
      route.push(...route.slice().reverse());
      const it = L.put('combine_harvester', route[0][0], route[0][1]);
      if (it) life.movers.push({ its: [it], offs: [0], route, speed: 2.2, kind: 'combine' });
    }
  } else if (kind < 0.84) {
    // pasture: ranch fence all round with a gate, stock grazing
    const f = pickId(L, ['ranch_fence', 'picket_fence']);
    const c = [[cx - w / 2 + 1, cz - d / 2 + 1], [cx + w / 2 - 1, cz - d / 2 + 1], [cx + w / 2 - 1, cz + d / 2 - 1], [cx - w / 2 + 1, cz + d / 2 - 1]];
    for (let k = 0; k < 4; k++) fenceLine(L, f, c[k][0], c[k][1], c[(k + 1) % 4][0], c[(k + 1) % 4][1], { dedupe: fences, gaps: k === 0 ? [[w / 2 - 4, w / 2 + 4]] : [] });
    const animal = L.pick(['cow', 'cow', 'sheep', 'horse', 'cow']);
    const n = animal === 'horse' ? 5 + Math.floor(L.rand() * 4) : 10 + Math.floor(L.rand() * 10);
    const hcx = cx + L.range(-w / 5, w / 5),
      hcz = cz + L.range(-d / 5, d / 5);
    for (let k = 0; k < n; k++) {
      // the herd stays together
      const it = L.put(animal, hcx + L.range(-14, 14), hcz + L.range(-14, 14), { yaw: L.range(0, 6.28), tint: animal === 'horse' ? L.pick(['cocoa', 'caramel', 'charcoal']) : undefined });
      if (it) life.grazers.push({ it, cx, cz, yaw: 0, hw: w / 2 - 5, hd: d / 2 - 5, speed: animal === 'horse' ? 1.2 : 0.35, still: 0.75 });
    }
  } else if (kind < 0.94) {
    // hay: mown stripes with bales in rows
    paint.push((bb) => bb.rect(cx, cz, w, d, 0, SK.field, { P: [6], C: ['butter', 'lime'], y: -0.15 }));
    for (let x = cx - w / 2 + 10; x < cx + w / 2 - 6; x += 18) for (let z = cz - d / 2 + 10; z < cz + d / 2 - 6; z += 22) if (L.rand() < 0.6) L.put('hay_bale', x + L.range(-2, 2), z + L.range(-2, 2), { yaw: L.range(0, 3) });
  } else {
    // an orchard: one variety in rows
    const orchard = L.pick(['leaf', 'lime', 'pine']);
    for (let x = cx - w / 2 + 6; x < cx + w / 2 - 4; x += 9) for (let z = cz - d / 2 + 6; z < cz + d / 2 - 4; z += 9) L.put('tree_round', x, z, { scale: L.range(0.55, 0.7), tint: orchard });
  }
}

function farmstead(ctx, life, x0, x1, z0, z1, nr) {
  const { L, occ, paint } = ctx;
  // the road side of the cell (snapped to an axis)
  const cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2;
  let ux = nr.x - cx,
    uz = nr.z - cz;
  if (Math.abs(ux) > Math.abs(uz)) [ux, uz] = [Math.sign(ux), 0];
  else [ux, uz] = [0, Math.sign(uz)];
  const px = -uz,
    pz = ux; // along the road
  const half = ux ? (x1 - x0) / 2 : (z1 - z0) / 2; // cell half-depth from the road
  const span = ux ? (z1 - z0) / 2 : (x1 - x0) / 2;
  if (half < 40 || span < 36) return false;
  // farmyard strip 64 m deep on the road side
  const yd = 64;
  const yc = [cx + ux * (half - yd / 2), cz + uz * (half - yd / 2)];
  const yard = { x: yc[0], z: yc[1], hw: ux ? yd / 2 : span, hd: ux ? span : yd / 2, yaw: 0 };
  if (occ.hits(yard)) return false;
  occ.add(yard, 'farm');
  const at = (a, b) => [cx + ux * a + px * b, cz + uz * a + pz * b]; // a: towards the road, b: along it
  const face = Math.atan2(ux, uz);
  const sb = L.range(-span * 0.3, span * 0.3);
  // house near the road, barn and silos behind, machine shed, shelterbelt of pines behind and on one side
  const house = pickId(L, ['farmhouse', 'house_c']);
  L.put(house, ...at(half - 20, sb), { yaw: face });
  L.put('red_barn', ...at(half - 44, sb + 16), { yaw: face + Math.PI / 2 });
  L.put('grain_silo', ...at(half - 46, sb + 32));
  if (L.rand() < 0.6) L.put('grain_silo', ...at(half - 36, sb + 34));
  L.put(pickId(L, ['garage', 'garden_shed']), ...at(half - 40, sb - 16), { yaw: face, scale: 1.4 });
  if (L.rand() < 0.7) L.put('tractor', ...at(half - 30, sb - 10), { yaw: face + L.range(-1, 1) });
  const pick = L.pick(['pickup_truck', 'pickup_truck', 'suv'].filter((i) => L.lib.byId.has(i)));
  L.put(pick, ...at(half - 10, sb + 5), { yaw: L.along(pick, face), tint: L.pick(PARKED_TINTS) });
  L.put('mailbox', ...at(half - 1, sb + 4), { yaw: face });
  for (let k = -5; k <= 5; k++) L.put('pine_tree', ...at(half - yd + 3, sb + k * 7 + L.range(-1, 1)), { scale: L.range(1, 1.3) });
  for (let k = 0; k < 6; k++) L.put('pine_tree', ...at(half - yd + 10 + k * 7, sb - 38), { scale: L.range(1, 1.3) });
  L.put('tree_round', ...at(half - 12, sb - 14), { scale: 1.4 });
  L.put('tree_round', ...at(half - 26, sb + 30), { scale: 1.3 });
  // gravel drive to the road
  const [dx, dz] = at(half - 4, sb + 5);
  paint.push((b) => b.rect(dx, dz, ux ? 18 : 4, ux ? 4 : 18, 0, SK.dirt, { C: ['caramel', 'sand'], y: -0.12 }));
  // chickens scratching about the yard
  const [fx, fz] = at(half - 30, sb + 6);
  flock(L, life, fx, fz, 5);
  // the windmill on the first farm
  if (!ctx.windmill && L.lib.byId.has('windmill_tower') && L.lib.byId.has('windmill_sails')) {
    ctx.windmill = true;
    const [wx, wz] = at(half - 30, sb - 32);
    const yaw = face + 0.4;
    L.put('windmill_tower', wx, wz, { yaw });
    const st = L.lib.byId.get('windmill_sails');
    const it = L.put('windmill_sails', wx + Math.sin(yaw) * WINDMILL_FWD, wz + Math.cos(yaw) * WINDMILL_FWD, { yaw, y: WINDMILL_AXLE - st.dims[1] / 2 });
    if (it) life.spinners.push({ it, axis: 'z', rate: 0.5 });
  }
  // the rest of the cell is cropland
  const rest = half * 2 - yd - 1.6;
  if (rest > 24) {
    const [fcx, fcz] = at(half - yd - 0.8 - rest / 2, 0);
    const w = ux ? rest : span * 2,
      d = ux ? span * 2 : rest;
    const r = { x: fcx, z: fcz, hw: w / 2, hd: d / 2, yaw: 0 };
    if (!occ.hits(r)) {
      occ.add(r, 'field');
      field(ctx, life, fcx, fcz, w, d);
    }
  }
  return true;
}
const WINDMILL_AXLE = 14.4, // tower axle height (asset report)
  WINDMILL_FWD = 5; // sails sit this far in front of the tower centre

// review views (tests/city_review.mjs)
export const review = {
  play: [
    { name: 'main_street', x: MAIN_X - 4, z: 160, yaw: Math.PI },
    { name: 'square', x: -200, z: 70, yaw: Math.PI, d: 10 },
    { name: 'residential', x: -400, z: 20, yaw: Math.PI, d: 14 },
    { name: 'depot', x: MAIN_X, z: -400, yaw: Math.PI, d: 30 },
    { name: 'riverfront', x: waterX(-60) + 4, z: 10, yaw: Math.PI, d: 20 },
    { name: 'bridge', x: 60, z: HWY_Z, yaw: Math.PI / 2, d: 40 },
    { name: 'farms', x: -640, z: 200, yaw: Math.PI, d: 60 },
  ],
  aerial: [
    { name: 'downtown', pos: [-20, 220, 300], look: [-200, 0, -60] },
    { name: 'river', pos: [420, 300, -260], look: [60, 0, -100] },
    { name: 'farms', pos: [-300, 260, 700], look: [-560, 0, 300] },
    { name: 'lake', pos: [150, 220, 250], look: [450, 0, 560] },
  ],
  map: { cx: 0, cz: 0, half: 760 },
  maps: [{ name: 'downtown', cx: -150, cz: -100, half: 260 }],
  motion: [
    { name: 'main_st', pos: [-150, 40, 75], look: [-150, 0, -20] },
    { name: 'rail_crossing', pos: [-100, 60, -400], look: [-150, 0, -470], waitTrain: [-150, RAIL_Z] },
    { name: 'lake', pos: [330, 90, 380], look: [470, 0, 560] },
    { name: 'square', pos: [-215, 60, 135], look: [-215, 0, 20] },
  ],
};
