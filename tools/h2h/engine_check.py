"""Load TexturePacker's engine exports and the Studio's bundles of the same frame sets into the real
engines with tools/engine-verify, judged against the source frames (not against either export).

  python tools/h2h/engine_check.py [--port 4561] [--sets ninja,archer] [--only tp|nerulio]

Needs: tp_engine_exports.py run first; `npm ci --prefix tools/engine-verify/web`.
Writes $H2H_WORK/engine/results.json.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path
from h2h_paths import REPO, SETS, WORK

VERIFY = REPO / 'tools' / 'engine-verify' / 'verify.py'
BUNDLE = REPO / 'tools' / 'engine-verify' / 'studio_pack_bundle.mjs'
# (export id, engines) for TexturePacker; the Studio gets the matching target
TP_CASES = [('phaser', 'phaser3,phaser4'), ('phaser-rot', 'phaser3,phaser4'), ('pixijs', 'pixi8'), ('pixijs-rot', 'pixi8'),
            ('spine', 'spine'), ('spine-rot', 'spine')]
STUDIO_CASES = [('phaser', 'phaser', {}, 'phaser3,phaser4'), ('pixi', 'pixi', {}, 'pixi8'), ('spine', 'spine', {}, 'spine'),
                ('godot4', 'godot4', {}, 'godot')]


def expect_for(s, out):
    files = sorted((SETS / s).glob('*.png'))
    exp = {'asset': f'h2h set {s}', 'sprite': {'frames': [{'image': str(f), 'name': f.stem} for f in files],
                                               'order': True, 'placement': True, 'tolerance': 2, 'scale': 4}}
    p = out / f'expect-{s}.json'
    p.write_text(json.dumps(exp, indent=1))
    return p


def verify(bundle, expect, engines, port, report):
    r = subprocess.run([sys.executable, str(VERIFY), str(bundle), '--expect', str(expect), '--engines', engines,
                        '--port', str(port), '--json', str(report)], capture_output=True, text=True, cwd=REPO)
    try:
        rep = json.loads(Path(report).read_text())
    except Exception:
        rep = {'error': (r.stdout + r.stderr)[-1500:]}
    return r.returncode, rep, (r.stdout + r.stderr)[-2500:]


def summary(rep):
    """engine -> (verdict, failing field notes)"""
    out = {}
    for run in rep if isinstance(rep, list) else []:
        fails = [f"{c['field']}: {c.get('actual')} {c.get('note') or ''}".strip() for c in run.get('checks', []) if not c.get('ok')]
        passes = [f"{c['field']}: {c.get('actual')}" for c in run.get('checks', []) if c.get('ok')]
        out[run.get('engine')] = {'verdict': run.get('status'), 'fails': fails[:6], 'passes': passes[:8], 'errors': run.get('errors', [])[:3],
                                  'na': run.get('na')}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=4561)
    ap.add_argument('--sets', default='ninja,archer,samurai,toon')
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    out = WORK / 'engine'
    out.mkdir(parents=True, exist_ok=True)
    resf = out / 'results.json'
    results = json.loads(resf.read_text()) if resf.exists() else []
    for s in a.sets.split(','):
        exp = expect_for(s, out)
        if a.only in ('', 'tp'):
            for case, engines in TP_CASES:
                b = out / 'tp' / s / case
                rc, rep, log = verify(b, exp, engines, a.port, out / 'tp' / s / f'{case}.report.json')
                row = {'tool': 'tp', 'set': s, 'case': case, 'rc': rc, 'engines': summary(rep), 'log': log[-600:] if not summary(rep) else ''}
                results = [x for x in results if (x['tool'], x['set'], x['case']) != ('tp', s, case)] + [row]
                print('tp', s, case, rc, {k: v['verdict'] for k, v in row['engines'].items()}, flush=True)
        if a.only in ('', 'nerulio'):
            for case, target, settings, engines in STUDIO_CASES:
                bdir = out / 'nerulio' / s
                bdir.mkdir(parents=True, exist_ok=True)
                zipf = bdir / f'{case}.zip'
                files = [str(f) for f in sorted((SETS / s).glob('*.png'))]
                subprocess.run(['node', str(BUNDLE), '--target', target, '--out', str(zipf), '--name', s,
                                '--settings', json.dumps(settings), '--files', *files], check=True, cwd=REPO, capture_output=True)
                rc, rep, log = verify(zipf, exp, engines, a.port, bdir / f'{case}.report.json')
                row = {'tool': 'nerulio', 'set': s, 'case': case, 'rc': rc, 'engines': summary(rep), 'log': log[-600:] if not summary(rep) else ''}
                results = [x for x in results if (x['tool'], x['set'], x['case']) != ('nerulio', s, case)] + [row]
                print('nerulio', s, case, rc, {k: v['verdict'] for k, v in row['engines'].items()}, flush=True)
        resf.write_text(json.dumps(results, indent=1))


if __name__ == '__main__':
    main()
