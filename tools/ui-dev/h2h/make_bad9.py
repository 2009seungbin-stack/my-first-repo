"""Synthetic (clearly labelled) broken/edge-case nine-patches to test validity agreement with aapt2."""
import os
import numpy as np
from PIL import Image
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ninepatch', 'synthetic')
os.makedirs(D, exist_ok=True)
def base():
    a = np.zeros((20, 20, 4), np.uint8)
    a[1:19, 1:19] = (200, 120, 40, 255)
    a[0, 6:14] = (0, 0, 0, 255); a[6:14, 0] = (0, 0, 0, 255)
    return a
cases = {}
a = base(); cases['ok_minimal'] = a
a = base(); a[0, 8] = (0, 0, 0, 128); cases['bad_semitransparent_tick'] = a
a = base(); a[0, 8] = (60, 60, 60, 255); cases['bad_grey_tick'] = a
a = base(); a[0, 0] = (0, 0, 0, 255); cases['bad_corner'] = a
a = base(); a[19, 3:6] = (0, 0, 0, 255); a[19, 10:15] = (0, 0, 0, 255); cases['bad_split_padding'] = a
a = base(); a[0, 3:5] = (0, 0, 0, 255); cases['ok_two_stretch_regions'] = a
a = base(); a[19, 1:3] = (255, 0, 0, 255); a[19, 17:19] = (255, 0, 0, 255); a[19, 5:15] = (0, 0, 0, 255); cases['ok_layout_bounds'] = a
a = base(); a[0, 1:3] = (255, 0, 0, 255); cases['bad_red_on_top'] = a
a = base(); a[1:19, 1:19] = 0; a[1:19, 1:19, 3] = 255; a[1:19, 1:19, 0] = np.arange(18)[None, :] * 10; cases['ok_bad_patch_gradient_x'] = a
for k, v in cases.items():
    Image.fromarray(v, 'RGBA').save(os.path.join(D, k + '.9.png'))
print(sorted(cases))
