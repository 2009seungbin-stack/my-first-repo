"""Unity 6 check for the Studio Tile "Unity Rule Tiles" export.

    python tools/engine-verify/tile/unity_tile.py <asset dir from corpus_tiles.mjs>
    (run_all.py calls check(asset_dir))

1. A template project with com.unity.2d.tilemap.extras is made once under the engine cache
   (NERULIO_ENGINE_CACHE, default %LOCALAPPDATA%/nerulio-engine-verify/unity-template-tile), copied
   from the shared unity-template (which is left untouched). The package ships inside the editor
   (Editor/Data/Resources/PackageManager/Editor/com.unity.2d.tilemap.extras-8.0.3.tgz); the registry
   version is tried first and the bundled tarball is the fallback.
2. Per asset: copy the template, drop the bundle's unity/ folder into Assets/Bundle/, add
   unity/NerulioTileProbe.cs in an Editor folder, write _verify/job.json (make_unity_job.mjs), run
   `Unity -batchmode -quit -executeMethod NerulioTileProbe.Run`.
3. Judge: every painted cell's sprite against the Studio expectation (Unity's RuleTile semantics on
   the exported rules), against every tile whose pattern fits the neighbourhood, and against the
   corpus truth where known; sprite rects against the export and sprite pixels against the PNG.
"""
from __future__ import annotations
import json, os, shutil, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
UNITY = os.environ.get('UNITY_BIN', r'C:\Program Files\Unity\Hub\Editor\6000.5.3f1\Editor\Unity.exe')
CACHE = Path(os.environ.get('NERULIO_ENGINE_CACHE', Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'nerulio-engine-verify'))
PKG = 'com.unity.2d.tilemap.extras'
PKG_VERSION = '8.0.3'


def _run(args, log: Path, timeout=1800):
    p = subprocess.run([UNITY, '-batchmode', '-quit', *args, '-logFile', str(log)], capture_output=True, text=True,
                       encoding='utf-8', errors='replace', timeout=timeout, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    return p.returncode


def _has_pkg(t: Path) -> bool:
    return any((t / 'Library' / 'PackageCache').glob(PKG + '@*')) if (t / 'Library' / 'PackageCache').exists() else False


def template() -> Path:
    t = CACHE / 'unity-template-tile'
    if (t / '.ready').exists() and _has_pkg(t):
        return t
    base = CACHE / 'unity-template'
    if not (base / '.ready').exists():
        raise RuntimeError('the shared Unity template is missing; run tools/engine-verify once (unity_runner.template())')
    if t.exists():
        shutil.rmtree(t)
    shutil.copytree(base, t, ignore=shutil.ignore_patterns('Temp', 'Logs', '.ready'))
    manifest = t / 'Packages' / 'manifest.json'
    tgz = Path(UNITY).parent / 'Data' / 'Resources' / 'PackageManager' / 'Editor' / f'{PKG}-{PKG_VERSION}.tgz'
    for ref in (PKG_VERSION, 'file:' + tgz.as_posix()):
        m = json.loads(manifest.read_text(encoding='utf-8'))
        m['dependencies'][PKG] = ref
        manifest.write_text(json.dumps(m, indent=2), encoding='utf-8')
        code = _run(['-nographics', '-projectPath', str(t)], CACHE / 'unity-template-tile-resolve.log')
        if code == 0 and _has_pkg(t):
            (t / '.ready').write_text(ref)
            return t
    raise RuntimeError(f'Unity could not install {PKG} (see {CACHE / "unity-template-tile-resolve.log"})')


def run_probe(asset_dir: Path, work: Path) -> dict:
    job = json.loads((asset_dir / 'unity-job.json').read_text(encoding='utf-8'))
    proj = work / 'unity-proj'
    if proj.exists():
        shutil.rmtree(proj)
    shutil.copytree(template(), proj, ignore=shutil.ignore_patterns('Temp', 'Logs', '.ready'))
    shutil.copytree(asset_dir / 'unity', proj / 'Assets' / 'Bundle')
    ed = proj / 'Assets' / 'VerifyEditor' / 'Editor'
    ed.mkdir(parents=True)
    shutil.copy2(HERE / 'unity' / 'NerulioTileProbe.cs', ed / 'NerulioTileProbe.cs')
    v = proj / '_verify'
    v.mkdir()
    # JsonUtility cannot read nested arrays: cells travel as flat [x, y, terrain, …]
    (v / 'job.json').write_text(json.dumps({'json': job['json'], 'png': job['png'], 'terrainOrder': job['terrainOrder'],
                                            'cases': [{'name': c['name'], 'flat': [n for cell in c['cells'] for n in cell]} for c in job['cases']]}), encoding='utf-8')
    log = work / 'unity.log'
    t0 = time.time()
    code = _run(['-projectPath', str(proj), '-executeMethod', 'NerulioTileProbe.Run'], log)
    secs = round(time.time() - t0, 1)
    rep = v / 'report.json'
    if not rep.exists():
        text = log.read_text(encoding='utf-8', errors='replace') if log.exists() else ''
        errs = [l for l in text.splitlines() if 'error CS' in l or 'Exception' in l][:10]
        return {'errors': [f'the Unity probe produced no report (exit {code}); see {log}'] + errs, 'seconds': secs}
    data = json.loads(rep.read_text(encoding='utf-8'))
    data['seconds'] = secs
    return data


def judge(job: dict, rep: dict) -> dict:
    out = {'unity': rep.get('unity'), 'package': rep.get('package'), 'errors': rep.get('errors', []), 'settings': rep.get('settings'),
           'seconds': rep.get('seconds'), 'cases': []}
    exp_sprites = {s['name']: s for s in job['sprites']}
    got_sprites = {s['name']: s for s in rep.get('sprites', [])}
    rects_ok = sum(1 for n, s in exp_sprites.items() if n in got_sprites and got_sprites[n]['rect'] == [s['x'], s['y'], s['w'], s['h']])
    pixels_ok = sum(1 for n in exp_sprites if n in got_sprites and got_sprites[n]['diff'] == 0)
    out['sprites'] = {'expected': len(exp_sprites), 'rects_ok': rects_ok, 'pixels_ok': pixels_ok}
    st = rep.get('settings') or {}
    out['import_ok'] = st.get('filterMode') == 'Point' and st.get('compression') == 'Uncompressed' and st.get('spriteImportMode') == 'Multiple'
    ok_all = not out['errors'] and out['import_ok'] and rects_ok == len(exp_sprites) and pixels_ok == len(exp_sprites)
    for c in job['cases']:
        got = rep.get('cases', {}).get(c['name'])
        if got is None:
            out['cases'].append({'name': c['name'], 'error': 'not painted'}); ok_all = False
            continue
        cells = list(c['rule'].keys())
        rule_ok = [k for k in cells if got.get(k) == c['rule'][k]]
        ideal_ok = [k for k in cells if got.get(k) in c['ideal'][k]]
        # where the MODEL has a tile for the neighbourhood, Unity must draw one of those tiles: this is what
        # catches an exporter that writes wrong rules (the export-derived expectation cannot)
        applicable = [k for k in cells if c['ideal'][k]]
        applicable_ok = [k for k in applicable if got.get(k) in c['ideal'][k]]
        row = {'name': c['name'], 'cells': len(cells), 'match_studio': len(rule_ok), 'fit_ideal': len(ideal_ok),
               'studio_rule_vs_ideal': sum(1 for k in cells if c['rule'][k] in c['ideal'][k]),
               'model_has_tile': len(applicable), 'model_tile_drawn': len(applicable_ok),
               'diff_studio': [{'cell': k, 'unity': got.get(k), 'studio': c['rule'][k]} for k in cells if k not in rule_ok][:10]}
        if 'truth' in c:
            row['truth_cells'] = len(c['truth'])
            row['truth_right'] = sum(1 for k, v in c['truth'].items() if got.get(k) in v)
        out['cases'].append(row)
        if row['match_studio'] != row['cells'] or row['model_tile_drawn'] != row['model_has_tile'] or row.get('truth_right', 0) != row.get('truth_cells', 0):
            ok_all = False
    out['pass'] = ok_all
    return out


def check(asset_dir) -> dict:
    asset_dir = Path(asset_dir)
    if not Path(UNITY).exists():
        return {'verdict': 'UNVERIFIED', 'summary': 'Unity 6000.5.3f1 is not installed here', 'details': {}}
    if not (asset_dir / 'unity' / 'nerulio-ruletile.json').exists():
        return {'verdict': 'N/A', 'summary': 'no Unity bundle (corner / dual-grid sets are not exported as Rule Tiles)', 'details': {}}
    subprocess.run(['node', str(HERE / 'make_unity_job.mjs'), str(asset_dir)], check=True, capture_output=True, cwd=ROOT)
    job = json.loads((asset_dir / 'unity-job.json').read_text(encoding='utf-8'))
    try:
        rep = run_probe(asset_dir, asset_dir / '_unity')
    except RuntimeError as e:
        return {'verdict': 'UNVERIFIED', 'summary': str(e), 'details': {}}
    res = judge(job, rep)
    (asset_dir / 'unity-result.json').write_text(json.dumps(res, indent=1), encoding='utf-8')
    cases = ', '.join(f"{c['name']} {c.get('match_studio')}/{c.get('cells')} model {c.get('model_tile_drawn')}/{c.get('model_has_tile')}" + (f" truth {c['truth_right']}/{c['truth_cells']}" if 'truth_cells' in c else '') for c in res['cases'])
    sp = res.get('sprites', {})
    summary = f"{res.get('unity')} {res.get('package')} {res.get('seconds')}s; sprites rect {sp.get('rects_ok')}/{sp.get('expected')} pixels {sp.get('pixels_ok')}/{sp.get('expected')}; import {'ok' if res.get('import_ok') else 'WRONG'}; {cases} {res['errors'] or ''}"
    return {'verdict': 'PASS' if res['pass'] else 'FAIL', 'summary': summary, 'details': res}


if __name__ == '__main__':
    r = check(sys.argv[1])
    print(r['verdict'], r['summary'])
