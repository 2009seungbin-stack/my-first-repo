"""Side-by-side debug of atlas reconstruction vs exact truth for a few glyphs (uses the judge's own functions)."""
import sys, os, json, importlib.util
import numpy as np
from PIL import Image
spec = importlib.util.spec_from_file_location('fq', r'C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-a8be6c03441cb4b55\tools\font-quality.py')
fq = importlib.util.module_from_spec(spec); spec.loader.exec_module(fq)
font_path, atlas, qjson, chars, out = sys.argv[1:6]
q = json.load(open(qjson, encoding='utf-8'))
font = fq.Font(font_path)
fnt = fq.read_bmfont(atlas)
pages = fq.load_pages(fnt['pages'], os.path.dirname(os.path.abspath(atlas)))
field = q['field']; rng = q['distance_range_px'] or 0
chan = {int(k): v for k, v in q['channel'].items()}
reg = q['registration']
jobs = fq.jobs_from_bmfont(fnt, font, reg['em_px'], reg.get('dx_px', 0), reg.get('dy_px', 0))
S = 1 if field == 'bitmap' else 4
tiles = []
for ch in chars:
    j = next(j for j in jobs if j.cp == ord(ch))
    t, r = fq.eval_job(j, font, pages, field, rng, S, chan)
    z = 12 if S == 1 else 3
    def up(a): return np.kron(a, np.ones((z, z)))
    row = np.concatenate([up(t), np.ones((t.shape[0] * z, 4)), up(r), np.ones((t.shape[0] * z, 4)), up(np.abs(r - t))], axis=1)
    tiles.append(row)
W = max(t.shape[1] for t in tiles)
img = np.concatenate([np.pad(t, ((0, 6), (0, W - t.shape[1])), constant_values=1) for t in tiles], axis=0)
Image.fromarray((255 - img * 255).astype(np.uint8)).save(out)
print('saved', out)
