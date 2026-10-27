// Shot list for the promo, cut to the voiceover (cut points at the pauses between lines).
// at: put the ball here at this diameter first; preroll: seconds of game time fast-forwarded with the
// autopilot before recording (so the ball carries a crust); cam: a fixed camera move instead of the follow cam.
export const SHOTS = [
  { name: '01_hook_city', level: 6, hud: true, at: { x: 300, z: 300, d: 70, yaw: Math.PI }, preroll: 4, dur: 4.1 },
  { name: '02_title_desk', level: 1, hud: false, preroll: 0, dur: 2.5 },
  { name: '03_desk_roll', level: 1, hud: true, preroll: 25, dur: 2.9 },
  { name: '04_desk_grow', level: 1, hud: false, preroll: 70, dur: 3.6 },
  { name: '05_house', level: 2, hud: true, preroll: 60, dur: 2.1 },
  { name: '06_park', level: 3, hud: false, preroll: 60, dur: 1.6 },
  { name: '07_suburb', level: 4, hud: true, at: { x: -60, z: 106, d: 10, yaw: -Math.PI * 0.6 }, preroll: 12, dur: 3.1 },
  { name: '08_town', level: 5, hud: false, at: { x: -154, z: 160, d: 30, yaw: Math.PI }, preroll: 6, dur: 2.8 },
  { name: '09_city_street', level: 6, hud: true, at: { x: 0, z: -60, d: 45, yaw: Math.PI }, preroll: 4, dur: 2.4 },
  {
    name: '10_city_pullback',
    level: 6,
    hud: false,
    at: { x: 0, z: 300, d: 120, yaw: Math.PI },
    preroll: 4,
    dur: 8.6,
    cam: { from: { pos: [0, 70, 400], look: [0, 20, 290] }, to: { pos: [1000, 1200, 1700], look: [0, 0, -500] }, fov: 55 },
  },
];
