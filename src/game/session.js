// One play session of one level: builds the world from the layout, runs the fixed-step
// simulation, pickups/bumps/knock-offs, creatures, timer, milestones; emits events for UI/audio.
import * as THREE from 'three';
import { World, ALIVE, MOVING, GONE } from './world.js';
import { Ball, PHYS } from './ball.js';
import { Crust } from './crust.js';
import { FollowCamera } from './camera.js';
import { Particles, SHAPE } from './particles.js';
import { Environment, makeBlobMaterial } from '../render/environment.js';
import { makeToonMaterial, makeOutlineMaterial, makeCoreMaterial, shared, linearRGB } from '../render/materials.js';
import { SKINS, PATTERNS } from './skins.js';
import { PAL, HEX } from '../render/palette.js';
import * as rules from './rules.js';
import { Lint } from './lint.js';

const STEP = 1 / 60;
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const POPPED = new Int32Array(64);

/** palette geometry helper for trivial shapes (core sphere etc.) */
export function paletteGeometry(geo, palIdx) {
  const n = geo.attributes.position.count;
  const a = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) a[i * 2] = palIdx;
  geo.setAttribute('aPal', new THREE.BufferAttribute(a, 2));
  geo.setAttribute('aOutN', geo.attributes.normal.clone());
  return geo;
}

class Flyer {
  constructor() {
    this.mat = makeToonMaterial();
    this.mesh = new THREE.Mesh(undefined, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.visible = false;
    this.active = false;
    this.from = new THREE.Matrix4();
    this.local = new THREE.Matrix4();
    this.t = 0;
  }
}

export class Session {
  constructor(game, level, mode) {
    this.game = game;
    this.level = level;
    this.mode = mode; // 'zen' | 'timed'
    this.lib = game.lib;
    this.scene = new THREE.Scene();
    this.events = game.events;
    this.time = 0;
    this.timeLeft = level.time;
    this.acc = 0;
    this.over = false;
    this.paused = false;
    this.reachedTarget = false;
    this.collected = new Map(); // type id -> count
    this.collectOrder = []; // type ids in order of first pickup this session
    this.pickups = 0;
    this.combo = 0;
    this.comboT = 0;
    this.nextMilestone = 0;
    this.creatures = [];
    this.fallers = []; // {i, vx, vy, vz, sx, sz}
    this.wobbles = []; // {i, t, amp}
    this.tinyAcc = 0;
    this.lastTinyFx = 0;
    this.biggest = null;
  }

  build() {
    const L = this.level;
    const lib = this.lib;
    const mod = L.mod;
    // environment
    this.env = new Environment(mod.env);
    this.scene.add(this.env.group);
    this.scene.background = this.env.skyTexture;
    if (mod.env.fog) {
      shared.uFogNear.value = mod.env.fog[0];
      shared.uFogFar.value = mod.env.fog[1];
      linearRGB(HEX[mod.env.fog[2]] || mod.env.fog[2], shared.uFogColor.value);
    } else {
      shared.uFogNear.value = 1e7;
      shared.uFogFar.value = 2e7;
    }
    // world
    const layout = mod.layout(lib);
    this.layoutMissing = [...layout.missing];
    const b = mod.bounds;
    const pad = 4;
    this.world = new World({
      types: lib.types,
      capacity: layout.items.length + 16,
      bounds: { minX: b.minX - pad * L.cell, minZ: b.minZ - pad * L.cell, maxX: b.maxX + pad * L.cell, maxZ: b.maxZ + pad * L.cell },
      cellSize: L.cell,
    });
    const placed = new Map();
    for (const it of layout.items) {
      const t = lib.byId.get(it.id);
      const i = this.world.add(t.idx, it.x, it.y, it.z, it.yaw, it.scale, it.tint ? PAL[it.tint] + 1 : 0);
      placed.set(it, i);
      if (it.on) this.world.restOn[i] = placed.get(it.on) ?? -1;
      if (t.flags.includes('wander') && !it.on) this.creatures.push({ i, heading: Math.random() * 6.28, timer: 0, speed: 0 });
    }
    this.world.buildBatches(this.scene, this.game.quality);
    this.totalObjects = layout.items.length;

    // ball
    this.ball = new Ball();
    this.ball.handler = this;
    const sp = mod.spawn;
    this.ball.reset(sp.x, this.env.groundAt(sp.x, sp.z), sp.z, L.start / 2);
    this.rVis = this.ball.r;
    this.rPop = 0;
    this.ballGroup = new THREE.Group();
    const coreGeo = paletteGeometry(new THREE.IcosahedronGeometry(1, 3), PAL.lavender);
    this.coreGeo = coreGeo;
    this.coreMat = makeCoreMaterial();
    this.coreFlash = this.coreMat.uniforms.uFlash;
    this.setSkin(this.game.skinId || 'lavender');
    this.coreOutMat = makeOutlineMaterial(1, { outlinePx: { value: 3.2 } });
    this.core = new THREE.Mesh(coreGeo, this.coreMat);
    this.coreOut = new THREE.Mesh(coreGeo, this.coreOutMat);
    this.ballGroup.add(this.core, this.coreOut);
    this.crust = this.game.crust;
    this.crust.reset();
    this.ballGroup.add(this.crust.mesh, this.crust.outline);
    this.scene.add(this.ballGroup);
    this.coreOutMat.uniforms.uObjSize.value = 100;


    // blob shadow under the ball
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), makeBlobMaterial(0.25));
    this.scene.add(this.blob);

    // flying pickups
    this.flyers = [];
    for (let k = 0; k < 10; k++) {
      const f = new Flyer();
      this.flyers.push(f);
      this.scene.add(f.mesh);
    }
    this.particles = new Particles();
    this.particles.budget = this.game.quality.particles;
    this.scene.add(this.particles.mesh);

    // Lint
    this.lint = new Lint(lib);
    this.scene.add(this.lint.group);

    // camera
    this.camera = this.game.camera;
    this.cam = new FollowCamera(this.camera);
    this.cam.reducedMotion = this.game.reducedMotion;
    this.cam.reset(this.ball, sp.yaw);
    this.nextMilestone = rules.milestoneAfter(this.ball.diameter);
    this.startDiameter = this.ball.diameter;
    this.events.emit('session:start', this);
  }

  setSkin(id) {
    const skin = SKINS.find((s) => s.id === id) || SKINS[0];
    linearRGB(HEX[skin.a], this.coreMat.uniforms.uA.value);
    linearRGB(HEX[skin.b], this.coreMat.uniforms.uB.value);
    this.coreMat.uniforms.uPattern.value = PATTERNS[skin.pattern];
  }

  // ------------------------------------------------------------ ball handler callbacks
  pickup(i, nx, ny, nz) {
    const w = this.world;
    const t = w.types[w.type[i]];
    const ball = this.ball;
    const r = ball.r;
    // attach pose: keep orientation, move centre onto the surface along the contact direction
    _m.fromArray(w.mat, i * 16);
    const cy = t.dims[1] * 0.5 * w.scale[i];
    _v.set(0, t.dims[1] * 0.5, 0).applyMatrix4(_m); // object centre (world)
    _v2.copy(_v).sub(ball.pos);
    let len = _v2.length();
    if (len < 1e-6) {
      _v2.set(-nx, -ny, -nz);
      len = 1;
    }
    _v2.multiplyScalar(1 / len);
    const minHalf = Math.min(t.dims[0], t.dims[1], t.dims[2]) * 0.5 * w.scale[i];
    const dist = r * 0.93 + minHalf * 0.6;
    const ox = ball.pos.x + _v2.x * dist - _v.x;
    const oy = ball.pos.y + _v2.y * dist - _v.y;
    const oz = ball.pos.z + _v2.z * dist - _v.z;
    _m.elements[12] += ox;
    _m.elements[13] += oy;
    _m.elements[14] += oz;
    // to ball-local
    _m2.compose(ball.pos, ball.quat, _one);
    _inv.copy(_m2).invert();
    const f = this.flyers.find((f) => !f.active) || this.flyers[0];
    if (f.active) this.finishFlyer(f);
    f.active = true;
    f.inst = i;
    f.t = 0;
    f.type = t;
    f.from.fromArray(w.mat, i * 16);
    f.local.multiplyMatrices(_inv, _m);
    f.dist = dist;
    _v.set(_v2.x, _v2.y, _v2.z).applyQuaternion(_q.copy(ball.quat).invert());
    f.lx = _v.x * dist;
    f.ly = _v.y * dist;
    f.lz = _v.z * dist;
    f.mesh.geometry = t.geo[0];
    f.mat.uniforms.uTint.value = w.tint[i];
    f.mesh.visible = true;

    w.remove(i);
    this.dropChildren(i);
    const vol = t.vol * w.scale[i] ** 3;
    const before = ball.diameter;
    const gained = rules.gainVolume(ball.r, vol, w.size[i]);
    ball.r = rules.radiusFromVolume(rules.sphereVolume(ball.r) + gained);
    f.gained = gained;
    this.rPop = Math.min(0.12, this.rPop + 0.03 + (0.25 * vol) / (rules.sphereVolume(r) + 1e-12));
    this.count(t);
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 0.9;
    const rel = w.size[i] / (2 * r); // 0..0.5
    this.events.emit('pickup', { type: t, rel, combo: this.combo, before, after: ball.diameter, session: this });
    // sparkles
    const cx = f.from.elements[12],
      cyw = f.from.elements[13] + cy,
      cz = f.from.elements[14];
    const pals = t.colors.filter((c) => c !== 'ink');
    this.particles.burst(cx, cyw, cz, 4 + Math.round(rel * 10), r * 1.4, r * 0.16 + w.size[i] * 0.15, 0.45, pals.length ? pals : ['sun'], SHAPE.star, 0, 0.6);
    this.checkMilestone();
  }

  tiny(i) {
    const w = this.world;
    const t = w.types[w.type[i]];
    w.remove(i);
    this.dropChildren(i);
    this.ball.r = rules.grow(this.ball.r, t.vol * w.scale[i] ** 3, w.size[i]);
    this.count(t);
    this.tinyAcc++;
    if (this.time - this.lastTinyFx > 0.12) {
      this.lastTinyFx = this.time;
      this.particles.burst(w.x[i], w.y[i], w.z[i], 2, this.ball.r * 0.6, this.ball.r * 0.08, 0.35, ['paper', 'sun'], SHAPE.puff);
      this.events.emit('tiny', { type: t, session: this });
    }
  }

  count(t) {
    const c = this.collected.get(t.id) || 0;
    if (!c) this.collectOrder.push(t.id);
    this.collected.set(t.id, c + 1);
    this.pickups++;
    if (!this.biggest || t.size > this.biggest.size) this.biggest = t;
  }

  /** Objects resting on a collected object fall down. */
  dropChildren(i) {
    const w = this.world;
    for (let k = 0; k < w.n; k++) {
      if (w.restOn[k] !== i || w.state[k] === GONE) continue;
      w.restOn[k] = -1;
      if (w.state[k] === ALIVE) {
        w.state[k] = MOVING;
        this.fallers.push({ i: k, vx: 0, vy: 0, vz: 0, sx: 0, sz: 0, land: false });
      }
    }
  }

  wobble(i, impact) {
    if (this.wobbles.some((wb) => wb.i === i)) return;
    this.wobbles.push({ i, t: 0, amp: Math.min(0.35, 0.12 + impact * 0.25), dir: Math.random() < 0.5 ? -1 : 1 });
    this.events.emit('wobble', { type: this.world.types[this.world.type[i]], session: this });
  }

  bump(i, impact, nx, ny, nz) {
    const ball = this.ball;
    const w = this.world;
    const t = w.types[w.type[i]];
    this.cam.shake(Math.min(0.5, 0.08 + impact * 0.22));
    this.lint.flinch();
    this.particles.burst(ball.pos.x - nx * ball.r, ball.pos.y - ball.r * 0.4, ball.pos.z - nz * ball.r, 6, ball.r * 1.2, ball.r * 0.22, 0.5, ['paper', 'cloud'], SHAPE.puff, 0, 0.2);
    let knocked = 0;
    if (impact > 0.6) {
      const n = Math.min(POPPED.length, Math.floor(1 + (impact - 0.6) * 5));
      knocked = this.knockOff(n, nx, nz);
    }
    this.events.emit('bump', { type: t, impact, knocked, session: this });
  }

  knockOff(n, nx, nz) {
    const ball = this.ball;
    const crust = this.crust;
    const k = crust.popRecent(n, POPPED);
    const w = this.world;
    for (let j = 0; j < k; j++) {
      const it = POPPED[j];
      const i = crust.inst[it];
      const t = w.types[w.type[i]];
      _v.set(crust.loc[it * 3], crust.loc[it * 3 + 1], crust.loc[it * 3 + 2]).applyQuaternion(ball.quat);
      w.x[i] = ball.pos.x + _v.x;
      w.y[i] = Math.max(this.env.groundAt(0, 0), ball.pos.y + _v.y - t.dims[1] * 0.5 * w.scale[i]);
      w.z[i] = ball.pos.z + _v.z;
      w.yaw[i] = Math.random() * 6.28;
      w.revive(i, MOVING);
      const sp = ball.r * (2.5 + Math.random() * 2);
      const dl = Math.hypot(_v.x, _v.z) || 1;
      this.fallers.push({
        i,
        vx: (_v.x / dl) * sp * 0.6 + nx * sp * 0.5,
        vy: ball.r * (5 + Math.random() * 3),
        vz: (_v.z / dl) * sp * 0.6 + nz * sp * 0.5,
        sx: (Math.random() - 0.5) * 14,
        sz: (Math.random() - 0.5) * 14,
        land: false,
      });
      ball.r = rules.shrink(ball.r, crust.vol[it], ball.minR);
      const c = this.collected.get(t.id) || 1;
      this.collected.set(t.id, c - 1);
      this.pickups--;
    }
    return k;
  }

  checkMilestone() {
    const d = this.ball.diameter;
    if (d >= this.nextMilestone) {
      const m = this.nextMilestone;
      this.nextMilestone = rules.milestoneAfter(d);
      this.cam.kick(7, 0.12);
      this.coreFlash.value = 0.7;
      const b = this.ball;
      this.particles.burst(b.pos.x, b.pos.y + b.r, b.pos.z, 40, b.r * 3, b.r * 0.22, 1.2, ['flamingo', 'sun', 'sky', 'lime', 'grape', 'tangerine'], SHAPE.confetti, b.r * 6, 1.2);
      this.lint.celebrate(1);
      this.events.emit('milestone', { size: m, session: this });
    }
    if (!this.reachedTarget && rules.isCompleted(d, this.level.target)) {
      this.reachedTarget = true;
      this.events.emit('target', { session: this });
    }
  }

  finishFlyer(f) {
    f.active = false;
    f.mesh.visible = false;
    const w = this.world;
    const i = f.inst;
    const t = f.type;
    const s = w.scale[i];
    const useLod0 = t.size * s > this.ball.r * 0.35 || !t.geo[1];
    this.crust.add(useLod0 ? t.geo[0] : t.geo[1], f.local, w.tint[i], i, f.dist, t.bound * s, f.gained, f.lx, f.ly, f.lz, w.size[i]);
  }

  // ------------------------------------------------------------ update
  update(dtRaw, input) {
    if (this.paused || this.over) return;
    const dt = Math.min(dtRaw, 0.1);
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 4) {
      this.ball.step(STEP, input.x, input.y, this.cam.yaw, this.world, this.env);
      this.acc -= STEP;
      steps++;
    }
    if (steps === 4) this.acc = 0;
    this.time += dt;
    if (this.mode === 'timed') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.end('time');
        return;
      }
    }
    this.comboT -= dt;
    this.updateCreatures(dt);
    this.updateFallers(dt);
    this.updateWobbles(dt);
    this.updateBallVisual(dt);
    this.cam.update(dt, this.ball, input);
    const lintSize = this.level.start * 0.6 * Math.pow(this.ball.diameter / this.level.start, 0.35);
    this.lint.update(dt, this.ball, this.cam.yaw, lintSize, this.env.groundAt(this.ball.pos.x, this.ball.pos.z));
    this.updateFlyers(dt);
    this.particles.update(dt);
    this.crust.bury(this.rVis * 0.9, this.ball.r * 0.035, this.time);
    shared.uFocalPx.value = this.game.focalPx;
  }

  updateBallVisual(dt) {
    const b = this.ball;
    this.rVis += (b.r - this.rVis) * (1 - Math.exp(-dt * 7));
    this.rPop *= Math.exp(-dt * 7);
    this.coreFlash.value *= Math.exp(-dt * 5);
    this.ballGroup.position.copy(b.pos);
    this.ballGroup.quaternion.copy(b.quat);
    const cr = this.rVis * 0.95 * (1 + this.rPop);
    this.core.scale.setScalar(cr);
    this.coreOut.scale.setScalar(cr);
    // shadow on the ground below
    const gy = this.env.groundAt(b.pos.x, b.pos.z);
    const h = Math.max(0, b.pos.y - b.r - gy);
    const k = Math.max(0, 1 - h / (b.r * 6));
    this.blob.position.set(b.pos.x + b.r * 0.15, gy + b.r * 0.01, b.pos.z - b.r * 0.1);
    this.blob.scale.setScalar(b.r * 1.25 * (0.6 + 0.4 * k));
    this.blob.visible = k > 0.02;
  }

  updateFlyers(dt) {
    const b = this.ball;
    _m2.compose(b.pos, b.quat, _one);
    for (const f of this.flyers) {
      if (!f.active) continue;
      f.t += dt / 0.16;
      if (f.t >= 1) {
        this.finishFlyer(f);
        continue;
      }
      const e = 1 - (1 - f.t) * (1 - f.t);
      _m.multiplyMatrices(_m2, f.local);
      f.from.decompose(_v, _q, _s);
      _m.decompose(_v2, _q2, _s);
      _v.lerp(_v2, e);
      _v.y += Math.sin(f.t * Math.PI) * b.r * 0.5;
      _q.slerp(_q2, e);
      const pop = 1 + Math.sin(f.t * Math.PI) * 0.35;
      f.mesh.matrix.compose(_v, _q, _s.multiplyScalar(pop));
      f.mesh.matrixWorld.copy(f.mesh.matrix);
    }
  }

  updateCreatures(dt) {
    const w = this.world;
    const b = this.ball;
    const D = b.diameter;
    const B = this.level.mod.bounds;
    for (const c of this.creatures) {
      const i = c.i;
      if (w.state[i] === GONE) continue;
      const dx = w.x[i] - b.pos.x,
        dz = w.z[i] - b.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > (b.r * 60) ** 2) continue;
      const t = w.types[w.type[i]];
      const size = w.size[i];
      let speed = Math.max(size * 0.9, 0.004);
      const edible = rules.canPickUp(size, D);
      if (edible && t.flags.includes('flee') && d2 < (b.r * 6) ** 2) {
        c.heading = Math.atan2(dx, dz) + Math.sin(this.time * 3 + i) * 0.4;
        speed *= 2.6;
        c.timer = 0.6;
      } else {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.timer = 1 + Math.random() * 2.5;
          c.heading += (Math.random() - 0.5) * 2.2;
          c.speed = Math.random() < 0.25 ? 0 : 1;
        }
        speed *= c.speed;
      }
      if (speed <= 0) continue;
      let nx = w.x[i] + Math.sin(c.heading) * speed * dt;
      let nz = w.z[i] + Math.cos(c.heading) * speed * dt;
      const r = w.bound[i];
      if (nx < B.minX + r || nx > B.maxX - r || nz < B.minZ + r || nz > B.maxZ - r) {
        c.heading += Math.PI * (0.7 + Math.random() * 0.6);
        continue;
      }
      w.x[i] = nx;
      w.z[i] = nz;
      w.yaw[i] = c.heading;
      if (w.state[i] === ALIVE) w.state[i] = MOVING;
      w.moved(i);
    }
  }

  updateFallers(dt) {
    const w = this.world;
    const g = PHYS.gravity * this.ball.r * 0.8;
    for (let k = this.fallers.length - 1; k >= 0; k--) {
      const f = this.fallers[k];
      const i = f.i;
      if (w.state[i] === GONE) {
        this.fallers.splice(k, 1);
        continue;
      }
      f.vy -= g * dt;
      w.x[i] += f.vx * dt;
      w.y[i] += f.vy * dt;
      w.z[i] += f.vz * dt;
      w.tilt[i * 2] += f.sx * dt;
      w.tilt[i * 2 + 1] += f.sz * dt;
      const gy = this.env.groundAt(w.x[i], w.z[i]);
      const B = this.level.mod.bounds;
      w.x[i] = Math.min(B.maxX - w.bound[i] * 0.5, Math.max(B.minX + w.bound[i] * 0.5, w.x[i]));
      w.z[i] = Math.min(B.maxZ - w.bound[i] * 0.5, Math.max(B.minZ + w.bound[i] * 0.5, w.z[i]));
      if (w.y[i] <= gy && f.vy < 0) {
        w.y[i] = gy;
        w.tilt[i * 2] = 0;
        w.tilt[i * 2 + 1] = 0;
        w.state[i] = ALIVE;
        this.fallers.splice(k, 1);
      }
      w.moved(i);
    }
  }

  updateWobbles(dt) {
    const w = this.world;
    for (let k = this.wobbles.length - 1; k >= 0; k--) {
      const wb = this.wobbles[k];
      wb.t += dt;
      const i = wb.i;
      const done = wb.t > 0.7 || w.state[i] === GONE;
      const a = done ? 0 : wb.amp * Math.sin(wb.t * 22) * (1 - wb.t / 0.7);
      w.tilt[i * 2] = a * wb.dir;
      w.tilt[i * 2 + 1] = a * 0.5;
      w.updateMatrix(i);
      if (done) this.wobbles.splice(k, 1);
    }
  }

  render(renderer) {
    this.world.updateRender(this.camera, this.game.focalPx);
    renderer.render(this.scene, this.camera);
  }

  end(reason) {
    if (this.over) return;
    this.over = true;
    for (const f of this.flyers) if (f.active) this.finishFlyer(f);
    const d = this.ball.diameter;
    const result = {
      level: this.level,
      mode: this.mode,
      reason,
      diameter: d,
      target: this.level.target,
      completed: rules.isCompleted(d, this.level.target),
      stars: this.mode === 'timed' ? rules.starsFor(d, this.level.target) : 0,
      collected: this.collected,
      order: this.collectOrder,
      pickups: this.pickups,
      time: this.time,
      biggest: this.biggest,
    };
    this.events.emit('session:end', result);
    return result;
  }

  dispose() {
    this.world.dispose();
    this.env.dispose();
    this.ballGroup.remove(this.crust.mesh, this.crust.outline);
    this.coreGeo.dispose();
    this.coreMat.dispose();
    this.coreOutMat.dispose();
    this.blob.geometry.dispose();
    this.blob.material.dispose();
    for (const f of this.flyers) f.mat.dispose();
    this.lint.dispose();
    this.particles.mesh.geometry.dispose();
    this.particles.mat.dispose();
    this.scene.clear();
  }
}
