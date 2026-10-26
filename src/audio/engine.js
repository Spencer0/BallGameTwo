// Web Audio engine: context unlock (iOS), buses (music / sfx / reverb), and a small synth
// instrument rack used by both the music sequencer and the sound effects. All original synthesis.

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.7;
    this.sfxVol = 0.9;
    this.muted = false;
    this.unlocked = false;
  }

  /** Must be called from a user gesture (iOS). Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.build();
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    if (!this.unlocked) {
      // silent buffer kick for older iOS
      const b = this.ctx.createBuffer(1, 1, 22050);
      const s = this.ctx.createBufferSource();
      s.buffer = b;
      s.connect(this.ctx.destination);
      s.start(0);
      this.unlocked = true;
    }
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.18;
    this.master.connect(this.comp).connect(c.destination);
    this.music = c.createGain();
    this.music.gain.value = this.musicVol;
    this.duck = c.createGain();
    this.music.connect(this.duck).connect(this.master);
    this.sfx = c.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);
    // reverb send (generated impulse response)
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(1.6, 3.2);
    this.revOut = c.createGain();
    this.revOut.gain.value = 0.32;
    this.reverb.connect(this.revOut).connect(this.master);
    this.noise = this.makeNoise(1.5);
    this.pulse = this.makePulseWave(0.22);
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(music, t, 0.05);
    this.sfx.gain.setTargetAtTime(sfx, t, 0.05);
  }

  /** Briefly duck the music under a fanfare. */
  duckMusic(amount = 0.35, hold = 0.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.duck.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(amount, t + 0.05);
    g.setValueAtTime(amount, t + hold);
    g.linearRampToValueAtTime(1, t + hold + 0.5);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  impulse(seconds, decay) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45;
        d[i] = lp * Math.pow(1 - t, decay) * (i < c.sampleRate * 0.012 ? i / (c.sampleRate * 0.012) : 1);
      }
    }
    return buf;
  }

  makeNoise(seconds) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  makePulseWave(duty) {
    const n = 32;
    const re = new Float32Array(n),
      im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = ((2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty));
    return this.ctx.createPeriodicWave(re, im);
  }

  // ------------------------------------------------------------------ primitives
  osc(type, freq, t, stop, dest) {
    const o = this.ctx.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(this.pulse);
    else o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(stop);
    return o;
  }

  gain(v, dest) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    return g;
  }

  /** Noise source through an optional filter; returns the gain node for enveloping. */
  noiseHit(t, dur, dest, filterType, freq, q = 1, vol = 1) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const g = c.createGain();
    g.gain.value = 0;
    let head = g;
    if (filterType) {
      const f = c.createBiquadFilter();
      f.type = filterType;
      f.frequency.setValueAtTime(freq, t);
      f.Q.value = q;
      s.connect(f).connect(g);
      head = f;
    } else s.connect(g);
    g.connect(dest);
    const off = Math.random() * 0.8;
    s.start(t, off, dur + 0.05);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    return { src: s, gain: g, filter: head !== g ? head : null };
  }

  /** Output node with optional reverb send and pan. */
  out(bus, send = 0, pan = 0) {
    const c = this.ctx;
    const g = c.createGain();
    let tail = g;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      tail = p;
    }
    tail.connect(bus);
    if (send > 0) {
      const s = c.createGain();
      s.gain.value = send;
      tail.connect(s).connect(this.reverb);
    }
    return g;
  }

  // ------------------------------------------------------------------ instruments
  // each: (t, midi, dur, vel, bus) — dur in seconds

  epiano(t, m, dur, vel, bus, send = 0.25) {
    const f = mtof(m);
    const o = this.out(bus, send, (m - 64) / 60);
    const amp = this.gain(0, o);
    const end = t + dur + 1.2;
    const car = this.osc('sine', f, t, end, amp);
    const mod = this.ctx.createOscillator();
    mod.frequency.value = f;
    const mg = this.gain(0, car.frequency);
    mod.connect(mg);
    mg.gain.setValueAtTime(f * 2.4 * vel, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.35, t + 0.45);
    mod.start(t);
    mod.stop(end);
    const tine = this.ctx.createOscillator();
    tine.frequency.value = f * 14;
    const tg = this.gain(0, car.frequency);
    tine.connect(tg);
    tg.gain.setValueAtTime(f * 0.9 * vel, t);
    tg.gain.exponentialRampToValueAtTime(1, t + 0.06);
    tine.start(t);
    tine.stop(t + 0.1);
    const pk = 0.16 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(pk * 0.35, t + 0.5);
    amp.gain.setValueAtTime(pk * 0.35, t + dur);
    amp.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.5);
  }

  bass(t, m, dur, vel, bus, style = 'finger') {
    const f = mtof(m);
    const o = this.out(bus, 0.03);
    const amp = this.gain(0, o);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = style === 'synth' ? 7 : 1.2;
    lp.connect(amp);
    const end = t + dur + 0.2;
    if (style === 'synth' || style === 'slap') {
      this.osc('sawtooth', f, t, end, lp);
      this.osc('square', f * 0.5, t, end, this.gain(0.4, lp));
      const top = style === 'slap' ? f * 18 : f * 9;
      lp.frequency.setValueAtTime(top * (0.6 + vel * 0.6), t);
      lp.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.16);
    } else {
      this.osc('triangle', f, t, end, lp);
      this.osc('sine', f, t, end, this.gain(0.7, lp));
      lp.frequency.setValueAtTime(f * 7, t);
      lp.frequency.exponentialRampToValueAtTime(f * 2.5, t + 0.12);
    }
    const pk = 0.42 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.006);
    amp.gain.exponentialRampToValueAtTime(pk * 0.55, t + 0.18);
    amp.gain.setValueAtTime(pk * 0.5, t + Math.max(0.05, dur - 0.04));
    amp.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.08);
    if (style === 'slap') this.noiseHit(t, 0.03, o, 'bandpass', 2500, 1.5, 0.15 * vel);
  }

  clav(t, m, dur, vel, bus) {
    const f = mtof(m);
    const o = this.out(bus, 0.08, -0.25);
    const amp = this.gain(0, o);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3.5;
    bp.connect(amp);
    const end = t + dur + 0.1;
    this.osc('pulse', f, t, end, bp);
    this.osc('sawtooth', f * 2, t, end, this.gain(0.3, bp));
    bp.frequency.setValueAtTime(f * 8, t);
    bp.frequency.exponentialRampToValueAtTime(f * 2.5, t + 0.12);
    const pk = 0.32 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.002);
    amp.gain.exponentialRampToValueAtTime(pk * 0.3, t + 0.15);
    amp.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.06);
  }

  organ(t, m, dur, vel, bus) {
    const f = mtof(m);
    const o = this.out(bus, 0.15, 0.2);
    const amp = this.gain(0, o);
    const end = t + dur + 0.1;
    this.osc('sine', f, t, end, amp);
    this.osc('sine', f * 2, t, end, this.gain(0.5, amp));
    this.osc('sine', f * 3, t, end, this.gain(0.3, amp));
    this.osc('sine', f * 4, t, t + 0.08, this.gain(0.25, amp)); // percussion
    const pk = 0.07 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.01);
    amp.gain.setValueAtTime(pk, t + dur);
    amp.gain.linearRampToValueAtTime(0, t + dur + 0.06);
  }

  brass(t, m, dur, vel, bus, mute = false) {
    const f = mtof(m);
    const o = this.out(bus, 0.2, 0.15);
    const amp = this.gain(0, o);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = mute ? 6 : 1.5;
    lp.connect(amp);
    const end = t + dur + 0.2;
    for (const d of [-7, 0, 7]) {
      const s = this.osc('sawtooth', f, t, end, this.gain(0.33, lp));
      s.detune.value = d;
    }
    const top = mute ? f * 3.5 : f * 7;
    lp.frequency.setValueAtTime(f * 1.2, t);
    lp.frequency.exponentialRampToValueAtTime(top * (0.6 + vel * 0.5), t + 0.05);
    lp.frequency.exponentialRampToValueAtTime(top * 0.55, t + 0.25);
    const pk = 0.12 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.025);
    amp.gain.setValueAtTime(pk * 0.85, t + Math.max(0.03, dur - 0.03));
    amp.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.12);
  }

  vibes(t, m, dur, vel, bus, send = 0.35) {
    const f = mtof(m);
    const o = this.out(bus, send, 0.3);
    const amp = this.gain(0, o);
    const trem = this.ctx.createOscillator();
    trem.frequency.value = 5.5;
    const tg = this.gain(0.25, amp.gain);
    trem.connect(tg);
    const end = t + dur + 1.5;
    trem.start(t);
    trem.stop(end);
    this.osc('sine', f, t, end, amp);
    this.osc('sine', f * 4, t, t + 0.3, this.gain(0.25, amp));
    const pk = 0.14 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0005, t + dur + 1.2);
  }

  glock(t, m, dur, vel, bus) {
    const f = mtof(m);
    const o = this.out(bus, 0.3, -0.3);
    const amp = this.gain(0, o);
    const end = t + 1.2;
    this.osc('sine', f, t, end, amp);
    this.osc('sine', f * 2.76, t, t + 0.25, this.gain(0.4, amp));
    this.osc('sine', f * 5.4, t, t + 0.08, this.gain(0.25, amp));
    const pk = 0.13 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.002);
    amp.gain.exponentialRampToValueAtTime(0.0005, t + 1.0);
  }

  whistle(t, m, dur, vel, bus) {
    const f = mtof(m);
    const o = this.out(bus, 0.3, 0.1);
    const amp = this.gain(0, o);
    const end = t + dur + 0.15;
    const s = this.osc('sine', f, t, end, amp);
    s.frequency.setValueAtTime(f * 0.96, t);
    s.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 5.8;
    const vg = this.gain(0, s.frequency);
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.25, dur));
    vib.connect(vg);
    vib.start(t);
    vib.stop(end);
    const pk = 0.13 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.02);
    amp.gain.setValueAtTime(pk * 0.9, t + Math.max(0.02, dur - 0.02));
    amp.gain.linearRampToValueAtTime(0, t + dur + 0.08);
    this.noiseHit(t, Math.min(0.15, dur), o, 'bandpass', f * 2, 2, 0.02 * vel);
  }

  kazoo(t, m, dur, vel, bus) {
    const f = mtof(m);
    const o = this.out(bus, 0.15, -0.1);
    const amp = this.gain(0, o);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 1.4;
    const pk2 = this.ctx.createBiquadFilter();
    pk2.type = 'peaking';
    pk2.frequency.value = 2600;
    pk2.gain.value = 9;
    bp.connect(pk2).connect(amp);
    const end = t + dur + 0.1;
    const s1 = this.osc('sawtooth', f, t, end, bp);
    const s2 = this.osc('square', f * 1.003, t, end, this.gain(0.5, bp));
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 6.5;
    const vg = this.gain(f * 0.018, s1.frequency);
    vib.connect(vg);
    vib.connect(this.gain(f * 0.018, s2.frequency));
    vib.start(t);
    vib.stop(end);
    s1.frequency.setValueAtTime(f * 0.93, t);
    s1.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    const pk = 0.11 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.015);
    amp.gain.setValueAtTime(pk * 0.85, t + Math.max(0.02, dur - 0.02));
    amp.gain.linearRampToValueAtTime(0, t + dur + 0.05);
  }

  pad(t, m, dur, vel, bus) {
    const f = mtof(m);
    const o = this.out(bus, 0.5, 0);
    const amp = this.gain(0, o);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = f * 3;
    lp.connect(amp);
    const end = t + dur + 0.8;
    for (const d of [-9, 9]) this.osc('sawtooth', f, t, end, this.gain(0.4, lp)).detune.value = d;
    this.osc('sine', f * 2, t, end, this.gain(0.3, lp));
    const pk = 0.05 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.35);
    amp.gain.setValueAtTime(pk, t + dur);
    amp.gain.linearRampToValueAtTime(0, t + dur + 0.6);
  }

  // ------------------------------------------------------------------ drums
  drum(name, t, vel, bus) {
    const o = this.out(bus, name === 'snare' || name === 'clap' || name === 'rim' ? 0.12 : 0.02);
    const v = vel;
    switch (name) {
      case 'kick': {
        const amp = this.gain(0, o);
        const s = this.osc('sine', 150, t, t + 0.4, amp);
        s.frequency.exponentialRampToValueAtTime(46, t + 0.11);
        amp.gain.setValueAtTime(0.95 * v, t);
        amp.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        this.noiseHit(t, 0.012, o, 'highpass', 3000, 0.7, 0.18 * v);
        break;
      }
      case 'snare': {
        this.noiseHit(t, 0.18, o, 'bandpass', 2000, 0.7, 0.42 * v);
        const amp = this.gain(0, o);
        const s = this.osc('triangle', 200, t, t + 0.12, amp);
        s.frequency.exponentialRampToValueAtTime(165, t + 0.08);
        amp.gain.setValueAtTime(0.32 * v, t);
        amp.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        break;
      }
      case 'brush':
        this.noiseHit(t, 0.16, o, 'bandpass', 3500, 0.5, 0.16 * v);
        break;
      case 'clap':
        for (let k = 0; k < 3; k++) this.noiseHit(t + k * 0.011, k === 2 ? 0.16 : 0.02, o, 'bandpass', 1300, 1.2, 0.35 * v);
        break;
      case 'rim': {
        const amp = this.gain(0, o);
        this.osc('square', 1700, t, t + 0.03, amp);
        amp.gain.setValueAtTime(0.12 * v, t);
        amp.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        this.noiseHit(t, 0.02, o, 'bandpass', 3200, 2, 0.15 * v);
        break;
      }
      case 'hat':
        this.noiseHit(t, 0.045, o, 'highpass', 7500, 0.7, 0.16 * v);
        break;
      case 'ohat':
        this.noiseHit(t, 0.28, o, 'highpass', 6500, 0.7, 0.13 * v);
        break;
      case 'ride': {
        this.noiseHit(t, 0.45, o, 'bandpass', 7800, 1.2, 0.09 * v);
        const amp = this.gain(0, o);
        this.osc('square', 5100, t, t + 0.3, amp);
        amp.gain.setValueAtTime(0.01 * v, t);
        amp.gain.exponentialRampToValueAtTime(0.0005, t + 0.3);
        break;
      }
      case 'shaker':
        this.noiseHit(t, 0.06, o, 'highpass', 6000, 0.5, 0.07 * v);
        break;
      case 'cowbell': {
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2400;
        bp.Q.value = 1.2;
        const amp = this.gain(0, o);
        bp.connect(amp);
        this.osc('square', 562, t, t + 0.3, bp);
        this.osc('square', 845, t, t + 0.3, bp);
        amp.gain.setValueAtTime(0.16 * v, t);
        amp.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        break;
      }
      case 'conga':
      case 'congaHi': {
        const amp = this.gain(0, o);
        const f0 = name === 'conga' ? 190 : 285;
        const s = this.osc('sine', f0 * 1.3, t, t + 0.3, amp);
        s.frequency.exponentialRampToValueAtTime(f0, t + 0.03);
        amp.gain.setValueAtTime(0.4 * v, t);
        amp.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        this.noiseHit(t, 0.015, o, 'bandpass', 1800, 1, 0.08 * v);
        break;
      }
      case 'tom': {
        const amp = this.gain(0, o);
        const s = this.osc('sine', 140, t, t + 0.4, amp);
        s.frequency.exponentialRampToValueAtTime(95, t + 0.2);
        amp.gain.setValueAtTime(0.5 * v, t);
        amp.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        break;
      }
      case 'crash':
        this.noiseHit(t, 1.4, o, 'highpass', 4500, 0.5, 0.14 * v);
        break;
      case 'timbale': {
        const amp = this.gain(0, o);
        const s = this.osc('triangle', 520, t, t + 0.2, amp);
        s.frequency.exponentialRampToValueAtTime(470, t + 0.1);
        amp.gain.setValueAtTime(0.18 * v, t);
        amp.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        this.noiseHit(t, 0.05, o, 'highpass', 3000, 1, 0.12 * v);
        break;
      }
      case 'clave': {
        const amp = this.gain(0, o);
        this.osc('sine', 2500, t, t + 0.06, amp);
        amp.gain.setValueAtTime(0.14 * v, t);
        amp.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        break;
      }
      default:
        break;
    }
  }
}
