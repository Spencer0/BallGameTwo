# Progress

_Last updated: during the main build session._

## Done
- **Docs**: DESIGN.md (pitch, story, rules, levels, object lists), TECH.md (scale plan), STYLE.md, DECISIONS.md, README.md.
- **Asset pipeline** (`tools/blender`): palette, part helpers, LOD-by-rebuild, EEVEE toon + Freestyle thumbnails,
  GLB export, budgets; `tools/pack.mjs` (meshopt packs + WASM-free fallback packs, merged catalog);
  `tools/sheet.py` (contact sheet, icon atlas, ASSETS.md).
- **Assets**: L1 (67), L2 (50), L3 (39) done and reviewed; L4–L6 in progress. Characters: Lint rig, Prudence
  portraits (3 moods), full-body + in-world Prudence.
- **Engine**: instanced world + grid culling + LOD + blob shadows; crust (merged stuck objects, burial,
  knock-off); ball physics (climb low things from any angle, bumps); follow camera (auto-yaw, quick turn,
  wall collision, scaling fog/view distance); particles; Lint rig; set dressing; inward-facing room walls.
- **Levels**: layouts for all six (L1–L3 playable and balanced; L4–L6 waiting on their asset packs).
- **UI**: title over a live attract-mode scene, level select, mode sheet, story dialogue, HUD (size bar with
  star ticks, timer, pickup cards with NEW badges, milestone stamps, title card, time warnings), pause,
  settings, results (stars, items, verdict), collection + skins, postcard, ending, rotate prompt,
  perf overlay (triple-tap size readout).
- **Audio**: synth engine, 7 original songs, material-aware pickup SFX in key, fanfares, UI, Prudence babble.
- **Tests**: unit (23), audio render check, balance tool, screen tour (3 viewports), playthrough bot,
  persistence across reload, long-session profiler.

## Polish pass 1 (wow / jank review)
Wow:
- Attract-mode menus: the title and level select float over a live demo of Lint rolling up the table.
- Level-intro camera swoop from high above while the title card plays.
- Madame Prudence cameos in every level, scaled absurdly to match (life-size in the garden, a 65 m giant at the
  end of the street, a 240 m colossus on the town horizon, a 900 m inspector beyond the city).
- Lumpy rolling (big stuck things lift the ball as they pass under it), dust trail at speed, "Time's up!" stamp.
- Prudence babbles her results verdict; Lint squeaks on milestones.
Jank fixed:
- Ball jittering on low edges (diagonal contacts) → low obstacles are steps, climbable from any angle.
- Ball wandering on furniture tops (climb limit 2.3 r → 1.6 r).
- Camera trapped behind dollhouse walls → low walls don't block the camera; room walls are see-through planes.
- Buildings between camera and ball / Lint → hidden (two sight lines).
- Camera inside an object → its outline hull flooded the screen with ink → instances containing the camera are culled.
- Inward-facing faces from some helpers → normals recalculated in the asset pipeline.
- Release single-page build was corrupted by `$'` sequences in the minified JS → function replacements.
- Pickup-card strobing during tiny-item bursts → rate-limited, NEW/big pickups always shown.

## Next
- Integrate L4–L6 packs, balance, playthrough all levels both modes.
- Regenerate icon atlas + ASSETS.md with all assets.
- 30-minute soak profile; performance pass on the city.
- Two polish passes; publish artifact.

## Known issues
- Performance numbers come from desktop Chromium + SwiftShader, not a physical iPhone.
