// Level 5 — Small Town: Puddleford. Town grid + plaza, farmland west, harbour south-east,
// fairground north-east, a railway across the north. 900 x 900 m.
import { Layout } from './layout.js';

const S = 450;
const RW = 14; // road width
const GRID = [-150, -75, 0, 75, 150];

const roads = [];
for (const g of GRID) {
  roads.push({ x: 0, z: g, w: 2 * 190, d: RW, y: 0.002, pattern: 'roadx', a: 'charcoal', b: 'paper', cell: RW, offset: [0, -g] });
  roads.push({ x: g, z: 0, w: RW, d: 2 * 190, y: 0.001, pattern: 'roadz', a: 'charcoal', b: 'paper', cell: RW, offset: [-g, 0] });
}

export const env = {
  sky: [
    [0, 'tangerine'],
    [0.55, '#FFC27A'],
    [1, 'butter'],
  ],
  fog: { near: 300, far: 800, k: 75, color: '#FFE0A8' },
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: 6000, d: 6000, y: -0.4, pattern: 'lawn', a: 'leaf', b: '#47B064', cell: 40 },
    { x: 0, z: 0, w: 2 * S, d: 2 * S, y: -0.3, pattern: 'lawn', a: 'lime', b: '#8DCE47', cell: 18 },
    // town base + plaza
    { x: 0, z: 0, w: 390, d: 390, y: -0.2, pattern: 'tiles', a: 'cloud', b: '#E6E9F1', c: 'stone', cell: 6 },
    ...roads,
    { x: 37.5, z: 37.5, w: 60, d: 60, y: 0.004, pattern: 'tiles', a: 'sand', b: '#F2D9AE', c: 'caramel', cell: 5 },
    // farm fields
    { x: -330, z: -120, w: 170, d: 150, y: -0.1, pattern: 'lawn', a: 'sun', b: 'butter', cell: 6 },
    { x: -330, z: 70, w: 170, d: 150, y: -0.1, pattern: 'lawn', a: 'leaf', b: 'lime', cell: 6, rot: Math.PI / 2 },
    { x: -330, z: 260, w: 170, d: 140, y: -0.1, pattern: 'lawn', a: 'caramel', b: 'sand', cell: 6 },
    // harbour water
    { x: 330, z: 330, w: 260, d: 260, y: -0.05, pattern: 'water', a: 'teal', b: '#4FCBBE', cell: 10 },
    { x: 330, z: 205, w: 260, d: 14, y: 0.01, pattern: 'boards', a: 'caramel', b: 'sand', c: 'cocoa', cell: 3 },
    // fairground
    { x: 300, z: -300, w: 220, d: 220, y: -0.1, pattern: 'checks', a: 'sand', b: 'butter', cell: 16 },
    // railway
    { x: 0, z: -390, w: 2 * S, d: 10, y: -0.05, pattern: 'roadx', a: 'stone', b: 'cocoa', cell: 10, offset: [0, 390] },
  ],
  blocks: [
    { min: [-S - 20, -5, -S - 20], max: [S + 20, 2000, -S], visible: false },
    { min: [-S - 20, -5, S], max: [S + 20, 2000, S + 20], visible: false },
    { min: [-S - 20, -5, -S], max: [-S, 2000, S], visible: false },
    { min: [S, -5, -S], max: [S + 20, 2000, S], visible: false },
  ],
};

export const bounds = { minX: -S, maxX: S, minZ: -S, maxZ: S };
export const spawn = { x: 37.5, z: 60, yaw: Math.PI };

const SHOPS = ['shop_a', 'shop_b', 'cafe', 'bakery', 'shop_a', 'shop_b'];
const HOUSES = ['house_a', 'house_b', 'house_c'];

export function layout(lib, seed = 505) {
  const L = new Layout(lib, seed, { minX: -S + 5, maxX: S - 5, minZ: -S + 5, maxZ: S - 5 });
  L.clear(spawn.x, spawn.z, 18);
  // ---- the plaza (block x[7,68] z[7,68])
  L.put('town_fountain', 37.5, 37.5);
  L.put('church', 37.5, 14, { yaw: 0 });
  L.put('statue', 18, 50, { yaw: 2.2 });
  L.put('gazebo', 58, 52);
  L.put('clock_tower', 60, 16, { yaw: 0 });
  // ---- town blocks: buildings along each block's four frontages
  for (let bx = 0; bx < GRID.length - 1; bx++) {
    for (let bz = 0; bz < GRID.length - 1; bz++) {
      const x0 = GRID[bx] + RW / 2 + 3,
        x1 = GRID[bx + 1] - RW / 2 - 3;
      const z0 = GRID[bz] + RW / 2 + 3,
        z1 = GRID[bz + 1] - RW / 2 - 3;
      if (bx === 2 && bz === 2) continue; // plaza
      const central = Math.abs(GRID[bx] + 37.5) < 80 && Math.abs(GRID[bz] + 37.5) < 80;
      const kinds = central ? SHOPS : [...HOUSES, 'apartment_block'];
      const inset = 7;
      L.row(kinds, x0 + 2, z0 + inset, x1 - 2, z0 + inset, Math.PI, 3); // faces -z street
      L.row(kinds, x0 + 2, z1 - inset, x1 - 2, z1 - inset, 0, 3); // faces +z street
      L.row(kinds, x0 + inset, z0 + 18, x0 + inset, z1 - 18, -Math.PI / 2, 3);
      L.row(kinds, x1 - inset, z0 + 18, x1 - inset, z1 - 18, Math.PI / 2, 3);
      // backyards / courtyards
      L.scatterTable(
        [
          ['tree_round', 3],
          ['garden_shed', 1],
          ['picnic_table', 1],
          ['trampoline', 1],
          ['car', 2],
          ['person_adult', 2],
          ['dog', 1],
        ],
        { minX: x0 + 20, maxX: x1 - 20, minZ: z0 + 20, maxZ: z1 - 20 },
        { pad: 0.5 },
      );
    }
  }
  L.put('petrol_station', -112, 112, { yaw: 0 });
  // ---- streets: cars, buses, lamps, people
  for (const g of GRID) {
    for (let t = -180; t <= 180; t += 30) {
      if (L.rand() < 0.55) L.put(L.pick(['car', 'car', 'pickup_truck', 'delivery_van', 'city_bus', 'motorcycle']), t + L.range(-6, 6), g + (L.rand() < 0.5 ? 3.5 : -3.5), { yaw: L.rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2 });
      if (L.rand() < 0.45) L.put(L.pick(['car', 'car', 'fire_truck', 'delivery_van', 'city_bus']), g + (L.rand() < 0.5 ? 3.5 : -3.5), t + L.range(-6, 6), { yaw: L.rand() < 0.5 ? 0 : Math.PI });
      L.put('street_lamp', t + 8, g + RW / 2 + 1.5, { yaw: Math.PI });
    }
  }
  L.scatterTable(
    [
      ['person_adult', 30],
      ['person_adult2', 30],
      ['person_kid', 20],
      ['person_grandpa', 12],
      ['dog', 12],
      ['bicycle', 12],
      ['park_bench', 16],
      ['bus_stop', 6],
      ['phone_booth', 6],
      ['wheelie_bin', 20],
      ['fire_hydrant', 20],
      ['mailbox', 12],
      ['traffic_cone', 16],
      ['billboard', 4],
      ['tree_round', 30],
    ],
    { minX: -185, maxX: 185, minZ: -185, maxZ: 185 },
    { pad: 0.6 },
  );
  // ---- farm (west)
  L.put('red_barn', -300, -20, { yaw: Math.PI / 2 });
  L.put('grain_silo', -280, -45);
  L.put('grain_silo', -268, -45, { scale: 0.85 });
  L.put('windmill', -400, 160, { yaw: 0.5 });
  L.put('water_tower', -240, 200);
  L.put('red_barn', -360, 350, { yaw: 0.3 });
  L.put('grain_silo', -330, 380);
  L.scatterTable(
    [
      ['cow', 26],
      ['sheep', 34],
      ['horse', 12],
      ['hay_bale', 40],
      ['tractor', 6],
      ['picket_fence', 30],
      ['tree_round', 16],
      ['pine_tree', 20],
      ['person_grandpa', 4],
      ['wheelbarrow', 4],
      ['garden_shed', 3],
      ['sunflower', 30],
    ],
    { minX: -440, maxX: -210, minZ: -440, maxZ: 440 },
    { pad: 1 },
  );
  // ---- harbour (south-east): boats on the water, lighthouse on the point
  L.put('lighthouse', 430, 430, { yaw: -2.3 });
  L.scatterTable(
    [
      ['sailboat', 14],
      ['fishing_boat', 10],
    ],
    { minX: 215, maxX: 445, minZ: 220, maxZ: 445 },
    { pad: 1.5 },
  );
  L.row(['shop_a', 'cafe', 'shop_b', 'bakery'], 210, 190, 445, 190, Math.PI, 4);
  L.scatterTable(
    [
      ['person_adult', 10],
      ['person_kid', 6],
      ['park_bench', 6],
      ['dumpster', 4],
      ['delivery_van', 3],
    ],
    { minX: 205, maxX: 445, minZ: 175, maxZ: 200 },
    { pad: 0.5 },
  );
  // ---- fairground (north-east)
  L.put('ferris_wheel', 330, -330, { yaw: -0.6 });
  L.put('circus_tent', 250, -240);
  L.put('carousel', 360, -230);
  L.put('hot_air_balloon', 280, -380, { y: 60 });
  L.put('hot_air_balloon', 160, -280, { y: 90, scale: 1.2 });
  L.scatterTable(
    [
      ['ice_cream_van', 3],
      ['lemonade_stand', 6],
      ['person_adult', 18],
      ['person_adult2', 18],
      ['person_kid', 24],
      ['park_bench', 8],
      ['traffic_cone', 10],
      ['trampoline', 3],
      ['playground_slide', 2],
      ['swing_set', 2],
      ['billboard', 2],
    ],
    { minX: 195, maxX: 410, minZ: -410, maxZ: -195 },
    { pad: 1 },
  );
  // ---- outskirts & railway
  L.put('radio_mast', 150, 380);
  L.put('water_tower', 380, 60);
  L.put('billboard', -200, 40, { yaw: Math.PI / 2 });
  L.put('billboard', 200, -40, { yaw: -Math.PI / 2 });
  L.put('locomotive', -60, -390, { yaw: Math.PI / 2 });
  for (let k = 1; k <= 5; k++) L.put('train_carriage', -60 - k * 17, -390, { yaw: Math.PI / 2 });
  L.put('locomotive', 220, -390, { yaw: -Math.PI / 2 });
  for (let k = 1; k <= 3; k++) L.put('train_carriage', 220 + k * 17, -390, { yaw: -Math.PI / 2 });
  for (const [x0, x1, z0, z1] of [
    [-200, 190, 200, 440],
    [-200, 190, -440, -200],
    [195, 445, -180, 160],
  ])
    L.scatterTable(
      [
        ['house_a', 6],
        ['house_b', 6],
        ['house_c', 6],
        ['garage', 4],
        ['tree_round', 26],
        ['pine_tree', 22],
        ['car', 10],
        ['pickup_truck', 4],
        ['swing_set', 3],
        ['above_ground_pool', 3],
        ['bush', 20],
        ['person_adult', 6],
        ['dog', 4],
        ['cow', 4],
      ],
      { minX: x0, maxX: x1, minZ: z0, maxZ: z1 },
      { pad: 0.8 },
    );
  return L;
}
