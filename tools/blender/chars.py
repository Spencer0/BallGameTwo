"""Characters: Lint (in-game rig parts) and Madame Prudence Plume (dialogue portraits).

  xvfb-run -a -s "-screen 0 1280x1024x24" blender -b -P tools/blender/chars.py

Outputs:
  build/raw/CHAR.glb               char__lint_body / _ear_l / _ear_r / _foot_l / _foot_r (pivots at origin)
  assets/img/prudence_<mood>.png   512px portraits (stern, shocked, pleased)
  assets/img/lint_<pose>.png       512px renders (wave, push) for UI
  build/thumbs/char_*.png          previews
"""
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

from lib import core, render  # noqa: E402
from lib.core import box, cyl, sphere, ico, torus, lathe, extrude, tube, capsule, eyes  # noqa: E402

# Lint is authored ~1 unit tall (body radius 0.36) and scaled in game.
BODY_R = 0.36


def lint_body(face="happy"):
    # fluffy body: core sphere + ring of tufts
    sphere(BODY_R, at=(0, 0, BODY_R), color="lavender", segs=16, rings=10)
    for k in range(14):
        a = 2 * math.pi * k / 14
        if abs(math.degrees(a) - 270) < 40:  # keep the face clear
            continue
        z = BODY_R + (0.12 if k % 2 else -0.06)
        rr = BODY_R * (0.88 if k % 2 else 0.95)
        sphere(0.09 if k % 2 else 0.1, at=(rr * math.cos(a), rr * math.sin(a), z), color="lavender", segs=8)
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        sphere(0.08, at=(0.12 * math.cos(a), 0.12 * math.sin(a), 2 * BODY_R - 0.03), color="lavender", segs=8)
    # face (front = -Y)
    eyes((0, -BODY_R * 0.97, BODY_R * 1.12), 0.22, 0.065, color="ink")
    for side in (-1, 1):
        sphere(0.055, at=(side * 0.2, -BODY_R * 0.88, BODY_R * 0.93), scale=(1.2, 0.4, 0.75), color="bubblegum", segs=8)
    # tiny smile
    torus(0.04, 0.012, at=(0, -BODY_R * 0.99, BODY_R * 0.99), rot=(-90, 0, 0), color="ink", segs=10, rsegs=4, arc=180)
    # nubby arms reaching forward
    for side in (-1, 1):
        sphere(0.07, at=(side * 0.3, -0.2, BODY_R * 0.8), scale=(1, 1.3, 1), color="lavender", segs=8)


def lint_ear(side):
    # pivot at the ear base (origin), ear points up and slightly outward
    tilt = 14 * side
    capsule(0.075, 0.36, at=(0, 0, 0.24), color="lavender", segs=10)
    capsule(0.04, 0.27, at=(0, -0.05, 0.25), color="bubblegum", segs=8)
    # floppy tip on the right ear for asymmetry/charm
    if side > 0:
        sphere(0.08, at=(0.04, 0.0, 0.47), scale=(1.1, 0.9, 0.8), color="lavender", segs=8)


def lint_foot():
    # pivot at ankle; sneaker pointing -Y
    sphere(0.085, at=(0, -0.035, 0.05), scale=(0.9, 1.45, 0.75), color="tangerine", segs=10)
    box((0.15, 0.25, 0.035), at=(0, -0.035, 0.0), color="snow", bevel=0.015, base=True)
    box((0.05, 0.03, 0.02), at=(0, -0.13, 0.075), color="snow", lod0=True)


def prudence(mood="stern", full=False):
    """Flamingo bust: big head, compact S-neck, banana beak, monocle. Faces -Y."""
    pink, pale = "flamingo", "bubblegum"
    # body (egg) + wing
    sphere(0.42, at=(0, 0.1, 0.62), scale=(0.9, 1.15, 0.78), color=pink, segs=16)
    sphere(0.3, at=(0.26, 0.14, 0.66), scale=(0.45, 1.05, 0.72), rot=(-10, 0, 0), color=pale, segs=12)
    # compact S-curve neck
    tube([(0.0, -0.05, 0.8), (0.0, -0.22, 1.0), (0.0, -0.14, 1.2), (0.0, -0.02, 1.36), (0.0, -0.04, 1.5)], 0.1,
         r_end=0.085, color=pink, segs=12, smooth_path=2)
    # pearls
    for k in range(14):
        a = 2 * math.pi * k / 14
        sphere(0.04, at=(0.13 * math.cos(a), -0.07 + 0.12 * math.sin(a), 0.86 + 0.03 * math.sin(a)), color="snow", segs=8)
    # head
    hz = 1.62
    sphere(0.25, at=(0, -0.08, hz), scale=(1, 1.12, 0.95), color=pink, segs=16)
    # crest feathers
    for k, (dx, h) in enumerate(((-0.06, 0.18), (0.02, 0.24), (0.1, 0.16))):
        capsule(0.035, h, at=(dx, 0.0, hz + 0.22 + h / 2), rot=(-28 + k * 10, 18 * (k - 1), 0), color=pale, segs=6)
    # beak: big bent banana, pale with ink tip
    tube([(0, -0.3, hz - 0.02), (0, -0.46, hz - 0.04), (0, -0.57, hz - 0.12), (0, -0.6, hz - 0.24)], 0.085,
         r_end=0.05, color="paper", segs=12, smooth_path=2)
    tube([(0, -0.585, hz - 0.18), (0, -0.6, hz - 0.26), (0, -0.57, hz - 0.33)], 0.056, r_end=0.02, color="ink", segs=10,
         smooth_path=1)
    if mood == "shocked":
        tube([(0, -0.28, hz - 0.12), (0, -0.4, hz - 0.2), (0, -0.46, hz - 0.28)], 0.055, r_end=0.03, color="paper",
             segs=10, smooth_path=1)
        sphere(0.06, at=(0, -0.36, hz - 0.13), scale=(0.7, 1, 0.6), color="tomato", segs=8)
    # eyes per mood
    ex, ez = 0.13, hz + 0.06
    for side in (-1, 1):
        x = side * ex
        if mood == "pleased":
            torus(0.05, 0.016, at=(x, -0.3, ez), rot=(90, 0, 0), color="ink", segs=10, rsegs=4, arc=180)
            sphere(0.055, at=(x * 1.25, -0.27, ez - 0.1), scale=(1.2, 0.4, 0.7), color="tomato", segs=8)
        else:
            big = mood == "shocked"
            sphere(0.085 if big else 0.07, at=(x, -0.27, ez), scale=(1, 0.5, 1.1), color="snow", segs=12)
            sphere(0.05 if big else 0.042, at=(x, -0.31, ez - 0.005), scale=(1, 0.5, 1.15), color="ink", segs=10)
            sphere(0.016, at=(x - 0.015, -0.335, ez + 0.02), color="snow", segs=6)
        if mood == "stern":
            box((0.13, 0.03, 0.03), at=(x, -0.31, ez + 0.1), rot=(0, side * -20, 0), color="ink", bevel=0.01)
        elif mood == "shocked":
            box((0.11, 0.03, 0.028), at=(x, -0.3, ez + 0.15), rot=(0, side * 14, 0), color="ink", bevel=0.01)
        else:
            box((0.1, 0.03, 0.026), at=(x, -0.3, ez + 0.11), rot=(0, side * 8, 0), color="ink", bevel=0.01)
    # monocle over her left eye (+x) with chain
    torus(0.1, 0.016, at=(ex, -0.355, ez), rot=(90, 0, 0), color="sun", segs=18, rsegs=6)
    cyl(0.088, 0.004, at=(ex, -0.355, ez), rot=(90, 0, 0), color="glass", segs=16, base=False)
    tube([(ex + 0.08, -0.34, ez - 0.06), (ex + 0.15, -0.3, ez - 0.25), (0.22, -0.2, 1.2), (0.25, -0.14, 0.95)], 0.01,
         color="sun", segs=4, smooth_path=1)
    # clipboard held in front
    box((0.36, 0.035, 0.46), at=(-0.2, -0.44, 0.66), rot=(-12, 0, 18), color="caramel", bevel=0.015)
    box((0.3, 0.02, 0.38), at=(-0.2, -0.465, 0.64), rot=(-12, 0, 18), color="snow")
    box((0.13, 0.045, 0.055), at=(-0.27, -0.45, 0.88), rot=(-12, 0, 18), color="stone", bevel=0.01)
    for k in range(4):
        box((0.19 - 0.04 * (k % 2), 0.01, 0.02), at=(-0.19 + 0.01 * k, -0.48, 0.73 - 0.075 * k), rot=(-12, 0, 18),
            color="tomato" if k == 0 else "stone")
    sphere(0.13, at=(-0.24, -0.38, 0.56), scale=(0.7, 0.9, 1.1), rot=(0, 30, 0), color=pale, segs=10)  # wing tip
    if full:
        for side, lift in ((-1, 0), (1, 1)):
            x = side * 0.1
            if lift:
                tube([(x, 0.1, 0.3), (x, 0.05, 0.05), (x, -0.22, 0.2), (x, -0.08, 0.34)], 0.028, color=pink, segs=6)
            else:
                tube([(x, 0.1, 0.3), (x, 0.06, -0.35), (x, 0.04, -0.95)], 0.028, color=pink, segs=6)
                sphere(0.08, at=(x, -0.04, -0.96), scale=(1, 1.6, 0.4), color=pink, segs=8)


def render_png(obj, path, size=512, az=22, el=8, pad=1.08, crop=None):
    sc = bpy.context.scene
    sc.render.resolution_x = sc.render.resolution_y = size
    for o in sc.collection.objects:
        if o.type == "MESH":
            o.hide_render = o is not obj
    render.frame_camera(obj, az, el, pad)
    if crop:
        # frame only the z-range crop=(z0, z1) of the object
        cam = bpy.data.objects["Cam"]
        inv = cam.matrix_world.inverted()
        bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        xs = [b.x for b in bb]
        cx = (min(xs) + max(xs)) / 2
        p0 = inv @ Vector((cx, 0, crop[0]))
        p1 = inv @ Vector((cx, 0, crop[1]))
        mid = cam.matrix_world @ Vector(((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 0))
        cam.location = mid
        cam.data.ortho_scale = abs(p1.y - p0.y) * pad
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    render.setup_scene()
    os.makedirs(os.path.join(ROOT, "assets", "img"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "build", "thumbs"), exist_ok=True)
    out_objs = []
    # Lint rig parts (no recentering: pivots matter)
    parts = {
        "char__lint_body": lambda: lint_body(),
        "char__lint_ear_l": lambda: lint_ear(-1),
        "char__lint_ear_r": lambda: lint_ear(1),
        "char__lint_foot_l": lambda: lint_foot(),
        "char__lint_foot_r": lambda: lint_foot(),
    }
    for name, fn in parts.items():
        core.begin(0)
        fn()
        o, st = core.finalize(name, recenter=False)
        out_objs.append(o)
        print(f"[char] {name} tris {st['tris']}")
    # full-figure Lint for UI renders
    def lint_full(pose="wave"):
        core.begin(0)
        lint_body()
        # ears placed like the in-game rig
        for side in (-1, 1):
            tilt = side * (16 if pose == "wave" else 8)
            capsule(0.075, 0.36, at=(side * 0.14 + side * 0.06, -0.02, 0.64 + 0.24), rot=(0, tilt, 0), color="lavender",
                    segs=10)
            capsule(0.04, 0.27, at=(side * 0.14 + side * 0.065, -0.07, 0.64 + 0.25), rot=(0, tilt, 0),
                    color="bubblegum", segs=8)
        for side in (-1, 1):
            sphere(0.085, at=(side * 0.13, -0.07, 0.05), scale=(0.9, 1.45, 0.75), color="tangerine", segs=10)
            box((0.15, 0.25, 0.035), at=(side * 0.13, -0.07, 0.0), color="snow", bevel=0.015, base=True)
        if pose == "wave":
            capsule(0.06, 0.16, at=(0.38, -0.08, 0.62), rot=(0, -40, 0), color="lavender", segs=8)
        o, _ = core.finalize("lint_" + pose, recenter=False)
        return o

    for pose in ("wave",):
        o = lint_full(pose)
        render_png(o, os.path.join(ROOT, "assets", "img", f"lint_{pose}.png"), 512, az=18, el=10)
        render_png(o, os.path.join(ROOT, "build", "thumbs", f"char_lint_{pose}.png"), 256, az=18, el=10)
        bpy.data.objects.remove(o, do_unlink=True)

    for mood in ("stern", "shocked", "pleased"):
        core.begin(0)
        prudence(mood)
        o, st = core.finalize("prudence_" + mood, recenter=False)
        print(f"[char] prudence {mood} tris {st['tris']}")
        render_png(o, os.path.join(ROOT, "assets", "img", f"prudence_{mood}.png"), 512, az=-28, el=6, pad=1.04,
                   crop=(0.55, 2.02))
        render_png(o, os.path.join(ROOT, "build", "thumbs", f"char_prudence_{mood}.png"), 256, az=-28, el=6, pad=1.04,
                   crop=(0.55, 2.02))
        bpy.data.objects.remove(o, do_unlink=True)
    core.begin(0)
    prudence("pleased", full=True)
    o, _ = core.finalize("prudence_full", recenter=True)
    render_png(o, os.path.join(ROOT, "assets", "img", "prudence_full.png"), 512, az=-24, el=6, pad=1.04)
    bpy.data.objects.remove(o, do_unlink=True)
    # in-world Prudence (stern, inspecting) for set dressing
    core.begin(0)
    prudence("stern", full=True)
    o, st = core.finalize("char__prudence", recenter=True)
    print(f"[char] prudence world tris {st['tris']}")
    out_objs.append(o)

    # export Lint rig
    bpy.ops.object.select_all(action="DESELECT")
    for o in out_objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, "build", "raw", "CHAR.glb"), export_format="GLB",
                              use_selection=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_materials="NONE", export_normals=True, export_yup=True, export_apply=True,
                              export_texcoords=False, export_animations=False, export_extras=False)
    print("[chars] done")


main()
