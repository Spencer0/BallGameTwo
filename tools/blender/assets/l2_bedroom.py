"""Level 2 — Bedroom Bedlam (a kid's bedroom). Objects face -Y; base at z = 0; metres."""
import math
import random

import bmesh
from mathutils import Euler, Matrix, Vector

from lib import core
from lib.core import box, cyl, sphere, ico, torus, lathe, extrude, tube, capsule, eyes, ngon_points, \
    star_points, rounded_rect_points
from lib.registry import asset

L = 2
RAINBOW = ["tomato", "tangerine", "sun", "lime", "leaf", "sky", "cobalt", "grape"]


# ---------------------------------------------------------------- local helpers

def _lod():
    return core.STATE.lod


def _rp(at, rot, local):
    """World position of `local` inside a part placed at `at` with `rot` (degrees, XYZ)."""
    v = Euler([math.radians(a) for a in rot], "XYZ").to_matrix() @ Vector(local)
    return (at[0] + v.x, at[1] + v.y, at[2] + v.z)


def _aim(d):
    """Euler (degrees) that turns local +Z towards direction d."""
    e = Vector(d).normalized().to_track_quat("Z", "Y").to_euler("XYZ")
    return tuple(math.degrees(a) for a in e)


def _mesh(verts, faces, color, tint=False, lod0=False, smooth=False):
    """Raw polygon soup (faces index into verts) merged into the builder."""
    if lod0 and _lod() > 0:
        return
    tmp = bmesh.new()
    vs = [tmp.verts.new(v) for v in verts]
    for f in faces:
        try:
            tmp.faces.new([vs[i] for i in f])
        except ValueError:
            pass
    core._merge(tmp, color, tint, Matrix.Identity(4), smooth=smooth)


def _slab(pts, thick, color, tint=False, lod0=False):
    """Thin prism from a planar convex 3D polygon (paper, kite panels, fins)."""
    P = [Vector(p) for p in pts]
    n = (P[1] - P[0]).cross(P[2] - P[0]).normalized() * (thick / 2)
    k = len(P)
    verts = [tuple(p + n) for p in P] + [tuple(p - n) for p in P]
    faces = [list(range(k)), list(reversed(range(k, 2 * k)))]
    faces += [[k + i, k + (i + 1) % k, (i + 1) % k, i] for i in range(k)]
    _mesh(verts, faces, color, tint, lod0)


def _eyes(at, spacing, r, far=True, **kw):
    """eyes() that can be dropped from LOD1 (far=False) to save triangles on small creatures."""
    if not far and _lod() > 0:
        return
    eyes(at, spacing, r, **kw)


def _bar(x0, y0, x1, y1, w):
    d = Vector((x1 - x0, y1 - y0))
    n = Vector((-d.y, d.x)).normalized() * (w / 2)
    return [(x0 - n.x, y0 - n.y), (x1 - n.x, y1 - n.y), (x1 + n.x, y1 + n.y), (x0 + n.x, y0 + n.y)]


def _arc(cx, cy, r, w, a0, a1, n):
    out, inn = [], []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        out.append((cx + (r + w / 2) * math.cos(a), cy + (r + w / 2) * math.sin(a)))
        inn.append((cx + (r - w / 2) * math.cos(a), cy + (r - w / 2) * math.sin(a)))
    return out + list(reversed(inn))


# letters for toy blocks, in a unit box centred on 0 (each entry is one extruded stroke)
GLYPHS = {
    "A": [_bar(-0.36, -0.5, 0.0, 0.5, 0.2), _bar(0.36, -0.5, 0.0, 0.5, 0.2), _bar(-0.2, -0.08, 0.2, -0.08, 0.16)],
    "B": [_bar(-0.3, -0.5, -0.3, 0.5, 0.2), _arc(-0.2, 0.25, 0.17, 0.16, 90, -90, 6),
          _arc(-0.2, -0.22, 0.2, 0.16, 90, -90, 6)],
    "C": [_arc(0.0, 0.0, 0.36, 0.2, 50, 310, 8)],
}


def _glyph(ch, at, rot, size, depth, color, lod0=True):
    for poly in GLYPHS[ch]:
        extrude([(x * size, y * size) for (x, y) in poly], depth, at=at, rot=rot, color=color, center=False,
                lod0=lod0)


# ---------------------------------------------------------------- tiny & small toys

@asset("marble", "Marble", "Rolls under furniture on purpose. For the drama.", L, "glass", "tiny",
       variants=["sky", "flamingo", "lime", "sun"], col="sphere")
def marble():
    sphere(0.008, at=(0, 0, 0.008), color="sky", segs=12, rings=7, tint=True)
    # S-shaped vane across the side facing the viewer
    pts = []
    for i in range(11):
        t = math.radians(-62 + 124 * i / 10)
        lat = 0.75 * math.sin(2 * t)
        v = Vector((math.sin(t) * math.cos(lat), -math.cos(t) * math.cos(lat), math.sin(lat)))
        v = Matrix.Rotation(math.radians(25), 3, "Z") @ v * 0.0076
        pts.append((v.x, v.y, v.z + 0.008))
    tube(pts, 0.0012, color="snow", segs=4, lod0=True)
    sphere(0.0017, at=(-0.0035, -0.0058, 0.0115), color="snow", segs=5, lod0=True)


@asset("building_block", "Letter Block", "A, B, C. Spells nothing yet. Give it time.", L, "wood", "small",
       variants=["tomato", "cobalt", "leaf", "grape"], col="box", fill=0.95)
def building_block():
    s = 0.04
    box((s, s, s), base=True, color="sand", bevel=0.003, bseg=1)
    p, t = 0.031, 0.002
    for at, size in (((0, -s / 2, s / 2), (p, t, p)), ((0, s / 2, s / 2), (p, t, p)),
                     ((s / 2, 0, s / 2), (t, p, p)), ((-s / 2, 0, s / 2), (t, p, p)), ((0, 0, s), (p, p, t))):
        box(size, at=at, color="tomato", tint=True)
    g, d = 0.024, 0.0025
    _glyph("A", (0, -s / 2 - 0.001, s / 2), (90, 0, 0), g, d, "snow")
    _glyph("B", (s / 2 + 0.001, 0.002, s / 2), (90, 0, 90), g, d, "snow")
    _glyph("C", (0, 0, s + 0.001), (0, 0, 0), g, d, "snow")


@asset("yoyo", "Yo-Yo", "Goes down. Comes back up. Emotionally available.", L, "plastic", "small",
       variants=["tomato", "sky", "lime", "grape"], col="box", fill=0.6)
def yoyo():
    cyl(0.023, 0.012, at=(0, -0.0025, 0.03), rot=(90, 0, 0), r2=0.03, color="tomato", segs=16, bevel=0.003,
        tint=True)
    cyl(0.023, 0.012, at=(0, 0.0025, 0.03), rot=(-90, 0, 0), r2=0.03, color="tomato", segs=16, bevel=0.003,
        tint=True)
    cyl(0.007, 0.006, at=(0, 0.003, 0.03), rot=(90, 0, 0), color="ink_soft", segs=8)
    cyl(0.016, 0.002, at=(0, -0.0143, 0.03), rot=(90, 0, 0), color="sun", segs=12)
    cyl(0.006, 0.0015, at=(0, -0.016, 0.03), rot=(90, 0, 0), color="snow", segs=8, lod0=True)
    tube([(0, 0, 0.036), (0, 0, 0.064), (0.004, 0, 0.07)], 0.0012, color="paper", segs=4, caps=False)
    torus(0.0055, 0.0013, at=(0.009, 0, 0.072), rot=(90, 0, 0), color="paper", segs=8, rsegs=4)


@asset("baseball", "Baseball", "Hit one window. Just the one. Very sorry.", L, "rubber", "small", col="sphere",
       fill=0.52)
def baseball():
    r = 0.0375
    sphere(r, at=(0, 0, r), color="snow", segs=14, rings=8)
    n = 28 if _lod() == 0 else 14
    a, b = 0.7, 0.3
    c = 2 * math.sqrt(a * b)
    rm = Euler((math.radians(25), math.radians(-20), math.radians(30)), "XYZ").to_matrix()
    pts = []
    for i in range(n + 1):
        t = 2 * math.pi * i / n
        v = rm @ Vector((a * math.cos(t) + b * math.cos(3 * t), a * math.sin(t) - b * math.sin(3 * t),
                         c * math.sin(2 * t))) * (r * 1.005)
        pts.append((v.x, v.y, v.z + r))
    tube(pts, 0.0024, color="tomato", segs=4, caps=False)


@asset("action_figure", "Action Figure", "Mint condition, minus the chew marks.", L, "plastic", "small",
       variants=["cobalt", "leaf", "grape"], col="box", fill=0.3)
def action_figure():
    cyl(0.032, 0.007, color="ink_soft", segs=8)
    for k in (-1, 1):
        box((0.016, 0.019, 0.055), at=(k * 0.012, 0, 0.007), rot=(0, -k * 7, 0), base=True, color="cobalt", tint=True)
        box((0.02, 0.026, 0.013), at=(k * 0.015, -0.003, 0.007), base=True, color="tomato", lod0=True)
    box((0.044, 0.026, 0.042), at=(0, 0, 0.058), base=True, color="cobalt", tint=True, taper=(1.2, 1.1))
    box((0.042, 0.028, 0.007), at=(0, 0, 0.057), base=True, color="sun", lod0=True)
    extrude(star_points(5, 0.009, 0.004), 0.002, at=(0, -0.0138, 0.083), rot=(90, 0, 0), color="sun",
            center=False, lod0=True)
    cyl(0.006, 0.01, at=(0, 0, 0.098), color="skin1", segs=6, lod0=True)
    sphere(0.016, at=(0, 0, 0.119), color="skin1", segs=10, scale=(1, 1, 1.08))
    sphere(0.0167, at=(0, 0.002, 0.124), color="ink", segs=10, scale=(1.02, 1.02, 0.75), lod0=True)  # hair
    _eyes((0, -0.0152, 0.117), 0.012, 0.0024, far=False, shine=False)
    # cape
    extrude([(-0.025, 0.098), (0.025, 0.098), (0.042, 0.022), (0.016, 0.032), (0, 0.02), (-0.016, 0.032),
             (-0.042, 0.022)], 0.004, at=(0, 0.019, 0), rot=(90, 0, 0), color="tomato", center=False)
    # arms: one fist to the sky, one hand on hip
    tube([(-0.026, 0, 0.095), (-0.038, 0, 0.115), (-0.042, 0, 0.138)], 0.0065, color="cobalt", segs=6, tint=True)
    sphere(0.0085, at=(-0.042, 0, 0.145), color="tomato", segs=6)
    tube([(0.026, 0, 0.095), (0.042, -0.004, 0.08), (0.029, -0.007, 0.067)], 0.0065, color="cobalt", segs=6,
         tint=True)
    sphere(0.0085, at=(0.027, -0.007, 0.066), color="tomato", segs=6)


@asset("crayon_box", "Crayon Box", "Several colours eaten. Allegedly by the dog.", L, "paper", "small",
       col="box", fill=0.7)
def crayon_box():
    box((0.08, 0.032, 0.072), base=True, color="sun")
    box((0.082, 0.034, 0.026), at=(0, 0, 0.024), base=True, color="leaf")
    box((0.08, 0.003, 0.026), at=(0, 0.0175, 0.07), rot=(-20, 0, 0), base=True, color="sun")
    cols = ["tomato", "cobalt", "tangerine", "grape", "sky", "leaf", "flamingo", "ink_soft"]
    hs = [0.038, 0.03, 0.042, 0.033, 0.034, 0.026, 0.038, 0.029]
    for i, (c, h) in enumerate(zip(cols, hs)):
        x = -0.03 + 0.06 * (i % 4) / 3 + (0.006 if i >= 4 else 0)
        y = -0.0065 if i >= 4 else 0.0065
        z = 0.05 + h - (0.006 if i >= 4 else 0)
        cyl(0.0068, z - 0.05, at=(x, y, 0.05), color=c, segs=8, caps=False)
        cyl(0.0068, 0.015, at=(x, y, z), r2=0.0016, color=c, segs=8, caps=False)
    for i in range(3):
        extrude([(-0.012, 0.0), (0.0, 0.009), (0.012, 0.0)], 0.002, at=(-0.022 + 0.022 * i, -0.0168, 0.033),
                rot=(90, 0, 0), color="sun", center=False, lod0=True)


@asset("alarm_clock", "Alarm Clock", "Screams at seven. Has never once been thanked.", L, "metal", "small",
       variants=["tomato", "sky", "mint", "grape"], col="box", fill=0.5)
def alarm_clock():
    c = 0.068
    cyl(0.054, 0.045, at=(0, 0.0225, c), rot=(90, 0, 0), color="tomato", segs=14, bevel=0.006, tint=True)
    cyl(0.045, 0.003, at=(0, -0.022, c), rot=(90, 0, 0), color="snow", segs=16)
    torus(0.047, 0.004, at=(0, -0.0235, c), rot=(90, 0, 0), color="cloud", segs=12, rsegs=3, lod0=True)
    box((0.004, 0.002, 0.034), at=(0, -0.026, c), rot=(0, 60, 0), base=True, color="ink")
    box((0.005, 0.002, 0.024), at=(0, -0.026, c), rot=(0, -55, 0), base=True, color="ink")
    for a in (0, 90, 180, 270):
        x, z = 0.038 * math.cos(math.radians(a)), 0.038 * math.sin(math.radians(a))
        box((0.004, 0.002, 0.004), at=(x, -0.0255, c + z), color="ink", lod0=True)
    for k in (-1, 1):
        p = (k * 0.058 * math.sin(math.radians(40)), 0, c + 0.058 * math.cos(math.radians(40)))
        lathe([(0.027, 0.0), (0.026, 0.009), (0.021, 0.018), (0.012, 0.025), (0.0, 0.027)], at=p,
              rot=(0, k * 40, 0), color="cloud", segs=10)
        cyl(0.007, 0.022, at=(k * 0.033, 0, 0), r2=0.005, color="ink_soft", segs=6)
    cyl(0.0025, 0.03, at=(0, 0, c + 0.05), color="stone", segs=5, lod0=True)
    torus(0.03, 0.004, at=(0, 0.01, c + 0.058), rot=(90, 0, 0), arc=180, color="cloud", segs=8, rsegs=4,
          lod0=True)


@asset("piggy_bank", "Piggy Bank", "Accepts coins. Judges your spending in silence.", L, "ceramic", "small",
       variants=["bubblegum", "lavender", "mint", "butter"], col="box", fill=0.55)
def piggy_bank():
    cz = 0.084
    sphere(0.075, at=(0, 0, cz), scale=(0.88, 1.18, 0.88), color="bubblegum", segs=12, rings=8, tint=True)
    for x in (-0.042, 0.042):
        for y in (-0.048, 0.05):
            cyl(0.017, 0.035, at=(x, y, 0), color="bubblegum", segs=6, tint=True)
    cyl(0.025, 0.022, at=(0, -0.078, cz - 0.004), rot=(90, 0, 0), color="flamingo", segs=12)
    for k in (-1, 1):
        sphere(0.0045, at=(k * 0.008, -0.1, cz - 0.004), scale=(0.7, 0.4, 1.15), color="ink", segs=5, lod0=True)
        extrude([(-0.017, 0), (0.017, 0), (0.0, 0.03)], 0.008, at=(k * 0.04, -0.028, 0.137),
                rot=(70, k * 22, 0), color="flamingo", center=True)
    _eyes((0, -0.074, 0.113), 0.044, 0.0065, far=False, pitch=-10)
    box((0.032, 0.007, 0.006), at=(0, 0.012, cz + 0.065), color="ink")
    tube([(0, 0.085, 0.1), (0, 0.1, 0.106), (0.01, 0.106, 0.116), (0.0, 0.103, 0.124), (-0.007, 0.107, 0.114)],
         0.0045, color="bubblegum", segs=5, tint=True)


@asset("hamster", "Hamster", "Ran four miles last night. Went nowhere. Thrilled.", L, "living", "small",
       variants=["caramel", "sand", "stone"], col="sphere", flags=["creature", "wander", "flee"], fill=0.6)
def hamster():
    sphere(0.031, at=(0, 0.004, 0.03), scale=(1, 1.25, 0.95), color="caramel", segs=12, rings=7, tint=True)
    for k in (-1, 1):
        sphere(0.0135, at=(k * 0.0145, -0.022, 0.024), scale=(1, 0.95, 0.95), color="paper", segs=8, rings=5)
        sphere(0.0085, at=(k * 0.018, -0.004, 0.056), scale=(1, 0.45, 1), color="bubblegum", segs=6)
        sphere(0.005, at=(k * 0.013, -0.026, 0.004), scale=(1, 1.3, 0.6), color="bubblegum", segs=5, lod0=True)
    _eyes((0, -0.031, 0.04), 0.024, 0.0038, far=False)
    sphere(0.003, at=(0, -0.039, 0.031), color="flamingo", segs=5)


@asset("headphones", "Headphones", "Noise cancelling. Mostly cancels parents.", L, "electronic", "small",
       variants=["tomato", "cobalt", "lime", "flamingo"], col="box", fill=0.3)
def headphones():
    torus(0.074, 0.009, at=(0, 0, 0.085), rot=(90, 0, 0), arc=180, color="tomato", segs=12, rsegs=6, tint=True)
    torus(0.068, 0.0075, at=(0, 0, 0.085), rot=(90, -35, 0), arc=110, color="ink_soft", segs=8, rsegs=4, lod0=True)
    for k in (-1, 1):
        cyl(0.006, 0.02, at=(k * 0.074, 0, 0.07), color="stone", segs=6)
        cyl(0.037, 0.028, at=(k * 0.062, 0, 0.042), rot=(0, k * 90, 0), color="tomato", segs=12, bevel=0.006,
            tint=True)
        cyl(0.031, 0.014, at=(k * 0.064, 0, 0.042), rot=(0, -k * 90, 0), color="ink_soft", segs=12)
        cyl(0.018, 0.003, at=(k * 0.089, 0, 0.042), rot=(0, k * 90, 0), color="snow", segs=12, lod0=True)


@asset("toy_train", "Toy Train", "Leaves the station on time. The station is a rug.", L, "wood", "medium",
       variants=["tomato", "cobalt", "leaf"], col="box", fill=0.5)
def toy_train():
    box((0.22, 0.08, 0.026), at=(-0.005, 0, 0.02), base=True, color="ink_soft")
    for x, r in ((-0.075, 0.026), (-0.015, 0.026), (0.06, 0.032)):
        for k in (-1, 1):
            cyl(r, 0.014, at=(x, k * 0.04, r), rot=(k * -90, 0, 0), color="sun", segs=10)
            if k < 0:
                cyl(r * 0.35, 0.002, at=(x, k * 0.054, r), rot=(k * -90, 0, 0), color="ink_soft", segs=6, lod0=True)
    cyl(0.04, 0.13, at=(-0.105, 0, 0.086), rot=(0, 90, 0), color="tomato", segs=12, tint=True)
    cyl(0.043, 0.012, at=(-0.105, 0, 0.086), rot=(0, -90, 0), color="ink_soft", segs=12)
    cyl(0.009, 0.006, at=(-0.117, 0, 0.11), rot=(0, -90, 0), color="butter", segs=8, lod0=True)
    torus(0.0405, 0.003, at=(-0.04, 0, 0.086), rot=(0, 90, 0), color="sun", segs=12, rsegs=3, lod0=True)
    lathe([(0.014, 0.0), (0.014, 0.03), (0.025, 0.052), (0.025, 0.06), (0.0, 0.06)], at=(-0.08, 0, 0.115),
          color="ink_soft", segs=10)
    sphere(0.017, at=(-0.033, 0, 0.122), scale=(1, 1, 0.85), color="sun", segs=8)
    box((0.08, 0.09, 0.09), at=(0.065, 0, 0.046), base=True, color="tomato", tint=True)
    box((0.042, 0.004, 0.036), at=(0.065, -0.045, 0.1), color="sky", lod0=True)
    box((0.096, 0.104, 0.012), at=(0.065, 0, 0.136), base=True, color="ink_soft", bevel=0.003, bseg=1)
    box((0.032, 0.08, 0.034), at=(-0.128, 0, 0.0), base=True, taper=(0.25, 1.0), color="sun")


@asset("sock", "Sock", "Stands up on its own. That's never a good sign.", L, "soft", "small",
       variants=["tomato", "cobalt", "leaf", "grape"], col="box", fill=0.35)
def sock():
    sq = (1, 0.72, 1)
    heel = (0.045, 0, 0.036)
    sphere(0.036, at=heel, scale=sq, color="sun", segs=10, rings=6)
    sphere(0.034, at=(-0.1, 0, 0.033), scale=(1.15, 0.72, 0.97), color="sun", segs=10, rings=6)
    n = 6
    h = 0.165 / n
    for i in range(n):
        cyl(0.036, h, at=(0.045, 0, 0.036 + i * h), scale=sq, color="snow" if i % 2 else "tomato",
            tint=not i % 2, segs=10, caps=False)
    cyl(0.039, 0.024, at=(0.045, 0, 0.198), scale=sq, color="sun", segs=10, bevel=0.004)
    cyl(0.03, 0.002, at=(0.045, 0, 0.221), scale=sq, color="ink_soft", segs=10)
    m = 4
    w = 0.145 / m
    for i in range(m):
        cyl(0.033, w, at=(0.045 - i * w, 0, 0.034), rot=(0, -90, 0), scale=sq, color="tomato" if i % 2 else "snow",
            tint=bool(i % 2), segs=10, caps=False)


@asset("soccer_ball", "Soccer Ball", "Not allowed indoors. Is indoors.", L, "rubber", "small", col="sphere",
       fill=0.52)
def soccer_ball():
    r = 0.11
    sphere(r, at=(0, 0, r), color="snow", segs=16, rings=9)
    phi = (1 + 5 ** 0.5) / 2
    rm = Euler((math.radians(18), 0, math.radians(20)), "XYZ").to_matrix()
    verts = []
    for a in (-1, 1):
        for b in (-1, 1):
            verts += [(0, a, b * phi), (a, b * phi, 0), (b * phi, 0, a)]
    for v in verts:
        n = (rm @ Vector(v)).normalized()
        p = n * (r - 0.004)
        cyl(0.034, 0.014, at=(p.x, p.y, p.z + r), rot=_aim(n), base=False, color="ink", segs=5,
            lod0=n.y > 0.3)


@asset("bunny_slipper", "Bunny Slipper", "Hops nowhere. Keeps toes warm. Fair trade.", L, "soft", "medium",
       variants=["bubblegum", "snow", "lavender", "sky"], col="box", fill=0.4)
def bunny_slipper():
    extrude(ngon_points(16, 1.0, sx=0.052, sy=0.13), 0.018, color="flamingo", center=False)
    extrude(ngon_points(12, 1.0, sx=0.04, sy=0.06), 0.004, at=(0, 0.055, 0.018), color="paper", center=False)
    sphere(0.06, at=(0, -0.052, 0.03), scale=(0.92, 1.3, 0.85), color="bubblegum", segs=12, rings=7, tint=True)
    torus(0.046, 0.011, at=(0, 0.055, 0.026), scale=(1.05, 1.5, 1), color="bubblegum", segs=12, rsegs=5, tint=True)
    _eyes((0, -0.112, 0.068), 0.04, 0.0068, far=False, pitch=-20)
    sphere(0.0075, at=(0, -0.128, 0.052), scale=(1.3, 0.8, 0.9), color="flamingo", segs=8)
    for k in (-1, 1):
        sphere(0.009, at=(k * 0.028, -0.11, 0.045), scale=(1, 0.5, 0.7), color="flamingo", segs=6, lod0=True)
        at = (k * 0.022, -0.05, 0.075)
        rot = (12, k * 16, 0)
        sphere(0.022, at=_rp(at, rot, (0, 0, 0.052)), rot=rot, scale=(0.8, 0.38, 2.5), color="bubblegum", segs=8,
               rings=6, tint=True)
        sphere(0.014, at=_rp(at, rot, (0, -0.0055, 0.056)), rot=rot, scale=(0.8, 0.3, 2.6), color="flamingo",
               segs=6, rings=5)
    sphere(0.017, at=(0, 0.13, 0.035), color="snow", segs=8, lod0=True)


@asset("basketball", "Basketball", "Dribbled indoors exactly once. The lamp remembers.", L, "rubber", "medium",
       col="sphere", fill=0.52)
def basketball():
    r = 0.12
    c = (0, 0, r)
    sphere(r, at=c, color="tangerine", segs=16, rings=9)
    tilt = (-38, 0, 28)
    for n in ((0, 0, 1), (1, 0, 0)):
        torus(r * 1.004, 0.003, at=c, rot=_aim(_rp((0, 0, 0), tilt, n)), color="ink", segs=22, rsegs=4)
    for k in (-1, 1):
        d = 0.075
        torus(math.sqrt(r * r - d * d) * 1.006, 0.003, at=_rp(c, tilt, (0, 0, k * d)),
              rot=_aim(_rp((0, 0, 0), tilt, (0, 0, 1))), color="ink", segs=18, rsegs=4, lod0=True)


# ---------------------------------------------------------------- books, paper

@asset("book", "Book", "Face-down on chapter three. Spine has seen things.", L, "paper", "small",
       variants=["tomato", "cobalt", "leaf", "grape"], col="box", fill=0.35)
def book():
    ang = 32
    half = 0.15
    h = half * math.sin(math.radians(ang))
    for k in (-1, 1):
        rot = (0, k * ang, 0)
        sp = (0, 0, h)
        cen = _rp(sp, rot, (k * half / 2, 0, 0.004))
        box((half, 0.22, 0.006), at=cen, rot=rot, color="tomato", tint=True)
        pcen = _rp(sp, rot, (k * 0.066, 0, -0.008))
        box((0.13, 0.208, 0.018), at=pcen, rot=rot, color="paper")
        if k == 1:
            box((0.07, 0.11, 0.002), at=_rp(sp, rot, (0.085, -0.01, 0.0075)), rot=rot, color="sun")
            box((0.05, 0.012, 0.002), at=_rp(sp, rot, (0.085, -0.03, 0.0085)), rot=rot, color="ink", lod0=True)
            box((0.04, 0.008, 0.002), at=_rp(sp, rot, (0.085, -0.005, 0.0085)), rot=rot, color="ink", lod0=True)
    cyl(0.011, 0.22, at=(0, 0.11, h + 0.001), rot=(90, 0, 0), color="tomato", segs=10, tint=True)
    tube([(0.015, -0.104, h - 0.01), (0.02, -0.118, h - 0.04), (0.03, -0.116, h - 0.07)], 0.0035,
         color="sun", segs=4, lod0=True)


@asset("comic_stack", "Comic Stack", "Required reading. For whom is unclear.", L, "paper", "small", col="box",
       fill=0.6)
def comic_stack():
    rng = random.Random(4)
    cols = ["cobalt", "sun", "tomato", "sky", "grape", "lime", "flamingo", "cobalt"]
    z = 0.0
    t = 0.0065
    for i, c in enumerate(cols):
        ox, oy, rz = rng.uniform(-0.01, 0.01), rng.uniform(-0.01, 0.01), rng.uniform(-9, 9)
        box((0.17, 0.25, t), at=(ox, oy, z), rot=(0, 0, rz), base=True, color=c)
        z += t
    top = (0.004, -0.004, z)
    box((0.17, 0.25, t), at=top, rot=(0, 0, 6), base=True, color="tomato")
    z += t
    extrude(star_points(9, 0.06, 0.038), 0.002, at=(0.01, 0.03, z), rot=(0, 0, 6), color="sun", center=False,
            lod0=True)
    extrude(ngon_points(10, 1.0, sx=0.04, sy=0.025), 0.002, at=(-0.03, -0.075, z), rot=(0, 0, 6), color="snow",
            center=False, lod0=True)
    extrude([(0.0, 0.0), (0.02, 0.0), (-0.004, -0.02)], 0.002, at=(-0.022, -0.09, z), rot=(0, 0, 6), color="snow",
            center=False, lod0=True)


@asset("paper_airplane", "Paper Airplane", "Folded with love. Flies with spite.", L, "paper", "small",
       variants=["snow", "sky", "butter", "lime"], col="box", flags=["float"], fill=0.15)
def paper_airplane():
    yaw = Matrix.Rotation(math.radians(-25), 3, "Z")

    def P(x, y, z):
        v = yaw @ Vector((x, y, z))
        return (v.x, v.y, v.z)

    nose = (-0.125, 0.0, 0.06)
    tail = (0.125, 0.0, 0.065)
    for k in (-1, 1):
        tip = (0.125, k * 0.095, 0.085)
        _slab([P(*nose), P(*tail), P(*tip)] if k > 0 else [P(*nose), P(*tip), P(*tail)], 0.003, "snow", tint=True)
        # coloured stripe along the wing edge
        a = Vector(nose).lerp(Vector(tip), 0.35)
        b = Vector(tip)
        cc = Vector(tail).lerp(Vector(tip), 0.82)
        d = Vector(nose).lerp(Vector(tail), 0.33).lerp(Vector(nose).lerp(Vector(tip), 0.33), 0.82)
        quad = [tuple(v + Vector((0, 0, 0.0025))) for v in (a, b, cc, d)]
        _slab([P(*q) for q in (quad if k > 0 else list(reversed(quad)))], 0.002, "tomato", lod0=False)
    keel = (0.1, 0.0, 0.012)
    _slab([P(*nose), P(*keel), P(*tail)], 0.006, "snow", tint=True)


# ---------------------------------------------------------------- shoes & clothes

@asset("sneaker", "Sneaker", "Only ever found alone. The other is out there.", L, "rubber", "small",
       variants=["tomato", "cobalt", "lime", "grape"], col="box", fill=0.5)
def sneaker():
    nf = 18 if _lod() == 0 else 10
    foot = [(x, y * (1.08 if x < 0 else 0.92)) for (x, y) in ngon_points(nf, 1.0, start=0, sx=0.146, sy=0.052)]
    extrude(foot, 0.026, color="snow", center=False, bevel=0.004)
    extrude([(x * 1.01, y * 1.03) for (x, y) in foot], 0.008, at=(0, 0, 0), color="ink_soft", center=False)
    prof = [(-0.12, 0.026), (-0.135, 0.045), (-0.12, 0.068), (-0.075, 0.08), (-0.025, 0.105), (0.025, 0.13),
            (0.07, 0.137), (0.11, 0.142), (0.138, 0.13), (0.14, 0.026)]
    extrude(prof, 0.088, at=(0, 0, 0), rot=(90, 0, 0), color="tomato", tint=True, bevel=0.008)
    sphere(0.05, at=(-0.095, 0, 0.042), scale=(1.0, 0.94, 0.55), color="snow", segs=12, rings=7)
    sphere(0.042, at=(0.075, -0.0, 0.142), scale=(1.15, 0.85, 0.22), color="ink_soft", segs=10, rings=6)
    box((0.028, 0.012, 0.05), at=(0.141, 0, 0.08), base=False, color="sun", bevel=0.004, bseg=1, lod0=True)
    box((0.07, 0.05, 0.012), at=(-0.03, 0, 0.112), rot=(0, -27, 0), color="tomato", tint=True, bevel=0.004, bseg=1)
    for i in range(4):
        x = -0.064 + 0.024 * i
        z = 0.083 + (x + 0.075) * 0.5 + 0.004
        box((0.011, 0.074, 0.006), at=(x, 0, z), rot=(0, -27, 0), color="snow", lod0=True)
    extrude(ngon_points(10, 0.014), 0.003, at=(0.07, -0.0445, 0.09), rot=(90, 0, 0), color="snow", center=False,
            lod0=True)




# ---------------------------------------------------------------- room toys

@asset("fishbowl", "Fishbowl", "Every lap is a brand new lap. Bliss.", L, "glass", "small", col="cyl", fill=0.6)
def fishbowl():
    far = _lod() > 0
    water = [(0.0, 0.0), (0.075, 0.0), (0.112, 0.022), (0.136, 0.065), (0.142, 0.11), (0.136, 0.155),
             (0.128, 0.172), (0.0, 0.172)]
    lathe([water[i] for i in (0, 1, 3, 5, 6, 7)] if far else water, color="sky", segs=14)
    # glass band above the water: outer wall up, inner wall back down below the waterline
    band = [(0.0, 0.165), (0.131, 0.165), (0.133, 0.172), (0.113, 0.2), (0.088, 0.226), (0.08, 0.226),
            (0.104, 0.2), (0.12, 0.168)]
    lathe([band[i] for i in (0, 1, 4, 5, 7)] if far else band, color="glass", segs=14)
    torus(0.085, 0.007, at=(0, 0, 0.226), color="glass", segs=14, rsegs=4, lod0=True)
    # the fish, nose pressed to the glass on the viewer's side
    a = math.radians(-62)
    fp = (0.138 * math.cos(a), 0.138 * math.sin(a), 0.095)
    yaw = math.degrees(a) + 90
    fr = (0, 0, yaw)
    sphere(0.03, at=fp, rot=fr, scale=(1.35, 0.62, 0.95), color="tangerine", segs=10, rings=6)
    extrude([(0.0, 0.0), (0.03, 0.024), (0.024, 0.0), (0.03, -0.024)], 0.008, at=_rp(fp, fr, (0.036, 0, 0)),
            rot=(90, 0, yaw), color="tangerine")
    extrude([(-0.014, 0.0), (0.014, 0.0), (0.01, 0.018)], 0.006, at=_rp(fp, fr, (0, 0, 0.022)),
            rot=(90, 0, yaw), color="tangerine")
    sphere(0.0058, at=_rp(fp, fr, (-0.022, -0.016, 0.007)), rot=fr, scale=(1, 0.6, 1.15), color="ink", segs=8)
    for i, (dz, r) in enumerate(((0.05, 0.007), (0.08, 0.005))):
        sphere(r, at=(fp[0] - 0.02 - 0.006 * i, fp[1] + 0.02, fp[2] + 0.1 + dz * 0.5), color="snow", segs=5,
               lod0=True)


@asset("toy_robot", "Toy Robot", "Wind it up and it walks into the wall. Again.", L, "metal", "medium",
       variants=["sky", "sun", "lime", "cloud"], col="box", flags=["wander"], fill=0.45)
def toy_robot():
    for k in (-1, 1):
        box((0.05, 0.07, 0.026), at=(k * 0.034, -0.006, 0), base=True, color="ink_soft", bevel=0.006, bseg=1)
        cyl(0.015, 0.05, at=(k * 0.034, 0, 0.024), color="stone", segs=8)
    box((0.12, 0.085, 0.1), at=(0, 0, 0.072), base=True, color="sky", bevel=0.01, bseg=2, tint=True)
    box((0.072, 0.006, 0.05), at=(0, -0.043, 0.112), color="charcoal")
    for i, c in enumerate(("tomato", "sun", "lime")):
        cyl(0.0065, 0.004, at=(-0.022 + 0.022 * i, -0.046, 0.12), rot=(90, 0, 0), color=c, segs=8, lod0=True)
    box((0.04, 0.004, 0.006), at=(0, -0.047, 0.1), color="sun", lod0=True)
    cyl(0.02, 0.012, at=(0, 0, 0.17), color="stone", segs=8)
    box((0.095, 0.078, 0.072), at=(0, 0, 0.18), base=True, color="sky", bevel=0.01, bseg=2, tint=True)
    for k in (-1, 1):
        cyl(0.017, 0.004, at=(k * 0.022, -0.038, 0.222), rot=(90, 0, 0), color="snow", segs=12)
        cyl(0.0075, 0.003, at=(k * 0.022, -0.041, 0.222), rot=(90, 0, 0), color="ink", segs=8)
        cyl(0.014, 0.012, at=(k * 0.047, 0, 0.215), rot=(0, k * 90, 0), color="tomato", segs=8)
        tube([(k * 0.058, 0, 0.155), (k * 0.078, -0.01, 0.13), (k * 0.08, -0.02, 0.1)], 0.011, color="stone",
             segs=6)
        torus(0.014, 0.0055, at=(k * 0.08, -0.024, 0.088), rot=(0, 90, 0), arc=270, color="tomato", segs=8,
              rsegs=4)
    box((0.042, 0.004, 0.012), at=(0, -0.04, 0.195), color="ink_soft")
    cyl(0.003, 0.03, at=(0, 0, 0.252), color="stone", segs=5)
    sphere(0.011, at=(0, 0, 0.285), color="tomato", segs=8)
    cyl(0.004, 0.02, at=(0, 0.042, 0.12), rot=(-90, 0, 0), color="sun", segs=5, lod0=True)
    for k in (-1, 1):
        torus(0.012, 0.004, at=(k * 0.012, 0.066, 0.12), rot=(0, 90, 0), color="sun", segs=8, rsegs=4, lod0=True)


@asset("game_console", "Game Console", "Just one more level. It is now Tuesday.", L, "electronic", "small",
       variants=["tomato", "sky", "lime", "grape"], col="box", fill=0.3)
def game_console():
    box((0.24, 0.17, 0.05), at=(0, 0.05, 0), base=True, color="cloud", bevel=0.008, bseg=1)
    box((0.2, 0.12, 0.004), at=(0, 0.06, 0.05), color="charcoal")
    box((0.11, 0.024, 0.075), at=(0, 0.075, 0.045), base=True, color="tomato", bevel=0.004, bseg=1, tint=True)
    box((0.08, 0.004, 0.04), at=(0, 0.0625, 0.088), color="paper")
    box((0.016, 0.004, 0.01), at=(-0.085, -0.0355, 0.025), color="tomato", lod0=True)
    for x in (0.03, 0.07):
        box((0.022, 0.004, 0.01), at=(x, -0.0355, 0.022), color="charcoal", lod0=True)
    c = (0.02, -0.11, 0.0)
    rz = -12
    box((0.11, 0.055, 0.026), at=c, rot=(0, 0, rz), base=True, color="cloud", bevel=0.009, bseg=2)
    for k in (-1, 1):
        sphere(0.032, at=_rp(c, (0, 0, rz), (k * 0.055, 0.006, 0.014)), rot=(0, 0, rz), scale=(1, 1.1, 0.46),
               color="cloud", segs=10, rings=6)
    pd = _rp(c, (0, 0, rz), (-0.05, 0.0, 0.028))
    box((0.028, 0.009, 0.006), at=pd, rot=(0, 0, rz), color="charcoal")
    box((0.009, 0.028, 0.006), at=pd, rot=(0, 0, rz), color="charcoal")
    for (x, y, col) in ((0.044, 0.007, "tomato"), (0.06, -0.007, "tomato")):
        cyl(0.0065, 0.008, at=_rp(c, (0, 0, rz), (x, y, 0.022)), color=col, segs=8)
    tube([_rp(c, (0, 0, rz), (0, 0.022, 0.01)), (0.0, -0.065, 0.006), (-0.05, -0.06, 0.006), (-0.07, -0.03, 0.02)],
         0.0035, color="ink_soft", segs=4, smooth_path=1)


@asset("trophy", "Trophy", "Participation, gold edition.", L, "metal", "medium", col="cyl", fill=0.35)
def trophy():
    S = 1.2
    box((0.13 * S, 0.13 * S, 0.05 * S), base=True, color="cocoa", bevel=0.004, bseg=1)
    box((0.1 * S, 0.1 * S, 0.025 * S), at=(0, 0, 0.05 * S), base=True, color="cocoa", bevel=0.003, bseg=1)
    box((0.07 * S, 0.004, 0.026 * S), at=(0, -0.066 * S, 0.025 * S), color="butter", lod0=True)
    lathe([(r * S, z * S) for (r, z) in ((0.0, 0.075), (0.035, 0.075), (0.03, 0.085), (0.012, 0.1), (0.01, 0.13),
                                         (0.02, 0.143), (0.0, 0.143))], color="sun", segs=12)
    lathe([(r * S, z * S) for (r, z) in ((0.0, 0.14), (0.03, 0.142), (0.06, 0.16), (0.076, 0.2), (0.081, 0.245),
                                         (0.086, 0.26), (0.08, 0.262), (0.072, 0.254), (0.0, 0.24))],
          color="sun", segs=16)
    for k in (-1, 1):
        torus(0.032 * S, 0.008 * S, at=(k * 0.078 * S, 0, 0.21 * S), rot=(90, 100 if k > 0 else -80, 0), arc=200,
              color="sun", segs=10, rsegs=5)
    extrude(star_points(5, 0.026 * S, 0.012 * S), 0.004, at=(0, -0.071 * S, 0.2 * S), rot=(83, 0, 0),
            color="butter", center=False, lod0=True)


@asset("toy_dinosaur", "Toy Dinosaur", "Rawr. That's it. That's the whole personality.", L, "plastic", "medium",
       variants=["leaf", "grape", "tangerine", "sky"], col="box", fill=0.35)
def toy_dinosaur():
    t = dict(color="leaf", tint=True)
    sphere(0.075, at=(0.02, 0, 0.145), scale=(1.4, 0.82, 0.95), segs=12, rings=8, **t)
    for k in (-1, 1):
        sphere(0.04, at=(0.045, k * 0.045, 0.11), scale=(1.05, 0.7, 1.25), segs=8, rings=6, **t)
        cyl(0.026, 0.08, at=(0.05, k * 0.045, 0.012), segs=8, **t)
        box((0.07, 0.04, 0.022), at=(0.035, k * 0.045, 0.0), base=True, bevel=0.008, bseg=1, **t)
        for j in (-1, 1):
            sphere(0.0065, at=(0.0, k * 0.045 + j * 0.01, 0.008), color="snow", segs=5, lod0=True)
        tube([(-0.05, k * 0.035, 0.155), (-0.075, k * 0.042, 0.135), (-0.08, k * 0.04, 0.118)], 0.011, segs=6, **t)
    tube([(0.11, 0, 0.16), (0.16, 0, 0.14), (0.2, 0, 0.1), (0.23, 0, 0.065)], 0.05, r_end=0.008, segs=8,
         smooth_path=1, **t)
    tube([(-0.04, 0, 0.17), (-0.065, 0, 0.21), (-0.08, 0, 0.245)], 0.04, segs=8, **t)
    head = (-0.1, 0, 0.268)
    sphere(0.052, at=head, scale=(1.35, 0.85, 0.8), segs=10, rings=7, **t)
    box((0.062, 0.07, 0.03), at=(-0.135, 0, 0.243), bevel=0.012, bseg=1, **t)
    box((0.06, 0.068, 0.004), at=(-0.138, 0, 0.255), color="ink", lod0=False)
    for i in range(3):
        for k in (-1, 1):
            cyl(0.005, 0.01, at=(-0.158 + 0.015 * i, k * 0.026, 0.257), rot=(180, 0, 0), r2=0.0004, color="snow",
                segs=4, lod0=True)
    eyes((-0.12, 0, 0.29), 0.075, 0.0085, yaw=-90)
    for i, (x, z, s) in enumerate(((-0.06, 0.225, 0.7), (-0.025, 0.215, 1.0), (0.02, 0.218, 1.15), (0.065, 0.205, 1.0),
                                    (0.11, 0.18, 0.85), (0.15, 0.155, 0.7))):
        extrude([(-0.022 * s, -0.01), (0.022 * s, -0.01), (0.004 * s, 0.035 * s)], 0.012, at=(x, 0, z),
                rot=(90, 0, 0), color="sun")


@asset("teddy_bear", "Teddy Bear", "Has heard every secret. Tells no one.", L, "soft", "medium",
       variants=["caramel", "cocoa", "bubblegum", "stone"], col="box", flags=["squeaky"], fill=0.5)
def teddy_bear():
    t = dict(color="caramel", tint=True)
    sphere(0.1, at=(0, 0.01, 0.11), scale=(1, 0.88, 1.12), segs=10, rings=6, **t)
    sphere(0.066, at=(0, -0.034, 0.1), scale=(1, 0.6, 1.1), color="sand", segs=8, rings=5)
    for k in (-1, 1):
        capsule(0.042, 0.06, at=(k * 0.06, -0.075, 0.042), rot=(90, 0, 0), segs=8, **t)
        cyl(0.031, 0.008, at=(k * 0.06, -0.142, 0.042), rot=(90, 0, 0), color="sand", segs=8)
        d = (k * 0.55, -0.45, -0.7)
        capsule(0.033, 0.07, at=_rp((k * 0.085, -0.01, 0.165), _aim(d), (0, 0, 0.045)), rot=_aim(d), segs=8, **t)
        sphere(0.03, at=(k * 0.068, 0.0, 0.36), scale=(1, 0.55, 1), segs=8, rings=5, **t)
        sphere(0.018, at=(k * 0.068, -0.012, 0.358), scale=(1, 0.4, 1), color="sand", segs=6, rings=4)
    sphere(0.086, at=(0, 0, 0.29), segs=10, rings=7, **t)
    sphere(0.036, at=(0, -0.071, 0.272), scale=(1.18, 0.8, 0.85), color="sand", segs=10, rings=6)
    sphere(0.013, at=(0, -0.1, 0.284), scale=(1.3, 0.8, 0.9), color="ink", segs=6, lod0=True)
    _eyes((0, -0.07, 0.318), 0.062, 0.009, far=False, pitch=-15)
    for k in (-1, 1):
        cyl(0.028, 0.034, at=(0, -0.072, 0.206), rot=(0, k * 90, 0), r2=0.006, color="tomato", segs=4,
            caps=False)
    sphere(0.011, at=(0, -0.078, 0.206), color="tomato", segs=6, lod0=True)


@asset("toy_drum", "Toy Drum", "A gift from a relative who doesn't live here.", L, "wood", "medium",
       variants=["tomato", "cobalt", "leaf", "grape"], col="cyl", fill=0.6)
def toy_drum():
    cyl(0.15, 0.17, at=(0, 0, 0.02), color="tomato", segs=18, tint=True)
    cyl(0.158, 0.026, color="sun", segs=18, bevel=0.005)
    cyl(0.158, 0.026, at=(0, 0, 0.17), color="sun", segs=18, bevel=0.005)
    cyl(0.146, 0.006, at=(0, 0, 0.19), color="snow", segs=18)
    zz = 9 if _lod() == 0 else 6
    pts = []
    for i in range(2 * zz + 1):
        a = math.pi * i / zz
        z = 0.03 if i % 2 == 0 else 0.18
        pts.append((0.153 * math.cos(a), 0.153 * math.sin(a), z))
    tube(pts, 0.0045, color="snow", segs=4, caps=False)
    for (a, b, lift) in (((-0.13, -0.07), (0.1, 0.08), 0.0), ((-0.11, 0.1), (0.13, -0.05), 0.014)):
        p0 = (a[0], a[1], 0.203 + lift)
        p1 = (b[0], b[1], 0.207 + lift)
        tube([p0, p1], 0.0065, color="sand", segs=6)
        sphere(0.014, at=p0, color="cocoa", segs=8)


@asset("laptop", "Laptop", "Forty-two tabs open. Homework is not one of them.", L, "electronic", "medium",
       variants=["cloud", "sky", "bubblegum", "lavender"], col="box", fill=0.3)
def laptop():
    box((0.32, 0.22, 0.016), base=True, color="cloud", bevel=0.004, bseg=1, tint=True)
    box((0.27, 0.1, 0.003), at=(0, 0.025, 0.016), color="ink_soft")
    for r in range(4):
        box((0.26, 0.002, 0.002), at=(0, 0.0 + 0.022 * r - 0.008, 0.018), color="charcoal", lod0=True)
    box((0.09, 0.055, 0.003), at=(0, -0.07, 0.016), color="stone")
    hinge = (0, 0.105, 0.012)
    rot = (-14, 0, 0)
    box((0.32, 0.012, 0.215), at=hinge, rot=rot, base=True, color="cloud", bevel=0.004, bseg=1, tint=True)
    box((0.29, 0.004, 0.18), at=_rp(hinge, rot, (0, -0.006, 0.11)), rot=rot, color="cobalt")
    for (x, z, w, h, c) in ((-0.04, 0.13, 0.16, 0.09, "sky"), (0.085, 0.15, 0.07, 0.05, "sun"),
                            (0.085, 0.085, 0.07, 0.05, "flamingo"), (-0.04, 0.05, 0.16, 0.02, "snow")):
        box((w, 0.003, h), at=_rp(hinge, rot, (x, -0.008, z)), rot=rot, color=c, lod0=True)


@asset("xylophone", "Xylophone", "Plays a rainbow. Sounds like a rainbow falling over.", L, "wood", "medium",
       col="box", fill=0.35)
def xylophone():
    for k in (-1, 1):
        box((0.38, 0.024, 0.03), at=(0, k * 0.062, 0), rot=(0, 0, -k * 5), base=True, color="caramel", bevel=0.005,
            bseg=1)
    for i, c in enumerate(RAINBOW):
        x = -0.155 + i * 0.044
        ln = 0.19 - i * 0.012
        box((0.036, ln, 0.012), at=(x, 0, 0.03), base=True, color=c, bevel=0.003, bseg=1)
    for (p0, p1) in (((-0.08, -0.15, 0.05), (0.1, -0.02, 0.06)), ((0.02, -0.17, 0.05), (0.17, -0.05, 0.065))):
        tube([p0, p1], 0.005, color="sand", segs=5)
        sphere(0.015, at=p0, color="snow", segs=8)


@asset("potted_cactus", "Potted Cactus", "The only plant that forgives you. Barely.", L, "plant", "medium",
       variants=["brick", "sky", "bubblegum"], col="cyl", fill=0.4)
def potted_cactus():
    lathe([(0.0, 0.0), (0.048, 0.0), (0.058, 0.075), (0.068, 0.075), (0.07, 0.1), (0.06, 0.1), (0.06, 0.092),
           (0.0, 0.092)], color="brick", segs=14, tint=True)
    cyl(0.058, 0.004, at=(0, 0, 0.09), color="cocoa", segs=14)
    capsule(0.033, 0.095, at=(0, 0, 0.14), color="leaf", segs=12)
    tube([(0.02, 0, 0.125), (0.055, 0, 0.125), (0.062, 0, 0.145), (0.062, 0, 0.18)], 0.017, color="leaf", segs=8,
         smooth_path=1)
    sphere(0.017, at=(0.062, 0, 0.18), color="leaf", segs=8)
    tube([(-0.02, 0, 0.11), (-0.05, 0, 0.11), (-0.056, 0, 0.125), (-0.056, 0, 0.15)], 0.015, color="leaf", segs=8,
         smooth_path=1)
    sphere(0.015, at=(-0.056, 0, 0.15), color="leaf", segs=8)
    for i in range(5):
        a = 2 * math.pi * i / 5
        sphere(0.011, at=(0.011 * math.cos(a), 0.011 * math.sin(a), 0.232), scale=(1, 1, 0.55), color="flamingo",
               segs=6, rings=4)
    sphere(0.007, at=(0, 0, 0.236), color="sun", segs=6)
    for i in range(8):
        a = 2.4 * i
        z = 0.11 + 0.012 * i
        sphere(0.0028, at=(0.034 * math.cos(a), 0.034 * math.sin(a), z), color="paper", segs=4, lod0=True,
               smooth=False)


@asset("desk_lamp", "Desk Lamp", "Studies late. Mostly studies the ceiling.", L, "metal", "medium",
       variants=["cobalt", "tomato", "teal", "grape"], col="box", fill=0.25)
def desk_lamp():
    cyl(0.08, 0.026, color="cobalt", segs=16, bevel=0.008, tint=True)
    j0, j1, j2 = (0.0, 0.02, 0.036), (0.075, 0.045, 0.255), (-0.055, -0.01, 0.385)
    for j in (j0, j1, j2):
        sphere(0.017, at=j, color="charcoal", segs=8)
    tube([j0, j1], 0.011, color="stone", segs=8)
    tube([j1, j2], 0.011, color="stone", segs=8)
    dl = Vector((-0.5, -0.35, -0.8)).normalized()
    up = -dl
    mouth = Vector(j2) + dl * 0.1
    lathe([(0.0, 0.03), (0.068, 0.004), (0.074, 0.0), (0.066, 0.025), (0.042, 0.07), (0.026, 0.1), (0.0, 0.105)],
          at=tuple(mouth), rot=_aim(up), color="cobalt", segs=14, tint=True)
    sphere(0.03, at=tuple(mouth + up * 0.018), color="butter", segs=10)


@asset("globe", "Globe", "Spin it and point. You live there now.", L, "plastic", "medium", col="cyl", fill=0.45)
def globe():
    cyl(0.085, 0.028, color="cocoa", segs=16, bevel=0.008)
    tilt = 23
    R = 0.13
    m = 0.148
    bot = 247
    cx = -m * math.cos(math.radians(bot))
    c = (cx, 0, 0.11 + m * 0.92)
    cyl(0.012, c[2] + m * math.sin(math.radians(bot)) - 0.02, at=(0, 0, 0.02), color="sun", segs=8)
    sphere(R, at=c, rot=(0, tilt, 0), color="sky", segs=14, rings=9)
    torus(m, 0.0065, at=c, rot=(90, 113, 0), arc=180, color="sun", segs=14, rsegs=5)
    for s in (-1, 1):
        sphere(0.01, at=_rp(c, (0, tilt, 0), (0, 0, s * m)), color="sun", segs=6)
    rm = Euler((0, math.radians(tilt), 0), "XYZ").to_matrix()
    lands = [((-0.3, -0.85, 0.42), 0.05), ((-0.12, -0.9, 0.2), 0.035), ((-0.45, -0.8, 0.55), 0.03),
             ((0.45, -0.78, 0.1), 0.045), ((0.38, -0.82, -0.2), 0.04), ((0.3, -0.75, -0.45), 0.03),
             ((0.85, -0.25, 0.48), 0.05), ((0.7, -0.1, 0.72), 0.03),
             ((-0.8, -0.5, -0.3), 0.045), ((0.6, 0.35, -0.6), 0.05), ((-0.25, 0.6, 0.75), 0.05),
             ((0.05, -0.2, -0.98), 0.04)]
    for i, (d, s) in enumerate(lands):
        n = (rm @ Vector(d)).normalized()
        p = Vector(c) + n * (R - 0.003)
        sphere(s, at=tuple(p), rot=_aim(n), scale=(1.0, 0.8, 0.2), color="leaf", segs=7, rings=4,
               lod0=i in (2, 5, 7, 11))


@asset("board_game", "Board Game", "Ends friendships. Missing two pieces and a die.", L, "paper", "small",
       variants=["cobalt", "grape", "leaf", "tomato"], col="box", fill=0.6)
def board_game():
    box((0.43, 0.29, 0.055), base=True, color="cobalt", bevel=0.004, bseg=1, tint=True)
    box((0.435, 0.295, 0.012), at=(0, 0, 0.012), base=True, color="paper")
    extrude(star_points(5, 0.07, 0.032), 0.003, at=(-0.09, 0.02, 0.055), color="sun", center=False)
    for i in range(7):
        a = 0.9 * i
        r = 0.035 + 0.011 * i
        cyl(0.012, 0.003, at=(0.08 + r * math.cos(a), r * math.sin(a), 0.055), color=RAINBOW[i % 4], segs=8,
            lod0=True)
    for (x, y, c) in ((0.12, -0.08, "tomato"), (0.17, 0.06, "sun")):
        lathe([(0.0, 0.0), (0.026, 0.0), (0.026, 0.008), (0.012, 0.045), (0.0, 0.045)], at=(x, y, 0.055),
              color=c, segs=10)
        sphere(0.018, at=(x, y, 0.112), color=c, segs=8)
    dc = (-0.215, -0.2, 0)
    box((0.042, 0.042, 0.042), at=dc, rot=(0, 0, 25), base=True, color="snow", bevel=0.006, bseg=1)
    sphere(0.005, at=_rp((dc[0], dc[1], 0.021), (0, 0, 25), (0, -0.0212, 0)), rot=(0, 0, 25), scale=(1, 0.3, 1),
           color="ink", segs=6, lod0=True)
    sphere(0.005, at=(dc[0], dc[1], 0.0422), scale=(1, 1, 0.3), color="ink", segs=6, lod0=True)


@asset("trash_can", "Trash Can", "Three-point line is the bed. Success rate: 11%.", L, "plastic", "small",
       variants=["sky", "lime", "flamingo", "grape"], col="cyl", fill=0.5)
def trash_can():
    box((0.24, 0.24, 0.32), base=True, color="sky", taper=(1.25, 1.25), tint=True)
    box((0.31, 0.31, 0.03), at=(0, 0, 0.305), base=True, color="snow", bevel=0.006, bseg=1)
    box((0.27, 0.27, 0.004), at=(0, 0, 0.334), color="ink_soft")
    for (p, r, far) in (((0.04, 0.03, 0.35), 0.055, True), ((-0.06, -0.04, 0.345), 0.05, True),
                        ((0.07, -0.07, 0.34), 0.04, False), ((-0.05, 0.07, 0.34), 0.04, False)):
        ico(r, at=p, color="paper", subdiv=1, rot=(20, 30 + r * 900, 10), scale=(1, 0.95, 0.88), lod0=not far)
    ico(0.042, at=(0.2, -0.14, 0.036), color="paper", subdiv=1, rot=(10, 40, 70))
    for k in range(4):
        x = -0.075 + 0.05 * k
        box((0.02, 0.004, 0.22), at=(x * 1.08, -0.1245, 0.04), rot=(5.4, 0, 0), base=True, color="snow", lod0=True)


@asset("toy_rocket", "Toy Rocket", "Fuelled by imagination and one AA battery.", L, "plastic", "medium",
       variants=["snow", "sun", "mint", "lavender"], col="cyl", fill=0.35)
def toy_rocket():
    lathe([(0.0, 0.05), (0.062, 0.05), (0.076, 0.1), (0.08, 0.2), (0.075, 0.29), (0.066, 0.33), (0.0, 0.33)],
          color="snow", segs=16, tint=True)
    lathe([(0.0, 0.325), (0.067, 0.325), (0.06, 0.37), (0.04, 0.42), (0.016, 0.465), (0.0, 0.48)],
          color="tomato", segs=16)
    lathe([(0.0, 0.02), (0.05, 0.02), (0.036, 0.05), (0.0, 0.055)], color="ink_soft", segs=12)
    for a in (0, 120, 240):
        extrude([(0.05, 0.06), (0.074, 0.17), (0.084, 0.17), (0.138, 0.07), (0.138, 0.0), (0.105, 0.0),
                 (0.07, 0.05)], 0.016, rot=(90, 0, a), color="tomato", bevel=0.003)
    cyl(0.032, 0.012, at=(0, -0.068, 0.235), rot=(90, 0, 0), color="sky", segs=14)
    torus(0.034, 0.0065, at=(0, -0.079, 0.235), rot=(90, 0, 0), color="tomato", segs=14, rsegs=5)
    sphere(0.008, at=(0.012, -0.081, 0.247), color="snow", segs=6, lod0=True)


@asset("backpack", "Backpack", "Contains one banana from last term. Do not open.", L, "soft", "medium",
       variants=["cobalt", "tomato", "leaf", "grape"], col="box", fill=0.65)
def backpack():
    box((0.3, 0.16, 0.4), base=True, color="cobalt", bevel=0.07, bseg=3, tint=True)
    box((0.23, 0.07, 0.17), at=(0, -0.085, 0.035), base=True, color="sun", bevel=0.03, bseg=2)
    box((0.2, 0.004, 0.006), at=(0, -0.121, 0.18), color="ink_soft", lod0=True)
    box((0.012, 0.008, 0.03), at=(0.06, -0.124, 0.165), color="ink_soft")
    torus(0.04, 0.009, at=(0, 0, 0.395), rot=(90, 0, 0), arc=180, color="ink_soft", segs=10, rsegs=5)
    for k in (-1, 1):
        tube([(k * 0.08, 0.07, 0.36), (k * 0.09, 0.115, 0.3), (k * 0.095, 0.12, 0.15), (k * 0.09, 0.08, 0.06)],
             0.016, color="ink_soft", segs=6, smooth_path=1)
    extrude(star_points(5, 0.022, 0.01), 0.004, at=(-0.07, -0.12, 0.1), rot=(90, 0, 0), color="snow", center=False)


# ---------------------------------------------------------------- soft furnishings & creatures

@asset("pillow", "Pillow", "Professionally fluffed. Fights back at sleepovers.", L, "soft", "medium",
       variants=["sky", "bubblegum", "lavender", "mint"], col="box", fill=0.6)
def pillow():
    # flopped on the floor: pinched corners, big puff
    c = (0, 0, 0.09)
    rot = (0, 0, 8)
    box((0.58, 0.4, 0.04), at=c, rot=rot, color="sky", bevel=0.018, bseg=2, tint=True)
    sphere(0.25, at=c, rot=rot, scale=(1.08, 0.72, 0.46), color="sky", segs=16, rings=9, tint=True)
    sphere(0.026, at=_rp(c, rot, (0, 0, 0.113)), rot=rot, scale=(1, 1, 0.4), color="snow", segs=10, rings=5)
    box((0.07, 0.045, 0.006), at=_rp(c, rot, (0.24, -0.215, 0)), rot=rot, color="snow", lod0=True)


@asset("cat", "Cat", "Knocked something off this desk. Feels nothing.", L, "living", "medium",
       variants=["tangerine", "charcoal", "cocoa", "stone"], col="box", flags=["creature", "wander", "flee"],
       fill=0.35)
def cat():
    t = dict(color="tangerine", tint=True)
    capsule(0.066, 0.15, at=(0, 0.035, 0.15), rot=(90, 0, 0), segs=12, **t)
    for x in (-0.038, 0.038):
        for y in (-0.06, 0.12):
            cyl(0.021, 0.13, at=(x, y, 0.01), segs=8, **t)
            sphere(0.025, at=(x, y - 0.006, 0.013), scale=(1, 1.25, 0.55), color="paper", segs=6, rings=4)
    sphere(0.045, at=(0, -0.075, 0.13), scale=(0.9, 0.7, 1.0), color="paper", segs=10)
    head = (0, -0.125, 0.245)
    sphere(0.072, at=head, scale=(1.12, 0.95, 0.92), segs=12, rings=7, **t)
    sphere(0.03, at=(0, -0.188, 0.222), scale=(1.35, 0.7, 0.8), color="paper", segs=10)
    sphere(0.008, at=(0, -0.206, 0.235), scale=(1.3, 0.8, 0.9), color="bubblegum", segs=6)
    for k in (-1, 1):
        ear = (k * 0.046, -0.12, 0.282)
        er = (90, k * 20, 0)
        extrude([(-0.038, 0.0), (0.038, 0.0), (0.006 * k, 0.1)], 0.022, at=ear, rot=er, bevel=0.003, **t)
        extrude([(-0.022, 0.012), (0.022, 0.012), (0.0045 * k, 0.07)], 0.004, at=_rp(ear, er, (0, 0, 0.012)),
                rot=er, color="bubblegum", center=False)
        for dz in (-0.006, 0.006):
            box((0.05, 0.002, 0.002), at=(k * 0.05, -0.2, 0.224 + dz), rot=(0, k * dz * 25, 0), color="ink",
                lod0=True)
    _eyes((0, -0.188, 0.262), 0.058, 0.011, far=False)
    tube([(0, 0.17, 0.17), (0, 0.235, 0.2), (0, 0.255, 0.29), (0.02, 0.22, 0.37), (0.055, 0.19, 0.39),
          (0.07, 0.205, 0.36)], 0.021, r_end=0.016, segs=8, smooth_path=1, **t)
    sphere(0.017, at=(0.07, 0.205, 0.36), segs=6, **t)


@asset("stool", "Stool", "Short, round, and always being stood on.", L, "wood", "small",
       variants=["sun", "tomato", "sky", "lime"], col="cyl", fill=0.3)
def stool():
    cyl(0.17, 0.045, at=(0, 0, 0.405), color="sun", segs=16, bevel=0.012, tint=True)
    for i in range(4):
        a = math.radians(45 + 90 * i)
        b = (0.16 * math.cos(a), 0.16 * math.sin(a), 0)
        t = (0.11 * math.cos(a), 0.11 * math.sin(a), 0.41)
        d = Vector(t) - Vector(b)
        cyl(0.019, d.length, at=b, rot=_aim(d), color="caramel", segs=8, r2=0.016)
    torus(0.137, 0.009, at=(0, 0, 0.15), color="caramel", segs=16, rsegs=5)


# ---------------------------------------------------------------- sports & outdoor-ish

@asset("tennis_racket", "Tennis Racket", "Mostly used as an air guitar.", L, "plastic", "medium",
       variants=["tomato", "cobalt", "lime", "grape"], col="box", fill=0.15)
def tennis_racket():
    hc = (0, 0, 0.51)
    rx, rz = 0.115, 0.155
    torus(rx, 0.012, at=hc, rot=(90, 0, 0), scale=(1, rz / rx, 1), color="tomato", segs=20, rsegs=6, tint=True)
    if _lod() == 0:
        for i in range(-3, 4):
            x = i * 0.03
            h = 2 * rz * math.sqrt(max(0.0, 1 - (x / rx) ** 2))
            box((0.0025, 0.003, h), at=(x, 0, hc[2]), color="snow")
        for i in range(-4, 5):
            z = i * 0.032
            w = 2 * rx * math.sqrt(max(0.0, 1 - (z / rz) ** 2))
            box((w, 0.003, 0.0025), at=(0, 0, hc[2] + z), color="snow")
    for k in (-1, 1):
        tube([(k * 0.055, 0, 0.375), (k * 0.02, 0, 0.3), (0, 0, 0.26)], 0.01, color="tomato", segs=6, tint=True)
    cyl(0.017, 0.24, at=(0, 0, 0.03), color="ink_soft", segs=8)
    cyl(0.021, 0.03, color="tomato", segs=8, bevel=0.005, tint=True)
    sphere(0.033, at=(0.09, -0.04, 0.033), color="lime", segs=12)
    torus(0.033, 0.002, at=(0.09, -0.04, 0.033), rot=(70, 0, 30), color="snow", segs=12, rsegs=3, lod0=True)


@asset("skateboard", "Skateboard", "Ollies: zero. Bruises: several. Spirit: unbroken.", L, "wood", "medium",
       variants=["tomato", "sky", "lime", "grape"], col="box", fill=0.25)
def skateboard():
    z = 0.088
    extrude(rounded_rect_points(0.56, 0.21, 0.01), 0.016, at=(0, 0, z), color="tomato", center=False, tint=True)
    k_ = 6 if _lod() == 0 else 3
    tail = [(0.0, -0.105), (0.03, -0.105)]
    for i in range(1, k_):
        a = -math.pi / 2 + math.pi * i / k_
        tail.append((0.03 + 0.105 * math.cos(a), 0.105 * math.sin(a)))
    tail += [(0.03, 0.105), (0.0, 0.105)]
    for k in (-1, 1):
        pts = [(k * x, y) for (x, y) in tail]
        if k < 0:
            pts.reverse()
        extrude(pts, 0.016, at=(k * 0.279, 0, z + 0.0005), rot=(0, -k * 18, 0), color="tomato", center=False,
                tint=True)
    extrude([(-0.06, 0.03), (0.01, 0.03), (-0.01, 0.005), (0.06, 0.005), (-0.02, -0.04), (0.0, -0.01),
             (-0.06, -0.01)], 0.002, at=(0, 0, z + 0.016), rot=(0, 0, 90), color="sun", center=False)
    for x in (-0.2, 0.2):
        box((0.06, 0.05, 0.012), at=(x, 0, z), rot=(180, 0, 0), base=True, color="stone")
        box((0.035, 0.17, 0.022), at=(x, 0, 0.055), base=True, color="stone", bevel=0.005, bseg=1)
        for k in (-1, 1):
            cyl(0.03, 0.03, at=(x, k * 0.075, 0.03), rot=(k * -90, 0, 0), color="sun", segs=12, bevel=0.006)


@asset("kite", "Kite", "Waiting for wind. Indoors. Optimistic.", L, "paper", "medium",
       variants=["tomato", "cobalt", "grape", "leaf"], col="box", flags=["float"], fill=0.15)
def kite():
    rm = Matrix.Rotation(math.radians(-14), 3, "Y")

    def P(x, z, y=0.0):
        v = rm @ Vector((x, y, z))
        return (v.x, v.y, v.z)

    top, right, bot, left = (0, 0.9), (0.23, 0.66), (0, 0.32), (-0.23, 0.66)
    mid = (0, 0.66)
    quads = [(top, right, "tomato", True), (right, bot, "sun", False), (bot, left, "tomato", True),
             (left, top, "sun", False)]
    for a, b, c, ti in quads:
        _slab([P(*mid), P(*b), P(*a)], 0.005, c, tint=ti)
    tube([P(top[0], top[1], -0.006), P(bot[0], bot[1], -0.006)], 0.006, color="cocoa", segs=5)
    tube([P(left[0], left[1], -0.008), P(right[0], right[1], -0.008)], 0.006, color="cocoa", segs=5)
    tail = [P(0, 0.32), P(0.05, 0.25), P(-0.03, 0.16), P(0.04, 0.08), P(-0.01, 0.0)]
    tube(tail, 0.0035, color="ink_soft", segs=4, smooth_path=1)
    for i, (x, z) in enumerate(((0.035, 0.235), (-0.01, 0.15), (0.03, 0.065))):
        col = "sun" if i % 2 else "tomato"
        for k in (-1, 1):
            _slab([P(x, z, -0.001), P(x + k * 0.04, z + 0.022), P(x + k * 0.04, z - 0.022)][::k], 0.004, col,
                  tint=col == "tomato")


@asset("umbrella", "Umbrella", "Opened indoors. The bad luck can find somebody else.", L, "soft", "medium",
       variants=["tomato", "cobalt", "grape", "leaf"], col="cyl", flags=["float"], fill=0.3)
def umbrella():
    n_g = 8
    K, M = (4, 3) if _lod() == 0 else (2, 1)
    prof = [(0.0, 0.8), (0.14, 0.785), (0.27, 0.745), (0.37, 0.685), (0.45, 0.6)]
    if K == 2:
        prof = [prof[0], prof[2], prof[4]]
    for g in range(n_g):
        a0, a1 = 2 * math.pi * g / n_g, 2 * math.pi * (g + 1) / n_g
        verts, faces = [], []
        grid = []
        for k, (rr, zz) in enumerate(prof):
            row = []
            for m in range(M + 1):
                u = m / M
                a = a0 + (a1 - a0) * u
                sag = math.sin(math.pi * u)
                r2 = rr * (1 - 0.04 * sag)
                z2 = zz - 0.012 * sag * (k / K) + (0.035 * sag if k == K else 0)
                if k == K:
                    r2 = rr * (1 - 0.07 * sag)
                if k == 0:
                    row.append(len(verts))
                    verts.append((0, 0, zz))
                    break
                row.append(len(verts))
                verts.append((r2 * math.cos(a), r2 * math.sin(a), z2))
            grid.append(row)
        for k in range(K):
            r0, r1 = grid[k], grid[k + 1]
            for m in range(M):
                if len(r0) == 1:
                    faces.append([r0[0], r1[m], r1[m + 1]])
                else:
                    faces.append([r0[m], r1[m], r1[m + 1], r0[m + 1]])
        nv = len(verts)
        verts += [(x, y, z - 0.006) for (x, y, z) in verts]
        faces += [list(reversed([i + nv for i in f])) for f in faces]
        col = "tomato" if g % 2 == 0 else "snow"
        _mesh(verts, faces, col, tint=col == "tomato", smooth=True)
        tip = (0.45 * math.cos(a0), 0.45 * math.sin(a0), 0.6)
        sphere(0.009, at=tip, color="ink_soft", segs=6, lod0=True)
    cyl(0.009, 0.06, at=(0, 0, 0.795), r2=0.003, color="ink_soft", segs=6)
    cyl(0.008, 0.74, at=(0, 0, 0.06), color="ink_soft", segs=6)
    torus(0.035, 0.012, at=(0.035, 0, 0.06), rot=(90, 180, 0), arc=180, color="cocoa", segs=10, rsegs=6)
    sphere(0.0125, at=(0.07, 0, 0.06), color="cocoa", segs=8)


# ---------------------------------------------------------------- furniture

@asset("desk_chair", "Desk Chair", "Spins at least forty times per homework.", L, "plastic", "large",
       variants=["cobalt", "tomato", "teal", "grape"], col="box", fill=0.3)
def desk_chair():
    for i in range(5):
        a = 90 + 72 * i
        r = math.radians(a)
        box((0.27, 0.042, 0.03), at=(0.13 * math.cos(r), 0.13 * math.sin(r), 0.045), rot=(0, 6, a),
            color="charcoal", bevel=0.008, bseg=1)
        sphere(0.026, at=(0.27 * math.cos(r), 0.27 * math.sin(r), 0.026), color="ink_soft", segs=8, rings=5)
    cyl(0.05, 0.05, at=(0, 0, 0.03), color="charcoal", segs=10)
    cyl(0.024, 0.32, at=(0, 0, 0.07), color="stone", segs=8)
    box((0.18, 0.18, 0.04), at=(0, 0, 0.38), base=True, color="charcoal")
    box((0.47, 0.44, 0.08), at=(0, 0, 0.41), base=True, color="cobalt", bevel=0.03, bseg=2, tint=True)
    box((0.06, 0.03, 0.18), at=(0, 0.2, 0.44), base=True, color="charcoal")
    box((0.43, 0.075, 0.36), at=(0, 0.215, 0.56), rot=(-8, 0, 0), base=True, color="cobalt", bevel=0.035,
        bseg=2, tint=True)
    for k in (-1, 1):
        box((0.03, 0.03, 0.14), at=(k * 0.215, 0.02, 0.47), base=True, color="charcoal")
        box((0.055, 0.22, 0.03), at=(k * 0.215, 0.0, 0.61), base=True, color="charcoal", bevel=0.01, bseg=1)


@asset("beanbag", "Beanbag", "Takes the shape of whoever gave up last.", L, "soft", "large",
       variants=["tomato", "grape", "teal", "sun"], col="cyl", fill=0.6)
def beanbag():
    # squashy body with a dished seat, slumped backrest behind it
    lathe([(0.0, 0.0), (0.3, 0.0), (0.41, 0.05), (0.45, 0.15), (0.43, 0.25), (0.37, 0.32), (0.28, 0.34),
           (0.15, 0.3), (0.0, 0.27)], scale=(1, 0.95, 1), color="tomato", segs=18, tint=True)
    sphere(0.26, at=(0, 0.2, 0.36), scale=(1.45, 0.72, 0.95), color="tomato", segs=16, rings=9, tint=True)
    torus(0.03, 0.008, at=(0, 0.25, 0.6), rot=(70, 0, 0), arc=180, color="ink_soft", segs=8, rsegs=4)
    box((0.06, 0.004, 0.04), at=(0.2, -0.392, 0.1), rot=(0, 0, 25), color="paper", lod0=True)


@asset("guitar", "Guitar", "Knows three chords. Plays them with feeling.", L, "wood", "medium",
       variants=["caramel", "tomato", "cobalt", "ink_soft"], col="box", fill=0.25)
def guitar():
    circles = [((0.0, 0.2), 0.185), ((0.0, 0.43), 0.135)]
    o = Vector((0.0, 0.32))
    n = 36 if _lod() == 0 else 18
    outline = []
    for i in range(n):
        a = 2 * math.pi * i / n
        d = Vector((math.cos(a), math.sin(a)))
        best = 0.0
        for (cx, cy), r in circles:
            f = o - Vector((cx, cy))
            b = f.dot(d)
            disc = b * b - (f.dot(f) - r * r)
            if disc >= 0:
                best = max(best, -b + math.sqrt(disc))
        p = o + d * best
        outline.append((p.x, p.y))
    extrude(outline, 0.09, rot=(90, 0, 0), color="caramel", tint=True)
    extrude([(x * 0.965, 0.32 + (y - 0.32) * 0.97) for (x, y) in outline], 0.004, at=(0, -0.045, 0),
            rot=(90, 0, 0), color="sand", center=False)
    cyl(0.045, 0.004, at=(0, -0.048, 0.4), rot=(90, 0, 0), color="ink", segs=14)
    torus(0.05, 0.004, at=(0, -0.05, 0.4), rot=(90, 0, 0), color="cocoa", segs=14, rsegs=4, lod0=True)
    box((0.08, 0.012, 0.018), at=(0, -0.052, 0.15), color="cocoa")
    box((0.052, 0.03, 0.42), at=(0, -0.018, 0.5), base=True, color="cocoa")
    box((0.046, 0.006, 0.4), at=(0, -0.036, 0.52), base=True, color="ink_soft")
    hs = (0, -0.018, 0.915)
    box((0.07, 0.024, 0.12), at=hs, rot=(12, 0, 0), base=True, color="cocoa", bevel=0.008, bseg=1)
    for i in range(3):
        for k in (-1, 1):
            cyl(0.0055, 0.016, at=_rp(hs, (12, 0, 0), (k * 0.035, 0, 0.03 + 0.03 * i)), rot=(0, k * 90, 0),
                color="stone", segs=6, lod0=True)
    for i in range(4):
        x = -0.012 + 0.008 * i
        box((0.0018, 0.002, 0.77), at=(x, -0.05, 0.15), base=True, color="snow", lod0=True)


@asset("desk", "Desk", "Homework happens here. In theory.", L, "wood", "large",
       variants=["sky", "mint", "bubblegum", "sun"], col="box", fill=0.35)
def desk():
    box((1.2, 0.6, 0.04), at=(0, 0, 0.72), base=True, color="caramel", bevel=0.01, bseg=1)
    box((0.4, 0.56, 0.72), at=(0.37, 0, 0), base=True, color="sand")
    for i in range(3):
        z = 0.045 + i * 0.225
        box((0.36, 0.02, 0.2), at=(0.37, -0.285, z), base=True, color="sky", bevel=0.006, bseg=1, tint=True)
        sphere(0.02, at=(0.37, -0.3, z + 0.1), scale=(1, 0.8, 1), color="cocoa", segs=8)
    for y in (-0.26, 0.26):
        box((0.055, 0.055, 0.72), at=(-0.555, y, 0), base=True, color="sand")
    box((0.74, 0.02, 0.36), at=(-0.18, 0.27, 0.36), base=True, color="sand")


@asset("dresser", "Dresser", "Sock drawer is a portal. Nobody comes back.", L, "wood", "large",
       variants=["sky", "bubblegum", "mint", "lavender"], col="box", fill=0.8)
def dresser():
    box((1.0, 0.48, 0.84), at=(0, 0, 0.07), base=True, color="snow", bevel=0.01, bseg=1)
    box((1.07, 0.52, 0.035), at=(0, 0, 0.91), base=True, color="caramel", bevel=0.008, bseg=1)
    for x in (-0.46, 0.46):
        for y in (-0.2, 0.2):
            cyl(0.035, 0.07, at=(x, y, 0), r2=0.045, color="caramel", segs=8)
    rows = [(0.66, [(-0.245, 0.45), (0.245, 0.45)]), (0.385, [(0, 0.94)]), (0.11, [(0, 0.94)])]
    for z, drawers in rows:
        for (x, w) in drawers:
            box((w, 0.02, 0.24), at=(x, -0.245, z), base=True, color="sky", bevel=0.008, bseg=1, tint=True)
            for kx in ((0,) if w < 0.5 else (-0.24, 0.24)):
                sphere(0.024, at=(x + kx, -0.26, z + 0.12), scale=(1, 0.75, 1), color="sun", segs=8)


@asset("floor_lamp", "Floor Lamp", "Tall, bright, and terrible at hide and seek.", L, "metal", "medium",
       variants=["sky", "bubblegum", "mint", "lavender"], col="cyl", fill=0.15)
def floor_lamp():
    cyl(0.16, 0.035, color="charcoal", segs=16, bevel=0.01)
    cyl(0.04, 0.03, at=(0, 0, 0.03), r2=0.02, color="charcoal", segs=10)
    cyl(0.014, 1.29, at=(0, 0, 0.05), color="stone", segs=8)
    sphere(0.022, at=(0, 0, 0.75), color="charcoal", segs=8)
    lathe([(0.0, 1.36), (0.205, 1.285), (0.22, 1.27), (0.15, 1.6), (0.0, 1.6)], color="sky", segs=18, tint=True)
    torus(0.22, 0.012, at=(0, 0, 1.272), color="ink_soft", segs=18, rsegs=4)
    torus(0.151, 0.01, at=(0, 0, 1.598), color="ink_soft", segs=18, rsegs=4)
    tube([(0.06, -0.05, 1.32), (0.06, -0.05, 1.17)], 0.002, color="stone", segs=4, lod0=True)
    sphere(0.008, at=(0.06, -0.05, 1.165), color="sun", segs=6, lod0=True)


@asset("bookshelf", "Bookshelf", "Alphabetised once, in a moment of weakness.", L, "wood", "large", col="box",
       fill=0.7)
def bookshelf():
    W, D, H = 0.8, 0.3, 1.8
    for k in (-1, 1):
        box((0.03, D, H), at=(k * (W / 2 - 0.015), 0, 0), base=True, color="caramel")
    box((W + 0.02, D + 0.02, 0.03), at=(0, 0, H - 0.03), base=True, color="caramel", bevel=0.006, bseg=1)
    box((W - 0.06, D, 0.08), base=True, color="caramel")
    box((W - 0.06, 0.012, H - 0.03), at=(0, D / 2 - 0.006, 0), base=True, color="cocoa")
    shelves = [0.08, 0.5, 0.92, 1.34]
    for z in shelves[1:]:
        box((W - 0.06, D - 0.01, 0.025), at=(0, 0, z), base=True, color="caramel")
    rng = random.Random(11)
    cols = ["tomato", "cobalt", "sun", "leaf", "grape", "sky", "tangerine", "flamingo", "paper", "pine"]
    inner = W / 2 - 0.03
    for si, z0 in enumerate(shelves):
        z0 = z0 + (0.0 if si == 0 else 0.025)
        x = -inner + 0.005
        lean_at = rng.randint(4, 7) if si != 2 else None
        n = 0
        if si == 2:
            for j in range(4):
                box((0.24 - j * 0.015, 0.2, 0.035), at=(-inner + 0.13, -0.02, z0 + 0.035 * j), rot=(0, 0, rng.uniform(-6, 6)),
                    base=True, color=cols[(j * 3 + 1) % len(cols)])
            x = -inner + 0.27
        while True:
            w = rng.uniform(0.034, 0.064) if _lod() == 0 else rng.uniform(0.06, 0.1)
            h = rng.uniform(0.22, 0.32)
            if x + w > inner - 0.01:
                break
            c = cols[rng.randrange(len(cols))]
            if lean_at is not None and n == lean_at:
                box((w, 0.2, h), at=(x + 0.06, -0.02, z0), rot=(0, 22, 0), base=True, color=c)
                x += 0.13
            else:
                box((w, 0.2, h), at=(x + w / 2, -0.02, z0), base=True, color=c)
                if w > 0.042:
                    box((w + 0.002, 0.004, 0.02), at=(x + w / 2, -0.12, z0 + h * 0.75), color="paper", lod0=True)
                x += w + 0.003
            n += 1
    cyl(0.05, 0.08, at=(inner - 0.08, -0.03, 1.365), r2=0.06, color="brick", segs=10)
    sphere(0.07, at=(inner - 0.08, -0.03, 1.48), scale=(1, 1, 0.75), color="leaf", segs=10)


@asset("bed", "Bed", "Monster-free zone. Officially. Probably.", L, "soft", "large",
       variants=["sky", "grape", "leaf", "tomato"], col="box", fill=0.55)
def bed():
    box((0.06, 1.0, 0.75), at=(-0.97, 0, 0), base=True, color="caramel", bevel=0.01, bseg=1)
    cyl(0.5, 0.06, at=(-1.0, 0, 0.72), rot=(0, 90, 0), scale=(0.45, 1, 1), color="caramel", segs=20)
    box((0.06, 1.0, 0.52), at=(0.97, 0, 0), base=True, color="caramel", bevel=0.01, bseg=1)
    sphere(0.035, at=(0.97, -0.47, 0.54), color="cocoa", segs=8)
    sphere(0.035, at=(0.97, 0.47, 0.54), color="cocoa", segs=8)
    for y in (-0.47, 0.47):
        box((1.88, 0.045, 0.16), at=(0, y, 0.12), base=True, color="caramel")
    box((1.86, 0.9, 0.18), at=(0, 0, 0.26), base=True, color="snow", bevel=0.03, bseg=1)
    box((1.42, 1.0, 0.27), at=(0.25, 0, 0.18), base=True, color="sky", bevel=0.04, bseg=2, tint=True)
    box((0.16, 1.01, 0.275), at=(-0.46, 0, 0.18), base=True, color="snow", bevel=0.035, bseg=2)
    for x in (0.0, 0.42, 0.84):
        box((0.09, 1.012, 0.272), at=(x, 0, 0.18), base=True, color="sun", bevel=0.03, bseg=1)
    pc = (-0.74, 0, 0.5)
    box((0.3, 0.62, 0.1), at=pc, rot=(0, -10, 0), color="snow", bevel=0.04, bseg=2)
    sphere(0.2, at=pc, rot=(0, -10, 0), scale=(0.75, 1.45, 0.3), color="snow", segs=14, rings=8)
