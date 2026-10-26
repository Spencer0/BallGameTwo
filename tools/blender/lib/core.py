"""Part helpers for building Lint Roller assets.

Every helper appends geometry to one shared bmesh ("the builder"). Each face stores the palette
slot of its part in material_index (slot = palette index, +64 when the part is tintable).
`finalize()` turns the builder into a Blender object with palette materials (for thumbnails)
and a COLOR_0 attribute that encodes (palette_index/255, tint, 0, 1) for the game.

LOD: assets are rebuilt with STATE.lod = 1, where helpers drop segment counts, bevels and
parts marked `lod0=True`. This keeps LOD1 colours exact (no decimation smearing).
Units are metres, Blender Z-up; the object's base sits at z = 0.
"""
import math
import bmesh
import bpy
from mathutils import Matrix, Vector, Euler

from .palette import INDEX, PALETTE, linear

TINT_OFFSET = 64


class _State:
    lod = 0
    bm = None


STATE = _State()


def begin(lod=0):
    STATE.lod = lod
    if STATE.bm is not None:
        STATE.bm.free()
    STATE.bm = bmesh.new()


def seg(n, minimum=3):
    """Segment count for the current LOD."""
    if STATE.lod == 0:
        return n
    return max(minimum, int(round(n * 0.5)))


def _matrix(at, rot, scale=None):
    m = Matrix.Translation(Vector(at)) @ Euler([math.radians(a) for a in rot], "XYZ").to_matrix().to_4x4()
    if scale is not None:
        m = m @ Matrix.Diagonal(Vector((scale[0], scale[1], scale[2], 1.0)))
    return m


def _slot(color, tint):
    if color not in INDEX:
        raise KeyError(f"colour '{color}' is not in the palette")
    return INDEX[color] + (TINT_OFFSET if tint else 0)


def _merge(tmp, color, tint, matrix, smooth=True):
    """Transform temp bmesh and copy it into the builder."""
    tmp.transform(matrix)
    bm = STATE.bm
    vmap = {}
    for v in tmp.verts:
        vmap[v] = bm.verts.new(v.co)
    slot = _slot(color, tint)
    for f in tmp.faces:
        try:
            nf = bm.faces.new([vmap[v] for v in f.verts])
        except ValueError:
            continue
        nf.material_index = slot
        nf.smooth = smooth
    tmp.free()


def _skip(lod0):
    return lod0 and STATE.lod > 0


# ---------------------------------------------------------------- primitives

def box(size, at=(0, 0, 0), rot=(0, 0, 0), color="cloud", bevel=0.0, bseg=2, base=False,
        tint=False, lod0=False, taper=None):
    """Box of `size` (x, y, z). base=True puts `at` on the bottom face.
    taper=(sx, sy) scales the top face (for wedges, roofs, trapezoids)."""
    if _skip(lod0):
        return
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1.0)
    for v in tmp.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
        if taper and v.co.z > 0:
            v.co.x *= taper[0]
            v.co.y *= taper[1]
    b = bevel if STATE.lod == 0 else 0.0
    if b > 0:
        bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=min(b, min(size) * 0.49), segments=bseg,
                        affect="EDGES", profile=0.5, clamp_overlap=True)
    off = Vector((0, 0, size[2] / 2 if base else 0))
    _merge(tmp, color, tint, _matrix(at, rot) @ Matrix.Translation(off), smooth=b > 0)


def cyl(r, h, at=(0, 0, 0), rot=(0, 0, 0), color="cloud", segs=12, r2=None, base=True,
        bevel=0.0, tint=False, lod0=False, scale=None, caps=True):
    """Cylinder / cone frustum along local Z. r2 = top radius."""
    if _skip(lod0):
        return
    tmp = bmesh.new()
    n = seg(segs, 4)
    top = r if r2 is None else r2
    bmesh.ops.create_cone(tmp, cap_ends=caps, cap_tris=False, segments=n, radius1=r, radius2=max(top, 1e-5),
                          depth=h)
    b = bevel if STATE.lod == 0 else 0.0
    if b > 0:
        cap_edges = [e for e in tmp.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
        bmesh.ops.bevel(tmp, geom=cap_edges, offset=min(b, h * 0.45, r * 0.45), segments=2, affect="EDGES",
                        profile=0.5, clamp_overlap=True)
    off = Matrix.Translation(Vector((0, 0, h / 2 if base else 0)))
    _merge(tmp, color, tint, _matrix(at, rot, scale) @ off)


def sphere(r, at=(0, 0, 0), rot=(0, 0, 0), color="cloud", segs=12, rings=None, scale=(1, 1, 1),
           tint=False, lod0=False, smooth=True):
    if _skip(lod0):
        return
    tmp = bmesh.new()
    u = seg(segs, 5)
    v = seg(rings if rings else max(4, segs // 2 + 1), 3)
    bmesh.ops.create_uvsphere(tmp, u_segments=u, v_segments=v, radius=r)
    _merge(tmp, color, tint, _matrix(at, rot, scale), smooth=smooth)


def ico(r, at=(0, 0, 0), color="cloud", subdiv=1, scale=(1, 1, 1), rot=(0, 0, 0), tint=False, lod0=False,
        smooth=False):
    """Icosphere; good for tiny or faceted things (crumbs, rocks)."""
    if _skip(lod0):
        return
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=subdiv if STATE.lod == 0 else max(1, subdiv - 1), radius=r)
    _merge(tmp, color, tint, _matrix(at, rot, scale), smooth=smooth)


def torus(R, r, at=(0, 0, 0), rot=(0, 0, 0), color="cloud", segs=14, rsegs=6, arc=360.0, tint=False,
          lod0=False, scale=None):
    """Torus in the local XY plane. arc < 360 makes an open handle (no caps)."""
    if _skip(lod0):
        return
    tmp = bmesh.new()
    n = seg(segs, 6)
    m = seg(rsegs, 4)
    closed = arc >= 359.9
    count = n if closed else n + 1
    rings = []
    for i in range(count):
        a = math.radians(arc) * i / n
        ring = []
        for j in range(m):
            b = 2 * math.pi * j / m
            rr = R + r * math.cos(b)
            ring.append(tmp.verts.new((rr * math.cos(a), rr * math.sin(a), r * math.sin(b))))
        rings.append(ring)
    for i in range(n):
        r0 = rings[i]
        r1 = rings[(i + 1) % count] if closed else rings[i + 1]
        for j in range(m):
            tmp.faces.new([r0[j], r0[(j + 1) % m], r1[(j + 1) % m], r1[j]])
    if not closed:
        for ring in (rings[0], rings[-1]):
            tmp.faces.new(ring if ring is rings[-1] else list(reversed(ring)))
    _merge(tmp, color, tint, _matrix(at, rot, scale))


def lathe(profile, at=(0, 0, 0), rot=(0, 0, 0), color="cloud", segs=12, tint=False, lod0=False, scale=None,
          smooth=True):
    """Revolve a profile [(radius, z), ...] around Z (bottom to top). radius 0 = pole."""
    if _skip(lod0):
        return
    tmp = bmesh.new()
    n = seg(segs, 5)
    rings = []
    for (rad, z) in profile:
        if rad <= 1e-6:
            rings.append([tmp.verts.new((0, 0, z))])
        else:
            rings.append([tmp.verts.new((rad * math.cos(2 * math.pi * i / n), rad * math.sin(2 * math.pi * i / n), z))
                          for i in range(n)])
    for a, b in zip(rings[:-1], rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for i in range(n):
                tmp.faces.new([a[0], b[i], b[(i + 1) % n]])
        elif len(b) == 1:
            for i in range(n):
                tmp.faces.new([a[i], b[0], a[(i + 1) % n]])
        else:
            for i in range(n):
                tmp.faces.new([a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]])
    if len(rings[0]) > 1:
        tmp.faces.new(list(reversed(rings[0])))
    if len(rings[-1]) > 1:
        tmp.faces.new(rings[-1])
    _merge(tmp, color, tint, _matrix(at, rot, scale), smooth=smooth)


def extrude(points, depth, at=(0, 0, 0), rot=(0, 0, 0), color="cloud", tint=False, lod0=False, center=True,
            bevel=0.0):
    """Prism from a 2D polygon (x, y) list, extruded along local Z by depth."""
    if _skip(lod0):
        return
    tmp = bmesh.new()
    z0 = -depth / 2 if center else 0.0
    vs = [tmp.verts.new((x, y, z0)) for (x, y) in points]
    face = tmp.faces.new(vs)
    bmesh.ops.recalc_face_normals(tmp, faces=[face])
    if face.normal.z > 0:
        face.normal_flip()
    res = bmesh.ops.extrude_face_region(tmp, geom=[face])
    top = [g for g in res["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(tmp, verts=top, vec=(0, 0, depth))
    bmesh.ops.recalc_face_normals(tmp, faces=list(tmp.faces))
    b = bevel if STATE.lod == 0 else 0.0
    if b > 0:
        cap_edges = [e for e in tmp.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
        bmesh.ops.bevel(tmp, geom=cap_edges, offset=b, segments=1, affect="EDGES", clamp_overlap=True)
    _merge(tmp, color, tint, _matrix(at, rot), smooth=False)


def tube(path, r, color="cloud", segs=8, tint=False, lod0=False, smooth_path=0, caps=True, r_end=None):
    """Sweep a circle along a polyline of 3D points (parallel-transport frames)."""
    if _skip(lod0):
        return
    pts = [Vector(p) for p in path]
    for _ in range(smooth_path if STATE.lod == 0 else max(0, smooth_path - 1)):
        out = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            out.append(a.lerp(b, 0.25))
            out.append(a.lerp(b, 0.75))
        out.append(pts[-1])
        pts = out
    tmp = bmesh.new()
    n = seg(segs, 4)
    tangents = []
    for i in range(len(pts)):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        tangents.append((b - a).normalized())
    up = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
    normal = tangents[0].cross(up).normalized()
    rings = []
    for i, (p, t) in enumerate(zip(pts, tangents)):
        normal = (normal - t * normal.dot(t)).normalized()
        binormal = t.cross(normal)
        rr = r if r_end is None else r + (r_end - r) * i / (len(pts) - 1)
        rings.append([tmp.verts.new(p + (normal * math.cos(2 * math.pi * j / n) + binormal * math.sin(2 * math.pi * j / n)) * rr)
                      for j in range(n)])
    for a, b in zip(rings[:-1], rings[1:]):
        for j in range(n):
            tmp.faces.new([a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]])
    if caps:
        tmp.faces.new(list(reversed(rings[0])))
        tmp.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(tmp, faces=list(tmp.faces))
    _merge(tmp, color, tint, Matrix.Identity(4))


def capsule(r, length, at=(0, 0, 0), rot=(0, 0, 0), color="cloud", segs=12, tint=False, lod0=False):
    """Capsule along local Z, centred at `at`."""
    if _skip(lod0):
        return
    k = seg(3, 1)
    prof = []
    for i in range(k + 1):
        a = -math.pi / 2 + (math.pi / 2) * i / k
        prof.append((r * math.cos(a), -length / 2 + r * math.sin(a)))
    for i in range(k + 1):
        a = (math.pi / 2) * i / k
        prof.append((r * math.cos(a), length / 2 + r * math.sin(a)))
    prof[0] = (0, prof[0][1])
    prof[-1] = (0, prof[-1][1])
    lathe(prof, at=at, rot=rot, color=color, segs=segs, tint=tint)


def ngon_points(n, r, start=90.0, sx=1.0, sy=1.0):
    return [(r * sx * math.cos(math.radians(start + 360 * i / n)), r * sy * math.sin(math.radians(start + 360 * i / n)))
            for i in range(n)]


def star_points(n, r_out, r_in, start=90.0):
    pts = []
    for i in range(2 * n):
        rr = r_out if i % 2 == 0 else r_in
        a = math.radians(start + 180 * i / n)
        pts.append((rr * math.cos(a), rr * math.sin(a)))
    return pts


def rounded_rect_points(w, h, r, corner_segs=3):
    r = min(r, w / 2, h / 2)
    k = seg(corner_segs, 1)
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)):
        for i in range(k + 1):
            a = math.radians(a0 + 90 * i / k)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


# ---------------------------------------------------------------- character helpers

def eyes(at, spacing, r, yaw=0.0, color="ink", shine=True, pitch=0.0):
    """Two dot eyes centred on `at`. Objects face -Y; yaw (degrees) turns the gaze around Z."""
    a = math.radians(yaw)
    side = (math.cos(a), math.sin(a))
    face = (math.sin(a), -math.cos(a))
    for k in (-1, 1):
        x = at[0] + side[0] * k * spacing / 2
        y = at[1] + side[1] * k * spacing / 2
        sphere(r, at=(x, y, at[2]), color=color, segs=10, scale=(1, 0.6, 1.15), rot=(pitch, 0, yaw))
        if shine:
            sphere(r * 0.36, at=(x + face[0] * r * 0.5 - side[0] * r * 0.32,
                                 y + face[1] * r * 0.5 - side[1] * r * 0.32, at[2] + r * 0.42),
                   color="snow", segs=6, lod0=True)


# ---------------------------------------------------------------- finalize

MATERIAL_CACHE = {}


def palette_material(slot):
    idx = slot % TINT_OFFSET
    name = PALETTE[idx][0]
    key = f"P_{name}"
    if key in bpy.data.materials:
        return bpy.data.materials[key]
    from .render import make_toon_material
    mat = make_toon_material(key, linear(name))
    return mat


def finalize(name, recenter=True):
    """Build the object from the builder. Returns (obj, stats)."""
    bm = STATE.bm
    # make every part's winding consistent and outward (some helpers, and helper workarounds,
    # produce inward faces; the game renders single-sided)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method="BEAUTY", ngon_method="EAR_CLIP")
    bm.verts.ensure_lookup_table()
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    if recenter:
        cx, cy, z0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
        bmesh.ops.translate(bm, verts=list(bm.verts), vec=(-cx, -cy, -z0))
    mesh = bpy.data.meshes.new(name)
    slots = sorted({f.material_index for f in bm.faces})
    remap = {s: i for i, s in enumerate(slots)}
    face_slot = []
    for f in bm.faces:
        face_slot.append(f.material_index)
        f.material_index = remap[f.material_index]
    bm.to_mesh(mesh)
    bm.free()
    STATE.bm = None
    for s in slots:
        mesh.materials.append(palette_material(s))
    attr = mesh.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for poly, slot in zip(mesh.polygons, face_slot):
        idx = slot % TINT_OFFSET
        tint = 1.0 if slot >= TINT_OFFSET else 0.0
        for li in poly.loop_indices:
            attr.data[li].color = (idx / 255.0, tint, 0.0, 1.0)
    mesh.color_attributes.active_color = attr
    mesh.set_sharp_from_angle(angle=math.radians(38))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    stats = {
        "tris": len(mesh.polygons),
        "verts": len(mesh.vertices),
        "min": (min(xs), min(ys), min(zs)),
        "max": (max(xs), max(ys), max(zs)),
        "colors": sorted({PALETTE[s % TINT_OFFSET][0] for s in slots}),
        "tintable": any(s >= TINT_OFFSET for s in slots),
    }
    return obj, stats
