// Level 2 — Bedroom Bedlam: a kid's bedroom, 7.6 x 6.2 m. Walls are inward-facing planes so the
// camera can swing behind them and see through.
import { Layout } from './layout.js';

const W = 7.6,
  D = 6.2,
  H = 2.6;
const X = W / 2,
  Z = D / 2;

const wallpaper = { h: H, pattern: 'stripes', a: 'lavender', b: '#C7B8F3', cell: 0.24 };

export const env = {
  sky: [
    [0, 'grape'],
    [0.5, 'lavender'],
    [1, 'paper'],
  ],
  fog: null,
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: W, d: D, y: 0, pattern: 'carpet', a: 'cobalt', b: '#4C6EE0', cell: 0.16 },
    { x: 0.2, z: 0.3, r: 1.35, y: 0.002, pattern: 'stripes', a: 'sun', b: 'butter', cell: 0.22 },
    { x: -1.9, z: 1.4, w: 1.6, d: 1.1, y: 0.002, pattern: 'checks', a: 'tomato', b: 'paper', cell: 0.2 },
  ],
  walls: [
    { from: [-X, -Z], to: [X, -Z], ...wallpaper, shade: 0.95 },
    { from: [X, -Z], to: [X, Z], ...wallpaper, shade: 0.85 },
    { from: [X, Z], to: [-X, Z], ...wallpaper, shade: 0.95 },
    { from: [-X, Z], to: [-X, -Z], ...wallpaper, shade: 1.0 },
    // skirting boards
    { from: [-X + 0.01, -Z + 0.01], to: [X - 0.01, -Z + 0.01], h: 0.12, pattern: 'solid', a: 'snow', collide: false, shade: 0.95 },
    { from: [X - 0.01, -Z + 0.01], to: [X - 0.01, Z - 0.01], h: 0.12, pattern: 'solid', a: 'snow', collide: false, shade: 0.85 },
    { from: [X - 0.01, Z - 0.01], to: [-X + 0.01, Z - 0.01], h: 0.12, pattern: 'solid', a: 'snow', collide: false, shade: 0.95 },
    { from: [-X + 0.01, Z - 0.01], to: [-X + 0.01, -Z + 0.01], h: 0.12, pattern: 'solid', a: 'snow', collide: false },
    // window (back wall) and door (right wall)
    { from: [-0.9, -Z + 0.02], to: [0.9, -Z + 0.02], y: 1.0, h: 1.1, pattern: 'tiles', a: 'sky', b: '#86D2F7', c: 'snow', cell: 0.55, collide: false, shade: 1 },
    { from: [X - 0.02, 0.6], to: [X - 0.02, 1.6], h: 2.05, pattern: 'boards', a: 'caramel', b: 'sand', c: 'cocoa', cell: 0.25, collide: false, shade: 0.9 },
  ],
  blocks: [],
};

export const bounds = { minX: -X, maxX: X, minZ: -Z, maxZ: Z };
export const spawn = { x: 0.3, z: 1.6, yaw: Math.PI };

export function layout(lib, seed = 202) {
  const L = new Layout(lib, seed, { minX: -X + 0.08, maxX: X - 0.08, minZ: -Z + 0.08, maxZ: Z - 0.08 });
  L.clear(spawn.x, spawn.z, 0.6);
  L.clear(X - 0.3, 1.1, 0.5); // by the door

  // ---- furniture along the walls
  const bed = L.put('bed', -X + 1.05, -Z + 1.2, { yaw: 0 });
  L.putOn(bed, 'pillow', 0, -0.7);
  L.putOn(bed, 'teddy_bear', 0.25, -0.3);
  L.putOn(bed, 'book', -0.3, 0.2);
  L.putOn(bed, 'sock', 0.2, 0.5);
  L.putOn(bed, 'cat', -0.1, 0.0);
  const desk = L.put('desk', X - 0.45, -Z + 1.5, { yaw: -Math.PI / 2 });
  L.putOn(desk, 'laptop', 0, 0.1);
  L.putOn(desk, 'desk_lamp', 0.0, -0.45);
  L.putOn(desk, 'globe', -0.05, 0.45);
  L.putOn(desk, 'crayon_box', 0.15, -0.15);
  L.putOn(desk, 'pencil', -0.15, 0.25);
  L.put('desk_chair', X - 1.1, -Z + 1.5, { yaw: Math.PI / 2 });
  const dresser = L.put('dresser', 0.9, -Z + 0.35, { yaw: 0 });
  L.putOn(dresser, 'alarm_clock', -0.35, 0);
  L.putOn(dresser, 'piggy_bank', 0.05, 0.02);
  L.putOn(dresser, 'trophy', 0.4, 0);
  const shelf = L.put('bookshelf', -X + 0.25, 1.0, { yaw: Math.PI / 2 });
  L.putOn(shelf, 'toy_robot', 0, 0);
  L.put('floor_lamp', -X + 0.35, Z - 0.35);
  L.put('beanbag', 2.0, 1.5, { yaw: -2.2 });
  L.put('fishbowl', -1.6, -Z + 0.3);
  L.put('trash_can', X - 0.3, -0.2);
  L.put('guitar', X - 0.35, 2.2, { yaw: -1.4 });
  L.put('stool', 1.6, -0.4);
  L.put('toy_drum', -0.6, -0.3);
  L.put('board_game', 0.9, 0.9, { yaw: 0.4 });
  L.put('xylophone', -1.2, 1.9, { yaw: 0.2 });
  L.put('kite', 2.4, -1.2, { yaw: 0.9 });
  L.put('umbrella', -2.2, 2.1, { yaw: 1.4 });
  L.put('skateboard', 0.0, -1.3, { yaw: 1.2 });
  L.put('tennis_racket', 2.6, 0.5, { yaw: -0.3 });
  L.put('backpack', -X + 0.4, -0.4, { yaw: 1.4 });
  L.put('toy_rocket', 1.8, -1.7);
  L.put('teddy_bear', -0.6, 1.2, { yaw: 2.6 });
  L.put('game_console', 0.4, 0.2, { yaw: 0.3 });
  // a sibling's half of the room
  const bed2 = L.put('bed', X - 1.05, Z - 1.25, { yaw: Math.PI });
  L.putOn(bed2, 'pillow', 0, 0.7);
  L.putOn(bed2, 'teddy_bear', -0.2, 0.2);
  L.put('wardrobe', -X + 0.4, -0.9, { yaw: Math.PI / 2 });
  L.put('armchair', -X + 0.7, Z - 1.1, { yaw: 2.4 });
  L.put('laundry_basket', 2.9, -0.6);
  L.put('potted_fern', -X + 0.35, -Z + 0.35);
  L.put('desk_chair', -1.0, 2.6, { yaw: 2.8 });
  L.put('beanbag', -2.4, -0.2, { yaw: 1.2 });
  L.put('toy_drum', 2.1, 2.5);
  L.put('fish_tank', -0.3, -Z + 0.35, { yaw: 0 });

  // ---- toys and clothes everywhere
  const floor = { minX: -X + 0.12, maxX: X - 0.12, minZ: -Z + 0.12, maxZ: Z - 0.12 };
  // bigger things first, with breathing room so the ball never starts boxed in
  L.scatterTable(
    [
      ['pillow', 2],
      ['teddy_bear', 2],
      ['toy_rocket', 1],
      ['backpack', 1],
      ['board_game', 1],
      ['xylophone', 1],
      ['trophy', 2],
      ['globe', 1],
      ['laptop', 1],
      ['desk_lamp', 1],
      ['trash_can', 1],
      ['fishbowl', 1],
    ],
    floor,
    { pad: 1.2 },
  );
  L.scatterTable(
    [
      ['sock', 18],
      ['bunny_slipper', 4],
      ['sneaker', 6],
      ['book', 14],
      ['comic_stack', 4],
      ['paper_airplane', 8],
      ['soccer_ball', 2],
      ['basketball', 2],
      ['baseball', 6],
      ['toy_train', 3],
      ['toy_dinosaur', 4],
      ['action_figure', 8],
      ['toy_robot', 3],
      ['headphones', 3],
      ['potted_cactus', 2],
      ['hamster', 4],
      ['alarm_clock', 2],
      ['piggy_bank', 2],
    ],
    floor,
    { pad: 0.9 },
  );
  L.scatterTable(
    [
      ['yoyo', 6],
      ['building_block', 30],
      ['marble', 30],
      ['crayon', 16],
      ['crayon_box', 2],
      ['pencil', 8],
      ['toy_car', 8],
      ['rubber_duck', 3],
      ['die', 10],
      ['button', 16],
      ['coin', 20],
      ['chess_pawn', 8],
      ['eraser', 6],
      ['sticky_note', 8],
      ['battery', 6],
      ['key', 4],
      ['spool', 4],
      ['wrapped_candy', 12],
      ['cookie', 6],
      ['juice_box', 3],
      ['apple', 2],
      ['banana', 2],
      ['smartphone', 1],
      ['glasses', 1],
      ['tv_remote', 1],
      ['cereal_box', 1],
      ['mug', 3],
      ['teacup', 2],
      ['donut', 3],
      ['cupcake', 3],
      ['rubber_duck', 2],
    ],
    floor,
    { pad: 0.3 },
  );
  return L;
}
