// Level 6 — The Big Tidy: the whole city. Downtown towers, port, airport, stadium, space centre,
// suburbs, and clouds overhead for the very end. 2.6 x 2.6 km.
import { Layout } from './layout.js';

const S = 1300;
const RW = 34;
const GRID = [-600, -400, -200, 0, 200, 400, 600];

const roads = [];
for (const g of GRID) {
  roads.push({ x: 0, z: g, w: 1500, d: RW, y: 0.02, pattern: 'roadx', a: 'charcoal', b: 'paper', cell: RW, offset: [0, -g] });
  roads.push({ x: g, z: 0, w: RW, d: 1500, y: 0.01, pattern: 'roadz', a: 'charcoal', b: 'paper', cell: RW, offset: [-g, 0] });
}

export const env = {
  sky: [
    [0, 'grape'],
    [0.42, 'flamingo'],
    [0.75, 'tangerine'],
    [1, 'butter'],
  ],
  fog: { near: 900, far: 2400, k: 70, color: '#FF9E7A' },
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: 20000, d: 20000, y: -2, pattern: 'lawn', a: 'pine', b: '#2A8A5E', cell: 120 },
    { x: 0, z: 0, w: 2 * S, d: 2 * S, y: -1.5, pattern: 'lawn', a: 'leaf', b: '#47B064', cell: 50 },
    { x: 0, z: 0, w: 1440, d: 1440, y: -1, pattern: 'tiles', a: '#7A7390', b: '#837C99', c: 'charcoal', cell: 25 },
    ...roads,
    // central park
    { x: -100, z: 100, w: 160, d: 160, y: -0.5, pattern: 'lawn', a: 'lime', b: '#8DCE47', cell: 10 },
    { x: -100, z: 100, r: 40, y: -0.4, pattern: 'water', a: 'sky', b: '#8AD2F7', cell: 8 },
    // port water (south)
    { x: 0, z: 1050, w: 2 * S, d: 500, y: -0.6, pattern: 'water', a: 'cobalt', b: '#5B7BE4', cell: 30 },
    { x: 0, z: 790, w: 1500, d: 40, y: 0.03, pattern: 'boards', a: 'stone', b: '#A9AEC1', c: 'charcoal', cell: 8 },
    // airport (west)
    { x: -1000, z: -100, w: 500, d: 700, y: -0.8, pattern: 'tiles', a: '#7A7390', b: '#837C99', c: 'charcoal', cell: 40 },
    { x: -1000, z: -100, w: 70, d: 650, y: 0.04, pattern: 'roadz', a: 'charcoal', b: 'snow', cell: 70, offset: [1000, 100] },
    // stadium plaza (north)
    { x: 0, z: -950, r: 230, y: -0.6, pattern: 'tiles', a: 'cloud', b: '#E6E9F1', c: 'stone', cell: 20 },
    // space centre (east)
    { x: 1050, z: -300, w: 400, d: 500, y: -0.7, pattern: 'checks', a: 'sand', b: '#F2D9AE', cell: 50 },
  ],
  blocks: [
    { min: [-S - 50, -10, -S - 50], max: [S + 50, 10000, -S], visible: false },
    { min: [-S - 50, -10, S], max: [S + 50, 10000, S + 50], visible: false },
    { min: [-S - 50, -10, -S], max: [-S, 10000, S], visible: false },
    { min: [S, -10, -S], max: [S + 50, 10000, S], visible: false },
  ],
};

export const bounds = { minX: -S, maxX: S, minZ: -S, maxZ: S };
export const spawn = { x: 300, z: 520, yaw: Math.PI };

const TOWERS = ['skyscraper_deco', 'skyscraper_spire', 'skyscraper_twist', 'office_block', 'apartment_tower', 'office_block'];
const MID = ['office_block', 'apartment_tower', 'apartment_block', 'parking_garage', 'shop_a', 'shop_b', 'cafe', 'bakery'];
const LOW = ['house_a', 'house_b', 'house_c', 'shop_a', 'shop_b', 'apartment_block', 'garage'];

export function layout(lib, seed = 606) {
  const L = new Layout(lib, seed, { minX: -S + 20, maxX: S - 20, minZ: -S + 20, maxZ: S - 20 });
  L.clear(spawn.x, spawn.z, 70);
  // ---- city blocks: towers in the middle, mid-rise around, low-rise at the edge
  for (let bx = 0; bx < GRID.length - 1; bx++) {
    for (let bz = 0; bz < GRID.length - 1; bz++) {
      const cx = (GRID[bx] + GRID[bx + 1]) / 2,
        cz = (GRID[bz] + GRID[bz + 1]) / 2;
      if (Math.abs(cx + 100) < 10 && Math.abs(cz - 100) < 10) continue; // central park
      const x0 = GRID[bx] + RW / 2 + 8,
        x1 = GRID[bx + 1] - RW / 2 - 8;
      const z0 = GRID[bz] + RW / 2 + 8,
        z1 = GRID[bz + 1] - RW / 2 - 8;
      const ring = Math.max(Math.abs(cx), Math.abs(cz));
      const kinds = ring < 250 ? TOWERS : ring < 450 ? MID : LOW;
      const inset = ring < 250 ? 30 : 20;
      L.row(kinds, x0, z0 + inset, x1, z0 + inset, Math.PI, 10);
      L.row(kinds, x0, z1 - inset, x1, z1 - inset, 0, 10);
      L.row(kinds, x0 + inset, z0 + 2 * inset + 10, x0 + inset, z1 - 2 * inset - 10, -Math.PI / 2, 10);
      L.row(kinds, x1 - inset, z0 + 2 * inset + 10, x1 - inset, z1 - 2 * inset - 10, Math.PI / 2, 10);
      L.scatterTable(
        [
          ['tree_round', 6],
          ['car', 6],
          ['city_bus', 1],
          ['person_adult', 3],
          ['person_adult2', 3],
          ['park_bench', 2],
          ['street_lamp', 3],
        ],
        { minX: x0 + 2 * inset, maxX: x1 - 2 * inset, minZ: z0 + 2 * inset, maxZ: z1 - 2 * inset },
        { pad: 0.6 },
      );
    }
  }
  // ---- landmarks
  L.put('observation_tower', 0, 0);
  L.put('museum_dome', 300, -300, { yaw: 0 });
  L.put('cathedral', -300, -300, { yaw: 0 });
  L.put('giant_statue', -100, 100, { yaw: Math.PI });
  L.put('obelisk', 300, 300);
  L.put('donut_shop', 500, 100, { yaw: -Math.PI / 2 });
  L.put('big_wheel', 520, 740, { yaw: 0.4 });
  L.put('stadium', 0, -950, { yaw: 0 });
  L.put('rocket_pad', 1100, -350);
  L.put('factory_chimneys', 900, 200, { yaw: Math.PI / 2 });
  L.put('factory_chimneys', 1000, 380, { yaw: 0.3 });
  L.put('radio_mast', 1150, -650);
  L.put('water_tower', 950, -50);
  L.put('grain_silo', 880, 520);
  L.put('lighthouse', -1200, 860, { scale: 1.5 });
  L.put('bridge_tower', -350, 960, { tint: 'sky' });
  L.put('bridge_tower', -350, 1160, { tint: 'sky' });
  // ---- central park
  L.scatterTable(
    [
      ['tree_round', 40],
      ['pine_tree', 12],
      ['park_bench', 10],
      ['person_adult', 14],
      ['person_kid', 14],
      ['dog', 8],
      ['gazebo', 2],
      ['town_fountain', 1],
      ['carousel', 1],
      ['ice_cream_van', 2],
      ['lemonade_stand', 4],
    ],
    { minX: -175, maxX: -25, minZ: 25, maxZ: 175 },
    { pad: 0.5 },
  );
  // ---- port
  L.put('cruise_ship', -200, 900, { yaw: L.along('cruise_ship', Math.PI / 2) });
  L.put('cargo_ship', 250, 880, { yaw: L.along('cargo_ship', -Math.PI / 2) });
  L.put('cargo_ship', 700, 1000, { yaw: L.along('cargo_ship', Math.PI / 2) + 0.2 });
  for (const x of [-60, 60, 380, 480]) L.put('harbour_crane', x, 830, { yaw: 0 });
  L.scatterTable(
    [
      ['container_stack', 40],
      ['delivery_van', 10],
      ['garbage_truck', 4],
      ['dumpster', 10],
      ['person_adult', 10],
    ],
    { minX: -700, maxX: 700, minZ: 640, maxZ: 775 },
    { pad: 0.4 },
  );
  L.scatterTable(
    [
      ['sailboat', 26],
      ['fishing_boat', 16],
    ],
    { minX: -1250, maxX: 1250, minZ: 850, maxZ: 1280 },
    { pad: 1 },
  );
  // ---- airport
  for (let k = 0; k < 6; k++) L.put('airliner', -900 + (k % 2) * 30, -380 + k * 110, { yaw: -Math.PI / 2 + (k % 2) * 0.3 });
  L.put('airliner', -1000, -300, { yaw: Math.PI });
  L.row(['parking_garage', 'office_block'], -780, -420, -780, 220, -Math.PI / 2, 25);
  L.scatterTable(
    [
      ['helicopter', 4],
      ['delivery_van', 12],
      ['city_bus', 6],
      ['traffic_cone', 30],
      ['container_stack', 6],
    ],
    { minX: -1240, maxX: -760, minZ: -440, maxZ: 240 },
    { pad: 1 },
  );
  // ---- stadium surroundings + suburbs + space centre
  L.scatterTable(
    [
      ['person_adult', 30],
      ['person_adult2', 30],
      ['person_kid', 20],
      ['car', 60],
      ['city_bus', 10],
      ['ice_cream_van', 4],
      ['tree_round', 20],
    ],
    { minX: -230, maxX: 230, minZ: -1180, maxZ: -720 },
    { pad: 0.6 },
  );
  L.scatterTable(
    [
      ['container_stack', 10],
      ['water_tower', 2],
      ['grain_silo', 3],
      ['delivery_van', 8],
      ['traffic_cone', 20],
      ['radio_mast', 1],
    ],
    { minX: 860, maxX: 1240, minZ: -540, maxZ: -60 },
    { pad: 1 },
  );
  for (const [x0, x1, z0, z1] of [
    [-1250, -760, 260, 760],
    [-1250, -760, -1250, -460],
    [-740, -260, -1250, -700],
    [260, 1250, -1250, -700],
    [760, 1250, 40, 760],
  ])
    L.scatterTable(
      [
        ['house_a', 14],
        ['house_b', 14],
        ['house_c', 14],
        ['apartment_block', 6],
        ['red_barn', 1],
        ['tree_round', 50],
        ['pine_tree', 40],
        ['car', 20],
        ['school_bus', 2],
        ['church', 1],
        ['shop_a', 4],
        ['petrol_station', 1],
        ['windmill', 1],
        ['person_adult', 8],
        ['cow', 6],
      ],
      { minX: x0, maxX: x1, minZ: z0, maxZ: z1 },
      { pad: 0.5 },
    );
  // ---- the sky: helicopters, blimps, balloons, clouds (the final course)
  for (let k = 0; k < 6; k++) L.put('helicopter', L.range(-900, 900), L.range(-900, 700), { y: L.range(80, 160) });
  for (let k = 0; k < 4; k++) L.put('blimp', L.range(-900, 900), L.range(-900, 700), { y: L.range(170, 260), yaw: L.range(0, 6.28) });
  for (let k = 0; k < 6; k++) L.put('hot_air_balloon', L.range(-1100, 1100), L.range(-1100, 700), { y: L.range(90, 200), scale: L.range(1, 1.6) });
  for (let k = 0; k < 26; k++) L.put('fluffy_cloud', L.range(-1200, 1200), L.range(-1200, 1200), { y: L.range(220, 420), scale: L.range(0.8, 1.6), yaw: L.range(0, 6.28) });
  return L;
}
