"""Build Lint Roller asset packs.

Usage (needs a display for EEVEE thumbnails, so wrap in xvfb-run):
  xvfb-run -a blender -b -P tools/blender/build.py -- [--levels 1,2] [--only id,id] [--no-thumbs] [--no-export]

Outputs:
  build/thumbs/<id>.png        256px preview (EEVEE toon + Freestyle)
  build/raw/L<n>.glb           uncompressed pack (LOD0 `<id>`, LOD1 `<id>__lod1`)
  build/catalog/L<n>.json      metadata for the game (dims, collider, pickup size, ...)
"""
import importlib
import json
import os
import pkgutil
import sys
import time

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

from lib import core, render  # noqa: E402
from lib.registry import ASSETS, BUDGETS  # noqa: E402
import assets  # noqa: E402

for m in pkgutil.iter_modules(assets.__path__):
    importlib.import_module(f"assets.{m.name}")


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = {"levels": None, "only": None, "thumbs": True, "export": True}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--levels":
            opts["levels"] = [int(x) for x in argv[i + 1].split(",")]
            i += 1
        elif a == "--only":
            opts["only"] = argv[i + 1].split(",")
            i += 1
        elif a == "--no-thumbs":
            opts["thumbs"] = False
        elif a == "--no-export":
            opts["export"] = False
        i += 1
    if opts["only"]:
        opts["export"] = False
    return opts


def to_three_dims(st):
    (x0, y0, z0), (x1, y1, z1) = st["min"], st["max"]
    return [round(x1 - x0, 5), round(z1 - z0, 5), round(y1 - y0, 5)]


def collider(kind, dims):
    w, h, d = dims
    if kind == "box":
        return {"kind": "box", "half": [w / 2, h / 2, d / 2], "cy": h / 2}
    if kind == "cyl":
        return {"kind": "cyl", "r": max(w, d) / 2, "h": h, "cy": h / 2}
    return {"kind": "sphere", "r": max(w, h, d) / 2, "cy": h / 2}


def build_asset(a):
    core.begin(0)
    a["fn"]()
    o0, s0 = core.finalize(a["id"])
    core.begin(1)
    a["fn"]()
    o1, s1 = core.finalize(a["id"] + "__lod1")
    b0, b1 = BUDGETS[a["tier"]]
    problems = []
    if s0["tris"] > b0:
        problems.append(f"LOD0 {s0['tris']} > {b0}")
    if s1["tris"] > b1:
        problems.append(f"LOD1 {s1['tris']} > {b1}")
    dims = to_three_dims(s0)
    sd = sorted(dims, reverse=True)
    meta = {k: a[k] for k in ("id", "name", "desc", "level", "mat", "tier", "variants", "flags")}
    meta.update({
        "dims": dims,
        "size": round(0.5 * sd[0] + 0.5 * sd[1], 5),
        "vol": round(dims[0] * dims[1] * dims[2] * a["fill"], 9),
        "collider": collider(a["col"], dims),
        "tris": [s0["tris"], s1["tris"]],
        "colors": s0["colors"],
        "tintable": s0["tintable"],
    })
    meta.update(a["extra"])
    return o0, o1, meta, problems


def main():
    opts = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    render.setup_scene()
    os.makedirs(os.path.join(ROOT, "build", "thumbs"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "build", "raw"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "build", "catalog"), exist_ok=True)
    selected = [a for a in ASSETS.values()
                if (opts["levels"] is None or a["level"] in opts["levels"])
                and (opts["only"] is None or a["id"] in opts["only"])]
    by_level = {}
    for a in selected:
        by_level.setdefault(a["level"], []).append(a)
    all_problems = []
    for lvl, items in sorted(by_level.items()):
        t0 = time.time()
        metas, objs = [], []
        for a in items:
            o0, o1, meta, problems = build_asset(a)
            objs += [o0, o1]
            metas.append(meta)
            if problems:
                all_problems.append(f"{a['id']}: " + "; ".join(problems))
            if opts["thumbs"]:
                o1.hide_render = True
                render.render_thumb(o0, os.path.join(ROOT, "build", "thumbs", a["id"] + ".png"))
            print(f"[asset] L{lvl} {a['id']:<22} tris {meta['tris'][0]:>5}/{meta['tris'][1]:<4} "
                  f"dims {meta['dims']} size {meta['size']}")
        if opts["export"]:
            bpy.ops.object.select_all(action="DESELECT")
            for o in objs:
                o.select_set(True)
                o.hide_render = False
            path = os.path.join(ROOT, "build", "raw", f"L{lvl}.glb")
            bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                                      export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                                      export_materials="NONE", export_normals=True, export_yup=True,
                                      export_apply=True, export_texcoords=False, export_tangents=False,
                                      export_animations=False, export_skins=False, export_morph=False,
                                      export_cameras=False, export_lights=False, export_extras=False)
            with open(os.path.join(ROOT, "build", "catalog", f"L{lvl}.json"), "w") as f:
                json.dump(metas, f, indent=1)
        # clean up for the next level
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
        for m in list(bpy.data.meshes):
            if m.users == 0:
                bpy.data.meshes.remove(m)
        print(f"[pack] L{lvl}: {len(items)} assets in {time.time() - t0:.1f}s")
    if all_problems:
        print("[budget] OVER BUDGET:\n  " + "\n  ".join(all_problems))
    print("[build] done")


main()
