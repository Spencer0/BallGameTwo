// Floating joystick: touch anywhere on the play layer to place the stick, drag to roll.
// Double-tap = quick turn. Keyboard (WASD/arrows, Q/E, Space) for desktop testing.
export class Input {
  constructor(layer, stickEl) {
    this.layer = layer;
    this.stick = stickEl;
    this.knob = stickEl.querySelector('.knob');
    this.x = 0; // -1..1 right
    this.y = 0; // -1..1 forward
    this.turn = 0; // -1..1 camera turn (keyboard)
    this.active = false;
    this.pointerId = -1;
    this.ox = 0;
    this.oy = 0;
    this.radius = 58;
    this.lastTapTime = 0;
    this.downTime = 0;
    this.moved = 0;
    this.enabled = false;
    this.onQuickTurn = null;
    this.onFirstTouch = null;
    this.keys = new Set();
    this.override = null; // autopilot: {x, y}
    this.sx = 0;
    this.sy = 0;

    layer.addEventListener('pointerdown', (e) => this.down(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' && this.enabled && this.onQuickTurn) this.onQuickTurn();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.release();
    });
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.release();
  }

  down(e) {
    if (this.onFirstTouch) this.onFirstTouch();
    if (!this.enabled || this.pointerId !== -1) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.active = true;
    this.ox = e.clientX;
    this.oy = e.clientY;
    this.sx = 0;
    this.sy = 0;
    this.moved = 0;
    this.downTime = performance.now();
    this.stick.style.transform = `translate(${this.ox}px, ${this.oy}px)`;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.stick.classList.add('on');
  }

  move(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    let dx = e.clientX - this.ox;
    let dy = e.clientY - this.oy;
    const d = Math.hypot(dx, dy);
    this.moved = Math.max(this.moved, d);
    const R = this.radius;
    if (d > R * 1.35) {
      // drag the base along so the stick never "runs out"
      const k = (d - R * 1.35) / d;
      this.ox += dx * k;
      this.oy += dy * k;
      dx = e.clientX - this.ox;
      dy = e.clientY - this.oy;
      this.stick.style.transform = `translate(${this.ox}px, ${this.oy}px)`;
    }
    const dd = Math.hypot(dx, dy);
    const cl = Math.min(1, dd / R);
    const nx = dd > 0 ? dx / dd : 0,
      ny = dd > 0 ? dy / dd : 0;
    const dead = 0.1;
    const mag = cl < dead ? 0 : (cl - dead) / (1 - dead);
    this.sx = nx * mag;
    this.sy = -ny * mag;
    this.knob.style.transform = `translate(${nx * cl * R}px, ${ny * cl * R}px)`;
  }

  up(e) {
    if (e.pointerId !== this.pointerId) return;
    const now = performance.now();
    const tap = now - this.downTime < 260 && this.moved < 14;
    if (tap) {
      if (now - this.lastTapTime < 360) {
        this.lastTapTime = 0;
        if (this.enabled && this.onQuickTurn) this.onQuickTurn();
      } else this.lastTapTime = now;
    }
    this.release();
  }

  release() {
    this.pointerId = -1;
    this.active = false;
    this.sx = 0;
    this.sy = 0;
    this.stick.classList.remove('on');
  }

  /** Sample the current input into this.x / this.y / this.turn. */
  update() {
    let x = this.sx,
      y = this.sy,
      t = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyQ')) t -= 1;
    if (k.has('KeyE')) t += 1;
    if (this.override) {
      x = this.override.x;
      y = this.override.y;
    }
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    this.x = this.enabled ? x : 0;
    this.y = this.enabled ? y : 0;
    this.turn = this.enabled ? t : 0;
  }
}
