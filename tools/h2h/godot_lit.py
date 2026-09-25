"""Normal maps of every tool, lit in Godot 4.7.2 exactly like a game would light them (CanvasTexture +
PointLight2D), compared with the same scene lit through the REAL reference normal map.

  python tools/h2h/godot_lit.py <h2h dir>      (layout of tools/engine-verify/texture/h2h_measure.mjs)

Four lights, one at each corner of the picture, at a height of half the picture's longer side.
Result per tool and input: mean |difference| and 95th percentile in 8-bit levels over opaque
pixels (all four renders), against the reference-normal render. Writes <h2h dir>/godot-lit.json.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from h2h_paths import GODOT, REPO

sys.path.insert(0, str(REPO / 'tools' / 'engine-verify'))
from ev_common import unpremultiply  # noqa: E402

PROJECT = '''config_version=5

[application]

config/name="h2h-lit"
config/features=PackedStringArray("4.4")

[display]

window/size/viewport_width=256
window/size/viewport_height=256
window/size/borderless=true

[rendering]

renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
'''
TRUTH = {'torch': 'truth_torch_n.png', 'asteroids': 'truth_asteroids_n.png', 'bricks': 'truth_bricks_n.png', 'bricksheight': 'truth_bricks_n.png'}
DIFFUSE = {'torch': 'torch.png', 'asteroids': 'asteroids.png', 'bricks': 'bricks.png', 'bricksheight': 'bricks.png'}


def main():
    h2h = Path(sys.argv[1])
    proj = h2h / 'godot-lit'
    if proj.exists():
        shutil.rmtree(proj)
    (proj / '_verify').mkdir(parents=True)
    (proj / 'maps').mkdir()
    (proj / 'project.godot').write_text(PROJECT, encoding='utf-8')
    shutil.copy2(Path(__file__).with_name('godot_lit_probe.gd'), proj / '_verify' / 'godot_lit_probe.gd')
    cases, tools = [], sorted(p.name for p in (h2h / 'out').iterdir() if p.is_dir() and p.name != 'in')
    for inp, truth in TRUTH.items():
        diff = h2h / 'in' / DIFFUSE[inp]
        shutil.copy2(diff, proj / 'maps' / DIFFUSE[inp])
        w, h = Image.open(diff).size
        shutil.copy2(h2h / 'in' / truth, proj / 'maps' / f'truth__{inp}_n.png')
        cases.append({'id': f'truth__{inp}', 'diffuse': f'res://maps/{DIFFUSE[inp]}', 'normal': f'res://maps/truth__{inp}_n.png', 'size': [w, h]})
        for t in tools:
            f = h2h / 'out' / t / inp / f'{inp}_n.png'
            if f.exists() and Image.open(f).size == (w, h):
                shutil.copy2(f, proj / 'maps' / f'{t}__{inp}_n.png')
                cases.append({'id': f'{t}__{inp}', 'diffuse': f'res://maps/{DIFFUSE[inp]}', 'normal': f'res://maps/{t}__{inp}_n.png', 'size': [w, h]})
    lights = [[0, 0], [1, 0], [1, 1], [0, 1]]
    job = {'cases': cases, 'lights': [[x, y, 0] for x, y in lights]}
    # height relative to picture size is set per case below by scaling: Godot's height is in px,
    # so write one job per input size
    job['lights'] = lights
    (proj / '_verify' / 'job.json').write_text(json.dumps(job))
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    subprocess.run([GODOT, '--headless', '--path', str(proj), '--import'], capture_output=True, timeout=600, creationflags=flags)
    rows = []
    for inp in TRUTH:
        sub = [c for c in cases if c['id'].endswith('__' + inp)]
        w, h = sub[0]['size']
        (proj / '_verify' / 'job.json').write_text(json.dumps({'cases': sub, 'lights': [[x, y, max(w, h) / 2] for x, y in lights]}))
        r = subprocess.run([GODOT, '--path', str(proj), '--script', 'res://_verify/godot_lit_probe.gd', '--rendering-driver', 'opengl3',
                            '--window-position', '0,0', '--resolution', '256x256'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900, creationflags=flags)
        out = proj / '_verify' / 'out'
        alpha = np.asarray(Image.open(h2h / 'in' / DIFFUSE[inp]).convert('RGBA'))[..., 3] == 255

        def renders(i):
            return [np.asarray(unpremultiply(Image.open(out / f'{i}_L{k}.png')), dtype=np.float32)[..., :3] for k in range(4)]
        try:
            ref = renders(f'truth__{inp}')
        except FileNotFoundError:
            print('no renders for', inp, r.stdout[-800:], r.stderr[-800:])
            continue
        for c in sub:
            if c['id'].startswith('truth__'):
                continue
            got = renders(c['id'])
            d = np.concatenate([np.abs(a - b).max(axis=2)[alpha] for a, b in zip(got, ref)])
            row = {'tool': c['id'].split('__')[0], 'input': inp, 'meanLevels': round(float(d.mean()), 2), 'p95Levels': round(float(np.percentile(d, 95)), 1)}
            rows.append(row)
            print(row, flush=True)
    (h2h / 'godot-lit.json').write_text(json.dumps({'godot': GODOT, 'rows': rows}, indent=1))


if __name__ == '__main__':
    main()
