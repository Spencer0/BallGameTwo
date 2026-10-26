// Street networks for the outdoor levels: axis-aligned road segments, their ground planes, and
// helpers that fill both sides of every road with lots and street furniture.

/** roads: [{ x0, z0, x1, z1 }] axis-aligned. Returns env planes (sidewalk + asphalt with markings). */
export function roadPlanes(roads, width, { walk = 3, y = 0, walkColor = 'cloud' } = {}) {
  const planes = [];
  roads.forEach((r, k) => {
    const alongX = Math.abs(r.x1 - r.x0) > Math.abs(r.z1 - r.z0);
    const cx = (r.x0 + r.x1) / 2,
      cz = (r.z0 + r.z1) / 2;
    const len = alongX ? Math.abs(r.x1 - r.x0) : Math.abs(r.z1 - r.z0);
    const lift = y + 0.0005 * (k % 7);
    planes.push({
      x: cx,
      z: cz,
      w: alongX ? len + width : width + 2 * walk,
      d: alongX ? width + 2 * walk : len + width,
      y: lift - 0.01,
      pattern: 'tiles',
      a: walkColor,
      b: '#E6E9F1',
      c: 'stone',
      cell: Math.max(1.2, width / 6),
    });
    planes.push({
      x: cx,
      z: cz,
      w: alongX ? len + width : width,
      d: alongX ? width : len + width,
      y: lift,
      pattern: alongX ? 'roadx' : 'roadz',
      a: 'charcoal',
      b: 'paper',
      cell: width,
      offset: [-cx, -cz],
    });
  });
  return planes;
}

/** distance from a point to the nearest road centre line */
export function roadDist(roads, x, z) {
  let best = Infinity;
  for (const r of roads) {
    const minX = Math.min(r.x0, r.x1),
      maxX = Math.max(r.x0, r.x1),
      minZ = Math.min(r.z0, r.z1),
      maxZ = Math.max(r.z0, r.z1);
    const qx = Math.max(minX, Math.min(x, maxX)),
      qz = Math.max(minZ, Math.min(z, maxZ));
    best = Math.min(best, Math.hypot(x - qx, z - qz));
  }
  return best;
}

/**
 * Lots along both sides of every road. lotFn(L, cx, cz, yaw) builds one lot whose front faces
 * direction yaw (towards the road). Lots never overlap each other, other roads, or `avoid` circles.
 */
export function lotsAlong(L, roads, { spacing, setback, radius, lotFn, bounds, avoid = [], margin = 6 }) {
  const lots = [];
  const ok = (x, z) => {
    if (x - radius < bounds.minX || x + radius > bounds.maxX || z - radius < bounds.minZ || z + radius > bounds.maxZ) return false;
    if (roadDist(roads, x, z) < setback - 0.5) return false;
    for (const l of lots) if ((l.x - x) ** 2 + (l.z - z) ** 2 < (radius * 2 - 2) ** 2) return false;
    for (const a of avoid) if ((a.x - x) ** 2 + (a.z - z) ** 2 < (a.r + radius) ** 2) return false;
    return true;
  };
  for (const r of roads) {
    const alongX = Math.abs(r.x1 - r.x0) > Math.abs(r.z1 - r.z0);
    const len = alongX ? Math.abs(r.x1 - r.x0) : Math.abs(r.z1 - r.z0);
    const sx = Math.sign(r.x1 - r.x0) || 0,
      sz = Math.sign(r.z1 - r.z0) || 0;
    for (const side of [-1, 1]) {
      // normal pointing from the road to the lot
      const nx = alongX ? 0 : side,
        nz = alongX ? side : 0;
      for (let t = margin + spacing / 2; t < len - margin; t += spacing) {
        const x = r.x0 + sx * t + nx * setback,
          z = r.z0 + sz * t + nz * setback;
        if (!ok(x, z)) continue;
        lots.push({ x, z });
        lotFn(L, x, z, Math.atan2(-nx, -nz));
      }
    }
  }
  return lots;
}

/** lamps, hydrants and parked vehicles along roads */
export function streetFurniture(L, roads, width, { lampEvery = 20, parked = 0.35, vehicles = ['car'], hydrants = true } = {}) {
  for (const r of roads) {
    const alongX = Math.abs(r.x1 - r.x0) > Math.abs(r.z1 - r.z0);
    const len = alongX ? Math.abs(r.x1 - r.x0) : Math.abs(r.z1 - r.z0);
    const sx = Math.sign(r.x1 - r.x0) || 0,
      sz = Math.sign(r.z1 - r.z0) || 0;
    const roadYaw = Math.atan2(sx, sz);
    for (let t = lampEvery / 2; t < len; t += lampEvery) {
      const px = r.x0 + sx * t,
        pz = r.z0 + sz * t;
      const side = Math.floor(t / lampEvery) % 2 ? 1 : -1;
      const ox = alongX ? 0 : side * (width / 2 + 1.6),
        oz = alongX ? side * (width / 2 + 1.6) : 0;
      L.put('street_lamp', px + ox, pz + oz, { yaw: Math.atan2(-ox, -oz) });
      if (hydrants && L.rand() < 0.25) L.put('fire_hydrant', px + ox * 1.02 + (alongX ? 3 : 0), pz + oz * 1.02 + (alongX ? 0 : 3));
      if (L.rand() < parked) {
        const id = L.pick(vehicles);
        const lane = (L.rand() < 0.5 ? -1 : 1) * width * 0.3;
        L.put(id, px + (alongX ? 0 : lane) + (alongX ? lampEvery / 2 : 0), pz + (alongX ? lane : 0) + (alongX ? 0 : lampEvery / 2), {
          yaw: L.along(id, roadYaw + (lane > 0 ? 0 : Math.PI)),
        });
      }
    }
  }
}
