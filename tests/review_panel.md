# City review panel — brief for each reviewer

You are one of four independent reviewers judging the outdoor levels of **Lint Roller**, a phone game in
the spirit of Katamari Damacy: you roll a sticky ball that picks up everything smaller than it, growing
from a few metres to hundreds of metres. The art style is deliberately toy-like and graphic (flat colours,
chunky ink outlines, limited palette — see STYLE.md). Realism here means **the places make sense**, not
photorealism.

The owner's complaint that started this work: "from the cul-de-sac on, levels don't feel real — picket
fences not touching and turned the wrong way, streets that just end, cars that don't move; it's a
hodge-podge of assets to be rolled over. I want them to feel living and breathing, like real places."
Their definition of done: **a group of smart reviewers all agree the levels are cohesive, coherent and
aligned with a sense of realism.**

What each level is meant to be (judge it against this):
- **L4 Cul-de-Sac** — a 1990s North American subdivision ("Maple Loop") off a suburban arterial.
- **L5 Small Town** — a Midwestern / New England river town ("Puddleford") with farms around it.
- **L6 The Big Tidy** — a big city modelled on Manhattan and its rivers.

Evidence per level in `build/review/L<n>/` (read every image with the Read tool):
- `play_*.png` — what the player sees (ball + follow camera) in different districts and ball sizes,
- `aerial_*.png` — oblique overviews of districts,
- `map.png` — top-down view of the whole level,
- `motion_*_0..3.png` — four frames 0.5 s apart from a fixed camera (look for things that moved),
- `stats.json` — object counts by type, road-network stats, life-system stats (moving agents).

Your lens is given in your task. Stay in it, but flag anything that badly breaks the illusion.

Report, for EACH of L4, L5, L6:
1. **Verdict: PASS or FAIL** for "cohesive, coherent, realistic place, alive" under your lens.
   PASS means you would sign off on it as is; minor polish notes may accompany a PASS.
2. The issues that drive a FAIL (or the polish notes for a PASS), most important first. Each issue:
   what is wrong, where (image name + location in it), why it breaks the sense of place, and a concrete
   fix. Be specific and skeptical; do not give credit for intentions you cannot see in the images.
Keep the report under ~600 words. Do not edit any files.
