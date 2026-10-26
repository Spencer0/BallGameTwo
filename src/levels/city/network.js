// Road network for the outdoor levels: a graph of nodes and polyline edges with road classes.
// build() derives everything the level needs from one source of truth:
//   - street surface pieces (asphalt arms with markings and crosswalks, intersection patches,
//     cul-de-sac bulbs, sidewalks with corners) for the street mesh,
//   - frontages (each side of each edge, between corners) for lots and buildings,
//   - traffic lanes (right-hand traffic) with connectors through nodes,
//   - sidewalk paths for pedestrians, with crossings between them.
// Pure data (no three.js) so it can be unit-tested in node.

export const CLASSES = {
  // w: carriageway width, lanes: per direction (oneway: total), walk: sidewalk width, verge: planting strip
  arterial: { w: 15, lanes: 2, walk: 3, verge: 1.5, center: 2, speed: 14 },
  street: { w: 9, lanes: 1, walk: 2.2, verge: 1.6, center: 1, speed: 9 },
  lane: { w: 6, lanes: 1, walk: 0, verge: 0, center: 0, speed: 7 },
  avenue: { w: 24, lanes: 4, oneway: true, walk: 6, verge: 0, center: 0, speed: 13 },
  crosstown: { w: 14, lanes: 2, oneway: true, walk: 5, verge: 0, center: 0, speed: 11 },
  boulevard: { w: 22, lanes: 2, walk: 5, verge: 0, center: 2, speed: 13 },
  highway: { w: 22, lanes: 2, walk: 0, verge: 0, center: 2, speed: 24 },
  main: { w: 20, lanes: 1, walk: 4, verge: 0, center: 1, speed: 8, parking: 'angled' },
  rail: { w: 4, lanes: 0, walk: 0, verge: 0, center: 0, speed: 0 },
  path: { w: 3, lanes: 0, walk: 0, verge: 0, center: 0, speed: 0 },
};

const TAU = Math.PI * 2;
const norm = (a) => ((a % TAU) + TAU) % TAU;

/** points along a circular arc, inclusive; angles like yaw (0 = +z, pi/2 = +x) */
export function arc(cx, cz, r, a0, a1, step = 4) {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / step));
  const out = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    out.push([cx + Math.sin(a) * r, cz + Math.cos(a) * r]);
  }
  return out;
}

function polyLen(p) {
  const L = [0];
  for (let k = 1; k < p.length; k++) L.push(L[k - 1] + Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]));
  return L;
}

/** point + unit tangent at distance s along polyline p with cumulative lengths L */
export function sample(p, L, s, out = {}) {
  const total = L[L.length - 1];
  s = Math.max(0, Math.min(total, s));
  let k = 1;
  while (k < L.length - 1 && L[k] < s) k++;
  const seg = L[k] - L[k - 1] || 1e-9;
  const t = (s - L[k - 1]) / seg;
  const dx = (p[k][0] - p[k - 1][0]) / seg,
    dz = (p[k][1] - p[k - 1][1]) / seg;
  out.x = p[k - 1][0] + (p[k][0] - p[k - 1][0]) * t;
  out.z = p[k - 1][1] + (p[k][1] - p[k - 1][1]) * t;
  out.dx = dx;
  out.dz = dz;
  return out;
}

/** polyline p offset sideways by `off` (right of travel = positive), between distances s0..s1 */
export function offsetPoly(p, L, off, s0 = 0, s1 = L[L.length - 1], step = 0) {
  const out = [];
  const pts = [s0];
  for (let k = 1; k < L.length - 1; k++) if (L[k] > s0 + 1e-6 && L[k] < s1 - 1e-6) pts.push(L[k]);
  pts.push(s1);
  // optionally densify long straight runs (keeps long sidewalks walkable in pieces)
  const ss = [];
  for (let k = 0; k < pts.length; k++) {
    ss.push(pts[k]);
    if (step > 0 && k < pts.length - 1) {
      const n = Math.floor((pts[k + 1] - pts[k]) / step);
      for (let j = 1; j < n; j++) ss.push(pts[k] + ((pts[k + 1] - pts[k]) * j) / n);
    }
  }
  const q = {};
  for (const s of ss) {
    // average tangent at interior vertices for clean joins
    sample(p, L, s, q);
    let dx = q.dx,
      dz = q.dz;
    const k = L.indexOf(s);
    if (k > 0 && k < L.length - 1) {
      const ax = (p[k][0] - p[k - 1][0]) / (L[k] - L[k - 1]),
        az = (p[k][1] - p[k - 1][1]) / (L[k] - L[k - 1]);
      const bx = (p[k + 1][0] - p[k][0]) / (L[k + 1] - L[k]),
        bz = (p[k + 1][1] - p[k][1]) / (L[k + 1] - L[k]);
      dx = ax + bx;
      dz = az + bz;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const c = dx * ax + dz * az; // cos(half turn): scale offset to keep width
      const m = 1 / Math.max(0.5, c);
      out.push([q.x + -dz * off * m, q.z + dx * off * m, s]);
      continue;
    }
    // right of travel = (-dz, dx)
    out.push([q.x + -dz * off, q.z + dx * off, s]);
  }
  return out;
}

export class Network {
  constructor() {
    this.nodes = [];
    this.edges = [];
  }

  node(x, z, opts = {}) {
    const n = { id: this.nodes.length, x, z, arms: [], signal: false, stop: false, bulb: 0, exit: false, ...opts };
    this.nodes.push(n);
    return n.id;
  }

  /**
   * edge from node a to node b. opts: cls (CLASSES key), w, lanes, walk, verge, oneway, pts (interior polyline
   * points [[x,z],..]), name, speed, markings (false = plain), sidewalks ('both'|'left'|'right'|'none'), y (deck height)
   */
  edge(a, b, opts = {}) {
    const cls = CLASSES[opts.cls || 'street'];
    const e = {
      id: this.edges.length,
      a,
      b,
      cls: opts.cls || 'street',
      w: opts.w ?? cls.w,
      lanes: opts.lanes ?? cls.lanes,
      walk: opts.walk ?? cls.walk,
      verge: opts.verge ?? cls.verge,
      oneway: opts.oneway ?? !!cls.oneway,
      center: opts.center ?? cls.center,
      speed: opts.speed ?? cls.speed,
      parking: opts.parking ?? cls.parking ?? null,
      markings: opts.markings ?? true,
      sidewalks: opts.sidewalks ?? 'both',
      name: opts.name || '',
      y: opts.y ?? 0,
      traffic: opts.traffic ?? true,
      plaza: opts.plaza ?? false,
      paint: opts.paint ?? true, // false: the surface comes from a model (bridge decks)
      pts: opts.pts || [],
    };
    this.edges.push(e);
    return e.id;
  }

  /** convenience: a chain of edges through a list of [x,z] points (nodes created at each point) */
  chain(points, opts = {}, nodeOpts = {}) {
    const ids = points.map(([x, z]) => this.node(x, z, nodeOpts));
    for (let k = 0; k < ids.length - 1; k++) this.edge(ids[k], ids[k + 1], opts);
    return ids;
  }

  /** find a node at (x,z) within tol, or create one */
  at(x, z, tol = 0.5, opts = {}) {
    for (const n of this.nodes) if (Math.abs(n.x - x) < tol && Math.abs(n.z - z) < tol) return Object.assign(n, opts).id;
    return this.node(x, z, opts);
  }

  build() {
    const N = this.nodes,
      E = this.edges;
    for (const n of N) n.arms = [];
    // polylines and arms
    for (const e of E) {
      const A = N[e.a],
        B = N[e.b];
      e.poly = [[A.x, A.z], ...e.pts, [B.x, B.z]];
      e.L = polyLen(e.poly);
      e.len = e.L[e.L.length - 1];
      const p = e.poly;
      const ha = Math.atan2(p[1][0] - p[0][0], p[1][1] - p[0][1]);
      const m = p.length - 1;
      const hb = Math.atan2(p[m - 1][0] - p[m][0], p[m - 1][1] - p[m][1]);
      A.arms.push({ e: e.id, end: 0, ang: norm(ha) });
      B.arms.push({ e: e.id, end: 1, ang: norm(hb) });
    }
    for (const n of N) {
      n.arms.sort((u, v) => u.ang - v.ang);
      n.deg = n.arms.length;
    }
    // trims: how far from the node centre each arm's road surface starts
    for (const n of N) {
      for (let k = 0; k < n.deg; k++) {
        const arm = n.arms[k];
        const e = E[arm.e];
        let trim = 0;
        if (n.deg >= 3) {
          // distance to clear the other roads' carriageways (projected on this arm's direction)
          for (const o of n.arms) {
            if (o === arm) continue;
            const eo = E[o.e];
            const d = Math.abs(Math.sin(o.ang - arm.ang));
            if (d < 0.25) continue; // straight-through partner
            trim = Math.max(trim, eo.w / 2 / d + Math.abs(Math.cos(o.ang - arm.ang)) * (e.w / 2) / d);
          }
        } else if (n.deg === 1 && n.bulb) {
          // road ends where it meets the turning circle (no overlap with the bulb disc)
          trim = Math.sqrt(Math.max(0, n.bulb * n.bulb - (e.w / 2) ** 2));
        }
        arm.trim = trim;
        arm.cross = n.deg >= 3 && n.crosswalks !== false && e.cls !== 'lane' && e.cls !== 'highway';
        if (arm.end === 0) e.trimA = trim;
        else e.trimB = trim;
        if (arm.end === 0) e.crossA = arm.cross;
        else e.crossB = arm.cross;
      }
      // intersection patch: covers the overlap of the arms (oriented on the widest arm)
      if (n.deg >= 3) {
        let main = n.arms[0];
        for (const a of n.arms) if (E[a.e].w > E[main.e].w) main = a;
        n.mainAng = main.ang;
        let along = 0,
          across = E[main.e].w / 2;
        for (const a of n.arms) {
          const s = Math.abs(Math.sin(a.ang - main.ang)),
            c = Math.abs(Math.cos(a.ang - main.ang));
          if (s > 0.25) along = Math.max(along, a.trim * c + (E[a.e].w / 2) * s);
          across = Math.max(across, (E[a.e].w / 2) * c + a.trim * s);
        }
        n.patch = { along: Math.max(along, 0.5), across };
      }
    }
    // signals default: any 3+ way node where two arms are arterial/avenue/boulevard/main
    const big = new Set(['arterial', 'avenue', 'crosstown', 'boulevard', 'main']);
    for (const n of N) {
      if (n.deg < 3 || n.signal === 'none') {
        n.signal = false;
        continue;
      }
      if (n.signal === true) continue;
      const nb = n.arms.filter((a) => big.has(E[a.e].cls)).length;
      n.signal = nb >= 2 || (nb >= 1 && n.deg >= 4);
      n.stop = !n.signal;
    }
    this.buildLanes();
    this.buildSidewalks();
    return this;
  }

  // ------------------------------------------------------------------ traffic lanes
  buildLanes() {
    const E = this.edges,
      N = this.nodes;
    this.lanes = [];
    for (const e of E) {
      e.laneIds = [[], []];
      if (!e.traffic || e.cls === 'rail' || e.cls === 'path') continue;
      const dirs = e.oneway ? [0] : [0, 1];
      const per = e.oneway ? e.lanes : e.lanes;
      const lw = e.oneway ? e.w / per : e.w / 2 / per;
      for (const dir of dirs) {
        // dir 0: a -> b, dir 1: b -> a (polyline reversed)
        const p = dir === 0 ? e.poly : [...e.poly].reverse();
        const L = polyLen(p);
        const t0 = dir === 0 ? e.trimA : e.trimB,
          t1 = dir === 0 ? e.trimB : e.trimA;
        const c0 = dir === 0 ? e.crossA : e.crossB,
          c1 = dir === 0 ? e.crossB : e.crossA;
        const s0 = t0 + (c0 ? 3.5 : 0) + 0.5,
          s1 = L[L.length - 1] - t1 - (c1 ? 4 : 0) - 0.5;
        if (s1 - s0 < 2) continue;
        for (let j = 0; j < per; j++) {
          const off = e.oneway ? -e.w / 2 + lw * (j + 0.5) : lw * (j + 0.5);
          const pts = offsetPoly(p, L, off, s0, s1).map(([x, z]) => [x, z]);
          const lane = { id: this.lanes.length, e: e.id, dir, j, pts, L: polyLen(pts), from: dir === 0 ? e.a : e.b, to: dir === 0 ? e.b : e.a, w: lw, speed: e.speed, y: e.y };
          lane.len = lane.L[lane.L.length - 1];
          // arm heading at the far node (for signal grouping): direction of travel at the end
          const m = pts.length - 1;
          lane.inAng = norm(Math.atan2(pts[m][0] - pts[m - 1][0], pts[m][1] - pts[m - 1][1]));
          lane.outAng0 = norm(Math.atan2(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]));
          this.lanes.push(lane);
          e.laneIds[dir].push(lane.id);
        }
      }
    }
    // outgoing lanes per node
    for (const n of N) n.out = [];
    for (const l of this.lanes) N[l.from].out.push(l.id);
  }

  /** lanes a vehicle at the end of lane `id` may continue into (no immediate U-turns unless dead end) */
  nextLanes(id) {
    const l = this.lanes[id];
    const n = this.nodes[l.to];
    const opts = n.out.filter((k) => this.lanes[k].e !== l.e);
    if (opts.length) return opts;
    return n.out; // dead end: turn around (bulb) or exit
  }

  // ------------------------------------------------------------------ sidewalks & frontages
  buildSidewalks() {
    const E = this.edges,
      N = this.nodes;
    this.walks = []; // pedestrian paths along sidewalks
    this.frontages = []; // lot frontage lines (property line), each side of each edge
    for (const e of E) {
      if (e.cls === 'rail' || e.cls === 'path') continue;
      for (const side of [1, -1]) {
        // side +1 = right of a->b travel
        const has = e.walk > 0 && (e.sidewalks === 'both' || (e.sidewalks === 'right' && side === 1) || (e.sidewalks === 'left' && side === -1));
        const A = N[e.a],
          B = N[e.b];
        // corner trims: where the neighbouring arm on this side cuts the sidewalk
        const tA = this.sideTrim(A, e, 0, side),
          tB = this.sideTrim(B, e, 1, side);
        const s0 = tA,
          s1 = e.len - tB;
        const curb = e.w / 2;
        const prop = curb + e.verge + e.walk; // property line
        if (s1 - s0 > 1) {
          if (has) {
            const mid = curb + e.verge + e.walk / 2;
            const pts = offsetPoly(e.poly, e.L, side * mid, s0, s1, 6).map(([x, z]) => [x, z]);
            this.walks.push({ id: this.walks.length, e: e.id, side, pts, L: polyLen(pts), w: e.walk });
          }
          const fs0 = s0 + (A.deg >= 3 ? prop - curb : 0),
            fs1 = s1 - (B.deg >= 3 ? prop - curb : 0);
          if (fs1 - fs0 > 4) {
            const pts = offsetPoly(e.poly, e.L, side * prop, fs0, fs1).map(([x, z]) => [x, z]);
            // frontage faces the road: facing direction = towards the edge (opposite of the side normal)
            this.frontages.push({ id: this.frontages.length, e: e.id, side, pts, L: polyLen(pts), cls: e.cls, setbackBase: prop });
          }
        }
        e['walk' + (side > 0 ? 'R' : 'L')] = { s0, s1, has };
      }
    }
    // crossings: connect sidewalk path ends that face each other across a road or around a corner
    for (const w of this.walks) {
      w.links = [[], []];
    }
    const ends = [];
    for (const w of this.walks) {
      ends.push({ w: w.id, end: 0, x: w.pts[0][0], z: w.pts[0][1] });
      const m = w.pts.length - 1;
      ends.push({ w: w.id, end: 1, x: w.pts[m][0], z: w.pts[m][1] });
    }
    for (const a of ends) {
      const ea = E[this.walks[a.w].e];
      const reach = Math.max(ea.w + ea.walk * 2 + ea.verge * 2 + 4, 10);
      for (const b of ends) {
        if (a === b || (a.w === b.w)) continue;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d < reach) this.walks[a.w].links[a.end].push({ w: b.w, end: b.end, d });
      }
    }
  }

  /** distance from the node centre at which edge e's sidewalk on `side` must stop (0 = straight through) */
  sideTrim(n, e, end, side) {
    if (n.deg <= 1) {
      if (!n.bulb) return 0;
      // stop where the sidewalk band meets the ring of sidewalk around the turning circle
      const inner = e.w / 2 + e.verge;
      return Math.sqrt(Math.max(0, (n.bulb + e.verge + e.walk) ** 2 - inner * inner));
    }
    if (n.deg === 2) return 0;
    const arm = n.arms.find((a) => a.e === e.id && a.end === end);
    // travelling away from the node along the arm, "right of a->b" flips for the b end
    const s = end === 0 ? side : -side;
    // neighbour arm on that side in angular order: the right of heading θ is θ − π/2, i.e. the next smaller angle
    const k = n.arms.indexOf(arm);
    const nb = s > 0 ? n.arms[(k - 1 + n.deg) % n.deg] : n.arms[(k + 1) % n.deg];
    let gap = norm(s > 0 ? arm.ang - nb.ang : nb.ang - arm.ang);
    if (gap > Math.PI * 0.83) return Math.min(arm.trim, 0); // nothing on that side: sidewalk runs on
    const eo = this.edges[nb.e];
    const sn = Math.max(0.3, Math.sin(gap));
    return eo.w / 2 / sn + Math.abs(Math.cos(gap)) * (e.w / 2 + e.verge + e.walk) / sn;
  }

  /** stats for tests and reviews */
  stats() {
    const dead = this.nodes.filter((n) => n.deg === 1 && !n.bulb && !n.exit).length;
    // connectivity over drivable edges
    const adj = new Map();
    for (const e of this.edges) {
      if (e.cls === 'rail' || e.cls === 'path') continue;
      (adj.get(e.a) || adj.set(e.a, []).get(e.a)).push(e.b);
      (adj.get(e.b) || adj.set(e.b, []).get(e.b)).push(e.a);
    }
    const seen = new Set();
    let comps = 0;
    for (const k of adj.keys()) {
      if (seen.has(k)) continue;
      comps++;
      const st = [k];
      seen.add(k);
      while (st.length) {
        const u = st.pop();
        for (const v of adj.get(u)) if (!seen.has(v)) seen.add(v), st.push(v);
      }
    }
    return { nodes: this.nodes.length, edges: this.edges.length, lanes: this.lanes.length, walks: this.walks.length, frontages: this.frontages.length, deadEnds: dead, components: comps };
  }
}
