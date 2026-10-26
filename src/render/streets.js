// Street surface: one merged mesh + one shader for everything flat and man-made on the ground:
// roads with lane markings and crosswalks, intersection patches, sidewalks, driveways, parking lots,
// rail track, crop rows, park paths, plazas, runways. Pieces never overlap (the network trims them),
// so they all sit at the same height without z-fighting.
import * as THREE from 'three';
import { PALETTE, PAL } from './palette.js';
import { shared, paletteUniform } from './materials.js';

export const SK = {
  asphalt: 0,
  road: 1,
  patch: 2,
  walk: 3,
  drive: 4,
  parking: 5,
  rail: 6,
  field: 7,
  path: 8,
  plaza: 9,
  runway: 10,
  dirt: 11,
  solid: 12,
  water: 13,
};

const vertex = /* glsl */ `
attribute vec2 aUV;
attribute vec4 aP;
attribute vec4 aQ;
attribute vec3 aCol;
attribute float aKind;
varying vec2 vUV;
varying vec4 vP;
varying vec4 vQ;
varying vec3 vCol;
varying float vKind;
varying float vFogDepth;
void main() {
  vUV = aUV; vP = aP; vQ = aQ; vCol = aCol; vKind = aKind;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */ `
uniform vec3 uPalette[PAL_COUNT];
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
varying vec2 vUV;
varying vec4 vP;
varying vec4 vQ;
varying vec3 vCol;
varying float vKind;
varying float vFogDepth;
vec3 pal(float i) { return uPalette[int(i + 0.5)]; }
float aa(float edge, float x) { float w = fwidth(x) * 0.75 + 1e-5; return smoothstep(edge - w, edge + w, x); }
// 1 inside |x| < hw (anti-aliased band)
float band(float x, float hw) { float w = fwidth(x) * 0.75 + 1e-5; return 1.0 - smoothstep(hw - w, hw + w, abs(x)); }
float dashes(float v, float period, float duty) { return aa(1.0 - duty, fract(v / period)); }
void main() {
  int k = int(vKind + 0.5);
  float u = vUV.x, v = vUV.y;
  vec3 A = pal(vCol.x), B = pal(vCol.y), C = pal(vCol.z);
  vec3 col = A;
  if (k == 1) { // road: p = (halfW, lanesPerDir, centre style, parking width) q = (s0, s1, crossStart, crossEnd)
    float hw = vP.x, lanes = max(vP.y, 1.0), style = vP.z, park = vP.w;
    float s0 = vQ.x, s1 = vQ.y;
    bool oneway = style > 2.5;
    float inner = hw - park;                 // carriageway between parking bays
    float lw = oneway ? (2.0 * inner) / lanes : inner / lanes;
    float m = 0.0; // white marks
    float y = 0.0; // yellow marks
    bool nearA = vQ.z > 0.5 && v < s0 + 3.6;
    bool nearB = vQ.w > 0.5 && v > s1 - 3.6;
    if (!nearA && !nearB) {
      // edge lines
      m = max(m, band(abs(u) - (inner - 0.35), 0.07));
      if (!oneway) {
        if (style > 1.5) y = max(band(abs(u) - 0.16, 0.06), y);                     // double yellow
        else if (style > 0.5) m = max(m, band(u, 0.07) * dashes(v, 6.0, 0.5));        // dashed centre
        // lane dividers within each direction
        for (int j = 1; j < 4; j++) { if (float(j) >= lanes) break; m = max(m, band(abs(u) - lw * float(j), 0.06) * dashes(v, 9.0, 0.35)); }
      } else {
        for (int j = 1; j < 6; j++) { if (float(j) >= lanes) break; m = max(m, band(u + inner - lw * float(j), 0.07) * dashes(v, 9.0, 0.35)); }
      }
      // angled parking bays along the curbs
      if (park > 0.5 && abs(u) > inner) {
        float d = fract((v + (abs(u) - inner) * 0.8) / 3.0);
        m = max(m, band(d - 0.5, 0.025) * 0.9);
      }
    }
    // stop lines (inbound side only) and zebra crosswalks
    if (vQ.z > 0.5) {
      if (v < s0 + 3.2 && abs(u) < hw - 0.2) m = max(m, band(fract(u / 1.1) - 0.5, 0.25));
      bool inA = oneway ? false : u < 0.0;
      if (inA && abs(v - (s0 + 3.6)) < 0.25 && abs(u) < inner) m = 1.0;
    }
    if (vQ.w > 0.5) {
      if (v > s1 - 3.2 && abs(u) < hw - 0.2) m = max(m, band(fract(u / 1.1) - 0.5, 0.25));
      bool inB = oneway ? true : u > 0.0;
      if (inB && abs(v - (s1 - 3.6)) < 0.25 && abs(u) < inner) m = 1.0;
    }
    col = mix(A, B, clamp(m, 0.0, 1.0));
    col = mix(col, C, clamp(y, 0.0, 1.0));
  } else if (k == 3) { // sidewalk: u = distance from curb (0 at curb), v along; p.x = width
    vec2 g = vec2(u, v) / 1.5;
    float jx = 1.0 - band(fract(g.y) - 0.5, 0.46);
    float jy = 1.0 - band(fract(g.x) - 0.5, 0.46);
    col = mix(A, C, max(jx, jy) * 0.6);
    col = mix(col, B, (1.0 - aa(0.28, u)) * vP.y);    // curb stone (p.y = 1 when the walk meets the road)
  } else if (k == 4) { // driveway: concrete slabs
    float j = 1.0 - band(fract(v / 3.0) - 0.5, 0.48);
    col = mix(A, C, j * 0.5);
  } else if (k == 5) { // parking lot: p = (stall width, stall depth); u across rows, v along
    float row = fract(u / (2.0 * vP.y + 6.0));
    float rowPos = row * (2.0 * vP.y + 6.0);
    float inStalls = step(rowPos, vP.y) + step(vP.y + 6.0, rowPos);
    float line = band(fract(v / vP.x) - 0.5, 0.48) < 0.5 ? 1.0 : 0.0;
    col = mix(A, B, line * inStalls);
  } else if (k == 6) { // rail: ballast, ties, two rails; u lateral, v along
    col = A;
    float tie = band(fract(v / 0.7) - 0.5, 0.18) * band(u, 1.25);
    col = mix(col, B, tie);
    float rails = max(band(u - 0.72, 0.08), band(u + 0.72, 0.08));
    col = mix(col, C, rails);
  } else if (k == 7) { // field rows: p.x = row period
    float r = fract(u / vP.x);
    col = mix(A, B, band(r - 0.5, 0.22));
  } else if (k == 8) { // park path: gravel with soft edges
    col = mix(A, B, 1.0 - band(u, vP.x - 0.25));
  } else if (k == 9) { // plaza pavers
    vec2 g = vec2(u, v) / vP.x;
    float a = mod(floor(g.x) + floor(g.y), 2.0);
    col = mix(A, B, a * 0.6);
    vec2 f = abs(fract(g) - 0.5);
    col = mix(col, C, aa(0.47, max(f.x, f.y)) * 0.7);
  } else if (k == 10) { // runway: centre dashes, edge lines, threshold piano keys
    float hw = vP.x, len = vP.y;
    float m = band(u, 0.6) * dashes(v, 60.0, 0.5);
    m = max(m, band(abs(u) - (hw - 1.5), 0.6));
    if (v < 50.0 || v > len - 50.0) m = max(m, band(fract(u / 4.0) - 0.5, 0.3) * band(abs(u), hw - 4.0) * step(8.0, min(v, len - v)));
    col = mix(A, B, m);
  } else if (k == 11) { // dirt road: two worn tracks
    col = mix(A, B, max(band(u - 0.9, 0.35), band(u + 0.9, 0.35)) * 0.8);
  } else if (k == 13) { // water: small light streaks drifting with the current
    float w = sin(v * 0.33 + u * 0.11 + uTime * 1.1) + sin(u * 0.47 - v * 0.07 - uTime * 0.8);
    col = mix(A, B, aa(1.62, w));
  }
  float f = smoothstep(uFogNear, uFogFar, vFogDepth);
  gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
  #include <colorspace_fragment>
}
`;

const ci = (c) => (typeof c === 'number' ? c : PAL[c] ?? PAL.charcoal);

/** Accumulates quads/strips/discs; build() returns one BufferGeometry. */
export class StreetBuilder {
  constructor() {
    this.pos = [];
    this.uv = [];
    this.p = [];
    this.q = [];
    this.col = [];
    this.kind = [];
    this.index = [];
  }

  vert(x, y, z, u, v, kind, P, Q, C) {
    this.pos.push(x, y, z);
    this.uv.push(u, v);
    this.p.push(P[0] ?? 0, P[1] ?? 0, P[2] ?? 0, P[3] ?? 0);
    this.q.push(Q[0] ?? 0, Q[1] ?? 0, Q[2] ?? 0, Q[3] ?? 0);
    this.col.push(ci(C[0]), ci(C[1] ?? C[0]), ci(C[2] ?? C[0]));
    this.kind.push(kind);
    return this.pos.length / 3 - 1;
  }

  /**
   * Strip along a polyline: pts [[x,z],...] with cumulative lengths L; lateral band [u0,u1] (right of travel
   * positive), longitudinal range [s0,s1]. uv: u = lateral offset (or offset - uBase), v = distance along.
   */
  strip(pts, L, u0, u1, s0, s1, kind, { P = [], Q = [], C = ['charcoal'], y = 0, uBase = 0, flipU = false, vBase = 0 } = {}) {
    if (s1 - s0 < 0.05) return;
    const ss = [s0];
    for (let k = 1; k < L.length - 1; k++) if (L[k] > s0 + 0.01 && L[k] < s1 - 0.01) ss.push(L[k]);
    ss.push(s1);
    let prev = -1;
    for (const s of ss) {
      // tangent: averaged at interior vertices
      let k = 1;
      while (k < L.length - 1 && L[k] < s - 1e-6) k++;
      const seg = L[k] - L[k - 1] || 1e-9;
      const t = (s - L[k - 1]) / seg;
      let dx = (pts[k][0] - pts[k - 1][0]) / seg,
        dz = (pts[k][1] - pts[k - 1][1]) / seg;
      let mx = 1;
      const atVertex = Math.abs(t - 1) < 1e-6 && k < L.length - 1;
      if (atVertex) {
        const s2 = L[k + 1] - L[k] || 1e-9;
        const bx = (pts[k + 1][0] - pts[k][0]) / s2,
          bz = (pts[k + 1][1] - pts[k][1]) / s2;
        const ax = dx,
          az = dz;
        dx = ax + bx;
        dz = az + bz;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        mx = 1 / Math.max(0.5, dx * ax + dz * az);
      }
      const x = pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * t,
        z = pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * t;
      const rx = -dz,
        rz = dx;
      const ua = flipU ? -(u0 - uBase) : u0 - uBase,
        ub = flipU ? -(u1 - uBase) : u1 - uBase;
      const i0 = this.vert(x + rx * u0 * mx, y, z + rz * u0 * mx, ua, s - vBase, kind, P, Q, C);
      const i1 = this.vert(x + rx * u1 * mx, y, z + rz * u1 * mx, ub, s - vBase, kind, P, Q, C);
      if (prev >= 0) this.quad(prev, prev + 1, i1, i0, u1 > u0);
      prev = i0;
    }
  }

  quad(a, b, c, d, flip) {
    // a,b = previous row (u0,u1); d,c = this row (u0,u1). Wind CCW seen from above (+y).
    if (flip) this.index.push(a, d, b, b, d, c);
    else this.index.push(a, b, d, b, c, d);
  }

  /** rectangle centred at (cx,cz), size w (local x) by d (local z), rotated by yaw; uv in metres local */
  rect(cx, cz, w, d, yaw, kind, { P = [], Q = [], C = ['charcoal'], y = 0, uv0 = [0, 0] } = {}) {
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    const corners = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ];
    const ids = corners.map(([lx, lz]) => this.vert(cx + c * lx + s * lz, y, cz - s * lx + c * lz, lx + uv0[0], lz + uv0[1], kind, P, Q, C));
    this.index.push(ids[0], ids[2], ids[1], ids[0], ids[3], ids[2]);
  }

  /** convex polygon [[x,z],...]; uv = world xz relative to the first point (or given origin) */
  poly(points, kind, { P = [], Q = [], C = ['charcoal'], y = 0, origin = null, rot = 0 } = {}) {
    const ox = origin ? origin[0] : points[0][0],
      oz = origin ? origin[1] : points[0][1];
    const c = Math.cos(rot),
      s = Math.sin(rot);
    const ids = points.map(([x, z]) => {
      const lx = x - ox,
        lz = z - oz;
      return this.vert(x, y, z, c * lx - s * lz, s * lx + c * lz, kind, P, Q, C);
    });
    // fan; ensure CCW from above
    let area = 0;
    for (let k = 0; k < points.length; k++) {
      const [x0, z0] = points[k],
        [x1, z1] = points[(k + 1) % points.length];
      area += x0 * z1 - x1 * z0;
    }
    for (let k = 1; k < ids.length - 1; k++) {
      if (area > 0) this.index.push(ids[0], ids[k], ids[k + 1]);
      else this.index.push(ids[0], ids[k + 1], ids[k]);
    }
  }

  /** disc or ring (r0 > 0) */
  disc(cx, cz, r1, kind, { r0 = 0, P = [], Q = [], C = ['charcoal'], y = 0, segs = 40, radialUV = false, a0 = 0, a1 = Math.PI * 2 } = {}) {
    const ring = [];
    for (let k = 0; k <= segs; k++) {
      const a = a0 + (k / segs) * (a1 - a0);
      const sx = Math.sin(a),
        cz2 = Math.cos(a);
      // radialUV: u = distance out from the inner edge (curb), v = arc length
      const outer = this.vert(cx + sx * r1, y, cz + cz2 * r1, radialUV ? r1 - r0 : sx * r1, radialUV ? a * r1 : cz2 * r1, kind, P, Q, C);
      const inner = r0 > 0 ? this.vert(cx + sx * r0, y, cz + cz2 * r0, radialUV ? 0 : sx * r0, radialUV ? a * r1 : cz2 * r0, kind, P, Q, C) : -1;
      ring.push([outer, inner]);
    }
    if (r0 <= 0) {
      const c = this.vert(cx, y, cz, 0, 0, kind, P, Q, C);
      for (let k = 0; k < segs; k++) this.index.push(c, ring[k + 1][0], ring[k][0]);
    } else {
      for (let k = 0; k < segs; k++) {
        const [o0, i0] = ring[k],
          [o1, i1] = ring[k + 1];
        this.index.push(i0, o1, o0, i0, i1, o1);
      }
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aUV', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aP', new THREE.Float32BufferAttribute(this.p, 4));
    g.setAttribute('aQ', new THREE.Float32BufferAttribute(this.q, 4));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(this.kind, 1));
    const n = this.pos.length / 3;
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.index, 1) : new THREE.Uint16BufferAttribute(this.index, 1));
    g.computeBoundingSphere();
    return g;
  }
}

export function makeStreetMaterial(timeUniform) {
  return new THREE.ShaderMaterial({
    defines: { PAL_COUNT: PALETTE.length },
    uniforms: {
      uPalette: paletteUniform,
      uFogColor: shared.uFogColor,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uTime: timeUniform,
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    side: THREE.DoubleSide, // only ever seen from above; saves caring about winding per piece
  });
}
