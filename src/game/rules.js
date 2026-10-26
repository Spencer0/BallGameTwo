// Pure game rules (no DOM, no three.js) so they can be unit-tested with node:test.

/** A thing sticks when its pickup size is at most PICK_RATIO x ball diameter. */
export const PICK_RATIO = 0.5;
/** Objects up to this multiple of the threshold wobble ("almost!") when bumped. */
export const WOBBLE_RATIO = 1.35;
/** Effective volume gained = GROWTH x object effective volume + a size-linear bonus so that
 *  small pickups still visibly count (each adds ~LIN_GROWTH x size/diameter to the diameter). */
export const GROWTH = 1.6;
export const LIN_GROWTH = 0.03;
/** Below this fraction of the ball radius an object is auto-collected in bulk (tiny cutoff). */
export const TINY_CUTOFF = 0.025;
/** Star thresholds as multiples of the target diameter. */
export const STAR_RATIOS = [1, 1.4, 1.9];

export function pickupThreshold(diameter) {
  return PICK_RATIO * diameter;
}

export function canPickUp(objSize, diameter) {
  return objSize <= PICK_RATIO * diameter;
}

export function isAlmost(objSize, diameter) {
  const t = PICK_RATIO * diameter;
  return objSize > t && objSize <= t * WOBBLE_RATIO;
}

export function isTiny(objSize, radius) {
  return objSize < TINY_CUTOFF * radius;
}

export function sphereVolume(r) {
  return (4 / 3) * Math.PI * r * r * r;
}

export function radiusFromVolume(v) {
  return Math.cbrt((3 * v) / (4 * Math.PI));
}

/** Ball volume gained by absorbing an object (effective volume objVol, pickup size objSize). */
export function gainVolume(radius, objVol, objSize, mult = 1) {
  const D = 2 * radius;
  return mult * (GROWTH * objVol + (Math.PI / 2) * LIN_GROWTH * objSize * D * D);
}

/** New radius after absorbing an object. */
export function grow(radius, objVol, objSize = 0, mult = 1) {
  return radiusFromVolume(sphereVolume(radius) + gainVolume(radius, objVol, objSize, mult));
}

/** New radius after losing `gained` volume (an item knocked loose). Never below minR. */
export function shrink(radius, gained, minR) {
  const v = sphereVolume(radius) - gained;
  return Math.max(minR, v > 0 ? radiusFromVolume(v) : minR);
}

export function starsFor(diameter, target, ratios = STAR_RATIOS) {
  let s = 0;
  for (const r of ratios) if (diameter >= target * r - 1e-9) s++;
  return s;
}

/** A level is completed (unlocks the next) when the target size was reached, in either mode. */
export function isCompleted(diameter, target) {
  return diameter >= target - 1e-9;
}

/** "Nice" milestone sizes (metres, diameter): 1-2-5 series. */
export function milestoneAfter(d) {
  let m = 0.01;
  const steps = [1, 2, 5];
  for (let e = -2; e < 5; e++) {
    for (const s of steps) {
      m = s * Math.pow(10, e);
      if (m > d * (1 + 1e-9)) return m;
    }
  }
  return m * 2;
}

/** Format a diameter in metres like "12.4 cm", "1.35 m", "8 mm". */
export function formatSize(d) {
  if (d < 0.01) return `${(d * 1000).toFixed(1)} mm`;
  if (d < 1) return `${(d * 100).toFixed(d < 0.1 ? 1 : 0)} cm`;
  if (d < 10) return `${d.toFixed(2)} m`;
  if (d < 100) return `${d.toFixed(1)} m`;
  return `${Math.round(d)} m`;
}

export function formatTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
