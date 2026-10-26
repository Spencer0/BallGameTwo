// Level 6 — The Big Tidy: a city modelled on Manhattan (CITY.md §2).
// A long island between two rivers. North of Houston (z = DT_Z) the 1811 grid: one-way avenues running the
// length of the island, cross streets every 150 m; Broadway cuts the grid on a diagonal from the park's
// south-west corner, making bow-tie squares (the midtown one is a pedestrian plaza of screens). Downtown,
// below DT_Z, the older streets run on Broadway's own bearing at uneven spacing, tapering with the island
// to Battery Park at the tip. The park is one long superblock (2.5:1) with a curving drive, three sunken
// transverses, lakes, a reservoir with its running track, the Mall, lawns and woods. Height peaks in
// midtown and the financial district, with brownstone terraces in the Village between them. Shore
// drives all round; three suspension bridges east to a low-rise borough of rowhouse streets with an
// elevated line, a stadium, a park and the ferris wheel; one bridge west to the Jersey shore with its own
// towers, the port and the airport. Everything is on one connected road network; traffic, crowds, ferries,
// planes, trains and the park's rowboats and carriage horses move.
import { Layout } from './layout.js';
import { Network } from './city/network.js';
import { paintNetwork } from './city/surface.js';
import { Occupancy, occupyNetwork, frameAt, local, fillFrontage } from './city/frontage.js';
import { SK } from '../render/streets.js';
import { pickId, woods, parkingLot } from './city/suburb.js';
import { lifeSpec, spawnTraffic, spawnWalkers, spawnLoopWalkers, trafficLights, flock } from './city/lifespec.js';

const S = 2200;
const SHORE = 800; // island half-width
const TIP0 = 1250,
  TIP1 = 1860; // the island narrows to its tip between these
const DRIVE_IN = 55; // shore drive distance inside the shoreline
const AVE_X = [-600, -300, 0, 300, 600];
const AVE_NAMES = ['Eleventh', 'Eighth', 'Fifth', 'Third', 'First'];
const DT_Z = 1000; // Houston Street: the grid stops here
const BAT_Z = 1690; // Battery Place: Battery Park is south of it
const STREET_Z = [];
for (let z = -2150; z <= DT_Z; z += 150) STREET_Z.push(z);
const PARK = { minX: -300, maxX: 300, minZ: -2000, maxZ: -500 };
const TRANSVERSE = [-1700, -1250, -800];
const PD = 50; // park drive inset
const BW0 = [-300, -500]; // Broadway leaves the park's south-west corner...
const BW_PHI = 0.4312; // ...on this bearing (radians east of due "south", +z); downtown's grid shares it
const EAST_X0 = 1200; // east bank shoreline
const WEST_X0 = -1250; // west bank shoreline
const BRIDGES_Z = [1150, 550, -200];
const WEST_BRIDGE_Z = -1850;
const BORO_AVE = [1300, 1500, 1700, 1900, 2100];
const BORO_Z = [];
for (let z = -2125; z <= 1250; z += 125) BORO_Z.push(z);
for (const z of BRIDGES_Z) if (!BORO_Z.includes(z)) BORO_Z.push(z);
BORO_Z.sort((a, b) => a - b);
const ELEVATED_X = 1500; // the elevated train runs above this borough avenue
const SHORE_RD_X = WEST_X0 - 70;
const SHORE_RD_Z = [-2300, -2050, WEST_BRIDGE_Z, -1550, -1300, -1050, -800, -550, -300, -50, 200, 450, 760, 1000, 1250];
const FREIGHT_Z = 760;
const PLAZA_C = [0, 0]; // set below: the Broadway block just north of the Fifth Avenue bow-tie

export const islandHalf = (z) => (z < TIP0 ? SHORE : SHORE * Math.max(0, 1 - ((z - TIP0) / (TIP1 - TIP0)) ** 2.4) ** 0.5);
const driveX = (z) => Math.max(0, islandHalf(z) - DRIVE_IN);
const TANB = Math.tan(BW_PHI);
const bwX = (z) => BW0[0] + (z - BW0[1]) * TANB;
const bwZ = (x) => BW0[1] + (x - BW0[0]) / TANB;
PLAZA_C[0] = bwX(25);
PLAZA_C[1] = 25;

// ------------------------------------------------------------------ downtown: the old streets
const DT_STREETS_A = ['Wall St', 'Pine St', 'Maiden Ln', 'John St', 'Fulton St', 'Ann St', 'Beekman St', 'Spruce St', 'Duane St', 'Reade St', 'Chambers St', 'Warren St', 'Murray St', 'Vesey St', 'Barclay St'];
const DT_STREETS_B = ['Church St', 'Nassau St', 'William St', 'Pearl St', 'Water St', 'Greenwich St', 'Trinity Pl', 'Gold St', 'Cliff St', 'Hudson St', 'Lafayette St', 'Centre St'];

/** Downtown below Houston: the older streets. Broadway runs straight down the middle; west of it the
 *  streets follow Broadway's bearing, east of it they swing round towards the East River, so the two
 *  grids meet Broadway at different angles. Spacing is uneven, the district tapers with the island.
 *  Creates the edges; returns where streets meet the district's edges (Houston St, Battery Place, the
 *  two shore drives) so those can be built through them. */
function downtown(net, N) {
  // below Houston, Broadway bends and runs nearly due south to the Battery
  const BWD = -0.12;
  const v = [Math.sin(BWD), Math.cos(BWD)]; // along Broadway
  const u = [Math.cos(BWD), -Math.sin(BWD)]; // across it (towards the east)
  const dot = (p, d) => p[0] * d[0] + p[1] * d[1];
  const P0 = [bwX(DT_Z), DT_Z];
  const c0 = dot(P0, u);
  const base = (x, z) => Math.min(z - DT_Z, BAT_Z - z, driveX(z) - Math.abs(x));
  const corners = [[-driveX(DT_Z), DT_Z], [driveX(DT_Z), DT_Z], [driveX(BAT_Z), BAT_Z], [-driveX(BAT_Z), BAT_Z]];
  const jitter = (k, b, amp) => b + amp * Math.sin(k * 2.39 + 0.7) + amp * 0.5 * Math.sin(k * 5.1);
  const anchors = {
    top: [-driveX(DT_Z), driveX(DT_Z), ...AVE_X, P0[0]],
    bottom: [-driveX(BAT_Z), driveX(BAT_Z)],
    west: [DT_Z, BAT_Z],
    east: [DT_Z, BAT_Z, 1150],
    bw: [0],
  };
  const hits = { top: [], bottom: [], west: [], east: [], bw: [] };
  const sideOf = (x, z) => (Math.abs(dot([x, z], u) - c0) < 0.6 ? 'bw' : Math.abs(z - DT_Z) < 0.6 ? 'top' : Math.abs(z - BAT_Z) < 0.6 ? 'bottom' : x < 0 ? 'west' : 'east');
  const snapPt = (side, x, z) => {
    const key = side === 'top' || side === 'bottom' ? x : side === 'bw' ? dot([x - P0[0], z - P0[1]], v) : z;
    const tol = side === 'top' || side === 'bottom' || side === 'bw' ? 30 : 36;
    let best = null;
    for (const a of [...anchors[side], ...hits[side]]) if (Math.abs(a - key) < tol && (best === null || Math.abs(a - key) < Math.abs(best - key))) best = a;
    const k = best ?? key;
    if (best === null) hits[side].push(k);
    if (side === 'top') return [k, DT_Z];
    if (side === 'bottom') return [k, BAT_Z];
    if (side === 'bw') return [P0[0] + v[0] * k, P0[1] + v[1] * k];
    return [(side === 'west' ? -1 : 1) * driveX(k), k];
  };
  const DISTRICTS = [
    { side: -1, phi: BWD + 0.42, spA: 122, ampA: 14, spB: 100, ampB: 12, offA: 70 }, // west: angled towards the Hudson
    { side: 1, phi: BWD - 0.45, spA: 108, ampA: 16, spB: 92, ampB: 14, offA: 30 }, // east: swung towards the East River
  ];
  let nameA = 0,
    nameB = 0;
  for (const D of DISTRICTS) {
    const dv = [Math.sin(D.phi), Math.cos(D.phi)],
      du = [Math.cos(D.phi), -Math.sin(D.phi)];
    const margin = (x, z) => Math.min(base(x, z), D.side * (dot([x, z], u) - c0));
    const inside = (x, z) => margin(x, z) >= 0;
    const range = (d) => [Math.min(...corners.map((p) => dot(p, d))) - 60, Math.max(...corners.map((p) => dot(p, d))) + 60];
    const offsets = (start, [lo, hi], b, amp, skipStart) => {
      const out = skipStart ? [] : [start];
      for (let c = start, k = 1; c < hi; k++) out.push((c += jitter(k, b, amp)));
      for (let c = start, k = 1; c > lo; k++) out.unshift((c -= jitter(-k, b, amp)));
      return out;
    };
    const lines = [];
    // B lines run along dv (p.du = c); west of Broadway they're parallel to it, so skip Broadway's own line
    offsets(dot(P0, du) + D.side * 40, range(du), D.spB, D.ampB, false).forEach((c) => lines.push({ kind: 'B', c, n: du, d: dv, name: DT_STREETS_B[nameB++ % DT_STREETS_B.length] }));
    offsets(dot([0, DT_Z + D.offA], dv), range(dv), D.spA, D.ampA, false).forEach((c) => lines.push({ kind: 'A', c, n: dv, d: du, name: DT_STREETS_A[nameA++ % DT_STREETS_A.length] }));
    for (const ln of lines) {
      const at = (t) => [ln.n[0] * ln.c + ln.d[0] * t, ln.n[1] * ln.c + ln.d[1] * t];
      let t0 = null,
        t1 = null;
      for (let t = -3000; t <= 3000; t += 4) {
        const [x, z] = at(t);
        if (inside(x, z)) {
          if (t0 === null) t0 = t;
          t1 = t;
        }
      }
      if (t0 === null) {
        ln.dead = true;
        continue;
      }
      const refine = (a, b) => {
        for (let k = 0; k < 30; k++) {
          const m = (a + b) / 2;
          const [x, z] = at(m);
          if (inside(x, z)) a = m;
          else b = m;
        }
        return a;
      };
      ln.t0 = refine(t0, t0 - 4);
      ln.t1 = refine(t1, t1 + 4);
      ln.at = at;
      ln.nodes = [];
    }
    const live = lines.filter((l) => !l.dead && l.t1 - l.t0 > 50);
    const As = live.filter((l) => l.kind === 'A'),
      Bs = live.filter((l) => l.kind === 'B');
    const near = [];
    for (const a of As)
      for (const b of Bs) {
        const p = [du[0] * b.c + dv[0] * a.c, du[1] * b.c + dv[1] * a.c];
        const m = margin(p[0], p[1]);
        if (m < 0) continue;
        if (m >= 26) {
          a.nodes.push(b.c);
          b.nodes.push(a.c);
        } else near.push([a, b.c, b, a.c]);
      }
    // a crossing too near the district's edge can't be a junction: the B street stops at its last one
    for (const [, , b, tb] of near) {
      if (!b.nodes.length) {
        b.cut = true;
        continue;
      }
      const lo = Math.min(...b.nodes),
        hi = Math.max(...b.nodes);
      if (tb > hi) {
        b.t1 = Math.min(b.t1, hi);
        b.endCut = true;
      } else if (tb < lo) {
        b.t0 = Math.max(b.t0, lo);
        b.startCut = true;
      }
    }
    for (const ln of live) {
      if (ln.cut) continue;
      const pts = [];
      if (!ln.startCut) {
        const [x, z] = ln.at(ln.t0);
        pts.push(snapPt(sideOf(x, z), x, z));
      }
      for (const t of ln.nodes.filter((t) => t >= ln.t0 - 0.01 && t <= ln.t1 + 0.01).sort((a, b) => a - b)) pts.push(ln.at(t));
      if (!ln.endCut) {
        const [x, z] = ln.at(ln.t1);
        pts.push(snapPt(sideOf(x, z), x, z));
      }
      if (pts.length < 2) continue;
      for (let k = 0; k < pts.length - 1; k++) {
        const a = N(pts[k][0], pts[k][1]),
          b = N(pts[k + 1][0], pts[k + 1][1]);
        if (a !== b) net.edge(a, b, { cls: 'street', w: 11, walk: 4, verge: 0, name: ln.name });
      }
    }
  }
  // Broadway itself: straight on down to the Battery, through every street that meets it
  let tEnd = 0;
  while (base(P0[0] + v[0] * (tEnd + 2), P0[1] + v[1] * (tEnd + 2)) >= 0) tEnd += 2;
  const [ex, ez] = [P0[0] + v[0] * tEnd, P0[1] + v[1] * tEnd];
  const endPt = snapPt(sideOf(ex, ez) === 'bw' ? (Math.abs(ez - BAT_Z) < 3 ? 'bottom' : ex < 0 ? 'west' : 'east') : sideOf(ex, ez), ex, ez);
  const bwPts = [P0, ...[...new Set(hits.bw)].filter((t) => t > 20 && t < tEnd - 20).sort((a, b) => a - b).map((t) => [P0[0] + v[0] * t, P0[1] + v[1] * t]), endPt];
  for (let k = 0; k < bwPts.length - 1; k++) {
    const a = N(bwPts[k][0], bwPts[k][1]),
      b = N(bwPts[k + 1][0], bwPts[k + 1][1]);
    if (a !== b) net.edge(a, b, { cls: 'boulevard', name: 'Broadway', w: 18, oneway: true, lanes: 3 });
  }
  const sideList = (side) => [...new Set([...anchors[side].filter((z) => z > DT_Z + 1 && z < BAT_Z - 1), ...hits[side]])].sort((a, b) => a - b);
  return {
    top: [...new Set(hits.top)],
    bottom: [...new Set(hits.bottom)],
    west: sideList('west').map((z) => [-driveX(z), z]),
    east: sideList('east').map((z) => [driveX(z), z]),
  };
}

function buildNet() {
  const net = new Network();
  const N = (x, z, o) => net.at(x, z, 0.5, o);
  const dt = downtown(net, N);
  // --- shore drives: through every street end and downtown junction, round Battery Park at the tip
  const side = (sx) => [[sx * driveX(-2300), -2300, { exit: true }], ...STREET_Z.map((z) => [sx * driveX(z), z]), ...(sx < 0 ? dt.west : dt.east), [sx * driveX(BAT_Z), BAT_Z]];
  const west = side(-1).map(([x, z, o]) => N(x, z, o)),
    east = side(1).map(([x, z, o]) => N(x, z, o));
  for (let k = 0; k < west.length - 1; k++) net.edge(west[k], west[k + 1], { cls: 'highway', name: 'West Side Highway', walk: 0 });
  for (let k = 0; k < east.length - 1; k++) net.edge(east[k + 1], east[k], { cls: 'highway', name: 'East River Drive', walk: 0 });
  const tipPts = [];
  const rx = driveX(BAT_Z),
    rz = TIP1 - DRIVE_IN - BAT_Z;
  for (let k = 1; k < 16; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / 16;
    tipPts.push([Math.sin(a) * rx, BAT_Z + Math.cos(a) * rz]);
  }
  net.edge(west[west.length - 1], east[east.length - 1], { cls: 'highway', name: 'Battery Drive', pts: tipPts, walk: 0 });
  // --- Broadway's crossings in the grid
  const onBw = (z) => z >= BW0[1] - 1 && z <= DT_Z + 1;
  // --- avenues: one-way, alternating; Fifth stops at the park; all end at Houston
  AVE_X.forEach((x, k) => {
    const zs = STREET_Z.filter((z) => !(x > PARK.minX && x < PARK.maxX && z > PARK.minZ && z < PARK.maxZ && !TRANSVERSE.includes(z)));
    if (x > BW0[0] && bwZ(x) < DT_Z - 1) zs.push(bwZ(x));
    zs.sort((a, b) => a - b);
    const nodes = [N(x, -2300, { exit: true }), ...zs.map((z) => N(x, z))];
    const north = k % 2 === 0;
    for (let j = 0; j < nodes.length - 1; j++) {
      const za = net.nodes[nodes[j]].z,
        zb = net.nodes[nodes[j + 1]].z;
      if (x > PARK.minX && x < PARK.maxX && za >= PARK.minZ - 1 && zb <= PARK.maxZ + 1) continue;
      const opts = { cls: 'avenue', name: `${AVE_NAMES[k]} Avenue`, draw: 2.5 };
      if (north) net.edge(nodes[j + 1], nodes[j], opts);
      else net.edge(nodes[j], nodes[j + 1], opts);
    }
  });
  // --- cross streets: one-way alternating, every fourth two-way; through the park only as transverses
  STREET_Z.forEach((z, k) => {
    const half = driveX(z);
    const xs = [-half, half, ...AVE_X.filter((x) => Math.abs(x) < half - 30)];
    if (TRANSVERSE.includes(z)) xs.push(PARK.minX + PD, PARK.maxX - PD);
    if (onBw(z)) xs.push(bwX(z));
    if (z === DT_Z) xs.push(...dt.top);
    const ux = [...new Set(xs.map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b);
    const two = k % 4 === 0 || z === DT_Z;
    const eastbound = k % 2 === 0;
    for (let j = 0; j < ux.length - 1; j++) {
      const xa = ux[j],
        xb = ux[j + 1];
      const inPark = z > PARK.minZ && z < PARK.maxZ && xa >= PARK.minX - 1 && xb <= PARK.maxX + 1;
      if (inPark && !TRANSVERSE.includes(z)) continue;
      const a = N(xa, z),
        b = N(xb, z);
      const name = z === DT_Z ? 'Houston St' : TRANSVERSE.includes(z) && inPark ? `${k + 10}th St Transverse` : `${k + 10}th St`;
      const opts = two || TRANSVERSE.includes(z) ? { cls: 'street', w: 14, walk: 5, verge: 0, name } : { cls: 'crosstown', name };
      if (two || TRANSVERSE.includes(z) || eastbound) net.edge(a, b, opts);
      else net.edge(b, a, opts);
    }
  });
  // Battery Place along the north edge of Battery Park
  const bp = [...new Set([-driveX(BAT_Z), driveX(BAT_Z), ...dt.bottom])].sort((a, b) => a - b);
  for (let j = 0; j < bp.length - 1; j++) net.edge(N(bp[j], BAT_Z), N(bp[j + 1], BAT_Z), { cls: 'street', w: 12, walk: 5, verge: 0, name: 'Battery Place' });
  // --- Broadway: two-way boulevard through all its crossings in the grid (downtown carries it on)
  const cross = [];
  for (const z of STREET_Z) if (onBw(z) && Math.abs(bwX(z)) < driveX(z) - 20) cross.push([bwX(z), z]);
  for (const x of AVE_X) if (x > BW0[0] && bwZ(x) < DT_Z - 1) cross.push([x, bwZ(x)]);
  cross.sort((p, q) => p[1] - q[1]);
  const bwNodes = [];
  for (const [x, z] of cross) {
    const id = N(x, z);
    if (bwNodes[bwNodes.length - 1] !== id) bwNodes.push(id);
  }
  for (let j = 0; j < bwNodes.length - 1; j++) {
    const A = net.nodes[bwNodes[j]],
      B = net.nodes[bwNodes[j + 1]];
    const plaza = Math.hypot((A.x + B.x) / 2 - PLAZA_C[0], (A.z + B.z) / 2 - PLAZA_C[1]) < 60;
    net.edge(bwNodes[j], bwNodes[j + 1], { cls: 'boulevard', name: plaza ? 'Broadway Plaza' : 'Broadway', w: 18, oneway: true, lanes: 3, traffic: !plaza, plaza, draw: 2 }); // one-way, southbound
  }
  // --- the park drive: a curving loop inside the park, crossed by the transverses, two gates
  const xw = PARK.minX + PD,
    xe = PARK.maxX - PD,
    zn = PARK.minZ + PD,
    zs = PARK.maxZ - PD;
  const wiggle = (x, za, zb, amp) => {
    const pts = [];
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      pts.push([x + Math.sin(t * Math.PI) * amp + Math.sin(t * Math.PI * 3) * amp * 0.35, za + (zb - za) * t]);
    }
    return pts;
  };
  const westSide = [zs, -800, -1100, -1250, -1700, zn];
  const eastSide = [zn, -1700, -1550, -1250, -800, zs];
  const drive = { cls: 'lane', w: 9, walk: 0, name: 'Park Drive' };
  for (let j = 0; j < westSide.length - 1; j++) net.edge(N(xw, westSide[j]), N(xw, westSide[j + 1]), { ...drive, name: 'West Drive', pts: wiggle(xw, westSide[j], westSide[j + 1], (j % 2 ? -1 : 1) * 12) });
  for (let j = 0; j < eastSide.length - 1; j++) net.edge(N(xe, eastSide[j]), N(xe, eastSide[j + 1]), { ...drive, name: 'East Drive', pts: wiggle(xe, eastSide[j], eastSide[j + 1], (j % 2 ? 1 : -1) * 12) });
  const arc = (z, dir) => {
    const pts = [];
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      pts.push([xw + (xe - xw) * t, z + dir * Math.sin(t * Math.PI) * 16]);
    }
    return pts;
  };
  net.edge(N(xw, zn), N(xe, zn), { ...drive, name: 'Park Drive North', pts: arc(zn, -1) });
  net.edge(N(xe, zs), N(xw, zs), { ...drive, name: 'Park Drive South', pts: arc(zs, 1).reverse() });
  net.edge(N(PARK.minX, -1100), N(xw, -1100), { ...drive, name: 'Park Gate' });
  net.edge(N(xe, -1550), N(PARK.maxX, -1550), { ...drive, name: 'Park Gate' });
  // --- bridges: three east to the borough, one west to the Jersey shore
  BRIDGES_Z.forEach((z, k) => net.edge(N(driveX(z), z), N(BORO_AVE[0], z), { cls: 'boulevard', name: ['Brooklyn Bridge', 'Manhattan Bridge', 'Queensboro Bridge'][k], w: 20, walk: 0, y: 0.6 }));
  net.edge(N(-driveX(WEST_BRIDGE_Z), WEST_BRIDGE_Z), N(SHORE_RD_X, WEST_BRIDGE_Z), { cls: 'boulevard', name: 'George Washington Bridge', w: 20, walk: 0, y: 0.6 });
  BORO_AVE.forEach((x, k) => {
    const nodes = [N(x, -2300, { exit: true }), ...BORO_Z.filter((z) => z < 1300).map((z) => N(x, z))];
    for (let j = 0; j < nodes.length - 1; j++) net.edge(nodes[j], nodes[j + 1], { cls: 'street', w: 12, walk: 3, verge: 0, name: `${['Kent', 'Bedford', 'Driggs', 'Union', 'Graham'][k]} Ave` });
  });
  for (const z of BORO_Z.filter((z) => z < 1300)) {
    const nodes = [...BORO_AVE.map((x) => N(x, z)), N(S + 100, z, { exit: true })];
    for (let j = 0; j < nodes.length - 1; j++) net.edge(nodes[j], nodes[j + 1], { cls: 'street', w: 13, walk: 3, verge: 1.2, name: 'Boro St' });
  }
  // --- the Jersey shore: shore road, airport road, freight road to the port
  const wNodes = SHORE_RD_Z.map((z, k) => N(SHORE_RD_X, z, k === 0 ? { exit: true } : k === SHORE_RD_Z.length - 1 ? { bulb: 18 } : {}));
  for (let j = 0; j < wNodes.length - 1; j++) net.edge(wNodes[j], wNodes[j + 1], { cls: 'arterial', name: 'Shore Road', walk: 3, verge: 0 });
  net.edge(N(SHORE_RD_X, -800), N(-1440, -800, { bulb: 20 }), { cls: 'arterial', name: 'Airport Road', walk: 0, verge: 0 });
  net.edge(N(SHORE_RD_X, FREIGHT_Z), N(-2100, FREIGHT_Z), { cls: 'street', name: 'Freight Road', walk: 0, verge: 0 });
  net.edge(N(-2100, FREIGHT_Z), N(-S - 100, FREIGHT_Z, { exit: true }), { cls: 'street', name: 'Freight Road', walk: 0, verge: 0 });
  return net.build();
}

export const net = buildNet();

// ------------------------------------------------------------------ ground: water, island, banks, park
const blob = (cx, cz, rx, rz, ph = 0, n = 40) => {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const f = 1 + 0.12 * Math.sin(3 * a + ph) + 0.07 * Math.sin(5 * a + ph * 2.3);
    pts.push([cx + Math.sin(a) * rx * f, cz + Math.cos(a) * rz * f]);
  }
  return pts;
};
const LAKES = [
  { name: 'The Lake', cx: -40, cz: -1030, rx: 130, rz: 62, ph: 0.4 },
  { name: 'Reservoir', cx: 10, cz: -1500, rx: 175, rz: 110, ph: 1.7 },
  { name: 'Harlem Meer', cx: 120, cz: -1860, rx: 80, rz: 40, ph: 2.6 },
  { name: 'The Pond', cx: 150, cz: -640, rx: 45, rz: 28, ph: 0.9 },
  { name: 'Prospect Lake', cx: 1830, cz: -560, rx: 90, rz: 55, ph: 1.2 },
];

const hash = (x, z) => {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
/** the city carrying on beyond the map, as blocks of rooftops round yards, fading into the haze */
function roofs(b, x0, x1, z0, z1, bw, bd, st, pal, y, yard = 0.5) {
  for (let x = x0; x + bw <= x1 + 0.1; x += bw)
    for (let z = z0; z + bd <= z1 + 0.1; z += bd) {
      const h = hash(x, z);
      b.rect(x + bw / 2, z + bd / 2, bw - st, bd - st, 0, SK.solid, { C: [pal[Math.floor(h * pal.length)]], y });
      if (hash(z, x) < yard) b.rect(x + bw / 2, z + bd / 2, (bw - st) * 0.7, (bd - st) * 0.45, 0, SK.solid, { C: [h < 0.7 ? 'pine' : 'concrete'], y: y + 0.02 });
    }
}

function landPolys(b) {
  for (let z = -9000; z < TIP0; z += 400) {
    const z1 = Math.min(TIP0, z + 400);
    b.poly([[-SHORE, z], [SHORE, z], [SHORE, z1], [-SHORE, z1]], SK.solid, { C: ['stone'], y: -1.2 });
  }
  const tip = [[0, TIP0]];
  for (let z = TIP0; z <= TIP1; z += 15) tip.push([-islandHalf(z), z]);
  for (let z = TIP1; z >= TIP0; z -= 15) tip.push([islandHalf(z), z]);
  b.poly(tip, SK.solid, { C: ['stone'], y: -1.2 });
  // the banks
  b.poly([[-9000, -9000], [WEST_X0, -9000], [WEST_X0, 1300], [-9000, 1300]], SK.solid, { C: ['leaf'], y: -1.2 });
  // the Jersey shore: paved where the towers and the port stand, parkland and woods elsewhere
  b.rect((WEST_X0 - 1460) / 2, -245, WEST_X0 + 1460, 2010, 0, SK.solid, { C: ['concrete'], y: -1.15 });
  b.rect(-1500, 1040, 500, 520, 0, SK.solid, { C: ['concrete'], y: -1.15 });
  // the borough's waterfront park
  b.rect((EAST_X0 + BORO_AVE[0] - 10) / 2, -470, BORO_AVE[0] - 10 - EAST_X0 - 4, 3440, 0, SK.solid, { C: ['leaf'], y: -1.15 });
  b.poly([[EAST_X0, -9000], [9000, -9000], [9000, 1350], [EAST_X0, 1350]], SK.solid, { C: ['stone'], y: -1.2 });
  // beyond the map: Manhattan north of the edge, more borough to the east, Jersey towns and woods to the west
  roofs(b, -SHORE + 60, SHORE - 60, -6000, -S - 100, 150, 75, 16, ['slate', 'concrete', 'stone', 'slate', 'brick'], -1.0, 0.4);
  roofs(b, S + 50, S + 2600, -6000, 1300, 200, 62.5, 12, ['brick', 'cocoa', 'brick', 'caramel'], -1.0, 0.8);
  roofs(b, S + 2600, S + 6600, -7000, 1300, 400, 125, 20, ['brick', 'cocoa', 'sand', 'slate'], -1.0, 0.6);
  roofs(b, -S - 6600, -S - 2600, -7000, 1250, 400, 125, 20, ['paper', 'sand', 'brick', 'slate'], -1.0, 0.8);
  roofs(b, EAST_X0 + 60, S + 50, -6000, -S - 50, 200, 62.5, 12, ['brick', 'cocoa', 'brick', 'caramel'], -1.0, 0.8);
  roofs(b, -S - 2600, -S - 150, -6000, 1250, 130, 65, 12, ['paper', 'sand', 'brick', 'slate', 'cloud'], -1.0, 0.9);
  roofs(b, WEST_X0 - 900, WEST_X0 - 60, -6000, -S - 150, 130, 65, 12, ['paper', 'sand', 'brick', 'slate', 'cloud'], -1.0, 0.9);
  // riverside parks between the shore drives and the water (Hudson River Park, the East River esplanade)
  for (const sx of [-1, 1]) b.rect(sx * (SHORE - 21), (-S - 100 + TIP0) / 2, 36, TIP0 + S + 100, 0, SK.solid, { C: ['leaf'], y: -1.1 });
  // the statue's island
  const isl = blob(320, 2050, 70, 55, 0.8, 24);
  b.poly([[320, 2050], ...isl, isl[0]], SK.solid, { C: ['leaf'], y: -1.2 });
  // the park: lawn, then lakes (same water as the rivers)
  b.rect((PARK.minX + PARK.maxX) / 2, (PARK.minZ + PARK.maxZ) / 2, PARK.maxX - PARK.minX - 12, PARK.maxZ - PARK.minZ - 12, 0, SK.solid, { C: ['leaf'], y: -0.6 });
  b.rect(1830, -600, 340, 300, 0, SK.solid, { C: ['leaf'], y: -0.6 });
  for (const l of LAKES) {
    const p = blob(l.cx, l.cz, l.rx, l.rz, l.ph);
    b.poly([[l.cx, l.cz], ...p, p[0]], SK.water, { C: ['cobalt', 'sky'], y: -0.35, origin: [0, 0] });
    const r = blob(l.cx, l.cz, l.rx + 5, l.rz + 5, l.ph);
    b.poly([[l.cx, l.cz], ...r, r[0]], SK.solid, { C: ['stone'], y: -0.45 });
  }
  // Battery Park at the tip
  const bpk = [[0, BAT_Z + 20]];
  const rx = driveX(BAT_Z) - 13,
    rz = TIP1 - DRIVE_IN - BAT_Z - 13;
  for (let k = 0; k <= 24; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / 24;
    bpk.push([Math.sin(a) * rx, BAT_Z + 12 + Math.cos(a) * rz]);
  }
  b.poly(bpk, SK.solid, { C: ['leaf'], y: -0.6 });
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
    // airport grass
    { x: -1830, z: -350, w: 560, d: 2000, y: -0.6, pattern: 'solid', a: '#8FCF4A' },
  ],
  streets: (b) => {
    landPolys(b);
    paintNetwork(b, net, { plazaA: 'concrete', plazaB: 'cloud' });
  },
  blocks: [
    { min: [-S - 50, -10, -S - 50], max: [S + 50, 10000, -S], visible: false },
    { min: [-S - 50, -10, S], max: [S + 50, 10000, S + 50], visible: false },
    { min: [-S - 50, -10, -S], max: [-S, 10000, S], visible: false },
    { min: [S, -10, -S], max: [S + 50, 10000, S], visible: false },
  ],
};


export const bounds = { minX: -S, maxX: S, minZ: -S, maxZ: S };
// Union Square: the block Broadway cuts between Fifth and Third, 14th to 17th; the ball starts in it
const UNION = { minX: 18, maxX: 282, minZ: 412, maxZ: 538 };
export const spawn = { x: 228, z: 495, yaw: Math.PI };

// ------------------------------------------------------------------ zoning
// Height falls off from two cores (midtown, the financial district); avenues and Broadway carry the bigger
// buildings, side streets the walk-ups; the Village between the cores is brownstone terraces; the park is
// lined with grand apartment houses; the plaza with screens; the borough is rowhouse streets.
const SUPER = ['skyscraper_spire', 'skyscraper_deco', 'skyscraper_twist'];
const HIGH = ['highrise_glass', 'highrise_stone', 'office_block', 'apartment_tower'];
const MID = ['midrise_prewar', 'midrise_modern', 'midrise_deco', 'office_block'];
const WALKUP = ['brownstone', 'brownstone', 'brownstone', 'tenement', 'tenement'];
const SHOPS = ['storefront_a', 'storefront_b'];
const JERSEY = ['highrise_glass', 'apartment_tower', 'midrise_modern', 'office_block'];
const CORES = [
  { x: 0, z: -150, r: 420 }, // midtown
  { x: 120, z: 1420, r: 340 }, // the financial district
];
const VILLAGE = { x: 60, z: 620, r: 360 };
// limits on how often one landmark tower may appear
const CAP = { skyscraper_twist: 3, skyscraper_spire: 10, skyscraper_deco: 8, midrise_deco: 30, highrise_stone: 30, apartment_tower: 40 };
// the city's colours: stone, brick, glass; no candy pastels on buildings
const CITY_OK = new Set(['cobalt', 'teal', 'navy', 'sand', 'cloud', 'sky', 'slate', 'concrete', 'paper', 'brick', 'cocoa', 'caramel', 'butter', 'stone', 'charcoal', 'tomato']);

const gauss = (x, z, c) => Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / (2 * c.r * c.r));

function zone(x, z, e) {
  const cls = e.cls;
  const avenue = cls === 'avenue' || cls === 'boulevard';
  if (x > EAST_X0) {
    // the borough: shops under tenements on its avenues, rowhouse terraces on its streets
    if (e.name.endsWith(' Ave')) return { row: true, tiers: [[['storefront_a', 'storefront_b', 'storefront_c'], 2], [['tenement'], 1]], gap: 0 };
    return { row: true, tiers: [[['brownstone'], 3], [['tenement'], 1.4]], gap: 0 };
  }
  if (x < WEST_X0) return { tiers: [[JERSEY, 1]], gap: 16 };
  if (cls === 'highway') return { tiers: [[MID, 1], [HIGH, 0.4]], gap: 18 };
  if (Math.hypot(x - PLAZA_C[0], z - PLAZA_C[1]) < 170) return { tiers: [[['screen_building'], 1], [['highrise_glass', 'office_block', 'midrise_modern'], 1.4]], gap: 0 };
  let core = 0;
  for (const c of CORES) core = Math.max(core, gauss(x, z, c));
  const vil = gauss(x, z, VILLAGE);
  const parkSide = z > PARK.minZ - 160 && z < PARK.maxZ + 160 && Math.abs(x) < 460;
  if (parkSide && avenue) return { tiers: [[['midrise_prewar', 'midrise_deco', 'highrise_stone'], 1]], gap: 0 };
  // the Village: five storeys at most
  if (vil > 0.35 && core < 0.5) return avenue ? { tiers: [[['tenement'], 2], [['brownstone'], 1], [['storefront_b'], 0.6]], gap: 0 } : { row: true, tiers: [[['brownstone'], 3], [['tenement'], 1]], gap: 0 };
  const a = avenue ? 1 : 0.45;
  return {
    tiers: [
      [SUPER, 0.5 * core * core * a],
      [HIGH, (0.9 * core + 0.08) * a],
      [MID, 0.55 * (avenue ? 1 : 0.6)],
      [WALKUP, avenue ? 0.04 : 0.9 * (1 - core)],
      [SHOPS, avenue ? 0 : 0.08],
    ],
    gap: 0,
  };
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
  // reserved: the park, Battery Park, the borough park, the stadium
  occ.add({ x: (PARK.minX + PARK.maxX) / 2, z: (PARK.minZ + PARK.maxZ) / 2, hw: (PARK.maxX - PARK.minX) / 2 - 4, hd: (PARK.maxZ - PARK.minZ) / 2 - 4, yaw: 0 }, 'park');
  occ.add({ x: 0, z: (BAT_Z + TIP1) / 2, hw: driveX(BAT_Z), hd: (TIP1 - BAT_Z) / 2, yaw: 0 }, 'park');
  occ.add({ x: 1830, z: -600, hw: 170, hd: 150, yaw: 0 }, 'park');
  occ.add({ x: 1800, z: -1500, hw: 160, hd: 190, yaw: 0 }, 'stadium');
  occ.add({ x: (UNION.minX + UNION.maxX) / 2, z: (UNION.minZ + UNION.maxZ) / 2, hw: (UNION.maxX - UNION.minX) / 2, hd: (UNION.maxZ - UNION.minZ) / 2, yaw: 0 }, 'park');

  const used = {};
  const muted = (id) => {
    const t = lib.byId.get(id);
    const v = (t?.variants || []).filter((c) => CITY_OK.has(c));
    return v.length ? L.pick(v) : t?.variants?.length ? 'concrete' : undefined;
  };
  const zonePick = (zn, rem) => {
    const tiers = zn.tiers.map(([ids, w]) => [ids.filter((id) => lib.byId.has(id) && lib.byId.get(id).dims[0] <= rem + 0.5 && (used[id] || 0) < (CAP[id] ?? Infinity)), w]).filter(([ids, w]) => ids.length && w > 0);
    const total = tiers.reduce((t, [, w]) => t + w, 0);
    if (!total) return null;
    let r = L.rand() * total;
    for (const [ids, w] of tiers) {
      r -= w;
      if (r <= 0) return L.pick(ids);
    }
    return L.pick(tiers[tiers.length - 1][0]);
  };

  // ---- street walls on every frontage
  const order = [...net.frontages].sort((a, b) => {
    const r = (f) => ({ avenue: 0, boulevard: 0, crosstown: 1, street: 1, highway: 2, arterial: 2 })[net.edges[f.e].cls] ?? 3;
    return r(a) - r(b);
  });
  const skip = (f, e) => {
    if (e.cls === 'lane' || e.y > 0.1) return true; // park drives, bridges
    const mid = frameAt(f, f.L[f.L.length - 1] / 2);
    const [ix, iz] = local(mid, 0, -20);
    if (ix > PARK.minX && ix < PARK.maxX && iz > PARK.minZ && iz < PARK.maxZ) return true;
    if (Math.abs(ix) > SHORE + 5 && ix < EAST_X0 && ix > WEST_X0) return true; // over water
    if (iz > BAT_Z && Math.abs(ix) < SHORE) return true; // Battery Park
    if (ix < WEST_X0 && (e.name !== 'Shore Road' || iz < -1250 || iz > FREIGHT_Z - 20)) return true; // airport, port, woods
    if (ix < SHORE_RD_X && iz > -760 && iz < 40) return true; // no towers backing onto the airport apron
    return false;
  };
  for (const f of order) {
    const e = net.edges[f.e];
    if (skip(f, e)) continue;
    const mid = frameAt(f, f.L[f.L.length - 1] / 2);
    const [ix, iz] = local(mid, 0, -20);
    const z = zone(ix, iz, e);
    // terraces: one building type and one colour down a whole block face
    let rowId = null,
      rowTint = null;
    if (z.row) {
      rowId = zonePick(z, 99);
      rowTint = muted(rowId);
    }
    fillFrontage(L, occ, f, {
      pick: (rem) => {
        if (rowId && lib.byId.get(rowId).dims[0] <= rem + 0.5) return rowId;
        const id = zonePick(z, rem);
        if (id) used[id] = (used[id] || 0) + 1;
        return id;
      },
      tint: (id) => (id === rowId && L.rand() < 0.8 ? rowTint : muted(id)),
      setback: 0.3,
      gap: () => z.gap + (z.row ? 0.1 : L.rand() < 0.08 ? 4 : 0.4),
      step: 6,
    });
  }
  // second pass: plug the gaps the big buildings left with narrow ones (no one-storey shops on avenues)
  const narrowSide = ['brownstone', 'tenement', 'storefront_a', 'storefront_b'].filter((id) => lib.byId.has(id));
  const narrowAve = ['tenement', 'brownstone'].filter((id) => lib.byId.has(id));
  for (const f of order) {
    const e = net.edges[f.e];
    if (skip(f, e) || e.cls === 'highway' || e.plaza) continue;
    const mid = frameAt(f, f.L[f.L.length - 1] / 2);
    const [ix] = local(mid, 0, -20);
    if (ix < WEST_X0) continue;
    const pool = e.cls === 'avenue' || e.cls === 'boulevard' ? narrowAve : narrowSide;
    fillFrontage(L, occ, f, {
      pick: (rem) => {
        const fit = pool.filter((id) => lib.byId.get(id).dims[0] <= rem + 0.3);
        return fit.length ? L.pick(fit) : null;
      },
      tint: muted,
      setback: 0.3,
      gap: () => 0.3,
      step: 2,
    });
  }
  blockInteriors(ctx);
  // pocket plazas: whatever street frontage is still empty (the wedges along Broadway, corners the big
  // buildings couldn't fill) becomes a paved square with trees, benches and a cart
  for (const f of net.frontages) {
    const e = net.edges[f.e];
    if (skip(f, e) || e.cls === 'highway' || e.plaza) continue;
    const [ix] = local(frameAt(f, f.L[f.L.length - 1] / 2), 0, -20);
    if (Math.abs(ix) > SHORE) continue;
    const len = f.L[f.L.length - 1];
    for (let s = 6; s < len - 6; s += 8) {
      const fr = frameAt(f, s);
      for (const [w, d] of [[16, 18], [9, 11]]) {
        const [x, z] = local(fr, 0, -(d / 2 + 0.5));
        const r = { x, z, hw: w / 2, hd: d / 2, yaw: fr.yaw };
        if (occ.hits(r)) continue;
        occ.add(r, 'plaza');
        L.paint.push((b) => b.rect(x, z, w, d, fr.yaw, SK.plaza, { P: [3], C: ['concrete', 'concrete', 'stone'], y: 0.01 }));
        L.put(pickId(L, ['street_tree', 'tree_round']), ...local(fr, -w / 4, -(d / 2 + 0.5)), { scale: 1.1, tint: 'leaf' });
        if (w > 10) L.put(pickId(L, ['street_tree', 'tree_round']), ...local(fr, w / 4, -(d / 2 + 0.5)), { scale: 1.1, tint: 'leaf' });
        const k = L.rand();
        if (k < 0.6) L.put('park_bench', ...local(fr, 0, -(d / 2 + 0.5)), { yaw: fr.yaw });
        else if (k < 0.8) L.put(pickId(L, ['newsstand', 'hot_dog_cart']), ...local(fr, 0, -2), { yaw: fr.yaw });
        s += w - 8;
        break;
      }
    }
  }
  unionSquare(ctx, life);
  plaza(ctx, life);
  centralPark(ctx, life);
  batteryPark(ctx, life);
  waterfront(ctx, life);
  borough(ctx, life);
  westBank(ctx, life);
  streetFurniture(ctx);

  // ---- life: taxis in platoons on the avenues, crowds on the midtown and downtown sidewalks
  trafficLights(L, life, net);
  const laneW = (l) => {
    const e = net.edges[l.e];
    const base = e.cls === 'avenue' || e.cls === 'boulevard' ? 3.2 : e.cls === 'highway' ? 2.2 : e.cls === 'lane' ? 0.5 : e.cls === 'arterial' ? 1.2 : 1;
    const [x, z] = net.edges[l.e].poly[0];
    let core = 0;
    for (const c of CORES) core = Math.max(core, gauss(x, z, c));
    return base * (x > EAST_X0 ? 1.4 : 0.5 + 5 * core); // thickest in midtown and the financial district; the borough has its own
  };
  spawnTraffic(L, life, net, 1450, [['taxi', 14], ['car', 4], ['suv', 3], ['hatchback', 2], ['city_bus', 1.4], ['delivery_van', 2.4], ['food_truck', 0.4], ['police_car', 0.7], ['ambulance', 0.3], ['limo', 0.6], ['garbage_truck', 0.4], ['fire_truck', 0.2], ['pickup_truck', 0.8]], { laneWeight: laneW, speed: 1 });
  const walkW = (w) => {
    const e = net.edges[w.e];
    const [x, z] = w.pts[0];
    if (x > EAST_X0) return 1.0;
    if (x < WEST_X0) return 0.15;
    let core = 0;
    for (const c of CORES) core = Math.max(core, gauss(x, z, c));
    return (e.cls === 'avenue' || e.cls === 'boulevard' ? 1.6 : 1) * (0.5 + 4 * core + 1.5 * gauss(x, z, VILLAGE));
  };
  spawnWalkers(L, life, net, 1250, { dogs: 0.07, joggers: 0.05, walkWeight: walkW });
  // the sky: helicopters circling, a blimp over the stadium, clouds well above the towers
  const ring = (cx, cz, r, n = 24) => {
    const p = [];
    for (let k = 0; k <= n; k++) p.push([cx + Math.sin((k / n) * Math.PI * 2) * r, cz + Math.cos((k / n) * Math.PI * 2) * r]);
    return p;
  };
  for (const [cx, cz, r, y, s] of [[0, -100, 380, 150, 0], [300, 1350, 300, 130, 900], [-100, -1300, 500, 180, 400]]) {
    const it = L.put('helicopter', cx + r, cz, { y });
    if (it) life.movers.push({ its: [it], offs: [0], route: ring(cx, cz, r), speed: 32, y, s, air: true, kind: 'heli' });
  }
  const blimp = L.put('blimp', 1800, -1300, { y: 260 });
  if (blimp) life.movers.push({ its: [blimp], offs: [0], route: ring(1800, -1300, 260, 32), speed: 9, y: 260, air: true, kind: 'blimp' });
  for (let k = 0; k < 40; k++) L.put('fluffy_cloud', L.range(-S, S), L.range(-S, S), { y: L.range(520, 860), scale: L.range(0.8, 1.8), yaw: L.range(0, 6.28), tint: L.pick(['snow', 'cloud']) });
  return L;
}

// ------------------------------------------------------------------ districts
function blockInteriors(ctx) {
  // rear yards (green, trees) in the residential districts, paved courts in the cores
  const xsAll = [-SHORE, ...AVE_X, SHORE];
  for (let i = 0; i < xsAll.length - 1; i++) {
    for (let j = 0; j < STREET_Z.length - 1; j++) {
      const x0 = xsAll[i] + (i === 0 ? DRIVE_IN + 11 : 12) + 5,
        x1 = xsAll[i + 1] - (i + 1 === xsAll.length - 1 ? DRIVE_IN + 11 : 12) - 5;
      const z0 = STREET_Z[j] + 12,
        z1 = STREET_Z[j + 1] - 12;
      blockYard(ctx, x0, x1, z0, z1);
    }
  }
  // the borough: every block has rear yards
  for (let i = 0; i < BORO_AVE.length - 1; i++) {
    const bz = BORO_Z.filter((z) => z < 1300);
    for (let j = 0; j < bz.length - 1; j++) blockYard(ctx, BORO_AVE[i] + 11, BORO_AVE[i + 1] - 11, bz[j] + 10, bz[j + 1] - 10, true);
  }
}

function blockYard(ctx, x0, x1, z0, z1, boro = false) {
  const { L, occ } = ctx;
  if (x1 - x0 < 20 || z1 - z0 < 20) return;
  const cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2;
  if (!boro) {
    if (cx > PARK.minX && cx < PARK.maxX && cz > PARK.minZ && cz < PARK.maxZ) return;
    if (cx > UNION.minX && cx < UNION.maxX && cz > UNION.minZ && cz < UNION.maxZ) return;
    if (Math.abs(cx) > driveX(cz) - 20) return;
  } else if (occ.hits({ x: cx, z: cz, hw: 4, hd: 4, yaw: 0 })) return;
  let core = 0;
  for (const c of CORES) core = Math.max(core, gauss(cx, cz, c));
  const green = boro || gauss(cx, cz, VILLAGE) > 0.35 || core < 0.12; // rear yards; paved courts under the towers
  L.paint.push((b) => b.rect(cx, cz, x1 - x0, z1 - z0, 0, SK.solid, { C: [green ? 'pine' : 'concrete'], y: -0.3 }));
  if (green) {
    // the rear yards are lots: a fence line down the middle of the block, and one between every yard
    const along = x1 - x0 > z1 - z0;
    L.paint.push((b) => {
      if (along) b.rect(cx, cz, x1 - x0, 0.35, 0, SK.solid, { C: ['cocoa'], y: -0.28 });
      else b.rect(cx, cz, 0.35, z1 - z0, 0, SK.solid, { C: ['cocoa'], y: -0.28 });
      const len = along ? x1 - x0 : z1 - z0,
        dep = along ? z1 - z0 : x1 - x0;
      for (let t = -len / 2 + 7; t < len / 2; t += 7) {
        if (along) b.rect(cx + t, cz, 0.3, dep, 0, SK.solid, { C: ['cocoa'], y: -0.28 });
        else b.rect(cx, cz + t, dep, 0.3, 0, SK.solid, { C: ['cocoa'], y: -0.28 });
      }
    });
  }
  if (!green) {
    // the middle of a midtown block isn't a car park: mid-block buildings fill what the street walls left
    const ids = ['midrise_modern', 'office_block', 'midrise_prewar', 'parking_garage'].filter((id) => L.lib.byId.has(id));
    const along = x1 - x0 > z1 - z0;
    const len = along ? x1 - x0 : z1 - z0;
    for (let s = -len / 2 + 4; s < len / 2 - 4; ) {
      const id = L.pick(ids);
      const t = L.lib.byId.get(id);
      const w = t.dims[0],
        d = t.dims[2];
      const x = along ? cx + s + w / 2 : cx,
        z = along ? cz : cz + s + w / 2;
      const yaw = along ? 0 : Math.PI / 2;
      const r = { x, z, hw: w / 2, hd: d / 2, yaw };
      if (s + w < len / 2 - 2 && !occ.hits(r)) {
        occ.add(r, 'bld');
        const v = (t.variants || []).filter((c) => CITY_OK.has(c));
        L.put(id, x, z, { yaw, tint: v.length ? L.pick(v) : undefined });
        s += w + 1;
      } else s += 6;
    }
  }
  for (let k = 0; k < (green ? 12 : 4); k++) {
    const x = L.range(x0 + 4, x1 - 4),
      z = L.range(z0 + 4, z1 - 4);
    const r = { x, z, hw: 2, hd: 2, yaw: 0 };
    if (occ.hits(r)) continue;
    occ.add(r, 'tree');
    L.put(pickId(L, ['street_tree', 'tree_round']), x, z, { scale: L.range(0.9, 1.3), tint: L.pick(['leaf', 'pine', 'lime', 'leaf']) });
  }
}

function unionSquare(ctx, life) {
  const { L, occ, paint } = ctx;
  const U = UNION;
  const cx = (U.minX + U.maxX) / 2,
    cz = (U.minZ + U.maxZ) / 2;
  paint.push((b) => {
    b.rect(cx, cz, U.maxX - U.minX, U.maxZ - U.minZ, 0, SK.solid, { C: ['leaf'], y: -0.28 });
    // a paved promenade round the edge and walks across the lawns
    for (const [x0, z0, x1, z1] of [[U.minX + 3, U.minZ + 3, U.maxX - 3, U.minZ + 3], [U.minX + 3, U.maxZ - 3, U.maxX - 3, U.maxZ - 3], [U.minX + 3, U.minZ + 3, U.minX + 3, U.maxZ - 3], [U.maxX - 3, U.minZ + 3, U.maxX - 3, U.maxZ - 3], [U.minX + 3, U.minZ + 3, U.maxX - 3, U.maxZ - 3], [U.minX + 3, U.maxZ - 3, U.maxX - 3, U.minZ + 3]]) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      b.rect((x0 + x1) / 2, (z0 + z1) / 2, 5, len, Math.atan2(x1 - x0, z1 - z0), SK.plaza, { P: [2], C: ['concrete', 'cloud', 'stone'], y: -0.26 });
    }
  });
  const free = (x, z, r = 2) => !occ.hits({ x, z, hw: r, hd: r, yaw: 0 }, new Set(['park', 'spawn']));
  // shade trees round the edge, a statue and benches, the farmers' market stalls on the north side
  for (let x = U.minX + 8; x < U.maxX - 4; x += 13)
    for (const z of [U.minZ + 9, U.maxZ - 9]) if (free(x, z)) L.put('tree_round', x, z, { scale: 1.5, tint: 'leaf' });
  for (let z = U.minZ + 22; z < U.maxZ - 18; z += 13)
    for (const x of [U.minX + 9, U.maxX - 9]) if (free(x, z)) L.put('tree_round', x, z, { scale: 1.5, tint: 'leaf' });
  if (free(70, cz, 4)) L.put('statue', 70, cz, { yaw: Math.PI / 2, tint: 'caramel' });
  for (let k = 0; k < 8; k++) {
    const x = U.minX + 30 + k * 26,
      z = U.minZ + 18;
    if (free(x, z)) L.put(pickId(L, ['lemonade_stand', 'hot_dog_cart']), x, z, { yaw: 0 });
  }
  for (let k = 0; k < 14; k++) {
    const x = L.range(U.minX + 14, U.maxX - 14),
      z = L.range(U.minZ + 14, U.maxZ - 14);
    if (free(x, z)) L.put('park_bench', x, z, { yaw: L.range(0, 6.28) });
  }
  const ids = ['person_adult', 'person_adult2', 'person_kid', 'person_teen', 'person_business', 'person_grandpa'].filter((i) => L.lib.byId.has(i));
  for (let k = 0; k < 45; k++) {
    const x = L.range(U.minX + 6, U.maxX - 6),
      z = L.range(U.minZ + 6, U.maxZ - 6);
    if (!free(x, z, 0.5)) continue;
    const it = L.put(L.pick(ids), x, z);
    if (it) life.grazers.push({ it, cx: x, cz: z, yaw: 0, hw: 4, hd: 4, speed: 1, still: 0.5 });
  }
  flock(L, life, 90, U.minZ + 40, 10, { r: 5 });
}

function plaza(ctx, life) {
  const { L } = ctx;
  // Broadway Plaza: a packed crowd on the pedestrianised blocks, carts, street performers, pigeons
  const ids = ['person_adult', 'person_adult2', 'person_kid', 'person_business', 'person_teen', 'person_grandpa'].filter((i) => L.lib.byId.has(i));
  for (const e of net.edges) {
    if (!e.plaza) continue;
    const [ax, az] = e.poly[0],
      [bx, bz] = e.poly[e.poly.length - 1];
    const yaw = Math.atan2(bx - ax, bz - az);
    const s0 = e.trimA || 0,
      s1 = e.len - (e.trimB || 0);
    const mid = (s0 + s1) / 2;
    const cx = ax + Math.sin(yaw) * mid,
      cz = az + Math.cos(yaw) * mid;
    const hd = Math.max(4, (s1 - s0) / 2 - 4),
      hw = e.w / 2 + e.walk - 1.5;
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    const at = (lx, lz) => [cx + c * lx + s * lz, cz - s * lx + c * lz];
    for (let k = 0; k < 4; k++) {
      const [x, z] = at(L.range(-hw * 0.5, hw * 0.5), L.range(-hd * 0.8, hd * 0.8));
      L.put(pickId(L, ['hot_dog_cart', 'newsstand', 'phone_booth']), x, z, { yaw: yaw + (L.rand() < 0.5 ? 0 : Math.PI) });
    }
    for (let k = 0; k < 6; k++) {
      const [x, z] = at(L.range(-hw * 0.7, hw * 0.7), L.range(-hd * 0.9, hd * 0.9));
      L.put('park_bench', x, z, { yaw: yaw + Math.PI / 2 });
    }
    // a performer with a ring of spectators
    const [px, pz] = at(0, hd * 0.3);
    L.put(pickId(L, ['person_teen', 'person_adult']), px, pz, { yaw: 0 });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      L.put(L.pick(ids), px + Math.sin(a) * 5, pz + Math.cos(a) * 5, { yaw: a + Math.PI });
    }
    flock(L, life, ...at(0, -hd * 0.4), 10, { r: 5 });
    for (let k = 0; k < 55; k++) {
      const [x, z] = at(L.range(-hw, hw), L.range(-hd, hd));
      const it = L.put(L.pick(ids), x, z);
      if (it) life.grazers.push({ it, cx, cz, yaw, hw, hd, speed: 1.1, still: 0.45 });
    }
  }
}

function centralPark(ctx, life) {
  const { L, paint } = ctx;
  const P = PARK;
  const inLake = (x, z, pad = 0) => LAKES.some((l) => ((x - l.cx) / (l.rx * 1.2 + pad)) ** 2 + ((z - l.cz) / (l.rz * 1.2 + pad)) ** 2 < 1);
  const paths = [];
  const path = (pts, w, C = ['sand', 'caramel']) => {
    paths.push(pts);
    paint.push((b) => b.ribbon(pts, pts.map(() => w / 2), SK.path, { P: [w / 2], C, y: -0.1 }));
  };
  // the reservoir's running track
  const track = blob(LAKES[1].cx, LAKES[1].cz, LAKES[1].rx + 14, LAKES[1].rz + 14, LAKES[1].ph, 48);
  path([...track, track[0]], 4, ['caramel', 'sand']);
  spawnLoopWalkers(L, life, track, 40, ['person_jogger', 'person_adult', 'person_teen'], { speed: [2.2, 3.4], dogs: 0 });
  // the Mall: a straight promenade lined with elms, from the south lawns to Bethesda Terrace on the Lake
  const mallA = [-120, -640],
    mallB = [-55, -955];
  path([mallA, mallB], 9, ['concrete', 'stone']);
  const ml = Math.hypot(mallB[0] - mallA[0], mallB[1] - mallA[1]);
  const mdx = (mallB[0] - mallA[0]) / ml,
    mdz = (mallB[1] - mallA[1]) / ml;
  for (let s = 6; s < ml - 6; s += 11)
    for (const sd of [-1, 1]) L.put('tree_round', mallA[0] + mdx * s - mdz * 8 * sd, mallA[1] + mdz * s + mdx * 8 * sd, { scale: 2.2, tint: 'leaf' });
  for (let s = 12; s < ml - 6; s += 22) for (const sd of [-1, 1]) L.put('park_bench', mallA[0] + mdx * s - mdz * 5 * sd, mallA[1] + mdz * s + mdx * 5 * sd, { yaw: Math.atan2(mdx, mdz) + (sd * Math.PI) / 2 });
  spawnLoopWalkers(L, life, [mallA, mallB, [mallB[0] + 2, mallB[1]], [mallA[0] + 2, mallA[1]]], 26);
  paint.push((b) => b.rect(mallB[0], mallB[1] + 2, 44, 20, 0, SK.plaza, { P: [1.8], C: ['sand', 'concrete', 'stone'], y: -0.08 }));
  L.put(pickId(L, ['town_fountain', 'statue']), mallB[0], mallB[1] + 2);
  // Bethesda Terrace is always busy
  for (let k = 0; k < 30; k++) {
    const it = L.put(L.pick(['person_adult', 'person_adult2', 'person_kid', 'person_teen', 'person_grandpa'].filter((i) => L.lib.byId.has(i))), mallB[0] + L.range(-20, 20), mallB[1] + 2 + L.range(-8, 8));
    if (it) life.grazers.push({ it, cx: mallB[0], cz: mallB[1] + 2, yaw: 0, hw: 21, hd: 9, speed: 0.9, still: 0.5 });
  }
  L.put(pickId(L, ['bandshell', 'gazebo']), -10, -880, { yaw: -Math.PI / 2 });
  // winding footpaths from the gates on the park's edges to the middle of things
  const wind = (a, b, bend, w = 4) => {
    const pts = [];
    const nx = -(b[1] - a[1]),
      nz = b[0] - a[0];
    const l = Math.hypot(nx, nz);
    for (let k = 0; k <= 30; k++) {
      const t = k / 30;
      const off = Math.sin(t * Math.PI) * bend + Math.sin(t * Math.PI * 3) * 14;
      pts.push([a[0] + (b[0] - a[0]) * t + (nx / l) * off, a[1] + (b[1] - a[1]) * t + (nz / l) * off]);
    }
    path(pts, w);
    return pts;
  };
  const E = 14; // paths stop at the perimeter sidewalk
  const walks = [
    wind([P.minX + E, -560], mallA, 30),
    wind([P.maxX - E, -650], [-60, -760], -40),
    wind([P.maxX - E, -1000], [40, -1000], 30),
    wind([P.minX + E, -1350], [-60, -1330], -25),
    wind([P.maxX - E, -1350], [60, -1320], 25),
    wind([P.minX + E, -1820], [80, -1840], 40),
    wind([-150, -1100], [-80, -1210], 20, 3),
    wind([60, -1090], [-20, -1200], -20, 3),
    wind([P.maxX - E, -1950], [150, -1930], 20),
  ];
  for (const w of walks.slice(0, 6)) spawnLoopWalkers(L, life, [...w, ...w.slice().reverse()], 7);
  // the Great Lawn: open grass with ball fields and people on blankets; Sheep Meadow likewise
  for (const [cx, cz] of [[-60, -1310], [60, -1310]]) paint.push((b) => b.disc(cx, cz + 22, 22, SK.dirt, { C: ['sand', 'caramel'], segs: 4, a0: Math.PI * 0.75, a1: Math.PI * 1.25, y: -0.08 }));
  for (const [cx, cz, hw, hd, n] of [[0, -1310, 110, 32, 30], [-175, -720, 42, 55, 40]]) {
    for (let k = 0; k < n; k++) {
      const it = L.put(L.pick(['person_adult', 'person_adult2', 'person_kid', 'person_teen'].filter((i) => L.lib.byId.has(i))), cx + L.range(-hw, hw), cz + L.range(-hd, hd));
      if (it) life.grazers.push({ it, cx, cz, yaw: 0, hw, hd, speed: 0.8, still: 0.8 });
    }
  }
  // woods: the Ramble, the North Woods, groves round the edges; open where the lawns, lakes and paths are
  const lawns = [[0, -1310, 130, 40], [-175, -720, 50, 64], [mallA[0] / 2 + mallB[0] / 2, (mallA[1] + mallB[1]) / 2, 22, 170]];
  const onPath = (x, z) => paths.some((p) => p.some(([px, pz]) => Math.abs(px - x) < 9 && Math.abs(pz - z) < 9));
  const clear = (x, z) =>
    inLake(x, z, 6) ||
    lawns.some(([cx, cz, hw, hd]) => Math.abs(x - cx) < hw && Math.abs(z - cz) < hd) ||
    TRANSVERSE.some((tz) => Math.abs(z - tz) < 16) ||
    Math.abs(x - (P.minX + PD)) < 22 ||
    Math.abs(x - (P.maxX - PD)) < 22 ||
    Math.abs(z - (P.minZ + PD)) < 22 ||
    Math.abs(z - (P.maxZ - PD)) < 22 ||
    onPath(x, z);
  const groves = [[-40, -1170, 90], [-120, -1880, 120], [120, -1760, 80], [-180, -1500, 70], [190, -1150, 70], [-200, -980, 60], [200, -830, 70], [-60, -560, 50], [190, -1420, 60], [-200, -1640, 60], [40, -1640, 60]];
  paint.push((b) => {
    for (const [gx, gz, gr] of groves) b.disc(gx, gz, gr * 0.9, SK.solid, { C: ['pine'], y: -0.55, segs: 28 });
  });
  let planted = 0;
  for (let k = 0; k < 6000 && planted < 720; k++) {
    let x, z;
    if (k % 3) {
      const [gx, gz, gr] = groves[k % groves.length];
      const a = L.rand() * Math.PI * 2,
        d = Math.sqrt(L.rand()) * gr;
      x = gx + Math.sin(a) * d;
      z = gz + Math.cos(a) * d;
    } else {
      x = L.range(P.minX + 14, P.maxX - 14);
      z = L.range(P.minZ + 14, P.maxZ - 14);
    }
    if (x < P.minX + 12 || x > P.maxX - 12 || z < P.minZ + 12 || z > P.maxZ - 12 || clear(x, z)) continue;
    L.put(L.rand() < 0.72 ? 'tree_round' : 'pine_tree', x, z, { scale: L.range(2.2, 3.6), tint: L.pick(['leaf', 'pine', 'lime', 'leaf', 'pine']) });
    planted++;
  }
  // the lake: rowboats out on the water; the carousel; the zoo's pond with ducks (pigeons, anyway)
  const lk = LAKES[0];
  for (let k = 0; k < 6; k++) {
    const cx = lk.cx + L.range(-60, 60),
      cz = lk.cz + L.range(-18, 18);
    const loop = [];
    for (let j = 0; j <= 12; j++) loop.push([cx + Math.sin((j / 12) * 6.283) * 26, cz + Math.cos((j / 12) * 6.283) * 12]);
    const it = L.put(pickId(L, ['rowboat', 'canoe']), loop[0][0], loop[0][1]);
    if (it) life.movers.push({ its: [it], offs: [0], route: loop, speed: 1.2 + L.rand(), s: k * 10, kind: 'boat' });
  }
  L.put('carousel', -200, -840);
  L.put('statue', -60, -1260, { yaw: 0 });
  flock(L, life, -150, -620, 10, { r: 6 });
  flock(L, life, 100, -1250, 8, { r: 5 });
  flock(L, life, 190, -650, 8, { r: 4 });
  // carriage horses on the bridle path just inside the drive
  const bridle = [];
  const bx0 = P.minX + PD + 18,
    bx1 = P.maxX - PD - 18,
    bz0 = P.minZ + PD + 18,
    bz1 = P.maxZ - PD - 18;
  for (let k = 0; k <= 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const sx = Math.sin(a),
      cz = Math.cos(a);
    // a rounded rectangle (superellipse)
    bridle.push([(bx0 + bx1) / 2 + Math.sign(sx) * Math.abs(sx) ** 0.25 * (bx1 - bx0) / 2, (bz0 + bz1) / 2 + Math.sign(cz) * Math.abs(cz) ** 0.25 * (bz1 - bz0) / 2]);
  }
  path(bridle, 2.4, ['sand', 'caramel']);
  for (let k = 0; k < 5; k++) {
    const it = L.put('horse', bridle[0][0], bridle[0][1]);
    if (it) life.movers.push({ its: [it], offs: [0], route: bridle, speed: 2.4, s: k * 700, kind: 'horse' });
  }
}

function batteryPark(ctx, life) {
  const { L, paint } = ctx;
  // lawn, trees, a promenade along the water and the ferry terminal at the very tip
  const rx = driveX(BAT_Z) - 20,
    rz = TIP1 - DRIVE_IN - BAT_Z - 20;
  for (let k = 0; k < 90; k++) {
    const a = L.range(-Math.PI / 2, Math.PI / 2),
      d = Math.sqrt(L.rand());
    const x = Math.sin(a) * rx * d,
      z = BAT_Z + 14 + Math.cos(a) * rz * d;
    L.put(L.rand() < 0.8 ? 'tree_round' : 'pine_tree', x, z, { scale: L.range(1.8, 2.8), tint: L.pick(['leaf', 'pine', 'lime']) });
  }
  // the esplanade follows the seawall round the tip, outside the drive
  const prom = [];
  for (let z = BAT_Z; z < TIP1 - 16; z += 8) prom.push([-Math.max(0, islandHalf(z) - 14), z]);
  prom.push([0, TIP1 - 14]);
  for (let z = TIP1 - 16 - ((TIP1 - 16 - BAT_Z) % 8); z >= BAT_Z; z -= 8) prom.push([Math.max(0, islandHalf(z) - 14), z]);
  paint.push((b) => b.ribbon(prom, prom.map(() => 3), SK.path, { P: [3], C: ['concrete', 'stone'], y: -0.08 }));
  spawnLoopWalkers(L, life, [...prom, ...prom.slice().reverse()], 24);
  L.put(pickId(L, ['pier_shed', 'container_stack']), 0, TIP1 - 8, { yaw: 0, scale: 0.6 });
  flock(L, life, 120, BAT_Z + 60, 9, { r: 5 });
}

function waterfront(ctx, life) {
  const { L, paint } = ctx;
  // piers on the west shore, the statue island, ships and ferries
  for (const z of [-1700, -1100, -500, 100, 700]) {
    paint.push((b) => b.rect(-SHORE - 60, z, 120, 34, 0, SK.plaza, { P: [4], C: ['stone', 'concrete', 'charcoal'], y: 0 }));
    L.put(pickId(L, ['pier_shed', 'container_stack']), -SHORE - 62, z, { yaw: -Math.PI / 2 });
  }
  L.put('cruise_ship', -SHORE - 70, -1410, { yaw: L.along('cruise_ship', Math.PI / 2) + Math.PI / 2 });
  L.put('giant_statue', 320, 2050, { yaw: Math.PI + 0.3, scale: 0.75 });
  L.put('lighthouse', -1200, 1500, { scale: 1.5 });
  const ferry = pickId(L, ['ferry', 'fishing_boat']);
  // ferries run long loops between their two landings (turning wide, never spinning on the spot)
  const shuttle = (ax, az, bx, bz, wide, n = 28) => {
    const cx = (ax + bx) / 2,
      cz = (az + bz) / 2;
    const hl = Math.hypot(bx - ax, bz - az) / 2;
    const ux = (bx - ax) / (2 * hl),
      uz = (bz - az) / (2 * hl);
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      const along = Math.cos(a) * hl,
        across = Math.sin(a) * wide;
      pts.push([cx + ux * along - uz * across, cz + uz * along + ux * across]);
    }
    return pts;
  };
  const routes = [
    { pts: shuttle(40, TIP1 + 50, 300, 1985, 90), speed: 8 },
    { pts: shuttle(-SHORE - 40, 400, WEST_X0 + 40, 400, 110), speed: 9 },
    { pts: shuttle(SHORE + 40, 900, EAST_X0 - 40, 900, 110), speed: 9 },
  ];
  for (const r of routes) {
    const it = L.put(ferry, r.pts[0][0], r.pts[0][1]);
    if (it) life.movers.push({ its: [it], offs: [0], route: r.pts, speed: r.speed, loop: true, kind: 'boat' });
  }
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
  for (const [x, dir] of [[-1020, 1], [1000, -1]]) {
    const route = [];
    for (let z = -2350; z <= 1700; z += 200) route.push([x + dir * 40, z]);
    for (let z = 1700; z >= -2350; z -= 200) route.push([x - dir * 40, z]);
    for (let k = 0; k < 3; k++) {
      const it = L.put(pickId(L, ['river_barge', 'fishing_boat']), x, 0);
      if (it) life.movers.push({ its: [it], offs: [0], route, speed: 6, s: k * 2700, kind: 'boat' });
    }
  }
  // the bridges themselves
  const bridge = pickId(L, ['suspension_bridge', 'bridge_tower']);
  const place = (x, z) => {
    if (bridge === 'suspension_bridge') L.put(bridge, x, z, { y: -5.4, yaw: 0 });
    else for (const dx of [-120, 120]) L.put(bridge, x + dx, z, { tint: 'sky' });
  };
  BRIDGES_Z.forEach((z) => place((SHORE + EAST_X0) / 2, z));
  place((-SHORE + WEST_X0) / 2, WEST_BRIDGE_Z);
  // the ferris wheel on the borough's waterfront
  if (L.lib.byId.get('ferris_wheel_frame')) {
    L.put('ferris_wheel_frame', EAST_X0 + 80, 1250, { yaw: Math.PI / 2 });
    const ringT = L.lib.byId.get('ferris_wheel_ring');
    const axle = L.lib.byId.get('ferris_wheel_frame').axle ?? 19;
    const ringIt = L.put('ferris_wheel_ring', EAST_X0 + 80, 1250, { yaw: Math.PI / 2, y: axle - ringT.dims[1] / 2 });
    if (ringIt) life.spinners.push({ it: ringIt, axis: 'z', rate: 0.12 });
  } else L.put('big_wheel', EAST_X0 + 90, 1250, { yaw: Math.PI / 2 });
}

function borough(ctx, life) {
  const { L, paint } = ctx;
  // cars parked along both curbs of the rowhouse streets
  const parked = ['car', 'suv', 'hatchback', 'car', 'delivery_van'].filter((id) => L.lib.byId.has(id));
  for (const e of net.edges) {
    if (e.name !== 'Boro St') continue;
    const dx = (e.poly[1][0] - e.poly[0][0]) / e.len,
      dz = (e.poly[1][1] - e.poly[0][1]) / e.len;
    for (const side of [1, -1])
      for (let v = (e.trimA || 0) + 8; v < e.len - (e.trimB || 0) - 8; v += 6.5) {
        if (L.rand() > 0.2) continue;
        const u = side * (e.w / 2 - 1.1);
        const id = L.pick(parked);
        L.put(id, e.poly[0][0] + dx * v - dz * u, e.poly[0][1] + dz * v + dx * u, { yaw: L.along(id, Math.atan2(dx * side, dz * side)), tint: L.pick(['paper', 'cloud', 'stone', 'slate', 'cocoa', 'tomato', 'sky', 'navy']) });
      }
  }
  // the stadium in its car park, the park with its lake, factories on the water, the museum, the El
  L.put('stadium', 1800, -1500, { yaw: 0 });
  // the waterfront park along the river, with a promenade
  const px0 = EAST_X0 + 22,
    px1 = BORO_AVE[0] - 26;
  for (let z = -2150; z < 1230; z += 26)
    for (const x of [px0, px1]) {
      const r = { x, z, hw: 2, hd: 2, yaw: 0 };
      if (ctx.occ.hits(r)) continue;
      ctx.occ.add(r, 'tree');
      L.put(L.rand() < 0.75 ? 'tree_round' : 'pine_tree', x + L.range(-3, 3), z + L.range(-4, 4), { scale: L.range(1.6, 2.2), tint: L.pick(['leaf', 'pine', 'lime']) });
    }
  paint.push((b) => b.rect((px0 + px1) / 2, -460, 4, 3380, 0, SK.path, { P: [2], C: ['concrete', 'stone'], y: -1.1 }));
  spawnLoopWalkers(L, life, [[(px0 + px1) / 2, -2140], [(px0 + px1) / 2, 1220], [(px0 + px1) / 2 + 1, 1220], [(px0 + px1) / 2 + 1, -2140]], 40, ['person_adult', 'person_adult2', 'person_jogger', 'person_kid']);
  parkingLot(ctx, 1800, -1300, 280, 40, Math.PI / 2, { fill: 0.5 });
  L.put('factory_chimneys', 1330, -900, { yaw: Math.PI / 2 });
  L.put('factory_chimneys', 1330, 200, { yaw: Math.PI / 2 });
  L.put('museum_dome', 1900, 800, { yaw: -Math.PI / 2 });
  // Prospect Park
  for (let k = 0; k < 140; k++) {
    const x = 1830 + L.range(-160, 160),
      z = -600 + L.range(-140, 140);
    const l = LAKES[4];
    if (((x - l.cx) / (l.rx * 1.25)) ** 2 + ((z - l.cz) / (l.rz * 1.25)) ** 2 < 1) continue;
    L.put(L.rand() < 0.75 ? 'tree_round' : 'pine_tree', x, z, { scale: L.range(1.8, 2.8), tint: L.pick(['leaf', 'pine', 'lime']) });
  }
  const loop = blob(1830, -600, 140, 120, 0.3, 40);
  paint.push((b) => b.ribbon([...loop, loop[0]], [...loop, loop[0]].map(() => 2.5), SK.path, { P: [2.5], C: ['sand', 'caramel'], y: -0.08 }));
  spawnLoopWalkers(L, life, loop, 22, ['person_jogger', 'person_adult', 'person_adult2', 'person_kid']);
  flock(L, life, 1800, -1240, 8, { r: 5 });
  flock(L, life, 1760, -520, 7, { r: 4 });
  const via = L.lib.byId.get('elevated_viaduct');
  if (via) {
    const segL = via.dims[0];
    for (let z = -S + segL / 2; z < 1250; z += segL) L.put('elevated_viaduct', ELEVATED_X + 9, z, { yaw: Math.PI / 2 });
    const car = L.lib.byId.get('subway_car');
    if (car) {
      const route = [[ELEVATED_X + 7, -S - 200], [ELEVATED_X + 7, 1240], [ELEVATED_X + 11, 1240], [ELEVATED_X + 11, -S - 200]];
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
}

function westBank(ctx, life) {
  const { L, paint } = ctx;
  // airport: runway, taxiway, terminal, tower, hangars, planes at the gates, one taking off on a loop
  const RX = -1830,
    R0 = -1300,
    R1 = 500;
  paint.push((b) => {
    b.rect(RX, (R0 + R1) / 2, 60, R1 - R0, 0, SK.runway, { P: [30, R1 - R0], C: ['charcoal', 'paper'], uv0: [0, (R1 - R0) / 2] });
    b.rect(RX + 120, (R0 + R1) / 2, 25, R1 - R0, 0, SK.asphalt, { C: ['charcoal'] });
    for (const z of [R0 + 20, -400, R1 - 20]) b.rect(RX + 60, z, 95, 22, 0, SK.asphalt, { C: ['charcoal'], y: -0.01 }); // taxiway links
    b.rect(RX + 260, -350, 240, 600, 0, SK.asphalt, { C: ['charcoal'] }); // apron
  });
  L.put(pickId(L, ['airport_terminal', 'parking_garage']), -1480, -350, { yaw: -Math.PI / 2 });
  L.put(pickId(L, ['control_tower', 'radio_mast']), -1560, -720);
  for (const z of [-1050, -950]) L.put(pickId(L, ['hangar', 'garage']), -1600, z, { yaw: -Math.PI / 2 });
  for (const z of [-560, -440, -320, -200]) L.put('airliner', -1600, z, { yaw: L.along('airliner', Math.PI / 2) }); // nose-in at the gates
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
  // port: cranes on the quay, container stacks, ships at berth, trucks on the freight road
  for (let k = 0; k < 6; k++) L.put('harbour_crane', WEST_X0 - 20, 850 + k * 70, { yaw: Math.PI / 2 });
  for (let k = 0; k < 24; k++) L.put('container_stack', -1450 - (k % 4) * 60, 820 + Math.floor(k / 4) * 70, { yaw: (Math.PI / 2) * (k % 2) });
  L.put('cargo_ship', WEST_X0 + 40, 1000, { yaw: L.along('cargo_ship', 0) });
  woods(ctx, { minX: -S, maxX: WEST_X0 - 120, minZ: -S, maxZ: -1500 }, { count: 200, ids: ['pine_tree', 'tree_round'], scale: [2.5, 4] });
  // a riverside walk along the Jersey shore
  paint.push((b) => b.rect(WEST_X0 - 12, -250, 6, 2000, 0, SK.path, { P: [3], C: ['concrete', 'stone'], y: -0.08 }));
  const walk = [[WEST_X0 - 12, -1240], [WEST_X0 - 12, 740]];
  spawnLoopWalkers(L, life, [...walk, [WEST_X0 - 11, 740], [WEST_X0 - 11, -1240]], 30);
}

function streetFurniture(ctx) {
  const { L } = ctx;
  // lamps on every avenue, trees on the side streets, hydrants, subway entrances at avenue corners
  for (const e of net.edges) {
    if (e.y > 0.1 || e.walk <= 0 || e.plaza) continue;
    const big = e.cls === 'avenue' || e.cls === 'boulevard' || e.cls === 'arterial';
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
        else L.put(pickId(L, ['street_tree', 'tree_round']), px, pz, { scale: 0.9, tint: L.pick(['leaf', 'pine', 'lime']) });
        if (L.rand() < 0.08) L.put('fire_hydrant', px + dx * 3, pz + dz * 3);
      }
    }
  }
  for (const n of net.nodes) {
    if (n.deg < 4 || !n.signal || L.rand() > 0.35) continue;
    if (Math.abs(n.x) > SHORE) continue;
    // on the corner sidewalk of the first arm that has one
    const arm = n.arms.find((a) => net.edges[a.e].walk > 2 && !net.edges[a.e].plaza);
    if (!arm) continue;
    const e = net.edges[arm.e];
    const dx = Math.sin(arm.ang),
      dz = Math.cos(arm.ang);
    const off = e.w / 2 + e.verge + e.walk * 0.55,
      back = arm.trim + 6;
    L.put(pickId(L, ['subway_entrance', 'phone_booth']), n.x + dx * back + dz * off, n.z + dz * back - dx * off, { yaw: arm.ang });
  }
}

// review views (tests/city_review.mjs)
export const review = {
  play: [
    { name: 'village', x: 228, z: 495, yaw: Math.PI },
    { name: 'avenue', x: 300, z: 300, yaw: Math.PI },
    { name: 'plaza', x: PLAZA_C[0] + Math.sin(BW_PHI) * 40, z: PLAZA_C[1] + Math.cos(BW_PHI) * 40, yaw: BW_PHI + Math.PI, d: 16 },
    { name: 'park', x: -300, z: -560, yaw: Math.PI, d: 80 },
    { name: 'downtown', x: 300, z: 1250, yaw: 0, d: 120 },
    { name: 'bridge', x: 760, z: 550, yaw: Math.PI / 2, d: 200 },
    { name: 'borough', x: 1700, z: 300, yaw: Math.PI, d: 60 },
  ],
  aerial: [
    { name: 'midtown', pos: [600, 430, 700], look: [0, 0, -100] },
    { name: 'downtown', pos: [-700, 430, 2200], look: [100, 0, 1300] },
    { name: 'park', pos: [700, 450, -600], look: [0, 0, -1250] },
    { name: 'borough', pos: [1000, 430, 600], look: [1700, 0, -100] },
    { name: 'jersey', pos: [-700, 380, 500], look: [-1400, 0, -150] },
  ],
  map: { cx: 0, cz: 0, half: 2250 },
  maps: [
    { name: 'midtown', cx: 0, cz: -150, half: 650 },
    { name: 'downtown', cx: 0, cz: 1350, half: 650 },
    { name: 'park', cx: 0, cz: -1250, half: 800 },
  ],
  motion: [
    { name: 'fifth_ave', pos: [60, 90, 300], look: [0, 0, 180] },
    { name: 'plaza', pos: [PLAZA_C[0] + 20, 120, PLAZA_C[1] + 110], look: [PLAZA_C[0], 0, PLAZA_C[1]] },
    { name: 'park', pos: [-40, 120, -900], look: [-40, 0, -1030] },
    { name: 'airport', pos: [-1380, 170, 0], look: [-1620, 0, -380] },
    { name: 'harbour', pos: [500, 250, 1700], look: [100, 0, 2000] },
  ],
};
