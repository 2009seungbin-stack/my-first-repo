"""How much marking a person must do to reach a working blob-47 terrain by hand in Godot 4's TileSet
editor and in Tiled's Wang-set editor, computed from the corpus ground-truth masks (not guessed).

Godot 4 (Terrains paint mode, "Match Corners and Sides"): every tile needs its centre bit plus each
peering bit whose neighbour is terrain. A mask bit = one click (dragging can paint several bits in
one stroke, so this is the number of bits to set, an upper bound on clicks).
Tiled 1.12 (Mixed Wang set = corners and edges): every edge/corner region that is terrain is one
click. Tiled has no centre bit; a tile whose Wang ID is all zeros is dropped.

  python tools/h2h/autotile_clicks.py [corpus path of a blob-47 sheet]
"""
import json
import sys
from h2h_paths import CORPUS

path = sys.argv[1] if len(sys.argv) > 1 else 'tiles/oga-cave-platformer-47/autotile47.png'
entry = next(f for f in json.loads((CORPUS / 'manifest.json').read_text(encoding='utf-8'))['files'] if f['path'] == path)
masks = [m for row in entry['truth']['masks'] for m in row if m is not None]
bits = sum(bin(m).count('1') for m in masks)
sides = sum(bin(m & 0b01010101).count('1') for m in masks)
out = {
    'asset': path, 'tiles': len(masks), 'distinct_masks': len(set(masks)),
    'godot_bits': bits + len(masks),        # peering bits + one centre bit per tile
    'godot_peering_bits': bits, 'godot_centre_bits': len(masks),
    'tiled_regions': bits,                  # Mixed set: one region per terrain corner/edge
    'side_bits': sides, 'corner_bits': bits - sides,
    'tiles_all_zero': sum(1 for m in masks if m == 0),
}
print(json.dumps(out, indent=1))
