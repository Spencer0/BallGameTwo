# Lint Roller

A portrait, one-thumb roll-and-grow game for the phone browser. You are **Lint**, a very small
dust bunny with a very sticky ball. **Madame Prudence Plume**, a flamingo inspector with a monocle,
wants things tidy: first the breakfast table, then the bedroom, the house, the street, the town…
and, eventually, the whole city.

Everything is original and made from code: 240+ objects modelled by Blender Python scripts,
seven pieces of music and all sound effects synthesised with Web Audio, rendered with Three.js.

**Play it:** https://claude.ai/artifact/WY8bjgJp4aa1vB6BNitPUB. Open it on your iPhone and hold the phone
upright. Tap once to start the sound.

## How to play

- **Roll**: touch anywhere and drag. A joystick appears under your thumb; push up to roll forward.
- **Turn around**: double-tap.
- **Grow**: anything smaller than about half your ball sticks to it. The ball grows, so bigger things
  start sticking too. Small walls and furniture can be climbed by pushing into them.
- **Careful**: slamming into something too big knocks your most recent pickups loose.
- **Almost**: things that wobble when you bump them are nearly small enough. Grow a little more.

### Modes
- **Zen**: no timer. Roll as long as you like and finish from the pause menu. Reaching the goal size
  passes the level.
- **Timed**: reach the goal size before time runs out (4 to 8 minutes per level, about 35 in all).
  ★ for the goal; ★★ and ★★★ for going bigger. The tick marks on the size bar show where they are. After
  the goal you can keep rolling or tap **Finish**.

Passing a level in either mode unlocks the next. There are six: Crumb Patrol (breakfast table),
Bedroom Bedlam, House Party, Cul-de-Sac, Small Town and The Big Tidy (the city).

The three outdoor levels are modelled on real kinds of place and they are alive: a 1990s subdivision
(Maple Loop: a collector loop, cul-de-sacs, a signalised entrance, a shopping strip), a Midwestern
river town (Puddleford: courthouse square, Main Street, rail crossing, lake, farms) and Manhattan
(the grid, Broadway's plazas, Central Park, downtown, a rowhouse borough, Jersey City and the harbour).
Cars keep to their lanes and stop at lights and for people, pedestrians cross at the zebras, trains,
ferries, planes and ducks go about their business, and all of it can be rolled up.

### Extras
- **Collection**: every kind of thing you have ever rolled up, with a one-line description.
- **Ball skins**: ten patterns unlocked by stars, levels and discoveries (Collection → Ball skins).
- **Postcard**: on the results screen, make a postcard of your ball. Press and hold it to save or share.
- **Settings**: music and sound volume, haptics (Android; iPhone on iOS 18+), graphics quality
  (Auto / Low / Medium / High).

Progress, the collection and settings are saved in your browser (localStorage).

## Known limitations
- No offline / Add to Home Screen mode: the hosting page does not allow service workers.
- The postcard can't be downloaded directly (the host blocks downloads); press and hold the image instead.
- iPhone haptics need iOS 18 or newer; older iPhones have no web haptics.
- Fonts load from Google Fonts; without a connection the game falls back to system fonts.
- The hosted page can't serve binary model files, so the asset packs travel as base64 text (about a third
  bigger to download: roughly 0.7 MB per level with WebAssembly, 1.6 MB without).
- Performance was measured in desktop Chromium with software WebGL and iPhone-sized viewports, not on a
  physical iPhone. The automatic quality fallback is there to catch slower devices.

## Development

```bash
npm install
# assets (needs Blender 4.5 + Xvfb): build packs, thumbnails, catalog, contact sheet
xvfb-run -a blender -b -P tools/blender/build.py && xvfb-run -a blender -b -P tools/blender/chars.py
node tools/pack.mjs && python3 tools/sheet.py
# game
node tools/build.mjs            # dist/index.html (local) + dist/artifact.html (single page)
npx http-server dist            # open http://localhost:8080 (add ?level=3&mode=zen to jump in)
# tests
npm test                        # rules, growth, stars, save/load, songs
node tools/balance.mjs          # every level reachable at a "typical player" pace, 3★ possible
node tests/screens.mjs          # screenshots of every screen at iPhone sizes
node tests/playthrough.mjs      # autopilot plays all 6 levels in both modes
node tests/calibrate.mjs 3      # timed run to the buzzer: when the goal falls, final stars
node tests/ending.mjs           # clear the city, watch the finale, check it's saved
node tests/artifact_page.mjs    # the single-page build as the host serves it (after a DIST=build/release build)
node tests/profile.mjs 30 1,3,6 # 30-minute soak: heap, GPU resources, frame time
node tests/audio.mjs            # offline-render all music + SFX, check levels/clipping
```

Docs: [DESIGN.md](DESIGN.md) · [TECH.md](TECH.md) · [STYLE.md](STYLE.md) · [DECISIONS.md](DECISIONS.md) ·
[ASSETS.md](ASSETS.md) · [PROGRESS.md](PROGRESS.md)
