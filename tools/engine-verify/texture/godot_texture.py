"""Godot 4 check of the Texture workspace export: does Godot light the exported sprite the way the
Studio preview does?

For each case folder made by make_case.mjs: a throw-away project gets the bundle's godot/ folder
as-is, `godot --headless --import` runs, then texture_probe.gd (with a real renderer: a small
window opens) loads <base>_lit.tscn, draws each checked frame (by region, and once through the
exported AnimationPlayer) and saves the pixels. They are compared with the reference render from
src/game/normals/lighting.js on the sprite's opaque pixels.

    python tools/engine-verify/texture/godot_texture.py <case dir> [<case dir> …] [--json out.json]

PASS = mean |Δ| ≤ 1.5/255 and ≥ 99 % of opaque pixels within 3/255 on every channel. A second
render with the green channel flipped must be clearly worse (it proves the comparison would catch
a wrong convention).
"""
from __future__ import annotations
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image

GODOT = os.environ.get('GODOT_BIN', r'C:\Users\2009s\Desktop\Godot_v4.7.2-stable_win64_console.exe')
HERE = Path(__file__).resolve().parent
PROJECT = '''config_version=5

[application]

config/name="nerulio-texture-verify"
config/features=PackedStringArray("4.4")

[display]

window/size/viewport_width={w}
window/size/viewport_height={h}
window/size/borderless=true

[rendering]

renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
'''


def compare(got: np.ndarray, want: np.ndarray, alpha: np.ndarray) -> dict:
    m = alpha == 255
    if not m.any():
        return {'pixels': 0}
    d = np.abs(got[..., :3].astype(np.int32) - want[..., :3].astype(np.int32))[m]
    return {'pixels': int(m.sum()), 'mean': round(float(d.mean()), 3), 'max': int(d.max()),
            'within3': round(float((d.max(axis=1) <= 3).mean()), 5), 'within1': round(float((d.max(axis=1) <= 1).mean()), 5)}


def run_case(case: Path, log) -> dict:
    meta = json.loads((case / 'case.json').read_text(encoding='utf-8'))
    base = meta['base']
    work = Path(tempfile.mkdtemp(prefix='nerulio-tex-'))
    proj = work / 'proj'
    shutil.copytree(case / 'bundle' / 'godot', proj / 'bundle')
    fw = max(c['rect']['w'] for c in meta['checks']); fh = max(c['rect']['h'] for c in meta['checks'])
    win = (max(64, fw + 32), max(64, fh + 32))
    (proj / 'project.godot').write_text(PROJECT.format(w=win[0], h=win[1]), encoding='utf-8')
    (proj / '_verify').mkdir()
    shutil.copy2(HERE / 'texture_probe.gd', proj / '_verify' / 'probe.gd')
    checks = [dict(c) for c in meta['checks']]
    # one more check through the exported AnimationPlayer: seek into the last checked frame
    if meta['frames'] > 1:
        last = checks[-1]
        checks.append({**last, 'frame': 1000 + last['frame'], 'time': last['frame'] * 0.1 + 0.05})
    (proj / '_verify' / 'job.json').write_text(json.dumps({'scene': f'res://bundle/{base}_lit.tscn', 'checks': checks, 'via_animation': True}), encoding='utf-8')
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    imp = subprocess.run([GODOT, '--headless', '--path', str(proj), '--import'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600, creationflags=flags)
    log.write(f'import exit {imp.returncode}\n{imp.stdout[-3000:]}\n{imp.stderr[-3000:]}\n')
    run = subprocess.run([GODOT, '--path', str(proj), '--script', 'res://_verify/probe.gd', '--rendering-driver', 'opengl3', '--window-position', '0,0', '--resolution', f'{win[0]}x{win[1]}'],
                         capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600, creationflags=flags)
    log.write(f'probe exit {run.returncode}\n{run.stdout[-6000:]}\n{run.stderr[-6000:]}\n')
    rep_path = proj / '_verify' / 'out' / 'report.json'
    if not rep_path.exists():
        return {'case': base, 'verdict': 'FAIL', 'error': 'probe wrote no report', 'stderr': run.stderr[-800:]}
    rep = json.loads(rep_path.read_text(encoding='utf-8'))
    results = []
    out_dir = case / 'godot'
    out_dir.mkdir(exist_ok=True)
    for c in checks:
        png = proj / '_verify' / 'out' / f"frame_{c['frame']}.png"
        if not png.exists():
            results.append({'frame': c['frame'], 'error': 'no capture'}); continue
        shutil.copy2(png, out_dir / png.name)
        got = np.asarray(Image.open(png).convert('RGBA'))
        src = c['frame'] % 1000
        want = np.asarray(Image.open(case / f'expected_{src}.png').convert('RGBA'))
        alb = np.asarray(Image.open(case / f'albedo_{src}.png').convert('RGBA'))
        r = compare(got, want, alb[..., 3])
        flipped = compare(got, np.asarray(Image.open(case / f'expected_flipped_{src}.png').convert('RGBA')), alb[..., 3])
        r['flippedMean'] = flipped.get('mean')
        r['frame'] = c['frame']; r['via'] = 'animation' if c['frame'] >= 1000 else 'region'
        results.append(r)
    ok = bool(results) and all(r.get('pixels', 0) > 0 and r.get('mean', 99) <= 1.5 and r.get('within3', 0) >= .99 and (r.get('flippedMean') or 0) > 2 * r['mean'] + .5 for r in results)
    return {'case': base, 'verdict': 'PASS' if ok and not rep['errors'] else 'FAIL', 'godot': rep.get('godot', {}).get('string'),
            'renderer': rep.get('renderer'), 'texture_class': rep.get('texture_class'), 'lights': rep.get('lights'),
            'animation_keys': len(rep.get('animation_keys', [])), 'errors': rep['errors'], 'results': results}


def main(argv):
    out_json = None
    if '--json' in argv:
        i = argv.index('--json'); out_json = argv[i + 1]; argv = argv[:i] + argv[i + 2:]
    reports = []
    for d in argv:
        case = Path(d)
        with (case / 'godot.log').open('w', encoding='utf-8') as log:
            rep = run_case(case, log)
        reports.append(rep)
        print(json.dumps(rep, indent=1))
    if out_json:
        Path(out_json).write_text(json.dumps(reports, indent=1), encoding='utf-8')
    return 0 if all(r['verdict'] == 'PASS' for r in reports) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
