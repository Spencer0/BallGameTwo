// Pooled billboard particles (sparkle stars, dust puffs, confetti) in a single instanced draw.
import * as THREE from 'three';
import { paletteUniform } from '../render/materials.js';
import { PAL } from '../render/palette.js';

const MAX = 384;
export const SHAPE = { star: 0, puff: 1, confetti: 2, ring: 3 };

export class Particles {
  constructor() {
    const g = new THREE.PlaneGeometry(1, 1);
    this.col = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3); // palette idx, shape, life01
    this.col.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aP', this.col);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uPalette: paletteUniform },
      vertexShader: /* glsl */ `
        attribute vec3 aP;
        uniform vec3 uPalette[32];
        varying vec3 vColor;
        varying vec2 vUv;
        varying float vShape;
        varying float vLife;
        void main() {
          vColor = uPalette[int(aP.x + 0.5)];
          vShape = aP.y;
          vLife = aP.z;
          vUv = uv * 2.0 - 1.0;
          float s = length(instanceMatrix[0].xyz);
          float rot = instanceMatrix[1].x; // spin angle stored in an unused slot
          vec2 q = position.xy;
          float c = cos(rot), sn = sin(rot);
          q = vec2(c * q.x - sn * q.y, sn * q.x + c * q.y);
          vec4 mv = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
          mv.xy += q * s;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying vec2 vUv;
        varying float vShape;
        varying float vLife;
        void main() {
          float a = 1.0;
          vec3 col = vColor;
          if (vShape < 0.5) { // 4-point star
            vec2 p = abs(vUv);
            float d = pow(p.x, 0.6) + pow(p.y, 0.6);
            if (d > 1.0) discard;
            col = mix(vec3(1.0), vColor, smoothstep(0.0, 0.7, d));
          } else if (vShape < 1.5) { // puff: flat disc with ink rim
            float d = length(vUv);
            if (d > 1.0) discard;
            col = mix(vColor, vec3(0.16, 0.12, 0.25), smoothstep(0.78, 0.86, d));
          } else if (vShape < 2.5) { // confetti square
            if (max(abs(vUv.x), abs(vUv.y * 2.2)) > 1.0) discard;
          } else { // ring
            float d = length(vUv);
            if (d > 1.0 || d < 0.78) discard;
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      depthWrite: true,
    });
    this.mesh = new THREE.InstancedMesh(g, this.mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 5;
    this.n = 0;
    this.px = new Float32Array(MAX * 3);
    this.v = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.max = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    this.grow = new Float32Array(MAX);
    this.spin = new Float32Array(MAX);
    this.rot = new Float32Array(MAX);
    this.pal = new Uint8Array(MAX);
    this.shape = new Uint8Array(MAX);
    this.grav = new Float32Array(MAX);
    this.budget = 1; // quality multiplier
  }

  emit(x, y, z, vx, vy, vz, size, life, palName, shape = SHAPE.star, gravity = 0, grow = 0) {
    if (this.n >= MAX) return;
    const i = this.n++;
    this.px[i * 3] = x;
    this.px[i * 3 + 1] = y;
    this.px[i * 3 + 2] = z;
    this.v[i * 3] = vx;
    this.v[i * 3 + 1] = vy;
    this.v[i * 3 + 2] = vz;
    this.size[i] = size;
    this.life[i] = life;
    this.max[i] = life;
    this.pal[i] = typeof palName === 'number' ? palName : PAL[palName] ?? 2;
    this.shape[i] = shape;
    this.grav[i] = gravity;
    this.grow[i] = grow;
    this.spin[i] = (Math.random() - 0.5) * 8;
    this.rot[i] = Math.random() * 6.28;
  }

  burst(x, y, z, count, speed, size, life, pals, shape = SHAPE.star, gravity = 0, up = 0.5) {
    count = Math.max(1, Math.round(count * this.budget));
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.2) * 1.2;
      const sp = speed * (0.5 + Math.random() * 0.7);
      this.emit(
        x,
        y,
        z,
        Math.cos(a) * Math.cos(e) * sp,
        (Math.sin(e) + up) * sp,
        Math.sin(a) * Math.cos(e) * sp,
        size * (0.6 + Math.random() * 0.6),
        life * (0.7 + Math.random() * 0.6),
        pals[k % pals.length],
        shape,
        gravity,
      );
    }
  }

  update(dt) {
    const arr = this.mesh.instanceMatrix.array;
    const col = this.col.array;
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      // compact in place
      if (w !== i) {
        for (let k = 0; k < 3; k++) {
          this.px[w * 3 + k] = this.px[i * 3 + k];
          this.v[w * 3 + k] = this.v[i * 3 + k];
        }
        this.life[w] = this.life[i];
        this.max[w] = this.max[i];
        this.size[w] = this.size[i];
        this.pal[w] = this.pal[i];
        this.shape[w] = this.shape[i];
        this.grav[w] = this.grav[i];
        this.grow[w] = this.grow[i];
        this.spin[w] = this.spin[i];
        this.rot[w] = this.rot[i];
      }
      const drag = Math.exp(-2.2 * dt);
      this.v[w * 3] *= drag;
      this.v[w * 3 + 1] = this.v[w * 3 + 1] * drag - this.grav[w] * dt;
      this.v[w * 3 + 2] *= drag;
      this.px[w * 3] += this.v[w * 3] * dt;
      this.px[w * 3 + 1] += this.v[w * 3 + 1] * dt;
      this.px[w * 3 + 2] += this.v[w * 3 + 2] * dt;
      this.rot[w] += this.spin[w] * dt;
      const t = this.life[w] / this.max[w]; // 1 -> 0
      const pop = t > 0.85 ? (1 - t) / 0.15 : Math.min(1, t * 2.2);
      const s = this.size[w] * pop * (1 + this.grow[w] * (1 - t));
      const o = w * 16;
      arr[o] = s;
      arr[o + 1] = 0;
      arr[o + 2] = 0;
      arr[o + 3] = 0;
      arr[o + 4] = this.rot[w];
      arr[o + 5] = 1;
      arr[o + 6] = 0;
      arr[o + 7] = 0;
      arr[o + 8] = 0;
      arr[o + 9] = 0;
      arr[o + 10] = 1;
      arr[o + 11] = 0;
      arr[o + 12] = this.px[w * 3];
      arr[o + 13] = this.px[w * 3 + 1];
      arr[o + 14] = this.px[w * 3 + 2];
      arr[o + 15] = 1;
      col[w * 3] = this.pal[w];
      col[w * 3 + 1] = this.shape[w];
      col[w * 3 + 2] = t;
      w++;
    }
    this.n = w;
    this.mesh.count = w;
    this.mesh.visible = w > 0;
    if (w > 0) {
      this.mesh.instanceMatrix.clearUpdateRanges();
      this.mesh.instanceMatrix.addUpdateRange(0, w * 16);
      this.mesh.instanceMatrix.needsUpdate = true;
      this.col.clearUpdateRanges();
      this.col.addUpdateRange(0, w * 3);
      this.col.needsUpdate = true;
    }
  }

  clear() {
    this.n = 0;
    this.mesh.count = 0;
  }
}
