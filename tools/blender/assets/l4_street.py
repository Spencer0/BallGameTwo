"""Level 4 — Cul-de-Sac (street furniture, gardens, vehicles, houses). Objects face -Y; base at z = 0; metres.
Vehicles are authored side-on along X with their nose at +X (the thumbnail camera sits front-right)."""
import math

from lib.core import STATE, box, cyl, sphere, torus, lathe, extrude, tube, ngon_points
from lib.registry import asset


# ---------------------------------------------------------------- local helpers

def _lod1():
    return STATE.lod > 0


def _dot_eyes(at, spacing, r, yaw=0.0, color="ink", segs=6):
    """Cheap dot eyes (copied pattern from l3_house)."""
    a = math.radians(yaw)
    side = (math.cos(a), math.sin(a))
    face = (math.sin(a), -math.cos(a))
    for k in (-1, 1):
        x = at[0] + side[0] * k * spacing / 2
        y = at[1] + side[1] * k * spacing / 2
        sphere(r, at=(x, y, at[2]), color=color, segs=segs, rings=4, scale=(1, 0.6, 1.2), rot=(0, 0, yaw))
        sphere(r * 0.38, at=(x + face[0] * r * 0.5 - side[0] * r * 0.3, y + face[1] * r * 0.5 - side[1] * r * 0.3,
                             at[2] + r * 0.45), color="snow", segs=4, rings=3, lod0=True)


def _tyre(at, r, w, hub="cloud", segs=14, tyre="ink_soft"):
    """Chunky toy tyre with the axle along Y."""
    cyl(r, w, at=at, rot=(90, 0, 0), base=False, color=tyre, segs=segs, bevel=r * 0.18)
    cyl(r * 0.5, w + 0.03, at=at, rot=(90, 0, 0), base=False, color=hub, segs=8)


def _wheels(xs, y, z, r, w, **kw):
    for x in xs:
        for k in (-1, 1):
            _tyre((x, k * y, z), r, w, **kw)


_SIDES = {"-y": (0, -1), "+y": (0, 1), "-x": (-1, 0), "+x": (1, 0)}


def _panel(side, wall, u, z, w, h, t, color, off=0.0, **kw):
    """Flat box stuck on a wall. `wall` = the wall's x (for ±x) or y (for ±y); `u` = position along it;
    `z` = centre height; `t` = thickness out of the wall."""
    nx, ny = _SIDES[side]
    if ny:
        box((w, t, h), at=(u, wall + ny * (off + t / 2), z), color=color, **kw)
    else:
        box((t, w, h), at=(wall + nx * (off + t / 2), u, z), color=color, **kw)


def _window(side, wall, u, z, w, h, frame="snow", shutter=None, mull=True, sill=True):
    """House window: glass pane (kept at LOD1) + frame, mullions, shutters, sill (LOD0 only)."""
    _panel(side, wall, u, z, w + 0.24, h + 0.24, 0.05, frame, lod0=True)
    _panel(side, wall, u, z, w, h, 0.08, "glass")
    if mull:
        _panel(side, wall, u, z, 0.09, h, 0.11, frame, lod0=True)
        _panel(side, wall, u, z, w, 0.09, 0.11, frame, lod0=True)
    if sill:
        _panel(side, wall, u, z - h / 2 - 0.12, w + 0.4, 0.12, 0.18, frame, lod0=True)
    if shutter:
        for k in (-1, 1):
            _panel(side, wall, u + k * (w / 2 + 0.3), z, 0.36, h + 0.1, 0.07, shutter, lod0=True)


def _door(side, wall, u, z0, w, h, color="cocoa", knob="sun"):
    _panel(side, wall, u, z0 + h / 2 + 0.06, w + 0.26, h + 0.12, 0.05, "snow", lod0=True)
    _panel(side, wall, u, z0 + h / 2, w, h, 0.1, color)
    _panel(side, wall, u + w * 0.32, z0 + h * 0.47, 0.12, 0.12, 0.16, knob, lod0=True)


def _gable_x(w, d, z0, h, wall, roof, over=0.35, t=0.24, wall_tint=True, roof_tint=False, c=(0, 0), cap=None):
    """Gable roof, ridge along X: triangular end walls + two roof slabs + ridge cap."""
    cx, cy = c
    extrude([(-d / 2, 0), (d / 2, 0), (0, h)], w, at=(cx, cy, z0), rot=(90, 0, 90), color=wall, tint=wall_tint)
    a = math.atan2(h, d / 2)
    L = math.hypot(d / 2, h)
    ca, sa = math.cos(a), math.sin(a)
    for k in (-1, 1):
        y = cy + k * (d / 4 + over / 2 * ca + t / 2 * sa)
        z = z0 + h / 2 - over / 2 * sa + t / 2 * ca
        box((w + 2 * over, L + over, t), at=(cx, y, z), rot=(-k * math.degrees(a), 0, 0), color=roof,
            tint=roof_tint)
    cyl(t * 0.75, w + 2 * over + 0.04, at=(cx, cy, z0 + h + t * 0.55), rot=(0, 90, 0), base=False,
        color=cap or roof, tint=roof_tint and cap is None, segs=8)


def _gable_y(w, d, z0, h, wall, roof, over=0.35, t=0.24, wall_tint=True, roof_tint=False, c=(0, 0), cap=None):
    """Gable roof, ridge along Y (the gable faces the front)."""
    cx, cy = c
    extrude([(-w / 2, 0), (w / 2, 0), (0, h)], d, at=(cx, cy, z0), rot=(90, 0, 0), color=wall, tint=wall_tint)
    a = math.atan2(h, w / 2)
    L = math.hypot(w / 2, h)
    ca, sa = math.cos(a), math.sin(a)
    for k in (-1, 1):
        x = cx + k * (w / 4 + over / 2 * ca + t / 2 * sa)
        z = z0 + h / 2 - over / 2 * sa + t / 2 * ca
        box((L + over, d + 2 * over, t), at=(x, cy, z), rot=(0, k * math.degrees(a), 0), color=roof,
            tint=roof_tint)
    cyl(t * 0.75, d + 2 * over + 0.04, at=(cx, cy, z0 + h + t * 0.55), rot=(90, 0, 0), base=False,
        color=cap or roof, tint=roof_tint and cap is None, segs=8)


# ---------------------------------------------------------------- street furniture

@asset("traffic_cone", "Traffic Cone", "Stands in the road all day. Considers this a career.", 4, "rubber", "small",
       col="cyl", fill=0.35)
def traffic_cone():
    box((0.44, 0.44, 0.05), base=True, bevel=0.02, color="tangerine")
    top, bot, z0, h = 0.035, 0.17, 0.05, 0.64

    def r_at(z):
        return bot + (top - bot) * (z - z0) / h
    cyl(bot, h, r2=top, at=(0, 0, z0), color="tangerine", segs=14)
    for (za, zb) in ((0.2, 0.31), (0.41, 0.5)):
        cyl(r_at(za) + 0.006, zb - za, r2=r_at(zb) + 0.006, at=(0, 0, za), color="snow", segs=14)
    sphere(top * 1.15, at=(0, 0, z0 + h), color="tangerine", segs=8, rings=4)


@asset("fire_hydrant", "Fire Hydrant", "Short, stout, and every dog's favourite pen pal.", 4, "metal", "small",
       variants=["tomato", "sun", "lime", "sky"], col="cyl", fill=0.55)
def fire_hydrant():
    lathe([(0, 0), (0.2, 0), (0.2, 0.06), (0.15, 0.08), (0.14, 0.55), (0.18, 0.56), (0.18, 0.62), (0.15, 0.63),
           (0.13, 0.7), (0.07, 0.76), (0, 0.77)], color="tomato", tint=True, segs=12)
    cyl(0.04, 0.05, at=(0, 0, 0.75), color="cloud", segs=6, lod0=True)
    for k in (-1, 1):
        cyl(0.06, 0.08, at=(k * 0.15, 0, 0.42), rot=(0, k * 90, 0), color="tomato", tint=True, segs=8)
        cyl(0.06, 0.04, at=(k * 0.225, 0, 0.42), rot=(0, 90, 0), base=False, color="cloud", segs=6, lod0=True)
    cyl(0.085, 0.08, at=(0, -0.13, 0.33), rot=(90, 0, 0), color="tomato", tint=True, segs=10)
    cyl(0.09, 0.05, at=(0, -0.235, 0.33), rot=(90, 0, 0), base=False, color="cloud", segs=6)
    tube([(0.15, -0.07, 0.42), (0.1, -0.2, 0.3), (0.05, -0.24, 0.33)], 0.008, color="stone", segs=4, lod0=True)


@asset("mailbox", "Mailbox", "Mostly bills. Once, a postcard from a cousin.", 4, "metal", "small",
       variants=["cobalt", "tomato", "pine", "snow", "charcoal"], col="box", fill=0.25)
def mailbox():
    box((0.12, 0.12, 1.02), base=True, color="caramel", bevel=0.01)
    box((0.12, 0.34, 0.08), at=(0, 0.0, 0.94), base=True, color="caramel")
    box((0.28, 0.54, 0.15), at=(0, 0, 1.02), base=True, color="cobalt", tint=True)
    cyl(0.14, 0.54, at=(0, 0, 1.17), rot=(90, 0, 0), base=False, color="cobalt", tint=True, segs=12)
    # door: slightly proud, contrasting
    box((0.29, 0.03, 0.15), at=(0, -0.28, 1.02), base=True, color="cloud")
    cyl(0.145, 0.03, at=(0, -0.28, 1.17), rot=(90, 0, 0), base=False, color="cloud", segs=12)
    box((0.05, 0.03, 0.04), at=(0, -0.3, 1.25), color="ink_soft", lod0=True)
    # the raised flag (you've got mail)
    box((0.03, 0.04, 0.32), at=(0.16, 0.12, 1.05), base=True, color="tomato")
    box((0.03, 0.14, 0.1), at=(0.16, 0.07, 1.27), base=True, color="tomato")
    box((0.2, 0.012, 0.13), at=(0.0, -0.31, 1.24), rot=(-8, 0, 6), color="paper", lod0=True)
    box((0.04, 0.02, 0.16), at=(-0.02, -0.07, 0.7), base=True, color="snow", lod0=True)


@asset("wheelie_bin", "Wheelie Bin", "Taken for a walk every Tuesday. Never says thank you.", 4, "plastic", "small",
       variants=["leaf", "cobalt", "charcoal", "sun", "pine"], col="box", fill=0.85)
def wheelie_bin():
    box((0.56, 0.66, 0.92), at=(0, 0, 0.05), base=True, color="leaf", tint=True, bevel=0.035, taper=(1.12, 1.12))
    box((0.68, 0.82, 0.07), at=(0, -0.02, 0.97), base=True, color="leaf", tint=True, bevel=0.025)
    box((0.62, 0.06, 0.06), at=(0, 0.4, 0.95), color="ink_soft")  # hinge / handle
    tube([(-0.26, 0.42, 0.9), (-0.26, 0.48, 0.92), (0.26, 0.48, 0.92), (0.26, 0.42, 0.9)], 0.025, color="ink_soft",
         segs=6)
    for k in (-1, 1):
        cyl(0.11, 0.07, at=(k * 0.3, 0.3, 0.11), rot=(0, 90, 0), base=False, color="ink_soft", segs=12)
        cyl(0.05, 0.08, at=(k * 0.3, 0.3, 0.11), rot=(0, 90, 0), base=False, color="cloud", segs=6, lod0=True)
    cyl(0.025, 0.66, at=(0, 0.3, 0.11), rot=(0, 90, 0), base=False, color="stone", segs=6)
    _panel("-y", -0.36, 0, 0.62, 0.22, 0.22, 0.02, "snow", lod0=True)
    # the lid doesn't quite close: something banana-shaped escapes
    tube([(0.12, -0.36, 1.0), (0.18, -0.44, 0.96), (0.2, -0.47, 0.88)], 0.03, r_end=0.018, color="sun", segs=6,
         smooth_path=1)


@asset("park_bench", "Park Bench", "Reserved for pigeons and people pretending to read.", 4, "wood", "medium",
       variants=["pine", "caramel", "tomato", "cobalt"], col="box", fill=0.3)
def park_bench():
    W = 1.8
    for x in (-0.78, 0.78):
        # chunky cast-iron sides
        extrude([(-0.28, 0), (-0.18, 0), (-0.14, 0.38), (0.18, 0.38), (0.24, 0), (0.3, 0), (0.25, 0.46),
                 (0.31, 0.88), (0.24, 0.9), (0.18, 0.46), (-0.26, 0.46), (-0.3, 0.62), (-0.36, 0.6)], 0.07,
                at=(x, 0, 0), rot=(90, 0, 90), color="charcoal")
    for y in (-0.2, -0.07, 0.06, 0.19):
        box((W, 0.11, 0.045), at=(0, y, 0.43), base=True, bevel=0.012, color="pine", tint=True)
    for i, z in enumerate((0.6, 0.73)):
        box((W, 0.04, 0.11), at=(0, 0.23 + i * 0.03, z), rot=(-12, 0, 0), bevel=0.012, color="pine", tint=True)
    for x in (-0.78, 0.78):
        box((0.07, 0.42, 0.04), at=(x, -0.11, 0.6), rot=(-4, 0, 0), base=True, color="charcoal", bevel=0.012)
    # resident pigeon
    px, py, pz = 0.38, -0.08, 0.475
    sphere(0.085, at=(px, py, pz + 0.07), scale=(1.35, 0.9, 0.85), color="stone", segs=8, rings=5)
    sphere(0.05, at=(px + 0.1, py, pz + 0.16), color="stone", segs=8, rings=5)
    sphere(0.045, at=(px + 0.08, py, pz + 0.12), scale=(1, 1.1, 0.6), color="teal", segs=6, rings=4, lod0=True)
    cyl(0.016, 0.04, at=(px + 0.145, py, pz + 0.16), rot=(0, 90, 0), r2=0.004, color="tangerine", segs=5)
    _dot_eyes((px + 0.13, py, pz + 0.18), 0.075, 0.011, yaw=90)
    box((0.1, 0.06, 0.03), at=(px - 0.15, py, pz + 0.1), rot=(0, -20, 0), color="ink_soft", lod0=True)


@asset("stop_sign", "Stop Sign", "Says one word. Means it.", 4, "metal", "small", col="cyl", fill=0.08)
def stop_sign():
    cyl(0.04, 2.15, color="stone", segs=8)
    cyl(0.09, 0.05, color="stone", segs=8)
    z = 2.1
    extrude(ngon_points(8, 0.42, start=22.5), 0.03, at=(0, 0.02, z), rot=(90, 0, 0), color="snow")
    extrude(ngon_points(8, 0.37, start=22.5), 0.03, at=(0, -0.005, z), rot=(90, 0, 0), color="tomato")
    # chunky "STOP" lettering as four blocky glyph slabs
    for i in range(4):
        _panel("-y", -0.02, -0.21 + i * 0.14, z, 0.1, 0.17, 0.012, "snow", lod0=True)
    box((0.12, 0.06, 0.08), at=(0, 0.04, z - 0.33), color="stone", lod0=True)


@asset("lemonade_stand", "Lemonade Stand", "Twenty-five cents. Mostly sugar. Entirely honest.", 4, "wood", "medium",
       variants=["sun", "flamingo", "sky", "lime"], col="box", fill=0.45)
def lemonade_stand():
    box((1.5, 0.7, 0.98), base=True, bevel=0.02, color="caramel")
    for x in (-0.37, 0.0, 0.37):
        _panel("-y", -0.35, x, 0.5, 0.03, 0.9, 0.02, "cocoa", lod0=True)
    box((1.64, 0.86, 0.06), at=(0, -0.03, 0.98), base=True, bevel=0.015, color="sand")
    # the sign
    _panel("-y", -0.35, 0, 0.56, 1.12, 0.5, 0.04, "paper")
    sphere(0.17, at=(-0.32, -0.41, 0.56), scale=(1.25, 0.3, 0.95), color="sun", segs=10, rings=6)
    sphere(0.04, at=(-0.13, -0.41, 0.6), scale=(1.2, 0.4, 0.8), color="sun", segs=6, rings=4, lod0=True)
    for i, w in enumerate((0.5, 0.36)):
        _panel("-y", -0.39, 0.16, 0.63 - i * 0.12, w, 0.06, 0.012, "ink_soft", lod0=True)
    # posts and striped awning
    for x in (-0.73, 0.73):
        for y in (-0.33, 0.3):
            box((0.07, 0.07, 1.0 if y > 0 else 0.86), at=(x, y, 1.04), base=True, color="caramel")
    n = 6
    sw = 1.7 / n
    for i in range(n):
        c, t = ("sun", True) if i % 2 == 0 else ("snow", False)
        x = -0.85 + sw * (i + 0.5)
        box((sw, 0.92, 0.05), at=(x, -0.07, 1.98), rot=(14, 0, 0), color=c, tint=t)
        sphere(sw / 2, at=(x, -0.52, 1.87), scale=(1, 0.18, 0.75), color=c, tint=t, segs=8, rings=4, lod0=True)
    # pitcher and cups
    cyl(0.1, 0.26, at=(0.3, -0.08, 1.04), color="glass", segs=10)
    cyl(0.088, 0.17, at=(0.3, -0.08, 1.045), color="butter", segs=10, lod0=True)
    torus(0.06, 0.016, at=(0.41, -0.08, 1.17), rot=(90, 0, 0), color="glass", segs=8, rsegs=4, arc=200)
    for (x, y) in ((-0.1, -0.2), (-0.26, -0.12), (0.02, 0.02)):
        cyl(0.045, 0.11, r2=0.055, at=(x, y, 1.04), color="snow", segs=8)
    sphere(0.07, at=(-0.5, 0.05, 1.11), scale=(1.2, 1, 0.9), color="sun", segs=8, rings=5, lod0=True)


@asset("phone_booth", "Phone Booth", "Took coins, gave directions, kept secrets.", 4, "metal", "medium",
       variants=["tomato", "cobalt", "pine", "sun"], col="box", fill=0.85)
def phone_booth():
    box((1.12, 1.12, 0.12), base=True, color="charcoal")
    box((1.0, 1.0, 2.14), at=(0, 0, 0.12), base=True, bevel=0.04, color="tomato", tint=True)
    box((1.12, 1.12, 0.12), at=(0, 0, 2.24), base=True, bevel=0.03, color="tomato", tint=True)
    box((1.0, 1.0, 0.16), at=(0, 0, 2.36), base=True, taper=(0.55, 0.55), color="tomato", tint=True)
    sphere(0.07, at=(0, 0, 2.55), color="sun", segs=8, rings=5)
    for (sx, sy) in ((0.78, 1.03), (1.03, 0.78)):
        box((sx, sy, 0.15), at=(0, 0, 1.98), base=True, color="snow")
        box((sx * 0.95, sy, 1.38), at=(0, 0, 0.5), base=True, color="glass")
    for i in range(4):
        _panel("-y", -0.515, -0.24 + i * 0.16, 2.055, 0.1, 0.08, 0.01, "ink", lod0=True)
    for z in (0.95, 1.4):
        for (sx, sy) in ((0.74, 1.045), (1.045, 0.74)):
            box((sx, sy, 0.05), at=(0, 0, z), color="tomato", tint=True, lod0=True)
    for (sx, sy) in ((0.05, 1.045), (1.045, 0.05)):
        box((sx, sy, 1.38), at=(0, 0, 0.5), base=True, color="tomato", tint=True, lod0=True)
    _panel("-y", -0.5, 0.42, 1.2, 0.04, 0.22, 0.06, "stone", lod0=True)
    # receiver shape visible behind the glass
    box((0.24, 0.12, 0.3), at=(0, -0.38, 1.25), base=True, color="ink_soft", bevel=0.02)


@asset("picket_fence", "Picket Fence", "Keeps nothing in and nothing out. Looks great doing it.", 4, "wood",
       "medium", variants=["snow", "sky", "butter", "bubblegum"], col="box", fill=0.25)
def picket_fence():
    W, H = 2.5, 1.0
    n = 13
    pw = 0.12
    picket = [(-pw / 2, 0.0), (pw / 2, 0.0), (pw / 2, H - 0.1), (0, H), (-pw / 2, H - 0.1)]
    for i in range(n):
        x = -W / 2 + 0.15 + (W - 0.3) * i / (n - 1)
        h = 1.0 + 0.04 * math.sin(i * 1.7)
        extrude([(px + x, py * h) for (px, py) in picket], 0.03, at=(0, -0.02, 0), rot=(90, 0, 0), color="snow",
                tint=True)
    for z in (0.25, 0.68):
        box((W, 0.04, 0.09), at=(0, 0.02, z), color="snow", tint=True)
    for x in (-W / 2 + 0.03, W / 2 - 0.03):
        box((0.11, 0.11, 1.08), at=(x, 0.02, 0), base=True, color="snow", tint=True)
        sphere(0.075, at=(x, 0.02, 1.12), color="snow", tint=True, segs=8, rings=5)


@asset("picnic_table", "Picnic Table", "The ants booked it first.", 4, "wood", "medium",
       variants=["caramel", "tomato", "leaf", "cobalt"], col="box", fill=0.35)
def picnic_table():
    for y in (-0.28, -0.093, 0.093, 0.28):
        box((1.95, 0.175, 0.06), at=(0, y, 0.72), base=True, bevel=0.015, color="caramel", tint=True)
    for k in (-1, 1):
        for y in (0.06, 0.2):
            box((1.95, 0.13, 0.05), at=(0, k * (0.5 + y) , 0.42), base=True, bevel=0.012, color="caramel",
                tint=True)
    for x in (-0.72, 0.72):
        for k in (-1, 1):
            box((0.08, 0.1, 0.98), at=(x, k * 0.43, 0.37), rot=(k * 40.4, 0, 0), color="cocoa")
        box((0.08, 1.6, 0.07), at=(x, 0, 0.36), base=True, color="cocoa")
        box((0.08, 0.7, 0.07), at=(x, 0, 0.65), base=True, color="cocoa")
    # watermelon slice, a basket, a lemonade
    arc = [(0.22 * math.cos(math.radians(a)), 0.22 * math.sin(math.radians(a))) for a in range(0, 181, 30)]
    extrude(arc, 0.07, at=(-0.35, -0.05, 0.78), rot=(90, 0, 15), center=False, color="leaf")
    extrude([(x * 0.84, y * 0.84 + 0.01) for (x, y) in arc], 0.075, at=(-0.35, -0.052, 0.78), rot=(90, 0, 15),
            center=False, color="tomato")
    box((0.42, 0.3, 0.22), at=(0.4, 0.08, 0.78), base=True, bevel=0.02, color="sand", taper=(1.1, 1.1))
    torus(0.18, 0.02, at=(0.4, 0.08, 1.0), rot=(90, 0, 0), color="sand", segs=10, rsegs=4, arc=180)
    box((0.42, 0.3, 0.012), at=(0.4, 0.08, 0.98), base=True, color="tomato", lod0=True)
    cyl(0.04, 0.12, at=(0.05, -0.2, 0.78), color="snow", segs=8, lod0=True)


@asset("garden_shed", "Garden Shed", "One rake, nine pots and a spider named Gerald.", 4, "wood", "medium",
       variants=["pine", "sky", "butter", "tomato", "lavender"], col="box", fill=0.8)
def garden_shed():
    W, D, H = 2.4, 1.8, 1.9
    box((W + 0.1, D + 0.1, 0.12), base=True, color="stone")
    box((W, D, H), at=(0, 0, 0.12), base=True, color="pine", tint=True)
    for i in range(5):
        _panel("-y", -D / 2, -W / 2 + 0.25 + i * 0.475, 1.07, 0.04, H - 0.05, 0.02, "ink_soft", lod0=True)
    _gable_x(W, D, 0.12 + H, 0.85, "pine", "charcoal", over=0.25, t=0.14)
    _door("-y", -D / 2, -0.45, 0.12, 0.8, 1.6, color="sand", knob="ink_soft")
    tube([(-0.81, -D / 2 - 0.13, 0.3), (-0.09, -D / 2 - 0.13, 1.62)], 0.035, color="caramel", segs=4, lod0=True)
    _window("-y", -D / 2, 0.6, 1.25, 0.6, 0.5, frame="snow", sill=False)
    _panel("-y", -D / 2, 0.6, 0.86, 0.75, 0.18, 0.25, "cocoa")
    for i, c in enumerate(("tomato", "sun", "flamingo")):
        sphere(0.08, at=(0.38 + i * 0.22, -D / 2 - 0.13, 1.0), color=c, segs=6, rings=4, lod0=True)
    _window("+x", W / 2, 0.0, 1.3, 0.55, 0.45, sill=False)
    # rake leaning on the side
    tube([(W / 2 + 0.12, -0.6, 0.0), (W / 2 + 0.06, -0.45, 1.7)], 0.025, color="caramel", segs=5)
    box((0.06, 0.4, 0.05), at=(W / 2 + 0.12, -0.6, 0.06), color="stone")


@asset("basketball_hoop", "Basketball Hoop", "Nothing but net. Mostly nothing.", 4, "metal", "medium",
       variants=["charcoal", "cobalt", "tomato"], col="box", fill=0.08)
def basketball_hoop():
    box((0.8, 1.05, 0.32), at=(0, 0.35, 0), base=True, bevel=0.05, color="charcoal", tint=True)
    cyl(0.08, 2.75, at=(0, 0.45, 0.3), color="stone", segs=10)
    tube([(0, 0.45, 2.9), (0, 0.45, 3.0), (0, 0.32, 3.05), (0, 0.06, 3.05)], 0.06, color="stone", segs=6,
         smooth_path=1)
    box((1.2, 0.07, 0.82), at=(0, 0.0, 2.58), base=True, bevel=0.03, color="snow")
    _panel("-y", -0.035, 0, 2.86, 0.52, 0.4, 0.015, "tomato")
    _panel("-y", -0.035, 0, 2.86, 0.4, 0.28, 0.022, "snow", lod0=True)
    box((0.12, 0.12, 0.05), at=(0, -0.09, 2.7), color="tangerine")
    torus(0.23, 0.025, at=(0, -0.37, 2.72), color="tangerine", segs=14, rsegs=4)
    lathe([(0.22, 2.42), (0.15, 2.42), (0.19, 2.71), (0.22, 2.71)], at=(0, -0.37, 0), color="snow", segs=10)
    sphere(0.12, at=(0.55, -0.4, 0.12), color="tangerine", segs=10, rings=6)
    torus(0.12, 0.008, at=(0.55, -0.4, 0.12), rot=(90, 0, 30), color="ink", segs=10, rsegs=3, lod0=True)


@asset("swing_set", "Swing Set", "Goes back and forth. Never gets anywhere. Loves it.", 4, "metal", "medium",
       variants=["tomato", "sky", "leaf", "grape"], col="box", fill=0.12)
def swing_set():
    W, H = 3.3, 2.2
    for x in (-W / 2 + 0.1, W / 2 - 0.1):
        for k in (-1, 1):
            tube([(x, k * 0.95, 0.0), (x, 0, H)], 0.06, color="tomato", tint=True, segs=8)
            sphere(0.08, at=(x, k * 0.95, 0.03), scale=(1, 1, 0.5), color="ink_soft", segs=6, rings=4)
        box((0.08, 1.3, 0.08), at=(x, 0, 0.75), color="tomato", tint=True, lod0=True)
    cyl(0.085, W + 0.2, at=(0, 0, H), rot=(0, 90, 0), base=False, color="tomato", tint=True, segs=10)
    for x in (-W / 2 - 0.1, W / 2 + 0.1):
        sphere(0.1, at=(x, 0, H), color="sun", segs=8, rings=5)
    # two swings, one mid-swoosh
    for (x, swing, c) in ((-0.75, 0.0, "sun"), (0.65, 22.0, "flamingo")):
        a = math.radians(swing)
        L = H - 0.55
        sy, sz = -L * math.sin(a), H - L * math.cos(a)
        for dx in (-0.26, 0.26):
            tube([(x + dx, 0, H - 0.05), (x + dx, sy, sz + 0.03)], 0.018, color="stone", segs=4)
        box((0.6, 0.26, 0.06), at=(x, sy, sz), rot=(-swing, 0, 0), bevel=0.02, color=c)


@asset("trampoline", "Trampoline", "Gravity, but optional for about half a second.", 4, "rubber", "large",
       variants=["sky", "lime", "flamingo", "sun"], col="cyl", fill=0.3)
def trampoline():
    R, z = 1.7, 0.85
    torus(R, 0.045, at=(0, 0, z), color="stone", segs=24, rsegs=4)
    cyl(R - 0.12, 0.03, at=(0, 0, z - 0.01), color="ink_soft", segs=22)
    torus(R - 0.05, 0.2, at=(0, 0, z + 0.02), scale=(1, 1, 0.35), color="sky", tint=True, segs=24, rsegs=6)
    for i in range(3):
        a0 = math.radians(120 * i + 10)
        a1 = math.radians(120 * i + 50)
        p0 = (R * math.cos(a0), R * math.sin(a0))
        p1 = (R * math.cos(a1), R * math.sin(a1))
        tube([(p0[0], p0[1], z), (p0[0] * 1.02, p0[1] * 1.02, 0.03), (p1[0] * 1.02, p1[1] * 1.02, 0.03),
              (p1[0], p1[1], z)], 0.04, color="stone", segs=5)
    # net poles + top hoop
    n = 8
    for i in range(n):
        a = math.radians(360 * i / n + 22.5)
        c, s = math.cos(a), math.sin(a)
        tube([(R * c, R * s, z), (R * 1.0 * c, R * 1.0 * s, 1.9), (R * 0.97 * c, R * 0.97 * s, 2.5)], 0.045,
             color="sky", tint=True, segs=5, smooth_path=1)
    torus(R * 0.97, 0.035, at=(0, 0, 2.5), color="stone", segs=20, rsegs=4)
    # a forgotten ball, mid-bounce
    sphere(0.22, at=(0.3, -0.2, 1.55), color="tomato", segs=10, rings=6)
    torus(0.22, 0.03, at=(0.3, -0.2, 1.55), rot=(70, 0, 20), color="snow", segs=12, rsegs=3, lod0=True)


@asset("playground_slide", "Playground Slide", "Wheee is its entire vocabulary.", 4, "plastic", "medium",
       variants=["sun", "tomato", "sky", "lime"], col="box", fill=0.2)
def playground_slide():
    zt = 1.6
    for y in (-0.33, 0.33):
        tube([(-1.55, y, 0.0), (-1.2, y, zt + 0.8)], 0.05, color="teal", segs=6)
        cyl(0.06, zt, at=(-0.55, y, 0), color="teal", segs=8)
    for i in range(5):
        z = zt * (i + 1) / 6
        box((0.06, 0.7, 0.05), at=(-1.55 + 0.35 * z / (zt + 0.8), 0, z), color="snow")
    box((0.75, 0.8, 0.1), at=(-0.88, 0, zt), base=True, bevel=0.02, color="teal")
    for y in (-0.38, 0.38):
        tube([(-1.22, y, zt + 0.75), (-0.88, y, zt + 0.8), (-0.55, y, zt + 0.6)], 0.04, color="teal", segs=6,
             smooth_path=1)
    # the chute: side profile strip extruded across Y
    pts = []
    n = 5 if _lod1() else 9
    for i in range(n):
        t = i / (n - 1)
        x = -0.55 + 2.05 * t
        z = zt + 0.08 - (zt - 0.25) * (3 * t * t - 2 * t * t * t)
        pts.append((x, z))
    pts.append((1.85, 0.33))
    bed = [(x, z) for (x, z) in pts] + [(x, z - 0.07) for (x, z) in reversed(pts)]
    extrude(bed, 0.6, at=(0, 0, 0), rot=(90, 0, 0), color="sun", tint=True)
    wall = [(x, z + 0.2) for (x, z) in pts] + [(x, z - 0.07) for (x, z) in reversed(pts)]
    for y in (-0.32, 0.32):
        extrude(wall, 0.06, at=(0, y, 0), rot=(90, 0, 0), color="sun", tint=True)
    for (x, h) in ((0.55, 0.62), (1.6, 0.3)):
        for y in (-0.25, 0.25):
            cyl(0.04, h, at=(x, y, 0), color="teal", segs=6)


@asset("motorcycle", "Motorcycle", "Leather jacket not included. Attitude is.", 4, "metal", "medium",
       variants=["tomato", "cobalt", "sun", "ink_soft", "mint"], col="box", fill=0.3)
def motorcycle():
    r = 0.33
    for x in (-0.72, 0.72):
        _tyre((x, 0, r), r, 0.16, hub="stone", segs=16)
    box((0.5, 0.26, 0.34), at=(-0.04, 0, 0.22), base=True, bevel=0.05, color="charcoal")
    for k in (-1, 1):
        cyl(0.09, 0.08, at=(0.0, k * 0.17, 0.4), rot=(90, 0, 0), base=False, color="stone", segs=8, lod0=True)
    sphere(0.26, at=(0.12, 0, 0.8), scale=(1.35, 0.78, 0.6), color="tomato", tint=True, segs=12, rings=7)
    sphere(0.22, at=(-0.36, 0, 0.78), scale=(1.5, 0.75, 0.32), color="ink_soft", segs=8, rings=5)
    sphere(0.2, at=(-0.68, 0, 0.73), scale=(1.4, 0.55, 0.4), rot=(0, -12, 0), color="tomato", tint=True, segs=10,
           rings=5)
    torus(r + 0.04, 0.05, at=(0.72, 0, r), rot=(90, 0, 0), arc=150, color="tomato", tint=True, segs=10, rsegs=4,
          scale=(1, 1, 1.6))
    for k in (-1, 1):
        tube([(0.72, k * 0.09, r), (0.5, k * 0.09, 1.02)], 0.035, color="stone", segs=6)
        tube([(-0.72, k * 0.09, r), (-0.3, k * 0.12, 0.62)], 0.03, color="stone", segs=5)
    tube([(0.42, -0.36, 1.12), (0.5, -0.2, 1.06), (0.5, 0.2, 1.06), (0.42, 0.36, 1.12)], 0.025, color="stone",
         segs=4)
    for k in (-1, 1):
        cyl(0.035, 0.12, at=(0.42, k * 0.38, 1.12), rot=(90, 0, 0), base=False, color="ink_soft", segs=6)
        tube([(0.46, k * 0.27, 1.08), (0.44, k * 0.3, 1.28)], 0.01, color="stone", segs=4, lod0=True)
        sphere(0.04, at=(0.44, k * 0.3, 1.3), scale=(1, 1.4, 0.8), color="cloud", segs=6, rings=4, lod0=True)
    cyl(0.12, 0.1, at=(0.62, 0, 0.92), rot=(0, 90, 0), color="stone", segs=10)
    cyl(0.1, 0.02, at=(0.72, 0, 0.92), rot=(0, 90, 0), color="butter", segs=10)
    tube([(0.05, 0.19, 0.25), (-0.4, 0.21, 0.32), (-0.85, 0.21, 0.45)], 0.055, color="cloud", segs=8)
    cyl(0.065, 0.06, at=(-0.86, 0.21, 0.455), rot=(0, -75, 0), base=False, color="ink_soft", segs=8, lod0=True)
    box((0.04, 0.16, 0.06), at=(-0.93, 0, 0.72), color="tomato")


@asset("dumpster", "Dumpster", "The raccoon's penthouse. Please knock.", 4, "metal", "medium",
       variants=["pine", "cobalt", "sun", "tomato"], col="box", fill=0.85)
def dumpster():
    W, D = 2.6, 1.4
    z0 = 0.18
    box((W, D, 1.15), at=(0, 0, z0), base=True, bevel=0.04, color="pine", tint=True, taper=(1.06, 1.12))
    box((W * 1.06 + 0.08, D * 1.12 + 0.08, 0.1), at=(0, 0, z0 + 1.1), base=True, color="pine", tint=True)
    for x in (-W / 2 + 0.25, W / 2 - 0.25):
        for y in (-D / 2 + 0.2, D / 2 - 0.2):
            cyl(0.09, 0.08, at=(x, y, 0.09), rot=(90, 0, 0), base=False, color="ink_soft", segs=8)
            box((0.12, 0.12, 0.08), at=(x, y, 0.12), base=True, color="charcoal")
    for k in (-1, 1):
        box((0.12, 0.6, 0.3), at=(k * (W / 2 + 0.06), 0, 0.55), base=True, color="charcoal")
    # two lids: one shut, one flung back
    zt = z0 + 1.2
    box((W * 0.53, D * 1.2, 0.06), at=(-W * 0.27, 0, zt), base=True, rot=(-4, 0, 0), bevel=0.02, color="ink_soft")
    box((W * 0.53, 0.06, D * 1.1), at=(W * 0.27, D * 0.62, zt), base=True, rot=(-12, 0, 0), bevel=0.02,
        color="ink_soft")
    # resident
    rx, ry, rz = 0.6, -0.15, zt + 0.2
    sphere(0.33, at=(rx, ry + 0.05, rz - 0.12), scale=(1.1, 0.9, 0.8), color="stone", segs=10, rings=6)
    sphere(0.3, at=(rx, ry, rz + 0.12), scale=(1.12, 0.95, 0.88), color="stone", segs=12, rings=7)
    for k in (-1, 1):
        extrude([(-0.09, 0), (0.09, 0), (0, 0.17)], 0.07, at=(rx + k * 0.2, ry + 0.02, rz + 0.3),
                rot=(90, 0, -k * 18), color="charcoal")
    sphere(0.2, at=(rx, ry - 0.2, rz + 0.15), scale=(1.65, 0.45, 0.5), color="charcoal", segs=10, rings=5)
    sphere(0.12, at=(rx, ry - 0.25, rz + 0.0), scale=(1.2, 0.9, 0.75), color="snow", segs=8, rings=5)
    sphere(0.045, at=(rx, ry - 0.36, rz + 0.04), color="ink", segs=6, rings=4, lod0=True)
    for k in (-1, 1):
        sphere(0.055, at=(rx + k * 0.12, ry - 0.27, rz + 0.16), scale=(1, 0.5, 1.15), color="snow", segs=6, rings=4)
        sphere(0.032, at=(rx + k * 0.12, ry - 0.3, rz + 0.155), scale=(1, 0.5, 1.15), color="ink", segs=6, rings=4,
               lod0=True)
        sphere(0.08, at=(rx + k * 0.22, ry - 0.42, zt + 0.08), scale=(1, 1.3, 0.6), color="charcoal", segs=6,
               rings=4, lod0=True)
    box((0.4, 0.3, 0.02), at=(-0.4, -0.2, zt + 0.08), rot=(10, -6, 25), color="paper", lod0=True)


# ---------------------------------------------------------------- plants & lamps

@asset("tree_round", "Round Tree", "A lollipop for giants. Do not lick.", 4, "plant", "large",
       variants=["leaf", "lime", "pine", "tangerine", "bubblegum"], col="cyl", fill=0.4)
def tree_round():
    lathe([(0, 0), (0.55, 0), (0.42, 0.25), (0.35, 0.8), (0.3, 3.4), (0, 3.4)], color="cocoa", segs=10)
    tube([(0.1, 0, 2.4), (0.6, -0.1, 3.0), (0.85, -0.15, 3.4)], 0.12, r_end=0.08, color="cocoa", segs=6)
    sphere(2.45, at=(0, 0, 4.55), scale=(1, 1, 0.95), color="leaf", tint=True, segs=16, rings=10)
    for (x, y, z, r) in ((1.55, -1.0, 3.6, 1.15), (-1.7, -0.6, 3.75, 1.1), (0.2, -1.6, 5.4, 1.0),
                         (-0.9, 1.3, 5.6, 1.1), (1.4, 1.1, 4.9, 1.0)):
        sphere(r, at=(x, y, z), color="leaf", tint=True, segs=10, rings=6)
    for (x, z) in ((0.9, 4.3), (-0.6, 3.9), (0.1, 5.0), (-1.4, 4.9), (1.6, 5.2)):
        sphere(0.17, at=(x, -2.25 + 0.4 * abs(x) / 1.6 + 0.3 * abs(z - 4.5), z), color="tomato", segs=6, rings=4,
               lod0=True)


@asset("pine_tree", "Pine Tree", "Pointy all year round. Smells festive in July.", 4, "plant", "medium",
       variants=["pine", "leaf"], col="cyl", fill=0.35)
def pine_tree():
    cyl(0.4, 1.4, r2=0.3, color="cocoa", segs=8)
    for (z, r, h) in ((1.0, 2.5, 3.0), (2.9, 2.05, 2.8), (4.6, 1.6, 2.6), (6.2, 1.1, 2.7)):
        cyl(r, h, r2=r * 0.12, at=(0, 0, z), color="pine", tint=True, segs=12)
        cyl(r * 1.02, 0.25, r2=r * 0.9, at=(0, 0, z), color="pine", tint=True, segs=12, lod0=True)
    sphere(0.22, at=(0, 0, 8.9), color="pine", tint=True, segs=6, rings=4)
    for (x, z) in ((-0.9, 2.0), (0.7, 4.1), (-0.4, 5.6), (1.3, 1.8)):
        sphere(0.14, at=(x, -(2.4 - 0.32 * z) * 0.86, z), scale=(0.8, 0.8, 1.2), color="caramel", segs=6, rings=4,
               lod0=True)


@asset("bush", "Bush", "Contains one lost frisbee and a very calm cat.", 4, "plant", "medium",
       variants=["leaf", "pine", "lime"], col="cyl", fill=0.7)
def bush():
    for (x, y, z, r) in ((0.0, 0.0, 0.5, 0.56), (-0.42, 0.08, 0.38, 0.42), (0.44, 0.06, 0.36, 0.4),
                         (0.12, -0.16, 0.86, 0.36), (-0.2, 0.15, 0.88, 0.33)):
        sphere(r, at=(x, y, z), color="leaf", tint=True, segs=12, rings=7)
    for (x, z, c) in ((-0.3, 0.6, "bubblegum"), (0.25, 0.75, "snow"), (0.5, 0.42, "bubblegum"),
                      (-0.55, 0.3, "snow"), (0.02, 0.35, "bubblegum"), (-0.05, 1.05, "snow")):
        y = -math.sqrt(max(0.02, 0.56 ** 2 - x * x * 0.6 - (z - 0.5) ** 2 * 0.5)) - 0.02
        sphere(0.06, at=(x, y, z), scale=(1, 0.5, 1), color=c, segs=6, rings=4, lod0=True)


@asset("street_lamp", "Street Lamp", "Clocks on at dusk. The moths have been notified.", 4, "metal", "medium",
       variants=["charcoal", "pine", "navy"], col="box", fill=0.05)
def street_lamp():
    lathe([(0, 0), (0.24, 0), (0.24, 0.1), (0.16, 0.2), (0.12, 0.55), (0.15, 0.62), (0, 0.62)], color="charcoal",
          tint=True, segs=10)
    cyl(0.075, 4.2, r2=0.055, at=(0, 0, 0.6), color="charcoal", tint=True, segs=8)
    tube([(0, 0, 4.7), (0, 0, 4.95), (0.12, 0, 5.12), (0.4, 0, 5.18), (0.75, 0, 5.08), (0.85, 0, 5.0)], 0.055,
         color="charcoal", tint=True, segs=6, smooth_path=1)
    tube([(0, 0, 4.2), (0.25, 0, 4.55), (0.5, 0, 4.98)], 0.03, color="charcoal", tint=True, segs=5, lod0=True)
    lathe([(0, 4.78), (0.38, 4.78), (0.34, 4.86), (0.2, 4.98), (0.06, 5.04), (0, 5.05)], at=(0.88, 0, 0),
          color="charcoal", tint=True, segs=12)
    sphere(0.22, at=(0.88, 0, 4.78), scale=(1, 1, 0.55), color="butter", segs=10, rings=5)
    # a lost-cat poster, naturally
    _panel("-y", -0.07, 0.0, 1.7, 0.3, 0.38, 0.015, "paper", rot=(0, 0, 0))
    _panel("-y", -0.085, 0.0, 1.73, 0.16, 0.14, 0.01, "ink_soft", lod0=True)


@asset("bus_stop", "Bus Stop", "The bus is coming. The bus is always coming.", 4, "glass", "medium",
       variants=["cobalt", "teal", "tomato", "sun"], col="box", fill=0.3)
def bus_stop():
    W, D, H = 3.3, 1.4, 2.45
    for x in (-W / 2, W / 2):
        for y in (-D / 2, D / 2):
            box((0.1, 0.1, H), at=(x, y, 0), base=True, color="charcoal")
    box((W + 0.45, D + 0.35, 0.18), at=(0, -0.05, H), base=True, rot=(-4, 0, 0), bevel=0.05, color="cobalt",
        tint=True)
    box((W, 0.05, 1.9), at=(0, D / 2, 0.35), base=True, color="glass")
    box((0.05, D, 1.9), at=(-W / 2, 0, 0.35), base=True, color="glass")
    # advert panel on the right
    box((0.14, D * 0.85, 1.75), at=(W / 2, 0.05, 0.3), base=True, color="charcoal")
    box((0.16, D * 0.72, 1.55), at=(W / 2, 0.05, 0.4), base=True, color="sun")
    sphere(0.32, at=(W / 2 + 0.06, 0.05, 1.3), scale=(0.3, 1, 1), color="flamingo", segs=10, rings=6)
    box((0.17, D * 0.5, 0.12), at=(W / 2, 0.05, 0.7), base=True, color="ink_soft", lod0=True)
    # bench
    box((W - 0.5, 0.4, 0.07), at=(0, 0.35, 0.47), base=True, bevel=0.02, color="sand")
    for x in (-1.0, 1.0):
        box((0.08, 0.3, 0.47), at=(x, 0.38, 0), base=True, color="charcoal")
    # stop sign
    sx, sy = W / 2 + 0.55, -D / 2 - 0.1
    cyl(0.045, 2.55, at=(sx, sy, 0), color="stone", segs=8)
    cyl(0.32, 0.06, at=(sx, sy, 2.55), rot=(90, 0, 0), base=False, color="sun", segs=14)
    cyl(0.25, 0.08, at=(sx, sy, 2.55), rot=(90, 0, 0), base=False, color="cobalt", segs=12)
    box((0.26, 0.1, 0.12), at=(sx, sy - 0.01, 2.56), color="snow", lod0=True)
    box((0.26, 0.05, 0.38), at=(sx, sy - 0.05, 1.5), base=True, color="paper", lod0=True)


# ---------------------------------------------------------------- vehicles (nose at +X)

@asset("car", "Car", "Four wheels, one cup holder, endless snack crumbs.", 4, "metal", "large",
       variants=["tomato", "sky", "sun", "mint", "flamingo", "tangerine", "lavender"], col="box", fill=0.65)
def car():
    r, wy = 0.42, 0.76
    _wheels((-1.32, 1.32), wy, r, r, 0.34)
    box((4.15, 1.78, 0.74), at=(0, 0, 0.3), base=True, bevel=0.3, color="tomato", tint=True)
    box((2.3, 1.62, 0.66), at=(-0.28, 0, 0.92), base=True, taper=(0.72, 0.84), bevel=0.14, color="glass")
    box((1.82, 1.46, 0.15), at=(-0.32, 0, 1.52), base=True, bevel=0.06, color="tomato", tint=True)
    box((0.16, 1.64, 0.62), at=(-0.3, 0, 0.94), base=True, taper=(1, 0.86), color="tomato", tint=True)
    for x in (2.06, -2.06):
        box((0.22, 1.72, 0.24), at=(x, 0, 0.28), base=True, bevel=0.08, color="cloud")
    for k in (-1, 1):
        sphere(0.15, at=(2.02, k * 0.56, 0.8), scale=(0.45, 1, 0.9), color="butter", segs=10, rings=5)
        box((0.08, 0.26, 0.14), at=(-2.06, k * 0.6, 0.82), bevel=0.03, color="tomato")
        _panel("-y" if k < 0 else "+y", k * 0.89, -0.05, 0.7, 0.04, 0.5, 0.02, "ink_soft", lod0=True)
        _panel("-y" if k < 0 else "+y", k * 0.89, 0.25, 0.86, 0.22, 0.05, 0.03, "cloud", lod0=True)
        _panel("-y" if k < 0 else "+y", k * 0.89, -0.65, 0.86, 0.22, 0.05, 0.03, "cloud", lod0=True)
        sphere(0.08, at=(0.62, k * 0.92, 1.05), scale=(1.3, 0.6, 0.8), color="tomato", tint=True, segs=6, rings=4,
               lod0=True)
    box((0.06, 0.9, 0.18), at=(2.1, 0, 0.6), color="ink_soft", lod0=True)
    tube([(-1.0, 0.5, 1.6), (-1.35, 0.5, 2.05)], 0.012, color="ink_soft", segs=4, lod0=True)
    sphere(0.04, at=(-1.35, 0.5, 2.06), color="tomato", segs=6, rings=4, lod0=True)


@asset("pickup_truck", "Pickup Truck", "Every neighbour's best friend on moving day.", 4, "metal", "large",
       variants=["cobalt", "tomato", "sun", "pine", "sand"], col="box", fill=0.55)
def pickup_truck():
    r, wy = 0.46, 0.86
    _wheels((-1.75, 1.75), wy, r, r, 0.36)
    box((5.3, 1.6, 0.28), at=(0, 0, 0.42), base=True, color="charcoal")
    box((2.85, 2.0, 0.82), at=(1.3, 0, 0.55), base=True, bevel=0.22, color="cobalt", tint=True)
    box((1.6, 1.84, 0.78), at=(0.45, 0, 1.3), base=True, taper=(0.8, 0.9), bevel=0.1, color="glass")
    box((1.38, 1.72, 0.14), at=(0.4, 0, 2.03), base=True, bevel=0.05, color="cobalt", tint=True)
    box((0.14, 1.86, 0.78), at=(0.35, 0, 1.3), base=True, taper=(1, 0.9), color="cobalt", tint=True)
    # bed
    box((2.6, 1.9, 0.18), at=(-1.4, 0, 0.6), base=True, color="ink_soft")
    for k in (-1, 1):
        box((2.6, 0.12, 0.72), at=(-1.4, k * 0.95, 0.62), base=True, bevel=0.04, color="cobalt", tint=True)
    box((0.14, 2.02, 0.72), at=(-2.67, 0, 0.62), base=True, bevel=0.04, color="cobalt", tint=True)
    box((0.06, 0.8, 0.12), at=(-2.75, 0, 1.12), color="ink_soft", lod0=True)
    for x in (2.8, -2.8):
        box((0.2, 2.0, 0.26), at=(x, 0, 0.42), base=True, bevel=0.08, color="cloud")
    for k in (-1, 1):
        box((0.1, 0.38, 0.2), at=(2.76, k * 0.66, 1.05), bevel=0.04, color="butter")
        box((0.06, 0.16, 0.26), at=(-2.75, k * 0.86, 1.0), color="tomato")
    _panel("+x", 2.73, 0, 1.0, 0.7, 0.24, 0.03, "stone", lod0=True)
    # cargo: hay bale and a crate
    box((1.0, 0.75, 0.6), at=(-1.75, 0.3, 0.78), base=True, bevel=0.1, color="butter")
    for x in (-2.0, -1.5):
        box((0.04, 0.77, 0.62), at=(x, 0.3, 0.77), base=True, color="caramel", lod0=True)
    box((0.62, 0.62, 0.55), at=(-0.85, -0.4, 0.78), base=True, rot=(0, 0, 12), bevel=0.03, color="caramel")
    sphere(0.32, at=(-0.85, -0.4, 1.45), scale=(1, 1, 0.8), color="leaf", segs=8, rings=5)


@asset("ice_cream_van", "Ice-Cream Van", "Plays one song. Every child within a mile hears it.", 4, "metal",
       "large", variants=["bubblegum", "mint", "sky", "butter"], col="box", fill=0.6)
def ice_cream_van():
    r, wy = 0.42, 0.9
    _wheels((-1.6, 1.85), wy, r, r, 0.34)
    box((4.6, 2.1, 2.3), at=(-0.6, 0, 0.45), base=True, bevel=0.25, color="snow")
    box((1.35, 2.0, 1.1), at=(2.2, 0, 0.45), base=True, bevel=0.28, color="snow")
    box((4.62, 2.12, 0.34), at=(-0.6, 0, 0.75), base=True, color="bubblegum", tint=True)
    box((1.37, 2.02, 0.34), at=(2.2, 0, 0.75), base=True, color="bubblegum", tint=True)
    _panel("+x", 1.7, 0, 2.05, 1.8, 0.9, 0.06, "glass")
    box((0.95, 2.12, 0.72), at=(1.05, 0, 2.02), color="glass")
    for x in (3.0, -3.0):
        box((0.2, 2.0, 0.24), at=(x * 0.96, 0, 0.42), base=True, bevel=0.08, color="cloud")
    for k in (-1, 1):
        sphere(0.14, at=(2.86, k * 0.66, 1.25), scale=(0.45, 1, 1), color="butter", segs=8, rings=5)
        box((0.06, 0.2, 0.3), at=(-2.92, k * 0.8, 1.2), color="tomato")
    # serving hatch with striped awning, facing the kerb (-Y)
    _panel("-y", -1.05, -0.9, 1.8, 2.0, 0.95, 0.03, "ink_soft")
    _panel("-y", -1.05, -0.9, 1.33, 2.2, 0.08, 0.3, "cloud")
    n = 6
    sw = 2.3 / n
    for i in range(n):
        c, t = ("bubblegum", True) if i % 2 == 0 else ("snow", False)
        box((sw, 0.75, 0.05), at=(-0.9 - 1.15 + sw * (i + 0.5), -1.38, 2.38), rot=(18, 0, 0), color=c, tint=t)
    for i, c in enumerate(("tomato", "sun", "sky")):
        _panel("-y", -1.05, 0.55, 2.2 - i * 0.3, 0.32, 0.22, 0.02, c, lod0=True)
    sphere(0.12, at=(-1.4, -1.2, 1.5), color="flamingo", segs=8, rings=5, lod0=True)
    cyl(0.04, 0.16, r2=0.11, at=(-1.4, -1.2, 1.37), color="sand", segs=8, lod0=True)
    # the giant cone on the roof
    cx = -0.75
    cyl(0.35, 0.12, at=(cx, 0, 2.72), color="stone", segs=10)
    cyl(0.08, 1.45, r2=0.62, at=(cx, 0, 2.8), color="sand", segs=14)
    for a in range(0, 180, 45):
        torus(0.36, 0.025, at=(cx, 0, 3.55), rot=(0, 0, a), scale=(1, 0.04, 1.9), color="caramel", segs=4,
              rsegs=3, lod0=True)
    sphere(0.68, at=(cx, 0, 4.42), scale=(1, 1, 0.85), color="bubblegum", segs=14, rings=8)
    sphere(0.52, at=(cx + 0.05, 0, 5.0), scale=(1, 1, 0.9), color="mint", segs=12, rings=7)
    sphere(0.17, at=(cx + 0.08, 0, 5.52), color="tomato", segs=8, rings=5)
    tube([(cx + 0.08, 0, 5.65), (cx + 0.2, 0, 5.85)], 0.025, color="pine", segs=4, lod0=True)
    for (a, z) in ((-60, 4.2), (30, 4.25), (150, 4.15)):
        ar = math.radians(a)
        sphere(0.13, at=(cx + 0.62 * math.cos(ar), 0.62 * math.sin(ar), z), scale=(0.8, 0.8, 1.4),
               color="bubblegum", segs=6, rings=4, lod0=True)
    # the speaker that plays the song
    cyl(0.06, 0.32, r2=0.2, at=(1.3, 0, 2.86), rot=(0, 80, 0), color="cloud", segs=8)


@asset("delivery_van", "Delivery Van", "Your parcel is in this van. Or the next one.", 4, "metal", "large",
       variants=["tangerine", "cobalt", "snow", "leaf"], col="box", fill=0.75)
def delivery_van():
    r, wy = 0.44, 0.92
    _wheels((-1.85, 1.75), wy, r, r, 0.34)
    box((4.1, 2.2, 2.65), at=(-0.95, 0, 0.5), base=True, bevel=0.14, color="tangerine", tint=True)
    box((1.95, 2.1, 1.95), at=(1.95, 0, 0.5), base=True, bevel=0.34, color="tangerine", tint=True)
    box((0.9, 2.08, 0.7), at=(1.05, 0, 2.6), base=True, taper=(0.6, 1), color="tangerine", tint=True)
    _panel("+x", 2.92, 0, 1.95, 1.75, 0.75, 0.06, "glass", off=-0.05)
    box((1.05, 2.12, 0.7), at=(1.85, 0, 1.95), color="glass")
    box((4.0, 2.22, 0.3), at=(-0.4, 0, 0.5), base=True, color="charcoal")
    for x in (3.0, -3.05):
        box((0.2, 2.04, 0.26), at=(x, 0, 0.45), base=True, bevel=0.08, color="cloud")
    for k in (-1, 1):
        sphere(0.15, at=(2.9, k * 0.68, 1.15), scale=(0.45, 1, 0.9), color="butter", segs=8, rings=5)
        box((0.06, 0.22, 0.4), at=(-3.02, k * 0.85, 1.3), color="tomato")
        _panel("-y" if k < 0 else "+y", k * 1.1, -0.2, 1.8, 0.05, 2.2, 0.02, "ink_soft", lod0=True)
    # parcel logo on both flanks
    box((1.3, 2.24, 1.05), at=(-1.3, 0, 1.75), rot=(0, 12, 0), color="caramel")
    box((0.22, 2.26, 1.05), at=(-1.3, 0, 1.75), rot=(0, 12, 0), color="sand", lod0=True)
    box((2.6, 2.24, 0.18), at=(-0.95, 0, 0.75), base=True, color="snow")
    _panel("-x", -3.05, 0, 1.8, 0.05, 2.3, 0.03, "ink_soft", lod0=True)
    box((0.3, 0.12, 0.25), at=(2.1, -1.1, 2.15), base=True, color="tangerine", tint=True)  # mirror
    box((0.3, 0.12, 0.25), at=(2.1, 1.1, 2.15), base=True, color="tangerine", tint=True)


@asset("garbage_truck", "Garbage Truck", "Eats what you won't. Very brave.", 4, "metal", "large",
       variants=["leaf", "sun", "cobalt", "snow"], col="box", fill=0.7)
def garbage_truck():
    r, wy = 0.56, 1.0
    _wheels((3.15, -1.55, -2.85), wy, r, r, 0.44)
    box((8.4, 1.7, 0.5), at=(-0.1, 0, 0.45), base=True, color="charcoal")
    box((1.95, 2.45, 2.45), at=(3.5, 0, 0.6), base=True, bevel=0.32, color="snow")
    _panel("+x", 4.47, 0, 2.3, 2.1, 0.9, 0.06, "glass", off=-0.05)
    box((1.2, 2.47, 0.8), at=(3.55, 0, 2.3), color="glass")
    box((0.1, 2.0, 0.5), at=(4.5, 0, 1.15), color="stone")
    for k in (-1, 1):
        sphere(0.16, at=(4.45, k * 0.85, 1.55), scale=(0.45, 1, 0.9), color="butter", segs=8, rings=5)
    box((0.3, 2.3, 0.28), at=(4.6, 0, 0.5), base=True, bevel=0.08, color="stone")
    box((0.5, 0.35, 0.18), at=(3.4, 0, 3.05), base=True, bevel=0.06, color="tangerine")
    cyl(0.1, 1.6, at=(2.38, 0.9, 2.0), color="stone", segs=8)
    # body + rear loader
    box((5.9, 2.5, 2.85), at=(-0.65, 0, 0.95), base=True, bevel=0.4, color="leaf", tint=True)
    box((5.92, 2.52, 0.32), at=(-0.65, 0, 1.75), base=True, color="snow")
    box((1.2, 2.4, 2.9), at=(-4.05, 0, 0.75), base=True, rot=(0, 8, 0), bevel=0.25, color="leaf", tint=True)
    box((0.12, 2.0, 1.2), at=(-4.68, 0, 1.1), base=True, rot=(0, 8, 0), color="ink_soft")
    box((0.5, 2.3, 0.12), at=(-4.6, 0, 0.6), base=True, color="stone")
    for i in range(4):
        box((0.53, 0.25, 0.13), at=(-4.6, -0.9 + i * 0.6, 0.6), base=True, color="sun", lod0=True)
    for k in (-1, 1):
        box((0.06, 0.2, 0.35), at=(-4.75, k * 1.0, 2.2), color="tomato", lod0=True)
    # tidbits that didn't quite make it
    tube([(-4.45, -0.3, 2.05), (-4.75, -0.35, 1.95), (-4.85, -0.4, 1.75)], 0.07, r_end=0.04, color="sun",
         segs=6, smooth_path=1, lod0=True)
    box((0.35, 0.3, 0.03), at=(-4.7, 0.4, 2.05), rot=(20, 30, 10), color="paper", lod0=True)


@asset("school_bus", "School Bus", "Long, yellow and fully loaded with homework.", 4, "metal", "large",
       col="box", fill=0.8)
def school_bus():
    r, wy = 0.55, 1.02
    _wheels((-3.4, 3.55), wy, r, r, 0.44)
    box((9.7, 2.5, 2.6), at=(-0.6, 0, 0.6), base=True, bevel=0.32, color="sun")
    box((1.35, 2.3, 1.25), at=(4.75, 0, 0.6), base=True, bevel=0.28, color="sun")
    _panel("+x", 5.42, 0, 1.25, 1.2, 0.5, 0.05, "charcoal")
    _panel("+x", 4.25, 0, 2.45, 2.1, 0.95, 0.06, "glass")
    for x in (5.55, -5.5):
        box((0.22, 2.5, 0.3), at=(x, 0, 0.55), base=True, bevel=0.08, color="ink_soft")
    for k in (-1, 1):
        sphere(0.15, at=(5.42, k * 0.85, 1.55), scale=(0.45, 1, 0.9), color="butter", segs=8, rings=5)
        box((0.06, 0.2, 0.3), at=(-5.45, k * 0.95, 1.35), color="tomato")
        for x in (4.0, -5.2):
            box((0.22, 0.22, 0.12), at=(x, k * 0.9, 3.2), base=True, color="tangerine", lod0=True)
    for i in range(8):
        x = -4.8 + i * 1.05
        box((0.85, 2.52, 0.82), at=(x, 0, 2.45), color="glass")
    for z in (1.55, 1.82):
        box((9.72, 2.52, 0.09), at=(-0.6, 0, z), color="ink")
    _panel("-y", -1.25, 3.7, 1.6, 0.75, 1.9, 0.03, "glass")
    _panel("-y", -1.25, 3.7, 1.6, 0.06, 1.9, 0.05, "ink_soft", lod0=True)
    # fold-out stop arm
    extrude(ngon_points(8, 0.3, start=22.5), 0.04, at=(2.9, -1.38, 2.0), rot=(90, 0, 0), color="tomato",
            lod0=True)
    _panel("-y", -1.25, 0.0, 0.95, 1.6, 0.25, 0.02, "ink", lod0=True)


# ---------------------------------------------------------------- buildings

@asset("house_a", "Porch House", "Has a porch for waving at absolutely everyone.", 4, "wood", "large",
       variants=["sky", "butter", "mint", "bubblegum", "lavender", "snow"], col="box", fill=0.85)
def house_a():
    W, D, H, z0 = 8.0, 6.4, 3.2, 0.4
    box((W + 0.2, D + 0.2, z0), base=True, color="stone")
    box((W, D, H), at=(0, 0, z0), base=True, color="sky", tint=True)
    _gable_x(W, D, z0 + H, 2.5, "sky", "brick", over=0.45, t=0.28)
    # porch
    px = -1.4
    box((3.6, 1.7, 0.36), at=(px, -D / 2 - 0.85, 0), base=True, color="sand")
    for i in range(2):
        box((1.2, 0.36, 0.12 + 0.12 * i), at=(px, -D / 2 - 1.88 + 0.18 * i, 0), base=True, color="stone")
    for x in (px - 1.65, px + 1.65):
        box((0.18, 0.18, 2.6), at=(x, -D / 2 - 1.55, 0.36), base=True, color="snow")
    box((4.0, 2.1, 0.18), at=(px, -D / 2 - 0.95, 3.05), rot=(14, 0, 0), color="brick")
    box((3.6, 0.08, 0.1), at=(px, -D / 2 - 1.55, 0.95), color="snow", lod0=True)
    for i in range(8):
        box((0.06, 0.06, 0.58), at=(px - 1.5 + i * 0.43, -D / 2 - 1.55, 0.36), base=True, color="snow", lod0=True)
    _door("-y", -D / 2, px, z0, 1.0, 2.2, color="tomato")
    _window("-y", -D / 2, px + 1.1, 1.9, 0.6, 1.0, shutter=None)
    _window("-y", -D / 2, 2.3, 1.95, 1.5, 1.3, shutter="cobalt")
    _window("-y", -D / 2, -3.4, 1.95, 0.7, 1.3)
    _window("+x", W / 2, -1.4, 1.95, 1.3, 1.3, shutter="cobalt")
    _window("+x", W / 2, 1.5, 1.95, 1.3, 1.3, shutter="cobalt")
    cyl(0.45, 0.08, at=(W / 2 + 0.04, 0, z0 + H + 1.0), rot=(0, 90, 0), base=False, color="snow", segs=12,
        lod0=True)
    cyl(0.35, 0.1, at=(W / 2 + 0.04, 0, z0 + H + 1.0), rot=(0, 90, 0), base=False, color="glass", segs=12)
    _window("+y", D / 2, -2.0, 1.95, 1.3, 1.3)
    _window("+y", D / 2, 2.0, 1.95, 1.3, 1.3)
    _window("-x", -W / 2, 0.0, 1.95, 1.3, 1.3)
    # flower boxes + mailbox number
    for x in (2.3,):
        _panel("-y", -D / 2, x, 1.15, 1.6, 0.3, 0.35, "cocoa", lod0=True)
        for i, c in enumerate(("flamingo", "sun", "flamingo", "sun")):
            sphere(0.14, at=(x - 0.6 + i * 0.4, -D / 2 - 0.2, 1.35), color=c, segs=6, rings=4, lod0=True)
    for (x, y, rr) in ((-W / 2 - 0.1, -2.2, 0.7), (-W / 2 + 0.6, -D / 2 - 0.5, 0.6), (W / 2 - 0.4, -D / 2 - 0.5, 0.55)):
        sphere(rr, at=(x, y, rr * 0.8), color="leaf", segs=8, rings=5)


@asset("house_b", "A-Frame House", "Mostly roof. The architect had one idea and committed.", 4, "wood", "large",
       variants=["pine", "brick", "cobalt", "charcoal", "grape"], col="box", fill=0.7)
def house_b():
    W, D, H, z0 = 8.0, 8.6, 7.6, 0.5
    box((W - 0.2, D, z0), base=True, color="stone")
    _gable_y(W, D, z0, H, "caramel", "pine", over=0.45, t=0.34, wall_tint=False, roof_tint=True, cap="charcoal")
    f = -D / 2
    # big triangular window up top
    tri = [(-2.6, 0), (2.6, 0), (0, 3.6)]
    extrude(tri, 0.1, at=(0, f - 0.04, z0 + 3.0), rot=(90, 0, 0), color="glass")
    extrude([(-2.9, -0.2), (2.9, -0.2), (0, 3.95)], 0.05, at=(0, f - 0.01, z0 + 3.0), rot=(90, 0, 0),
            color="snow", lod0=True)
    for x in (-1.3, 0.0, 1.3):
        h = 3.6 * (1 - abs(x) / 2.6)
        _panel("-y", f, x, z0 + 3.0 + h / 2, 0.1, h, 0.13, "snow", lod0=True)
    _panel("-y", f, 0, z0 + 3.0, 5.4, 0.14, 0.13, "snow", lod0=True)
    _door("-y", f, 0, z0, 1.2, 2.3, color="tomato")
    for x in (-2.2, 2.2):
        _window("-y", f, x, z0 + 1.45, 1.0, 1.1, sill=False)
    _window("+y", D / 2, 0, z0 + 3.4, 1.6, 1.6, sill=False)
    # deck + railing
    box((W + 0.4, 2.0, 0.4), at=(0, f - 1.0, 0), base=True, color="caramel")
    for x in (-W / 2 - 0.1, W / 2 + 0.1):
        box((0.12, 2.0, 0.08), at=(x, f - 1.0, 1.35), color="cocoa")
        for y in (f - 0.1, f - 1.0, f - 1.9):
            box((0.12, 0.12, 1.0), at=(x, y, 0.4), base=True, color="cocoa")
    for x in (-W / 2 - 0.1, W / 2 + 0.1):
        box((2.65, 0.12, 0.08), at=(x * 0.83, f - 1.94, 1.35), color="cocoa")
        box((0.12, 0.12, 1.0), at=(x * 0.67, f - 1.94, 0.4), base=True, color="cocoa")
    box((1.6, 0.5, 0.2), at=(0, f - 2.25, 0), base=True, color="caramel")
    # chimney pipe
    a = math.atan2(H, W / 2)
    cyl(0.28, 2.8, at=(1.8, 1.8, z0 + H - 1.8 * math.tan(a) + 0.2), color="charcoal", segs=10)
    cyl(0.4, 0.2, at=(1.8, 1.8, z0 + H - 1.8 * math.tan(a) + 3.0), color="charcoal", segs=10)
    for (x, c) in ((-3.0, "tomato"), (3.0, "sun")):
        cyl(0.3, 0.45, r2=0.36, at=(x, f - 1.5, 0.4), color="brick", segs=10, lod0=True)
        sphere(0.38, at=(x, f - 1.5, 1.05), color="leaf", segs=8, rings=5, lod0=True)
        sphere(0.1, at=(x + 0.15, f - 1.85, 1.15), color=c, segs=6, rings=4, lod0=True)


@asset("house_c", "Two-Storey House", "Two storeys, one chimney, a hundred birthday parties.", 4, "stone",
       "large", variants=["butter", "mint", "bubblegum", "sky", "lavender", "sand"], col="box", fill=0.85)
def house_c():
    W, D, z0 = 8.0, 7.0, 0.35
    H = 5.8
    box((W + 0.2, D + 0.2, z0), base=True, color="stone")
    box((W, D, H), at=(0, 0, z0), base=True, color="butter", tint=True)
    box((W, 0.18, 0.18), at=(0, -D / 2 - 0.05, z0 + 2.95), color="snow", lod0=True)
    box((W + 1.0, D + 1.0, 2.9), at=(0, 0, z0 + H), base=True, taper=(0.5, 0.04), color="charcoal")
    box((W + 1.04, D + 1.04, 0.2), at=(0, 0, z0 + H - 0.05), base=True, color="snow")
    # chimney
    box((0.9, 0.9, 4.0), at=(2.6, 1.3, z0 + H), base=True, color="brick")
    box((1.1, 1.1, 0.25), at=(2.6, 1.3, z0 + H + 4.0), base=True, color="stone")
    for x in (2.45, 2.75):
        cyl(0.12, 0.3, at=(x, 1.3, z0 + H + 4.25), color="ink_soft", segs=6, lod0=True)
    # side wing: one-storey garage
    gx = W / 2 + 1.6
    box((3.2, 6.0, 3.0), at=(gx, 0.5, z0), base=True, color="butter", tint=True)
    box((3.6, 6.4, 0.25), at=(gx - 0.1, 0.5, z0 + 3.0), base=True, color="charcoal")
    _panel("-y", -2.5, gx, z0 + 1.15, 2.5, 2.3, 0.08, "snow")
    for i in range(4):
        _panel("-y", -2.5, gx, z0 + 0.35 + i * 0.55, 2.5, 0.05, 0.1, "cloud", lod0=True)
    box((2.6, 1.6, 0.02), at=(gx, -3.3, 0.0), base=True, color="charcoal")
    # front: door with a little portico
    f = -D / 2
    _door("-y", f, -0.5, z0, 1.1, 2.3, color="cobalt")
    box((2.2, 1.3, 0.16), at=(-0.5, f - 0.6, z0 + 2.6), base=True, color="snow")
    _gable_x(2.2, 1.3, z0 + 2.76, 0.6, "snow", "charcoal", over=0.1, t=0.12, wall_tint=False, c=(-0.5, f - 0.6))
    for x in (-1.45, 0.45):
        cyl(0.1, 2.6, at=(x, f - 1.12, z0), color="snow", segs=8)
    box((2.0, 0.5, 0.2), at=(-0.5, f - 1.45, 0), base=True, color="stone")
    for x in (-2.8, 2.2):
        _window("-y", f, x, z0 + 1.45, 1.3, 1.3, shutter="navy")
    for x in (-2.8, -0.5, 2.2):
        _window("-y", f, x, z0 + 4.35, 1.1, 1.25, shutter="navy")
    for u in (-1.6, 1.6):
        _window("+x", W / 2, u, z0 + 4.35, 1.1, 1.25)
        _window("-x", -W / 2, u, z0 + 1.45, 1.1, 1.25)
        _window("-x", -W / 2, u, z0 + 4.35, 1.1, 1.25)
        _window("+y", D / 2, u * 1.5, z0 + 1.45, 1.1, 1.25)
        _window("+y", D / 2, u * 1.5, z0 + 4.35, 1.1, 1.25)
    _window("+x", gx + 1.6, 1.0, z0 + 1.5, 1.2, 1.0, sill=False)


@asset("garage", "Garage", "Has never once contained a car.", 4, "wood", "large",
       variants=["snow", "sky", "butter", "mint", "bubblegum"], col="box", fill=0.85)
def garage():
    W, D, H, z0 = 4.0, 4.8, 2.6, 0.15
    box((W + 0.2, D + 0.2, z0), base=True, color="stone")
    box((W, D, H), at=(0, 0, z0), base=True, color="snow", tint=True)
    _gable_y(W, D, z0 + H, 1.35, "snow", "brick", over=0.3, t=0.2)
    f = -D / 2
    _panel("-y", f, 0, z0 + 1.05, 3.3, 2.2, 0.06, "snow", off=0.0, lod0=True)
    _panel("-y", f, 0, z0 + 1.05, 3.0, 2.1, 0.1, "cloud")
    for i in range(4):
        _panel("-y", f, 0, z0 + 0.3 + i * 0.52, 3.0, 0.05, 0.13, "stone", lod0=True)
    for i in range(4):
        _panel("-y", f, -1.05 + i * 0.7, z0 + 1.72, 0.5, 0.25, 0.13, "glass", lod0=True)
    _panel("-y", f, 0, z0 + H + 0.55, 0.7, 0.45, 0.06, "glass")
    sphere(0.12, at=(1.85, f - 0.12, z0 + 2.4), scale=(1, 0.6, 1), color="butter", segs=6, rings=4, lod0=True)
    _window("+x", W / 2, -0.5, z0 + 1.5, 1.2, 0.9, sill=False)
    _door("+x", W / 2, 1.3, z0, 0.9, 2.0, color="cocoa")
    box((3.3, 0.9, 0.02), at=(0, f - 0.45, 0.0), base=True, color="charcoal")
    for i, c in enumerate(("tomato", "sky")):
        cyl(0.18, 0.22, at=(-W / 2 - 0.3, -1.8 + i * 0.45, 0), color=c, segs=8, lod0=True)


@asset("treehouse", "Treehouse", "No grown-ups allowed. Grown-ups are fine with that.", 4, "wood", "large",
       variants=["sand", "sky", "tomato", "mint"], col="cyl", fill=0.4)
def treehouse():
    lathe([(0, 0), (0.75, 0), (0.55, 0.35), (0.48, 1.2), (0.42, 5.0), (0, 5.0)], color="cocoa", segs=10)
    for (x, y, z, r) in ((0.0, 0.6, 5.2, 2.3), (-1.8, 0.3, 4.4, 1.5), (1.9, 0.4, 4.6, 1.5), (0.4, -0.3, 6.3, 1.4),
                         (-1.0, -0.7, 5.9, 1.2)):
        sphere(r, at=(x, y, z), color="leaf", segs=12, rings=7)
    # platform + hut
    zp = 2.7
    box((2.9, 2.6, 0.2), at=(0, -0.6, zp), base=True, color="caramel")
    for k in (-1, 1):
        tube([(k * 0.4, 0.0, zp - 1.3), (k * 1.3, -0.6, zp)], 0.1, color="cocoa", segs=5)
    box((2.1, 1.8, 1.55), at=(0, -0.6, zp + 0.2), base=True, color="sand", tint=True)
    _gable_x(2.1, 1.8, zp + 1.75, 0.8, "sand", "tomato", over=0.2, t=0.14, c=(0, -0.6))
    f = -0.6 - 0.9
    arch = [(-0.32, 0), (0.32, 0)] + [(0.32 * math.cos(math.radians(a)), 0.75 + 0.32 * math.sin(math.radians(a)))
                                      for a in range(0, 181, 45)]
    extrude(arch, 0.05, at=(-0.4, f - 0.02, zp + 0.2), rot=(90, 0, 0), color="ink_soft")
    _window("-y", f, 0.55, zp + 1.0, 0.5, 0.5, sill=False)
    _window("+x", 1.05, -0.6, zp + 1.0, 0.5, 0.5, sill=False)
    _panel("-y", f, 0.0, zp + 1.98, 0.9, 0.24, 0.04, "paper", lod0=True)
    # railing on the front ledge
    box((2.9, 0.08, 0.08), at=(0, -1.88, zp + 0.75), color="caramel")
    for x in (-1.4, -0.95, -0.45, 0.45, 0.95, 1.4):
        box((0.07, 0.07, 0.55), at=(x, -1.88, zp + 0.2), base=True, color="caramel", lod0=True)
    # rope ladder
    for x in (0.2, 0.6):
        tube([(x, -1.9, zp + 0.1), (x + 0.05, -2.05, 0.0)], 0.03, color="sand", segs=4)
    for i in range(6):
        z = 0.3 + i * 0.42
        box((0.5, 0.06, 0.05), at=(0.42, -1.92 - 0.15 * (1 - z / zp), z), color="caramel")
    # pennant flag
    tube([(0.9, -0.6, zp + 2.5), (0.9, -0.6, zp + 3.4)], 0.03, color="cocoa", segs=4)
    extrude([(0, 0), (0.6, 0.15), (0, 0.3)], 0.03, at=(0.9, -0.6, zp + 3.05), rot=(90, 0, 0), color="flamingo")


@asset("above_ground_pool", "Backyard Pool", "A lake you can lean on.", 4, "plastic", "large",
       variants=["cobalt", "cloud", "sand", "teal"], col="cyl", fill=0.85)
def above_ground_pool():
    R, H = 2.5, 1.2
    cyl(R, H, color="cobalt", tint=True, segs=24)
    cyl(R - 0.08, 0.05, at=(0, 0, H - 0.12), color="sky", segs=24)
    torus(R, 0.1, at=(0, 0, H), color="snow", segs=24, rsegs=4)
    for i in range(12):
        a = math.radians(360 * i / 12 + 15)
        box((0.14, 0.08, H), at=(R * math.cos(a), R * math.sin(a), 0), rot=(0, 0, math.degrees(a) + 90), base=True,
            color="cloud", lod0=True)
    # ladder straddling the front wall
    for x in (-0.3, 0.3):
        tube([(x, -R - 0.75, 0.0), (x, -R - 0.15, H + 0.4), (x, -R + 0.15, H + 0.4), (x, -R + 0.6, H - 0.3)],
             0.04, color="stone", segs=5)
    for i in range(3):
        t = (i + 1) / 4
        box((0.6, 0.18, 0.05), at=(0, -R - 0.75 + 0.6 * t, (H + 0.4) * t), color="cloud")
    # floatie + beach ball
    torus(0.42, 0.15, at=(0.7, 0.4, H - 0.05), color="flamingo", segs=14, rsegs=6)
    for a in (0, 120, 240):
        ar = math.radians(a)
        sphere(0.12, at=(0.7 + 0.42 * math.cos(ar), 0.4 + 0.42 * math.sin(ar), H - 0.03),
               scale=(1, 1, 0.9), color="snow", segs=6, rings=4, lod0=True)
    sphere(0.3, at=(-0.9, -0.5, H + 0.1), color="sun", segs=10, rings=6)
    torus(0.3, 0.06, at=(-0.9, -0.5, H + 0.1), rot=(0, 90, 30), scale=(1, 1, 1), color="tomato", segs=12,
          rsegs=3, lod0=True)


@asset("hot_air_balloon", "Hot-Air Balloon", "Basically a picnic basket with ambitions.", 4, "soft", "large",
       variants=["tomato", "cobalt", "grape", "leaf", "flamingo"], col="sphere", flags=["float"], fill=0.5)
def hot_air_balloon():
    cz, R = 10.1, 4.9
    prof = [(0.95, 4.2)]
    for d in (-58, -44, -30, -15, 0, 15, 32, 50, 68, 82):
        a = math.radians(d)
        prof.append((R * math.cos(a), cz + R * math.sin(a) * (1.08 if d < 0 else 1.0)))
    prof.append((0.0, cz + R))
    cols = [("tomato", True), ("sun", False), ("tomato", True), ("snow", False)]
    for i in range(len(prof) - 1):
        c, t = cols[i % 4]
        lathe([prof[i], prof[i + 1]] if i < len(prof) - 2 else [prof[i], prof[i + 1]], color=c, tint=t, segs=16)
    # burner skirt + ropes + basket
    cyl(0.95, 0.35, r2=0.95, at=(0, 0, 3.85), color="caramel", segs=12)
    cyl(0.32, 0.4, at=(0, 0, 2.55), color="stone", segs=8)
    cyl(0.22, 0.5, r2=0.02, at=(0, 0, 2.95), color="tangerine", segs=8, lod0=True)
    for (x, y) in ((-0.55, -0.55), (0.55, -0.55), (0.55, 0.55), (-0.55, 0.55)):
        tube([(x, y, 1.15), (x * 1.45, y * 1.45, 3.9)], 0.05, color="ink_soft", segs=4)
    box((1.3, 1.3, 1.1), base=True, bevel=0.1, color="caramel")
    box((1.42, 1.42, 0.16), at=(0, 0, 1.0), base=True, bevel=0.05, color="cocoa")
    for i in range(3):
        _panel("-y", -0.65, 0, 0.25 + i * 0.3, 1.3, 0.05, 0.02, "cocoa", lod0=True)
    for (x, y) in ((0.68, -0.3), (-0.3, -0.68)):
        sphere(0.14, at=(x, y, 0.55), scale=(0.8, 0.8, 1.1), color="sand", segs=6, rings=4, lod0=True)
