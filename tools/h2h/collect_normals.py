"""Move a normal-map tool's exported files (<input>_n.png next to the inputs, the way
SpriteIlluminator and Laigter write them) into the layout tools/engine-verify/texture/h2h_measure.mjs
reads: <dir>/out/<tool>/<input>/<input>_n.png.

  python tools/h2h/collect_normals.py <export folder> <h2h dir> <tool name> [input ...]
"""
import shutil
import sys
from pathlib import Path

src, h2h, tool = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
names = sys.argv[4:] or [p.name[:-6] for p in src.glob('*_n.png')]
for n in names:
    f = src / f'{n}_n.png'
    if not f.exists():
        print('missing', f)
        continue
    d = h2h / 'out' / tool / n
    d.mkdir(parents=True, exist_ok=True)
    shutil.move(str(f), d / f.name)
    print(tool, n)
