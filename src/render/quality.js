// Graphics quality tiers + automatic fallback (TECH.md §7).
export const TIERS = {
  low: { name: 'low', dpr: 1.0, outlines: false, lodPx: 60, cullPx: 3.0, particles: 0.4, view: 0.6, shadows: false },
  medium: { name: 'medium', dpr: 1.5, outlines: true, lodPx: 36, cullPx: 2.0, particles: 0.7, view: 0.8, shadows: true },
  high: { name: 'high', dpr: 2.0, outlines: true, lodPx: 22, cullPx: 1.3, particles: 1.0, view: 1.0, shadows: true },
};
export const ORDER = ['low', 'medium', 'high'];

/**
 * Watches frame times. When the average over a window is too slow it first lowers the pixel
 * ratio in small steps, then drops a tier. When there is lots of headroom it climbs back, never
 * above the player's chosen ceiling.
 */
export class AutoQuality {
  constructor(apply) {
    this.apply = apply; // (tierName, dprScale) => void
    this.enabled = true;
    this.ceiling = 'high';
    this.tier = 'high';
    this.dprScale = 1;
    this.sum = 0;
    this.n = 0;
    this.window = 0;
    this.goodTime = 0;
    this.cooldown = 3; // ignore the first seconds (shader compiles, loading)
    this.history = [];
  }

  reset(tier) {
    this.tier = tier;
    this.dprScale = 1;
    this.cooldown = 3;
    this.sum = this.n = this.window = this.goodTime = 0;
  }

  frame(dt) {
    if (!this.enabled) return;
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      return;
    }
    this.sum += dt;
    this.n++;
    this.window += dt;
    if (this.window < 2) return;
    const avg = (this.sum / this.n) * 1000;
    this.sum = this.n = this.window = 0;
    this.history.push(Math.round(avg * 10) / 10);
    if (this.history.length > 30) this.history.shift();
    if (avg > 22) {
      this.goodTime = 0;
      if (this.dprScale > 0.76) {
        this.dprScale -= 0.125;
      } else {
        const k = ORDER.indexOf(this.tier);
        if (k > 0) {
          this.tier = ORDER[k - 1];
          this.dprScale = 1;
        }
      }
      this.apply(this.tier, this.dprScale);
      this.cooldown = 1.5;
    } else if (avg < 13) {
      this.goodTime += 2;
      if (this.goodTime >= 12) {
        this.goodTime = 0;
        if (this.dprScale < 1) this.dprScale = Math.min(1, this.dprScale + 0.125);
        else {
          const k = ORDER.indexOf(this.tier);
          if (k < ORDER.indexOf(this.ceiling)) this.tier = ORDER[k + 1];
        }
        this.apply(this.tier, this.dprScale);
        this.cooldown = 2;
      }
    } else this.goodTime = 0;
  }
}
