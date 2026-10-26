"""Regenerate src/render/palette.js from the Blender palette (single source of truth)."""
import os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'blender'))
from lib.palette import PALETTE, SHADOW_TINT
lines = ['// GENERATED from tools/blender/lib/palette.py by tools/gen_palette.py — do not edit.', 'export const PALETTE = [']
lines += [f"  ['{n}', '{h}']," for n, h in PALETTE]
lines += ['];', "export const PAL = Object.fromEntries(PALETTE.map(([n], i) => [n, i]));",
          'export const HEX = Object.fromEntries(PALETTE);', f"export const SHADOW_TINT = '{SHADOW_TINT}';"]
open(os.path.join(ROOT, 'src', 'render', 'palette.js'), 'w').write('\n'.join(lines) + '\n')
