"""Level 1 — Crumb Patrol (breakfast table), part B. Objects face -Y; base at z = 0; metres."""
import math

from mathutils import Matrix

from lib.core import box, cyl, sphere, ico, torus, lathe, extrude, tube, capsule, eyes, ngon_points, \
    star_points, rounded_rect_points
from lib.registry import asset


# ---------------------------------------------------------------- local helpers

def _lathe(profile, **kw):
    """lathe() with its end poles swapped for ngon caps: core's pole fans are wound inward (they vanish
    under back-face culling). A flat end just drops the pole; a domed end gets a tiny capped ring."""
    prof = list(profile)
    for end in (-1, 0):
        r, z = prof[end]
        if r > 1e-6:
            continue
        nb = prof[-2] if end == -1 else prof[1]
        if abs(nb[1] - z) < 1e-9:
            prof.pop(end)
        else:
            prof[end] = (max(nb[0] * 0.15, 2e-5), z)
    lathe(prof, **kw)


def _torus(R, r, scale=None, **kw):
    """torus() mirrored in its own Z: same shape, but core's faces are wound inward and the mirror fixes that."""
    sx, sy, sz = scale or (1, 1, 1)
    torus(R, r, scale=(sx, sy, -sz), **kw)


def _xz(points, depth, at=(0, 0, 0), **kw):
    """Flat shape drawn in the XZ plane as (x, z), extruded along Y and centred on at[1]."""
    extrude(points, depth, at=at, rot=(90, 0, 0), **kw)


def _yz(points, width, at=(0, 0, 0), **kw):
    """Side profile drawn in the YZ plane as (y, z), extruded along X and centred on at[0]."""
    extrude([(-z, y) for (y, z) in points], width, at=at, rot=(0, 90, 0), **kw)


def _along_x(spin=0.0):
    """Euler (degrees) laying a local-Z part (lathe/cyl) along +X, spun `spin` degrees about its own axis."""
    m = Matrix.Rotation(math.radians(90), 3, "Y") @ Matrix.Rotation(math.radians(spin), 3, "Z")
    return tuple(math.degrees(a) for a in m.to_euler("XYZ"))


def _arc(cx, cy, r, a0, a1, n):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def _blob(n, r, wob, seed=0.0, sx=1.0, sy=1.0):
    """Lumpy closed outline (egg whites, cookies, syrup puddles)."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + wob * (0.6 * math.sin(3 * a + seed) + 0.4 * math.sin(5 * a + 2.1 * seed))
        pts.append((r * k * sx * math.cos(a), r * k * sy * math.sin(a)))
    return pts


def _leaf_pts(length, width, n=4):
    """Pointed leaf outline from (0, 0) along +X, widest a little before the middle."""
    up, down = [], []
    for i in range(n + 1):
        t = i / n
        w = width / 2 * math.sin(math.pi * t ** 0.8)
        up.append((length * t, w))
        if 0 < i < n:
            down.append((length * t, -w))
    return up + list(reversed(down))


def _heart_pts(width, n=16):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x * width / 32, y * width / 32))
    return pts


def _r_at(profile, z):
    """Radius of a lathe profile [(r, z), ...] at height z (first matching segment)."""
    for (r0, z0), (r1, z1) in zip(profile[:-1], profile[1:]):
        if min(z0, z1) <= z <= max(z0, z1) and abs(z1 - z0) > 1e-9:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return profile[0][0]


def _dot_on(profile, z, ang, r, color, center=(0, 0), squash=0.45, lod0=True, segs=8):
    """Flattened dot stuck to the surface of a lathed body at height z, angle ang (degrees from +X)."""
    rr = _r_at(profile, z)
    a = math.radians(ang)
    sphere(r, at=(center[0] + rr * math.cos(a), center[1] + rr * math.sin(a), z), rot=(0, 0, ang),
           scale=(squash, 1, 1), color=color, segs=segs, lod0=lod0)


# ================================================================ tiny things

@asset("ant", "Ant", "Carries fifty times its weight. Refuses to carry yours.", 1, "living", "tiny",
       col="sphere", flags=["creature", "wander", "flee"], fill=0.3)
def ant():
    body = "brick"
    sphere(0.0019, at=(0, 0.0025, 0.0029), scale=(0.85, 1.3, 0.9), rot=(-20, 0, 0), color=body, segs=7)  # gaster
    ico(0.0009, at=(0, -0.0001, 0.0021), color=body, scale=(0.8, 1.35, 0.8))  # thorax
    sphere(0.0014, at=(0, -0.0025, 0.0027), color=body, segs=7)  # head
    for k in (-1, 1):
        for j, y in enumerate((-0.0008, -0.0001, 0.0006)):
            dy = (j - 1) * 0.0018
            tube([(0.0003 * k, y, 0.0019), (0.0014 * k, y + dy * 0.4, 0.0024), (0.0023 * k, y + dy, 0.0)], 0.00016,
                 color=body, segs=3, caps=False, lod0=True)
        tube([(0.0004 * k, -0.003, 0.0038), (0.0007 * k, -0.0033, 0.0061), (0.0019 * k, -0.0052, 0.0066)], 0.0002,
             color=body, segs=3, caps=False, lod0=True)
        ico(0.00045, at=(0.00062 * k, -0.0036, 0.003), color="ink", lod0=True)


@asset("blueberry", "Blueberry", "Technically a berry. Spiritually a marble.", 1, "food", "tiny", col="sphere",
       fill=0.52)
def blueberry():
    sphere(0.006, at=(0, 0, 0.0055), scale=(1, 1, 0.9), color="cobalt", segs=10)
    extrude(star_points(5, 0.0028, 0.0012), 0.0012, at=(0, 0, 0.0102), color="navy", center=False)


@asset("cereal_loop", "Cereal Loop", "A life ring for ants. Also delicious.", 1, "food", "tiny",
       variants=["tangerine", "tomato", "sun", "leaf", "grape"], col="cyl", fill=0.5)
def cereal_loop():
    _torus(0.0047, 0.0019, at=(0, 0, 0.0016), color="tangerine", segs=10, rsegs=6, tint=True,
          scale=(1, 1, 0.85))


@asset("sugar_cube", "Sugar Cube", "Perfectly square. Dissolves under pressure.", 1, "food", "tiny", col="box",
       fill=0.95)
def sugar_cube():
    box((0.0125, 0.0125, 0.0115), base=True, color="snow", bevel=0.0012, bseg=1)
    for (x, y) in ((0.0085, -0.004), (-0.002, -0.0085), (0.009, 0.003)):
        box((0.0013, 0.0013, 0.0013), at=(x, y, 0.0), rot=(0, 0, 25 * x / 0.003), base=True, color="snow",
            lod0=True)


@asset("button", "Button", "Fell off a coat. Now an independent contractor.", 1, "plastic", "tiny",
       variants=["tomato", "sky", "sun", "leaf", "flamingo"], col="cyl", fill=0.8)
def button():
    _lathe([(0.0, 0.0), (0.007, 0.0), (0.0069, 0.0024), (0.0054, 0.0019), (0.0, 0.0014)], color="tomato",
          segs=14, tint=True)
    for (x, y) in ((0.0016, 0.0016), (-0.0016, 0.0016), (0.0016, -0.0016), (-0.0016, -0.0016)):
        cyl(0.0008, 0.0005, at=(x, y, 0.0013), color="ink", segs=6, lod0=True)


@asset("thumbtack", "Thumbtack", "Lands point-up. Every. Single. Time.", 1, "metal", "tiny",
       variants=["tomato", "sky", "sun", "leaf"], col="cyl", fill=0.3)
def thumbtack():
    _lathe([(0.0, 0.0), (0.0026, 0.0003), (0.0042, 0.001), (0.0048, 0.0016)], color="tomato", segs=10, tint=True)
    cyl(0.0058, 0.0013, at=(0, 0, 0.0016), color="tomato", segs=12, tint=True, bevel=0.0004)
    cyl(0.0006, 0.0075, at=(0, 0, 0.0029), r2=0.00005, color="stone", segs=6)


@asset("ring", "Ring", "Said yes to nobody. Still sparkles about it.", 1, "metal", "small",
       variants=["flamingo", "sky", "leaf", "grape"], col="box", fill=0.25)
def ring():
    _torus(0.0075, 0.0015, at=(0, 0, 0.009), rot=(90, 0, 0), color="sun", segs=16, rsegs=6)
    cyl(0.0026, 0.0018, at=(0, 0, 0.0172), color="sun", segs=8)
    _lathe([(0.0, 0.0), (0.0037, 0.0026), (0.0026, 0.0043), (0.0, 0.0043)], at=(0, 0, 0.0184), color="flamingo",
          segs=8, tint=True, smooth=False)


@asset("thimble", "Thimble", "A tiny helmet for a very brave finger.", 1, "metal", "small", col="cyl", fill=0.6)
def thimble():
    prof = [(0.0, 0.0), (0.0085, 0.0), (0.0084, 0.003), (0.0076, 0.016), (0.0068, 0.0195), (0.0045, 0.0215),
            (0.0, 0.022)]
    _lathe(prof, color="cloud", segs=14)
    _torus(0.0085, 0.0013, at=(0, 0, 0.0019), color="sun", segs=12, rsegs=4)
    for row, z in enumerate((0.0065, 0.0105, 0.0145)):
        for i in range(6):
            a = 360 * (i + 0.5 * (row % 2)) / 6
            rr = _r_at(prof, z)
            ico(0.0011, at=(rr * math.cos(math.radians(a)), rr * math.sin(math.radians(a)), z), color="stone",
                lod0=True)
    for i in range(3):
        a = math.radians(120 * i + 30)
        ico(0.0011, at=(0.0022 * math.cos(a), 0.0022 * math.sin(a), 0.0218), color="stone", lod0=True)


@asset("bottle_cap", "Bottle Cap", "Popped off with a hiss. Still salty about it.", 1, "metal", "small",
       variants=["tomato", "cobalt", "leaf", "sun"], col="cyl", fill=0.7)
def bottle_cap():
    extrude(star_points(18, 0.0135, 0.0121), 0.0058, color="tomato", tint=True, center=False)
    cyl(0.0117, 0.0009, at=(0, 0, 0.0058), color="tomato", segs=18, tint=True, bevel=0.0004)
    extrude(star_points(5, 0.0068, 0.0029), 0.0006, at=(0, 0, 0.0066), color="snow", center=False, lod0=True)


@asset("grape", "Grape", "Left the bunch to find itself.", 1, "food", "tiny", variants=["grape", "lime"],
       col="sphere", fill=0.52)
def grape():
    sphere(0.0085, at=(0, 0, 0.0085), scale=(0.95, 0.95, 1.18), rot=(0, 25, 0), color="grape", segs=10, tint=True)
    a = math.radians(25)
    cyl(0.001, 0.0045, at=(0.0094 * math.sin(a), 0, 0.0085 + 0.0094 * math.cos(a)), rot=(0, 25, 0),
        color="pine", segs=5)


@asset("cherry_pair", "Cherry Pair", "Inseparable. Literally joined at the stem.", 1, "food", "small", col="box",
       fill=0.35)
def cherry_pair():
    sphere(0.011, at=(-0.0125, 0.002, 0.0105), scale=(1.05, 1.05, 0.95), color="tomato", segs=12)
    sphere(0.011, at=(0.0115, -0.003, 0.0105), scale=(1.05, 1.05, 0.95), color="tomato", segs=12)
    tube([(-0.0125, 0.002, 0.018), (-0.0095, 0.001, 0.032), (0.0, 0.0, 0.046)], 0.0011, color="pine", segs=5,
         smooth_path=1)
    tube([(0.0115, -0.003, 0.018), (0.009, -0.002, 0.032), (0.0, 0.0, 0.046)], 0.0011, color="pine", segs=5,
         smooth_path=1)
    extrude(_leaf_pts(0.022, 0.011), 0.0012, at=(0.0, 0.0, 0.046), rot=(-10, -25, 20), color="leaf")


@asset("wrapped_candy", "Wrapped Candy", "A tiny bow tie you're allowed to eat.", 1, "food", "small",
       variants=["tomato", "sky", "lime", "grape", "flamingo"], col="box", fill=0.45)
def wrapped_candy():
    sphere(0.0085, at=(0, 0, 0.0085), scale=(1.3, 1, 1), color="tomato", segs=12, tint=True)
    for k in (-1, 1):
        _lathe([(0.0028, 0.0), (0.0016, 0.0028), (0.0078, 0.0095), (0.0068, 0.011), (0.0, 0.0085)],
              at=(k * 0.0092, 0, 0.0085), rot=(0, 90 * k, 0), color="tomato", segs=8, tint=True, smooth=False)
        _torus(0.0078, 0.0011, at=(k * 0.0042, 0, 0.0085), rot=(0, 90, 0), color="snow", segs=12, rsegs=4, lod0=True)


@asset("snail", "Snail", "Brought its whole house. Will not be leaving soon.", 1, "living", "small", col="box",
       flags=["creature", "wander"], fill=0.45)
def snail():
    skin = "sand"
    tube([(0, -0.013, 0.004), (0, 0.002, 0.0036), (0, 0.018, 0.0022)], 0.0045, r_end=0.0016, color=skin, segs=6,
         smooth_path=1)  # foot
    tube([(0, -0.011, 0.004), (0, -0.016, 0.009), (0, -0.0172, 0.013)], 0.0044, r_end=0.004, color=skin, segs=6)
    sphere(0.0046, at=(0, -0.0172, 0.0138), color=skin, segs=8)  # head
    for k in (-1, 1):
        tube([(0.0016 * k, -0.0178, 0.016), (0.0036 * k, -0.019, 0.0225)], 0.0008, color=skin, segs=4, lod0=True)
        sphere(0.0018, at=(0.0036 * k, -0.019, 0.0235), color=skin, segs=7, lod0=True)
        sphere(0.001, at=(0.0036 * k, -0.0203, 0.0237), scale=(1, 0.6, 1.15), color="ink", segs=6, lod0=True)
        sphere(0.00036, at=(0.0036 * k - 0.0003, -0.0209, 0.0241), color="snow", segs=5, lod0=True)
    rs, sy, sz = 0.012, 0.0045, 0.0155
    sphere(rs, at=(0, sy, sz), scale=(0.72, 1, 1), color="caramel", segs=12)  # shell
    for k in (-1, 1):
        pts = []
        for i in range(11):
            t = i / 10
            rho = 0.0098 * (1 - 0.88 * t)
            th = math.radians(250) - t * 2 * math.pi * 1.55
            x = 0.72 * rs * math.sqrt(max(0.0, 1 - (rho / rs) ** 2)) + 0.0003
            pts.append((k * x, sy + rho * math.cos(th), sz + rho * math.sin(th)))
        tube(pts, 0.001, color="cocoa", segs=4, lod0=True)


@asset("eraser", "Eraser", "Undoes mistakes. Shrinks a little with every one.", 1, "rubber", "small",
       variants=["cobalt", "leaf", "tomato", "grape"], col="box", fill=0.9)
def eraser():
    box((0.044, 0.021, 0.012), base=True, color="bubblegum", bevel=0.0025, bseg=2)
    box((0.025, 0.0222, 0.0132), at=(0.004, 0, -0.0006), base=True, color="cobalt", tint=True, bevel=0.0008, bseg=1)
    box((0.004, 0.0226, 0.0136), at=(-0.0045, 0, -0.0008), base=True, color="snow", lod0=True)


@asset("spool", "Spool of Thread", "Forty metres of plans to hem something, someday.", 1, "soft", "small",
       variants=["tomato", "cobalt", "leaf", "sun", "flamingo"], col="cyl", fill=0.85)
def spool():
    cyl(0.0165, 0.0045, color="sand", segs=14, bevel=0.0012)
    cyl(0.0165, 0.0045, at=(0, 0, 0.0355), color="sand", segs=14, bevel=0.0012)
    cyl(0.0138, 0.031, at=(0, 0, 0.0045), color="tomato", segs=14, tint=True)
    cyl(0.0035, 0.0008, at=(0, 0, 0.0397), color="cocoa", segs=8, lod0=True)  # hole
    tube([(0.0098, -0.0098, 0.03), (0.0142, -0.0142, 0.02), (0.0175, -0.019, 0.006), (0.021, -0.025, 0.0008),
          (0.03, -0.028, 0.0008), (0.033, -0.024, 0.0008)], 0.0008, color="tomato", tint=True, segs=4, smooth_path=1,
         lod0=True)


@asset("chess_pawn", "Chess Pawn", "Dreams of crossing the board and getting a crown.", 1, "wood", "small",
       variants=["paper", "charcoal"], col="cyl", fill=0.55)
def chess_pawn():
    _lathe([(0.0, 0.0), (0.0135, 0.0), (0.0132, 0.0045), (0.0118, 0.0062), (0.0095, 0.0085), (0.0068, 0.016),
           (0.0052, 0.025), (0.0088, 0.0265), (0.0088, 0.0292), (0.0045, 0.0305), (0.0, 0.031)],
          color="paper", segs=14, tint=True)
    sphere(0.0082, at=(0, 0, 0.0385), color="paper", segs=14, tint=True)


@asset("battery", "Battery", "Fully charged. Mostly with opinions.", 1, "electronic", "small",
       variants=["tangerine", "lime", "sky"], col="box", fill=0.75)
def battery():
    r = 0.0072
    cyl(r, 0.033, at=(-0.025, 0, r), rot=(0, 90, 0), color="charcoal", segs=14)
    cyl(r + 0.0001, 0.015, at=(0.008, 0, r), rot=(0, 90, 0), color="tangerine", segs=14, tint=True)
    cyl(0.0026, 0.0018, at=(0.023, 0, r), rot=(0, 90, 0), color="stone", segs=8)
    box((0.0052, 0.0012, 0.0014), at=(0.0155, -r, r), color="snow", lod0=True)
    box((0.0014, 0.0012, 0.0052), at=(0.0155, -r, r), color="snow", lod0=True)


@asset("key", "Key", "Opens one door. Nobody remembers which.", 1, "metal", "small", col="box", fill=0.3)
def key():
    _torus(0.0095, 0.0036, at=(-0.019, 0, 0.0025), color="sun", segs=14, rsegs=6, scale=(1, 1, 0.7))
    box((0.033, 0.0058, 0.0046), at=(0.005, 0, 0), base=True, color="sun", bevel=0.001, bseg=1)
    extrude([(0.009, -0.002), (0.0215, -0.002), (0.0215, -0.0125), (0.0185, -0.0125), (0.0185, -0.009),
             (0.0158, -0.009), (0.0158, -0.0135), (0.0124, -0.0135), (0.0124, -0.0085), (0.009, -0.0085)],
            0.0046, color="sun", center=False)


@asset("paperclip", "Paperclip", "Holds things together. Emotionally, too.", 1, "metal", "small",
       variants=["cloud", "tomato", "sky", "lime", "sun"], col="box", fill=0.2)
def paperclip():
    mm = 0.001
    r = 0.00085
    pts = [(5, -2)]
    pts += _arc(-8, 0, 2, 270, 90, 4)
    pts += _arc(12, -1, 3, 90, -90, 4)
    pts += _arc(-12, 0, 4, 270, 90, 5)
    pts += [(6, 4)]
    tube([(x * mm, y * mm, r) for (x, y) in pts], r, color="cloud", segs=5, tint=True)


@asset("egg", "Egg", "Balanced on its end out of sheer stubbornness.", 1, "food", "small",
       variants=["paper", "sand"], col="cyl", fill=0.52)
def egg():
    h, rmax = 0.058, 0.0215
    prof = []
    for i in range(12):
        t = i / 11
        z = h * (1 - math.cos(math.pi * t)) / 2
        r = rmax * math.sin(math.pi * t) * (1 + 0.13 * math.cos(math.pi * t))
        prof.append((r, z))
    _lathe(prof, color="paper", segs=14, tint=True)


@asset("sticky_note", "Sticky Note", "Reminder: remember the thing. Nobody remembers the thing.", 1, "paper",
       "small", variants=["sun", "flamingo", "lime", "sky", "tangerine"], col="box", fill=0.95)
def sticky_note():
    box((0.076, 0.076, 0.0075), base=True, color="sun", tint=True, bevel=0.0006, bseg=1)
    h = 0.016
    extrude([(-h, 0), (h, 0), (0, -h)], 0.0008, at=(0.038 - h * 0.7071, -0.038 + h * 0.7071, 0.0076),
            rot=(-55, 0, 45), color="sun", tint=True)
    for i, (x0, w) in enumerate(((-0.026, 0.046), (-0.026, 0.038), (-0.026, 0.026))):
        y = 0.022 - i * 0.013
        n = 6
        tube([(x0 + w * j / n, y + 0.0022 * (1 if j % 2 else -1), 0.0078) for j in range(n + 1)], 0.0008,
             color="ink", segs=3, lod0=True)


@asset("matchbox", "Matchbox", "Full of tiny bad ideas with red hats.", 1, "paper", "small", col="box", fill=0.85)
def matchbox():
    W, D, H = 0.052, 0.036, 0.015
    box((0.05, D - 0.003, 0.0115), at=(0.016, 0, 0.0005), base=True, color="cocoa")  # drawer, slid out
    for i in range(5):
        y = -0.012 + i * 0.006
        box((0.04, 0.0026, 0.0026), at=(0.0145, y, 0.012), base=True, color="sand")
        sphere(0.0023, at=(0.036, y, 0.0133), scale=(1.3, 1, 1), color="tomato", segs=8, lod0=i % 2 == 1)
    box((W, D, H), base=True, color="cobalt", bevel=0.0008, bseg=1)  # sleeve
    for k in (-1, 1):
        box((W - 0.008, 0.001, H - 0.006), at=(0, k * D / 2, 0.003), base=True, color="cocoa")  # strikers
    flame = [(0.0, -0.007), (0.005, -0.004), (0.006, 0.0), (0.003, 0.005), (0.0, 0.011), (-0.002, 0.005),
             (-0.005, 0.002), (-0.0055, -0.003)]
    extrude(flame, 0.0006, at=(-0.006, 0.0, H), color="tomato", center=False, lod0=True)


@asset("cookie", "Cookie", "Has chips. Will not share them.", 1, "food", "small", col="cyl", fill=0.75)
def cookie():
    extrude(_blob(14, 0.031, 0.05, seed=0.7), 0.009, color="caramel", center=False, bevel=0.0025)
    chips = ((0.0, 0.0), (0.014, 0.009), (-0.012, 0.013), (-0.017, -0.008), (0.01, -0.015), (0.022, -0.004),
             (-0.002, 0.022), (-0.004, -0.021))
    for i, (x, y) in enumerate(chips):
        ico(0.0042, at=(x, y, 0.0088), scale=(1, 1, 0.75), rot=(0, 0, 40 * i), color="cocoa", lod0=i >= 3)


@asset("birthday_candle", "Birthday Candle", "Make a wish. Not that one.", 1, "plastic", "small",
       variants=["flamingo", "sky", "lime", "sun"], col="cyl", fill=0.25)
def birthday_candle():
    petals = []
    for i in range(18):
        a = 2 * math.pi * i / 18
        rr = 0.0078 + 0.0022 * abs(math.cos(3 * a))
        petals.append((rr * math.cos(a), rr * math.sin(a)))
    extrude(petals, 0.0025, color="flamingo", tint=True, center=False)  # flower holder
    cyl(0.0058, 0.006, at=(0, 0, 0.0025), color="flamingo", tint=True, segs=8)
    r = 0.0043
    cyl(r, 0.052, at=(0, 0, 0.005), color="snow", segs=10)
    for i in range(6):
        cyl(r + 0.0002, 0.0036, at=(0, 0, 0.012 + i * 0.0075), rot=(18, 0, 0), color="flamingo", tint=True, segs=10,
            caps=False, lod0=i % 2 == 1)
    cyl(0.0006, 0.004, at=(0, 0, 0.057), color="ink", segs=5, lod0=True)
    sphere(0.0035, at=(0, 0, 0.0625), color="tangerine", segs=8, lod0=True)
    _lathe([(0.0, 0.0), (0.0042, 0.003), (0.0045, 0.0065), (0.0022, 0.012), (0.0, 0.016)], at=(0, 0, 0.0605),
           color="sun", segs=8)


@asset("orange", "Orange", "Named after the colour, or the other way round. Won't say.", 1, "food", "small",
       col="sphere", fill=0.52)
def orange():
    sphere(0.038, at=(0, 0, 0.036), scale=(1, 1, 0.95), color="tangerine", segs=14)
    cyl(0.0035, 0.004, at=(0, 0, 0.0705), color="pine", segs=6)
    extrude(_leaf_pts(0.034, 0.014), 0.0015, at=(0.002, 0, 0.073), rot=(0, -22, 30), color="leaf")


@asset("apple", "Apple", "Keeps the doctor away. Attracts ants, though.", 1, "food", "small",
       variants=["tomato", "lime"], col="sphere", fill=0.52)
def apple():
    _lathe([(0.0, 0.004), (0.012, 0.001), (0.03, 0.006), (0.041, 0.022), (0.0425, 0.04), (0.037, 0.058),
           (0.023, 0.068), (0.01, 0.0665), (0.0, 0.06)], color="tomato", segs=14, tint=True)
    tube([(0, 0, 0.058), (0.001, 0, 0.07), (0.0045, 0, 0.08)], 0.0022, color="cocoa", segs=6, smooth_path=1)
    extrude(_leaf_pts(0.03, 0.014), 0.0015, at=(0.002, 0, 0.072), rot=(0, -25, -150), color="leaf")


@asset("lemon", "Lemon", "Sour about everything, especially lemonade.", 1, "food", "small", col="box", fill=0.5)
def lemon():
    _lathe([(0.0, 0.0), (0.004, 0.003), (0.0085, 0.009), (0.019, 0.017), (0.026, 0.03), (0.0275, 0.04),
           (0.026, 0.05), (0.019, 0.063), (0.0085, 0.071), (0.004, 0.077), (0.0, 0.08)],
          at=(-0.04, 0, 0.0275), rot=(0, 90, 0), color="sun", segs=12)
    extrude(_leaf_pts(0.026, 0.011), 0.0014, at=(0.037, 0, 0.033), rot=(0, -35, 20), color="leaf")


# ================================================================ table-top clutter

@asset("toy_car", "Toy Car", "Zero to breakfast in under a second.", 1, "plastic", "small",
       variants=["tomato", "sky", "sun", "leaf", "grape"], col="box", fill=0.6)
def toy_car():
    box((0.044, 0.078, 0.019), at=(0, 0, 0.007), base=True, color="tomato", tint=True, bevel=0.006, bseg=2)
    box((0.038, 0.04, 0.017), at=(0, 0.006, 0.0245), base=True, color="glass", bevel=0.004, bseg=1,
        taper=(0.84, 0.78))
    box((0.033, 0.03, 0.004), at=(0, 0.007, 0.04), base=True, color="tomato", tint=True, bevel=0.0015, bseg=1)
    for x in (-0.0215, 0.0215):
        for y in (-0.024, 0.024):
            cyl(0.0095, 0.008, at=(x, y, 0.0095), rot=(0, 90, 0), base=False, color="ink_soft", segs=12)
            cyl(0.0045, 0.0084, at=(x * 1.01, y, 0.0095), rot=(0, 90, 0), base=False, color="cloud", segs=8,
                lod0=True)
    for x in (-0.013, 0.013):
        sphere(0.0045, at=(x, -0.0385, 0.018), scale=(1, 0.5, 1), color="cloud", segs=8, lod0=True)


@asset("crayon", "Crayon", "Draws on walls the moment you look away.", 1, "plastic", "small",
       variants=["tomato", "cobalt", "sun", "leaf", "grape", "tangerine"], col="box", fill=0.7)
def crayon():
    r = 0.0056
    rx = (0, 90, 0)
    cyl(r, 0.072, at=(-0.045, 0, r), rot=rx, color="tomato", tint=True, segs=10)
    cyl(r + 0.0003, 0.026, at=(-0.022, 0, r), rot=rx, color="paper", segs=10)  # label
    for x in (-0.038, -0.032, 0.008, 0.014):
        cyl(r + 0.0004, 0.0022, at=(x, 0, r), rot=rx, color="ink", segs=10, lod0=True)
    cyl(r, 0.013, at=(0.027, 0, r), rot=rx, r2=0.0024, color="tomato", tint=True, segs=10)


@asset("boiled_egg_cup", "Boiled Egg in Cup", "Sits in its little armchair like it owns the table.", 1, "ceramic",
       "small", variants=["sky", "flamingo", "sun", "leaf"], col="cyl", fill=0.45)
def boiled_egg_cup():
    _lathe([(0.0, 0.0), (0.023, 0.0), (0.0235, 0.004), (0.0095, 0.012), (0.0095, 0.018), (0.0215, 0.03),
           (0.0245, 0.044), (0.022, 0.0455), (0.0, 0.04)], color="sky", segs=10, tint=True)
    h, rmax, z0 = 0.056, 0.0205, 0.022
    prof = []
    for i in range(6):
        t = i * 0.7 / 5
        z = h * (1 - math.cos(math.pi * t)) / 2
        r = rmax * math.sin(math.pi * t) * (1 + 0.13 * math.cos(math.pi * t))
        prof.append((r, z0 + z))
    top_r, top_z = prof[-1]
    prof.append((0.0, top_z))
    _lathe(prof, color="sand", segs=10)
    cyl(top_r - 0.0008, 0.0012, at=(0, 0, top_z), color="snow", segs=10)
    sphere(0.0095, at=(0, 0, top_z + 0.0008), scale=(1, 1, 0.55), color="sun", segs=9)


@asset("salt_shaker", "Salt Shaker", "Has a lot of holes in its story.", 1, "glass", "small", col="cyl", fill=0.7)
def salt_shaker():
    _lathe([(0.0, 0.0), (0.021, 0.0), (0.0225, 0.004), (0.0225, 0.034), (0.0, 0.034)], color="snow", segs=8,
          smooth=False)
    _lathe([(0.0, 0.034), (0.0225, 0.034), (0.021, 0.056), (0.0185, 0.06), (0.0, 0.06)], color="glass", segs=8,
          smooth=False)
    cap = [(0.0, 0.058), (0.0198, 0.058), (0.0205, 0.068), (0.017, 0.079), (0.009, 0.0855), (0.0, 0.087)]
    _lathe(cap, color="stone", segs=14)
    for i in range(6):
        _dot_on(cap, 0.077, 60 * i + 15, 0.0016, "ink", squash=0.35, segs=6)
    sphere(0.0018, at=(0, 0, 0.0868), scale=(1, 1, 0.35), color="ink", segs=6, lod0=True)


@asset("jam_jar", "Jam Jar", "Dressed for a picnic it was never invited to.", 1, "glass", "small",
       variants=["tomato", "grape", "tangerine"], col="cyl", fill=0.8)
def jam_jar():
    _lathe([(0.0, 0.0), (0.029, 0.0), (0.0315, 0.004), (0.0315, 0.054), (0.027, 0.06), (0.0, 0.06)],
          color="tomato", segs=14, tint=True)
    cyl(0.027, 0.006, at=(0, 0, 0.058), color="glass", segs=14)
    cyl(0.0322, 0.024, at=(0, 0, 0.016), color="paper", segs=14, caps=False)  # label
    sphere(0.0065, at=(0, -0.0323, 0.028), scale=(1, 0.3, 1), color="tomato", tint=True, segs=10, lod0=True)
    extrude(_leaf_pts(0.008, 0.004), 0.001, at=(0.0, -0.0328, 0.0335), rot=(90, -40, 0), color="tomato", tint=True,
            lod0=True)
    lid = [(0.0, 0.062), (0.0375, 0.062), (0.0355, 0.068), (0.031, 0.077), (0.0, 0.077)]
    _lathe(lid, color="tomato", segs=16)
    cell = 0.0105
    for i in range(-3, 4):
        for j in range(-3, 4):
            if (i + j) % 2:
                continue
            cx, cy = i * cell, j * cell
            if math.hypot(abs(cx) + cell / 2, abs(cy) + cell / 2) > 0.0315:
                continue
            box((cell, cell, 0.0006), at=(cx, cy, 0.0768), base=True, color="snow", lod0=True)


@asset("fried_egg", "Fried Egg", "Sunny side up, and a little smug about it.", 1, "food", "small", col="cyl",
       fill=0.35)
def fried_egg():
    extrude(_blob(16, 0.052, 0.09, seed=1.3, sx=1.08), 0.005, color="snow", center=False, bevel=0.002)
    sphere(0.019, at=(0.007, -0.006, 0.004), scale=(1, 1, 0.62), color="sun", segs=14)


@asset("cheese_wedge", "Cheese Wedge", "More holes than a bedtime excuse.", 1, "food", "small", col="box",
       fill=0.5)
def cheese_wedge():
    H = 0.045
    tip, rb, lb = (0.0, -0.055), (0.042, 0.04), (-0.042, 0.04)

    def notch(p0, p1, t, r, n=4):
        # semicircular bite into the edge p0->p1 at fraction t (outline runs counter-clockwise)
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        L = math.hypot(dx, dy)
        ux, uy = dx / L, dy / L
        cx, cy = p0[0] + dx * t, p0[1] + dy * t
        out = []
        for i in range(n + 1):
            a = math.pi * i / n
            # from -u through inward normal to +u
            nx, ny = -uy, ux
            out.append((cx - ux * r * math.cos(a) + nx * r * math.sin(a),
                        cy - uy * r * math.cos(a) + ny * r * math.sin(a)))
        return out

    pts = [tip] + notch(tip, rb, 0.5, 0.0075) + [rb]
    pts += _arc(0, -0.035, 0.0775, math.degrees(math.atan2(0.075, 0.042)), math.degrees(math.atan2(0.075, -0.042)),
                4)[1:-1]
    pts += [lb] + notch(lb, tip, 0.38, 0.006)
    extrude(pts, H, color="butter", center=False)
    # holes on the faces
    sphere(0.008, at=(-0.008, 0.008, H), scale=(1, 0.8, 0.12), color="sun", segs=10, lod0=True)
    sphere(0.005, at=(0.012, 0.022, H), scale=(1, 0.8, 0.12), color="sun", segs=8, lod0=True)
    sphere(0.004, at=(-0.006, -0.025, H), scale=(1, 0.8, 0.12), color="sun", segs=8, lod0=True)
    ang = math.degrees(math.atan2(-0.042, 0.095))
    for (t, z, r) in ((0.22, 0.03, 0.0055), (0.78, 0.016, 0.0065), (0.75, 0.036, 0.0035)):
        x, y = tip[0] + (rb[0] - tip[0]) * t, tip[1] + (rb[1] - tip[1]) * t
        sphere(r, at=(x, y, z), rot=(0, 0, ang), scale=(0.12, 1, 1), color="sun", segs=8, lod0=True)


@asset("mug", "Mug", "Holds coffee and grudges in equal measure.", 1, "ceramic", "small",
       variants=["tomato", "cobalt", "sun", "leaf", "flamingo"], col="cyl", fill=0.6)
def mug():
    _lathe([(0.0, 0.0), (0.036, 0.0), (0.0395, 0.005), (0.0405, 0.09), (0.0385, 0.094), (0.0355, 0.09),
           (0.0355, 0.082), (0.0, 0.082)], color="tomato", segs=16, tint=True)
    cyl(0.0357, 0.001, at=(0, 0, 0.0815), color="cocoa", segs=16)
    _torus(0.0215, 0.0078, at=(0.041, 0, 0.048), rot=(90, 100, 0), arc=200, color="tomato", tint=True, segs=12,
          rsegs=6)
    _xz(_heart_pts(0.026), 0.004, at=(0, -0.0385, 0.047), color="snow", lod0=True)


@asset("juice_box", "Juice Box", "Small, square and full of slurp.", 1, "paper", "small",
       variants=["tangerine", "grape", "lime", "tomato"], col="box", fill=0.85)
def juice_box():
    W, D, H = 0.058, 0.038, 0.088
    box((W, D, H), base=True, color="tangerine", tint=True, bevel=0.002, bseg=1)
    _xz(rounded_rect_points(0.046, 0.052, 0.008), 0.002, at=(0, -D / 2, 0.042), color="snow")
    _xz(ngon_points(14, 0.0135), 0.002, at=(0, -D / 2 - 0.0012, 0.04), color="tangerine", tint=True)
    extrude(_leaf_pts(0.014, 0.007), 0.0016, at=(0.001, -D / 2 - 0.0015, 0.052), rot=(90, -55, 0), color="leaf")
    # folded top flaps
    for k in (-1, 1):
        _yz([(-0.004, 0.0), (0.004, 0.0), (0.0, 0.006)], 0.0015, at=(k * (W / 2 + 0.0004), 0, H - 0.0062),
            color="tangerine", tint=True)
    cyl(0.0035, 0.0006, at=(0.016, 0.006, H), color="cloud", segs=8, lod0=True)
    tube([(0.016, 0.006, H - 0.004), (0.016, 0.006, H + 0.022), (0.0175, 0.006, H + 0.027),
          (0.027, 0.006, H + 0.033)], 0.0022, color="snow", segs=6)


@asset("pancake_stack", "Pancake Stack", "A tower of fluff with a syrupy waterfall.", 1, "food", "medium",
       col="cyl", fill=0.75)
def pancake_stack():
    t = 0.0125
    offs = [(0.0, 0.0), (0.004, -0.003), (-0.003, 0.002), (0.002, 0.004)]
    for i, (dx, dy) in enumerate(offs):
        z = i * t
        _lathe([(0.0, z), (0.055, z), (0.0585, z + t * 0.5), (0.055, z + t), (0.0, z + t)], at=(dx, dy, 0),
              color="sand", segs=16)
    top = len(offs) * t
    ox, oy = offs[-1]
    cyl(0.051, 0.0008, at=(ox, oy, top - 0.0002), color="caramel", segs=16)
    extrude(_blob(14, 0.038, 0.1, seed=2.0), 0.0016, at=(ox, oy, top + 0.0004), color="cocoa", center=False)
    for (ang, L) in ((-70, 0.03), (-25, 0.018), (20, 0.036), (-120, 0.022)):
        a = math.radians(ang)
        c, s = math.cos(a), math.sin(a)
        tube([(ox + 0.036 * c, oy + 0.036 * s, top + 0.0012), (ox + 0.0575 * c, oy + 0.0575 * s, top - 0.002),
              (ox + 0.06 * c, oy + 0.06 * s, top - L)], 0.0032, r_end=0.0036, color="cocoa", segs=6)
        sphere(0.0045, at=(ox + 0.06 * c, oy + 0.06 * s, top - L), color="cocoa", segs=8, lod0=True)
    box((0.026, 0.022, 0.009), at=(ox + 0.004, oy - 0.003, top + 0.001), rot=(0, 0, 18), base=True, color="butter",
        bevel=0.002, bseg=1)


@asset("croissant", "Croissant", "Flaky, but always shows up for breakfast.", 1, "food", "small", col="box",
       fill=0.45)
def croissant():
    R, cy = 0.055, -0.026
    angs = (-76, -52, -26, 0, 26, 52, 76)
    rads = (0.005, 0.0125, 0.019, 0.0225, 0.019, 0.0125, 0.005)

    def p(a, r):
        aa = math.radians(a)
        return (R * math.sin(aa), cy + R * math.cos(aa), r * 0.85)

    for (a0, r0), (a1, r1) in zip(zip(angs[:-1], rads[:-1]), zip(angs[1:], rads[1:])):
        tube([p(a0, r0), p((a0 + a1) / 2, (r0 + r1) / 2), p(a1, r1)], r0, r_end=r1, color="caramel", segs=8)
    for a, r in zip(angs[1:-1], rads[1:-1]):
        _torus(r * 0.97, 0.0026, at=p(a, r), rot=(90, 0, 90 - a), color="sand", segs=10, rsegs=4, lod0=True)


@asset("pencil", "Pencil", "Sharp, but only at one end.", 1, "wood", "small",
       variants=["sun", "tomato", "cobalt", "leaf"], col="box", fill=0.7)
def pencil():
    R = 0.0046
    ap = R * math.cos(math.radians(30))
    hx = _along_x(30)
    rx = (0, 90, 0)
    cyl(0.0042, 0.011, at=(-0.085, 0, ap), rot=rx, color="bubblegum", segs=10, bevel=0.0015)
    cyl(0.0048, 0.012, at=(-0.0755, 0, ap), rot=rx, color="stone", segs=10)
    for x in (-0.0725, -0.0665):
        _torus(0.0048, 0.0006, at=(x, 0, ap), rot=rx, color="stone", segs=10, rsegs=3, lod0=True)
    _lathe([(0.0, 0.0), (R, 0.0), (R, 0.1215), (0.0, 0.1215)], at=(-0.0635, 0, ap), rot=hx, color="sun", tint=True,
          segs=6, smooth=False)
    _lathe([(0.0, 0.0), (R, 0.0), (0.0017, 0.0195), (0.0, 0.0195)], at=(0.058, 0, ap), rot=hx, color="sand",
          segs=6, smooth=False)
    cyl(0.0017, 0.008, at=(0.0773, 0, ap), rot=rx, r2=0.0002, color="ink", segs=6)


@asset("glasses", "Glasses", "Usually lost on top of someone's head.", 1, "glass", "small",
       variants=["charcoal", "tomato", "cobalt", "flamingo"], col="box", fill=0.15)
def glasses():
    fz, sc = 0.024, (1.15, 0.9, 1)
    for k in (-1, 1):
        _torus(0.0215, 0.003, at=(k * 0.0295, 0, fz), rot=(90, 0, 0), scale=sc, color="charcoal", tint=True,
              segs=12, rsegs=5)
        cyl(0.021, 0.0016, at=(k * 0.0295, 0.0005, fz), rot=(90, 0, 0), base=False, scale=sc, color="glass", segs=14,
            lod0=True)
        ox = k * (0.0295 + 0.0215 * 1.15)
        box((0.006, 0.006, 0.006), at=(ox, 0.002, fz + 0.01), color="charcoal", tint=True, bevel=0.0015, bseg=1,
            lod0=True)
        tube([(ox, 0.003, fz + 0.01), (ox + k * 0.002, 0.06, fz + 0.012), (ox + k * 0.003, 0.108, fz + 0.012),
              (ox + k * 0.003, 0.125, 0.004)], 0.0022, color="charcoal", tint=True, segs=5, smooth_path=1)
    tube([(-0.0055, 0, fz + 0.007), (0, 0, fz + 0.012), (0.0055, 0, fz + 0.007)], 0.0024, color="charcoal",
         tint=True, segs=5, smooth_path=1)


@asset("smartphone", "Smartphone", "Forty-two unread notifications. Zero regrets.", 1, "electronic", "small",
       variants=["flamingo", "sky", "lime", "tangerine"], col="box", fill=0.95)
def smartphone():
    T = 0.009
    box((0.072, 0.148, T), base=True, color="flamingo", tint=True, bevel=0.0042, bseg=2)
    extrude(rounded_rect_points(0.064, 0.137, 0.007), 0.001, at=(0, 0, T - 0.0004), color="ink", center=False)
    cols = ("sky", "sun", "sun", "sky")
    for row in range(4):
        for c in range(4):
            x = -0.0225 + c * 0.015
            y = 0.048 - row * 0.019
            extrude(rounded_rect_points(0.0095, 0.0095, 0.0025, 1), 0.001, at=(x, y, T + 0.0004),
                    color=cols[(row + c) % 4], center=False, lod0=True)
    extrude(rounded_rect_points(0.022, 0.003, 0.0015, 1), 0.001, at=(0, -0.062, T + 0.0004), color="snow",
            center=False, lod0=True)


@asset("pepper_mill", "Pepper Mill", "Twist it and it sneezes on your eggs.", 1, "wood", "small", col="cyl",
       fill=0.6)
def pepper_mill():
    _lathe([(0.0, 0.0), (0.025, 0.0), (0.0265, 0.007), (0.0235, 0.013), (0.0265, 0.035), (0.024, 0.058),
            (0.016, 0.085), (0.0175, 0.1), (0.0215, 0.113), (0.02, 0.118), (0.0, 0.118)], color="cocoa", segs=12)
    cyl(0.0205, 0.004, at=(0, 0, 0.1165), color="stone", segs=12, lod0=True)
    _lathe([(0.0, 0.12), (0.0235, 0.12), (0.024, 0.127), (0.019, 0.138), (0.01, 0.1455), (0.0, 0.147)],
           color="caramel", segs=12)
    cyl(0.003, 0.006, at=(0, 0, 0.145), color="stone", segs=6, lod0=True)
    sphere(0.0075, at=(0, 0, 0.1545), color="stone", segs=10)


@asset("fork", "Fork", "Four prongs of pure ambition.", 1, "metal", "small", col="box", fill=0.2)
def fork():
    upper = _arc(-0.08, 0.0, 0.0105, 180, 90, 4)[:-1] + [
        (-0.08, 0.0105), (-0.06, 0.0098), (-0.03, 0.0072), (0.0, 0.0042), (0.012, 0.0046), (0.025, 0.0092),
        (0.036, 0.0124), (0.048, 0.0132)]
    tines = [(0.088, 0.0132), (0.0905, 0.0109), (0.088, 0.0086), (0.054, 0.0086), (0.054, 0.0058), (0.088, 0.0058),
             (0.0905, 0.0036), (0.088, 0.0014), (0.054, 0.0014)]
    half = upper + tines
    pts = half + [(x, -y) for (x, y) in reversed(half)]
    extrude(pts, 0.0038, color="cloud", center=False)


@asset("butter_knife", "Butter Knife", "Too polite to cut anything. Spreads gossip instead.", 1, "metal", "small",
       col="box", fill=0.25)
def butter_knife():
    extrude(rounded_rect_points(0.084, 0.0165, 0.0075), 0.008, at=(-0.058, 0, 0), color="cocoa", center=False,
            bevel=0.0015)
    for x in (-0.085, -0.058, -0.031):
        cyl(0.0018, 0.0006, at=(x, 0, 0.0079), color="sand", segs=6, lod0=True)
    box((0.012, 0.012, 0.0062), at=(-0.011, 0, 0.0009), base=True, color="cloud", bevel=0.0015, bseg=1)
    blade = [(-0.005, 0.0062), (0.07, 0.0095), (0.095, 0.009), (0.106, 0.005), (0.11, 0.0), (0.107, -0.005),
             (0.098, -0.0085), (0.06, -0.0095), (-0.005, -0.0062)]
    extrude(blade, 0.0026, at=(0, 0, 0.0018), color="cloud", center=False)
    extrude(_blob(10, 0.009, 0.15, seed=0.4, sx=1.6), 0.0022, at=(0.072, 0.0, 0.0042), color="butter",
            center=False, bevel=0.0008)


@asset("tv_remote", "TV Remote", "Escaped the sofa cushions. Living large at breakfast.", 1, "electronic",
       "small", col="box", fill=0.9)
def tv_remote():
    H = 0.02
    box((0.048, 0.178, H), base=True, color="charcoal", bevel=0.007, bseg=2)
    cyl(0.0062, 0.0025, at=(0.012, 0.072, H - 0.0006), color="tomato", segs=10, bevel=0.0008)
    cyl(0.0145, 0.002, at=(0, 0.036, H - 0.0006), color="cloud", segs=14, bevel=0.0008)
    cyl(0.006, 0.0032, at=(0, 0.036, H - 0.0006), color="stone", segs=10)
    for k in (-1, 1):
        box((0.0085, 0.026, 0.0035), at=(k * 0.0135, 0.0, H - 0.001), base=True, color="stone", bevel=0.0015,
            bseg=1)
    for row in range(4):
        for c in range(3):
            box((0.0085, 0.0062, 0.0026), at=(-0.0135 + c * 0.0135, -0.03 - row * 0.012, H - 0.0006), base=True,
                color="cloud", lod0=True)


@asset("banana", "Banana", "Comes in its own sleeping bag.", 1, "food", "small", col="box", fill=0.3)
def banana():
    Rb, cz = 0.13, 0.13

    def p(a):
        a = math.radians(a)
        return (Rb * math.sin(a), 0.0, cz - Rb * math.cos(a))

    tube([p(a) for a in (-47, -42, -36)], 0.006, r_end=0.0155, color="sun", segs=6)
    tube([p(a) for a in (-36, -24, -12, 0, 12, 24)], 0.0155, r_end=0.0165, color="sun", segs=6)
    tube([p(a) for a in (24, 31, 38)], 0.0165, r_end=0.0085, color="sun", segs=6)
    tube([p(a) for a in (38, 42, 47)], 0.005, r_end=0.0042, color="leaf", segs=6)
    sphere(0.0048, at=p(47.5), color="cocoa", segs=6)
    sphere(0.0055, at=p(-47.5), color="cocoa", segs=6)
    for a, dy in ((-20, 0.01), (6, 0.012), (18, 0.011)):
        x, _, z = p(a)
        sphere(0.0035, at=(x, -dy, z + 0.006), scale=(1, 0.4, 1), color="cocoa", segs=6, lod0=True)


@asset("bowl_of_cereal", "Bowl of Cereal", "Goes soggy in ninety seconds. Roll fast.", 1, "ceramic", "medium",
       variants=["sky", "flamingo", "lime", "cobalt"], col="cyl", fill=0.55)
def bowl_of_cereal():
    _lathe([(0.0, 0.0), (0.036, 0.0), (0.038, 0.006), (0.062, 0.026), (0.076, 0.052), (0.0795, 0.06),
           (0.0745, 0.0615), (0.071, 0.056), (0.0, 0.056)], color="sky", segs=18, tint=True)
    cyl(0.0715, 0.0012, at=(0, 0, 0.0555), color="snow", segs=18)
    loops = [(0.0, 0.0, 0.066, 10, 15), (0.024, -0.014, 0.063, -15, 60), (-0.026, -0.012, 0.0625, 20, 10),
             (0.004, -0.034, 0.061, 25, -30), (-0.006, 0.026, 0.064, -20, 40), (0.036, 0.016, 0.061, 10, 80),
             (-0.04, 0.018, 0.0605, -15, 0), (0.042, -0.036, 0.059, 18, 20), (-0.034, -0.042, 0.059, -10, 70),
             (0.018, 0.044, 0.0605, 12, 0), (-0.052, -0.006, 0.0595, 8, 30), (0.054, -0.006, 0.0595, -10, 50),
             (0.012, -0.012, 0.072, 35, 20)]
    for i, (x, y, z, tilt, yaw) in enumerate(loops):
        _torus(0.0075, 0.0032, at=(x, y, z), rot=(tilt, 0, yaw), color="sun" if i % 2 == 0 else "tomato", segs=8,
              rsegs=4, lod0=i >= 4)


@asset("milk_carton", "Milk Carton", "Opened on the wrong side. Again.", 1, "paper", "small",
       variants=["cobalt", "flamingo", "cocoa"], col="box", fill=0.85)
def milk_carton():
    S, H = 0.07, 0.145
    box((S, S, H), base=True, color="snow", bevel=0.0015, bseg=1)
    box((S + 0.0008, S + 0.0008, 0.052), base=True, color="cobalt", tint=True)
    _xz([(-0.0365, 0.0), (0.0365, 0.0), (0.0, 0.032)], S, at=(0, 0, H), color="cobalt", tint=True)
    box((0.0055, S, 0.013), at=(0, 0, H + 0.03), base=True, color="cobalt", tint=True)
    drop = [(0.0, 0.016)] + _arc(0, 0.0, 0.0085, 30, -210, 8)
    _xz(drop, 0.002, at=(0, -S / 2 - 0.0008, 0.016), color="snow", lod0=True)
    for (x, z, r) in ((-0.016, 0.115, 0.009), (0.017, 0.088, 0.0075), (0.004, 0.128, 0.005)):
        _xz(_blob(9, r, 0.18, seed=x * 300), 0.0012, at=(x, -S / 2 - 0.0002, z), color="ink_soft", lod0=True)
    for (y, z, r) in ((-0.012, 0.1, 0.0085), (0.018, 0.122, 0.006)):
        _yz([(y + px, z + pz) for (px, pz) in _blob(9, r, 0.18, seed=y * 300)], 0.0012, at=(S / 2 + 0.0002, 0, 0),
            color="ink_soft", lod0=True)


@asset("teapot", "Teapot", "Short and stout. Has heard the song. Hates the song.", 1, "ceramic", "medium",
       variants=["sky", "flamingo", "teal", "sun"], col="cyl", fill=0.5)
def teapot():
    body = [(0.0, 0.0), (0.05, 0.0), (0.056, 0.006), (0.074, 0.035), (0.078, 0.06), (0.07, 0.09), (0.052, 0.112),
            (0.04, 0.116), (0.0, 0.116)]
    _lathe(body, color="sky", segs=16, tint=True)
    _lathe([(0.0, 0.114), (0.043, 0.114), (0.043, 0.121), (0.035, 0.131), (0.02, 0.139), (0.0, 0.141)],
          color="sky", segs=14, tint=True)
    _torus(0.042, 0.0035, at=(0, 0, 0.1165), color="snow", segs=16, rsegs=4)
    cyl(0.005, 0.01, at=(0, 0, 0.138), color="snow", segs=8)
    sphere(0.0125, at=(0, 0, 0.152), color="snow", segs=10)
    tube([(-0.062, 0, 0.04), (-0.09, 0, 0.052), (-0.106, 0, 0.082), (-0.118, 0, 0.11), (-0.134, 0, 0.122)],
         0.0155, r_end=0.0075, color="sky", tint=True, segs=8, smooth_path=1)
    _torus(0.0075, 0.0028, at=(-0.134, 0, 0.122), rot=(0, 70, 0), color="sky", tint=True, segs=10, rsegs=4, lod0=True)
    _torus(0.034, 0.0095, at=(0.07, 0, 0.065), rot=(90, 100, 0), arc=210, color="sky", tint=True, segs=14, rsegs=5)
    for (z, a) in ((0.03, -100), (0.05, -60), (0.078, -85), (0.062, -30), (0.072, -130), (0.04, -150), (0.07, 10),
                   (0.035, 25), (0.075, 70), (0.045, 120), (0.06, 185)):
        _dot_on(body, z, a, 0.007, "snow", squash=0.3, segs=6)


@asset("plate", "Plate", "Clean, for now. This is a breakfast table.", 1, "ceramic", "medium",
       variants=["sky", "tomato", "leaf", "sun"], col="cyl", fill=0.15)
def plate():
    _lathe([(0.0, 0.0), (0.078, 0.0), (0.082, 0.004), (0.118, 0.014), (0.125, 0.0185), (0.1215, 0.0205),
           (0.11, 0.0172), (0.082, 0.0078), (0.0, 0.0078)], color="snow", segs=24)
    _torus(0.1195, 0.0028, at=(0, 0, 0.0185), color="sky", tint=True, segs=24, rsegs=4)
    for (x, y, s) in ((0.02, -0.03, 1.0), (-0.035, 0.01, 0.8), (0.04, 0.025, 0.7), (-0.01, -0.05, 0.6)):
        ico(0.0055 * s, at=(x, y, 0.0085), scale=(1.2, 0.9, 0.7), rot=(10, 20, 30 * s), color="caramel", lod0=True)


@asset("toaster", "Toaster", "Ding! Two slices of breaking news.", 1, "electronic", "medium",
       variants=["tomato", "cloud", "sky", "mint"], col="box", fill=0.8)
def toaster():
    W, D, H = 0.27, 0.15, 0.17
    box((W, D, H), base=True, color="tomato", tint=True, bevel=0.035, bseg=3)
    for y in (-0.03, 0.03):
        box((0.19, 0.022, 0.003), at=(0, y, H - 0.0018), base=True, color="ink")
    slice_ = [(-0.052, 0.0), (0.052, 0.0), (0.052, 0.075), (0.06, 0.088), (0.056, 0.1), (0.042, 0.108), (0.02, 0.111),
              (0.0, 0.11), (-0.02, 0.111), (-0.042, 0.108), (-0.056, 0.1), (-0.06, 0.088), (-0.052, 0.075)]
    inner = [(x * 0.85, 0.009 + y * 0.85) for (x, y) in slice_]
    for (y, z0, tilt) in ((-0.03, 0.1, -3), (0.03, 0.118, 4)):
        _xz(slice_, 0.013, at=(0.0, y, z0), color="caramel")
        _xz(inner, 0.0138, at=(0.0, y, z0), color="sand")
    box((0.022, 0.032, 0.012), at=(W / 2 + 0.008, 0, 0.115), base=True, color="charcoal", bevel=0.004, bseg=1)
    cyl(0.013, 0.008, at=(0.085, -D / 2 + 0.002, 0.045), rot=(90, 0, 0), color="charcoal", segs=12, bevel=0.002)
    box((0.004, 0.0035, 0.009), at=(0.085, -D / 2 - 0.0055, 0.05), base=True, color="snow", lod0=True)
    for x in (-0.1, 0.1):
        for y in (-0.05, 0.05):
            cyl(0.008, 0.008, at=(x, y, -0.006), color="charcoal", segs=8, lod0=True)


@asset("bread_loaf", "Bread Loaf", "The best thing since itself.", 1, "food", "medium", col="box", fill=0.85)
def bread_loaf():
    half = [(0.052, 0.0), (0.055, 0.068), (0.063, 0.082), (0.062, 0.098), (0.05, 0.113), (0.026, 0.122),
            (0.0, 0.124)]
    crust = half + [(-y, z) for (y, z) in reversed(half[:-1])]
    inner = [(y * 0.86, 0.008 + z * 0.86) for (y, z) in crust]
    _yz(crust, 0.22, at=(-0.03, 0, 0), color="caramel")
    _yz(inner, 0.004, at=(0.0805, 0, 0), color="sand")
    # one loose slice leaning off the end
    _yz(crust, 0.016, at=(0.103, 0, 0.0), color="caramel")
    _yz(inner, 0.0168, at=(0.103, 0, 0.0), color="sand")


@asset("vase_tulips", "Vase of Tulips", "Here to make the table look like it has its life together.", 1, "plant",
       "medium", variants=["cobalt", "teal", "sky", "grape"], col="cyl", fill=0.3)
def vase_tulips():
    _lathe([(0.0, 0.0), (0.034, 0.0), (0.036, 0.004), (0.047, 0.045), (0.043, 0.085), (0.026, 0.118), (0.022, 0.13),
           (0.028, 0.141), (0.024, 0.143), (0.019, 0.135), (0.0, 0.133)], color="cobalt", segs=14, tint=True)
    heads = [((-0.045, -0.008, 0.27), "tomato", (0, -14, 0)), ((0.04, 0.006, 0.288), "sun", (0, 12, 0)),
             ((0.002, -0.022, 0.305), "tomato", (8, 0, 0))]
    for (hx, hy, hz), c, rot in heads:
        tube([(hx * 0.1, hy * 0.1, 0.12), (hx * 0.55, hy * 0.55, 0.21), (hx, hy, hz)], 0.0028, color="leaf", segs=5,
             smooth_path=1)
        _lathe([(0.0, 0.0), (0.016, 0.007), (0.021, 0.022), (0.0165, 0.042), (0.0, 0.034)],
               at=(hx, hy, hz - 0.012), rot=rot, color=c, segs=8)
        for i in range(3):
            a = math.radians(120 * i + 30)
            cyl(0.0085, 0.015, at=(hx + 0.0135 * math.cos(a), hy + 0.0135 * math.sin(a), hz + 0.027),
                rot=(rot[0] - 12 * math.sin(a), rot[1] + 12 * math.cos(a), 0), r2=0.0005, color=c, segs=5, lod0=True)
    extrude(_leaf_pts(0.12, 0.026), 0.002, at=(0.008, -0.004, 0.13), rot=(10, -62, 20), color="leaf")
    extrude(_leaf_pts(0.1, 0.022), 0.002, at=(-0.008, 0.004, 0.13), rot=(-10, -58, 200), color="leaf")


@asset("cereal_box", "Cereal Box", "Contains one free toy and absolutely no vegetables.", 1, "paper", "medium",
       variants=["tomato", "sky", "grape", "leaf"], col="box", fill=0.95)
def cereal_box():
    W, D, H = 0.2, 0.07, 0.3
    fy = -D / 2
    box((W, D, H), base=True, color="tomato", tint=True, bevel=0.0025, bseg=1)
    _xz(star_points(12, 0.082, 0.06, start=0), 0.002, at=(0.0, fy - 0.0005, 0.135), color="sun")
    bowl = _arc(0.0, 0.0, 0.066, 180, 360, 10)
    _xz(bowl, 0.002, at=(0.0, fy - 0.0015, 0.105), color="cobalt")
    _xz(rounded_rect_points(0.136, 0.014, 0.007), 0.002, at=(0.0, fy - 0.0025, 0.106), color="snow")
    for i, (x, z, a) in enumerate(((-0.04, 0.124, 0), (-0.012, 0.13, 20), (0.018, 0.124, -15), (0.044, 0.128, 10),
                                    (0.002, 0.152, 5), (-0.028, 0.152, -10), (0.03, 0.153, 25))):
        _torus(0.0105, 0.0048, at=(x, fy - 0.004, z), rot=(90, a, 0), color="tomato", tint=True, segs=10, rsegs=4,
              lod0=i >= 2)
    # title banner with an invented chunky wordmark: "YUM"
    _xz(rounded_rect_points(0.17, 0.056, 0.014), 0.002, at=(0.0, fy - 0.0005, 0.246), color="snow")
    ty, th, sw = fy - 0.0025, 0.036, 0.0085
    lz = 0.228
    # Y
    box((sw, 0.002, 0.02), at=(-0.048, ty, lz), base=True, color="cobalt", lod0=True)
    box((sw, 0.002, 0.021), at=(-0.054, ty, lz + 0.016), rot=(0, -28, 0), base=True, color="cobalt", lod0=True)
    box((sw, 0.002, 0.021), at=(-0.042, ty, lz + 0.016), rot=(0, 28, 0), base=True, color="cobalt", lod0=True)
    # U
    for x in (-0.018, 0.006):
        box((sw, 0.002, 0.026), at=(x, ty, lz + 0.01), base=True, color="cobalt", lod0=True)
    _torus(0.012, sw / 2, at=(-0.006, ty, lz + 0.012), rot=(90, 0, 0), arc=180, scale=(1, 1, 0.3), color="cobalt",
          segs=8, rsegs=4, lod0=True)
    _torus(0.012, sw / 2, at=(-0.006, ty, lz + 0.012), rot=(90, 180, 0), arc=180, scale=(1, 1, 0.3),
          color="cobalt", segs=8, rsegs=4, lod0=True)
    # M
    for x in (0.028, 0.06):
        box((sw, 0.002, th), at=(x, ty, lz), base=True, color="cobalt", lod0=True)
    box((sw * 0.9, 0.002, 0.024), at=(0.036, ty, lz + 0.033), rot=(0, 140, 0), base=True, color="cobalt", lod0=True)
    box((sw * 0.9, 0.002, 0.024), at=(0.052, ty, lz + 0.033), rot=(0, -140, 0), base=True, color="cobalt", lod0=True)
    # side panel "small print"
    _yz(rounded_rect_points(0.05, 0.12, 0.006), 0.0015, at=(W / 2 + 0.0004, 0, 0.17), color="snow", lod0=True)
    for i in range(7):
        _yz(rounded_rect_points(0.036, 0.0035, 0.0015, 1), 0.0015, at=(W / 2 + 0.0012, 0.0, 0.215 - i * 0.013),
            color="ink", lod0=True)


@asset("newspaper", "Newspaper", "Yesterday's news. Today's sticky snack.", 1, "paper", "small", col="box",
       fill=0.3)
def newspaper():
    W, Dp, T = 0.29, 0.2, 0.004
    lift = -9.0
    box((W, Dp, T), at=(0, 0, 0), base=True, color="paper")
    cyl(T, W, at=(-W / 2, Dp / 2, T), rot=(0, 90, 0), color="paper", segs=8)
    hinge = (0.0, Dp / 2, T)
    c, s = math.cos(math.radians(lift)), math.sin(math.radians(lift))

    def on_page(x, y, dz=0.0):
        # point on the lifted top half: y measured from the hinge (negative = towards the front edge)
        return (x, hinge[1] + y * c - dz * s, hinge[2] + y * s + dz * c)

    box((W, Dp, T), at=on_page(0, -Dp / 2), rot=(lift, 0, 0), base=True, color="paper")
    box((0.25, 0.026, 0.0008), at=on_page(0, -0.03, T), rot=(lift, 0, 0), base=True, color="ink")
    box((0.1, 0.075, 0.0008), at=on_page(-0.07, -0.1, T), rot=(lift, 0, 0), base=True, color="sky")
    sphere(0.014, at=on_page(-0.085, -0.092, T + 0.0006), rot=(lift, 0, 0), scale=(1, 1, 0.05), color="sun",
           segs=10, lod0=True)
    for i in range(9):
        w = 0.11 if i % 4 != 3 else 0.07
        box((w, 0.0045, 0.0006), at=on_page(0.02 + w / 2 - 0.0, -0.058 - i * 0.0135, T), rot=(lift, 0, 0),
            base=True, color="stone", lod0=True)
    box((0.1, 0.0045, 0.0006), at=on_page(-0.07, -0.152, T), rot=(lift, 0, 0), base=True, color="stone", lod0=True)
    box((0.1, 0.0045, 0.0006), at=on_page(-0.07, -0.166, T), rot=(lift, 0, 0), base=True, color="stone", lod0=True)
