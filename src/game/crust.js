// The ball "crust": every stuck object is baked into one preallocated dynamic mesh in ball-local
// space (2 draw calls total with the outline). Append-only with cheap pop-from-end (knock-off),
// in-place burial of deep items, and occasional compaction. See TECH.md §4.
import * as THREE from 'three';
import { makeToonMaterial, makeOutlineMaterial } from '../render/materials.js';

const _n = new THREE.Matrix3();
const ATTRS = ['position', 'normal', 'aOutN', 'aPal', 'aSize'];
const SIZES = [3, 3, 3, 2, 1];

export class Crust {
  constructor(maxVerts = 90000, maxItems = 2048) {
    this.maxV = maxVerts;
    this.maxI = maxVerts * 2;
    this.maxItems = maxItems;
    this.P = new Float32Array(maxVerts * 3);
    this.N = new Float32Array(maxVerts * 3);
    this.O = new Float32Array(maxVerts * 3);
    this.A = new Uint8Array(maxVerts * 2);
    this.S = new Float32Array(maxVerts); // item size per vertex (outline width cap)
    this.I = new Uint32Array(this.maxI);
    // items (parallel arrays)
    this.vStart = new Int32Array(maxItems);
    this.vCount = new Int32Array(maxItems);
    this.iStart = new Int32Array(maxItems);
    this.iCount = new Int32Array(maxItems);
    this.inst = new Int32Array(maxItems);
    this.dist = new Float32Array(maxItems);
    this.rad = new Float32Array(maxItems);
    this.vol = new Float32Array(maxItems);
    this.loc = new Float32Array(maxItems * 3); // item centre in ball space
    this.dead = new Uint8Array(maxItems);
    this.count = 0;
    this.vEnd = 0;
    this.iEnd = 0;
    this.deadVerts = 0;
    this.lastCompact = 0;

    const g = new THREE.BufferGeometry();
    const mk = (arr, size, norm) => {
      const a = new THREE.BufferAttribute(arr, size, norm);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    g.setAttribute('position', mk(this.P, 3));
    g.setAttribute('normal', mk(this.N, 3));
    g.setAttribute('aOutN', mk(this.O, 3));
    g.setAttribute('aPal', mk(this.A, 2));
    g.setAttribute('aSize', mk(this.S, 1));
    g.setIndex(mk(this.I, 1));
    g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    this.geometry = g;
    this.material = makeToonMaterial();
    this.outlineMat = makeOutlineMaterial(1, { sizeAttr: true });
    this.mesh = new THREE.Mesh(g, this.material);
    this.outline = new THREE.Mesh(g, this.outlineMat);
    this.mesh.frustumCulled = false;
    this.outline.frustumCulled = false;
  }

  reset() {
    this.count = 0;
    this.vEnd = 0;
    this.iEnd = 0;
    this.deadVerts = 0;
    this.geometry.setDrawRange(0, 0);
  }

  get full() {
    return this.count >= this.maxItems;
  }

  /**
   * Bake a geometry into the crust.
   * @param geo   converted object geometry (position/normal/aOutN/aPal/index)
   * @param m     Matrix4 object -> ball-local transform
   * @param tint  palette index + 1 or 0
   */
  add(geo, m, tint, instIdx, dist, rad, vol, lx = 0, ly = 0, lz = 0, size = 0.1) {
    const vc = geo.attributes.position.count;
    const ic = geo.index.count;
    if (this.vEnd + vc > this.maxV || this.iEnd + ic > this.maxI || this.count >= this.maxItems) {
      this.makeRoom(vc, ic);
      if (this.vEnd + vc > this.maxV || this.iEnd + ic > this.maxI || this.count >= this.maxItems) return false;
    }
    const v0 = this.vEnd;
    const i0 = this.iEnd;
    const sp = geo.attributes.position.array,
      sn = geo.attributes.normal.array,
      so = geo.attributes.aOutN.array,
      sa = geo.attributes.aPal.array,
      si = geo.index.array;
    const e = m.elements;
    _n.getNormalMatrix(m);
    const ne = _n.elements;
    for (let k = 0; k < vc; k++) {
      const x = sp[k * 3],
        y = sp[k * 3 + 1],
        z = sp[k * 3 + 2];
      const o = (v0 + k) * 3;
      this.P[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
      this.P[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      this.P[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      let nx = sn[k * 3],
        ny = sn[k * 3 + 1],
        nz = sn[k * 3 + 2];
      this.N[o] = ne[0] * nx + ne[3] * ny + ne[6] * nz;
      this.N[o + 1] = ne[1] * nx + ne[4] * ny + ne[7] * nz;
      this.N[o + 2] = ne[2] * nx + ne[5] * ny + ne[8] * nz;
      nx = so[k * 3];
      ny = so[k * 3 + 1];
      nz = so[k * 3 + 2];
      this.O[o] = ne[0] * nx + ne[3] * ny + ne[6] * nz;
      this.O[o + 1] = ne[1] * nx + ne[4] * ny + ne[7] * nz;
      this.O[o + 2] = ne[2] * nx + ne[5] * ny + ne[8] * nz;
      const pal = sa[k * 2];
      const tintable = sa[k * 2 + 1];
      this.A[(v0 + k) * 2] = tintable && tint > 0 ? tint - 1 : pal;
      this.A[(v0 + k) * 2 + 1] = 0;
      this.S[v0 + k] = size;
    }
    for (let k = 0; k < ic; k++) this.I[i0 + k] = si[k] + v0;
    const it = this.count++;
    this.vStart[it] = v0;
    this.vCount[it] = vc;
    this.iStart[it] = i0;
    this.iCount[it] = ic;
    this.inst[it] = instIdx;
    this.dist[it] = dist;
    this.rad[it] = rad;
    this.vol[it] = vol;
    this.loc[it * 3] = lx;
    this.loc[it * 3 + 1] = ly;
    this.loc[it * 3 + 2] = lz;
    this.dead[it] = 0;
    this.vEnd += vc;
    this.iEnd += ic;
    this.upload(v0, vc, i0, ic);
    this.geometry.setDrawRange(0, this.iEnd);
    return true;
  }

  upload(v0, vc, i0, ic) {
    const g = this.geometry;
    for (let k = 0; k < ATTRS.length; k++) {
      const name = ATTRS[k],
        size = SIZES[k];
      const a = g.attributes[name];
      a.addUpdateRange(v0 * size, vc * size);
      a.needsUpdate = true;
    }
    g.index.addUpdateRange(i0, ic);
    g.index.needsUpdate = true;
  }

  /** Remove the n most recent live items. Returns how many were removed; fills `out` with inst ids. */
  popRecent(n, out) {
    let k = 0;
    while (k < n && this.count > 0) {
      const it = this.count - 1;
      if (!this.dead[it]) out[k++] = it;
      else this.deadVerts -= this.vCount[it];
      // removal from the end: just shrink
      this.vEnd = this.vStart[it];
      this.iEnd = this.iStart[it];
      this.count--;
    }
    this.geometry.setDrawRange(0, this.iEnd);
    return k;
  }

  /** Kill one item in place (degenerate its triangles). */
  kill(it) {
    if (this.dead[it]) return;
    this.dead[it] = 1;
    const i0 = this.iStart[it],
      ic = this.iCount[it],
      v = this.vStart[it];
    this.I.fill(v, i0, i0 + ic);
    this.geometry.index.addUpdateRange(i0, ic);
    this.geometry.index.needsUpdate = true;
    this.deadVerts += this.vCount[it];
  }

  /** Bury items that sank under the core surface or became negligible. */
  bury(coreR, minRad, now) {
    for (let it = 0; it < this.count; it++) {
      if (this.dead[it]) continue;
      if (this.dist[it] + this.rad[it] * 0.6 < coreR || this.rad[it] < minRad) this.kill(it);
    }
    if (this.deadVerts > this.vEnd * 0.3 && now - this.lastCompact > 2) this.compact(now);
  }

  /** Free space by burying the oldest items first (they're deepest), then compact. */
  makeRoom(vc, ic) {
    let freedV = 0;
    for (let it = 0; it < this.count && freedV < Math.max(vc * 4, this.maxV * 0.15); it++) {
      if (this.dead[it]) continue;
      this.kill(it);
      freedV += this.vCount[it];
    }
    this.compact(this.lastCompact + 10);
  }

  compact(now) {
    this.lastCompact = now;
    let w = 0,
      vw = 0,
      iw = 0;
    for (let it = 0; it < this.count; it++) {
      if (this.dead[it]) continue;
      const vs = this.vStart[it],
        vc = this.vCount[it],
        is = this.iStart[it],
        ic = this.iCount[it];
      if (vs !== vw) {
        this.P.copyWithin(vw * 3, vs * 3, (vs + vc) * 3);
        this.N.copyWithin(vw * 3, vs * 3, (vs + vc) * 3);
        this.O.copyWithin(vw * 3, vs * 3, (vs + vc) * 3);
        this.A.copyWithin(vw * 2, vs * 2, (vs + vc) * 2);
        this.S.copyWithin(vw, vs, vs + vc);
      }
      const shift = vs - vw;
      for (let k = 0; k < ic; k++) this.I[iw + k] = this.I[is + k] - shift;
      this.vStart[w] = vw;
      this.vCount[w] = vc;
      this.iStart[w] = iw;
      this.iCount[w] = ic;
      this.inst[w] = this.inst[it];
      this.dist[w] = this.dist[it];
      this.rad[w] = this.rad[it];
      this.vol[w] = this.vol[it];
      this.loc[w * 3] = this.loc[it * 3];
      this.loc[w * 3 + 1] = this.loc[it * 3 + 1];
      this.loc[w * 3 + 2] = this.loc[it * 3 + 2];
      this.dead[w] = 0;
      vw += vc;
      iw += ic;
      w++;
    }
    this.count = w;
    this.vEnd = vw;
    this.iEnd = iw;
    this.deadVerts = 0;
    if (vw > 0) this.upload(0, vw, 0, iw);
    this.geometry.setDrawRange(0, iw);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.outlineMat.dispose();
  }
}

