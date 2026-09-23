"""Godot 4 check for Studio Tile exports: build the TileSet with the importer the bundle ships,
paint every case with set_cells_terrain_connect, and compare each cell with the Studio's own
prediction (the tile the Studio painter shows) and, when given, with the corpus truth.

    python tools/engine-verify/tile/godot_tile.py <bundle folder> <job.json> [--out dir]

job.json: {"cases":[{"name", "calls":[{"terrain", "cells":[[x,y],...]}],
                     "predict":{"x,y":[[ax,ay],...]},       # Studio: acceptable atlas tiles (duplicates)
                     "truth":{"x,y":[[ax,ay],...]}}]}         # optional: from the source layout
A cell missing from "predict" means the Studio predicts an EMPTY cell there.
Exit 1 when any case differs from the prediction.
"""
from __future__ import annotations
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
GODOT = os.environ.get('GODOT_BIN', r'C:\Users\2009s\Desktop\Godot_v4.7.2-stable_win64_console.exe')
PROJECT = 'config_version=5\n\n[application]\n\nconfig/name="nerulio-tile-verify"\nconfig/features=PackedStringArray("4.4")\n'


def run(bundle: Path, job: dict, work: Path) -> dict:
    proj = work / 'godot-proj'
    if proj.exists():
        shutil.rmtree(proj)
    shutil.copytree(bundle, proj)
    (proj / 'project.godot').write_text(PROJECT, encoding='utf-8')
    v = proj / '_verify'
    v.mkdir(exist_ok=True)
    shutil.copy2(HERE / 'terrain_probe.gd', v / 'terrain_probe.gd')
    (v / 'job.json').write_text(json.dumps({k: job[k] for k in job if k != 'cases'} | {'cases': [{'name': c['name'], 'calls': c['calls']} for c in job['cases']]}), encoding='utf-8')
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    log = []
    for args in (['--headless', '--path', str(proj), '--import'], ['--headless', '--quit-after', '2000', '--path', str(proj), '--script', 'res://_verify/terrain_probe.gd']):
        p = subprocess.run([GODOT, *args], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=300, creationflags=flags)
        log.append(f'$ godot {" ".join(args)} (exit {p.returncode})\n{p.stdout[-3000:]}\n{p.stderr[-3000:]}')
    (work / 'godot.log').write_text('\n'.join(log), encoding='utf-8')
    rep = v / 'out' / 'report.json'
    if not rep.exists():
        return {'errors': ['the probe wrote no report; see godot.log']}
    return json.loads(rep.read_text(encoding='utf-8'))


def judge(job: dict, rep: dict) -> dict:
    out = {'godot': rep.get('godot', {}).get('string'), 'errors': rep.get('errors', []), 'importer_log': rep.get('importer_log'),
           'importer_problems': rep.get('importer_problems'), 'cases': []}
    for case in job['cases']:
        got = rep.get('cases', {}).get(case['name'])
        if got is None:
            out['cases'].append({'name': case['name'], 'error': 'not painted'})
            continue
        pred = case.get('predict', {})
        keys = sorted(set(pred) | set(got), key=lambda k: tuple(map(int, k.split(',')))[::-1])
        diff = []
        for k in keys:
            want = [list(a) for a in pred.get(k, [])]
            have = got.get(k)
            if (have is None and want) or (have is not None and have not in want):
                diff.append({'cell': k, 'godot': have, 'studio': want})
        row = {'name': case['name'], 'cells': len(keys), 'match_studio': len(keys) - len(diff), 'diff_studio': diff[:12]}
        if 'truth' in case:
            truth = case['truth']
            right = sum(1 for k, v in truth.items() if got.get(k) in [list(a) for a in v])
            row['truth_cells'] = len(truth)
            row['truth_right'] = right
            row['truth_wrong'] = [{'cell': k, 'godot': got.get(k), 'want': v} for k, v in truth.items() if got.get(k) not in [list(a) for a in v]][:12]
        out['cases'].append(row)
    # collision polygons: the JSON's tile-pixel polygons must come back from Godot exactly, shifted to
    # Godot's tile-centred coordinates (the shipped importer subtracts half a tile)
    spec = job.get('collision')
    if spec:
        half = [spec['tile'][0] / 2, spec['tile'][1] / 2]
        tiles = rep.get('tileset', {}).get('tiles', {})
        want_n = sum(len(v) for v in spec['shapes'].values())
        got_n, bad = 0, []
        for k, shapes in spec['shapes'].items():
            got = tiles.get(k, {}).get('polygon_points', [])
            got_n += len(got)
            exp = [[[x - half[0], y - half[1]] for x, y in poly] for poly in shapes]
            if len(got) != len(exp) or any(len(a) != len(b) or any(abs(p[0] - q[0]) > 1e-4 or abs(p[1] - q[1]) > 1e-4 for p, q in zip(a, b)) for a, b in zip(got, exp)):
                bad.append(k)
        out['collision'] = {'polygons_expected': want_n, 'polygons_in_godot': got_n, 'tiles_differ': bad[:10], 'pass': not bad and got_n == want_n}
    out['pass'] = not out['errors'] and all(c.get('match_studio') == c.get('cells') for c in out['cases']) and (not spec or out['collision']['pass'])
    return out


def main():
    bundle, job_path = Path(sys.argv[1]), Path(sys.argv[2])
    outdir = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else Path(tempfile.mkdtemp(prefix='nerulio-tile-'))
    outdir.mkdir(parents=True, exist_ok=True)
    job = json.loads(job_path.read_text(encoding='utf-8'))
    rep = run(bundle, job, outdir)
    res = judge(job, rep)
    (outdir / 'godot-result.json').write_text(json.dumps(res, indent=1), encoding='utf-8')
    for c in res['cases']:
        t = f"; truth {c['truth_right']}/{c['truth_cells']}" if 'truth_cells' in c else ''
        print(f"{c['name']}: studio {c.get('match_studio')}/{c.get('cells')}{t}" + (f"  first diffs {c['diff_studio'][:3]}" if c.get('diff_studio') else ''))
    print('GODOT', res['godot'], 'PASS' if res['pass'] else 'FAIL', res['errors'] or '')
    sys.exit(0 if res['pass'] else 1)


if __name__ == '__main__':
    main()
