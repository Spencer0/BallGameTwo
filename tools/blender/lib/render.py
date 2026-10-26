"""Thumbnail rendering: EEVEE toon (2-band) + Freestyle ink outlines, matching STYLE.md."""
import math
import bpy
from mathutils import Vector

from .palette import linear, SHADOW_TINT

THUMB_SIZE = 256


def make_toon_material(name, base_linear):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = nt.nodes.new("ShaderNodeShaderToRGB")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    sh = linear(SHADOW_TINT)
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (sh[0], sh[1], sh[2], 1)
    ramp.color_ramp.elements[1].position = 0.12
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[6].default_value = (base_linear[0], base_linear[1], base_linear[2], 1)
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(diff.outputs[0], s2r.inputs[0])
    nt.links.new(s2r.outputs["Color"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], emit.inputs["Color"])
    nt.links.new(emit.outputs[0], out.inputs["Surface"])
    mat.diffuse_color = (base_linear[0], base_linear[1], base_linear[2], 1)
    return mat


def setup_scene(size=THUMB_SIZE):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.eevee.taa_render_samples = 8
    try:
        sc.eevee.use_shadows = True
    except AttributeError:
        pass
    world = sc.world or bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0, 0, 0, 1)
        bg.inputs[1].default_value = 0.0
    # sun: front-left-high (objects face -Y)
    if "Sun" not in bpy.data.objects:
        ld = bpy.data.lights.new("Sun", "SUN")
        ld.energy = 3.0
        ld.angle = math.radians(2)
        sun = bpy.data.objects.new("Sun", ld)
        sc.collection.objects.link(sun)
        sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
    if "Cam" not in bpy.data.objects:
        cd = bpy.data.cameras.new("Cam")
        cd.type = "ORTHO"
        cam = bpy.data.objects.new("Cam", cd)
        sc.collection.objects.link(cam)
        sc.camera = cam
    # freestyle ink lines
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = "ABSOLUTE"
    sc.render.line_thickness = 1.0
    vl = sc.view_layers[0]
    vl.use_freestyle = True
    fs = vl.freestyle_settings
    fs.crease_angle = math.radians(120)
    ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new("Ink")
    ls.select_by_visibility = True
    ls.select_by_edge_types = True
    ls.select_silhouette = True
    ls.select_border = True
    ls.select_crease = True
    ls.select_external_contour = True
    ls.select_material_boundary = False
    if ls.linestyle is None:
        ls.linestyle = bpy.data.linestyles.new("InkStyle")
    ink = linear("ink")
    ls.linestyle.color = ink
    ls.linestyle.thickness = 2.6 * size / 256
    ls.linestyle.thickness_position = "CENTER"
    return sc


def frame_camera(obj, az=30.0, el=24.0, pad=1.12):
    """Orthographic 3/4 view from front-right (objects face -Y)."""
    sc = bpy.context.scene
    cam = bpy.data.objects["Cam"]
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    center = sum(corners, Vector()) / 8
    a, e = math.radians(az), math.radians(el)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    dist = max((c - center).length for c in corners) * 4 + 1
    cam.location = center + d * dist
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    pts = [inv @ c for c in corners]
    w = max(p.x for p in pts) - min(p.x for p in pts)
    h = max(p.y for p in pts) - min(p.y for p in pts)
    cx = (max(p.x for p in pts) + min(p.x for p in pts)) / 2
    cy = (max(p.y for p in pts) + min(p.y for p in pts)) / 2
    cam.location = cam.matrix_world @ Vector((cx, cy, 0))
    cam.data.ortho_scale = max(w, h) * pad
    cam.data.clip_start = 0.001
    cam.data.clip_end = dist * 3
    # keep line width readable for tiny/huge objects (Freestyle works in pixels)
    sc.view_layers[0].freestyle_settings.linesets[0].linestyle.thickness = 2.6 * sc.render.resolution_x / 256


def render_thumb(obj, path, az=30.0, el=24.0):
    sc = bpy.context.scene
    for o in sc.collection.objects:
        if o.type == "MESH":
            o.hide_render = o is not obj
    # light scale independent; shadows need the sun to cover the object
    frame_camera(obj, az, el)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
