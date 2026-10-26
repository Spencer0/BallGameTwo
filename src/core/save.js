// Progress + settings persistence in localStorage. Every access is guarded: private mode,
// blocked storage or corrupt JSON all fall back to a fresh in-memory save.
export const SAVE_KEY = 'lintroller.save.v1';
export const SAVE_VERSION = 1;

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    unlocked: 1, // number of unlocked levels
    levels: {}, // id -> { zen: { best, done }, timed: { best, stars, done } }
    seen: {}, // object type id -> times collected (collection log)
    skins: { owned: ['lavender'], equipped: 'lavender' },
    story: { intro: false, beats: {} }, // beats[levelId] = true once the post-level beat was shown
    settings: { music: 0.7, sfx: 0.9, haptics: true, quality: 'auto' },
    stats: { pickups: 0, playSeconds: 0, sessions: 0 },
  };
}

function num(v, d, lo = -Infinity, hi = Infinity) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
}

/** Repair/upgrade any parsed object into a valid save. */
export function sanitize(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const s = d;
  s.unlocked = Math.round(num(raw.unlocked, 1, 1, 6));
  if (raw.levels && typeof raw.levels === 'object') {
    for (const [id, l] of Object.entries(raw.levels)) {
      if (!l || typeof l !== 'object') continue;
      s.levels[id] = {
        zen: { best: num(l.zen?.best, 0, 0), done: !!l.zen?.done },
        timed: { best: num(l.timed?.best, 0, 0), stars: Math.round(num(l.timed?.stars, 0, 0, 3)), done: !!l.timed?.done },
      };
    }
  }
  if (raw.seen && typeof raw.seen === 'object') {
    for (const [id, c] of Object.entries(raw.seen)) {
      const n = Math.round(num(c, 0, 0));
      if (n > 0 && typeof id === 'string' && id.length < 64) s.seen[id] = n;
    }
  }
  if (raw.skins && Array.isArray(raw.skins.owned)) {
    s.skins.owned = [...new Set(['lavender', ...raw.skins.owned.filter((x) => typeof x === 'string')])];
    s.skins.equipped = s.skins.owned.includes(raw.skins.equipped) ? raw.skins.equipped : 'lavender';
  }
  if (raw.story) {
    s.story.intro = !!raw.story.intro;
    if (raw.story.beats && typeof raw.story.beats === 'object') for (const k of Object.keys(raw.story.beats)) s.story.beats[k] = !!raw.story.beats[k];
  }
  if (raw.settings) {
    s.settings.music = num(raw.settings.music, 0.7, 0, 1);
    s.settings.sfx = num(raw.settings.sfx, 0.9, 0, 1);
    s.settings.haptics = raw.settings.haptics !== false;
    s.settings.quality = ['auto', 'low', 'medium', 'high'].includes(raw.settings.quality) ? raw.settings.quality : 'auto';
  }
  if (raw.stats) {
    s.stats.pickups = Math.round(num(raw.stats.pickups, 0, 0));
    s.stats.playSeconds = num(raw.stats.playSeconds, 0, 0);
    s.stats.sessions = Math.round(num(raw.stats.sessions, 0, 0));
  }
  return s;
}

export class SaveStore {
  constructor(storage = safeStorage()) {
    this.storage = storage;
    this.data = this.load();
  }

  load() {
    try {
      const txt = this.storage && this.storage.getItem(SAVE_KEY);
      if (!txt) return defaultSave();
      return sanitize(JSON.parse(txt));
    } catch {
      return defaultSave();
    }
  }

  save() {
    try {
      if (this.storage) this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  reset() {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings;
    this.save();
  }

  level(id) {
    if (!this.data.levels[id]) this.data.levels[id] = { zen: { best: 0, done: false }, timed: { best: 0, stars: 0, done: false } };
    return this.data.levels[id];
  }

  /**
   * Record a finished session. Returns { newBest, newStars, unlockedNext, newTypes:[ids] }.
   * levelIndex is 0-based.
   */
  recordResult(levelIndex, levelId, result) {
    const L = this.level(levelId);
    const m = result.mode === 'timed' ? L.timed : L.zen;
    const out = { newBest: false, newStars: 0, unlockedNext: false, newTypes: [] };
    if (result.diameter > m.best) {
      m.best = result.diameter;
      out.newBest = true;
    }
    if (result.mode === 'timed' && result.stars > L.timed.stars) {
      out.newStars = result.stars - L.timed.stars;
      L.timed.stars = result.stars;
    }
    if (result.completed) {
      m.done = true;
      if (this.data.unlocked < levelIndex + 2 && levelIndex + 2 <= 6) {
        this.data.unlocked = levelIndex + 2;
        out.unlockedNext = true;
      }
    }
    for (const [id, c] of result.collected) {
      if (c <= 0) continue;
      if (!this.data.seen[id]) out.newTypes.push(id);
      this.data.seen[id] = (this.data.seen[id] || 0) + c;
      this.data.stats.pickups += c;
    }
    this.data.stats.sessions++;
    this.data.stats.playSeconds += result.time || 0;
    this.save();
    return out;
  }

  totalStars() {
    let s = 0;
    for (const l of Object.values(this.data.levels)) s += l.timed.stars;
    return s;
  }

  discovered() {
    return Object.keys(this.data.seen).length;
  }
}

export function safeStorage() {
  try {
    const s = window.localStorage;
    const k = '__lr_probe';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return memoryStorage();
  }
}

export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
