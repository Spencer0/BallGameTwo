// Lint, the dust bunny who pushes the ball. Procedural rig from Blender parts (body, ears, feet):
// walk cycle, push lean, springy ears, idle breathing, celebration hops.
import * as THREE from 'three';
import { makeToonMaterial, makeOutlineMaterial } from '../render/materials.js';

const TAU = Math.PI * 2;

export class Lint {
  constructor(lib) {
    this.group = new THREE.Group();
    this.rig = new THREE.Group(); // bob / lean
    this.group.add(this.rig);
    this.mat = makeToonMaterial();
    this.outMat = makeOutlineMaterial(0.5, { outlinePx: { value: 3.0 } });
    const part = (name) => {
      const geo = lib.sets.get('char__lint_' + name);
      const g = new THREE.Group();
      if (geo) {
        g.add(new THREE.Mesh(geo, this.mat), new THREE.Mesh(geo, this.outMat));
        g.children.forEach((m) => (m.frustumCulled = false));
      }
      return g;
    };
    this.body = part('body');
    this.earL = part('ear_l');
    this.earR = part('ear_r');
    this.footL = part('foot_l');
    this.footR = part('foot_r');
    this.rig.add(this.body);
    this.body.add(this.earL, this.earR);
    this.earL.position.set(-0.2, 0.62, 0.0);
    this.earR.position.set(0.2, 0.62, 0.0);
    this.group.add(this.footL, this.footR);
    this.footL.position.set(-0.13, 0, 0.07);
    this.footR.position.set(0.13, 0, 0.07);
    this.phase = 0;
    this.heading = 0;
    this.earVel = [0, 0];
    this.earAng = [0, 0];
    this.hop = 0;
    this.hopV = 0;
    this.t = 0;
    this.blinkT = 2;
    this.y = 0;
    this.scale = 0; // snapped on the first update
    this.visible = true;
  }

  celebrate(strength = 1) {
    this.hopV = Math.max(this.hopV, 3.2 * strength);
    this.earVel[0] -= 8 * strength;
    this.earVel[1] += 8 * strength;
  }

  flinch() {
    this.earVel[0] += 10;
    this.earVel[1] -= 10;
  }

  /**
   * @param ball  Ball
   * @param camYaw camera heading (used when idle so Lint stays behind from the player's view)
   * @param size  Lint height in world units
   */
  update(dt, ball, camYaw, size, groundY) {
    this.t += dt;
    const vx = ball.vel.x,
      vz = ball.vel.z;
    const sp = Math.hypot(vx, vz);
    const vmax = 4.4 * ball.r;
    const moving = sp > vmax * 0.08;
    // face the direction of travel when moving, otherwise the camera's forward
    const want = moving ? Math.atan2(vx, vz) : camYaw;
    let d = (want - this.heading) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    this.heading += d * (1 - Math.exp(-dt * (moving ? 10 : 3)));
    if (this.scale === 0) {
      this.scale = size;
      this.y = Math.max(groundY, ball.pos.y - ball.r);
      this.heading = camYaw;
    }
    this.scale += (size - this.scale) * (1 - Math.exp(-dt * 3));
    const s = this.scale;
    const fx = Math.sin(this.heading),
      fz = Math.cos(this.heading);
    const back = ball.r + s * 0.3;
    const targetY = Math.max(groundY, ball.pos.y - ball.r);
    this.y += (targetY - this.y) * (1 - Math.exp(-dt * 12));
    // hop physics (in units of Lint height)
    this.hopV -= 14 * dt;
    this.hop = Math.max(0, this.hop + this.hopV * dt);
    if (this.hop === 0 && this.hopV < 0) this.hopV = 0;
    this.group.position.set(ball.pos.x - fx * back, this.y + this.hop * s * 0.35, ball.pos.z - fz * back);
    this.group.rotation.y = this.heading;
    this.group.scale.setScalar(s);
    // walk cycle
    const k = Math.min(1, sp / vmax);
    this.phase += (dt * (sp / (s * 0.55)) * 1.2) % TAU;
    const p = this.phase;
    const stride = 0.12 * k;
    this.footL.position.z = 0.07 + Math.sin(p) * stride;
    this.footR.position.z = 0.07 - Math.sin(p) * stride;
    this.footL.position.y = Math.max(0, Math.cos(p)) * 0.08 * k;
    this.footR.position.y = Math.max(0, -Math.cos(p)) * 0.08 * k;
    const breathe = Math.sin(this.t * 2.2) * 0.02 * (1 - k);
    const bob = Math.abs(Math.sin(p)) * 0.06 * k;
    this.rig.position.y = bob + 0.04 * k;
    this.rig.rotation.x = 0.28 * k + (ball.climbing ? 0.3 : 0); // lean into the push
    this.body.scale.set(1 - breathe, 1 + breathe * 2 - this.hopV * 0.01, 1 - breathe);
    // springy ears: driven by acceleration-ish (speed changes) and walk bounce
    for (let e = 0; e < 2; e++) {
      const target = -0.25 * k + (e ? 0.12 : -0.12) + Math.sin(this.t * 1.3 + e) * 0.04;
      const f = (target - this.earAng[e]) * 90 - this.earVel[e] * 7 + Math.cos(p * 2) * 6 * k;
      this.earVel[e] += f * dt;
      this.earAng[e] += this.earVel[e] * dt;
    }
    this.earL.rotation.set(this.earAng[0] * 0.8, 0, 0.18 + this.earAng[0] * 0.3);
    this.earR.rotation.set(this.earAng[1] * 0.8, 0, -0.18 - this.earAng[1] * 0.3);
  }

  dispose() {
    this.mat.dispose();
    this.outMat.dispose();
    this.group.removeFromParent();
  }
}
