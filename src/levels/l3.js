// Level 3 — House Party: a cut-away bungalow (low dollhouse walls, climbable once the ball is
// ~1.5 m) with a garden all around. 34 x 26 m.
import { Layout } from './layout.js';

const W = 34,
  D = 38; // garden to z=±13, plus a street out front (z 13..19)
const WALL_H = 1.5; // rooms open up once the ball is ~1.5 m (climb limit 2 r)
const T = 0.24; // wall thickness

// house footprint x[-9,9] z[-7,7]; rooms (see DESIGN.md L3)
const ROOMS = {
  living: { minX: -9, maxX: 0, minZ: 0, maxZ: 7 },
  kitchen: { minX: 0, maxX: 9, minZ: 0, maxZ: 7 },
  bedroom: { minX: -9, maxX: -2, minZ: -7, maxZ: 0 },
  bath: { minX: -2, maxX: 3, minZ: -7, maxZ: 0 },
  hall: { minX: 3, maxX: 9, minZ: -7, maxZ: 0 },
};

/** wall along x (z fixed) or along z (x fixed) with door gaps [[from,to],...] */
function wall(axis, fixed, from, to, gaps = [], color = 'paper') {
  const out = [];
  let a = from;
  const cuts = [...gaps].sort((p, q) => p[0] - q[0]);
  for (const [g0, g1] of [...cuts, [to, to]]) {
    if (g0 - a > 0.05) {
      out.push(
        axis === 'x'
          ? { min: [a, 0, fixed - T / 2], max: [g0, WALL_H, fixed + T / 2], color, climb: true, outline: true, cam: false }
          : { min: [fixed - T / 2, 0, a], max: [fixed + T / 2, WALL_H, g0], color, climb: true, outline: true, cam: false },
      );
    }
    a = g1;
  }
  return out;
}

const blocks = [
  // exterior walls with doors front (z=7) and back (z=-7)
  ...wall('x', 7, -9, 9, [[-5.5, -3.5], [4, 6]], 'butter'),
  ...wall('x', -7, -9, 9, [[-6.5, -4.5], [5, 7]], 'butter'),
  ...wall('z', -9, -7, 7, [[2, 4]], 'butter'),
  ...wall('z', 9, -7, 7, [[-4, -2], [3, 5]], 'butter'),
  // interior walls
  ...wall('x', 0, -9, 9, [[-6, -4], [-0.2, 1.6], [5.4, 7.4]], 'paper'),
  ...wall('z', 0, 0, 7, [[2.5, 5]], 'paper'),
  ...wall('z', -2, -7, 0, [[-4.5, -2.5]], 'paper'),
  ...wall('z', 3, -7, 0, [[-5, -3]], 'paper'),
  // garden boundary (invisible)
  { min: [-W / 2 - 2, -1, -D / 2 - 2], max: [W / 2 + 2, 30, -D / 2], visible: false },
  { min: [-W / 2 - 2, -1, D / 2], max: [W / 2 + 2, 30, D / 2 + 2], visible: false },
  { min: [-W / 2 - 2, -1, -D / 2], max: [-W / 2, 30, D / 2], visible: false },
  { min: [W / 2, -1, -D / 2], max: [W / 2 + 2, 30, D / 2], visible: false },
  // garden fence (visual) around the garden; the street side is open
  { min: [-W / 2, 0, -13.15], max: [W / 2, 1.8, -13], color: 'caramel', collide: false },
  { min: [-W / 2 - 0.15, 0, -13], max: [-W / 2, 1.8, 13], color: 'caramel', collide: false },
  { min: [W / 2, 0, -13], max: [W / 2 + 0.15, 1.8, 13], color: 'caramel', collide: false },
];

export const env = {
  sky: [
    [0, 'sky'],
    [0.6, '#BFE6FA'],
    [1, 'paper'],
  ],
  fog: null,
  groundY: 0,
  planes: [
    { x: 0, z: 0, w: 140, d: 120, y: -0.02, pattern: 'lawn', a: 'leaf', b: '#4DB86A', cell: 3 },
    { x: 0, z: -3, w: W, d: 32, y: -0.01, pattern: 'lawn', a: 'lime', b: '#8BCB45', cell: 1.6 },
    { x: 0, z: 14.2, w: 140, d: 2.4, y: -0.008, pattern: 'tiles', a: 'cloud', b: '#E6E9F1', c: 'stone', cell: 1.2 },
    { x: 0, z: 17.6, w: 140, d: 4.6, y: -0.006, pattern: 'roadx', a: 'charcoal', b: 'paper', cell: 4.6, offset: [0, -17.6] },
    // patio
    { x: 0, z: -9.5, w: 10, d: 5, y: -0.005, pattern: 'tiles', a: 'cloud', b: 'stone', c: '#C3C8D6', cell: 1 },
    { x: -4.5, z: 3.5, w: 9, d: 7, y: 0.002, pattern: 'boards', a: 'caramel', b: 'sand', c: 'cocoa', cell: 0.5 },
    { x: 4.5, z: 3.5, w: 9, d: 7, y: 0.002, pattern: 'tiles', a: 'paper', b: 'sky', c: '#D9CDB8', cell: 0.6 },
    { x: -5.5, z: -3.5, w: 7, d: 7, y: 0.002, pattern: 'carpet', a: 'lavender', b: '#A893E6', cell: 0.5 },
    { x: 0.5, z: -3.5, w: 5, d: 7, y: 0.002, pattern: 'tiles', a: 'snow', b: 'mint', c: '#C9D3DF', cell: 0.4 },
    { x: 6, z: -3.5, w: 6, d: 7, y: 0.002, pattern: 'boards', a: 'sand', b: '#E0B97F', c: 'caramel', cell: 0.45 },
    { x: -4.5, z: 3.5, r: 2.2, y: 0.004, pattern: 'stripes', a: 'tomato', b: 'sun', cell: 0.5 },
  ],
  blocks,
};

// Madame Prudence inspects the garden (life-size, 1.5 m)
env.decor = [{ id: 'char__prudence', x: -9.5, y: 0, z: -11.2, yaw: 0.3, scale: 0.5, size: 1.5, collide: true }];

export const bounds = { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2 };
export const spawn = { x: -5.2, z: 4.6, yaw: Math.PI * 0.85 };

export function layout(lib, seed = 303) {
  const L = new Layout(lib, seed, { minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3 });
  L.clear(spawn.x, spawn.z, 1.2);
  // keep doorways clear
  for (const [x, z] of [[-4.5, 7], [5, 7], [-5.5, -7], [6, -7], [-9, 3], [9, -3], [9, 4], [-5, 0], [0.7, 0], [6.4, 0], [0, 3.7], [-2, -3.5], [3, -4]])
    L.clear(x, z, 1.1);
  const inset = (r, m = 0.4) => ({ minX: r.minX + m, maxX: r.maxX - m, minZ: r.minZ + m, maxZ: r.maxZ - m });

  // ---- living room
  const sofa = L.put('sofa', -4.6, 6.1, { yaw: Math.PI });
  L.putOn(sofa, 'pillow', -0.5, 0.1);
  L.putOn(sofa, 'teddy_bear', 0.5, 0);
  L.put('armchair', -7.9, 4.4, { yaw: Math.PI / 2 });
  L.put('armchair', -1.3, 4.6, { yaw: -Math.PI / 2 });
  const ct = L.put('coffee_table', -4.5, 3.7, { yaw: 0 });
  L.putOn(ct, 'mug', 0.3, 0.1);
  L.putOn(ct, 'tv_remote', -0.2, -0.1);
  L.putOn(ct, 'book', -0.35, 0.15);
  L.put('tv_stand', -4.5, 0.6, { yaw: 0 });
  L.put('piano', -8.4, 1.4, { yaw: Math.PI / 2 });
  L.put('grandfather_clock', -0.6, 6.4, { yaw: Math.PI });
  L.put('bookshelf', -8.5, 6.3, { yaw: Math.PI / 2 });
  L.put('floor_lamp', -1.0, 1.0);
  L.put('potted_fern', -8.3, 0.7);
  L.put('fish_tank', -2.4, 0.6, { yaw: 0 });
  L.put('person_grandpa', -6.3, 4.6, { yaw: 0.5 });
  L.put('cat', -3.2, 2.2);
  L.scatterTable(
    [
      ['book', 6],
      ['comic_stack', 2],
      ['bunny_slipper', 3],
      ['sock', 6],
      ['toy_car', 6],
      ['building_block', 14],
      ['marble', 10],
      ['baseball', 3],
      ['yoyo', 3],
      ['action_figure', 3],
      ['teddy_bear', 1],
      ['board_game', 1],
      ['headphones', 1],
      ['game_console', 1],
      ['beanbag', 1],
      ['coin', 12],
      ['crayon', 8],
      ['rubber_duck', 2],
    ],
    inset(ROOMS.living),
  );

  // ---- kitchen
  L.put('fridge', 8.5, 6.4, { yaw: Math.PI });
  L.put('stove', 6.8, 6.5, { yaw: Math.PI });
  const kt = L.put('kitchen_table', 4.2, 3.6, { yaw: 0 });
  L.putOn(kt, 'plate', -0.4, 0.2);
  L.putOn(kt, 'plate', 0.4, -0.2);
  L.putOn(kt, 'teapot', 0, 0);
  L.putOn(kt, 'bowl_of_cereal', 0.5, 0.3);
  for (const [dx, dz, yaw] of [[-1.1, 0, Math.PI / 2], [1.1, 0, -Math.PI / 2], [0, 0.85, Math.PI], [0, -0.85, 0]]) L.put('desk_chair', 4.2 + dx, 3.6 + dz, { yaw });
  L.put('trash_can', 1.0, 6.4);
  L.put('person_adult', 6.6, 2.2, { yaw: 2.2 });
  L.put('dog', 2.2, 2.0);
  L.scatterTable(
    [
      ['cereal_box', 2],
      ['milk_carton', 2],
      ['toaster', 1],
      ['bread_loaf', 2],
      ['mug', 4],
      ['teacup', 3],
      ['apple', 6],
      ['orange', 4],
      ['banana', 3],
      ['spoon', 6],
      ['fork', 4],
      ['jam_jar', 2],
      ['juice_box', 3],
      ['donut', 4],
      ['cupcake', 3],
      ['egg', 6],
      ['watering_can', 1],
    ],
    inset(ROOMS.kitchen),
  );

  // ---- bedroom
  const bed = L.put('bed', -7.4, -4.6, { yaw: Math.PI / 2 });
  L.putOn(bed, 'pillow', 0, 0.6);
  L.put('wardrobe', -2.8, -6.5, { yaw: 0 });
  L.put('dresser', -5.2, -6.6, { yaw: 0 });
  const desk = L.put('desk', -3.0, -1.0, { yaw: Math.PI });
  L.putOn(desk, 'laptop', 0.2, 0);
  L.putOn(desk, 'desk_lamp', -0.4, 0.1);
  L.put('desk_chair', -3.0, -1.9, { yaw: 0 });
  L.put('laundry_basket', -8.2, -1.0);
  L.put('person_kid', -5.6, -2.4, { yaw: 1.0 });
  L.scatterTable(
    [
      ['sneaker', 4],
      ['sock', 8],
      ['bunny_slipper', 2],
      ['soccer_ball', 1],
      ['basketball', 1],
      ['toy_robot', 2],
      ['toy_train', 1],
      ['toy_dinosaur', 2],
      ['toy_rocket', 1],
      ['kite', 1],
      ['backpack', 1],
      ['book', 5],
      ['marble', 8],
      ['building_block', 10],
      ['alarm_clock', 1],
      ['piggy_bank', 1],
      ['globe', 1],
      ['guitar', 1],
      ['skateboard', 1],
      ['hamster', 2],
    ],
    inset(ROOMS.bedroom),
  );

  // ---- bathroom
  L.put('bathtub', 0.4, -6.0, { yaw: 0 });
  L.put('toilet', 2.4, -2.0, { yaw: -Math.PI / 2 });
  L.put('washing_machine', -1.4, -1.0, { yaw: Math.PI / 2 });
  L.scatterTable(
    [
      ['rubber_duck', 6],
      ['laundry_basket', 1],
      ['sock', 4],
      ['bunny_slipper', 2],
      ['coin', 6],
    ],
    inset(ROOMS.bath),
  );

  // ---- hall / utility
  L.put('vacuum_cleaner', 8.2, -1.0);
  L.put('ironing_board', 6.0, -6.4, { yaw: 0 });
  L.put('person_adult2', 5.0, -2.8, { yaw: 2.6 });
  L.scatterTable(
    [
      ['umbrella', 2],
      ['sneaker', 4],
      ['backpack', 2],
      ['trash_can', 1],
      ['laundry_basket', 1],
      ['tennis_racket', 1],
      ['stool', 2],
      ['potted_cactus', 2],
      ['skateboard', 1],
      ['basketball', 1],
    ],
    inset(ROOMS.hall),
  );

  // ---- garden (everything outside the house)
  const yard = [
    { minX: -W / 2 + 0.8, maxX: W / 2 - 0.8, minZ: 7.8, maxZ: 12.2 },
    { minX: -W / 2 + 0.8, maxX: W / 2 - 0.8, minZ: -12.2, maxZ: -7.8 },
    { minX: -W / 2 + 0.8, maxX: -9.8, minZ: -7.8, maxZ: 7.8 },
    { minX: 9.8, maxX: W / 2 - 0.8, minZ: -7.8, maxZ: 7.8 },
  ];
  // hedges along the fence
  for (let x = -W / 2 + 2; x < W / 2 - 1; x += 3.2) {
    if (Math.abs(x + 4.5) > 3) L.put('hedge', x, 12.2, { yaw: 0 });
    L.put('hedge', x + 1, -12.1, { yaw: 0 });
  }
  // the street out front: parked cars and street stuff for when the ball is big
  for (const [x, id, tint] of [[-14, 'car', 'tomato'], [-8.5, 'pickup_truck', null], [-2, 'car', 'sun'], [6, 'delivery_van', null], [12.5, 'car', 'leaf']])
    L.put(id, x, 16.3, { yaw: L.along(id, Math.PI / 2), tint: tint || undefined });
  // traffic going by in the far lane (eastbound), people strolling the sidewalk
  const life = (L.life = { cars: [], peds: [], followers: [], grazers: [], flocks: [], movers: [], spinners: [], signals: [] });
  const lane = [[-75, 18.8], [75, 18.8]];
  for (const [id, s0, v, tint] of [['car', 20, 7, 'cobalt'], ['motorcycle', 70, 9, undefined], ['delivery_van', 115, 6, undefined]]) {
    const it = L.put(id, -75 + s0, 18.8, { yaw: L.along(id, Math.PI / 2), tint });
    if (it) life.movers.push({ its: [it], offs: [0], route: lane, speed: v, s: s0, loop: true, kind: 'car' });
  }
  for (const [id, x] of [['person_adult', -30], ['person_grandpa', 12], ['person_kid', 40]]) {
    const it = L.put(id, x, 14.2);
    if (it) life.peds.push({ it, path: [[-60, 14 + Math.random() * 0.4], [60, 14.2]], s: x + 60, dir: x < 0 ? 1 : -1, lat: 0, speed: 1 });
  }
  if (L.has('dog')) {
    const dog = L.put('dog', -29, 14.2);
    if (dog) life.followers.push({ it: dog, owner: life.peds[0].it, side: 0.6, back: 1 });
  }
  for (const x of [-15, -5, 5, 15]) L.put('street_lamp', x, 14.3, { yaw: Math.PI });
  L.put('mailbox', -3, 13.6, { yaw: Math.PI });
  L.put('wheelie_bin', 1, 13.8);
  L.put('wheelie_bin', 2, 13.8, { tint: 'cobalt' });
  L.put('fire_hydrant', 9, 13.7);
  L.put('bus_stop', -15.5, 13.9, { yaw: Math.PI });
  L.put('dumpster', 15.5, 13.9, { yaw: Math.PI / 2 });
  L.put('garden_shed', 14.3, 10.5, { yaw: -Math.PI / 2 });
  L.put('above_ground_pool', -12.4, 9.4);
  L.put('playground_slide', 11.5, -5.5, { yaw: 1.2 });
  L.put('lemonade_stand', 6.5, 13.6, { yaw: Math.PI });
  L.put('car', 13.2, -9.6, { yaw: Math.PI / 2, tint: 'sky' });
  L.put('garden_shed', -14.5, -10.3, { yaw: Math.PI / 2 });
  L.put('trampoline', 13.5, 0.6);
  L.put('swing_set', -13.4, -2.5, { yaw: Math.PI / 2 });
  L.put('picnic_table', 6.5, -10.4, { yaw: 0 });
  L.put('wheelie_bin', 15.5, 4.2);
  L.put('wheelie_bin', 15.5, 5.6, { tint: 'leaf' });
  L.put('mailbox', 4, 12.2, { yaw: Math.PI });
  L.put('kiddie_pool', 11.5, 9, {});
  L.put('pingpong_table', -12, -9.5, { yaw: 0 });
  L.put('bbq_grill', 3, -10.5);
  L.put('garden_bench', -2, -11.6, { yaw: 0 });
  L.put('doghouse', 13.2, -4.5, { yaw: -Math.PI / 2 });
  L.put('dog', 12, -2.5);
  L.put('birdbath', -12.5, 9);
  L.put('wheelbarrow', 13, 4.5, { yaw: 1 });
  L.put('lawn_mower', -13, 3, { yaw: 2 });
  L.put('person_kid', 10.5, 7.5, { yaw: -2 });
  L.put('person_adult', -6, 10, { yaw: 3 });
  for (const r of yard)
    L.scatterTable(
      [
        ['garden_gnome', 2],
        ['flamingo_ornament', 2],
        ['sunflower', 3],
        ['potted_fern', 1],
        ['watering_can', 1],
        ['hose_reel', 1],
        ['tricycle', 1],
        ['bicycle', 1],
        ['soccer_ball', 2],
        ['baseball', 3],
        ['kite', 1],
        ['skateboard', 1],
        ['apple', 4],
        ['snail', 6],
        ['ladybug', 6],
        ['toy_car', 3],
      ],
      r,
    );
  return L;
}
