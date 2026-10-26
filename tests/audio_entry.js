import { AudioEngine } from '../src/audio/engine.js';
import { Music } from '../src/audio/music.js';
import { Sfx } from '../src/audio/sfx.js';
import { SONGS } from '../src/audio/songs.js';

function stats(buf) {
  let peak = 0, sum = 0, n = 0, nan = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) { const v = d[i]; if (!Number.isFinite(v)) { nan++; continue; } const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; n++; }
  }
  // per-second RMS to find dropouts
  const d = buf.getChannelData(0); const sr = buf.sampleRate; const secs = [];
  for (let s = 0; s + sr <= d.length; s += sr) { let q = 0; for (let i = s; i < s + sr; i++) q += d[i] * d[i]; secs.push(Math.sqrt(q / sr)); }
  return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4), nan, minSecRms: +Math.min(...secs.slice(1)).toFixed(4) };
}

window.renderSong = async (id, secs = 20) => {
  const e = new AudioEngine();
  e.ctx = new OfflineAudioContext(2, 44100 * secs, 44100);
  e.build();
  const m = new Music(e);
  const song = SONGS[id];
  m.song = song; m.out = e.ctx.createGain(); m.out.gain.value = song.gain ?? 1; m.out.connect(e.music);
  m.prepare(song); m.sec = 0; m.bar = 0; m.step = 0; m.next = 0.05;
  while (m.next < secs - 0.5) { m.schedule(m.next); m.advance(); }
  const buf = await e.ctx.startRendering();
  return stats(buf);
};

window.renderSfx = async () => {
  const e = new AudioEngine();
  e.ctx = new OfflineAudioContext(2, 44100 * 12, 44100);
  e.build();
  Object.defineProperty(e, 'running', { get: () => true });
  const s = new Sfx(e);
  let t = 0;
  const at = (fn) => { const save = Object.getOwnPropertyDescriptor(AudioEngine.prototype, 'now'); Object.defineProperty(e, 'now', { get: () => t, configurable: true }); fn(); };
  const mats = ['soft', 'wood', 'metal', 'ceramic', 'glass', 'food', 'plastic', 'paper', 'electronic', 'living', 'stone', 'rubber', 'plant'];
  mats.forEach((mat, i) => { t = 0.1 + i * 0.25; at(() => s.pickup(mat, 0.3, i + 1)); });
  t = 4; at(() => s.bump(1.2, 2)); t = 5; at(() => s.milestone(1)); t = 6.5; at(() => s.target()); t = 9; at(() => s.timeUp()); t = 10.2; at(() => s.babble('Lint. The Grand Tidiness Inspection is TODAY.'));
  const buf = await e.ctx.startRendering();
  return stats(buf);
};
