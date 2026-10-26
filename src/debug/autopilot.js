// Autopilot for scripted playthroughs and soak tests: steers toward the best collectible object
// near the ball (bigger + closer = better), backs off when stuck. Drives Input.override.
import { canPickUp, isTiny } from '../game/rules.js';
import { ALIVE, MOVING } from '../game/world.js';
import { PHYS } from '../game/ball.js';

const BUF = new Int32Array(4096);

export class Autopilot {
  constructor(game) {
    this.game = game;
    this.target = -1;
    this.retarget = 0;
    this.stuckT = 0;
    this.lastPos = { x: 0, z: 0 };
    this.escape = 0;
    this.escapeDir = 0;
    this.override = { x: 0, y: 0 };
    this.skill = 1; // 0..1, lower = more wandering
    this.wanderT = 0;
    this.banned = new Map(); // instance -> time until which it is ignored (unreachable)
    this.t = 0;
  }

  update(dt) {
    const s = this.game.session;
    if (!s || s.over) return;
    const input = this.game.input;
    input.override = this.override;
    const b = s.ball,
      w = s.world;
    this.retarget -= dt;
    this.t += dt;
    // stuck detection
    this.stuckT += dt;
    if (this.stuckT > 1.2) {
      const moved = Math.hypot(b.pos.x - this.lastPos.x, b.pos.z - this.lastPos.z);
      if (moved < b.r * 0.6 && this.escape <= 0) {
        this.escape = 0.9;
        this.escapeDir = Math.random() * Math.PI * 2;
        if (this.target >= 0) this.banned.set(this.target, this.t + 12);
        this.target = -1;
      }
      this.lastPos.x = b.pos.x;
      this.lastPos.z = b.pos.z;
      this.stuckT = 0;
    }
    let dirX = 0,
      dirZ = 0;
    if (this.escape > 0) {
      this.escape -= dt;
      dirX = Math.sin(this.escapeDir);
      dirZ = Math.cos(this.escapeDir);
    } else {
      if (this.retarget <= 0 || this.target < 0 || w.state[this.target] === 0) {
        this.retarget = 0.4;
        this.target = this.pick(s);
      }
      if (this.target >= 0) {
        dirX = w.x[this.target] - b.pos.x;
        dirZ = w.z[this.target] - b.pos.z;
      } else {
        // nothing nearby: head toward the level centre / wander
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 2;
          this.escapeDir = Math.random() * Math.PI * 2;
        }
        dirX = Math.sin(this.escapeDir);
        dirZ = Math.cos(this.escapeDir);
      }
    }
    const l = Math.hypot(dirX, dirZ) || 1;
    dirX /= l;
    dirZ /= l;
    const yaw = s.cam.yaw;
    const fx = Math.sin(yaw),
      fz = Math.cos(yaw);
    const rx = -fz,
      rz = fx;
    this.override.x = dirX * rx + dirZ * rz;
    this.override.y = dirX * fx + dirZ * fz;
  }

  pick(s) {
    const b = s.ball,
      w = s.world;
    const D = b.diameter;
    const radius = b.r * 30;
    const n = w.query(b.pos.x, b.pos.z, radius, BUF);
    let best = -1,
      bestScore = 0;
    for (let k = 0; k < n; k++) {
      const i = BUF[k];
      if (w.state[i] !== ALIVE && w.state[i] !== MOVING) continue;
      const size = w.size[i];
      if (!canPickUp(size, D) || isTiny(size, b.r)) continue;
      const ban = this.banned.get(i);
      if (ban !== undefined && ban > this.t) continue;
      // skip things resting on top of obstacles we can't climb yet
      if (w.y[i] > b.pos.y - b.r + PHYS.climbMax * b.r * 0.9) continue;
      if (s.env.blockedPath(b.pos.x, b.pos.z, w.x[i], w.z[i], PHYS.climbMax * b.r)) continue;
      const d = Math.hypot(w.x[i] - b.pos.x, w.z[i] - b.pos.z) + b.r;
      const score = (Math.pow(size / D, this.skill) + 0.05) / d;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  stop() {
    this.game.input.override = null;
  }
}
