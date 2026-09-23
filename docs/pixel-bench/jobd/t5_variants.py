"""T5 variants: which Aseprite rgbmap/fitCriteria reproduce a nearest-colour mapping to PICO-8?"""
import json, os, subprocess
import numpy as np
from PIL import Image

ASE = r"C:\Users\2009s\asebuild\b\bin\aseprite.exe"
C = r"C:\Users\2009s\nerulio-asset-corpus"
WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(WORK, "aseprite")
T = os.path.join(C, r"pixel\oga-sumo-hulk\sumoHulk_spriteSheet.png")
PAL = os.path.join(C, r"palettes\lospec\pico-8.gpl")
truth = np.asarray(Image.open(T).convert("RGBA")).astype(float)
op = truth[..., 3] >= 128
pico = np.array([[int(x) for x in l.split()[:3]] for l in open(PAL)
                 if len(l.split()) >= 3 and all(x.isdigit() for x in l.split()[:3])], float)


def srgb2lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def oklab(rgb):
    l = srgb2lin(rgb)
    M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
    M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
    lms = np.cbrt(l @ M1.T)
    return lms @ M2.T


def expected(space):
    src = truth[..., :3][op]
    if space == "rgb":
        d = ((src[:, None] - pico[None]) ** 2).sum(-1)
    else:
        d = ((oklab(src)[:, None] - oklab(pico)[None]) ** 2).sum(-1)
    return pico[d.argmin(-1)]


res = {}
for rgbmap in ["", "octree", "rgb5a3"]:
    for fit in ["", "rgb", "cielab"]:
        tag = f"{rgbmap or 'default'}_{fit or 'default'}"
        out = os.path.join(A, f"T5_variant_{tag}.png")
        r = subprocess.run([ASE, "-b", "--script-param", f"in={T}", "--script-param", f"pal={PAL}",
                            "--script-param", f"out={out}", "--script-param", f"rgbmap={rgbmap}",
                            "--script-param", f"fit={fit}", "--script", os.path.join(WORK, "jobd", "t5_indexed.lua")],
                           capture_output=True, text=True)
        o = np.asarray(Image.open(out).convert("RGBA")).astype(float)
        got = o[..., :3][op]
        blk = np.all(truth[..., :3][op] == 0, -1)
        res[tag] = {
            "match_nearest_rgb_pct": round(100 * np.all(got == expected("rgb"), -1).mean(), 2),
            "match_nearest_oklab_pct": round(100 * np.all(got == expected("oklab"), -1).mean(), 2),
            "black_px": int(blk.sum()),
            "black_kept_black_pct": round(100 * np.all(got[blk] == 0, -1).mean(), 2) if blk.any() else None,
            "opaque_lost": int((op & (o[..., 3] < 128)).sum()),
        }
        print(tag, res[tag])
json.dump(res, open(os.path.join(A, "T5_variants.json"), "w"), indent=1)
