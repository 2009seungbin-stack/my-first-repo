"""Unity 6 check of the Texture workspace's Unity export (URP 2D, Secondary Texture _NormalMap).

    python tools/engine-verify/texture/unity_texture.py <case dir> [...] [--json out.json]

1. A URP template project is made once under the engine cache (NERULIO_ENGINE_CACHE, default
   %LOCALAPPDATA%/nerulio-engine-verify/unity-template-urp), copied from the shared unity-template
   plus com.unity.render-pipelines.universal (it ships inside the editor).
2. Per case (make_case.mjs): copy the template, put the bundle's unity/ folder in Assets/Bundle/ and
   unity/NerulioTextureProbe.cs in an Editor folder, run the probe with a real GPU (no -nographics).
3. Judge: the importer's settings (the sprite has exactly one secondary texture named _NormalMap,
   the normal map is imported with sRGB off) and the lit render. URP's 2D point light uses its own
   falloff curve and works in linear colour, so its pixels are NOT expected to equal the Studio
   preview (which is Godot's model). What must hold is that the normal map is read the right way
   round: the per-pixel lighting Unity drew must rank like the Studio's N·L prediction for the
   exported map (Spearman ρ ≥ 0.8), and clearly better than the same map read with green flipped.
"""
from __future__ import annotations
import json, os, shutil, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
UNITY = os.environ.get('UNITY_BIN', r'C:\Program Files\Unity\Hub\Editor\6000.5.3f1\Editor\Unity.exe')
CACHE = Path(os.environ.get('NERULIO_ENGINE_CACHE', Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'nerulio-engine-verify'))
URP = ('com.unity.render-pipelines.universal', '17.5.0')


def _run(args, log: Path, timeout=2400, graphics=False):
    base = [UNITY, '-batchmode', '-quit'] + ([] if graphics else ['-nographics'])
    p = subprocess.run(base + args + ['-logFile', str(log)], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout,
                       creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    return p.returncode


def template() -> Path:
    t = CACHE / 'unity-template-urp'
    if (t / '.ready').exists():
        return t
    base = CACHE / 'unity-template'
    if not (base / '.ready').exists():
        raise RuntimeError('the shared Unity template is missing; run tools/engine-verify once (unity_runner.template())')
    if t.exists():
        shutil.rmtree(t)
    shutil.copytree(base, t, ignore=shutil.ignore_patterns('Temp', 'Logs', '.ready'))
    manifest = t / 'Packages' / 'manifest.json'
    m = json.loads(manifest.read_text(encoding='utf-8'))
    m['dependencies'][URP[0]] = URP[1]
    manifest.write_text(json.dumps(m, indent=2), encoding='utf-8')
    if _run(['-projectPath', str(t)], CACHE / 'unity-template-urp-resolve.log') != 0:
        raise RuntimeError(f'Unity could not resolve URP (see {CACHE / "unity-template-urp-resolve.log"})')
    (t / '.ready').write_text('ok')
    return t


def rank(a):
    o = np.argsort(a, kind='stable'); r = np.empty(len(a)); r[o] = np.arange(len(a)); return r


def spearman(a, b):
    ra, rb = rank(a), rank(b)
    return float(np.corrcoef(ra, rb)[0, 1])


def predict(normal, rect, scene, flip):
    """Σ over lights of falloff-free N·L at each pixel centre (frame-local, y down), Godot-style normal decode."""
    n = normal.astype(np.float64) / 255 * 2 - 1
    nx, ny = n[..., 0], -n[..., 1] * (-1 if flip else 1)
    nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
    h, w = nx.shape
    yy, xx = np.mgrid[0:h, 0:w] + .5
    out = np.zeros((h, w))
    for l in scene['lights']:
        dx, dy, dz = l['x'] - xx, l['y'] - yy, np.full((h, w), float(l['z']))
        ln = np.sqrt(dx * dx + dy * dy + dz * dz)
        out += l.get('energy', 1) * np.clip((nx * dx + ny * dy + nz * dz) / ln, 0, None) * (np.hypot(dx, dy) < l['radius'])
    return out


def run_case(case: Path, log) -> dict:
    meta = json.loads((case / 'case.json').read_text(encoding='utf-8'))
    work = Path(tempfile.mkdtemp(prefix='nerulio-utex-'))
    proj = work / 'proj'
    shutil.copytree(template(), proj, ignore=shutil.ignore_patterns('Temp', 'Logs', '.ready'))
    shutil.copytree(case / 'bundle' / 'unity', proj / 'Assets' / 'Bundle')
    ed = proj / 'Assets' / 'VerifyEditor' / 'Editor'; ed.mkdir(parents=True)
    shutil.copy2(HERE / 'unity' / 'NerulioTextureProbe.cs', ed / 'NerulioTextureProbe.cs')
    code = _run(['-projectPath', str(proj), '-executeMethod', 'NerulioTextureProbe.Run'], work / 'unity.log', graphics=True)
    rep_path = proj / '_verify' / 'report.json'
    if not rep_path.exists():
        text = (work / 'unity.log').read_text(encoding='utf-8', errors='replace') if (work / 'unity.log').exists() else ''
        return {'case': meta['base'], 'verdict': 'FAIL', 'error': f'no report (exit {code})', 'log': [l for l in text.splitlines() if 'error' in l.lower()][:10]}
    rep = json.loads(rep_path.read_text(encoding='utf-8'))
    out = {'case': meta['base'], 'unity': rep.get('unity'), 'report': rep}
    if rep['errors'] or not (proj / '_verify' / 'lit.png').exists():
        out['verdict'] = 'FAIL'; return out
    shutil.copy2(proj / '_verify' / 'lit.png', case / 'unity_lit.png')
    got = np.asarray(Image.open(proj / '_verify' / 'lit.png').convert('RGB'), dtype=np.float64)
    c0 = meta['checks'][0]; r = c0['rect']
    alb = np.asarray(Image.open(case / c0['albedo']).convert('RGBA'), dtype=np.float64)
    nrm = np.asarray(Image.open(case / 'bundle' / 'unity' / (meta['base'] + '_n.png')).convert('RGB'))[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']]
    lin = lambda c: np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
    a_lum = (lin(alb[..., :3] / 255) @ [.2126, .7152, .0722])
    g_lum = (lin(got / 255) @ [.2126, .7152, .0722])
    m = (alb[..., 3] == 255) & (a_lum > .02)
    factor = g_lum[m] / a_lum[m]
    right = spearman(factor, predict(nrm, r, meta['scene'], False)[m])
    wrong = spearman(factor, predict(nrm, r, meta['scene'], True)[m])
    sec = rep.get('secondary', [])
    settings_ok = len(sec) == 1 and sec[0]['name'] == '_NormalMap' and sec[0]['texture'].endswith('_n.png') and rep.get('normalSRGB') is False and rep.get('spriteSecondaryCount') == 1
    lit_ok = right >= .8 and right - wrong >= .3 and float(factor.max()) > .05
    out.update({'pixels': int(m.sum()), 'spearmanRight': round(right, 3), 'spearmanFlipped': round(wrong, 3), 'settingsOk': settings_ok,
                'verdict': 'PASS' if settings_ok and lit_ok else 'FAIL'})
    return out


def main(argv):
    out_json = None
    if '--json' in argv:
        i = argv.index('--json'); out_json = argv[i + 1]; argv = argv[:i] + argv[i + 2:]
    reps = []
    for d in argv:
        with (Path(d) / 'unity.log').open('w', encoding='utf-8') as log:
            r = run_case(Path(d), log)
        reps.append(r); print(json.dumps({k: v for k, v in r.items() if k != 'report'}, indent=1))
    if out_json:
        Path(out_json).write_text(json.dumps(reps, indent=1), encoding='utf-8')
    return 0 if reps and all(r['verdict'] == 'PASS' for r in reps) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
