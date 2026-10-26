"""Asset registry. Asset modules decorate builder functions with @asset(...)."""

ASSETS = {}

# triangle budgets (LOD0, LOD1) per tier, see TECH.md section 2
BUDGETS = {
    "tiny": (260, 64),
    "small": (720, 180),
    "medium": (1400, 400),
    "large": (2600, 720),
    "landmark": (4200, 1100),
}

MATERIALS = {"soft", "wood", "metal", "ceramic", "glass", "food", "plastic", "paper", "electronic",
             "living", "stone", "rubber", "plant"}


def asset(id, name, desc, level, mat, tier="small", variants=None, col="box", flags=(), fill=0.5, **extra):
    assert mat in MATERIALS, f"{id}: unknown material {mat}"
    assert tier in BUDGETS, f"{id}: unknown tier {tier}"
    assert col in ("box", "cyl", "sphere"), f"{id}: unknown collider {col}"

    def deco(fn):
        assert id not in ASSETS, f"duplicate asset id {id}"
        ASSETS[id] = dict(id=id, name=name, desc=desc, level=level, mat=mat, tier=tier,
                          variants=list(variants or []), col=col, flags=list(flags), fill=fill, fn=fn,
                          extra=extra)
        return fn
    return deco
