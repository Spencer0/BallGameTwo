# Decisions log

Calls made along the way that the brief left open. Newest at the bottom of each section.

## Identity & story
- **Name: Lint Roller.** A pun on the sticky lint roller (literally a thing that picks stuff up). Hero **Lint**
  is a dust bunny (a fluff ball with actual bunny ears); patron **Madame Prudence Plume** is a tidy-obsessed
  flamingo inspector with a monocle and clipboard. The absurd reason for rolling: tidying, with the scope of
  "what needs tidying" escalating from a breakfast table to the whole city.
- The pusher character scales slowly with the ball (`size ∝ start · (D/start)^0.35`) so Lint stays readable
  but the ball clearly outgrows Lint.
- Prudence speaks via kazoo babble (one syllable per word) rather than voice acting.

## Rules & feel
- Pickup size = `0.5·max + 0.5·mid` dimension, collectible at `≤ 0.5 × ball diameter`. Thin long things
  (pencils, spoons) and flat things (plates) behave intuitively.
- Growth = volume (×1.6 for "air gaps") **plus a size-linear bonus** (`LIN_GROWTH = 0.03`). Pure volume made
  small pickups feel worthless (39 crumbs → +0.6 cm); the linear term makes every pickup visibly count while
  big pickups still dominate.
- Knock-off: impacts above 0.6× top speed shed `1 + (impact−0.6)·5` most-recent items. Exact volume bookkeeping
  (each crust item stores the volume it added).
- Climbing: pushing into an obstacle whose top is within **2.0 radii** of the ball's bottom climbs it, from any
  contact angle (Katamari-style). 2.3 r let a 1 m ball mount sofas and wander on furniture tops; 1.6 r made the
  breakfast table too fiddly. Low obstacles never bounce or knock items loose — they're steps, not walls.
  The climb assist stays on until the contact normal is nearly vertical (ny ≥ 0.92): with a narrower band a
  ball could hang on the top edge of a thin wall, neither climbing nor standing on it (the final playthrough
  caught a 3 m ball trapped in the kitchen this way).
- Dollhouse walls in the House level are 1.5 m: rooms stay meaningful until the ball is ~1.5 m, then the whole
  house opens. With walls passable, the House needed the same pace/growth tuning as the outdoor levels.
- Camera: auto-follow toward direction of travel (not while deliberately reversing) + **double-tap quick turn**.
  No separate camera control was needed in testing; keyboard Q/E exists for desktop.
- Zen mode: "Finish & inspect" in the pause menu ends the level; reaching the target counts as completed.
- Timed mode stars at 1×, 1.4×, 1.9× target; music tempo +7% in the last 30 s.

- **Outdoor balance.** The first outdoor layouts were exhausted within a minute: once the ball is large it
  sweeps area ∝ diameter × speed, and the streets were packed with things it could already eat (in the city,
  96 % of objects were collectible at the start). Fixes, measured with the calibration bot: smaller start sizes
  (town 18 → 10 m, city 75 → 30 m) so buildings gate progress; 3–4× larger maps (480 m, 1.5 km, 4.4 km) built
  from street networks; per-level pace (0.85/0.8/0.65) and growth (0.6/0.5/0.35); and star ladders set near the
  full-sweep size, because the post-goal snowball is the fun part.
- Timers: L1 4:00, L2 6:00, L3 8:00, L4 8:00, L5 9:00, L6 10:00 (≈ 45 min), each roughly 2× the bot's time to goal.

## Rendering
- Three.js r170, custom ShaderMaterials. Colours are a **palette index per vertex** (COLOR_0.r = index/255)
  looked up in a uniform array: exact flat colours, tiny vertex data, colour variants via one per-instance
  float, global palette tweaks without re-exporting.
- LOD1 is **rebuilt from the same Python function at lower segment counts** instead of decimation, which would
  smear palette indices across part boundaries.
- Outlines are inverted hulls with welded smooth normals computed at load; width is capped by projected size so
  tiny/far things don't become ink blobs.
- Instances whose bounds contain the camera are culled (you see through them) — otherwise an outline hull
  around the camera floods the screen with ink.
- Sky is a gradient canvas texture as the scene background (cheap; no extra geometry).
- Room walls (bedroom) are inward-facing planes: from outside they are back-face culled, so the camera can
  swing behind a wall and see through it instead of being shoved into the ball.
- Outdoor fog and view distance scale with the ball (`far = k × camera radius`): the world literally opens up
  as you grow, and culling distance follows.
- All asset winding is normalised in `finalize()` (recalc outward normals per part). Some helpers (torus,
  lathe pole caps) produced inward faces that Blender's double-sided thumbnails hid but the game's back-face
  culling would expose.
- Results/postcard: Lint stands beside the ball facing the camera instead of pushing it from behind (which hid
  the ball).

## Pipeline
- Blender 4.5 LTS was not preinstalled; installed from the official tarball. EEVEE/Workbench need a GL
  context: renders run under **Xvfb** (`xvfb-run`). Thumbnails use EEVEE + Shader-to-RGB toon + Freestyle.
- meshopt + quantization via gltf-transform (8-bit colour quantization keeps palette indices exact).
- Asset authoring was parallelised across agents per level, each owning one module file; the library
  (`tools/blender/lib`) is shared and read-only to them.

## Audio
- All music is sequenced live from chord charts + groove templates + written melodies (`src/audio/songs.js`)
  with a look-ahead scheduler; instruments are synthesised (FM e-piano, clav, brass, whistle, kazoo, drums).
- Pickup sounds are quantised to the current song's key; combos climb a pentatonic scale.

## Testing
- The autopilot (test bot) targets the best nearby pickup (size/distance), bans targets it got stuck on,
  respects climbability and has line of sight against walls. It's deliberately simple; its completion times
  set the timer budgets (each timer ≈ 1.6–2.4× the bot's time to goal).

## Platform / extras
- **Hosting is a claude.ai artifact**, which forbids service workers and page-initiated downloads. So:
  no offline/Add-to-Home-Screen PWA; the **postcard** is shown as an image to press-and-hold (save/share via
  the iOS context menu) instead of a download button.
- Fonts: Shrikhand + Baloo 2 from Google Fonts (the only external resource), with system fallbacks.
- Haptics: `navigator.vibrate` where available; on iOS 18+ a hidden switch control is toggled (Safari plays
  a system haptic for switches). Older iOS has no web haptics.
- Extras chosen for effort/impact: collection log, 10 unlockable ball skins, postcard, attract-mode menus
  (the title floats over a live demo of Lint rolling up the table). Skipped: PWA (blocked by the host).
- Asset packs ship twice: meshopt-compressed (needs WebAssembly) and quantized-only. The game probes
  WebAssembly at boot and falls back, in case the host's content policy forbids WASM compilation.
- Sound follows the iPhone's silent switch (default Web Audio session); no `audioSession` override.
- A performance overlay is hidden behind a triple-tap on the size readout, so frame rate can be checked on a
  real phone.
- The finale isn't forced on the player: the first City clear adds a "See the finale" button to the results
  screen (instead of the story popping over the results after a delay).
