"""Level 5 — Small Town (farms, high street, harbour). Objects face -Y; base at z = 0; metres.

Vehicles and boats run along X with their nose at +X (towards the thumbnail camera).
Most of these are seen far away at LOD1: big silhouettes stay, windows and trims are lod0.
"""
import math

from mathutils import Matrix, Vector

from lib.core import STATE, box, cyl, sphere, ico, torus, lathe, extrude, tube, capsule
from lib.registry import asset

L = 5


# ---------------------------------------------------------------- local helpers

def _lod1():
    return STATE.lod > 0


def _dot_eyes(at, spacing, r, yaw=0.0, color="ink", segs=6):
    """Cheap dot eyes (same recipe as level 3)."""
    a = math.radians(yaw)
    side = (math.cos(a), math.sin(a))
    face = (math.sin(a), -math.cos(a))
    for k in (-1, 1):
        x = at[0] + side[0] * k * spacing / 2
        y = at[1] + side[1] * k * spacing / 2
        sphere(r, at=(x, y, at[2]), color=color, segs=segs, rings=4, scale=(1, 0.6, 1.2), rot=(0, 0, yaw))
        sphere(r * 0.38, at=(x + face[0] * r * 0.5 - side[0] * r * 0.3, y + face[1] * r * 0.5 - side[1] * r * 0.3,
                             at[2] + r * 0.45), color="snow", segs=4, rings=3, lod0=True)


def _poly3d(pts, thick, color, tint=False, lod0=False):
    """Flat convex polygon through 3D points (in order), given a thickness. Used for striped panels."""
    P = [Vector(p) for p in pts]
    p0 = P[0]
    ex = (P[1] - p0).normalized()
    n = (P[1] - p0).cross(P[2] - p0).normalized()
    ey = n.cross(ex)
    m = Matrix((ex, ey, n)).transposed()
    rot = tuple(math.degrees(a) for a in m.to_euler("XYZ"))
    loc = [((p - p0).dot(ex), (p - p0).dot(ey)) for p in P]
    extrude(loc, thick, at=tuple(p0), rot=rot, color=color, tint=tint, lod0=lod0)


def _stripes(r0, z0, r1, z1, n, colors, tints=(True, False), thick=0.12, start=0.0, lod0=False):
    """Ring of n flat panels from radius r0 at z0 to r1 at z1, alternating colours (cone / drum / roof)."""
    for i in range(n):
        a0 = math.radians(start + 360.0 * i / n)
        a1 = math.radians(start + 360.0 * (i + 1) / n)
        pts = [(r0 * math.cos(a0), r0 * math.sin(a0), z0), (r0 * math.cos(a1), r0 * math.sin(a1), z0)]
        if r1 > 1e-3:
            pts += [(r1 * math.cos(a1), r1 * math.sin(a1), z1), (r1 * math.cos(a0), r1 * math.sin(a0), z1)]
        else:
            pts += [(0.0, 0.0, z1)]
        _poly3d(pts, thick, colors[i % len(colors)], tint=tints[i % len(tints)], lod0=lod0)


def _wheel(at, r, w, tyre="ink_soft", hub="cloud", segs=14, hub_r=None, hub_segs=8):
    """Chunky toy wheel with its axle along Y (seen side-on from the front/side)."""
    cyl(r, w, at=at, rot=(90, 0, 0), base=False, color=tyre, segs=segs)
    cyl(hub_r or r * 0.48, w * 1.1, at=at, rot=(90, 0, 0), base=False, color=hub, segs=hub_segs)


def _win(x, y, z, w, h, face="-y", color="glass", d=0.14, lod0=True, sill=None):
    """Flat window box on a wall. face '-y' = front wall (w along X), '+x'/'-x' = side walls (w along Y)."""
    if face in ("-y", "+y"):
        box((w, d, h), at=(x, y, z), base=True, color=color, lod0=lod0)
        if sill:
            box((w * 1.15, d * 2.2, h * 0.09), at=(x, y, z - h * 0.06), base=True, color=sill, lod0=True)
    else:
        box((d, w, h), at=(x, y, z), base=True, color=color, lod0=lod0)
        if sill:
            box((d * 2.2, w * 1.15, h * 0.09), at=(x, y, z - h * 0.06), base=True, color=sill, lod0=True)


def _flag(at, h, w, color, pole="ink_soft", pr=0.08, yaw=0.0):
    """Pole with a triangular pennant flying towards +X (turned by yaw)."""
    cyl(pr, h, at=at, color=pole, segs=6)
    a = math.radians(yaw)
    top = at[2] + h
    p0 = (at[0], at[1], top)
    p1 = (at[0], at[1], top - w * 0.6)
    p2 = (at[0] + w * math.cos(a), at[1] + w * math.sin(a), top - w * 0.3)
    _poly3d([p0, p1, p2], max(0.04, w * 0.04), color)


def _gambrel_offset(pts, t):
    """Mitred outward offset of an open polyline (x, z) — for roof slabs."""
    out = []
    for i, p in enumerate(pts):
        ns = []
        for a, b in ((pts[i - 1], p) if i > 0 else (None, None), (p, pts[i + 1]) if i < len(pts) - 1 else (None, None)):
            if a is None:
                continue
            dx, dz = b[0] - a[0], b[1] - a[1]
            ln = math.hypot(dx, dz)
            ns.append((-dz / ln, dx / ln))
        nx = sum(n[0] for n in ns)
        nz = sum(n[1] for n in ns)
        ln = math.hypot(nx, nz)
        nx, nz = nx / ln, nz / ln
        cosh = max(0.3, nx * ns[0][0] + nz * ns[0][1])
        out.append((p[0] + nx * t / cosh, p[1] + nz * t / cosh))
    return out


# ---------------------------------------------------------------- farm animals

@asset("sheep", "Sheep", "Ninety percent wool, ten percent mild panic.", L, "living", "medium",
       variants=["snow", "cloud", "paper", "lavender"], col="box", flags=["creature", "wander", "flee"], fill=0.55)
def sheep():
    for x in (-0.17, 0.17):
        for y in (-0.24, 0.26):
            cyl(0.055, 0.42, at=(x, y, 0), color="ink_soft", segs=6)
    sphere(0.36, at=(0, 0.04, 0.66), scale=(1.0, 1.35, 0.82), color="snow", tint=True, segs=12, rings=7)
    puffs = [(-0.3, -0.22, 0.62, 0.2), (0.3, -0.22, 0.62, 0.2), (-0.3, 0.22, 0.6, 0.21), (0.3, 0.22, 0.6, 0.21),
             (0, -0.28, 0.9, 0.2), (0, 0.15, 0.94, 0.22), (-0.2, -0.02, 0.88, 0.2), (0.2, -0.02, 0.88, 0.2),
             (0, 0.48, 0.72, 0.2), (-0.16, -0.42, 0.7, 0.16), (0.16, -0.42, 0.7, 0.16), (0, 0.38, 0.48, 0.18)]
    for i, (x, y, z, r) in enumerate(puffs):
        sphere(r, at=(x, y, z), color="snow", tint=True, segs=8, rings=5, lod0=i >= 7)
    # dark face, ears, wool fringe
    sphere(0.17, at=(0, -0.5, 0.8), scale=(0.88, 1.12, 1.08), rot=(20, 0, 0), color="ink_soft", segs=10, rings=6)
    for k in (-1, 1):
        sphere(0.1, at=(k * 0.19, -0.44, 0.86), scale=(1.5, 0.5, 0.62), rot=(0, k * -25, 0), color="ink_soft",
               segs=6, rings=4)
    sphere(0.12, at=(0, -0.47, 0.96), scale=(1.15, 1, 0.75), color="snow", tint=True, segs=8, rings=5)
    for k in (-1, 1):
        sphere(0.045, at=(k * 0.07, -0.66, 0.84), scale=(1, 0.6, 1.15), color="snow", segs=6, rings=4)
        sphere(0.025, at=(k * 0.068, -0.69, 0.83), scale=(1, 0.6, 1.15), color="ink", segs=6, rings=3)


@asset("cow", "Cow", "Chews thoughtfully. Has never had a single thought.", L, "living", "medium",
       variants=["ink", "cocoa", "caramel"], col="box", flags=["creature", "wander"], fill=0.5)
def cow():
    for x in (-0.27, 0.27):
        for y in (-0.6, 0.62):
            cyl(0.11, 0.78, at=(x, y, 0.1), color="snow", segs=8)
            cyl(0.125, 0.14, at=(x, y, 0), color="ink_soft", segs=8)
    box((0.86, 1.7, 0.78), at=(0, 0.05, 0.66), base=True, bevel=0.24, bseg=2, color="snow")
    for (x, y, z, sx, sy, sz, r) in ((0.43, -0.25, 1.1, 0.22, 1.0, 0.75, 0.3), (0.43, 0.48, 0.88, 0.2, 0.9, 0.8, 0.24),
                                     (-0.43, 0.1, 1.0, 0.22, 1.1, 0.85, 0.32), (0.0, 0.35, 1.44, 1.0, 0.9, 0.18, 0.3),
                                     (-0.43, -0.5, 0.82, 0.2, 0.7, 0.6, 0.18)):
        sphere(r, at=(x, y, z), scale=(sx, sy, sz), color="ink", tint=True, segs=8, rings=5)
    sphere(0.15, at=(0, 0.5, 0.64), scale=(1.2, 1, 0.7), color="bubblegum", segs=8, rings=4, lod0=True)
    # head
    box((0.52, 0.56, 0.52), at=(0, -0.92, 0.84), base=True, bevel=0.14, color="snow")
    sphere(0.22, at=(0, -1.17, 0.92), scale=(1.2, 0.75, 0.78), color="bubblegum", segs=10, rings=6)
    for k in (-1, 1):
        sphere(0.035, at=(k * 0.09, -1.33, 0.95), scale=(1, 0.5, 1.2), color="ink", segs=5, rings=3, lod0=True)
        sphere(0.11, at=(k * 0.34, -0.86, 1.24), scale=(1.5, 0.45, 0.65), rot=(0, k * -15, 0), color="snow",
               segs=6, rings=4)
        cyl(0.055, 0.22, at=(k * 0.2, -0.9, 1.32), rot=(0, k * 45, 0), r2=0.015, color="sand", segs=6)
    sphere(0.13, at=(0.12, -1.0, 1.28), scale=(1.1, 0.6, 0.55), color="ink", tint=True, segs=6, rings=4, lod0=True)
    _dot_eyes((0, -1.2, 1.17), 0.26, 0.045, segs=8)
    # bell + tail
    torus(0.26, 0.035, at=(0, -0.72, 0.9), rot=(70, 0, 0), color="tomato", segs=10, rsegs=4, lod0=True)
    cyl(0.07, 0.11, at=(0, -0.86, 0.62), r2=0.04, color="sun", segs=8)
    tube([(0, 0.88, 1.3), (0.04, 0.96, 1.1), (0.06, 0.97, 0.8)], 0.035, color="snow", segs=5)
    sphere(0.07, at=(0.06, 0.97, 0.76), scale=(1, 1, 1.4), color="ink", tint=True, segs=6, rings=4)


@asset("horse", "Horse", "Neighs at its own reflection. Every single time.", L, "living", "medium",
       variants=["caramel", "cocoa", "snow", "stone", "sand"], col="box", flags=["creature", "wander"], fill=0.4)
def horse():
    for x in (-0.2, 0.2):
        for y in (-0.52, 0.55):
            cyl(0.085, 1.02, at=(x, y, 0.12), r2=0.1, color="caramel", tint=True, segs=7)
            cyl(0.11, 0.16, at=(x, y, 0), color="ink_soft", segs=7)
            cyl(0.1, 0.14, at=(x, y, 0.13), color="snow", segs=7, lod0=True)
    capsule(0.37, 0.95, at=(0, 0.04, 1.32), rot=(90, 0, 0), color="caramel", tint=True, segs=12)
    # saddle blanket
    box((0.86, 0.6, 0.16), at=(0, 0.02, 1.58), base=True, bevel=0.06, color="tomato")
    # neck + head
    tube([(0, -0.5, 1.4), (0, -0.78, 1.86), (0, -0.88, 2.08)], 0.25, r_end=0.17, color="caramel", tint=True, segs=8)
    box((0.3, 0.72, 0.34), at=(0, -1.12, 1.98), rot=(38, 0, 0), bevel=0.1, color="caramel", tint=True)
    box((0.06, 0.4, 0.12), at=(0, -1.27, 1.98), rot=(38, 0, 0), color="snow", lod0=True)
    for k in (-1, 1):
        sphere(0.025, at=(k * 0.07, -1.42, 1.75), color="ink", segs=5, rings=3, lod0=True)
        cyl(0.06, 0.2, at=(k * 0.09, -0.86, 2.2), rot=(-10, k * 12, 0), r2=0.01, color="caramel", tint=True, segs=5)
    _dot_eyes((0, -1.14, 2.16), 0.36, 0.045, segs=8)
    # mane + forelock + tail
    tube([(0, -0.38, 1.66), (0, -0.62, 1.98), (0, -0.82, 2.25)], 0.1, r_end=0.075, color="ink_soft", segs=6)
    sphere(0.1, at=(0, -0.96, 2.22), scale=(1, 1.3, 0.7), color="ink_soft", segs=6, rings=4)
    tube([(0, 0.82, 1.48), (0, 1.08, 1.32), (0, 1.16, 0.95), (0, 1.12, 0.7)], 0.11, r_end=0.07, color="ink_soft",
         segs=6, smooth_path=1)


@asset("hay_bale", "Round Hay Bale", "A giant shredded wheat nobody is brave enough to eat.", L, "plant", "small",
       col="box", fill=0.75)
def hay_bale():
    cyl(0.8, 1.2, at=(0, 0, 0.8), rot=(0, 90, 0), base=False, color="sand", segs=16)
    for k in (-1, 1):
        cyl(0.5, 0.04, at=(k * 0.6, 0, 0.8), rot=(0, 90, 0), base=False, color="butter", segs=12)
        torus(0.5, 0.045, at=(k * 0.61, 0, 0.8), rot=(0, 90, 0), color="caramel", segs=12, rsegs=3, lod0=True)
        torus(0.24, 0.04, at=(k * 0.63, 0, 0.8), rot=(0, 90, 0), color="caramel", segs=10, rsegs=3, lod0=True)
    for x in (-0.3, 0.3):
        cyl(0.815, 0.06, at=(x, 0, 0.8), rot=(0, 90, 0), base=False, color="caramel", segs=16, lod0=True)
    for (x, a) in ((-0.1, 70), (0.15, 100), (0.4, 80)):
        box((0.04, 0.03, 0.22), at=(x, 0, 1.55), rot=(0, a - 90, a), color="butter", lod0=True)


# ---------------------------------------------------------------- vehicles

@asset("tractor", "Tractor", "Top speed: brisk walk. Top confidence: unlimited.", L, "metal", "medium",
       variants=["tomato", "leaf", "sky", "sun"], col="box", fill=0.45)
def tractor():
    # big back wheels with tread lugs, small front wheels
    for y in (-0.82, 0.82):
        _wheel((-0.85, y, 0.85), 0.85, 0.5, hub="sun", segs=16, hub_r=0.42)
        _wheel((1.3, y * 0.85, 0.45), 0.45, 0.3, hub="sun", segs=12, hub_r=0.2)
        for i in range(12):
            a = 2 * math.pi * i / 12
            box((0.2, 0.46, 0.12), at=(-0.85 + 0.86 * math.cos(a), y, 0.85 + 0.86 * math.sin(a)),
                rot=(0, 90 - math.degrees(a), 0), color="ink_soft", lod0=True)
        torus(0.95, 0.09, at=(-0.85, y, 0.85), rot=(90, 0, 0), arc=180, scale=(1, 1, 3.2), color="tomato",
              tint=True, segs=10, rsegs=4)
    # chassis + hood
    box((2.0, 0.9, 0.8), at=(0.7, 0, 0.62), base=True, bevel=0.1, color="tomato", tint=True)
    box((0.12, 0.74, 0.6), at=(1.72, 0, 0.7), base=True, color="charcoal")
    for z in (0.82, 0.98, 1.14):
        box((0.05, 0.7, 0.05), at=(1.79, 0, z), color="stone", lod0=True)
    for k in (-1, 1):
        sphere(0.08, at=(1.72, k * 0.3, 1.32), scale=(0.6, 1, 1), color="sun", segs=6, rings=4, lod0=True)
    box((1.4, 1.2, 0.42), at=(-0.75, 0, 0.9), base=True, bevel=0.05, color="tomato", tint=True)
    # exhaust
    cyl(0.07, 1.25, at=(1.25, 0.22, 1.35), color="charcoal", segs=8)
    cyl(0.09, 0.08, at=(1.25, 0.22, 2.58), color="charcoal", segs=8)
    # cab: glass block, corner posts, roof
    box((1.1, 1.06, 1.15), at=(-0.75, 0, 1.32), base=True, color="glass")
    for x in (-1.3, -0.2):
        for y in (-0.53, 0.53):
            box((0.1, 0.1, 1.2), at=(x, y, 1.32), base=True, color="tomato", tint=True)
    box((1.45, 1.35, 0.14), at=(-0.75, 0, 2.5), base=True, bevel=0.05, color="snow")
    cyl(0.16, 0.04, at=(-0.35, -0.05, 1.7), rot=(0, -60, 0), color="ink_soft", segs=8, lod0=True)
    box((0.3, 0.4, 0.3), at=(-0.95, 0, 1.32), base=True, color="ink_soft", lod0=True)


@asset("city_bus", "City Bus", "Stops everywhere except exactly where you are standing.", L, "metal", "large",
       variants=["tomato", "cobalt", "leaf", "teal", "grape"], col="box", fill=0.85)
def city_bus():
    Lb, W, H = 11.8, 2.55, 3.0
    for x in (-3.7, 3.4):
        for y in (-1.2, 1.2):
            _wheel((x, y, 0.52), 0.52, 0.34, hub="cloud", segs=14)
    box((Lb, W, H - 0.35), at=(0, 0, 0.35), base=True, bevel=0.22, color="tomato", tint=True)
    box((Lb - 0.4, W + 0.04, 0.32), at=(0, 0, 0.32), base=True, color="charcoal")
    box((Lb - 2.0, W + 0.06, 1.05), at=(-0.5, 0, 1.68), base=True, color="glass")
    box((Lb - 0.6, W + 0.05, 0.16), at=(-0.1, 0, 1.45), base=True, color="snow")
    box((0.12, W - 0.3, 1.25), at=(Lb / 2 - 0.02, 0, 1.45), base=True, color="glass")
    box((0.12, W - 0.5, 0.3), at=(Lb / 2 - 0.02, 0, 2.75), base=True, color="sun")
    box((3.0, 1.6, 0.35), at=(-1.5, 0, H), base=True, bevel=0.08, color="snow")
    for x in (-0.5, 3.0):
        box((1.15, 0.1, 2.1), at=(x, -W / 2 - 0.01, 0.4), base=True, color="ink_soft", lod0=True)
        box((0.05, 0.12, 1.8), at=(x, -W / 2 - 0.02, 0.5), base=True, color="glass", lod0=True)
    for i in range(6):
        box((0.1, W + 0.08, 1.05), at=(-5.0 + i * 1.6, 0, 1.68), base=True, color="tomato", tint=True, lod0=True)
    for k in (-1, 1):
        sphere(0.14, at=(Lb / 2 + 0.05, k * 0.85, 0.85), scale=(0.5, 1, 1), color="sun", segs=8, rings=4, lod0=True)
        box((0.25, 0.08, 0.35), at=(Lb / 2 - 0.1, k * (W / 2 + 0.12), 2.2), color="ink_soft", lod0=True)


@asset("fire_truck", "Fire Engine", "Huge ladder, louder siren, rescues one cat a week.", L, "metal", "large",
       variants=["tomato", "sun"], col="box", fill=0.7)
def fire_truck():
    for x in (3.0, -1.8, -3.2):
        for y in (-1.15, 1.15):
            _wheel((x, y, 0.56), 0.56, 0.36, hub="cloud", segs=14)
    # cab
    box((2.3, 2.5, 2.4), at=(3.55, 0, 0.55), base=True, bevel=0.2, color="tomato", tint=True)
    box((0.12, 2.2, 0.95), at=(4.68, 0, 1.75), base=True, color="glass")
    for y in (-1.26, 1.26):
        box((1.1, 0.08, 0.85), at=(3.85, y, 1.8), base=True, color="glass")
    box((1.2, 1.6, 0.25), at=(3.6, 0, 2.95), base=True, color="cloud")
    for y in (-0.45, 0.45):
        sphere(0.22, at=(3.6, y, 3.2), scale=(1, 1, 0.8), color="sky", segs=8, rings=4)
    box((0.3, 2.6, 0.35), at=(4.75, 0, 0.45), base=True, bevel=0.06, color="cloud")
    for y in (-0.9, 0.9):
        sphere(0.14, at=(4.72, y, 1.15), scale=(0.5, 1, 1), color="sun", segs=8, rings=4, lod0=True)
    # body
    box((7.0, 2.5, 2.0), at=(-0.95, 0, 0.55), base=True, bevel=0.1, color="tomato", tint=True)
    box((7.05, 2.56, 0.22), at=(-0.95, 0, 1.0), base=True, color="snow")
    for i in range(5):
        box((0.06, 2.58, 1.3), at=(-4.0 + 1.4 * i + 0.7, 0, 0.75), base=True, color="charcoal", lod0=True)
    # turntable + ladder (rails + rungs)
    cyl(0.9, 0.4, at=(-3.3, 0, 2.55), color="cloud", segs=12)
    lx0, lx1, lz0, lz1 = -3.9, 4.7, 3.05, 3.6
    ang = math.degrees(math.atan2(lz1 - lz0, lx1 - lx0))
    ln = math.hypot(lx1 - lx0, lz1 - lz0)
    for y in (-0.5, 0.5):
        box((ln, 0.14, 0.22), at=((lx0 + lx1) / 2, y, (lz0 + lz1) / 2), rot=(0, -ang, 0), color="cloud")
    n = 14 if not _lod1() else 5
    for i in range(n):
        t = (i + 0.5) / n
        box((0.08, 1.0, 0.08), at=(lx0 + (lx1 - lx0) * t, 0, lz0 + (lz1 - lz0) * t), color="cloud")
    box((0.8, 0.8, 0.7), at=(-3.3, 0, 2.6), base=True, color="tomato", tint=True)
    cyl(0.45, 0.3, at=(-2.4, -1.3, 1.6), rot=(90, 0, 0), base=False, color="charcoal", segs=10, lod0=True)
    cyl(0.32, 0.32, at=(-2.4, -1.3, 1.6), rot=(90, 0, 0), base=False, color="snow", segs=10, lod0=True)


@asset("locomotive", "Steam Locomotive", "Choo-choo is technically its full legal name.", L, "metal", "large",
       variants=["pine", "navy", "tomato", "grape"], col="box", fill=0.6)
def locomotive():
    box((15.0, 2.6, 0.55), at=(-0.2, 0, 0.75), base=True, color="charcoal")
    # driving wheels + leading wheels
    for y in (-1.25, 1.25):
        for x in (-0.4, 1.6, 3.6):
            _wheel((x, y, 0.95), 0.95, 0.24, tyre="tomato", hub="sun", segs=14, hub_r=0.3)
        for x in (5.6, 6.7):
            _wheel((x, y, 0.5), 0.5, 0.22, tyre="tomato", hub="sun", segs=10, hub_r=0.18)
        for x in ((-6.2, -4.6) if not _lod1() else ()):
            _wheel((x, y, 0.5), 0.5, 0.22, tyre="tomato", hub="sun", segs=10, hub_r=0.18)
        box((4.4, 0.08, 0.16), at=(1.6, y * 1.12, 0.75), color="stone")
    # boiler, smokebox, chimney, domes
    cyl(1.2, 7.4, at=(3.3, 0, 2.55), rot=(0, 90, 0), base=False, color="pine", tint=True, segs=16)
    for x in (1.0, 3.0, 5.0):
        cyl(1.23, 0.14, at=(x, 0, 2.55), rot=(0, 90, 0), base=False, color="sun", segs=16, lod0=True)
    cyl(1.28, 1.2, at=(7.3, 0, 2.55), rot=(0, 90, 0), base=False, color="ink_soft", segs=16)
    cyl(0.85, 0.1, at=(7.95, 0, 2.55), rot=(0, 90, 0), base=False, color="charcoal", segs=12, lod0=True)
    cyl(0.25, 0.3, at=(7.95, 0, 3.55), rot=(0, 90, 0), base=False, color="sun", segs=10)
    cyl(0.42, 1.6, at=(6.9, 0, 3.4), r2=0.62, color="ink_soft", segs=12)
    cyl(0.68, 0.18, at=(6.9, 0, 5.0), color="ink_soft", segs=12)
    sphere(0.55, at=(3.6, 0, 3.75), scale=(1, 1, 0.9), color="sun", segs=12, rings=6)
    sphere(0.4, at=(1.6, 0, 3.7), scale=(1, 1, 0.8), color="pine", tint=True, segs=10, rings=5)
    # cab + bunker
    box((3.0, 2.8, 2.9), at=(-2.4, 0, 1.3), base=True, bevel=0.06, color="pine", tint=True)
    box((3.5, 3.1, 0.25), at=(-2.4, 0, 4.2), base=True, bevel=0.08, color="ink_soft")
    for y in (-1.41, 1.41):
        box((1.2, 0.1, 1.0), at=(-2.4, y, 2.75), base=True, color="glass")
    for y in (-0.7, 0.7):
        cyl(0.32, 0.1, at=(-0.88, y, 3.4), rot=(0, 90, 0), base=False, color="glass", segs=10, lod0=True)
    box((3.2, 2.6, 1.8), at=(-5.5, 0, 1.3), base=True, bevel=0.06, color="pine", tint=True)
    ico(0.95, at=(-5.5, 0, 3.0), scale=(1.4, 1.1, 0.5), color="ink", lod0=True)
    # cowcatcher + buffer beam
    extrude([(7.6, 0.25), (8.75, 0.25), (7.6, 1.35)], 2.4, rot=(90, 0, 0), color="tomato")
    box((0.3, 2.8, 0.55), at=(7.8, 0, 1.3), base=True, color="tomato")
    # a friendly puff of steam
    for (x, z, r) in ((6.9, 5.8, 0.75), (6.1, 6.4, 0.6), (5.2, 6.7, 0.45)):
        sphere(r, at=(x, 0, z), color="snow", segs=8, rings=5, lod0=r < 0.7)



@asset("train_carriage", "Train Carriage", "The quiet carriage. Someone is still eating crisps.", L, "metal",
       "large", variants=["cobalt", "tomato", "teal", "pine", "grape"], col="box", fill=0.8)
def train_carriage():
    Lc, W = 15.4, 2.8
    for x in (-5.4, 5.4):
        box((2.8, 2.2, 0.5), at=(x, 0, 0.45), base=True, color="charcoal")
        for dx in (-0.8, 0.8):
            for y in (-1.15, 1.15):
                _wheel((x + dx, y, 0.45), 0.45, 0.2, tyre="ink_soft", hub="stone", segs=10, hub_segs=6)
    box((Lc, W, 2.7), at=(0, 0, 0.95), base=True, bevel=0.15, color="cobalt", tint=True)
    box((Lc - 0.1, W + 0.04, 0.2), at=(0, 0, 1.75), base=True, color="snow")
    box((Lc - 0.1, W - 0.2, 0.55), at=(0, 0, 3.65), base=True, taper=(1.0, 0.62), color="cloud")
    for k in (-1, 1):
        box((0.5, 1.8, 2.3), at=(k * (Lc / 2 + 0.2), 0, 1.1), base=True, color="ink_soft")
    nw = 7
    for y in (-W / 2, W / 2):
        for i in range(nw):
            x = -5.4 + i * 1.8
            box((1.2, 0.12, 0.85), at=(x, y, 2.1), base=True, color="glass", lod0=True)
        for x in (-Lc / 2 + 0.65, Lc / 2 - 0.65):
            box((0.8, 0.12, 2.0), at=(x, y, 1.05), base=True, color="ink_soft", lod0=True)


# ---------------------------------------------------------------- boats

def _hull_outline(Lh, B, bow=0.42, stern=0.78):
    """Top view of a hull: flat-ish stern at -X, pointed bow at +X."""
    x0, x1 = -Lh / 2, Lh / 2
    return [(x0, -B / 2 * stern), (x0 + Lh * 0.3, -B / 2), (x1 - Lh * 0.3, -B / 2 * 0.95), (x1 - Lh * 0.1, -B / 2 * bow),
            (x1, 0.0), (x1 - Lh * 0.1, B / 2 * bow), (x1 - Lh * 0.3, B / 2 * 0.95), (x0 + Lh * 0.3, B / 2),
            (x0, B / 2 * stern)]


def _scaled(pts, sx, sy, dx=0.0):
    return [(x * sx + dx, y * sy) for (x, y) in pts]


@asset("sailboat", "Sailboat", "Powered entirely by wind and mild showing off.", L, "wood", "large",
       variants=["navy", "tomato", "teal", "cobalt"], col="box", fill=0.25)
def sailboat():
    hull = _hull_outline(8.4, 2.7)
    extrude(_scaled(hull, 0.84, 0.5), 0.55, at=(0, 0, 0.0), color="navy", tint=True, center=False)
    extrude(hull, 1.05, at=(0, 0, 0.5), color="navy", tint=True, center=False)
    extrude(_scaled(hull, 1.01, 1.03), 0.2, at=(0, 0, 1.2), color="snow", center=False)
    extrude(_scaled(hull, 0.95, 0.88), 0.08, at=(0, 0, 1.52), color="sand", center=False)
    box((2.6, 1.6, 0.6), at=(-1.2, 0, 1.55), base=True, bevel=0.12, color="snow")
    for x in (-2.0, -1.2, -0.4):
        cyl(0.13, 0.04, at=(x, -0.8, 1.85), rot=(90, 0, 0), base=False, color="glass", segs=8, lod0=True)
    # mast, boom, sails
    cyl(0.1, 8.2, at=(0.6, 0, 1.55), color="sand", segs=8)
    cyl(0.08, 3.9, at=(-1.3, 0, 2.3), rot=(0, 90, 0), base=False, color="sand", segs=6)
    extrude([(0.45, 2.42), (0.45, 9.5), (-3.25, 2.42)], 0.1, at=(0, 0.02, 0), rot=(90, 0, 0), color="snow")
    extrude([(0.82, 2.0), (0.82, 8.9), (4.15, 1.75)], 0.1, at=(0, 0.02, 0), rot=(90, 0, 0), color="snow")
    box((0.08, 0.12, 6.9), at=(0.9, 0, 2.0), base=True, color="snow", lod0=True)
    tube([(0.65, 0, 9.7), (4.2, 0, 1.6)], 0.025, color="ink_soft", segs=4, lod0=True)
    extrude([(0.68, 9.75), (0.68, 9.35), (1.7, 9.55)], 0.06, rot=(90, 0, 0), color="tomato")
    for x in (-0.6, 0.3, 1.2):
        sphere(0.12, at=(x, -1.38, 1.0), color="tangerine", segs=6, rings=4, lod0=True)


@asset("fishing_boat", "Fishing Boat", "Smells of the sea and a sandwich from last Tuesday.", L, "metal", "large",
       variants=["cobalt", "teal", "tomato", "leaf"], col="box", fill=0.45)
def fishing_boat():
    hull = _hull_outline(11.0, 3.9, bow=0.5, stern=0.85)
    extrude(_scaled(hull, 0.9, 0.7), 0.6, at=(0, 0, 0.0), color="tomato", center=False)
    extrude(hull, 1.85, at=(0, 0, 0.55), color="cobalt", tint=True, center=False)
    extrude(_scaled(hull, 1.01, 1.02), 0.24, at=(0, 0, 2.3), color="snow", center=False)
    # raised bow deck
    extrude([(2.8, -1.55), (4.6, -0.9), (5.6, 0.0), (4.6, 0.9), (2.8, 1.55)], 0.7, at=(0, 0, 2.3),
            color="cobalt", tint=True, center=False)
    extrude([(2.7, -1.6), (4.65, -0.93), (5.68, 0.0), (4.65, 0.93), (2.7, 1.6)], 0.18, at=(0, 0, 3.0),
            color="snow", center=False)
    # wheelhouse
    box((2.8, 2.5, 2.3), at=(0.9, 0, 2.4), base=True, bevel=0.08, color="snow")
    box((0.12, 2.1, 0.85), at=(2.3, 0, 3.5), base=True, color="glass")
    for y in (-1.26, 1.26):
        box((1.9, 0.12, 0.85), at=(0.8, y, 3.5), base=True, color="glass")
    box((3.3, 2.9, 0.22), at=(1.0, 0, 4.7), base=True, bevel=0.06, color="tomato")
    torus(0.42, 0.11, at=(-0.1, -1.32, 3.0), rot=(90, 0, 0), color="tangerine", segs=12, rsegs=4, lod0=True)
    # stack
    cyl(0.32, 1.4, at=(-0.9, 0.4, 3.6), color="ink_soft", segs=10)
    cyl(0.34, 0.3, at=(-0.9, 0.4, 4.6), color="tomato", segs=10, lod0=True)
    # mast + outriggers + crane
    cyl(0.12, 5.6, at=(1.1, 0, 4.9), color="ink_soft", segs=8)
    sphere(0.18, at=(1.1, 0, 10.55), color="sun", segs=6, rings=4, lod0=True)
    for k in (-1, 1):
        tube([(1.1, 0, 5.6), (1.1, k * 3.8, 8.6)], 0.08, color="ink_soft", segs=5)
        tube([(1.1, 0, 10.2), (1.1, k * 3.8, 8.6)], 0.03, color="ink_soft", segs=4, lod0=True)
        sphere(0.2, at=(1.1, k * 3.8, 8.6), color="tangerine", segs=6, rings=4)
    tube([(-4.3, -1.2, 2.55), (-4.6, 0, 5.4), (-4.3, 1.2, 2.55)], 0.11, color="sun", segs=6)
    tube([(-4.6, 0, 5.4), (-5.5, 0, 4.8), (-5.6, 0, 3.4)], 0.05, color="ink_soft", segs=4, lod0=True)
    ico(0.8, at=(-3.2, 0.2, 2.75), scale=(1.4, 1.0, 0.5), color="leaf")
    for x in (-3.4, -2.0, 3.0):
        sphere(0.22, at=(x, -1.75, 1.9), color="tangerine", segs=6, rings=4, lod0=True)


# ---------------------------------------------------------------- farm buildings

@asset("red_barn", "Red Barn", "Smells of hay. Contains one very important chicken.", L, "wood", "large",
       variants=["tomato", "brick", "sky", "sun"], col="box", fill=0.85)
def red_barn():
    W, H, D = 10.0, 5.2, 13.0
    top = [(-W / 2, H), (-W / 2 * 0.74, H + 3.0), (0.0, H + 4.6), (W / 2 * 0.74, H + 3.0), (W / 2, H)]
    prof = [(-W / 2, 0.0), (W / 2, 0.0)] + list(reversed(top))
    extrude(prof, D, rot=(90, 0, 0), color="tomato", tint=True)
    # roof slabs with mitred overhang
    eave = [(-W / 2 - 0.5, H - 0.6)] + top[1:-1] + [(W / 2 + 0.5, H - 0.6)]
    eave[0] = (top[0][0] - 0.45, top[0][1] - 0.55)
    eave[-1] = (top[-1][0] + 0.45, top[-1][1] - 0.55)
    outer = _gambrel_offset(eave, 0.42)
    for i in range(len(eave) - 1):
        extrude([eave[i], eave[i + 1], outer[i + 1], outer[i]], D + 0.9, rot=(90, 0, 0), color="charcoal")
    # front: big doors with white X bracing, hay loft
    fy = -D / 2 - 0.08
    box((4.6, 0.16, 4.3), at=(0, fy, 0), base=True, color="tomato", tint=True)
    for (w, h, x, z) in ((4.8, 0.3, 0, 4.25), (0.3, 4.4, -2.3, 0), (0.3, 4.4, 2.3, 0), (0.3, 4.3, 0, 0)):
        box((w, 0.24, h), at=(x, fy - 0.04, z), base=True, color="snow")
    xa = math.degrees(math.atan2(4.0, 2.1))
    for x in (-1.15, 1.15):
        for s in (-1, 1):
            box((0.24, 0.2, 4.4), at=(x, fy - 0.05, 2.15), rot=(0, s * (90 - xa), 0), color="snow")
    box((2.0, 0.16, 1.9), at=(0, fy, 5.9), base=True, color="ink_soft")
    for (w, h, x, z) in ((2.3, 0.22, 0, 5.75), (2.3, 0.22, 0, 7.75), (0.22, 2.2, -1.05, 5.8), (0.22, 2.2, 1.05, 5.8)):
        box((w, 0.24, h), at=(x, fy - 0.04, z), base=True, color="snow")
    box((0.6, 1.4, 0.18), at=(0, fy - 0.6, 8.3), base=True, color="cocoa", lod0=True)
    # side windows
    for y in (-3.5, 0.5, 4.0):
        _win(W / 2 + 0.02, y, 2.2, 1.3, 1.3, face="+x", color="snow")
        _win(W / 2 + 0.06, y, 2.4, 0.9, 0.9, face="+x", color="ink_soft")
    # cupola + weathervane
    box((1.6, 1.6, 1.3), at=(0, 1.0, H + 4.1), base=True, color="snow")
    box((2.1, 2.1, 1.2), at=(0, 1.0, H + 5.4), base=True, taper=(0.04, 0.04), color="charcoal")
    tube([(0, 1.0, H + 6.5), (0, 1.0, H + 7.4)], 0.05, color="ink_soft", segs=4, lod0=True)
    extrude([(-0.4, 0.0), (0.3, 0.0), (0.45, 0.35), (0.25, 0.55), (0.0, 0.3), (-0.4, 0.5)], 0.06,
            at=(0, 1.0, H + 7.3), rot=(90, 0, 0), color="ink_soft", lod0=True)


@asset("grain_silo", "Grain Silo", "A cereal box for giants. Mostly full of cereal.", L, "metal", "large",
       variants=["cloud", "navy", "tomato", "teal"], col="cyl", fill=0.7)
def grain_silo():
    cyl(3.3, 0.6, color="stone", segs=16)
    cyl(3.0, 13.0, at=(0, 0, 0.5), color="cloud", tint=True, segs=16)
    for z in (2.6, 5.2, 7.8, 10.4):
        cyl(3.06, 0.3, at=(0, 0, z), color="stone", segs=16, lod0=True)
    lathe([(3.15, 13.4), (3.0, 14.3), (2.5, 15.3), (1.6, 16.1), (0.6, 16.5), (0.0, 16.55)], color="stone", segs=16)
    cyl(0.6, 0.5, at=(0, 0, 16.4), color="stone", segs=8)
    cyl(0.85, 0.7, at=(0, 0, 16.9), r2=0.05, color="tomato", segs=8)
    # loading spout down the side
    tube([(1.4, -0.3, 15.8), (5.2, -1.2, 9.0), (6.0, -1.4, 6.5)], 0.32, color="tomato", segs=8)
    cyl(0.5, 0.9, at=(6.0, -1.4, 5.7), r2=0.36, color="tomato", segs=8)
    # ladder
    for x in (-0.35, 0.35):
        box((0.1, 0.1, 13.5), at=(x, -3.15, 0.6), base=True, color="ink_soft")
    if not _lod1():
        for i in range(22):
            box((0.7, 0.08, 0.08), at=(0, -3.15, 1.0 + i * 0.6), color="ink_soft")
    box((1.6, 0.12, 1.6), at=(-1.2, -2.85, 9.8), rot=(0, 0, -22), base=True, color="tomato", lod0=True)


@asset("windmill", "Windmill", "Turns wind into flour, and tourists into photos.", L, "wood", "large",
       col="cyl", fill=0.35)
def windmill():
    cyl(4.0, 1.6, color="stone", segs=8)
    cyl(3.6, 12.4, at=(0, 0, 1.6), r2=2.5, color="paper", segs=8)
    cyl(4.4, 0.35, at=(0, 0, 5.0), color="cocoa", segs=8)
    for i in range(8):
        a = math.radians(22.5 + 45 * i)
        box((0.12, 0.12, 1.0), at=(4.3 * math.cos(a), 4.3 * math.sin(a), 5.35), base=True, color="cocoa", lod0=True)
    cyl(4.35, 0.12, at=(0, 0, 6.3), color="cocoa", segs=8, lod0=True)
    # cap
    sphere(2.9, at=(0, 0.2, 14.0), scale=(1.0, 1.25, 0.8), color="tomato", segs=12, rings=6)
    cyl(2.75, 0.5, at=(0, 0.2, 13.6), color="cocoa", segs=12)
    # door + windows
    arch = [(-0.8, 0), (0.8, 0)] + [(0.8 * math.cos(math.radians(a)), 2.0 + 0.8 * math.sin(math.radians(a)))
                                    for a in range(0, 181, 45)]
    extrude(arch, 0.2, at=(0, -3.55, 1.6), rot=(90, 0, 0), color="cocoa", center=False)
    _win(0, -3.0, 8.4, 1.0, 1.4, color="glass", sill="cocoa")
    _win(2.55, -1.2, 10.0, 0.9, 1.2, face="+x", color="glass")
    # sails on a horizontal shaft at the front
    hub = Vector((0, -3.6, 14.2))
    cyl(0.4, 2.0, at=(0, -2.6, 14.2), rot=(90, 0, 0), base=False, color="cocoa", segs=8)
    sphere(0.65, at=tuple(hub), color="cocoa", segs=8, rings=5)
    Ls = 11.4
    k = Ls / 10.4
    for i in range(4):
        phi = 30 + 90 * i
        r = math.radians(phi)
        d = Vector((math.sin(r), 0, math.cos(r)))
        p = Vector((math.cos(r), 0, -math.sin(r)))
        c = hub + d * (Ls / 2)
        box((0.36, 0.32, Ls), at=tuple(c), rot=(0, phi, 0), color="cocoa")
        pc = hub + d * 6.2 * k + p * 1.1 + Vector((0, 0.1, 0))
        box((2.0, 0.12, 7.6 * k), at=tuple(pc), rot=(0, phi, 0), color="sand")
        if not _lod1():
            for j in range(6):
                q = hub + d * (2.75 + j * 1.38) * k + p * 1.1 + Vector((0, -0.02, 0))
                box((2.1, 0.14, 0.12), at=tuple(q), rot=(0, phi, 0), color="cocoa")
            q = hub + d * 6.2 * k + p * 2.1 + Vector((0, -0.02, 0))
            box((0.12, 0.14, 7.6 * k), at=tuple(q), rot=(0, phi, 0), color="cocoa")


@asset("water_tower", "Water Tower", "The town's biggest cup of water. Please do not stir.", L, "metal", "large",
       variants=["sky", "mint", "tomato", "snow"], col="cyl", fill=0.35)
def water_tower():
    zt = 18.5
    legs = []
    for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        b = (sx * 4.6, sy * 4.6, 0.0)
        t = (sx * 3.4, sy * 3.4, zt + 0.2)
        legs.append((b, t))
        tube([b, t], 0.4, color="stone", segs=8)
        cyl(0.7, 0.6, at=b, color="stone", segs=8)
    for z in (6.0, 12.5):
        f = z / zt
        ring = [tuple(b[i] + (t[i] - b[i]) * f for i in range(3)) for (b, t) in legs]
        for i in range(4):
            tube([ring[i], ring[(i + 1) % 4]], 0.2, color="stone", segs=5)
    if not _lod1():
        for (z0, z1) in ((0.6, 6.0), (6.0, 12.5), (12.5, zt)):
            r0 = [tuple(b[i] + (t[i] - b[i]) * z0 / zt for i in range(3)) for (b, t) in legs]
            r1 = [tuple(b[i] + (t[i] - b[i]) * z1 / zt for i in range(3)) for (b, t) in legs]
            for i in range(4):
                j = (i + 1) % 4
                tube([r0[i], r1[j]], 0.09, color="stone", segs=4)
                tube([r0[j], r1[i]], 0.09, color="stone", segs=4)
    cyl(0.7, zt, color="stone", segs=8)
    # tank
    cyl(1.6, 1.6, at=(0, 0, zt - 1.4), r2=5.0, color="sky", tint=True, segs=16)
    cyl(5.0, 7.0, at=(0, 0, zt + 0.2), color="sky", tint=True, segs=16)
    cyl(5.05, 1.4, at=(0, 0, zt + 3.0), color="snow", segs=16)
    for i in range(5):
        box((0.6 if i % 2 else 0.9, 0.2, 0.7), at=(-1.6 + i * 0.8, -5.0, zt + 3.35), base=True, color="cobalt",
            lod0=True)
    torus(5.6, 0.1, at=(0, 0, zt + 1.4), color="ink_soft", segs=20, rsegs=3, lod0=True)
    cyl(5.65, 0.2, at=(0, 0, zt + 0.2), color="ink_soft", segs=16)
    cyl(5.4, 3.3, at=(0, 0, zt + 7.2), r2=0.3, color="ink_soft", segs=16)
    sphere(0.45, at=(0, 0, zt + 10.6), color="tomato", segs=8, rings=5)
    if not _lod1():
        for k in (-0.3, 0.3):
            box((0.08, 0.08, zt), at=(4.6 + k, -4.7, 0.2), base=True, rot=(0, -3.7, 0), color="ink_soft")


@asset("radio_mast", "Radio Mast", "Plays the same three songs to the entire county.", L, "metal", "large",
       col="cyl", fill=0.08)
def radio_mast():
    cyl(3.6, 0.5, color="stone", segs=8)
    box((3.0, 3.0, 2.6), at=(4.6, -2.2, 0), base=True, color="cloud")
    box((3.3, 3.3, 0.3), at=(4.6, -2.2, 2.6), base=True, color="stone")
    box((0.9, 0.1, 1.8), at=(4.6, -3.72, 0), base=True, color="ink_soft", lod0=True)
    nb = 8
    H = 54.0
    rb, rt = 3.2, 1.1
    corners = [math.radians(90 + 120 * i) for i in range(3)]
    for k in range(nb):
        z0, z1 = 0.5 + H * k / nb, 0.5 + H * (k + 1) / nb
        r0 = rb + (rt - rb) * k / nb
        r1 = rb + (rt - rb) * (k + 1) / nb
        col = "tomato" if k % 2 == 0 else "snow"
        p0 = [(r0 * math.cos(a), r0 * math.sin(a), z0) for a in corners]
        p1 = [(r1 * math.cos(a), r1 * math.sin(a), z1) for a in corners]
        for i in range(3):
            tube([p0[i], p1[i]], 0.3, color=col, segs=4)
            j = (i + 1) % 3
            tube([p1[i], p1[j]], 0.12, color=col, segs=4, lod0=True)
            if k % 2:
                tube([p0[i], p1[j]], 0.1, color=col, segs=4, lod0=True)
            else:
                tube([p0[j], p1[i]], 0.1, color=col, segs=4, lod0=True)
    zt = 0.5 + H
    cyl(0.3, 4.5, at=(0, 0, zt), r2=0.12, color="tomato", segs=6)
    sphere(0.45, at=(0, 0, zt + 4.6), color="tomato", segs=8, rings=5)
    for (z, a) in ((32.0, -90), (41.0, 30)):
        r = rb + (rt - rb) * (z - 0.5) / H + 0.6
        ar = math.radians(a)
        cyl(1.5, 0.5, at=(r * math.cos(ar), r * math.sin(ar), z), rot=(90, 0, a + 90), r2=1.7, base=False,
            color="cloud", segs=12)
    cyl(1.2, 0.4, at=(-1.4, 0.6, 22.0), rot=(90, 0, 150), r2=1.35, base=False, color="cloud", segs=10, lod0=True)


# ---------------------------------------------------------------- high street

def _awning(x0, x1, y, z, depth, n, color, other="snow", drop=0.5):
    """Striped awning sloping out from the wall at y (front faces -Y)."""
    w = (x1 - x0) / n
    ang = math.degrees(math.atan2(drop, depth))
    ln = math.hypot(depth, drop)
    for i in range(n):
        c, t = (color, True) if i % 2 == 0 else (other, False)
        x = x0 + w * (i + 0.5)
        box((w + 0.01, ln, 0.1), at=(x, y - depth / 2, z - drop / 2), rot=(ang, 0, 0), color=c, tint=t)
        box((w + 0.01, 0.08, 0.5), at=(x, y - depth - 0.02, z - drop - 0.45), base=True, color=c, tint=t)
        cyl(w / 2, 0.08, at=(x, y - depth - 0.02, z - drop - 0.45), rot=(90, 0, 0), base=False, color=c, tint=t,
            segs=8, lod0=True)


@asset("shop_a", "Corner Shop", "Sells everything you came for, except the one thing.", L, "stone", "large",
       variants=["tomato", "cobalt", "leaf", "flamingo", "grape"], col="box", fill=0.9)
def shop_a():
    W, D, H = 11.0, 8.0, 8.2
    fy = -D / 2
    box((W, D, H), base=True, color="paper")
    box((W + 0.5, D + 0.5, 0.6), at=(0, 0, H), base=True, color="navy")
    box((W + 0.2, D + 0.2, 0.3), at=(0, 0, H - 0.3), base=True, color="navy", lod0=True)
    box((1.2, 1.2, 1.8), at=(3.2, 2.0, H + 0.6), base=True, color="brick")
    # shopfront
    box((W - 0.4, 0.3, 4.6), at=(0, fy, 0), base=True, color="navy")
    box((W - 0.6, 0.38, 0.95), at=(0, fy, 3.55), base=True, color="navy")
    for (x, w) in ((-3.2, 3.6), (3.2, 3.6)):
        box((w, 0.4, 2.4), at=(x, fy, 0.75), base=True, color="glass")
    box((1.5, 0.4, 2.8), at=(0, fy, 0.0), base=True, color="glass")
    box((1.3, 0.44, 0.06), at=(0, fy, 1.4), base=True, color="navy", lod0=True)
    for i in range(6):
        box((0.6 if i % 3 else 1.0, 0.44, 0.5), at=(-3.0 + i * 1.2, fy, 3.78), base=True, color="sun", lod0=True)
    _awning(-W / 2 + 0.3, W / 2 - 0.3, fy - 0.1, 3.5, 1.8, 9, "tomato", other="paper", drop=0.6)
    # upper floor windows + flower boxes
    for x in (-3.5, 0, 3.5):
        _win(x, fy - 0.02, 5.4, 1.6, 2.0, sill="snow", lod0=False)
        box((1.5, 0.4, 0.35), at=(x, fy - 0.2, 5.05), base=True, color="leaf", lod0=True)
        for dx in (-0.45, 0.0, 0.45):
            sphere(0.17, at=(x + dx, fy - 0.3, 5.45), color="tomato" if dx else "sun", segs=6, rings=4, lod0=True)
    for y in (-1.5, 1.5):
        _win(W / 2, y, 5.4, 1.6, 2.0, face="+x", sill="snow")
        _win(W / 2, y, 1.2, 1.6, 2.0, face="+x")


@asset("shop_b", "Gabled Boutique", "Fancy gable, fancier prices. Mostly sells candles.", L, "stone", "large",
       variants=["mint", "bubblegum", "sky", "butter", "lavender"], col="box", fill=0.85)
def shop_b():
    W, D, H = 9.0, 9.0, 8.0
    fy = -D / 2
    box((W, D, H), base=True, color="mint", tint=True)
    box((W + 0.3, D, 4.2), at=(0, 0.15, H), base=True, taper=(0.02, 1.0), color="cocoa")
    # stepped gable facade
    st = 1.25
    steps = [(4.5, H), (3.4, H), (3.4, H + st), (2.3, H + st), (2.3, H + 2 * st), (1.2, H + 2 * st),
             (1.2, H + 3 * st)]
    pts = [(-W / 2, 0.0), (W / 2, 0.0)] + steps + [(-x, z) for (x, z) in reversed(steps)]
    extrude(pts, 0.7, at=(0, fy + 0.2, 0), rot=(90, 0, 0), color="mint", tint=True)
    for (x, z, w) in ((3.95, H, 1.3), (2.85, H + st, 1.3), (1.75, H + 2 * st, 1.3)):
        for s in (-1, 1):
            box((w, 0.9, 0.22), at=(s * x, fy + 0.2, z), base=True, color="snow")
    box((2.6, 0.9, 0.22), at=(0, fy + 0.2, H + 3 * st), base=True, color="snow")
    cyl(0.18, 0.9, at=(0, fy + 0.2, H + 3 * st + 0.2), r2=0.02, color="snow", segs=6)
    # ground floor: arched shop window, door, sign
    arch = [(-2.0, 0), (2.0, 0)] + [(2.0 * math.cos(math.radians(a)), 2.4 + 1.2 * math.sin(math.radians(a)))
                                    for a in range(0, 181, 30)]
    extrude([(x * 1.1, z * 1.06 - 0.1) for (x, z) in arch], 0.2, at=(-1.6, fy - 0.2, 0.7), rot=(90, 0, 0),
            color="snow", center=False)
    extrude(arch, 0.2, at=(-1.6, fy - 0.3, 0.7), rot=(90, 0, 0), color="glass", center=False)
    box((1.5, 0.3, 3.0), at=(2.7, fy - 0.15, 0), base=True, color="cocoa")
    sphere(0.09, at=(2.25, fy - 0.35, 1.5), color="sun", segs=6, rings=4, lod0=True)
    box((0.12, 1.2, 0.12), at=(3.9, fy - 0.8, 4.35), base=True, color="ink_soft", lod0=True)
    box((0.1, 1.0, 0.8), at=(3.9, fy - 0.9, 3.5), base=True, color="sun", lod0=True)
    # upper windows + round attic window
    for x in (-2.3, 2.3):
        _win(x, fy - 0.2, 5.2, 1.4, 2.2, sill="snow", lod0=False)
    cyl(0.8, 0.2, at=(0, fy - 0.2, H + 1.6), rot=(90, 0, 0), base=False, color="snow", segs=12)
    cyl(0.6, 0.24, at=(0, fy - 0.2, H + 1.6), rot=(90, 0, 0), base=False, color="glass", segs=12)
    for y in (-1.5, 2.0):
        _win(W / 2, y, 5.2, 1.4, 2.2, face="+x", sill="snow")
        _win(W / 2, y, 1.2, 1.4, 2.2, face="+x")


def _umbrella(x, y, color, h=2.5, r=1.4):
    cyl(0.6, 0.06, at=(x, y, 0.74), color="cocoa", segs=8)
    cyl(0.07, 0.74, at=(x, y, 0), color="cocoa", segs=4)
    cyl(0.04, h, at=(x, y, 0.8), color="snow", segs=4)
    if _lod1():
        cyl(r, 0.5, at=(x, y, h + 0.3), r2=0.05, color=color, tint=True, segs=8)
    else:
        for i in range(8):
            a0, a1 = math.radians(45 * i), math.radians(45 * (i + 1))
            _poly3d([(x + r * math.cos(a0), y + r * math.sin(a0), h + 0.3),
                     (x + r * math.cos(a1), y + r * math.sin(a1), h + 0.3), (x, y, h + 0.85)], 0.06,
                    color if i % 2 == 0 else "snow", tint=i % 2 == 0)
    for k in (-1, 1):
        box((0.5, 0.5, 0.5), at=(x + k * 0.95, y, 0), base=True, color="caramel", lod0=True)
        box((0.5, 0.08, 0.5), at=(x + k * 0.95, y + 0.22, 0.5), base=True, color="caramel", lod0=True)


@asset("cafe", "Café", "Serves coffee in cups roughly the size of your head.", L, "stone", "large",
       variants=["tomato", "cobalt", "sun", "flamingo", "leaf"], col="box", fill=0.6)
def cafe():
    W, D, H = 10.0, 7.0, 4.6
    by = 1.6
    fy = by - D / 2
    box((W, D, H), at=(0, by, 0), base=True, color="lavender")
    box((W + 0.6, D + 0.6, 0.55), at=(0, by, H), base=True, color="cocoa")
    box((4.4, 0.4, 1.6), at=(-1.5, fy, H + 0.55), base=True, color="cocoa")
    box((4.0, 0.46, 1.2), at=(-1.5, fy, H + 0.75), base=True, color="paper")
    # giant cup on the sign
    lathe([(0, 0), (0.42, 0), (0.55, 0.75), (0, 0.75)], at=(-2.9, fy - 0.3, H + 0.85), color="snow", segs=10)
    torus(0.24, 0.07, at=(-2.4, fy - 0.3, H + 1.25), rot=(90, 0, 0), color="snow", segs=8, rsegs=3, lod0=True)
    for i in range(4):
        box((0.35 if i % 2 else 0.5, 0.5, 0.4), at=(-1.8 + i * 0.6, fy, H + 1.1), base=True, color="cocoa",
            lod0=True)
    # big windows + door
    for x in (-3.2, 0.6):
        box((3.0, 0.3, 2.6), at=(x, fy, 0.6), base=True, color="snow")
        box((2.7, 0.36, 2.3), at=(x, fy, 0.75), base=True, color="glass")
    box((1.4, 0.3, 3.0), at=(3.5, fy, 0), base=True, color="cocoa")
    box((0.9, 0.34, 1.4), at=(3.5, fy, 1.3), base=True, color="glass", lod0=True)
    _win(W / 2, by, 0.8, 3.5, 2.4, face="+x", color="glass")
    # terrace with umbrellas
    for (x, y) in ((-3.3, -3.6), (0.2, -4.0), (3.6, -3.4)):
        _umbrella(x, y, "tomato")
    extrude([(-0.4, 0), (0.4, 0), (0.25, 1.1), (-0.25, 1.1)], 0.25, at=(5.7, -2.4, 0), rot=(90, 0, 0),
            color="ink_soft", lod0=True)


@asset("bakery", "Bakery", "The giant loaf on the roof is not for sale. People ask.", L, "stone", "large",
       variants=["paper", "bubblegum", "butter", "mint"], col="box", fill=0.75)
def bakery():
    W, D, H = 10.0, 8.0, 5.6
    fy = -D / 2
    box((W, D, H), base=True, color="paper", tint=True)
    box((W + 0.5, D + 0.5, 0.5), at=(0, 0, H), base=True, color="cocoa")
    box((W - 0.4, 0.3, 0.9), at=(0, fy, 3.6), base=True, color="cocoa")
    # bow window full of buns
    box((4.6, 1.0, 0.5), at=(-2.2, fy - 0.3, 0.5), base=True, color="cocoa")
    box((4.4, 0.9, 2.2), at=(-2.2, fy - 0.3, 1.0), base=True, color="glass")
    box((4.8, 1.2, 0.3), at=(-2.2, fy - 0.35, 3.2), base=True, color="cocoa")
    for (x, c) in ((-3.6, "caramel"), (-2.7, "sand"), (-1.8, "caramel"), (-0.9, "sand")):
        sphere(0.38, at=(x, fy - 0.8, 1.35), scale=(1.1, 0.6, 0.7), color=c, segs=6, rings=4, lod0=True)
    box((1.5, 0.3, 3.0), at=(2.6, fy, 0), base=True, color="cocoa")
    box((0.9, 0.34, 1.3), at=(2.6, fy, 1.4), base=True, color="glass", lod0=True)
    _win(4.2, fy, 1.0, 0.8, 2.0, color="glass")
    for y in (-1.5, 1.5):
        _win(W / 2, y, 1.4, 1.6, 2.0, face="+x", sill="cocoa")
    # giant loaf sign on posts
    for x in (-2.2, 2.2):
        box((0.35, 0.35, 1.9), at=(x, 0.5, H + 0.4), base=True, color="ink_soft")
    lz, lh, lx, ly = H + 2.0, 2.3, 4.5, 1.7
    cyl(1.0, 0.45, at=(0, 0.5, lz), scale=(lx, ly, 1), color="cocoa", segs=16)
    lathe([(math.cos(math.radians(a)), 0.45 + lh * math.sin(math.radians(a))) for a in (0, 25, 50, 70, 90)],
          at=(0, 0.5, lz), scale=(lx, ly, 1), color="caramel", segs=16)
    for x in (-2.7, -0.9, 0.9, 2.7):
        h = 0.45 + lh * math.sqrt(1 - (x / lx) ** 2)
        slope = math.degrees(math.atan(lh * x / (lx * lx * math.sqrt(1 - (x / lx) ** 2))))
        sphere(1.0, at=(x, 0.5, lz + h - 0.16), scale=(0.3, 1.15, 0.22), rot=(0, slope, 28), color="sand", segs=8,
               rings=4)


@asset("billboard", "Billboard", "Toast: it's bread, but braver. Ad space available.", L, "paper", "large",
       col="box", fill=0.15)
def billboard():
    zb = 5.0
    for x in (-3.8, 3.8):
        cyl(0.32, zb + 0.4, at=(x, 0.6, 0), color="charcoal", segs=8)
    box((8.4, 0.25, 0.3), at=(0, 0.6, 2.6), color="charcoal")
    box((12.4, 1.2, 0.18), at=(0, -0.4, zb - 0.25), base=True, color="charcoal", lod0=True)
    for i in range(7):
        box((0.06, 0.06, 0.9), at=(-6.0 + i * 2.0, -0.95, zb - 0.1), base=True, color="charcoal", lod0=True)
    box((12.5, 0.5, 5.4), at=(0, 0.2, zb), base=True, color="snow")
    box((12.0, 0.4, 4.9), at=(0, 0.04, zb + 0.25), base=True, color="sky")
    # the ad: a very happy slice of toast
    tx, tz, fy = -2.6, zb + 2.5, -0.25
    star = []
    for i in range(16):
        r = 2.6 if i % 2 == 0 else 1.8
        a = math.radians(90 + 22.5 * i)
        star.append((r * math.cos(a), r * math.sin(a)))
    extrude(star, 0.08, at=(tx, fy + 0.06, tz), rot=(90, 0, 0), color="butter")
    crust = [(-1.55, -1.7), (1.55, -1.7), (1.55, 0.6)] + \
            [(0.85 + 0.85 * math.cos(math.radians(a)), 0.75 + 0.85 * math.sin(math.radians(a)))
             for a in range(0, 181, 30)][1:] + \
            [(-0.85 + 0.85 * math.cos(math.radians(a)), 0.75 + 0.85 * math.sin(math.radians(a)))
             for a in range(0, 181, 30)][1:] + [(-1.55, 0.6)]
    extrude(crust, 0.18, at=(tx, fy, tz), rot=(90, 0, 0), color="caramel")
    extrude([(x * 0.82, y * 0.82 - 0.05) for (x, y) in crust], 0.12, at=(tx, fy - 0.12, tz), rot=(90, 0, 0),
            color="sand")
    box((1.0, 0.3, 0.55), at=(tx + 0.5, fy - 0.3, tz + 1.1), rot=(0, -12, 0), color="butter")
    for k in (-1, 1):
        sphere(0.17, at=(tx + k * 0.5, fy - 0.24, tz + 0.15), scale=(1, 0.4, 1.3), color="ink", segs=6, rings=4)
        sphere(0.14, at=(tx + k * 0.95, fy - 0.2, tz - 0.25), scale=(1, 0.3, 0.7), color="bubblegum", segs=6,
               rings=3, lod0=True)
    torus(0.45, 0.07, at=(tx, fy - 0.2, tz - 0.3), rot=(90, 180, 0), arc=180, color="ink", segs=8, rsegs=3)
    # "headline" bars
    for (w, z, c) in ((4.4, zb + 3.6, "tomato"), (3.6, zb + 2.5, "ink"), (2.6, zb + 1.5, "ink")):
        box((w, 0.2, 0.7), at=(2.9 - (4.4 - w) / 2, -0.2, z), base=True, color=c, lod0=c == "ink")
    for x in (-4.0, 0.0, 4.0):
        tube([(x, -0.05, zb + 5.4), (x, -0.9, zb + 5.9), (x, -1.3, zb + 5.7)], 0.07, color="charcoal", segs=4,
             lod0=True)


@asset("petrol_station", "Petrol Station", "Fuel, crisps, and one sandwich of uncertain age.", L, "metal",
       "large", variants=["tomato", "leaf", "cobalt", "sun"], col="box", fill=0.25)
def petrol_station():
    box((19.0, 10.0, 0.15), at=(0, 0, 0), base=True, color="cloud")
    # canopy
    for x in (-4.5, 4.5):
        for y in (-2.0, 2.0):
            box((0.5, 0.5, 5.2), at=(x, y, 0.15), base=True, color="snow")
    box((18.0, 9.0, 0.35), at=(0, 0, 5.2), base=True, color="snow")
    box((18.2, 9.2, 0.9), at=(0, 0, 5.5), base=True, color="tomato", tint=True)
    box((18.25, 9.25, 0.18), at=(0, 0, 5.95), base=True, color="snow", lod0=True)
    # pump islands
    for y in (-2.0, 2.0):
        box((10.5, 1.2, 0.3), at=(0, y, 0.15), base=True, color="stone")
        for x in (-2.2, 2.2):
            box((0.9, 0.6, 1.9), at=(x, y, 0.45), base=True, color="tomato", tint=True)
            box((0.95, 0.65, 0.4), at=(x, y, 2.35), base=True, color="snow")
            box((0.55, 0.08, 0.4), at=(x, y - 0.32, 1.6), base=True, color="ink_soft", lod0=True)
            tube([(x + 0.35, y - 0.32, 1.3), (x + 0.6, y - 0.6, 0.9), (x + 0.55, y - 0.5, 0.5)], 0.05,
                 color="ink_soft", segs=4, lod0=True)
    # kiosk behind
    box((9.0, 5.0, 3.8), at=(0, 7.3, 0.15), base=True, color="snow")
    box((9.4, 5.4, 0.6), at=(0, 7.3, 3.95), base=True, color="tomato", tint=True)
    box((6.0, 0.2, 2.2), at=(-1.0, 4.8, 0.6), base=True, color="glass")
    box((1.4, 0.2, 2.6), at=(3.2, 4.8, 0.15), base=True, color="glass")
    # price totem
    box((1.8, 0.7, 7.2), at=(10.6, -3.8, 0), base=True, color="tomato", tint=True)
    box((1.5, 0.76, 1.5), at=(10.6, -3.8, 5.2), base=True, color="snow")
    cyl(0.5, 0.82, at=(10.6, -3.8, 5.95), rot=(90, 0, 0), base=False, color="sun", segs=10)
    for z in (1.2, 2.4, 3.6):
        box((1.4, 0.76, 0.85), at=(10.6, -3.8, z), base=True, color="ink_soft", lod0=True)
        box((0.9, 0.8, 0.25), at=(10.75, -3.8, z + 0.3), base=True, color="sun", lod0=True)


# ---------------------------------------------------------------- civic + landmarks

@asset("statue", "Pompous Statue", "Points heroically at the bakery. Nobody knows why.", L, "stone", "large",
       variants=["teal", "stone", "sun"], col="box", fill=0.45)
def statue():
    box((3.8, 3.8, 0.5), base=True, color="stone")
    box((2.8, 2.8, 1.9), at=(0, 0, 0.5), base=True, color="cloud")
    box((3.3, 3.3, 0.35), at=(0, 0, 2.4), base=True, color="stone")
    box((1.6, 0.1, 0.7), at=(0, -1.42, 1.1), base=True, color="sun", lod0=True)
    z0, s, c = 2.75, 1.22, "teal"

    def p(x, y, z):
        return (x * s, y * s, z0 + z * s)

    cyl(1.1, 0.22, at=(0, 0, z0), color=c, tint=True, segs=10)
    for (x, y) in ((-0.32, 0.15), (0.34, -0.2)):
        cyl(0.24 * s, 1.5 * s, at=p(x, y, 0.15), color=c, tint=True, segs=7)
        sphere(0.27 * s, at=p(x, y - 0.16, 0.27), scale=(1, 1.5, 0.6), color=c, tint=True, segs=6, rings=4)
    # frock coat, puffed chest, cape
    lathe([(0, 1.25), (0.9, 1.25), (0.74, 2.2), (0.66, 2.95), (0.78, 3.4), (0.56, 3.75), (0.0, 3.8)], at=(0, 0, z0),
          scale=(s, s, s), color=c, tint=True, segs=12)
    sphere(0.58 * s, at=p(0, -0.25, 3.05), scale=(1.1, 0.85, 0.9), color=c, tint=True, segs=8, rings=5)
    _poly3d([p(-0.72, 0.35, 3.7), p(0.72, 0.35, 3.7), p(1.25, 0.95, 0.9), p(-1.3, 1.0, 0.95)], 0.16 * s, c,
            tint=True)
    for k in (-1, 1):
        sphere(0.3 * s, at=p(k * 0.75, 0, 3.62), scale=(1.25, 1, 0.55), color=c, tint=True, segs=6, rings=4)
    # head held high: nose, moustache, sideways bicorne
    cyl(0.24 * s, 0.3 * s, at=p(0, 0, 3.7), color=c, tint=True, segs=6)
    sphere(0.46 * s, at=p(0, -0.04, 4.3), color=c, tint=True, segs=10, rings=6)
    sphere(0.13 * s, at=p(0, -0.48, 4.3), scale=(0.9, 1, 1.2), color=c, tint=True, segs=6, rings=4)
    for k in (-1, 1):
        sphere(0.17 * s, at=p(k * 0.17, -0.43, 4.1), scale=(1.6, 0.7, 0.55), rot=(0, k * 20, 0), color=c,
               tint=True, segs=6, rings=4)
    hat = [(1.05 * math.cos(math.radians(a)), 0.6 * math.sin(math.radians(a))) for a in range(0, 181, 20)]
    extrude([(x * s, y * s) for (x, y) in hat], 0.42 * s, at=p(0, -0.04, 4.55), rot=(90, 0, 0), color=c,
            tint=True)
    # arm pointing grandly into the distance, other fist on hip
    tube([p(0.72, -0.05, 3.5), p(1.45, -0.4, 3.95), p(2.25, -0.75, 4.45)], 0.21 * s, r_end=0.17 * s, color=c,
         tint=True, segs=7)
    sphere(0.22 * s, at=p(2.33, -0.79, 4.5), color=c, tint=True, segs=6, rings=4)
    tube([p(2.4, -0.82, 4.55), p(2.85, -1.0, 4.85)], 0.07 * s, color=c, tint=True, segs=5)
    tube([p(-0.72, -0.05, 3.5), p(-1.2, -0.2, 2.85), p(-0.72, -0.3, 2.4)], 0.21 * s, color=c, tint=True, segs=7)
    # pigeon, unimpressed
    px, py, pz = p(-0.2, 0.0, 5.18)
    sphere(0.22, at=(px, py, pz), scale=(1.4, 1, 0.9), color="stone", segs=6, rings=4, lod0=True)
    sphere(0.13, at=(px + 0.28, py, pz + 0.18), color="stone", segs=6, rings=4, lod0=True)


@asset("town_fountain", "Town Fountain", "Wish fund currently stands at four coins and a button.", L, "stone",
       "large", col="cyl", fill=0.35)
def town_fountain():
    lathe([(0, 0), (4.4, 0), (4.55, 0.15), (4.45, 0.8), (4.6, 0.95), (4.05, 0.95), (4.05, 0.4), (0, 0.4)],
          color="cloud", segs=20)
    cyl(4.06, 0.06, at=(0, 0, 0.7), color="sky", segs=20)
    lathe([(0.8, 0.4), (0.55, 1.2), (0.45, 2.0), (0.6, 2.2)], color="stone", segs=10)
    lathe([(0, 2.1), (0.6, 2.1), (1.6, 2.35), (2.2, 2.75), (2.25, 2.95), (1.95, 2.95), (0, 2.75)], color="cloud",
          segs=16)
    cyl(1.96, 0.06, at=(0, 0, 2.82), color="sky", segs=16)
    lathe([(0.4, 2.8), (0.3, 3.4), (0.3, 3.8), (0.45, 3.95)], color="stone", segs=8)
    lathe([(0, 3.85), (0.4, 3.85), (0.9, 4.0), (1.2, 4.3), (1.22, 4.45), (1.0, 4.45), (0, 4.3)], color="cloud",
          segs=12)
    cyl(1.0, 0.05, at=(0, 0, 4.36), color="sky", segs=12)
    sphere(0.35, at=(0, 0, 4.7), color="sun", segs=8, rings=5)
    cyl(0.16, 1.4, at=(0, 0, 4.9), r2=0.08, color="sky", segs=6)
    sphere(0.38, at=(0, 0, 6.35), scale=(1, 1, 0.8), color="sky", segs=8, rings=5)
    # arcing jets: four from the top spout, four from the middle bowl
    for i in range(4):
        a = math.radians(45 + 90 * i)
        c, sn = math.cos(a), math.sin(a)
        tube([(0.15 * c, 0.15 * sn, 5.6), (0.9 * c, 0.9 * sn, 6.0), (1.5 * c, 1.5 * sn, 5.0), (1.75 * c, 1.75 * sn, 2.85)],
             0.2, r_end=0.13, color="sky", segs=6, smooth_path=1)
        a = math.radians(90 * i)
        c, sn = math.cos(a), math.sin(a)
        tube([(2.1 * c, 2.1 * sn, 2.8), (2.9 * c, 2.9 * sn, 3.0), (3.4 * c, 3.4 * sn, 2.0), (3.55 * c, 3.55 * sn, 0.75)],
             0.22, r_end=0.14, color="sky", segs=6, smooth_path=1)
        sphere(0.3, at=(3.55 * c, 3.55 * sn, 0.75), scale=(1, 1, 0.45), color="snow", segs=6, rings=3, lod0=True)
    for (x, y) in ((1.5, -2.6), (-2.0, -1.8), (2.6, 1.2), (-0.6, 3.0)):
        cyl(0.14, 0.03, at=(x, y, 0.75), color="sun", segs=6, lod0=True)


@asset("gazebo", "Bandstand", "Hosts one brass band concert a year. Lives for it.", L, "wood", "large",
       variants=["leaf", "cobalt", "tomato", "flamingo"], col="cyl", fill=0.35)
def gazebo():
    R = 2.9
    cyl(3.4, 0.6, color="cloud", segs=8)
    cyl(3.3, 0.12, at=(0, 0, 0.6), color="caramel", segs=8)
    for i in range(3):
        box((1.8, 0.45, 0.2 * (i + 1)), at=(0, -3.3 - 0.45 * (2 - i) + 0.1, 0), base=True, color="cloud")
    zt = 3.7
    for i in range(8):
        a = math.radians(22.5 + 45 * i)
        cyl(0.13, zt - 0.7, at=(R * math.cos(a), R * math.sin(a), 0.7), color="snow", segs=6)
    for i in range(8):
        if i in (5, 6):
            continue
        a0, a1 = math.radians(22.5 + 45 * i), math.radians(22.5 + 45 * (i + 1))
        p0 = Vector((R * math.cos(a0), R * math.sin(a0), 1.6))
        p1 = Vector((R * math.cos(a1), R * math.sin(a1), 1.6))
        mid = (p0 + p1) / 2
        yaw = math.degrees(math.atan2(p1.y - p0.y, p1.x - p0.x))
        box(((p1 - p0).length, 0.12, 0.12), at=tuple(mid), rot=(0, 0, yaw), color="snow")
        box(((p1 - p0).length, 0.08, 0.8), at=tuple(mid - Vector((0, 0, 0.85))), rot=(0, 0, yaw), base=True,
            color="snow", lod0=True)
    cyl(3.25, 0.35, at=(0, 0, zt), color="snow", segs=8)
    _stripes(3.65, zt + 0.35, 1.7, zt + 1.35, 8, ("leaf", "snow"), start=22.5, thick=0.1)
    _stripes(1.7, zt + 1.35, 0.0, zt + 2.6, 8, ("leaf", "snow"), start=22.5, thick=0.1)
    cyl(0.12, 0.6, at=(0, 0, zt + 2.55), color="snow", segs=6)
    sphere(0.22, at=(0, 0, zt + 3.2), color="sun", segs=8, rings=5)
    if not _lod1():
        for i in range(8):
            a0, a1 = math.radians(22.5 + 45 * i), math.radians(22.5 + 45 * (i + 1))
            for j in range(3):
                t0, t1 = (j + 0.1) / 3, (j + 0.9) / 3
                ax = R * 1.08 * (math.cos(a0) * (1 - (t0 + t1) / 2) + math.cos(a1) * (t0 + t1) / 2)
                ay = R * 1.08 * (math.sin(a0) * (1 - (t0 + t1) / 2) + math.sin(a1) * (t0 + t1) / 2)
                q0 = (R * 1.08 * (math.cos(a0) * (1 - t0) + math.cos(a1) * t0),
                      R * 1.08 * (math.sin(a0) * (1 - t0) + math.sin(a1) * t0), zt - 0.05)
                q1 = (R * 1.08 * (math.cos(a0) * (1 - t1) + math.cos(a1) * t1),
                      R * 1.08 * (math.sin(a0) * (1 - t1) + math.sin(a1) * t1), zt - 0.05)
                _poly3d([q0, q1, (ax, ay, zt - 0.5)], 0.04, ("sun", "tomato", "sky")[(i + j) % 3])


def _toy_horse(origin, yaw, body, saddle, lod1, s=1.35):
    """Carousel horse facing local -Y, built around `origin`, turned by yaw (degrees), scaled by s."""
    ca, sa = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))

    def w(p):
        x, y, z = p[0] * s, p[1] * s, p[2] * s
        return (origin[0] + x * ca - y * sa, origin[1] + x * sa + y * ca, origin[2] + z)

    if lod1:
        box((0.45 * s, 1.2 * s, 0.5 * s), at=w((0, 0, 0)), rot=(0, 0, yaw), color=body)
        box((0.35 * s, 0.45 * s, 0.8 * s), at=w((0, -0.6, 0.45)), rot=(-25, 0, yaw), color=body)
        box((0.5 * s, 0.4 * s, 0.14 * s), at=w((0, 0, 0.27)), rot=(0, 0, yaw), color=saddle)
        return
    capsule(0.27 * s, 0.65 * s, at=w((0, 0, 0)), rot=(90, 0, yaw), color=body, segs=8)
    tube([w((0, -0.4, 0.1)), w((0, -0.6, 0.55)), w((0, -0.65, 0.7))], 0.17 * s, color=body, segs=6)
    box((0.24 * s, 0.55 * s, 0.26 * s), at=w((0, -0.82, 0.68)), rot=(30, 0, yaw), color=body)
    tube([w((0, -0.3, 0.32)), w((0, -0.55, 0.78))], 0.07 * s, color=saddle, segs=4)
    for k in (-1, 1):
        tube([w((k * 0.13, -0.3, -0.15)), w((k * 0.13, -0.6, -0.3)), w((k * 0.13, -0.5, -0.6))], 0.065 * s,
             color=body, segs=4)
        tube([w((k * 0.13, 0.35, -0.15)), w((k * 0.13, 0.55, -0.7))], 0.065 * s, color=body, segs=4)
    box((0.58 * s, 0.45 * s, 0.12 * s), at=w((0, 0.0, 0.27)), rot=(0, 0, yaw), color=saddle)
    tube([w((0, 0.55, 0.1)), w((0, 0.8, -0.1)), w((0, 0.85, -0.45))], 0.08 * s, color=saddle, segs=4)


@asset("carousel", "Carousel", "Round and round forever. The horses are not going anywhere.", L, "wood",
       "landmark", variants=["flamingo", "tomato", "cobalt", "leaf"], col="cyl", fill=0.55)
def carousel():
    lod1 = _lod1()
    cyl(6.0, 0.7, color="sun", segs=16)
    cyl(5.85, 0.1, at=(0, 0, 0.7), color="sky", segs=16)
    cyl(1.2, 4.2, at=(0, 0, 0.8), color="flamingo", tint=True, segs=12)
    for i in range(6):
        a = math.radians(60 * i + 30)
        box((0.8, 0.1, 2.4), at=(1.21 * math.cos(a), 1.21 * math.sin(a), 1.6), rot=(0, 0, 60 * i + 120), base=True,
            color="sun", lod0=True)
    zc = 4.6
    n = 16 if not lod1 else 10
    _stripes(6.25, zc, 6.25, zc + 0.9, n, ("flamingo", "snow"), thick=0.14)
    _stripes(6.5, zc + 0.9, 0.7, zc + 3.6, n, ("flamingo", "snow"), thick=0.14)
    cyl(6.3, 0.2, at=(0, 0, zc - 0.15), color="sun", segs=16)
    if not lod1:
        for i in range(n):
            a = math.radians(360 * (i + 0.5) / n)
            cyl(0.42, 0.12, at=(6.27 * math.cos(a), 6.27 * math.sin(a), zc - 0.15), rot=(90, 0, 360 * (i + 0.5) / n + 90),
                base=False, color="sun", segs=8)
    cyl(0.9, 0.7, at=(0, 0, zc + 3.4), color="sun", segs=10)
    cyl(1.05, 0.9, at=(0, 0, zc + 4.1), r2=0.05, color="flamingo", tint=True, segs=10)
    _flag((0, 0, zc + 4.9), 1.4, 1.1, "sun", pole="ink_soft", pr=0.06)
    # horses on brass poles, bobbing at different heights
    for i in range(8):
        a = 360.0 * i / 8 + 15
        ar = math.radians(a)
        px, py = 4.4 * math.cos(ar), 4.4 * math.sin(ar)
        cyl(0.07, zc - 0.8, at=(px, py, 0.8), color="sun", segs=5)
        _toy_horse((px, py, 2.2 + 0.45 * (i % 2)), a, "snow", ("sky", "tomato")[i % 2], lod1)


@asset("church", "Village Church", "The bells are lovely. The bells are also at 7 a.m.", L, "stone", "landmark",
       col="box", fill=0.55)
def church():
    # nave
    box((10.0, 17.0, 8.0), at=(0, 4.0, 0), base=True, color="paper")
    box((11.2, 17.6, 5.4), at=(0, 4.0, 8.0), base=True, taper=(0.02, 1.0), color="tomato")
    for y in (-0.5, 3.5, 7.5, 11.0):
        for x in (-5.0, 5.0):
            arch = [(-0.7, 0), (0.7, 0)] + [(0.7 * math.cos(math.radians(a)), 2.6 + 0.7 * math.sin(math.radians(a)))
                                            for a in range(0, 181, 45)]
            extrude(arch, 0.2, at=(x, y, 2.6), rot=(90, 0, 90), color="lavender")
    # tower + spire
    ty = -6.6
    box((5.2, 5.2, 15.0), at=(0, ty, 0), base=True, color="paper")
    box((5.8, 5.8, 0.6), at=(0, ty, 15.0), base=True, color="tomato")
    box((5.6, 5.6, 0.4), at=(0, ty, 10.0), base=True, color="paper", lod0=True)
    box((4.8, 4.8, 15.5), at=(0, ty, 15.6), base=True, taper=(0.03, 0.03), color="tomato")
    for (dx, dy, r) in ((0, -2.6, 0), (2.6, 0, 90), (0, 2.6, 0), (-2.6, 0, 90)):
        arch = [(-0.9, 0), (0.9, 0)] + [(0.9 * math.cos(math.radians(a)), 2.0 + 0.9 * math.sin(math.radians(a)))
                                        for a in range(0, 181, 45)]
        extrude(arch, 0.2, at=(dx, ty + dy, 11.3), rot=(90, 0, r), color="ink_soft")
    cyl(1.0, 0.2, at=(0, ty - 2.62, 7.6), rot=(90, 0, 0), base=False, color="sun", segs=14)
    cyl(0.75, 0.24, at=(0, ty - 2.62, 7.6), rot=(90, 0, 0), base=False, color="lavender", segs=14)
    door = [(-1.2, 0), (1.2, 0)] + [(1.2 * math.cos(math.radians(a)), 2.6 + 1.2 * math.sin(math.radians(a)))
                                    for a in range(0, 181, 30)]
    extrude(door, 0.24, at=(0, ty - 2.62, 0), rot=(90, 0, 0), color="cocoa")
    box((0.08, 0.3, 3.4), at=(0, ty - 2.75, 0), base=True, color="ink_soft", lod0=True)
    # cross on top
    box((0.3, 0.3, 2.6), at=(0, ty, 31.0), base=True, color="sun")
    box((1.4, 0.3, 0.3), at=(0, ty, 32.9), color="sun")
    # little round window at the back gable
    cyl(0.9, 0.2, at=(0, 12.55, 9.5), rot=(90, 0, 0), base=False, color="lavender", segs=10, lod0=True)


@asset("lighthouse", "Lighthouse", "Winks at boats all night. The boats never wink back.", L, "stone", "large",
       variants=["tomato", "cobalt", "leaf", "ink_soft"], col="cyl", fill=0.4)
def lighthouse():
    for (x, y, r, sx, sy, sz) in ((3.6, -2.0, 2.0, 1.3, 1.0, 0.7), (-3.3, -2.6, 1.8, 1.2, 1.0, 0.6),
                                  (-2.8, 2.8, 2.2, 1.2, 1.1, 0.7), (3.0, 3.0, 1.6, 1.0, 1.2, 0.6),
                                  (0.5, -4.0, 1.4, 1.3, 0.9, 0.5)):
        ico(r, at=(x, y, r * sz * 0.3), scale=(sx, sy, sz), color="stone", rot=(0, 0, x * 20))
    cyl(4.0, 1.6, color="cloud", segs=16)
    nb = 6
    z0, z1, r0, r1 = 1.6, 22.5, 3.3, 2.25
    for k in range(nb):
        za, zb = z0 + (z1 - z0) * k / nb, z0 + (z1 - z0) * (k + 1) / nb
        ra, rb = r0 + (r1 - r0) * k / nb, r0 + (r1 - r0) * (k + 1) / nb
        if k % 2 == 0:
            cyl(ra, zb - za, at=(0, 0, za), r2=rb, color="snow", segs=16)
        else:
            cyl(ra, zb - za, at=(0, 0, za), r2=rb, color="tomato", tint=True, segs=16)
    arch = [(-0.7, 0), (0.7, 0)] + [(0.7 * math.cos(math.radians(a)), 1.8 + 0.7 * math.sin(math.radians(a)))
                                    for a in range(0, 181, 45)]
    extrude(arch, 0.3, at=(0, -3.25, 1.6), rot=(90, 0, -3), color="ink_soft")
    for (z, a) in ((8.0, -100), (12.5, -60), (17.0, -95)):
        r = r0 + (r1 - r0) * (z - z0) / (z1 - z0)
        ar = math.radians(a)
        box((0.6, 0.3, 1.0), at=(r * math.cos(ar), r * math.sin(ar), z), rot=(0, 0, a + 90), base=True,
            color="ink_soft", lod0=True)
    # gallery, lantern, dome
    cyl(3.3, 0.5, at=(0, 0, z1), color="ink_soft", segs=16)
    torus(3.1, 0.07, at=(0, 0, z1 + 1.2), color="ink_soft", segs=20, rsegs=3, lod0=True)
    if not _lod1():
        for i in range(12):
            a = math.radians(30 * i)
            cyl(0.06, 1.2, at=(3.1 * math.cos(a), 3.1 * math.sin(a), z1 + 0.5), color="ink_soft", segs=4)
    cyl(1.7, 0.5, at=(0, 0, z1 + 0.5), color="tomato", tint=True, segs=12)
    cyl(1.55, 2.4, at=(0, 0, z1 + 1.0), color="glass", segs=12)
    sphere(0.9, at=(0, 0, z1 + 2.2), color="sun", segs=10, rings=6)
    if not _lod1():
        for i in range(6):
            a = math.radians(60 * i + 15)
            box((0.12, 0.12, 2.4), at=(1.56 * math.cos(a), 1.56 * math.sin(a), z1 + 1.0), base=True, color="ink_soft")
    lathe([(1.95, z1 + 3.4), (1.7, z1 + 4.1), (1.1, z1 + 4.8), (0.4, z1 + 5.2), (0, z1 + 5.3)], color="tomato",
          tint=True, segs=12)
    sphere(0.35, at=(0, 0, z1 + 5.55), color="ink_soft", segs=8, rings=5)
    cyl(0.06, 1.0, at=(0, 0, z1 + 5.8), color="ink_soft", segs=4, lod0=True)


@asset("clock_tower", "Clock Tower", "Four faces, four slightly different opinions on the time.", L, "stone",
       "landmark", col="box", fill=0.6)
def clock_tower():
    box((8.0, 8.0, 3.0), base=True, color="cloud")
    box((6.0, 6.0, 21.5), at=(0, 0, 3.0), base=True, color="brick")
    for (x, y) in ((-3.0, -3.0), (3.0, -3.0), (3.0, 3.0), (-3.0, 3.0)):
        box((0.7, 0.7, 21.5), at=(x, y, 3.0), base=True, color="cloud", lod0=True)
    box((6.8, 6.8, 0.6), at=(0, 0, 24.5), base=True, color="cloud")
    box((6.4, 6.4, 6.2), at=(0, 0, 25.1), base=True, color="cloud")
    box((7.0, 7.0, 0.6), at=(0, 0, 31.3), base=True, color="cloud")
    zf = 28.2
    for (dx, dy, yaw) in ((0, -3.2, 0), (3.2, 0, 90), (0, 3.2, 180), (-3.2, 0, 270)):
        ca, sa = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        nx, ny = sa, -ca  # outward normal of this face
        cyl(2.5, 0.2, at=(dx, dy, zf), rot=(90, 0, yaw), base=False, color="ink", segs=16)
        cyl(2.25, 0.3, at=(dx, dy, zf), rot=(90, 0, yaw), base=False, color="paper", segs=16)
        hx, hy = dx + nx * 0.2, dy + ny * 0.2
        box((0.22, 0.1, 1.6), at=(hx, hy, zf), rot=(0, 0, yaw), base=True, color="ink")
        box((1.3, 0.1, 0.22), at=(hx + ca * 0.6, hy + sa * 0.6, zf), rot=(0, 0, yaw), color="ink")
        if not _lod1():
            for i in range(12):
                a = math.radians(30 * i)
                box((0.18, 0.1, 0.18), at=(hx + ca * 1.85 * math.cos(a), hy + sa * 1.85 * math.cos(a),
                                           zf + 1.85 * math.sin(a)), rot=(0, 0, yaw), color="ink")
    # belfry + spire
    box((5.6, 5.6, 3.0), at=(0, 0, 31.9), base=True, color="brick")
    for (dx, dy, r) in ((0, -2.8, 0), (2.8, 0, 90), (0, 2.8, 0), (-2.8, 0, 90)):
        arch = [(-0.9, 0), (0.9, 0)] + [(0.9 * math.cos(math.radians(a)), 1.4 + 0.9 * math.sin(math.radians(a)))
                                        for a in range(0, 181, 45)]
        extrude(arch, 0.2, at=(dx, dy, 32.2), rot=(90, 0, r), color="ink_soft")
    box((6.2, 6.2, 0.4), at=(0, 0, 34.9), base=True, color="cloud")
    box((6.0, 6.0, 4.3), at=(0, 0, 35.3), base=True, taper=(0.04, 0.04), color="teal")
    cyl(0.12, 0.9, at=(0, 0, 39.4), color="sun", segs=6)
    sphere(0.3, at=(0, 0, 39.75), color="sun", segs=8, rings=4)
    # door and slit windows
    door = [(-1.2, 0), (1.2, 0)] + [(1.2 * math.cos(math.radians(a)), 2.4 + 1.2 * math.sin(math.radians(a)))
                                    for a in range(0, 181, 30)]
    extrude(door, 0.3, at=(0, -4.02, 0), rot=(90, 0, 0), color="ink_soft")
    for z in (8.0, 13.0, 18.0):
        _win(0, -3.02, z, 0.8, 2.2, color="ink_soft")
        _win(3.02, 0, z, 0.8, 2.2, face="+x", color="ink_soft")


@asset("circus_tent", "Circus Tent", "Stripes this loud should really need a permit.", L, "soft", "landmark",
       variants=["tomato", "cobalt", "grape", "leaf"], col="cyl", fill=0.6)
def circus_tent():
    lod1 = _lod1()
    n = 16 if not lod1 else 10
    R = 11.0
    _stripes(R, 0.0, R, 5.6, n, ("tomato", "snow"), thick=0.16)
    _stripes(R + 0.6, 5.6, 4.6, 9.6, n, ("tomato", "snow"), thick=0.16)
    _stripes(4.6, 9.6, 0.5, 16.2, n, ("tomato", "snow"), thick=0.16)
    cyl(R + 0.7, 0.45, at=(0, 0, 5.35), color="sun", segs=16)
    if not lod1:
        for i in range(n):
            a = math.radians(360 * (i + 0.5) / n)
            cyl(1.05, 0.14, at=((R + 0.62) * math.cos(a), (R + 0.62) * math.sin(a), 5.35),
                rot=(90, 0, 360 * (i + 0.5) / n + 90), base=False, color="sun", segs=8)
    cyl(0.6, 0.6, at=(0, 0, 16.0), color="sun", segs=8)
    _flag((0, 0, 16.5), 3.5, 2.6, "tomato", pole="ink_soft", pr=0.12)
    for i in range(4):
        a = math.radians(45 + 90 * i)
        r = 6.6
        z = 5.6 + (9.6 - 5.6) * (R + 0.6 - r) / (R + 0.6 - 4.6)
        _flag((r * math.cos(a), r * math.sin(a), z - 0.3), 2.2, 1.5, ("sun", "sky")[i % 2], pole="ink_soft",
              pr=0.08)
    # entrance
    box((4.4, 1.2, 4.4), at=(0, -R - 0.2, 0), base=True, color="sun")
    box((3.4, 1.3, 3.8), at=(0, -R - 0.25, 0), base=True, color="ink_soft")
    box((5.2, 2.2, 1.6), at=(0, -R - 0.4, 4.4), base=True, taper=(1.0, 0.02), color="tomato", tint=True)


@asset("ferris_wheel", "Ferris Wheel", "Goes nowhere, slowly, with a lovely view of it.", L, "metal", "landmark",
       col="box", fill=0.2)
def ferris_wheel():
    lod1 = _lod1()
    zc, R = 21.0, 16.5
    box((16.0, 8.0, 0.8), base=True, color="stone")
    box((4.0, 3.0, 2.4), at=(6.0, -2.4, 0.8), base=True, color="snow", lod0=True)
    for y in (-2.8, 2.8):
        for x in (-7.0, 7.0):
            tube([(x, y, 0.8), (0, y * 0.75, zc)], 0.5, color="cobalt", segs=8)
        tube([(-4.8, y * 0.95, 7.0), (4.8, y * 0.95, 7.0)], 0.3, color="cobalt", segs=6)
    cyl(0.9, 5.0, at=(0, 0, zc), rot=(90, 0, 0), base=False, color="sun", segs=10)
    for y in (-1.1, 1.1):
        torus(R, 0.6, at=(0, y, zc), rot=(90, 0, 0), color="snow", segs=36, rsegs=6)
    torus(R * 0.55, 0.3, at=(0, 0, zc), rot=(90, 0, 0), color="tomato", segs=24, rsegs=4, lod0=True)
    ns = 12 if not lod1 else 8
    for i in range(ns):
        phi = 360.0 * i / ns + 15
        r = math.radians(phi)
        box((0.6, 0.6, R), at=(math.sin(r) * R / 2, 0, zc + math.cos(r) * R / 2), rot=(0, phi, 0), color="snow")
    # gondolas
    ng = 12
    cols = ("tomato", "sun", "sky")
    for i in range(ng):
        a = math.radians(360.0 * i / ng + 15)
        px, pz = R * math.cos(a), zc + R * math.sin(a)
        cyl(0.13, 2.6, at=(px, 0, pz), rot=(90, 0, 0), base=False, color="ink_soft", segs=4, lod0=True)
        box((0.16, 0.16, 0.8), at=(px, 0, pz - 0.8), base=True, color="ink_soft")
        cyl(1.55, 1.7, at=(px, 0, pz - 3.3), color=cols[i % 3], segs=10)
        cyl(1.7, 0.6, at=(px, 0, pz - 1.6), r2=0.3, color=cols[i % 3], segs=10)
        cyl(1.6, 0.7, at=(px, 0, pz - 2.4), color="glass", segs=10, lod0=True)


@asset("apartment_block", "Apartment Block", "Forty kitchens, forty dinners, one very tired lift.", L, "stone",
       "large", variants=["sand", "bubblegum", "mint", "sky", "butter"], col="box", fill=0.9)
def apartment_block():
    W, D, H = 18.0, 12.0, 23.4
    fy = -D / 2
    box((W, D, H), base=True, color="sand", tint=True)
    box((W + 0.3, D + 0.3, 3.2), base=True, color="stone")
    box((W + 0.5, D + 0.5, 0.6), at=(0, 0, H), base=True, color="snow")
    # rooftop
    box((3.5, 3.5, 2.6), at=(4.5, 2.0, H + 0.6), base=True, color="stone")
    cyl(1.3, 2.0, at=(-4.0, 1.5, H + 1.8), color="cloud", segs=10)
    for (x, y) in ((-4.8, 0.7), (-3.2, 0.7), (-4.8, 2.3), (-3.2, 2.3)):
        box((0.2, 0.2, 1.2), at=(x, y, H + 0.6), base=True, color="ink_soft", lod0=True)
    tube([(0, 3.0, H + 0.6), (0, 3.0, H + 4.0)], 0.06, color="ink_soft", segs=4, lod0=True)
    box((2.0, 0.08, 0.08), at=(0, 3.0, H + 3.6), color="ink_soft", lod0=True)
    # entrance canopy
    box((3.6, 0.3, 2.6), at=(0, fy - 0.1, 0), base=True, color="glass")
    box((4.6, 2.0, 0.3), at=(0, fy - 0.9, 2.9), base=True, color="snow")
    # windows + balconies
    floors = 7
    fh = (H - 3.2) / floors
    cols = (-7.2, -3.6, 0.0, 3.6, 7.2)
    for f in range(floors):
        z = 3.2 + f * fh
        for x in cols:
            _win(x, fy, z + 0.6, 1.5, 1.6, color="glass")
        for y in (-3.6, 0.0, 3.6):
            _win(W / 2, y, z + 0.6, 1.5, 1.6, face="+x", color="glass")
        if f < floors - 1:
            for x in (-5.4, 5.4):
                box((3.2, 1.3, 0.25), at=(x, fy - 0.65, z + fh), base=True, color="snow")
                box((3.2, 0.12, 1.0), at=(x, fy - 1.25, z + fh + 0.25), base=True, color="snow")
