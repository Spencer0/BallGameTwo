// Level 6 — The Big Tidy: a city modelled on Manhattan (CITY.md §2).
// A long island between two rivers: one-way avenues north-south, cross streets every 150 m, a diagonal
// "Broadway" from the park's south-west corner making bow-tie squares (the midtown one is a plaza of
// screens), a 600 x 900 m central park, two height peaks (midtown, downtown) with brownstones and
// tenements on the side streets between, shore drives, piers, three bridges to a row-house borough with
// an elevated train and a stadium, a container port and an airport across the west river, a harbour with
// a statue island. Everything is on one connected road network; traffic, crowds, ferries, planes move.
import { Layout } from './layout.js';
import { Network } from './city/network.js';
import { paintNetwork } from './city/surface.js';
import { Occupancy, occupyNetwork, frameAt, local, fillFrontage, fenceLine } from './city/frontage.js';
import { SK } from '../render/streets.js';
import { pickId, woods, parkingLot } from './city/suburb.js';
import { lifeSpec, spawnTraffic, spawnWalkers, spawnLoopWalkers, trafficLights, flock } from './city/lifespec.js';

const S = 2200;
const SHORE = 800; // island half-width
const TIP0 = 1250,
  TIP1 = 1860; // the island narrows to its tip between these
const DRIVE_IN = 55; // shore drive distance inside the shoreline
const AVE_X = [-600, -300, 0, 300, 600];
const STREET_Z = [];
for (let z = -2150; z <= 1700; z += 150) STREET_Z.push(z);
const PARK = { minX: -300, maxX: 300, minZ: -1550, maxZ: -650 };
const TRANSVERSE = [-1250, -950];
const PD = 45; // park drive inset
const BROADWAY = { x0: -300, z0: -650, x1: 600, z1: 1500 };
const EAST_X0 = 1200; // east bank shoreline
const WEST_X0 = -1250; // west bank shoreline
const BRIDGES_Z = [1150, 550, -200];
const BORO_AVE = [1300, 1500, 1700, 1900, 2100];
const BORO_Z = [];
for (let z = -2125; z <= 1250; z += 125) BORO_Z.push(z);
for (const z of BRIDGES_Z) if (!BORO_Z.includes(z)) BORO_Z.push(z);
BORO_Z.sort((a, b) => a - b);
const ELEVATED_X = 1500; // the elevated train runs above this borough avenue

export const islandHalf = (z) => (z < TIP0 ? SHORE : SHORE * Math.sqrt(Math.max(0, 1 - ((z - TIP0) / (TIP1 - TIP0)) ** 2)));
const driveX = (z) => Math.max(0, islandHalf(z) - DRIVE_IN);

function buildNet() {
  const net = new Network();
  const N = (x, z, o) => net.at(x, z, 0.5, o);
  // --- shore drives: chains through every street end, round the tip
  const zs = STREET_Z.filter((z) => driveX(z) > 120);
  const west = [N(-driveX(-2300), -2300, { exit: true })],
    east = [N(driveX(-2300), -2300, { exit: true })];
  for (const z of zs) {
    west.push(N(-driveX(z), z));
    east.push(N(driveX(z), z));
  }
  // tip arc: points round the end of the island, inside the shore
  const zLast = zs[zs.length - 1];
  const tipPts = [];
  const steps = 14;
  for (let k = 1; k < steps; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / steps; // -90..+90 deg
    const rz = TIP1 - DRIVE_IN - zLast;
    tipPts.push([Math.sin(a) * driveX(zLast), zLast + Math.cos(a) * rz]);
  }
  for (let k = 0; k < west.length - 1; k++) net.edge(west[k], west[k + 1], { cls: 'highway', name: 'West Side Highway', walk: 0 });
  for (let k = 0; k < east.length - 1; k++) net.edge(east[k + 1], east[k], { cls: 'highway', name: 'East River Drive', walk: 0 });
  net.edge(west[west.length - 1], east[east.length - 1], { cls: 'highway', name: 'Battery Drive', pts: tipPts, walk: 0 });
  // --- Broadway crossings
  const bw = (t) => [BROADWAY.x0 + (BROADWAY.x1 - BROADWAY.x0) * t, BROADWAY.z0 + (BROADWAY.z1 - BROADWAY.z0) * t];
  const bwZ = (x) => BROADWAY.z0 + ((x - BROADWAY.x0) / (BROADWAY.x1 - BROADWAY.x0)) * (BROADWAY.z1 - BROADWAY.z0);
  const bwX = (z) => BROADWAY.x0 + ((z - BROADWAY.z0) / (BROADWAY.z1 - BROADWAY.z0)) * (BROADWAY.x1 - BROADWAY.x0);
  const onBw = (z) => z >= BROADWAY.z0 - 1 && z <= BROADWAY.z1 + 1;
  // --- avenues: one-way, alternating; stop at the park
  AVE_X.forEach((x, k) => {
    const pts = [];
    for (const z of STREET_Z) {
      if (Math.abs(x) > driveX(z) - 30) continue;
      if (x > PARK.minX && x < PARK.maxX && z > PARK.minZ && z < PARK.maxZ && !TRANSVERSE.includes(z)) continue;
      pts.push(z);
    }
    for (const xx of [x]) if (xx > BROADWAY.x0 && xx <= BROADWAY.x1) pts.push(bwZ(xx));
    pts.sort((a, b) => a - b);
    const nodes = [N(x, -2300, { exit: true }), ...pts.map((z) => N(x, z))];
    const north = k % 2 === 0; // alternate: even avenues run north (towards -z)
    for (let j = 0; j < nodes.length - 1; j++) {
      const za = net.nodes[nodes[j]].z,
        zb = net.nodes[nodes[j + 1]].z;
      // the park interrupts the middle avenue
      if (x > PARK.minX && x < PARK.maxX && za >= PARK.minZ - 1 && zb <= PARK.maxZ + 1) continue;
      const a = nodes[j],
        b = nodes[j + 1];
      if (north) net.edge(b, a, { cls: 'avenue', name: `${['Eleventh', 'Ninth', 'Fifth', 'Third', 'First'][k]} Avenue` });
      else net.edge(a, b, { cls: 'avenue', name: `${['Eleventh', 'Ninth', 'Fifth', 'Third', 'First'][k]} Avenue` });
    }
  });
  // --- cross streets: one-way alternating, every fourth two-way crosstown; stop at the park except transverses
  STREET_Z.forEach((z, k) => {
    const half = driveX(z);
    if (half < 120) return;
    const xs = [-half, half, ...AVE_X.filter((x) => Math.abs(x) < half - 30)];
    if (TRANSVERSE.includes(z)) xs.push(PARK.minX + PD, PARK.maxX - PD); // they cross the park drive
    if (onBw(z)) xs.push(bwX(z));
    xs.sort((a, b) => a - b);
    const two = k % 4 === 0;
    const eastbound = k % 2 === 0;
    for (let j = 0; j < xs.length - 1; j++) {
      const xa = xs[j],
        xb = xs[j + 1];
      const inPark = z > PARK.minZ && z < PARK.maxZ && xa >= PARK.minX - 1 && xb <= PARK.maxX + 1;
      if (inPark && !TRANSVERSE.includes(z)) continue;
      const a = N(xa, z),
        b = N(xb, z);
      const opts = two || TRANSVERSE.includes(z) ? { cls: 'street', w: 14, walk: 5, verge: 0, name: `${k + 10}th St` } : { cls: 'crosstown', name: `${k + 10}th St` };
      if (two || TRANSVERSE.includes(z) || eastbound) net.edge(a, b, opts);
      else net.edge(b, a, opts);
    }
  });
  // --- Broadway: two-way boulevard through all its crossings
  const cross = [];
  for (const z of STREET_Z) if (onBw(z) && Math.abs(bwX(z)) < driveX(z) - 20) cross.push(bw((z - BROADWAY.z0) / (BROADWAY.z1 - BROADWAY.z0)));
  for (const x of AVE_X) if (x > BROADWAY.x0 && x <= BROADWAY.x1) cross.push([x, bwZ(x)]);
  cross.push([BROADWAY.x0, BROADWAY.z0]);
  cross.sort((p, q) => p[1] - q[1]);
  const bwNodes = [];
  for (const [x, z] of cross) {
    const id = N(x, z);
    if (bwNodes[bwNodes.length - 1] !== id) bwNodes.push(id);
  }
  // the blocks of Broadway either side of the Fifth Avenue crossing are a pedestrian plaza (Times Square)
  const px = 0,
    pz = bwZ(0);
  for (let j = 0; j < bwNodes.length - 1; j++) {
    const A = net.nodes[bwNodes[j]],
      B = net.nodes[bwNodes[j + 1]];
    const plaza = Math.hypot((A.x + B.x) / 2 - px, (A.z + B.z) / 2 - pz) < 110;
    net.edge(bwNodes[j], bwNodes[j + 1], { cls: 'boulevard', name: plaza ? 'Broadway Plaza' : 'Broadway', w: 18, traffic: !plaza, plaza });
  }
  // --- the park drive: a loop inside the park, crossed by the transverses, joined to the avenues at two gates
  const xw = PARK.minX + PD,
    xe = PARK.maxX - PD,
    zn = PARK.minZ + PD,
    zsth = PARK.maxZ - PD;
  const westSide = [zsth, -800, ...TRANSVERSE.slice().sort((a, b) => b - a), zn].map((z) => N(xw, z));
  const eastSide = [zn, -1400, ...TRANSVERSE.slice().sort((a, b) => a - b), zsth].map((z) => N(xe, z));
  const drive = { cls: 'lane', w: 9, walk: 0 };
  for (let j = 0; j < westSide.length - 1; j++) net.edge(westSide[j], westSide[j + 1], { ...drive, name: 'West Drive' });
  net.edge(westSide[westSide.length - 1], eastSide[0], { ...drive, name: 'Park Drive North' });
  for (let j = 0; j < eastSide.length - 1; j++) net.edge(eastSide[j], eastSide[j + 1], { ...drive, name: 'East Drive' });
  net.edge(eastSide[eastSide.length - 1], westSide[0], { ...drive, name: 'Park Drive South' });
  net.edge(N(PARK.minX, -800), N(xw, -800), { ...drive, name: 'Park Gate' });
  net.edge(N(xe, -1400), N(PARK.maxX, -1400), { ...drive, name: 'Park Gate' });
  // --- bridges to the east bank and the borough grid
  BRIDGES_Z.forEach((z, k) => {
    net.edge(N(driveX(z), z), N(BORO_AVE[0], z), { cls: 'boulevard', name: ['Brooklyn Bridge', 'Manhattan Bridge', 'Queensboro Bridge'][k], w: 20, walk: 0, y: 0.6 });
  });
  BORO_AVE.forEach((x, k) => {
    const nodes = [N(x, -2300, { exit: true }), ...BORO_Z.filter((z) => z < 1300).map((z) => N(x, z))];
    for (let j = 0; j < nodes.length - 1; j++) net.edge(nodes[j], nodes[j + 1], { cls: 'street', w: 12, walk: 3, verge: 0, name: `${k + 1} Ave (Boro)` });
  });
  for (const z of BORO_Z.filter((z) => z < 1300)) {
    const nodes = [...BORO_AVE.map((x) => N(x, z)), N(S + 100, z, { exit: true })];
    for (let j = 0; j < nodes.length - 1; j++) net.edge(nodes[j], nodes[j + 1], { cls: 'street', w: 10, walk: 3, verge: 0, name: 'Boro St' });
  }
  // --- west bank: shore road, airport road, port road
  const wNodes = [];
  for (let z = -2300; z <= 1250; z += 250) wNodes.push(N(WEST_X0 - 70, z, z === -2300 ? { exit: true } : z + 250 > 1250 ? { bulb: 18 } : {}));
  for (let j = 0; j < wNodes.length - 1; j++) net.edge(wNodes[j], wNodes[j + 1], { cls: 'arterial', name: 'Shore Road', walk: 0, verge: 0 });
  net.edge(N(WEST_X0 - 70, -800), N(-1440, -800, { bulb: 20 }), { cls: 'arterial', name: 'Airport Road', walk: 0, verge: 0 });
  net.edge(N(WEST_X0 - 70, -800 + 1000), N(-2100, 200), { cls: 'street', name: 'Freight Road', walk: 0, verge: 0 });
  net.edge(N(-2100, 200), N(-S - 100, 200, { exit: true }), { cls: 'street', name: 'Freight Road', walk: 0, verge: 0 });
  return net.build();
}

export const net = buildNet();

// ------------------------------------------------------------------ ground: water, island, banks, park
function landPolys(b) {
  const pts = [];
  for (let z = -S - 150; z < TIP0; z += 200) pts.push([-SHORE, z]);
  for (let k = 0; k <= 24; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / 24;
    pts.push([Math.sin(a) * SHORE, TIP0 + Math.cos(a) * (TIP1 - TIP0)]);
  }
  for (let z = TIP0 - 1; z > -S - 150; z -= 200) pts.push([SHORE, z]);
  // fan from the island's centre (convex enough per half: split into strips)
  for (let z = -S - 150; z < TIP0; z += 400) {
    const z1 = Math.min(TIP0, z + 400);
    b.poly([[-SHORE, z], [SHORE, z], [SHORE, z1], [-SHORE, z1]], SK.solid, { C: ['stone'], y: -1.2 });
  }
  const tip = [[-SHORE, TIP0]];
  for (let k = 0; k <= 24; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / 24;
    tip.push([Math.sin(a) * SHORE, TIP0 + Math.cos(a) * (TIP1 - TIP0)]);
  }
  b.poly(tip, SK.solid, { C: ['stone'], y: -1.2 });
  // banks
  b.poly([[-S - 400, -S - 400], [WEST_X0, -S - 400], [WEST_X0, 1300], [-S - 400, 1300]], SK.solid, { C: ['stone'], y: -1.2 });
  b.poly([[EAST_X0, -S - 400], [S + 400, -S - 400], [S + 400, 1350], [EAST_X0, 1350]], SK.solid, { C: ['stone'], y: -1.2 });
  b.disc(320, 2050, 70, SK.solid, { C: ['leaf'], y: -1.2 });
}

export const env = {
  sky: [
    [0, 'grape'],
    [0.42, 'flamingo'],
    [0.75, 'tangerine'],
    [1, 'butter'],
  ],
  fog: { near: 600, far: 1700, k: 70, color: '#FF9E7A' },
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: 20000, d: 20000, y: -2.5, pattern: 'water', a: 'cobalt', b: 'sky', cell: 30 },
    // central park lawns and lakes
    { x: (PARK.minX + PARK.maxX) / 2, z: (PARK.minZ + PARK.maxZ) / 2, w: PARK.maxX - PARK.minX - 12, d: PARK.maxZ - PARK.minZ - 12, y: -0.6, pattern: 'lawn', a: 'leaf', b: '#4DB86A', cell: 14 },
    { x: -60, z: -1380, r: 95, y: -0.4, pattern: 'water', a: 'cobalt', b: 'sky', cell: 12 },
    { x: 120, z: -820, r: 55, y: -0.4, pattern: 'water', a: 'cobalt', b: 'sky', cell: 10 },
    // borough park + stadium plaza
    { x: 1800, z: -1500, w: 300, d: 360, y: -0.6, pattern: 'solid', a: 'leaf' },
    // airport grass
    { x: -1830, z: -350, w: 560, d: 2000, y: -0.6, pattern: 'solid', a: '#8FCF4A' },
  ],
  streets: (b) => {
    landPolys(b);
    paintNetwork(b, net);
  },
  blocks: [
    { min: [-S - 50, -10, -S - 50], max: [S + 50, 10000, -S], visible: false },
    { min: [-S - 50, -10, S], max: [S + 50, 10000, S + 50], visible: false },
    { min: [-S - 50, -10, -S], max: [-S, 10000, S], visible: false },
    { min: [S, -10, -S], max: [S + 50, 10000, S], visible: false },
  ],
};

// Madame Prudence, city-sized, supervising from beyond the north end of the island
env.decor = [{ id: 'char__prudence', x: 400, y: 0, z: -2750, yaw: -0.15, scale: 300, size: 800 }];

export const bounds = { minX: -S, maxX: S, minZ: -S, maxZ: S };
export const spawn = { x: 170, z: 470, yaw: Math.PI };

// ------------------------------------------------------------------ zoning
// Height falls off from two cores (midtown, downtown); avenues and Broadway carry the bigger buildings,
// side streets the walk-ups; the park is lined with grand apartment houses; the borough is low-rise.
const SUPER = ['skyscraper_spire', 'skyscraper_deco', 'skyscraper_twist'];
const HIGH = ['highrise_glass', 'highrise_stone', 'office_block', 'apartment_tower'];
const MID = ['midrise_prewar', 'midrise_modern', 'midrise_deco', 'office_block', 'apartment_block'];
const WALKUP = ['brownstone', 'brownstone', 'brownstone', 'tenement', 'tenement'];
const SHOPS = ['shop_a', 'shop_b', 'cafe', 'bakery'];
const BORO = ['brownstone', 'brownstone', 'tenement', 'house_c', 'apartment_block', 'shop_a', 'shop_b'];
const CORES = [
  { x: 0, z: -150, r: 420 }, // midtown
  { x: 120, z: 1450, r: 380 }, // downtown
];

/** returns a picker (rand, avail) -> id list for a frontage at (x,z) on a road of class cls */
function zone(x, z, cls) {
  const avenue = cls === 'avenue' || cls === 'boulevard';
  if (x > EAST_X0) return { tiers: [[BORO, 1]], gap: 0 };
  if (cls === 'highway') return { tiers: [[MID, 1]], gap: 18 };
  let core = 0;
  for (const c of CORES) core = Math.max(core, Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / (2 * c.r * c.r)));
  const parkSide = z > PARK.minZ - 160 && z < PARK.maxZ + 160 && Math.abs(x) < 460;
  if (parkSide && avenue) return { tiers: [[['midrise_prewar', 'midrise_deco', 'highrise_stone'], 1]], gap: 0 };
  const a = avenue ? 1 : 0.45;
  return {
    tiers: [
      [SUPER, 0.5 * core * core * a],
      [HIGH, (0.9 * core + 0.08) * a],
      [MID, 0.55 * (avenue ? 1 : 0.6)],
      [WALKUP, avenue ? 0.05 : 0.9 * (1 - core)],
      [SHOPS, avenue ? 0.04 : 0.12],
    ],
    gap: 0,
  };
}

function zonePick(L, lib, zn, rem) {
  const tiers = zn.tiers.map(([ids, w]) => [ids.filter((id) => lib.byId.has(id) && lib.byId.get(id).dims[0] <= rem + 0.5), w]).filter(([ids, w]) => ids.length && w > 0);
  const total = tiers.reduce((t, [, w]) => t + w, 0);
  if (!total) return null;
  let r = L.rand() * total;
  for (const [ids, w] of tiers) {
    r -= w;
    if (r <= 0) return L.pick(ids);
  }
  return L.pick(tiers[tiers.length - 1][0]);
}

export function layout(lib, seed = 606) {
  const L = new Layout(lib, seed, { minX: -S + 20, maxX: S - 20, minZ: -S + 20, maxZ: S - 20 });
  L.setCell(60);
  const occ = new Occupancy(60);
  occupyNetwork(occ, net, 0.1);
  L.clear(spawn.x, spawn.z, 45);
  occ.add({ x: spawn.x, z: spawn.z, hw: 30, hd: 30, yaw: 0 }, 'spawn');
  const ctx = { L, occ, paint: L.paint, rand: L.rand, lib };
  const life = (L.life = lifeSpec(net));
  // reserved: the park, the plaza at the Broadway x Fifth crossing, the airport, the port, the stadium
  occ.add({ x: (PARK.minX + PARK.maxX) / 2, z: (PARK.minZ + PARK.maxZ) / 2, hw: (PARK.maxX - PARK.minX) / 2 - 4, hd: (PARK.maxZ - PARK.minZ) / 2 - 4, yaw: 0 }, 'park');

  // ---- street walls on every frontage
  const avail = (ids) => ids.filter((id) => lib.byId.has(id));
  const order = [...net.frontages].sort((a, b) => {
    const r = (f) => ({ avenue: 0, boulevard: 0, crosstown: 1, street: 1, highway: 2 })[net.edges[f.e].cls] ?? 3;
    return r(a) - r(b);
  });
  const roofTanks = [];
  for (const f of order) {
    const e = net.edges[f.e];
    if (e.cls === 'lane' || e.y > 0.1) continue; // park drives, bridges
    const mid = frameAt(f, f.L[f.L.length - 1] / 2);
    const [ix, iz] = local(mid, 0, -20);
    if (ix > PARK.minX && ix < PARK.maxX && iz > PARK.minZ && iz < PARK.maxZ) continue;
    if (Math.abs(ix) > SHORE + 5 && ix < EAST_X0) continue; // over water
    if (ix < WEST_X0) continue; // the west bank is port and airport
    const z = zone(ix, iz, e.cls);
    fillFrontage(L, occ, f, {
      pick: (rem) => zonePick(L, lib, z, rem),
      setback: 0.3,
      gap: () => z.gap + (L.rand() < 0.08 ? 4 : 0.4),
      step: 6,
      onPlace: (it) => {
        if ((it.id === 'tenement' || it.id === 'midrise_prewar') && L.rand() < 0.6) roofTanks.push(it);
      },
    });
  }
  // second pass: plug the gaps the big buildings left (corners, diagonal lots) with narrow ones
  const narrow = ['brownstone', 'tenement', 'shop_a', 'shop_b', 'cafe', 'bakery'].filter((id) => lib.byId.has(id));
  for (const f of order) {
    const e = net.edges[f.e];
    if (e.cls === 'lane' || e.y > 0.1 || e.cls === 'highway' || e.plaza) continue;
    const mid = frameAt(f, f.L[f.L.length - 1] / 2);
    const [ix, iz] = local(mid, 0, -20);
    if ((ix > PARK.minX && ix < PARK.maxX && iz > PARK.minZ && iz < PARK.maxZ) || (Math.abs(ix) > SHORE + 5 && ix < EAST_X0) || ix < WEST_X0) continue;
    fillFrontage(L, occ, f, {
      pick: (rem) => {
        const fit = narrow.filter((id) => lib.byId.get(id).dims[0] <= rem + 0.3);
        return fit.length ? L.pick(fit) : null;
      },
      setback: 0.3,
      gap: () => 0.3,
      step: 2,
    });
  }
  // block interiors: rear yards (green, trees) in the residential districts, paved courts in the cores
  const xsAll = [-SHORE, ...AVE_X, SHORE];
  for (let i = 0; i < xsAll.length - 1; i++) {
    for (let j = 0; j < STREET_Z.length - 1; j++) {
      const x0 = xsAll[i] + (i === 0 ? DRIVE_IN + 11 : 12) + 5,
        x1 = xsAll[i + 1] - (i + 1 === xsAll.length - 1 ? DRIVE_IN + 11 : 12) - 5;
      const z0 = STREET_Z[j] + 12,
        z1 = STREET_Z[j + 1] - 12;
      if (x1 - x0 < 20 || z1 - z0 < 20) continue;
      const cx = (x0 + x1) / 2,
        cz = (z0 + z1) / 2;
      if (cx > PARK.minX && cx < PARK.maxX && cz > PARK.minZ && cz < PARK.maxZ) continue;
      if (Math.abs(cx) > driveX(cz) - 20) continue;
      let core = 0;
      for (const c of CORES) core = Math.max(core, Math.exp(-((cx - c.x) ** 2 + (cz - c.z) ** 2) / (2 * c.r * c.r)));
      const green = core < 0.45;
      L.paint.push((b) => b.rect(cx, cz, x1 - x0, z1 - z0, 0, SK.solid, { C: [green ? 'pine' : 'concrete'], y: -0.3 }));
      for (let k = 0; k < (green ? 10 : 4); k++) {
        const x = L.range(x0 + 4, x1 - 4),
          z = L.range(z0 + 4, z1 - 4);
        const r = { x, z, hw: 2, hd: 2, yaw: 0 };
        if (occ.hits(r)) continue;
        occ.add(r, 'tree');
        L.put(pickId(L, ['street_tree', 'tree_round']), x, z, { scale: L.range(0.9, 1.3) });
      }
    }
  }
  // pocket plazas: the leftover wedges along Broadway become little squares with trees and benches
  for (const f of net.frontages) {
    const e = net.edges[f.e];
    if (e.name !== 'Broadway') continue;
    const len = f.L[f.L.length - 1];
    for (let s = 6; s < len - 6; s += 9) {
      const fr = frameAt(f, s);
      const [x, z] = local(fr, 0, -6);
      const r = { x, z, hw: 4.5, hd: 5.5, yaw: fr.yaw };
      if (occ.hits(r)) continue;
      occ.add(r, 'plaza');
      L.paint.push((b) => b.rect(x, z, 9, 11, fr.yaw, SK.plaza, { P: [1.6], C: ['concrete', 'cloud', 'stone'] }));
      const k = L.rand();
      if (k < 0.5) L.put(pickId(L, ['street_tree', 'tree_round']), x, z, { scale: 1.1 });
      else if (k < 0.75) L.put('park_bench', x, z, { yaw: fr.yaw });
      else if (k < 0.85) L.put(pickId(L, ['newsstand', 'hot_dog_cart']), x, z, { yaw: fr.yaw });
    }
  }
  for (const it of roofTanks) {
    const t = lib.byId.get(it.id);
    const tank = pickId(L, ['rooftop_water_tank', 'water_tower']);
    if (tank === 'water_tower') continue;
    const c = Math.cos(it.yaw),
      s = Math.sin(it.yaw);
    const ox = (L.rand() - 0.5) * t.dims[0] * 0.5,
      oz = -t.dims[2] * 0.25;
    L.putOn(it, tank, c * ox + s * oz, -s * ox + c * oz);
  }

  plaza(ctx, life);
  centralPark(ctx, life);
  waterfront(ctx, life);
  borough(ctx, life);
  westBank(ctx, life);
  streetFurniture(ctx);

  // ---- life
  trafficLights(L, life, net);
  const laneW = (l) => {
    const e = net.edges[l.e];
    return e.cls === 'avenue' || e.cls === 'boulevard' ? 3 : e.cls === 'highway' ? 2.5 : e.cls === 'lane' ? 0.6 : 1;
  };
  spawnTraffic(L, life, net, 420, [['taxi', 9], ['car', 4], ['suv', 3], ['hatchback', 2], ['city_bus', 1.2], ['delivery_van', 2], ['food_truck', 0.4], ['police_car', 0.6], ['ambulance', 0.3], ['limo', 0.5], ['garbage_truck', 0.4], ['fire_truck', 0.2], ['pickup_truck', 1]], { laneWeight: laneW, speed: 1 });
  const walkW = (w) => {
    const e = net.edges[w.e];
    const p = w.pts[0];
    const busy = p[1] > -700 && p[1] < 400 ? 3 : p[1] > 1000 ? 2 : 1;
    return (e.cls === 'avenue' || e.cls === 'boulevard' ? 1.6 : 1) * busy;
  };
  spawnWalkers(L, life, net, 560, { dogs: 0.08, joggers: 0.05, walkWeight: walkW });
  // the sky: helicopters circling midtown, a blimp over the stadium, the odd balloon, clouds for the end
  const ring = (cx, cz, r, n = 24) => {
    const p = [];
    for (let k = 0; k <= n; k++) p.push([cx + Math.sin((k / n) * Math.PI * 2) * r, cz + Math.cos((k / n) * Math.PI * 2) * r]);
    return p;
  };
  for (const [cx, cz, r, y, s] of [[0, -100, 380, 150, 0], [300, 1350, 300, 130, 900], [-100, -1100, 500, 180, 400]]) {
    const it = L.put('helicopter', cx + r, cz, { y });
    if (it) life.movers.push({ its: [it], offs: [0], route: ring(cx, cz, r), speed: 32, y, s, air: true, kind: 'heli' });
  }
  const blimp = L.put('blimp', 1800, -800, { y: 260 });
  if (blimp) life.movers.push({ its: [blimp], offs: [0], route: ring(1800, -1000, 260, 32), speed: 9, y: 260, air: true, kind: 'blimp' });
  for (let k = 0; k < 40; k++) L.put('fluffy_cloud', L.range(-S, S), L.range(-S, S), { y: L.range(480, 820), scale: L.range(0.8, 1.8), yaw: L.range(0, 6.28) });
  return L;
}

// ------------------------------------------------------------------ districts
function plaza(ctx, life) {
  const { L } = ctx;
  // Broadway Plaza: crowds milling on the pedestrianised blocks, carts, pigeons
  for (const e of net.edges) {
    if (!e.plaza) continue;
    const [ax, az] = e.poly[0],
      [bx, bz] = e.poly[e.poly.length - 1];
    const cx = (ax + bx) / 2,
      cz = (az + bz) / 2;
    const yaw = Math.atan2(bx - ax, bz - az);
    const hd = Math.max(4, e.len / 2 - (e.trimA + e.trimB) / 2 - 6),
      hw = e.w / 2 + e.walk - 1;
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    const at = (lx, lz) => [cx + c * lx + s * lz, cz - s * lx + c * lz];
    for (let k = 0; k < 3; k++) {
      const [x, z] = at(L.range(-hw * 0.6, hw * 0.6), L.range(-hd * 0.8, hd * 0.8));
      L.put(pickId(L, ['hot_dog_cart', 'newsstand', 'phone_booth']), x, z, { yaw: yaw + (L.rand() < 0.5 ? 0 : Math.PI) });
    }
    const [fx, fz] = at(0, 0);
    flock(L, life, fx, fz, 8, { r: 5 });
    for (let k = 0; k < 22; k++) {
      const id = L.pick(['person_adult', 'person_adult2', 'person_kid', 'person_business', 'person_teen'].filter((i) => L.lib.byId.has(i)));
      const [x, z] = at(L.range(-hw, hw), L.range(-hd, hd));
      const it = L.put(id, x, z);
      if (it) life.grazers.push({ it, cx, cz, yaw, hw, hd, speed: 1.1, still: 0.5 });
    }
  }
}

function centralPark(ctx, life) {
  const { L, paint, occ } = ctx;
  const P = PARK;
  // paths: a looping footpath ring inside the drive, meadow paths, the lakes
  const ring = [];
  const inset = 75;
  const x0 = P.minX + inset,
    x1 = P.maxX - inset,
    z0 = P.minZ + inset,
    z1 = P.maxZ - inset;
  for (let k = 0; k <= 40; k++) {
    const t = k / 40;
    const a = t * Math.PI * 2;
    ring.push([(x0 + x1) / 2 + Math.sin(a) * (x1 - x0) / 2 * 1.02, (z0 + z1) / 2 + Math.cos(a) * (z1 - z0) / 2 * 1.02]);
  }
  paint.push((b) => {
    const L2 = [0];
    for (let k = 1; k < ring.length; k++) L2.push(L2[k - 1] + Math.hypot(ring[k][0] - ring[k - 1][0], ring[k][1] - ring[k - 1][1]));
    b.strip(ring, L2, -3, 3, 0, L2[L2.length - 1], SK.path, { P: [3], C: ['sand', 'caramel'], y: 0 });
    // the great lawn's ball fields
    for (const [cx, cz] of [[60, -1080], [150, -1080]]) b.disc(cx, cz, 26, SK.solid, { C: ['caramel'], segs: 4, a0: Math.PI * 0.75, a1: Math.PI * 1.25 + Math.PI * 1.0, y: 0 });
  });
  spawnLoopWalkers(L, life, ring.slice(0, -1), 40);
  // trees in dense groves (the park is mostly woodland with meadows), avoiding lakes, drives and fields
  const clear = (x, z) =>
    Math.hypot(x + 60, z + 1380) < 105 ||
    Math.hypot(x - 120, z + 820) < 65 ||
    (x > 20 && x < 190 && z > -1120 && z < -1040) ||
    TRANSVERSE.some((tz) => Math.abs(z - tz) < 14) ||
    Math.abs(x - (P.minX + 45)) < 9 ||
    Math.abs(x - (P.maxX - 45)) < 9 ||
    Math.abs(z - (P.minZ + 45)) < 9 ||
    Math.abs(z - (P.maxZ - 45)) < 9;
  const groves = [];
  for (let k = 0; k < 16; k++) groves.push([L.range(P.minX + 30, P.maxX - 30), L.range(P.minZ + 30, P.maxZ - 30), L.range(35, 70)]);
  let planted = 0;
  for (let k = 0; k < 2000 && planted < 300; k++) {
    const [gx, gz, gr] = groves[k % groves.length];
    const a = L.rand() * Math.PI * 2,
      d = Math.sqrt(L.rand()) * gr;
    const x = gx + Math.sin(a) * d,
      z = gz + Math.cos(a) * d;
    if (x < P.minX + 12 || x > P.maxX - 12 || z < P.minZ + 12 || z > P.maxZ - 12 || clear(x, z)) continue;
    const id = L.rand() < 0.7 ? 'tree_round' : L.rand() < 0.6 ? 'pine_tree' : pickId(L, ['street_tree', 'tree_round']);
    L.put(id, x, z, { scale: L.range(2.4, 3.8) });
    planted++;
  }
  // woodland floor under the groves (reads as woods from above)
  paint.push((b) => {
    for (const [gx, gz, gr] of groves) b.disc(gx, gz, gr * 0.95, SK.solid, { C: ['pine'], y: -0.45, segs: 24 });
  });
  // winding footpaths across the meadows
  paint.push((b) => {
    for (const [ax, az, bx, bz, bend] of [[-250, -700, 250, -1500, 120], [-250, -1500, 220, -700, -140], [0, -660, -40, -1540, 90]]) {
      const pts = [];
      for (let k = 0; k <= 24; k++) {
        const t = k / 24;
        const nx = -(bz - az),
          nz = bx - ax;
        const l = Math.hypot(nx, nz);
        const off = Math.sin(t * Math.PI) * bend + Math.sin(t * Math.PI * 3) * 18;
        pts.push([ax + (bx - ax) * t + (nx / l) * off, az + (bz - az) * t + (nz / l) * off]);
      }
      const Lp = [0];
      for (let k = 1; k < pts.length; k++) Lp.push(Lp[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      b.strip(pts, Lp, -2.2, 2.2, 0, Lp[Lp.length - 1], SK.path, { P: [2.2], C: ['sand', 'caramel'], y: -0.1 });
    }
  });
  L.put(pickId(L, ['bandshell', 'gazebo']), 0, -980, { yaw: 0 });
  L.put('carousel', -150, -760);
  L.put('statue', -60, -1270, { yaw: 0 });
  for (let k = 0; k < 6; k++) L.put(pickId(L, ['rowboat', 'canoe']), -60 + L.range(-60, 60), -1380 + L.range(-50, 50), { yaw: L.range(0, 6) });
  for (let k = 0; k < 30; k++) L.put('park_bench', L.range(P.minX + 80, P.maxX - 80), L.range(P.minZ + 80, P.maxZ - 80), { yaw: L.range(0, 6) });
  flock(L, life, -150, -700, 9, { r: 6 });
  flock(L, life, 100, -1460, 8, { r: 5 });
  // horses and carriages on the park drive? a few horses grazing by the stables
  for (let k = 0; k < 4; k++) {
    const it = L.put('horse', 220 + L.range(-10, 10), -1480 + L.range(-10, 10));
    if (it) life.grazers.push({ it, cx: 220, cz: -1480, yaw: 0, hw: 18, hd: 14, speed: 1, still: 0.6 });
  }
}

function waterfront(ctx, life) {
  const { L, paint, occ } = ctx;
  // piers on the west shore, ferry terminal at the tip, the statue island, ships and ferries
  for (const z of [-1700, -1100, -500, 100, 700]) {
    paint.push((b) => b.rect(-SHORE - 60, z, 120, 34, 0, SK.plaza, { P: [4], C: ['stone', 'concrete', 'charcoal'], y: 0 }));
    L.put(pickId(L, ['pier_shed', 'container_stack']), -SHORE - 62, z, { yaw: -Math.PI / 2 });
  }
  L.put('cruise_ship', -SHORE - 70, -1410, { yaw: L.along('cruise_ship', Math.PI / 2) + Math.PI / 2 });
  L.put('giant_statue', 320, 2050, { yaw: Math.PI + 0.3 });
  L.put('lighthouse', -1200, 1500, { scale: 1.5 });
  // ferries: island tip <-> statue island <-> west bank, and across the east river
  const ferry = pickId(L, ['ferry', 'fishing_boat']);
  const routes = [
    { pts: [[0, TIP1 + 40], [200, 1980], [320, 1960], [200, 1980], [0, TIP1 + 40]], speed: 9 },
    { pts: [[-SHORE - 30, 400], [-1020, 420], [WEST_X0 + 30, 400], [-1020, 380], [-SHORE - 30, 400]], speed: 10 },
    { pts: [[SHORE + 30, 900], [1000, 920], [EAST_X0 - 30, 900], [1000, 880], [SHORE + 30, 900]], speed: 10 },
  ];
  for (const r of routes) {
    const it = L.put(ferry, r.pts[0][0], r.pts[0][1]);
    if (it) life.movers.push({ its: [it], offs: [0], route: r.pts, speed: r.speed, loop: true, pause: { points: [0, 2], time: 7 }, kind: 'boat' });
  }
  // the harbour: a cargo ship and tugs on slow loops, sailboats
  const harbour = [];
  for (let k = 0; k <= 32; k++) harbour.push([-200 + Math.sin((k / 32) * Math.PI * 2) * 700, 2050 + Math.cos((k / 32) * Math.PI * 2) * 120]);
  const cargo = L.put('cargo_ship', 500, 2050);
  if (cargo) life.movers.push({ its: [cargo], offs: [0], route: harbour, speed: 7, kind: 'boat' });
  for (let k = 0; k < 3; k++) {
    const tug = L.put(pickId(L, ['tugboat', 'fishing_boat']), 0, 2000);
    if (tug) life.movers.push({ its: [tug], offs: [0], route: harbour, speed: 6, s: 700 + k * 900, kind: 'boat' });
  }
  for (let k = 0; k < 10; k++) {
    const cx = L.range(-900, 900),
      cz = L.range(1950, 2150);
    const loop = [];
    for (let j = 0; j <= 12; j++) loop.push([cx + Math.sin((j / 12) * Math.PI * 2) * 60, cz + Math.cos((j / 12) * Math.PI * 2) * 30]);
    const it = L.put('sailboat', cx, cz);
    if (it) life.movers.push({ its: [it], offs: [0], route: loop, speed: 3, kind: 'boat' });
  }
  // river traffic: barges and tugs up and down both rivers
  for (const [x, dir] of [[-1020, 1], [1000, -1]]) {
    const route = [];
    for (let z = -2350; z <= 1700; z += 200) route.push([x + dir * 40, z]);
    for (let z = 1700; z >= -2350; z -= 200) route.push([x - dir * 40, z]);
    const its = [];
    for (let k = 0; k < 3; k++) {
      const it = L.put(pickId(L, ['river_barge', 'fishing_boat']), x, 0);
      if (it) life.movers.push({ its: [it], offs: [0], route, speed: 6, s: k * 2700, kind: 'boat' });
    }
  }
  // the bridges themselves
  const bridge = pickId(L, ['suspension_bridge', 'bridge_tower']);
  BRIDGES_Z.forEach((z) => {
    if (bridge === 'suspension_bridge') L.put(bridge, (SHORE + EAST_X0) / 2, z, { y: -5.4, yaw: 0 });
    else for (const x of [880, 1120]) L.put(bridge, x, z, { tint: 'sky' });
  });
  // a pier with a ferris wheel and a carousel on the east bank
  const fw = L.lib.byId.get('ferris_wheel_frame') ? 'split' : null;
  if (fw) {
    const frame = L.put('ferris_wheel_frame', EAST_X0 + 80, 1250, { yaw: Math.PI / 2 });
    const ringT = L.lib.byId.get('ferris_wheel_ring');
    const axle = L.lib.byId.get('ferris_wheel_frame').axle ?? 19;
    const ringIt = L.put('ferris_wheel_ring', EAST_X0 + 80, 1250, { yaw: Math.PI / 2, y: axle - ringT.dims[1] / 2 });
    if (ringIt) life.spinners.push({ it: ringIt, axis: 'z', rate: 0.12 });
  } else L.put('big_wheel', EAST_X0 + 90, 1250, { yaw: Math.PI / 2 });
}

function borough(ctx, life) {
  const { L, paint, occ } = ctx;
  // stadium + park in the north of the borough, factories by the water, the elevated train
  L.put('stadium', 1800, -1500, { yaw: 0 });
  occ.add({ x: 1800, z: -1500, hw: 150, hd: 180, yaw: 0 }, 'stadium');
  L.put('factory_chimneys', 1330, -600, { yaw: Math.PI / 2 });
  L.put('factory_chimneys', 1330, 200, { yaw: Math.PI / 2 });
  L.put('observation_tower', 1650, 300);
  L.put('museum_dome', 1900, 800, { yaw: -Math.PI / 2 });
  L.put('rocket_pad', 2050, -400);
  // elevated train: viaduct segments along the borough avenue, a train looping on top
  const via = L.lib.byId.get('elevated_viaduct');
  if (via) {
    const segL = via.dims[0];
    for (let z = -S + segL / 2; z < 1250; z += segL) L.put('elevated_viaduct', ELEVATED_X + 9, z, { yaw: Math.PI / 2 });
    const car = L.lib.byId.get('subway_car');
    if (car) {
      const route = [[ELEVATED_X + 7, -S - 200], [ELEVATED_X + 7, 1240], [ELEVATED_X + 11, 1240], [ELEVATED_X + 11, -S - 200]]; // the viaduct's two tracks, 2 m either side of its centre
      for (const s0 of [0, 3300]) {
        const its = [],
          offs = [];
        for (let k = 0; k < 4; k++) {
          its.push(L.put('subway_car', ELEVATED_X + 6, 0, { y: 8.5 }));
          offs.push(k * (car.dims[0] + 0.8));
        }
        life.movers.push({ its, offs, route, speed: 16, s: s0, y: 8.5, kind: 'train' });
      }
    }
  }
  // borough street walls handled by the frontage fill (zone BORO); people and pigeons in the park
  flock(L, life, 1800, -1240, 8, { r: 5 });
}

function westBank(ctx, life) {
  const { L, paint, occ } = ctx;
  // airport: runway, taxiway, terminal, tower, hangars, planes at the gates, one taking off on a loop
  const RX = -1830,
    R0 = -1300,
    R1 = 500;
  paint.push((b) => {
    b.rect(RX, (R0 + R1) / 2, 60, R1 - R0, 0, SK.runway, { P: [30, R1 - R0], C: ['charcoal', 'paper'], uv0: [0, (R1 - R0) / 2] });
    b.rect(RX + 120, (R0 + R1) / 2, 25, R1 - R0, 0, SK.asphalt, { C: ['charcoal'] });
    b.rect(RX + 260, -350, 240, 600, 0, SK.asphalt, { C: ['charcoal'] }); // apron
  });
  L.put(pickId(L, ['airport_terminal', 'parking_garage']), -1480, -350, { yaw: -Math.PI / 2 });
  L.put(pickId(L, ['control_tower', 'radio_mast']), -1560, -720);
  for (const z of [-1050, -950]) L.put(pickId(L, ['hangar', 'garage']), -1600, z, { yaw: -Math.PI / 2 });
  for (const z of [-560, -440, -320, -200]) L.put('airliner', -1600, z, { yaw: L.along('airliner', -Math.PI / 2) });
  // take-off loop: taxi up the taxiway, roll down the runway, climb out over the north, come round again
  const route = [
    [RX + 120, 450, 0],
    [RX + 120, -1250, 0],
    [RX, -1290, 0],
    [RX, 300, 0],
    [RX, 520, 25],
    [RX, 900, 160],
    [RX - 300, 1800, 420],
    [RX + 600, 2600, 600],
    [RX + 900, 3200, 600],
  ];
  for (const s0 of [0, 2200]) {
    const it = L.put('airliner', RX, 0);
    if (it) life.movers.push({ its: [it], offs: [0], route, speed: 38, s: s0, loop: false, pitch: true, kind: 'plane' });
  }
  // port: cranes on the quay, container stacks, ships at berth
  for (let k = 0; k < 6; k++) L.put('harbour_crane', WEST_X0 - 20, 850 + k * 70, { yaw: Math.PI / 2 });
  for (let k = 0; k < 24; k++) L.put('container_stack', -1450 - (k % 4) * 60, 820 + Math.floor(k / 4) * 70, { yaw: Math.PI / 2 * (k % 2) });
  L.put('cargo_ship', WEST_X0 + 40, 1000, { yaw: L.along('cargo_ship', 0) });
  L.put('container_stack', -1700, -1700);
  woods(ctx, { minX: -S, maxX: WEST_X0 - 120, minZ: -S, maxZ: -1500 }, { count: 160, ids: ['pine_tree', 'tree_round'], scale: [2.5, 4] });
}

function streetFurniture(ctx) {
  const { L } = ctx;
  // lamps on every avenue, trees on the side streets, hydrants, subway entrances at avenue corners
  for (const e of net.edges) {
    if (e.y > 0.1 || e.walk <= 0) continue;
    const big = e.cls === 'avenue' || e.cls === 'boulevard';
    const step = big ? 60 : 32;
    for (let s = step / 2; s < e.len - 10; s += step) {
      for (const side of [1, -1]) {
        const wk = side > 0 ? e.walkR : e.walkL;
        if (!wk || !wk.has || s < wk.s0 + 4 || s > wk.s1 - 4) continue;
        let k = 1;
        while (k < e.L.length - 1 && e.L[k] < s) k++;
        const t = (s - e.L[k - 1]) / (e.L[k] - e.L[k - 1] || 1);
        const dx = (e.poly[k][0] - e.poly[k - 1][0]) / (e.L[k] - e.L[k - 1] || 1),
          dz = (e.poly[k][1] - e.poly[k - 1][1]) / (e.L[k] - e.L[k - 1] || 1);
        const x = e.poly[k - 1][0] + (e.poly[k][0] - e.poly[k - 1][0]) * t,
          z = e.poly[k - 1][1] + (e.poly[k][1] - e.poly[k - 1][1]) * t;
        const off = side * (e.w / 2 + 1.1);
        const px = x - dz * off,
          pz = z + dx * off;
        if (Math.abs(px) > SHORE && px < EAST_X0 && px > WEST_X0) continue;
        if (big) L.put('street_lamp', px, pz, { yaw: Math.atan2(dz * side, -dx * side) });
        else L.put(pickId(L, ['street_tree', 'tree_round']), px, pz, { scale: 0.9 });
        if (L.rand() < 0.08) L.put('fire_hydrant', px + dx * 3, pz + dz * 3);
      }
    }
  }
  for (const n of net.nodes) {
    if (n.deg < 4 || !n.signal || L.rand() > 0.35) continue;
    if (Math.abs(n.x) > SHORE) continue;
    L.put(pickId(L, ['subway_entrance', 'phone_booth']), n.x + 22, n.z + 16, { yaw: 0 });
  }
}

// review views (tests/city_review.mjs)
export const review = {
  play: [
    { name: 'village', x: 170, z: 470, yaw: Math.PI },
    { name: 'avenue', x: 300, z: 300, yaw: Math.PI },
    { name: 'plaza', x: 40, z: 120, yaw: Math.PI * 0.85, d: 60 },
    { name: 'park', x: -300, z: -700, yaw: Math.PI, d: 80 },
    { name: 'downtown', x: 150, z: 1250, yaw: 0, d: 120 },
    { name: 'bridge', x: 760, z: 550, yaw: Math.PI / 2, d: 200 },
  ],
  aerial: [
    { name: 'midtown', pos: [700, 700, 900], look: [0, 0, -100] },
    { name: 'downtown', pos: [-900, 500, 2300], look: [100, 0, 1200] },
    { name: 'park', pos: [900, 900, -300], look: [0, 0, -1100] },
  ],
  map: { cx: 0, cz: 0, half: 2250 },
  maps: [{ name: 'midtown', cx: 0, cz: -150, half: 650 }, { name: 'downtown', cx: 150, cz: 1300, half: 650 }],
  motion: [
    { name: 'fifth_ave', pos: [60, 90, 300], look: [0, 0, 180] },
    { name: 'plaza', pos: [70, 80, 150], look: [0, 0, 66] },
    { name: 'airport', pos: [-1500, 260, 500], look: [-1830, 0, -300] },
    { name: 'harbour', pos: [500, 250, 1700], look: [100, 0, 2000] },
  ],
};
