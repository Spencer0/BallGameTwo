// Life: everything that moves on its own in the outdoor levels (CITY.md §3.3).
//   cars      follow network lanes, choose turns, keep their distance, obey signals/stop signs, U-turn
//             round cul-de-sacs, leave and re-enter at the map edge, stop (and honk) for the ball
//   peds      walk sidewalk paths with a waddle, cross between corners, pause, flee a ball that can eat them
//   followers dogs on leads (offset from their walker)
//   grazers   wander inside a local rectangle (yard dogs, cows, sheep)
//   flocks    sit, peck, burst into the air when the ball comes near, land somewhere else
//   movers    trains/boats/planes on fixed routes (several instances spaced along one route)
//   spinners  ferris wheels, windmill sails, water wheels, carousels
//   signals   traffic lights cycling, tinting their lamp instances
// Instances stay world objects (collectible); once one is picked up the agent drops it for good.
// Simulation LOD: full rate near the camera, every 4th frame further out, every 16th far away.
import { GONE, MOVING, MOVING_AIR } from './world.js';
import { PAL } from '../render/palette.js';
import * as rules from './rules.js';

const CUR = { seg: 1, px: 0, pz: 0, py: 0, hx: 0, hz: 1 };
const TINT_GREEN = PAL.leaf + 1,
  TINT_AMBER = PAL.sun + 1,
  TINT_RED = PAL.tomato + 1;

/** polyline cursor sampling: p [[x,z],...], L cumulative lengths; keeps a segment hint on the agent */
function at(p, L, s, a) {
  let k = a.seg || 1;
  if (k >= L.length) k = L.length - 1;
  while (k > 1 && L[k - 1] > s) k--;
  while (k < L.length - 1 && L[k] < s) k++;
  a.seg = k;
  const seg = L[k] - L[k - 1] || 1e-9;
  const t = Math.max(0, Math.min(1, (s - L[k - 1]) / seg));
  const ax = p[k - 1][0],
    az = p[k - 1][1];
  a.px = ax + (p[k][0] - ax) * t;
  a.pz = az + (p[k][1] - az) * t;
  a.hx = (p[k][0] - ax) / seg;
  a.hz = (p[k][1] - az) / seg;
  if (p[k].length > 2) a.py = p[k - 1][2] + (p[k][2] - p[k - 1][2]) * t;
}

function cumul(p) {
  const L = [0];
  for (let k = 1; k < p.length; k++) L.push(L[k - 1] + Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]));
  return L;
}

export class Life {
  /**
   * @param session  the Session (world, ball, events, time)
   * @param spec     layout.life with item references
   * @param inst     item -> instance index resolver
   */
  constructor(session, spec, inst) {
    this.s = session;
    this.w = session.world;
    this.net = spec.net || null;
    this.cars = [];
    this.peds = [];
    this.followers = [];
    this.grazers = [];
    this.flocks = [];
    this.movers = [];
    this.spinners = [];
    this.signals = [];
    this.frame = 0;
    this.conn = new Map(); // connector polylines between lanes
    this.agentOf = new Int32Array(this.w.cap).fill(-1);
    this.released = new Uint8Array(this.w.cap);
    const net = this.net;
    if (net) {
      this.laneCars = net.lanes.map(() => []);
      this.laneIncoming = new Int16Array(net.lanes.length); // cars in a junction headed into each lane
      this.nodeOcc = net.nodes.map(() => []); // cars currently driving through each junction
      this.conflictCache = new Map();
      this.entries = net.lanes.filter((l) => net.nodes[l.from].exit).map((l) => l.id);
      // signal state per node
      this.sig = net.nodes.map((n) => (n.signal ? { t: Math.random() * 30, phase: 0 } : null));
    }
    const reg = (i) => i >= 0 && i < this.w.cap;
    for (const c of spec.cars || []) {
      const i = inst(c.it);
      if (!reg(i)) continue;
      const t = this.w.types[this.w.type[i]];
      const a = { i, lane: c.lane, s: c.s, v: 0, vmax: (0.75 + Math.random() * 0.35) * (c.speed ?? 1), len: t.dims[0] * this.w.scale[i], conn: null, next: -1, wait: 0, honkT: 0, dead: false, seg: 1, y: c.y ?? 0 };
      this.cars.push(a);
      this.laneCars[a.lane].push(a);
      this.agentOf[i] = this.cars.length - 1;
    }
    for (const p of spec.peds || []) {
      const i = inst(p.it);
      if (!reg(i)) continue;
      const wk = p.path ? { pts: p.path, L: cumul(p.path), loop: !!p.loop } : net.walks[p.walk];
      this.peds.push({ i, walk: p.walk ?? -1, path: p.path ? wk : null, s: p.s, dir: p.dir ?? 1, v: p.speed ?? 1.1 + Math.random() * 0.5, base: p.speed ?? 1.2, lat: p.lat ?? (Math.random() - 0.5) * 0.8, cross: null, pause: 0, phase: Math.random() * 6, run: p.run ?? false, dead: false, seg: 1 });
    }
    for (const f of spec.followers || []) {
      const i = inst(f.it);
      const owner = this.peds.find((p) => p.i === inst(f.owner));
      if (!reg(i) || !owner) continue;
      this.followers.push({ i, owner, side: f.side ?? 0.9, back: f.back ?? 1.2, phase: Math.random() * 6, dead: false });
    }
    for (const g of spec.grazers || []) {
      const i = inst(g.it);
      if (!reg(i)) continue;
      this.grazers.push({ i, cx: g.cx, cz: g.cz, yaw: g.yaw ?? 0, hw: g.hw, hd: g.hd, heading: Math.random() * 6.28, t: 0, speed: g.speed ?? 0.6, still: g.still ?? 0.4, phase: Math.random() * 6, dead: false });
    }
    for (const f of spec.flocks || []) {
      const birds = f.its.map(inst).filter(reg);
      if (!birds.length) continue;
      this.flocks.push({ birds, yawOff: f.yawOff ?? 0, x: f.x, z: f.z, r: f.r ?? 4, state: 0, t: 0, homes: f.homes || null, vx: new Float32Array(birds.length), vy: new Float32Array(birds.length), vz: new Float32Array(birds.length), tx: 0, tz: 0, y0: f.y ?? 0 });
    }
    for (const m of spec.movers || []) {
      const its = m.its.map(inst);
      const pts = m.route;
      const L = cumul(pts);
      const pause = m.pause ? { at: [...(m.pause.at || []), ...(m.pause.points || []).map((k) => Math.max(0.01, L[k]))], time: m.pause.time } : null;
      this.movers.push({ its, offs: m.offs, pts, L, len: L[L.length - 1], s: m.s ?? 0, v: m.speed, loop: m.loop ?? true, pause, pt: 0, y: m.y ?? 0, pitch: m.pitch ?? false, kind: m.kind || 'mover', seg: 1, segs: its.map(() => 1), dead: false, air: m.air ?? false });
    }
    for (const sp of spec.spinners || []) {
      const i = inst(sp.it);
      if (!reg(i)) continue;
      this.spinners.push({ i, axis: sp.axis || 'z', rate: sp.rate ?? 0.3, a: Math.random() * 6 });
    }
    for (const sg of spec.signals || []) {
      const lights = sg.lights.map((l) => ({ i: inst(l.it), group: l.group })).filter((l) => reg(l.i));
      if (lights.length) this.signals.push({ node: sg.node, lights });
    }
    // rail crossings: lights flash and cars wait while a train is near
    this.crossings = (spec.crossings || []).map((c) => ({
      x: c.x,
      z: c.z,
      r: c.r ?? 120,
      lights: (c.lights || []).map(inst).filter(reg),
      // gate arms swing about their hinge end: hinge (hx,hy,hz), pointing along yaw when lowered
      gates: (c.gates || []).map((g) => ({ ...g, i: inst(g.it), a: 1.45 })).filter((g) => g.i >= 0),
      active: false,
    }));
    this.trains = this.movers.filter((m) => m.kind === 'train');
    this.honks = 0;
  }

  /** the ball picked this instance up: stop driving it for good */
  release(i) {
    this.released[i] = 1;
  }

  alive(i) {
    return !this.released[i] && this.w.state[i] !== GONE;
  }

  update(dt) {
    this.dtLast = dt;
    this.frame++;
    const f = this.frame;
    const ball = this.s.ball;
    const cam = this.s.camera;
    const cx = cam.position.x,
      cz = cam.position.z;
    const near = Math.max(120, this.w.viewDist * 0.45);
    const near2 = near * near,
      far2 = (near * 2.2) ** 2;
    // decide each agent's update cadence from its distance to the camera
    const tick = (x, z, k) => {
      const d2 = (x - cx) ** 2 + (z - cz) ** 2;
      if (d2 < near2) return 1;
      if (d2 < far2) return (f + k) % 4 === 0 ? 4 : 0;
      return (f + k) % 16 === 0 ? 16 : 0;
    };
    if (this.crossings.length) this.updateCrossings();
    // who is where near the camera, in coarse cells: cars yield to people in front of them, people wait
    // for a gap before stepping off the kerb (only agents in view matter for that)
    this.pedHash = this.hashAgents(this.peds, 6, near2, cx, cz, this.pedHash);
    this.carHash = this.hashAgents(this.cars, 12, near2, cx, cz, this.carHash);
    if (this.net) {
      this.updateSignals(dt);
      for (let k = 0; k < this.cars.length; k++) {
        const a = this.cars[k];
        if (a.dead) continue;
        if (!this.alive(a.i)) {
          this.dropCar(a);
          continue;
        }
        const m = tick(this.w.x[a.i], this.w.z[a.i], k);
        if (m) this.stepCar(a, dt * m, ball);
      }
    }
    {
      for (let k = 0; k < this.peds.length; k++) {
        const p = this.peds[k];
        if (p.dead) continue;
        if (!this.alive(p.i)) {
          p.dead = true;
          continue;
        }
        const m = tick(this.w.x[p.i], this.w.z[p.i], k);
        if (m) this.stepPed(p, dt * m, ball);
      }
    }
    for (const fl of this.followers) {
      if (fl.dead) continue;
      if (!this.alive(fl.i)) {
        fl.dead = true;
        continue;
      }
      if (fl.owner.dead) {
        // lost its walker: wanders off as a grazer around here
        fl.dead = true;
        this.grazers.push({ i: fl.i, cx: this.w.x[fl.i], cz: this.w.z[fl.i], yaw: 0, hw: 6, hd: 6, heading: 0, t: 0, speed: 1.5, still: 0.2, phase: 0, dead: false });
        continue;
      }
      this.stepFollower(fl, dt);
    }
    for (let k = 0; k < this.grazers.length; k++) {
      const g = this.grazers[k];
      if (g.dead) continue;
      if (!this.alive(g.i)) {
        g.dead = true;
        continue;
      }
      const m = tick(this.w.x[g.i], this.w.z[g.i], k);
      if (m) this.stepGrazer(g, dt * m, ball);
    }
    for (const fl of this.flocks) this.stepFlock(fl, dt, ball);
    for (const mv of this.movers) this.stepMover(mv, dt, ball);
    for (const sp of this.spinners) {
      if (!this.alive(sp.i)) continue;
      sp.a += sp.rate * dt;
      if (sp.axis === 'y') this.w.yaw[sp.i] = sp.a;
      else this.w.tilt[sp.i * 2 + 1] = sp.a;
      this.w.updateMatrix(sp.i);
    }
  }

  // ------------------------------------------------------------------ signals
  updateSignals(dt) {
    const net = this.net;
    for (let n = 0; n < this.sig.length; n++) {
      const g = this.sig[n];
      if (!g) continue;
      g.t += dt;
      const C = 14 + 3 + 1.5 + 11 + 3 + 1.5;
      const t = g.t % C;
      // phase: 0 A green, 1 A amber, 2 all red, 3 B green, 4 B amber, 5 all red
      g.phase = t < 14 ? 0 : t < 17 ? 1 : t < 18.5 ? 2 : t < 29.5 ? 3 : t < 32.5 ? 4 : 5;
    }
    for (const sg of this.signals) {
      const g = this.sig[sg.node];
      if (!g) continue;
      for (const l of sg.lights) {
        if (!this.alive(l.i)) continue;
        const green = l.group === 0 ? g.phase === 0 : g.phase === 3;
        const amber = l.group === 0 ? g.phase === 1 : g.phase === 4;
        this.w.tint[l.i] = green ? TINT_GREEN : amber ? TINT_AMBER : TINT_RED;
      }
    }
  }

  updateCrossings() {
    const w = this.w;
    const blink = Math.floor(this.s.time * 2.2) % 2 === 0;
    for (const c of this.crossings) {
      let near = false;
      for (const m of this.trains) {
        if (m.dead) continue;
        for (const i of m.its) {
          if (i < 0 || !this.alive(i)) continue;
          if ((w.x[i] - c.x) ** 2 + (w.z[i] - c.z) ** 2 < c.r * c.r) {
            near = true;
            break;
          }
        }
        if (near) break;
      }
      c.active = near;
      for (const g of c.gates) {
        if (!this.alive(g.i)) continue;
        const goal = near ? 0 : 1.45;
        const da = goal - g.a;
        if (Math.abs(da) < 1e-3 && g.set) continue;
        g.a += Math.sign(da) * Math.min(Math.abs(da), 0.9 * this.dtLast);
        g.set = true;
        const t = w.types[w.type[g.i]],
          s = w.scale[g.i];
        const half = (t.dims[0] * s) / 2,
          cy = (t.dims[1] * s) / 2;
        const ca = Math.cos(g.a);
        w.x[g.i] = g.hx + Math.cos(g.yaw) * ca * half;
        w.z[g.i] = g.hz - Math.sin(g.yaw) * ca * half;
        w.y[g.i] = g.hy + Math.sin(g.a) * half - cy;
        w.yaw[g.i] = g.yaw;
        w.tilt[g.i * 2 + 1] = g.a;
        w.updateMatrix(g.i);
        w.moved(g.i);
      }
      for (let k = 0; k < c.lights.length; k++) {
        const i = c.lights[k];
        if (!this.alive(i)) continue;
        w.tint[i] = near ? ((k % 2 === 0) === blink ? TINT_RED : PAL.charcoal + 1) : PAL.charcoal + 1;
      }
    }
  }

  /** agents within near of the camera, bucketed by cell (reuses the map and its arrays) */
  hashAgents(list, cell, near2, cx, cz, H) {
    H = H || { cell, map: new Map() };
    for (const arr of H.map.values()) arr.length = 0;
    const w = this.w;
    for (let k = 0; k < list.length; k++) {
      const a = list[k];
      if (a.dead) continue;
      const x = w.x[a.i],
        z = w.z[a.i];
      if ((x - cx) ** 2 + (z - cz) ** 2 > near2) continue;
      const key = (Math.floor(x / cell) + 32768) * 65536 + (Math.floor(z / cell) + 32768);
      let arr = H.map.get(key);
      if (!arr) H.map.set(key, (arr = []));
      arr.push(a);
    }
    return H;
  }

  /** first agent in hash H within r of (x,z) that passes test, or null */
  nearAgent(H, x, z, r, test = null) {
    if (!H) return null;
    const w = this.w,
      c = H.cell;
    const x0 = Math.floor((x - r) / c),
      x1 = Math.floor((x + r) / c),
      z0 = Math.floor((z - r) / c),
      z1 = Math.floor((z + r) / c);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const arr = H.map.get((ix + 32768) * 65536 + (iz + 32768));
        if (!arr) continue;
        for (const a of arr) {
          const dx = w.x[a.i] - x,
            dz = w.z[a.i] - z;
          if (dx * dx + dz * dz < r * r && (!test || test(a))) return a;
        }
      }
    return null;
  }

  /** is a train passing the level crossing near (x,z)? */
  railBusy(x, z, r = 12) {
    for (const c of this.crossings) if (c.active && (c.x - x) ** 2 + (c.z - z) ** 2 < r * r) return true;
    return false;
  }

  /** a car at (x,z) heading (hx,hz): is there an active crossing just ahead? */
  crossingAhead(x, z, hx, hz) {
    for (const c of this.crossings) {
      if (!c.active) continue;
      const dx = c.x - x,
        dz = c.z - z;
      const along = dx * hx + dz * hz;
      if (along > 4 && along < 34 && Math.abs(dx * hz - dz * hx) < 9) return along;
    }
    return 0;
  }

  /** may traffic on this lane (approaching its end node) go? */
  canGo(lane) {
    const g = this.sig[lane.to];
    if (!g) return true;
    const n = this.net.nodes[lane.to];
    const group = Math.abs(Math.sin(lane.inAng - n.mainAng)) < 0.5 ? 0 : 1;
    return group === 0 ? g.phase === 0 : g.phase === 3;
  }

  // ------------------------------------------------------------------ cars
  dropCar(a) {
    a.dead = true;
    const arr = this.laneCars[a.lane];
    const k = arr.indexOf(a);
    if (k >= 0) arr.splice(k, 1);
    if (a.conn) {
      this.leaveNode(a);
      if (a.next >= 0) this.laneIncoming[a.next] = Math.max(0, this.laneIncoming[a.next] - 1);
    }
  }

  leaveNode(a) {
    const occ = this.nodeOcc[this.net.lanes[a.lane].to];
    const k = occ.indexOf(a);
    if (k >= 0) occ.splice(k, 1);
  }

  /** do the paths of two junction movements cross (or merge)? cached per pair */
  conflicts(fromA, toA, fromB, toB) {
    if (toA === toB) return true;
    const key = fromA * 73856093 + toA * 19349663 + fromB * 83492791 + toB;
    let c = this.conflictCache.get(key);
    if (c !== undefined) return c;
    // conflict if the two paths ever come closer than a car's width plus a margin
    const dense = (P) => {
      const out = [];
      for (let i = 1; i < P.length; i++) {
        const n = Math.max(1, Math.ceil(Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])));
        for (let k = 0; k < n; k++) out.push([P[i - 1][0] + ((P[i][0] - P[i - 1][0]) * k) / n, P[i - 1][1] + ((P[i][1] - P[i - 1][1]) * k) / n]);
      }
      out.push(P[P.length - 1]);
      return out;
    };
    const A = dense(this.connector(fromA, toA).pts),
      B = dense(this.connector(fromB, toB).pts);
    c = false;
    for (let i = 0; i < A.length && !c; i++) for (let j = 0; j < B.length && !c; j++) if ((A[i][0] - B[j][0]) ** 2 + (A[i][1] - B[j][1]) ** 2 < 2.8 * 2.8) c = true;
    this.conflictCache.set(key, c);
    return c;
  }

  /** may car a (at the end of its lane, heading for a.next) enter the junction now? */
  junctionClear(a) {
    const occ = this.nodeOcc[this.net.lanes[a.lane].to];
    for (let k = 0; k < occ.length; k++) {
      const o = occ[k];
      if (o.lane === a.lane) {
        // the car ahead from my own lane: wait until it has pulled clear
        if (o.s < o.len + 3) return false;
        continue;
      }
      if (this.conflicts(a.lane, a.next, o.lane, o.next)) return false;
    }
    // a car waiting at another approach's stop line with its nose out over the junction: don't turn
    // through it
    const node = this.net.lanes[a.lane].to;
    if (!this.sig[node]) return true; // (only at lights, where the waiting car is held by its red)
    if (!this.nodeIn) {
      this.nodeIn = new Map();
      this.net.lanes.forEach((l, id) => {
        if (!this.nodeIn.has(l.to)) this.nodeIn.set(l.to, []);
        this.nodeIn.get(l.to).push(id);
      });
    }
    const path = this.connector(a.lane, a.next).pts;
    const w = this.w;
    for (const lid of this.nodeIn.get(node) || []) {
      if (lid === a.lane) continue;
      const cars = this.laneCars[lid];
      const lane = this.net.lanes[lid];
      for (const o of cars) {
        if (o.dead || o.conn || o.s < lane.len - 7 || o.v > 0.5 || this.canGo(lane)) continue;
        const ox = w.x[o.i],
          oz = w.z[o.i];
        for (const p of path) if ((p[0] - ox) ** 2 + (p[1] - oz) ** 2 < 9) return false;
      }
    }
    return true;
  }

  connector(from, to) {
    const key = from * 100003 + to;
    let c = this.conn.get(key);
    if (c) return c;
    const net = this.net;
    const A = net.lanes[from],
      B = net.lanes[to];
    const p0 = A.pts[A.pts.length - 1],
      p2 = B.pts[0];
    const m = A.pts.length - 1;
    const d0x = (p0[0] - A.pts[m - 1][0]) / (A.L[m] - A.L[m - 1] || 1),
      d0z = (p0[1] - A.pts[m - 1][1]) / (A.L[m] - A.L[m - 1] || 1);
    const d2x = (B.pts[1][0] - p2[0]) / (B.L[1] || 1),
      d2z = (B.pts[1][1] - p2[1]) / (B.L[1] || 1);
    const pts = [];
    const n = net.nodes[A.to];
    if (A.e === B.e && n.bulb) {
      // U-turn round the turning circle, keeping the island on the left
      const r = Math.max(4, n.bulb * 0.62);
      let a0 = Math.atan2(p0[0] - n.x, p0[1] - n.z),
        a1 = Math.atan2(p2[0] - n.x, p2[1] - n.z);
      // sweep the long way round in the direction that keeps traffic on the right
      const cross = d0x * (n.z - p0[1]) - d0z * (n.x - p0[0]);
      if (cross > 0) {
        while (a1 < a0) a1 += Math.PI * 2;
      } else {
        while (a1 > a0) a1 -= Math.PI * 2;
      }
      pts.push(p0);
      const steps = 14;
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        const a = a0 + (a1 - a0) * t;
        const rr = r + (Math.hypot(p0[0] - n.x, p0[1] - n.z) - r) * (1 - Math.sin(Math.PI * t));
        pts.push([n.x + Math.sin(a) * rr, n.z + Math.cos(a) * rr]);
      }
      pts.push(p2);
    } else {
      // quadratic Bezier through the intersection of the two lane lines
      const den = d0x * d2z - d0z * d2x;
      let cx = (p0[0] + p2[0]) / 2,
        cz = (p0[1] + p2[1]) / 2;
      if (Math.abs(den) > 0.05) {
        const t = ((p2[0] - p0[0]) * d2z - (p2[1] - p0[1]) * d2x) / den;
        if (t > 0 && t < 60) {
          cx = p0[0] + d0x * t;
          cz = p0[1] + d0z * t;
        }
      }
      const steps = 8;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps,
          u = 1 - t;
        pts.push([u * u * p0[0] + 2 * u * t * cx + t * t * p2[0], u * u * p0[1] + 2 * u * t * cz + t * t * p2[1]]);
      }
    }
    const L = cumul(pts);
    c = { pts, L, len: L[L.length - 1] };
    this.conn.set(key, c);
    return c;
  }

  chooseNext(a) {
    const net = this.net;
    const lane = net.lanes[a.lane];
    const opts = net.nextLanes(a.lane);
    if (!opts.length) return -1;
    // prefer going straight (weight 3), turns (1); keep the same lane index if possible
    let best = -1,
      total = 0;
    const weights = [];
    for (const id of opts) {
      const l = net.lanes[id];
      const turn = Math.abs(Math.sin((l.outAng0 - lane.inAng) / 2));
      let w = turn < 0.3 ? 3 : turn > 0.95 ? 0.15 : 1;
      if (l.j !== lane.j && net.edges[l.e].laneIds[l.dir].length > lane.j) w *= 0.3;
      w *= net.edges[l.e].draw ?? 1; // busy streets pull traffic (Main Street, the highway)
      weights.push(w);
      total += w;
    }
    let r = Math.random() * total;
    for (let k = 0; k < opts.length; k++) {
      r -= weights[k];
      if (r <= 0) {
        best = opts[k];
        break;
      }
    }
    return best >= 0 ? best : opts[0];
  }

  stepCar(a, dt, ball) {
    const net = this.net;
    const w = this.w;
    const lane = net.lanes[a.lane];
    let target = lane.speed * a.vmax;
    // following: nearest car ahead in this lane
    if (!a.conn) {
      const arr = this.laneCars[a.lane];
      let gap = Infinity;
      for (let k = 0; k < arr.length; k++) {
        const o = arr[k];
        if (o === a || o.s <= a.s) continue;
        const g = o.s - a.s - (o.len + a.len) / 2;
        if (g < gap) gap = g;
      }
      // the lane end: red light, stop sign, busy junction, or the next lane is jammed
      const toEnd = lane.len - a.s;
      if (toEnd < 40) {
        if (a.next < 0) a.next = this.chooseNext(a);
        let hold = false;
        const n = net.nodes[lane.to];
        if (!this.canGo(lane) && toEnd > 0.8) hold = true;
        if (!hold && n.stop && a.wait < 0.9) {
          if (toEnd < 1.5) {
            hold = true;
            if (a.v < 0.3) a.wait += dt;
          }
        }
        if (!hold && a.next >= 0 && toEnd < 8 && !this.junctionClear(a)) hold = true;
        if (!hold && a.next >= 0) {
          // don't enter if the start of the next lane is occupied or another car is already turning into it
          if (this.laneIncoming[a.next] > 0) hold = true;
          const nx = this.laneCars[a.next];
          for (let k = 0; k < nx.length; k++) if (nx[k].s < nx[k].len + 3) hold = true;
        }
        // measured from the nose, so a long truck stops as far behind the line as a hatchback
        if (hold) gap = Math.min(gap, toEnd - a.len / 2 + 2);
        a.hold = hold;
      } else a.hold = false;
      if (gap < Infinity) target = Math.min(target, Math.max(0, (gap - 2.5) * 1.1));
    }
    // a train coming through the level crossing ahead
    if (this.crossings.length) {
      const ca = this.crossingAhead(w.x[a.i], w.z[a.i], a.hx ?? 0, a.hz ?? 1);
      // stop well back from the gate; a car already within a few metres of the tracks clears them
      if (ca > 11) target = Math.min(target, Math.max(0, (ca - 13) * 0.8));
    }
    // the ball in the way
    const bx = ball.pos.x - w.x[a.i],
      bz = ball.pos.z - w.z[a.i];
    const hx = a.hx ?? 0,
      hz = a.hz ?? 1;
    const along = bx * hx + bz * hz;
    const lat = Math.abs(bx * hz - bz * hx);
    const R = ball.r;
    if (along > -a.len * 0.3 && along < R + a.len + 10 && lat < R + 1.6) {
      target = Math.min(target, Math.max(0, (along - R - a.len / 2 - 1.2) * 0.9));
      if (a.v < 0.5) {
        a.honkT += dt;
        if (a.honkT > 1.2) {
          a.honkT = -2.5 - Math.random() * 3;
          this.s.events.emit('honk', { x: w.x[a.i], z: w.z[a.i], session: this.s });
          this.honks++;
        }
      }
    }
    // someone on the crossing (or stepping off the kerb) right in front: stop for them
    if (this.pedHash && target > 0) {
      const ahead = a.len / 2;
      for (const d of [ahead + 2, ahead + 5.5]) {
        if (this.nearAgent(this.pedHash, w.x[a.i] + hx * d, w.z[a.i] + hz * d, 1.9)) {
          target = 0;
          break;
        }
      }
    }
    const acc = target > a.v ? 2.6 : 7;
    a.v += Math.max(-acc * dt, Math.min(acc * dt, target - a.v));
    if (a.v < 0) a.v = 0;
    const sPrev = a.s;
    a.s += a.v * dt;
    if (!a.conn) {
      // never into the car ahead, even when it stopped harder than we can brake (it was told to wait)
      const arr = this.laneCars[a.lane];
      for (let k = 0; k < arr.length; k++) {
        const o = arr[k];
        if (o === a || o.s <= sPrev) continue;
        const lim = o.s - (o.len + a.len) / 2 - 0.3;
        if (a.s > lim) {
          a.s = Math.max(sPrev, lim);
          a.v = Math.min(a.v, o.v);
        }
      }
    }
    // advance along lane / connector
    if (!a.conn) {
      if (a.s >= lane.len && a.hold && !net.nodes[lane.to].exit) {
        // told to wait but arrived too fast to stop smoothly: stop at the line rather than barge in
        a.s = Math.max(sPrev, lane.len - a.len / 2);
        a.v = 0;
      }
      if (a.s >= lane.len) {
        const n = net.nodes[lane.to];
        if (n.exit) {
          this.respawn(a);
          return;
        }
        if (a.next < 0) a.next = this.chooseNext(a);
        if (a.next < 0) {
          a.s = lane.len;
          a.v = 0;
        } else {
          a.conn = this.connector(a.lane, a.next);
          a.s -= lane.len;
          a.seg = 1;
          this.laneIncoming[a.next]++;
          this.nodeOcc[lane.to].push(a);
          a.wait = 0;
        }
      }
    }
    if (a.conn && a.s >= a.conn.len) {
      this.leaveNode(a);
      this.laneIncoming[a.next]--;
      const arr = this.laneCars[a.lane];
      arr.splice(arr.indexOf(a), 1);
      a.s -= a.conn.len;
      a.lane = a.next;
      a.next = -1;
      a.conn = null;
      a.seg = 1;
      this.laneCars[a.lane].push(a);
    }
    const P = a.conn || net.lanes[a.lane];
    at(P.pts, P.L, a.s, a);
    w.x[a.i] = a.px;
    w.z[a.i] = a.pz;
    w.y[a.i] = net.lanes[a.lane].y || a.y;
    w.yaw[a.i] = Math.atan2(a.hx, a.hz) - Math.PI / 2;
    if (w.state[a.i] !== MOVING) w.state[a.i] = MOVING;
    w.updateMatrix(a.i);
    w.moved(a.i);
  }

  respawn(a) {
    const arr = this.laneCars[a.lane];
    arr.splice(arr.indexOf(a), 1);
    // re-enter from a random edge of the map (the fog hides the switch)
    const ids = this.entries.length ? this.entries : [a.lane];
    let lane = ids[Math.floor(Math.random() * ids.length)];
    for (let k = 0; k < 6; k++) {
      const occ = this.laneCars[lane].some((o) => o.s < o.len + 6);
      if (!occ) break;
      lane = ids[Math.floor(Math.random() * ids.length)];
    }
    a.lane = lane;
    a.s = 0;
    a.v = this.net.lanes[lane].speed * 0.6;
    a.next = -1;
    a.seg = 1;
    this.laneCars[lane].push(a);
  }

  // ------------------------------------------------------------------ pedestrians
  stepPed(p, dt, ball) {
    const w = this.w;
    const i = p.i;
    const size = w.size[i];
    const bx = w.x[i] - ball.pos.x,
      bz = w.z[i] - ball.pos.z;
    const d2 = bx * bx + bz * bz;
    const scared = rules.canPickUp(size, ball.diameter) && d2 < (ball.r * 3 + 4) ** 2;
    if (p.pause > 0 && !scared) {
      p.pause -= dt;
      this.pose(p, 0);
      return;
    }
    const wk = p.path || this.net.walks[p.walk];
    const speed = scared ? p.base * 2.8 : p.v;
    if (p.cross) {
      // crossing the street / turning the corner in a straight line
      const c = p.cross;
      c.t += (speed * dt) / c.len;
      const t = Math.min(1, c.t);
      w.x[i] = c.x0 + (c.x1 - c.x0) * t;
      w.z[i] = c.z0 + (c.z1 - c.z0) * t;
      w.yaw[i] = Math.atan2(c.x1 - c.x0, c.z1 - c.z0);
      if (t >= 1) {
        p.cross = null;
        p.walk = c.walk;
        const nwk = this.net.walks[p.walk];
        p.s = c.end === 0 ? 0 : nwk.L[nwk.L.length - 1];
        p.dir = c.end === 0 ? 1 : -1;
        p.seg = 1;
      }
    } else {
      if (scared) {
        // run away along the path, whichever direction increases the distance
        at(wk.pts, wk.L, p.s, p);
        p.dir = bx * p.hx + bz * p.hz >= 0 ? 1 : -1;
      }
      // the sidewalk runs over the tracks: hold back while the gates are down
      if (!scared && this.crossings.length && this.railBusy(w.x[i], w.z[i], 14)) {
        p.pause = 0.4;
        this.pose(p, 0);
        return;
      }
      p.s += p.dir * speed * dt;
      const len = wk.L[wk.L.length - 1];
      if (p.s < 0 || p.s > len) {
        const end = p.s < 0 ? 0 : 1;
        p.s = Math.max(0, Math.min(len, p.s));
        const links = p.path ? null : wk.links[end];
        if (links && links.length && !scared) {
          const lk = p.next ?? links[Math.floor(Math.random() * links.length)];
          const tw = this.net.walks[lk.w];
          const q = lk.end === 0 ? tw.pts[0] : tw.pts[tw.pts.length - 1];
          const len2 = Math.hypot(q[0] - w.x[i], q[1] - w.z[i]);
          // across a road: wait at the kerb for a gap in the traffic (and never across a live level crossing)
          let wait = false;
          if (len2 > 5) {
            for (const t of [0.2, 0.5, 0.8]) {
              const sx = w.x[i] + (q[0] - w.x[i]) * t,
                sz = w.z[i] + (q[1] - w.z[i]) * t;
              if (this.nearAgent(this.carHash, sx, sz, 11, (c) => c.v > 0.6) || this.railBusy(sx, sz)) wait = true;
            }
          }
          if (wait) {
            p.next = lk; // keep the same crossing in mind; look again in a moment
            p.pause = 0.35;
          } else {
            p.next = null;
            p.cross = { x0: w.x[i], z0: w.z[i], x1: q[0], z1: q[1], t: 0, len: Math.max(0.5, len2), walk: lk.w, end: lk.end };
          }
        } else {
          p.dir = -p.dir; // turn around (or loop paths)
          if (p.path && p.path.loop) p.s = end === 0 ? len : 0;
        }
        if (Math.random() < 0.15 && !scared) p.pause = 1 + Math.random() * 3;
      }
      if (!p.cross) {
        at(wk.pts, wk.L, p.s, p);
        // keep to a lateral lane on the sidewalk (people walking towards each other pass)
        const lat = p.lat * p.dir;
        w.x[i] = p.px - p.hz * lat;
        w.z[i] = p.pz + p.hx * lat;
        w.yaw[i] = Math.atan2(p.hx * p.dir, p.hz * p.dir);
      }
    }
    this.pose(p, speed * dt);
    if (!scared && Math.random() < dt * 0.02) p.pause = 2 + Math.random() * 4;
  }

  /** waddle: tilt side to side and bob as they walk */
  pose(p, step) {
    const w = this.w,
      i = p.i;
    p.phase += step * 3.4;
    w.tilt[i * 2 + 1] = step > 0 ? Math.sin(p.phase) * 0.09 : 0;
    w.tilt[i * 2] = step > 0 ? 0.04 : 0;
    if (w.state[i] !== MOVING) w.state[i] = MOVING;
    w.updateMatrix(i);
    w.moved(i);
  }

  stepFollower(fl, dt) {
    const w = this.w;
    const o = fl.owner.i,
      i = fl.i;
    const yaw = w.yaw[o];
    const fx = Math.sin(yaw),
      fz = Math.cos(yaw);
    const tx = w.x[o] - fx * fl.back - fz * fl.side,
      tz = w.z[o] - fz * fl.back + fx * fl.side;
    const dx = tx - w.x[i],
      dz = tz - w.z[i];
    const d = Math.hypot(dx, dz);
    const k = Math.min(1, dt * 6);
    w.x[i] += dx * k;
    w.z[i] += dz * k;
    if (d > 0.02) w.yaw[i] = Math.atan2(dx, dz);
    fl.phase += d * 8;
    w.tilt[i * 2] = Math.sin(fl.phase) * 0.12;
    if (w.state[i] !== MOVING) w.state[i] = MOVING;
    w.updateMatrix(i);
    w.moved(i);
  }

  // ------------------------------------------------------------------ grazers, flocks
  stepGrazer(g, dt, ball) {
    const w = this.w,
      i = g.i;
    g.t -= dt;
    if (g.t <= 0) {
      g.t = 1.5 + Math.random() * 4;
      g.heading += (Math.random() - 0.5) * 2.4;
      g.moving = Math.random() > g.still;
    }
    const size = w.size[i];
    const bx = w.x[i] - ball.pos.x,
      bz = w.z[i] - ball.pos.z;
    let sp = g.moving ? g.speed : 0;
    if (rules.canPickUp(size, ball.diameter) && bx * bx + bz * bz < (ball.r * 3 + 5) ** 2) {
      g.heading = Math.atan2(bx, bz);
      sp = g.speed * 3;
    }
    if (sp > 0) {
      let nx = w.x[i] + Math.sin(g.heading) * sp * dt,
        nz = w.z[i] + Math.cos(g.heading) * sp * dt;
      // stay inside the rectangle (in its own frame)
      const c = Math.cos(g.yaw),
        s = Math.sin(g.yaw);
      const lx = c * (nx - g.cx) - s * (nz - g.cz),
        lz = s * (nx - g.cx) + c * (nz - g.cz);
      if (Math.abs(lx) > g.hw || Math.abs(lz) > g.hd) {
        g.heading = Math.atan2(g.cx - w.x[i], g.cz - w.z[i]) + (Math.random() - 0.5);
        return;
      }
      w.x[i] = nx;
      w.z[i] = nz;
      w.yaw[i] = g.heading;
      g.phase += sp * dt * 6;
      w.tilt[i * 2] = Math.sin(g.phase) * 0.06;
    } else {
      // grazing nod
      g.phase += dt * 2;
      w.tilt[i * 2] = Math.max(0, Math.sin(g.phase)) * 0.25;
    }
    if (w.state[i] !== MOVING) w.state[i] = MOVING;
    w.updateMatrix(i);
    w.moved(i);
  }

  stepFlock(fl, dt, ball) {
    const w = this.w;
    fl.t += dt;
    const dx = fl.x - ball.pos.x,
      dz = fl.z - ball.pos.z;
    if (fl.state === 0) {
      // on the ground: peck about; scatter when the ball comes close
      let any = false;
      for (let k = 0; k < fl.birds.length; k++) {
        const i = fl.birds[k];
        if (!this.alive(i)) continue;
        any = true;
        if (Math.random() < dt * 0.8) w.yaw[i] += (Math.random() - 0.5) * 2;
        w.tilt[i * 2] = Math.max(0, Math.sin(fl.t * 5 + k * 1.7)) * 0.5;
        w.updateMatrix(i);
      }
      if (!any) return;
      if (dx * dx + dz * dz < (ball.r * 4 + 8) ** 2) {
        fl.state = 1;
        fl.t = 0;
        const a = Math.atan2(dx, dz) + (Math.random() - 0.5);
        const dist = 25 + Math.random() * 30 + ball.r * 6;
        fl.tx = fl.x + Math.sin(a) * dist;
        fl.tz = fl.z + Math.cos(a) * dist;
        if (fl.homes) {
          const h = fl.homes[Math.floor(Math.random() * fl.homes.length)];
          fl.tx = h[0];
          fl.tz = h[1];
        }
        for (let k = 0; k < fl.birds.length; k++) {
          const i = fl.birds[k];
          if (!this.alive(i)) continue;
          w.state[i] = MOVING_AIR;
          fl.vx[k] = (Math.random() - 0.5) * 3;
          fl.vy[k] = 4 + Math.random() * 3;
          fl.vz[k] = (Math.random() - 0.5) * 3;
        }
        this.s.events.emit('flock', { x: fl.x, z: fl.z, n: fl.birds.length, session: this.s });
      }
    } else {
      // flying to the new spot, then gliding down
      const T = 4.5;
      const u = Math.min(1, fl.t / T);
      for (let k = 0; k < fl.birds.length; k++) {
        const i = fl.birds[k];
        if (!this.alive(i)) continue;
        const ox = Math.sin(k * 2.39) * fl.r,
          oz = Math.cos(k * 2.39) * fl.r;
        const tx = fl.x + (fl.tx - fl.x) * u + ox * (0.5 + u),
          tz = fl.z + (fl.tz - fl.z) * u + oz * (0.5 + u);
        const ty = fl.y0 + Math.sin(Math.PI * u) * (10 + k % 3) + fl.vy[k] * 0.1;
        const px = w.x[i],
          pz = w.z[i];
        w.x[i] += (tx - px) * Math.min(1, dt * 3) + fl.vx[k] * dt * (1 - u);
        w.z[i] += (tz - pz) * Math.min(1, dt * 3) + fl.vz[k] * dt * (1 - u);
        w.y[i] = ty;
        w.yaw[i] = Math.atan2(fl.tx - fl.x, fl.tz - fl.z) + fl.yawOff;
        w.tilt[i * 2 + 1] = Math.sin(fl.t * 22 + k) * 0.35; // flapping
        w.tilt[i * 2] = 0;
        w.updateMatrix(i);
        w.moved(i);
      }
      if (u >= 1) {
        fl.state = 0;
        fl.t = 0;
        fl.x = fl.tx;
        fl.z = fl.tz;
        for (const i of fl.birds) {
          if (!this.alive(i)) continue;
          w.y[i] = fl.y0;
          w.tilt[i * 2 + 1] = 0;
          w.state[i] = MOVING;
          w.updateMatrix(i);
        }
      }
    }
  }

  // ------------------------------------------------------------------ movers
  stepMover(m, dt, ball) {
    const w = this.w;
    if (m.pause && m.pt > 0) {
      m.pt -= dt;
      return;
    }
    // stop for the ball if it sits on the route just ahead of the lead vehicle
    const lead = m.its[0];
    let v = m.v;
    if (lead >= 0 && this.alive(lead) && !m.air) {
      at(m.pts, m.L, m.s, m);
      const bx = ball.pos.x - w.x[lead],
        bz = ball.pos.z - w.z[lead];
      const along = bx * m.hx + bz * m.hz,
        lat = Math.abs(bx * m.hz - bz * m.hx);
      if (along > 0 && along < ball.r + 30 && lat < ball.r + 4) v = 0;
    }
    const prev = m.s;
    m.s += v * dt;
    if (m.pause) {
      for (const ps of m.pause.at) if (prev < ps && m.s >= ps) m.pt = m.pause.time;
    }
    if (m.s > m.len) m.s = m.loop ? m.s - m.len : 0;
    let any = false;
    for (let k = 0; k < m.its.length; k++) {
      const i = m.its[k];
      if (i < 0 || !this.alive(i)) continue;
      any = true;
      let s = m.s - m.offs[k];
      if (s < 0) s = m.loop ? s + m.len : 0;
      const cur = CUR;
      cur.seg = m.segs[k];
      cur.py = undefined;
      at(m.pts, m.L, s, cur);
      m.segs[k] = cur.seg;
      w.x[i] = cur.px;
      w.z[i] = cur.pz;
      w.y[i] = (cur.py ?? 0) + m.y;
      w.yaw[i] = Math.atan2(cur.hx, cur.hz) - Math.PI / 2;
      if (m.pitch && cur.py !== undefined) {
        // planes nose up while climbing: rotate about the long (x) axis is the roll axis for +x-forward models,
        // so pitch is a rotation about local z
        const k1 = Math.min(cur.seg, m.L.length - 1);
        const slope = (m.pts[k1][2] - m.pts[k1 - 1][2]) / (m.L[k1] - m.L[k1 - 1] || 1);
        w.tilt[i * 2 + 1] = Math.atan(slope);
      }
      const st = (cur.py ?? 0) + m.y > 2 ? MOVING_AIR : MOVING;
      if (w.state[i] !== st) w.state[i] = st;
      w.updateMatrix(i);
      w.moved(i);
    }
    if (!any) m.dead = true;
  }

  stats() {
    const moving = (arr) => arr.filter((a) => !a.dead).length;
    return {
      cars: moving(this.cars),
      peds: moving(this.peds),
      followers: moving(this.followers),
      grazers: moving(this.grazers),
      flocks: this.flocks.length,
      movers: moving(this.movers),
      spinners: this.spinners.length,
      signals: this.signals.length,
      honks: this.honks,
    };
  }
}
