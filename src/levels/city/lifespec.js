// Helpers that populate a level's life spec (src/game/life.js) from its road network: traffic in lanes,
// pedestrians on sidewalks (some walking dogs), traffic lights and stop signs at junctions, flocks.
import { sample } from './network.js';

export function lifeSpec(net) {
  return { net, cars: [], peds: [], followers: [], grazers: [], flocks: [], movers: [], spinners: [], signals: [] };
}

const have = (L, ids) => ids.filter((id) => L.lib.byId.has(id));

/**
 * count vehicles spread over the lanes (weighted by lane length x laneWeight(lane)), spaced >= 12 m apart.
 * mix: [[id, weight], ...]
 */
export function spawnTraffic(L, life, net, count, mix, { laneWeight = () => 1, speed = 1 } = {}) {
  const ids = mix.filter(([id]) => L.lib.byId.has(id));
  if (!ids.length) return;
  const total = ids.reduce((a, [, w]) => a + w, 0);
  const lanes = net.lanes.filter((l) => l.len > 14 && laneWeight(l) > 0);
  const wsum = lanes.reduce((a, l) => a + l.len * laneWeight(l), 0);
  const taken = new Map();
  let placed = 0;
  for (let tries = 0; tries < count * 8 && placed < count; tries++) {
    let r = L.rand() * wsum,
      lane = lanes[0];
    for (const l of lanes) {
      r -= l.len * laneWeight(l);
      if (r <= 0) {
        lane = l;
        break;
      }
    }
    const s = 5 + L.rand() * (lane.len - 10);
    const arr = taken.get(lane.id) || [];
    if (arr.some((o) => Math.abs(o - s) < 14)) continue;
    arr.push(s);
    taken.set(lane.id, arr);
    let pick = L.rand() * total,
      id = ids[0][0];
    for (const [k, w] of ids) {
      pick -= w;
      if (pick <= 0) {
        id = k;
        break;
      }
    }
    const q = sample(lane.pts, lane.L, s);
    const it = L.put(id, q.x, q.z, { yaw: Math.atan2(q.dx, q.dz) - Math.PI / 2, y: lane.y || 0 });
    if (!it) continue;
    life.cars.push({ it, lane: lane.id, s, speed });
    placed++;
  }
  return placed;
}

/** pedestrians on sidewalks; `dogs` fraction walk a dog on a lead */
export function spawnWalkers(L, life, net, count, { ids = ['person_adult', 'person_adult2', 'person_kid', 'person_grandpa', 'person_teen', 'person_business'], joggers = 0.12, dogs = 0.15, walkWeight = () => 1 } = {}) {
  const pool = have(L, ids);
  const walks = net.walks.filter((w) => w.L[w.L.length - 1] > 8 && walkWeight(w) > 0);
  if (!pool.length || !walks.length) return 0;
  const wsum = walks.reduce((a, w) => a + w.L[w.L.length - 1] * walkWeight(w), 0);
  let placed = 0;
  for (let k = 0; k < count; k++) {
    let r = L.rand() * wsum,
      wk = walks[0];
    for (const w of walks) {
      r -= w.L[w.L.length - 1] * walkWeight(w);
      if (r <= 0) {
        wk = w;
        break;
      }
    }
    const len = wk.L[wk.L.length - 1];
    const s = L.rand() * len;
    const q = sample(wk.pts, wk.L, s);
    const jog = L.rand() < joggers && L.lib.byId.has('person_jogger');
    const id = jog ? 'person_jogger' : L.pick(pool);
    const it = L.put(id, q.x, q.z, { yaw: Math.atan2(q.dx, q.dz) });
    if (!it) continue;
    const ped = { it, walk: wk.id, s, dir: L.rand() < 0.5 ? 1 : -1, lat: (L.rand() - 0.5) * Math.max(0.2, wk.w - 1), speed: jog ? 2.9 : 1.05 + L.rand() * 0.45 };
    life.peds.push(ped);
    if (!jog && L.rand() < dogs && L.lib.byId.has('dog')) {
      const dog = L.put('dog', q.x + 1, q.z + 1);
      if (dog) life.followers.push({ it: dog, owner: it, side: 0.8, back: 1.3 });
    }
    placed++;
  }
  return placed;
}

/** pedestrians strolling round a closed path (park loops) */
export function spawnLoopWalkers(L, life, path, count, ids = ['person_adult', 'person_adult2', 'person_kid', 'person_grandpa'], { speed = [0.9, 1.4], dogs = 0.3 } = {}) {
  const pool = have(L, ids);
  const P = [...path, path[0]];
  let len = 0;
  for (let k = 1; k < P.length; k++) len += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
  for (let k = 0; k < count && pool.length; k++) {
    const s = L.rand() * len;
    // position will be set by the life system on its first update; start near the first point
    const it = L.put(L.pick(pool), P[0][0], P[0][1]);
    if (!it) continue;
    life.peds.push({ it, path: P, loop: true, s, dir: L.rand() < 0.5 ? 1 : -1, lat: (L.rand() - 0.5) * 0.8, speed: speed[0] + L.rand() * (speed[1] - speed[0]) });
    if (L.rand() < dogs && L.lib.byId.has('dog')) {
      const dog = L.put('dog', P[0][0] + 1, P[0][1]);
      if (dog) life.followers.push({ it: dog, owner: it });
    }
  }
}

/**
 * Traffic lights at signalised nodes: one mast-arm signal per approach, pole on the near-right corner,
 * arm reaching over the approach lanes. Group 0 = arms along the node's main axis.
 */
export function trafficLights(L, life, net, { id = 'traffic_light' } = {}) {
  if (!L.lib.byId.has(id)) return;
  const t = L.lib.byId.get(id);
  // distance from the model's bbox centre back to its pole (the mast arm reaches out along +x)
  const half = id === 'traffic_light' ? 2.625 : 0;
  for (const n of net.nodes) {
    if (!n.signal) continue;
    const lights = [];
    for (const arm of n.arms) {
      const e = net.edges[arm.e];
      if (e.oneway && arm.end === 0) continue; // one-way arm leaving the node: nobody approaches on it
      const dx = Math.sin(arm.ang),
        dz = Math.cos(arm.ang); // from the node out along the arm
      // traffic approaching travels -d; its right-hand curb is on the (dz, -dx) side
      const rx = dz,
        rz = -dx;
      const back = arm.trim + 4.5;
      const off = e.w / 2 + 1.1;
      const px = n.x + dx * back + rx * off,
        pz = n.z + dz * back + rz * off;
      // the model's arm extends along local +x from the pole: aim it over the lanes (towards -right)
      const yaw = arm.ang + Math.PI;
      const c = Math.cos(yaw),
        s = Math.sin(yaw);
      // the instance is placed by its bbox centre: shift so the pole lands on (px,pz)
      const it = L.put(id, px + c * half, pz - s * half, { yaw });
      if (!it) continue;
      const group = Math.abs(Math.sin(arm.ang - n.mainAng)) < 0.5 ? 0 : 1;
      lights.push({ it, group });
    }
    if (lights.length) life.signals.push({ node: n.id, lights });
  }
}

/** stop signs on every approach to an unsignalised junction */
export function stopSigns(L, net) {
  if (!L.lib.byId.has('stop_sign')) return;
  for (const n of net.nodes) {
    if (!n.stop || n.deg < 3) continue;
    for (const arm of n.arms) {
      const e = net.edges[arm.e];
      if (e.cls === 'lane') continue;
      const dx = Math.sin(arm.ang),
        dz = Math.cos(arm.ang);
      const rx = dz,
        rz = -dx;
      const back = arm.trim + 4;
      const off = e.w / 2 + Math.min(1.2, e.verge * 0.6 + 0.4);
      L.put('stop_sign', n.x + dx * back + rx * off, n.z + dz * back + rz * off, { yaw: arm.ang });
    }
  }
}

/** a flock of birds on the ground at (x,z) */
export function flock(L, life, x, z, n, { id = 'pigeon', r = 3, y = 0, homes = null } = {}) {
  if (!L.lib.byId.has(id)) return;
  const its = [];
  for (let k = 0; k < n; k++) {
    const a = L.rand() * Math.PI * 2,
      d = Math.sqrt(L.rand()) * r;
    const it = L.put(id, x + Math.sin(a) * d, z + Math.cos(a) * d, { y });
    if (it) its.push(it);
  }
  // birds are modelled facing +x: turn them so they fly beak first
  if (its.length) life.flocks.push({ its, x, z, r, y, homes, yawOff: -Math.PI / 2 });
}
