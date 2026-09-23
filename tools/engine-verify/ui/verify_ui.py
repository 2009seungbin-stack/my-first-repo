"""Nine-slice / button verification of a Nerulio UI export in real engines.

    python tools/engine-verify/ui/verify_ui.py <bundle folder|zip> [--engines godot,unity,phaser3,phaser4,pixi8,css]
                                               [--json out.json] [--work dir] [--port 4521] [--profile-fit]

Bundle schema (nerulio-ui.json, all numbers in source pixels):

    {"format":"nerulio-ui","version":1,
     "images":[{"file":"panel_beige.png","width":100,"height":100}],
     "elements":{"<name>":{"image":0,"rect":{"x":0,"y":0,"w":100,"h":100},
        "nineSlice":{"left":..,"right":..,"top":..,"bottom":..},
        "padding":{"left":..,"right":..,"top":..,"bottom":..}|null,
        "stretch":{"horizontal":"stretch"|"tile"|"tile-fit","vertical":...},"drawCenter":true}},
     "buttons":{"<name>":{"normal":"<element>","hover":..,"pressed":..,"disabled":..,"focus":..}},
     "previews":[{"element":"<name>","w":..,"h":..,"scale":1}]}

Engine files are looked for where make_ui_bundle.py puts them (godot/, unity/Editor/, web/). Every
element is drawn at the sizes of ui_common.standard_sizes() (smaller than, equal to and much larger
than the source, odd sizes, 1x/2x/3x/1.5x) plus the bundle's previews, with NEAREST filtering, and
compared pixel by pixel with the reference render of that engine's profile (ui_common.PROFILES).
Each row also says whether the engine's pixels equal the Studio's own plan (`plan`), so the
places where engines disagree with the Studio preview are listed, not hidden.

A case the engine cannot express at all (e.g. tile modes in Phaser/Pixi, drawCenter=false in Pixi)
is N/A with the reason. Exit code 1 when any case FAILs.
"""
from __future__ import annotations
import argparse, json, shutil, subprocess, sys, time
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import ui_common as U  # noqa: E402

GODOT = __import__('os').environ.get('GODOT_BIN', r'C:\Users\2009s\Desktop\Godot_v4.7.2-stable_win64_console.exe')
ALL = ['godot', 'unity', 'phaser3', 'phaser4', 'pixi8', 'css']


def layout(cases, width=2048, gap=16):
    x = y = gap
    row = 0
    W = 0
    for c in cases:
        w, h = int(c['w']), int(c['h'])
        if x + w + gap > width and x > gap:
            x, y, row = gap, y + row + gap, 0
        c['slot'] = [x, y, w, h]
        x += w + gap
        row = max(row, h)
        W = max(W, x)
    return [max(W, 16), y + row + gap]


def crop(canvas: np.ndarray, slot) -> np.ndarray:
    x, y, w, h = slot
    return canvas[y:y + h, x:x + w]


# ---------------------------------------------------------------- Godot

GODOT_PROJECT = '''config_version=5

[application]

config/name="nerulio-ui-verify"
config/features=PackedStringArray("4.4")

[display]

window/size/viewport_width=64
window/size/viewport_height=64
window/size/borderless=true

[rendering]

renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
textures/canvas_textures/default_texture_filter=0
'''


def run_godot(bundle: Path, cases, canvas, data, work: Path, log) -> dict:
    proj = work / 'godot-proj'
    if proj.exists():
        shutil.rmtree(proj)
    shutil.copytree(bundle, proj / 'bundle')
    (proj / 'project.godot').write_text(GODOT_PROJECT, encoding='utf-8')
    v = proj / '_verify'
    v.mkdir()
    shutil.copy2(HERE / 'godot' / 'ui_probe.gd', v / 'ui_probe.gd')
    rel = lambda p: 'res://bundle/' + p
    buttons = []
    for name, states in (data.get('buttons') or {}).items():
        el = data['elements'][states['normal']]
        for (w, h) in [(el['rect']['w'], el['rect']['h']), (int(el['rect']['w'] * 1.6) + 1, int(el['rect']['h'] * 1.3))]:
            buttons.append({'button': name, 'w': w, 'h': h, 'theme': rel(f'godot/{name}_theme.tres')})
    # one size per button for now: the source size and a larger odd one
    job = {'json': rel('nerulio-ui.json'), 'helper': rel('godot/nerulio_ui_import.gd'), 'tres_dir': rel('godot').rstrip('/'),
           'canvas': canvas, 'cases': cases, 'paths': ['tres', 'helper', 'ninepatch'], 'buttons': buttons[1:2]}
    (v / 'job.json').write_text(json.dumps(job), encoding='utf-8')
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    t0 = time.time()
    imp = subprocess.run([GODOT, '--headless', '--path', str(proj), '--import'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600, creationflags=flags)
    log.write(f'$ godot --import (exit {imp.returncode})\n{imp.stdout[-3000:]}\n{imp.stderr[-3000:]}\n')
    run = subprocess.run([GODOT, '--path', str(proj), '--script', 'res://_verify/ui_probe.gd', '--rendering-driver', 'opengl3',
                          '--window-position', '0,0', '--resolution', '64x64'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600, creationflags=flags)
    log.write(f'$ godot ui_probe (exit {run.returncode})\n{run.stdout[-6000:]}\n{run.stderr[-6000:]}\n')
    rep = v / 'out' / 'report.json'
    if not rep.exists():
        return {'errors': ['the Godot probe wrote no report; see the log'], 'seconds': round(time.time() - t0, 1)}
    r = json.loads(rep.read_text(encoding='utf-8'))
    r['seconds'] = round(time.time() - t0, 1)
    r['stderr_errors'] = [l for l in (run.stdout + run.stderr).splitlines() if l.startswith(('ERROR', 'SCRIPT ERROR', 'WARNING'))][:20]
    r['_out'] = str(v / 'out')
    r['job_buttons'] = job['buttons']
    return r


# ---------------------------------------------------------------- judging

def judge_paths(engine: str, profile: U.Profile, js, data, cases, images: dict, extra_na=None) -> list[dict]:
    """images: path name -> {case id: array or None}. Returns one row per (path, case)."""
    rows, cache = [], {}
    plan = U.PROFILES['plan']
    for path, got in images.items():
        for c in cases:
            el = data['elements'][c['element']]
            row = {'engine': engine, 'path': path, 'case': c['id'], 'element': c['element'], 'size': [c['w'], c['h']], 'scale': c['scale'],
                   'label': c['label'], 'modes': list(U.element_modes(el)), 'drawCenter': el.get('drawCenter', True)}
            why = U.supported(profile, el) or (extra_na(c, el) if extra_na else None)
            if why:
                row.update(status='N/A', note=why)
                rows.append(row)
                continue
            actual = got.get(c['id'])
            if actual is None:
                row.update(status='FAIL', note='the engine drew nothing for this case')
                rows.append(row)
                continue
            base, variants = U.expected_for(js, data, c, profile, cache)
            cmp = U.compare(variants, actual)
            _, pv = U.expected_for(js, data, c, plan, cache)
            pc = U.compare(pv, actual)
            row.update(status='PASS' if cmp['ok'] else 'FAIL', stats=cmp, plan={'same': pc['ok'], 'wrong': pc['wrong']})
            rows.append(row)
    return rows


def judge_godot(rep, js, data, cases) -> dict:
    out = {'engine': 'godot', 'version': (rep.get('godot') or {}).get('string'), 'errors': list(rep.get('errors', [])), 'seconds': rep.get('seconds')}
    if not rep.get('paths'):
        out['rows'] = []
        return out
    images = {}
    for path, info in rep['paths'].items():
        png = Path(rep['_out']) / info['png'] if info.get('png') else None
        if not png or not png.exists():
            out['errors'].append(f'{path}: no capture')
            continue
        canvas = U.unpremultiply(U.to_array(png))
        images[path] = {c['id']: crop(canvas, c['slot']) for c in cases}
        if path == 'ninepatch':
            # a Control never shrinks below its minimum size (the patch margins)
            grown = {cid: s for cid, s in info.get('sizes', {}).items() if any(abs(a - b) > 1e-3 for a, b in zip(s, next(c for c in cases if c['id'] == cid)['slot'][2:]))}
            out['ninepatch_grew'] = grown

    def np_na(c, el):
        return None
    rows = judge_paths('godot', U.PROFILES['godot'], js, data, cases, images)
    # NinePatchRect is a Control: below its minimum size it is drawn at the minimum size instead
    for r in rows:
        if r['path'] == 'ninepatch' and r['case'] in out.get('ninepatch_grew', {}):
            r['note'] = f'NinePatchRect grew to its minimum size {out["ninepatch_grew"][r["case"]]} (Control minimum = patch margins)'
            if r['status'] == 'FAIL':
                r['status'] = 'N/A'
    out['rows'] = rows
    # fields read back from the shipped .tres and the helper's resources against the JSON
    fchecks = []
    for src in ('tres_fields', 'helper_fields'):
        for name, f in (rep.get(src) or {}).items():
            el = data['elements'][name]
            L, R, T, B = U.sides(el['nineSlice'])
            want_margin = [L, R, T, B]
            pad = el.get('padding')
            want_content = [pad['left'], pad['right'], pad['top'], pad['bottom']] if pad else want_margin
            axis = {'stretch': 0, 'tile': 1, 'tile-fit': 2}
            mh, mv = U.element_modes(el)
            ok = (f['texture_margin'] == want_margin and f['content_margin'] == want_content and f['axis'] == [axis[mh], axis[mv]]
                  and f['draw_center'] == el.get('drawCenter', True))
            r = el['rect']
            img = data['images'][el['image']]
            if (r['x'], r['y'], r['w'], r['h']) != (0, 0, img['width'], img['height']):
                ok = ok and f['region'] == [r['x'], r['y'], r['w'], r['h']]
            fchecks.append({'source': src.split('_')[0], 'element': name, 'ok': ok, 'fields': f})
    out['field_checks'] = fchecks
    out['buttons'] = judge_godot_buttons(rep, js, data)
    out['stderr_errors'] = rep.get('stderr_errors')
    return out


def _over(dst: np.ndarray, src: np.ndarray) -> np.ndarray:
    d, s = dst.astype(np.float32) / 255, src.astype(np.float32) / 255
    a = s[..., 3:4] + d[..., 3:4] * (1 - s[..., 3:4])
    rgb = np.where(a > 0, (s[..., :3] * s[..., 3:4] + d[..., :3] * d[..., 3:4] * (1 - s[..., 3:4])) / np.maximum(a, 1e-6), 0)
    return np.round(np.concatenate([rgb, a], axis=-1) * 255).astype(np.uint8)


def judge_godot_buttons(rep, js, data) -> list[dict]:
    rows = []
    prof = U.PROFILES['godot']
    for jb in rep.get('job_buttons', []):
        info = (rep.get('buttons') or {}).get(jb['button'])
        if not info:
            continue
        states = data['buttons'][jb['button']]
        for state, st in info['states'].items():
            png = Path(rep['_out']) / st['png']
            if not png.exists():
                rows.append({'button': jb['button'], 'state': state, 'status': 'FAIL', 'note': 'no capture'})
                continue
            got = U.unpremultiply(U.to_array(png))[8:8 + jb['h'], 8:8 + jb['w']]
            case = {'element': states['normal' if state == 'focus' else state], 'w': jb['w'], 'h': jb['h'], 'scale': 1}
            base, variants = U.expected_for(js, data, case, prof)
            if state == 'focus':
                fb, fv = U.expected_for(js, data, {**case, 'element': states['focus']}, prof)
                variants = [_over(v, f) for v, f in zip(variants, fv)]
            if state == 'hover' and not st.get('hovered'):
                rows.append({'button': jb['button'], 'state': state, 'status': 'UNVERIFIED', 'note': 'the pushed mouse event did not hover the button', 'draw_mode': st['draw_mode']})
                continue
            cmp = U.compare(variants, got)
            rows.append({'button': jb['button'], 'state': state, 'size': [jb['w'], jb['h']], 'status': 'PASS' if cmp['ok'] else 'FAIL', 'stats': cmp,
                         'draw_mode': st['draw_mode'], 'minimum_size': st['minimum_size'], 'has_focus': st['has_focus']})
    return rows


# ---------------------------------------------------------------- main

def summarize(res: dict) -> str:
    rows = res.get('rows', [])
    by = {}
    for r in rows:
        by.setdefault(r['path'], {}).setdefault(r['status'], 0)
        by[r['path']][r['status']] += 1
    return '; '.join(f'{p}: ' + ', '.join(f'{k} {v}' for k, v in sorted(s.items())) for p, s in by.items())


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('bundle')
    ap.add_argument('--engines', default=','.join(ALL))
    ap.add_argument('--json')
    ap.add_argument('--work')
    ap.add_argument('--port', type=int, default=4521)
    a = ap.parse_args(argv)
    sys.path.insert(0, str(HERE.parent))
    from ev_common import unpack
    import tempfile
    work = Path(a.work) if a.work else Path(tempfile.mkdtemp(prefix='nerulio-ui-verify-'))
    work.mkdir(parents=True, exist_ok=True)
    bundle = unpack(a.bundle, work / 'bundle')
    js, data = U.load_bundle(bundle)
    bundle = js.parent
    cases = U.cases_for(data)
    canvas = layout(cases)
    results = {}
    log = open(work / 'verify_ui.log', 'w', encoding='utf-8')
    engines = [e for e in a.engines.split(',') if e]
    for eng in engines:
        t0 = time.time()
        if eng == 'godot':
            rep = run_godot(bundle, cases, canvas, data, work, log)
            res = judge_godot(rep, js, data, cases)
        elif eng == 'unity':
            import unity_ui
            res = unity_ui.verify(bundle, js, data, cases, work, log)
        elif eng in ('phaser3', 'phaser4', 'pixi8', 'css'):
            import web_ui
            res = web_ui.verify(eng, bundle, js, data, cases, canvas, work, a.port, log)
        else:
            print(f'unknown engine {eng}')
            continue
        res.setdefault('seconds', round(time.time() - t0, 1))
        results[eng] = res
        print(f'{eng}: {summarize(res)} {res.get("errors") or ""}', flush=True)
        for b in res.get('buttons', []) or []:
            print(f'  button {b.get("button")} {b.get("state")}: {b["status"]} {b.get("stats", {}).get("wrong", "")} {b.get("note", "")}')
        for f in res.get('field_checks', []) or []:
            if not f['ok']:
                print(f'  fields {f["source"]} {f["element"]}: WRONG {f["fields"]}')
    log.close()
    out = {'bundle': str(a.bundle), 'cases': len(cases), 'engines': results}
    if a.json:
        Path(a.json).write_text(json.dumps(out, indent=1, default=str), encoding='utf-8')
    fails = [r for res in results.values() for r in res.get('rows', []) + (res.get('buttons') or []) if r.get('status') == 'FAIL']
    fails += [e for res in results.values() for e in res.get('errors', [])]
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
