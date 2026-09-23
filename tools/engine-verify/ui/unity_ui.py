"""Unity 6 side of the UI verifiers (nine-slices, buttons, TextMeshPro fonts).

A template with com.unity.ugui 2.x (uGUI + TextMeshPro, a built-in package of the editor, so it
resolves offline) and the TMP Essential Resources (shipped INSIDE that package as
`Package Resources/TMP Essential Resources.unitypackage`) is made once under the engine cache
(NERULIO_ENGINE_CACHE, default %LOCALAPPDATA%/nerulio-engine-verify/unity-template-ui), copied from
the shared unity-template, which is left untouched. Every run copies that template to its own
work folder, so concurrent runs never share a project.

Rendering: batch mode WITHOUT -nographics keeps a D3D11 device, so a Camera renders the UI into a
RenderTexture (the template's colour space is Gamma).
"""
from __future__ import annotations
import json, os, shutil, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import ui_common as U  # noqa: E402

UNITY = os.environ.get('UNITY_BIN', r'C:\Program Files\Unity\Hub\Editor\6000.5.3f1\Editor\Unity.exe')
CACHE = Path(os.environ.get('NERULIO_ENGINE_CACHE', Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'nerulio-engine-verify'))
UGUI = 'com.unity.ugui'


def _run(args, log: Path, timeout=1800):
    p = subprocess.run([UNITY, '-batchmode', '-quit', *args, '-logFile', str(log)], capture_output=True, text=True,
                       encoding='utf-8', errors='replace', timeout=timeout, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    return p.returncode


def _ugui_version() -> str:
    pj = Path(UNITY).parent / 'Data' / 'Resources' / 'PackageManager' / 'BuiltInPackages' / UGUI / 'package.json'
    return json.loads(pj.read_text(encoding='utf-8'))['version'] if pj.exists() else '2.0.0'


def essentials_package() -> Path:
    return Path(UNITY).parent / 'Data' / 'Resources' / 'PackageManager' / 'BuiltInPackages' / UGUI / 'Package Resources' / 'TMP Essential Resources.unitypackage'


def template() -> Path:
    t = CACHE / 'unity-template-ui'
    if (t / '.ready').exists():
        return t
    left = sorted(CACHE.glob('unity-template-ui.tmp*'))
    if left and (left[-1] / '.ready').exists():  # an earlier run built it but could not rename it
        try:
            left[-1].rename(t)
            return t
        except PermissionError:
            pass
    base = CACHE / 'unity-template'
    if not (base / '.ready').exists():
        raise RuntimeError('the shared Unity template is missing; run tools/engine-verify once (unity_runner.template())')
    tmp = CACHE / f'unity-template-ui.tmp{os.getpid()}'
    if tmp.exists():
        shutil.rmtree(tmp)
    shutil.copytree(base, tmp, ignore=shutil.ignore_patterns('Temp', 'Logs', '.ready'))
    manifest = tmp / 'Packages' / 'manifest.json'
    m = json.loads(manifest.read_text(encoding='utf-8'))
    m['dependencies'][UGUI] = _ugui_version()
    manifest.write_text(json.dumps(m, indent=2), encoding='utf-8')
    code = _run(['-nographics', '-projectPath', str(tmp), '-importPackage', str(essentials_package())], CACHE / 'unity-template-ui-resolve.log')
    if code != 0 or not (tmp / 'Assets' / 'TextMesh Pro').exists():
        raise RuntimeError(f'Unity could not add {UGUI} + TMP Essential Resources (see {CACHE / "unity-template-ui-resolve.log"})')
    (tmp / '.ready').write_text(f'{UGUI} {_ugui_version()} + TMP Essential Resources')
    if t.exists():
        shutil.rmtree(t)
    for _ in range(60):  # Unity may still hold a handle for a moment after exiting
        try:
            tmp.rename(t)
            return t
        except PermissionError:
            time.sleep(2)
    shutil.copytree(tmp, t)
    shutil.rmtree(tmp, ignore_errors=True)
    return t


def new_project(work: Path, bundle: Path, probe: Path, extra_editor: list[Path] = ()) -> Path:
    proj = work / 'unity-proj'
    if proj.exists():
        shutil.rmtree(proj)
    shutil.copytree(template(), proj, ignore=shutil.ignore_patterns('Temp', 'Logs', '.ready'))
    shutil.copytree(bundle, proj / 'Assets' / 'Bundle')
    ed = proj / 'Assets' / 'VerifyEditor' / 'Editor'
    ed.mkdir(parents=True)
    shutil.copy2(probe, ed / probe.name)
    for p in extra_editor:
        shutil.copy2(p, ed / p.name)
    (proj / '_verify').mkdir()
    return proj


def run_method(proj: Path, method: str, log: Path) -> tuple[int, float]:
    t0 = time.time()
    code = _run(['-projectPath', str(proj), '-executeMethod', method], log)
    return code, round(time.time() - t0, 1)


def log_errors(log: Path) -> list[str]:
    text = log.read_text(encoding='utf-8', errors='replace') if log.exists() else ''
    return [l for l in text.splitlines() if 'error CS' in l or 'Exception' in l][:10]


def verify(bundle: Path, js: Path, data: dict, cases: list, work: Path, log) -> dict:
    from verify_ui import judge_paths, crop, layout, _over
    out = {'engine': 'unity', 'errors': [], 'rows': []}
    if not Path(UNITY).exists():
        out['errors'].append(f'Unity is not installed at {UNITY}')
        out['status'] = 'UNVERIFIED'
        return out
    if not (bundle / 'unity' / 'Editor' / 'NerulioUIImporter.cs').exists():
        out['errors'].append('the bundle ships no unity/Editor/NerulioUIImporter.cs')
        return out
    canvas = layout(cases)  # same slots as every other engine
    buttons = []
    for name, states in (data.get('buttons') or {}).items():
        el = data['elements'][states['normal']]
        buttons.append({'button': name, 'w': int(el['rect']['w'] * 1.6) + 1, 'h': int(el['rect']['h'] * 1.3)})
    try:
        proj = new_project(work, bundle, HERE / 'unity' / 'NerulioUIProbe.cs')
    except RuntimeError as e:
        out['errors'].append(str(e))
        out['status'] = 'UNVERIFIED'
        return out
    (proj / '_verify' / 'job.json').write_text(json.dumps({'canvas': canvas, 'cases': cases, 'buttons': buttons}), encoding='utf-8')
    ulog = work / 'unity-ui.log'
    code, secs = run_method(proj, 'NerulioUIProbe.Run', ulog)
    out['seconds'] = secs
    rep_path = proj / '_verify' / 'out' / 'report.json'
    if not rep_path.exists():
        out['errors'] += [f'the Unity probe wrote no report (exit {code}); see {ulog}'] + log_errors(ulog)
        return out
    rep = json.loads(rep_path.read_text(encoding='utf-8'))
    out.update(version=rep.get('unity'), graphics=rep.get('graphics'), colorSpace=rep.get('colorSpace'), warnings=rep.get('warnings'),
               textures=rep.get('textures'), sprites=rep.get('sprites'))
    out['errors'] += rep.get('errors', [])
    # sprite read-back against the JSON (Unity rect y from the bottom, border L,B,R,T)
    checks = []
    for name, el in data['elements'].items():
        s = (rep.get('sprites') or {}).get(name)
        if not s:
            checks.append({'element': name, 'ok': False, 'note': 'no sprite'})
            continue
        L, R, T, B = U.sides(el['nineSlice'])
        r = el['rect']
        th = s['texture'][1]
        want_rect = [r['x'], th - r['y'] - r['h'], r['w'], r['h']]
        ok = s['border'] == [L, B, R, T] and s['rect'] == want_rect
        checks.append({'element': name, 'ok': ok, 'border': s['border'], 'want_border': [L, B, R, T], 'rect': s['rect'], 'want_rect': want_rect})
    out['field_checks'] = checks
    tex_ok = all(t.get('filterMode') == 'Point' and t.get('compression') == 'Uncompressed' and not t.get('mipmaps') for t in rep.get('textures', []))
    out['import_ok'] = tex_ok
    png = proj / '_verify' / 'out' / 'path_unity.png'
    if not png.exists():
        out['errors'].append('no capture')
        return out
    full = U.to_array(png)
    # The UI shader blends straight alpha onto the transparent target; see readback_note
    full_u = U.unpremultiply(full)
    out['readback_note'] = 'compared unpremultiplied (the transparent RenderTexture holds rgb*a after SrcAlpha/OneMinusSrcAlpha blending)'
    images = {'unity': {c['id']: crop(full_u, c['slot']) for c in cases}}
    out['rows'] = judge_paths('unity', U.PROFILES['unity'], js, data, cases, images)
    out['buttons'] = []
    for name, b in (rep.get('buttons') or {}).items():
        bp = proj / '_verify' / 'out' / b['png']
        img = U.unpremultiply(U.to_array(bp))
        states = data['buttons'][name]
        for state, st in b['states'].items():
            x, y, w, h = st['slot']
            got = img[y:y + h, x:x + w]
            case = {'element': states[state], 'w': w, 'h': h, 'scale': 1}
            _, variants = U.expected_for(js, data, case, U.PROFILES['unity'])
            cmp = U.compare(variants, got)
            row = {'button': name, 'state': state, 'size': [w, h], 'status': 'PASS' if cmp['ok'] else 'FAIL', 'stats': cmp,
                   'sprite': st['sprite'], 'content': st['content']}
            if state == 'focus':
                # Unity's Selected sprite REPLACES the normal one (Godot draws focus over it)
                nb, nv = U.expected_for(js, data, {**case, 'element': states['normal']}, U.PROFILES['unity'])
                row['same_as_overlay'] = U.compare([_over(v, f) for v, f in zip(nv, variants)], got)['ok']
            out['buttons'].append(row)
    return out
