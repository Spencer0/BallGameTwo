import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Network } from '../../src/levels/city/network.js';
import { World, GONE } from '../../src/game/world.js';
import { Life } from '../../src/game/life.js';
import { lifeSpec, spawnTraffic, spawnWalkers } from '../../src/levels/city/lifespec.js';

// a 4x4 grid of streets with a signalised arterial through the middle and exits at both ends
function town() {
  const net = new Network();
  const id = {};
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) id[i + ',' + j] = net.node(i * 120, j * 120);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      if (i < 3) net.edge(id[i + ',' + j], id[i + 1 + ',' + j], { cls: j === 1 ? 'arterial' : 'street' });
      if (j < 3) net.edge(id[i + ',' + j], id[i + ',' + (j + 1)], { cls: 'street' });
    }
  net.edge(net.node(-150, 120, { exit: true }), id['0,1'], { cls: 'arterial' });
  net.edge(id['3,1'], net.node(510, 120, { exit: true }), { cls: 'arterial' });
  return net.build();
}

function setup(nCars = 40, nPeds = 30) {
  const net = town();
  const types = [
    { id: 'car', idx: 0, dims: [4.3, 1.8, 2], size: 3.2, bound: 2.6, vol: 8, flags: [], geo: [] },
    { id: 'person_adult', idx: 1, dims: [0.6, 1.7, 0.5], size: 1.2, bound: 0.95, vol: 0.1, flags: [], geo: [] },
  ];
  const byId = new Map(types.map((t) => [t.id, t]));
  let seed = 7;
  const L = {
    lib: { byId },
    items: [],
    rand: () => ((seed = (seed * 16807) % 2147483647) / 2147483647),
    pick(a) {
      return a[Math.floor(this.rand() * a.length)];
    },
    put(id, x, z, o = {}) {
      const it = { id, x, z, y: o.y ?? 0, yaw: o.yaw ?? 0, scale: 1 };
      this.items.push(it);
      return it;
    },
  };
  const life = lifeSpec(net);
  spawnTraffic(L, life, net, nCars, [['car', 1]]);
  spawnWalkers(L, life, net, nPeds, { ids: ['person_adult'], dogs: 0, joggers: 0 });
  const world = new World({ types, capacity: L.items.length + 4, bounds: { minX: -400, minZ: -400, maxX: 800, maxZ: 800 }, cellSize: 40 });
  const inst = new Map();
  for (const it of L.items) inst.set(it, world.add(byId.get(it.id).idx, it.x, it.y, it.z, it.yaw, 1, 0));
  const session = {
    world,
    ball: { pos: { x: 9999, y: 0, z: 9999 }, r: 1, diameter: 2 },
    camera: { position: { x: 180, y: 50, z: 180 } },
    events: { emit() {} },
    time: 0,
  };
  world.viewDist = 2000;
  const sim = new Life(session, life, (it) => inst.get(it) ?? -1);
  return { net, world, sim, session };
}

test('traffic keeps moving, stays finite and inside the town', () => {
  const { world, sim, session } = setup();
  const start = sim.cars.map((a) => [world.x[a.i], world.z[a.i]]);
  for (let k = 0; k < 3600; k++) {
    session.time += 1 / 30;
    sim.update(1 / 30);
  }
  let moved = 0;
  sim.cars.forEach((a, k) => {
    const x = world.x[a.i],
      z = world.z[a.i];
    assert.ok(Number.isFinite(x) && Number.isFinite(z), 'finite position');
    assert.ok(x > -200 && x < 560 && z > -20 && z < 380, `inside the town: ${x.toFixed(1)}, ${z.toFixed(1)}`);
    if (Math.hypot(x - start[k][0], z - start[k][1]) > 20) moved++;
  });
  assert.ok(moved > sim.cars.length * 0.8, `${moved}/${sim.cars.length} cars moved`);
});

test('cars in the same lane keep their distance', () => {
  const { sim } = setup(60, 0);
  let worst = Infinity;
  for (let k = 0; k < 2400; k++) {
    sim.update(1 / 30);
    if (k % 30) continue;
    for (const arr of sim.laneCars)
      for (const a of arr)
        for (const b of arr) {
          if (a === b || a.conn || b.conn) continue;
          const gap = Math.abs(a.s - b.s) - (a.len + b.len) / 2;
          worst = Math.min(worst, gap);
        }
  }
  assert.ok(worst > -0.5, `closest gap ${worst.toFixed(2)} m`);
});

test('signals cycle and cars stop for the ball', () => {
  const { sim, session, world } = setup(30, 0);
  const sig = sim.sig.find((g) => g);
  assert.ok(sig, 'arterial junctions are signalised');
  const phases = new Set();
  for (let k = 0; k < 1200; k++) {
    sim.update(1 / 20);
    phases.add(sig.phase);
  }
  assert.equal(phases.size, 6);
  // park the ball right in front of a car: it must stop
  const a = sim.cars.find((c) => !c.conn && c.v > 1);
  assert.ok(a);
  session.ball.pos.x = world.x[a.i] + a.hx * 8;
  session.ball.pos.z = world.z[a.i] + a.hz * 8;
  session.ball.r = 2;
  for (let k = 0; k < 120; k++) sim.update(1 / 30);
  assert.ok(a.v < 0.3, `car speed ${a.v.toFixed(2)}`);
});

test('a picked-up car is dropped for good', () => {
  const { sim, world } = setup(10, 0);
  const a = sim.cars[0];
  world.state[a.i] = GONE;
  sim.release(a.i);
  sim.update(1 / 30);
  assert.ok(a.dead);
  assert.ok(!sim.laneCars.some((arr) => arr.includes(a)));
});

test('no two cars ever overlap, junctions included', () => {
  const { sim, world } = setup(70, 0);
  let worst = Infinity,
    at = '';
  for (let k = 0; k < 3000; k++) {
    sim.update(1 / 30);
    if (k % 10) continue;
    const live = sim.cars.filter((a) => !a.dead);
    for (let i = 0; i < live.length; i++)
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i],
          b = live[j];
        const d = Math.hypot(world.x[a.i] - world.x[b.i], world.z[a.i] - world.z[b.i]);
        if (d < worst) {
          worst = d;
          at = `frame ${k}: ${a.conn ? 'junction' : 'lane ' + a.lane} / ${b.conn ? 'junction' : 'lane ' + b.lane}`;
        }
      }
  }
  assert.ok(worst > 2.4, `closest cars ${worst.toFixed(2)} m (${at})`);
});
