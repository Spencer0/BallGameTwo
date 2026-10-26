// Level 1 — Crumb Patrol: a long farmhouse breakfast table (2.4 x 1.4 m). Ground = table top.
import { Layout } from './layout.js';

const W = 2.4,
  D = 1.4;

export const env = {
  sky: [
    [0, 'butter'],
    [0.55, '#FFEFC4'],
    [1, 'paper'],
  ],
  fog: null,
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: W, d: D, y: 0, pattern: 'gingham', a: 'tomato', b: 'paper', c: '#F79A8E', cell: 0.045 },
    // kitchen floor far below the table
    { x: 0, z: 0, w: 14, d: 12, y: -0.76, pattern: 'tiles', a: '#F3E2C6', b: 'sky', c: '#E8D2B0', cell: 0.4 },
  ],
  blocks: [
    // table top slab (visible rim) and legs
    { min: [-W / 2 - 0.03, -0.06, -D / 2 - 0.03], max: [W / 2 + 0.03, -0.0005, D / 2 + 0.03], color: 'caramel', collide: false },
    ...[
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].map(([sx, sz]) => ({
      min: [sx * (W / 2 - 0.12) - 0.05, -0.76, sz * (D / 2 - 0.1) - 0.05],
      max: [sx * (W / 2 - 0.12) + 0.05, -0.06, sz * (D / 2 - 0.1) + 0.05],
      color: 'cocoa',
      collide: false,
    })),
    // invisible rails at the table edge (the inspection does not cover the floor)
    { min: [-W / 2 - 1, -1, -D / 2 - 1], max: [W / 2 + 1, 2, -D / 2], visible: false },
    { min: [-W / 2 - 1, -1, D / 2], max: [W / 2 + 1, 2, D / 2 + 1], visible: false },
    { min: [-W / 2 - 1, -1, -D / 2], max: [-W / 2, 2, D / 2], visible: false },
    { min: [W / 2, -1, -D / 2], max: [W / 2 + 1, 2, D / 2], visible: false },
    // kitchen walls (backdrop)
    { min: [-7, -0.76, -6.2], max: [7, 2.6, -6], color: 'butter', collide: false, outline: false },
    { min: [-7, -0.76, 6], max: [7, 2.6, 6.2], color: 'butter', collide: false, outline: false },
    { min: [-7.2, -0.76, -6], max: [-7, 2.6, 6], color: 'sand', collide: false, outline: false },
    { min: [7, -0.76, -6], max: [7.2, 2.6, 6], color: 'sand', collide: false, outline: false },
  ],
};

export const bounds = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 };
export const spawn = { x: 0, z: 0.42, yaw: Math.PI }; // facing -Z (towards the far place setting)

export function layout(lib, seed = 101) {
  const L = new Layout(lib, seed, { minX: -W / 2 + 0.02, maxX: W / 2 - 0.02, minZ: -D / 2 + 0.02, maxZ: D / 2 - 0.02 });
  L.clear(spawn.x, spawn.z, 0.09);

  // --- place settings (big obstacles early, collectible late)
  const settings = [
    [-0.62, 0.3, 0],
    [0.62, -0.3, Math.PI],
    [0.15, -0.38, Math.PI],
  ];
  for (const [x, z, yaw] of settings) {
    const plate = L.put('plate', x, z, { yaw });
    if (plate) {
      L.putOn(plate, 'toast', 0.02, 0.0);
      L.putOn(plate, 'fried_egg', -0.04, 0.05);
    }
    L.put('fork', x - 0.17, z, { yaw: yaw + 0.05 });
    L.put('butter_knife', x + 0.17, z, { yaw: yaw - 0.04 });
    L.put('spoon', x + 0.21, z + 0.03, { yaw: yaw + 0.1 });
    L.put(L.rand() < 0.5 ? 'mug' : 'teacup', x + 0.2, z - 0.15 * Math.cos(yaw));
    L.put('egg_cup', x - 0.18, z - 0.14 * Math.cos(yaw));
  }
  // --- centrepiece strip
  L.put('vase_tulips', 0, 0, { yaw: 0.3 });
  L.put('bread_loaf', -0.32, -0.08, { yaw: 1.4 });
  L.put('teapot', 0.3, 0.12, { yaw: -0.8 });
  L.put('jam_jar', 0.14, 0.12);
  L.put('salt_shaker', -0.12, 0.14);
  L.put('pepper_mill', -0.17, 0.11);
  L.put('toaster', 0.95, 0.42, { yaw: -0.4 });
  L.put('cereal_box', -0.98, -0.45, { yaw: 0.25 });
  L.put('milk_carton', -0.82, -0.5, { yaw: -0.3 });
  L.put('newspaper', 0.85, -0.05, { yaw: 1.2 });
  L.put('bowl_cereal', -0.45, 0.45);
  L.put('pancake_stack', 0.5, 0.45);

  // --- fruit corner
  const fruit = { x: -0.85, z: 0.2, r: 0.2 };
  L.scatterTable(
    [
      ['banana', 2],
      ['apple', 3],
      ['orange', 3],
      ['lemon', 2],
      ['grape', 10],
      ['cherry', 4],
      ['strawberry', 6],
      ['blueberry', 10],
    ],
    fruit,
  );
  // --- bakery corner
  L.scatterTable(
    [
      ['croissant', 2],
      ['donut', 4],
      ['cupcake', 4],
      ['cookie', 6],
      ['cheese_wedge', 2],
    ],
    { x: 0.45, z: 0.25, r: 0.22 },
  );
  // --- game / craft corner
  L.scatterTable(
    [
      ['die', 10],
      ['chess_pawn', 6],
      ['toy_car', 3],
      ['rubber_duck', 2],
      ['crayon', 8],
      ['button', 12],
      ['spool', 3],
      ['thimble', 4],
      ['eraser', 4],
      ['sticky_note', 5],
      ['matchbox', 2],
      ['pencil', 3],
    ],
    { x: 0.82, z: -0.38, r: 0.28 },
  );
  // --- junk drawer spill
  L.scatterTable(
    [
      ['coin', 16],
      ['key', 4],
      ['battery', 4],
      ['paperclip', 8],
      ['thumbtack', 8],
      ['ring', 2],
      ['bottle_cap', 6],
      ['wrapped_candy', 8],
      ['birthday_candle', 4],
      ['glasses', 1],
      ['smartphone', 1],
      ['tv_remote', 1],
      ['juice_box', 2],
    ],
    { x: -0.45, z: -0.32, r: 0.3 },
  );
  // --- breakfast debris everywhere
  const all = { minX: -W / 2 + 0.03, maxX: W / 2 - 0.03, minZ: -D / 2 + 0.03, maxZ: D / 2 - 0.03 };
  L.scatterTable(
    [
      ['crumb', 70],
      ['pea', 40],
      ['cereal_loop', 50],
      ['sugar_cube', 14],
      ['blueberry', 12],
      ['coin', 8],
      ['ladybug', 4],
      ['snail', 3],
      ['egg', 4],
      ['strawberry', 4],
      ['donut', 2],
      ['toast', 3],
      ['teacup', 2],
      ['mug', 2],
      ['spoon', 3],
    ],
    all,
    { pad: 0.6 },
  );
  // ant trail across the table
  L.line('ant', -1.0, 0.6, 0.6, -0.6, 14, { jitter: 0.02 });
  return L;
}
