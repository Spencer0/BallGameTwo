// Level environment: sky gradient, patterned ground (procedural shader on trivial planes),
// static walls/boxes and their colliders. Patterns follow STYLE.md §5.
import * as THREE from 'three';
import { HEX } from './palette.js';
import { shared, linearRGB, makeToonMaterial, makeOutlineMaterial } from './materials.js';

export const PATTERN = { solid: 0, gingham: 1, boards: 2, tiles: 3, lawn: 4, carpet: 5, stripes: 6, asphalt: 7, water: 8, checks: 9, roadz: 10, roadx: 11 };

const groundVertex = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vFogDepth;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * wp;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const groundFragment = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uCell;
uniform int uPattern;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
uniform vec2 uOffset;
uniform int uMode; // 0 ground (xz), 1 wall (horizontal coord, y)
uniform float uShade;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vFogDepth;
float aastep(float edge, float x) {
  float w = fwidth(x) * 0.75;
  return smoothstep(edge - w, edge + w, x);
}
void main() {
  vec2 p = (vWorld.xz + uOffset) / uCell;
  if (uMode == 1) p = vec2(abs(vNormalW.x) > 0.5 ? vWorld.z : vWorld.x, vWorld.y) / uCell;
  vec3 col = uA;
  if (uPattern == 1) { // gingham
    float a = aastep(0.5, fract(p.x));
    float b = aastep(0.5, fract(p.y));
    col = mix(uB, mix(uC, uA, a * b), max(a, b));
  } else if (uPattern == 2) { // floorboards
    float row = floor(p.y);
    float off = fract(sin(row * 12.9898) * 43758.5453) * 3.0;
    float plank = floor(p.x * 0.25 + off);
    float shade = fract(sin(plank * 78.233 + row * 3.1) * 12543.1);
    col = mix(uA, uB, step(0.66, shade));
    float seamY = aastep(0.94, fract(p.y));
    float seamX = aastep(0.985, fract(p.x * 0.25 + off));
    col = mix(col, uC, max(seamY, seamX));
  } else if (uPattern == 3) { // tiles
    float a = mod(floor(p.x) + floor(p.y), 2.0);
    col = mix(uA, uB, a);
    vec2 f = abs(fract(p) - 0.5);
    col = mix(col, uC, aastep(0.46, max(f.x, f.y)));
  } else if (uPattern == 4) { // mowed lawn stripes
    col = mix(uA, uB, aastep(0.5, fract(p.x * 0.5)));
  } else if (uPattern == 5) { // carpet with soft dots
    vec2 f = fract(p) - 0.5;
    col = mix(uA, uB, 1.0 - aastep(0.12, length(f)));
  } else if (uPattern == 6) { // wide stripes
    col = mix(uA, uB, aastep(0.5, fract(p.x)));
  } else if (uPattern == 7) { // asphalt
    col = uA;
  } else if (uPattern == 10 || uPattern == 11) { // road with dashed centre line (p is local: offset = -centre)
    vec2 q = uPattern == 10 ? p : p.yx;
    float dash = step(0.5, fract(q.y * 0.9));
    float line = 1.0 - aastep(0.035, abs(q.x));
    col = mix(uA, uB, line * dash);
    float edge = aastep(0.44, abs(q.x)) * (1.0 - aastep(0.47, abs(q.x)));
    col = mix(col, uB, edge);
  } else if (uPattern == 9) { // plain checks
    col = mix(uA, uB, mod(floor(p.x) + floor(p.y), 2.0));
  } else if (uPattern == 8) { // water ripples
    float w = sin(p.x * 1.7 + uTime * 0.8) * 0.5 + sin(p.y * 2.3 - uTime * 0.6) * 0.5;
    col = mix(uA, uB, aastep(0.72, w));
  }
  col *= uShade;
  float f = smoothstep(uFogNear, uFogFar, vFogDepth);
  gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
  #include <colorspace_fragment>
}
`;

export function makeGroundMaterial({ pattern = 'solid', a = 'paper', b = 'cloud', c = 'ink', cell = 1, offset = [0, 0], mode = 0, shade = 1 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: linearRGB(HEX[a] || a) },
      uB: { value: linearRGB(HEX[b] || b) },
      uC: { value: linearRGB(HEX[c] || c) },
      uCell: { value: cell },
      uPattern: { value: PATTERN[pattern] },
      uFogColor: shared.uFogColor,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uTime: sharedTime,
      uOffset: { value: new THREE.Vector2(offset[0], offset[1]) },
      uMode: { value: mode },
      uShade: { value: shade },
    },
    vertexShader: groundVertex,
    fragmentShader: groundFragment,
  });
}

export const sharedTime = { value: 0 };

/** Soft ink blob (shadow) material for flat decals. */
export function makeBlobMaterial(opacity = 0.22) {
  return new THREE.ShaderMaterial({
    uniforms: { uInk: shared.uInk, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #ifdef USE_INSTANCING
      #endif
      void main() {
        vUv = uv * 2.0 - 1.0;
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float d = length(vUv);
        float a = (1.0 - smoothstep(0.55, 1.0, d)) * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uInk, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** Vertical sky gradient as a background texture (cheap: drawn as the clear). */
export function makeSkyTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  stops.forEach(([t, col]) => grad.addColorStop(t, HEX[col] || col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds the static environment from a level's `env` spec:
 *  { sky: [[0,'butter'],[1,'paper']], fog: [near, far, colour],
 *    planes: [{ x, z, w, d, y, pattern, a, b, c, cell }],
 *    blocks: [{ min:[x,y,z], max:[x,y,z], color, collide, climb, visible }] }
 */
export class Environment {
  constructor(spec) {
    this.spec = spec;
    this.group = new THREE.Group();
    this.boxes = [];
    this.disposables = [];
    this.groundY = spec.groundY ?? 0;
    this.skyTexture = makeSkyTexture(spec.sky);
    this.disposables.push(this.skyTexture);
    for (const p of spec.planes || []) {
      const geo = p.r ? new THREE.CircleGeometry(p.r, 48) : new THREE.PlaneGeometry(p.w, p.d);
      geo.rotateX(-Math.PI / 2);
      if (p.rot) geo.rotateY(p.rot);
      const mat = makeGroundMaterial(p);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p.x, p.y ?? 0, p.z);
      m.renderOrder = -1;
      this.group.add(m);
      this.disposables.push(geo, mat);
    }
    // room walls: inward-facing planes (invisible from outside, so the camera can pass behind them)
    for (const w of spec.walls || []) {
      const [x0, z0] = w.from;
      const [x1, z1] = w.to;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const geo = new THREE.PlaneGeometry(len, w.h);
      const mat = makeGroundMaterial({ ...w, mode: 1, shade: w.shade ?? 1 });
      const m = new THREE.Mesh(geo, mat);
      // walls run counter-clockwise around the room; the inward normal is (-dz, dx)
      const nx = -(z1 - z0) / len,
        nz = (x1 - x0) / len;
      m.rotation.y = Math.atan2(nx, nz); // plane faces +Z by default
      m.position.set((x0 + x1) / 2, (w.y ?? 0) + w.h / 2, (z0 + z1) / 2);
      this.group.add(m);
      this.disposables.push(geo, mat);
      if (w.collide !== false) {
        const t = w.thick ?? 1;
        const box = { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), minY: -1, maxY: (w.y ?? 0) + w.h + 50, climb: false, cam: false };
        if (Math.abs(nx) > 0.5) {
          if (nx > 0) box.minX -= t;
          else box.maxX += t;
        } else if (nz > 0) box.minZ -= t;
        else box.maxZ += t;
        this.boxes.push(box);
      }
    }
    const blockGeo = new THREE.BoxGeometry(1, 1, 1);
    // aPal for trivial boxes: single palette index, filled per block material via uTint
    const n = blockGeo.attributes.position.count;
    const pal = new Uint8Array(n * 2);
    for (let i = 0; i < n; i++) pal[i * 2 + 1] = 1; // tintable: colour comes from uTint
    blockGeo.setAttribute('aPal', new THREE.BufferAttribute(pal, 2));
    blockGeo.setAttribute('aOutN', blockGeo.attributes.normal.clone());
    // smooth outline normals for a cube: corner directions
    const on = blockGeo.attributes.aOutN;
    const pos = blockGeo.attributes.position;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.sign(pos.getX(i)), Math.sign(pos.getY(i)), Math.sign(pos.getZ(i))).normalize();
      on.setXYZ(i, v.x, v.y, v.z);
    }
    this.disposables.push(blockGeo);
    const PALI = Object.keys(HEX);
    for (const b of spec.blocks || []) {
      const [x0, y0, z0] = b.min;
      const [x1, y1, z1] = b.max;
      if (b.visible !== false) {
        const tint = PALI.indexOf(b.color || 'caramel') + 1;
        if (tint === 0) throw new Error('environment block colour must be a palette name: ' + b.color);
        const mat = makeToonMaterial({ tint });
        const m = new THREE.Mesh(blockGeo, mat);
        m.scale.set(x1 - x0, y1 - y0, z1 - z0);
        m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        this.group.add(m);
        this.disposables.push(mat);
        if (b.outline !== false) {
          const om = makeOutlineMaterial(Math.min(x1 - x0, y1 - y0, z1 - z0) * 4, { tint });
          const o = new THREE.Mesh(blockGeo, om);
          o.scale.copy(m.scale);
          o.position.copy(m.position);
          this.group.add(o);
          this.disposables.push(om);
        }
      }
      if (b.collide !== false)
        this.boxes.push({ minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1, climb: !!b.climb, cam: b.cam !== false && b.visible !== false });
    }
  }

  groundAt() {
    return this.groundY;
  }

  /** 2D line of travel blocked by a box taller than `climb` (used by the autopilot)? */
  blockedPath(ax, az, bx, bz, climb) {
    for (let k = 0; k < this.boxes.length; k++) {
      const B = this.boxes[k];
      if (B.maxY - Math.max(B.minY, this.groundY) <= climb) continue;
      let t0 = 0,
        t1 = 1;
      const dx = bx - ax,
        dz = bz - az;
      let ok = true;
      for (const [o, d, lo, hi] of [
        [ax, dx, B.minX, B.maxX],
        [az, dz, B.minZ, B.maxZ],
      ]) {
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) ok = false;
          continue;
        }
        let ta = (lo - o) / d,
          tb = (hi - o) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) ok = false;
      }
      if (ok) return true;
    }
    return false;
  }

  /**
   * Segment (ax,ay,az)->(bx,by,bz) against camera-blocking boxes (slab test).
   * Returns the smallest hit fraction in [0,1] (1 = clear).
   */
  segmentHit(ax, ay, az, bx, by, bz) {
    let best = 1;
    const dx = bx - ax,
      dy = by - ay,
      dz = bz - az;
    for (let k = 0; k < this.boxes.length; k++) {
      const B = this.boxes[k];
      if (!B.cam) continue;
      let t0 = 0,
        t1 = 1;
      let ok = true;
      for (let axis = 0; axis < 3 && ok; axis++) {
        const o = axis === 0 ? ax : axis === 1 ? ay : az;
        const d = axis === 0 ? dx : axis === 1 ? dy : dz;
        const lo = axis === 0 ? B.minX : axis === 1 ? B.minY : B.minZ;
        const hi = axis === 0 ? B.maxX : axis === 1 ? B.maxY : B.maxZ;
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) ok = false;
        } else {
          let ta = (lo - o) / d,
            tb = (hi - o) / d;
          if (ta > tb) {
            const t = ta;
            ta = tb;
            tb = t;
          }
          if (ta > t0) t0 = ta;
          if (tb < t1) t1 = tb;
          if (t0 > t1) ok = false;
        }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }

  dispose() {
    this.group.removeFromParent();
    for (const d of this.disposables) d.dispose();
  }
}
