// Lint Roller — app shell: boot, renderer, main loop, state machine (menus <-> play <-> results),
// audio, save, haptics, postcard.
import * as THREE from 'three';
import { AssetLibrary } from './render/assets.js';
import { shared } from './render/materials.js';
import { TIERS, AutoQuality } from './render/quality.js';
import { sharedTime } from './render/environment.js';
import { Crust } from './game/crust.js';
import { Session } from './game/session.js';
import { Input } from './core/input.js';
import { Events } from './core/events.js';
import { SaveStore } from './core/save.js';
import { LEVELS } from './levels/index.js';
import { formatSize } from './game/rules.js';
import { SKINS, isUnlocked } from './game/skins.js';
import { AudioEngine } from './audio/engine.js';
import { Music } from './audio/music.js';
import { Sfx } from './audio/sfx.js';
import { SONGS } from './audio/songs.js';
import { UI } from './ui/ui.js';
import { Autopilot } from './debug/autopilot.js';

const params = new URLSearchParams(location.search);
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

class App {
  constructor() {
    this.events = new Events();
    this.save = new SaveStore();
    this.lib = new AssetLibrary();
    this.audio = new AudioEngine();
    this.sfx = new Sfx(this.audio);
    this.music = new Music(this.audio);
    this.canvas = document.getElementById('gl');
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const qs = this.save.data.settings.quality;
    this.qualityName = params.get('q') || (qs === 'auto' ? 'medium' : qs);
    this.quality = TIERS[this.qualityName];
    this.dprScale = 1;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x2a1e3f, 1);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.01, 100);
    this.crust = new Crust(90000);
    this.input = new Input(document.getElementById('play'), document.getElementById('stick'));
    this.input.onQuickTurn = () => this.session && !this.session.over && this.session.cam.quickTurn();
    this.auto = new AutoQuality((tier, scale) => this.setQuality(tier, scale, true));
    this.auto.enabled = qs === 'auto' && !params.get('q');
    this.auto.ceiling = 'high';
    this.session = null;
    this.focalPx = 800;
    this.last = performance.now();
    this.frames = 0;
    this.stats = { frameMs: 16 };
    this.skinId = this.save.data.skins.equipped;
    this.autopilot = params.get('auto') ? new Autopilot(this) : null;
    this.simSpeed = parseInt(params.get('sim')) || 1;
    this.orbit = 0;
    this.hapticLast = 0;
    this.lastMode = 'timed';
    this.ui = new UI(this);
    this.audio.setVolumes(this.save.data.settings.music, this.save.data.settings.sfx);
    this.wireEvents();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    // first gesture anywhere unlocks audio (iOS)
    const unlock = () => {
      this.audio.unlock();
      if (this.audio.ctx && !this.musicStarted) {
        this.musicStarted = true;
        this.playMusicForState();
        const hint = document.querySelector('.sound-hint');
        if (hint) hint.classList.add('hide');
      }
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('touchend', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => this.onVisibility());
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      if (this.session && !this.session.over) this.pause();
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.resize();
    });
  }

  // ------------------------------------------------------------ boot
  async boot() {
    this.ui.showLoading('Unpacking crumbs…');
    await this.lib.loadCatalog();
    this.ui.setLoading(0.3);
    try {
      const r = await fetch('assets/icons.json');
      if (r.ok) this.ui.icons = await r.json();
    } catch {
      /* icons are optional */
    }
    await this.lib.loadPack('CHAR');
    this.ui.setLoading(0.6);
    await this.lib.loadPack('L1');
    this.ui.setLoading(1);
    this.ui.hideLoading();
    const lvl = params.get('level');
    if (lvl) {
      // dev / test shortcut: straight into a level
      await this.startLevel(Math.max(0, Math.min(5, parseInt(lvl) - 1)), params.get('mode') || 'timed', { skipStory: true });
    } else this.ui.showTitle();
    const loop = (now) => {
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  wireEvents() {
    const ev = this.events;
    ev.on('pickup', (e) => {
      this.sfx.pickup(e.type.mat, e.rel, e.combo);
      this.ui.hudPickup(e.type);
      if (e.rel > 0.2) this.haptic('pick');
    });
    ev.on('tiny', () => this.sfx.tiny());
    ev.on('bump', (e) => {
      this.sfx.bump(e.impact, e.knocked);
      this.haptic('bump');
    });
    ev.on('wobble', () => this.sfx.wobble());
    ev.on('milestone', (e) => {
      this.sfx.milestone(Math.round(Math.log10(e.size) * 3));
      this.ui.hudStamp(formatSize(e.size) + '!');
      this.haptic('big');
    });
    ev.on('target', (e) => {
      this.sfx.target();
      this.ui.hudTarget(e.session.mode === 'timed');
      this.haptic('big');
    });
    ev.on('session:end', (r) => this.onSessionEnd(r));
  }

  // ------------------------------------------------------------ rendering
  setQuality(name, scale = 1, fromAuto = false) {
    this.qualityName = name;
    this.quality = TIERS[name];
    this.dprScale = scale;
    const s = this.session;
    if (s) {
      s.world.lodPx = this.quality.lodPx;
      s.world.cullPx = this.quality.cullPx;
      s.world.setOutlines(this.quality.outlines);
      s.particles.budget = this.quality.particles;
    }
    this.resize();
    if (!fromAuto) this.auto.reset(name);
  }

  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.dpr) * this.dprScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const bw = Math.round(w * dpr),
      bh = Math.round(h * dpr);
    shared.uResolution.value.set(bw, bh);
    shared.uOutlinePx.value = 2.4 * Math.max(1, dpr * 0.85);
    this.focalPx = bh / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    sharedTime.value += dt;
    const s = this.session;
    if (this.autopilot) this.autopilot.update(dt);
    this.input.update();
    if (s && !this.contextLost) {
      if (!s.over) {
        for (let k = 1; k < this.simSpeed && !s.over && !s.paused; k++) {
          if (this.autopilot) this.autopilot.update(1 / 60);
          this.input.update();
          s.update(1 / 60, this.input);
        }
        s.update(dt, this.input);
        if (!s.over) this.ui.hudFrame(s);
        if (s.mode === 'timed' && !s.over) this.music.tempoScale = s.timeLeft < 30 ? 1.07 : 1;
      } else this.resultsCamera(dt);
      s.render(this.renderer);
      if (!s.paused) this.auto.frame(dt);
    }
    this.frames++;
    this.stats.frameMs = this.stats.frameMs * 0.95 + dt * 1000 * 0.05;
  }

  resultsCamera(dt) {
    const s = this.session;
    const b = s.ball;
    this.orbit += dt * 0.35;
    const r = s.rVis;
    const cam = this.camera;
    cam.position.set(b.pos.x + Math.sin(this.orbit) * r * 5, b.pos.y + r * 1.4, b.pos.z + Math.cos(this.orbit) * r * 5);
    cam.lookAt(b.pos.x, b.pos.y - r * 1.9, b.pos.z);
    cam.near = r * 0.05;
    cam.far = r * 900;
    cam.updateProjectionMatrix();
    s.ballGroup.rotateY(dt * 0.25);
    s.particles.update(dt);
    s.lint.update(dt, b, this.orbit + Math.PI, s.lint.scale, s.env.groundAt(b.pos.x, b.pos.z));
    if (Math.random() < dt * 0.6) s.lint.celebrate(0.7);
  }

  // ------------------------------------------------------------ flow
  playMusicForState() {
    if (!this.audio.ctx) return;
    if (this.session && !this.session.over) {
      const song = SONGS[this.session.level.theme];
      this.music.play(song);
      this.sfx.setKey(song.id);
    } else {
      this.music.play(SONGS.title);
      this.sfx.setKey('title');
    }
  }

  async startLevel(i, mode, { skipStory = false } = {}) {
    const level = LEVELS[i];
    this.lastMode = mode;
    this.ui.closeOverlay();
    if (!skipStory) {
      const lines = this.ui.storyFor(i);
      if (lines) await this.ui.dialog(lines);
    }
    this.ui.showLoading(['Unpacking crumbs…', 'Pairing socks…', 'Dusting the sofa…', 'Mowing lawns…', 'Polishing the town…', 'Inflating the city…'][i]);
    const packs = ['CHAR', ...level.packs];
    for (let k = 0; k < packs.length; k++) {
      await this.lib.loadPack(packs[k]).catch((e) => console.warn('pack', packs[k], e.message));
      this.ui.setLoading((k + 1) / (packs.length + 1));
    }
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
    await new Promise((r) => setTimeout(r, 30));
    const s = new Session(this, level, mode);
    s.build();
    s.levelIndex = i;
    s.world.lodPx = this.quality.lodPx;
    s.world.cullPx = this.quality.cullPx;
    s.world.setOutlines(this.quality.outlines);
    this.session = s;
    // warm up: compile shaders for every batch once before revealing
    s.update(1 / 60, this.input);
    s.render(this.renderer);
    this.renderer.compile(s.scene, this.camera);
    this.ui.setLoading(1);
    this.ui.hideLoading();
    this.ui.clearScreen();
    this.input.setEnabled(true);
    this.auto.reset(this.qualityName);
    this.ui.hudStart(s);
    this.playMusicForState();
    return s;
  }

  pause() {
    const s = this.session;
    if (!s || s.over || s.paused) return;
    s.paused = true;
    this.input.setEnabled(false);
    this.ui.showPause(s);
    if (this.audio.ctx) this.audio.duck.gain.setTargetAtTime(0.35, this.audio.now, 0.1);
  }

  resume() {
    const s = this.session;
    if (!s || s.over) return;
    this.ui.closeOverlay();
    s.paused = false;
    this.last = performance.now();
    this.input.setEnabled(true);
    if (this.audio.ctx) this.audio.duck.gain.setTargetAtTime(1, this.audio.now, 0.1);
  }

  finish() {
    const s = this.session;
    if (!s || s.over) return;
    this.ui.closeOverlay();
    s.paused = false;
    if (this.audio.ctx) this.audio.duck.gain.setTargetAtTime(1, this.audio.now, 0.1);
    s.end('finish');
  }

  restart() {
    const s = this.session;
    if (!s) return;
    this.ui.closeOverlay();
    if (this.audio.ctx) this.audio.duck.gain.setTargetAtTime(1, this.audio.now, 0.1);
    this.startLevel(s.levelIndex ?? s.level.n - 1, s.mode, { skipStory: true });
  }

  quitToLevels() {
    this.ui.closeOverlay();
    this.ui.hudEnd();
    this.input.setEnabled(false);
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
    if (this.audio.ctx) this.audio.duck.gain.setTargetAtTime(1, this.audio.now, 0.1);
    this.renderer.clear();
    this.ui.showLevels();
    this.playMusicForState();
  }

  onSessionEnd(result) {
    this.input.setEnabled(false);
    this.ui.hudEnd();
    this.music.stop(1.2);
    if (result.reason === 'time') this.sfx.timeUp();
    const i = result.level.n - 1;
    const before = this.unlockContext();
    const rec = this.save.recordResult(i, result.level.id, result);
    const after = this.unlockContext();
    this.lastResult = { result, rec };
    this.orbit = this.session.cam.yaw + Math.PI;
    setTimeout(() => this.sfx.results(result.completed), result.reason === 'time' ? 1100 : 200);
    setTimeout(() => {
      this.ui.showResults(result, rec);
      for (const sk of SKINS) if (!isUnlocked(sk, before) && isUnlocked(sk, after)) setTimeout(() => this.ui.toast(`New ball skin: ${sk.name}!`, 'hot'), 1600);
      if (result.completed && result.level.n === 6 && !this.save.data.story.ending) {
        this.save.data.story.ending = true;
        this.save.save();
        setTimeout(() => this.ui.showEnding(), 2600);
      }
    }, result.reason === 'time' ? 1300 : 400);
    setTimeout(() => {
      if (this.audio.ctx && this.session && this.session.over) this.music.play(SONGS.title, { fadeIn: 2 });
    }, 3500);
  }

  // ------------------------------------------------------------ settings / meta
  setSetting(k, v) {
    const st = this.save.data.settings;
    st[k] = v;
    this.save.save();
    if (k === 'music' || k === 'sfx') this.audio.setVolumes(st.music, st.sfx);
    if (k === 'quality') {
      this.auto.enabled = v === 'auto';
      this.setQuality(v === 'auto' ? 'medium' : v);
    }
  }

  setSkin(id) {
    this.save.data.skins.equipped = id;
    if (!this.save.data.skins.owned.includes(id)) this.save.data.skins.owned.push(id);
    this.save.save();
    this.skinId = id;
    if (this.session) this.session.setSkin(id);
    this.ui.toast(`Now rolling: ${SKINS.find((s) => s.id === id).name}`);
  }

  unlockContext() {
    const d = this.save.data;
    let levelsDone = 0;
    LEVELS.forEach((L, i) => {
      const r = d.levels[L.id];
      if (r && (r.zen.done || r.timed.done)) levelsDone = Math.max(levelsDone, i + 1);
    });
    return { stars: this.save.totalStars(), levelsDone, types: this.save.discovered() };
  }

  resetProgress() {
    this.save.reset();
    this.skinId = 'lavender';
  }

  haptic(kind) {
    if (!this.save.data.settings.haptics) return;
    const now = performance.now();
    if (now - this.hapticLast < (kind === 'tap' ? 40 : 90)) return;
    this.hapticLast = now;
    if (navigator.vibrate) {
      navigator.vibrate(kind === 'big' ? [18, 40, 18] : kind === 'bump' ? 28 : 10);
    } else if (isIOS) {
      // iOS 18+ Safari plays a system haptic when a switch control toggles
      const l = document.getElementById('haptic-label');
      if (l) l.click();
    }
  }

  hapticsNote() {
    if (navigator.vibrate) return 'Your device supports vibration.';
    if (isIOS) return 'iPhone haptics need iOS 18 or newer.';
    return 'This device has no vibration support; the setting is kept for later.';
  }

  autoInfo() {
    return this.auto.enabled ? ` Right now: ${this.qualityName}${this.dprScale < 1 ? ' (reduced resolution)' : ''}.` : '';
  }

  onVisibility() {
    if (document.hidden) {
      if (this.session && !this.session.over) this.pause();
      this.audio.suspend();
    } else {
      this.audio.resume();
      this.last = performance.now();
    }
  }

  // ------------------------------------------------------------ postcard
  async makePostcard() {
    const s = this.session;
    if (!s) return;
    try {
      await document.fonts.load('64px Shrikhand');
      await document.fonts.load('800 40px "Baloo 2"');
    } catch {
      /* fallback fonts are fine */
    }
    const SZ = 900;
    const rt = new THREE.WebGLRenderTarget(SZ, SZ, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const r = s.rVis;
    const cam = new THREE.PerspectiveCamera(40, 1, r * 0.05, r * 900);
    const b = s.ball;
    const a = this.orbit;
    cam.position.set(b.pos.x + Math.sin(a) * r * 4.4, b.pos.y + r * 1.6, b.pos.z + Math.cos(a) * r * 4.4);
    cam.lookAt(b.pos.x, b.pos.y - r * 0.15, b.pos.z);
    cam.updateMatrixWorld();
    const oldRes = shared.uResolution.value.clone();
    const oldFocal = shared.uFocalPx.value;
    const focal = SZ / 2 / Math.tan(THREE.MathUtils.degToRad(20));
    shared.uResolution.value.set(SZ, SZ);
    shared.uFocalPx.value = focal;
    s.world.updateRender(cam, focal);
    this.renderer.setRenderTarget(rt);
    this.renderer.render(s.scene, cam);
    const px = new Uint8Array(SZ * SZ * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, SZ, SZ, px);
    this.renderer.setRenderTarget(null);
    shared.uResolution.value.copy(oldRes);
    shared.uFocalPx.value = oldFocal;
    rt.dispose();
    const shot = document.createElement('canvas');
    shot.width = shot.height = SZ;
    const sctx = shot.getContext('2d');
    const img = sctx.createImageData(SZ, SZ);
    for (let y = 0; y < SZ; y++) img.data.set(px.subarray((SZ - 1 - y) * SZ * 4, (SZ - y) * SZ * 4), y * SZ * 4);
    sctx.putImageData(img, 0, 0);

    const W = 1080,
      H = 1350;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const L = s.level;
    const css = getComputedStyle(document.documentElement);
    const col = (n) => css.getPropertyValue('--' + n).trim() || '#FFC830';
    g.fillStyle = col(L.color);
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(42,30,63,0.13)';
    for (let y = 18; y < H; y += 40)
      for (let x = 18 + ((y / 40) % 2) * 20; x < W; x += 40) {
        g.beginPath();
        g.arc(x, y, 5, 0, 7);
        g.fill();
      }
    const rr = (x, y, w, h, rad) => {
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, w, h, rad);
      else g.rect(x, y, w, h);
    };
    g.fillStyle = col('ink');
    rr(64, 74, W - 128, H - 140, 40);
    g.fill();
    g.fillStyle = col('paper');
    rr(64, 64, W - 128, H - 140, 40);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = col('ink');
    g.stroke();
    g.save();
    rr(100, 100, W - 200, W - 200, 26);
    g.clip();
    g.drawImage(shot, 100, 100, W - 200, W - 200);
    g.restore();
    rr(100, 100, W - 200, W - 200, 26);
    g.lineWidth = 7;
    g.stroke();
    g.textAlign = 'left';
    g.fillStyle = col('ink');
    g.font = '64px Shrikhand, Georgia, serif';
    g.fillText(L.name, 110, W + 12);
    g.font = '800 46px "Baloo 2", system-ui, sans-serif';
    g.fillStyle = col('ink-soft');
    g.fillText(`${formatSize(b.diameter)} · ${s.pickups} things rolled up`, 112, W + 78);
    g.font = '700 34px "Baloo 2", system-ui, sans-serif';
    g.fillText(`Lint Roller · ${new Date().toLocaleDateString()}`, 112, W + 132);
    // inspection stamp
    g.save();
    g.translate(W - 230, W - 70);
    g.rotate(-0.22);
    g.strokeStyle = col('tomato');
    g.fillStyle = col('tomato');
    g.lineWidth = 8;
    g.beginPath();
    g.arc(0, 0, 112, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, 96, 0, Math.PI * 2);
    g.lineWidth = 3;
    g.stroke();
    g.textAlign = 'center';
    g.font = '52px Shrikhand, Georgia, serif';
    g.fillText('TIDY!', 0, 14);
    g.font = '800 22px "Baloo 2", system-ui, sans-serif';
    g.fillText('INSPECTED BY', 0, -44);
    g.fillText('M. P. PLUME', 0, 58);
    g.restore();
    this.ui.showPostcard(c.toDataURL('image/jpeg', 0.9));
  }
}

async function boot() {
  const app = new App();
  window.__game = app;
  await app.boot();
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('boot-error');
  if (el) el.textContent = 'Lint Roller could not load: ' + e.message + '. Reload the page to try again.';
});
