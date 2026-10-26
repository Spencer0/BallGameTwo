# Progress

_Last updated: end of the main build session._

## Done
- **Docs**: DESIGN.md (pitch, story, rules, levels, object lists), TECH.md (scale plan), STYLE.md, DECISIONS.md, README.md.
- **Asset pipeline** (`tools/blender`): palette, part helpers, LOD-by-rebuild, EEVEE toon + Freestyle thumbnails,
  GLB export, budgets; `tools/pack.mjs` (meshopt packs + WASM-free fallback packs, merged catalog);
  `tools/sheet.py` (contact sheet, icon atlas, ASSETS.md).
- **Assets**: 248 types across six packs (L1 67, L2 50, L3 39, L4 35, L5 32, L6 25), reviewed on the contact
  sheet. Characters: Lint rig, Prudence portraits (3 moods), full-body + in-world Prudence.
- **Engine**: instanced world + grid culling + LOD + blob shadows; crust (merged stuck objects, burial,
  knock-off); ball physics (climb low things from any angle, bumps); follow camera (auto-yaw, quick turn,
  wall collision, scaling fog/view distance); particles; Lint rig; set dressing; inward-facing room walls.
- **Levels**: all six playable and calibrated in both modes (balance tool + timed bot runs).
- **UI**: title over a live attract-mode scene, level select, mode sheet, story dialogue, HUD (size bar with
  star ticks, timer, pickup cards with NEW badges, milestone stamps, title card, time warnings), pause,
  settings, results (stars, items, verdict), collection + skins, postcard, ending, rotate prompt,
  perf overlay (triple-tap size readout).
- **Audio**: synth engine, 7 original songs, material-aware pickup SFX in key, fanfares, UI, Prudence babble.
- **Tests**: unit (23), audio render check, balance tool, screen tour (3 viewports), level tour, playthrough
  bot (6 levels × 2 modes), timed calibration, finale flow, persistence across reload, long-session profiler.

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

## Polish pass 2 (wow / jank review)
Wow:
- Results count up from the start size while the items pop in one by one; Prudence babbles her verdict.
- Big pickups (over ~40 % of the ball) give the camera a little kick on top of the shake + fanfare.
- The finale floats over the tidied city instead of a flat card; first city clear offers "See the finale".
- Fonts gate the first paint, so the title never flashes in a fallback face.
Jank fixed:
- A big ball could hang on the top edge of a thin wall (neither climbing nor standing on it): the bot spent
  four minutes trapped in the House kitchen. Climbing now continues until the ball is on top.
- With walls passable the House was far too quick (goal at 15 % of the timer): walls 1.1 → 1.5 m, pace 0.9,
  growth 0.75, new star ladder; the bot now reaches the goal at ~30 %.
- Finale used to pop over the City results after 2.6 s, hiding them.
- Outdoor levels were exhausted in a minute: bigger maps, per-level pace/growth/stars (see DESIGN.md).
- Results card on short phones (SE): rows were squashed together, then scrolled; now a compact layout fits
  without scrolling and the action row never wraps.

## Final verification
- Playthrough bot: all 6 levels × Zen and Timed complete, next level unlocks, no console errors.
- 32-minute soak across all six levels (load/dispose every ~45 s): heap flat at 37–39 MB once all packs are
  cached, 11 shader programs throughout, geometry counts return to baseline, no console errors.
- Screens at iPhone SE / 14 sizes, persistence across reload, finale flow, single-page build as hosted.
- Published: https://claude.ai/artifact/WY8bjgJp4aa1vB6BNitPUB

## Known issues
- Performance numbers come from desktop Chromium + SwiftShader, not a physical iPhone.
