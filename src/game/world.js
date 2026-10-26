// World object store (structure of arrays), uniform-grid broadphase, and per-type instanced
// rendering with cell frustum culling + LOD selection. See TECH.md §5–6.
import * as THREE from 'three';
import { toonMaterial, makeOutlineMaterial } from '../render/materials.js';
import { makeBlobMaterial } from '../render/environment.js';

export const ALIVE = 1;
export const GONE = 0; // collected (in the ball crust or bulk-collected)
export const MOVING = 2; // creature / falling / knocked loose (still collectible)
export const MOVING_AIR = 3; // airborne (knocked loose, falling): no blob shadow

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _box = new THREE.Box3();
const _frustum = new THREE.Frustum();
const _pv = new THREE.Matrix4();
const _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

function copy16(src, so, dst, d) {
  for (let k = 0; k < 16; k++) dst[d + k] = src[so + k];
}

/** area-weighted most common palette index of a geometry (for far impostor boxes) */
function dominantPal(geo) {
  const pal = geo.attributes.aPal.array,
    pos = geo.attributes.position.array,
    idx = geo.index.array;
  const acc = new Float64Array(64);
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 3,
      b = idx[k + 1] * 3,
      c = idx[k + 2] * 3;
    const ux = pos[b] - pos[a],
      uy = pos[b + 1] - pos[a + 1],
      uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a],
      vy = pos[c + 1] - pos[a + 1],
      vz = pos[c + 2] - pos[a + 2];
    const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    acc[pal[idx[k] * 2] & 63] += area;
  }
  let best = 0;
  for (let k = 1; k < 64; k++) if (acc[k] > acc[best]) best = k;
  return best;
}

/** Far-away box-like buildings: one instanced unit box, scaled per instance, in the type's main colour. */
class BoxBatch {
  constructor(cap) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const n = g.attributes.position.count;
    const pal = new Uint8Array(n * 2);
    for (let k = 0; k < n; k++) pal[k * 2 + 1] = 1; // every vertex takes the instance tint
    g.setAttribute('aPal', new THREE.BufferAttribute(pal, 2));
    g.setAttribute('aOutN', g.attributes.normal);
    const tint = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    tint.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aTint', tint);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    this.mesh = new THREE.InstancedMesh(g, toonMaterial, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.n = 0;
  }
  flush() {
    const m = this.mesh,
      n = this.n;
    m.count = n;
    m.visible = n > 0;
    if (n > 0) {
      m.instanceMatrix.clearUpdateRanges();
      m.instanceMatrix.addUpdateRange(0, n * 16);
      m.instanceMatrix.needsUpdate = true;
      const t = m.geometry.attributes.aTint;
      t.clearUpdateRanges();
      t.addUpdateRange(0, n);
      t.needsUpdate = true;
    }
  }
}

class TypeBatch {
  constructor(type, cap, quality) {
    this.type = type;
    this.cap = cap;
    const make = (lod) => {
      const src = type.geo[lod] || type.geo[0];
      const g = new THREE.BufferGeometry();
      for (const k of ['position', 'normal', 'aPal', 'aOutN']) g.setAttribute(k, src.attributes[k]);
      g.setIndex(src.index);
      const tint = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
      tint.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aTint', tint);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
      const mesh = new THREE.InstancedMesh(g, toonMaterial, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      return mesh;
    };
    this.lod0 = make(0);
    this.lod1 = make(1);
    this.outlineMat = makeOutlineMaterial(type.size);
    this.out0 = new THREE.InstancedMesh(this.lod0.geometry, this.outlineMat, cap);
    this.out0.instanceMatrix = this.lod0.instanceMatrix; // shared buffer: uploaded once
    this.out0.frustumCulled = false;
    this.out0.count = 0;
    this.n0 = 0;
    this.n1 = 0;
    this.outlines = quality.outlines;
  }
  addTo(scene) {
    scene.add(this.lod0, this.lod1, this.out0);
  }
  dispose() {
    for (const m of [this.lod0, this.lod1, this.out0]) m.removeFromParent();
    this.lod0.geometry.dispose();
    this.lod1.geometry.dispose();
    this.outlineMat.dispose();
  }
  flush() {
    const finish = (mesh, n) => {
      mesh.count = n;
      mesh.visible = n > 0;
      if (n > 0) {
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, n * 16);
        mesh.instanceMatrix.needsUpdate = true;
        const t = mesh.geometry.attributes.aTint;
        t.clearUpdateRanges();
        t.addUpdateRange(0, n);
        t.needsUpdate = true;
      }
    };
    finish(this.lod0, this.n0);
    finish(this.lod1, this.n1);
    this.out0.count = this.outlines ? this.n0 : 0;
    this.out0.visible = this.outlines && this.n0 > 0;
  }
}

export class World {
  /**
   * @param {object} opts { types, capacity, bounds:{minX,minZ,maxX,maxZ}, cellSize }
   */
  constructor(opts) {
    const cap = opts.capacity;
    this.types = opts.types;
    this.cap = cap;
    this.n = 0;
    this.type = new Uint16Array(cap);
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.z = new Float32Array(cap);
    this.yaw = new Float32Array(cap);
    this.scale = new Float32Array(cap);
    this.tint = new Uint8Array(cap); // palette index + 1, 0 = default colours
    this.state = new Uint8Array(cap);
    this.size = new Float32Array(cap); // pickup size (type size x scale)
    this.bound = new Float32Array(cap); // bounding radius
    this.stamp = new Uint32Array(cap);
    this.mat = new Float32Array(cap * 16);
    this.tilt = new Float32Array(cap * 2); // wobble / tumble tilt (x, z) radians
    this.restOn = new Int32Array(cap).fill(-1); // index of the object this one sits on
    this.stampId = 1;
    this.maxBound = 0;
    // grid
    const b = opts.bounds;
    this.cell = opts.cellSize;
    this.minX = b.minX;
    this.minZ = b.minZ;
    this.gw = Math.max(1, Math.ceil((b.maxX - b.minX) / this.cell));
    this.gh = Math.max(1, Math.ceil((b.maxZ - b.minZ) / this.cell));
    this.cells = new Array(this.gw * this.gh);
    this.cellTop = new Float32Array(this.gw * this.gh); // max object top in cell (for culling boxes)
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
    this.cellMin = new Int32Array(cap * 2); // registered cell rect per instance (x0,z0) and
    this.cellMax = new Int32Array(cap * 2); // (x1,z1), so moving objects can unregister cheaply
    this.batches = [];
    this.batchOf = [];
    this.countByType = new Uint32Array(this.types.length);
    this.lodPx = 26; // projected size (px) above which LOD0 is used
    this.farPx = 0; // below this, box-like buildings draw as plain boxes (0 = off)
    this.boxBatch = null;
    this.cullPx = 1.6; // below this an object isn't drawn
    this.viewDist = 1e9;
    this.visibleCount = 0;
    this.focus = null; // {x,y,z,r}: the ball; objects occluding the camera's view of it are hidden
  }

  add(typeIdx, x, y, z, yaw = 0, scale = 1, tint = 0) {
    const i = this.n++;
    if (i >= this.cap) throw new Error('world capacity');
    const t = this.types[typeIdx];
    this.type[i] = typeIdx;
    this.x[i] = x;
    this.y[i] = y;
    this.z[i] = z;
    this.yaw[i] = yaw;
    this.scale[i] = scale;
    this.tint[i] = tint;
    this.state[i] = ALIVE;
    this.size[i] = t.size * scale;
    this.bound[i] = t.bound * scale;
    this.maxBound = Math.max(this.maxBound, this.bound[i]);
    this.countByType[typeIdx]++;
    this.updateMatrix(i);
    this.register(i);
    return i;
  }

  updateMatrix(i) {
    const t = this.types[this.type[i]];
    const s = this.scale[i];
    const tx = this.tilt[i * 2];
    const tz = this.tilt[i * 2 + 1];
    if (tx !== 0 || tz !== 0) {
      // tilt about the object's centre so wobbles look like rocking
      _q.setFromEuler(_e.set(tx, this.yaw[i], tz, 'YXZ'));
      const cy = t.dims[1] * 0.5 * s;
      _p.set(0, cy, 0).applyQuaternion(_q);
      _m.compose(_s.set(this.x[i] - _p.x, this.y[i] + cy - _p.y, this.z[i] - _p.z), _q, _p.set(s, s, s));
    } else {
      _q.setFromAxisAngle(UP, this.yaw[i]);
      _m.compose(_s.set(this.x[i], this.y[i], this.z[i]), _q, _p.set(s, s, s));
    }
    _m.toArray(this.mat, i * 16);
  }

  // ---------------------------------------------------------------- grid
  cellIndex(cx, cz) {
    return cz * this.gw + cx;
  }
  cx(x) {
    return Math.min(this.gw - 1, Math.max(0, Math.floor((x - this.minX) / this.cell)));
  }
  cz(z) {
    return Math.min(this.gh - 1, Math.max(0, Math.floor((z - this.minZ) / this.cell)));
  }
  register(i) {
    const r = this.bound[i];
    const x0 = this.cx(this.x[i] - r),
      x1 = this.cx(this.x[i] + r);
    const z0 = this.cz(this.z[i] - r),
      z1 = this.cz(this.z[i] + r);
    const top = this.y[i] + this.types[this.type[i]].dims[1] * this.scale[i];
    for (let cz = z0; cz <= z1; cz++)
      for (let cx = x0; cx <= x1; cx++) {
        const c = this.cellIndex(cx, cz);
        this.cells[c].push(i);
        if (top > this.cellTop[c]) this.cellTop[c] = top;
      }
    this.cellMin[i * 2] = x0;
    this.cellMin[i * 2 + 1] = z0;
    this.cellMax[i * 2] = x1;
    this.cellMax[i * 2 + 1] = z1;
  }
  unregister(i) {
    for (let cz = this.cellMin[i * 2 + 1]; cz <= this.cellMax[i * 2 + 1]; cz++)
      for (let cx = this.cellMin[i * 2]; cx <= this.cellMax[i * 2]; cx++) {
        const arr = this.cells[this.cellIndex(cx, cz)];
        const k = arr.indexOf(i);
        if (k >= 0) {
          arr[k] = arr[arr.length - 1];
          arr.pop();
        }
      }
  }
  /** Re-bucket after a move, only if the covered cell rect changed. */
  moved(i) {
    const r = this.bound[i];
    if (
      this.cx(this.x[i] - r) !== this.cellMin[i * 2] ||
      this.cz(this.z[i] - r) !== this.cellMin[i * 2 + 1] ||
      this.cx(this.x[i] + r) !== this.cellMax[i * 2] ||
      this.cz(this.z[i] + r) !== this.cellMax[i * 2 + 1]
    ) {
      this.unregister(i);
      this.register(i);
    }
    this.updateMatrix(i);
  }
  remove(i) {
    if (this.state[i] === GONE) return;
    this.state[i] = GONE;
    this.unregister(i);
  }
  revive(i, state = MOVING) {
    if (this.state[i] !== GONE) return;
    this.state[i] = state;
    this.register(i);
    this.updateMatrix(i);
  }

  /** Collect live instance indices whose bounds may touch the circle; returns count. */
  query(x, z, radius, out) {
    const stamp = ++this.stampId;
    let n = 0;
    const x0 = this.cx(x - radius),
      x1 = this.cx(x + radius);
    const z0 = this.cz(z - radius),
      z1 = this.cz(z + radius);
    for (let cz = z0; cz <= z1; cz++)
      for (let cx = x0; cx <= x1; cx++) {
        const arr = this.cells[this.cellIndex(cx, cz)];
        for (let k = 0; k < arr.length; k++) {
          const i = arr[k];
          if (this.stamp[i] === stamp) continue;
          this.stamp[i] = stamp;
          const dx = this.x[i] - x,
            dz = this.z[i] - z,
            rr = radius + this.bound[i];
          if (dx * dx + dz * dz > rr * rr) continue;
          if (n < out.length) out[n++] = i;
        }
      }
    return n;
  }

  // ---------------------------------------------------------------- rendering
  buildBatches(scene, quality) {
    for (let t = 0; t < this.types.length; t++) {
      const c = this.countByType[t];
      if (!c || !this.types[t].geo[0]) {
        this.batchOf[t] = null;
        continue;
      }
      const b = new TypeBatch(this.types[t], c, quality);
      b.addTo(scene);
      this.batches.push(b);
      this.batchOf[t] = b;
    }
    // impostor boxes for big box-like types (buildings)
    let nb = 0;
    for (let t = 0; t < this.types.length; t++) {
      const ty = this.types[t];
      // box-like enough to draw as a plain box when tiny on screen: tall buildings, anything that fills
      // most of its box (vehicles, sheds, bins), and fence panels (a thin box reads as a fence far off)
      const fill = ty.vol / Math.max(1e-9, ty.dims[0] * ty.dims[1] * ty.dims[2]);
      const treeish = ty.collider && ty.collider.kind === 'cyl' && /tree/.test(ty.id); // a blob of leaves, only when tiny
      ty.treeish = treeish;
      ty.boxable = !!(this.batchOf[t] && ty.collider && !ty.isCreature && !ty.floats && !/airliner|helicopter|blimp|cloud|balloon|statue|obelisk|observation_tower|bridge_tower|radio_mast|crane|big_wheel|rocket|lighthouse|spire|flag|boat|ship|ferry|tug|canoe|kayak|barge|yacht|sail|duck|bridge|viaduct/.test(ty.id) && (treeish || (ty.collider.kind === 'box' && (ty.dims[1] >= 6 || fill >= 0.55 || /fence/.test(ty.id)))));
      if (ty.boxable) {
        ty.domPal = dominantPal(ty.geo[1] || ty.geo[0]);
        nb += this.countByType[t];
      }
    }
    if (nb > 0) {
      this.boxBatch = new BoxBatch(nb);
      scene.add(this.boxBatch.mesh);
    }
  }
  /** One instanced draw for soft blob shadows under nearby (LOD0) objects. */
  buildShadows(scene, cap) {
    const g = new THREE.PlaneGeometry(2, 2);
    g.rotateX(-Math.PI / 2);
    this.shadowMat = makeBlobMaterial(0.2);
    this.shadows = new THREE.InstancedMesh(g, this.shadowMat, cap);
    this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shadows.frustumCulled = false;
    this.shadows.count = 0;
    this.shadows.renderOrder = 1;
    this.shadowCap = cap;
    this.shadowsOn = true;
    scene.add(this.shadows);
  }

  setOutlines(on) {
    for (const b of this.batches) b.outlines = on;
  }
  dispose() {
    for (const b of this.batches) b.dispose();
    this.batches.length = 0;
    if (this.shadows) {
      this.shadows.removeFromParent();
      this.shadows.geometry.dispose();
      this.shadowMat.dispose();
    }
  }

  /** Fill instance buffers from cells visible to the camera. */
  /** Does segment a->b pass through instance i's yawed box (inflated by m)? Slab test in object space. */
  segmentHitsBox(i, ax, ay, az, bx, by, bz, m) {
    const t = this.types[this.type[i]];
    const s = this.scale[i];
    const c = Math.cos(this.yaw[i]),
      sn = Math.sin(this.yaw[i]);
    const px = ax - this.x[i],
      pz = az - this.z[i];
    const ox = c * px - sn * pz,
      oz = sn * px + c * pz,
      oy = ay - this.y[i];
    const qx = bx - ax,
      qz = bz - az;
    const dx = c * qx - sn * qz,
      dz = sn * qx + c * qz,
      dy = by - ay;
    const hx = t.dims[0] * 0.5 * s + m,
      hz = t.dims[2] * 0.5 * s + m;
    let t0 = 0.02,
      t1 = 0.98;
    // x slab
    if (Math.abs(dx) < 1e-12) {
      if (Math.abs(ox) > hx) return false;
    } else {
      let u = (-hx - ox) / dx,
        v = (hx - ox) / dx;
      if (u > v) [u, v] = [v, u];
      if (u > t0) t0 = u;
      if (v < t1) t1 = v;
      if (t0 > t1) return false;
    }
    // y slab (base at 0)
    if (Math.abs(dy) < 1e-12) {
      if (oy < -m || oy > t.dims[1] * s + m) return false;
    } else {
      let u = (-m - oy) / dy,
        v = (t.dims[1] * s + m - oy) / dy;
      if (u > v) [u, v] = [v, u];
      if (u > t0) t0 = u;
      if (v < t1) t1 = v;
      if (t0 > t1) return false;
    }
    // z slab
    if (Math.abs(dz) < 1e-12) return Math.abs(oz) <= hz;
    let u = (-hz - oz) / dz,
      v = (hz - oz) / dz;
    if (u > v) [u, v] = [v, u];
    if (u > t0) t0 = u;
    if (v < t1) t1 = v;
    return t0 <= t1;
  }

  /** Is the camera inside instance i's yawed box (plus a small margin for the outline hull)? */
  cameraInside(i, camX, camY, camZ) {
    const t = this.types[this.type[i]];
    const s = this.scale[i];
    const c = Math.cos(this.yaw[i]),
      sn = Math.sin(this.yaw[i]);
    const dx = camX - this.x[i],
      dz = camZ - this.z[i];
    const lx = c * dx - sn * dz,
      lz = sn * dx + c * dz,
      ly = camY - this.y[i];
    const m = 0.06 * Math.max(t.dims[0], t.dims[1], t.dims[2]) * s;
    return Math.abs(lx) < t.dims[0] * 0.5 * s + m && Math.abs(lz) < t.dims[2] * 0.5 * s + m && ly > -m && ly < t.dims[1] * s + m;
  }

  updateRender(camera, focalPx) {
    for (let k = 0; k < this.batches.length; k++) {
      this.batches[k].n0 = 0;
      this.batches[k].n1 = 0;
    }
    _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    const camX = camera.position.x,
      camY = camera.position.y,
      camZ = camera.position.z;
    const vd = Math.min(this.viewDist, camera.far);
    const x0 = this.cx(camX - vd),
      x1 = this.cx(camX + vd);
    const z0 = this.cz(camZ - vd),
      z1 = this.cz(camZ + vd);
    const stamp = ++this.stampId;
    const lodPx = this.lodPx,
      cullPx = this.cullPx,
      farPx = this.farPx;
    const BB = this.boxBatch;
    if (BB) BB.n = 0;
    // camera -> focus segment for occluder hiding
    const F = this.focus;
    let sx = 0,
      sy = 0,
      sz = 0,
      sl2 = 0;
    if (F) {
      sx = F.x - camX;
      sy = F.y - camY;
      sz = F.z - camZ;
      sl2 = sx * sx + sy * sy + sz * sz;
    }
    const pad = this.maxBound;
    let visible = 0;
    let ns = 0;
    const sh = this.shadows && this.shadowsOn ? this.shadows.instanceMatrix.array : null;
    const shCap = this.shadowCap || 0;
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = this.cellIndex(cx, cz);
        const arr = this.cells[c];
        if (arr.length === 0) continue;
        const bx = this.minX + cx * this.cell,
          bz = this.minZ + cz * this.cell;
        _box.min.set(bx - 0.01, -pad * 0.1 - 1, bz - 0.01);
        _box.max.set(bx + this.cell, this.cellTop[c] + 0.01, bz + this.cell);
        if (!_frustum.intersectsBox(_box)) continue;
        for (let k = 0; k < arr.length; k++) {
          const i = arr[k];
          if (this.stamp[i] === stamp) continue;
          this.stamp[i] = stamp;
          if (this.hideAbove && this.y[i] > this.hideAbove) continue; // review map views: no clouds/aircraft
          const dx = this.x[i] - camX,
            dy = this.y[i] - camY,
            dz = this.z[i] - camZ;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
          // camera inside (or nearly inside) this object's box: hide it so we see through it. (A bounding-sphere
          // test hid long thin props such as knives whenever they neared the bottom corners of the view.)
          if (d < this.bound[i] * 1.1 && this.cameraInside(i, camX, camY, camZ)) continue;
          // object between the camera and the ball (or Lint at its base): hide it (Katamari-style see-through).
          // Exact sight-segment vs yawed-box test: a sphere test hid flat props (knives, books) lying in the
          // foreground, especially toward the bottom corners of the view, though they couldn't block the ball.
          if (F && d * d < sl2 && this.bound[i] > F.r * 0.25) {
            const m = F.r * 0.15;
            if (this.segmentHitsBox(i, camX, camY, camZ, F.x, F.y, F.z, m) || this.segmentHitsBox(i, camX, camY, camZ, F.x, F.y - F.r * 0.7, F.z, m)) continue;
          }
          const px = (this.bound[i] * 2 * focalPx) / d;
          if (px < cullPx) continue;
          const b = this.batchOf[this.type[i]];
          if (!b) continue;
          visible++;
          if (px < farPx && b.type.boxable && BB && (!b.type.treeish || px < farPx * 0.45)) {
            // far away: a plain box in the building's main colour
            const t = b.type,
              s = this.scale[i];
            const o = BB.n++ * 16,
              m = BB.mesh.instanceMatrix.array;
            const c = Math.cos(this.yaw[i]),
              sn = Math.sin(this.yaw[i]);
            const sx = t.dims[0] * s,
              sy = t.dims[1] * s,
              sz = t.dims[2] * s;
            m[o] = c * sx;
            m[o + 1] = 0;
            m[o + 2] = -sn * sx;
            m[o + 3] = 0;
            m[o + 4] = 0;
            m[o + 5] = sy;
            m[o + 6] = 0;
            m[o + 7] = 0;
            m[o + 8] = sn * sz;
            m[o + 9] = 0;
            m[o + 10] = c * sz;
            m[o + 11] = 0;
            m[o + 12] = this.x[i];
            m[o + 13] = this.y[i];
            m[o + 14] = this.z[i];
            m[o + 15] = 1;
            BB.mesh.geometry.attributes.aTint.array[o / 16] = this.tint[i] || t.domPal + 1;
            continue;
          }
          if (px > lodPx) {
            const n = b.n0++;
            copy16(this.mat, i * 16, b.lod0.instanceMatrix.array, n * 16);
            b.lod0.geometry.attributes.aTint.array[n] = this.tint[i];
            if (sh && ns < shCap && !this.types[this.type[i]].floats) {
              const t = this.types[this.type[i]];
              const s = this.scale[i];
              const o = ns++ * 16;
              const c = Math.cos(this.yaw[i]),
                sn = Math.sin(this.yaw[i]);
              const hx = t.dims[0] * 0.5 * s * 1.08,
                hz = t.dims[2] * 0.5 * s * 1.08;
              sh[o] = c * hx;
              sh[o + 1] = 0;
              sh[o + 2] = -sn * hx;
              sh[o + 3] = 0;
              sh[o + 4] = 0;
              sh[o + 5] = 1;
              sh[o + 6] = 0;
              sh[o + 7] = 0;
              sh[o + 8] = sn * hz;
              sh[o + 9] = 0;
              sh[o + 10] = c * hz;
              sh[o + 11] = 0;
              sh[o + 12] = this.x[i];
              sh[o + 13] = this.y[i] + 0.002 * s * t.dims[1];
              sh[o + 14] = this.z[i];
              sh[o + 15] = 1;
            }
          } else {
            const n = b.n1++;
            copy16(this.mat, i * 16, b.lod1.instanceMatrix.array, n * 16);
            b.lod1.geometry.attributes.aTint.array[n] = this.tint[i];
          }
        }
      }
    }
    for (let k = 0; k < this.batches.length; k++) this.batches[k].flush();
    if (BB) BB.flush();
    this.visibleCount = visible;
    if (this.shadows) {
      this.shadows.count = ns;
      this.shadows.visible = ns > 0;
      if (ns > 0) {
        this.shadows.instanceMatrix.clearUpdateRanges();
        this.shadows.instanceMatrix.addUpdateRange(0, ns * 16);
        this.shadows.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
