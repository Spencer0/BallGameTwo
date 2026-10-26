// Level 4 — Cul-de-Sac: the Maple Loop neighbourhood. A network of streets ending in turning
// circles, a park, a school field, lots along every road. 480 x 480 m.
import { Layout } from './layout.js';
import { roadPlanes, lotsAlong, streetFurniture } from './streets.js';

const S = 240; // half size
const ROAD = 9;
const ROADS = [
  { x0: 0, z0: -230, x1: 0, z1: 150 }, // Maple Loop (main street) -> turning circle north
  { x0: -230, z0: -150, x1: 230, z1: -150 },
  { x0: -230, z0: -20, x1: 230, z1: -20 },
  { x0: -150, z0: 100, x1: 150, z1: 100 },
  { x0: -150, z0: -230, x1: -150, z1: 100 },
  { x0: 150, z0: -230, x1: 150, z1: 100 },
  { x0: 75, z0: -20, x1: 75, z1: 55 }, // spur -> circle
  { x0: -75, z0: -150, x1: -75, z1: -80 }, // spur -> circle
];
const CIRCLES = [
  { x: 0, z: 165, r: 16 },
  { x: 75, z: 70, r: 15 },
  { x: -75, z: -65, r: 15 },
];
const PARK = { minX: -232, maxX: -160, minZ: -232, maxZ: -160 };
const SCHOOL = { minX: 160, maxX: 232, minZ: -232, maxZ: -160 };

export const env = {
  sky: [
    [0, 'sky'],
    [0.62, '#A9DDF8'],
    [1, 'butter'],
  ],
  fog: { near: 160, far: 420, k: 70, color: '#D9EEF0' },
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: 3000, d: 3000, y: -0.05, pattern: 'lawn', a: 'leaf', b: '#47B064', cell: 14 },
    { x: 0, z: 0, w: 2 * S, d: 2 * S, y: -0.03, pattern: 'lawn', a: 'lime', b: '#8DCE47', cell: 6 },
    ...roadPlanes(ROADS, ROAD),
    ...CIRCLES.flatMap((c) => [
      { x: c.x, z: c.z, r: c.r + 3.5, y: -0.018, pattern: 'tiles', a: 'cloud', b: '#E6E9F1', c: 'stone', cell: 1.6 },
      { x: c.x, z: c.z, r: c.r, y: 0.001, pattern: 'solid', a: 'charcoal' },
      { x: c.x, z: c.z, r: 5.5, y: 0.004, pattern: 'solid', a: 'lime' },
    ]),
    { x: (PARK.minX + PARK.maxX) / 2, z: (PARK.minZ + PARK.maxZ) / 2, w: 72, d: 72, y: -0.01, pattern: 'lawn', a: '#7FCB4E', b: 'lime', cell: 4 },
    { x: -196, z: -196, r: 12, y: -0.005, pattern: 'solid', a: 'sand' },
    { x: (SCHOOL.minX + SCHOOL.maxX) / 2, z: (SCHOOL.minZ + SCHOOL.maxZ) / 2, w: 72, d: 72, y: -0.01, pattern: 'lawn', a: 'leaf', b: 'lime', cell: 8 },
    { x: 196, z: -196, w: 40, d: 26, y: -0.005, pattern: 'tiles', a: 'tomato', b: '#E25A47', c: 'paper', cell: 13 },
  ],
  blocks: [
    { min: [-S - 10, -1, -S - 10], max: [S + 10, 600, -S], visible: false },
    { min: [-S - 10, -1, S], max: [S + 10, 600, S + 10], visible: false },
    { min: [-S - 10, -1, -S], max: [-S, 600, S], visible: false },
    { min: [S, -1, -S], max: [S + 10, 600, S], visible: false },
  ],
};

// a giant Madame Prudence peers over the end of the street
env.decor = [{ id: 'char__prudence', x: 20, y: 0, z: 285, yaw: Math.PI + 0.15, scale: 22, size: 60 }];

export const bounds = { minX: -S, maxX: S, minZ: -S, maxZ: S };
export const spawn = { x: 0, z: 140, yaw: Math.PI };

/** one suburban lot; side = +1 (east of the road, faces west) or -1 */
function lot(L, cx, cz, yaw, rand) {
  const house = L.pick(['house_a', 'house_b', 'house_c']);
  const fx = Math.sin(yaw),
    fz = Math.cos(yaw); // front direction
  const rx = Math.cos(yaw),
    rz = -Math.sin(yaw); // right
  const at = (f, r) => [cx + fx * f + rx * r, cz + fz * f + rz * r];
  const p = (id, f, r, o = {}) => {
    const [x, z] = at(f, r);
    return L.put(id, x, z, { yaw: yaw + (o.turn ?? 0), ...o });
  };
  p(house, 0, 0);
  // driveway + car + garage
  const side = rand() < 0.5 ? -1 : 1;
  if (rand() < 0.5) p('garage', -1, side * 9.5);
  const carId = L.pick(['car', 'car', 'pickup_truck', 'car']);
  p(carId, 9, side * 8.5, { turn: L.along(carId, 0) + Math.PI * (rand() < 0.5 ? 0 : 1) });
  p('mailbox', 15.5, -side * 6);
  p('wheelie_bin', 15.2, side * 6.2);
  // front garden
  for (let k = -2; k <= 2; k++) if (k !== side * 2) p('picket_fence', 14.5, k * 2.6, { turn: Math.PI / 2 });
  p(L.pick(['tree_round', 'bush', 'tree_round']), 11, -side * 7);
  p('bush', 6.5, -side * 4);
  p('bush', 6.5, -side * 2);
  if (rand() < 0.5) p(L.pick(['garden_gnome', 'flamingo_ornament', 'sunflower']), 9, -side * 3);
  if (rand() < 0.4) p(L.pick(['person_adult', 'person_adult2', 'person_grandpa']), 10, -side * 1);
  // back yard
  const back = [['trampoline', 'swing_set', 'above_ground_pool', 'garden_shed', 'picnic_table'], ['kiddie_pool', 'bbq_grill', 'doghouse', 'pingpong_table']];
  p(L.pick(back[0]), -13, side * 5);
  p(L.pick(back[1]), -12, -side * 6);
  if (rand() < 0.25) p('treehouse', -16, -side * 1);
  if (rand() < 0.6) p('dog', -9, -side * 2);
  if (rand() < 0.5) p(L.pick(['person_kid', 'tricycle', 'bicycle']), -10, side * 1);
  p('hedge', -19, -4);
  p('hedge', -19, 0);
  p('hedge', -19, 4);
}

export function layout(lib, seed = 404) {
  const L = new Layout(lib, seed, { minX: -S + 2, maxX: S - 2, minZ: -S + 2, maxZ: S - 2 });
  const rand = L.rand;
  L.clear(spawn.x, spawn.z, 8);
  const avoid = [...CIRCLES.map((c) => ({ x: c.x, z: c.z, r: c.r + 8 })), { x: -196, z: -196, r: 52 }, { x: 196, z: -196, r: 52 }];
  lotsAlong(L, ROADS, { spacing: 24, setback: 27, radius: 13, bounds, avoid, lotFn: (L2, x, z, yaw) => lot(L2, x, z, yaw, rand) });
  // houses around each turning circle
  for (const c of CIRCLES)
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      const dir = c.z > 0 ? 1 : -1;
      const x = c.x + Math.sin(a) * (c.r + 24),
        z = c.z + dir * Math.cos(a) * (c.r + 24);
      if (Math.abs(x) > S - 14 || Math.abs(z) > S - 14) continue;
      lot(L, x, z, Math.atan2(c.x - x, c.z - z), rand);
    }
  for (const c of CIRCLES) L.put('tree_round', c.x, c.z, { scale: 1.1 });
  streetFurniture(L, ROADS, ROAD, { lampEvery: 22, parked: 0.3, vehicles: ['car', 'car', 'pickup_truck', 'motorcycle', 'delivery_van'] });
  // traffic: a few big vehicles on the roads
  L.put('school_bus', 196, -175, { yaw: L.along('school_bus', Math.PI / 2) });
  L.put('school_bus', 2.4, -100, { yaw: L.along('school_bus', 0) });
  L.put('garbage_truck', 60, -17.6, { yaw: L.along('garbage_truck', Math.PI / 2) });
  L.put('garbage_truck', -2.4, 40, { yaw: L.along('garbage_truck', Math.PI) });
  L.put('ice_cream_van', -190, -164, { yaw: L.along('ice_cream_van', Math.PI / 2) });
  L.put('delivery_van', 147.6, 20, { yaw: L.along('delivery_van', 0) });
  L.put('dumpster', -14, -40, { yaw: Math.PI / 2 });
  L.put('bus_stop', 30, -13.5, { yaw: Math.PI });
  L.put('phone_booth', 40, -13.6, { yaw: Math.PI });
  L.line('traffic_cone', 1.5, -60, 1.5, -75, 6);
  L.put('stop_sign', 6.3, -14.5, { yaw: Math.PI });
  L.put('stop_sign', -6.3, -145.5, { yaw: 0 });
  // people, dogs and bikes on the pavements of the main street
  L.scatterTable(
    [
      ['person_adult', 10],
      ['person_adult2', 10],
      ['person_kid', 8],
      ['person_grandpa', 4],
      ['dog', 8],
      ['bicycle', 5],
    ],
    { minX: -7.5, maxX: 7.5, minZ: -225, maxZ: 145 },
    { pad: 1 },
  );
  // the park
  L.put('lemonade_stand', -168, -168, { yaw: Math.PI });
  L.put('playground_slide', -200, -190, { yaw: 0.6 });
  L.put('swing_set', -186, -212, { yaw: 0 });
  L.put('trampoline', -214, -176);
  L.put('hot_air_balloon', -196, -196, { y: 38 });
  L.put('hot_air_balloon', 120, 60, { y: 52, scale: 0.9 });
  L.put('hot_air_balloon', -90, 40, { y: 70, scale: 1.1 });
  L.scatterTable(
    [
      ['park_bench', 8],
      ['picnic_table', 6],
      ['tree_round', 14],
      ['pine_tree', 6],
      ['bush', 12],
      ['person_kid', 10],
      ['person_adult', 5],
      ['dog', 4],
      ['soccer_ball', 4],
      ['kite', 4],
      ['tricycle', 2],
    ],
    PARK,
    { pad: 1 },
  );
  // the school field
  L.put('basketball_hoop', 182, -208, { yaw: 0.2 });
  L.put('basketball_hoop', 210, -184, { yaw: Math.PI });
  L.scatterTable(
    [
      ['person_kid', 16],
      ['soccer_ball', 6],
      ['basketball', 4],
      ['swing_set', 2],
      ['playground_slide', 1],
      ['picnic_table', 3],
      ['tree_round', 6],
      ['bicycle', 6],
      ['traffic_cone', 8],
    ],
    SCHOOL,
    { pad: 1 },
  );
  // fringe forest around the edge
  for (let k = 0; k < 120; k++) {
    const t = k / 120;
    const edge = k % 4;
    const u = -S + 4 + ((t * 4) % 1) * (2 * S - 8);
    const [x, z] = edge === 0 ? [u, -S + 5] : edge === 1 ? [u, S - 5] : edge === 2 ? [-S + 5, u] : [S - 5, u];
    L.put(k % 3 ? 'pine_tree' : 'tree_round', x + L.range(-2, 2), z + L.range(-2, 2), { scale: L.range(0.9, 1.25) });
  }
  return L;
}
