"""Level 5 — Small Town, part 2: the river town "Puddleford" (CITY.md). Objects face -Y; base at z = 0; metres.

Main Street storefronts are PARTY-WALL buildings: wall depth 14 m, flat windowless +-X side walls, front
facade plane at y = -7. Front trim (awnings, cornices, bays) reaches exactly y = -7.7 and every storefront has
a rear stoop reaching exactly y = +7.7, so the bounding box stays centred on the walls: after finalize() the
facade sits at exactly 7.0 m in front of the origin for every storefront, and rows line up.

Vehicles, rolling stock and boats run along X with their nose at +X. Rotating parts (ferris wheel ring,
windmill sails, water wheel) are separate assets, symmetric about their bounding-box centre, axle along Y.
Bridges: deck runs along X, structure starts at z = 0, top of the road deck at exactly z = 4.5.
"""
import math

from mathutils import Matrix, Vector

from lib.core import STATE, box, cyl, sphere, ico, torus, lathe, extrude, tube
from lib.registry import asset

L = 5

SF_D = 14.0      # storefront wall depth
SF_FY = -7.0     # storefront facade plane
SF_REACH = 0.7   # front trim / rear stoop reach beyond the walls
SF_WALLS = ["brick", "cocoa", "sand", "concrete", "caramel", "mint"]


# ---------------------------------------------------------------- local helpers (l5_town idioms)

def _lod1():
    return STATE.lod > 0


def _dot_eyes(at, spacing, r, yaw=0.0, color="ink", segs=6):
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
    """Flat convex polygon through 3D points (in order), given a thickness."""
    P = [Vector(p) for p in pts]
    p0 = P[0]
    ex = (P[1] - p0).normalized()
    n = (P[1] - p0).cross(P[2] - p0).normalized()
    ey = n.cross(ex)
    m = Matrix((ex, ey, n)).transposed()
    rot = tuple(math.degrees(a) for a in m.to_euler("XYZ"))
    loc = [((p - p0).dot(ex), (p - p0).dot(ey)) for p in P]
    extrude(loc, thick, at=tuple(p0), rot=rot, color=color, tint=tint, lod0=lod0)


def _wheel(at, r, w, tyre="ink_soft", hub="cloud", segs=14, hub_r=None, hub_segs=8):
    """Chunky toy wheel with its axle along Y."""
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


def _beam(p0, p1, w, h, color, tint=False, lod0=False):
    """Box beam from p0 to p1 in the XZ plane (y taken from p0), w across (Y), h thick."""
    dx, dz = p1[0] - p0[0], p1[2] - p0[2]
    ln = math.hypot(dx, dz)
    ang = math.degrees(math.atan2(dz, dx))
    box((ln, w, h), at=((p0[0] + p1[0]) / 2, p0[1], (p0[2] + p1[2]) / 2), rot=(0, -ang, 0), color=color,
        tint=tint, lod0=lod0)


def _arch_pts(w, h, step=30):
    """Round-headed opening: rectangle of height h with a semicircle on top (local x, z)."""
    r = w / 2
    return [(-r, 0), (r, 0)] + [(r * math.cos(math.radians(a)), h + r * math.sin(math.radians(a)))
                                for a in range(0, 181, step)]


def _arch_win(x, y, z, w, h, color="glass", trim="paper", rot_z=0.0):
    """Arched window on a -Y facing wall at plane y: glass in front of a trim surround. LOD1: plain box."""
    if _lod1():
        box((w, 0.14, h + w * 0.4), at=(x, y - 0.05, z), base=True, color=color)
        return
    extrude([(px * 1.28, pz * 1.0 + (0.12 if pz > 0 else -0.1)) for (px, pz) in _arch_pts(w, h, 45)], 0.12,
            at=(x, y - 0.06, z), rot=(90, 0, rot_z), color=trim)
    extrude(_arch_pts(w, h, 30), 0.14, at=(x, y - 0.07, z), rot=(90, 0, rot_z), color=color)
    box((0.3, 0.2, 0.36), at=(x, y - 0.1, z + h + w / 2 - 0.05), base=True, color=trim)


def _sash(x, z, w, h, trim="paper", y=SF_FY, glass_lod0=False):
    """Front sash window with lintel and sill (trim), plus a meeting rail."""
    _win(x, y, z, w, h, lod0=glass_lod0)
    box((w + 0.4, 0.3, 0.32), at=(x, y - 0.05, z + h), base=True, color=trim, lod0=True)
    box((w + 0.25, 0.32, 0.14), at=(x, y - 0.06, z - 0.14), base=True, color=trim, lod0=True)
    box((w, 0.2, 0.08), at=(x, y - 0.03, z + h * 0.5), base=True, color=trim, lod0=True)


def _side_sash(x, y, z, w, h, trim="paper"):
    """Sash window on a +X facing wall at plane x."""
    _win(x, y, z, w, h, face="+x", lod0=False)
    box((0.3, w + 0.4, 0.32), at=(x + 0.05, y, z + h), base=True, color=trim, lod0=True)
    box((0.32, w + 0.25, 0.14), at=(x + 0.06, y, z - 0.14), base=True, color=trim, lod0=True)


def _awning(x0, x1, z, depth, drop, n, color, other="paper", tint=False, fy=SF_FY):
    """Striped fabric awning from the facade at fy, sloping out to exactly fy - depth (valance face)."""
    w = (x1 - x0) / n
    ln = math.hypot(depth - 0.06, drop)
    ang = math.degrees(math.atan2(drop, depth - 0.06))
    for i in range(n):
        c, t = (color, tint) if i % 2 == 0 else (other, False)
        x = x0 + w * (i + 0.5)
        box((w + 0.01, ln, 0.1), at=(x, fy - (depth - 0.06) / 2, z - drop / 2), rot=(ang, 0, 0), color=c, tint=t)
        box((w + 0.01, 0.06, 0.42), at=(x, fy - depth + 0.03, z - drop - 0.36), base=True, color=c, tint=t)


def _rear_stoop(x, W, color="stone", door="cocoa"):
    """Back door + stoop reaching exactly y = SF_D/2 + SF_REACH (balances the front trim)."""
    box((1.8, SF_REACH, 0.3), at=(x, SF_D / 2 + SF_REACH / 2, 0), base=True, color=color)
    box((1.1, 0.12, 2.3), at=(x, SF_D / 2 + 0.04, 0.3), base=True, color=door)
    box((1.6, SF_REACH - 0.05, 0.12), at=(x, SF_D / 2 + (SF_REACH - 0.05) / 2, 2.75), base=True, color=color,
        lod0=True)


def _parapets(W, H, h=0.6, front_y=-6.3, color="brick", tint=True):
    """Flat-roof parapets on the side and back walls (flush with the party walls)."""
    for s in (-1, 1):
        box((0.3, SF_D / 2 - front_y, h), at=(s * (W / 2 - 0.15), (front_y + SF_D / 2) / 2, H), base=True,
            color=color, tint=tint)
    box((W, 0.3, h), at=(0, SF_D / 2 - 0.15, H), base=True, color=color, tint=tint)


def _letters(x0, x1, y, z, h, n, color="paper", lod0=True, face="-y"):
    """Row of chunky letter blocks on a sign (detail, LOD0 only unless lod0=False). face '+x'/'-x' runs along Y."""
    w = (x1 - x0) / (n * 1.4)
    for i in range(n):
        t = x0 + (x1 - x0) * (i + 0.5) / n
        ww = w * (1.0 if i % 3 else 0.7)
        if face in ("-y", "+y"):
            box((ww, 0.1, h), at=(t, y, z), base=True, color=color, lod0=lod0)
        else:
            box((0.1, ww, h), at=(y, t, z), base=True, color=color, lod0=lod0)


def _shopfront(x0, x1, door_x, door_w, gf, frame, sign_z, glass="glass", transom=False, fy=SF_FY):
    """Ground-floor shopfront between x0 and x1 at the facade: bulkhead + display glass + recessed door.
    The ground-floor wall body behind must start at y = fy + 1.0 (the recess depth)."""
    rec = 1.0
    segs = []
    if door_x - door_w / 2 > x0 + 0.1:
        segs.append((x0, door_x - door_w / 2))
    if door_x + door_w / 2 < x1 - 0.1:
        segs.append((door_x + door_w / 2, x1))
    top = sign_z
    for (a, b) in segs:
        w = b - a
        c = (a + b) / 2
        box((w, rec + 0.05, 0.7), at=(c, fy + rec / 2 - 0.025, 0), base=True, color=frame)
        gh = top - 0.7 - (0.75 if transom else 0.0)
        box((w, 0.15, gh), at=(c, fy + 0.05, 0.7), base=True, color=glass)
        box((w, rec, 0.12), at=(c, fy + rec / 2, top - 0.12), base=True, color=frame)
        if transom:
            box((w, 0.2, 0.14), at=(c, fy + 0.02, 0.7 + gh), base=True, color=frame)
            box((w, 0.15, 0.61), at=(c, fy + 0.05, 0.84 + gh), base=True, color=glass)
            nm = max(1, int(round(w / 0.9)))
            for i in range(1, nm):
                box((0.08, 0.22, 0.61), at=(a + w * i / nm, fy, 0.84 + gh), base=True, color=frame, lod0=True)
        # mullion + returns into the recess
        if w > 2.6:
            box((0.14, 0.24, gh), at=(c, fy, 0.7), base=True, color=frame, lod0=True)
        for e in (a, b):
            if abs(e - (door_x - door_w / 2)) < 1e-6 or abs(e - (door_x + door_w / 2)) < 1e-6:
                ex = e + (0.06 if e < door_x else -0.06)
                box((0.12, rec, top - 0.7), at=(ex, fy + rec / 2, 0.7), base=True, color=glass)
    # recessed door: step, door leaf with glass, transom over the door
    box((door_w, rec, 0.15), at=(door_x, fy + rec / 2, 0), base=True, color="stone")
    box((door_w * 0.62, 0.14, 2.55), at=(door_x, fy + rec - 0.02, 0.15), base=True, color=frame)
    box((door_w * 0.4, 0.18, 1.5), at=(door_x, fy + rec - 0.04, 1.0), base=True, color=glass, lod0=True)
    box((door_w, rec, top - 2.7), at=(door_x, fy + rec / 2, 2.7), base=True, color=glass)
    box((door_w, rec + 0.02, 0.12), at=(door_x, fy + rec / 2, 2.7), base=True, color=frame, lod0=True)


# ---------------------------------------------------------------- Main Street storefronts

@asset("storefront_a", "Brick Storefront", "Two floors of brick, one awning, and a sale that never ends.", L,
       "stone", "large", variants=SF_WALLS, col="box", fill=0.9)
def storefront_a():
    W, H, GF = 10.0, 9.4, 4.2
    fy = SF_FY
    wall = dict(color="brick", tint=True)
    box((W, SF_D - 1.0, H), at=(0, 0.5, 0), base=True, **wall)
    box((W, 1.0, H - GF), at=(0, fy + 0.5, GF), base=True, **wall)
    # brick piers at the party walls, carrying the sign band
    for s in (-1, 1):
        box((0.6, 1.15, GF), at=(s * (W / 2 - 0.3), fy + 0.425, 0), base=True, **wall)
        box((0.7, 0.3, 0.3), at=(s * (W / 2 - 0.35), fy - 0.05, 3.0), base=True, color="paper", lod0=True)
    _shopfront(-W / 2 + 0.6, W / 2 - 0.6, 3.5, 1.8, GF, "pine", 3.3)
    box((W - 1.2, 1.25, 0.9), at=(0, fy + 0.375, 3.3), base=True, color="pine")
    _letters(-3.2, 3.2, fy - 0.3, 3.52, 0.46, 7, color="paper")
    _awning(-W / 2 + 0.6, W / 2 - 0.6, 3.3, SF_REACH, 1.0, 8, "pine", "paper")
    # belt course + upper sash windows
    box((W, 0.2, 0.25), at=(0, fy - 0.05, GF), base=True, color="paper", lod0=True)
    for x in (-3.0, 0.0, 3.0):
        _sash(x, 5.3, 1.4, 2.4)
    # cornice with brackets, parapets, flat roof, chimney
    box((W, 1.25, 0.6), at=(0, fy - 0.55 + 0.625, H), base=True, color="paper")
    box((W, 0.2, 0.3), at=(0, fy - 0.08, H - 0.45), base=True, color="paper", lod0=True)
    for i in range(7):
        box((0.22, 0.4, 0.4), at=(-W / 2 + 0.6 + i * (W - 1.2) / 6, fy - 0.25, H - 0.4), base=True, color="paper",
            lod0=True)
    _parapets(W, H, front_y=fy + 0.7)
    box((W - 0.6, SF_D - 1.6, 0.06), at=(0, 0.5, H), base=True, color="stone")
    box((1.0, 1.4, 1.0), at=(-W / 2 + 0.8, 5.0, H), base=True, **wall)
    box((2.2, 2.0, 1.3), at=(1.8, 4.0, H), base=True, color="stone", lod0=True)
    # back: stoop + a couple of windows
    _rear_stoop(2.5, W)
    for x in (-2.5, 2.5):
        _win(x, SF_D / 2, 5.6, 1.2, 1.8, face="+y")


@asset("storefront_b", "Three-Storey Block", "Built 1887. Still arguing with the building next door.", L,
       "stone", "large", variants=SF_WALLS, col="box", fill=0.9)
def storefront_b():
    W, H, GF = 12.0, 12.0, 4.4
    fy = SF_FY
    wall = dict(color="brick", tint=True)
    box((W, SF_D - 1.0, H), at=(0, 0.5, 0), base=True, **wall)
    box((W, 1.0, H - GF), at=(0, fy + 0.5, GF), base=True, **wall)
    for s in (-1, 1):
        box((0.6, 1.2, GF), at=(s * (W / 2 - 0.3), fy + 0.4, 0), base=True, color="navy")
    _shopfront(-W / 2 + 0.6, W / 2 - 0.6, 0.0, 2.2, GF, "navy", 3.7, transom=True)
    box((W - 1.2, 1.3, 0.7), at=(0, fy + 0.35, 3.7), base=True, color="navy")
    _letters(-3.8, 3.8, fy - 0.35, 3.84, 0.42, 8, color="sun")
    # belt courses
    box((W, 0.3, 0.3), at=(0, fy - 0.05, GF), base=True, color="paper")
    box((W, 0.2, 0.22), at=(0, fy - 0.05, 8.2), base=True, color="paper", lod0=True)
    # arched windows on floors 2 + 3
    for z in (5.0, 8.75):
        for x in (-4.2, -1.4, 1.4, 4.2):
            _arch_win(x, fy, z, 1.3, 1.75)
            box((1.55, 0.32, 0.14), at=(x, fy - 0.08, z - 0.14), base=True, color="paper", lod0=True)
    # decorative cornice with brackets + date plaque pediment
    box((W, 1.3, 0.5), at=(0, fy - 0.7 + 0.65, H), base=True, color="paper")
    box((W, 0.25, 0.45), at=(0, fy - 0.1, H - 0.55), base=True, color="paper")
    for i in range(9):
        box((0.24, 0.45, 0.55), at=(-W / 2 + 0.5 + i * (W - 1.0) / 8, fy - 0.35, H - 0.55), base=True,
            color="paper", lod0=True)
    box((3.8, 0.55, 0.55), at=(0, fy - 0.08, H + 0.5), base=True, color="paper")
    extrude([(-2.1, 0), (2.1, 0), (0, 0.65)], 0.55, at=(0, fy - 0.08, H + 1.05), rot=(90, 0, 0), color="paper")
    box((2.4, 0.1, 0.4), at=(0, fy - 0.38, H + 0.58), base=True, color="navy", lod0=True)
    for i in range(4):
        box((0.3, 0.1, 0.28), at=(-0.75 + i * 0.5, fy - 0.42, H + 0.64), base=True, color="sun", lod0=True)
    _parapets(W, H, h=0.95, front_y=fy + 0.6)
    box((W - 0.6, SF_D - 1.4, 0.06), at=(0, 0.6, H), base=True, color="stone")
    box((2.4, 2.4, 1.8), at=(-2.5, 3.0, H), base=True, color="stone")
    box((1.0, 1.2, 1.8), at=(W / 2 - 0.8, 6.0, H), base=True, **wall)
    _rear_stoop(-3.0, W)
    for x in (-3.0, 3.0):
        for z in (5.4, 9.0):
            _win(x, SF_D / 2, z, 1.2, 1.8, face="+y")


@asset("storefront_c", "Painted False-Front", "A tall front for a short building. Very Main Street.", L,
       "stone", "large", variants=["sky", "butter", "bubblegum", "mint", "lavender", "brick"], col="box", fill=0.85)
def storefront_c():
    W, H, GF = 8.0, 6.8, 3.9
    fy = SF_FY
    wall = dict(color="sky", tint=True)
    box((W, SF_D - 1.0, H), at=(0, 0.5, 0), base=True, **wall)
    box((W, 1.0, H - GF), at=(0, fy + 0.5, GF), base=True, **wall)
    # low gable roof hidden behind the false front (ridge front-to-back, no eaves past the party walls)
    box((W, SF_D - 0.3, 1.25), at=(0, 0.15, H), base=True, taper=(0.04, 1.0), color="slate")
    # false front with a curved crest
    zc = 8.0 - GF  # crest springs from the cornice band (local z above GF)
    crest = [(-W / 2, 0), (W / 2, 0), (W / 2, zc), (2.8, zc)]
    for a in range(30, 151, 30 if not _lod1() else 60):
        crest.append((2.8 * math.cos(math.radians(a)), zc + 1.05 * math.sin(math.radians(a))))
    crest += [(-2.8, zc), (-W / 2, zc)]
    extrude(crest, 0.35, at=(0, fy + 0.125, GF), rot=(90, 0, 0), color="sky", tint=True)
    # cornice band (reaches the trim line) + brackets, round attic window in the crest
    box((W, 0.8, 0.38), at=(0, fy - SF_REACH + 0.4, 7.62), base=True, color="snow")
    for i in range(6):
        box((0.2, 0.42, 0.42), at=(-W / 2 + 0.5 + i * (W - 1.0) / 5, fy - 0.2, 7.2), base=True, color="snow",
            lod0=True)
    cyl(0.42, 0.2, at=(0, fy - 0.12, 8.5), rot=(90, 0, 0), base=False, color="snow", segs=10)
    cyl(0.28, 0.24, at=(0, fy - 0.14, 8.5), rot=(90, 0, 0), base=False, color="glass", segs=10, lod0=True)
    # shopfront
    for s in (-1, 1):
        box((0.5, 1.1, GF), at=(s * (W / 2 - 0.25), fy + 0.45, 0), base=True, color="snow")
    _shopfront(-W / 2 + 0.5, W / 2 - 0.5, 2.6, 1.8, GF, "cocoa", 3.2)
    box((W - 1.0, 1.15, 0.7), at=(0, fy + 0.425, 3.2), base=True, color="snow")
    _letters(-2.6, 2.6, fy - 0.2, 3.36, 0.4, 6, color="cocoa")
    # upstairs bay window (projects 0.6)
    bay = [(-1.7, 0.0), (1.7, 0.0), (1.15, -0.6), (-1.15, -0.6)]
    extrude(bay, 2.4, at=(0, fy, GF + 0.6), color="snow", center=False)
    extrude([(x * 1.06, y * 1.0 - 0.03) for (x, y) in bay], 0.3, at=(0, fy - 0.01, GF + 3.0), color="sky",
            tint=True, center=False)
    extrude([(x * 0.92, y * 0.95 + 0.02) for (x, y) in bay], 0.35, at=(0, fy - 0.01, GF + 0.3), color="sky",
            tint=True, center=False)
    box((1.9, 0.14, 1.7), at=(0, fy - 0.62, GF + 0.95), base=True, color="glass")
    for s in (-1, 1):
        box((0.6, 0.12, 1.7), at=(s * 1.41, fy - 0.29, GF + 0.95), rot=(0, 0, s * -47.5), base=True, color="glass")
    box((1.9, 0.12, 0.08), at=(0, fy - 0.6, GF + 1.8), base=True, color="snow", lod0=True)
    # side sash windows flanking the bay
    for s in (-1, 1):
        _sash(s * 2.75, GF + 0.95, 0.8, 1.7, trim="snow")
    _rear_stoop(-2.0, W)
    _win(1.8, SF_D / 2, GF + 0.8, 1.0, 1.5, face="+y")


@asset("storefront_corner", "Corner Bank", "Holds the corner, the town's savings and one dramatic turret.", L,
       "stone", "large", variants=SF_WALLS, col="box", fill=0.9)
def storefront_corner():
    # body x in [-7, 6.5]: the +X street side keeps 0.5 m for its cornice so the bbox stays centred
    X0, X1, H, GF = -7.0, 6.5, 9.0, 4.6
    fy = SF_FY
    c = 2.6
    wall = dict(color="brick", tint=True)
    foot = [(X0, fy), (X1 - c, fy), (X1, fy + c), (X1, SF_D / 2), (X0, SF_D / 2)]
    extrude(foot, H, color="brick", tint=True, center=False)
    # cornice slab wrapping front, chamfer and side
    ch = (X1 - c) - fy + 0.6 * math.sqrt(2)  # chamfer line x - y = ch
    top = [(X0, fy - SF_REACH), (ch + fy - SF_REACH, fy - SF_REACH), (7.0, 7.0 - ch), (7.0, SF_D / 2 - 0.3),
           (X0, SF_D / 2 - 0.3)]
    extrude(top, 0.6, at=(0, 0, H), color="paper", center=False)
    # frieze bands under the cornice (front + side)
    box((X1 - c - X0, 0.25, 0.4), at=((X0 + X1 - c) / 2, fy - 0.1, H - 0.55), base=True, color="paper", lod0=True)
    box((0.25, SF_D - c, 0.4), at=(X1 + 0.1, (fy + c + SF_D / 2) / 2, H - 0.55), base=True, color="paper",
        lod0=True)
    box((X1 - X0 - 0.3, SF_D - 1.0, 0.06), at=((X0 + X1) / 2, 0.5, H + 0.6), base=True, color="stone")
    # stone base course + belt course, front and side
    for (a, b) in ((X0, X1 - c),):
        box((b - a, 0.2, 0.8), at=((a + b) / 2, fy - 0.08, 0), base=True, color="paper")
        box((b - a, 0.22, 0.28), at=((a + b) / 2, fy - 0.08, GF), base=True, color="paper")
    box((0.2, SF_D - c, 0.8), at=(X1 + 0.08, (fy + c + SF_D / 2) / 2, 0), base=True, color="paper")
    box((0.22, SF_D - c, 0.28), at=(X1 + 0.08, (fy + c + SF_D / 2) / 2, GF), base=True, color="paper")
    # ground floor: tall arched bank windows, front and side
    for x in (-5.4, -2.6, 0.2, 2.9):
        _arch_win(x, fy, 0.95, 1.6, 2.4)
    for y in (-2.8, 0.2, 3.2, 6.0):
        if _lod1():
            box((0.14, 1.6, 3.0), at=(X1 + 0.05, y, 0.95), base=True, color="glass")
        else:
            extrude([(px * 1.28, pz + (0.12 if pz > 0 else -0.1)) for (px, pz) in _arch_pts(1.6, 2.4, 45)], 0.12,
                    at=(X1 + 0.06, y, 0.95), rot=(90, 0, 90), color="paper")
            extrude(_arch_pts(1.6, 2.4, 30), 0.14, at=(X1 + 0.07, y, 0.95), rot=(90, 0, 90), color="glass")
    # sign band over the side windows
    box((0.25, 5.0, 0.5), at=(X1 + 0.12, 1.7, GF - 0.7), base=True, color="navy", lod0=True)
    # upper floor sash windows
    for x in (-5.4, -2.6, 0.2, 2.9):
        _sash(x, 5.5, 1.2, 2.2)
    for y in (-2.8, 0.2, 3.2, 6.0):
        _side_sash(X1, y, 5.5, 1.2, 2.2)
    # chamfered corner entrance: doors + steps + sign
    mx, my = X1 - c / 2, fy + c / 2
    nx, ny = math.sqrt(0.5), -math.sqrt(0.5)
    box((2.0, 0.2, 3.2), at=(mx + nx * 0.05, my + ny * 0.05, 0.3), rot=(0, 0, 45), base=True, color="navy")
    box((1.5, 0.24, 2.4), at=(mx + nx * 0.08, my + ny * 0.08, 0.3), rot=(0, 0, 45), base=True, color="glass",
        lod0=True)
    box((2.6, 0.9, 0.3), at=(mx + nx * 0.4, my + ny * 0.4, 0), rot=(0, 0, 45), base=True, color="paper")
    # corner turret, corbelled out over the entrance
    tx, ty, tr = 5.0, -5.5, 1.5
    lathe([(0.3, GF - 0.6), (tr, GF + 0.3)], at=(tx, ty, 0), color="paper", segs=12)
    cyl(tr, H + 0.6 - GF - 0.3, at=(tx, ty, GF + 0.3), color="brick", tint=True, segs=12)
    cyl(tr + 0.15, 0.6, at=(tx, ty, H), color="paper", segs=12)
    cyl(tr - 0.05, 0.7, at=(tx, ty, H + 0.6), color="brick", tint=True, segs=12)
    cyl(tr + 0.2, 2.4, at=(tx, ty, H + 1.3), r2=0.05, color="slate", segs=12)
    sphere(0.16, at=(tx, ty, H + 3.75), color="sun", segs=6, rings=4)
    for a in (-90, -45, 0):
        ar = math.radians(a)
        box((0.7, 0.14, 1.9), at=(tx + (tr + 0.02) * math.cos(ar), ty + (tr + 0.02) * math.sin(ar), 5.6),
            rot=(0, 0, a + 90), base=True, color="glass", lod0=a != -45)
    # party wall chimney + rear stoop
    box((1.2, 1.6, 1.8), at=(X0 + 0.9, 4.0, H + 0.6), base=True, **wall)
    _rear_stoop(-3.0, 14.0)


# ---------------------------------------------------------------- civic buildings

def _columns(xs, y, z0, h, r, color="paper", segs=10):
    for x in xs:
        cyl(r * 1.25, 0.3, at=(x, y, z0), color=color, segs=segs, lod0=True)
        cyl(r, h, at=(x, y, z0), color=color, segs=segs)
        box((r * 2.6, r * 2.6, 0.3), at=(x, y, z0 + h - 0.3), base=True, color=color, lod0=True)


def _steps(x, y_front, z_top, w, n=3, run=0.45, color="concrete"):
    """Flight of n steps rising towards +Y, front edge at y_front, top at z_top."""
    rise = z_top / n
    for i in range(n):
        d = run * (n - i)
        box((w, d, rise * (i + 1)), at=(x, y_front + run * i + d / 2, 0), base=True, color=color)


@asset("town_hall", "Town Hall", "The clock is right twice a day and once at council meetings.", L, "stone",
       "landmark", col="box", fill=0.7)
def town_hall():
    W, y0, y1, H = 28.0, -5.0, 9.0, 10.0
    yc = (y0 + y1) / 2
    box((W + 0.4, y1 - y0 + 0.4, 1.0), at=(0, yc, 0), base=True, color="concrete")
    box((W, y1 - y0, H - 1.0), at=(0, yc, 1.0), base=True, color="brick")
    # stone quoins, belt course, cornice
    for x in (-W / 2, W / 2):
        for y in (y0, y1):
            box((0.7, 0.7, H - 1.0), at=(x - math.copysign(0.3, x), y - math.copysign(0.3, y), 1.0), base=True,
                color="concrete", lod0=True)
    box((W + 0.1, y1 - y0 + 0.1, 0.35), at=(0, yc, 5.4), base=True, color="concrete", lod0=True)
    box((W + 0.9, y1 - y0 + 0.9, 0.8), at=(0, yc, H), base=True, color="concrete")
    # hipped roof with a flat deck for the cupola
    box((W + 0.6, y1 - y0 + 0.6, 3.4), at=(0, yc, H + 0.8), base=True, taper=(0.78, 0.5), color="slate")
    # windows: two storeys, three bays each side of the portico + sides
    for x in (-12.0, -9.4, -6.8, 6.8, 9.4, 12.0):
        for z in (2.0, 6.3):
            _win(x, y0, z, 1.3, 2.5, color="glass", lod0=False)
            box((1.7, 0.36, 0.35), at=(x, y0 - 0.06, z + 2.5), base=True, color="concrete", lod0=True)
            box((1.5, 0.36, 0.15), at=(x, y0 - 0.06, z - 0.15), base=True, color="concrete", lod0=True)
    for s in (-1, 1):
        for y in (-2.0, 2.0, 6.0):
            for z in (2.0, 6.3):
                _win(s * W / 2, y, z, 1.3, 2.5, face="+x", color="glass")
    # portico: podium + steps, six columns, entablature, pediment
    pw, py0 = 12.0, -8.0
    box((pw + 1.0, y0 - py0 + 0.4, 1.2), at=(0, (py0 + y0) / 2 - 0.2, 0), base=True, color="concrete")
    _steps(0, py0 - 1.4, 1.2, pw - 2.0, n=3, run=0.45)
    cols = [-5.2, -3.1, -1.0, 1.0, 3.1, 5.2]
    _columns(cols, py0 + 0.8, 1.2, 7.4, 0.42, color="paper")
    box((pw + 0.6, y0 - py0 + 0.8, 1.1), at=(0, (py0 + y0) / 2 + 0.2, 8.6), base=True, color="concrete")
    extrude([(-(pw + 0.6) / 2, 0), ((pw + 0.6) / 2, 0), (0, 2.6)], y0 - py0 + 0.6,
            at=(0, (py0 + y0) / 2 + 0.3, 9.7), rot=(90, 0, 0), color="paper")
    cyl(0.8, 0.2, at=(0, py0 - 0.1, 10.6), rot=(90, 0, 0), base=False, color="sun", segs=10, lod0=True)
    # double doors under the portico
    door = _arch_pts(2.4, 2.4, 30)
    extrude(door, 0.25, at=(0, y0 - 0.1, 1.2), rot=(90, 0, 0), color="cocoa")
    for x in (-3.2, 3.2):
        _win(x, y0, 2.4, 1.2, 2.4, color="glass")
        _win(x, y0, 6.3, 1.2, 2.2, color="glass")
    # cupola: base, clock stage, open belfry, dome, finial
    zc = H + 0.8 + 3.4
    box((5.6, 5.6, 1.6), at=(0, yc, zc - 0.2), base=True, color="concrete")
    box((4.6, 4.6, 3.2), at=(0, yc, zc + 1.4), base=True, color="brick")
    box((5.2, 5.2, 0.4), at=(0, yc, zc + 4.6), base=True, color="concrete")
    zf = zc + 3.0
    for (dx, dy, yaw) in ((0, -2.3, 0), (2.3, 0, 90), (0, 2.3, 180), (-2.3, 0, 270)):
        ca, sa = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        nx, ny = sa, -ca
        cyl(1.65, 0.2, at=(dx, yc + dy, zf), rot=(90, 0, yaw), base=False, color="ink", segs=14)
        cyl(1.45, 0.3, at=(dx, yc + dy, zf), rot=(90, 0, yaw), base=False, color="paper", segs=14)
        hx, hy = dx + nx * 0.18, yc + dy + ny * 0.18
        box((0.18, 0.1, 1.05), at=(hx, hy, zf), rot=(0, 0, yaw), base=True, color="ink", lod0=True)
        box((0.85, 0.1, 0.18), at=(hx + ca * 0.38, hy + sa * 0.38, zf), rot=(0, 0, yaw), color="ink", lod0=True)
    zb = zc + 5.0
    for i in range(8):
        a = math.radians(22.5 + 45 * i)
        cyl(0.2, 2.6, at=(1.9 * math.cos(a), yc + 1.9 * math.sin(a), zb), color="paper", segs=6)
    cyl(1.4, 2.6, at=(0, yc, zb), color="ink_soft", segs=8, lod0=True)
    cyl(2.35, 0.45, at=(0, yc, zb + 2.6), color="concrete", segs=8)
    lathe([(2.1, 0), (2.0, 0.7), (1.6, 1.4), (0.9, 1.9), (0.0, 2.1)], at=(0, yc, zb + 3.05), color="teal", segs=12)
    cyl(0.1, 1.0, at=(0, yc, zb + 5.1), color="sun", segs=6)
    sphere(0.28, at=(0, yc, zb + 5.3), color="sun", segs=8, rings=5)
    # flag poles flanking the steps
    for x in (-7.2, 7.2):
        cyl(0.1, 6.5, at=(x, py0 - 0.8, 0), color="ink_soft", segs=6, lod0=True)


@asset("library", "Public Library", "Shhh. The books are sleeping. Some for ninety years.", L, "stone",
       "landmark", col="box", fill=0.7)
def library():
    W, y0, y1, H = 20.0, -5.0, 8.0, 6.0
    yc = (y0 + y1) / 2
    box((W + 0.4, y1 - y0 + 0.4, 1.2), at=(0, yc, 0), base=True, color="paper")
    box((W, y1 - y0, H - 1.2), at=(0, yc, 1.2), base=True, color="sand")
    box((W + 0.6, y1 - y0 + 0.6, 0.9), at=(0, yc, H), base=True, color="paper")
    box((W + 0.2, y1 - y0 + 0.2, 0.5), at=(0, yc, H + 0.9), base=True, color="sand")
    box((W - 0.4, y1 - y0 - 0.4, 0.06), at=(0, yc, H + 1.4), base=True, color="stone")
    # tall windows between pilasters
    for x in (-8.4, -5.8, 5.8, 8.4):
        _win(x, y0, 1.8, 1.4, 3.0, color="glass", lod0=False)
        box((1.8, 0.34, 0.3), at=(x, y0 - 0.05, 4.8), base=True, color="paper", lod0=True)
    for x in (-9.75, -7.1, -4.5, 4.5, 7.1, 9.75):
        box((0.5, 0.3, H - 1.2), at=(x, y0 - 0.05, 1.2), base=True, color="paper", lod0=True)
    for s in (-1, 1):
        for y in (-2.0, 1.5, 5.0):
            _win(s * W / 2, y, 1.8, 1.4, 3.0, face="+x", color="glass")
    # portico: four columns, entablature + pediment, steps
    py0 = -7.0
    box((9.0, y0 - py0 + 0.4, 1.2), at=(0, (py0 + y0) / 2 - 0.2, 0), base=True, color="paper")
    _steps(0, py0 - 1.0, 1.2, 7.0, n=3, run=0.33, color="paper")
    _columns([-3.0, -1.0, 1.0, 3.0], py0 + 0.6, 1.2, 4.3, 0.36, color="snow")
    box((9.2, y0 - py0 + 0.4, 0.8), at=(0, (py0 + y0) / 2 + 0.2, 5.5), base=True, color="paper")
    box((5.6, 0.1, 0.42), at=(0, py0 - 0.02, 5.68), base=True, color="sand", lod0=True)
    _letters(-2.4, 2.4, py0 - 0.06, 5.74, 0.3, 7, color="cocoa")
    extrude([(-4.6, 0), (4.6, 0), (0, 1.5)], y0 - py0 + 0.2, at=(0, (py0 + y0) / 2 + 0.3, 6.3), rot=(90, 0, 0),
            color="snow")
    extrude(_arch_pts(1.8, 2.0, 30), 0.25, at=(0, y0 - 0.1, 1.2), rot=(90, 0, 0), color="cocoa")
    # low dome on a drum
    zd = H + 1.3
    cyl(3.6, 0.4, at=(0, yc + 0.5, zd), color="paper", segs=14)
    cyl(3.2, 0.75, at=(0, yc + 0.5, zd + 0.4), color="sand", segs=14)
    if not _lod1():
        for i in range(10):
            a = math.radians(36 * i + 18)
            box((0.4, 0.2, 0.5), at=(3.22 * math.cos(a), yc + 0.5 + 3.22 * math.sin(a), zd + 0.52),
                rot=(0, 0, 36 * i + 18 + 90), base=True, color="glass")
    lathe([(3.4, 0), (3.2, 0.75), (2.6, 1.4), (1.5, 1.85), (0, 2.05)], at=(0, yc + 0.5, zd + 1.15), color="teal",
          segs=14)
    cyl(0.4, 0.3, at=(0, yc + 0.5, zd + 3.15), color="paper", segs=8)
    sphere(0.26, at=(0, yc + 0.5, zd + 3.62), color="sun", segs=8, rings=5)
    # reading lamps on the cheek walls
    for x in (-4.2, 4.2):
        box((0.8, 1.6, 0.4), at=(x, py0 - 0.2, 1.2), base=True, color="paper")
        sphere(0.35, at=(x, py0 - 0.2, 1.95), color="butter", segs=8, rings=5)


@asset("post_office", "Post Office", "Your letter is in there somewhere. Probably. Try Tuesday.", L, "stone",
       "large", col="box", fill=0.6)
def post_office():
    W, y0, y1, H = 14.0, -4.0, 6.0, 5.0
    yc = (y0 + y1) / 2
    box((W + 0.3, y1 - y0 + 0.3, 0.7), at=(0, yc, 0), base=True, color="concrete")
    box((W, y1 - y0, H - 0.7), at=(0, yc, 0.7), base=True, color="brick")
    box((W + 0.5, y1 - y0 + 0.5, 0.45), at=(0, yc, H), base=True, color="paper")
    # balustrade parapet
    box((W - 0.6, y1 - y0 - 0.6, 0.12), at=(0, yc, H + 0.45), base=True, color="stone")
    if _lod1():
        box((W - 0.2, 0.25, 0.55), at=(0, y0 + 0.15, H + 0.45), base=True, color="paper")
    else:
        for i in range(17):
            cyl(0.1, 0.5, at=(-6.4 + i * 0.8, y0 + 0.15, H + 0.55), color="paper", segs=5)
        for s in (-1, 1):
            for i in range(8):
                cyl(0.1, 0.5, at=(s * (W / 2 - 0.15), y0 + 1.0 + i * 1.15, H + 0.55), color="paper", segs=5)
    for s in (-1, 1):
        box((0.5, y1 - y0, 0.5), at=(s * (W / 2 - 0.25), yc, H + 0.55), base=True, color="paper")
    box((W, 0.3, 0.2), at=(0, y0 + 0.15, H + 1.05), base=True, color="paper")
    box((W, 0.3, 0.7), at=(0, y1 - 0.15, H + 0.55), base=True, color="paper")
    # entrance pavilion: pilasters, fanlight door, sign band
    box((4.6, 0.5, H - 0.7), at=(0, y0 - 0.2, 0.7), base=True, color="paper")
    extrude(_arch_pts(1.8, 2.3, 30), 0.25, at=(0, y0 - 0.5, 0.7), rot=(90, 0, 0), color="navy")
    if not _lod1():
        extrude([(x, z) for (x, z) in _arch_pts(1.4, 0.0, 30) if z >= 0], 0.27, at=(0, y0 - 0.52, 3.0),
                rot=(90, 0, 0), color="glass")
    box((4.0, 0.14, 0.5), at=(0, y0 - 0.48, H - 0.62), base=True, color="navy")
    _letters(-1.6, 1.6, y0 - 0.56, H - 0.54, 0.34, 6, color="snow")
    _steps(0, y0 - 1.7, 0.7, 3.6, n=2, run=0.6)
    # tall windows
    for x in (-5.2, -3.4, 3.4, 5.2):
        _arch_win(x, y0, 1.3, 1.1, 2.0, trim="paper")
    for s in (-1, 1):
        for y in (-1.5, 1.5, 4.0):
            _win(s * W / 2, y, 1.4, 1.1, 2.0, face="+x", color="glass")
    # mailbox by the steps
    box((0.55, 0.5, 0.9), at=(2.6, y0 - 1.3, 0.25), base=True, color="navy", lod0=True)
    cyl(0.25, 0.55, at=(2.6, y0 - 1.3, 1.15), rot=(90, 0, 0), base=False, color="navy", segs=8, lod0=True)
    for x in (2.4, 2.8):
        box((0.08, 0.08, 0.25), at=(x, y0 - 1.3, 0), base=True, color="navy", lod0=True)
    # flagpole on the lawn with a big flag
    fx, fyy = -5.5, -5.9
    cyl(0.42, 0.3, at=(fx, fyy, 0), color="concrete", segs=8)
    cyl(0.09, 6.8, at=(fx, fyy, 0.3), color="cloud", segs=6)
    sphere(0.16, at=(fx, fyy, 7.1), color="sun", segs=6, rings=4)
    fz, fw, fh = 6.85, 2.4, 1.5
    for i in range(5):
        box((fw, 0.05, fh / 5), at=(fx + 0.1 + fw / 2, fyy, fz - fh + i * fh / 5), base=True,
            color="tomato" if i % 2 == 0 else "snow")
    box((1.0, 0.07, fh * 0.6), at=(fx + 0.6, fyy, fz - fh * 0.6), base=True, color="navy")


# ---------------------------------------------------------------- railroad + highway

def _brace_y(x, y0, z0, y1, z1, color, w=0.18, lod0=True):
    """Diagonal brace in the YZ plane (eave brackets)."""
    dy, dz = y1 - y0, z1 - z0
    ln = math.hypot(dy, dz)
    ang = math.degrees(math.atan2(dz, dy))
    box((w, ln, w), at=(x, (y0 + y1) / 2, (z0 + z1) / 2), rot=(ang, 0, 0), color=color, lod0=lod0)


@asset("depot_station", "Railroad Depot", "Trains stop here twice a day. The clock stops more often.", L, "wood",
       "landmark", col="box", fill=0.55,
       place={"platform_side": "back: blender +Y = game -Z", "platform_edge_game_z": -4.73, "platform_top": 0.35})
def depot_station():
    X, y0, y1, Hw = 11.0, -3.0, 1.8, 4.0
    yc = (y0 + y1) / 2
    # platform along the back (track side)
    box((32.0, 3.4, 0.35), at=(0, 3.3, 0), base=True, color="concrete")
    box((32.0, 0.18, 0.02), at=(0, 4.82, 0.35), base=True, color="sun", lod0=True)
    # walls with a dark wainscot band
    box((2 * X + 0.08, y1 - y0 + 0.08, 1.1), at=(0, yc, 0), base=True, color="cocoa")
    box((2 * X, y1 - y0, Hw - 1.1), at=(0, yc, 1.1), base=True, color="sand")
    # deep hipped roof on brackets
    box((2 * X + 3.0, y1 - y0 + 3.0, 0.3), at=(0, yc, Hw - 0.1), base=True, color="pine")
    box((2 * X + 3.0, y1 - y0 + 3.0, 2.4), at=(0, yc, Hw + 0.2), base=True, taper=(0.82, 0.14), color="pine")
    for x in (-9.5, -6.5, -3.5, 0.5, 3.5, 6.5, 9.5):
        _brace_y(x, y0, 2.9, y0 - 1.3, Hw - 0.1, "cocoa")
    for y in (-1.8, 0.6):
        for s in (-1, 1):
            box((1.3, 0.18, 0.18), at=(s * (X + 0.6), y, 3.45), rot=(0, s * 40, 0), color="cocoa", lod0=True)
    for x in (-4.0, 4.5):
        box((0.8, 0.8, 3.2), at=(x, yc + 0.4, Hw), base=True, color="brick")
    # street side: doors, windows, freight door
    for x in (-2.2, 2.2):
        box((1.3, 0.16, 2.6), at=(x, y0, 0.0), base=True, color="cocoa")
        _win(x, y0, 2.75, 1.3, 0.55, color="glass")
    for x in (-8.6, -5.6, 5.6):
        _win(x, y0, 1.2, 1.2, 2.0, color="glass", sill="cocoa", lod0=False)
    box((2.8, 0.16, 2.9), at=(8.8, y0, 0), base=True, color="cocoa")
    for i in range(3):
        box((0.1, 0.2, 2.8), at=(7.7 + i * 1.1, y0, 0.05), base=True, color="sand", lod0=True)
    # name boards on both ends
    for s in (-1, 1):
        box((0.16, 3.4, 0.8), at=(s * (X + 0.08), yc, 2.9), base=True, color="sun")
        _letters(-1.3, 1.3, s * (X + 0.17), 3.07, 0.46, 6, color="ink_soft", face="+x")
        _win(s * X, yc - 1.2, 1.2, 1.0, 1.4, face="+x", color="glass")
    # telegrapher's bay on the track side
    bay = [(-1.7, 0.0), (1.7, 0.0), (1.1, 0.9), (-1.1, 0.9)]
    extrude(bay, Hw - 0.3, at=(0, y1, 0), color="sand", center=False)
    box((2.0, 0.14, 1.6), at=(0, y1 + 0.92, 1.3), base=True, color="glass")
    for s in (-1, 1):
        box((0.9, 0.12, 1.6), at=(s * 1.42, y1 + 0.45, 1.3), rot=(0, 0, s * 56.3), base=True, color="glass",
            lod0=True)
    for x in (-6.5, -3.5, 3.5, 6.5):
        _win(x, y1, 1.2, 1.2, 2.0, face="+y", color="glass")
    # long platform canopy on posts (runs past both ends of the building)
    box((32.0, 3.5, 0.24), at=(0, 3.25, 3.55), rot=(-4, 0, 0), base=True, color="pine")
    box((32.0, 0.16, 0.45), at=(0, 4.96, 3.25), base=True, color="cocoa")
    for i in range(9):
        x = -15.0 + i * 3.75
        cyl(0.12, 3.3, at=(x, 4.5, 0.35), color="cocoa", segs=6)
        _brace_y(x, 4.5, 2.7, 3.7, 3.55, "cocoa", w=0.12)
        _brace_y(x, 4.5, 2.7, 5.0, 3.3, "cocoa", w=0.12)
    # benches + a baggage cart
    for x in (-13.0, 13.0):
        box((2.0, 0.5, 0.45), at=(x, 2.2, 0.35), base=True, color="cocoa", lod0=True)
    box((2.2, 1.0, 0.4), at=(-7.5, 3.3, 0.75), base=True, color="caramel", lod0=True)
    for (dx, dy) in ((-0.8, -0.5), (0.8, -0.5), (-0.8, 0.5), (0.8, 0.5)):
        cyl(0.28, 0.1, at=(-7.5 + dx, 3.3 + dy, 0.63), rot=(90, 0, 0), base=False, color="ink_soft", segs=8,
            lod0=True)
    box((1.0, 0.7, 0.8), at=(-7.8, 3.3, 1.15), base=True, color="sand", lod0=True)


@asset("grain_elevator", "Grain Elevator", "Prairie skyscraper. Holds a million breakfasts.", L, "stone",
       "landmark", col="box", fill=0.6)
def grain_elevator():
    R, Hb = 2.25, 26.0
    for x in (-4.4, 0.0, 4.4):
        for y in (-2.2, 2.2):
            cyl(R, Hb, at=(x, y, 0), color="concrete", segs=16)
            cyl(R + 0.08, 0.3, at=(x, y, 0.0), color="stone", segs=16, lod0=True)
    box((8.8, 4.4, Hb), at=(0, 0, 0), base=True, color="concrete")
    # gallery across the bins + headhouse
    box((13.4, 2.8, 2.4), at=(0, 0, Hb), base=True, color="stone")
    box((13.6, 3.0, 0.3), at=(0, 0, Hb + 2.4), base=True, color="slate")
    box((5.6, 5.6, 7.0), at=(-0.4, 0, Hb), base=True, color="stone")
    box((6.2, 6.2, 0.35), at=(-0.4, 0, Hb + 7.0), base=True, color="slate")
    box((6.2, 6.2, 0.7), at=(-0.4, 0, Hb + 7.35), base=True, taper=(0.55, 0.55), color="slate")
    for y in (-1.4, 1.4):
        _win(2.4, y, Hb + 4.4, 1.0, 1.4, face="+x", color="glass")
    # big painted sign on the headhouse
    box((5.0, 0.14, 2.6), at=(-0.4, -2.82, Hb + 3.4), base=True, color="tomato")
    _letters(-2.5, 1.7, -2.92, Hb + 3.9, 1.6, 5, color="paper", lod0=False)
    # manlift / stair tower on the side
    box((1.3, 1.3, Hb + 1.0), at=(6.55, 0, 0), base=True, color="stone")
    box((1.5, 1.5, 0.4), at=(6.55, 0, Hb + 1.0), base=True, color="slate")
    # truck dump shed in front, scale house
    box((6.0, 2.6, 5.0), at=(-3.4, -4.7, 0), base=True, color="stone")
    box((6.4, 2.9, 0.3), at=(-3.4, -4.85, 5.0), rot=(-6, 0, 0), base=True, color="slate")
    box((3.4, 0.12, 3.6), at=(-3.4, -6.0, 0), base=True, color="ink_soft")
    box((2.8, 2.0, 2.8), at=(3.6, -5.0, 0), base=True, color="paper")
    box((3.1, 2.3, 0.3), at=(3.6, -5.0, 2.8), base=True, color="slate")
    _win(3.6, -6.0, 1.1, 1.2, 1.0, color="glass")
    # loading spout down to the rail siding at the back
    tube([(1.8, 2.6, Hb + 5.0), (1.8, 5.6, 6.6)], 0.28, color="slate", segs=6)
    cyl(0.5, 1.2, at=(1.8, 5.6, 5.6), r2=0.3, color="slate", segs=8)
    # ladder on a bin
    if not _lod1():
        for s in (-1, 1):
            box((0.08, 0.1, Hb - 1.0), at=(-6.62, s * 0.25 - 2.2, 0.8), base=True, color="ink_soft")


@asset("diner", "Chrome Diner", "Pie of the day: yes. Coffee refills: until you vibrate.", L, "metal", "large",
       col="box", fill=0.6)
def diner():
    from lib.core import rounded_rect_points
    Lb, B = 15.0, 4.4
    box((Lb + 0.6, B + 0.6, 0.6), at=(0, 0, 0), base=True, color="stone")
    extrude(rounded_rect_points(Lb, B, 1.3, 3), 1.0, at=(0, 0, 0.6), color="cloud", center=False)
    extrude(rounded_rect_points(Lb + 0.08, B + 0.08, 1.33, 3), 0.25, at=(0, 0, 1.45), color="tomato",
            center=False)
    extrude(rounded_rect_points(Lb - 0.04, B - 0.04, 1.28, 3), 1.05, at=(0, 0, 1.7), color="glass", center=False)
    extrude(rounded_rect_points(Lb, B, 1.3, 3), 0.45, at=(0, 0, 2.75), color="cloud", center=False)
    extrude(rounded_rect_points(Lb + 0.5, B + 0.5, 1.5, 3), 0.25, at=(0, 0, 3.2), color="teal", center=False)
    cyl(2.0, Lb - 2.2, at=(0, 0, 3.4), rot=(0, 90, 0), base=False, scale=(0.4, 1.0, 1.0), color="cloud", segs=14)
    # window mullions
    if not _lod1():
        for i in range(12):
            box((0.12, B + 0.12, 1.05), at=(-6.0 + i * 1.09, 0, 1.7), base=True, color="cloud")
    # entrance vestibule with steps
    box((2.8, 1.4, 3.0), at=(0, -B / 2 - 0.5, 0.6), base=True, color="cloud")
    box((3.2, 1.7, 0.25), at=(0, -B / 2 - 0.55, 3.6), base=True, color="teal")
    box((1.3, 0.14, 2.3), at=(0, -B / 2 - 1.22, 0.6), base=True, color="glass")
    box((2.4, 1.0, 0.3), at=(0, -B / 2 - 1.6, 0), base=True, color="stone")
    # rooftop sign
    for x in (-2.0, 2.0):
        box((0.2, 0.2, 0.6), at=(x, 0.0, 3.6), base=True, color="ink_soft")
    box((6.6, 0.4, 1.3), at=(0, 0.0, 3.9), base=True, color="tomato")
    box((6.2, 0.46, 1.0), at=(0, 0.0, 4.05), base=True, color="sun")
    _letters(-2.6, 2.6, -0.26, 4.15, 0.8, 5, color="tomato", lod0=False)
    # kitchen annex + stack at the back
    box((5.0, 2.2, 2.8), at=(3.8, B / 2 + 1.0, 0), base=True, color="stone")
    cyl(0.3, 4.5, at=(5.4, B / 2 + 1.5, 0), color="charcoal", segs=8)
    box((1.2, 0.8, 1.0), at=(1.8, B / 2 + 1.5, 0), base=True, color="charcoal", lod0=True)


@asset("motel", "Roadside Motel", "Vacancy. Always vacancy. The ice machine has seen things.", L, "stone",
       "landmark", col="box", fill=0.6)
def motel():
    y0, y1, Hr = -2.0, 6.0, 3.3
    x0, x1 = -20.0, 12.0
    box((x1 - x0, y1 - y0, Hr), at=((x0 + x1) / 2, (y0 + y1) / 2, 0), base=True, color="paper")
    box((x1 - x0 + 0.4, y1 - y0 + 2.6, 0.45), at=((x0 + x1) / 2, (y0 + y1) / 2 - 1.1, Hr), base=True,
        color="tangerine")
    box((x1 - x0 - 0.2, y1 - y0 + 2.0, 0.06), at=((x0 + x1) / 2, (y0 + y1) / 2 - 1.1, Hr + 0.45), base=True,
        color="stone")
    box((x1 - x0, 2.4, 0.22), at=((x0 + x1) / 2, y0 - 1.2, 0), base=True, color="concrete")
    n = 11
    bay = (x1 - x0 - 0.4) / n
    for i in range(n):
        xc = x0 + 0.2 + bay * (i + 0.5)
        box((1.0, 0.14, 2.2), at=(xc - 0.75, y0, 0.22), base=True, color="teal")
        _win(xc + 0.6, y0, 1.1, 1.3, 1.1, color="glass", lod0=False)
        box((0.7, 0.3, 0.45), at=(xc + 0.6, y0 - 0.12, 0.45), base=True, color="cloud", lod0=True)
        box((0.4, 0.12, 0.3), at=(xc - 0.75, y0 - 0.02, 2.5), base=True, color="sun", lod0=True)
        cyl(0.09, Hr - 0.22, at=(x0 + 0.2 + bay * i + 0.05, y0 - 2.15, 0.22), color="snow", segs=6)
    cyl(0.09, Hr - 0.22, at=(x1 - 0.25, y0 - 2.15, 0.22), color="snow", segs=6)
    # office with big glass and a swooping roof
    box((x1 - x0 + 0.4, 0.1, 0.2), at=((x0 + x1) / 2, y0 - 2.42, Hr + 0.2), base=True, color="snow", lod0=True)
    box((8.0, 8.0, 3.6), at=(16.0, 2.4, 0), base=True, color="paper")
    box((6.4, 0.14, 2.4), at=(16.6, -1.6, 0.5), base=True, color="glass")
    box((1.2, 0.18, 2.5), at=(13.6, -1.62, 0.0), base=True, color="teal")
    box((9.0, 9.4, 0.35), at=(16.2, 2.0, 3.9), rot=(0, -9, 0), color="tangerine")
    box((3.4, 0.14, 0.55), at=(16.4, -1.62, 3.0), base=True, color="tomato")
    _letters(15.0, 17.8, -1.72, 3.1, 0.34, 6, color="snow")
    # tall roadside sign: arrow board on two poles
    sx, sy = 17.0, -5.4
    for x in (sx - 1.2, sx + 1.2):
        cyl(0.14, 5.0, at=(x, sy, 0), color="charcoal", segs=8)
    box((4.4, 0.3, 1.8), at=(sx, sy, 3.0), base=True, color="tomato")
    _letters(sx - 1.9, sx + 1.9, sy - 0.2, 3.3, 1.2, 5, color="sun", lod0=False)
    extrude([(-2.6, 0.0), (0.6, 0.0), (0.6, -0.3), (1.5, 0.3), (0.6, 0.9), (0.6, 0.6), (-2.6, 0.6)], 0.25,
            at=(sx + 0.4, sy, 4.85), rot=(90, 0, 0), color="sun")
    sphere(0.32, at=(sx - 1.9, sy, 5.15), scale=(1, 0.6, 1), color="sun", segs=8, rings=5)
    box((2.8, 0.25, 0.8), at=(sx, sy, 1.95), base=True, color="paper")
    _letters(sx - 1.1, sx + 1.1, sy - 0.15, 2.1, 0.5, 7, color="tomato")
    # ice machine + soda machine by the office
    box((0.9, 0.7, 1.8), at=(11.2, y0 - 0.6, 0.22), base=True, color="tomato", lod0=True)
    box((0.9, 0.7, 1.4), at=(10.1, y0 - 0.6, 0.22), base=True, color="cloud", lod0=True)


@asset("farmhouse", "Farmhouse", "Porch swing, pie on the sill, rooster with no off switch.", L, "wood",
       "large", variants=["snow", "butter", "mint", "sky"], col="box", fill=0.7)
def farmhouse():
    x0, x1, y0, y1 = -5.0, 5.0, -1.2, 4.0
    wall = dict(color="snow", tint=True)
    box((x1 - x0 + 0.2, y1 - y0 + 0.2, 0.6), at=(0, (y0 + y1) / 2, 0), base=True, color="stone")
    box((x1 - x0, y1 - y0, 5.8), at=(0, (y0 + y1) / 2, 0.6), base=True, **wall)
    box((x1 - x0 + 0.8, y1 - y0 + 1.2, 2.6), at=(0, (y0 + y1) / 2, 6.4), base=True, taper=(1.0, 0.02),
        color="slate")
    box((1.0, 1.0, 3.3), at=(-2.8, 2.0, 6.3), base=True, color="brick")
    # back kitchen ell
    box((4.4, 2.4, 3.2), at=(-2.2, y1 + 1.2, 0.4), base=True, **wall)
    box((5.0, 2.7, 1.5), at=(-2.2, y1 + 1.2, 3.6), base=True, taper=(0.02, 1.0), color="slate")
    # windows with shutters
    for (x, z) in ((-2.7, 1.5), (2.7, 1.5), (-2.7, 4.2), (0.0, 4.2), (2.7, 4.2)):
        _win(x, y0, z, 1.1, 1.6, color="glass", lod0=False)
        for s in (-1, 1):
            box((0.45, 0.12, 1.6), at=(x + s * 0.8, y0 - 0.04, z), base=True, color="pine", lod0=True)
    for y in (0.3, 2.6):
        _win(x1, y, 4.2, 1.1, 1.6, face="+x", color="glass")
        _win(x0, y, 4.2, 1.1, 1.6, face="+x", color="glass")
    _win(x1, 2.6, 1.5, 1.1, 1.6, face="+x", color="glass")
    box((1.2, 0.16, 2.3), at=(0.0, y0, 0.6), base=True, color="tomato")
    # wrap-around porch: floor, posts, rails, roof (front + right side)
    py0, px1 = -3.6, 7.2
    box((px1 - x0 + 0.2, y0 - py0, 0.6), at=((x0 - 0.2 + px1) / 2, (py0 + y0) / 2, 0), base=True, color="caramel")
    box((px1 - x1, 3.0 - y0, 0.6), at=((x1 + px1) / 2, (y0 + 3.0) / 2, 0), base=True, color="caramel")
    box((2.0, 1.0, 0.3), at=(0, py0 - 0.4, 0), base=True, color="caramel")
    for x in (-4.9, -2.4, 1.2, 4.0, 7.0):
        box((0.2, 0.2, 2.6), at=(x, py0 + 0.2, 0.6), base=True, color="snow")
    for y in (-0.6, 1.4, 2.8):
        box((0.2, 0.2, 2.6), at=(px1 - 0.2, y, 0.6), base=True, color="snow")
    if not _lod1():
        for (a, b) in ((-4.9, -2.4), (1.2, 4.0), (4.0, 7.0)):
            box((b - a, 0.1, 0.1), at=((a + b) / 2, py0 + 0.2, 1.5), color="snow")
        box((0.1, 3.0 - py0, 0.1), at=(px1 - 0.2, (py0 + 3.0) / 2, 1.5), color="snow")
    box((px1 - x0 + 0.6, y0 - py0 + 0.6, 0.25), at=((x0 + px1) / 2, (py0 + y0) / 2 - 0.2, 3.2), rot=(-8, 0, 0),
        color="slate")
    box((px1 - x1 + 0.4, 3.4 - y0, 0.25), at=((x1 + px1) / 2 + 0.2, (y0 + 3.2) / 2, 3.2), rot=(0, 8, 0),
        color="slate")
    # porch swing + pie
    box((1.4, 0.5, 0.15), at=(-3.6, -2.4, 1.0), base=True, color="caramel", lod0=True)
    cyl(0.2, 0.08, at=(2.7, y0 - 0.15, 1.5), color="caramel", segs=8, lod0=True)


@asset("crossing_signal", "Crossing Signal", "Ding ding ding. It is always very sure about trains.", L, "metal",
       "small", col="box", fill=0.15)
def crossing_signal():
    box((0.6, 0.6, 0.3), base=True, color="concrete")
    cyl(0.08, 3.85, at=(0, 0, 0.3), color="cloud", segs=8)
    box((0.3, 0.22, 0.45), at=(0, 0.12, 0.9), base=True, color="cloud", lod0=True)
    # crossbuck
    for a in (45, -45):
        box((1.4, 0.05, 0.24), at=(0, -0.12, 3.55), rot=(0, a, 0), color="snow")
    if not _lod1():
        for a in (45, -45):
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            for t in (-0.5, -0.3, 0.3, 0.5):
                box((0.14, 0.03, 0.1), at=(t * ca, -0.155, 3.55 - t * sa), rot=(0, a, 0), color="ink")
    # light bar with two lamps (lenses visible front and back; the game tints them red)
    box((1.2, 0.1, 0.12), at=(0, 0, 2.55), color="charcoal")
    for x in (-0.45, 0.45):
        cyl(0.26, 0.08, at=(x, 0, 2.55), rot=(90, 0, 0), base=False, color="ink", segs=12)
        cyl(0.155, 0.24, at=(x, 0, 2.55), rot=(90, 0, 0), base=False, color="charcoal", tint=True, segs=10)
        for s in (-1, 1):
            box((0.36, 0.2, 0.04), at=(x, s * 0.14, 2.72), rot=(s * 15, 0, 0), color="ink", lod0=True)
    # bell on top
    cyl(0.17, 0.12, at=(0, 0, 4.06), r2=0.12, color="ink_soft", segs=8)


# ---------------------------------------------------------------- rolling stock
# Matches train_carriage: trucks (2.8 x 2.2 x 0.5 frame at z 0.45, r 0.45 wheels at y +-1.15),
# floor at z ~1.25, roof ~4.2-4.3, couplers centred at z ~1.15 reaching the ends of the stated length.

def _truck(x):
    box((2.8, 2.2, 0.5), at=(x, 0, 0.45), base=True, color="charcoal")
    for dx in (-0.8, 0.8):
        for y in (-1.15, 1.15):
            _wheel((x + dx, y, 0.45), 0.45, 0.2, tyre="ink_soft", hub="stone", segs=16, hub_segs=6)


def _couplers(half, body_half, z=0.98):
    for s in (-1, 1):
        ln = half - body_half + 0.2
        box((ln, 0.42, 0.34), at=(s * (half - ln / 2), 0, z), base=True, color="charcoal")
        box((0.22, 0.6, 0.4), at=(s * (half - 0.11), 0, z - 0.03), base=True, color="charcoal")


def _ladder(x, y, z0, z1, color="ink_soft", along="x"):
    if _lod1():
        return
    n = int((z1 - z0) / 0.45)
    for k in (-1, 1):
        o = (k * 0.22, 0) if along == "x" else (0, k * 0.22)
        box((0.05, 0.05, z1 - z0), at=(x + o[0], y + o[1], z0), base=True, color=color)
    for i in range(n):
        box((0.5 if along == "x" else 0.05, 0.05 if along == "x" else 0.5, 0.05),
            at=(x, y, z0 + 0.3 + i * 0.45), base=True, color=color)


@asset("freight_car", "Boxcar", "Contents: classified. Probably socks. It is always socks.", L, "metal", "large",
       variants=["brick", "cocoa", "tangerine", "navy", "pine"], col="box", fill=0.85)
def freight_car():
    half, bh, B = 7.5, 6.9, 2.86
    for x in (-5.0, 5.0):
        _truck(x)
    box((2 * bh + 0.2, 2.6, 0.32), at=(0, 0, 0.95), base=True, color="charcoal")
    _couplers(half, bh)
    box((2 * bh, B, 2.95), at=(0, 0, 1.25), base=True, color="brick", tint=True)
    box((2 * bh + 0.1, B + 0.1, 0.14), at=(0, 0, 4.2), base=True, color="brick", tint=True)
    box((2 * bh - 0.4, 0.5, 0.06), at=(0, 0, 4.34), base=True, color="charcoal", lod0=True)
    for s in (-1, 1):
        y = s * (B / 2 + 0.04)
        box((2.6, 0.08, 2.75), at=(0, y, 1.3), base=True, color="brick", tint=True)
        box((2.9, 0.1, 0.1), at=(0.15, y + s * 0.02, 4.0), base=True, color="ink_soft", lod0=True)
        box((2.9, 0.1, 0.1), at=(0.15, y + s * 0.02, 1.3), base=True, color="ink_soft", lod0=True)
        box((0.08, 0.12, 0.5), at=(-1.0, y + s * 0.02, 2.4), base=True, color="ink_soft", lod0=True)
        if not _lod1():
            for i in range(10):
                x = -6.3 + i * 1.3 + (1.45 if i >= 5 else 0)
                if abs(x) < 1.5 or abs(x) > 6.5:
                    continue
                box((0.12, 0.06, 2.9), at=(x, s * (B / 2 + 0.03), 1.28), base=True, color="brick", tint=True)
        cyl(0.5, 0.06, at=(3.9, s * (B / 2 + 0.03), 2.75), rot=(90, 0, 0), base=False, color="snow", segs=12,
            lod0=True)
        box((2.2, 0.06, 0.3), at=(-4.2, s * (B / 2 + 0.03), 3.3), base=True, color="snow", lod0=True)
        box((1.4, 0.06, 0.22), at=(-4.6, s * (B / 2 + 0.03), 2.8), base=True, color="snow", lod0=True)
        _ladder(s * (bh - 0.35), s * (B / 2 + 0.06), 1.25, 4.1)
    cyl(0.3, 0.05, at=(-bh - 0.05, 0.6, 3.6), rot=(0, 90, 0), base=False, color="ink_soft", segs=8, lod0=True)


@asset("hopper_car", "Hopper Car", "Carries a mountain of coal to a slightly different place.", L, "metal",
       "large", variants=["cocoa", "sun", "sky", "tangerine"], col="box", fill=0.75)
def hopper_car():
    half, bh, B = 7.0, 6.4, 2.9
    for x in (-4.8, 4.8):
        _truck(x)
    box((2 * bh, 0.7, 0.3), at=(0, 0, 0.95), base=True, color="charcoal")
    _couplers(half, bh)
    prof = [(-bh, 4.0), (-bh, 1.6), (-4.0, 1.25), (-3.6, 1.25), (-2.7, 0.8), (-2.1, 0.8), (-1.2, 1.25),
            (-0.3, 0.8), (0.3, 0.8), (1.2, 1.25), (2.1, 0.8), (2.7, 0.8), (3.6, 1.25), (4.0, 1.25), (bh, 1.6),
            (bh, 4.0)]
    extrude(prof, B, rot=(90, 0, 0), color="cocoa", tint=True)
    box((2 * bh + 0.1, B + 0.1, 0.16), at=(0, 0, 3.9), base=True, color="cocoa", tint=True)
    if not _lod1():
        for s in (-1, 1):
            for i in range(9):
                x = -5.6 + i * 1.4
                box((0.14, 0.08, 2.5 if abs(x) > 4 else 2.9), at=(x, s * (B / 2 + 0.03), 1.4 if abs(x) > 4 else 1.0),
                    base=True, color="cocoa", tint=True)
            box((2.4, 0.06, 0.32), at=(-2.6, s * (B / 2 + 0.06), 3.1), base=True, color="snow")
    # the coal
    sphere(1.0, at=(0, 0, 3.92), scale=(5.6, 1.25, 0.5), color="ink_soft", segs=12, rings=5)
    for x in (-3.2, 0.4, 3.4):
        ico(0.9, at=(x, 0.1, 4.1), scale=(1.4, 1.1, 0.42), color="ink_soft", lod0=True)
    for s in (-1, 1):
        _ladder(s * (bh - 0.3), s * (B / 2 + 0.06), 1.4, 3.9)


@asset("tank_car", "Tank Car", "Full of something sloshy. Do not shake. Do not ask.", L, "metal", "large",
       variants=["snow", "ink_soft", "sky", "sun"], col="box", fill=0.7)
def tank_car():
    half, R = 6.5, 1.35
    for x in (-4.3, 4.3):
        _truck(x)
        box((0.9, 2.5, 0.55), at=(x, 0, 0.95), base=True, color="charcoal")
    box((11.4, 0.6, 0.35), at=(0, 0, 0.95), base=True, color="charcoal")
    _couplers(half, 5.7)
    zc = 1.3 + R
    cyl(R, 10.6, at=(0, 0, zc), rot=(0, 90, 0), base=False, color="snow", tint=True, segs=16)
    for s in (-1, 1):
        sphere(R, at=(s * 5.3, 0, zc), scale=(0.42, 1, 1), color="snow", tint=True, segs=16, rings=7)
        cyl(R + 0.03, 0.12, at=(s * 3.2, 0, zc), rot=(0, 90, 0), base=False, color="charcoal", segs=16, lod0=True)
        box((3.0, 0.06, 0.38), at=(-1.8, s * (R + 0.01), zc + 0.25), base=True, color="ink_soft", lod0=True)
    cyl(0.6, 0.55, at=(0, 0, zc + R - 0.15), color="snow", tint=True, segs=12)
    cyl(0.68, 0.12, at=(0, 0, zc + R + 0.4), color="charcoal", segs=12)
    box((2.6, 2.4, 0.08), at=(0, 0, zc + R - 0.1), base=True, color="charcoal", lod0=True)
    if not _lod1():
        for (x, y) in ((-1.25, -1.15), (1.25, -1.15), (-1.25, 1.15), (1.25, 1.15)):
            box((0.06, 0.06, 0.6), at=(x, y, zc + R - 0.05), base=True, color="charcoal")
        for y in (-1.15, 1.15):
            box((2.5, 0.06, 0.06), at=(0, y, zc + R + 0.5), base=True, color="charcoal")
    for s in (-1, 1):
        _ladder(s * 1.6, s * (R + 0.15), 1.3, zc + R - 0.1, along="x")


@asset("caboose", "Caboose", "The train's little red full stop. Has a cosy stove.", L, "wood", "large",
       col="box", fill=0.65)
def caboose():
    half, bh, B = 5.0, 3.6, 2.8
    for x in (-2.6, 2.6):
        _truck(x)
    box((2 * bh + 2.0, 2.6, 0.32), at=(0, 0, 0.95), base=True, color="charcoal")
    _couplers(half, bh + 1.0)
    box((2 * bh, B, 2.6), at=(0, 0, 1.25), base=True, color="tomato")
    box((2 * bh + 0.04, B + 0.04, 0.22), at=(0, 0, 1.3), base=True, color="snow")
    box((2 * bh + 0.6, B + 0.3, 0.16), at=(0, 0, 3.85), base=True, color="cocoa")
    # cupola
    box((2.2, 2.3, 0.95), at=(0.6, 0, 4.0), base=True, color="tomato")
    box((2.6, 2.6, 0.15), at=(0.6, 0, 4.95), base=True, color="cocoa")
    for y in (-1.15, 1.15):
        box((1.5, 0.1, 0.5), at=(0.6, y, 4.25), base=True, color="glass")
    for x in (-0.5, 1.7):
        box((0.1, 1.5, 0.5), at=(x, 0, 4.25), base=True, color="glass", lod0=True)
    cyl(0.12, 1.0, at=(-2.4, 0.6, 4.0), color="charcoal", segs=6)
    cyl(0.2, 0.15, at=(-2.4, 0.6, 5.0), color="charcoal", segs=6)
    # windows + end doors
    for y in (-B / 2, B / 2):
        for x in (-2.2, 2.4):
            box((0.9, 0.12, 0.8), at=(x, y, 2.4), base=True, color="glass")
        box((2.4, 0.06, 0.32), at=(0.2, y * 1.02, 2.0), base=True, color="snow", lod0=True)
    for s in (-1, 1):
        box((0.12, 0.9, 2.1), at=(s * bh, 0, 1.4), base=True, color="cocoa")
        box((0.14, 0.5, 0.6), at=(s * bh, 0, 2.6), base=True, color="glass", lod0=True)
        # end platform with railings + steps
        box((1.0, 2.6, 0.14), at=(s * (bh + 0.5), 0, 1.15), base=True, color="cocoa")
        if not _lod1():
            for y in (-1.2, 1.2):
                box((0.06, 0.06, 1.1), at=(s * (bh + 0.95), y, 1.29), base=True, color="ink_soft")
                box((0.06, 0.06, 1.1), at=(s * (bh + 0.2), y, 1.29), base=True, color="ink_soft")
                box((0.8, 0.06, 0.06), at=(s * (bh + 0.55), y, 2.35), base=True, color="ink_soft")
            box((0.06, 2.4, 0.06), at=(s * (bh + 0.95), 0, 2.35), base=True, color="ink_soft")
            for y in (-1.2, 1.2):
                box((0.8, 0.3, 0.06), at=(s * (bh + 0.55), y * 1.08, 0.75), base=True, color="ink_soft")
        sphere(0.12, at=(s * (bh + 0.1), 1.25, 3.6), color="sun", segs=6, rings=4, lod0=True)


# ---------------------------------------------------------------- bridges (deck top at z = 4.5)

DECK = 4.5


@asset("road_bridge", "River Bridge", "Two lanes, one river, and a fisherman who never leaves.", L, "metal",
       "landmark", col="box", fill=0.3, place={"deck_top": DECK, "sink": 4.05, "road_half_width": 5.2})
def road_bridge():
    Lb, zr = 72.0, DECK
    for s in (-1, 1):
        box((4.0, 16.0, zr - 0.9), at=(s * 34.0, 0, 0), base=True, color="concrete")
        box((4.0, 16.0, 0.4), at=(s * 34.0, 0, zr - 1.3), base=True, color="concrete", lod0=True)
    box((Lb, 14.4, 0.7), at=(0, 0, zr - 0.9), base=True, color="concrete")
    box((Lb, 10.4, 0.2), at=(0, 0, zr - 0.2), base=True, color="charcoal")
    for s in (-1, 1):
        box((Lb, 2.0, 0.2), at=(0, s * 6.2, zr - 0.2), base=True, color="concrete")
    if not _lod1():
        for i in range(17):
            box((2.2, 0.16, 0.02), at=(-32.0 + i * 4.0, 0, zr), base=True, color="sun")
    # tie girders (kerb) + railing
    zt = zr + 0.6
    for s in (-1, 1):
        box((Lb, 0.8, zt - (zr - 0.9)), at=(0, s * 7.6, zr - 0.9), base=True, color="pine")
        box((Lb, 0.14, 0.14), at=(0, s * 7.25, zr + 1.1), base=True, color="pine")
        if not _lod1():
            for i in range(19):
                box((0.12, 0.12, 1.1), at=(-36.0 + 0.06 + i * (Lb - 0.12) / 18, s * 7.25, zr), base=True,
                    color="pine")
            box((Lb, 0.08, 0.08), at=(0, s * 7.25, zr + 0.6), base=True, color="pine")
    # the arches
    xs, apex = 33.0, 17.9
    def zarch(x):
        return zt + (apex - zt) * (1 - (x / xs) ** 2)
    n = 14 if not _lod1() else 8
    for s in (-1, 1):
        y = s * 7.6
        for i in range(n):
            xa, xb = -xs + 2 * xs * i / n, -xs + 2 * xs * (i + 1) / n
            p0, p1 = (xa, y, zarch(xa)), (xb, y, zarch(xb))
            dx, dz = p1[0] - p0[0], p1[2] - p0[2]
            ln = math.hypot(dx, dz) + 0.5
            ang = math.degrees(math.atan2(dz, dx))
            box((ln, 0.9, 1.7), at=((xa + xb) / 2, y, (p0[2] + p1[2]) / 2), rot=(0, -ang, 0), color="pine")
        step = 1 if not _lod1() else 2
        for i in range(0, 15, step):
            x = -28.0 + i * 4.0
            box((0.4, 0.4, zarch(x) - zt), at=(x, y, zt), base=True, color="pine")
    # top lateral bracing between the arches
    for x in (-16.0, -8.0, 0.0, 8.0, 16.0):
        box((0.8, 15.2, 0.8), at=(x, 0, zarch(x) + 0.1), color="pine")
    if not _lod1():
        for (xa, xb) in ((-16.0, -8.0), (-8.0, 0.0), (0.0, 8.0), (8.0, 16.0)):
            za, zb = zarch(xa), zarch(xb)
            for k in (-1, 1):
                ang = math.degrees(math.atan2(k * 15.2, xb - xa))
                ln = math.hypot(15.2, xb - xa)
                box((ln, 0.25, 0.25), at=((xa + xb) / 2, 0, (za + zb) / 2 + 0.1), rot=(0, 0, ang), color="pine")
    # street lamps on the railings
    if not _lod1():
        for x in (-30.0, -10.0, 10.0, 30.0):
            for s in (-1, 1):
                cyl(0.08, 3.4, at=(x, s * 7.25, zr), color="ink_soft", segs=6)
                sphere(0.28, at=(x, s * 7.25, zr + 3.55), color="butter", segs=8, rings=5)


@asset("rail_bridge", "Rail Bridge", "A steel cage for trains. They seem fine with it.", L, "metal", "landmark",
       col="box", fill=0.3, place={"deck_top": DECK, "sink": 4.05, "rail_top": DECK + 0.26, "rail_y": 1.15})
def rail_bridge():
    Lb, zr = 64.0, DECK
    for s in (-1, 1):
        box((3.0, 8.0, zr - 0.7), at=(s * 30.5, 0, 0), base=True, color="concrete")
    box((Lb, 6.6, 0.7), at=(0, 0, zr - 0.7), base=True, color="charcoal")
    # track
    if _lod1():
        box((Lb, 3.0, 0.12), at=(0, 0, zr), base=True, color="cocoa")
    else:
        for i in range(64):
            box((0.26, 3.0, 0.12), at=(-31.5 + i, 0, zr), base=True, color="cocoa")
    for y in (-1.15, 1.15):
        box((Lb, 0.14, 0.14), at=(0, y, zr + 0.12), base=True, color="stone")
    # Parker (camelback) through trusses
    zb = zr + 0.2
    tops = {0: 9.6, 8: 9.4, 16: 8.6, 24: 7.0}
    def top(x):
        return zb + tops[abs(int(round(x)))]
    for s in (-1, 1):
        y = s * 3.65
        box((Lb, 0.7, 1.0), at=(0, y, zr - 0.7), base=True, color="stone")
        for k in (-1, 1):
            _beam((k * 32.0, y, zr - 0.2), (k * 24.0, y, top(24)), 0.7, 1.1, "stone")
        for i in range(6):
            xa, xb = -24.0 + 8 * i, -16.0 + 8 * i
            pa, pb = (xa, y, top(xa)), (xb, y, top(xb))
            ln = math.hypot(xb - xa, pb[2] - pa[2]) + 0.4
            ang = math.degrees(math.atan2(pb[2] - pa[2], xb - xa))
            box((ln, 0.7, 1.1), at=((xa + xb) / 2, y, (pa[2] + pb[2]) / 2), rot=(0, -ang, 0), color="stone")
        for i in range(7):
            x = -24.0 + 8 * i
            box((0.65, 0.6, top(x) - zb), at=(x, y, zb), base=True, color="stone")
        for i in range(6):
            xa, xb = -24.0 + 8 * i, -16.0 + 8 * i
            if abs(xa) >= abs(xb):  # Pratt: diagonals slope down towards mid-span
                _beam((xa, y, top(xa)), (xb, y, zb + 0.3), 0.5, 0.6, "stone")
            else:
                _beam((xb, y, top(xb)), (xa, y, zb + 0.3), 0.5, 0.6, "stone")
            if not _lod1() and abs(xa + xb) < 17:
                if abs(xa) >= abs(xb):
                    _beam((xb, y, top(xb)), (xa, y, zb + 0.3), 0.2, 0.2, "stone")
                else:
                    _beam((xa, y, top(xa)), (xb, y, zb + 0.3), 0.2, 0.2, "stone")
    # top struts, portals with a name plate, lateral bracing
    for i in range(7):
        x = -24.0 + 8 * i
        box((0.6, 7.3, 0.6), at=(x, 0, top(x) - 0.1), color="stone")
    for k in (-1, 1):
        x = k * 24.4
        box((0.35, 7.3, 1.3), at=(x, 0, top(24) - 1.6), base=True, color="stone")
        box((0.4, 3.0, 0.7), at=(x + k * 0.05, 0, top(24) - 1.3), base=True, color="sun", lod0=True)
    if not _lod1():
        for i in range(6):
            xa, xb = -24.0 + 8 * i, -16.0 + 8 * i
            za, zbb = top(xa), top(xb)
            for k in (-1, 1):
                ang = math.degrees(math.atan2(k * 7.3, xb - xa))
                box((math.hypot(7.3, xb - xa), 0.2, 0.2), at=((xa + xb) / 2, 0, (za + zbb) / 2), rot=(0, 0, ang),
                    color="stone")


# ---------------------------------------------------------------- river: boats + boathouse
# Boats: long axis X, bow at +X, hull bottom at z = 0, waterline ~0.4 above the bottom.

def _hull_outline(Lh, B, bow=0.42, stern=0.78):
    """Top view of a hull: flat-ish stern at -X, pointed bow at +X."""
    x0, x1 = -Lh / 2, Lh / 2
    return [(x0, -B / 2 * stern), (x0 + Lh * 0.3, -B / 2), (x1 - Lh * 0.3, -B / 2 * 0.95), (x1 - Lh * 0.1, -B / 2 * bow),
            (x1, 0.0), (x1 - Lh * 0.1, B / 2 * bow), (x1 - Lh * 0.3, B / 2 * 0.95), (x0 + Lh * 0.3, B / 2),
            (x0, B / 2 * stern)]


def _scaled(pts, sx, sy, dx=0.0):
    return [(x * sx + dx, y * sy) for (x, y) in pts]


def _gunwale(pts, z0, z1, t, color, tint=False, closed=True):
    """Thin walls standing on a closed outline (hollow open boats)."""
    n = len(pts)
    for i in range(n if closed else n - 1):
        a, b = pts[i], pts[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy)
        if ln < 1e-4:
            continue
        # push the wall inwards by t/2 so the outline stays the outer face
        nx, ny = dy / ln, -dx / ln
        cx, cy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        if nx * cx + ny * cy > 0:
            nx, ny = -nx, -ny
        box((ln + t, t, z1 - z0), at=(cx + nx * t / 2, cy + ny * t / 2, z0), rot=(0, 0, math.degrees(math.atan2(dy, dx))),
            base=True, color=color, tint=tint)


@asset("rowboat", "Rowboat", "Two oars, one bench, zero sense of direction.", L, "wood", "small", col="box",
       fill=0.35)
def rowboat():
    hull = _hull_outline(3.5, 1.35, bow=0.3, stern=0.72)
    extrude(_scaled(hull, 0.9, 0.7), 0.25, color="snow", center=False)
    extrude(_scaled(hull, 0.97, 0.9), 0.15, at=(0, 0, 0.2), color="snow", center=False)
    if _lod1():
        extrude(hull, 0.36, at=(0, 0, 0.3), color="pine", center=False)
        extrude(_scaled(hull, 0.9, 0.82), 0.02, at=(0, 0, 0.66), color="sand", center=False)
    else:
        extrude(_scaled(hull, 0.92, 0.85), 0.04, at=(0, 0, 0.33), color="sand", center=False)
        _gunwale(hull, 0.3, 0.66, 0.09, "pine")
    for x in (-0.75, 0.35):
        box((0.28, 1.15, 0.06), at=(x, 0, 0.5), base=True, color="caramel")
    box((0.4, 0.95, 0.06), at=(-1.45, 0, 0.5), base=True, color="caramel", lod0=True)
    for s in (-1, 1):
        box((2.3, 0.06, 0.06), at=(-0.2, s * 0.32, 0.6), color="caramel")
        box((0.5, 0.14, 0.03), at=(-1.4, s * 0.32, 0.6), color="caramel", lod0=True)
    box((0.12, 0.12, 0.12), at=(-0.2, -0.62, 0.66), base=True, color="ink_soft", lod0=True)
    box((0.12, 0.12, 0.12), at=(-0.2, 0.62, 0.66), base=True, color="ink_soft", lod0=True)


def _canoe_outline(Lh, B, n=10):
    pts = []
    for i in range(n + 1):
        t = -1 + 2 * i / n
        pts.append((t * Lh / 2, -B / 2 * (1 - abs(t) ** 2.2) ** 0.9))
    for i in range(n - 1, 0, -1):
        t = -1 + 2 * i / n
        pts.append((t * Lh / 2, B / 2 * (1 - abs(t) ** 2.2) ** 0.9))
    return pts


@asset("canoe", "Canoe", "Seats two people who will disagree about steering.", L, "wood", "small",
       variants=["tomato", "sun", "sky", "leaf", "tangerine"], col="box", fill=0.3)
def canoe():
    Lh, B = 4.5, 0.9
    hull = _canoe_outline(Lh, B, 12 if not _lod1() else 6)
    extrude(_scaled(hull, 0.95, 0.7), 0.2, color="tomato", tint=True, center=False)
    extrude(hull, 0.38, at=(0, 0, 0.15), color="tomato", tint=True, center=False)
    extrude(_scaled(hull, 0.9, 0.78), 0.03, at=(0, 0, 0.52), color="sand", center=False)
    extrude(_scaled(hull, 1.01, 1.06), 0.07, at=(0, 0, 0.45), color="cocoa", center=False, lod0=True)
    for s in (-1, 1):
        _poly3d([(s * 1.75, 0.0, 0.3), (s * 2.25, 0.0, 0.42), (s * 2.3, 0.0, 0.78), (s * 1.9, 0.0, 0.6)], 0.1,
                "tomato", tint=True)
        box((0.22, B * 0.62, 0.06), at=(s * 1.35, 0, 0.55), base=True, color="caramel")
    box((0.2, B * 0.85, 0.06), at=(0, 0, 0.55), base=True, color="caramel", lod0=True)
    box((1.6, 0.06, 0.06), at=(0.3, 0.12, 0.62), rot=(0, 0, 8), color="caramel", lod0=True)
    box((0.55, 0.16, 0.05), at=(1.15, 0.24, 0.62), rot=(0, 0, 8), color="caramel", lod0=True)


@asset("river_barge", "River Barge", "Moves gravel at the speed of a thoughtful duck.", L, "metal", "large",
       col="box", fill=0.6)
def river_barge():
    Lh, B, Hh = 30.0, 9.0, 1.5
    extrude([(-13.6, 0.0), (13.6, 0.0), (15.0, Hh), (-15.0, Hh)], B, rot=(90, 0, 0), color="brick")
    box((Lh - 0.2, B + 0.2, 0.28), at=(0, 0, Hh - 0.3), base=True, color="charcoal")
    box((Lh - 0.6, B - 0.4, 0.06), at=(0, 0, Hh), base=True, color="charcoal")
    # hold coaming
    for s in (-1, 1):
        box((24.0, 0.35, 0.8), at=(0, s * 3.7, Hh), base=True, color="sun")
        box((0.35, 7.75, 0.8), at=(s * 12.0, 0, Hh), base=True, color="sun")
    # cargo heaps
    for (x, c) in ((-7.8, "sand"), (0.0, "stone"), (7.8, "sand")):
        sphere(1.0, at=(x, 0, Hh + 0.2), scale=(3.5, 3.1, 1.6), color=c, segs=12, rings=6)
    # bitts
    for x in (-14.0, 14.0):
        for y in (-3.6, 3.6):
            cyl(0.22, 0.5, at=(x, y, Hh), color="ink_soft", segs=6, lod0=True)


@asset("tugboat", "Tugboat", "Small, loud, and convinced it is the biggest boat here.", L, "metal", "large",
       col="box", fill=0.5)
def tugboat():
    hull = _hull_outline(12.0, 5.0, bow=0.55, stern=0.85)
    extrude(_scaled(hull, 0.92, 0.8), 0.55, color="ink_soft", center=False)
    extrude(hull, 1.5, at=(0, 0, 0.5), color="tomato", center=False)
    extrude(_scaled(hull, 1.03, 1.06), 0.35, at=(0, 0, 1.45), color="ink_soft", center=False)
    extrude(_scaled(hull, 0.96, 0.92), 0.06, at=(0, 0, 1.95), color="sand", center=False)
    sphere(0.55, at=(6.0, 0, 1.5), scale=(1.0, 1.0, 1.3), color="ink_soft", segs=8, rings=5)
    # deckhouse + wheelhouse
    box((5.4, 3.2, 1.8), at=(-0.6, 0, 2.0), base=True, color="snow")
    for x in (-2.6, -0.6, 1.4):
        for y in (-1.6, 1.6):
            cyl(0.28, 0.1, at=(x, y, 3.0), rot=(90, 0, 0), base=False, color="glass", segs=8, lod0=True)
    box((5.8, 3.6, 0.2), at=(-0.6, 0, 3.8), base=True, color="tomato")
    box((2.6, 3.0, 1.7), at=(0.9, 0, 4.0), base=True, color="snow")
    box((0.12, 2.6, 0.8), at=(2.2, 0, 4.7), base=True, color="glass")
    for y in (-1.5, 1.5):
        box((2.1, 0.12, 0.8), at=(0.9, y, 4.7), base=True, color="glass")
    box((3.0, 3.4, 0.2), at=(0.9, 0, 5.7), base=True, color="tomato")
    cyl(0.07, 1.2, at=(0.9, 0, 5.9), color="ink_soft", segs=6)
    sphere(0.14, at=(0.9, 0, 7.1), color="sun", segs=6, rings=4)
    # stack
    cyl(0.5, 2.6, at=(-1.9, 0, 3.8), color="sun", segs=10)
    cyl(0.52, 0.45, at=(-1.9, 0, 6.0), color="ink", segs=10)
    # tyre fenders + towing bitt + lifebuoy
    if not _lod1():
        for x in (-3.5, -1.0, 1.5, 3.8):
            for s in (-1, 1):
                torus(0.32, 0.12, at=(x, s * 2.6, 1.2), rot=(90, 0, 0), color="ink", segs=8, rsegs=4)
    cyl(0.25, 0.6, at=(-4.6, 0, 2.0), color="ink_soft", segs=8)
    box((0.9, 0.18, 0.18), at=(-4.6, 0, 2.45), color="ink_soft")
    torus(0.32, 0.08, at=(-0.6, -1.62, 2.9), rot=(90, 0, 0), color="tangerine", segs=10, rsegs=4, lod0=True)


@asset("boathouse", "Boathouse", "A garage for boats. Smells like rope and summer.", L, "wood", "large",
       variants=["tomato", "sky", "snow", "butter"], col="box", fill=0.6)
def boathouse():
    X, y0, y1, Hw = 5.0, -3.0, 6.0, 3.4
    wall = dict(color="tomato", tint=True)
    box((2 * X, y1 - y0, Hw), at=(0, (y0 + y1) / 2, 0.4), base=True, **wall)
    extrude([(-X, 0), (X, 0), (0, 2.3)], 0.2, at=(0, y0 + 0.1, 0.4 + Hw), rot=(90, 0, 0), color="tomato", tint=True)
    box((2 * X + 0.8, y1 - y0 + 0.8, 2.5), at=(0, (y0 + y1) / 2, 0.4 + Hw), base=True, taper=(0.02, 1.0),
        color="slate")
    # board-and-batten
    if not _lod1():
        for i in range(9):
            x = -4.0 + i * 1.0
            if abs(x) < 2.8:
                continue
            box((0.1, 0.08, Hw), at=(x, y0 - 0.02, 0.4), base=True, color="tomato", tint=True)
    # big boat door, small side door, windows, sign
    box((5.2, 0.14, 3.0), at=(0, y0, 0.4), base=True, color="ink_soft")
    box((5.6, 0.2, 0.3), at=(0, y0 - 0.05, 3.4), base=True, color="snow")
    box((2.6, 0.12, 0.5), at=(0, y0 - 0.06, 4.1), base=True, color="snow")
    _letters(-1.0, 1.0, y0 - 0.12, 4.18, 0.34, 5, color="tomato")
    box((0.14, 1.1, 2.2), at=(X, 3.8, 0.4), base=True, color="snow")
    _win(X, 0.8, 1.6, 1.2, 1.0, face="+x", color="glass", sill="snow")
    _win(-X, 2.4, 1.6, 1.2, 1.0, face="+x", color="glass")
    # dock with finger piers around the slip
    for s in (-1, 1):
        box((2.3, 3.2, 0.2), at=(s * 3.85, -4.4, 0.35), base=True, color="caramel")
        for y in (-5.8, -3.2):
            cyl(0.15, 0.6, at=(s * 4.85, y, 0), color="cocoa", segs=6)
            cyl(0.15, 0.6, at=(s * 2.85, y, 0), color="cocoa", segs=6, lod0=True)
    box((2 * X, 0.6, 0.4), at=(0, y0 + 0.0, 0), base=True, color="caramel")
    box((2 * X + 0.2, y1 - y0 + 0.2, 0.4), at=(0, (y0 + y1) / 2, 0), base=True, color="stone")
    # a canoe on the dock
    box((2.6, 0.5, 0.25), at=(-3.9, -4.4, 0.55), base=True, color="tangerine", lod0=True)


# ---------------------------------------------------------------- farm belt

@asset("ranch_fence", "Ranch Fence", "Three rails, zero cows escaped. This week.", L, "wood", "tiny",
       variants=["snow", "caramel", "cocoa"], col="box", fill=0.25, place={"tile_length": 3.0})
def ranch_fence():
    Lf, Hf, Df = 3.0, 1.3, 0.15
    for s in (-1, 1):
        box((Df / 2, Df, Hf), at=(s * (Lf / 2 - Df / 4), 0, 0), base=True, color="snow", tint=True)
    for z in (0.32, 0.72, 1.1):
        box((Lf, 0.05, 0.16), at=(0, -Df / 2 + 0.025, z), base=True, color="snow", tint=True)


@asset("scarecrow", "Scarecrow", "Has frightened zero crows. Has befriended several.", L, "soft", "small",
       col="box", fill=0.25)
def scarecrow():
    if _lod1():
        box((0.1, 0.1, 1.75), at=(0, 0.06, 0), base=True, color="cocoa")
        box((0.4, 0.22, 0.95), at=(0, 0, 0.3), base=True, color="navy")
        box((0.42, 0.3, 0.45), at=(0, 0, 1.15), base=True, color="tomato")
        box((1.0, 0.18, 0.18), at=(0, 0, 1.5), color="tomato")
        sphere(0.22, at=(0, 0, 1.78), color="sand", segs=6, rings=4)
        cyl(0.3, 0.04, at=(0, 0, 1.92), color="butter", segs=8)
        cyl(0.15, 0.22, at=(0, 0, 1.95), r2=0.12, color="butter", segs=8)
        return
    box((0.1, 0.1, 1.75), at=(0, 0.06, 0), base=True, color="cocoa")
    # trousers + straw feet
    for x in (-0.11, 0.11):
        cyl(0.09, 0.62, at=(x, 0, 0.42), r2=0.1, color="navy", segs=6)
        cyl(0.1, 0.14, at=(x, 0, 0.29), r2=0.02, rot=(180, 0, 0), color="butter", segs=5)
    box((0.42, 0.26, 0.4), at=(0, 0, 0.95), base=True, color="navy")
    # shirt, arms on the crossbar, straw hands
    cyl(0.21, 0.52, at=(0, 0, 1.1), r2=0.24, scale=(1, 0.65, 1), color="tomato", segs=8)
    box((0.3, 0.06, 0.32), at=(0, -0.14, 1.16), base=True, color="navy")
    box((0.86, 0.08, 0.08), at=(0, 0.06, 1.5), color="cocoa")
    for s in (-1, 1):
        cyl(0.085, 0.3, at=(s * 0.22, 0, 1.5), rot=(0, s * 90, 0), r2=0.1, color="tomato", segs=6)
        cyl(0.09, 0.15, at=(s * 0.38, 0, 1.5), rot=(0, s * 90, 0), r2=0.01, color="butter", segs=5)
    # sack head with dot eyes, hat with a band
    sphere(0.22, at=(0, 0, 1.78), scale=(1, 0.9, 1.0), color="sand", segs=8, rings=5)
    _dot_eyes((0, -0.19, 1.8), 0.15, 0.034)
    cyl(0.3, 0.04, at=(0, 0, 1.92), color="butter", segs=10)
    cyl(0.15, 0.22, at=(0, 0, 1.95), r2=0.12, color="butter", segs=8)
    cyl(0.152, 0.05, at=(0, 0, 1.97), color="tomato", segs=8)
    # a crow friend
    sphere(0.08, at=(0.33, 0.06, 1.62), scale=(1.3, 0.8, 0.9), color="ink_soft", segs=6, rings=4)
    sphere(0.05, at=(0.4, 0.06, 1.7), color="ink_soft", segs=5, rings=3)
    cyl(0.02, 0.06, at=(0.45, 0.06, 1.7), rot=(0, 90, 0), r2=0.002, base=False, color="sun", segs=4)


@asset("combine_harvester", "Combine Harvester", "Eats a field for breakfast, then asks for seconds.", L,
       "metal", "large", variants=["leaf", "sun", "tomato"], col="box", fill=0.45)
def combine_harvester():
    body = dict(color="leaf", tint=True)
    for y in (-1.45, 1.45):
        _wheel((0.9, y, 0.85), 0.85, 0.55, hub="snow", segs=16, hub_r=0.38)
        _wheel((-3.1, y * 0.85, 0.5), 0.5, 0.35, hub="snow", segs=8, hub_r=0.2)
    box((5.9, 2.4, 2.0), at=(-1.25, 0, 0.9), base=True, bevel=0.1, **body)
    box((1.8, 2.2, 0.8), at=(-3.1, 0, 2.9), base=True, **body)
    box((2.5, 2.5, 0.9), at=(-1.0, 0, 2.9), base=True, taper=(1.08, 1.08), **body)
    box((0.7, 2.44, 0.18), at=(-4.0, 0, 1.2), base=True, color="charcoal")
    # cab
    box((1.6, 1.8, 0.4), at=(0.95, 0, 2.9), base=True, **body)
    box((1.5, 1.6, 0.95), at=(0.95, 0, 3.3), base=True, color="glass")
    box((1.9, 2.0, 0.16), at=(0.95, 0, 4.25), base=True, color="snow")
    cyl(0.08, 0.6, at=(-3.6, 0.6, 3.7), color="charcoal", segs=6)
    # unloading auger folded along the side
    tube([(-2.5, 1.32, 2.8), (-2.2, 1.35, 3.75), (0.2, 1.35, 3.75)], 0.16, color="leaf", tint=True, segs=6)
    # feeder house + header + reel
    box((1.8, 1.5, 0.8), at=(2.5, 0, 0.9), rot=(0, 18, 0), color="leaf", tint=True)
    box((1.4, 6.0, 0.55), at=(3.6, 0, 0.35), base=True, **body)
    box((0.35, 6.0, 0.12), at=(4.35, 0, 0.3), base=True, color="charcoal")
    box((1.5, 0.12, 1.0), at=(3.55, -2.94, 0.35), base=True, **body)
    box((1.5, 0.12, 1.0), at=(3.55, 2.94, 0.35), base=True, **body)
    for s in (-1, 1):
        lathe([(0.0, 0.0), (0.16, 0.0), (0.0, 0.55)], at=(4.2, s * 2.85, 0.6), rot=(0, 90, 0), color="snow",
              segs=6)
        cyl(0.62, 0.06, at=(3.9, s * 2.75, 1.65), rot=(90, 0, 0), base=False, color="snow", segs=10)
        box((1.6, 0.1, 0.1), at=(3.2, s * 2.8, 1.5), rot=(0, 10, 0), color="snow")
    cyl(0.08, 5.5, at=(3.9, 0, 1.65), rot=(90, 0, 0), base=False, color="snow", segs=6)
    for k in range(6 if not _lod1() else 3):
        a = math.radians(30 + k * (60 if not _lod1() else 120))
        box((0.12, 5.4, 0.12), at=(3.9 + 0.58 * math.cos(a), 0, 1.65 + 0.58 * math.sin(a)), color="snow")
    _win(0.95, -0.85, 3.4, 0.05, 0.05, face="-y", color="glass")
    box((0.1, 0.4, 0.9), at=(1.8, -0.75, 1.9), base=True, color="ink_soft", lod0=True)


# ---------------------------------------------------------------- mill + water wheel

WW_AXLE = (-7.0, -6.5, 4.5)  # water wheel axle in mill authoring coords


@asset("mill", "Brick Mill", "Grinds flour all day. Dusts everyone for free.", L, "stone", "large",
       col="box", fill=0.7, place={"water_wheel_axle_game_xyz": [-7.0, 4.5, 5.325], "pairs": "water_wheel"})
def mill():
    X, y0, y1, Hw = 13.0, -5.0, 6.0, 10.5
    yc = (y0 + y1) / 2
    box((2 * X + 0.3, y1 - y0 + 0.3, 1.2), at=(0, yc, 0), base=True, color="concrete")
    box((2 * X, y1 - y0, Hw - 1.2), at=(0, yc, 1.2), base=True, color="brick")
    box((2 * X + 0.6, y1 - y0 + 0.8, 2.9), at=(0, yc, Hw), base=True, taper=(1.0, 0.02), color="slate")
    # chimney
    box((1.8, 1.8, 14.6), at=(10.0, 3.6, 0), base=True, color="brick")
    box((2.2, 2.2, 0.6), at=(10.0, 3.6, 14.6), base=True, color="concrete")
    box((1.2, 1.2, 0.8), at=(10.0, 3.6, 15.2), base=True, color="ink_soft")
    # windows (none hidden behind the wheel)
    wx, _, wz = WW_AXLE
    for z in (1.9, 5.0, 8.0):
        for i in range(7):
            x = -10.5 + i * 3.5
            if abs(x - wx) < 4.6 and z < wz + 4.2:
                continue
            _win(x, y0, z, 1.3, 1.9, color="glass", lod0=False)
            box((1.6, 0.3, 0.28), at=(x, y0 - 0.05, z + 1.9), base=True, color="concrete", lod0=True)
    for s in (-1, 1):
        for y in (-2.5, 0.5, 3.5):
            for z in (1.9, 5.0, 8.0):
                _win(s * X, y, z, 1.2, 1.9, face="+x", color="glass")
    # lucam (hoist housing) over the loading doors
    box((2.4, 1.4, 3.2), at=(6.0, y0 - 0.6, Hw - 1.8), base=True, color="cocoa")
    box((3.0, 2.0, 0.3), at=(6.0, y0 - 0.6, Hw + 1.4), base=True, rot=(-12, 0, 0), color="slate")
    for z in (1.2, 4.6):
        box((1.8, 0.16, 2.6), at=(6.0, y0, z), base=True, color="cocoa")
    box((0.2, 1.2, 0.2), at=(6.0, y0 - 1.6, Hw - 0.5), color="cocoa", lod0=True)
    # wheel bearings: boss on the wall, outer stone pier with a stub axle
    box((1.6, 0.8, wz), at=(wx, -8.3, 0), base=True, color="concrete")
    box((1.8, 0.9, 0.5), at=(wx, -8.3, wz - 0.25), base=True, color="charcoal")
    cyl(0.22, 0.75, at=(wx, -7.85, wz), rot=(90, 0, 0), base=False, color="charcoal", segs=8)
    cyl(0.45, 0.35, at=(wx, y0 - 0.15, wz), rot=(90, 0, 0), base=False, color="charcoal", segs=8)
    # tailrace with low stone kerbs
    box((9.6, 3.0, 0.12), at=(wx, -6.5, 0), base=True, color="teal")
    for x in (wx - 4.95, wx + 4.95):
        box((0.3, 3.4, 0.5), at=(x, -6.5, 0), base=True, color="concrete")
    # overshot flume over the top of the wheel, on a trestle post
    box((2.2, 3.4, 0.6), at=(wx, -6.4, wz + 4.25), base=True, color="cocoa")
    box((1.8, 3.4, 0.1), at=(wx, -6.4, wz + 4.8), base=True, color="teal")
    box((0.3, 0.3, 4.25 - 0.5), at=(wx, -7.9, wz + 0.5), base=True, color="cocoa")
    # door
    box((2.4, 0.16, 3.0), at=(-1.0, y0, 1.2), base=True, color="cocoa")
    _steps(-1.0, y0 - 1.0, 1.2, 2.8, n=2, run=0.5)


@asset("water_wheel", "Water Wheel", "Goes round and round. Has never once got dizzy.", L, "wood", "large",
       col="cyl", fill=0.35, place={"rotates": True, "axle": "Y", "mill_axle_height": WW_AXLE[2]})
def water_wheel():
    R, T = 4.0, 2.5
    for y in (-1.0, 1.0):
        torus(R - 0.2, 0.2, at=(0, y, 0), rot=(90, 0, 0), color="cocoa", segs=24, rsegs=4)
        torus(3.0, 0.12, at=(0, y, 0), rot=(90, 0, 0), color="cocoa", segs=16, rsegs=3, lod0=True)
    for i in range(16):
        a = 22.5 * i
        r = math.radians(a)
        box((0.95, 2.0, 0.1), at=((R - 0.5) * math.cos(r), 0, (R - 0.5) * math.sin(r)), rot=(0, -a, 0),
            color="caramel")
    ns = 8 if not _lod1() else 4
    for y in (-1.0, 1.0):
        for i in range(ns):
            a = 180.0 * i / ns
            r = math.radians(a)
            box((2 * (R - 0.25), 0.2, 0.2), at=(0, y, 0), rot=(0, -a, 0), color="cocoa")
    cyl(0.6, 2.2, at=(0, 0, 0), rot=(90, 0, 0), base=False, color="cocoa", segs=8)
    cyl(0.2, T, at=(0, 0, 0), rot=(90, 0, 0), base=False, color="charcoal", segs=8)


# ---------------------------------------------------------------- split mechanisms (the game spins the moving part)

FW_AXLE = 19.0   # ferris wheel axle height above the frame's base
FW_R = 15.4      # rim radius; gondolas centred at FW_R + 0.5 with radius 1.5, so the ring is ~34.8 m across


@asset("ferris_wheel_frame", "Ferris Wheel Frame", "Holds the wheel up and never gets a turn itself.", L,
       "metal", "landmark", col="box", fill=0.2, place={"axle_height": FW_AXLE, "axle": "Y", "pairs": "ferris_wheel_ring"})
def ferris_wheel_frame():
    zc = FW_AXLE
    box((18.0, 8.0, 0.8), base=True, color="stone")
    # A-legs on both sides of the wheel, meeting at the bearings
    for y in (-1, 1):
        for x in (-7.6, 7.6):
            tube([(x, y * 3.4, 0.8), (0, y * 2.95, zc - 0.3)], 0.5, color="cobalt", segs=8)
        tube([(-5.0, y * 3.3, 7.0), (5.0, y * 3.3, 7.0)], 0.3, color="cobalt", segs=6)
        tube([(-2.6, y * 3.12, 13.0), (2.6, y * 3.12, 13.0)], 0.25, color="cobalt", segs=6, lod0=True)
        box((1.8, 0.8, 1.8), at=(0, y * 2.95, zc), color="sun")
        cyl(0.55, 0.5, at=(0, y * 3.45, zc), rot=(90, 0, 0), base=False, color="cobalt", segs=10)
    # loading deck under the lowest gondola, steps, ticket booth
    box((3.6, 2.4, 0.5), at=(0, 0, 0.8), base=True, color="cloud")
    for i in range(2):
        box((2.0, 0.6, 0.25 * (i + 1)), at=(0, -1.5 - 0.6 * (1 - i), 0.8), base=True, color="cloud", lod0=True)
    box((3.4, 2.6, 2.4), at=(6.2, -2.3, 0.8), base=True, color="snow")
    box((3.8, 3.0, 0.3), at=(6.2, -2.3, 3.2), base=True, color="tomato")
    box((1.8, 0.1, 0.9), at=(6.2, -3.62, 1.9), base=True, color="glass", lod0=True)
    for x in (-8.0, 8.0):
        box((0.12, 7.6, 0.9), at=(x, 0, 0.8), base=True, color="tomato", lod0=True)


@asset("ferris_wheel_ring", "Ferris Wheel Ring", "The part that actually does the going round.", L, "metal",
       "landmark", col="cyl", fill=0.15, place={"rotates": True, "axle": "Y", "centre_above_origin": FW_R + 0.5 + 1.5})
def ferris_wheel_ring():
    lod1 = _lod1()
    R = FW_R
    for y in (-1.6, 1.6):
        torus(R, 0.55, at=(0, y, 0), rot=(90, 0, 0), color="snow", segs=40, rsegs=6)
    torus(R * 0.55, 0.35, at=(0, 0, 0), rot=(90, 0, 0), color="tomato", segs=24, rsegs=4, lod0=True)
    for y in (-1.45, 1.45):
        for i in range(6):
            a = 30.0 * i + 15.0
            box((2 * R, 0.55, 0.55), at=(0, y, 0), rot=(0, -a, 0), color="snow")
    cyl(1.3, 4.4, at=(0, 0, 0), rot=(90, 0, 0), base=False, color="sun", segs=12)
    cyl(0.5, 5.2, at=(0, 0, 0), rot=(90, 0, 0), base=False, color="cobalt", segs=8)
    # drum-shaped gondolas between the rims (round, so they read right at any angle)
    cols = ("tomato", "sun", "sky", "leaf")
    Rp = R + 0.5
    for i in range(16):
        a = math.radians(22.5 * i)
        px, pz = Rp * math.cos(a), Rp * math.sin(a)
        cyl(1.5, 2.4, at=(px, 0, pz), rot=(90, 0, 0), base=False, color=cols[i % 4], segs=12 if not lod1 else 8)
        cyl(1.0, 2.52, at=(px, 0, pz), rot=(90, 0, 0), base=False, color="glass", segs=10, lod0=True)


WM_AXLE = 14.4      # windmill axle height
WM_FORWARD = 5.0    # sails plane sits this far in front (-Y) of the tower centre


@asset("windmill_tower", "Windmill Tower", "A windmill with its arms off, waiting patiently.", L, "wood", "large",
       col="cyl", fill=0.4, place={"axle_height": WM_AXLE, "sails_forward": WM_FORWARD, "axle": "Y",
                                    "pairs": "windmill_sails"})
def windmill_tower():
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
    # wind shaft out of the cap (ends inside the sails' hub)
    cyl(0.42, 2.25, at=(0, -(WM_FORWARD - 0.25 - 2.25 / 2), WM_AXLE), rot=(90, 0, 0), base=False, color="cocoa",
        segs=8)
    # tail pole + winch at the back (turns the cap; also balances the bounding box)
    tube([(0, 3.2, 13.2), (0, 4.45, 6.6)], 0.15, color="cocoa", segs=5)
    box((0.7, 0.3, 0.7), at=(0, WM_FORWARD - 0.25 - 0.15, 6.2), base=True, color="cocoa")


@asset("windmill_sails", "Windmill Sails", "Four big arms, waving at absolutely everyone.", L, "wood", "large",
       col="cyl", fill=0.15, place={"rotates": True, "axle": "Y"})
def windmill_sails():
    Ls = 9.9
    sphere(0.65, color="cocoa", segs=8, rings=5)
    for i in range(4):
        phi = 45 + 90 * i
        r = math.radians(phi)
        d = Vector((math.sin(r), 0, math.cos(r)))
        p = Vector((math.cos(r), 0, -math.sin(r)))
        c = d * (Ls / 2)
        box((0.36, 0.32, Ls), at=tuple(c), rot=(0, phi, 0), color="cocoa")
        pc = d * 6.0 + p * 1.05
        box((1.9, 0.12, 7.2), at=tuple(pc), rot=(0, phi, 0), color="sand")
        if not _lod1():
            for j in range(6):
                q = d * (2.7 + j * 1.32) + p * 1.05 + Vector((0, -0.08, 0))
                box((2.0, 0.06, 0.1), at=tuple(q), rot=(0, phi, 0), color="cocoa")
            q = d * 6.0 + p * 2.0 + Vector((0, -0.08, 0))
            box((0.1, 0.06, 7.2), at=tuple(q), rot=(0, phi, 0), color="cocoa")
            q = d * 6.0 + p * 2.0 + Vector((0, 0.08, 0))
            box((0.1, 0.06, 7.2), at=tuple(q), rot=(0, phi, 0), color="cocoa")


# ---------------------------------------------------------------- street furniture

@asset("town_lamp", "Acorn Street Lamp", "Glows warmly at moths. Moths glow warmly back.", L, "metal", "small",
       col="cyl", fill=0.15)
def town_lamp():
    cyl(0.3, 0.25, color="pine", segs=8)
    cyl(0.22, 1.0, at=(0, 0, 0.25), r2=0.11, color="pine", segs=8)
    torus(0.15, 0.04, at=(0, 0, 1.25), color="pine", segs=10, rsegs=3, lod0=True)
    cyl(0.075, 2.3, at=(0, 0, 1.25), color="pine", segs=8)
    cyl(0.17, 0.12, at=(0, 0, 3.5), r2=0.12, color="pine", segs=10)
    lathe([(0.11, 3.62), (0.24, 3.76), (0.27, 3.95), (0.22, 4.13), (0.13, 4.24), (0.0, 4.27)], color="butter",
          segs=12)
    cyl(0.14, 0.14, at=(0, 0, 4.18), r2=0.05, color="pine", segs=8)
    sphere(0.06, at=(0, 0, 4.38), color="pine", segs=6, rings=4)
    cyl(0.015, 0.08, at=(0, 0, 4.42), color="pine", segs=4, lod0=True)


@asset("planter", "Flower Planter", "The town's proudest petunias. Do not roll on the petunias.", L, "plant",
       "small", col="box", fill=0.7)
def planter():
    box((1.5, 0.8, 0.5), base=True, color="concrete")
    box((1.56, 0.86, 0.08), at=(0, 0, 0.48), base=True, color="concrete", lod0=True)
    box((1.36, 0.66, 0.1), at=(0, 0, 0.5), base=True, color="cocoa")
    for (x, y, r) in ((-0.42, 0.05, 0.25), (0.05, -0.05, 0.27), (0.45, 0.06, 0.24)):
        ico(r, at=(x, y, 0.55), scale=(1.1, 0.95, 0.75), color="leaf")
    flowers = ((-0.55, -0.18, "tomato"), (-0.3, 0.12, "sun"), (-0.05, -0.2, "bubblegum"), (0.2, 0.15, "tomato"),
               (0.38, -0.15, "sun"), (0.6, 0.1, "bubblegum"), (-0.2, -0.05, "tomato"), (0.1, 0.12, "sun"))
    for i, (x, y, c) in enumerate(flowers):
        sphere(0.085, at=(x, y, 0.78 + 0.03 * (i % 3)), color=c, segs=6, rings=4, lod0=i >= 4)
