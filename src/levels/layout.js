// Seeded, deterministic object placement helpers used by the level layout scripts.
// A layout produces a flat list of placements { id, x, y, z, yaw, scale, tint, on }.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Layout {
  constructor(lib, seed, bounds) {
    this.lib = lib;
    this.rand = mulberry32(seed);
    this.items = [];
    this.bounds = bounds; // {minX,maxX,minZ,maxZ}
    this.blockers = []; // {x,z,r} areas kept clear (e.g. spawn point)
    this.missing = new Set();
    this.hash = new Map(); // spatial hash of placed items for overlap tests
    this.hcell = Math.max(1e-3, (bounds.maxX - bounds.minX) / 160);
    this.maxR = 0;
    this.paint = []; // (streetBuilder) => void: extra street-surface pieces (driveways, parking, plazas)
    this.life = null; // movers for the life system (traffic, pedestrians, animals, ...)
  }

  /** cell size for the overlap hash; set once from the level's scale before placing */
  setCell(c) {
    this.hcell = c;
    this.hash.clear();
    for (const it of this.items) this.index(it);
  }

  index(it) {
    const k = Math.floor(it.x / this.hcell) + ',' + Math.floor(it.z / this.hcell);
    let a = this.hash.get(k);
    if (!a) this.hash.set(k, (a = []));
    a.push(it);
    if (it.r > this.maxR) this.maxR = it.r;
  }

  has(id) {
    return this.lib.byId.has(id);
  }

  range(a, b) {
    return a + (b - a) * this.rand();
  }

  pick(arr) {
    return arr[Math.floor(this.rand() * arr.length)];
  }

  footprint(id, scale = 1) {
    const t = this.lib.byId.get(id);
    return (Math.max(t.dims[0], t.dims[2]) / 2) * scale;
  }

  height(id, scale = 1) {
    return this.lib.byId.get(id).dims[1] * scale;
  }

  clear(x, z, r) {
    this.blockers.push({ x, z, r });
  }

  fits(x, z, r, y = 0, pad = 0.15) {
    const b = this.bounds;
    if (x - r < b.minX || x + r > b.maxX || z - r < b.minZ || z + r > b.maxZ) return false;
    for (const c of this.blockers) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) return false;
    const reach = r + this.maxR * (1 + pad);
    const c = this.hcell;
    const x0 = Math.floor((x - reach) / c),
      x1 = Math.floor((x + reach) / c);
    const z0 = Math.floor((z - reach) / c),
      z1 = Math.floor((z + reach) / c);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > this.items.length + 64) {
      for (const it of this.items) if (this.overlaps(it, x, z, r, y, pad)) return false;
      return true;
    }
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const a = this.hash.get(cx + ',' + cz);
        if (a) for (const it of a) if (this.overlaps(it, x, z, r, y, pad)) return false;
      }
    return true;
  }

  overlaps(it, x, z, r, y, pad) {
    if (Math.abs(it.y - y) > 1e-3) return false;
    const rr = r + it.r + Math.min(r, it.r) * pad;
    return (x - it.x) ** 2 + (z - it.z) ** 2 < rr * rr;
  }

  /** Yaw that lines an object's longest horizontal axis up with direction `dir` (radians, like yaw). */
  along(id, dir) {
    const t = this.lib.byId.get(id);
    if (!t) return dir;
    return t.dims[0] > t.dims[2] ? dir - Math.PI / 2 : dir;
  }

  /** Place one object exactly. Returns its placement or null when the type isn't built. */
  put(id, x, z, opts = {}) {
    if (!this.has(id)) {
      this.missing.add(id);
      return null;
    }
    const t = this.lib.byId.get(id);
    const scale = opts.scale ?? 1;
    const it = {
      id,
      x,
      y: opts.y ?? 0,
      z,
      yaw: opts.yaw ?? this.rand() * Math.PI * 2,
      scale,
      tint: opts.tint ?? this.variant(t),
      r: this.footprint(id, scale),
      on: opts.on,
    };
    this.items.push(it);
    this.index(it);
    return it;
  }

  variant(t) {
    if (!t.variants || !t.variants.length) return null;
    const r = this.rand();
    return r < 0.35 ? null : t.variants[Math.floor(this.rand() * t.variants.length)];
  }

  /** Place an object resting on top of another placement. */
  putOn(base, id, dx = 0, dz = 0, opts = {}) {
    if (!base) return null;
    const y = base.y + this.height(base.id, base.scale);
    return this.put(id, base.x + dx, base.z + dz, { ...opts, y, on: base });
  }

  /**
   * Scatter `count` objects inside a region.
   * region: { x, z, r } circle or { minX, maxX, minZ, maxZ } rect
   */
  scatter(id, count, region, opts = {}) {
    if (!this.has(id)) {
      this.missing.add(id);
      return [];
    }
    const out = [];
    for (let k = 0; k < count; k++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        let x, z;
        if (region.r !== undefined) {
          const a = this.rand() * Math.PI * 2;
          const d = Math.sqrt(this.rand()) * region.r;
          x = region.x + Math.cos(a) * d;
          z = region.z + Math.sin(a) * d;
        } else {
          x = this.range(region.minX, region.maxX);
          z = this.range(region.minZ, region.maxZ);
        }
        const s = opts.scaleRange ? this.range(opts.scaleRange[0], opts.scaleRange[1]) : opts.scale ?? 1;
        const r = this.footprint(id, s);
        if (!this.fits(x, z, r, opts.y ?? 0, opts.pad ?? 0.15)) continue;
        out.push(this.put(id, x, z, { ...opts, scale: s }));
        break;
      }
    }
    return out;
  }

  /** Scatter by a weighted table: [[id, count], ...]. */
  scatterTable(table, region, opts = {}) {
    for (const [id, count] of table) this.scatter(id, count, region, opts);
  }

  /**
   * Buildings along a frontage from (x0,z0) to (x1,z1), each facing `yaw`, spaced by their own
   * widths + gap. ids: array (random pick per slot).
   */
  row(ids, x0, z0, x1, z1, yaw, gap = 2, opts = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ux = (x1 - x0) / len,
      uz = (z1 - z0) / len;
    let d = 0;
    const out = [];
    while (d < len) {
      const id = this.pick(ids);
      if (!this.has(id)) {
        this.missing.add(id);
        d += 10;
        continue;
      }
      const t = this.lib.byId.get(id);
      const s = opts.scaleRange ? this.range(opts.scaleRange[0], opts.scaleRange[1]) : 1;
      // width along the row: the object's local x extent (it faces yaw, so its x axis runs along the row)
      const w = t.dims[0] * s;
      if (d + w > len) break;
      const c = d + w / 2;
      out.push(this.put(id, x0 + ux * c, z0 + uz * c, { ...opts, yaw, scale: s }));
      d += w + gap;
    }
    return out;
  }

  /** A line of objects (ant trails, fences, cars on a road). */
  line(id, x0, z0, x1, z1, count, opts = {}) {
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let k = 0; k < count; k++) {
      const t = count === 1 ? 0.5 : k / (count - 1);
      const j = opts.jitter ?? 0;
      this.put(id, x0 + (x1 - x0) * t + this.range(-j, j), z0 + (z1 - z0) * t + this.range(-j, j), {
        ...opts,
        yaw: (opts.yaw ?? yaw) + this.range(-0.15, 0.15),
      });
    }
  }
}
