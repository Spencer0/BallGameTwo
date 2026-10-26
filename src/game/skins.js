// Unlockable ball-core skins (DESIGN.md §8). Each unlock is checked against the save.
export const SKINS = [
  { id: 'lavender', name: 'Lint Lavender', a: 'lavender', b: 'grape', pattern: 'fluff', unlock: null, hint: 'Free. Fluffy.' },
  { id: 'polka', name: 'Bubblegum Polka', a: 'bubblegum', b: 'snow', pattern: 'dots', unlock: { stars: 3 }, hint: 'Earn 3 stars' },
  { id: 'sunny', name: 'Sunny Stripes', a: 'sun', b: 'tangerine', pattern: 'stripes', unlock: { level: 2 }, hint: 'Finish Bedroom Bedlam' },
  { id: 'mintchip', name: 'Mint Chip', a: 'mint', b: 'cocoa', pattern: 'chips', unlock: { types: 40 }, hint: 'Discover 40 things' },
  { id: 'gingham', name: 'Picnic Gingham', a: 'tomato', b: 'paper', pattern: 'checks', unlock: { stars: 6 }, hint: 'Earn 6 stars' },
  { id: 'night', name: 'Night Sky', a: 'navy', b: 'sun', pattern: 'stars', unlock: { level: 4 }, hint: 'Finish Cul-de-Sac' },
  { id: 'melon', name: 'Watermelon', a: 'leaf', b: 'lime', pattern: 'stripes', unlock: { types: 90 }, hint: 'Discover 90 things' },
  { id: 'disco', name: 'Disco Ball', a: 'cloud', b: 'sky', pattern: 'checks', unlock: { stars: 12 }, hint: 'Earn 12 stars' },
  { id: 'rainbow', name: 'Rainbow Roll', a: 'tomato', b: 'cobalt', pattern: 'rainbow', unlock: { level: 6 }, hint: 'Tidy the whole city' },
  { id: 'gold', name: 'Golden Inspector', a: 'sun', b: 'butter', pattern: 'shine', unlock: { stars: 18 }, hint: 'Earn all 18 stars' },
];

export const PATTERNS = { fluff: 0, dots: 1, stripes: 2, chips: 3, checks: 4, stars: 5, rainbow: 6, shine: 7 };

/** levelsDone: highest completed level number (1-based) */
export function isUnlocked(skin, { stars, levelsDone, types }) {
  const u = skin.unlock;
  if (!u) return true;
  if (u.stars !== undefined) return stars >= u.stars;
  if (u.level !== undefined) return levelsDone >= u.level;
  if (u.types !== undefined) return types >= u.types;
  return false;
}
