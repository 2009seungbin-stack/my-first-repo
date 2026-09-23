import json, os, sys
import numpy as np
from PIL import Image
W = sys.argv[1]
cases = json.load(open(os.path.join(W, 'cases.json')))
def cmp(png, raw):
    a = np.asarray(Image.open(png).convert('RGBA'), dtype=np.int16).reshape(-1, 4)
    b = np.frombuffer(open(raw, 'rb').read(), dtype=np.uint8).astype(np.int16).reshape(-1, 4)
    if a.shape != b.shape: return f'size {a.shape} vs {b.shape}'
    d = np.abs(a - b).max(axis=1); d[(a[:, 3] == 0) & (b[:, 3] == 0)] = 0
    return f'maxdiff={int(d.max())} px={int((d > 0).sum())}/{d.size}'
for name, m in cases.items():
    for tool in ('ase', 'ls'):
        d = os.path.join(W, f'{tool}-{name}')
        res = []
        for f in range(m['frames']):
            p = os.path.join(d, f'{f}.png')
            if not os.path.exists(p): res.append(f'f{f}: NO OUTPUT'); continue
            raw = os.path.join(W, f'{name}.f{f}.rgba')
            if tool == 'ase' and os.path.exists(os.path.join(W, f'{name}.flat.f{f}.rgba')):
                raw = os.path.join(W, f'{name}.flat.f{f}.rgba')  # CLI export renders groups flat
            res.append(f'f{f}: ' + cmp(p, raw))
        print(tool, name, ' | '.join(res))
p = os.path.join(W, 'compose.composed.png')
print('aseprite drawSprite with compose_groups on vs our compose render:', cmp(p, os.path.join(W, 'compose.f0.rgba')))
