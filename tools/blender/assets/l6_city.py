"""Level 6 — The Big Tidy (the whole city + port + sky). Objects face -Y; base at z = 0; metres.

These are mostly seen from far away as skyline silhouettes, so every type exaggerates the one
shape that names it (setbacks, spire, twist, dome, rose window, ...). Fine window rows are
lod0-only; LOD1 keeps a few fat bands with the same glass/wall ratio.
"""
import math

from lib.core import STATE, box, cyl, sphere, torus, lathe, extrude, tube, capsule, seg, ngon_points, \
    rounded_rect_points, eyes
from lib.registry import asset


# ---------------------------------------------------------------- local helpers

def _lod1():
    return STATE.lod > 0


def _bands(w, d, z0, z1, n, color, n1=3, ratio=0.45, out=0.3, at=(0, 0), taper=None, tint=False):
    """Horizontal window bands wrapping a w x d block between z0 and z1 (all four faces at once).
    LOD0 draws n bands, LOD1 n1 fatter ones with the same glass/wall ratio.
    taper=(sx, sy) follows a block built with box(..., taper=...) from z0 to z1."""
    k = n1 if _lod1() else n
    if k <= 0:
        return
    step = (z1 - z0) / k
    hh = step * ratio
    for i in range(k):
        zc = z0 + step * (i + 0.5)
        ww, dd = w, d
        if taper:
            t = (zc - z0) / (z1 - z0)
            ww, dd = w * (1 + (taper[0] - 1) * t), d * (1 + (taper[1] - 1) * t)
        box((ww + 2 * out, dd + 2 * out, hh), at=(at[0], at[1], zc), color=color, tint=tint)


def _vstrips(w, d, z0, z1, n, width, color, out=0.3, at=(0, 0), sides=True, lod0=True, margin=0.12):
    """n vertical strips on the front/back faces (and n on the sides), one box per face pair."""
    h = z1 - z0
    for i in range(n):
        t = (i + 0.5) / n
        x = -w / 2 + w * margin + w * (1 - 2 * margin) * t
        box((width, d + 2 * out, h), at=(at[0] + x, at[1], z0), base=True, color=color, lod0=lod0)
        if sides:
            y = -d / 2 + d * margin + d * (1 - 2 * margin) * t
            box((w + 2 * out, width, h), at=(at[0], at[1] + y, z0), base=True, color=color, lod0=lod0)


def _hull_plan(L, W, bow=0.24, stern_r=0.3, nb=6, ns=3, sx=1.0, sy=1.0):
    """Plan-view ship hull: rounded stern at -X, curved pointy bow at +X."""
    hx, hy = L / 2, W / 2
    r = W * stern_r
    nb, ns = seg(nb, 3), seg(ns, 1)
    pts = []
    for i in range(ns + 1):
        a = math.radians(180 + 90 * i / ns)
        pts.append((-hx + r + r * math.cos(a), -hy + r + r * math.sin(a)))
    xb = hx - L * bow
    for i in range(nb + 1):
        t = i / nb
        pts.append((xb + (hx - xb) * t, -hy * (1 - t ** 2)))
    pts += [(x, -y) for (x, y) in reversed(pts[:-1])]
    return [(x * sx, y * sy) for (x, y) in pts]


def _container(at, length=12.2, color="tomato", yaw=0.0, tint=False, ribs=5):
    """Shipping container (long axis along X before yaw) with lod0 ribs and door bars."""
    w, h = 2.44, 2.6
    box((length, w, h), at=at, rot=(0, 0, yaw), base=True, color=color, tint=tint, bevel=0.05, bseg=1)
    if _lod1():
        return
    a = math.radians(yaw)
    ca, sa = math.cos(a), math.sin(a)
    for i in range(ribs):
        x = -length / 2 + length * (i + 0.5) / ribs
        box((0.35, w + 0.14, h - 0.35), at=(at[0] + x * ca, at[1] + x * sa, at[2] + 0.17), rot=(0, 0, yaw),
            base=True, color=color, tint=tint)
    for k in (-0.35, 0.35):
        x = length / 2 + 0.03
        box((0.1, 0.12, h - 0.5), at=(at[0] + x * ca - k * sa, at[1] + x * sa + k * ca, at[2] + 0.25),
            rot=(0, 0, yaw), base=True, color="ink_soft")


def _pyramid(size, h, at, color, rot_z=0.0, tint=False):
    """Square pyramid (4-sided cone) sitting on `at`."""
    cyl(size * 0.7071, h, at=at, r2=0.0, rot=(0, 0, 45 + rot_z), color=color, segs=4, tint=tint)


# ---------------------------------------------------------------- vehicles & port

@asset("helicopter", "Helicopter", "A ceiling fan with a commute.", 6, "metal", "large",
       variants=["tomato", "sun", "sky", "leaf"], col="box", flags=["float"], fill=0.25)
def helicopter():
    z = 2.7
    sphere(2.2, at=(0.9, 0, z), rot=(0, 90, 0), scale=(1, 1, 1.45), color="tomato", tint=True, segs=14, rings=9)
    sphere(1.75, at=(2.3, 0, z + 0.35), rot=(0, 90, 0), scale=(0.9, 1.05, 1.0), color="glass", segs=12, rings=7)
    box((1.8, 4.5, 0.35), at=(0.9, 0, z - 0.2), color="snow", lod0=True)
    tube([(-1.2, 0, z + 0.3), (-5.0, 0, z + 0.6), (-8.4, 0, z + 1.0)], 0.75, r_end=0.38, color="tomato", tint=True,
         segs=8)
    extrude([(-7.4, 0.0), (-8.9, 0.0), (-9.6, 3.2), (-8.5, 3.2)], 0.3, at=(0, 0, z + 0.7), rot=(90, 0, 0),
            color="tomato", tint=True)
    box((1.1, 3.4, 0.2), at=(-6.8, 0, z + 0.85), color="charcoal")
    cyl(1.2, 0.18, at=(-8.9, -0.35, z + 2.7), rot=(90, 0, 0), base=False, color="charcoal", segs=12, lod0=True)
    cyl(0.22, 0.5, at=(-8.9, -0.2, z + 2.7), rot=(90, 0, 0), base=False, color="stone", segs=8)
    # main rotor
    cyl(0.32, 1.0, at=(0.4, 0, z + 1.9), color="charcoal", segs=8)
    cyl(0.6, 0.4, at=(0.4, 0, z + 2.8), color="stone", segs=10)
    for a in (20, 110, 200, 290):
        r = math.radians(a)
        box((5.6, 0.7, 0.14), at=(0.4 + 2.95 * math.cos(r), 2.95 * math.sin(r), z + 3.05), rot=(0, 0, a),
            color="charcoal")
    # skids
    for y in (-1.55, 1.55):
        tube([(-2.0, y, 0.2), (2.6, y, 0.2), (3.4, y, 0.65)], 0.17, color="stone", segs=6)
        for x in (-0.9, 1.6):
            tube([(x, y, 0.2), (x, y * 0.55, z - 1.6)], 0.13, color="stone", segs=5)


@asset("container_stack", "Container Stack", "Contents unknown. Probably socks. Lots of socks.", 6, "metal",
       "large", variants=["sun", "leaf", "flamingo", "tangerine"], col="box", fill=0.8)
def container_stack():
    # stepped: front row one high, middle two, back three (so every box shows from the front)
    w, h = 2.56, 2.62
    rows = [(-w, 0.3, ("tomato",)), (0.0, -0.5, ("teal", "cobalt")), (w, 0.4, ("cobalt", "tomato", "teal"))]
    for (y, x, cols) in rows:
        for k, c in enumerate(cols):
            _container((x + (0.5 if k % 2 else 0.0), y, k * h), color=c)
    _container((0.2, 0.2, 3 * h), color="sun", yaw=-8, tint=True)


@asset("airliner", "Airliner", "Pretzels not included. Wings very much included.", 6, "metal", "landmark",
       variants=["cobalt", "tomato", "teal", "grape"], col="box", fill=0.2)
def airliner():
    zc = 6.0
    R = 4.0
    lathe([(0.8, -15.0), (2.4, -12.5), (3.6, -8.0), (R, -2.0), (R, 15.0), (3.75, 19.0), (3.1, 22.0), (2.0, 24.2),
           (0.0, 25.6)], at=(0, 0, zc), rot=(0, 90, 0), color="snow", segs=16)
    # upswept tail cone
    lathe([(0.0, -9.5), (1.6, -8.8), (2.7, -6.0), (3.6, -1.0), (3.9, 0.5)], at=(-14.5, 0, zc + 0.35),
          rot=(0, 96, 0), color="snow", segs=16)
    # cheat line + windows + cockpit
    box((31.0, 2 * R + 0.25, 0.8), at=(0.5, 0, zc - 0.6), color="cobalt", tint=True)
    if _lod1():
        box((27.0, 2 * R * 0.94 + 0.1, 0.8), at=(1.0, 0, zc + 1.2), color="ink_soft")
    else:
        for i in range(15):
            box((0.8, 2 * R * 0.94 + 0.1, 0.85), at=(-12.0 + i * 1.85, 0, zc + 1.2), color="ink_soft")
    box((2.6, 5.4, 1.0), at=(20.6, 0, zc + 1.55), rot=(0, 14, 0), color="ink_soft")
    # wings (low, swept, a little dihedral)
    wing = [(5.5, 2.5), (-5.5, 2.5), (-12.0, 24.0), (-8.0, 24.0)]
    extrude(wing, 1.0, at=(0, 0, zc - 2.2), rot=(5, 0, 0), color="cloud")
    extrude([(x, -y) for (x, y) in wing], 1.0, at=(0, 0, zc - 2.2), rot=(-5, 0, 0), color="cloud")
    for k in (-1, 1):
        cyl(1.6, 4.0, at=(-11.5, k * 23.6, zc - 0.2), rot=(0, 90, 0), base=False, color="cobalt", tint=True,
            segs=8, scale=(0.5, 0.25, 1), lod0=True)
    # engines
    for k in (-1, 1):
        y = k * 10.0
        cyl(1.9, 6.5, at=(0.8, y, zc - 3.6), rot=(0, 90, 0), base=False, r2=1.6, color="stone", segs=12)
        cyl(1.55, 0.3, at=(4.1, y, zc - 3.6), rot=(0, 90, 0), base=False, color="ink_soft", segs=12)
        box((3.5, 0.6, 1.4), at=(-0.5, y, zc - 2.0), color="cloud")
    # tail
    extrude([(-16.0, 0.0), (-23.5, 0.0), (-26.5, 11.5), (-22.0, 11.5)], 1.0, at=(0, 0, zc + 2.6),
            rot=(90, 0, 0), color="cobalt", tint=True)
    stab = [(-19.5, 0.5), (-25.0, 0.5), (-27.0, 9.0), (-24.0, 9.0)]
    extrude(stab, 0.7, at=(0, 0, zc + 1.7), color="cloud")
    extrude([(x, -y) for (x, y) in stab], 0.7, at=(0, 0, zc + 1.7), color="cloud")
    # chunky landing gear
    for (x, y) in ((17.0, 0.0), (-2.0, -2.6), (-2.0, 2.6)):
        cyl(0.3, zc - R, at=(x, y, 1.0), color="stone", segs=6)
        cyl(1.0, 1.0, at=(x, y, 1.0), rot=(90, 0, 0), base=False, color="ink_soft", segs=10)


@asset("blimp", "Blimp", "Floats over the city saying absolutely nothing. Bliss.", 6, "rubber", "landmark",
       variants=["flamingo", "sun", "sky", "lime"], col="box", flags=["float"], fill=0.45)
def blimp():
    zc = 16.0
    a, b = 34.0, 10.5

    def rad(x):
        return b * math.sqrt(max(0.0, 1 - (x / a) ** 2))

    sphere(b, at=(0, 0, zc), rot=(0, 90, 0), scale=(1, 1, a / b), color="cloud", segs=18, rings=14)
    for x in (-14.0, -3.0, 8.0):
        torus(rad(x) - 0.1, 0.9, at=(x, 0, zc), rot=(0, 90, 0), scale=(1, 1, 2.0), color="flamingo", tint=True,
              segs=20, rsegs=6)
    sphere(2.6, at=(a - 1.4, 0, zc), rot=(0, 90, 0), scale=(1, 1, 0.6), color="flamingo", tint=True, segs=12,
           rings=6)
    fin = [(-23.0, 5.5), (-33.0, 2.5), (-38.5, 2.5), (-37.0, 13.0), (-31.0, 13.0)]
    for psi in (0, 90, 180, 270):
        extrude(fin, 0.8, at=(0, 0, zc), rot=(psi, 0, 0), color="flamingo", tint=True)
    # gondola + props
    capsule(2.3, 8.0, at=(4.0, 0, zc - b - 1.4), rot=(0, 90, 0), color="charcoal", segs=10)
    box((9.0, 4.85, 1.0), at=(4.3, 0, zc - b - 1.0), color="glass", lod0=True)
    for k in (-1, 1):
        cyl(0.9, 3.2, at=(0.0, k * 4.0, zc - b - 0.8), rot=(0, 90, 0), base=False, color="charcoal", segs=8)
        box((0.2, 0.5, 4.2), at=(1.7, k * 4.0, zc - b - 0.8), color="stone", lod0=True)
        tube([(0.0, k * 1.8, zc - b - 0.9), (0.0, k * 3.6, zc - b - 0.8)], 0.3, color="charcoal", segs=5)


@asset("harbour_crane", "Harbour Crane", "Lifts boxes all day. Has never once opened one.", 6, "metal",
       "landmark", variants=["tangerine", "sky", "tomato", "sun"], col="box", fill=0.12)
def harbour_crane():
    C = "tangerine"
    zb = 40.0
    legs = [(-9.0, -7.0), (9.0, -7.0), (-9.0, 7.0), (9.0, 7.0)]
    for (x, y) in legs:
        box((2.0, 2.0, zb), at=(x, y, 0), base=True, color=C, tint=True)
        box((3.6, 3.0, 1.6), at=(x, y, 0), base=True, color="charcoal")
    for y in (-7.0, 7.0):
        box((20.0, 1.8, 2.4), at=(0, y, 13.0), color=C, tint=True)
        box((20.0, 2.2, 3.0), at=(0, y, zb - 1.2), color=C, tint=True)
    for x in (-9.0, 9.0):
        box((1.8, 16.0, 2.0), at=(x, 0, 24.0), color=C, tint=True)
    # boom: two box girders + lod0 truss zigzag
    x0, x1 = -21.0, 47.0
    for y in (-4.5, 4.5):
        box((x1 - x0, 1.8, 3.6), at=((x0 + x1) / 2, y, zb + 1.8), color=C, tint=True)
        if not _lod1():
            n = 14
            dx = (x1 - x0) / n
            for i in range(n):
                xm = x0 + dx * (i + 0.5)
                box((dx * 1.12, 0.5, 0.5), at=(xm, y, zb + 1.8), rot=(0, 30 if i % 2 else -30, 0), color="charcoal")
    box((x1 - x0, 10.8, 0.8), at=((x0 + x1) / 2, 0, zb + 0.4), color=C, tint=True, lod0=True)
    # A-frame apex
    for y in (-4.5, 4.5):
        tube([(-9.0, y, zb + 3.6), (-1.0, y, 63.0)], 0.9, color=C, tint=True, segs=6)
        tube([(9.0, y, zb + 3.6), (-1.0, y, 63.0)], 0.9, color=C, tint=True, segs=6)
        for xe in (45.5, 24.0, -19.5):
            tube([(-1.0, y, 63.0), (xe, y, zb + 3.4)], 0.35, color="charcoal", segs=4)
    box((2.0, 11.0, 2.0), at=(-1.0, 0, 63.0), color=C, tint=True)
    # machinery house, cab, trolley + dangling container
    box((11.0, 12.0, 6.0), at=(-14.0, 0, zb + 3.6), base=True, color="snow", bevel=0.4)
    box((11.2, 12.2, 1.0), at=(-14.0, 0, zb + 7.0), color="tomato", lod0=True)
    box((4.5, 4.5, 4.0), at=(13.0, -4.5, zb - 4.0), base=True, color="snow", bevel=0.3)
    box((4.7, 4.7, 1.6), at=(13.0, -4.5, zb - 2.6), base=True, color="ink_soft")
    box((6.0, 10.0, 2.4), at=(30.0, 0, zb + 3.6), base=True, color="charcoal")
    for y in (-2.0, 2.0):
        tube([(30.0, y, zb), (30.0, y, 22.0)], 0.22, color="charcoal", segs=4)
    box((13.0, 3.0, 0.9), at=(30.0, 0, 21.6), color="charcoal")
    _container((30.0, 0, 18.4), color="tomato")


@asset("cargo_ship", "Cargo Ship", "Carries everything you ordered at 2am.", 6, "metal", "landmark",
       variants=["navy", "pine", "tomato", "charcoal"], col="box", fill=0.55)
def cargo_ship():
    L, W = 196.0, 32.0
    extrude(_hull_plan(L, W, sx=0.97, sy=0.9), 7.0, at=(0, 0, 0), center=False, color="tomato")
    extrude(_hull_plan(L, W), 10.5, at=(0, 0, 5.5), center=False, color="navy", tint=True, bevel=1.2)
    sphere(4.4, at=(L / 2 - 2.0, 0, 3.2), rot=(0, 90, 0), scale=(0.8, 1, 1.7), color="tomato", segs=10, rings=6)
    extrude(_hull_plan(L, W, sx=1.006, sy=1.03), 1.0, at=(0, 0, 13.3), center=False, color="snow", lod0=True)
    # container bays: 3 stacks across, heights vary
    cols = ("tomato", "sun", "teal")
    heights = (3, 4, 5, 4, 5, 3, 4, 5, 4, 3, 2)
    x = -64.0
    i = 0
    while x < 72.0:
        hb = heights[i % len(heights)]
        for j, yy in enumerate((-9.6, 0.0, 9.6)):
            hh = hb + ((i + j) % 3 == 0) - ((i * 2 + j) % 5 == 0)
            c = cols[(i + j * 2) % 3]
            box((12.2, 9.2, 2.6 * max(1, hh)), at=(x, yy, 15.5), base=True, color=c)
            if not _lod1():
                box((0.5, 9.4, 2.6 * max(1, hh) - 0.8), at=(x, yy, 15.9), base=True, color="ink_soft")
        x += 13.0
        i += 1
    # superstructure at the stern
    xs = -80.0
    box((15.0, 27.0, 20.0), at=(xs, 0, 15.5), base=True, color="snow", bevel=0.6)
    box((9.0, 36.0, 3.6), at=(xs + 2.0, 0, 35.5), base=True, color="snow", bevel=0.4)
    box((9.4, 36.4, 1.6), at=(xs + 2.0, 0, 37.0), base=True, color="ink_soft")
    _bands(15.0, 27.0, 18.0, 34.0, 3, "glass", n1=0, ratio=0.25, at=(xs, 0))
    cyl(3.5, 12.0, at=(xs - 4.5, 0, 35.0), color="tomato", segs=10, scale=(1.3, 1, 1))
    cyl(3.6, 2.0, at=(xs - 4.5, 0, 47.0), color="ink", segs=10, scale=(1.3, 1, 1))
    box((1.0, 1.0, 12.0), at=(L / 2 - 14.0, 0, 15.0), base=True, color="snow", lod0=True)


@asset("cruise_ship", "Cruise Ship", "Twelve decks, four pools, one mandatory lifeboat drill.", 6, "metal",
       "landmark", variants=["tomato", "sun", "cobalt", "teal"], col="box", fill=0.6)
def cruise_ship():
    L, W = 240.0, 36.0
    extrude(_hull_plan(L, W, bow=0.22, stern_r=0.45, sx=0.98, sy=0.92), 9.0, at=(0, 0, 0), center=False,
            color="navy")
    extrude(_hull_plan(L, W, bow=0.22, stern_r=0.45), 13.0, at=(0, 0, 7.5), center=False, color="snow", bevel=1.4)
    sphere(5.0, at=(L / 2 - 2.0, 0, 3.4), rot=(0, 90, 0), scale=(0.8, 1, 1.7), color="navy", segs=10, rings=6)
    # porthole stripes on the hull
    nh = 1 if _lod1() else 2
    for k in range(nh):
        extrude(_hull_plan(L, W, bow=0.22, stern_r=0.45, sx=0.985, sy=1.012), 1.0, at=(0, 0, 13.2 - 3.0 * k),
                center=False, color="navy")
    # stacked decks, rounded at the bow end
    tiers = [(196.0, 33.0, 9.0, -10.0), (180.0, 31.0, 8.5, -14.0), (160.0, 29.0, 8.0, -18.0),
             (130.0, 26.0, 7.5, -22.0), (80.0, 22.0, 6.5, -16.0)]
    z = 20.5
    for ti, (tl, tw, th, tx) in enumerate(tiers):
        pts = [(tx + px, py) for (px, py) in rounded_rect_points(tl, tw, tw * 0.48, corner_segs=3)]
        extrude(pts, th, at=(0, 0, z), center=False, color="snow")
        rows = 1 if (_lod1() or ti >= 3) else 2
        for r in range(rows):
            zz = z + th * (0.3 + 0.38 * r) if rows == 2 else z + th * 0.42
            pts2 = [(tx + px, py) for (px, py) in rounded_rect_points(tl + 0.6, tw + 0.6, tw * 0.48, corner_segs=3)]
            extrude(pts2, 1.3 if rows == 2 else 2.0, at=(0, 0, zz), center=False, color="navy")
        z += th
    # lifeboats hung along the hull sides
    if _lod1():
        box((150.0, W + 1.6, 2.4), at=(-17.0, 0, 18.0), color="sun")
    else:
        for i in range(12):
            for k in (-1, 1):
                box((9.0, 2.6, 2.6), at=(-86.0 + i * 12.6, k * 18.6, 18.0), color="sun", bevel=0.8, bseg=1)
    # funnels
    for fx in (-64.0, -44.0):
        cyl(5.2, 19.0, at=(fx, 0, z - 1.0), r2=4.4, rot=(0, -10, 0), color="tomato", tint=True, segs=12,
            scale=(1.5, 1, 1))
        cyl(4.5, 2.4, at=(fx - 3.6, 0, z + 17.6), rot=(0, -10, 0), color="ink", segs=12, scale=(1.5, 1, 1))
    box((14.0, 11.0, 0.4), at=(-14.0, 0, z), base=True, color="sky", lod0=True)
    box((5.0, 37.0, 3.0), at=(46.0, 0, z - 9.5), base=True, color="snow")


# ---------------------------------------------------------------- towers & blocks

@asset("office_block", "Office Block", "Ninety meetings that could have been emails.", 6, "stone", "large",
       variants=["sand", "cloud", "bubblegum", "mint", "butter"], col="box", fill=0.9)
def office_block():
    w, d, H = 30.0, 22.0, 52.0
    box((w, d, H), base=True, color="sand", tint=True)
    box((w + 0.6, d + 0.6, 5.0), base=True, color="charcoal")
    _bands(w, d, 6.5, H - 2.0, 11, "cobalt", n1=3, ratio=0.5)
    for (x, y) in ((-w / 2, -d / 2), (w / 2, -d / 2), (-w / 2, d / 2), (w / 2, d / 2)):
        box((2.2, 2.2, H + 1.0), at=(x, y, 0), base=True, color="cloud")
    box((w + 1.6, d + 1.6, 1.4), at=(0, 0, H), base=True, color="cloud")
    box((12.0, 9.0, 5.0), at=(-4.0, 2.0, H + 1.4), base=True, color="cloud")
    cyl(2.6, 4.5, at=(8.0, 4.0, H + 3.0), color="caramel", segs=10)
    for x in (6.0, 10.0):
        for y in (1.2, 6.8):
            cyl(0.18, 3.0, at=(x, y, H + 1.4), color="charcoal", segs=4, lod0=True)
    cyl(2.7, 0.8, at=(8.0, 4.0, H + 7.5), r2=0.4, color="caramel", segs=10)
    box((9.0, 3.0, 0.8), at=(0, -d / 2 - 1.2, 4.6), base=True, color="cloud")
    box((5.0, 0.4, 4.2), at=(0, -d / 2 - 0.2, 0), base=True, color="glass", lod0=True)
    tube([(10.0, -3.0, H + 1.4), (10.0, -3.0, H + 10.0)], 0.25, color="charcoal", segs=4)


@asset("skyscraper_deco", "Art Deco Skyscraper", "Built back when buildings wore hats.", 6, "stone", "landmark",
       variants=["sand", "butter", "bubblegum", "cloud"], col="box", fill=0.6)
def skyscraper_deco():
    tiers = [(44.0, 36.0, 0.0, 42.0), (36.0, 29.0, 42.0, 82.0), (28.0, 22.0, 82.0, 110.0), (20.0, 16.0, 110.0, 126.0)]
    for i, (w, d, z0, z1) in enumerate(tiers):
        box((w, d, z1 - z0), at=(0, 0, z0), base=True, color="sand", tint=True)
        box((w + 1.2, d + 1.2, 1.4), at=(0, 0, z1 - 1.4), base=True, color="sun")
        n = (5, 4, 3, 2)[i]
        if _lod1():
            if i < 3:
                _vstrips(w, d, z0 + 3.0, z1 - 3.0, 2, w * 0.12, "ink_soft", lod0=False)
        else:
            _vstrips(w, d, z0 + 3.0, z1 - 3.0, n, 2.2, "ink_soft")
    # entrance
    box((10.0, 1.0, 9.0), at=(0, -18.2, 0), base=True, color="ink_soft")
    box((14.0, 1.6, 2.0), at=(0, -18.4, 9.0), base=True, color="sun")
    # stepped crown + corner fins + spire
    _pyramid(14.0, 4.0, (0, 0, 126.0), "sun")
    box((13.0, 11.0, 5.0), at=(0, 0, 126.0), base=True, color="sand", tint=True)
    box((9.0, 8.0, 5.0), at=(0, 0, 131.0), base=True, color="sun")
    box((5.5, 5.0, 4.0), at=(0, 0, 136.0), base=True, color="sand", tint=True)
    for kx in (-1, 1):
        for ky in (-1, 1):
            extrude([(0.0, 0.0), (5.0, 0.0), (0.0, 10.0)], 0.8, at=(kx * 10.0, ky * 8.0, 126.0),
                    rot=(90, 0, 0 if kx < 0 else 180), color="sun")
    cyl(1.4, 13.0, at=(0, 0, 140.0), r2=0.12, color="sun", segs=8)
    sphere(1.1, at=(0, 0, 140.5), color="sun", segs=8, rings=5)


@asset("skyscraper_spire", "Glass Skyscraper", "Mostly windows. Entirely reflective. Needlessly pointy.", 6,
       "glass", "landmark", variants=["cobalt", "teal", "grape", "navy"], col="box", fill=0.55)
def skyscraper_spire():
    w0, H, tp = 32.0, 160.0, 0.72
    box((w0 + 6.0, w0 + 6.0, 8.0), base=True, color="cloud")
    box((w0, w0, H), at=(0, 0, 0), base=True, color="glass", taper=(tp, tp))
    _bands(w0, w0, 10.0, H - 4.0, 16, "cobalt", n1=4, ratio=0.22, out=0.35, taper=(tp, tp), tint=True)
    # spine strip down each face centre
    sp = 3.0
    for rot in (0, 90):
        box((sp, w0 + 0.7, H), at=(0, 0, 0), rot=(0, 0, rot), base=True, color="cobalt", tint=True,
            taper=(1.0, tp))
    wt = w0 * tp
    box((wt + 1.0, wt + 1.0, 2.0), at=(0, 0, H), base=True, color="cloud")
    box((wt, wt, 12.0), at=(0, 0, H + 2.0), base=True, color="glass", taper=(0.35, 0.35))
    cyl(2.4, 4.0, at=(0, 0, H + 13.0), color="cloud", segs=8)
    cyl(1.4, 32.0, at=(0, 0, H + 17.0), r2=0.1, color="stone", segs=8)
    cyl(1.9, 1.2, at=(0, 0, H + 24.0), color="cobalt", tint=True, segs=8)


@asset("skyscraper_twist", "Twisty Skyscraper", "The architect sneezed mid-drawing. They kept it.", 6, "glass",
       "landmark", variants=["mint", "lavender", "butter", "sky"], col="box", fill=0.5)
def skyscraper_twist():
    n, hs = 16, 14.0
    s0, s1 = 42.0, 24.0
    box((s0 + 10.0, s0 + 10.0, 6.0), base=True, color="cloud")
    for i in range(n):
        t = i / (n - 1)
        s = s0 + (s1 - s0) * t ** 1.3
        yaw = i * 5.5
        z = 6.0 + i * hs
        box((s, s, hs - 1.6), at=(0, 0, z), rot=(0, 0, yaw), base=True, color="mint", tint=True, bevel=1.0, bseg=1)
        box((s * 0.9, s * 0.9, 1.6), at=(0, 0, z + hs - 1.6), rot=(0, 0, yaw + 2.75), base=True, color="teal")
        if not _lod1():
            box((s + 0.5, s * 0.55, 1.4), at=(0, 0, z + hs * 0.42), rot=(0, 0, yaw), color="teal")
            box((s * 0.55, s + 0.5, 1.4), at=(0, 0, z + hs * 0.42), rot=(0, 0, yaw), color="teal")
    zt = 6.0 + n * hs
    cyl(s1 * 0.55, 6.0, at=(0, 0, zt), r2=s1 * 0.3, color="teal", segs=12)
    cyl(1.0, 20.0, at=(0, 0, zt + 6.0), r2=0.15, color="stone", segs=6)


@asset("apartment_tower", "Apartment Tower", "Two hundred balconies, two hundred drying towels.", 6, "stone",
       "landmark", variants=["bubblegum", "butter", "sky", "lavender", "mint"], col="box", fill=0.85)
def apartment_tower():
    w, d, H = 30.0, 20.0, 84.0
    box((w, d, H), base=True, color="bubblegum", tint=True)
    box((w + 0.6, d + 0.6, 4.5), base=True, color="charcoal")
    fl = 4.2
    nf = int((H - 6.0) / fl)
    step = 2 if _lod1() else 1
    for i in range(0, nf, step):
        z = 6.0 + i * fl
        box((w * 0.84, d + 5.0, 1.5 * step), at=(0, 0, z), base=True, color="snow")
    for x in (-w * 0.14, w * 0.14):
        box((0.9, d + 5.4, nf * fl - 2.0), at=(x, 0, 6.0), base=True, color="bubblegum", tint=True, lod0=True)
    # stair core, rooftop water tank on legs
    box((7.0, 7.0, H + 5.0), at=(w / 2 - 1.0, 0, 0), base=True, color="cloud")
    box((w + 1.2, d + 1.2, 1.2), at=(0, 0, H), base=True, color="snow")
    for x in (-8.5, -3.5):
        for y in (-2.5, 2.5):
            cyl(0.3, 3.5, at=(x - 0.0, y, H + 1.2), color="cocoa", segs=4)
    cyl(4.0, 5.0, at=(-6.0, 0, H + 4.7), color="caramel", segs=10)
    cyl(4.3, 2.0, at=(-6.0, 0, H + 9.7), r2=0.4, color="caramel", segs=10)
    box((6.0, 1.0, 4.0), at=(0, -d / 2 - 0.3, 0), base=True, color="glass", lod0=True)


# ---------------------------------------------------------------- civic & landmarks

@asset("museum_dome", "Museum", "Home of one very old spoon. Do not touch the spoon.", 6, "stone", "landmark",
       variants=["teal", "sun", "cobalt", "flamingo"], col="box", fill=0.65)
def museum_dome():
    box((80.0, 52.0, 2.5), base=True, color="stone")
    box((76.0, 48.0, 2.0), at=(0, 0, 2.5), base=True, color="cloud")
    box((70.0, 40.0, 16.0), at=(0, 2.0, 4.5), base=True, color="paper")
    box((72.0, 42.0, 2.2), at=(0, 2.0, 20.5), base=True, color="cloud")
    # portico: steps, columns, entablature, pediment
    for i in range(3):
        box((40.0 - i * 2, 4.0, 1.2), at=(0, -26.5 + i * 1.4, 2.0 + i * 0.8), base=True, color="cloud", lod0=True)
    for i in range(8):
        cyl(1.4, 14.0, at=(-17.5 + i * 5.0, -22.5, 4.5), color="snow", segs=8)
    box((40.0, 9.0, 3.0), at=(0, -20.0, 18.5), base=True, color="paper")
    extrude([(-21.0, 0.0), (21.0, 0.0), (0.0, 8.0)], 9.0, at=(0, -20.0, 21.5), rot=(90, 0, 0), color="cloud")
    extrude([(-15.0, 0.0), (15.0, 0.0), (0.0, 5.6)], 0.6, at=(0, -24.6, 22.4), rot=(90, 0, 0), color="paper",
            lod0=True)
    box((7.0, 0.4, 10.0), at=(0, -18.0, 4.5), base=True, color="ink_soft")
    # banners between columns
    for x in (-12.5, 12.5):
        box((3.0, 0.4, 7.5), at=(x, -23.5, 9.0), base=True, color="flamingo", tint=True, lod0=True)
    # drum + dome + lantern
    cyl(15.0, 9.0, at=(0, 4.0, 22.7), color="paper", segs=16)
    if not _lod1():
        for i in range(12):
            a = math.radians(i * 30)
            box((1.4, 0.8, 6.0), at=(15.1 * math.cos(a), 4.0 + 15.1 * math.sin(a), 24.2), rot=(0, 0, i * 30 + 90),
                base=True, color="ink_soft")
    cyl(16.2, 1.4, at=(0, 4.0, 31.7), color="cloud", segs=16)
    R = 15.2
    lathe([(R * math.cos(math.radians(a)), 33.1 + R * math.sin(math.radians(a)) * 1.1) for a in
           (0, 20, 40, 58, 74, 88)] + [(0, 33.1 + R * 1.1)], at=(0, 4.0, 0), color="teal", tint=True, segs=16)
    cyl(2.6, 5.0, at=(0, 4.0, 48.8), color="paper", segs=8)
    sphere(2.8, at=(0, 4.0, 53.8), scale=(1, 1, 0.8), color="teal", tint=True, segs=8, rings=5)
    cyl(0.4, 4.0, at=(0, 4.0, 55.6), r2=0.05, color="sun", segs=4)


def _gothic_arch(w, h, n=4):
    """Pointed arch outline (x, z): straight sides then two arcs meeting at a point."""
    n = seg(n, 2)
    r = w
    pts = [(-w / 2, 0.0), (w / 2, 0.0)]
    hs = h - r * math.sin(math.acos(0.5))
    for i in range(n + 1):
        a = math.radians(0 + 60 * i / n)
        pts.append((w / 2 - r + r * math.cos(a), hs + r * math.sin(a)))
    for i in range(1, n + 1):
        a = math.radians(120 + 60 * i / n)
        pts.append((-w / 2 + r + r * math.cos(a), hs + r * math.sin(a)))
    return pts[:2] + pts[2:-1] + [pts[-1]]


@asset("cathedral", "Cathedral", "Echo guaranteed. Whispering strongly encouraged.", 6, "stone", "landmark",
       variants=["charcoal", "pine", "cobalt", "grape"], col="box", fill=0.55)
def cathedral():
    S = "sand"
    # nave + steep roof
    box((30.0, 66.0, 32.0), at=(0, 6.0, 0), base=True, color=S)
    extrude([(-16.5, 0.0), (16.5, 0.0), (0.0, 18.0)], 64.0, at=(0, 7.0, 32.0), rot=(90, 0, 0), color="charcoal",
            tint=True)
    # transept
    box((58.0, 18.0, 28.0), at=(0, 16.0, 0), base=True, color=S)
    extrude([(-15.0, 0.0), (15.0, 0.0), (0.0, 16.0)], 58.0, at=(0, 16.0, 28.0), rot=(90, 0, 90), color="charcoal",
            tint=True)
    # apse
    cyl(14.0, 30.0, at=(0, 39.0, 0), color=S, segs=12)
    cyl(15.0, 14.0, at=(0, 39.0, 30.0), r2=0.5, color="charcoal", tint=True, segs=12)
    # west front: gable between the towers
    box((24.0, 6.0, 40.0), at=(0, -26.0, 0), base=True, color=S)
    extrude([(-12.0, 0.0), (12.0, 0.0), (0.0, 13.0)], 6.0, at=(0, -26.0, 40.0), rot=(90, 0, 0), color=S)
    # twin towers + spires
    for k in (-1, 1):
        x = k * 17.0
        box((14.0, 14.0, 64.0), at=(x, -24.0, 0), base=True, color=S)
        box((15.6, 15.6, 2.0), at=(x, -24.0, 64.0), base=True, color="cloud")
        _pyramid(13.0, 34.0, (x, -24.0, 66.0), "charcoal", tint=True)
        for kx in (-1, 1):
            for ky in (-1, 1):
                cyl(1.0, 7.0, at=(x + kx * 6.6, -24.0 + ky * 6.6, 66.0), r2=0.05, color="cloud", segs=4, lod0=True)
        for z in (24.0, 44.0):
            extrude(_gothic_arch(3.6, 12.0), 0.6, at=(x, -31.2, z), rot=(90, 0, 0), color="ink_soft", lod0=True)
        box((14.6, 14.6, 1.4), at=(x, -24.0, 20.0), base=True, color="cloud", lod0=True)
    # rose window
    zr = 30.0
    cyl(8.0, 0.8, at=(0, -29.2, zr), rot=(90, 0, 0), base=False, color="cobalt", segs=16)
    torus(8.0, 1.1, at=(0, -29.4, zr), rot=(90, 0, 0), color="cloud", segs=16, rsegs=5)
    cyl(2.0, 1.4, at=(0, -29.4, zr), rot=(90, 0, 0), base=False, color="sun", segs=8)
    if not _lod1():
        for i in range(8):
            a = math.radians(i * 22.5)
            box((14.0, 1.0, 0.7), at=(0, -29.5, zr), rot=(0, i * 22.5, 0), color="cloud")
        for i in range(8):
            a = math.radians(i * 45 + 22.5)
            sphere(1.5, at=(5.0 * math.cos(a), -29.7, zr + 5.0 * math.sin(a)), scale=(1, 0.4, 1), color="sun",
                   segs=6, rings=4)
    # pointed door
    extrude(_gothic_arch(8.0, 16.0), 0.8, at=(0, -29.2, 0), rot=(90, 0, 0), color="ink_soft")
    extrude(_gothic_arch(11.0, 19.5), 0.6, at=(0, -28.9, 0), rot=(90, 0, 0), color="cloud")
    # nave windows
    if not _lod1():
        for i in range(5):
            for k in (-1, 1):
                extrude(_gothic_arch(3.6, 13.0), 0.6, at=(k * 15.1, -16.0 + i * 8.0 + (20.0 if i > 2 else 0), 10.0),
                        rot=(90, 0, 90), color="ink_soft")


@asset("factory_chimneys", "Factory", "Makes clouds, mostly. Possibly also buttons.", 6, "stone", "landmark",
       variants=["snow", "sun", "tomato"], col="box", fill=0.5)
def factory_chimneys():
    W, D, Hb = 64.0, 36.0, 14.0
    box((W, D, Hb), base=True, color="brick")
    box((W + 0.8, D + 0.8, 1.4), at=(0, 0, Hb - 1.0), base=True, color="charcoal")
    # sawtooth roof: glazed vertical faces towards the front (-Y)
    n = 5
    tw = D / n
    for i in range(n):
        y = -D / 2 + tw * i
        extrude([(0.0, 0.0), (tw, 0.0), (0.0, 8.0)], W, at=(0, y, Hb), rot=(90, 0, 90), color="charcoal")
        box((W - 1.0, 0.5, 6.4), at=(0, y - 0.05, Hb + 0.5), base=True, color="sky")
    # big doors + windows
    for x in (-18.0, 0.0):
        box((10.0, 0.6, 10.0), at=(x, -D / 2 - 0.2, 0), base=True, color="charcoal")
        box((10.8, 0.6, 1.0), at=(x, -D / 2 - 0.3, 10.0), base=True, color="snow", tint=True, lod0=True)
    for i in range(3):
        box((3.6, 0.6, 5.0), at=(12.0 + i * 6.5, -D / 2 - 0.2, 4.0), base=True, color="sky", lod0=True)
    # chimneys with stripes + smoke puffs
    stacks = [(-22.0, 10.0, 58.0, 3.6), (-10.0, 10.0, 66.0, 3.8), (2.0, 10.0, 50.0, 3.4)]
    for (x, y, h, r) in stacks:
        cyl(r, h, at=(x, y, 0), r2=r * 0.75, color="brick", segs=12)
        for t in (0.62, 0.86):
            rr = r + (r * 0.75 - r) * t
            cyl(rr + 0.35, h * 0.08, at=(x, y, h * t), r2=rr + 0.3, color="snow", tint=True, segs=12)
        cyl(r * 0.85, 1.6, at=(x, y, h - 1.0), color="charcoal", segs=12)
    for (x, z, s) in ((-10.0, 72.0, 5.5), (-5.0, 77.0, 7.0), (3.0, 79.0, 6.0), (-22.0, 63.5, 4.0)):
        sphere(s, at=(x, 10.0, z), color="snow", segs=10, rings=6, scale=(1.2, 1, 0.9))


@asset("parking_garage", "Parking Garage", "Level 3, row F. Or was it level 4? It was level 4.", 6, "stone",
       "large", variants=["sun", "tangerine", "lime", "sky"], col="box", fill=0.6)
def parking_garage():
    W, D = 44.0, 32.0
    lv = 3.4
    n = 4
    top = n * lv
    box((W - 7.0, D - 7.0, top), base=True, color="charcoal")
    for i in range(n + 1):
        z = i * lv
        box((W, D, 1.4 if i else 0.8), at=(0, 0, z), base=True, color="cloud")
        if i:
            box((W + 0.2, D + 0.2, 0.3), at=(0, 0, z + 0.55), base=True, color="sun", tint=True, lod0=True)
    for i in range(n):
        z = i * lv + 0.8
        for x in (-W / 2 + 0.6, -7.5, 7.5, W / 2 - 0.6):
            box((1.2, D, lv - 0.8), at=(x, 0, z), base=True, color="cloud",
                lod0=x not in (-W / 2 + 0.6, W / 2 - 0.6))
    # corkscrew ramp drum on the side: the stripes spiral up
    cx, r = W / 2 + 7.5, 8.0
    cyl(r - 0.6, top + 1.4, at=(cx, 0, 0), color="cloud", segs=14)
    cyl(r * 0.7, top + 2.4, at=(cx, 0, 0), color="charcoal", segs=12)
    turns, k = 3.0, 12
    m = int(turns * k)
    pts = []
    for i in range(m + 1):
        a = 2 * math.pi * i / k - math.pi / 2
        pts.append((cx + (r + 0.2) * math.cos(a), (r + 0.2) * math.sin(a), 0.9 + (top - 0.4) * i / m))
    tube(pts, 1.0, color="sun", tint=True, segs=5)
    box((8.0, 6.0, 1.4), at=(W / 2 + 2.0, 0, top), base=True, color="cloud")
    # roof: parked cars as plain blocks + stair tower + big sign
    if not _lod1():
        for (x, y, c) in ((-16.0, -9.0, "tomato"), (-10.0, -9.0, "cobalt"), (6.0, -9.0, "snow"),
                          (-16.0, 9.0, "snow"), (12.0, 9.0, "tomato")):
            box((2.2, 4.4, 1.0), at=(x, y, top + 1.4), base=True, color=c, bevel=0.3, bseg=1)
            box((1.9, 2.4, 0.8), at=(x, y + 0.2, top + 2.4), base=True, color=c, bevel=0.3, bseg=1)
    box((6.0, 6.0, top + 4.5), at=(W / 2 - 4.0, D / 2 - 4.0, 0), base=True, color="cloud")
    sx, sy = -W / 2 + 4.0, -D / 2 + 2.0
    box((1.6, 1.6, 22.0), at=(sx, sy, top), base=True, color="charcoal")
    zs = top + 14.0
    box((9.0, 1.6, 9.0), at=(sx, sy - 0.4, zs), base=True, color="cobalt", bevel=0.8, bseg=1)
    # the letter P
    yp = sy - 1.4
    box((1.4, 0.6, 6.6), at=(sx - 1.6, yp, zs + 1.2), base=True, color="snow")
    torus(1.5, 0.55, at=(sx + 0.3, yp, zs + 5.85), rot=(90, 90, 0), arc=180, color="snow", segs=8, rsegs=4)
    for z in (zs + 7.35, zs + 4.35):
        box((2.0, 0.9, 1.1), at=(sx - 0.7, yp, z), color="snow")


@asset("stadium", "Stadium", "Seats eighty thousand people. All of them have opinions.", 6, "stone", "landmark",
       variants=["tomato", "cobalt", "sun", "teal"], col="cyl", fill=0.4)
def stadium():
    sy = 0.76
    lathe([(66.0, 1.0), (70.0, 4.0), (101.0, 29.0), (108.0, 31.0), (108.0, 0.0)], scale=(1, sy, 1),
          color="tomato", tint=True, segs=24)
    cyl(108.6, 30.0, color="cloud", segs=24, scale=(1, sy, 1), caps=False)
    if not _lod1():
        for i in range(24):
            a = math.radians(i * 15 + 7.5)
            box((2.2, 2.2, 31.0), at=(109.0 * math.cos(a), 109.0 * sy * math.sin(a), 0), rot=(0, 0, i * 15),
                base=True, color="stone")
        torus(85.0, 0.9, at=(0, 0, 18.0), scale=(1, sy, 1), color="snow", segs=24, rsegs=4)
    torus(102.0, 10.0, at=(0, 0, 34.0), scale=(1, sy, 0.18), color="cloud", segs=24, rsegs=6)
    cyl(67.0, 2.0, scale=(1, sy, 1), color="leaf", segs=20)
    if not _lod1():
        for i in range(6):
            box((10.0, 88.0, 0.2), at=(-50.0 + i * 20.0, 0, 2.0), base=True, color="lime")
        box((0.6, 86.0, 0.25), at=(0, 0, 2.0), base=True, color="snow")
        torus(9.0, 0.4, at=(0, 0, 2.1), color="snow", segs=12, rsegs=3, scale=(1, 1, 0.3))
        for k in (-1, 1):
            box((14.0, 30.0, 0.25), at=(k * 45.0, 0, 2.0), base=True, color="snow")
            box((13.0, 28.8, 0.3), at=(k * 45.0, 0, 2.0), base=True, color="leaf")
    for (kx, ky) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        x, y = kx * 86.0, ky * 66.0
        cyl(1.4, 54.0, at=(x, y, 0), r2=0.9, color="cloud", segs=6)
        box((9.0, 2.0, 6.0), at=(x - kx * 0.5, y - ky * 0.5, 54.0), rot=(-ky * 20, 0, kx * ky * -50), color="snow")
        box((9.6, 1.0, 6.6), at=(x + kx * 0.3, y + ky * 0.6, 54.0), rot=(-ky * 20, 0, kx * ky * -50),
            color="charcoal")


@asset("donut_shop", "Giant Donut Shop", "The sign is edible. The sign is not for eating.", 6, "food", "large",
       variants=["flamingo", "cocoa", "sun", "mint"], col="box", fill=0.45)
def donut_shop():
    W, D, H = 28.0, 16.0, 8.0
    box((W, D, H), base=True, color="paper", bevel=0.4)
    box((W + 0.8, D + 0.8, 1.2), at=(0, 0, H), base=True, color="flamingo", tint=True)
    box((W - 8.0, 0.5, 3.4), at=(-3.0, -D / 2 - 0.1, 0.8), base=True, color="glass")
    box((3.0, 0.6, 5.0), at=(10.0, -D / 2 - 0.15, 0), base=True, color="caramel")
    # striped awning
    n = 9
    for i in range(n):
        box((W / n, 4.6, 0.6), at=(-W / 2 + W / n * (i + 0.5), -D / 2 - 2.0, 5.6), rot=(-30, 0, 0),
            color="flamingo" if i % 2 == 0 else "paper", tint=i % 2 == 0)
        sphere(W / n / 2, at=(-W / 2 + W / n * (i + 0.5), -D / 2 - 4.0, 4.45), scale=(1, 0.35, 0.6),
               color="flamingo" if i % 2 == 0 else "paper", tint=i % 2 == 0, segs=8, rings=4, lod0=True)
    # the donut
    R, r = 9.6, 4.9
    zc = H + 1.2 + 2.0 + R + r
    for x in (-5.0, 5.0):
        box((1.6, 1.6, 5.0), at=(x, 0, H + 1.2), base=True, color="charcoal")
    torus(R, r, at=(0, 0, zc), rot=(90, 0, 0), color="caramel", segs=20, rsegs=10)
    ri = r * 0.86
    torus(R, ri, at=(0, -r * 0.3, zc), rot=(90, 0, 0), color="flamingo", tint=True, segs=20, rsegs=10,
          scale=(1, 1, 0.95))
    if not _lod1():
        cols = ("sun", "snow", "sky")
        for i in range(22):
            th = math.radians(i * 360 / 22 + 7)
            d = (-0.45 if i % 2 else 0.45) * ri
            rr = R + d
            y = -r * 0.3 - math.sqrt(max(0.0, ri * ri - d * d)) * 0.95 - 0.1
            box((2.6, 0.9, 0.9), at=(rr * math.cos(th), y, zc + rr * math.sin(th)), rot=(0, i * 53, 0),
                color=cols[i % 3], bevel=0.3, bseg=1)


@asset("obelisk", "Obelisk", "A very tall point, made very carefully.", 6, "stone", "landmark", col="box",
       fill=0.25)
def obelisk():
    box((26.0, 26.0, 3.0), base=True, color="stone")
    box((21.0, 21.0, 3.0), at=(0, 0, 3.0), base=True, color="cloud")
    box((16.0, 16.0, 10.0), at=(0, 0, 6.0), base=True, color="stone")
    box((17.0, 17.0, 1.4), at=(0, 0, 14.6), base=True, color="cloud")
    tp = 0.6
    box((12.0, 12.0, 126.0), at=(0, 0, 16.0), base=True, color="cloud", taper=(tp, tp))
    box((12.8, 12.8, 2.0), at=(0, 0, 16.0), base=True, color="sun")
    _pyramid(12.0 * tp, 9.0, (0, 0, 142.0), "sun")
    box((5.0, 0.6, 3.0), at=(0, -8.2, 8.0), base=True, color="sun", lod0=True)
    for kx in (-1, 1):
        for ky in (-1, 1):
            cyl(0.6, 6.0, at=(kx * 11.5, ky * 11.5, 3.0), color="charcoal", segs=6, lod0=True)
            sphere(1.2, at=(kx * 11.5, ky * 11.5, 9.6), color="sun", segs=6, rings=4, lod0=True)


@asset("giant_statue", "Monument to Tidiness", "Her broom has never once touched dust. It is ceremonial.", 6,
       "metal", "landmark", variants=["sun", "mint", "caramel", "cloud"], col="box", fill=0.35)
def giant_statue():
    # pedestal
    box((28.0, 28.0, 5.0), base=True, color="stone")
    box((20.0, 20.0, 15.0), at=(0, 0, 5.0), base=True, color="stone")
    box((23.0, 23.0, 2.5), at=(0, 0, 20.0), base=True, color="cloud")
    box((22.0, 22.0, 2.0), at=(0, 0, 5.0), base=True, color="cloud")
    box((9.0, 0.6, 4.0), at=(0, -10.2, 11.0), base=True, color="sun", lod0=True)
    z0 = 22.5
    G = "sun"
    # grand gown, pompous bosom, raised chin
    lathe([(0, z0), (10.0, z0), (9.4, z0 + 4.0), (7.4, z0 + 14.0), (5.6, z0 + 22.0), (5.4, z0 + 25.0),
           (6.8, z0 + 29.5), (6.6, z0 + 33.0), (5.0, z0 + 36.5), (2.0, z0 + 38.0), (0, z0 + 38.0)],
          color=G, tint=True, segs=14)
    lathe([(10.4, z0), (10.6, z0 + 1.2), (10.0, z0 + 3.0), (0, z0 + 3.0)], color=G, tint=True, segs=14)
    # sash
    tube([(-5.3, -3.6, z0 + 33.5), (0.0, -6.4, z0 + 28.0), (5.4, -4.4, z0 + 22.5)], 1.2, color="flamingo",
         segs=6, smooth_path=1)
    sphere(1.7, at=(5.3, -4.8, z0 + 22.4), color="flamingo", segs=8, rings=5)
    # head, bun, nose in the air
    hz = z0 + 43.0
    cyl(2.0, 4.0, at=(0, 0, z0 + 36.0), color=G, tint=True, segs=8)
    hz += 0.6
    sphere(5.6, at=(0, 0, hz), color=G, tint=True, segs=14, rings=9)
    sphere(3.8, at=(0.0, 2.4, hz + 5.0), color=G, tint=True, segs=10, rings=7)
    sphere(1.2, at=(0, -5.6, hz + 0.2), scale=(1, 1.3, 0.9), rot=(-20, 0, 0), color=G, tint=True, segs=8, rings=5)
    eyes((0, -5.0, hz + 1.6), 3.8, 0.75, pitch=-20)
    torus(5.0, 0.7, at=(0, 0.6, hz + 2.6), rot=(-14, 0, 0), color="flamingo", segs=14, rsegs=4)
    # arm akimbo
    tube([(-6.0, 0.0, z0 + 33.5), (-10.0, -1.0, z0 + 28.5), (-6.0, -1.5, z0 + 23.5)], 1.8, color=G, tint=True,
         segs=8)
    # arm raised with the broom aloft
    hx, hy, hzz = 8.4, -1.5, z0 + 51.0
    tube([(6.0, 0.0, z0 + 33.5), (9.6, -1.0, z0 + 41.0), (hx, hy, hzz)], 1.8, color=G, tint=True, segs=8)
    sphere(2.1, at=(hx, hy, hzz), color=G, tint=True, segs=8, rings=5)
    tilt = 16.0
    dx, dz = math.sin(math.radians(tilt)), math.cos(math.radians(tilt))

    def along(t):
        return (hx + dx * t, hy, hzz + dz * t)

    tube([along(-7.0), along(11.0)], 0.8, color="cocoa", segs=6)
    cyl(1.8, 2.4, at=along(10.0), rot=(0, tilt, 0), color="cocoa", segs=8)
    # straw fan with ragged bristle tips
    fan = [(-1.6, 0.0), (1.6, 0.0), (5.4, 9.0)]
    for i in range(5):
        u = 5.4 - 10.8 * (i + 0.5) / 5
        fan += [(u + 1.08, 11.5), (u, 9.4)]
    fan += [(-5.4, 11.5), (-5.4, 9.0)]
    extrude(fan, 2.6, at=along(12.2), rot=(90, tilt, 0), color="caramel")
    box((6.4, 2.9, 0.9), at=along(15.0), rot=(0, tilt, 0), color="cocoa", lod0=True)


@asset("observation_tower", "Observation Tower", "Great view of the city. Terrible view of the tower.", 6,
       "stone", "landmark", variants=["tomato", "cobalt", "sun", "flamingo"], col="cyl", fill=0.1)
def observation_tower():
    lathe([(18.0, 0.0), (18.0, 3.0), (11.0, 8.0), (7.0, 30.0), (5.4, 120.0), (4.6, 200.0), (0, 200.0)],
          color="cloud", segs=12)
    zp = 196.0
    lathe([(4.0, zp - 2.0), (14.0, zp + 2.0), (22.5, zp + 8.0), (24.0, zp + 11.0), (22.5, zp + 16.0),
           (15.0, zp + 20.5), (5.0, zp + 23.0), (0, zp + 23.0)], color="tomato", tint=True, segs=16)
    cyl(24.0, 4.6, at=(0, 0, zp + 9.0), r2=23.4, color="glass", segs=16)
    cyl(4.0, 20.0, at=(0, 0, zp + 23.0), r2=3.4, color="cloud", segs=10)
    sphere(6.0, at=(0, 0, zp + 46.0), scale=(1, 1, 0.75), color="tomato", tint=True, segs=12, rings=7)
    cyl(6.1, 1.4, at=(0, 0, zp + 45.3), color="glass", segs=12)
    cyl(1.6, 55.0, at=(0, 0, zp + 49.0), r2=0.2, color="cloud", segs=6)
    for t in (0.18, 0.42):
        cyl(1.6 * (1 - t) + 0.45, 4.0, at=(0, 0, zp + 49.0 + 55.0 * t), color="tomato", tint=True, segs=6)
    if not _lod1():
        for z in (60.0, 110.0, 160.0):
            r = 7.0 + (4.6 - 7.0) * (z - 30.0) / 170.0 + 0.5
            cyl(r, 2.0, at=(0, 0, z), color="tomato", tint=True, segs=12)


@asset("big_wheel", "Big Wheel", "Goes round once every half hour. Nobody minds.", 6, "metal", "landmark",
       variants=["flamingo", "sky", "sun", "lime"], col="box", fill=0.15)
def big_wheel():
    hz, R = 67.0, 54.0
    box((74.0, 36.0, 3.0), base=True, color="charcoal")
    for y in (-2.6, 2.6):
        torus(R, 1.9, at=(0, y, hz), rot=(90, 0, 0), color="snow", segs=32, rsegs=5)
    torus(R * 0.45, 1.1, at=(0, 0, hz), rot=(90, 0, 0), color="snow", segs=16, rsegs=4, lod0=True)
    for i in range(8):
        box((2 * R, 1.0, 1.0), at=(0, 0, hz), rot=(0, i * 22.5, 0), color="snow")
    cyl(5.5, 10.0, at=(0, 0, hz), rot=(90, 0, 0), base=False, color="stone", segs=12)
    cyl(2.6, 11.0, at=(0, 0, hz), rot=(90, 0, 0), base=False, color="flamingo", tint=True, segs=10)
    for ky in (-1, 1):
        for kx in (-1, 1):
            tube([(0, ky * 4.5, hz), (kx * 32.0, ky * 15.0, 3.0)], 2.0, color="stone", segs=6)
        box((64.0, 1.6, 1.6), at=(0, ky * 12.0, 12.0), color="stone", lod0=True)
    n = 14
    for i in range(n):
        a = math.radians(i * 360 / n + 13)
        x, z = (R + 4.6) * math.cos(a), hz + (R + 4.6) * math.sin(a)
        c, t = ("flamingo", True) if i % 2 == 0 else ("sun", False)
        sphere(4.2, at=(x, 0, z - 1.0), scale=(1, 1, 1.12), color=c, tint=t, segs=10, rings=6)
        box((4.6, 8.6, 1.6), at=(x, 0, z - 0.6), color="glass", lod0=True)


@asset("rocket_pad", "Rocket on Launch Pad", "Ten, nine, eight... has anyone seen the keys?", 6, "metal",
       "landmark", variants=["tomato", "cobalt", "tangerine", "grape"], col="box", fill=0.3)
def rocket_pad():
    box((52.0, 44.0, 5.0), base=True, color="charcoal", bevel=0.6)
    box((16.0, 46.0, 2.4), at=(-6.0, 0, 3.0), base=True, color="ink", lod0=True)
    zr = 8.0
    for x in (-10.0, 2.0):
        box((2.5, 2.5, 3.0), at=(x, 0, 5.0), base=True, color="stone")
    rx = -4.0
    # rocket body
    lathe([(0, zr), (5.4, zr), (6.0, zr + 4.0), (6.0, zr + 64.0), (5.4, zr + 72.0), (0, zr + 72.0)],
          at=(rx, 0, 0), color="snow", segs=16)
    lathe([(5.5, zr + 71.0), (5.0, zr + 76.0), (3.8, zr + 83.0), (2.0, zr + 89.0), (0.5, zr + 92.0), (0, zr + 92.0)],
          at=(rx, 0, 0), color="tomato", tint=True, segs=16)
    cyl(6.15, 3.0, at=(rx, 0, zr + 48.0), color="tomato", tint=True, segs=16)
    cyl(6.15, 2.0, at=(rx, 0, zr + 20.0), color="ink_soft", segs=16, lod0=True)
    for z in (zr + 58.0, zr + 63.5):
        cyl(1.9, 1.0, at=(rx, -5.7, z), rot=(90, 0, 0), base=False, color="ink_soft", segs=10, lod0=True)
        cyl(1.3, 1.2, at=(rx, -5.8, z), rot=(90, 0, 0), base=False, color="sky", segs=10, lod0=True)
    # fins
    for k in range(4):
        extrude([(5.0, 0.0), (13.0, -4.0), (13.0, 4.0), (5.0, 18.0)], 1.2, at=(rx, 0, zr - 3.5),
                rot=(90, 0, 45 + 90 * k), color="tomato", tint=True)
    # side boosters
    for k in (-1, 1):
        bx = rx + k * 8.6
        cyl(2.6, 38.0, at=(bx, 0, zr - 2.0), color="cloud", segs=10)
        cyl(2.6, 6.0, at=(bx, 0, zr + 36.0), r2=0.3, color="cloud", segs=10)
        cyl(2.0, 2.0, at=(bx, 0, zr - 3.5), r2=2.6, color="charcoal", segs=8)
    cyl(4.0, 3.0, at=(rx, 0, zr - 3.0), r2=5.0, color="charcoal", segs=10)
    # launch gantry
    gx, gs, gh = 17.0, 8.0, 96.0
    for kx in (-1, 1):
        for ky in (-1, 1):
            box((1.2, 1.2, gh), at=(gx + kx * gs / 2, ky * gs / 2, 5.0), base=True, color="sun")
    nb = 6 if _lod1() else 12
    for i in range(nb):
        z = 5.0 + gh * (i + 1) / nb
        box((gs + 1.2, gs + 1.2, 1.0), at=(gx, 0, z - 1.0), base=True, color="sun")
    if not _lod1():
        for i in range(12):
            z = 5.0 + gh * (i + 0.5) / 12
            ang = math.degrees(math.atan2(gh / 12, gs))
            box((math.hypot(gs, gh / 12), 0.5, 0.5), at=(gx, -gs / 2, z), rot=(0, ang if i % 2 else -ang, 0),
                color="sun")
            box((0.5, math.hypot(gs, gh / 12), 0.5), at=(gx - gs / 2, 0, z), rot=(ang if i % 2 else -ang, 0, 0),
                color="sun")
    for z in (zr + 60.0, zr + 34.0):
        box((gx - rx - gs / 2 - 5.0, 2.4, 2.0), at=((gx - gs / 2 + rx + 6.0) / 2, 0, z), color="charcoal")
    box((gs + 4.0, gs + 4.0, 2.0), at=(gx, 0, 5.0 + gh), base=True, color="charcoal")
    tube([(gx, 0, 7.0 + gh), (gx, 0, 7.0 + gh + 6.0)], 0.4, color="charcoal", segs=4)
    sphere(1.0, at=(gx, 0, 13.5 + gh), color="tomato", segs=6, rings=4)


@asset("bridge_tower", "Suspension Bridge Tower", "Holds up half a bridge. Insufferably proud of it.", 6, "metal",
       "landmark", variants=["tomato", "sky", "sun", "cloud"], col="box", fill=0.12)
def bridge_tower():
    C = "tomato"
    H = 148.0
    xl = 15.0
    zd = 48.0
    for k in (-1, 1):
        box((14.0, 16.0, 10.0), at=(k * xl, 0, 0), base=True, color="cloud", bevel=0.8)
        box((8.0, 9.0, H - 10.0), at=(k * xl, 0, 10.0), base=True, color=C, tint=True, taper=(0.7, 0.75))
        box((6.6, 7.8, 3.0), at=(k * xl * 0.99, 0, H), base=True, color=C, tint=True)
        if not _lod1():
            box((1.2, 9.4, 80.0), at=(k * xl, 0, 60.0), base=True, color=C, tint=True, taper=(0.8, 0.8))
    for (z, h) in ((zd - 6.0, 6.0), (95.0, 5.0), (H - 6.0, 6.0)):
        box((2 * xl, 6.0, h), at=(0, 0, z), base=True, color=C, tint=True)
        if not _lod1():
            for k in (-1, 1):
                box((5.0, 6.2, 2.0), at=(k * (xl - 5.5), 0, z - 2.0), rot=(0, k * 30, 0), base=True, color=C,
                    tint=True)
    # deck segment
    L = 140.0
    box((2 * xl + 8.0, L, 3.0), at=(0, 0, zd), base=True, color="charcoal")
    box((2 * xl + 9.0, L + 0.2, 1.4), at=(0, 0, zd + 3.0), base=True, color=C, tint=True)
    box((2 * xl + 5.0, L, 1.0), at=(0, 0, zd + 2.4), base=True, color="charcoal")
    if not _lod1():
        for x in (-6.0, 6.0):
            for i in range(9):
                box((0.6, 8.0, 0.2), at=(x, -L / 2 + 8.0 + i * 16.0, zd + 3.45), base=True, color="snow")
    # main cables + suspenders
    for k in (-1, 1):
        x = k * (xl + 0.0)
        for sgn in (-1, 1):
            pts = []
            for i in range(9):
                t = i / 8
                y = sgn * 70.0 * t
                pts.append((x, y, (zd + 9.0) + (H + 1.5 - zd - 9.0) * (1 - t) ** 2))
            tube(pts, 1.0, color=C, tint=True, segs=6, caps=False)
            if not _lod1():
                for i in range(1, 9):
                    t = i / 9
                    zc = (zd + 9.0) + (H + 1.5 - zd - 9.0) * (1 - t) ** 2
                    box((0.3, 0.3, zc - zd - 3.0), at=(x, sgn * 70.0 * t, zd + 3.0), base=True, color="charcoal")


@asset("fluffy_cloud", "Fluffy Cloud", "Technically sky lint. The final boss of fluff.", 6, "soft", "large",
       variants=["snow", "bubblegum", "butter", "lavender"], col="box", flags=["float"], fill=0.5)
def fluffy_cloud():
    sphere(50.0, at=(0, 0, 13.0), scale=(1.1, 0.5, 0.28), color="cloud", segs=16, rings=8)
    puffs = [(0.0, 2.0, 27.0, 24.0), (-27.0, 4.0, 20.0, 19.0), (27.0, -2.0, 22.0, 20.0), (-47.0, 0.0, 13.0, 12.0),
             (47.0, 3.0, 13.0, 12.5), (10.0, -9.0, 15.0, 13.0)]
    for (x, y, z, r) in puffs:
        sphere(r, at=(x, y, z), color="snow", tint=True, segs=14, rings=9)
