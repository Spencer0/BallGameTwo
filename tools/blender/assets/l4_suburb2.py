"""Level 4 — Maple Loop street kit, part 2: signals, street trees, tiling privacy fence, houses with attached
garages, the school, the strip mall, pedestrians, pigeons, service vehicles and kerbside furniture.

Same conventions as l4_street: metres, Blender Z up, base at z = 0. Buildings face -Y (the game's +Z) with
their width along X. Vehicles run along X with the nose (headlights) at +X. Linear tiling things run along X at
exactly their spacing, with a half-post at each end."""
import math

from lib.core import STATE, box, cyl, sphere, torus, lathe, extrude, tube, star_points
from lib.registry import asset
from assets.l4_street import _lod1, _dot_eyes, _wheels, _panel, _window, _door, _gable_x, _gable_y


# ---------------------------------------------------------------- local helpers

def _signal_head(x, y, z, lens_r=0.17, pitch=0.42, plate=0.14, d=0.3, segs=10, rings=5):
    """Double-faced three-lens signal head centred at (x, y, z): a sun backplate through its middle, charcoal
    housing, and big domed lenses with short visors on BOTH faces (-Y and +Y), so it reads from either direction.
    The lenses are the ONLY tinted part (the game re-tints them per signal phase)."""
    w = lens_r * 2 + 0.16
    h = pitch * 2 + lens_r * 2 + 0.16
    box((w + 2 * plate, 0.05, h + 2 * plate), at=(x, y, z), color="sun")
    box((w, d, h), at=(x, y, z), bevel=0.03, bseg=1, color="charcoal")
    for s in (-1, 1):
        f = y + s * d / 2
        for i in (-1, 0, 1):
            zz = z + i * pitch
            sphere(lens_r, at=(x, f + s * 0.02, zz), scale=(1, 0.42, 1), color="leaf", tint=True, segs=segs,
                   rings=rings)
            box((lens_r * 2.3, lens_r * 0.8, 0.045), at=(x, f + s * lens_r * 0.4, zz + lens_r + 0.03),
                rot=(s * 10, 0, 0), color="charcoal", lod0=True)


def _shuttered(side, wall, u, z, w, h, shutter, frame="snow"):
    """Window with narrow shutters tight to the frame (for tightly spaced colonial bays)."""
    _window(side, wall, u, z, w, h, frame=frame)
    for k in (-1, 1):
        _panel(side, wall, u + k * (w / 2 + 0.27), z, 0.3, h + 0.1, 0.07, shutter, lod0=True)


def _garage_door(side, wall, u, z0, w, h, color="cloud", frame="snow"):
    """Sectional garage door: frame, slab, groove lines and a row of little windows."""
    _panel(side, wall, u, z0 + h / 2 + 0.04, w + 0.28, h + 0.1, 0.05, frame, lod0=True)
    _panel(side, wall, u, z0 + h / 2, w, h, 0.09, color)
    for i in range(1, 4):
        _panel(side, wall, u, z0 + h * i / 4, w, 0.05, 0.12, "stone", lod0=True)
    n = max(2, int(round(w / 0.75)))
    for i in range(n):
        _panel(side, wall, u - w / 2 + w * (i + 0.5) / n, z0 + h * 0.84, w / n * 0.6, h * 0.12, 0.12, "glass",
               lod0=True)


def _hair(hz, hr, color, tilt=-35, cover=-15, at=(0, 0)):
    R = hr * 1.07
    prof = [(R * math.cos(math.radians(a)), R * math.sin(math.radians(a))) for a in (cover, 18, 48, 72)] + [(0, R)]
    lathe(prof, at=(at[0], at[1], hz), rot=(tilt, 0, 0), color=color, segs=9)


def _head(hz, hr, skin, hy=0.0, look=0.0):
    sphere(hr, at=(0, hy, hz), color=skin, segs=10, rings=7)
    _dot_eyes((0, hy - hr * 0.89, hz - hr * (0.1 + look)), hr * 0.74, hr * 0.145)
    for k in (-1, 1):
        sphere(hr * 0.13, at=(k * hr * 0.6, hy - hr * 0.76, hz - hr * 0.34 - hr * look), scale=(1, 0.5, 0.75),
               color="bubblegum", segs=5, rings=3, lod0=True)


def _torso(top, tint, z0, sz, br, lean=0.0):
    T = sz - z0
    prof = [(0, 0), (br * 0.86, 0), (br, T * 0.22), (br * 0.97, T * 0.56), (br * 0.8, T * 0.86), (br * 0.45, T),
            (0, T)]
    lathe(prof, at=(0, 0, z0), rot=(lean, 0, 0), color=top, tint=tint, segs=10)


def _straight_legs(lx, lr, hip, color, shoes, tint=False):
    for k in (-1, 1):
        cyl(lr, hip - 0.02, at=(k * lx, 0, 0.03), color=color, tint=tint, segs=7)
        sphere(lr * 1.3, at=(k * lx, -lr * 0.45, lr * 0.6), scale=(1, 1.5, 0.65), color=shoes, segs=7, rings=4)


def _arm(path, r, color, tint, skin, hand_r):
    tube(path, r, color=color, tint=tint, segs=6)
    sphere(hand_r, at=path[-1], color=skin, segs=6, rings=3)


def _sedan(L, col, tint=False, r=0.4, wy=0.76):
    """Three-box toy sedan, nose at +X. Returns the body's half-width."""
    ax = L * 0.3
    _wheels((-ax, ax), wy, r, r, 0.32)
    box((L - 0.3, 1.8, 0.72), at=(0, 0, 0.3), base=True, bevel=0.26, color=col, tint=tint)
    box((L * 0.47, 1.62, 0.62), at=(-0.15, 0, 0.95), base=True, taper=(0.68, 0.84), bevel=0.12, color="glass")
    box((L * 0.33, 1.42, 0.14), at=(-0.2, 0, 1.53), base=True, bevel=0.05, color=col, tint=tint)
    box((0.16, 1.64, 0.6), at=(-0.1, 0, 0.96), base=True, taper=(1, 0.86), color=col, tint=tint)
    for x in (L / 2 - 0.1, -(L / 2 - 0.1)):
        box((0.2, 1.74, 0.24), at=(x, 0, 0.28), base=True, bevel=0.08, color="cloud")
    for k in (-1, 1):
        sphere(0.14, at=(L / 2 - 0.17, k * 0.56, 0.76), scale=(0.45, 1, 0.9), color="butter", segs=10, rings=5)
        box((0.08, 0.26, 0.14), at=(-(L / 2 - 0.17), k * 0.6, 0.8), bevel=0.03, color="tomato")
        sd = "-y" if k < 0 else "+y"
        _panel(sd, k * 0.9, -0.1, 0.66, 0.04, 0.5, 0.02, "ink_soft", lod0=True)
        _panel(sd, k * 0.9, 0.3, 0.84, 0.2, 0.05, 0.03, "cloud", lod0=True)
        _panel(sd, k * 0.9, -0.55, 0.84, 0.2, 0.05, 0.03, "cloud", lod0=True)
        sphere(0.08, at=(0.75, k * 0.92, 1.0), scale=(1.3, 0.6, 0.8), color=col, tint=tint, segs=6, rings=4,
               lod0=True)
    box((0.06, 0.9, 0.18), at=(L / 2 - 0.12, 0, 0.6), color="ink_soft", lod0=True)
    return 0.9


# ---------------------------------------------------------------- signals & street furniture

@asset("traffic_light", "Traffic Light", "Knows three words. Says them in the same order, forever.", 4, "metal",
       "medium", col="cyl", fill=0.06)
def traffic_light():
    # The pole stands at the -X end of the bbox; the mast arm reaches +X out over the road.
    px = -2.7
    cyl(0.34, 0.32, at=(px, 0, 0), r2=0.28, color="charcoal", segs=12)
    cyl(0.18, 6.15, r2=0.13, at=(px, 0, 0.3), color="stone", segs=10)
    sphere(0.17, at=(px, 0, 6.4), color="stone", segs=8, rings=5)
    # mast arm + brace
    tube([(px, 0, 5.9), (2.45, 0, 5.9)], 0.12, r_end=0.075, color="stone", segs=8)
    tube([(px, 0, 5.2), (px + 1.7, 0, 5.88)], 0.05, color="stone", segs=5, lod0=True)
    cyl(0.22, 0.2, at=(px, 0, 5.8), color="charcoal", segs=10, lod0=True)
    # the head hangs at the arm's end, lenses on both faces (-Y and +Y)
    hx = 2.45
    cyl(0.05, 0.3, at=(hx, 0, 5.62), color="stone", segs=6)
    _signal_head(hx, 0.0, 4.74, lens_r=0.22, pitch=0.52, plate=0.14)
    # street-name blade on top of the arm + push-button box on the pole
    box((1.7, 0.04, 0.34), at=(0.2, 0, 6.2), bevel=0.02, color="leaf")
    _panel("-y", -0.02, 0.2, 6.2, 1.5, 0.05, 0.01, "snow", lod0=True)
    for k in (-1, 1):
        box((0.04, 0.04, 0.3), at=(0.2 + k * 0.6, 0, 6.03), base=False, color="stone", lod0=True)
    box((0.16, 0.12, 0.26), at=(px, -0.2, 1.15), bevel=0.02, color="sun", lod0=True)
    cyl(0.04, 0.03, at=(px, -0.27, 1.15), rot=(90, 0, 0), base=False, color="charcoal", segs=8, lod0=True)


@asset("signal_post", "Signal Post", "The small-town signal. Knows every driver by their indicator habits.", 4,
       "metal", "small", col="cyl", fill=0.1)
def signal_post():
    cyl(0.28, 0.14, r2=0.24, color="charcoal", segs=10)
    cyl(0.085, 3.0, r2=0.075, at=(0, 0, 0.12), color="stone", segs=8)
    _signal_head(0, 0.0, 3.62, lens_r=0.13, pitch=0.32, plate=0.09, d=0.28, segs=8, rings=4)
    box((0.12, 0.1, 0.22), at=(0, -0.11, 1.1), bevel=0.015, color="sun", lod0=True)


@asset("street_tree", "Street Tree", "Planted by the council in 1994. Has been lifting the pavement ever since.", 4,
       "plant", "medium", variants=["leaf", "lime", "pine", "tangerine", "bubblegum"], col="cyl", fill=0.4)
def street_tree():
    lathe([(0, 0), (0.45, 0), (0.32, 0.2), (0.26, 0.7), (0.22, 3.6), (0, 3.6)], color="cocoa", segs=9)
    for (dx, dy) in ((0.95, -0.2), (-0.85, 0.45), (0.1, -0.95)):
        tube([(0, 0, 2.7), (dx * 0.6, dy * 0.6, 3.5), (dx, dy, 3.95)], 0.1, r_end=0.06, color="cocoa", segs=5)
    # a clump of three lobes under a tall crown: bumpy cloud silhouette, upright (not tree_round's lollipop)
    for (x, y, z, r) in ((1.05, -0.25, 4.3, 1.2), (-1.0, 0.55, 4.45, 1.2), (0.1, -1.05, 4.05, 1.1)):
        sphere(r, at=(x, y, z), color="leaf", tint=True, segs=11, rings=7)
    sphere(1.5, at=(0.0, 0.2, 5.45), scale=(1, 1, 1.05), color="leaf", tint=True, segs=13, rings=8)
    sphere(0.8, at=(0.35, -0.6, 6.25), color="leaf", tint=True, segs=8, rings=5, lod0=True)


@asset("privacy_fence", "Privacy Fence", "Six feet of polite silence between neighbours.", 4, "wood", "small",
       variants=["caramel", "sand", "snow", "cocoa"], col="box", fill=0.7)
def privacy_fence():
    # EXACTLY 2.4 long (X) x 1.8 high x 0.12 deep; boards on the front (-Y), rails behind (+Y), and a HALF post
    # at each end so panels laid end to end at 2.4 m spacing share full posts.
    L, H, HB = 2.4, 1.8, 1.72
    yb = (-0.06, -0.035)          # board layer
    yr = (-0.035, 0.06)           # rail / post layer
    byc, bt = (yb[0] + yb[1]) / 2, yb[1] - yb[0]
    if _lod1():
        box((L, bt, HB - 0.04), at=(0, byc, 0.04), base=True, color="caramel", tint=True)
    else:
        n = 16
        pw = L / n
        bw = pw - 0.014
        for i in range(n):
            x0 = -L / 2 + i * pw + 0.007
            h = HB if i % 2 == 0 else HB - 0.02
            board = [(x0, 0.04), (x0 + bw, 0.04), (x0 + bw, h - 0.05), (x0 + bw - 0.045, h), (x0 + 0.045, h),
                     (x0, h - 0.05)]
            extrude(board, bt, at=(0, byc, 0), rot=(90, 0, 0), color="caramel", tint=True)
    ryc, rt = yr[0] + 0.03, 0.06
    for z in (0.32, 1.4):
        box((L, rt, 0.12), at=(0, ryc, z), color="caramel", tint=True)
    pc, pt = (yr[0] + yr[1]) / 2, yr[1] - yr[0]
    for k in (-1, 1):
        box((0.05, pt, H), at=(k * (L / 2 - 0.025), pc, 0), base=True, color="caramel", tint=True)


# ---------------------------------------------------------------- houses with attached garages

@asset("house_d", "Ranch House", "Everything on one floor. Stairs are just a rumour here.", 4, "wood", "large",
       variants=["sand", "sky", "butter", "mint", "snow", "lavender"], col="box", fill=0.85)
def house_d():
    wall = "sand"
    z0, H, D = 0.3, 2.7, 7.6
    x0, x1 = -6.85, 2.2                   # main body; bbox is symmetric (+-7.32) so these are final x's
    W, cx = x1 - x0, (x0 + x1) / 2
    f = -D / 2
    box((W + 0.2, D + 0.2, z0), at=(cx, 0, 0), base=True, color="stone")
    box((W, D, H), at=(cx, 0, z0), base=True, color=wall, tint=True)
    _gable_x(W, D, z0 + H, 1.55, wall, "cocoa", over=0.45, t=0.24, c=(cx, 0))
    # attached garage on the +X end, stepped down; GARAGE DOOR CENTRED AT x = +4.6 (driveway lines up here)
    gx, GW, GD, gy, gz, GH = 4.6, 4.8, 7.0, -0.55, 0.12, 2.6
    gf = gy - GD / 2
    box((GW + 0.1, GD + 0.1, gz), at=(gx, gy, 0), base=True, color="stone")
    box((GW, GD, GH), at=(gx, gy, gz), base=True, color=wall, tint=True)
    _gable_x(GW, GD, gz + GH, 1.1, wall, "cocoa", over=0.3, t=0.22, c=(gx, gy))
    _garage_door("-y", gf, gx, gz, 3.9, 2.2)
    box((3.9, 1.2, 0.02), at=(gx, gf - 0.6, 0.0), base=True, color="charcoal", lod0=True)
    for k in (-1, 1):
        box((0.14, 0.12, 0.26), at=(gx + k * 2.18, gf - 0.08, 2.15), color="sun", lod0=True)
    _window("+x", gx + GW / 2, gy + 1.2, gz + 1.5, 1.0, 0.8, sill=False)
    # chimney on the back slope
    box((0.8, 0.8, 2.9), at=(-4.6, 1.4, 2.6), base=True, color="brick")
    box((1.0, 1.0, 0.15), at=(-4.6, 1.4, 5.5), base=True, color="stone")
    # brick wainscot across the front (split by the door)
    dx = -0.6
    for (a, b) in ((x0, dx - 0.66), (dx + 0.66, x1)):
        _panel("-y", f, (a + b) / 2, z0 + 0.32, b - a, 0.64, 0.06, "brick")
    # big three-pane picture window with shutters
    pz = z0 + 1.55
    _window("-y", f, -4.0, pz, 3.0, 1.5, shutter="slate", mull=False)
    for u in (-4.5, -3.5):
        _panel("-y", f, u, pz, 0.09, 1.5, 0.11, "snow", lod0=True)
    _window("-y", f, 1.2, z0 + 1.75, 1.0, 1.0)
    # front door + porch stoop with a little gable
    _door("-y", f, dx, z0, 1.0, 2.15, color="tomato")
    box((2.6, 1.6, z0), at=(dx, f - 0.8, 0), base=True, color="concrete")
    box((1.4, 0.45, 0.15), at=(dx, f - 1.82, 0), base=True, color="concrete")
    for k in (-1, 1):
        box((0.16, 0.16, 2.42), at=(dx + k * 1.15, f - 1.45, z0), base=True, color="snow")
    _gable_y(2.6, 1.7, 2.72, 0.6, "snow", "cocoa", over=0.15, t=0.14, wall_tint=False, c=(dx, f - 0.85))
    # sides + back
    _window("-x", x0, -1.4, z0 + 1.6, 1.2, 1.1)
    _window("-x", x0, 1.6, z0 + 1.6, 1.2, 1.1)
    for u in (-5.0, -2.0, 0.8):
        _window("+y", D / 2, u, z0 + 1.6, 1.2, 1.1)
    # foundation shrubs
    for (x, rr) in ((-6.1, 0.55), (-2.15, 0.5), (1.9, 0.45)):
        sphere(rr, at=(x, f - 0.45, rr), color="leaf", segs=8, rings=5, lod0=True)


@asset("house_e", "Colonial", "Perfectly symmetrical. The shutters have never once been shut.", 4, "stone",
       "large", variants=["butter", "snow", "sky", "sand", "mint", "bubblegum"], col="box", fill=0.85)
def house_e():
    wall = "butter"
    z0, D, H1, H2 = 0.4, 7.5, 2.9, 2.7
    H = H1 + H2
    x0, x1 = -3.0, 6.5                    # main block; bbox is symmetric (+-6.87) so these are final x's
    W, cx = x1 - x0, (x0 + x1) / 2
    f = -D / 2
    box((W + 0.2, D + 0.2, z0), at=(cx, 0, 0), base=True, color="stone")
    box((W, D, H), at=(cx, 0, z0), base=True, color=wall, tint=True)
    _gable_x(W, D, z0 + H, 2.6, wall, "slate", over=0.35, t=0.26, c=(cx, 0))
    box((W + 0.1, 0.24, 0.24), at=(cx, f - 0.08, z0 + H - 0.12), color="snow")             # cornice
    _panel("-y", f, cx, z0 + H1, W, 0.14, 0.08, "snow", lod0=True)                          # belt course
    for x in (x0 + 0.1, x1 - 0.1):
        _panel("-y", f, x, z0 + H / 2, 0.22, H, 0.07, "snow", lod0=True)                    # corner boards
    # twin end chimneys
    for x in (x0 + 0.9, x1 - 0.9):
        box((1.0, 0.7, 3.0), at=(x, 0.3, z0 + H), base=True, color="brick")
        box((1.2, 0.9, 0.18), at=(x, 0.3, z0 + H + 3.0), base=True, color="stone")
    # five-bay symmetric facade: door in the middle with fanlight + pedimented portico
    for u in (-3.75, -1.9, 1.9, 3.75):
        _shuttered("-y", f, cx + u, z0 + 1.5, 0.9, 1.45, "ink_soft")
    for u in (-3.75, -1.9, 0.0, 1.9, 3.75):
        _shuttered("-y", f, cx + u, z0 + 4.35, 0.9, 1.25, "ink_soft")
    _door("-y", f, cx, z0, 1.0, 2.1, color="tomato")
    fan = [(0.42 * math.cos(math.radians(a)), 0.42 * math.sin(math.radians(a))) for a in range(0, 181, 30)]
    extrude(fan, 0.08, at=(cx, f - 0.04, z0 + 2.2), rot=(90, 0, 0), color="glass")
    box((2.6, 1.5, z0), at=(cx, f - 0.75, 0), base=True, color="stone")
    box((1.6, 0.45, 0.2), at=(cx, f - 1.72, 0), base=True, color="stone")
    for k in (-1, 1):
        cyl(0.11, 2.2, r2=0.09, at=(cx + k * 0.95, f - 1.2, z0), color="snow", segs=8)
    box((2.3, 1.4, 0.2), at=(cx, f - 0.68, z0 + 2.2), base=True, color="snow")
    _gable_y(2.3, 1.4, z0 + 2.4, 0.5, "snow", "slate", over=0.1, t=0.12, wall_tint=False, c=(cx, f - 0.68))
    # sides + back
    for u in (-1.6, 1.6):
        for z in (z0 + 1.5, z0 + 4.35):
            _window("+x", x1, u, z, 0.9, 1.25)
            _window("+y", D / 2, cx + u * 1.6, z, 0.9, 1.25)
    # one-storey garage on the -X side, set back; GARAGE DOOR CENTRED AT x = -4.8
    gx, GW, GD, gz, GH = -4.8, 3.6, 6.6, 0.15, 3.0
    gy = f + 0.6 + GD / 2
    gf = gy - GD / 2
    box((GW + 0.1, GD + 0.1, gz), at=(gx, gy, 0), base=True, color="stone")
    box((GW, GD, GH), at=(gx, gy, gz), base=True, color=wall, tint=True)
    _gable_x(GW, GD, gz + GH, 1.3, wall, "slate", over=0.25, t=0.22, c=(gx, gy))
    _garage_door("-y", gf, gx, gz, 2.8, 2.25)
    box((2.8, 1.2, 0.02), at=(gx, gf - 0.6, 0.0), base=True, color="charcoal", lod0=True)
    _window("-x", gx - GW / 2, gy, gz + 1.6, 1.0, 0.9)
    for x in (cx - 3.0, cx + 3.0):
        sphere(0.55, at=(x, f - 0.5, 0.56), color="leaf", segs=8, rings=5, lod0=True)


@asset("house_f", "Craftsman Bungalow", "The porch is the living room from May to September.", 4, "wood", "large",
       variants=["sand", "sky", "mint", "caramel", "butter", "lavender"], col="box", fill=0.8)
def house_f():
    wall = "sand"
    z0, H, W = 0.6, 2.9, 9.2
    yb0, yb1, yp = -2.6, 5.4, -5.4        # body front, body back, porch front
    D, cyb = yb1 - yb0, (yb0 + yb1) / 2
    box((W + 0.2, D + 0.2, z0), at=(0, cyb, 0), base=True, color="stone")
    box((W, D, H), at=(0, cyb, z0), base=True, color=wall, tint=True)
    # one low, wide side-gabled roof sweeps down over the deep porch
    _gable_x(W, yb1 - yp, z0 + H, 2.6, wall, "pine", over=0.4, t=0.26, c=(0, (yp + yb1) / 2))
    # porch deck, steps, stone piers with tapered columns, beam
    box((W + 0.1, yb0 - yp, z0), at=(0, (yp + yb0) / 2, 0), base=True, color="stone")
    box((W - 0.1, yb0 - yp - 0.1, 0.04), at=(0, (yp + yb0) / 2, z0), base=True, color="caramel", lod0=True)
    box((2.2, 0.4, 0.4), at=(0, yp - 0.2, 0), base=True, color="stone")
    box((2.2, 0.4, 0.2), at=(0, yp - 0.6, 0), base=True, color="stone")
    cy = yp + 0.4
    for x in (-4.25, -1.4, 1.4, 4.25):
        box((0.75, 0.75, 0.95), at=(x, cy, z0), base=True, color="stone", bevel=0.04)
        box((0.56, 0.56, H - 0.95 - 0.38), at=(x, cy, z0 + 0.95), base=True, taper=(0.6, 0.6), color="paper")
    box((W + 0.2, 0.42, 0.38), at=(0, cy, z0 + H - 0.38), base=True, color="paper")
    for (a, b) in ((-4.25, -1.4), (1.4, 4.25)):
        box((b - a, 0.3, 0.7), at=((a + b) / 2, cy, z0), base=True, color="stone", lod0=True)
    # front wall under the porch
    _door("-y", yb0, 0, z0, 1.05, 2.15, color="cocoa", knob="sun")
    for i in range(3):
        _panel("-y", yb0, -0.3 + i * 0.3, z0 + 1.75, 0.2, 0.35, 0.12, "glass", lod0=True)
    for x in (-2.8, 2.8):
        _window("-y", yb0, x, z0 + 1.55, 1.8, 1.4)
    # gabled dormer on the front slope
    dy0, dy1 = -3.7, -0.6
    box((3.4, dy1 - dy0, 1.75), at=(0, (dy0 + dy1) / 2, 3.95), base=True, color=wall, tint=True)
    _gable_y(3.4, dy1 - dy0, 5.7, 0.5, wall, "pine", over=0.22, t=0.18, c=(0, (dy0 + dy1) / 2))
    _panel("-y", dy0, 0, 5.12, 2.7, 0.78, 0.05, "snow", lod0=True)
    _panel("-y", dy0, 0, 5.12, 2.5, 0.62, 0.08, "glass")
    for u in (-0.42, 0.42):
        _panel("-y", dy0, u, 5.12, 0.08, 0.62, 0.1, "snow", lod0=True)
    # chimney, gable vents, side + back windows
    box((0.9, 0.9, 3.0), at=(-2.8, 2.8, 3.6), base=True, color="brick")
    box((1.1, 1.1, 0.15), at=(-2.8, 2.8, 6.6), base=True, color="stone")
    for s, sd in ((-1, "-x"), (1, "+x")):
        _panel(sd, s * W / 2, 0, z0 + H + 1.2, 1.2, 0.7, 0.05, "paper", lod0=True)
        for u in (0.0, 3.2):
            _window(sd, s * W / 2, u, z0 + 1.55, 1.2, 1.2)
    for x in (-2.5, 2.5):
        _window("+y", yb1, x, z0 + 1.55, 1.2, 1.2)
    for s, c in ((-1, "flamingo"), (1, "sun")):
        for x in (1.75, 2.65, 3.55):
            sphere(0.42, at=(s * x, yp - 0.35, 0.36), scale=(1.15, 0.9, 0.85), color="leaf", segs=8, rings=5,
                   lod0=True)
        sphere(0.11, at=(s * 2.6, yp - 0.72, 0.55), color=c, segs=6, rings=4, lod0=True)


# ---------------------------------------------------------------- civic & commercial

@asset("school_building", "Elementary School", "Smells of crayons and floor polish. The clock is always slow.", 4,
       "stone", "landmark", col="box", fill=0.75)
def school_building():
    # Big colour bands, few edges: at 56 m wide anything under ~1 m turns into outline.
    z0, H = 0.2, 4.6
    # front classroom bar (front facade at y = -8)
    box((55.4, 8.4, z0), at=(0, -4, 0), base=True, color="concrete")
    box((55.0, 8.0, H), at=(0, -4, z0), base=True, color="brick")
    box((55.3, 8.3, 0.6), at=(0, -4, z0 + H - 0.25), base=True, color="concrete")

    def ribbon(side, wall, u, w=4.8):
        """One classroom's ribbon window: glass band, aluminium frame, two mullions."""
        _panel(side, wall, u, z0 + 2.2, w + 0.3, 2.1, 0.05, "cloud", lod0=True)
        _panel(side, wall, u, z0 + 2.2, w, 1.8, 0.09, "glass")
        for d in (-w / 6, w / 6):
            _panel(side, wall, u + d, z0 + 2.2, 0.12, 1.8, 0.12, "cloud", lod0=True)

    for s in (-1, 1):
        for c in (10.0, 16.5, 23.0):
            ribbon("-y", -8.0, s * c)
        ribbon("+x" if s > 0 else "-x", s * 27.5, -4.0, w=4.4)
    # classroom wings at the back corners + the gym in the middle
    for s in (-1, 1):
        wx = s * 23.0
        box((9.0, 7.4, H), at=(wx, 3.5, z0), base=True, color="brick")
        box((9.3, 7.7, 0.35), at=(wx, 3.5, z0 + H), base=True, color="concrete")
        ribbon("+x" if s > 0 else "-x", s * 27.5, 3.5, w=4.4)
        ribbon("+y", 7.2, wx, w=5.0)
    box((18.0, 9.5, 6.4), at=(0, 4.75, z0), base=True, color="brick")
    box((18.3, 9.8, 0.35), at=(0, 4.75, z0 + 6.4), base=True, color="concrete")
    _panel("-y", 0.0, 0, z0 + 5.65, 14.0, 1.0, 0.08, "glass")                       # gym clerestory
    for u in (-2.35, 2.35):
        _panel("-y", 0.0, u, z0 + 5.65, 0.15, 1.0, 0.11, "cloud", lod0=True)
    for s, sd in ((-1, "-x"), (1, "+x")):
        _panel(sd, s * 9.0, 4.8, z0 + 5.4, 6.0, 1.0, 0.08, "glass")
    _panel("+y", 9.5, 0, z0 + 1.2, 3.0, 2.4, 0.08, "charcoal", lod0=True)
    # entrance block: concrete, projects 1 m, taller; glass doors under the canopy, clock above
    box((12.0, 9.0, 5.8), at=(0, -4.5, z0), base=True, color="concrete")
    box((12.3, 9.3, 0.35), at=(0, -4.5, z0 + 5.8), base=True, color="stone")
    _panel("-y", -9.0, 0, z0 + 1.3, 4.3, 2.75, 0.05, "cloud", lod0=True)
    _panel("-y", -9.0, 0, z0 + 1.25, 4.0, 2.5, 0.09, "glass")
    _panel("-y", -9.0, 0, z0 + 1.25, 0.14, 2.5, 0.12, "cloud", lod0=True)
    cz = 5.05
    cyl(0.95, 0.1, at=(0, -9.03, cz), rot=(90, 0, 0), base=False, color="stone", segs=16)
    cyl(0.8, 0.08, at=(0, -9.1, cz), rot=(90, 0, 0), base=False, color="paper", segs=16)
    box((0.1, 0.04, 0.6), at=(0, -9.15, cz + 0.26), color="ink", lod0=True)
    box((0.45, 0.04, 0.1), at=(0.2, -9.15, cz - 0.08), rot=(0, 20, 0), color="ink", lod0=True)
    # entrance canopy; its front edge is the sign band
    box((10.4, 3.4, 0.35), at=(0, -10.7, 3.3), base=True, color="cobalt")
    box((10.6, 0.3, 1.1), at=(0, -12.4, 3.0), base=True, color="sun")
    _panel("-y", -12.55, 0, 3.55, 6.5, 0.45, 0.03, "cobalt", lod0=True)
    for x in (-4.6, 4.6):
        cyl(0.22, 3.3, at=(x, -11.9, 0), color="stone", segs=10)
    # rooftop units
    for (x, y, z, hgt) in ((-17.0, -4.5, z0 + H + 0.35, 1.0), (17.0, -3.5, z0 + H + 0.35, 1.0),
                           (0.0, 5.5, z0 + 6.75, 0.6)):
        box((3.0, 2.0, hgt), at=(x, y, z), base=True, bevel=0.06, color="cloud")
        cyl(0.6, 0.08, at=(x + 0.6, y, z + hgt), color="ink_soft", segs=10, lod0=True)


@asset("flagpole", "Flagpole", "Waves at everyone all day and never gets tired.", 4, "metal", "small",
       variants=["tomato", "cobalt", "leaf", "sun"], col="cyl", fill=0.05)
def flagpole():
    box((0.6, 0.6, 0.3), base=True, bevel=0.04, color="concrete")
    cyl(0.065, 8.6, r2=0.04, at=(0, 0, 0.3), color="cloud", segs=8)
    sphere(0.11, at=(0, 0, 8.98), color="sun", segs=8, rings=5)
    cyl(0.02, 0.4, at=(0.06, 0, 1.2), color="stone", segs=4, lod0=True)
    tube([(0.06, -0.01, 1.4), (0.06, -0.01, 8.85)], 0.008, color="stone", segs=3, lod0=True)
    # the flag: a strip of panels in a gentle wave, hoisted at the top, flying towards +X
    n = 4 if _lod1() else 7
    L, Hf, z1 = 1.3, 0.85, 8.85
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((0.05 + L * t, 0.09 * math.sin(t * math.pi * 1.6) * t, z1 - Hf / 2 - 0.06 * t * t))
    for a, b in zip(pts[:-1], pts[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        seg = math.hypot(dx, dy)
        box((seg + 0.01, 0.03, Hf), at=((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2),
            rot=(0, 0, math.degrees(math.atan2(dy, dx))), color="tomato", tint=True)
    extrude(star_points(5, 0.14, 0.06), 0.05, at=(0.32, pts[2][1] * 0.5, z1 - 0.3), rot=(90, 0, 0), color="snow",
            lod0=True)


@asset("strip_mall", "Strip Mall", "Nail salon, pizza, tax advice and a shop that only sells candles.", 4, "stone",
       "landmark", col="box", fill=0.8)
def strip_mall():
    # Big colour bands, few edges (see school_building).
    L, z0, H = 44.0, 0.15, 4.4
    yf, yb = -4.0, 6.0
    D, cy = yb - yf, (yf + yb) / 2
    box((L + 0.8, 3.8, z0), at=(0, yf - 1.8, 0), base=True, color="concrete")           # walkway slab
    box((L, D, H), at=(0, cy, z0), base=True, color="sand")
    box((L + 0.1, D + 0.1, 0.12), at=(0, cy, z0 + H), base=True, color="stone")         # roof membrane
    # front parapet with a raised centre
    zt = z0 + H
    box((L, 0.45, 1.05), at=(0, yf + 0.22, zt), base=True, color="sand")
    box((L + 0.3, 0.7, 0.2), at=(0, yf + 0.22, zt + 1.05), base=True, color="cloud")
    box((10.0, 0.6, 0.75), at=(0, yf + 0.28, zt + 1.25), base=True, color="sand")
    box((10.4, 0.85, 0.2), at=(0, yf + 0.28, zt + 2.0), base=True, color="cloud")
    # four shops: one big glass front each, a door, a tall coloured sign band, a matching awning
    shops = (("tomato", -16.5), ("cobalt", -5.5), ("leaf", 5.5), ("grape", 16.5))
    for (c, x) in shops:
        _panel("-y", yf, x, z0 + 1.6, 8.6, 2.6, 0.08, "glass")
        _panel("-y", yf, x + 3.1, z0 + 1.3, 1.4, 2.5, 0.11, "charcoal", lod0=True)
        _panel("-y", yf, x + 3.1, z0 + 1.25, 1.0, 2.2, 0.13, "glass", lod0=True)
        _panel("-y", yf, x, 4.3, 9.4, 1.5, 0.2, c)
        box((10.4, 1.15, 0.08), at=(x, yf - 3.85, 2.78), rot=(24, 0, 0), color=c)
    # covered walkway: roof slab with a deep fascia, columns
    box((L, 3.3, 0.35), at=(0, yf - 1.65, 3.05), base=True, color="cloud")
    box((L + 0.1, 0.3, 0.55), at=(0, yf - 3.3, 2.85), base=True, color="cloud")
    for x in (-21.75, -11.0, 0.0, 11.0, 21.75):
        box((0.45, 0.45, 2.75), at=(x, yf - 3.0, z0), base=True, color="sand")
    # back: service doors; roof: units
    for (c, x) in shops:
        _panel("+y", yb, x + 2.5, z0 + 1.1, 1.2, 2.2, 0.08, "charcoal", lod0=True)
    for (x, y) in ((-14.0, 2.0), (2.0, 1.5), (15.0, 2.5)):
        box((3.0, 2.0, 0.9), at=(x, y, zt + 0.12), base=True, bevel=0.06, color="cloud")
        cyl(0.6, 0.08, at=(x + 0.6, y, zt + 1.02), color="ink_soft", segs=10, lod0=True)


# ---------------------------------------------------------------- pedestrians (same peg build as l3 people)

_PED_FLAGS = ["creature", "wander", "flee"]


@asset("person_jogger", "Jogger", "Training for a marathon. Has been training since 2016.", 4, "living", "medium",
       variants=["tomato", "lime", "flamingo", "sky", "sun", "teal"], col="cyl", flags=_PED_FLAGS, fill=0.45)
def person_jogger():
    skin, top, shorts, shoes = "skin3", "tomato", "ink_soft", "snow"
    hz, hr, hip, br = 1.47, 0.27, 0.66, 0.24
    lean = 9.0
    sl = math.sin(math.radians(lean))
    lx, lr = br * 0.45, br * 0.34
    sz = hz - hr * 0.8
    z0 = hip - 0.05
    # legs mid-stride: left forward, right kicked back
    for k, path in ((-1, [(0, -0.02, hip), (0, -0.27, 0.46), (0, -0.24, 0.16)]),
                    (1, [(0, 0.03, hip), (0, 0.1, 0.3), (0, 0.3, 0.42)])):
        p = [(k * lx, y, z) for (_, y, z) in path]
        tube(p, lr, color=skin, segs=6)
        tube([p[0], (p[0][0] + (p[1][0] - p[0][0]) * 0.55, p[0][1] + (p[1][1] - p[0][1]) * 0.55,
                     p[0][2] + (p[1][2] - p[0][2]) * 0.55)], lr * 1.35, color=shorts, segs=7, lod0=True)
        sphere(lr * 1.3, at=(p[2][0], p[2][1] - lr * 0.5, p[2][2] - lr * 0.2), scale=(1, 1.5, 0.65),
               rot=(-20 if k > 0 else 0, 0, 0), color=shoes, segs=7, rings=4)
    sphere(br * 0.92, at=(0, 0.0, z0 + 0.06), scale=(1, 0.85, 0.6), color=shorts, segs=8, rings=5, lod0=True)
    _torso(top, True, z0, sz, br, lean=lean)
    # arms pumping, opposite to the legs
    T = sz - z0
    shz = sz - T * 0.16
    shy = -(shz - z0) * sl
    _arm([(br * 0.72, shy, shz), (br * 1.05, shy - 0.14, shz - 0.24), (br * 0.9, shy - 0.3, shz - 0.08)],
         br * 0.2, top, True, skin, br * 0.25)
    _arm([(-br * 0.72, shy, shz), (-br * 1.05, shy + 0.16, shz - 0.22), (-br * 1.0, shy + 0.06, shz - 0.42)],
         br * 0.2, top, True, skin, br * 0.25)
    hy = -(hz - z0) * sl
    _head(hz, hr, skin, hy=hy)
    _hair(hz, hr, "cocoa", tilt=-30, cover=-5, at=(0, hy))
    # ponytail mid-swing, out to the side so it shows in silhouette
    tube([(0.02, hy + hr * 0.85, hz + hr * 0.35), (hr * 0.45, hy + hr * 1.15, hz + hr * 0.1),
          (hr * 0.85, hy + hr * 1.2, hz - hr * 0.25)], hr * 0.2, r_end=hr * 0.1, color="cocoa", segs=6)
    torus(hr * 1.03, hr * 0.13, at=(0, hy, hz + hr * 0.38), rot=(-14, 0, 0), color="snow", segs=12, rsegs=4)


@asset("person_business", "Business Person", "Late for a meeting that could have been an email.", 4, "living",
       "medium", variants=["navy", "charcoal", "slate", "cocoa", "ink_soft"], col="cyl", flags=_PED_FLAGS,
       fill=0.45)
def person_business():
    skin, suit = "skin1", "navy"
    hz, hr, hip, br = 1.44, 0.27, 0.66, 0.25
    sz = hz - hr * 0.8
    z0 = hip - 0.05
    T = sz - z0
    lx, lr = br * 0.45, br * 0.34
    _straight_legs(lx, lr, hip, suit, "ink", tint=True)
    _torso(suit, True, z0, sz, br)
    # shirt V + tie
    extrude([(-0.09, 0), (0.09, 0), (0, -0.3)], 0.04, at=(0, -br * 0.78, sz - 0.02), rot=(90, 0, 0), color="snow")
    extrude([(-0.03, 0), (0.03, 0), (0.045, -0.26), (0, -0.32), (-0.045, -0.26)], 0.03,
            at=(0, -br * 0.84, sz - 0.04), rot=(84, 0, 0), color="tomato")
    hands = []
    for k in (-1, 1):
        sh = (k * br * 0.72, 0, sz - T * 0.16)
        el = (k * br * 1.1, 0.0, sz - T * 0.42)
        hd = (k * br * 1.28, -0.02, z0 + T * 0.3)
        _arm([sh, el, hd], br * 0.21, suit, True, skin, br * 0.25)
        hands.append(hd)
    # briefcase in the right hand, coffee in the left
    hx, hy, hzz = hands[1]
    box((0.1, 0.4, 0.3), at=(hx + 0.03, hy, hzz - 0.08), base=False, bevel=0.02, color="cocoa")
    box((0.11, 0.41, 0.03), at=(hx + 0.03, hy, hzz - 0.02), color="sun", lod0=True)
    torus(0.06, 0.015, at=(hx + 0.03, hy, hzz + 0.07), rot=(90, 0, 90), color="ink", segs=8, rsegs=3, arc=180, lod0=True)
    cx, cy, cz = hands[0]
    cyl(0.045, 0.14, r2=0.055, at=(cx - 0.02, cy - 0.06, cz - 0.02), color="snow", segs=8)
    cyl(0.057, 0.03, at=(cx - 0.02, cy - 0.06, cz + 0.12), color="ink_soft", segs=8, lod0=True)
    _head(hz, hr, skin)
    _hair(hz, hr, "cocoa", tilt=-40, cover=-8)
    sphere(hr * 0.5, at=(hr * 0.35, -hr * 0.55, hz + hr * 0.72), scale=(1.6, 0.9, 0.6), rot=(0, -20, 0),
           color="cocoa", segs=6, rings=4)


@asset("person_teen", "Teenager", "Communicates exclusively in shrugs. Phone at 4%.", 4, "living", "medium",
       variants=["grape", "flamingo", "sky", "pine", "tomato", "lime"], col="cyl", flags=_PED_FLAGS, fill=0.45)
def person_teen():
    skin, hood = "skin2", "grape"
    hz, hr, hip, br = 1.36, 0.27, 0.64, 0.25
    sz = hz - hr * 0.8
    z0 = hip - 0.05
    T = sz - z0
    lx, lr = br * 0.45, br * 0.36
    _straight_legs(lx, lr, hip, "navy", "snow")
    prof = [(0, 0), (br * 0.95, 0), (br * 1.05, T * 0.2), (br * 1.02, T * 0.56), (br * 0.84, T * 0.86),
            (br * 0.45, T), (0, T)]
    lathe(prof, at=(0, 0, z0 - 0.04), color=hood, tint=True, segs=10)
    # hood bunched behind the neck, front pocket, drawstrings
    sphere(hr * 0.8, at=(0, hr * 0.55, sz + 0.02), scale=(1.15, 0.8, 0.6), color=hood, tint=True, segs=8, rings=5)
    for k in (-1, 1):
        tube([(k * 0.04, -br * 0.6, sz - 0.02), (k * 0.05, -br * 0.95, sz - 0.16)], 0.008, color="snow", segs=3,
             lod0=True)
    # backpack on the back (+Y), straps over the shoulders
    box((br * 1.5, 0.17, T * 0.75), at=(0, br * 0.9 + 0.06, z0 + T * 0.5), bevel=0.05, color="sun")
    box((br * 1.2, 0.06, T * 0.3), at=(0, br * 0.9 + 0.15, z0 + T * 0.32), bevel=0.02, color="sun", lod0=True)
    for k in (-1, 1):
        tube([(k * br * 0.45, br * 0.9, sz - 0.02), (k * br * 0.5, -br * 0.4, sz - 0.04),
              (k * br * 0.55, -br * 0.85, sz - T * 0.45)], 0.022, color="ink_soft", segs=4, lod0=True)
    # left arm hangs, right arm holds the phone up at chest height, screen tilted towards the face
    _arm([(-br * 0.72, 0, sz - T * 0.16), (-br * 1.12, 0.02, sz - T * 0.45), (-br * 1.3, 0.0, z0 + T * 0.32)],
         br * 0.22, hood, True, skin, br * 0.25)
    ph = (br * 0.4, -br * 1.08, sz - T * 0.36)
    _arm([(br * 0.72, 0, sz - T * 0.16), (br * 1.15, -0.06, sz - T * 0.6), ph], br * 0.22, hood, True, skin,
         br * 0.25)
    box((0.09, 0.02, 0.16), at=(ph[0] - 0.03, ph[1] - 0.03, ph[2] + 0.07), rot=(-25, 0, 0), color="ink")
    box((0.07, 0.01, 0.13), at=(ph[0] - 0.03, ph[1] - 0.018, ph[2] + 0.075), rot=(-25, 0, 0), color="glass",
        lod0=True)
    _head(hz, hr, skin, look=0.25)
    _hair(hz, hr, "cocoa", tilt=-22, cover=-12)
    for (x, z) in ((-0.1, 0.92), (0.05, 0.98), (0.17, 0.88)):
        sphere(hr * 0.24, at=(x, -hr * 0.62, hz + hr * z * 0.62), color="cocoa", segs=6, rings=4, lod0=True)


# ---------------------------------------------------------------- critters

@asset("pigeon", "Pigeon", "Eats chips, fears nothing, owns the pavement.", 4, "living", "tiny", col="sphere",
       flags=["creature", "flee"], fill=0.5)
def pigeon():
    # long axis along X, head at +X (0.32 x 0.28 x 0.18). Tiny budget: eyes, feet, wing bars are LOD0-only.
    sphere(0.095, at=(-0.015, 0, 0.13), scale=(1.3, 0.88, 0.85), color="stone", segs=6, rings=5)
    extrude([(-0.11, 0.12), (-0.155, 0.15), (-0.155, 0.1)], 0.07, rot=(90, 0, 0), color="ink_soft")
    sphere(0.056, at=(0.095, 0, 0.215), color="stone", segs=7, rings=4)
    sphere(0.048, at=(0.07, 0, 0.175), scale=(1, 1.2, 0.9), color="lavender", segs=5, rings=3, lod0=True)
    cyl(0.017, 0.035, r2=0.004, at=(0.142, 0, 0.21), rot=(0, 95, 0), color="ink_soft", segs=4)
    for k in (-1, 1):
        sphere(0.012, at=(0.11, k * 0.045, 0.232), scale=(1.1, 0.6, 1.2), color="ink", segs=5, rings=3, lod0=True)
        box((0.018, 0.018, 0.06), at=(0.0, k * 0.03, 0.0), base=True, color="bubblegum", lod0=True)
        box((0.055, 0.03, 0.012), at=(0.015, k * 0.03, 0.0), base=True, color="bubblegum", lod0=True)
        box((0.07, 0.012, 0.02), at=(-0.06, k * 0.083, 0.132), rot=(0, -10, 0), color="ink", lod0=True)


@asset("duck", "Duck", "Paddles like mad under the water. Above it, total calm.", 4, "living", "tiny", col="sphere",
       variants=["leaf", "cocoa", "snow"], flags=["creature", "flee"], fill=0.5)
def duck():
    # a swimming mallard, long axis along X, head at +X (0.6 x 0.25 x 0.35); sits at the waterline
    sphere(0.13, at=(-0.02, 0, 0.09), scale=(1.75, 1.0, 0.75), color="stone", segs=6, rings=4)
    extrude([(-0.2, 0.1), (-0.3, 0.17), (-0.25, 0.08)], 0.12, rot=(90, 0, 0), color="ink_soft", lod0=True)
    for k in (-1, 1):
        box((0.26, 0.03, 0.08), at=(-0.04, k * 0.1, 0.1), rot=(0, -12, 0), color="cocoa", lod0=True)
        box((0.008, 0.012, 0.012), at=(0.25, k * 0.05, 0.29), color="ink", lod0=True)
    sphere(0.072, at=(0.19, 0, 0.27), color="leaf", tint=True, segs=5, rings=3)
    box((0.04, 0.06, 0.08), at=(0.15, 0, 0.17), color="snow", lod0=True)
    box((0.09, 0.05, 0.025), at=(0.28, 0, 0.255), color="sun")


# ---------------------------------------------------------------- vehicles (nose at +X)

@asset("taxi", "Taxi", "Knows a shortcut. The shortcut is longer.", 4, "metal", "large", col="box", fill=0.65)
def taxi():
    L = 4.4
    _sedan(L, "sun")
    box((0.9, 0.34, 0.3), at=(-0.2, 0, 1.66), base=True, bevel=0.04, color="snow")
    box((0.94, 0.38, 0.06), at=(-0.2, 0, 1.94), base=True, color="sun")
    for k in (-1, 1):
        for i in range(4):
            _panel("-y" if k < 0 else "+y", k * 0.17, -0.5 + i * 0.2, 1.81, 0.12, 0.14, 0.01, "ink", lod0=True)
    # chequer band along both flanks
    for k in (-1, 1):
        sd = "-y" if k < 0 else "+y"
        _panel(sd, k * 0.9, -0.1, 0.66, 3.4, 0.26, 0.02, "snow")
        if not _lod1():
            n, sq = 20, 3.4 / 20
            for i in range(n):
                for row in (0, 1):
                    if (i + row) % 2 == 0:
                        _panel(sd, k * 0.9, -1.8 + sq * (i + 0.5), 0.66 + (row - 0.5) * 0.13, sq, 0.13, 0.03, "ink")
        else:
            _panel(sd, k * 0.9, -0.1, 0.66, 3.4, 0.08, 0.03, "ink")


@asset("police_car", "Police Car", "Parks wherever it likes. Very polite about it.", 4, "metal", "large", col="box",
       fill=0.65)
def police_car():
    L = 4.5
    _sedan(L, "navy")
    box((1.9, 1.84, 0.6), at=(-0.15, 0, 0.36), base=True, color="snow")
    box((0.42, 1.46, 0.12), at=(-0.25, 0, 1.66), base=True, color="charcoal")
    for k, c in ((1, "tomato"), (-1, "cobalt")):
        box((0.36, 0.62, 0.17), at=(-0.25, k * 0.34, 1.72), base=True, bevel=0.04, color=c)
    for k in (-1, 1):
        extrude(star_points(5, 0.18, 0.08), 0.03, at=(-0.15, k * 0.93, 0.7), rot=(90, 0, 0 if k < 0 else 180),
                color="sun", lod0=True)
    # push bar on the nose
    for k in (-1, 1):
        box((0.08, 0.08, 0.5), at=(L / 2 + 0.05, k * 0.45, 0.3), base=True, color="ink_soft", lod0=True)
    box((0.08, 1.0, 0.08), at=(L / 2 + 0.05, 0, 0.72), color="ink_soft", lod0=True)
    tube([(-1.5, 0.5, 1.0), (-1.75, 0.5, 1.9)], 0.012, color="ink_soft", segs=4, lod0=True)


@asset("ambulance", "Ambulance", "Arrives fast, fixes scraped knees, never asks how it happened.", 4, "metal",
       "large", col="box", fill=0.75)
def ambulance():
    r, wy = 0.45, 0.88
    _wheels((-1.8, 1.95), wy, r, r, 0.36)
    box((5.7, 1.7, 0.32), at=(-0.05, 0, 0.42), base=True, color="charcoal")
    # rear box module + cab + short hood
    box((3.9, 2.3, 2.55), at=(-1.0, 0, 0.6), base=True, bevel=0.12, color="snow")
    box((1.5, 2.1, 1.95), at=(1.7, 0, 0.5), base=True, bevel=0.22, color="snow")
    box((0.6, 2.0, 0.85), at=(2.6, 0, 0.5), base=True, bevel=0.2, color="snow")
    _panel("+x", 2.45, 0, 1.95, 1.8, 0.75, 0.06, "glass", off=-0.05)
    box((1.0, 2.12, 0.7), at=(1.75, 0, 1.95), color="glass")
    # stripe: one tomato band right round
    box((3.92, 2.32, 0.3), at=(-1.0, 0, 1.05), base=True, color="tomato")
    box((1.52, 2.12, 0.3), at=(1.7, 0, 1.05), base=True, color="tomato")
    box((0.62, 2.02, 0.2), at=(2.6, 0, 1.05), base=True, color="tomato")
    # crosses on the flanks and the back
    for sd, wall in (("-y", -1.15), ("+y", 1.15)):
        _panel(sd, wall, -1.15, 2.2, 0.85, 0.28, 0.03, "tomato")
        _panel(sd, wall, -1.15, 2.2, 0.28, 0.85, 0.03, "tomato")
    _panel("-x", -2.95, 0, 2.55, 0.6, 0.2, 0.03, "tomato", lod0=True)
    _panel("-x", -2.95, 0, 2.55, 0.2, 0.6, 0.03, "tomato", lod0=True)
    for u in (-0.5, 0.5):
        _panel("-x", -2.95, u, 1.7, 0.92, 2.0, 0.02, "cloud", lod0=True)
        _panel("-x", -2.95, u, 2.15, 0.6, 0.5, 0.03, "glass", lod0=True)
    # light bar on the cab, corner beacons on the box
    box((0.36, 1.7, 0.18), at=(1.65, 0, 2.45), base=True, bevel=0.04, color="tomato")
    box((0.38, 0.4, 0.2), at=(1.65, 0, 2.45), base=True, color="snow", lod0=True)
    for x in (-2.75, 0.75):
        for k in (-1, 1):
            box((0.2, 0.2, 0.14), at=(x, k * 0.98, 3.15), base=True, color="tomato", lod0=True)
    for x in (3.0, -3.05):
        box((0.2, 2.04, 0.28), at=(x, 0, 0.45), base=True, bevel=0.08, color="cloud")
    for k in (-1, 1):
        sphere(0.15, at=(2.88, k * 0.7, 1.0), scale=(0.45, 1, 0.9), color="butter", segs=8, rings=5)
        box((0.06, 0.2, 0.3), at=(-2.98, k * 0.95, 1.0), color="tomato")
        box((0.25, 0.1, 0.25), at=(2.15, k * 1.12, 2.0), base=True, color="snow", lod0=True)


@asset("suv", "SUV", "Seven seats. Mostly carries one person to the gym.", 4, "metal", "large",
       variants=["snow", "charcoal", "navy", "tomato", "pine", "sky", "slate"], col="box", fill=0.65)
def suv():
    col = "slate"
    r, wy = 0.46, 0.83
    _wheels((-1.5, 1.5), wy, r, r, 0.34)
    box((4.5, 1.92, 0.95), at=(0, 0, 0.36), base=True, bevel=0.26, color=col, tint=True)
    box((3.0, 1.8, 0.58), at=(-0.35, 0, 1.24), base=True, taper=(0.92, 0.86), bevel=0.1, color="glass")
    box((2.8, 1.6, 0.13), at=(-0.4, 0, 1.8), base=True, bevel=0.05, color=col, tint=True)
    for x in (0.25, -1.05):
        box((0.16, 1.82, 0.56), at=(x, 0, 1.26), base=True, taper=(1, 0.86), color=col, tint=True)
    for k in (-1, 1):
        box((2.5, 0.07, 0.06), at=(-0.4, k * 0.64, 1.93), base=True, color="ink_soft", lod0=True)
        sd = "-y" if k < 0 else "+y"
        _panel(sd, k * 0.96, -0.4, 0.85, 0.04, 0.55, 0.02, "ink_soft", lod0=True)
        _panel(sd, k * 0.96, 0, 0.42, 3.6, 0.14, 0.04, "charcoal", lod0=True)
        sphere(0.16, at=(2.2, k * 0.62, 1.0), scale=(0.45, 1.1, 0.75), color="butter", segs=10, rings=5)
        box((0.08, 0.2, 0.32), at=(-2.22, k * 0.72, 1.05), bevel=0.03, color="tomato")
        sphere(0.09, at=(1.0, k * 1.0, 1.3), scale=(1.3, 0.6, 0.8), color=col, tint=True, segs=6, rings=4,
               lod0=True)
    for x in (2.3, -2.3):
        box((0.22, 1.9, 0.32), at=(x, 0, 0.32), base=True, bevel=0.08, color="charcoal")
    box((0.06, 1.0, 0.3), at=(2.26, 0, 0.82), color="ink_soft", lod0=True)


@asset("hatchback", "Hatchback", "Small outside, surprisingly roomy inside. Like a handbag.", 4, "metal", "large",
       variants=["sun", "tomato", "mint", "sky", "flamingo", "lime", "lavender"], col="box", fill=0.65)
def hatchback():
    col = "mint"
    r, wy = 0.36, 0.72
    _wheels((-1.2, 1.2), wy, r, r, 0.3)
    box((3.6, 1.72, 0.66), at=(0, 0, 0.26), base=True, bevel=0.24, color=col, tint=True)
    extrude([(-1.74, 0.86), (0.78, 0.86), (0.1, 1.42), (-1.48, 1.46), (-1.7, 1.18)], 1.56, rot=(90, 0, 0),
            color="glass")
    extrude([(0.08, 1.4), (0.2, 1.4), (0.08, 1.5), (-1.5, 1.54), (-1.62, 1.44), (-1.48, 1.42)], 1.42,
            rot=(90, 0, 0), color=col, tint=True)
    box((0.14, 1.6, 0.6), at=(-0.35, 0, 0.88), base=True, taper=(1, 0.88), color=col, tint=True)
    for x in (1.85, -1.85):
        box((0.2, 1.66, 0.24), at=(x, 0, 0.24), base=True, bevel=0.08, color="cloud")
    for k in (-1, 1):
        sphere(0.13, at=(1.72, k * 0.55, 0.7), scale=(0.45, 1.1, 0.9), color="butter", segs=10, rings=5)
        box((0.08, 0.18, 0.2), at=(-1.74, k * 0.62, 0.86), bevel=0.03, color="tomato")
        _panel("-y" if k < 0 else "+y", k * 0.86, -0.1, 0.62, 0.04, 0.48, 0.02, "ink_soft", lod0=True)
        sphere(0.07, at=(0.55, k * 0.88, 0.98), scale=(1.3, 0.6, 0.8), color=col, tint=True, segs=6, rings=4,
               lod0=True)
    box((0.06, 0.8, 0.16), at=(1.82, 0, 0.55), color="ink_soft", lod0=True)


@asset("mail_truck", "Mail Truck", "Neither rain nor snow nor a giant lint ball shall stay this courier.", 4,
       "metal", "large", col="box", fill=0.75)
def mail_truck():
    r, wy = 0.38, 0.82
    _wheels((-1.4, 1.35), wy, r, r, 0.3)
    box((3.25, 1.9, 2.1), at=(-0.625, 0, 0.45), base=True, bevel=0.15, color="snow")
    box((1.15, 1.8, 0.95), at=(1.575, 0, 0.45), base=True, bevel=0.22, taper=(0.8, 1), color="snow")
    _panel("+x", 1.0, 0, 1.95, 1.7, 0.85, 0.06, "glass")
    # stripes: cobalt under tomato, right round
    box((3.27, 1.92, 0.22), at=(-0.625, 0, 1.02), base=True, color="cobalt")
    box((3.27, 1.92, 0.1), at=(-0.625, 0, 1.26), base=True, color="tomato")
    box((1.17, 1.82, 0.22), at=(1.575, 0, 1.02), base=True, color="cobalt", taper=(0.95, 1))
    # driver sits on the right (-Y): open sliding door; left side window
    _panel("-y", -0.95, 0.5, 1.6, 0.9, 1.9, 0.03, "ink_soft")
    _panel("-y", -0.95, 0.5, 2.05, 0.7, 0.55, 0.04, "glass", lod0=True)
    _panel("+y", 0.95, 0.5, 2.0, 0.8, 0.7, 0.03, "glass")
    for sd, wall in (("-y", -0.95), ("+y", 0.95)):
        _panel(sd, wall, -1.2, 1.9, 0.62, 0.62, 0.03, "cobalt", lod0=True)
        _panel(sd, wall, -1.2, 1.9, 0.42, 0.18, 0.04, "snow", lod0=True)
    for x in (2.2, -2.3):
        box((0.2, 1.84, 0.26), at=(x, 0, 0.4), base=True, bevel=0.08, color="charcoal")
    for k in (-1, 1):
        cyl(0.13, 0.06, at=(2.13, k * 0.6, 1.05), rot=(0, 90, 0), base=False, color="butter", segs=10)
        box((0.06, 0.18, 0.3), at=(-2.27, k * 0.8, 1.2), color="tomato")
        box((0.08, 0.1, 0.3), at=(1.05, k * 1.02, 1.9), color="ink_soft", lod0=True)
    box((1.2, 0.5, 0.06), at=(-1.2, 0, 2.55), base=True, color="cloud", lod0=True)


@asset("street_sign", "Street Sign", "Tells you exactly where you are. You are still lost.", 4, "metal", "small",
       col="cyl", fill=0.05)
def street_sign():
    cyl(0.1, 0.06, color="stone", segs=8)
    cyl(0.045, 3.05, color="stone", segs=8)
    sphere(0.06, at=(0, 0, 3.08), color="stone", segs=6, rings=4)
    for (z, rot) in ((2.72, 0), (2.97, 90)):
        box((1.05, 0.04, 0.22), at=(0, 0, z), rot=(0, 0, rot), bevel=0.015, color="leaf")
        box((1.07, 0.03, 0.03), at=(0, 0, z + 0.09), rot=(0, 0, rot), color="snow", lod0=True)
        box((1.07, 0.03, 0.03), at=(0, 0, z - 0.09), rot=(0, 0, rot), color="snow", lod0=True)
        a = math.radians(rot)
        for k in (-1, 1):
            for i in range(5):
                u = -0.32 + i * 0.16
                off = k * 0.026
                box((0.1, 0.008, 0.1), at=(u * math.cos(a) - off * math.sin(a), u * math.sin(a) + off * math.cos(a),
                                            z - 0.01), rot=(0, 0, rot), color="snow", lod0=True)


@asset("parking_meter", "Parking Meter", "Eats coins and gives back nothing but time.", 4, "metal", "small",
       col="cyl", fill=0.15)
def parking_meter():
    cyl(0.1, 0.04, color="charcoal", segs=8)
    cyl(0.045, 0.86, color="charcoal", segs=8)
    box((0.22, 0.18, 0.1), at=(0, 0, 0.84), base=True, bevel=0.02, color="charcoal")
    box((0.3, 0.24, 0.26), at=(0, 0, 0.93), base=True, bevel=0.04, color="slate")
    sphere(0.15, at=(0, 0, 1.19), scale=(1, 0.8, 0.75), color="slate", segs=10, rings=5)
    sphere(0.105, at=(0, -0.09, 1.15), scale=(1, 0.42, 0.95), color="glass", segs=10, rings=5)
    box((0.1, 0.03, 0.05), at=(0.0, -0.125, 1.0), color="cloud", lod0=True)
    box((0.16, 0.02, 0.09), at=(0.04, -0.13, 1.15), rot=(0, -35, 0), color="tomato")


@asset("newspaper_box", "Newspaper Box", "Yesterday's news, today, for fifty cents.", 4, "metal", "small",
       variants=["cobalt", "tomato", "sun", "leaf", "snow", "sky"], col="box", fill=0.7)
def newspaper_box():
    for x in (-0.18, 0.18):
        for y in (-0.15, 0.15):
            box((0.05, 0.05, 0.36), at=(x, y, 0), base=True, color="charcoal")
    box((0.5, 0.44, 0.08), at=(0, 0, 0.3), base=True, color="charcoal")
    box((0.5, 0.44, 0.62), at=(0, 0, 0.36), base=True, bevel=0.03, color="cobalt", tint=True)
    box((0.54, 0.48, 0.12), at=(0, 0.0, 0.98), base=True, bevel=0.03, taper=(0.9, 0.82), color="cobalt", tint=True)
    _panel("-y", -0.22, 0, 0.72, 0.4, 0.34, 0.02, "charcoal")
    _panel("-y", -0.24, 0, 0.72, 0.34, 0.28, 0.02, "glass")
    _panel("-y", -0.25, 0, 0.75, 0.3, 0.18, 0.015, "paper", lod0=True)
    for i in range(3):
        _panel("-y", -0.262, -0.03 + 0.0 * i, 0.8 - i * 0.045, 0.18 - i * 0.03, 0.02, 0.008, "ink_soft", lod0=True)
    _panel("-y", -0.22, 0, 0.47, 0.42, 0.12, 0.02, "snow")
    box((0.12, 0.08, 0.12), at=(0.12, -0.0, 1.1), base=True, color="stone", lod0=True)
    box((0.16, 0.04, 0.03), at=(0, -0.26, 0.92), color="stone", lod0=True)


@asset("bike_rack", "Bike Rack", "Built for five bikes. Holds one bike and a lot of optimism.", 4, "metal", "small",
       col="box", fill=0.1)
def bike_rack():
    for k in (-1, 1):
        box((2.0, 0.06, 0.05), at=(0, k * 0.22, 0), base=True, color="charcoal")
    n = 2 if _lod1() else 6
    for x in (-0.9, -0.3, 0.3, 0.9):
        pts = [(x, -0.22, 0.02), (x, -0.22, 0.62)]
        for i in range(1, n):
            a = math.pi * i / n
            pts.append((x, -0.22 * math.cos(a), 0.62 + 0.22 * math.sin(a)))
        pts += [(x, 0.22, 0.62), (x, 0.22, 0.02)]
        tube(pts, 0.032, color="cobalt", segs=6)
