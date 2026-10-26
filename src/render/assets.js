// Loads the Blender-built GLB packs and converts every mesh into the game's geometry format:
//   position (f32x3), normal (f32x3), aPal (u8x2: palette index, tint flag), aOutN (f32x3, welded
//   smooth normals for inverted-hull outlines), index.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const v3 = new THREE.Vector3();
const n3 = new THREE.Matrix3();

export const ASSET_BASE = { url: 'assets/', packs: 'packs/' };

/** meshopt needs WebAssembly; some locked-down hosts forbid compiling it. Probe once. */
export async function chooseCompression() {
  try {
    // smallest valid module: magic + version
    const mod = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
    await WebAssembly.instantiate(mod);
    await MeshoptDecoder.ready;
    ASSET_BASE.packs = 'packs/';
  } catch {
    ASSET_BASE.packs = 'packs_q/';
  }
  return ASSET_BASE.packs;
}

/** catalog entry + runtime data */
export class ObjType {
  constructor(meta, idx) {
    Object.assign(this, meta);
    this.idx = idx;
    this.geo = [null, null]; // LOD0, LOD1
    this.bound = 0.5 * Math.hypot(meta.dims[0], meta.dims[1], meta.dims[2]);
    this.isCreature = meta.flags.includes('creature');
    this.floats = meta.flags.includes('float');
  }
}

export function convertMesh(mesh) {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const col = g.attributes.color;
  const n = pos.count;
  const P = new Float32Array(n * 3);
  const N = new Float32Array(n * 3);
  const A = new Uint8Array(n * 2);
  n3.getNormalMatrix(mesh.matrixWorld);
  for (let i = 0; i < n; i++) {
    v3.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    P[i * 3] = v3.x;
    P[i * 3 + 1] = v3.y;
    P[i * 3 + 2] = v3.z;
    v3.fromBufferAttribute(nor, i).applyMatrix3(n3).normalize();
    N[i * 3] = v3.x;
    N[i * 3 + 1] = v3.y;
    N[i * 3 + 2] = v3.z;
    if (col) {
      A[i * 2] = Math.round(col.getX(i) * 255);
      A[i * 2 + 1] = col.getY(i) > 0.5 ? 1 : 0;
    }
  }
  // welded smooth normals for the outline hull
  const O = new Float32Array(n * 3);
  const map = new Map();
  const q = 1e5;
  const keys = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(P[i * 3] * q)},${Math.round(P[i * 3 + 1] * q)},${Math.round(P[i * 3 + 2] * q)}`;
    keys[i] = k;
    let acc = map.get(k);
    if (!acc) map.set(k, (acc = [0, 0, 0]));
    acc[0] += N[i * 3];
    acc[1] += N[i * 3 + 1];
    acc[2] += N[i * 3 + 2];
  }
  for (let i = 0; i < n; i++) {
    const acc = map.get(keys[i]);
    const l = Math.hypot(acc[0], acc[1], acc[2]) || 1;
    O[i * 3] = acc[0] / l;
    O[i * 3 + 1] = acc[1] / l;
    O[i * 3 + 2] = acc[2] / l;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('aPal', new THREE.BufferAttribute(A, 2));
  out.setAttribute('aOutN', new THREE.BufferAttribute(O, 3));
  if (g.index) {
    const src = g.index.array;
    const idx = n > 65535 ? new Uint32Array(src.length) : new Uint16Array(src.length);
    idx.set(src);
    out.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

export class AssetLibrary {
  constructor() {
    this.types = [];
    this.byId = new Map();
    this.loadedPacks = new Set();
    this.sets = new Map(); // static set meshes by name
  }

  async loadCatalog() {
    const res = await fetch(ASSET_BASE.url + 'catalog.json');
    if (!res.ok) throw new Error('catalog ' + res.status);
    const list = await res.json();
    list.forEach((m) => {
      const t = new ObjType(m, this.types.length);
      this.types.push(t);
      this.byId.set(m.id, t);
    });
  }

  loadPack(name) {
    if (this.loadedPacks.has(name)) return Promise.resolve();
    if (!this.inflight) this.inflight = new Map();
    if (!this.inflight.has(name)) {
      const p = this._loadPack(name).finally(() => this.inflight.delete(name));
      this.inflight.set(name, p);
    }
    return this.inflight.get(name);
  }

  async _loadPack(name) {
    const gltf = await loader.loadAsync(ASSET_BASE.url + ASSET_BASE.packs + name + '.glb');
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.name;
      const lod1 = name.endsWith('__lod1');
      const id = lod1 ? name.slice(0, -6) : name;
      const geo = convertMesh(o);
      if (id.startsWith('set__') || id.startsWith('char__')) {
        this.sets.set(name, geo);
      } else {
        const t = this.byId.get(id);
        if (t) t.geo[lod1 ? 1 : 0] = geo;
      }
      o.geometry.dispose();
    });
    this.loadedPacks.add(name);
  }

  get(id) {
    const t = this.byId.get(id);
    if (!t) throw new Error('unknown object type ' + id);
    return t;
  }
}
