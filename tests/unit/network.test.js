import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Network, arc } from '../../src/levels/city/network.js';

function grid() {
  // 3x3 grid of streets 100 m apart, all edges meeting at 4-way/3-way nodes
  const net = new Network();
  const id = {};
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) id[i + ',' + j] = net.node(i * 100, j * 100);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      if (i < 2) net.edge(id[i + ',' + j], id[i + 1 + ',' + j], { cls: 'street' });
      if (j < 2) net.edge(id[i + ',' + j], id[i + ',' + (j + 1)], { cls: 'street' });
    }
  return net.build();
}

test('grid network is connected, lanes both ways, no dead ends', () => {
  const net = grid();
  const s = net.stats();
  assert.equal(s.components, 1);
  assert.equal(s.deadEnds, 0); // outer corners are degree 2
});

test('arms of a 4-way node are trimmed by the crossing road half-width', () => {
  const net = grid();
  const centre = net.nodes.find((n) => n.x === 100 && n.z === 100);
  assert.equal(centre.deg, 4);
  for (const a of centre.arms) assert.ok(Math.abs(a.trim - 4.5) < 1e-6, `trim ${a.trim}`);
  assert.ok(centre.patch.along >= 4.5 && centre.patch.across >= 4.5);
});

test('right-hand traffic: the a->b lane lies right of travel', () => {
  const net = new Network();
  const a = net.node(0, 0),
    b = net.node(0, 100); // travelling +z: right of travel is -x
  net.edge(a, b, { cls: 'street' });
  net.build();
  const l0 = net.lanes.find((l) => l.dir === 0);
  assert.ok(l0.pts[0][0] < 0, `lane x ${l0.pts[0][0]}`);
  const l1 = net.lanes.find((l) => l.dir === 1);
  assert.ok(l1.pts[0][0] > 0);
});

test('sidewalks stop at corners of a T junction but run on along the through side', () => {
  const net = new Network();
  const w = net.node(-100, 0),
    c = net.node(0, 0),
    e = net.node(100, 0),
    s = net.node(0, 100);
  net.edge(w, c, { cls: 'street' });
  net.edge(c, e, { cls: 'street' });
  net.edge(c, s, { cls: 'street' }); // side street to +z
  net.build();
  const e0 = net.edges[0]; // w -> c travelling +x: right of travel is -z... (−dz, dx) = (0, 1) => +z
  // +z side (right of travel) has the side street: trimmed; -z side runs on (trim 0)
  assert.ok(e0.walkR.s1 < e0.len - 3, 'right sidewalk trimmed at the corner');
  assert.ok(Math.abs(e0.walkL.s1 - e0.len) < 1e-6, 'left sidewalk runs through');
});

test('arc helper produces points on the circle', () => {
  const p = arc(0, 0, 50, 0, Math.PI / 2, 5);
  for (const [x, z] of p) assert.ok(Math.abs(Math.hypot(x, z) - 50) < 1e-9);
  assert.deepEqual(p[0].map((v) => +v.toFixed(6)), [0, 50]);
});

test('walk path ends link across roads', () => {
  const net = grid();
  const linked = net.walks.filter((w) => w.links[0].length + w.links[1].length > 0).length;
  assert.equal(linked, net.walks.length);
});
