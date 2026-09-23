"""Compare Nerulio's rendered frames (raw RGBA dumped by tools/aseprite-corpus.mjs) with
reference PNGs exported by real Aseprite (decoded independently with Pillow).
usage: python compare.py <dumpDir> <refDir> <report.json>
refDir layout: <refDir>/<relpath>/<n>.png  (n = frame number as exported, detected per file)"""
import json, sys, os
from PIL import Image
import numpy as np

dump, ref, report = sys.argv[1:4]
summary = json.load(open(os.path.join(dump, 'summary.json'), encoding='utf8'))
rows = []
for s in summary:
    rel = s['file']
    row = {'file': rel}
    if 'error' in s:
        row.update(status='ERROR', note=s['error']); rows.append(row); continue
    d = os.path.join(ref, rel)
    if not os.path.isdir(d):
        row.update(status='NOREF'); rows.append(row); continue
    pngs = sorted([p for p in os.listdir(d) if p.endswith('.png')], key=lambda p: int(p[:-4]) if p[:-4].isdigit() else 1 << 30)
    nums = [int(p[:-4]) for p in pngs if p[:-4].isdigit()]
    if not nums:
        row.update(status='NOREF'); rows.append(row); continue
    base = min(nums)
    W, H, n = s['width'], s['height'], s['frames']
    maxdiff, badpx, frames_ok, compared, notes = 0, 0, 0, 0, []
    for f in range(n):
        p = os.path.join(d, f'{f + base}.png')
        if not os.path.exists(p):
            notes.append(f'missing ref frame {f}'); continue
        try:
            im = Image.open(p); im.load()
        except Exception as e:
            notes.append(f'unreadable ref frame {f}: {e}'); continue
        if im.size != (W, H):
            notes.append(f'ref size {im.size} != {W}x{H}'); continue
        a = np.asarray(im.convert('RGBA'), dtype=np.int16).reshape(-1, 4)
        b = np.frombuffer(open(os.path.join(dump, rel) + f'.f{f}.rgba', 'rb').read(), dtype=np.uint8).astype(np.int16).reshape(-1, 4)
        both_clear = (a[:, 3] == 0) & (b[:, 3] == 0)
        diff = np.abs(a - b).max(axis=1)
        diff[both_clear] = 0
        m = int(diff.max()) if diff.size else 0
        compared += 1
        maxdiff = max(maxdiff, m)
        badpx += int((diff > 0).sum())
        if m == 0: frames_ok += 1
    row.update(status='PASS' if compared == n and maxdiff == 0 else 'FAIL', frames=n, compared=compared, framesExact=frames_ok,
               maxDiff=maxdiff, diffPixels=badpx, colorMode=s['colorMode'], notes=notes[:3])
    rows.append(row)
json.dump(rows, open(report, 'w'), indent=1)
from collections import Counter
print(Counter(r['status'] for r in rows))
for r in rows:
    if r['status'] in ('FAIL', 'ERROR'):
        print(r['status'], r['file'], r.get('maxDiff'), r.get('diffPixels'), r.get('framesExact'), '/', r.get('frames'), r.get('notes') or r.get('note', ''))
