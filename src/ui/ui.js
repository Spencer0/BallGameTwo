// DOM UI: screens, HUD, overlays. Styled by style.css following STYLE.md (sticker panels,
// Shrikhand display + Baloo 2 UI). Talks to the app through a small action interface.
import { ICON } from './icons.js';
import { LEVELS } from '../levels/index.js';
import { formatSize, formatTime, STAR_RATIOS } from '../game/rules.js';
import { SKINS, isUnlocked } from '../game/skins.js';
import { INTRO, BEFORE, ENDING, verdictFor, moodFor } from '../game/story.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const IMG = 'assets/img/';

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export class UI {
  constructor(app) {
    this.app = app;
    this.root = $('#ui');
    this.hudEl = $('#hud');
    this.screen = null;
    this.overlay = null;
    this.icons = null; // atlas meta
    this.hudState = {};
    this.toastQ = [];
    this.buildHud();
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      e.preventDefault();
      this.app.audio.unlock();
      const act = b.dataset.act;
      if (act === 'back' || act === 'close') this.app.sfx.back();
      else this.app.sfx.tap();
      this.app.haptic('tap');
      this.onAction(act, b.dataset, b);
    });
  }

  // ------------------------------------------------------------ helpers
  iconStyle(id, px = 56) {
    const meta = this.icons;
    if (!meta || meta.index[id] === undefined) return '';
    const i = meta.index[id];
    const c = meta.cols;
    const s = px / meta.cell;
    return `background-image:url(assets/icons.png);background-size:${c * meta.cell * s}px ${meta.rows * meta.cell * s}px;background-position:-${(i % c) * meta.cell * s}px -${Math.floor(i / c) * meta.cell * s}px;width:${px}px;height:${px}px`;
  }

  setScreen(node, cls = '') {
    const old = this.screen;
    if (old) {
      old.classList.add('leaving');
      setTimeout(() => old.remove(), 260);
    }
    this.screen = node;
    if (cls) node.classList.add(cls);
    this.root.appendChild(node);
    requestAnimationFrame(() => node.classList.add('in'));
  }

  clearScreen() {
    if (this.screen) {
      const old = this.screen;
      old.classList.add('leaving');
      setTimeout(() => old.remove(), 260);
      this.screen = null;
    }
  }

  setOverlay(node) {
    this.closeOverlay();
    this.overlay = node;
    this.root.appendChild(node);
    requestAnimationFrame(() => node.classList.add('in'));
  }

  closeOverlay() {
    if (this.overlay) {
      const o = this.overlay;
      o.classList.remove('in');
      o.classList.add('leaving');
      setTimeout(() => o.remove(), 260);
      this.overlay = null;
    }
  }

  toast(html, cls = '') {
    const t = el(`<div class="toast sticker ${cls}">${html}</div>`);
    this.root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.remove('in');
      setTimeout(() => t.remove(), 400);
    }, 2600);
  }

  // ------------------------------------------------------------ loading
  showLoading(text = 'Fluffing the ball…') {
    let l = $('#loading');
    if (!l) {
      l = el(`<div id="loading" class="overlay-full"><div class="load-card sticker"><img class="load-lint" src="${IMG}lint_wave.png" alt=""><div class="load-text"></div><div class="bar"><i></i></div></div></div>`);
      this.root.appendChild(l);
    }
    $('.load-text', l).textContent = text;
    this.setLoading(0);
    requestAnimationFrame(() => l.classList.add('in'));
  }
  setLoading(p) {
    const i = $('#loading .bar i');
    if (i) i.style.transform = `scaleX(${Math.max(0.03, Math.min(1, p))})`;
  }
  hideLoading() {
    const l = $('#loading');
    if (!l) return;
    l.classList.remove('in');
    setTimeout(() => l.remove(), 300);
  }

  // ------------------------------------------------------------ title
  showTitle() {
    document.body.classList.remove('playing');
    const s = this.app.save.data;
    const node = el(`
      <section class="screen title-screen bg-dots" style="--bg: var(--flamingo)">
        <div class="title-top">
          <h1 class="logo"><span>Lint</span><span>Roller</span></h1>
          <p class="tagline">A very tidy game about a very small bunny.</p>
        </div>
        <div class="title-art">
          <img class="title-prudence" src="${IMG}prudence_full.png" alt="Madame Prudence Plume, a flamingo with a monocle">
          <img class="title-lint" src="${IMG}lint_wave.png" alt="Lint, a dust bunny">
        </div>
        <div class="title-bottom">
          <button class="btn btn-primary btn-big" data-act="play">${ICON.play}<span>Play</span></button>
          <div class="row">
            <button class="btn btn-round" data-act="collection" aria-label="Collection">${ICON.book}</button>
            <button class="btn btn-round" data-act="settings" aria-label="Settings">${ICON.gear}</button>
          </div>
          <p class="sound-hint ${this.app.audio.running ? 'hide' : ''}">${ICON.music}<span>Tap anywhere for sound</span></p>
          <p class="footnote">${s.stats.sessions ? `${this.app.save.discovered()} things tidied so far` : 'Portrait, one thumb. Drag anywhere to roll.'}</p>
        </div>
      </section>`);
    this.setScreen(node);
  }

  // ------------------------------------------------------------ level select
  showLevels() {
    document.body.classList.remove('playing');
    const save = this.app.save;
    const cards = LEVELS.map((L, i) => {
      const locked = i + 1 > save.data.unlocked;
      const rec = save.data.levels[L.id];
      const stars = rec ? rec.timed.stars : 0;
      const best = rec ? Math.max(rec.timed.best, rec.zen.best) : 0;
      const done = rec && (rec.timed.done || rec.zen.done);
      return `
        <button class="level-card sticker ${locked ? 'locked' : ''}" data-act="${locked ? 'locked' : 'level'}" data-i="${i}" style="--c: var(--${L.color})">
          <span class="lc-num">${L.n}</span>
          <span class="lc-body">
            <span class="lc-name">${esc(L.name)}</span>
            <span class="lc-place">${esc(L.place)}</span>
            <span class="lc-meta">${locked ? `${ICON.lock}<em>Finish ${esc(LEVELS[i - 1].name)} to unlock</em>` : `<em>Goal ${formatSize(L.target)}</em>${best ? `<em>Best ${formatSize(best)}</em>` : ''}${done ? `<em class="done">${ICON.check}</em>` : ''}`}</span>
          </span>
          <span class="lc-stars">${[0, 1, 2].map((k) => (k < stars ? ICON.star : ICON.starEmpty)).join('')}</span>
        </button>`;
    }).join('');
    const node = el(`
      <section class="screen levels-screen bg-dots" style="--bg: var(--sky)">
        <header class="topbar">
          <button class="btn btn-round small" data-act="back-title" aria-label="Back">${ICON.back}</button>
          <h2 class="display">Pick a Mess</h2>
          <span class="chip">${ICON.star}<b>${save.totalStars()}</b>/18</span>
        </header>
        <div class="level-list">${cards}</div>
      </section>`);
    this.setScreen(node);
  }

  showModeSheet(i) {
    const L = LEVELS[i];
    const node = el(`
      <div class="overlay sheet-wrap" data-act="close-sheet">
        <div class="sheet sticker" style="--c: var(--${L.color})" data-stop>
          <div class="sheet-head"><span class="lc-num small">${L.n}</span><h3 class="display">${esc(L.name)}</h3></div>
          <button class="mode-btn" data-act="start" data-i="${i}" data-mode="zen">
            <span class="mode-ico">${ICON.zen}</span>
            <span><b>Zen</b><em>No timer. Roll as long as you like, finish from the pause menu. Reach ${formatSize(L.target)} to pass.</em></span>
          </button>
          <button class="mode-btn" data-act="start" data-i="${i}" data-mode="timed">
            <span class="mode-ico">${ICON.timer}</span>
            <span><b>Timed</b><em>Reach ${formatSize(L.target)} in ${formatTime(L.time)}. Stars at ${STAR_RATIOS.map((r) => formatSize(L.target * r)).join(' · ')}.</em></span>
          </button>
          <button class="btn btn-ghost" data-act="story" data-i="${i}">Replay the memo</button>
        </div>
      </div>`);
    node.querySelector('[data-stop]').addEventListener('click', (e) => {
      if (!e.target.closest('[data-act]')) e.stopPropagation();
    });
    this.setOverlay(node);
  }

  // ------------------------------------------------------------ dialogue
  /** lines: [[mood, text]] ; resolves when finished or skipped */
  dialog(lines) {
    return new Promise((resolve) => {
      let k = 0;
      let typing = null;
      const node = el(`
        <div class="overlay dialog">
          <button class="btn btn-ghost skip" aria-label="Skip">Skip</button>
          <div class="dlg-stage">
            <img class="dlg-portrait" alt="Madame Prudence Plume">
            <div class="dlg-bubble sticker">
              <span class="dlg-name">Madame Prudence Plume</span>
              <p class="dlg-text"></p>
              <span class="dlg-next">${ICON.next}</span>
            </div>
          </div>
        </div>`);
      const text = $('.dlg-text', node);
      const portrait = $('.dlg-portrait', node);
      const show = () => {
        const [mood, line] = lines[k];
        portrait.src = `${IMG}prudence_${mood}.png`;
        portrait.classList.remove('pop');
        void portrait.offsetWidth;
        portrait.classList.add('pop');
        text.textContent = '';
        let n = 0;
        clearInterval(typing);
        this.app.sfx.babble(line, mood === 'shocked' ? 81 : 76);
        typing = setInterval(() => {
          n += 2;
          text.textContent = line.slice(0, n);
          if (n >= line.length) {
            clearInterval(typing);
            typing = null;
          }
        }, 28);
      };
      const finish = () => {
        clearInterval(typing);
        node.removeEventListener('click', advance);
        this.closeOverlay();
        resolve();
      };
      const advance = (e) => {
        if (e && e.target.closest('.skip')) {
          this.app.sfx.back();
          return finish();
        }
        this.app.audio.unlock();
        if (typing) {
          clearInterval(typing);
          typing = null;
          text.textContent = lines[k][1];
          return;
        }
        k++;
        this.app.sfx.tap();
        if (k >= lines.length) return finish();
        show();
      };
      node.addEventListener('click', advance);
      this.setOverlay(node);
      show();
    });
  }

  storyFor(i, force = false) {
    const s = this.app.save.data.story;
    if (i === 0 && (!s.intro || force)) {
      s.intro = true;
      this.app.save.save();
      return INTRO;
    }
    const id = LEVELS[i].id;
    if (!s.beats[id] || force) {
      s.beats[id] = true;
      this.app.save.save();
      return BEFORE[i];
    }
    return null;
  }

  // ------------------------------------------------------------ HUD
  buildHud() {
    this.hudEl.innerHTML = `
      <button id="hud-pause" class="btn btn-round small" aria-label="Pause">${ICON.pause}</button>
      <div id="hud-size-wrap" class="sticker">
        <div id="hud-size">0 cm</div>
        <div id="hud-bar"><i></i><b class="mk m1"></b><b class="mk m2"></b><b class="mk m3"></b></div>
        <div id="hud-goal"></div>
      </div>
      <div id="hud-time" class="pill">${ICON.clock}<span>0:00</span></div>
      <div id="hud-card"><span class="ic"></span><span class="nm"></span></div>
      <div id="hud-stamp"></div>
      <div id="hud-banner"></div>
      <button id="hud-finish" class="btn btn-primary">${ICON.check}<span>Finish</span></button>
      <div id="hud-hint">Drag anywhere to roll · Double-tap to turn around</div>`;
    this.h = {
      size: $('#hud-size'),
      bar: $('#hud-bar i'),
      barWrap: $('#hud-bar'),
      goal: $('#hud-goal'),
      time: $('#hud-time span'),
      timeWrap: $('#hud-time'),
      card: $('#hud-card'),
      cardIc: $('#hud-card .ic'),
      cardNm: $('#hud-card .nm'),
      stamp: $('#hud-stamp'),
      banner: $('#hud-banner'),
      finish: $('#hud-finish'),
      hint: $('#hud-hint'),
    };
    $('#hud-pause').addEventListener('click', () => {
      this.app.audio.unlock();
      this.app.sfx.tap();
      this.app.pause();
    });
    this.h.finish.addEventListener('click', () => {
      this.app.sfx.tap();
      this.app.finish();
    });
  }

  hudStart(session) {
    document.body.classList.add('playing');
    const L = session.level;
    const timed = session.mode === 'timed';
    this.hudEl.classList.toggle('timed', timed);
    this.hudEl.classList.toggle('zen', !timed);
    this.h.finish.classList.remove('show');
    this.h.banner.classList.remove('show');
    this.h.goal.textContent = `Goal ${formatSize(L.target)}`;
    // bar spans start..3-star size (log scale)
    this.barMin = Math.log(L.start);
    this.barMax = Math.log(L.target * STAR_RATIOS[2] * 1.05);
    const pos = (d) => ((Math.log(d) - this.barMin) / (this.barMax - this.barMin)) * 100;
    $('.m1', this.h.barWrap).style.left = pos(L.target) + '%';
    $('.m2', this.h.barWrap).style.left = pos(L.target * STAR_RATIOS[1]) + '%';
    $('.m3', this.h.barWrap).style.left = pos(L.target * STAR_RATIOS[2]) + '%';
    this.h.barWrap.classList.toggle('stars', timed);
    this.hudState = { size: '', time: '', bar: -1, urgent: false };
    this.h.hint.classList.add('show');
    clearTimeout(this.hintT);
    this.hintT = setTimeout(() => this.h.hint.classList.remove('show'), 6000);
  }

  hudFrame(s) {
    const st = this.hudState;
    const txt = formatSize(s.ball.diameter);
    if (txt !== st.size) {
      st.size = txt;
      this.h.size.textContent = txt;
    }
    const p = Math.max(0, Math.min(1, (Math.log(s.ball.diameter) - this.barMin) / (this.barMax - this.barMin)));
    if (Math.abs(p - st.bar) > 0.002) {
      st.bar = p;
      this.h.bar.style.transform = `scaleX(${p.toFixed(3)})`;
    }
    if (s.mode === 'timed') {
      const t = formatTime(s.timeLeft);
      if (t !== st.time) {
        st.time = t;
        this.h.time.textContent = t;
        const urgent = s.timeLeft <= 30;
        if (urgent !== st.urgent) {
          st.urgent = urgent;
          this.h.timeWrap.classList.toggle('urgent', urgent);
        }
        if (s.timeLeft <= 10 && s.timeLeft > 0) this.app.sfx.tick(true);
      }
    }
  }

  hudPickup(type) {
    this.h.cardIc.setAttribute('style', this.iconStyle(type.id, 34));
    this.h.cardNm.textContent = type.name;
    const c = this.h.card;
    c.classList.remove('pop');
    void c.offsetWidth;
    c.classList.add('pop');
  }

  hudStamp(text, cls = '') {
    const s = this.h.stamp;
    s.textContent = text;
    s.className = cls;
    void s.offsetWidth;
    s.classList.add('go');
  }

  hudTarget(timed) {
    this.hudStamp('Goal!', 'goal');
    this.h.banner.innerHTML = timed ? `${ICON.star}<span>Goal reached! Keep rolling for more stars.</span>` : `${ICON.check}<span>Goal reached! Finish any time from pause.</span>`;
    this.h.banner.classList.add('show');
    setTimeout(() => this.h.banner.classList.remove('show'), 4200);
    if (timed) this.h.finish.classList.add('show');
  }

  hudEnd() {
    document.body.classList.remove('playing');
    this.h.finish.classList.remove('show');
  }

  // ------------------------------------------------------------ pause / settings
  showPause(session) {
    const zen = session.mode === 'zen';
    const node = el(`
      <div class="overlay pause-wrap">
        <div class="panel sticker">
          <h2 class="display">Paused</h2>
          <p class="sub">${esc(session.level.name)} · ${zen ? 'Zen' : 'Timed'} · ${formatSize(session.ball.diameter)}</p>
          <button class="btn btn-primary btn-wide" data-act="resume">${ICON.play}<span>Keep rolling</span></button>
          <button class="btn btn-wide" data-act="finish">${ICON.check}<span>${zen ? 'Finish & inspect' : 'Finish now'}</span></button>
          <button class="btn btn-wide" data-act="restart">${ICON.restart}<span>Start over</span></button>
          <div class="row">
            <button class="btn btn-round" data-act="settings" aria-label="Settings">${ICON.gear}</button>
            <button class="btn btn-round" data-act="quit" aria-label="Quit to level select">${ICON.home}</button>
          </div>
        </div>
      </div>`);
    this.setOverlay(node);
  }

  showSettings(from) {
    const st = this.app.save.data.settings;
    const q = st.quality;
    const node = el(`
      <div class="overlay settings-wrap">
        <div class="panel sticker">
          <header class="panel-head"><h2 class="display">Settings</h2><button class="btn btn-round small" data-act="close-settings" data-from="${from}" aria-label="Close">${ICON.close}</button></header>
          <label class="setting">${ICON.music}<span>Music</span><input id="set-music" type="range" min="0" max="1" step="0.05" value="${st.music}"></label>
          <label class="setting">${ICON.speaker}<span>Sounds</span><input id="set-sfx" type="range" min="0" max="1" step="0.05" value="${st.sfx}"></label>
          <label class="setting">${ICON.buzz}<span>Haptics</span><input id="set-haptics" type="checkbox" class="toggle" ${st.haptics ? 'checked' : ''}></label>
          <p class="setting-note">${this.app.hapticsNote()}</p>
          <div class="setting">${ICON.eye}<span>Graphics</span>
            <div class="seg" role="group" aria-label="Graphics quality">
              ${['auto', 'low', 'medium', 'high'].map((k) => `<button data-act="quality" data-q="${k}" class="${q === k ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}
            </div>
          </div>
          <p class="setting-note">Auto lowers detail when the frame rate drops.${this.app.autoInfo()}</p>
          <button class="btn btn-danger btn-wide" data-act="reset">${ICON.trash}<span>Reset progress</span></button>
          <p class="credits">Lint Roller. Every model, sound and song was made from code for this game: Blender scripts, Web Audio synths, Three.js.</p>
        </div>
      </div>`);
    $('#set-music', node).addEventListener('input', (e) => this.app.setSetting('music', +e.target.value));
    $('#set-sfx', node).addEventListener('input', (e) => this.app.setSetting('sfx', +e.target.value));
    $('#set-sfx', node).addEventListener('change', () => this.app.sfx.tap());
    $('#set-haptics', node).addEventListener('change', (e) => {
      this.app.setSetting('haptics', e.target.checked);
      this.app.sfx.toggle(e.target.checked);
      if (e.target.checked) this.app.haptic('tap');
    });
    this.setOverlay(node);
  }

  confirmReset(btn) {
    if (btn.dataset.armed) {
      this.app.resetProgress();
      btn.querySelector('span').textContent = 'Progress reset';
      btn.disabled = true;
      return;
    }
    btn.dataset.armed = '1';
    btn.querySelector('span').textContent = 'Tap again to erase everything';
  }

  // ------------------------------------------------------------ results
  showResults(result, rec) {
    const L = result.level;
    const timed = result.mode === 'timed';
    const title = timed ? (result.completed ? (result.reason === 'time' ? "Time's up!" : 'Tidy!') : 'So close!') : result.completed ? 'Tidy!' : 'Not quite…';
    const mood = moodFor(result);
    const verdict = verdictFor(result);
    const items = [...result.collected.entries()].filter(([, c]) => c > 0).sort((a, b) => this.app.lib.byId.get(b[0]).size - this.app.lib.byId.get(a[0]).size);
    const newSet = new Set(rec.newTypes);
    const grid = items
      .slice(0, 40)
      .map(([id, c]) => {
        const t = this.app.lib.byId.get(id);
        return `<div class="item ${newSet.has(id) ? 'new' : ''}" title="${esc(t.name)}"><span class="ic" style="${this.iconStyle(id, 46)}"></span><b>${c}</b>${newSet.has(id) ? '<i>new</i>' : ''}</div>`;
      })
      .join('');
    const canNext = result.completed && L.n < 6 && this.app.save.data.unlocked > L.n;
    const node = el(`
      <section class="screen results-screen">
        <div class="res-panel sticker">
          <h2 class="display res-title">${title}</h2>
          <div class="res-size"><span class="big">${formatSize(result.diameter)}</span><span class="goal">${result.completed ? ICON.check : ''} goal ${formatSize(L.target)}</span></div>
          ${timed ? `<div class="res-stars">${[0, 1, 2].map((k) => `<span class="rs" data-k="${k}">${k < result.stars ? ICON.star : ICON.starEmpty}</span>`).join('')}</div>` : ''}
          <div class="res-chips">
            ${rec.newBest && result.pickups > 0 ? '<span class="chip hot">New best!</span>' : ''}
            ${rec.unlockedNext ? `<span class="chip">${ICON.check}<b>Unlocked ${esc(LEVELS[L.n].name)}</b></span>` : ''}
            <span class="chip">${result.pickups} things · ${items.length} kinds</span>
            ${rec.newTypes.length ? `<span class="chip hot">${rec.newTypes.length} new in collection</span>` : ''}
          </div>
          <div class="res-items">${grid || '<p class="sub">Nothing at all. Bold.</p>'}</div>
          <div class="res-verdict"><img src="${IMG}prudence_${mood}.png" alt=""><p class="sticker">${esc(verdict)}</p></div>
          <div class="res-actions">
            ${canNext ? `<button class="btn btn-primary btn-wide" data-act="next" data-i="${L.n}">${ICON.next}<span>Next mess</span></button>` : ''}
            <div class="row">
              <button class="btn" data-act="retry">${ICON.restart}<span>Again</span></button>
              <button class="btn" data-act="postcard">${ICON.camera}<span>Postcard</span></button>
              <button class="btn btn-round" data-act="quit" aria-label="Level select">${ICON.home}</button>
            </div>
          </div>
        </div>
      </section>`);
    this.setScreen(node, 'results');
    if (timed) {
      node.querySelectorAll('.rs').forEach((s, k) => {
        if (k < result.stars) {
          s.classList.add('stamp');
          s.style.animationDelay = `${0.5 + k * 0.35}s`;
          setTimeout(() => this.app.sfx.star(k), 500 + k * 350);
        }
      });
    }
  }

  // ------------------------------------------------------------ collection
  showCollection(tab = 'things') {
    const lib = this.app.lib;
    const seen = this.app.save.data.seen;
    const found = Object.keys(seen).filter((id) => lib.byId.has(id)).length;
    let body = '';
    if (tab === 'things') {
      for (const L of LEVELS) {
        const types = lib.types.filter((t) => t.level === L.n);
        if (!types.length) continue;
        const have = types.filter((t) => seen[t.id]).length;
        body += `<h3 class="col-head"><span class="lc-num small" style="--c: var(--${L.color})">${L.n}</span>${esc(L.name)}<em>${have}/${types.length}</em></h3><div class="col-grid">`;
        body += types
          .map((t) => {
            const got = !!seen[t.id];
            return `<button class="col-item ${got ? '' : 'unknown'}" data-act="item" data-id="${t.id}"><span class="ic" style="${this.iconStyle(t.id, 58)}"></span><span class="nm">${got ? esc(t.name) : '???'}</span></button>`;
          })
          .join('');
        body += '</div>';
      }
    } else {
      const ctx = this.app.unlockContext();
      body = `<div class="skin-grid">${SKINS.map((s) => {
        const ok = isUnlocked(s, ctx);
        const on = this.app.save.data.skins.equipped === s.id;
        return `<button class="skin ${ok ? '' : 'locked'} ${on ? 'on' : ''}" data-act="${ok ? 'skin' : 'skin-locked'}" data-id="${s.id}">
            <span class="swatch sw-${s.pattern}" style="--a: var(--${s.a}); --b: var(--${s.b})"></span>
            <span class="nm">${esc(s.name)}</span><em>${ok ? (on ? 'Rolling with it' : 'Tap to wear') : esc(s.hint)}</em></button>`;
      }).join('')}</div>`;
    }
    const node = el(`
      <section class="screen collection-screen bg-dots" style="--bg: var(--teal)">
        <header class="topbar">
          <button class="btn btn-round small" data-act="back-from-collection" aria-label="Back">${ICON.back}</button>
          <h2 class="display">Collection</h2>
          <span class="chip"><b>${found}</b>/${lib.types.length}</span>
        </header>
        <div class="tabs"><button data-act="tab" data-tab="things" class="${tab === 'things' ? 'on' : ''}">Things</button><button data-act="tab" data-tab="skins" class="${tab === 'skins' ? 'on' : ''}">Ball skins</button></div>
        <div class="col-body">${body}</div>
      </section>`);
    this.setScreen(node);
  }

  showItem(id) {
    const t = this.app.lib.byId.get(id);
    const n = this.app.save.data.seen[id] || 0;
    const L = LEVELS[t.level - 1];
    const node = el(`
      <div class="overlay item-wrap" data-act="close">
        <div class="panel sticker item-card">
          <span class="ic big ${n ? '' : 'unknown'}" style="${this.iconStyle(id, 150)}"></span>
          <h3 class="display">${n ? esc(t.name) : '???'}</h3>
          <p class="desc">${n ? esc(t.desc) : 'Not rolled up yet. It is out there, being untidy.'}</p>
          <p class="sub">${n ? `Rolled up ${n} time${n === 1 ? '' : 's'} · ` : ''}${formatSize(t.size)} · first seen in ${esc(L.name)}</p>
        </div>
      </div>`);
    this.setOverlay(node);
  }

  // ------------------------------------------------------------ postcard
  showPostcard(url) {
    const node = el(`
      <div class="overlay postcard-wrap">
        <div class="postcard-box">
          <img class="postcard-img" src="${url}" alt="Postcard of your rolled-up ball">
          <p class="sub light">Press and hold the postcard to save or share it.</p>
          <button class="btn btn-primary" data-act="close">${ICON.check}<span>Done</span></button>
        </div>
      </div>`);
    this.setOverlay(node);
  }

  // ------------------------------------------------------------ ending
  async showEnding() {
    await this.dialog(ENDING);
    const node = el(`
      <section class="screen ending-screen bg-dots" style="--bg: var(--grape)">
        <h2 class="display big">The End</h2>
        <p class="sub light">The city has been tidied. Madame Prudence has filed her report.</p>
        <img class="title-lint" src="${IMG}lint_wave.png" alt="">
        <div class="credits-card sticker">
          <p><b>Lint Roller</b></p>
          <p>Design, code, art, music and sound: generated for this game with Blender scripts, Three.js and Web Audio.</p>
          <p>Thanks for rolling.</p>
        </div>
        <button class="btn btn-primary btn-big" data-act="quit">${ICON.home}<span>Back to the levels</span></button>
      </section>`);
    this.setScreen(node);
  }

  // ------------------------------------------------------------ actions
  onAction(act, d, btn) {
    const app = this.app;
    switch (act) {
      case 'play':
        app.audio.unlock();
        this.showLevels();
        break;
      case 'back-title':
        this.showTitle();
        break;
      case 'collection':
        this.showCollection('things');
        break;
      case 'back-from-collection':
        this.showTitle();
        break;
      case 'tab':
        this.showCollection(d.tab);
        break;
      case 'item':
        this.showItem(d.id);
        break;
      case 'skin':
        app.setSkin(d.id);
        this.showCollection('skins');
        break;
      case 'skin-locked':
        this.toast('Locked. Keep tidying!');
        break;
      case 'settings':
        this.showSettings(app.session && !app.session.over ? 'pause' : 'menu');
        break;
      case 'close-settings':
        if (d.from === 'pause' && app.session && app.session.paused) this.showPause(app.session);
        else this.closeOverlay();
        break;
      case 'quality':
        app.setSetting('quality', d.q);
        this.showSettings(app.session && app.session.paused ? 'pause' : 'menu');
        break;
      case 'reset':
        this.confirmReset(btn);
        break;
      case 'level':
        this.showModeSheet(+d.i);
        break;
      case 'locked':
        this.toast('Finish the level before this one to unlock it.');
        break;
      case 'close-sheet':
      case 'close':
        this.closeOverlay();
        break;
      case 'start':
        this.closeOverlay();
        app.startLevel(+d.i, d.mode);
        break;
      case 'story': {
        this.closeOverlay();
        const lines = this.storyFor(+d.i, true);
        if (lines) this.dialog(lines);
        break;
      }
      case 'resume':
        app.resume();
        break;
      case 'finish':
        app.finish();
        break;
      case 'restart':
        app.restart();
        break;
      case 'retry':
        app.restart();
        break;
      case 'quit':
        app.quitToLevels();
        break;
      case 'next':
        app.startLevel(+d.i, app.lastMode || 'timed');
        break;
      case 'postcard':
        app.makePostcard();
        break;
      default:
        break;
    }
  }
}
