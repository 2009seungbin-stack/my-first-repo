"""Run perfectPixel (theamusing/perfectPixel, commit 72096de, package 0.1.4) on every case.

Uses the repo's src/perfect_pixel package directly. The OpenCV backend is used when cv2 imports
(opencv-python-headless installed), exactly as the package __init__ chooses; pass `numpy` as the first
argument to force the NumPy-only backend.
Defaults: get_perfect_pixel(rgb) -> sample_method='center', grid_size=None (auto), min_size=4.0,
peak_width=6, refine_intensity=0.25, fix_square=True. The API takes RGB only (alpha is dropped: we
feed the RGB channels as stored, which is what cv2.imread(IMREAD_COLOR) in the README does), so
outputs are opaque RGB.
Usage: python run_perfectpixel.py [opencv|numpy] [DATA_DIR]
"""
import json, os, sys, time, traceback
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'perfectPixel', 'src'))
BACKEND = sys.argv[1] if len(sys.argv) > 1 else 'opencv'
DATA = sys.argv[2] if len(sys.argv) > 2 else r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-pixel'
if BACKEND == 'numpy':
    from perfect_pixel.perfect_pixel_noCV2 import get_perfect_pixel
    TOOL = 'perfectpixel-numpy'
else:
    import cv2  # noqa: F401  (must be importable)
    from perfect_pixel.perfect_pixel import get_perfect_pixel
    TOOL = 'perfectpixel'
OUT = os.path.join(HERE, 'out', TOOL)


def load_rgb(path):
    """Mimic cv2.imread(path, IMREAD_COLOR)+BGR2RGB: RGB channels as stored, alpha ignored."""
    im = Image.open(path)
    if im.mode == 'P':
        im = im.convert('RGBA')
    return np.ascontiguousarray(np.array(im.convert('RGBA'))[..., :3]) if 'A' in im.mode else np.array(im.convert('RGB'))


def main():
    os.makedirs(OUT, exist_ok=True)
    cases = json.load(open(os.path.join(DATA, 'cases.json')))['cases']
    only = os.environ.get('ONLY')
    for c in cases:
        if only and only not in c['id']:
            continue
        rgb = load_rgb(os.path.join(DATA, c['path']))
        meta = dict(tool=TOOL, commit='72096de5cf1bff9102687c4f89af6f62c4273a86', settings='get_perfect_pixel defaults (center, min_size 4, refine 0.25, fix_square)',
                    input=[c['width'], c['height']])
        t0 = time.perf_counter()
        try:
            w, h, out = get_perfect_pixel(rgb)
            meta['time_ms'] = round((time.perf_counter() - t0) * 1000, 1)
            if w is None or out is None:
                meta['error'] = 'no grid detected (returned None)'
            else:
                Image.fromarray(np.asarray(out, dtype=np.uint8)).save(os.path.join(OUT, c['id'] + '.png'))
                meta['output'] = [int(w), int(h)]
                meta['detected_scale'] = [c['width'] / w, c['height'] / h]  # grid size in px (derived: input / cells)
                meta['error'] = None
        except Exception as e:  # noqa
            meta['time_ms'] = round((time.perf_counter() - t0) * 1000, 1)
            meta['error'] = repr(e)[:300]
            meta['trace'] = traceback.format_exc()[-800:]
        json.dump(meta, open(os.path.join(OUT, c['id'] + '.json'), 'w'), indent=1)
        print(c['id'], meta.get('output'), meta['time_ms'], meta['error'] or '')


if __name__ == '__main__':
    main()
