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
- Climbing: pushing into an obstacle whose top is within 2.3 radii climbs it (Katamari-style). This is how
  small balls reach table tops and beds.
- Camera: auto-follow toward direction of travel (not while deliberately reversing) + **double-tap quick turn**.
  No separate camera control was needed in testing; keyboard Q/E exists for desktop.
- Zen mode: "Finish & inspect" in the pause menu ends the level; reaching the target counts as completed.
- Timed mode stars at 1×, 1.4×, 1.9× target; music tempo +7% in the last 30 s.

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

## Platform / extras
- **Hosting is a claude.ai artifact**, which forbids service workers and page-initiated downloads. So:
  no offline/Add-to-Home-Screen PWA; the **postcard** is shown as an image to press-and-hold (save/share via
  the iOS context menu) instead of a download button.
- Fonts: Shrikhand + Baloo 2 from Google Fonts (the only external resource), with system fallbacks.
- Haptics: `navigator.vibrate` where available; on iOS 18+ a hidden switch control is toggled (Safari plays
  a system haptic for switches). Older iOS has no web haptics.
- Extras chosen for effort/impact: collection log, 10 unlockable ball skins, postcard. Skipped: PWA (blocked
  by the host).
