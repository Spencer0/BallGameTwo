# Lint Roller asset pipeline (Blender 4.5, headless)

Every 3D asset in the game is built by Python in this folder. Nothing is hand-modelled or downloaded.

```
tools/blender/
  build.py            entry point: builds LOD0 + LOD1, renders thumbnails, exports GLB packs + catalog
  lib/palette.py      the palette (STYLE.md §2) - colours are referenced by NAME
  lib/core.py         part helpers (box, cyl, sphere, ico, torus, lathe, extrude, tube, capsule, eyes, ...)
  lib/render.py       EEVEE toon + Freestyle thumbnail renderer
  lib/registry.py     @asset decorator, triangle budgets, material list
  assets/lN_*.py      asset modules, one function per object type
```

## Commands

```bash
# quick preview of a few assets (no export)
xvfb-run -a -s "-screen 0 1280x1024x24" blender -b -P tools/blender/build.py -- --only teacup,mug
python3 tools/sheet.py --ids teacup,mug --out build/sheet_preview.png --cols 4 --cell 220
# full level pack (exports build/raw/L1.glb + build/catalog/L1.json)
xvfb-run -a -s "-screen 0 1280x1024x24" blender -b -P tools/blender/build.py -- --levels 1
python3 tools/sheet.py --levels 1 --out build/sheet_L1.png --cols 8 --cell 160
# everything + icon atlas + ASSETS.md
xvfb-run -a blender -b -P tools/blender/build.py && python3 tools/sheet.py
```

## Conventions

- Units are **metres at real-world scale** (a teacup is ~0.13 m wide, a bus is ~11 m long).
- Blender Z-up. The object's **front faces -Y** (towards the thumbnail camera). The base is
  auto-recentred to z = 0 and centred in x/y, so author around the origin.
- Colours are palette **names** only (`"tomato"`, `"snow"`, ...). `tint=True` marks parts that
  change colour for the asset's `variants` (e.g. a car body). Max ~4 colours per object + ink details.
- Helpers take `at=(x, y, z)` and `rot=(rx, ry, rz)` in degrees. `box(..., base=True)` and `cyl`
  (default `base=True`) put `at` at the bottom. `lod0=True` parts are skipped for LOD1 (use it for
  small details: eye shines, sprinkles, buttons, windows on far buildings).
- LOD1 is the same function rebuilt with halved segment counts and no bevels — so keep segment
  counts explicit and modest (`segs=8..16`).

## @asset metadata

```python
@asset("teacup", "Teacup", "Pinky out. Always.", level=1, mat="ceramic", tier="small",
       variants=["sky", "flamingo"], col="cyl", flags=[], fill=0.5)
```
- `desc`: one funny line for the collection log, ≤ 70 characters, in the voice of the game
  (dry, absurd, affectionate). No references to other games or real brands.
- `mat` (drives pickup sound): soft, wood, metal, ceramic, glass, food, plastic, paper,
  electronic, living, stone, rubber, plant.
- `tier` (triangle budget LOD0/LOD1): tiny 260/64 · small 720/180 · medium 1400/400 ·
  large 2600/720 · landmark 4200/1100.
- `col`: collider approximation from the bounding box: `box` (default), `cyl` (round footprint), `sphere`.
- `flags`: `creature` (alive, has a face), `wander` (moves around), `flee` (runs from a ball that can
  eat it), `float` (hovers/flies; layout places it in the air), `squeaky`.
- `fill`: fraction of the bounding box that is "stuff" (0.2 for a chair, 0.9 for a brick). Drives growth.

## Quality bar (review every thumbnail)

1. **Silhouette**: would it be recognisable as a solid black shape at 48 px? Exaggerate the
   defining feature (teapot spout, cat ears, plane wings).
2. **Bold flat graphic**: big simple shapes, 3–10 parts, flat palette colours, adjacent parts differ in
   value. No noisy detail. Chunky toy-like proportions.
3. **Charm**: creatures get dot eyes (`eyes()`); objects can be a little smug.
4. **Budget**: no `[budget] OVER BUDGET` lines.
5. **Scale**: real-world size so the level design works.
