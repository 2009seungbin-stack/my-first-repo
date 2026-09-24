"""Unity 6 check of the Texture workspace's Unity export (URP 2D, Secondary Texture _NormalMap).

    python tools/engine-verify/texture/unity_texture.py <case dir> [...] [--json out.json]

1. A URP template project is made once under the engine cache (NERULIO_ENGINE_CACHE, default
   %LOCALAPPDATA%/nerulio-engine-verify/unity-template-urp), copied from the shared unity-template
   plus com.unity.render-pipelines.universal (it ships inside the editor).
2. Per case (make_case.mjs): copy the template, put the bundle's unity/ folder in Assets/Bundle/ and
   unity/NerulioTextureProbe.cs in an Editor folder, run the probe with a real GPU (no -nographics).
3. Judge. URP's 2D point light has its own falloff curve and Unity may work in linear colour, so its
   pixels are NOT expected to equal the Studio preview (Godot's model). What the export controls is
   whether Unity reads the normal map the right way round and at the right strength. The probe
   renders every light alone twice: with the normal map as imported (light_i) and with the light's
   normal map switched off (flat_i = albedo x colour x falloff). URP's accurate normal lighting
   multiplies by saturate(dot(normalize(light - pixel, z = normalMapDistance), N)), so on opaque
   pixels light_i / flat_i must equal N.L computed from the exported _n.png (decoded like URP:
   x = r*2-1, y = g*2-1 up, z = sqrt(1-x^2-y^2)). Thresholds (fixed before the first run): mean
   |error| <= 0.02 and 95th percentile <= 0.05 over pixels where flat_i is neither dark (< 40/255)
   nor clipped (> 250/255); the negative control - the same N.L with green flipped - must be at
   least 3x worse and >= 0.05 mean, or the check cannot tell a wrong convention apart. Settings must
   hold too: one secondary texture _NormalMap, sRGB off, both textures at their original size (no
   power-of-two resampling or max-size shrinking), one Light2D per exported light with the
   Accurate normal-map quality and normalMapDistance = z / pixelsPerUnit.
   Runs each case in both colour spaces (Gamma and Linear); --space Gamma|Linear picks one.
   --negative: negative control - the bundle's _n.png is green-flipped before Unity imports it; every
   run must then FAIL (exit code 0 only if all FAIL).
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


def _run(args, log: Path, timeout=2400, graphics=False, env=None):
    base = [UNITY, '-batchmode', '-quit'] + ([] if graphics else ['-nographics'])
    p = subprocess.run(base + args + ['-logFile', str(log)], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout,
                       creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), env={**os.environ, **(env or {})})
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


def lights_of(scene):
    return [l for l in scene['lights'] if l.get('enabled', True) is not False]


def ndotl(normal, light, flip):
    """URP accurate 2D normal lighting factor for one light at each pixel centre (frame-local, y down)."""
    n = normal.astype(np.float64) / 255 * 2 - 1
    nx, ny = n[..., 0], -n[..., 1] * (-1 if flip else 1)
    nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
    h, w = nx.shape
    yy, xx = np.mgrid[0:h, 0:w] + .5
    dx, dy, dz = light['x'] - xx, light['y'] - yy, np.full((h, w), float(light['z']))
    ln = np.sqrt(dx * dx + dy * dy + dz * dz)
    return np.clip((nx * dx + ny * dy + nz * dz) / ln, 0, 1)


def lin(c):
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def run_case(case: Path, space: str, negative=False) -> dict:
    meta = json.loads((case / 'case.json').read_text(encoding='utf-8'))
    c0 = meta['checks'][0]; r = c0['rect']
    work = Path(tempfile.mkdtemp(prefix='nerulio-utex-'))
    proj = work / 'proj'
    shutil.copytree(template(), proj, ignore=shutil.ignore_patterns('Temp', 'Logs', '.ready'))
    shutil.copytree(case / 'bundle' / 'unity', proj / 'Assets' / 'Bundle')
    if negative:  # negative control: Unity gets the normal map with green flipped, the judge still expects the export
        nf = proj / 'Assets' / 'Bundle' / (meta['base'] + '_n.png')
        a = np.asarray(Image.open(nf).convert('RGBA')).copy(); a[..., 1] = 255 - a[..., 1]; Image.fromarray(a).save(nf)
    ed = proj / 'Assets' / 'VerifyEditor' / 'Editor'; ed.mkdir(parents=True)
    shutil.copy2(HERE / 'unity' / 'NerulioTextureProbe.cs', ed / 'NerulioTextureProbe.cs')
    env = {'NERULIO_PROBE_COLORSPACE': space, 'NERULIO_PROBE_FRAME': f"f{c0['frame']}" if meta['frames'] > 1 else ''}
    code = _run(['-projectPath', str(proj), '-executeMethod', 'NerulioTextureProbe.Run'], work / 'unity.log', graphics=True, env=env)
    tag = f"{meta['base']}/{space}" + (' NEGATIVE CONTROL (green flipped in Unity)' if negative else '')
    rep_path = proj / '_verify' / 'report.json'
    if not rep_path.exists():
        text = (work / 'unity.log').read_text(encoding='utf-8', errors='replace') if (work / 'unity.log').exists() else ''
        return {'case': tag, 'verdict': 'FAIL', 'error': f'no report (exit {code})', 'log': [l for l in text.splitlines() if 'error' in l.lower()][:10]}
    rep = json.loads(rep_path.read_text(encoding='utf-8'))
    out = {'case': tag, 'unity': rep.get('unity'), 'colorSpace': rep.get('colorSpace'), 'graphics': rep.get('graphics'), 'report': rep}
    if rep['errors'] or not (proj / '_verify' / 'lit.png').exists():
        out['verdict'] = 'FAIL'; out['error'] = rep['errors'][:1]; return out
    shots = case / (f'unity_{space.lower()}' + ('_negative' if negative else '')); shots.mkdir(exist_ok=True)
    for f in (proj / '_verify').glob('*.png'):
        shutil.copy2(f, shots / f.name)
    alb = np.asarray(Image.open(case / c0['albedo']).convert('RGBA'), dtype=np.float64)
    nrm = np.asarray(Image.open(case / 'bundle' / 'unity' / (meta['base'] + '_n.png')).convert('RGB'))[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']]
    linear = rep.get('colorSpace') == 'Linear'
    ls = lights_of(meta['scene'])
    per, errs, errs_f = [], [], []
    for i, l in enumerate(ls):
        A = np.asarray(Image.open(proj / '_verify' / f'light_{i}.png').convert('RGB'), dtype=np.float64) / 255
        B = np.asarray(Image.open(proj / '_verify' / f'flat_{i}.png').convert('RGB'), dtype=np.float64) / 255
        ch = B.argmax(-1)[..., None]
        a_c, b_c = np.take_along_axis(A, ch, -1)[..., 0], np.take_along_axis(B, ch, -1)[..., 0]
        m = (alb[..., 3] == 255) & (b_c >= 40 / 255) & (B.max(-1) <= 250 / 255)
        if linear:
            a_c, b_c = lin(a_c), lin(b_c)
        got = np.where(m, a_c / np.maximum(b_c, 1e-9), 0)
        e = np.abs(got - ndotl(nrm, l, False))[m]; ef = np.abs(got - ndotl(nrm, l, True))[m]
        errs.append(e); errs_f.append(ef)
        per.append({'light': i, 'pixels': int(m.sum()), 'meanAbs': round(float(e.mean()), 4) if e.size else None,
                    'p95': round(float(np.percentile(e, 95)), 4) if e.size else None, 'flippedMeanAbs': round(float(ef.mean()), 4) if ef.size else None})
    e, ef = np.concatenate(errs), np.concatenate(errs_f)
    sec = rep.get('secondary', [])
    ppu = rep['render']['ppu']
    ul = rep.get('lights', [])
    settings_ok = (len(sec) == 1 and sec[0]['name'] == '_NormalMap' and sec[0]['texture'].endswith('_n.png') and rep.get('normalSRGB') is False
                   and rep.get('spriteSecondaryCount') == 1 and len(ul) == len(ls)
                   and rep.get('normalSize') == [meta['width'], meta['height']] and rep.get('albedoSize') == [meta['width'], meta['height']]
                   and all(u['quality'] == 'Accurate' and abs(u['nmd'] - l['z'] / ppu) < 1e-4 and u['type'] == 'Point' for u, l in zip(ul, ls)))
    if not e.size:
        out.update({'pixels': 0, 'settingsOk': settings_ok, 'perLight': per, 'verdict': 'FAIL', 'error': 'no measurable pixels'}); return out
    mean, p95, fmean = float(e.mean()), float(np.percentile(e, 95)), float(ef.mean())
    lit_ok = e.size >= 50 and mean <= .02 and p95 <= .05 and fmean >= .05 and fmean >= 3 * mean
    out.update({'pixels': int(e.size), 'meanAbs': round(mean, 4), 'p95': round(p95, 4), 'flippedMeanAbs': round(fmean, 4),
                'flippedRatio': round(fmean / max(mean, 1e-9), 1), 'perLight': per, 'settingsOk': settings_ok,
                'verdict': 'PASS' if settings_ok and lit_ok else 'FAIL'})
    return out


def main(argv):
    out_json, spaces, negative = None, ['Gamma', 'Linear'], '--negative' in argv
    argv = [a for a in argv if a != '--negative']
    if '--json' in argv:
        i = argv.index('--json'); out_json = argv[i + 1]; argv = argv[:i] + argv[i + 2:]
    if '--space' in argv:
        i = argv.index('--space'); spaces = [argv[i + 1]]; argv = argv[:i] + argv[i + 2:]
    reps = []
    for d in argv:
        for sp in spaces:
            r = run_case(Path(d), sp, negative)
            reps.append(r); print(json.dumps({k: v for k, v in r.items() if k != 'report'}, indent=1), flush=True)
    if out_json:
        Path(out_json).write_text(json.dumps(reps, indent=1), encoding='utf-8')
    # with --negative every run must FAIL (the check can tell a flipped normal map apart)
    return 0 if reps and all((r['verdict'] == 'FAIL') == negative for r in reps) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
