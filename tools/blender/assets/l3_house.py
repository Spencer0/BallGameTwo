"""Level 3 — House Party (whole house + back garden). Objects face -Y; base at z = 0; metres."""
import math

from mathutils import Euler, Vector

from lib.core import STATE, box, cyl, sphere, torus, lathe, extrude, tube, capsule
from lib.registry import asset


# ---------------------------------------------------------------- local helpers

def _lod1():
    return STATE.lod > 0


def _dot_eyes(at, spacing, r, yaw=0.0, color="ink", segs=6):
    """Cheap dot eyes (for people/small creatures where eyes() would eat the budget)."""
    a = math.radians(yaw)
    side = (math.cos(a), math.sin(a))
    face = (math.sin(a), -math.cos(a))
    for k in (-1, 1):
        x = at[0] + side[0] * k * spacing / 2
        y = at[1] + side[1] * k * spacing / 2
        sphere(r, at=(x, y, at[2]), color=color, segs=segs, rings=4, scale=(1, 0.6, 1.2), rot=(0, 0, yaw))
        sphere(r * 0.38, at=(x + face[0] * r * 0.5 - side[0] * r * 0.3, y + face[1] * r * 0.5 - side[1] * r * 0.3,
                             at[2] + r * 0.45), color="snow", segs=4, rings=3, lod0=True)


def _wheel(at, r, tr, w=None, axis="y", tyre="ink_soft", hub="cloud", segs=16, hub_r=None, spokes=0,
           spoke_color="stone"):
    """Tyre torus + hub. axis='y' means the axle runs along Y (wheel seen side-on from the front)."""
    rot = (90, 0, 0) if axis == "y" else (0, 90, 0)
    sc = (1, 1, w / (2 * tr)) if w else None
    torus(r - tr, tr, at=at, rot=rot, color=tyre, segs=segs, rsegs=5, scale=sc)
    cyl(hub_r or r * 0.28, (w or 2 * tr) * 1.05, at=at, rot=rot, base=False, color=hub, segs=8)
    for i in range(spokes):
        a = 180.0 * i / spokes
        if axis == "y":
            box((2 * (r - tr), 0.008, 0.008), at=at, rot=(0, a, 0), color=spoke_color, lod0=True)
        else:
            box((0.008, 2 * (r - tr), 0.008), at=at, rot=(a, 0, 0), color=spoke_color, lod0=True)


def _frond(at, length, width, pitch, yaw, color, n):
    """Flat serrated fern frond in its own plane, pitched up by `pitch` and turned by `yaw`.
    Returns the tip position so a second (drooping) piece can continue from it."""
    L, W = length, width
    lo = [(0.0, -W * 0.2)]
    if n == 0:
        lo.append((L * 0.4, -W * 0.6))
    d = L / (n + 1)
    for i in range(n):
        x = d * (i + 1)
        w = W * (1 - 0.5 * x / L)
        lo += [(x - 0.3 * d, -w * 0.45), (x + 0.12 * d, -w)]
    pts = lo + [(L, 0.0)] + [(x, -y) for (x, y) in reversed(lo)]
    extrude(pts, 0.012, at=at, rot=(0, -pitch, yaw), color=color)
    p, y = math.radians(pitch), math.radians(yaw)
    return (at[0] + L * math.cos(p) * math.cos(y), at[1] + L * math.cos(p) * math.sin(y), at[2] + L * math.sin(p))


def _couch(width, seats, color, depth=0.86, seat_h=0.44, back_h=0.95, arm_w=0.2, pillow="butter", pillows=1):
    base_z = 0.1
    for kx in (-1, 1):
        for ky in (-1, 1):
            cyl(0.026, base_z, r2=0.04, at=(kx * (width / 2 - 0.09), ky * (depth / 2 - 0.09), 0), color="cocoa",
                segs=8)
    box((width - 0.04, depth - 0.04, seat_h - base_z - 0.12), at=(0, 0, base_z), base=True, bevel=0.04,
        color=color, tint=True)
    back_y = depth / 2 - 0.11
    box((width, 0.22, back_h - base_z), at=(0, back_y, base_z), base=True, bevel=0.06, color=color, tint=True)
    inner = width - 2 * arm_w
    cw = inner / seats
    for i in range(seats):
        x = -inner / 2 + cw * (i + 0.5)
        box((cw - 0.012, depth - 0.24, 0.16), at=(x, -0.11, seat_h - 0.13), base=True, bevel=0.05, color=color,
            tint=True)
        box((cw - 0.03, 0.18, back_h - seat_h - 0.06), at=(x, back_y - 0.18, seat_h + 0.02), rot=(-10, 0, 0),
            base=True, bevel=0.06, color=color, tint=True)
    for k in (-1, 1):
        x = k * (width / 2 - arm_w / 2)
        box((arm_w, depth, seat_h + 0.12 - base_z), at=(x, 0, base_z), base=True, bevel=0.05, color=color, tint=True)
        cyl(arm_w * 0.62, depth + 0.02, at=(x + k * 0.02, -0.01, seat_h + 0.13), rot=(90, 0, 0), base=False,
            color=color, tint=True, segs=10)
    for j in range(pillows):
        k = -1 if j == 0 else 1
        x = k * (inner / 2 - 0.2)
        box((0.36, 0.12, 0.34), at=(x, back_y - 0.3, seat_h + 0.04), base=True, rot=(-14, 0, k * -14),
            bevel=0.06, color=pillow)


def _peg(skin, top, bottom, shoes, hz, hr, hip, br, top_tint=True, dress=False, shorts=False, reach=(0.0, 0.0),
         cheeks=True):
    """Peg-doll person: legs, egg torso, tube arms, big round head with dot eyes.
    Returns ((left hand), (right hand)) positions."""
    sz = hz - hr * 0.8
    z0 = hip - 0.05
    T = sz - z0
    lr, lx = br * 0.34, br * 0.45
    leg_col = skin if (shorts or dress) else bottom
    for k in (-1, 1):
        cyl(lr, hip - 0.02, at=(k * lx, 0, 0.03), color=leg_col, segs=7)
        sphere(lr * 1.3, at=(k * lx, -lr * 0.45, lr * 0.6), scale=(1, 1.5, 0.65), color=shoes, segs=7, rings=4)
        if shorts:
            cyl(lr * 1.32, hip * 0.42, at=(k * lx, 0, hip * 0.6), color=bottom, segs=7)
    if dress:
        zh = hip * 0.5
        prof = [(0, zh), (br * 1.32, zh), (br * 1.12, zh + (sz - zh) * 0.3), (br * 0.92, zh + (sz - zh) * 0.62),
                (br * 0.78, zh + (sz - zh) * 0.88), (br * 0.45, sz), (0, sz)]
    else:
        prof = [(0, z0), (br * 0.86, z0), (br, z0 + T * 0.22), (br * 0.97, z0 + T * 0.56), (br * 0.8, z0 + T * 0.86),
                (br * 0.45, sz), (0, sz)]
    lathe(prof, color=top, tint=top_tint, segs=10)
    hands = []
    for k, fwd in zip((-1, 1), reach):
        sh = (k * br * 0.72, 0, sz - T * 0.16)
        el = (k * br * 1.12, -fwd * 0.4, sz - T * 0.42)
        hd = (k * br * 1.38, -0.03 - fwd, z0 + T * 0.36 + fwd * 0.4)
        tube([sh, el, hd], br * 0.21, color=top, tint=top_tint, segs=6)
        hp = (hd[0] + k * br * 0.04, hd[1] - br * 0.02, hd[2] - br * 0.12)
        sphere(br * 0.26, at=hp, color=skin, segs=6, rings=3)
        hands.append(hp)
    sphere(hr, at=(0, 0, hz), color=skin, segs=10, rings=7)
    _dot_eyes((0, -hr * 0.89, hz - hr * 0.1), hr * 0.74, hr * 0.145)
    if cheeks:
        for k in (-1, 1):
            sphere(hr * 0.13, at=(k * hr * 0.6, -hr * 0.76, hz - hr * 0.34), scale=(1, 0.5, 0.75), color="bubblegum",
                   segs=5, rings=3, lod0=True)
    return hands


def _hair_cap(hz, hr, color, tilt=-35, cover=-15):
    R = hr * 1.07
    prof = [(R * math.cos(math.radians(a)), R * math.sin(math.radians(a))) for a in (cover, 18, 48, 72)] + [(0, R)]
    lathe(prof, at=(0, 0, hz), rot=(tilt, 0, 0), color=color, segs=9)


# ---------------------------------------------------------------- small things

@asset("watering_can", "Watering Can", "Makes it rain, but only where it's told.", 3, "metal", "small",
       variants=["leaf", "sky", "tomato", "sun"], col="box", fill=0.4)
def watering_can():
    cyl(0.1, 0.2, color="leaf", segs=14, bevel=0.012, tint=True, scale=(1, 0.82, 1))
    cyl(0.1, 0.045, at=(0, 0, 0.2), r2=0.05, color="leaf", segs=14, tint=True, scale=(1, 0.82, 1))
    cyl(0.035, 0.03, at=(-0.03, 0, 0.235), color="stone", segs=10)
    tube([(0.06, 0, 0.05), (0.16, 0, 0.13), (0.27, 0, 0.25)], 0.021, r_end=0.014, color="leaf", segs=8, tint=True)
    cyl(0.016, 0.045, at=(0.265, 0, 0.245), rot=(0, 45, 0), r2=0.048, color="stone", segs=10)
    torus(0.085, 0.015, at=(-0.03, 0, 0.215), rot=(90, 0, 0), color="stone", segs=12, rsegs=5, arc=180)


@asset("laundry_basket", "Laundry Basket", "Clean or dirty? Nobody knows. Nobody checks.", 3, "plastic", "small",
       variants=["sky", "flamingo", "lime", "lavender"], col="box", fill=0.65)
def laundry_basket():
    box((0.54, 0.38, 0.3), base=True, color="sky", tint=True, bevel=0.03, taper=(1.1, 1.12))
    box((0.62, 0.46, 0.05), at=(0, 0, 0.29), base=True, color="sky", tint=True, bevel=0.02)
    for i in range(5):
        box((0.035, 0.02, 0.17), at=(-0.2 + i * 0.1, -0.2, 0.065), rot=(4.3, 0, 0), base=True, color="ink_soft",
            lod0=True)
    for i in range(3):
        box((0.02, 0.035, 0.17), at=(0.282, -0.1 + i * 0.1, 0.065), rot=(0, 5, 0), base=True, color="ink_soft",
            lod0=True)
    box((0.03, 0.14, 0.04), at=(0.31, 0, 0.295), base=True, color="ink_soft")
    sphere(0.2, at=(-0.07, 0.03, 0.33), scale=(1.15, 0.95, 0.4), color="snow", segs=12, rings=6)
    sphere(0.15, at=(0.12, -0.04, 0.35), scale=(1, 1, 0.5), rot=(0, 0, 30), color="sun", segs=10, rings=6)
    tube([(0.02, -0.12, 0.37), (0.04, -0.22, 0.375), (0.05, -0.255, 0.32), (0.05, -0.255, 0.22)], 0.026,
         color="tomato", segs=6, smooth_path=1)
    sphere(0.03, at=(0.05, -0.27, 0.215), scale=(1, 1.4, 0.9), color="tomato", segs=8, rings=4)


@asset("garden_gnome", "Garden Gnome", "Guards the petunias. Has never once blinked.", 3, "ceramic", "medium",
       variants=["cobalt", "leaf", "grape", "sky"], col="cyl", fill=0.5)
def garden_gnome():
    for k in (-1, 1):
        sphere(0.042, at=(k * 0.045, -0.03, 0.028), scale=(1, 1.45, 0.7), color="tomato", segs=6, rings=4)
    lathe([(0, 0.02), (0.112, 0.02), (0.108, 0.1), (0.085, 0.2), (0.055, 0.25), (0, 0.255)], color="cobalt",
          tint=True, segs=12)
    for k in (-1, 1):
        tube([(k * 0.07, 0, 0.22), (k * 0.1, -0.02, 0.16), (k * 0.085, -0.05, 0.12)], 0.025, color="cobalt",
             tint=True, segs=6)
        sphere(0.026, at=(k * 0.083, -0.065, 0.11), color="skin1", segs=6, rings=4)
    sphere(0.072, at=(0, -0.005, 0.29), color="skin1", segs=10, rings=6)
    sphere(0.08, at=(0, -0.045, 0.2), scale=(1.05, 0.62, 1.22), color="snow", segs=10, rings=6)
    sphere(0.026, at=(0, -0.08, 0.278), color="bubblegum", segs=6, rings=4)
    _dot_eyes((0, -0.064, 0.306), 0.054, 0.011)
    cyl(0.08, 0.02, at=(0, 0.0, 0.335), color="tomato", segs=10)
    cyl(0.074, 0.16, at=(0, 0.0, 0.345), r2=0.004, rot=(-12, 0, 0), color="tomato", segs=10)


@asset("hose_reel", "Hose Reel", "Thirty metres of hose, thirty-one metres of tangle.", 3, "plastic", "medium",
       variants=["tomato", "sun", "sky"], col="box", fill=0.5)
def hose_reel():
    z = 0.3
    for x in (-0.16, 0.16):
        cyl(0.2, 0.025, at=(x, 0, z), rot=(0, 90, 0), base=False, color="tomato", tint=True, segs=14)
    cyl(0.15, 0.3, at=(0, 0, z), rot=(0, 90, 0), base=False, color="leaf", segs=14)
    for x in (-0.1, 0.0, 0.1):
        torus(0.15, 0.022, at=(x, 0, z), rot=(0, 90, 0), color="leaf", segs=14, rsegs=4, lod0=True)
    cyl(0.05, 0.05, at=(0.19, 0, z), rot=(0, 90, 0), base=False, color="stone", segs=10)
    box((0.025, 0.03, 0.13), at=(0.21, 0, z), base=True, color="stone")
    cyl(0.018, 0.07, at=(0.21, 0, z + 0.13), rot=(0, 90, 0), color="ink_soft", segs=8)
    for x in (-0.19, 0.19):
        tube([(x, -0.17, 0.0), (x, 0.0, z), (x, 0.17, 0.0)], 0.018, color="stone", segs=6)
    tube([(-0.19, 0.17, 0.0), (-0.19, 0.2, 0.55), (-0.15, 0.2, 0.6), (0.15, 0.2, 0.6), (0.19, 0.2, 0.55),
          (0.19, 0.17, 0.0)], 0.018, color="stone", segs=6, smooth_path=1)
    tube([(0.0, -0.12, z - 0.09), (0.02, -0.24, 0.06), (0.1, -0.3, 0.025), (0.22, -0.3, 0.025)], 0.022,
         color="leaf", segs=6, smooth_path=1)
    cyl(0.022, 0.08, at=(0.22, -0.3, 0.025), rot=(0, 90, 0), r2=0.016, color="sun", segs=8)


@asset("potted_fern", "Potted Fern", "Thrives on neglect. Has received plenty.", 3, "plant", "medium", col="cyl",
       fill=0.35)
def potted_fern():
    lathe([(0, 0), (0.12, 0), (0.15, 0.24), (0.175, 0.25), (0.175, 0.31), (0.15, 0.31), (0, 0.3)], color="brick",
          segs=12)
    cyl(0.152, 0.012, at=(0, 0, 0.29), color="cocoa", segs=12)
    lod1 = _lod1()
    for k in range(8):
        yaw = 45 * k + 12 * math.sin(k * 2.1) + 10
        pitch = 48 + 10 * math.sin(k * 1.7)
        col = "leaf" if k % 2 == 0 else "lime"
        y = math.radians(yaw)
        base = (0.04 * math.cos(y), 0.04 * math.sin(y), 0.3)
        tip = _frond(base, 0.27, 0.14, pitch, yaw, col, 0 if lod1 else 3)
        _frond(tip, 0.25, 0.11, -28, yaw, col, 0 if lod1 else 2)
    for k in range(3):
        yaw = 120 * k + 30
        _frond((0, 0, 0.3), 0.38, 0.13, 72, yaw, "leaf", 0 if lod1 else 4)


@asset("tricycle", "Tricycle", "Three wheels, zero chill.", 3, "metal", "medium",
       variants=["tomato", "sky", "sun", "flamingo"], col="box", fill=0.2)
def tricycle():
    _wheel((0.22, 0, 0.2), 0.2, 0.03, w=0.06, segs=16, hub="cloud")
    for y in (-0.2, 0.2):
        _wheel((-0.22, y, 0.11), 0.11, 0.025, w=0.05, segs=12, hub="cloud")
    cyl(0.015, 0.4, at=(-0.22, 0, 0.11), rot=(90, 0, 0), base=False, color="stone", segs=6)
    for y in (-0.045, 0.045):
        tube([(0.22, y, 0.2), (0.2, y, 0.5)], 0.018, color="tomato", tint=True, segs=6)
    tube([(0.2, 0, 0.48), (0.17, 0, 0.62)], 0.022, color="tomato", tint=True, segs=6)
    tube([(0.13, -0.2, 0.66), (0.17, -0.12, 0.63), (0.17, 0.12, 0.63), (0.13, 0.2, 0.66)], 0.016, color="stone",
         segs=6)
    for y in (-0.2, 0.2):
        cyl(0.024, 0.08, at=(0.13, y, 0.66), rot=(90, 0, 0), base=False, color="ink_soft", segs=8)
        tube([(0.12, y * 1.2, 0.66), (0.05, y * 1.3, 0.62), (-0.02, y * 1.25, 0.6)], 0.008, color="flamingo",
             segs=4, lod0=True)
    tube([(0.19, 0, 0.5), (0.06, 0, 0.33), (-0.1, 0, 0.2), (-0.22, 0, 0.13)], 0.03, color="tomato", tint=True,
         segs=8, smooth_path=1)
    cyl(0.018, 0.18, at=(-0.04, 0, 0.26), color="stone", segs=6)
    sphere(0.08, at=(-0.05, 0, 0.44), scale=(1.3, 1.05, 0.38), color="ink_soft", segs=10, rings=5)
    box((0.12, 0.34, 0.025), at=(-0.25, 0, 0.14), base=True, color="stone", bevel=0.008)
    for y in (-0.08, 0.08):
        box((0.05, 0.03, 0.02), at=(0.22 + (0.05 if y < 0 else -0.05), y, 0.2), color="ink", lod0=True)


@asset("dog", "Dog", "Good dog. Very good dog. The best, honestly.", 3, "living", "medium",
       variants=["caramel", "sand", "snow", "stone"], col="box", flags=["creature", "wander"], fill=0.45)
def dog():
    capsule(0.13, 0.15, at=(0, 0.06, 0.26), rot=(90, 0, 0), color="caramel", tint=True, segs=10)
    for x in (-0.075, 0.075):
        for y in (-0.05, 0.17):
            cyl(0.05, 0.2, at=(x, y, 0.02), color="caramel", tint=True, segs=8)
            sphere(0.05, at=(x, y - 0.012, 0.025), scale=(1, 1.3, 0.6), color="snow", segs=8, rings=4)
    sphere(0.145, at=(0, -0.17, 0.46), scale=(1, 0.95, 0.92), color="caramel", tint=True, segs=12, rings=7)
    sphere(0.072, at=(0, -0.295, 0.415), scale=(1.12, 1.0, 0.78), color="snow", segs=10, rings=6)
    sphere(0.028, at=(0, -0.365, 0.445), scale=(1.3, 1.0, 0.9), color="ink", segs=8, rings=5)
    box((0.045, 0.03, 0.055), at=(0.015, -0.34, 0.35), rot=(-20, 0, 10), color="flamingo", bevel=0.012, bseg=1,
        lod0=True)
    _dot_eyes((0, -0.29, 0.51), 0.12, 0.024, segs=8)
    for k in (-1, 1):
        sphere(0.08, at=(k * 0.145, -0.15, 0.42), scale=(0.35, 0.8, 1.55), rot=(0, k * 14, 0), color="cocoa",
               segs=8, rings=6)
    torus(0.09, 0.02, at=(0, -0.09, 0.39), rot=(55, 0, 0), color="tomato", segs=10, rsegs=4)
    sphere(0.024, at=(0, -0.16, 0.33), scale=(1, 0.5, 1), color="sun", segs=8, rings=4, lod0=True)
    tube([(0, 0.26, 0.31), (0.02, 0.33, 0.37), (0.07, 0.36, 0.43), (0.12, 0.34, 0.47)], 0.04,
         r_end=0.024, color="caramel", tint=True, segs=6, smooth_path=1)
    sphere(0.032, at=(0.125, 0.335, 0.475), color="snow", segs=6, rings=4, lod0=True)


@asset("vacuum_cleaner", "Vacuum Cleaner", "Finally, something bigger than you that also eats dust.", 3,
       "electronic", "medium", variants=["grape", "tomato", "sky", "sun"], col="box", fill=0.35)
def vacuum_cleaner():
    box((0.36, 0.25, 0.09), at=(0, -0.07, 0.02), base=True, bevel=0.03, color="grape", tint=True)
    box((0.37, 0.04, 0.035), at=(0, -0.19, 0.02), base=True, color="ink_soft", bevel=0.01)
    for x in (-0.16, 0.16):
        cyl(0.065, 0.05, at=(x, 0.08, 0.065), rot=(0, 90, 0), base=False, color="ink_soft", segs=12)
    box((0.24, 0.18, 0.56), at=(0, 0.06, 0.07), rot=(-8, 0, 0), base=True, bevel=0.05, color="grape", tint=True)
    cyl(0.078, 0.3, at=(0, -0.035, 0.18), rot=(-8, 0, 0), color="glass", segs=12)
    cyl(0.082, 0.04, at=(0, -0.035 + 0.3 * math.sin(math.radians(8)), 0.475), rot=(-8, 0, 0), color="charcoal",
        segs=12)
    sphere(0.035, at=(0.0, -0.06, 0.25), scale=(1.5, 0.6, 0.8), color="stone", segs=8, rings=4, lod0=True)
    tube([(0, 0.14, 0.6), (0, 0.17, 0.82), (0, 0.17, 0.9)], 0.02, color="stone", segs=6)
    torus(0.06, 0.02, at=(0, 0.17, 0.95), rot=(90, 0, 0), color="charcoal", segs=12, rsegs=5)
    for z in (0.35, 0.47):
        box((0.04, 0.03, 0.03), at=(0, 0.17, z), color="charcoal", lod0=True)
    tube([(0.0, 0.16, 0.36), (0.03, 0.2, 0.42), (-0.03, 0.2, 0.46), (0.03, 0.2, 0.5), (0.0, 0.17, 0.54)], 0.012,
         color="ink", segs=4, lod0=True)


@asset("toilet", "Toilet", "Lid up. A household argument, preserved forever.", 3, "ceramic", "medium",
       variants=["sky", "bubblegum", "sun", "mint"], col="box", fill=0.55)
def toilet():
    cyl(0.12, 0.22, at=(0, 0.0, 0), r2=0.14, scale=(1, 1.25, 1), color="snow", segs=14)
    cyl(0.18, 0.16, at=(0, -0.06, 0.2), r2=0.2, scale=(1, 1.3, 1), color="snow", segs=16, bevel=0.025)
    cyl(0.15, 0.01, at=(0, -0.06, 0.355), scale=(1, 1.3, 1), color="glass", segs=14)
    torus(0.162, 0.03, at=(0, -0.065, 0.385), scale=(1, 1.3, 1), color="sky", tint=True, segs=16, rsegs=5)
    cyl(0.18, 0.026, at=(0, 0.095, 0.585), rot=(80, 0, 0), base=False, scale=(1, 1.12, 1), color="sky", tint=True,
        segs=16)
    box((0.42, 0.18, 0.34), at=(0, 0.2, 0.38), base=True, bevel=0.03, color="snow")
    box((0.45, 0.21, 0.045), at=(0, 0.2, 0.715), base=True, bevel=0.015, color="snow")
    box((0.07, 0.03, 0.025), at=(-0.15, 0.1, 0.67), color="stone", bevel=0.008, bseg=1, lod0=True)


@asset("washing_machine", "Washing Machine", "Eats exactly one sock per cycle. Won't say which.", 3, "electronic",
       "medium", col="box", fill=0.9)
def washing_machine():
    box((0.6, 0.6, 0.85), base=True, bevel=0.035, color="snow")
    box((0.58, 0.02, 0.13), at=(0, -0.3, 0.7), base=True, color="cloud")
    box((0.13, 0.015, 0.06), at=(-0.17, -0.31, 0.735), base=True, color="stone", lod0=True)
    box((0.1, 0.015, 0.05), at=(0.04, -0.31, 0.74), base=True, color="teal", lod0=True)
    cyl(0.035, 0.03, at=(0.2, -0.31, 0.765), rot=(90, 0, 0), base=False, color="ink_soft", segs=10, lod0=True)
    torus(0.175, 0.04, at=(0, -0.3, 0.37), rot=(90, 0, 0), color="stone", segs=18, rsegs=5)
    cyl(0.15, 0.02, at=(0, -0.3, 0.37), rot=(90, 0, 0), base=False, color="glass", segs=16)
    for (x, z, c, s) in ((-0.05, 0.31, "tomato", 0.07), (0.06, 0.34, "sun", 0.06), (-0.02, 0.42, "lavender", 0.055)):
        sphere(s, at=(x, -0.31, z), scale=(1.3, 0.25, 0.8), rot=(0, 30 * x / 0.05, 0), color=c, segs=8, rings=4,
               lod0=True)
    box((0.03, 0.03, 0.09), at=(0.2, -0.32, 0.33), base=True, color="stone", bevel=0.01, bseg=1)
    tube([(0.11, -0.335, 0.23), (0.135, -0.345, 0.15), (0.14, -0.345, 0.08)], 0.022, color="tomato", segs=6)
    sphere(0.026, at=(0.15, -0.35, 0.07), scale=(1.2, 1.3, 0.9), color="tomato", segs=8, rings=4)


@asset("flamingo_ornament", "Lawn Flamingo", "Standing on one leg since forever. Unbothered.", 3, "plastic",
       "small", variants=["flamingo", "sky", "lime"], col="box", fill=0.15)
def flamingo_ornament():
    tube([(0, 0, 0.0), (0.0, 0, 0.5)], 0.013, color="ink_soft", segs=6)
    tube([(0.0, 0.0, 0.42), (-0.06, 0.0, 0.36), (0.0, 0.0, 0.33)], 0.01, color="ink_soft", segs=4, lod0=True)
    sphere(0.16, at=(-0.03, 0, 0.56), scale=(1.35, 0.72, 0.82), rot=(0, 14, 0), color="flamingo", tint=True, segs=12,
           rings=7)
    for k in (-1, 1):
        sphere(0.12, at=(-0.06, k * 0.09, 0.585), scale=(1.15, 0.3, 0.55), rot=(0, 18, 0), color="bubblegum",
               segs=10, rings=5, lod0=True)
    tube([(0.14, 0, 0.6), (0.2, 0, 0.7), (0.12, 0, 0.79), (0.1, 0, 0.85), (0.14, 0, 0.9)], 0.028, r_end=0.024,
         color="flamingo", tint=True, segs=6, smooth_path=1)
    sphere(0.048, at=(0.16, 0, 0.9), color="flamingo", tint=True, segs=10, rings=6)
    cyl(0.024, 0.05, at=(0.195, 0, 0.9), rot=(0, 112, 0), r2=0.016, color="bubblegum", segs=8)
    cyl(0.016, 0.035, at=(0.24, 0, 0.881), rot=(0, 135, 0), r2=0.002, color="ink", segs=8)
    _dot_eyes((0.178, 0, 0.915), 0.08, 0.011, yaw=90)


@asset("birdbath", "Birdbath", "A spa for one very judgemental bird.", 3, "stone", "medium", col="cyl", fill=0.35)
def birdbath():
    lathe([(0, 0), (0.2, 0), (0.2, 0.05), (0.13, 0.09), (0.075, 0.17), (0.06, 0.45), (0.07, 0.55), (0.1, 0.6),
           (0, 0.6)], color="stone", segs=12)
    lathe([(0, 0.58), (0.12, 0.58), (0.28, 0.66), (0.33, 0.72), (0.33, 0.75), (0.29, 0.75), (0, 0.72)],
          color="cloud", segs=16)
    cyl(0.29, 0.012, at=(0, 0, 0.73), color="sky", segs=16)
    bx, by, bz = 0.2, -0.2, 0.75
    sphere(0.05, at=(bx, by, bz + 0.04), scale=(1, 1.25, 0.9), rot=(0, 0, 40), color="sun", segs=10, rings=6)
    sphere(0.034, at=(bx - 0.02, by - 0.03, bz + 0.1), color="sun", segs=10, rings=6)
    cyl(0.012, 0.03, at=(bx - 0.028, by - 0.06, bz + 0.095), rot=(90, 0, -20), r2=0.001, color="tangerine", segs=6)
    _dot_eyes((bx - 0.026, by - 0.055, bz + 0.112), 0.034, 0.007, yaw=-20)
    sphere(0.03, at=(bx + 0.03, by + 0.05, bz + 0.06), scale=(0.6, 1.4, 0.4), rot=(30, 0, 40), color="tangerine",
           segs=6, rings=4, lod0=True)


@asset("bbq_grill", "Barbecue", "Smells like summer and slightly singed eyebrows.", 3, "metal", "medium",
       variants=["tomato", "charcoal", "cobalt", "pine"], col="cyl", fill=0.35)
def bbq_grill():
    lathe([(0, 0.46), (0.14, 0.47), (0.25, 0.53), (0.31, 0.63), (0.32, 0.73)], color="tomato", tint=True, segs=16)
    cyl(0.33, 0.025, at=(0, 0, 0.725), color="charcoal", segs=16)
    lathe([(0.325, 0.75), (0.32, 0.78), (0.29, 0.88), (0.22, 0.96), (0.12, 1.01), (0, 1.02)], color="tomato",
          tint=True, segs=16)
    for x in (-0.07, 0.07):
        cyl(0.012, 0.04, at=(x, 0, 1.0), color="stone", segs=6)
    box((0.2, 0.045, 0.04), at=(0, 0, 1.04), base=True, bevel=0.015, color="cocoa")
    box((0.12, 0.04, 0.035), at=(0.36, 0, 0.66), base=True, bevel=0.012, color="cocoa")
    cyl(0.04, 0.02, at=(-0.12, -0.08, 0.98), rot=(-20, -25, 0), color="stone", segs=8, lod0=True)
    for a in (-90, 30, 150):
        r = math.radians(a)
        tube([(0.18 * math.cos(r), 0.18 * math.sin(r), 0.5), (0.32 * math.cos(r), 0.32 * math.sin(r), 0.04)], 0.018,
             color="stone", segs=6)
        if a != -90:
            cyl(0.06, 0.035, at=(0.33 * math.cos(r), 0.33 * math.sin(r), 0.06), rot=(0, 90, a + 90), base=False,
                color="ink_soft", segs=10)
    cyl(0.2, 0.012, at=(0, 0, 0.2), color="stone", segs=12)
    cyl(0.09, 0.07, at=(0, 0, 0.38), color="stone", segs=10, lod0=True)


@asset("armchair", "Armchair", "Grandad's chair. Do not sit. Do not even look.", 3, "soft", "medium",
       variants=["tomato", "teal", "sun", "grape", "cobalt"], col="box", fill=0.7)
def armchair():
    _couch(0.98, 1, "tomato", depth=0.86, back_h=1.0, arm_w=0.2)


@asset("lawn_mower", "Lawn Mower", "Gives the lawn a haircut it did not ask for.", 3, "metal", "medium",
       variants=["tomato", "leaf", "sun", "sky"], col="box", fill=0.35)
def lawn_mower():
    box((0.52, 0.46, 0.14), at=(0, 0, 0.06), base=True, bevel=0.045, color="tomato", tint=True)
    cyl(0.13, 0.13, at=(-0.03, 0, 0.19), color="charcoal", segs=12, bevel=0.02)
    cyl(0.09, 0.04, at=(-0.03, 0, 0.32), color="stone", segs=12)
    cyl(0.025, 0.03, at=(-0.1, -0.05, 0.31), color="sun", segs=8, lod0=True)
    for x in (-0.2, 0.2):
        for y in (-0.25, 0.25):
            cyl(0.095, 0.055, at=(x, y, 0.095), rot=(90, 0, 0), base=False, color="ink_soft", segs=14)
            cyl(0.045, 0.06, at=(x, y, 0.095), rot=(90, 0, 0), base=False, color="cloud", segs=8, lod0=True)
    tube([(0.2, -0.17, 0.17), (0.55, -0.2, 0.84), (0.6, -0.2, 0.9), (0.6, 0.2, 0.9), (0.55, 0.2, 0.84),
          (0.2, 0.17, 0.17)], 0.02, color="stone", segs=6, smooth_path=1)
    cyl(0.026, 0.3, at=(0.6, 0, 0.9), rot=(90, 0, 0), base=False, color="ink_soft", segs=8)
    box((0.3, 0.3, 0.2), at=(0.38, 0, 0.1), rot=(0, -20, 0), base=True, bevel=0.06, color="charcoal")
    tube([(0.0, 0.05, 0.34), (0.25, 0.1, 0.6), (0.52, 0.18, 0.8)], 0.006, color="ink", segs=4, lod0=True)


@asset("coffee_table", "Coffee Table", "Holds mugs, magazines and every lost remote.", 3, "wood", "medium",
       col="box", fill=0.3)
def coffee_table():
    box((1.1, 0.6, 0.06), at=(0, 0, 0.38), base=True, bevel=0.02, color="caramel")
    for x in (-0.47, 0.47):
        for y in (-0.22, 0.22):
            cyl(0.024, 0.38, r2=0.034, at=(x, y, 0), color="cocoa", segs=8)
    box((0.98, 0.48, 0.025), at=(0, 0, 0.1), base=True, color="caramel")
    box((0.3, 0.22, 0.05), at=(-0.2, 0.0, 0.125), base=True, rot=(0, 0, 6), color="cobalt", lod0=True)
    box((0.26, 0.2, 0.04), at=(-0.18, 0.0, 0.175), base=True, rot=(0, 0, -8), color="sun", lod0=True)
    box((0.24, 0.32, 0.014), at=(-0.22, 0.02, 0.44), base=True, rot=(0, 0, 14), color="tomato")
    cyl(0.046, 0.1, at=(0.28, -0.06, 0.44), color="snow", segs=12)
    cyl(0.039, 0.005, at=(0.28, -0.06, 0.537), color="cocoa", segs=10, lod0=True)
    torus(0.03, 0.01, at=(0.33, -0.06, 0.49), rot=(90, 0, 0), color="snow", segs=8, rsegs=4, arc=220,
          scale=(1, 1.1, 1))
    box((0.05, 0.16, 0.02), at=(0.1, 0.1, 0.44), base=True, rot=(0, 0, -30), color="ink_soft", bevel=0.008, bseg=1)


@asset("stove", "Kitchen Stove", "Four burners, one of which works properly.", 3, "metal", "medium",
       variants=["snow", "mint", "butter", "sky"], col="box", fill=0.85)
def stove():
    box((0.76, 0.64, 0.06), base=True, color="charcoal")
    box((0.76, 0.64, 0.76), at=(0, 0, 0.06), base=True, bevel=0.02, color="snow", tint=True)
    box((0.78, 0.66, 0.03), at=(0, 0, 0.82), base=True, bevel=0.01, color="charcoal")
    box((0.76, 0.06, 0.13), at=(0, 0.29, 0.85), base=True, bevel=0.02, color="snow", tint=True)
    for x in (-0.18, 0.18):
        for y in (-0.14, 0.12):
            cyl(0.095, 0.012, at=(x, y, 0.85), color="ink_soft", segs=12)
    box((0.64, 0.03, 0.46), at=(0, -0.32, 0.12), base=True, bevel=0.015, color="snow", tint=True)
    box((0.44, 0.02, 0.22), at=(0, -0.335, 0.24), base=True, color="ink_soft", bevel=0.02)
    cyl(0.014, 0.5, at=(0, -0.375, 0.62), rot=(0, 90, 0), base=False, color="stone", segs=6)
    for x in (-0.22, 0.22):
        box((0.02, 0.05, 0.02), at=(x, -0.35, 0.62), color="stone", lod0=True)
    for i in range(4):
        cyl(0.028, 0.03, at=(-0.27 + i * 0.18, -0.335, 0.72), rot=(90, 0, 0), base=False, color="ink", segs=8)
    cyl(0.11, 0.1, at=(-0.18, -0.14, 0.86), color="tomato", segs=12)
    cyl(0.115, 0.02, at=(-0.18, -0.14, 0.96), r2=0.08, color="stone", segs=12)
    sphere(0.02, at=(-0.18, -0.14, 0.985), color="ink_soft", segs=6, rings=4)
    for k in (-1, 1):
        box((0.05, 0.03, 0.02), at=(-0.18 + k * 0.13, -0.14, 0.94), color="tomato", lod0=True)


@asset("tv_stand", "Telly", "Three channels, all of them weather.", 3, "electronic", "medium",
       variants=["tangerine", "teal", "butter", "tomato"], col="box", fill=0.55)
def tv_stand():
    for x in (-0.5, 0.5):
        for y in (-0.15, 0.15):
            cyl(0.025, 0.08, at=(x, y, 0), color="ink_soft", segs=8)
    box((1.16, 0.42, 0.4), at=(0, 0, 0.08), base=True, bevel=0.02, color="cocoa")
    for x in (-0.28, 0.28):
        box((0.5, 0.02, 0.28), at=(x, -0.21, 0.14), base=True, color="caramel", lod0=True)
        sphere(0.02, at=(x * 0.2, -0.225, 0.28), color="ink_soft", segs=6, rings=4, lod0=True)
    box((0.74, 0.5, 0.54), at=(0, 0.02, 0.48), base=True, bevel=0.07, color="tangerine", tint=True)
    box((0.5, 0.05, 0.4), at=(-0.08, -0.215, 0.55), base=True, bevel=0.06, color="navy")
    box((0.16, 0.012, 0.04), at=(-0.18, -0.243, 0.86), rot=(0, 30, 0), color="sky", lod0=True)
    for z in (0.82, 0.7):
        cyl(0.035, 0.03, at=(0.26, -0.23, z), rot=(90, 0, 0), base=False, color="ink_soft", segs=10)
    for i in range(3):
        box((0.1, 0.01, 0.015), at=(0.26, -0.232, 0.56 + i * 0.035), color="ink_soft", lod0=True)
    sphere(0.06, at=(0, 0.05, 1.02), scale=(1, 1, 0.6), color="ink_soft", segs=10, rings=5)
    for k in (-1, 1):
        tube([(k * 0.02, 0.05, 1.03), (k * 0.24, 0.07, 1.28)], 0.008, color="ink_soft", segs=4)
        sphere(0.018, at=(k * 0.24, 0.07, 1.28), color="ink_soft", segs=6, rings=4)


@asset("fish_tank", "Fish Tank", "The fish have seen everything. They forgive you.", 3, "glass", "medium",
       col="box", fill=0.85)
def fish_tank():
    box((0.9, 0.42, 0.52), base=True, bevel=0.015, color="cocoa")
    box((0.86, 0.38, 0.42), at=(0, 0, 0.52), base=True, color="glass")
    box((0.92, 0.44, 0.06), at=(0, 0, 0.94), base=True, bevel=0.015, color="cocoa")
    f = -0.196
    for (x, h, w) in ((-0.33, 0.3, 0.07), (-0.22, 0.22, 0.06), (0.3, 0.34, 0.08)):
        pts = [(-w / 2, 0), (w / 2, 0), (w * 0.2, h * 0.4), (w * 0.6, h * 0.7), (0, h), (-w * 0.3, h * 0.65),
               (w * 0.05, h * 0.35)]
        extrude([(x + px, 0.525 + pz) for (px, pz) in pts], 0.01, at=(0, f, 0), rot=(90, 0, 0), color="leaf")
    for (x, z, s, d) in ((-0.06, 0.78, 1.0, 1), (0.14, 0.64, 0.8, -1)):
        sphere(0.06 * s, at=(x, f - 0.005, z), scale=(1.3, 0.3, 0.9), color="tangerine", segs=10, rings=5)
        extrude([(0, 0), (0.07 * s, 0.05 * s), (0.07 * s, -0.05 * s)], 0.012,
                at=(x - d * 0.06 * s, f - 0.005, z), rot=(90, 0, 0 if d > 0 else 180), color="tangerine")
        sphere(0.011 * s, at=(x + d * 0.04 * s, f - 0.022, z + 0.012), scale=(1, 0.5, 1), color="ink", segs=6,
               rings=4)
    for (x, z) in ((0.0, 0.86), (0.03, 0.9), (-0.02, 0.83)):
        sphere(0.012, at=(x, f - 0.004, z), scale=(1, 0.4, 1), color="snow", segs=6, rings=4, lod0=True)
    sphere(0.02, at=(0.0, -0.215, 0.26), color="sun", segs=6, rings=4, lod0=True)


@asset("ironing_board", "Ironing Board", "Flattens shirts. Secretly dreams of surfing.", 3, "metal", "medium",
       variants=["sky", "bubblegum", "mint", "butter"], col="box", fill=0.12)
def ironing_board():
    pts = []
    for i in range(7):
        a = math.radians(90 + 180 * i / 6)
        pts.append((-0.5 + 0.17 * math.cos(a), 0.17 * math.sin(a)))
    pts += [(0.3, -0.16), (0.5, -0.1), (0.62, 0.0), (0.5, 0.1), (0.3, 0.16)]
    extrude(pts, 0.04, at=(0, 0, 0.84), color="sky", tint=True, center=False)
    extrude([(x * 0.94, y * 0.88) for (x, y) in pts], 0.02, at=(0, 0, 0.825), color="stone", center=False)
    for (x, y) in ((-0.45, 0.06), (-0.2, -0.08), (0.05, 0.07), (0.3, -0.05), (0.15, -0.1), (-0.3, -0.1),
                   (0.45, 0.02)):
        cyl(0.025, 0.004, at=(x, y, 0.88), color="snow", segs=8, lod0=True)
    for y in (-0.11, 0.11):
        tube([(-0.42, y, 0.0), (0.25, y, 0.83)], 0.014, color="stone", segs=6)
        tube([(0.35, y, 0.0), (-0.3, y, 0.83)], 0.014, color="stone", segs=6)
        for x in (-0.42, 0.35):
            sphere(0.022, at=(x, y, 0.01), scale=(1.4, 1, 0.6), color="ink_soft", segs=6, rings=4)
    ix, iz = -0.36, 0.88
    shape = [(-0.11, -0.065), (0.04, -0.065), (0.13, 0.0), (0.04, 0.065), (-0.11, 0.065)]
    extrude(shape, 0.02, at=(ix, 0.0, iz), rot=(0, 0, 25), color="cloud", center=False)
    extrude([(x * 0.85, y * 0.8) for (x, y) in shape], 0.045, at=(ix, 0.0, iz + 0.02), rot=(0, 0, 25),
            color="teal", center=False)
    torus(0.06, 0.015, at=(ix - 0.01, -0.005, iz + 0.06), rot=(90, 0, 25), color="teal", segs=10, rsegs=4,
          arc=180)


@asset("wheelbarrow", "Wheelbarrow", "One wheel, two handles, infinite wobble.", 3, "metal", "medium",
       variants=["leaf", "tomato", "sun", "sky"], col="box", fill=0.3)
def wheelbarrow():
    prof = [(-0.22, 0.34), (0.25, 0.34), (0.36, 0.66), (-0.46, 0.66)]
    extrude(prof, 0.56, rot=(90, 0, 0), color="leaf", tint=True)
    box((0.74, 0.5, 0.02), at=(-0.05, 0, 0.64), base=True, color="cocoa")
    sphere(0.25, at=(-0.05, 0, 0.65), scale=(1.2, 0.85, 0.28), color="cocoa", segs=10, rings=5)
    _wheel((-0.5, 0, 0.17), 0.17, 0.04, w=0.08, segs=14, hub="cloud")
    for y in (-0.06, 0.06):
        tube([(-0.5, y, 0.17), (-0.3, y * 3.3, 0.32), (0.3, y * 4.2, 0.4), (0.62, y * 4.4, 0.53)], 0.018,
             color="stone", segs=6)
    for y in (-0.25, 0.25):
        cyl(0.026, 0.12, at=(0.62, y * 1.06, 0.53), rot=(0, 70, 0), base=False, color="ink_soft", segs=8)
        tube([(0.18, y, 0.38), (0.24, y, 0.0)], 0.016, color="stone", segs=6)
    cyl(0.012, 0.5, at=(0.24, 0, 0.02), rot=(90, 0, 0), base=False, color="stone", segs=6)


@asset("doghouse", "Doghouse", "Dog-sized real estate. Excellent views of the bin.", 3, "wood", "medium",
       variants=["tomato", "sky", "sun", "leaf", "lavender"], col="box", fill=0.75)
def doghouse():
    extrude([(-0.5, 0), (0.5, 0), (0.5, 0.62), (0, 0.97), (-0.5, 0.62)], 1.15, rot=(90, 0, 0), color="tomato",
            tint=True)
    ang = math.degrees(math.atan2(0.35, 0.5))
    s = math.sin(math.radians(ang))
    c = math.cos(math.radians(ang))
    for k in (-1, 1):
        box((0.74, 1.3, 0.07), at=(k * (0.27 + 0.035 * s), 0, 0.81 + 0.035 * c), rot=(0, k * ang, 0),
            color="charcoal", bevel=0.015)
    cyl(0.05, 1.32, at=(0, 0, 1.0), rot=(90, 0, 0), base=False, color="charcoal", segs=8)
    arch = [(-0.2, 0), (0.2, 0)] + [(0.2 * math.cos(math.radians(a)), 0.36 + 0.2 * math.sin(math.radians(a)))
                                    for a in range(0, 181, 30)]
    extrude(arch, 0.03, at=(0, -0.57, 0), rot=(90, 0, 0), color="ink")
    box((0.3, 0.02, 0.09), at=(0, -0.585, 0.66), color="paper", lod0=True)
    bx, by = 0.32, -0.66
    tube([(bx - 0.08, by, 0.025), (bx + 0.08, by, 0.025)], 0.018, color="paper", segs=6)
    for dx in (-0.09, 0.09):
        for dy in (-0.02, 0.02):
            sphere(0.024, at=(bx + dx, by + dy, 0.025), color="paper", segs=6, rings=4)


@asset("garden_bench", "Garden Bench", "Rated four sits out of five.", 3, "wood", "medium",
       variants=["caramel", "pine", "cobalt", "tomato"], col="box", fill=0.3)
def garden_bench():
    for y in (-0.15, -0.02, 0.11):
        box((1.5, 0.11, 0.035), at=(0, y, 0.42), base=True, bevel=0.012, color="caramel", tint=True)
    for i, z in enumerate((0.56, 0.69, 0.82)):
        box((1.5, 0.035, 0.1), at=(0, 0.22 + i * 0.025, z), rot=(-12, 0, 0), bevel=0.012, color="caramel",
            tint=True)
    for x in (-0.68, 0.68):
        tube([(x, -0.2, 0.0), (x, -0.2, 0.42), (x, -0.22, 0.6), (x, -0.27, 0.64)], 0.024, color="charcoal",
             segs=6, smooth_path=1)
        tube([(x, 0.2, 0.0), (x, 0.22, 0.42), (x, 0.27, 0.9)], 0.024, color="charcoal", segs=6)
        tube([(x, -0.22, 0.41), (x, 0.22, 0.41)], 0.02, color="charcoal", segs=6)
        tube([(x, -0.22, 0.6), (x, 0.0, 0.64), (x, 0.24, 0.66)], 0.022, color="charcoal", segs=6, smooth_path=1)
        sphere(0.035, at=(x, -0.27, 0.64), color="charcoal", segs=8, rings=4)
    box((0.14, 0.012, 0.05), at=(0, 0.215, 0.69), rot=(-12, 0, 0), color="sun", lod0=True)


# ---------------------------------------------------------------- people

@asset("person_adult", "Grown-Up", "Has a lot of opinions about the thermostat.", 3, "living", "medium",
       variants=["tomato", "sun", "teal", "grape", "sky"], col="cyl", flags=["creature", "wander", "flee"], fill=0.45)
def person_adult():
    hz, hr = 1.42, 0.28
    _peg("skin2", "tomato", "navy", "ink_soft", hz=hz, hr=hr, hip=0.6, br=0.27)
    _hair_cap(hz, hr, "cocoa", tilt=-38)
    sphere(hr * 0.42, at=(hr * 0.25, -hr * 0.68, hz + hr * 0.7), scale=(1.7, 0.9, 0.7), rot=(0, -18, 0),
           color="cocoa", segs=6, rings=4)


@asset("person_adult2", "Neighbour", "Here for the snacks, staying for the gossip.", 3, "living", "medium",
       variants=["teal", "flamingo", "sun", "lavender", "tomato"], col="cyl", flags=["creature", "wander", "flee"],
       fill=0.45)
def person_adult2():
    hz, hr = 1.36, 0.27
    _peg("skin4", "teal", "teal", "tomato", hz=hz, hr=hr, hip=0.6, br=0.25, dress=True)
    _hair_cap(hz, hr, "ink", tilt=-32, cover=-25)
    sphere(hr * 0.45, at=(0, hr * 0.3, hz + hr * 1.05), color="ink", segs=8, rings=4)


@asset("person_kid", "Kid", "Runs everywhere. Has never once walked.", 3, "living", "medium",
       variants=["sun", "lime", "flamingo", "sky"], col="cyl", flags=["creature", "wander", "flee"], fill=0.45)
def person_kid():
    hz, hr = 0.93, 0.23
    _peg("skin3", "sun", "cobalt", "snow", hz=hz, hr=hr, hip=0.34, br=0.19, shorts=True)
    _hair_cap(hz, hr, "ink", tilt=-25, cover=-5)
    for k in (-1, 1):
        sphere(hr * 0.4, at=(k * hr * 0.98, hr * 0.12, hz + hr * 0.52), color="ink", segs=7, rings=4)


@asset("person_grandpa", "Grandpa", "Remembers when all of this was fields.", 3, "living", "medium",
       variants=["pine", "cocoa", "grape", "sand"], col="cyl", flags=["creature", "wander"], fill=0.45)
def person_grandpa():
    hz, hr = 1.34, 0.26
    hands = _peg("skin1", "pine", "stone", "cocoa", hz=hz, hr=hr, hip=0.56, br=0.28, reach=(0.0, 0.07))
    for k in (-1, 1):
        sphere(hr * 0.36, at=(k * hr * 0.88, hr * 0.25, hz - hr * 0.05), scale=(0.75, 1.2, 0.9), color="cloud",
               segs=6, rings=4)
    sphere(hr * 0.24, at=(0, -hr * 0.93, hz - hr * 0.4), scale=(2.0, 0.8, 0.75), color="cloud", segs=6, rings=4)
    sphere(hr * 0.15, at=(0, -hr * 1.0, hz - hr * 0.16), color="skin2", segs=6, rings=4, lod0=True)
    for k in (-1, 1):
        torus(hr * 0.17, hr * 0.03, at=(k * hr * 0.36, -hr * 0.97, hz - hr * 0.08), rot=(90, 0, 0), color="ink",
              segs=8, rsegs=3, lod0=True)
    cyl(hr * 1.3, 0.025, at=(0, 0, hz + hr * 0.52), color="charcoal", segs=10)
    cyl(hr * 0.84, hr * 0.55, at=(0, 0, hz + hr * 0.52), r2=hr * 0.74, color="charcoal", segs=10)
    cyl(hr * 0.85, 0.035, at=(0, 0, hz + hr * 0.56), color="tomato", segs=10, lod0=True)
    hx, hy, hzz = hands[1]
    cx, cy = hx + 0.03, hy - 0.02
    tube([(cx, cy, 0.0), (cx, cy, hzz + 0.04)], 0.016, color="cocoa", segs=6)
    torus(0.045, 0.016, at=(cx - 0.045, cy, hzz + 0.04), rot=(90, 0, 0), color="cocoa", segs=8, rsegs=4, arc=180,
          lod0=True)


# ---------------------------------------------------------------- big things

@asset("bicycle", "Bicycle", "Hasn't forgotten how. It never does.", 3, "metal", "medium",
       variants=["tomato", "cobalt", "teal", "sun"], col="box", fill=0.12)
def bicycle():
    R = 0.34
    rh, fh = (-0.53, 0, R), (0.53, 0, R)
    for c in (rh, fh):
        _wheel(c, R, 0.032, segs=18, hub="stone", hub_r=0.035, spokes=3)
    bb, seat, ht, hb = (-0.06, 0, 0.3), (-0.2, 0, 0.8), (0.36, 0, 0.82), (0.4, 0, 0.7)
    for a, b in ((bb, seat), (bb, hb), (seat, ht), (bb, rh), (seat, rh), (hb, fh), (hb, ht)):
        tube([a, b], 0.026, color="tomato", tint=True, segs=6)
    tube([ht, (0.34, 0, 0.94)], 0.018, color="stone", segs=6)
    tube([(0.26, -0.24, 0.98), (0.33, -0.12, 0.95), (0.34, 0.0, 0.95), (0.33, 0.12, 0.95), (0.26, 0.24, 0.98)],
         0.014, color="stone", segs=6)
    for y in (-0.24, 0.24):
        cyl(0.02, 0.09, at=(0.26, y, 0.98), rot=(90, 0, 0), base=False, color="ink_soft", segs=8)
    tube([seat, (-0.22, 0, 0.9)], 0.016, color="stone", segs=6)
    sphere(0.075, at=(-0.2, 0, 0.92), scale=(1.6, 0.8, 0.38), color="ink_soft", segs=10, rings=5)
    torus(0.07, 0.012, at=(-0.06, 0.03, 0.3), rot=(90, 0, 0), color="stone", segs=10, rsegs=3, lod0=True)
    for (dx, dz, dy) in ((0.08, -0.05, -0.08), (-0.08, 0.05, 0.08)):
        box((0.08, 0.06, 0.02), at=(-0.06 + dx, dy, 0.3 + dz), color="ink", lod0=True)
    box((0.22, 0.3, 0.16), at=(0.5, 0, 0.8), base=True, taper=(1.15, 1.1), bevel=0.02, color="sand")
    for (x, y, c) in ((0.47, -0.06, "tomato"), (0.53, 0.06, "sun"), (0.55, -0.04, "flamingo")):
        sphere(0.04, at=(x, y, 0.98), color=c, segs=8, rings=4, lod0=True)


@asset("piano", "Upright Piano", "Knows one song. Plays it constantly.", 3, "wood", "large", col="box", fill=0.8)
def piano():
    box((1.5, 0.5, 1.25), at=(0, 0.05, 0), base=True, bevel=0.02, color="cocoa")
    box((1.56, 0.58, 0.05), at=(0, 0.05, 1.25), base=True, bevel=0.015, color="caramel")
    for x in (-0.72, 0.72):
        box((0.07, 0.62, 0.78), at=(x, -0.11, 0), base=True, bevel=0.015, color="caramel")
    box((1.38, 0.26, 0.06), at=(0, -0.32, 0.62), base=True, color="cocoa")
    box((1.37, 0.24, 0.05), at=(0, -0.33, 0.68), base=True, color="snow")
    wk = 1.37 / 21
    for o in range(3):
        for j in (1, 2, 4, 5, 6):
            x = -1.37 / 2 + wk * (o * 7 + j)
            box((wk * 0.55, 0.13, 0.03), at=(x, -0.29, 0.73), base=True, color="ink", lod0=True)
    box((1.38, 0.08, 0.06), at=(0, -0.2, 0.73), base=True, color="cocoa")
    box((0.42, 0.015, 0.28), at=(0, -0.21, 0.79), rot=(-14, 0, 0), base=True, color="snow")
    for x in (-0.08, 0.0, 0.08):
        box((0.04, 0.08, 0.02), at=(x, -0.22, 0.07), base=True, color="sun", lod0=True)
    box((0.12, 0.1, 0.22), at=(0.5, 0.05, 1.3), base=True, taper=(0.3, 0.3), color="caramel")
    tube([(0.5, 0.0, 1.32), (0.53, -0.01, 1.48)], 0.006, color="ink", segs=4, lod0=True)


@asset("bathtub", "Clawfoot Bathtub", "Feet like a lion, courage of a rubber duck.", 3, "ceramic", "large",
       variants=["bubblegum", "snow", "mint", "butter"], col="box", fill=0.6)
def bathtub():
    prof = [(0, 0.12), (0.26, 0.13), (0.36, 0.2), (0.4, 0.4), (0.41, 0.6), (0.43, 0.62), (0.4, 0.645), (0.37, 0.6),
            (0.34, 0.42), (0, 0.38)]
    lathe(prof, color="bubblegum", tint=True, segs=20, scale=(2.0, 1.0, 1.0))
    cyl(0.365, 0.02, at=(0, 0, 0.52), scale=(2.0, 1.0, 1.0), color="sky", segs=20)
    for (x, y, s) in ((-0.35, -0.05, 1.0), (-0.12, 0.08, 0.85), (0.1, -0.08, 0.95), (0.33, 0.06, 0.8),
                      (-0.5, 0.12, 0.7), (0.5, -0.1, 0.65), (0.0, 0.15, 0.7)):
        sphere(0.13 * s, at=(x, y, 0.55), scale=(1.2, 1.0, 0.65), color="snow", segs=8, rings=5, lod0=True)
    sphere(0.045, at=(0.15, -0.05, 0.65), scale=(1, 1.25, 0.8), color="sun", segs=8, rings=5, lod0=True)
    sphere(0.03, at=(0.15, -0.085, 0.7), color="sun", segs=8, rings=5, lod0=True)
    for x in (-0.55, 0.55):
        for y in (-0.22, 0.22):
            sphere(0.07, at=(x, y, 0.08), scale=(1, 1, 1.25), color="sun", segs=8, rings=5)
            sphere(0.045, at=(x * 1.05, y * 1.25, 0.03), scale=(1.2, 1.2, 0.7), color="sun", segs=8, rings=4)
    tube([(0.74, 0, 0.6), (0.8, 0, 0.8), (0.74, 0, 0.87), (0.66, 0, 0.82)], 0.022, color="sun", segs=6,
         smooth_path=1)
    for y in (-0.09, 0.09):
        cyl(0.025, 0.06, at=(0.78, y, 0.62), color="sun", segs=8, lod0=True)


@asset("fridge", "Fridge", "Magnets hold the house together. Literally.", 3, "electronic", "medium",
       variants=["mint", "snow", "butter", "sky", "bubblegum"], col="box", fill=0.92)
def fridge():
    box((0.76, 0.7, 1.74), at=(0, 0, 0.04), base=True, bevel=0.08, color="mint", tint=True)
    box((0.66, 0.6, 0.04), base=True, color="charcoal")
    box((0.74, 0.02, 0.02), at=(0, -0.352, 1.24), color="ink_soft")
    box((0.045, 0.06, 0.32), at=(-0.27, -0.37, 1.3), base=True, bevel=0.018, color="stone")
    box((0.045, 0.06, 0.4), at=(-0.27, -0.37, 0.78), base=True, bevel=0.018, color="stone")
    box((0.16, 0.01, 0.2), at=(0.08, -0.355, 0.88), rot=(0, 7, 0), color="paper")
    for (x, z, c) in ((0.08, 0.98, "tomato"), (0.2, 1.08, "sun"), (-0.06, 1.12, "cobalt"), (0.22, 0.62, "leaf"),
                      (0.0, 0.66, "sun"), (0.12, 1.42, "tomato"), (-0.05, 1.5, "cobalt")):
        cyl(0.035, 0.02, at=(x, -0.355, z), rot=(90, 0, 0), color=c, segs=8, lod0=True)
    box((0.12, 0.01, 0.12), at=(0.16, -0.356, 1.52), rot=(0, -10, 0), color="paper", lod0=True)


@asset("sofa", "Sofa", "Contains four coins, a crayon and a lost era.", 3, "soft", "large",
       variants=["teal", "tomato", "sun", "grape", "cobalt"], col="box", fill=0.7)
def sofa():
    _couch(2.1, 3, "teal", depth=0.9, back_h=0.95, arm_w=0.22, pillow="butter", pillows=2)


@asset("kitchen_table", "Kitchen Table", "Where all the important family arguments happen.", 3, "wood", "large",
       variants=["tomato", "cobalt", "leaf", "sun"], col="box", fill=0.45)
def kitchen_table():
    for x in (-0.62, 0.62):
        for y in (-0.31, 0.31):
            cyl(0.035, 0.6, r2=0.028, at=(x, y, 0), color="cocoa", segs=8)
    box((1.66, 1.0, 0.18), at=(0, 0, 0.59), base=True, taper=(0.928, 0.88), color="paper")
    box((1.67, 1.01, 0.03), at=(0, 0, 0.58), base=True, color="tomato", tint=True)
    for y in (-0.33, -0.11, 0.11, 0.33):
        box((1.53, 0.065, 0.006), at=(0, y, 0.77), base=True, color="tomato", tint=True)
    for i in range(7):
        box((0.065, 0.87, 0.006), at=(-0.66 + 0.22 * i, 0, 0.771), base=True, color="tomato", tint=True)
    for i in range(7):
        box((0.065, 0.01, 0.17), at=(-0.66 + 0.22 * i, -0.502, 0.6), rot=(-18.4, 0, 0), base=True, color="tomato",
            tint=True, lod0=True)
    for y in (-0.33, -0.11, 0.11, 0.33):
        box((0.01, 0.065, 0.17), at=(0.832, y, 0.6), rot=(0, -18.4, 0), base=True, color="tomato", tint=True,
            lod0=True)
    lathe([(0, 0.77), (0.07, 0.77), (0.15, 0.82), (0.17, 0.86), (0.14, 0.85), (0, 0.83)], color="snow", segs=12)
    for (x, y, c) in ((-0.05, -0.03, "tomato"), (0.06, 0.02, "lime"), (0.0, 0.07, "sun"), (0.02, -0.06, "tomato")):
        sphere(0.055, at=(x, y, 0.87), color=c, segs=8, rings=5, lod0=True)


@asset("wardrobe", "Wardrobe", "Full of coats. One sleeve is trying to escape.", 3, "wood", "large",
       variants=["sky", "flamingo", "sun", "lime"], col="box", fill=0.9)
def wardrobe():
    for x in (-0.46, 0.46):
        for y in (-0.22, 0.22):
            cyl(0.04, 0.08, r2=0.05, at=(x, y, 0), color="cocoa", segs=8)
    box((1.1, 0.6, 1.84), at=(0, 0, 0.08), base=True, bevel=0.02, color="caramel")
    box((1.2, 0.68, 0.08), at=(0, 0, 1.92), base=True, bevel=0.02, color="cocoa")
    for x in (-0.27, 0.27):
        box((0.48, 0.02, 1.3), at=(x, -0.305, 0.46), base=True, color="sand")
        sphere(0.025, at=(x * 0.12, -0.32, 1.1), color="sun", segs=6, rings=4)
    box((1.0, 0.02, 0.26), at=(0, -0.305, 0.14), base=True, color="sand")
    sphere(0.025, at=(0, -0.32, 0.27), color="sun", segs=6, rings=4, lod0=True)
    tube([(0.0, -0.3, 1.32), (0.04, -0.37, 1.2), (0.05, -0.38, 1.0), (0.04, -0.37, 0.85)], 0.045, r_end=0.04,
         color="sky", tint=True, segs=6, smooth_path=1)
    cyl(0.044, 0.04, at=(0.04, -0.37, 0.81), color="snow", segs=8)


@asset("grandfather_clock", "Grandfather Clock", "Bongs on the hour. Bongs off the hour. Just bongs.", 3, "wood",
       "medium", col="box", fill=0.6)
def grandfather_clock():
    box((0.56, 0.36, 0.45), base=True, bevel=0.015, color="cocoa")
    box((0.6, 0.4, 0.05), at=(0, 0, 0.42), base=True, bevel=0.01, color="caramel")
    box((0.44, 0.3, 0.95), at=(0, 0, 0.45), base=True, color="cocoa")
    box((0.26, 0.02, 0.62), at=(0, -0.152, 0.6), base=True, color="ink_soft")
    box((0.012, 0.012, 0.42), at=(0, -0.168, 0.82), rot=(0, 8, 0), base=True, color="sun")
    cyl(0.07, 0.02, at=(0.028, -0.172, 0.82), rot=(90, 0, 0), base=False, color="sun", segs=12)
    box((0.6, 0.4, 0.05), at=(0, 0, 1.38), base=True, bevel=0.01, color="caramel")
    box((0.56, 0.38, 0.5), at=(0, 0, 1.42), base=True, bevel=0.015, color="cocoa")
    cyl(0.2, 0.02, at=(0, -0.19, 1.66), rot=(90, 0, 0), base=False, color="paper", segs=18)
    torus(0.2, 0.012, at=(0, -0.2, 1.66), rot=(90, 0, 0), color="sun", segs=18, rsegs=3, lod0=True)
    for i in range(4):
        a = math.radians(90 * i)
        box((0.022, 0.01, 0.022), at=(0.16 * math.cos(a), -0.202, 1.66 + 0.16 * math.sin(a)), color="ink",
            lod0=True)
    box((0.012, 0.01, 0.13), at=(0.02, -0.205, 1.66), rot=(0, 20, 0), base=True, color="ink")
    box((0.1, 0.01, 0.014), at=(-0.04, -0.205, 1.64), rot=(0, 25, 0), color="ink")
    arch = [(-0.3, 0), (0.3, 0)] + [(0.3 * math.cos(math.radians(a)), 0.1 * math.sin(math.radians(a)))
                                    for a in range(30, 151, 30)]
    extrude(arch, 0.38, at=(0, 0, 1.92), rot=(90, 0, 0), color="caramel")
    sphere(0.035, at=(0, 0, 2.04), color="sun", segs=8, rings=5)


@asset("sunflower", "Sunflower", "Follows the sun around like a very tall puppy.", 3, "plant", "medium",
       col="cyl", fill=0.15)
def sunflower():
    tube([(0, 0, 0), (0.03, 0, 0.6), (0.0, 0, 1.1), (0.0, -0.06, 1.36)], 0.045, r_end=0.032, color="pine", segs=6,
         smooth_path=1)
    leaf = [(0, 0), (0.12, -0.13), (0.26, -0.15), (0.4, -0.09), (0.5, 0.0), (0.4, 0.09), (0.26, 0.15), (0.12, 0.13)]
    for (z, yaw, pitch) in ((0.42, 15, 15), (0.72, 195, 22), (0.98, 80, 12)):
        y = math.radians(yaw)
        extrude(leaf, 0.014, at=(0.02 * math.cos(y), 0.02 * math.sin(y), z), rot=(0, -pitch, yaw), color="leaf")
    hc = Vector((0.0, -0.1, 1.46))
    tilt = Euler((math.radians(105), 0, 0), "XYZ").to_matrix()
    cyl(0.2, 0.08, at=tuple(hc), rot=(105, 0, 0), base=False, color="cocoa", segs=16)
    cyl(0.18, 0.05, at=tuple(hc + tilt @ Vector((0, 0, -0.06))), rot=(105, 0, 0), base=False, color="leaf", segs=12)
    petal = [(0, -0.06), (0.11, -0.075), (0.23, 0.0), (0.11, 0.075), (0, 0.06)]
    n = 10 if _lod1() else 16
    for i in range(n):
        a = 360.0 * i / n
        m = tilt @ Euler((0, 0, math.radians(a)), "XYZ").to_matrix()
        e = m.to_euler("XYZ")
        p = hc + m @ Vector((0.16, 0, -0.012 + 0.012 * (i % 2)))
        extrude(petal, 0.014, at=tuple(p), rot=tuple(math.degrees(v) for v in e), color="sun")
    for i in range(7):
        a = 2.4 * i
        rr = 0.04 + 0.016 * i
        p = hc + tilt @ Vector((rr * math.cos(a), rr * math.sin(a), 0.04))
        sphere(0.014, at=tuple(p), scale=(1, 1, 0.5), rot=(105, 0, 0), color="sand", segs=5, rings=3, lod0=True)


@asset("kiddie_pool", "Kiddie Pool", "Eleven centimetres deep. Zero lifeguards.", 3, "rubber", "large",
       variants=["flamingo", "sky", "sun", "lime"], col="cyl", fill=0.4)
def kiddie_pool():
    cyl(0.9, 0.02, color="cloud", segs=24)
    cyl(0.84, 0.3, at=(0, 0, 0.0), color="sky", segs=24)
    for z, c, t in ((0.085, "flamingo", True), (0.235, "snow", False), (0.385, "flamingo", True)):
        torus(0.88, 0.085, at=(0, 0, z), color=c, tint=t, segs=26, rsegs=6)
    dx, dy = 0.25, -0.15
    sphere(0.09, at=(dx, dy, 0.33), scale=(1, 1.3, 0.75), color="sun", segs=10, rings=5)
    sphere(0.06, at=(dx, dy - 0.07, 0.42), color="sun", segs=10, rings=5)
    sphere(0.03, at=(dx, dy - 0.13, 0.41), scale=(1.2, 1.2, 0.5), color="tangerine", segs=8, rings=4)
    _dot_eyes((dx, dy - 0.115, 0.44), 0.05, 0.011)
    sphere(0.14, at=(-0.35, 0.25, 0.37), color="tomato", segs=10, rings=6)
    cyl(0.142, 0.06, at=(-0.35, 0.25, 0.37), base=False, color="snow", segs=10, lod0=True)


@asset("hedge", "Hedge", "A wall that grows. Hides at least three tennis balls.", 3, "plant", "large", col="box",
       fill=0.9)
def hedge():
    box((2.5, 0.8, 1.1), base=True, bevel=0.2, bseg=2, color="leaf")
    for i, x in enumerate((-0.95, -0.48, 0.0, 0.48, 0.95)):
        sphere(0.32, at=(x, 0.02 * (i % 2), 1.0 + 0.04 * (i % 2)), scale=(1.0, 1.15, 0.6), color="leaf", segs=10,
               rings=6)
    for (x, z) in ((-0.8, 0.5), (-0.2, 0.75), (0.45, 0.35), (0.9, 0.7), (-0.5, 0.25), (0.15, 0.55)):
        sphere(0.11, at=(x, -0.4, z), scale=(1.3, 0.4, 0.9), color="lime", segs=8, rings=4, lod0=True)
    for (x, z) in ((-0.6, 0.85), (0.3, 0.9), (1.05, 0.4), (-1.05, 0.6), (0.7, 0.2)):
        sphere(0.04, at=(x, -0.41, z), scale=(1, 0.5, 1), color="bubblegum", segs=6, rings=4, lod0=True)
    sphere(0.07, at=(0.62, -0.38, 0.6), color="lime", segs=10, rings=5, lod0=True)


@asset("pingpong_table", "Ping-Pong Table", "Mostly used for folding laundry.", 3, "wood", "large",
       variants=["cobalt", "pine", "teal"], col="box", fill=0.2)
def pingpong_table():
    box((2.74, 1.52, 0.04), at=(0, 0, 0.72), base=True, bevel=0.008, color="cobalt", tint=True)
    for y in (-0.745, 0.745):
        box((2.74, 0.03, 0.004), at=(0, y, 0.76), base=True, color="snow")
    for x in (-1.355, 1.355):
        box((0.03, 1.52, 0.004), at=(x, 0, 0.76), base=True, color="snow")
    box((2.74, 0.015, 0.004), at=(0, 0, 0.76), base=True, color="snow", lod0=True)
    box((0.015, 1.7, 0.15), at=(0, 0, 0.76), base=True, color="ink_soft")
    box((0.02, 1.7, 0.02), at=(0, 0, 0.91), base=True, color="snow")
    for y in (-0.86, 0.86):
        box((0.04, 0.04, 0.2), at=(0, y, 0.72), base=True, color="stone")
    for x in (-1.0, 1.0):
        for y in (-0.6, 0.6):
            box((0.06, 0.06, 0.72), at=(x, y, 0), base=True, color="charcoal")
        box((0.05, 1.2, 0.05), at=(x, 0, 0.18), base=True, color="charcoal", lod0=True)
    for (x, y, a) in ((-0.8, -0.3, 30), (0.7, 0.35, -110)):
        cyl(0.08, 0.012, at=(x, y, 0.76), color="tomato", segs=12)
        box((0.11, 0.035, 0.02), at=(x + 0.11 * math.cos(math.radians(a)), y + 0.11 * math.sin(math.radians(a)),
                                    0.765), rot=(0, 0, a), base=True, color="caramel")
    sphere(0.02, at=(0.2, -0.4, 0.78), color="snow", segs=8, rings=5, lod0=True)
