"""Check the shipped deterministic 64x64 threshold tile's spatial spectrum.

This is a narrow signal check at five fill levels, not a perceptual preference score.
"""
import json
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
script = "import('./src/studio/pixel/converter.js').then(m=>console.log(JSON.stringify([...m.blueTile()])))"
raw = subprocess.check_output(['node', '-e', script], cwd=ROOT, text=True)
tile = np.array(json.loads(raw), dtype=np.float64).reshape(64, 64)
assert len(np.unique(tile)) == 4096
reference = np.random.default_rng(12345).random((64, 64))
y, x = np.indices(tile.shape)
radius = np.hypot(y-32, x-32)
low = (radius >= 1) & (radius < 5)
high = (radius >= 24) & (radius < 32)

def ratio(mask):
    centered = mask.astype(float) - mask.mean()
    power = abs(np.fft.fftshift(np.fft.fft2(centered)))**2
    return float(power[low].mean()/power[high].mean())

rows = []
for fraction in (.1, .25, .5, .75, .9):
    actual = ratio(tile < fraction)
    white = ratio(reference < fraction)
    assert actual < white * .25, (fraction, actual, white)
    rows.append({'fraction': fraction, 'low_high': round(actual, 4),
                 'seeded_white_low_high': round(white, 4)})
print(json.dumps(rows, indent=2))
