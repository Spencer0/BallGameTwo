// Level 4 — Cul-de-Sac: Maple Loop. A suburban street ending in a turning circle, a cross street,
// a little park. 240 x 240 m.
import { Layout } from './layout.js';

const S = 120; // half size
const ROAD = 9;

export const env = {
  sky: [
    [0, 'sky'],
    [0.62, '#A9DDF8'],
    [1, 'butter'],
  ],
  fog: { near: 120, far: 330, k: 70, color: '#D9EEF0' },
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: 1400, d: 1400, y: -0.05, pattern: 'lawn', a: 'leaf', b: '#47B064', cell: 14 },
    { x: 0, z: 0, w: 2 * S, d: 2 * S, y: -0.03, pattern: 'lawn', a: 'lime', b: '#8DCE47', cell: 6 },
    // sidewalks
    { x: 0, z: -35, w: ROAD + 6, d: 170, y: -0.02, pattern: 'tiles', a: 'cloud', b: '#E6E9F1', c: 'stone', cell: 1.6 },
    { x: 0, z: -60, w: 2 * S, d: ROAD + 6, y: -0.019, pattern: 'tiles', a: 'cloud', b: '#E6E9F1', c: 'stone', cell: 1.6 },
    { x: 0, z: 55, r: 19.5, y: -0.018, pattern: 'tiles', a: 'cloud', b: '#E6E9F1', c: 'stone', cell: 1.6 },
    // roads
    { x: 0, z: -35, w: ROAD, d: 170, y: 0, pattern: 'roadz', a: 'charcoal', b: 'paper', cell: ROAD, offset: [0, 35] },
    { x: 0, z: -60, w: 2 * S, d: ROAD, y: 0.002, pattern: 'roadx', a: 'charcoal', b: 'paper', cell: ROAD, offset: [0, 60] },
    { x: 0, z: 55, r: 16, y: 0.001, pattern: 'solid', a: 'charcoal' },
    { x: 0, z: 55, r: 5.5, y: 0.004, pattern: 'solid', a: 'lime' },
    // park
    { x: -75, z: -95, w: 80, d: 40, y: -0.01, pattern: 'lawn', a: '#7FCB4E', b: 'lime', cell: 4 },
    { x: -80, z: -95, r: 10, y: -0.005, pattern: 'solid', a: 'sand' },
  ],
  blocks: [
    { min: [-S - 10, -1, -S - 10], max: [S + 10, 300, -S], visible: false },
    { min: [-S - 10, -1, S], max: [S + 10, 300, S + 10], visible: false },
    { min: [-S - 10, -1, -S], max: [-S, 300, S], visible: false },
    { min: [S, -1, -S], max: [S + 10, 300, S], visible: false },
  ],
};

export const bounds = { minX: -S, maxX: S, minZ: -S, maxZ: S };
export const spawn = { x: 0, z: 38, yaw: Math.PI };

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
  L.clear(spawn.x, spawn.z, 6);
  // lots along the main road
  for (let z = -40; z <= 30; z += 23) {
    lot(L, 27, z, -Math.PI / 2, rand);
    lot(L, -27, z, Math.PI / 2, rand);
  }
  // lots around the turning circle
  for (const a of [-0.9, -0.3, 0.3, 0.9]) {
    const x = Math.sin(a) * 40,
      z = 55 + Math.cos(a) * 40;
    lot(L, x, z, Math.atan2(-x, 55 - z), rand);
  }
  // lots along the cross street (the park takes the south-west corner)
  for (const x of [25, 50, 75, 100]) lot(L, x, -88, 0, rand);
  for (const x of [-100, -75, -50, 50, 75, 100]) lot(L, x, -32, Math.PI, rand);
  // the island tree in the circle
  L.put('tree_round', 0, 55, { scale: 1.1 });
  // street furniture
  for (let z = -105; z <= 40; z += 18) {
    L.put('street_lamp', 6.2, z, { yaw: -Math.PI / 2 });
    L.put('street_lamp', -6.2, z + 9, { yaw: Math.PI / 2 });
    if ((z / 18) % 2 === 0) L.put('fire_hydrant', 6.4, z + 4, { yaw: -Math.PI / 2 });
  }
  for (let x = -110; x <= 110; x += 22) {
    if (Math.abs(x) < 10) continue;
    L.put('street_lamp', x, -53.8, { yaw: Math.PI });
    L.put('street_lamp', x + 11, -66.2, { yaw: 0 });
  }
  L.put('stop_sign', 6.3, -54.5, { yaw: Math.PI });
  L.put('stop_sign', -6.3, -65.5, { yaw: 0 });
  L.put('bus_stop', 30, -53.5, { yaw: Math.PI });
  L.put('phone_booth', 37, -53.6, { yaw: Math.PI });
  L.put('school_bus', 40, -62, { yaw: L.along('school_bus', Math.PI / 2) });
  L.put('garbage_truck', 2.2, -20, { yaw: L.along('garbage_truck', Math.PI) });
  L.put('ice_cream_van', -55, -66, { yaw: L.along('ice_cream_van', -Math.PI / 2) });
  L.put('delivery_van', -2.2, 10, { yaw: L.along('delivery_van', 0) });
  L.line('traffic_cone', 1.5, -30, 1.5, -40, 5);
  L.put('dumpster', -14, -40, { yaw: Math.PI / 2 });
  // cars parked along the street
  for (let k = 0; k < 10; k++) {
    const id = L.pick(['car', 'car', 'pickup_truck', 'motorcycle']);
    L.put(id, k % 2 ? 3.2 : -3.2, -100 + k * 13 + L.range(-2, 2), { yaw: L.along(id, k % 2 ? 0 : Math.PI) });
  }
  for (let k = 0; k < 8; k++) {
    const id = L.pick(['car', 'delivery_van', 'car', 'motorcycle']);
    L.put(id, -100 + k * 26, -60 + (k % 2 ? 2.4 : -2.4), { yaw: L.along(id, k % 2 ? Math.PI / 2 : -Math.PI / 2) });
  }
  // people on sidewalks, dogs, bikes
  L.scatterTable(
    [
      ['person_adult', 8],
      ['person_adult2', 8],
      ['person_kid', 6],
      ['person_grandpa', 3],
      ['dog', 6],
      ['bicycle', 4],
      ['traffic_cone', 4],
      ['wheelie_bin', 3],
    ],
    { minX: -7.5, maxX: 7.5, minZ: -110, maxZ: 40 },
    { pad: 1 },
  );
  // the park
  const park = { minX: -112, maxX: -38, minZ: -113, maxZ: -78 };
  L.put('lemonade_stand', -45, -80, { yaw: Math.PI });
  L.put('playground_slide', -80, -95, { yaw: 0.6 });
  L.put('swing_set', -72, -102, { yaw: 0 });
  L.put('trampoline', -95, -88);
  L.put('basketball_hoop', -100, -104, { yaw: 0.5 });
  L.put('hot_air_balloon', -70, -95, { y: 34 });
  L.put('hot_air_balloon', 60, 20, { y: 48, scale: 0.9 });
  L.scatterTable(
    [
      ['park_bench', 6],
      ['picnic_table', 5],
      ['tree_round', 10],
      ['pine_tree', 4],
      ['bush', 10],
      ['person_kid', 8],
      ['person_adult', 4],
      ['dog', 3],
      ['soccer_ball', 4],
      ['kite', 4],
      ['tricycle', 2],
      ['bicycle', 3],
      ['flamingo_ornament', 2],
      ['garden_gnome', 2],
    ],
    park,
    { pad: 1 },
  );
  // fringe forest
  for (let k = 0; k < 70; k++) {
    const t = k / 70;
    const edge = k % 4;
    const u = -S + 4 + ((t * 4) % 1) * (2 * S - 8);
    const [x, z] = edge === 0 ? [u, -S + 5] : edge === 1 ? [u, S - 5] : edge === 2 ? [-S + 5, u] : [S - 5, u];
    L.put(k % 3 ? 'pine_tree' : 'tree_round', x + L.range(-2, 2), z + L.range(-2, 2), { scale: L.range(0.9, 1.25) });
  }
  // lawn clutter everywhere
  L.scatterTable(
    [
      ['garden_gnome', 10],
      ['flamingo_ornament', 8],
      ['sunflower', 12],
      ['watering_can', 6],
      ['lawn_mower', 4],
      ['wheelbarrow', 3],
      ['hose_reel', 4],
      ['soccer_ball', 6],
      ['basketball', 4],
      ['skateboard', 4],
      ['tricycle', 4],
      ['bush', 20],
      ['traffic_cone', 4],
      ['laundry_basket', 2],
      ['beanbag', 2],
      ['umbrella', 3],
    ],
    { minX: -S + 8, maxX: S - 8, minZ: -S + 8, maxZ: S - 8 },
    { pad: 1.5 },
  );
  return L;
}
