// Paints a road network onto a StreetBuilder (src/render/streets.js): road arms with markings and
// crosswalks, intersection patches, cul-de-sac bulbs, curbs and sidewalks, rail and park paths.
import { SK } from '../../render/streets.js';

export const STREET_STYLE = {
  asphalt: 'charcoal',
  marking: 'paper',
  yellow: 'sun',
  walk: 'concrete',
  walkJoint: 'stone',
  curb: 'cloud',
  island: 'leaf',
};

export function paintNetwork(b, net, style = {}) {
  const S = { ...STREET_STYLE, ...style };
  const N = net.nodes,
    E = net.edges;
  for (const e of E) {
    if (!e.paint) continue;
    if (e.cls === 'rail') {
      // leave gaps where roads cross the track (the road surface carries on over it)
      const gaps = railGaps(e, E);
      let s = 0;
      for (const [g0, g1] of gaps) {
        if (g0 > s) b.strip(e.poly, e.L, -1.7, 1.7, s, g0, SK.rail, { C: ['stone', 'cocoa', 'cloud'], y: e.y });
        s = Math.max(s, g1);
      }
      if (s < e.len) b.strip(e.poly, e.L, -1.7, 1.7, s, e.len, SK.rail, { C: ['stone', 'cocoa', 'cloud'], y: e.y });
      // across the road: a concrete crossing panel with the rails running through it
      for (const [g0, g1] of gaps) {
        const a = Math.max(0, g0),
          c = Math.min(e.len, g1);
        if (c - a < 0.5) continue;
        b.strip(e.poly, e.L, -2.4, 2.4, a, c, SK.solid, { C: ['stone'], y: e.y + 0.03 });
        b.strip(e.poly, e.L, -1.7, 1.7, a, c, SK.rail, { C: ['stone', 'stone', 'cloud'], y: e.y + 0.05 });
      }
      continue;
    }
    if (e.cls === 'path') {
      b.strip(e.poly, e.L, -e.w / 2, e.w / 2, 0, e.len, SK.path, { P: [e.w / 2], C: [S.path || 'sand', S.pathEdge || 'caramel'], y: e.y });
      continue;
    }
    const hw = e.w / 2;
    const s0 = e.trimA || 0,
      s1 = e.len - (e.trimB || 0);
    if (e.plaza) {
      // pedestrianised: paved kerb to kerb, sidewalks included
      const z = hw + e.verge + e.walk;
      b.strip(e.poly, e.L, -z, z, s0, s1, SK.plaza, { P: [2.2], C: [S.plazaA || 'tomato', S.plazaB || 'flamingo', 'ink_soft'], y: e.y });
      continue;
    }
    const centre = e.oneway ? 3 : e.markings ? e.center : 0;
    const park = e.parking === 'angled' ? 5.5 : 0;
    const kind = e.cls === 'lane' && e.dirt ? SK.dirt : SK.road;
    b.strip(e.poly, e.L, -hw, hw, s0, s1, kind, {
      P: [hw, e.lanes, e.markings ? centre : 0, park],
      Q: [s0, s1, e.crossA || 0, e.crossB || 0],
      C: kind === SK.dirt ? ['sand', 'caramel'] : [S.asphalt, S.marking, S.yellow],
      y: e.y,
    });
    // curbs (where a grass verge separates road and sidewalk) and sidewalks
    for (const side of [1, -1]) {
      const wk = side > 0 ? e.walkR : e.walkL;
      if (!wk) continue;
      if (e.verge > 0 && (e.walk > 0 || e.curbs)) {
        const u0 = side > 0 ? hw : -hw - 0.3,
          u1 = side > 0 ? hw + 0.3 : -hw;
        b.strip(e.poly, e.L, u0, u1, wk.s0, wk.s1, SK.solid, { C: [S.curb], y: e.y });
      }
      if (!wk.has) continue;
      const a = hw + e.verge,
        z = a + e.walk;
      if (side > 0) b.strip(e.poly, e.L, a, z, wk.s0, wk.s1, SK.walk, { P: [e.walk, e.verge > 0 ? 0 : 1], C: [S.walk, S.curb, S.walkJoint], uBase: a, y: e.y });
      else b.strip(e.poly, e.L, -z, -a, wk.s0, wk.s1, SK.walk, { P: [e.walk, e.verge > 0 ? 0 : 1], C: [S.walk, S.curb, S.walkJoint], uBase: -a, flipU: true, y: e.y });
    }
  }
  for (const n of N) {
    if (n.patch) b.rect(n.x, n.z, 2 * n.patch.across, 2 * n.patch.along, n.mainAng, SK.asphalt, { C: [S.asphalt], y: n.y ?? 0 });
    if (n.deg === 1 && n.bulb) {
      const e = E[n.arms[0].e];
      const island = n.island ?? n.bulb * 0.32;
      if (island > 0) {
        b.disc(n.x, n.z, n.bulb, SK.asphalt, { r0: island, C: [S.asphalt] });
        b.disc(n.x, n.z, island, SK.solid, { C: [S.island] });
      } else b.disc(n.x, n.z, n.bulb, SK.asphalt, { C: [S.asphalt] });
      // sidewalk ring around the circle, open where the court road comes in
      const mouth = n.arms[0].ang;
      const r0 = n.bulb + e.verge;
      const gap = Math.asin(Math.min(1, (e.w / 2 + e.verge + 0.4) / n.bulb));
      const wgap = Math.asin(Math.min(1, (e.w / 2 + e.verge) / r0));
      if (e.walk > 0) b.disc(n.x, n.z, r0 + e.walk, SK.walk, { r0, P: [e.walk, e.verge > 0 ? 0 : 1], C: [S.walk, S.curb, S.walkJoint], radialUV: true, segs: 44, a0: mouth + wgap, a1: mouth + Math.PI * 2 - wgap });
      if (e.verge > 0) b.disc(n.x, n.z, n.bulb + 0.3, SK.solid, { r0: n.bulb, C: [S.curb], segs: 44, a0: mouth + gap, a1: mouth + Math.PI * 2 - gap });
    }
  }
}

/** distances along rail edge r where road edges cross it (with their half-width + sidewalk) */
function railGaps(r, E) {
  const gaps = [];
  for (const e of E) {
    if (e === r || e.cls === 'rail' || e.cls === 'path' || !e.paint) continue;
    const half = e.w / 2 + e.verge + e.walk + 0.5;
    for (let i = 1; i < r.poly.length; i++) {
      const [ax, az] = r.poly[i - 1],
        [bx, bz] = r.poly[i];
      for (let j = 1; j < e.poly.length; j++) {
        const [cx, cz] = e.poly[j - 1],
          [dx, dz] = e.poly[j];
        const den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
        if (Math.abs(den) < 1e-9) continue;
        const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den;
        const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        const segLen = Math.hypot(bx - ax, bz - az);
        // crossing angle widens the gap
        const sin = Math.abs(den) / (segLen * Math.hypot(dx - cx, dz - cz));
        const s = r.L[i - 1] + t * segLen;
        const g = half / Math.max(0.3, sin);
        gaps.push([s - g, s + g]);
      }
    }
  }
  return gaps.sort((a, b) => a[0] - b[0]);
}
