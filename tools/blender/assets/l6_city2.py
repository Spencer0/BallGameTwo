"""Level 6 — The Big Tidy, part 2: the Manhattan kit (CITY.md). Objects face -Y; base at z = 0; metres.

Street buildings are PARTY-WALL buildings: the ±X side walls are flat and nothing crosses x = ±W/2, so
neighbours placed side by side form one continuous street wall. The front facade plane is at
y = -D/2 (D = the `facade` metadata x 2); only stoops/canopies/cornices/awnings protrude (≤ 2 m), and every
front protrusion is balanced by an equal one at the back (a rear extension, a service canopy, or simply a
box that passes straight through the building) so the bounding-box recentre in finalize() never moves the
facade off y = -D/2.

Windows are cheap: one dark strip per window column running the full height (front + back in a single
box that passes through the building) and one wall-coloured spandrel per floor laid over them. That is
cols + floors boxes per facade instead of cols x floors.
"""
import math

from lib.core import STATE, box, cyl, sphere, torus, lathe, extrude, tube, capsule, seg, rounded_rect_points
from lib.registry import asset

L = 6


# ---------------------------------------------------------------- local helpers

def _lod1():
    return STATE.lod > 0


def _grid(W, D, xs, ww, z0, fh, nf, wr=0.62, win="ink_soft", wall="cocoa", tint=True, out=0.12, every1=2,
          at=(0.0, 0.0), sides=False):
    """Punched windows on the front and back faces of a W x D block.
    xs: window column centres; ww: window width; z0: bottom of the first floor; fh: floor height;
    nf: floors; wr: window share of each floor (the rest is the spandrel/sill zone below the window).
    sides=True puts the same grid on the ±X faces (W and D swap roles, xs are then y positions).
    LOD1 keeps the strips but only every `every1`-th spandrel (taller windows, same read)."""
    ax, ay = at
    z1 = z0 + nf * fh
    sh = fh * (1.0 - wr)
    for x in xs:
        if sides:
            box((W + 2 * out, ww, z1 - z0), at=(ax, ay + x, z0), base=True, color=win)
        else:
            box((ww, D + 2 * out, z1 - z0), at=(ax + x, ay, z0), base=True, color=win)
    step = every1 if _lod1() else 1
    for i in range(0, nf, step):
        z = z0 + i * fh
        if sides:
            box((W + 2 * out + 0.12, D - 0.04, sh), at=(ax, ay, z), base=True, color=wall, tint=tint)
        else:
            box((W - 0.04, D + 2 * out + 0.12, sh), at=(ax, ay, z), base=True, color=wall, tint=tint)


def _front(w, h, x, z, yf, out, color, tint=False, lod0=False, embed=0.05):
    """Thin box on a front face at y = yf (face -Y), protruding `out`."""
    box((w, out + embed, h), at=(x, yf - out / 2 + embed / 2, z), base=True, color=color, tint=tint, lod0=lod0)


def _rear(w, h, x, D, p, color, tint=False):
    """Rear element reaching exactly y = D/2 + p (balances front protrusions for the bbox recentre)."""
    box((w, p + 0.05, h), at=(x, D / 2 + p / 2 - 0.025, 0), base=True, color=color, tint=tint)


def _balance(D, w=1.2, h=2.4, x=0.0, color="charcoal", tint=False):
    """Make the rear protrusion equal the front one (so the bbox recentre keeps the facade at y = -D/2):
    adds a small rear box (meter cabinet / back step) when the front sticks out further."""
    ys = [v.co.y for v in STATE.bm.verts]
    pf, pb = -D / 2 - min(ys), max(ys) - D / 2
    if pf - pb > 1e-4:
        box((w, pf + 0.05, h), at=(x, D / 2 + pf / 2 - 0.025, 0), base=True, color=color, tint=tint)


def _tank(x, y, z, r=1.5, legs=1.6, h=2.4, roof=1.1, wood="caramel", steel="ink", cone="caramel"):
    """Rooftop wooden water tank on steel legs with a conical roof (NYC skyline signature)."""
    if _lod1():
        box((r * 1.4, r * 1.4, legs), at=(x, y, z), base=True, color=steel)
    else:
        for (kx, ky) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            box((0.22, 0.22, legs), at=(x + kx * r * 0.62, y + ky * r * 0.62, z), base=True, color=steel)
        box((r * 1.5, r * 1.5, 0.18), at=(x, y, z + legs - 0.18), base=True, color=steel)
    cyl(r, h, at=(x, y, z + legs), color=wood, segs=10)
    for t in (0.25, 0.7):
        cyl(r + 0.05, 0.12, at=(x, y, z + legs + h * t), color=steel, segs=10, lod0=True)
    cyl(r + 0.12, roof, at=(x, y, z + legs + h), r2=0.12, color=cone, segs=10)


_SEGS = {0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg",
         9: "abcdfg"}


def _digit(n, x, z, yf, h, color, out=0.3, tint=False):
    """Seven-segment digit (chunky boxes) on a -Y face; (x, z) = bottom-centre."""
    w, t = h * 0.56, h * 0.15
    segs = {
        "a": (w, t, x, z + h - t), "g": (w, t, x, z + h / 2 - t / 2), "d": (w, t, x, z),
        "f": (t, h / 2, x - w / 2 + t / 2, z + h / 2), "b": (t, h / 2, x + w / 2 - t / 2, z + h / 2),
        "e": (t, h / 2, x - w / 2 + t / 2, z), "c": (t, h / 2, x + w / 2 - t / 2, z),
    }
    for s in _SEGS[n]:
        sw, sh, sx, sz = segs[s]
        _front(sw, sh, sx, sz, yf, out, color, tint=tint)


def _wheel(x, y, z, r, w, color="ink_soft", hub="cloud", segs=10):
    cyl(r, w, at=(x, y, z), rot=(90, 0, 0), base=False, color=color, segs=segs)
    cyl(r * 0.5, w + 0.04, at=(x, y, z), rot=(90, 0, 0), base=False, color=hub, segs=6, lod0=True)


# ---------------------------------------------------------------- street walls

@asset("brownstone", "Brownstone", "The stoop is for sitting. The door is mostly decorative.", L, "stone", "large",
       variants=["cocoa", "brick", "caramel", "concrete", "sand"], col="box", fill=0.85, facade=8.0)
def brownstone():
    W, D, H = 8.0, 16.0, 14.4
    F = "cocoa"
    yf = -D / 2
    box((W, D, H), base=True, color=F, tint=True)
    # rusticated garden level (proud water table), front + back in one box
    box((W - 0.04, D + 0.3, 2.6), base=True, color=F, tint=True)
    # windows: 3 bays; parlour floor tall, upper floors getting shorter
    bays = (-2.5, 0.0, 2.5)
    rows = [(6.9, 2.2, bays), (9.9, 1.9, bays), (12.5, 1.4, bays), (3.2, 2.9, bays[1:]), (0.9, 1.2, bays[1:])]
    if _lod1():
        for x in bays:
            box((1.3, D + 0.24, 13.9 - 6.9), at=(x, 0, 6.9), base=True, color="ink_soft")
        for (z, h) in ((9.1, 0.8), (11.8, 0.7)):
            box((W - 0.04, D + 0.4, h), at=(0, 0, z), base=True, color=F, tint=True)
        for x in bays[1:]:
            box((1.3, D + 0.24, 2.9), at=(x, 0, 3.2), base=True, color="ink_soft")
    else:
        for (z, h, xs) in rows:
            for x in xs:
                box((1.3, D + (0.24 if z > 2.0 else 0.42), h), at=(x, 0, z), base=True, color="ink_soft")
                if z > 2.0:
                    _front(1.7, 0.35, x, z + h + 0.05, yf, 0.3, "paper")
                    _front(1.6, 0.14, x, z - 0.12, yf, 0.22, "paper")
    # parlour door with hood
    _front(1.5, 3.1, -2.5, 2.6, yf, 0.1, "ink_soft")
    _front(2.2, 0.5, -2.5, 5.9, yf, 0.45, "paper")
    # bracketed cornice
    _front(W, 0.45, 0, 13.4, yf, 0.3, "charcoal")
    box((W, 1.5, 1.1), at=(0, yf - 0.9 + 0.75, 13.9), base=True, color="charcoal")
    if not _lod1():
        for x in (-3.55, -1.2, 1.2, 3.55):
            _front(0.4, 0.9, x, 13.1, yf, 0.75, "charcoal")
    # stoop: steps up to the parlour door, solid sloping balustrades, newel posts
    sx, sw = -2.5, 2.3
    ns = 3 if _lod1() else 6
    zt, run, land = 2.6, 2.0, 0.55
    r, tr = zt / ns, (run - land) / (ns - 1)
    pts = [(yf, 0.0), (yf, zt)]
    for i in range(ns):
        y = yf - land - tr * i
        pts += [(y, zt - i * r), (y, zt - (i + 1) * r)]
    extrude(pts, sw - 0.5, at=(sx, 0, 0), rot=(90, 0, 90), color=F, tint=True)
    bal = [(yf - run, 0.0), (yf, 0.0), (yf, zt + 0.95), (yf - land, zt + 0.95), (yf - run + 0.3, 1.2),
           (yf - run, 1.2)]
    for k in (-1, 1):
        x = sx + k * (sw / 2 - 0.13)
        extrude(bal, 0.26, at=(x, 0, 0), rot=(90, 0, 90), color=F, tint=True)
        box((0.42, 0.42, 1.5), at=(x, yf - run + 0.21, 0), base=True, color="charcoal")
        sphere(0.24, at=(x, yf - run + 0.21, 1.65), color="charcoal", segs=6, rings=4, lod0=True)
    # areaway railing in front of the garden level
    x0, x1 = sx + sw / 2, W / 2 - 0.05
    yr = yf - 1.7
    box((x1 - x0, 0.08, 0.1), at=((x0 + x1) / 2, yr, 1.0), base=True, color="charcoal")
    box((0.12, 1.7, 0.1), at=(x1 - 0.06, yf - 0.85, 1.0), base=True, color="charcoal")
    if _lod1():
        box((x1 - x0, 0.04, 1.0), at=((x0 + x1) / 2, yr, 0), base=True, color="charcoal")
    else:
        n = 7
        for i in range(n):
            x = x0 + 0.25 + (x1 - x0 - 0.5) * i / (n - 1)
            box((0.07, 0.07, 1.1), at=(x, yr, 0), base=True, color="charcoal")
    # chimney on the party wall + rear extension (balances the stoop)
    box((1.2, 1.6, 1.4), at=(-W / 2 + 0.6, 4.0, H), base=True, color=F, tint=True)
    _rear(5.0, 3.2, 1.5, D, run, F, tint=True)
    _balance(D, color=F, tint=True)


@asset("tenement", "Tenement", "Five floors, no elevator, a fire escape full of tomato plants.", L, "stone", "large",
       variants=["brick", "cocoa", "sand", "concrete", "tangerine"], col="box", fill=0.85, facade=10.0)
def tenement():
    W, D, H = 16.0, 20.0, 16.6
    F = "brick"
    yf = -D / 2
    box((W, D, H), base=True, color=F, tint=True)
    # upper floors: 6 window columns, 4 floors
    xs = (-6.3, -3.9, -1.2, 1.2, 3.9, 6.3)
    z0, fh, nf = 4.2, 2.9, 4
    _grid(W, D, xs, 1.25, z0, fh, nf, wr=0.64, win="glass", wall=F, every1=2)
    if not _lod1():
        for x in xs:
            for i in range(nf):
                _front(1.55, 0.3, x, z0 + (i + 1) * fh - 0.32, yf, 0.32, F, tint=True)
    # cornice
    _front(W, 0.5, 0, H - 1.3, yf, 0.35, F, tint=True)
    box((W, 1.4, 0.9), at=(0, yf + 0.25, H - 0.8), base=True, color=F, tint=True)
    if not _lod1():
        for x in (-7.6, -4.6, -1.5, 1.5, 4.6, 7.6):
            _front(0.4, 0.8, x, H - 1.6, yf, 0.6, F, tint=True)
    # ground-floor shops: glass, doors, deli awnings
    for (x0, x1) in ((-7.6, -0.6), (2.8, 7.6)):
        _front(x1 - x0, 0.5, (x0 + x1) / 2, 0, yf, 0.15, "ink", lod0=True)
        _front(x1 - x0 - 1.4, 2.6, (x0 + x1) / 2 - 0.5, 0.5, yf, 0.12, "glass")
        _front(1.0, 3.0, x1 - 0.7, 0.0, yf, 0.1, "ink", lod0=True)
        cx, cw, dep, drop = (x0 + x1) / 2, x1 - x0, 1.9, 0.8
        ang = math.degrees(math.atan2(drop, dep))
        box((cw, math.hypot(dep, drop), 0.12), at=(cx, yf - dep / 2, 4.0 - drop / 2), rot=(ang, 0, 0),
            color="pine")
        box((cw, 0.08, 0.5), at=(cx, yf - dep + 0.02, 3.2 - 0.5), base=True, color="pine", lod0=True)
    _front(1.6, 3.2, 1.1, 0.0, yf, 0.12, "ink")
    _front(2.2, 0.35, 1.1, 3.25, yf, 0.3, F, tint=True, lod0=True)
    # two zig-zag fire escapes
    for cx in (-5.1, 5.1):
        hw = 2.05
        zs = [z0 + i * fh + 0.62 for i in range(nf)]
        for i, z in enumerate(zs):
            box((2 * hw, 1.25, 0.12), at=(cx, yf - 0.6, z), base=True, color="ink")
            if not _lod1():
                box((2 * hw, 0.07, 0.1), at=(cx, yf - 1.2, z + 0.95), base=True, color="ink")
                for x in (-hw + 0.05, hw - 0.05):
                    box((0.07, 0.07, 0.95), at=(cx + x, yf - 1.2, z), base=True, color="ink")
            if i < nf - 1:
                sgn = 1 if i % 2 == 0 else -1
                dx = 2 * hw - 0.9
                ang = math.degrees(math.atan2(fh, dx))
                box((math.hypot(dx, fh), 0.55, 0.12), at=(cx, yf - 0.62, z + fh / 2),
                    rot=(0, -sgn * ang, 0), color="ink")
    # roof: stair bulkhead + water tank
    box((3.0, 3.6, 2.4), at=(-4.5, 4.0, H), base=True, color=F, tint=True)
    _tank(3.8, 3.0, H, r=1.55, legs=1.6, h=2.4, roof=1.0, steel="ink")
    _rear(7.0, 4.2, 2.0, D, 1.9, F, tint=True)
    _balance(D, color=F, tint=True)


@asset("midrise_prewar", "Prewar Apartments", "Built before the war. Still arguing about the radiators.", L,
       "stone", "large", variants=["concrete", "sand", "brick", "paper"], col="box", fill=0.85, facade=13.0)
def midrise_prewar():
    W, D = 28.0, 26.0
    F = "concrete"
    yf = -D / 2
    Hb = 35.0
    box((W, D, Hb), base=True, color=F, tint=True)
    # limestone base (two storeys), shop windows, belt cornice
    box((W - 0.04, D + 0.5, 6.4), base=True, color="stone")
    xs = [-12.25 + 3.5 * i for i in range(8)]
    if _lod1():
        box((W - 3.0, D + 0.62, 3.4), at=(0, 0, 0.6), base=True, color="ink_soft")
    else:
        for x in xs:
            if abs(x) > 2.0:
                box((2.4, D + 0.62, 3.6), at=(x, 0, 0.5), base=True, color="ink_soft")
                box((1.6, D + 0.62, 1.4), at=(x, 0, 4.5), base=True, color="ink_soft")
    box((W - 0.04, D + 1.0, 0.6), at=(0, 0, 6.4), base=True, color="stone")
    # shaft: 9 floors x 8 bays
    _grid(W, D, xs, 1.6, 7.0, 3.1, 9, wr=0.6, win="ink_soft", wall=F, every1=3)
    # lobby: door + canopy to the curb (passes through: service canopy at the back)
    box((3.4, D + 0.62, 4.6), at=(0, 0, 0), base=True, color="ink_soft")
    box((4.0, D + 4.0, 0.45), at=(0, 0, 4.2), base=True, color="ink_soft")
    if not _lod1():
        for k in (-1, 1):
            for s in (-1, 1):
                box((0.12, 0.12, 4.2), at=(k * 1.8, s * (D / 2 + 1.85), 0), base=True, color="ink_soft")
    # crown: heavy cornice, two setbacks, water tank
    box((W, D + 2.0, 1.2), at=(0, 0, Hb - 0.4), base=True, color="stone")
    w2, d2, h2 = 24.0, 20.0, 4.6
    z2 = Hb + 0.8
    box((w2, d2, h2), at=(0, 0, z2), base=True, color=F, tint=True)
    if _lod1():
        box((w2 + 0.24, d2 + 0.24, 2.2), at=(0, 0, z2 + 2.0), base=True, color="ink_soft")
    else:
        _grid(w2, d2, [-9.0, -5.4, -1.8, 1.8, 5.4, 9.0], 1.5, z2 + 0.3, 4.2, 1, wr=0.6, wall=F, every1=1)
        _grid(w2, d2, [-6.0, -2.0, 2.0, 6.0], 1.5, z2 + 0.3, 4.2, 1, wr=0.6, wall=F, every1=1, sides=True)
    box((w2 + 0.8, d2 + 0.8, 0.7), at=(0, 0, z2 + h2), base=True, color="stone")
    w3, d3, h3 = 15.0, 12.0, 3.4
    z3 = z2 + h2 + 0.7
    box((w3, d3, h3), at=(-3.0, 0, z3), base=True, color=F, tint=True)
    if not _lod1():
        _grid(w3, d3, [-4.5, 0.0, 4.5], 1.4, z3 + 0.4, 3.0, 1, wr=0.65, wall=F, every1=1, at=(-3.0, 0))
    box((w3 + 0.6, d3 + 0.6, 0.6), at=(-3.0, 0, z3 + h3), base=True, color="stone")
    _tank(8.6, 2.0, z2 + h2 + 0.7, r=2.3, legs=1.8, h=3.0, roof=1.3, steel="ink_soft")
    _balance(D, color="stone")


@asset("midrise_modern", "Glass Midrise", "All windows, no secrets. The blinds are doing their best.", L, "glass",
       "large", variants=["slate", "cobalt", "teal", "concrete"], col="box", fill=0.85, facade=13.0)
def midrise_modern():
    W, D = 26.0, 26.0
    T = "slate"
    yf = -D / 2
    Hb = 36.0
    box((W, D, Hb), base=True, color=T, tint=True)
    # curtain wall front + back (one box straight through), floor bands, mullions
    z0 = 6.0
    box((W - 1.6, D + 0.3, Hb - z0 - 1.0), at=(0, 0, z0), base=True, color="glass")
    nf = 9
    fh = (Hb - z0 - 1.0) / nf
    step = 3 if _lod1() else 1
    for i in range(0, nf + 1, step):
        box((W - 0.04, D + 0.5, 0.7), at=(0, 0, z0 + i * fh - 0.35), base=True, color=T, tint=True)
    if not _lod1():
        for i in range(1, 6):
            x = -W / 2 + 0.8 + (W - 1.6) * i / 6
            box((0.25, D + 0.42, Hb - z0 - 1.0), at=(x, 0, z0), base=True, color=T, tint=True)
    # glass lobby, columns, cantilevered canopy (through: loading canopy at the back)
    box((W - 3.0, D + 0.3, 4.8), at=(0, 0, 0), base=True, color="glass")
    for x in (-8.0, 0.0, 8.0):
        box((0.9, D + 0.5, 5.0), at=(x, 0, 0), base=True, color=T, tint=True, lod0=x != 0.0)
    box((2.4, D + 0.4, 3.2), at=(-4.0, 0, 0), base=True, color="ink_soft")
    box((12.0, D + 4.0, 0.5), at=(-4.0, 0, 4.4), base=True, color="cloud")
    # roof: parapet + mechanical penthouse
    box((W, D + 0.5, 1.0), at=(0, 0, Hb - 1.0), base=True, color=T, tint=True)
    box((14.0, 12.0, 3.8), at=(3.0, 1.0, Hb), base=True, color="cloud")
    if not _lod1():
        for i in range(5):
            box((0.3, 12.3, 3.0), at=(-3.0 + i * 3.0, 1.0, Hb + 0.4), base=True, color="cloud")
    box((4.0, 4.0, 2.2), at=(-8.0, -4.0, Hb), base=True, color="cloud")
    _balance(D, color=T, tint=True)


@asset("midrise_deco", "Deco Office", "Wears its hat at a jaunty angle and its piers very upright.", L, "stone",
       "large", variants=["sand", "concrete", "butter", "bubblegum"], col="box", fill=0.8, facade=14.0)
def midrise_deco():
    W, D = 30.0, 28.0
    F = "sand"
    yf = -D / 2
    H1 = 41.0
    box((W, D, H1), base=True, color=F, tint=True)
    # vertical window ribbons between continuous piers
    xs = [-12.0 + 4.0 * i for i in range(7)]
    for x in xs:
        if abs(x) < 1.0:
            continue
        box((2.3, D + 0.3, H1 - 10.0), at=(x, 0, 9.5), base=True, color="ink_soft")
    box((2.3, D + 0.3, H1 - 14.0), at=(0, 0, 13.5), base=True, color="ink_soft")
    if not _lod1():
        for x in xs:
            # spandrel chevrons at the top of every ribbon
            _front(2.3, 0.6, x, H1 - 1.6, yf, 0.3, "sun")
        for i in range(1, 8):
            box((W - 0.04, D + 0.2, 0.4), at=(0, 0, 9.5 + i * 3.9 - 0.2), base=True, color=F, tint=True)
    # two-storey base with a gold-framed portal (through: goods entrance at the back)
    box((W - 0.04, D + 0.5, 8.0), base=True, color=F, tint=True)
    for x in xs:
        if abs(x) > 5.0:
            box((2.8, D + 0.62, 5.5), at=(x, 0, 0.6), base=True, color="ink_soft")
    box((7.0, D + 0.8, 11.5), at=(0, 0, 0), base=True, color="sun")
    box((5.6, D + 0.9, 10.4), at=(0, 0, 0), base=True, color="ink_soft")
    for i, (w, z) in enumerate(((4.4, 6.0), (3.0, 8.0), (1.6, 9.4))):
        box((w, D + 1.0, 0.5), at=(0, 0, z), base=True, color="sun", lod0=i > 0)
    box((W - 0.04, D + 0.7, 0.7), at=(0, 0, 8.0), base=True, color="sun")
    # stepped crown with gold caps and fins
    tiers = [(24.0, 22.0, 5.0), (17.0, 15.0, 4.2), (10.0, 9.0, 3.4)]
    z = H1
    box((W - 0.04, D + 0.6, 0.8), at=(0, 0, z), base=True, color="sun")
    z += 0.8
    for i, (w, d, h) in enumerate(tiers):
        box((w, d, h), at=(0, 0, z), base=True, color=F, tint=True)
        n = (4, 3, 2)[i]
        if not _lod1() or i == 0:
            for k in range(n):
                t = (k + 0.5) / n
                box((1.4, d + 0.24, h - 1.2), at=(-w / 2 + w * 0.15 + w * 0.7 * t, 0, z + 0.4), base=True,
                    color="ink_soft")
                box((w + 0.24, 1.4, h - 1.2), at=(0, -d / 2 + d * 0.15 + d * 0.7 * t, z + 0.4), base=True,
                    color="ink_soft")
        box((w + 0.6, d + 0.6, 0.6), at=(0, 0, z + h), base=True, color="sun")
        z += h + 0.6
    cyl(1.6, 2.6, at=(0, 0, z), r2=0.15, color="sun", segs=6)
    if not _lod1():
        for k in (-1, 1):
            extrude([(0.0, 0.0), (2.8, 0.0), (0.0, 7.0)], 0.6, at=(k * 12.0, 0, H1 + 0.8),
                    rot=(90, 0, 0 if k > 0 else 180), color="sun")
    _balance(D, color=F, tint=True)


@asset("highrise_glass", "Glass Tower", "Reflects the whole city back at itself, mostly as a flex.", L, "glass",
       "landmark", variants=["sky", "teal", "slate", "cobalt"], col="box", fill=0.6, facade=17.0)
def highrise_glass():
    W, D, Hp = 38.0, 34.0, 14.0
    yf = -D / 2
    # podium
    box((W, D, Hp), base=True, color="concrete")
    box((W - 0.04, D + 0.3, 4.6), at=(0, 0, 0.4), base=True, color="ink_soft")
    for x in (-13.0, -6.5, 6.5, 13.0):
        box((1.2, D + 0.4, 4.8), at=(x, 0, 0), base=True, color="concrete", lod0=True)
    for z in (6.8, 10.2):
        box((W - 0.04, D + 0.3, 2.0), at=(0, 0, z), base=True, color="ink_soft")
    box((14.0, D + 4.0, 0.6), at=(0, 0, 5.0), base=True, color="snow")
    box((W, D + 0.6, 0.8), at=(0, 0, Hp - 0.8), base=True, color="snow")
    # tower: tinted glass, snow floor bands, corner fins
    tw, td, Ht = 30.0, 26.0, 100.0
    box((tw, td, Ht - Hp), at=(0, 0, Hp), base=True, color="sky", tint=True)
    n = 6 if _lod1() else 20
    fh = (Ht - Hp - 2.0) / n
    for i in range(n):
        box((tw + 0.4, td + 0.4, 0.55 if not _lod1() else 1.2), at=(0, 0, Hp + 2.0 + i * fh), base=True,
            color="snow")
    for (kx, ky) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        box((1.2, 1.2, Ht - Hp + 2.0), at=(kx * tw / 2, ky * td / 2, Hp), base=True, color="snow")
    if not _lod1():
        for i in range(1, 4):
            x = -tw / 2 + tw * i / 4
            box((0.35, td + 0.3, Ht - Hp - 2.0), at=(x, 0, Hp + 2.0), base=True, color="snow")
            y = -td / 2 + td * i / 4
            box((tw + 0.3, 0.35, Ht - Hp - 2.0), at=(0, y, Hp + 2.0), base=True, color="snow")
    # flat mechanical crown: open screen frame + plant box + mast
    box((tw + 0.8, td + 0.8, 1.4), at=(0, 0, Ht), base=True, color="snow")
    box((tw - 4.0, td - 4.0, 7.0), at=(0, 0, Ht + 1.4), base=True, color="concrete")
    if not _lod1():
        for i in range(7):
            x = -(tw - 4.0) / 2 + (tw - 4.0) * (i + 0.5) / 7
            box((0.5, td - 3.6, 6.0), at=(x, 0, Ht + 1.4), base=True, color="ink_soft")
    box((tw - 3.6, td - 3.6, 0.6), at=(0, 0, Ht + 8.4), base=True, color="snow")
    cyl(0.25, 4.0, at=(6.0, 4.0, Ht + 9.0), color="concrete", segs=4, lod0=True)
    _balance(D, color="concrete")


@asset("highrise_stone", "Wedding Cake Tower", "Three tiers, one tiny spire, no cake. A cruel building.", L,
       "stone", "landmark", variants=["concrete", "sand", "paper"], col="box", fill=0.6, facade=17.0)
def highrise_stone():
    W, D = 36.0, 34.0
    F = "concrete"
    tiers = [(W, D, 0.0, 36.0, 9), (29.0, 27.0, 36.0, 56.0, 7), (22.0, 20.0, 56.0, 70.0, 5), (15.0, 13.0, 70.0, 80.0, 3)]
    for i, (w, d, z0, z1, n) in enumerate(tiers):
        box((w, d, z1 - z0), at=(0, 0, z0), base=True, color=F, tint=True)
        zs = z0 + (12.0 if i == 0 else 1.6)
        xs = [-w / 2 + w * 0.12 + w * 0.76 * (k + 0.5) / n for k in range(n)]
        nn = n if not _lod1() else max(2, n // 2)
        if _lod1():
            xs = [-w / 2 + w * 0.12 + w * 0.76 * (k + 0.5) / nn for k in range(nn)]
        for x in xs:
            box((1.5 if not _lod1() else 2.6, d + 0.3, z1 - zs - 2.0), at=(x, 0, zs), base=True, color="ink_soft")
        if i > 0:
            ys = [-d / 2 + d * 0.12 + d * 0.76 * (k + 0.5) / max(2, nn - 1) for k in range(max(2, nn - 1))]
            for y in ys:
                box((w + 0.3, 1.5 if not _lod1() else 2.6, z1 - zs - 2.0), at=(0, y, zs), base=True,
                    color="ink_soft")
        # setback ledge (cornice) + corner urns
        box((w + (1.0 if i else -0.04), d + 1.0, 1.2), at=(0, 0, z1 - 1.2), base=True, color="stone")
        if i < 3 and not _lod1():
            w2, d2 = tiers[i + 1][0], tiers[i + 1][1]
            for (kx, ky) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                px, py = kx * (w2 / 2 + (w - w2) / 4), ky * (d2 / 2 + (d - d2) / 4)
                box((1.4, 1.4, 2.6), at=(px, py, z1), base=True, color="stone")
                cyl(0.75, 1.4, at=(px, py, z1 + 2.6), r2=0.05, color="stone", segs=4)
    # limestone base + tall entrance arch (through: back entrance too)
    box((W - 0.04, D + 0.5, 10.0), base=True, color="stone")
    for x in (-13.0, -8.0, 8.0, 13.0):
        box((3.0, D + 0.6, 5.0), at=(x, 0, 1.0), base=True, color="ink_soft")
    box((7.0, D + 0.7, 6.0), at=(0, 0, 0), base=True, color="ink_soft")
    cyl(3.5, D + 0.7, at=(0, 0, 6.0), rot=(90, 0, 0), base=False, color="ink_soft", segs=12)
    box((W, D + 1.2, 1.0), at=(0, 0, 10.0), base=True, color="stone")
    # copper hip roof + lantern + spire
    z = 80.0
    box((14.0, 12.0, 5.5), at=(0, 0, z), base=True, color="teal", taper=(0.28, 0.3))
    cyl(1.6, 2.5, at=(0, 0, z + 5.5), color="teal", segs=6)
    cyl(1.0, 7.0, at=(0, 0, z + 8.0), r2=0.08, color="teal", segs=6)
    sphere(0.6, at=(0, 0, z + 8.6), color="sun", segs=6, rings=4, lod0=True)
    _balance(D, color="stone")


@asset("screen_building", "Screen Building", "Shouts about toothpaste at four thousand nits, all night long.", L,
       "electronic", "landmark", variants=["flamingo", "sun", "lime", "sky"], col="box", fill=0.85, facade=16.0)
def screen_building():
    W, D, H = 40.0, 32.0, 50.0
    yf = -D / 2
    box((W, D, H), base=True, color="charcoal")
    # back + upper back: a few dark window bands so the rear isn't blank
    for z in (16.0, 24.0, 32.0, 40.0):
        box((W - 6.0, 0.4, 3.0), at=(0, D / 2 + 0.15, z), base=True, color="ink", lod0=True)
    # street level: glass shopfronts + marquee (through: stage-door canopy at the back)
    _front(W - 2.0, 4.0, 0, 0.3, yf, 0.15, "glass")
    for x in (-12.0, 0.0, 12.0):
        _front(1.0, 4.4, x, 0.0, yf, 0.25, "charcoal")
    box((W - 4.0, D + 3.4, 1.6), at=(0, 0, 4.8), base=True, color="sun")
    _front(W - 6.0, 0.8, 0, 5.2, yf - 1.7, 0.1, "snow")
    if not _lod1():
        for i in range(14):
            x = -W / 2 + 3.0 + (W - 6.0) * (i + 0.5) / 14
            sphere(0.2, at=(x, yf - 1.75, 6.25), color="snow", segs=5, rings=3)
    # news ticker wrapping the front
    _front(W, 2.4, 0, 8.4, yf, 0.8, "ink")
    if not _lod1():
        for i in range(9):
            _front(1.4 + (i % 3) * 0.8, 0.7, -17.0 + i * 4.2, 9.25, yf - 0.8, 0.12, "sun")
    # big screens and billboards, stacked and overlapping, at different depths
    # 1: the giant tinted screen (left), with a snow disc and copy bars
    _front(17.0, 26.0, -10.5, 12.5, yf, 1.6, "flamingo", tint=True)
    cyl(5.2, 0.3, at=(-10.5, yf - 1.7, 29.5), rot=(90, 0, 0), base=False, color="snow", segs=14)
    cyl(1.8, 0.15, at=(-10.5, yf - 1.88, 29.5), rot=(90, 0, 0), base=False, color="ink", segs=10)
    for i, w in enumerate((12.0, 9.0, 11.0)):
        _front(w, 1.2, -10.5, 15.0 + i * 2.6, yf - 1.6, 0.15, "snow")
    # 2: sky screen (right, middle) with a sun stripe
    _front(18.0, 13.0, 10.0, 13.0, yf, 0.9, "sky")
    _front(18.0, 3.0, 10.0, 16.0, yf - 0.9, 0.15, "sun")
    _front(5.0, 5.0, 14.5, 20.0, yf - 0.9, 0.15, "snow")
    # 3: sun billboard (right, upper) with tomato wedge "logo"
    _front(16.0, 12.0, 10.5, 27.5, yf, 1.2, "sun")
    extrude([(-4.0, 0.0), (4.0, 0.0), (0.0, 7.0)], 0.2, at=(9.0, yf - 1.25, 30.0), rot=(90, 0, 0),
            color="tomato")
    # 4: top banner across the whole face + rooftop billboard on stilts
    _front(W, 8.0, 0, 40.0, yf, 0.6, "sky")
    for i, w in enumerate((26.0, 18.0)):
        _front(w, 1.6, -3.0 + i * 4.0, 41.6 + i * 2.8, yf - 0.6, 0.15, "snow")
    for x in (-12.0, 0.0, 12.0):
        box((0.6, 0.6, 3.0), at=(x, -6.0, H), base=True, color="ink")
    box((32.0, 1.2, 9.0), at=(0, -6.6, H + 2.5), base=True, color="flamingo", tint=True)
    box((22.0, 0.3, 2.0), at=(-3.0, -7.3, H + 6.0), base=True, color="snow")
    box((14.0, 0.3, 2.0), at=(2.0, -7.3, H + 3.4), base=True, color="snow", lod0=True)
    # a billboard on the back too (also balances the front screens for the recentre)
    box((20.0, 1.6, 10.0), at=(0, D / 2 + 0.8, 20.0), base=True, color="sun")
    _balance(D)


# ---------------------------------------------------------------- street furniture & vehicles

@asset("subway_entrance", "Subway Entrance", "Stairs down to a warm wind and a train that just left.", L, "metal",
       "small", col="box", fill=0.3)
def subway_entrance():
    W, D = 3.2, 6.0
    hw, hd = W / 2 - 0.2, D / 2
    # the stairwell: dark hole with the first few steps catching light
    box((W - 0.3, D - 0.2, 0.06), at=(0, 0.0, 0), base=True, color="ink")
    if not _lod1():
        for i in range(5):
            box((W - 0.4, 0.3, 0.04), at=(0, -hd + 0.5 + i * 0.6, 0.06), base=True, color="stone")
    # low curb walls + railings on three sides
    G = "pine"
    for k in (-1, 1):
        box((0.3, D, 0.35), at=(k * hw, 0, 0), base=True, color="stone")
        if _lod1():
            box((0.06, D - 0.2, 0.82), at=(k * hw, 0, 0.35), base=True, color=G)
        else:
            box((0.1, D, 0.12), at=(k * hw, 0, 1.05), base=True, color=G)
            for i in range(7):
                box((0.06, 0.06, 0.7), at=(k * hw, -hd + 0.3 + i * (D - 0.6) / 6, 0.35), base=True, color=G)
    box((W - 0.2, 0.3, 0.35), at=(0, hd - 0.15, 0), base=True, color="stone")
    box((W - 0.2, 0.1, 0.12), at=(0, hd - 0.15, 1.05), base=True, color=G)
    # sign on the back rail
    box((2.6, 0.12, 0.55), at=(0, hd - 0.15, 1.2), base=True, color="ink")
    box((1.6, 0.16, 0.14), at=(-0.35, hd - 0.15, 1.4), base=True, color="snow", lod0=True)
    for i, c in enumerate(("tomato", "sun", "leaf")):
        cyl(0.13, 0.18, at=(0.65 + i * 0.3, hd - 0.15, 1.47), rot=(90, 0, 0), base=False, color=c, segs=8,
            lod0=True)
    # two green globe lamps at the mouth of the stairs
    for k in (-1, 1):
        x = k * hw
        cyl(0.12, 2.45, at=(x, -hd + 0.1, 0), color=G, segs=6)
        cyl(0.2, 0.3, at=(x, -hd + 0.1, 0), color=G, segs=6, lod0=True)
        sphere(0.3, at=(x, -hd + 0.1, 2.7), color="lime", segs=8, rings=5)
        cyl(0.08, 0.15, at=(x, -hd + 0.1, 2.97), color=G, segs=4, lod0=True)


@asset("newsstand", "Newsstand", "Sells the news, gum, and exactly one map nobody buys.", L, "metal", "small",
       variants=["pine", "navy", "tomato", "teal"], col="box", fill=0.8)
def newsstand():
    W, D, H = 3.0, 1.7, 2.2
    G = "pine"
    box((W, D, H), base=True, color=G, tint=True, bevel=0.05, bseg=1)
    # open front: dark interior + counter + magazine rack
    _front(2.5, 1.2, 0, 0.9, -D / 2, 0.06, "ink_soft")
    _front(2.6, 0.12, 0, 0.82, -D / 2, 0.3, "paper")
    cols = ("sun", "flamingo", "sky", "snow", "tomato", "lime")
    if _lod1():
        _front(2.4, 0.5, 0, 0.94, -D / 2, 0.18, "sun")
        _front(2.4, 0.5, 0, 0.25, -D / 2, 0.08, "flamingo")
    else:
        for i in range(6):
            box((0.34, 0.06, 0.46), at=(-1.0 + i * 0.4, -D / 2 - 0.2, 0.95), rot=(-12, 0, 0), base=True,
                color=cols[i])
            box((0.34, 0.06, 0.46), at=(-1.0 + i * 0.4, -D / 2 - 0.04, 0.2), rot=(-8, 0, 0), base=True,
                color=cols[(i + 3) % 6])
    # flip-up awning panel + roof + sign
    box((W, 0.6, 0.08), at=(0, -D / 2 - 0.25, 2.12), rot=(-18, 0, 0), color=G, tint=True)
    box((W + 0.0, D + 0.3, 0.12), at=(0, 0, H), base=True, color="paper")
    box((2.4, 0.2, 0.32), at=(0, -D / 2 - 0.05, H + 0.12), base=True, color="paper")
    for i in range(4):
        box((0.36, 0.06, 0.18), at=(-0.75 + i * 0.5, -D / 2 - 0.16, H + 0.19), base=True, color="ink", lod0=True)
    box((0.2, 0.2, 0.2), at=(0, 0, H + 0.12), base=True, color="paper")
    _balance(D, w=W - 0.4, h=0.3, color=G, tint=True)


@asset("hot_dog_cart", "Hot Dog Cart", "Lunch, dinner and a modest umbrella.", L, "metal", "small",
       variants=["sun", "sky", "tomato", "lime"], col="box", fill=0.45)
def hot_dog_cart():
    # long axis X, push handle at -X
    box((1.5, 0.8, 0.75), at=(0.1, 0, 0.35), base=True, color="cloud", bevel=0.05, bseg=1)
    box((1.56, 0.86, 0.1), at=(0.1, 0, 1.1), base=True, color="stone")
    # big hot dog painted on the sidewalk side (-Y)
    capsule(0.16, 0.8, at=(0.1, -0.42, 0.72), rot=(0, 90, 0), color="sand", segs=8)
    capsule(0.1, 1.0, at=(0.1, -0.5, 0.78), rot=(0, 90, 0), color="tomato", segs=6)
    # wheels + stand
    for y in (-0.47, 0.47):
        _wheel(-0.25, y, 0.3, 0.3, 0.08, color="ink_soft", hub="stone", segs=10)
    box((0.1, 0.5, 0.35), at=(0.7, 0, 0), base=True, color="stone")
    # push handle
    for y in (-0.3, 0.3):
        tube([(-0.6, y, 0.95), (-0.95, y, 1.05)], 0.035, color="ink_soft", segs=4)
    tube([(-0.95, -0.32, 1.05), (-0.95, 0.32, 1.05)], 0.045, color="ink_soft", segs=4)
    # condiments
    for i, c in enumerate(("sun", "tomato")):
        cyl(0.06, 0.22, at=(0.55 + i * 0.16, 0.2, 1.2), color=c, segs=6, lod0=True)
    # oval umbrella, striped by a darker skirt
    cyl(0.035, 1.0, at=(0.1, 0, 1.2), color="ink_soft", segs=4)
    cyl(1.0, 0.36, at=(0.1, 0, 1.86), r2=0.06, color="sun", tint=True, segs=10, scale=(1.0, 0.62, 1.0))
    cyl(1.02, 0.16, at=(0.1, 0, 1.76), r2=1.0, color="tomato", segs=10, scale=(1.0, 0.62, 1.0))
    sphere(0.07, at=(0.1, 0, 2.24), color="tomato", segs=5, rings=3, lod0=True)


@asset("food_truck", "Food Truck", "The menu changes daily. The queue does not.", L, "metal", "medium",
       variants=["tangerine", "teal", "flamingo", "lime", "sky"], col="box", fill=0.7)
def food_truck():
    T = "tangerine"
    # box body (rear) + cab (front, +X)
    box((5.0, 2.3, 2.05), at=(-1.0, 0, 0.45), base=True, color=T, tint=True, bevel=0.12, bseg=1)
    box((1.9, 2.2, 1.75), at=(2.45, 0, 0.45), base=True, color=T, tint=True, bevel=0.15, bseg=1)
    box((0.12, 1.9, 0.75), at=(3.3, 0, 1.38), rot=(0, -18, 0), base=True, color="glass")
    for y in (-1.12, 1.12):
        box((0.9, 0.06, 0.6), at=(2.6, y, 1.4), base=True, color="glass")
    box((0.3, 2.25, 0.4), at=(3.42, 0, 0.38), base=True, color="ink_soft")
    for y in (-0.75, 0.75):
        box((0.06, 0.4, 0.25), at=(3.42, y, 0.88), base=True, color="snow", lod0=True)
    # snow stripe + serving hatch with a propped-up flap on the curb side (-Y)
    box((5.04, 2.34, 0.25), at=(-1.0, 0, 0.85), base=True, color="snow")
    box((2.8, 0.1, 0.95), at=(-1.3, -1.16, 1.25), base=True, color="ink_soft")
    box((3.0, 0.3, 0.08), at=(-1.3, -1.3, 1.2), base=True, color="snow")
    box((3.0, 0.7, 0.08), at=(-1.3, -1.36, 2.4), rot=(-60, 0, 0), color=T, tint=True)
    box((1.0, 0.06, 0.8), at=(-3.0, -1.17, 1.25), base=True, color="paper", lod0=True)
    for i in range(3):
        box((0.7, 0.03, 0.08), at=(-3.0, -1.21, 1.4 + i * 0.2), base=True, color="ink", lod0=True)
    # wheels
    for x in (-2.4, 2.3):
        for y in (-1.02, 1.02):
            _wheel(x, y, 0.42, 0.42, 0.3, color="ink_soft", hub="cloud", segs=10)
    # giant taco on the roof: sun shell, leaf frill along the curve
    zt, R = 2.62, 0.5
    box((1.1, 0.5, 0.2), at=(-1.0, 0, 2.48), base=True, color="ink_soft")
    torus(R, 0.12, at=(-1.0, 0, zt), rot=(90, 0, 0), arc=180, color="leaf", segs=8, rsegs=4, scale=(1, 1, 3.2))
    extrude([(R * math.cos(math.pi * i / seg(8, 4)), R * math.sin(math.pi * i / seg(8, 4)))
             for i in range(seg(8, 4) + 1)], 0.6, at=(-1.0, 0, zt), rot=(90, 0, 0), color="sun")


@asset("limo", "Limousine", "Long enough to have its own weather system.", L, "metal", "medium",
       variants=["navy", "ink_soft", "snow", "charcoal"], col="box", fill=0.65)
def limo():
    C = "navy"
    box((7.0, 1.9, 0.7), at=(0, 0, 0.3), base=True, color=C, tint=True, bevel=0.2, bseg=2)
    box((4.6, 1.74, 0.62), at=(-0.4, 0, 0.95), base=True, color=C, tint=True, bevel=0.15, bseg=1,
        taper=(0.97, 0.9))
    # privacy glass band + chrome belt line
    box((4.4, 1.8, 0.36), at=(-0.4, 0, 1.08), base=True, color="slate")
    box((7.02, 1.92, 0.08), at=(0, 0, 0.88), base=True, color="cloud", lod0=True)
    box((0.12, 1.6, 0.5), at=(2.0, 0, 1.0), rot=(0, -50, 0), base=True, color="slate")
    # bumpers, lights
    for x in (-3.5, 3.5):
        box((0.16, 1.8, 0.22), at=(x, 0, 0.32), base=True, color="cloud")
    for y in (-0.62, 0.62):
        box((0.06, 0.36, 0.16), at=(3.5, y, 0.62), base=True, color="snow", lod0=True)
        box((0.06, 0.36, 0.16), at=(-3.5, y, 0.62), base=True, color="tomato", lod0=True)
    for x in (-2.4, 2.4):
        for y in (-0.9, 0.9):
            _wheel(x, y, 0.36, 0.36, 0.26, color="ink_soft", hub="cloud", segs=10)
    tube([(3.2, 0, 1.0), (3.35, 0, 1.12)], 0.04, color="cloud", segs=4, lod0=True)


@asset("ferry", "Commuter Ferry", "Goes there, comes back, goes there. Has never once turned around.", L,
       "metal", "landmark", variants=["tangerine", "teal", "tomato", "sun"], col="box", fill=0.55)
def ferry():
    O = "tangerine"
    L_, B = 46.0, 13.4

    def plan(l, b, r):
        return rounded_rect_points(l, b, r, corner_segs=3)

    # double-ended hull: dark bottom, orange topsides, rubbing strake
    extrude(plan(L_ - 1.0, B - 0.8, 5.5), 1.8, at=(0, 0, 0), center=False, color="charcoal")
    extrude(plan(L_, B, 6.0), 2.6, at=(0, 0, 1.6), center=False, color=O, tint=True)
    extrude(plan(L_ + 0.3, B + 0.6, 6.2), 0.5, at=(0, 0, 3.6), center=False, color="charcoal")
    # main deck house + upper deck house, window bands
    extrude(plan(L_ - 6.0, B - 1.0, 4.0), 3.0, at=(0, 0, 4.1), center=False, color=O, tint=True)
    extrude(plan(L_ - 5.8, B - 0.8, 4.0), 1.1, at=(0, 0, 5.0), center=False, color="ink_soft")
    extrude(plan(L_ - 5.2, B - 0.2, 4.4), 0.35, at=(0, 0, 7.1), center=False, color=O, tint=True)
    extrude(plan(L_ - 14.0, B - 2.4, 3.0), 2.4, at=(0, 0, 7.45), center=False, color=O, tint=True)
    extrude(plan(L_ - 13.8, B - 2.2, 3.0), 0.9, at=(0, 0, 8.1), center=False, color="ink_soft")
    extrude(plan(L_ - 13.2, B - 1.6, 3.2), 0.3, at=(0, 0, 9.85), center=False, color=O, tint=True)
    # pilot houses at both ends + centre stack with a band
    for k in (-1, 1):
        x = k * 15.0
        box((3.0, 6.0, 1.9), at=(x, 0, 10.15), base=True, color="snow", bevel=0.2, bseg=1)
        box((3.06, 6.06, 0.7), at=(x, 0, 10.75), base=True, color="ink_soft")
        cyl(0.1, 1.5, at=(x - k * 0.5, 0, 12.0), color="ink_soft", segs=4, lod0=True)
    cyl(1.6, 2.8, at=(0, 0, 10.15), color=O, tint=True, segs=10, scale=(1.4, 1, 1))
    cyl(1.65, 0.6, at=(0, 0, 12.35), color="ink_soft", segs=10, scale=(1.4, 1, 1))
    # promenade rails lod0 along the main deck sides
    if not _lod1():
        for y in (-(B - 0.9) / 2, (B - 0.9) / 2):
            box((L_ - 14.0, 0.1, 0.12), at=(0, y, 4.95), base=True, color="snow")
        for k in (-1, 1):
            box((0.9, 0.9, 0.7), at=(k * 21.5, 0, 4.1), base=True, color="ink_soft")


# ---------------------------------------------------------------- infrastructure

@asset("suspension_bridge", "Suspension Bridge", "Six lanes, two towers, one very long hug across the river.", L,
       "metal", "landmark", variants=["slate", "sky", "tomato", "stone"], col="box", fill=0.05, deck=6.0,
       towers=[-210.0, 210.0])
def suspension_bridge():
    T = "slate"
    Lh = 300.0               # half length
    xt, ztop = 210.0, 150.0  # tower position, cable saddle height
    zdeck = 6.0
    yc = 18.3                # cable / tower leg line
    # deck: roadway slab, side stiffening girders (railings), lane lines
    box((2 * Lh, 30.0, 2.0), at=(0, 0, zdeck - 2.0), base=True, color="charcoal")
    for k in (-1, 1):
        box((2 * Lh, 1.0, 4.6), at=(0, k * 15.5, 3.0), base=True, color=T, tint=True)
    for y in (-0.25, 0.25):
        box((2 * Lh, 0.3, 0.06), at=(0, y, zdeck), base=True, color="sun")
    for y in (-7.2, 7.2):
        box((2 * Lh, 0.3, 0.06), at=(0, y, zdeck), base=True, color="snow", lod0=True)
    # towers: two legs each, concrete plinths, portal struts
    for kx in (-1, 1):
        x = kx * xt
        for ky in (-1, 1):
            box((8.0, 6.0, 10.0), at=(x, ky * yc, 0), base=True, color="concrete")
            box((6.0, 4.0, ztop + 2.0), at=(x, ky * yc, 0), base=True, color=T, tint=True, taper=(0.65, 0.75))
            box((4.6, 3.6, 1.6), at=(x, ky * yc, ztop + 0.8), base=True, color=T, tint=True)
        for (z, h) in ((32.0, 4.0), (78.0, 4.0), (122.0, 3.5), (ztop - 3.0, 4.6)):
            box((4.2, 2 * yc, h), at=(x, 0, z), base=True, color=T, tint=True)
        if not _lod1():
            for (za, zb) in ((36.0, 78.0), (82.0, 122.0)):
                ln = math.hypot(2 * yc - 4.0, zb - za)
                ang = math.degrees(math.atan2(zb - za, 2 * yc - 4.0))
                for s in (-1, 1):
                    box((1.4, ln, 1.4), at=(x, 0, (za + zb) / 2), rot=(s * ang, 0, 0), color=T, tint=True)
    # anchorages flanking the road at both ends
    xa = 286.0
    za = 22.0
    for kx in (-1, 1):
        for ky in (-1, 1):
            box((28.0, 5.0, za), at=(kx * xa, ky * 18.5, 0), base=True, color="concrete")
            box((20.0, 5.4, 3.0), at=(kx * (xa + 2.0), ky * 18.5, za), base=True, color="concrete", lod0=True)

    # main cables: parabola between the towers, sagging side spans down into the anchorages
    zs = 13.0

    def zmain(x):
        return zs + (ztop - zs) * (x / xt) ** 2

    def zside(t):
        return ztop + (za - 2.0 - ztop) * t - 7.0 * 4 * t * (1 - t)

    nm = 8 if _lod1() else 16
    ns = 3 if _lod1() else 6
    xe = 280.0
    for ky in (-1, 1):
        y = ky * yc
        pts = [(-xe + (xe - xt) * i / ns, y, zside(1 - i / ns)) for i in range(ns)]
        pts += [(-xt + 2 * xt * i / nm, y, zmain(-xt + 2 * xt * i / nm)) for i in range(nm + 1)]
        pts += [(xt + (xe - xt) * i / ns, y, zside(i / ns)) for i in range(1, ns + 1)]
        tube(pts, 1.1, color=T, tint=True, segs=6, caps=True)
        if not _lod1():
            for i in range(-9, 10):
                x = i * 21.0
                ztopc = zmain(x) - 0.8
                box((0.45, 0.45, ztopc - 7.6), at=(x, y, 7.6), base=True, color="charcoal")
            for kx in (-1, 1):
                for t in (0.25, 0.5, 0.75):
                    x = kx * (xt + (xe - xt) * t)
                    zz = zside(t) - 0.8
                    if zz > 9.0:
                        box((0.45, 0.45, zz - 7.6), at=(x, y, 7.6), base=True, color="charcoal")


@asset("elevated_viaduct", "Elevated Railway", "A railway that decided the street was beneath it.", L, "metal",
       "large", variants=["slate", "pine", "charcoal", "navy"], col="box", fill=0.15, deck=8.5, tile=40.0)
def elevated_viaduct():
    T = "slate"
    Lh = 20.0
    # bents: two columns + cap beam, every 20 m (x = -10, +10 so the spacing holds across tiles)
    for x in (-10.0, 10.0):
        for y in (-3.6, 3.6):
            box((0.9, 0.9, 6.3), at=(x, y, 0), base=True, color=T, tint=True)
            box((1.4, 1.4, 0.35), at=(x, y, 0), base=True, color=T, tint=True, lod0=True)
            if not _lod1():
                s = 1 if y > 0 else -1
                ln = math.hypot(1.6, 1.4)
                box((0.3, ln, 0.3), at=(x, y - s * 0.8, 5.6), rot=(s * -41.0, 0, 0), color=T, tint=True)
        box((1.2, 9.0, 1.0), at=(x, 0, 6.2), base=True, color=T, tint=True)
    # outer lattice girders + inner stringers
    for y in (-4.0, 4.0):
        box((2 * Lh, 0.5, 2.2), at=(0, y, 6.2), base=True, color=T, tint=True)
        if not _lod1():
            s = 1 if y > 0 else -1
            for i in range(8):
                x = -Lh + 2.5 + i * 5.0
                ang = math.degrees(math.atan2(1.8, 4.6))
                box((math.hypot(4.6, 1.8), 0.2, 0.25), at=(x, y + s * 0.3, 7.3),
                    rot=(0, ang if i % 2 else -ang, 0), color="ink_soft")
    for y in (-1.6, 1.6):
        box((2 * Lh, 0.4, 1.2), at=(0, y, 7.2), base=True, color=T, tint=True, lod0=True)
    # deck, tie beds, rails (rail tops exactly at z = 8.5)
    box((2 * Lh, 8.0, 0.25), at=(0, 0, 8.0), base=True, color="charcoal")
    for yt in (-2.0, 2.0):
        box((2 * Lh, 2.6, 0.12), at=(0, yt, 8.25), base=True, color="cocoa")
        for r in (-0.72, 0.72):
            box((2 * Lh, 0.14, 0.13), at=(0, yt + r, 8.37), base=True, color="stone")
    # railings
    for y in (-4.25, 4.25):
        box((2 * Lh, 0.12, 0.12), at=(0, y, 9.3), base=True, color=T, tint=True)
        box((2 * Lh, 0.08, 0.08), at=(0, y, 8.85), base=True, color=T, tint=True, lod0=True)
        for i in range(10):
            box((0.1, 0.1, 1.0), at=(-Lh + 2.0 + i * 4.0, y, 8.4), base=True, color=T, tint=True, lod0=True)


@asset("subway_car", "Subway Car", "Stand clear of the closing doors. Especially you, ball.", L, "metal", "large",
       variants=["tomato", "cobalt", "leaf", "sun", "grape"], col="box", fill=0.8)
def subway_car():
    Lc, Wc = 18.0, 3.2
    # trucks + wheels (bottom at z = 0)
    for x in (-6.4, 6.4):
        box((2.8, 2.4, 0.5), at=(x, 0, 0.3), base=True, color="charcoal")
        for dx in (-0.9, 0.9):
            cyl(0.42, 2.0, at=(x + dx, 0, 0.42), rot=(90, 0, 0), base=False, color="ink_soft", segs=8,
                lod0=False)
    box((15.0, 2.8, 0.5), at=(0, 0, 0.8), base=True, color="charcoal")
    # stainless body + roof
    box((Lc, Wc, 2.35), at=(0, 0, 1.15), base=True, color="cloud", bevel=0.18, bseg=1)
    box((Lc - 0.6, Wc - 0.5, 0.15), at=(0, 0, 3.45), base=True, color="stone")
    # window band, colour stripe, doors (front + back faces in one box each)
    box((Lc - 1.2, Wc + 0.06, 0.8), at=(0, 0, 2.3), base=True, color="ink_soft")
    box((Lc + 0.04, Wc + 0.06, 0.3), at=(0, 0, 1.75), base=True, color="tomato", tint=True)
    for x in (-5.5, 0.0, 5.5):
        box((1.4, Wc + 0.1, 2.05), at=(x, 0, 1.25), base=True, color="stone")
        box((0.5, Wc + 0.14, 0.8), at=(x - 0.33, 0, 2.3), base=True, color="ink_soft", lod0=True)
        box((0.5, Wc + 0.14, 0.8), at=(x + 0.33, 0, 2.3), base=True, color="ink_soft", lod0=True)
    if not _lod1():
        for x in (-8.0, -2.75, 2.75, 8.0):
            box((0.25, Wc + 0.08, 0.8), at=(x, 0, 2.3), base=True, color="cloud")
    # cab end (+X): windscreen, route sign, headlights; rear end window
    box((0.1, 2.4, 0.8), at=(Lc / 2, 0, 2.3), base=True, color="ink_soft")
    box((0.1, 1.6, 0.35), at=(Lc / 2, 0, 3.15), base=True, color="ink")
    cyl(0.3, 0.12, at=(Lc / 2 + 0.05, -0.75, 1.65), rot=(0, 90, 0), base=False, color="tomato", tint=True,
        segs=8, lod0=True)
    for y in (0.5, 1.1):
        box((0.1, 0.3, 0.2), at=(Lc / 2, y, 1.5), base=True, color="snow", lod0=True)
    box((0.1, 1.2, 0.8), at=(-Lc / 2, 0, 2.3), base=True, color="ink_soft")


# ---------------------------------------------------------------- airport, port, park

def _roof_z(y):
    """Top of the terminal's wave roof (y = -25 front edge ... 25 back)."""
    return 13.4 + 6.4 * math.sin(math.pi * (y + 25.0) / 46.0)


@asset("airport_terminal", "Airport Terminal", "Arrivals left, departures left, baggage claim also left.", L,
       "glass", "landmark", variants=["cloud", "sky", "mint", "butter"], col="box", fill=0.6)
def airport_terminal():
    Lx = 180.0
    yb, ye = -25.0, 14.0
    k = seg(10, 5)
    ys = [yb + (ye - yb) * i / k for i in range(k + 1)]
    tk = 1.5

    def zb(y):
        return _roof_z(y) - tk

    # concourse hall under the roof (profile follows the roof underside)
    pts = [(-14.0, 0.0), (12.0, 0.0), (12.0, zb(12.0) + 0.3)] + \
          [(y, zb(y) + 0.3) for y in reversed(ys) if -14.0 < y < 12.0] + [(-14.0, zb(-14.0) + 0.3)]
    extrude(pts, Lx - 4.0, rot=(90, 0, 90), color="concrete")
    # glass front wall, leaning out
    gpts = [(-20.0, 0.0), (-14.0, 0.0), (-14.0, zb(-14.0) + 0.3)] + \
           [(y, zb(y) + 0.3) for y in reversed(ys) if -21.0 < y < -14.0] + [(-21.5, zb(-21.5) + 0.3)]
    extrude(gpts, Lx - 4.0, rot=(90, 0, 90), color="glass")
    if not _lod1():
        for i in range(17):
            x = -84.0 + i * 10.5
            box((0.6, 0.6, 13.8), at=(x, -20.2, 0), rot=(5.4, 0, 0), base=True, color="snow")
        box((Lx - 4.2, 0.6, 0.6), at=(0, -20.75, 4.6), base=True, color="snow")
    # wave roof (tinted), with tree columns under the front overhang
    top = [(y, _roof_z(y)) for y in ys]
    bot = [(y, zb(y)) for y in reversed(ys)]
    extrude(top + bot, Lx, rot=(90, 0, 90), color="cloud", tint=True)
    for i in range(5):
        x = -72.0 + i * 36.0
        cyl(0.7, zb(-23.0) + 0.2, at=(x, -23.0, 0), color="snow", segs=6)
    # drop-off kerb + entrance doors
    box((Lx - 4.0, 4.0, 0.4), at=(0, -22.5, 0), base=True, color="stone")
    for x in (-50.0, 0.0, 50.0):
        box((8.0, 0.5, 3.6), at=(x, -20.3, 0.4), base=True, color="ink_soft")
    # jet bridges on the airside (+Y)
    for x in (-60.0, -20.0, 20.0, 60.0):
        box((3.2, 13.0, 3.2), at=(x, 18.5, 4.5), base=True, color="stone", bevel=0.3, bseg=1)
        box((4.2, 3.0, 4.0), at=(x, 23.5, 4.2), base=True, color="stone")
        box((4.4, 0.6, 2.4), at=(x, 24.7, 4.9), base=True, color="ink_soft", lod0=True)
        cyl(0.4, 4.5, at=(x, 22.5, 0), color="ink_soft", segs=6)
    # sign band over the entrance
    box((40.0, 0.6, 2.2), at=(0, -21.45, 10.0), base=True, color="ink_soft")
    if not _lod1():
        for i in range(6):
            box((4.0, 0.2, 1.0), at=(-15.0 + i * 6.0, -21.8, 10.6), base=True, color="sun")


@asset("control_tower", "Control Tower", "Tells planes where to go. Politely. Over and over.", L, "stone",
       "landmark", variants=["concrete", "cloud", "sand"], col="cyl", fill=0.3)
def control_tower():
    C = "concrete"
    box((14.0, 14.0, 6.0), base=True, color=C, tint=True, bevel=0.4)
    _front(10.0, 3.0, 0, 0.0, -7.0, 0.2, "glass")
    cyl(3.3, 39.0, at=(0, 0, 6.0), r2=2.9, color=C, tint=True, segs=10)
    box((1.4, 0.5, 30.0), at=(0, -3.1, 8.0), base=True, color="glass", lod0=True)
    zc = 44.0
    lathe([(2.9, zc - 2.5), (4.0, zc - 1.2), (6.2, zc), (6.2, zc + 0.6)], color=C, tint=True, segs=10)
    cyl(6.2, 4.6, at=(0, 0, zc + 0.6), r2=7.0, color="glass", segs=10)
    if not _lod1():
        for i in range(10):
            a = 360.0 * i / 10 + 18.0
            r = 6.3
            box((0.25, 0.25, 4.7), at=(r * math.cos(math.radians(a)), r * math.sin(math.radians(a)), zc + 0.55),
                rot=(0, 10, a), base=True, color="ink_soft")
    cyl(7.2, 1.2, at=(0, 0, zc + 5.2), color="ink_soft", segs=10)
    cyl(5.0, 0.8, at=(0, 0, zc + 6.4), r2=4.0, color=C, tint=True, segs=10)
    sphere(1.4, at=(-2.0, 0, zc + 8.2), color="snow", segs=8, rings=5)
    cyl(0.16, 3.6, at=(2.0, 1.0, zc + 7.2), color="tomato", segs=4)
    for z in (zc + 8.0, zc + 9.6):
        cyl(0.2, 0.5, at=(2.0, 1.0, z), color="snow", segs=4, lod0=True)


@asset("hangar", "Hangar", "A very large garage for a very large car with wings.", L, "metal", "landmark",
       variants=["cloud", "sky", "stone", "mint"], col="box", fill=0.8)
def hangar():
    W, H, D = 70.0, 24.0, 54.0
    n = seg(12, 6)
    arch = [(W / 2 * math.cos(math.pi * i / n), H * math.sin(math.pi * i / n)) for i in range(n + 1)]
    extrude(arch, D, rot=(90, 0, 0), color="cloud", tint=True)
    # rib arches
    if not _lod1():
        rib = [(x * 1.012, z * 1.02) for (x, z) in arch]
        for y in (-13.5, 0.0, 13.5):
            extrude(rib, 1.0, at=(0, y, 0), rot=(90, 0, 0), color="stone")
    rib = [(x * 1.012, z * 1.02) for (x, z) in arch]
    for sy in (-1, 1):
        extrude(rib, 1.2, at=(0, sy * (D / 2 + 0.1), 0), rot=(90, 0, 0), color="stone")
    # big sliding doors on the front (-Y) with a hazard stripe, a lintel and a glazed tympanum
    yf = -D / 2 - 0.7

    def arch_z(x):
        return H * math.sqrt(max(0.0, 1 - (x / (W / 2)) ** 2))

    nd = 6
    dw = 58.0 / nd
    for i in range(nd):
        x = -29.0 + dw * (i + 0.5)
        box((dw - 0.25, 0.5 + (i % 2) * 0.3, 16.0), at=(x, yf - 0.25 - (i % 2) * 0.15, 0), base=True,
            color="slate")
    box((58.0, 1.1, 1.2), at=(0, yf - 0.55, 0.0), base=True, color="sun")
    box((60.0, 1.0, 1.4), at=(0, yf - 0.5, 16.0), base=True, color="stone")
    for x in (-15.5, -9.0, 9.0, 15.5):
        h = arch_z(abs(x) + 2.8) - 17.8 - 1.0
        box((5.0, 0.4, h), at=(x, yf - 0.2, 17.8), base=True, color="glass", lod0=abs(x) > 10.0)
    # hangar number 42 over the doors
    for (d, x) in ((4, -1.7), (2, 1.7)):
        _digit(d, x, 17.9, yf, 4.4, "ink_soft", out=0.4)


@asset("pier_shed", "Pier Shed", "Pier 57. Smells of fish, rope and quiet ambition.", L, "stone", "landmark",
       variants=["teal", "slate", "brick", "sky"], col="box", fill=0.8, facade=14.0)
def pier_shed():
    W, D = 110.0, 28.0
    T = "teal"
    yf = -D / 2
    # pier deck
    box((W, D + 4.0, 1.2), base=True, color="concrete")
    if not _lod1():
        for i in range(12):
            x = -W / 2 + 2.0 + i * (W - 4.0) / 11
            for y in (-(D + 4.0) / 2 + 0.6, (D + 4.0) / 2 - 0.6):
                cyl(0.35, 0.6, at=(x, y, 1.2), color="ink_soft", segs=6)
    # shed body + low gable roof with a glazed monitor
    Hs = 9.0
    box((W - 4.0, D, Hs), at=(0, 0, 1.2), base=True, color=T, tint=True)
    extrude([(-D / 2 - 0.5, 0.0), (D / 2 + 0.5, 0.0), (0.0, 2.6)], W - 3.0, at=(0, 0, 1.2 + Hs), rot=(90, 0, 90),
            color="stone")
    box((W - 16.0, 6.0, 1.4), at=(0, 0, 1.2 + Hs + 1.6), base=True, color="glass")
    box((W - 15.0, 7.2, 0.5), at=(0, 0, 1.2 + Hs + 3.0), base=True, color="stone")
    # cargo doors (front + back in one box) and a clerestory window band
    for i in range(10):
        x = -46.0 + i * 10.2
        if abs(x) < 14.0:
            continue
        box((6.4, D + 0.3, 6.0), at=(x, 0, 1.2), base=True, color="sun")
        box((6.4, D + 0.36, 0.3), at=(x, 0, 4.0), base=True, color="ink_soft", lod0=True)
    box((W - 4.04, D + 0.2, 1.4), at=(0, 0, 8.0), base=True, color="glass", lod0=True)
    if _lod1():
        box((W - 4.04, D + 0.2, 1.0), at=(0, 0, 8.2), base=True, color="glass")
    # Beaux-Arts headhouse in the middle of the front with the big pier number
    hw = 13.0
    box((2 * hw, D + 1.4, 12.0), at=(0, 0, 1.2), base=True, color="concrete")
    box((2 * hw - 6.0, D + 1.6, 1.6), at=(0, 0, 13.2), base=True, color="concrete")
    box((2 * hw + 1.0, D + 1.8, 0.8), at=(0, 0, 12.4), base=True, color="stone")
    box((8.0, D + 1.6, 6.5), at=(0, 0, 1.2), base=True, color="ink_soft")
    cyl(4.0, D + 1.6, at=(0, 0, 7.7), rot=(90, 0, 0), base=False, color="ink_soft", segs=12)
    for (dgt, x) in ((5, -8.6), (7, 8.6)):
        _digit(dgt, x, 3.0, yf - 0.7, 7.5, "ink_soft", out=0.35)


@asset("bandshell", "Bandshell", "Half a dome, full volume. Pigeons get the front row.", L, "stone", "large",
       variants=["teal", "cobalt", "grape", "tomato"], col="box", fill=0.5)
def bandshell():
    zs = 1.4
    # stage with a curved apron + steps
    n = seg(8, 4)
    apron = [(-11.0, 2.0), (11.0, 2.0), (11.0, -3.0)] + \
            [(11.0 * math.cos(math.radians(a)), -3.0 - 4.0 * math.sin(math.radians(a)))
             for a in [i * 180.0 / n for i in range(1, n)]] + [(-11.0, -3.0)]
    extrude(apron, zs, at=(0, 0, 0), center=False, color="concrete")
    box((5.0, 1.6, zs / 3), at=(0, -7.6, 0), base=True, color="stone")
    box((5.0, 1.0, 2 * zs / 3), at=(0, -7.3, 0), base=True, color="stone", lod0=True)
    # back wall: a half-disc in the tint colour
    nb = seg(10, 5)
    disc = [(9.0 * math.cos(math.pi * i / nb), 9.0 * math.sin(math.pi * i / nb)) for i in range(nb + 1)]
    extrude(disc, 1.0, at=(0, 7.0, zs), rot=(90, 0, 0), color="teal", tint=True)
    # telescoping shell: concentric half-rings stepping back, alternating paper / snow
    rings = [(11.2, -1.2, "paper"), (10.2, 1.2, "snow"), (9.2, 3.6, "paper"), (8.4, 5.8, "snow")]
    for (R, y, c) in rings:
        torus(R, 0.75, at=(0, y, zs), rot=(90, 0, 0), arc=180.0, color=c, segs=14, rsegs=4, scale=(1, 1, 1.9))
    # lyre finial + two lamp posts
    cyl(0.25, 0.9, at=(0, -1.2, zs + 11.8), color="sun", segs=6)
    sphere(0.5, at=(0, -1.2, zs + 12.9), color="sun", segs=6, rings=4)
    for k in (-1, 1):
        cyl(0.1, 3.0, at=(k * 10.0, -6.0, zs), color="ink_soft", segs=4, lod0=True)
        sphere(0.3, at=(k * 10.0, -6.0, zs + 3.1), color="butter", segs=6, rings=4, lod0=True)


@asset("rooftop_water_tank", "Water Tank", "A wooden barrel on stilts. Holds the building's bathwater and secrets.",
       L, "wood", "small", variants=["caramel", "sand", "cocoa"], col="cyl", fill=0.55)
def rooftop_water_tank():
    r = 1.9
    for (kx, ky) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        box((0.26, 0.26, 2.3), at=(kx * 1.3, ky * 1.3, 0), base=True, color="charcoal")
    for ky in (-1, 1):
        box((3.0, 0.3, 0.3), at=(0, ky * 1.3, 2.2), base=True, color="charcoal")
        if not _lod1():
            ln = math.hypot(2.6, 1.9)
            box((ln, 0.12, 0.14), at=(0, ky * 1.38, 1.15), rot=(0, math.degrees(math.atan2(1.9, 2.6)), 0),
                color="charcoal")
    box((3.6, 3.6, 0.2), at=(0, 0, 2.5), base=True, color="charcoal")
    cyl(r, 3.2, at=(0, 0, 2.7), color="caramel", tint=True, segs=12)
    for t in (0.18, 0.5, 0.82):
        cyl(r + 0.06, 0.14, at=(0, 0, 2.7 + 3.2 * t), color="charcoal", segs=12, lod0=t != 0.5)
    cyl(r + 0.15, 1.25, at=(0, 0, 5.9), r2=0.12, color="charcoal", segs=12)
    sphere(0.16, at=(0, 0, 7.18), color="charcoal", segs=6, rings=4, lod0=True)
    box((0.3, 0.1, 3.4), at=(0.5, -r - 0.05, 2.7), base=True, color="charcoal", lod0=True)


@asset("park_lamp", "Park Lamp", "Lights the path, charms the moths, ignores the squirrels.", L, "metal", "small",
       variants=["charcoal", "pine", "navy"], col="cyl", fill=0.15)
def park_lamp():
    C = "charcoal"
    lathe([(0.24, 0.0), (0.24, 0.2), (0.17, 0.3), (0.15, 0.8), (0.09, 0.95), (0.06, 1.05), (0.055, 3.05),
           (0.11, 3.12), (0.11, 3.2), (0.0, 3.2)], color=C, tint=True, segs=8)
    lathe([(0.1, 3.2), (0.2, 3.38), (0.22, 3.55), (0.15, 3.75), (0.0, 3.82)], color="butter", segs=8)
    cyl(0.17, 0.12, at=(0, 0, 3.72), r2=0.08, color=C, tint=True, segs=8)
    cyl(0.03, 0.2, at=(0, 0, 3.82), color=C, tint=True, segs=4, lod0=True)
    sphere(0.05, at=(0, 0, 4.03), color=C, tint=True, segs=5, rings=3, lod0=True)
