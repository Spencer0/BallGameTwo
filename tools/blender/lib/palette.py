"""Lint Roller master palette (STYLE.md section 2).

The ORDER is the palette index stored in exported vertex colours (COLOR_0.r = index/255),
so only ever append to this list.
"""

PALETTE = [
    ("ink", "#2A1E3F"),
    ("ink_soft", "#4A3B66"),
    ("snow", "#FFFFFF"),
    ("cloud", "#DDE2EE"),
    ("stone", "#9AA0B5"),
    ("charcoal", "#4A4458"),
    ("paper", "#FFF6E6"),
    ("butter", "#FFE48A"),
    ("sun", "#FFC830"),
    ("tangerine", "#FF8A1F"),
    ("tomato", "#F0412F"),
    ("flamingo", "#FF5C8A"),
    ("bubblegum", "#FFA6C6"),
    ("grape", "#7B4FD0"),
    ("lavender", "#B9A6EE"),
    ("cobalt", "#3457D5"),
    ("sky", "#5BC0F5"),
    ("teal", "#19B3A6"),
    ("lime", "#9AD94A"),
    ("leaf", "#3DAA5C"),
    ("pine", "#1F7A55"),
    ("sand", "#EBC894"),
    ("caramel", "#D98A4E"),
    ("cocoa", "#8A4B2F"),
    ("skin1", "#F6CDA8"),
    ("skin2", "#E0A47A"),
    ("skin3", "#B9784E"),
    ("skin4", "#7A4A2E"),
    ("glass", "#BDEBFA"),
    ("brick", "#C2513A"),
    ("navy", "#283A8F"),
    ("mint", "#A8E6C8"),
    ("concrete", "#CFCAC0"),
    ("slate", "#5F6F8C"),
]

INDEX = {name: i for i, (name, _) in enumerate(PALETTE)}
HEX = dict(PALETTE)

SHADOW_TINT = "#C9BCEB"  # multiplied in linear space -> ~(0.58, 0.50, 0.83)


def hex_to_srgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear(name_or_hex):
    h = HEX.get(name_or_hex, name_or_hex)
    return tuple(srgb_to_linear(c) for c in hex_to_srgb(h))
