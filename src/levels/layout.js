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
    for (const it of this.items) {
      if (Math.abs(it.y - y) > 1e-3) continue;
      const rr = r + it.r + Math.min(r, it.r) * pad;
      if ((x - it.x) ** 2 + (z - it.z) ** 2 < rr * rr) return false;
    }
    return true;
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
