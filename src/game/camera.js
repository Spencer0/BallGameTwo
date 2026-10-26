// Follow camera: auto-yaw toward travel, quick-turn, radius-driven pull-back, shake, FOV kick.
import * as THREE from 'three';

const TAU = Math.PI * 2;
function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export const CAM = {
  dist: 8.4, // in (smoothed) radii
  height: 5.0,
  look: 1.0,
  ahead: 2.2, // look-at point this many radii in front of the ball
  fov: 62,
  follow: 2.0, // auto-yaw rate
};

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.camR = 0.02;
    this.turnLeft = 0; // remaining quick-turn angle
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.fovKick = 0;
    this.zoomKick = 0;
    this.t = 0;
    this.target = new THREE.Vector3();
    this.smoothPos = new THREE.Vector3();
    this.first = true;
    this.reducedMotion = false;
    this.clip = 1; // smoothed camera-collision distance factor
  }

  reset(ball, yaw, intro = 2.6) {
    this.yaw = yaw;
    this.camR = ball.r;
    this.first = true;
    this.turnLeft = 0;
    this.introT = intro; // level-start swoop from high above
    this.introLen = intro;
  }

  quickTurn() {
    if (Math.abs(this.turnLeft) < 0.1) this.turnLeft = Math.PI;
  }

  shake(amount) {
    if (this.reducedMotion) return;
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeT = 0.35;
  }

  kick(fov, zoom) {
    this.fovKick = Math.max(this.fovKick, fov);
    this.zoomKick = Math.max(this.zoomKick, zoom);
  }

  update(dt, ball, input, env) {
    this.t += dt;
    // pull back smoothly as the ball grows
    this.camR += (ball.r - this.camR) * (1 - Math.exp(-dt * 1.6));
    // quick turn (ease)
    if (Math.abs(this.turnLeft) > 1e-3) {
      const step = this.turnLeft * (1 - Math.exp(-dt * 9));
      this.yaw += step;
      this.turnLeft -= step;
    }
    // auto-follow toward direction of travel
    const vx = ball.vel.x,
      vz = ball.vel.z;
    const sp = Math.hypot(vx, vz);
    const vmax = 4.4 * ball.speedMul * ball.r;
    if (sp > vmax * 0.18 && Math.abs(this.turnLeft) < 0.3) {
      const heading = Math.atan2(vx, vz);
      const d = angleDiff(heading, this.yaw);
      // don't swing around when deliberately reversing
      if (Math.abs(d) < Math.PI * 0.62) {
        const rate = CAM.follow * Math.min(1, sp / vmax) * (0.4 + 0.6 * Math.abs(input.x));
        this.yaw += d * (1 - Math.exp(-dt * rate));
      }
    }
    this.yaw += input.turn * dt * 2.2;

    const R = this.camR * (1 + this.zoomKick);
    const fx = Math.sin(this.yaw),
      fz = Math.cos(this.yaw);
    const cam = this.camera;
    const bx = ball.pos.x,
      by = ball.pos.y - ball.r + this.camR * CAM.look,
      bz = ball.pos.z;
    this.target.set(bx + fx * R * CAM.ahead, by, bz + fz * R * CAM.ahead);
    cam.position.set(bx - fx * R * CAM.dist, by + R * CAM.height, bz - fz * R * CAM.dist);
    // keep the camera inside rooms: pull it in front of camera-blocking walls (snap in, ease out)
    if (env) {
      const hit = env.segmentHit(bx, by + R * 0.5, bz, cam.position.x, cam.position.y, cam.position.z);
      const want = hit < 1 ? Math.max(0.15, hit - 0.06) : 1;
      this.clip = want < this.clip ? want : this.clip + (want - this.clip) * (1 - Math.exp(-dt * 2));
      if (this.clip < 0.999) {
        cam.position.x = bx + (cam.position.x - bx) * this.clip;
        cam.position.y = by + R * 0.5 + (cam.position.y - by - R * 0.5) * this.clip;
        cam.position.z = bz + (cam.position.z - bz) * this.clip;
      }
    }
    // keep the camera above the ground plane
    if (cam.position.y < this.target.y + R * 0.6) cam.position.y = this.target.y + R * 0.6;
    // intro swoop: start high and far, ease down into the follow position
    if (this.introT > 0) {
      this.introT -= dt;
      const t = Math.max(0, Math.min(1, 1 - this.introT / this.introLen));
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const k = 1 - e;
      const a = this.yaw + k * 1.2; // swing around a little as it descends
      const hx = bx - Math.sin(a) * R * 34,
        hy = by + R * 30,
        hz = bz - Math.cos(a) * R * 34;
      cam.position.x = hx + (cam.position.x - hx) * e;
      cam.position.y = hy + (cam.position.y - hy) * e;
      cam.position.z = hz + (cam.position.z - hz) * e;
      this.target.x = bx + (this.target.x - bx) * e;
      this.target.z = bz + (this.target.z - bz) * e;
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * this.camR * Math.max(0, this.shakeT / 0.35);
      cam.position.x += Math.sin(this.t * 61) * a;
      cam.position.y += Math.sin(this.t * 47 + 1) * a;
      cam.position.z += Math.cos(this.t * 53) * a;
    }
    cam.lookAt(this.target);
    this.fovKick *= Math.exp(-dt * 3);
    this.zoomKick *= Math.exp(-dt * 1.5);
    cam.fov = CAM.fov + this.fovKick;
    cam.near = this.camR * 0.06;
    cam.far = this.camR * 900;
    cam.updateProjectionMatrix();
  }
}

export { angleDiff };
