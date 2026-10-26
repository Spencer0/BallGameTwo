# Lint Roller — Technical Plan

Target: Safari on iPhone (portrait), WebGL2, 60 fps where possible, 30 fps floor with an
automatic quality fallback. One self-contained web app (one HTML with inlined JS + a few
fetched binary asset packs).

## 1. Stack

- **Three.js r170** (bundled from npm with esbuild and inlined into `index.html`). Custom
  toon/outline shaders; no physics engine (ball physics are bespoke and cheap, see §5).
- **Blender 4.5 LTS headless** asset pipeline (`tools/blender/`): every mesh is built by Python,
  exported as GLB, compressed with meshopt (`EXT_meshopt_compression` + `KHR_mesh_quantization`)
  by `tools/pack.mjs` (gltf-transform). Thumbnails rendered by Blender (EEVEE + Freestyle) under Xvfb.
- **Web Audio**: all music and SFX synthesised at runtime (no audio files).
- **UI**: DOM/CSS overlay above the canvas (crisp text, cheap), canvas only for the postcard.

## 2. Asset format

- One GLB **pack per level** (`assets/packs/L1.glb` …) containing every object type first used
  in that level as named nodes `<id>` (LOD0) and `<id>__lod1` (LOD1), plus the level's static
  set (`set__*`). Later levels reuse earlier packs (city loads all packs' LOD1 + its own).
- Geometry: positions, normals, `COLOR_0` vertex colours (palette from STYLE.md),
  `_TINT` attribute (0/1 per vertex: whether a colour variant tint applies). No textures.
- `assets/catalog.json` (generated from the Python registry): id, name, description, level,
  dims, pickup size, effective volume, material (for sound), collider (box / cylinder / sphere,
  local offsets), tint variants, flags (creature, floats, flees), poly counts.
- Poly budgets (triangles, LOD0 / LOD1): tiny 260 / 64; small 720 / 180; medium 1400 / 400;
  large 2600 / 720; landmark 4200 / 1100. Reported by the build script (`[budget] OVER BUDGET`)
  and fixed before an asset ships.
- Icons: `assets/icons.png` atlas (96 px cells) rendered from the same Blender scenes, used in the
  collection log and pickup cards.

## 3. Rendering

- **Toon shading**: 2-band (lit / shadow) Lambert step with a soft edge, shadow colour = base ×
  cool purple tint (STYLE.md), plus a constant ambient lift and distance fog to the sky colour.
- **Outlines**: inverted hull. Smoothed outline normals are computed at load (positions
  welded) so hard-edged meshes don't crack. Width is constant in screen pixels, scaled down with
  distance and dropped for LOD1. Outline colour = dark ink, slightly tinted by the base colour.
- **Instancing**: every object type has one `InstancedMesh` per LOD (+ outline twin sharing the
  same instance buffer). Colour variants use `instanceColor` applied only where `_TINT = 1`.
- **Blob shadows**: one instanced flat disc mesh draws a soft ink-coloured ellipse under every
  visible object and under the ball (quality ≥ Medium).
- **Ball**: a core sphere (skin shader) + the **crust** (see §4) + a pool of ≤ 10 "flying" meshes
  for the pickup animation, + Lint (the pusher, a skinned-free procedural rig: body, ears, feet).

## 4. The ball "crust" — merging attached objects

Attached objects are *baked into a single dynamic mesh in ball-local space* the moment their
pickup animation finishes:

- Preallocated typed arrays (positions, normals, outline normals, palette indices, outline-width sizes;
  Uint32 index) sized for 90k vertices / 2048 items, shared by every level (allocated once). Appending an object writes its (LOD-chosen)
  vertices transformed into ball space and uploads only the changed range (`addUpdateRange`).
- Items are kept in append order. **Knock-off** removes the most recent items → just shrink
  the draw range. Removed items become world objects again.
- **Burial**: as the ball grows, items whose outer extent sinks under the core surface
  (`|p| + extent < coreRadius`) or whose size falls below 3 % of the ball radius are dropped.
  Their indices are degenerated in place; when > 30 % of the buffer is dead, the crust is
  compacted (one full rebuild, amortised, never more than once every few seconds).
- Result: the whole stuck pile is **2 draw calls** (fill + outline) regardless of how many
  hundreds of items stuck, and memory is bounded by `CRUST_MAX_VERTS`.

## 5. Physics & collision (custom, allocation-free)

- Ball: position, velocity, radius. Input → acceleration in camera space. Top speed, acceleration and
  gravity scale linearly with radius (`v_max = 4.4 r/s`), so the feel is identical at every scale.
- Ground: level ground height `h(x,z)` (flat or terraced) + **support surfaces**: tops of
  uncollectible box colliders (tables, beds, cars, roofs) under the ball.
- **Climbing**: pushing into anything whose top is ≤ `1.6·r` above the ball's bottom makes the
  ball climb (Katamari-like wall climb), then roll onto the top. Such low obstacles never bounce the ball.
- Object colliders: yaw-rotated box, vertical cylinder, or sphere (from the catalog). Sphere-vs-shape
  tests in object local space, no allocations (scratch vectors are module-level).
- **Broadphase**: uniform grid (`cellSize` per level). Each cell stores instance indices and the max
  half-extent in the cell; queries expand by that. Objects that move (creatures, knocked items)
  are re-bucketed when they cross cells.

## 6. The scale problem (tabletop → city)

| Problem | Solution |
|---|---|
| Thousands of objects in the city | Per-type `InstancedMesh` (LOD0, LOD1, outline twin sharing the LOD0 instance buffer); draw calls are bounded by *types visible*, not objects. Blob shadows for all near objects are one more instanced draw. |
| Overdraw / far stuff | **Cell culling**: the grid is tested against the camera frustum and the (ball-scaled) view distance; only visible cells contribute. Instance buffers are refilled from visible cells every frame by copying cached 16-float matrices (≈0.2 ms for thousands of instances) — no per-frame allocation. Objects whose bounds contain the camera are skipped (see-through). |
| Detail at distance | **LOD**: per instance, projected size `size / distance` picks LOD0, LOD1, or *culled* (below ~2 px). Outlines only on LOD0. Big landmarks have a min-LOD1 distance, so skylines stay. |
| Tiny objects in huge levels | **Tiny-object cutoff**: when `size < 2.5 %` of the ball radius, an object is no longer simulated as a collider; rolling over its cell auto-collects it in bulk (counted for the log and growth, a puff of particles, no individual animation or crust entry). Its draw distance shrinks to near zero. |
| Stuck items explode in count | Crust merge + burial (§4). |
| Float precision | Each level is its own world in metres; the largest is 2.6 km, so float32 positions are fine (≤ 0.25 mm error at 2.6 km). **Depth precision** is the real risk: near/far planes are scaled with the smoothed camera radius (`near = 0.06·R`, `far = 900·R`, a constant 15 000:1 ratio at every scale), and outdoor fog ends well before `far`. A floating origin is not needed; documented if larger worlds are ever added. |
| Camera range | Camera distance and height are functions of ball radius with spring smoothing; FOV fixed, so the screen-space size of the ball stays roughly constant. |
| Physics step at scale | Fixed timestep (1/60) in *radius-normalised* units (speeds and gravity scale with r), max 4 substeps; tunnelling is prevented because per-step travel is < 0.2·r. |
| Memory | All per-level GPU resources are disposed on level exit; asset packs are streamed per level (each level lists the packs it needs; unlocked levels are prefetched in the background from the menus); crust buffers are reused across levels. No `new` in the frame loop (scratch vectors/matrices, pooled particles and fly-in meshes). Verified by `tests/profile.mjs` (flat heap and GPU resource counts across level switches). |

## 7. Performance strategy

- Quality tiers (Low / Medium / High) control: device pixel ratio cap (1.0 / 1.5 / 2.0), world outlines
  (off / on / on — the ball and Lint always keep theirs), LOD switch distance (projected size 60 / 36 / 22 px),
  small-object cull size (3 / 2 / 1.3 px), blob shadows (off / on / on) and particle budget (40 / 70 / 100 %).
- **Auto quality** (default): starts at Medium; rolling 2 s windows of frame time; > 22 ms average → first
  lower the pixel ratio in 12.5 % steps (to 75 %), then drop a tier; < 13 ms sustained for 12 s → step back
  up, never above High. The settings screen shows the tier currently in use.
- iOS hygiene: no per-frame allocations, `powerPreference: 'high-performance'`, antialias off at
  DPR ≥ 2, `webglcontextlost` handled (pause + rebuild on restore), audio context resumed on
  visibility change, and the loop stops in the background.

## 8. Testing

- `npm test` — node:test unit tests for `rules.js` (thresholds, growth, stars, completion),
  `save.js` (round-trip, corruption tolerance, migration), level balance.
- `npm run e2e` — Playwright at iPhone portrait viewports (390×844, 375×667, 430×932) with touch
  emulation: screenshots every screen, checks console errors, plays all 6 levels with the
  autopilot in both modes, profiles a long session (frame time, JS heap, renderer.info).
