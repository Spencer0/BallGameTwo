// Shot list for the promo, cut to the voiceover. Each shot is about a fifth of the way into its level
// (the autopilot plays that much first, fast-forwarded). mode: follow (the game camera), low (a low
// tracking shot beside the ball), orbit (circling it), chase (high behind it); cam: a fixed camera move.
export const SHOTS = [
  { name: '01_desk_low', level: 1, hud: false, mode: 'low', side: 1, dur: 2.4 },
  { name: '02_desk_orbit', level: 1, hud: false, mode: 'orbit', a0: 2.2, spin: 0.7, preroll: 70, dur: 1.9 },
  { name: '03_bedroom_title', level: 2, hud: true, mode: 'follow', dur: 2.5 },
  { name: '04_house_orbit', level: 3, hud: false, mode: 'orbit', a0: 0.4, spin: 0.6, dur: 2.6 },
  { name: '05_suburb_low', level: 4, hud: false, mode: 'low', side: -1, dur: 2.5 },
  { name: '06_town_chase', level: 5, hud: true, mode: 'chase', dur: 2.6 },
  { name: '07_city_low', level: 6, hud: false, mode: 'low', side: 1, dur: 2.7 },
  {
    name: '08_city_pullback',
    level: 6,
    hud: false,
    at: { x: 0, z: 300, d: 120, yaw: Math.PI },
    preroll: 4,
    dur: 5.0,
    cam: { from: { pos: [0, 70, 400], look: [0, 20, 290] }, to: { pos: [1000, 1200, 1700], look: [0, 0, -500] }, fov: 55 },
  },
];
export const MUSIC = { song: 'title', seconds: 21 };
