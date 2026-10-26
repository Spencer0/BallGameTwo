# Lint Roller — Style Guide

**One sentence:** a sticker book come to life — flat colour, chunky ink outlines, one hard
light, and nothing that couldn't be recognised as a black silhouette the size of a thumbnail.

## 1. Principles

1. **Silhouette first.** Every object must read as a solid black shape at 48 px. Exaggerate the
   one feature that names it (the spout of a teapot, the ears of a cat, the tail fins of a plane).
2. **Big shapes, few parts.** 3–8 primitives per object. No greebles. Bevels only to catch light.
3. **Flat colour.** One base colour per part from the palette. No textures, no gradients on
   objects. Pattern (stripes, checks, dots) only as separate geometry or vertex colour bands.
4. **Chunky proportions.** Slightly toy-like: thicker handles, rounder edges, bigger heads.
5. **Warm absurdity.** Faces on creatures only (dot eyes, no mouths unless needed).

## 2. Palette (the only colours allowed on objects)

Source of truth: `tools/blender/lib/palette.py` and `src/render/palette.js` (generated).

| Token | Hex | Use |
|---|---|---|
| `ink` | `#2A1E3F` | outlines, UI text, eyes |
| `ink_soft` | `#4A3B66` | secondary text, dark plastic, tyres |
| `snow` | `#FFFFFF` | highlights, plates, eye shine |
| `cloud` | `#DDE2EE` | light grey, porcelain, metal light |
| `stone` | `#9AA0B5` | metal, concrete |
| `charcoal` | `#4A4458` | asphalt, dark metal |
| `paper` | `#FFF6E6` | paper, cream, UI cards |
| `butter` | `#FFE48A` | light yellow, butter, cheese |
| `sun` | `#FFC830` | yellow |
| `tangerine` | `#FF8A1F` | orange |
| `tomato` | `#F0412F` | red |
| `flamingo` | `#FF5C8A` | hot pink (Prudence, accent) |
| `bubblegum` | `#FFA6C6` | light pink |
| `grape` | `#7B4FD0` | purple |
| `lavender` | `#B9A6EE` | light purple (Lint) |
| `cobalt` | `#3457D5` | blue |
| `sky` | `#5BC0F5` | light blue |
| `teal` | `#19B3A6` | teal |
| `lime` | `#9AD94A` | light green |
| `leaf` | `#3DAA5C` | green |
| `pine` | `#1F7A55` | dark green |
| `sand` | `#EBC894` | tan, bread, light wood |
| `caramel` | `#D98A4E` | wood, crust |
| `cocoa` | `#8A4B2F` | dark wood, chocolate |
| `skin1..4` | `#F6CDA8` `#E0A47A` `#B9784E` `#7A4A2E` | people |

Rules: adjacent parts must differ in value (light/dark), not just hue. Each object uses at most
4 palette colours (+ ink for eyes/details).

## 3. Lighting & shading

- One directional "sun" from front-left-high. Two bands only: **lit** = base colour,
  **shadow** = base × `#9E8FCC` (cool purple multiply) — never black, never grey.
- Band edge is crisp (smoothstep width 0.04). No specular, no PBR. A faint ambient lift keeps
  the shadow band saturated.
- Blob shadows: soft-edged ink ellipses at 22 % opacity under objects and the ball.
- Distance fog blends into the level's horizon colour (big levels only).

## 4. Outlines

- Inverted-hull outlines in `ink`, 2.5 px at 1× scale for objects (×DPR, capped), 3.5 px for the
  ball and Lint. Outline colour = ink mixed 15 % with the base colour (lines feel coloured, not dead).
- Far objects (LOD1) drop outlines; fog takes over.
- Thumbnails/icons use the same treatment (Freestyle silhouette + crease lines, 2.5 px).

## 5. Environments

| Level | Ground | Horizon / sky | Mood |
|---|---|---|---|
| 1 Crumb Patrol | red-and-paper gingham tablecloth | warm butter kitchen wall → paper | morning |
| 2 Bedroom Bedlam | cobalt carpet, sun-yellow round rug | lavender wallpaper with stripes | afternoon |
| 3 House Party | caramel floorboards / cloud tiles / leaf lawn | sky → paper | midday |
| 4 Cul-de-Sac | lime lawns, charcoal roads, paper road lines | sky → butter | sunny |
| 5 Small Town | leaf fields, sand paths, teal harbour water | tangerine → butter | golden hour |
| 6 The Big Tidy | charcoal city grid, pine hills, cobalt sea | grape → flamingo → tangerine | sunset |

## 6. UI

- **Sticker panels**: flat fill, 3 px `ink` border, 18 px radius, hard offset shadow
  `0 5px 0 ink` (no blur). Buttons press down 3 px and lose the shadow.
- Primary button `sun` fill; secondary `paper`; danger `tomato`; the brand accent is `flamingo`.
- Screen backgrounds: one saturated level colour with a slow-drifting dot pattern.
- HUD: big size readout top-centre on a sticker; timer top-right in a pill; pause top-left.
  Everything clears `env(safe-area-inset-*)`.
- Icons: hand-built inline SVG, 3 px ink strokes, round caps, flat fills from the palette.

## 7. Typography

- **Display**: *Shrikhand* — chunky retro italic. Titles, level names, milestone stamps,
  Prudence's name. Always with an ink outline (`-webkit-text-stroke` / paint-order) and offset shadow.
- **UI / body**: *Baloo 2* 600–800 — rounded, very legible digits. HUD numbers use 800 with
  tabular figures.
- Fallback stack: `"Baloo 2", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif`.
- Scale (px at 390 wide): 12 · 14 · 17 · 22 · 30 · 44 · 64. Uppercase labels get +0.06em tracking.

## 8. Motion

- Snappy: 120–220 ms ease-out-back for pops; 300 ms for panel slides.
- Pickups: squash 1.25 → 0.9 → 1.0 over 180 ms.
- Respect `prefers-reduced-motion`: no screen-shake, fewer particles, no background drift.

## 9. Audio identity

Funky, jazzy, quirky. Electric piano, clavinet, upright/synth bass, brushes and tight funk
drums, muted brass stabs, whistles and kazoos for jokes. Pickup sounds are quantised to the
current track's key and rise in pitch with combos.
