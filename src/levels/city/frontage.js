// Placement on top of the road network: oriented-rectangle occupancy (so nothing overlaps roads or other
// buildings), walking frontages, filling street walls, laying fences end to end, and lot frames.
import { sample } from './network.js';

/** Oriented rectangles in a spatial hash; SAT overlap tests. */
export class Occupancy {
  constructor(cell = 20) {
    this.cell = cell;
    this.map = new Map();
    this.n = 0;
  }
  key(cx, cz) {
    return cx * 73856093 + cz * 19349663;
  }
  /** rect: { x, z, hw, hd, yaw } (half sizes along local x / local z) */
  corners(r) {
    const c = Math.cos(r.yaw),
      s = Math.sin(r.yaw);
    // local x -> (c, -s), local z -> (s, c)
    return [
      [r.x + c * -r.hw + s * -r.hd, r.z - s * -r.hw + c * -r.hd],
      [r.x + c * r.hw + s * -r.hd, r.z - s * r.hw + c * -r.hd],
      [r.x + c * r.hw + s * r.hd, r.z - s * r.hw + c * r.hd],
      [r.x + c * -r.hw + s * r.hd, r.z - s * -r.hw + c * r.hd],
    ];
  }
  bounds(r) {
    const R = Math.hypot(r.hw, r.hd);
    return [Math.floor((r.x - R) / this.cell), Math.floor((r.x + R) / this.cell), Math.floor((r.z - R) / this.cell), Math.floor((r.z + R) / this.cell)];
  }
  add(r, tag = 1) {
    r.tag = tag;
    r.c = this.corners(r);
    const [x0, x1, z0, z1] = this.bounds(r);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const k = this.key(cx, cz);
        let a = this.map.get(k);
        if (!a) this.map.set(k, (a = []));
        a.push(r);
      }
    this.n++;
    return r;
  }
  /** true if r overlaps anything (optionally ignoring tags in `ignore`) */
  hits(r, ignore = null) {
    const c = this.corners(r);
    const [x0, x1, z0, z1] = this.bounds(r);
    const seen = new Set();
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const a = this.map.get(this.key(cx, cz));
        if (!a) continue;
        for (const o of a) {
          if (seen.has(o)) continue;
          seen.add(o);
          if (ignore && ignore.has(o.tag)) continue;
          if (satOverlap(c, o.c)) return o;
        }
      }
    return null;
  }
}

function axesOf(c) {
  return [
    [c[1][0] - c[0][0], c[1][1] - c[0][1]],
    [c[3][0] - c[0][0], c[3][1] - c[0][1]],
  ];
}
function satOverlap(a, b) {
  for (const ax of [...axesOf(a), ...axesOf(b)]) {
    let amin = Infinity,
      amax = -Infinity,
      bmin = Infinity,
      bmax = -Infinity;
    for (const p of a) {
      const d = p[0] * ax[0] + p[1] * ax[1];
      if (d < amin) amin = d;
      if (d > amax) amax = d;
    }
    for (const p of b) {
      const d = p[0] * ax[0] + p[1] * ax[1];
      if (d < bmin) bmin = d;
      if (d > bmax) bmax = d;
    }
    if (amax <= bmin + 1e-6 || bmax <= amin + 1e-6) return false;
  }
  return true;
}

/** Block every road/sidewalk band of the network so buildings stay off them. */
export function occupyNetwork(occ, net, extra = 0.5) {
  for (const e of net.edges) {
    const half = e.cls === 'rail' ? 3 : e.cls === 'path' ? e.w / 2 + 0.3 : e.w / 2 + e.verge + e.walk + extra;
    const p = e.poly;
    for (let k = 1; k < p.length; k++) {
      const dx = p[k][0] - p[k - 1][0],
        dz = p[k][1] - p[k - 1][1];
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      occ.add({ x: (p[k][0] + p[k - 1][0]) / 2, z: (p[k][1] + p[k - 1][1]) / 2, hw: half, hd: len / 2 + 0.5, yaw: Math.atan2(dx, dz) }, 'road');
    }
  }
  for (const n of net.nodes) {
    if (n.bulb) {
      const e = net.edges[n.arms[0].e];
      const R = n.bulb + e.verge + e.walk + extra;
      // the disc: an inner square plus a ring of tangent slabs (no corners poking out past R)
      occ.add({ x: n.x, z: n.z, hw: R * 0.7, hd: R * 0.7, yaw: 0 }, 'road');
      const segs = 16,
        th = R * 0.45;
      for (let k = 0; k < segs; k++) {
        const a = (k / segs) * Math.PI * 2;
        const rc = R - th / 2;
        occ.add({ x: n.x + Math.sin(a) * rc, z: n.z + Math.cos(a) * rc, hw: rc * Math.tan(Math.PI / segs) + 0.3, hd: th / 2, yaw: a }, 'road');
      }
    }
  }
}

/** frame at distance s along frontage f: position on the property line, yaw facing the road, inward vector */
export function frameAt(f, s, out = {}) {
  const q = sample(f.pts, f.L, s);
  // the frontage runs in its edge's a->b direction; side +1 frontages have the road on their left
  const fx = f.side * q.dz,
    fz = f.side * -q.dx;
  out.x = q.x;
  out.z = q.z;
  out.yaw = Math.atan2(fx, fz);
  out.fx = fx; // towards the road
  out.fz = fz;
  out.tx = q.dx; // along the frontage
  out.tz = q.dz;
  out.len = f.L[f.L.length - 1];
  return out;
}

/** world point from a frame + local (right r, forward-to-road f) */
export function local(fr, r, f) {
  // right of facing (fx,fz) is (-fz, fx)
  return [fr.x + -fr.fz * r + fr.fx * f, fr.z + fr.fx * r + fr.fz * f];
}

/**
 * Fill a frontage with buildings edge to edge (street wall) or with gaps.
 * opts: pick(remaining) -> id | null, setback (front facade distance behind the property line), gap,
 *       s0/s1 (range), scale(id) -> s, onPlace(item, frame), maxDepth
 */
export function fillFrontage(L, occ, f, opts) {
  const lib = L.lib;
  const s1 = opts.s1 ?? f.L[f.L.length - 1];
  let s = opts.s0 ?? 0;
  const out = [];
  let guard = 0;
  while (s < s1 - 2 && guard++ < 500) {
    const id = opts.pick(s1 - s, s);
    if (!id) break;
    const t = lib.byId.get(id);
    if (!t) {
      L.missing.add(id);
      s += 6;
      continue;
    }
    const sc = opts.scale ? opts.scale(id) : 1;
    const w = t.dims[0] * sc,
      d = t.dims[2] * sc;
    if (s + w > s1 + (opts.overhang ?? 0)) {
      if (opts.fallback) {
        // try something narrower next time round
        s += opts.fallback;
        continue;
      }
      break;
    }
    const fr = frameAt(f, s + w / 2);
    const setback = opts.setback ?? 0;
    const [cx, cz] = local(fr, 0, -(setback + d / 2));
    const rect = { x: cx, z: cz, hw: w / 2 - 0.05, hd: d / 2 - 0.05, yaw: fr.yaw };
    if (occ && occ.hits(rect)) {
      s += opts.step ?? 4;
      continue;
    }
    if (occ) occ.add(rect, 'bld');
    const it = L.put(id, cx, cz, { yaw: fr.yaw, scale: sc, tint: opts.tint ? opts.tint(id) : undefined });
    if (it) {
      out.push(it);
      if (opts.onPlace) opts.onPlace(it, fr, w, d, s);
    }
    s += w + (opts.gap ? opts.gap(id) : 0);
  }
  return out;
}

/**
 * Lay a linear tiling asset (fence panel, hedge, rail) from p0 to p1 end to end, long axis along the line.
 * dedupe: a Set shared by a whole level so back-to-back lots don't double their shared fence.
 */
export function fenceLine(L, id, x0, z0, x1, z1, { dedupe = null, opts = {}, skipEnds = 0, gaps = [] } = {}) {
  const t = L.lib.byId.get(id);
  if (!t) {
    L.missing.add(id);
    return 0;
  }
  const panel = Math.max(t.dims[0], t.dims[2]);
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < panel * 0.5) return 0;
  const n = Math.max(1, Math.round(len / panel));
  const scale = len / (n * panel); // stretch slightly so the run closes exactly (within a few %)
  const s = Math.min(1.08, Math.max(0.92, scale));
  const ux = (x1 - x0) / len,
    uz = (z1 - z0) / len;
  const dir = Math.atan2(ux, uz);
  const yaw = L.along(id, dir);
  let placed = 0;
  for (let k = skipEnds; k < n - skipEnds; k++) {
    const c = (k + 0.5) * (len / n);
    const x = x0 + ux * c,
      z = z0 + uz * c;
    if (gaps.some(([a, b]) => c > a && c < b)) continue;
    if (dedupe) {
      const key = Math.round(x * 2) + ',' + Math.round(z * 2);
      if (dedupe.has(key)) continue;
      dedupe.add(key);
    }
    if (L.put(id, x, z, { ...opts, yaw, scale: s })) placed++;
  }
  return placed;
}
