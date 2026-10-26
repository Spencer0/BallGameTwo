// Ball physics: radius-normalised movement, ground + static boxes, object colliders (yaw box /
// cylinder / sphere), climbing, pickups and bumps. Allocation-free per step.
import * as THREE from 'three';
import { canPickUp, isAlmost, isTiny } from './rules.js';
import { ALIVE, MOVING } from './world.js';

const UP = new THREE.Vector3(0, 1, 0);
const _axis = new THREE.Vector3();
const _dq = new THREE.Quaternion();
const QUERY = new Int32Array(1024);

export const PHYS = {
  speed: 4.4, // top speed in radii per second
  accel: 9.0, // radii / s^2
  dragIdle: 2.6, // 1/s when no input
  dragMove: 0.35,
  gravity: 26, // radii / s^2
  climbMax: 2.0, // climbable lip height in radii
  climbSpeed: 2.6, // radii / s
  restitution: 0.32,
  pickupReach: 1.06, // collectible things are picked up a touch before contact
};

export class Ball {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.r = 0.02;
    this.minR = 0.02;
    this.grounded = false;
    this.climbing = false;
    this.wantDir = new THREE.Vector3(); // desired move direction (world, horizontal)
    this.handler = null; // { pickup(i, nx, ny, nz), bump(i, impact, nx, ny, nz), wobble(i), tiny(i) }
    this.bumpCooldown = 0;
  }

  get diameter() {
    return this.r * 2;
  }

  reset(x, y, z, r) {
    this.pos.set(x, y + r, z);
    this.vel.set(0, 0, 0);
    this.quat.identity();
    this.r = r;
    this.minR = r * 0.9;
  }

  /**
   * @param dt     seconds
   * @param ix,iy  input (right, forward) -1..1
   * @param yaw    camera heading (forward = (sin yaw, 0, cos yaw))
   */
  step(dt, ix, iy, yaw, world, env) {
    const r = this.r;
    const fx = Math.sin(yaw),
      fz = Math.cos(yaw);
    const rx = -fz,
      rz = fx; // right = forward x up
    let wx = fx * iy + rx * ix,
      wz = fz * iy + rz * ix;
    const wl = Math.hypot(wx, wz);
    this.wantDir.set(wl > 0 ? wx / wl : 0, 0, wl > 0 ? wz / wl : 0);
    const input = Math.min(1, wl);
    const vmax = PHYS.speed * r;
    // acceleration towards desired direction
    this.vel.x += wx * PHYS.accel * r * dt;
    this.vel.z += wz * PHYS.accel * r * dt;
    // drag (stronger when idle) + speed cap
    const drag = input > 0.05 ? PHYS.dragMove : PHYS.dragIdle;
    const k = Math.exp(-drag * dt);
    this.vel.x *= k;
    this.vel.z *= k;
    // turning assist: bleed sideways velocity so steering feels responsive
    if (input > 0.05) {
      const along = this.vel.x * this.wantDir.x + this.vel.z * this.wantDir.z;
      const sx = this.vel.x - this.wantDir.x * along,
        sz = this.vel.z - this.wantDir.z * along;
      const kk = Math.exp(-2.2 * dt);
      this.vel.x = this.wantDir.x * along + sx * kk;
      this.vel.z = this.wantDir.z * along + sz * kk;
    }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const cap = vmax * Math.max(0.25, input);
    if (hs > cap && input > 0.05) {
      const s = cap / hs + (1 - cap / hs) * (1 - Math.exp(-4 * dt));
      this.vel.x *= s;
      this.vel.z *= s;
    } else if (hs > vmax * 1.6) {
      this.vel.x *= (vmax * 1.6) / hs;
      this.vel.z *= (vmax * 1.6) / hs;
    }
    // gravity
    this.vel.y -= PHYS.gravity * r * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    this.grounded = false;
    let climb = false;
    // ground
    const gy = env.groundAt(this.pos.x, this.pos.z);
    if (this.pos.y - r < gy) {
      this.pos.y = gy + r;
      if (this.vel.y < 0) this.vel.y = this.vel.y < -6 * r ? -this.vel.y * 0.2 : 0;
      this.grounded = true;
    }
    // static environment boxes (axis aligned)
    const boxes = env.boxes;
    for (let b = 0; b < boxes.length; b++) {
      const B = boxes[b];
      const qx = Math.max(B.minX, Math.min(this.pos.x, B.maxX));
      const qy = Math.max(B.minY, Math.min(this.pos.y, B.maxY));
      const qz = Math.max(B.minZ, Math.min(this.pos.z, B.maxZ));
      let dx = this.pos.x - qx,
        dy = this.pos.y - qy,
        dz = this.pos.z - qz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= r * r) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-7) {
        dy = 1;
        d = 1;
      }
      const nx = dx / d,
        ny = dy / d,
        nz = dz / d;
      this.resolve(nx, ny, nz, r - Math.min(d, r));
      if (ny > 0.55) this.grounded = true;
      else if (B.climb && Math.abs(ny) < 0.5 && this.wantsInto(nx, nz) && B.maxY - (this.pos.y - r) < PHYS.climbMax * r)
        climb = true;
    }
    // objects
    const reach = r * PHYS.pickupReach;
    const n = world.query(this.pos.x, this.pos.z, reach * 1.05, QUERY);
    const D = 2 * r;
    for (let q = 0; q < n; q++) {
      const i = QUERY[q];
      const st = world.state[i];
      if (st !== ALIVE && st !== MOVING) continue;
      const t = world.types[world.type[i]];
      const col = t.collider;
      const sc = world.scale[i];
      const yaw = world.yaw[i];
      const c = Math.cos(yaw),
        s = Math.sin(yaw);
      const dx = this.pos.x - world.x[i],
        dz = this.pos.z - world.z[i];
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const ly = this.pos.y - world.y[i] - col.cy * sc;
      let px, py, pz; // local closest point offset (ball centre - closest point)
      let top;
      if (col.kind === 'box') {
        const hx = col.half[0] * sc,
          hy = col.half[1] * sc,
          hz = col.half[2] * sc;
        px = lx - Math.max(-hx, Math.min(lx, hx));
        py = ly - Math.max(-hy, Math.min(ly, hy));
        pz = lz - Math.max(-hz, Math.min(lz, hz));
        if (px === 0 && py === 0 && pz === 0) {
          // centre inside: push out along the shallowest axis
          const ox = hx - Math.abs(lx),
            oy = hy - Math.abs(ly),
            oz = hz - Math.abs(lz);
          if (oy <= ox && oy <= oz) py = Math.sign(ly || 1) * 1e-4;
          else if (ox <= oz) px = Math.sign(lx || 1) * 1e-4;
          else pz = Math.sign(lz || 1) * 1e-4;
        }
        top = hy;
      } else if (col.kind === 'cyl') {
        const R = col.r * sc,
          hh = col.h * 0.5 * sc;
        const rr = Math.hypot(lx, lz);
        const k2 = rr > R ? R / rr : 1;
        px = lx - lx * k2;
        pz = lz - lz * k2;
        py = ly - Math.max(-hh, Math.min(ly, hh));
        if (px === 0 && py === 0 && pz === 0) py = 1e-4;
        top = hh;
      } else {
        const R = col.r * sc;
        const l = Math.hypot(lx, ly, lz) || 1e-6;
        const k2 = Math.min(1, R / l);
        px = lx - lx * k2;
        py = ly - ly * k2;
        pz = lz - lz * k2;
        if (l < R) {
          px = (lx / l) * 1e-4;
          py = (ly / l) * 1e-4;
          pz = (lz / l) * 1e-4;
        }
        top = R;
      }
      const d = Math.hypot(px, py, pz);
      const size = world.size[i];
      const collectible = canPickUp(size, D);
      if (collectible) {
        if (d < reach) {
          if (isTiny(size, r)) this.handler.tiny(i);
          else {
            const wnx = px * c + pz * s,
              wnz = -px * s + pz * c;
            this.handler.pickup(i, wnx, py, wnz);
          }
        }
        continue;
      }
      if (d >= r) continue;
      // obstacle: local normal back to world
      const inv = 1 / (d || 1);
      const lnx = px * inv,
        lny = py * inv,
        lnz = pz * inv;
      const nx = lnx * c + lnz * s;
      const nz = -lnx * s + lnz * c;
      const ny = lny;
      const vn = this.vel.x * nx + this.vel.y * ny + this.vel.z * nz;
      const lip = world.y[i] + (col.cy * sc + top) - (this.pos.y - r);
      const low = lip < PHYS.climbMax * r;
      this.resolve(nx, ny, nz, r - d, low);
      if (ny > 0.55) this.grounded = true;
      else if (low && ny > -0.3 && this.wantsInto(nx, nz)) climb = true; // walls and edges of low things
      if (!low && ny <= 0.55 && vn < 0) {
        const impact = -vn / (PHYS.speed * r);
        if (isAlmost(size, D)) this.handler.wobble(i, impact);
        if (impact > 0.35 && this.bumpCooldown <= 0) {
          this.bumpCooldown = 0.25;
          this.handler.bump(i, impact, nx, ny, nz);
        }
      } else if (low && vn < -0.2 * PHYS.speed * r && isAlmost(size, D)) this.handler.wobble(i, 0.3);
    }
    this.bumpCooldown -= dt;
    this.climbing = climb;
    if (climb) {
      this.vel.y = Math.max(this.vel.y, PHYS.climbSpeed * r);
    }
    // roll: rotate around axis perpendicular to horizontal velocity
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 1e-6) {
      _axis.set(this.vel.z, 0, -this.vel.x).multiplyScalar(1 / sp);
      _dq.setFromAxisAngle(_axis, (sp * dt) / r);
      this.quat.premultiply(_dq).normalize();
    }
  }

  wantsInto(nx, nz) {
    const h = Math.hypot(nx, nz) || 1;
    return -(this.wantDir.x * nx + this.wantDir.z * nz) / h > 0.45;
  }

  resolve(nx, ny, nz, pen, soft = false) {
    this.pos.x += nx * pen;
    this.pos.y += ny * pen;
    this.pos.z += nz * pen;
    const vn = this.vel.x * nx + this.vel.y * ny + this.vel.z * nz;
    if (vn < 0) {
      const e = ny > 0.55 || soft ? 0 : PHYS.restitution;
      this.vel.x -= (1 + e) * vn * nx;
      this.vel.y -= (1 + e) * vn * ny;
      this.vel.z -= (1 + e) * vn * nz;
    }
  }
}

export { UP };
