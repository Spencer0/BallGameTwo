// Step sequencer for the original level themes. Songs are chord charts + groove templates +
// written melodies (see songs.js). Look-ahead scheduling keeps timing tight even when the
// main thread hitches.

const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const QUAL = {
  '': [0, 4, 7],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  6: [0, 4, 7, 9],
  69: [0, 4, 7, 9, 14],
  m: [0, 3, 7],
  m6: [0, 3, 7, 9],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  7: [0, 4, 7, 10],
  9: [0, 4, 7, 10, 14],
  13: [0, 4, 7, 10, 14, 21],
  '7#9': [0, 4, 7, 10, 15],
  '7b9': [0, 4, 7, 10, 13],
  '7sus4': [0, 5, 7, 10],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
};

const chordCache = new Map();
export function parseChord(sym) {
  if (chordCache.has(sym)) return chordCache.get(sym);
  const m = /^([A-G][#b]?)(.*)$/.exec(sym);
  if (!m) throw new Error('bad chord ' + sym);
  const root = PC[m[1]];
  const ints = QUAL[m[2]];
  if (!ints) throw new Error('bad chord quality ' + sym);
  const third = ints.includes(4) ? 4 : ints.includes(3) ? 3 : ints.includes(5) ? 5 : 4;
  const fifth = ints.includes(7) ? 7 : ints.includes(6) ? 6 : ints.includes(8) ? 8 : 7;
  const seventh = ints.includes(10) ? 10 : ints.includes(11) ? 11 : ints.includes(9) ? 9 : 12;
  const c = { sym, root, ints, third, fifth, seventh };
  chordCache.set(sym, c);
  return c;
}

const NOTE_RE = /^([A-G][#b]?)(-?\d)$/;
export function noteToMidi(n) {
  const m = NOTE_RE.exec(n);
  if (!m) throw new Error('bad note ' + n);
  return PC[m[1]] + (parseInt(m[2]) + 1) * 12;
}

/** "A4/2 C5/2 r/4 E5/8!" -> [{step, midi, len, vel}] */
export function parseMelody(str) {
  const out = [];
  let step = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const accent = tok.endsWith('!');
    const [n, l] = tok.replace('!', '').split('/');
    const len = parseFloat(l);
    if (n !== 'r') out.push({ step, midi: noteToMidi(n), len, vel: accent ? 1 : 0.8 });
    step += len;
  }
  out.total = step;
  return out;
}

const VEL = { X: 1, x: 0.8, o: 0.55, g: 0.28 };

function degree(d, chord, next) {
  if (d.startsWith('n')) return degree(d.slice(1), next, next);
  switch (d) {
    case 'R':
      return 0;
    case '8':
      return 12;
    case '3':
      return chord.third;
    case 'b3':
      return 3;
    case '5':
      return chord.fifth;
    case '-5':
      return chord.fifth - 12;
    case '7':
      return chord.seventh;
    case 'b7':
      return 10;
    case '-7':
      return chord.seventh - 12;
    case '6':
      return 9;
    case '2':
      return 2;
    case '4':
      return 5;
    case 'ap': // chromatic approach from below to the next root
      return ((next.root - chord.root + 12) % 12) - 1;
    case 'ap+':
      return ((next.root - chord.root + 12) % 12) + 1;
    default:
      return 0;
  }
}

function bassMidi(chord, low = 36) {
  let m = low + chord.root;
  if (m > low + 7) m -= 12;
  return m;
}

/** rootless-ish piano voicing around the middle of the keyboard */
function voicing(chord, lo = 55, hi = 72) {
  const tones = chord.ints.length > 3 ? chord.ints.slice(1) : chord.ints.slice();
  const notes = [];
  for (const iv of tones) {
    let n = 48 + ((chord.root + iv) % 12);
    while (n < lo) n += 12;
    while (n > hi) n -= 12;
    if (!notes.includes(n)) notes.push(n);
  }
  return notes.sort((a, b) => a - b);
}

export class Music {
  constructor(engine) {
    this.e = engine;
    this.song = null;
    this.timer = null;
    this.tempoScale = 1;
    this.out = null;
  }

  play(song, { fadeIn = 0.3 } = {}) {
    const e = this.e;
    if (!e.ctx) return;
    if (this.song === song && this.timer) return;
    this.stop(0.4);
    this.song = song;
    this.out = e.ctx.createGain();
    this.out.gain.setValueAtTime(0, e.now);
    this.out.gain.linearRampToValueAtTime(song.gain ?? 1, e.now + fadeIn);
    this.out.connect(e.music);
    this.sec = 0;
    this.bar = 0;
    this.step = 0;
    this.next = e.now + 0.08;
    this.prepare(song);
    this.tempoScale = 1;
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  prepare(song) {
    if (song._prepared) return;
    for (const s of Object.values(song.sections)) {
      s.chordGrid = [];
      s.chords.forEach((bar) => {
        const parts = bar.split(/\s+/);
        for (let h = 0; h < 16; h++) s.chordGrid.push(parseChord(parts[Math.min(parts.length - 1, Math.floor((h * parts.length) / 16))]));
      });
      for (const p of s.parts) {
        if (p.notes && !p.parsed) p.parsed = parseMelody(p.notes);
        if (p.type === 'drums' && !p.voices) p.voices = Object.entries(p.pat);
      }
    }
    song._prepared = true;
  }

  stop(fade = 0.5) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.out && this.e.ctx) {
      const g = this.out;
      const t = this.e.now;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => g.disconnect(), (fade + 2) * 1000);
    }
    this.out = null;
    this.song = null;
  }

  tick() {
    const e = this.e;
    if (!this.song || !e.ctx) return;
    if (e.ctx.state !== 'running') {
      this.next = e.now + 0.05;
      return;
    }
    // if we fell far behind (tab hidden), resync instead of bursting notes
    if (this.next < e.now - 0.25) this.next = e.now + 0.05;
    while (this.next < e.now + 0.22) {
      this.schedule(this.next);
      this.advance();
    }
  }

  stepDur() {
    return 60 / (this.song.bpm * this.tempoScale) / 4;
  }

  advance() {
    this.next += this.stepDur();
    this.step++;
    if (this.step >= 16) {
      this.step = 0;
      this.bar++;
      const name = this.song.arrange[this.sec];
      if (this.bar >= this.song.sections[name].chords.length) {
        this.bar = 0;
        this.sec++;
        if (this.sec >= this.song.arrange.length) this.sec = this.song.loopFrom ?? 0;
      }
    }
  }

  schedule(t0) {
    const song = this.song;
    const s = song.sections[song.arrange[this.sec]];
    const bar = this.bar,
      step = this.step;
    const sd = this.stepDur();
    const swing = song.swing || 0;
    let t = t0;
    if (song.swing8) {
      if (step % 4 === 2) t += sd * 0.667 * song.swing8;
    } else if (step % 2 === 1) t += sd * 0.33 * swing;
    const gi = bar * 16 + step;
    const chord = s.chordGrid[gi];
    const nextChord = s.chordGrid[(gi + 1) % s.chordGrid.length] === chord ? this.nextDifferent(s, gi) : s.chordGrid[(gi + 1) % s.chordGrid.length];
    const bus = this.out;
    const e = this.e;
    const tp = (s.transpose || 0) + (song.transpose || 0);
    for (const p of s.parts) {
      switch (p.type) {
        case 'drums': {
          for (const [voice, pat] of p.voices) {
            const ch = pat[(bar * 16 + step) % pat.length];
            const v = VEL[ch];
            if (v) e.drum(voice, t, v * (p.vel ?? 1), bus);
          }
          break;
        }
        case 'bass': {
          const len = p.pat.length ? p.patLen || 16 : 16;
          const local = (bar * 16 + step) % len;
          for (const [st, d, l, v] of p.pat) {
            if (st !== local) continue;
            e.bass(t, bassMidi(chord) + degree(d, chord, nextChord) + tp, l * sd * 0.92, v ?? 0.9, bus, p.style);
          }
          break;
        }
        case 'walk': {
          if (step % 4 !== 0) break;
          const beat = step / 4;
          const base = bassMidi(chord);
          const opts = [0, chord.third, chord.fifth, chord.seventh - 12];
          let n;
          if (beat === 0) n = base;
          else if (beat === 3) n = base + degree('ap', chord, nextChord);
          else n = base + opts[(bar + beat * 2 + (chord.root % 3)) % opts.length];
          e.bass(t, n + tp, sd * 3.6, beat === 0 ? 0.95 : 0.8, bus, 'finger');
          break;
        }
        case 'comp': {
          const ch = p.rhythm[(bar * 16 + step) % p.rhythm.length];
          const v = VEL[ch];
          if (!v) break;
          let l = 1;
          while (p.rhythm[(bar * 16 + step + l) % p.rhythm.length] === '-' && l < 16) l++;
          const voiced = voicing(chord, p.lo ?? 55, p.hi ?? 72);
          for (const n of voiced) e[p.inst](t, n + tp + (p.oct || 0) * 12, l * sd * 0.9, v * (p.vel ?? 0.8), bus);
          break;
        }
        case 'arp': {
          const len = p.patLen || 16;
          const local = (bar * 16 + step) % len;
          for (const [st, idx, l] of p.pat) {
            if (st !== local) continue;
            const iv = chord.ints[idx % chord.ints.length] + 12 * Math.floor(idx / chord.ints.length);
            e[p.inst](t, 60 + chord.root + iv + tp + (p.oct || 0) * 12 - (chord.root > 6 ? 12 : 0), l * sd * 0.8, p.vel ?? 0.7, bus);
          }
          break;
        }
        case 'pad': {
          if (gi > 0 && s.chordGrid[gi - 1] === chord && step !== 0) break;
          if (gi > 0 && s.chordGrid[gi - 1] === chord) break;
          let l = 1;
          while (gi + l < s.chordGrid.length && s.chordGrid[gi + l] === chord) l++;
          for (const n of voicing(chord, 52, 70)) e.pad(t, n + tp, l * sd, p.vel ?? 0.7, bus);
          break;
        }
        case 'mel': {
          const pos = bar * 16 + step;
          for (const n of p.parsed) {
            if (n.step !== pos) continue;
            const mm = n.midi + tp + (p.shift || 0) + (p.oct || 0) * 12;
            e[p.inst](t, mm, n.len * sd * (p.legato ?? 0.92), n.vel * (p.vel ?? 1), bus);
            if (p.double) e[p.double](t, mm + (p.doubleOct || 0) * 12, n.len * sd * 0.9, n.vel * 0.6, bus);
          }
          break;
        }
        case 'hit': {
          // one-shot stabs at specific bar/steps: [[bar, step, inst]]
          for (const [b, st] of p.at) {
            if (b !== bar || st !== step) continue;
            for (const n of voicing(chord, 60, 79)) e[p.inst](t, n + tp, (p.len || 2) * sd, p.vel ?? 0.9, bus);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  nextDifferent(s, gi) {
    const c = s.chordGrid[gi];
    for (let k = 1; k < s.chordGrid.length; k++) {
      const n = s.chordGrid[(gi + k) % s.chordGrid.length];
      if (n !== c) return n;
    }
    return c;
  }
}
