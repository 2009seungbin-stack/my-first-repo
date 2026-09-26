"""Independent checks of the Aseprite outputs for T5 (pico-8 indexed), T8 (outline/shadow), T7 (swap)."""
import json, os
import numpy as np
from PIL import Image

C = r"C:\Users\2009s\nerulio-asset-corpus"
WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(WORK, "aseprite")
truth = np.asarray(Image.open(os.path.join(C, r"pixel\oga-sumo-hulk\sumoHulk_spriteSheet.png")).convert("RGBA")).astype(int)
op = truth[..., 3] >= 128
res = {}

# ---- T5 ----
pico = []
for line in open(os.path.join(C, r"palettes\lospec\pico-8.gpl")):
    p = line.split()
    if len(p) >= 3 and all(x.isdigit() for x in p[:3]):
        pico.append([int(x) for x in p[:3]])
pico = np.array(pico)
im = Image.open(os.path.join(A, "T5_sumoHulk_pico8_indexed.png"))
out = np.asarray(im.convert("RGBA")).astype(int)
d = ((truth[..., None, :3] - pico[None, None]) ** 2).sum(-1)  # squared RGB distance
exp_rgb = pico[d.argmin(-1)]
oop = out[..., 3] >= 128
match = np.all(out[..., :3] == exp_rgb, -1) & oop & op
used = {tuple(c) for c in out[..., :3][oop].tolist()}
res["T5"] = {
    "png_mode": im.mode,
    "alpha_preserved": bool((oop == op).all()),
    "opaque_px": int(op.sum()),
    "opaque_px_turned_transparent": int((op & ~oop).sum()),
    "match_nearest_rgb_euclid_pct": round(100 * match.sum() / op.sum(), 3),
    "all_output_colours_in_pico8": all(any((c == pc).all() for pc in pico) for c in np.array(list(used))),
    "colours_used": len(used),
}

# ---- T8 ----
o = np.asarray(Image.open(os.path.join(A, "T8_sumoHulk_outline.png")).convert("RGBA")).astype(int)
pad = np.zeros((op.shape[0] + 2, op.shape[1] + 2), bool)
pad[1:-1, 1:-1] = op
n4 = np.zeros_like(pad)
n8 = np.zeros_like(pad)
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        s = np.roll(np.roll(pad, dy, 0), dx, 1)
        n8 |= s
        if abs(dx) + abs(dy) == 1:
            n4 |= s
exp4 = n4 & ~pad
exp8 = n8 & ~pad
oo = o[..., 3] >= 128
black = oo & np.all(o[..., :3] == 0, -1) & ~pad
orig_kept = np.all(o[1:-1, 1:-1][op] == truth[op], -1).all()
res["T8"] = {
    "size": [o.shape[1], o.shape[0]],
    "outline_px": int(black.sum()),
    "expected_4conn_px": int(exp4.sum()),
    "expected_8conn_px": int(exp8.sum()),
    "equals_4conn": bool((black == exp4).all()),
    "equals_8conn": bool((black == exp8).all()),
    "original_pixels_unchanged": bool(orig_kept),
}
s = np.asarray(Image.open(os.path.join(A, "T8_sumoHulk_outline_shadow.png")).convert("RGBA")).astype(int)
res["T8"]["shadow_image_size"] = [s.shape[1], s.shape[0]]
res["T8"]["shadow_px_added"] = int(((s[..., 3] >= 128) & ~(oo)).sum())

# ---- T7 ----
for name in ["red", "blue", "green", "indexed_palette_edit_red"]:
    f = os.path.join(A, f"T7_variant_{name}.png" if "indexed" not in name else "T7_indexed_palette_edit_red.png")
    if os.path.exists(f):
        v = np.asarray(Image.open(f).convert("RGBA")).astype(int)
        team = np.all(truth[..., :3] == [0x84, 0xd6, 0x52], -1) & op
        same_shape = v.shape == truth.shape
        other_same = same_shape and bool(np.all(v[op & ~team] == truth[op & ~team]))
        res[f"T7_{name}"] = {"size": [v.shape[1], v.shape[0]], "team_px_in_truth": int(team.sum()),
                             "team_px_recoloured": int((same_shape and (~np.all(v[..., :3] == truth[..., :3], -1) & team).sum()) or 0),
                             "other_px_unchanged": other_same}
print(json.dumps(res, indent=1))
json.dump(res, open(os.path.join(A, "verify.json"), "w"), indent=1)
