// Sound effects. Pickup sounds vary by material and size, and are quantised to the current
// level's key so combos play little melodies.
import { mtof } from './engine.js';

// major pentatonic degrees for combo climbs
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export const KEYS = { crumb: 65, bedroom: 62, house: 70, culdesac: 64, town: 60, city: 63, title: 67 };

export class Sfx {
  constructor(engine) {
    this.e = engine;
    this.key = 65;
    this.lastPickup = 0;
    this.lastTiny = 0;
    this.voiceBusy = 0;
  }

  get ok() {
    return this.e.running;
  }

  setKey(songId) {
    this.key = KEYS[songId] ?? 65;
  }

  /** rel: object size / ball diameter (0..0.5); combo: 1.. */
  pickup(mat, rel, combo) {
    if (!this.ok) return;
    const e = this.e;
    const now = e.now;
    // rate limit stacking (bulk pickups)
    const t = Math.max(now, this.lastPickup + 0.03);
    if (t - now > 0.12) return;
    this.lastPickup = t;
    const deg = PENTA[Math.min(PENTA.length - 1, (combo - 1) % 11)];
    const sizeOct = rel > 0.3 ? -12 : rel > 0.15 ? 0 : 12;
    const m = this.key + deg + sizeOct;
    const v = 0.55 + Math.min(0.45, rel);
    const bus = e.sfx;
    // signature sticky "glomp": soft low blip with pitch drop
    {
      const o = e.out(bus, 0.05);
      const g = e.gain(0, o);
      const s = e.osc('sine', mtof(m - 12) * 1.6, t, t + 0.16, g);
      s.frequency.exponentialRampToValueAtTime(mtof(m - 12) * 0.7, t + 0.1);
      g.gain.setValueAtTime(0.32 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    }
    switch (mat) {
      case 'metal':
        this.bell(t, m + 12, 0.5 * v, 3.5, 0.6);
        break;
      case 'ceramic':
      case 'glass':
        this.clink(t, m + 12, 0.45 * v);
        break;
      case 'wood':
        this.tok(t, m, 0.6 * v);
        break;
      case 'food':
        this.bloop(t, m, 0.5 * v);
        break;
      case 'plastic':
      case 'rubber':
        this.pop(t, m + (mat === 'rubber' ? 12 : 0), 0.45 * v, mat === 'rubber');
        break;
      case 'paper':
        this.fwip(t, m, 0.5 * v);
        break;
      case 'electronic':
        this.beep(t, m + 12, 0.35 * v);
        break;
      case 'living':
        this.yelp(t, m + 12, 0.45 * v);
        break;
      case 'stone':
        this.thunk(t, m - 12, 0.6 * v);
        break;
      case 'plant':
        this.rustle(t, m, 0.45 * v);
        break;
      case 'soft':
      default:
        this.pomf(t, m, 0.5 * v);
        break;
    }
  }

  tiny() {
    if (!this.ok) return;
    const e = this.e;
    const t = e.now;
    if (t - this.lastTiny < 0.07) return;
    this.lastTiny = t;
    e.noiseHit(t, 0.03, e.out(e.sfx, 0), 'bandpass', 3000 + Math.random() * 2000, 2, 0.08);
  }

  bell(t, m, v, ratio = 3.5, dur = 0.6) {
    const e = this.e;
    const f = mtof(m);
    const o = e.out(e.sfx, 0.25);
    const g = e.gain(0, o);
    const car = e.osc('sine', f, t, t + dur + 0.1, g);
    const mod = e.ctx.createOscillator();
    mod.frequency.value = f * ratio;
    const mg = e.gain(f * 1.5, car.frequency);
    mod.connect(mg);
    mg.gain.setValueAtTime(f * 2.5, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.1, t + dur);
    mod.start(t);
    mod.stop(t + dur + 0.1);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22 * v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  }

  clink(t, m, v) {
    const e = this.e;
    const f = mtof(m);
    const o = e.out(e.sfx, 0.3);
    for (const [r, a, d] of [
      [1, 1, 0.3],
      [2.76, 0.5, 0.18],
      [5.4, 0.3, 0.08],
    ]) {
      const g = e.gain(0, o);
      e.osc('sine', f * r, t, t + d + 0.05, g);
      g.gain.setValueAtTime(0.2 * v * a, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
    }
  }

  tok(t, m, v) {
    const e = this.e;
    const o = e.out(e.sfx, 0.12);
    const g = e.gain(0, o);
    const s = e.osc('triangle', mtof(m), t, t + 0.12, g);
    s.frequency.exponentialRampToValueAtTime(mtof(m) * 0.8, t + 0.08);
    g.gain.setValueAtTime(0.4 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    e.noiseHit(t, 0.025, o, 'bandpass', 1800, 3, 0.25 * v);
  }

  bloop(t, m, v) {
    const e = this.e;
    const o = e.out(e.sfx, 0.12);
    const g = e.gain(0, o);
    const s = e.osc('sine', mtof(m) * 0.7, t, t + 0.18, g);
    s.frequency.exponentialRampToValueAtTime(mtof(m) * 1.5, t + 0.12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35 * v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  }

  pop(t, m, v, squeak) {
    const e = this.e;
    const o = e.out(e.sfx, 0.1);
    const g = e.gain(0, o);
    const s = e.osc(squeak ? 'sine' : 'square', mtof(m) * (squeak ? 1 : 1.5), t, t + 0.15, g);
    if (squeak) {
      s.frequency.setValueAtTime(mtof(m), t);
      s.frequency.linearRampToValueAtTime(mtof(m) * 1.4, t + 0.05);
      s.frequency.linearRampToValueAtTime(mtof(m) * 1.1, t + 0.12);
    } else s.frequency.exponentialRampToValueAtTime(mtof(m) * 0.6, t + 0.06);
    g.gain.setValueAtTime((squeak ? 0.3 : 0.14) * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (squeak ? 0.14 : 0.07));
  }

  fwip(t, m, v) {
    const e = this.e;
    const o = e.out(e.sfx, 0.1);
    const n = e.noiseHit(t, 0.12, o, 'bandpass', 900, 2, 0.4 * v);
    n.filter.frequency.exponentialRampToValueAtTime(4500, t + 0.1);
    this.tok(t + 0.02, m + 12, v * 0.3);
  }

  beep(t, m, v) {
    const e = this.e;
    const o = e.out(e.sfx, 0.08);
    for (const [k, mm] of [
      [0, m],
      [0.07, m + 7],
    ]) {
      const g = e.gain(0, o);
      e.osc('square', mtof(mm), t + k, t + k + 0.07, g);
      g.gain.setValueAtTime(0.07 * v, t + k);
      g.gain.setValueAtTime(0.07 * v, t + k + 0.05);
      g.gain.linearRampToValueAtTime(0, t + k + 0.065);
    }
  }

  yelp(t, m, v) {
    const e = this.e;
    const o = e.out(e.sfx, 0.12);
    const g = e.gain(0, o);
    const bp = e.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 1.5;
    bp.connect(g);
    const s = e.osc('sawtooth', mtof(m) * 0.8, t, t + 0.25, bp);
    s.frequency.exponentialRampToValueAtTime(mtof(m) * 1.6, t + 0.08);
    s.frequency.exponentialRampToValueAtTime(mtof(m) * 1.2, t + 0.2);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35 * v, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  }

  thunk(t, m, v) {
    const e = this.e;
    const o = e.out(e.sfx, 0.2);
    const g = e.gain(0, o);
    const s = e.osc('sine', mtof(m) * 1.2, t, t + 0.3, g);
    s.frequency.exponentialRampToValueAtTime(mtof(m) * 0.6, t + 0.2);
    g.gain.setValueAtTime(0.5 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    e.noiseHit(t, 0.12, o, 'lowpass', 900, 1, 0.3 * v);
  }

  rustle(t, m, v) {
    const e = this.e;
    const o = e.out(e.sfx, 0.15);
    e.noiseHit(t, 0.1, o, 'highpass', 4000, 0.7, 0.18 * v);
    e.noiseHit(t + 0.04, 0.08, o, 'highpass', 5000, 0.7, 0.12 * v);
    this.tok(t, m + 7, v * 0.4);
  }

  pomf(t, m, v) {
    const e = this.e;
    const o = e.out(e.sfx, 0.12);
    const g = e.gain(0, o);
    const s = e.osc('sine', mtof(m), t, t + 0.18, g);
    s.frequency.exponentialRampToValueAtTime(mtof(m) * 0.75, t + 0.15);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35 * v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    e.noiseHit(t, 0.08, o, 'lowpass', 1200, 0.7, 0.18 * v);
  }

  bump(impact, knocked) {
    if (!this.ok) return;
    const e = this.e;
    const t = e.now;
    const v = Math.min(1, 0.4 + impact * 0.5);
    const o = e.out(e.sfx, 0.2);
    const g = e.gain(0, o);
    const s = e.osc('sine', 110, t, t + 0.35, g);
    s.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    g.gain.setValueAtTime(0.7 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    e.noiseHit(t, 0.15, o, 'lowpass', 700, 0.8, 0.35 * v);
    if (knocked > 0) this.boing(t + 0.05, 0.6);
  }

  boing(t, v = 0.5) {
    const e = this.e;
    if (t === undefined) t = e.now;
    const o = e.out(e.sfx, 0.15);
    const g = e.gain(0, o);
    const s = e.osc('triangle', 220, t, t + 0.5, g);
    const lfo = e.ctx.createOscillator();
    lfo.frequency.value = 16;
    const lg = e.gain(60, s.frequency);
    lfo.connect(lg);
    lfo.start(t);
    lfo.stop(t + 0.5);
    s.frequency.setValueAtTime(180, t);
    s.frequency.exponentialRampToValueAtTime(330, t + 0.4);
    lg.gain.exponentialRampToValueAtTime(5, t + 0.45);
    g.gain.setValueAtTime(0.3 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  }

  wobble() {
    if (!this.ok) return;
    this.boing(this.e.now, 0.35);
  }

  /** Size milestone: quick brass + glock arpeggio in key. */
  milestone(level = 0) {
    if (!this.ok) return;
    const e = this.e;
    const t = e.now + 0.02;
    e.duckMusic(0.35, 0.7);
    const k = this.key + (level % 3) * 2;
    const notes = [0, 4, 7, 12];
    notes.forEach((d, i) => {
      e.brass(t + i * 0.08, k + d, 0.12, 0.9, e.sfx);
      e.glock(t + i * 0.08, k + d + 12, 0.2, 0.8, e.sfx);
    });
    for (const d of [0, 4, 7, 11, 14]) e.brass(t + 0.34, k + d, 0.45, 0.8, e.sfx);
    e.drum('crash', t + 0.34, 0.6, e.sfx);
  }

  target() {
    if (!this.ok) return;
    const e = this.e;
    const t = e.now + 0.02;
    e.duckMusic(0.25, 1.4);
    const k = this.key;
    [0, 4, 7, 12, 16, 19, 24].forEach((d, i) => e.glock(t + i * 0.06, k + d + 12, 0.2, 0.9, e.sfx));
    [
      [0, 0.0],
      [5, 0.25],
      [7, 0.5],
    ].forEach(([d, dt]) => {
      for (const iv of [0, 4, 7, 12]) e.brass(t + dt, k + d + iv, 0.2, 0.9, e.sfx);
    });
    for (const iv of [0, 4, 7, 11, 14]) e.brass(t + 0.75, k + iv, 0.8, 1, e.sfx);
    e.whistle(t + 0.75, k + 24, 0.6, 1, e.sfx);
    e.drum('crash', t + 0.75, 0.8, e.sfx);
  }

  tick(urgent) {
    if (!this.ok) return;
    const e = this.e;
    const t = e.now;
    const o = e.out(e.sfx, 0);
    const g = e.gain(0, o);
    e.osc('square', urgent ? 1320 : 990, t, t + 0.04, g);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  }

  /** Referee whistle with a trill. */
  timeUp() {
    if (!this.ok) return;
    const e = this.e;
    const t = e.now;
    for (const [st, d] of [
      [0, 0.18],
      [0.25, 0.7],
    ]) {
      const o = e.out(e.sfx, 0.15);
      const g = e.gain(0, o);
      const s = e.osc('sine', 2600, t + st, t + st + d + 0.05, g);
      const lfo = e.ctx.createOscillator();
      lfo.frequency.value = 30;
      lfo.connect(e.gain(180, s.frequency));
      lfo.start(t + st);
      lfo.stop(t + st + d);
      g.gain.setValueAtTime(0, t + st);
      g.gain.linearRampToValueAtTime(0.18, t + st + 0.01);
      g.gain.setValueAtTime(0.18, t + st + d - 0.03);
      g.gain.linearRampToValueAtTime(0, t + st + d);
    }
  }

  // ------------------------------------------------------------ UI
  tap() {
    if (!this.ok) return;
    this.pop(this.e.now, 84, 0.6, false);
  }
  back() {
    if (!this.ok) return;
    this.pop(this.e.now, 72, 0.6, false);
  }
  toggle(on) {
    if (!this.ok) return;
    this.pop(this.e.now, on ? 88 : 79, 0.5, true);
  }
  star(i) {
    if (!this.ok) return;
    const e = this.e;
    const t = e.now;
    this.thunk(t, 48, 0.5);
    this.bell(t + 0.02, 84 + [0, 4, 7][i % 3], 0.8, 2.0, 0.9);
  }
  results(good) {
    if (!this.ok) return;
    const e = this.e;
    const t = e.now + 0.05;
    const k = 60;
    const seq = good ? [0, 4, 7, 12, 11, 12] : [7, 5, 4, 0];
    seq.forEach((d, i) => e.vibes(t + i * 0.12, k + d + 12, 0.2, 0.9, e.sfx));
    const chord = good ? [0, 4, 7, 11, 14] : [0, 3, 7, 10];
    for (const iv of chord) e.epiano(t + seq.length * 0.12, k + iv, 1.2, 0.8, e.sfx);
  }

  /** Prudence's voice: chirpy kazoo babble, one syllable per word chunk. */
  babble(text, pitch = 76) {
    if (!this.ok) return;
    const e = this.e;
    const t0 = Math.max(e.now, this.voiceBusy);
    const words = text.split(/\s+/).slice(0, 14);
    let t = t0;
    words.forEach((w, i) => {
      const len = Math.min(0.13, 0.05 + w.length * 0.012);
      const m = pitch + [0, 3, -2, 5, 2, 7, -4][(w.charCodeAt(0) + i) % 7];
      e.kazoo(t, m, len, 0.55, e.sfx);
      t += len + 0.035;
    });
    this.voiceBusy = t;
  }

  /** Lint: tiny squeak */
  squeak() {
    if (!this.ok) return;
    this.pop(this.e.now, 91, 0.5, true);
  }

  // ------------------------------------------------------------------ city life
  /** a car horn: two detuned squares, short "meep" or a longer "meeeep"; v = 0..1 by distance */
  honk(v = 1, long = false) {
    if (!this.ok || v < 0.03) return;
    const e = this.e;
    const t = e.now + 0.01;
    const o = e.out(e.sfx, 0.05);
    const lp = e.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    lp.connect(o);
    const g = e.gain(0, lp);
    const base = 330 + Math.random() * 90;
    const dur = long ? 0.55 : 0.18;
    for (const r of [1, 1.26]) e.osc('square', base * r, t, t + dur + 0.05, g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09 * v, t + 0.015);
    g.gain.setValueAtTime(0.09 * v, t + dur - 0.03);
    g.gain.linearRampToValueAtTime(0, t + dur);
    if (!long && Math.random() < 0.5) {
      // double tap
      const g2 = e.gain(0, lp);
      for (const r of [1, 1.26]) e.osc('square', base * r, t + 0.24, t + 0.45, g2);
      g2.gain.setValueAtTime(0, t + 0.24);
      g2.gain.linearRampToValueAtTime(0.09 * v, t + 0.255);
      g2.gain.linearRampToValueAtTime(0, t + 0.42);
    }
  }

  /** a flock taking off: a burst of soft wing claps */
  flutter(v = 1, n = 6) {
    if (!this.ok || v < 0.03) return;
    const e = this.e;
    const o = e.out(e.sfx, 0.08);
    for (let k = 0; k < n * 3; k++) {
      const t = e.now + k * 0.035 + Math.random() * 0.02;
      e.noiseHit(t, 0.05, o, 'bandpass', 1400 + Math.random() * 900, 1.2, 0.09 * v * (1 - k / (n * 3)));
    }
  }

  /** ambient bed for a place: 'suburb' | 'town' | 'city' | null; call ambienceTick each frame */
  ambience(kind) {
    if (!this.ok) return;
    const e = this.e;
    if (this.amb) {
      const a = this.amb;
      a.g.gain.setTargetAtTime(0, e.now, 0.4);
      setTimeout(() => {
        try {
          a.src.stop();
        } catch {}
      }, 2000);
      this.amb = null;
    }
    this.ambKind = kind;
    if (!kind) return;
    const c = e.ctx;
    const src = c.createBufferSource();
    src.buffer = e.noise;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = kind === 'city' ? 380 : kind === 'town' ? 260 : 200;
    lp.Q.value = 0.3;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(lp).connect(g).connect(e.sfx);
    src.start();
    g.gain.setTargetAtTime(kind === 'city' ? 0.11 : 0.05, e.now, 1.5);
    this.amb = { src, g };
    this.ambT = 0;
  }

  ambienceTick(dt) {
    if (!this.ok || !this.ambKind) return;
    this.ambT -= dt;
    if (this.ambT > 0) return;
    const kind = this.ambKind;
    this.ambT = kind === 'city' ? 1.5 + Math.random() * 3 : 0.8 + Math.random() * 2.5;
    if (kind === 'city' && Math.random() < 0.35) this.honk(0.12 + Math.random() * 0.12, Math.random() < 0.3);
    else this.chirp(kind === 'city' ? 0.25 : 0.6);
  }

  /** a little bird: two or three quick sine sweeps */
  chirp(v = 0.5) {
    const e = this.e;
    const o = e.out(e.sfx, 0.25, (Math.random() - 0.5) * 0.8);
    const f = 2400 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const t = e.now + k * 0.09;
      const g = e.gain(0, o);
      const s = e.osc('sine', f, t, t + 0.08, g);
      s.frequency.exponentialRampToValueAtTime(f * (1.3 + Math.random() * 0.4), t + 0.05);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035 * v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    }
  }
}
