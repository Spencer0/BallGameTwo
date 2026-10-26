"""Level 1 — Crumb Patrol (breakfast table). Objects face -Y; base at z = 0; metres."""
import math

from lib.core import box, cyl, sphere, ico, torus, lathe, extrude, tube, capsule, eyes, ngon_points, \
    star_points, rounded_rect_points
from lib.registry import asset


@asset("teacup", "Teacup", "Pinky out. Always.", 1, "ceramic", "medium", variants=["sky", "flamingo", "lime", "sun"],
       col="cyl")
def teacup():
    cyl(0.062, 0.007, color="snow", segs=14)  # saucer
    cyl(0.038, 0.006, at=(0, 0, 0.004), color="snow", segs=16)
    lathe([(0.0, 0.009), (0.024, 0.009), (0.036, 0.022), (0.044, 0.05), (0.047, 0.064), (0.043, 0.064),
           (0.04, 0.05), (0.0, 0.05)], color="snow", segs=16)
    cyl(0.042, 0.003, at=(0, 0, 0.055), color="cocoa", segs=16)  # tea
    cyl(0.0455, 0.012, at=(0, 0, 0.036), color="sky", segs=16, tint=True, r2=0.0465)  # band
    torus(0.014, 0.0045, at=(0.05, 0, 0.04), rot=(90, 0, 0), color="snow", segs=8, rsegs=4, arc=260,
          scale=(1, 1.15, 1))


@asset("cupcake", "Cupcake", "Ninety percent frosting, ten percent cake, one hundred percent sticky.", 1, "food",
       "small", variants=["bubblegum", "mint", "butter", "lavender"], col="cyl")
def cupcake():
    lathe([(0.0, 0.0), (0.024, 0.0), (0.032, 0.034), (0.0, 0.034)], color="sky", segs=12)  # wrapper
    lathe([(0.0, 0.03), (0.036, 0.03), (0.038, 0.04), (0.03, 0.05), (0.024, 0.056), (0.012, 0.064),
           (0.004, 0.072), (0.0, 0.073)], color="bubblegum", segs=16, tint=True)
    sphere(0.009, at=(0, 0, 0.078), color="tomato", segs=10)  # cherry
    tube([(0, 0, 0.085), (0.004, 0.002, 0.094), (0.01, 0.003, 0.1)], 0.0012, color="pine", segs=4, lod0=True)
    for i, c in enumerate(["sun", "snow", "leaf", "sky", "tangerine", "snow", "grape"]):
        a = 2 * math.pi * i / 7 + 0.4
        box((0.006, 0.0025, 0.0025), at=(0.022 * math.cos(a), 0.022 * math.sin(a), 0.053 + 0.004 * (i % 2)),
            rot=(0, 25, math.degrees(a) + 40), color=c, lod0=True)


@asset("rubber_duck", "Rubber Duck", "Has seen things in the bath. Will not elaborate.", 1, "rubber", "medium",
       variants=["sun", "flamingo", "sky"], col="sphere", flags=["squeaky"])
def rubber_duck():
    sphere(0.042, at=(0, 0.006, 0.033), scale=(0.95, 1.25, 0.8), color="sun", segs=10, tint=True)
    sphere(0.016, at=(0, 0.05, 0.045), scale=(0.8, 1.0, 1.25), rot=(-30, 0, 0), color="sun", segs=8, tint=True)  # tail
    sphere(0.027, at=(0, -0.022, 0.08), color="sun", segs=10, tint=True)  # head
    sphere(0.014, at=(0, -0.05, 0.075), scale=(1.2, 1.3, 0.55), color="tangerine", segs=12)  # beak
    eyes((0, -0.043, 0.09), 0.026, 0.0055, color="ink")
    sphere(0.02, at=(0.034, 0.006, 0.04), scale=(0.35, 1.0, 0.7), color="sun", segs=10, tint=True, lod0=True)
    sphere(0.02, at=(-0.034, 0.006, 0.04), scale=(0.35, 1.0, 0.7), color="sun", segs=10, tint=True, lod0=True)


@asset("spoon", "Spoon", "Was lying down like it paid rent.", 1, "metal", "small", col="box")
def spoon():
    sphere(0.022, at=(0, -0.052, 0.008), scale=(0.75, 1.0, 0.33), color="cloud", segs=14)
    tube([(0, -0.03, 0.009), (0, 0.0, 0.012), (0, 0.04, 0.012), (0, 0.075, 0.008)], 0.0042, r_end=0.007,
         color="cloud", segs=6, smooth_path=1)
    sphere(0.008, at=(0, 0.078, 0.008), scale=(1, 1.2, 0.5), color="cloud", segs=8)


@asset("donut", "Donut", "A bagel that believed in itself.", 1, "food", "small",
       variants=["bubblegum", "cocoa", "butter", "mint"], col="cyl")
def donut():
    torus(0.028, 0.017, at=(0, 0, 0.017), color="caramel", segs=16, rsegs=8)
    torus(0.028, 0.0155, at=(0, 0, 0.0215), color="bubblegum", segs=16, rsegs=8, tint=True, scale=(1.03, 1.03, 0.75))
    cols = ["snow", "sun", "sky", "leaf", "tomato", "grape"]
    for i in range(14):
        a = 2 * math.pi * i / 14 + (i % 3) * 0.2
        rr = 0.028 + 0.009 * math.sin(i * 2.3)
        box((0.007, 0.0022, 0.0022), at=(rr * math.cos(a), rr * math.sin(a), 0.0335),
            rot=(0, 0, math.degrees(a) + 70 * (i % 2)), color=cols[i % len(cols)], lod0=True)


@asset("coin", "Coin", "Worth exactly one wish, if you have a fountain.", 1, "metal", "tiny", col="cyl")
def coin():
    cyl(0.011, 0.0022, color="sun", segs=14, bevel=0.0006)
    cyl(0.007, 0.0006, at=(0, 0, 0.0022), color="butter", segs=10, lod0=True)


@asset("pea", "Pea", "Escaped from a plate. Living its best life.", 1, "food", "tiny", col="sphere")
def pea():
    sphere(0.0045, at=(0, 0, 0.0045), color="lime", segs=8)


@asset("crumb", "Crumb", "The original mess.", 1, "food", "tiny", variants=["sand", "caramel"], col="sphere")
def crumb():
    ico(0.0035, at=(0, 0, 0.0028), color="sand", subdiv=1, scale=(1.2, 0.9, 0.7), rot=(10, 20, 30), tint=True)


@asset("ladybug", "Ladybug", "Polka dots: still in fashion.", 1, "living", "small", col="sphere", flags=["creature", "wander"])
def ladybug():
    sphere(0.0055, at=(0, 0.001, 0.003), scale=(1, 1.15, 0.65), color="tomato", segs=8)
    sphere(0.0022, at=(0, -0.0058, 0.0024), scale=(1.2, 0.8, 0.8), color="ink", segs=6)
    for side in (-1, 1):
        sphere(0.0007, at=(side * 0.0009, -0.0077, 0.003), color="snow", segs=5, lod0=True)
    for (x, y) in ((0.0025, -0.0005), (-0.0025, -0.0005), (0.0022, 0.0035), (-0.0022, 0.0035)):
        sphere(0.0011, at=(x, y, 0.0058), scale=(1, 1, 0.4), color="ink", segs=5, lod0=True)


@asset("strawberry", "Strawberry", "Seeds on the outside, like a rebel.", 1, "food", "small", col="sphere")
def strawberry():
    lathe([(0.0, 0.0), (0.006, 0.002), (0.014, 0.012), (0.02, 0.026), (0.019, 0.034), (0.012, 0.039), (0.0, 0.04)],
          color="tomato", segs=12)
    for i in range(5):
        a = 2 * math.pi * i / 5
        extrude([(0, -0.004), (0.016, 0), (0, 0.004)], 0.0016, at=(0.007 * math.cos(a), 0.007 * math.sin(a), 0.04),
                rot=(0, -12, math.degrees(a)), color="leaf")
    cyl(0.0015, 0.008, at=(0, 0, 0.039), color="pine", segs=5)
    for i in range(10):
        a = 2.4 * i
        z = 0.012 + 0.0022 * i
        rr = 0.0165 if 0.01 < z < 0.033 else 0.012
        sphere(0.0014, at=(rr * math.cos(a), rr * math.sin(a), z), color="butter", segs=4, lod0=True, smooth=False)


@asset("toast", "Toast", "Landed butter-side up. Lucky toast.", 1, "food", "small", col="box")
def toast():
    pts = [(-0.05, -0.045), (0.05, -0.045), (0.05, 0.03), (0.04, 0.045), (0.02, 0.052), (0.0, 0.054), (-0.02, 0.052),
           (-0.04, 0.045), (-0.05, 0.03)]
    extrude(pts, 0.014, at=(0, 0, 0.0), color="caramel", center=False)
    inner = [(x * 0.84, y * 0.84 - 0.002) for (x, y) in pts]
    extrude(inner, 0.0025, at=(0, 0, 0.0128), color="sand", center=False)
    box((0.03, 0.022, 0.006), at=(0.004, -0.004, 0.015), rot=(0, 0, 12), color="butter", bevel=0.002, base=True)


@asset("die", "Die", "Rolled a six. Then got rolled.", 1, "plastic", "tiny", variants=["snow", "tomato"], col="box")
def die():
    box((0.016, 0.016, 0.016), base=True, color="snow", bevel=0.0025, bseg=1, tint=True)
    pips = [((0, -0.0081, 0.008),), ]
    for (x, z) in ((0, 0.008),):
        sphere(0.0018, at=(x, -0.0081, z), scale=(1, 0.3, 1), color="ink", segs=5, lod0=True)
    for (x, y) in ((-0.004, -0.004), (0.004, 0.004)):
        sphere(0.0018, at=(x, y, 0.0161), scale=(1, 1, 0.3), color="ink", segs=5, lod0=True)
    for (y, z) in ((-0.004, 0.004), (0, 0.008), (0.004, 0.012)):
        sphere(0.0018, at=(0.0081, y, z), scale=(0.3, 1, 1), color="ink", segs=5, lod0=True)
