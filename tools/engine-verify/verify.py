"""Import an exported asset bundle into real game engines and report field-level results.

    python tools/engine-verify/verify.py <bundle.zip|folder> [--expect expect.json]
        [--engines godot,phaser3,phaser4,pixi8] [--out <dir>] [--port 4441] [--godot <exe>] [--json <report>]

Engines: `godot` (Godot 4 console exe; GODOT_BIN or --godot; opens a small window for a few
seconds because drawing needs a real renderer), `phaser3`, `phaser4`, `pixi8` (the real npm
libraries in Chromium via Playwright; `npm ci --prefix tools/engine-verify/web` once).

Without --expect only what the engine itself reports is recorded (load errors, frame and
animation counts) and the verdict is at best UNVERIFIED: a PASS needs expectations that come from
the original asset (see docs/ENGINE-VERIFY.md and tools/engine-verify/expect_from_corpus.py).

Exit code: 0 when no engine run FAILED, 1 otherwise, 2 on usage errors.
"""
from __future__ import annotations
import argparse, json, shutil, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ev_common import Result, unpack, detect  # noqa: E402
import godot_runner, web_runner, unity_runner, love_runner, defold_runner, file_runners, judge  # noqa: E402

ALL = ['godot', 'phaser3', 'phaser4', 'pixi8', 'unity', 'love', 'defold', 'pillow', 'aseprite']


def _resolve(expect: dict, base: Path) -> dict:
    """Image paths in an expectation file are relative to the file."""
    def fix(p):
        q = Path(p)
        return str(q if q.is_absolute() else (base / q).resolve())
    s = expect.get('sprite')
    if s:
        for f in s.get('frames', []):
            f['image'] = fix(f['image'])
    f = expect.get('font')
    if f and f.get('chars'):
        f['chars'] = {c: fix(p) for c, p in f['chars'].items()}
    t = expect.get('tileset')
    if t and t.get('expectedPaint'):
        t['expectedPaint'] = fix(t['expectedPaint'])
    return expect


def godot_sprite_report(rep: dict) -> dict:
    out = Path(rep['_out'])
    frames, seen, anims = [], {}, {}
    # SpriteFrames.get_animation_names() is alphabetical (row_1, row_10, row_2 ...), so the unique
    # frame list is built over animations in natural order; each animation is judged on its own.
    import re as _re
    natural = lambda k: [int(t) if t.isdigit() else t for t in _re.split(r'(\d+)', k)]
    for name, a in sorted((rep.get('animations') or {}).items(), key=lambda kv: natural(kv[0])):
        steps = []
        for i, f in enumerate(a['frames']):
            png = str(out / f['png']) if f.get('png') else None
            key = (tuple(f.get('region') or []), tuple(f.get('margin') or []))
            if key not in seen:
                seen[key] = f'{name}[{i}]'
                frames.append({'name': seen[key], 'png': png, 'region': f.get('region'), 'sourceSize': f.get('size')})
            steps.append({'name': seen[key], 'png': png, 'durationMs': f['duration'] * 1000.0 / a['speed'] if a.get('speed') else None})
        anims[name] = {'fps': a.get('speed'), 'loop': a.get('loop'), 'frames': steps}
    scaled = None
    sc = rep.get('scaled')
    if sc and sc.get('png') and anims.get(sc['animation']):
        filt = {0: 'inherit (project default: linear)', 1: 'nearest', 2: 'linear'}.get(sc.get('node_filter'), sc.get('node_filter'))
        scaled = {'png': str(out / sc['png']), 'scale': sc['scale'], 'base_png': anims[sc['animation']]['frames'][0]['png'],
                  'note': f'node texture_filter = {filt}; project default filter = {rep.get("project_filter")}'}
    return {'frames': frames, 'animations': anims, 'scaled': scaled}


def run_godot(folder: Path, item: dict, expect: dict, work: Path, godot: str) -> Result:
    res = Result('godot', item['kind'], item.get('json') or item.get('fnt') or item.get('font') or item.get('image') or '')
    if item['kind'] in godot_runner.NOT_GODOT:
        verdict, why = godot_runner.NOT_GODOT[item['kind']]
        if verdict == 'N/A':
            res.na = why
        else:
            res.errors.append(why)
        return res
    job = godot_runner.job_for(item, expect)
    if job is None:
        res.na = f'no Godot check for {item["kind"]}'
        return res
    if not Path(godot).exists():
        res.errors.append(f'UNVERIFIED: no Godot binary at {godot}')
        return res
    project = work / f'godot-{item["kind"]}'
    if project.exists():
        shutil.rmtree(project)
    shutil.copytree(folder, project)
    res.info['version'] = godot_runner.godot_version(godot)
    with open(work / f'godot-{item["kind"]}.log', 'w', encoding='utf-8') as log:
        rep = godot_runner.run_probe(project, godot, job, log)
    if rep is None:
        res.errors.append(f'the Godot probe produced no report (see {work / ("godot-" + item["kind"] + ".log")})')
        return res
    res.info['renderer'] = rep.get('renderer')
    res.errors.extend(rep.get('errors', []))
    if rep.get('_stderr_errors'):
        res.info['engine_errors'] = rep['_stderr_errors']
        # A script error in the probe means part of the report is missing: never a pass.
        res.errors.extend(f'engine: {l}' for l in rep['_stderr_errors'] if l.startswith('SCRIPT ERROR'))
    mode = job['mode']
    if mode == 'spriteframes-tres':
        res.info['page_import'] = rep.get('pages')
        eng = godot_sprite_report(rep)
        res.check('load', bool(eng['animations']), 'a SpriteFrames .tres Godot loads, with animations', f'{len(eng["animations"])} animations')
        judge.judge_sprite(res, eng, expect.get('sprite') or {})
    elif mode == 'spriteframes':
        res.check('helper.verify', not rep.get('helper_problems'), 'the shipped helper finds no mismatch', rep.get('helper_problems'))
        pages = rep.get('pages') or []
        res.info['page_import'] = pages
        eng = godot_sprite_report(rep)
        res.check('load', bool(eng['animations']), 'SpriteFrames with animations', f'{len(eng["animations"])} animations',
                  'the helper builds animations only; an export with no animation gives the engine nothing to play' if not eng['animations'] else '')
        judge.judge_sprite(res, eng, expect.get('sprite') or {})
    elif mode == 'tileset':
        res.info['importer_log'] = rep.get('importer_log')
        res.check('importer.problems', not rep.get('importer_problems'), [], rep.get('importer_problems'))
        eng = {'tileset': rep.get('tileset'), 'paint': rep.get('paint')}
        if eng.get('paint') and eng['paint'].get('png'):
            eng['paint']['png'] = str(Path(rep['_out']) / eng['paint']['png'])
        judge.judge_tileset(res, eng, expect.get('tileset') or {}, item.get('data'))
        res.info['tileset'] = {k: v for k, v in (rep.get('tileset') or {}).items() if k != 'tiles'}
    elif mode == 'font':
        res.info['font'] = rep.get('font')
        glyphs = {c: {'has': g['has'], 'png': str(Path(rep['_out']) / g['png']) if g.get('png') else None, 'advance': g.get('advance')}
                  for c, g in (rep.get('glyphs') or {}).items()}
        res.check('load', rep.get('font') is not None, 'a Font resource', (rep.get('font') or {}).get('class'))
        judge.judge_font(res, {'glyphs': glyphs}, expect.get('font') or {})
    elif mode == 'texture':
        res.info['texture'] = rep.get('texture')
        res.check('load', rep.get('texture') is not None, 'Texture2D', (rep.get('texture') or {}).get('class'))
    return res


def run_unity(folder: Path, item: dict, expect: dict, work: Path) -> Result:
    res = Result('unity', item['kind'], item.get('json') or '')
    if item['kind'] != 'nerulio-sprite-unity':
        res.na = f'unity: no check for {item["kind"]} (only the Sprite Lab Unity bundle ships a Unity importer)'
        return res
    if not unity_runner.version():
        res.errors.append(f'UNVERIFIED: no Unity editor at {unity_runner.UNITY}')
        return res
    res.info['version'] = unity_runner.version()
    rep = unity_runner.run_probe(folder, work)
    res.errors.extend(rep.get('errors', []))
    res.info['pages'] = rep.get('pages')
    out = Path(rep.get('_out', work))
    sprites = rep.get('sprites') or []
    for pg in rep.get('pages') or []:
        res.check('import.filter', pg.get('filterMode') == 'Point', 'Point', pg.get('filterMode'))
        res.check('import.compression', pg.get('compression') == 'Uncompressed', 'Uncompressed', pg.get('compression'))
        res.check('import.spriteMode', pg.get('spriteImportMode') == 'Multiple', 'Multiple', pg.get('spriteImportMode'))
    want = {s['name']: s for s in (item.get('data') or {}).get('unity', {}).get('sprites', [])}
    # Unity has no frame order of its own (each Sprite is a sub-asset; LoadAllAssetsAtPath returns
    # them in asset-database order), so order is judged against the export's own sprite list.
    rank = {n: i for i, n in enumerate(want)}
    sprites = sorted(sprites, key=lambda s: rank.get(s['name'], len(rank)))
    bad = [s['name'] for s in sprites if s['name'] in want
           and [round(v, 3) for v in s['rect']] != [want[s['name']]['rect'][k] for k in ('x', 'y', 'width', 'height')]]
    res.check('sprites.rects_vs_export', not bad and bool(sprites), 'Unity sprite rects == exported rects',
              f'{len(sprites) - len(bad)}/{len(sprites)}', f'differ: {bad[:5]}' if bad else '')
    eng = {'frames': [{'name': s['name'], 'png': str(out / s['png']) if s.get('png') else None} for s in sprites], 'animations': {}}
    # AnimationClips built by the shipped importer: SpriteRenderer.m_Sprite keys; the last key only
    # closes the last frame's time, so durations are the gaps between consecutive keys.
    by_name = {f['name']: f['png'] for f in eng['frames']}
    for c in rep.get('clips') or []:
        keys = [k for k in c['keys'] if k['property'] == 'm_Sprite' and k['type'] == 'SpriteRenderer']
        res.info.setdefault('clips', {})[c['name']] = {'keys': len(keys), 'length': c['length'], 'loop': c['loop']}
        steps = [{'name': k['sprite'], 'png': by_name.get(k['sprite']), 'durationMs': (keys[i + 1]['time'] - k['time']) * 1000.0}
                 for i, k in enumerate(keys[:-1])]
        eng['animations'][c['name']] = {'fps': None, 'loop': c['loop'], 'frames': steps}
    sp = dict(expect.get('sprite') or {})
    sp['placement'] = False  # a Unity Sprite is the trimmed rect; alignment lives in the pivot, checked below
    judge.judge_sprite(res, eng, sp)
    # Alignment: a sprite is drawn at (-pivot.x, pivot.y - h) around its transform, so every frame's
    # art must sit at the same place relative to one common anchor as it sat in its source cell.
    if sp.get('frames') and sprites:
        from ev_common import rgba, alpha_bbox
        with_png = [s for s in sprites if s.get('png')]
        want_imgs = [rgba(Path(f['image'])) for f in sp['frames']]
        m = judge._match(want_imgs, [rgba(out / s['png']) for s in with_png], sp.get('tolerance', 2))
        anchors = set()
        for k, i in enumerate(m):
            if i is None:
                continue
            bx, by, _, _ = alpha_bbox(want_imgs[k])
            s = with_png[i]
            anchors.add((round(bx + s['pivotPx'][0], 2), round(by + s['rect'][3] - s['pivotPx'][1], 2)))
        res.check('frames.anchor', len(anchors) == 1, 'one pivot position for every frame, relative to the source cell',
                  f'{len(anchors)} distinct anchors', f'first: {sorted(anchors)[:3]}' if len(anchors) > 1 else '')
    return res


def run_love(folder: Path, item: dict, expect: dict, work: Path) -> Result:
    res = Result('love', item['kind'], item.get('lua') or '')
    if item['kind'] != 'love-quads':
        res.na = f'love: no LÖVE loader for {item["kind"]} (LÖVE has no atlas format; only the Studio LÖVE export ships one)'
        return res
    if not love_runner.version():
        res.errors.append(f'UNVERIFIED: no LÖVE at {love_runner.LOVE}')
        return res
    rep = love_runner.run(folder, item, work, (expect.get('sprite') or {}).get('scale', 4))
    res.info['version'] = rep.get('version')
    res.errors.extend(rep.get('errors', []))
    eng = love_runner.normalise(rep)
    res.check('load', bool(eng['frames']), 'the shipped helper loads the table and draws frames', f'{len(eng["frames"])} frames')
    judge.judge_sprite(res, eng, expect.get('sprite') or {})
    return res


def run_defold(folder: Path, item: dict, expect: dict, work: Path) -> Result:
    res = Result('defold', item['kind'], item.get('file') or '')
    if item['kind'] not in ('defold-atlas', 'defold-tilesource'):
        res.na = f'defold: no Defold check for {item["kind"]}'
        return res
    rep = defold_runner.run(folder, item, work)
    res.info.update({k: rep.get(k) for k in ('version', 'built', 'animations')})
    res.errors.extend(rep.get('errors', []))
    res.check('build', bool(rep.get('built')), 'bob.jar builds the project with this resource', rep.get('built'))
    for name, want in ((expect.get('defold') or {}).get('animations') or {}).items():
        got = (rep.get('animations') or {}).get(name)
        res.check(f'anim[{name}].frames', got is not None and got.get('frames') == want, want, got and got.get('frames'))
    if rep.get('frames'):
        judge.judge_sprite(res, {'frames': rep['frames'], 'animations': rep.get('engine_animations') or {}}, expect.get('sprite') or {})
    return res


def run_file(folder: Path, item: dict, engine: str, expect: dict, work: Path) -> Result:
    res = Result(engine, item['kind'], item.get('file') or item.get('json') or '')
    want = {'pillow': ('anim-gif', 'apng', 'gamemaker-strips'), 'aseprite': ('aseprite-file',)}[engine]
    if item['kind'] not in want:
        res.na = f'{engine}: not a {"/".join(want)} item'
        return res
    if engine == 'aseprite':
        if not file_runners.aseprite_version():
            res.errors.append(f'UNVERIFIED: no Aseprite CLI at {file_runners.ASEPRITE}')
            return res
        rep = file_runners.open_aseprite(folder / item['file'], work / 'aseprite')
        res.info['version'] = rep.get('version')
        res.info['slices'] = rep.get('slices')
    elif item['kind'] == 'gamemaker-strips':
        rep = file_runners.cut_strips(folder, item, work / 'gamemaker')
        res.info['note'] = 'strips cut as GameMaker names them (name_stripN.png); GameMaker itself is not run (UNVERIFIED in the engine)'
    else:
        rep = file_runners.decode_animation(folder / item['file'], work / ('pillow-' + Path(item['file']).stem))
        res.info['format'] = rep.get('format')
    res.errors.extend(rep.get('errors', []))
    res.check('load', bool(rep.get('frames')), 'the file opens with frames', f'{len(rep.get("frames") or [])} frames')
    judge.judge_sprite(res, rep, expect.get('sprite') or {})
    return res


def run_web(folder: Path, item: dict, engine: str, expect: dict, work: Path, port: int, browser) -> Result:
    res = Result(engine, web_runner.loader_for(item, engine) or item['kind'], item.get('json') or item.get('xml') or item.get('fnt') or '')
    if item['kind'] in ('nerulio-tileset-godot', 'image', 'font-file', 'godot-spriteframes-tres', 'love-quads', 'defold-atlas', 'defold-tilesource',
                        'anim-gif', 'apng', 'aseprite-file'):
        res.na = f'{engine}: no standard loader for {item["kind"]}'
        return res
    chars = list((expect.get('font') or {}).get('chars', {}).keys())
    page = web_runner.run(folder, item, engine, work, port, chars=chars, browser=browser)
    res.info['version'] = page.get('version')
    if page.get('na'):
        res.na = page['errors'][0]
        return res
    res.errors.extend(page.get('errors', []))
    if page.get('console'):
        res.info['console'] = page['console']
    if page.get('warnings'):
        res.info['warnings'] = page['warnings']
    eng = web_runner.normalise(page)
    res.check('load', bool(page.get('loaded')), 'the engine loads the bundle', 'loaded' if page.get('loaded') else 'nothing usable')
    if item['kind'].startswith('bmfont'):
        res.info['font'] = page.get('font')
        judge.judge_font(res, eng, expect.get('font') or {})
    else:
        res.info['frames'] = len(eng['frames'])
        res.info['animations'] = {k: len(v['frames']) for k, v in eng['animations'].items()}
        judge.judge_sprite(res, eng, expect.get('sprite') or {})
    return res


def verify(bundle: str | Path, expect: dict | None = None, engines=ALL, out: Path | None = None, port: int = 4441,
           godot: str = godot_runner.DEFAULT_GODOT, only_kinds=None, browser=None) -> list[Result]:
    out = Path(out or tempfile.mkdtemp(prefix='nerulio-verify-'))
    out.mkdir(parents=True, exist_ok=True)
    folder = unpack(bundle, out / 'bundle')
    items = detect(folder)
    expect = expect or {}
    if only_kinds:
        items = [i for i in items if i['kind'] in only_kinds]
    # Loose images are only interesting when nothing else is in the bundle or a texture check is asked for.
    if any(i['kind'] != 'image' for i in items) and not expect.get('texture'):
        items = [i for i in items if i['kind'] != 'image']
    results = []
    for n, item in enumerate(items):
        for engine in engines:
            work = out / f'{n:02d}-{item["kind"]}'
            work.mkdir(exist_ok=True)
            try:
                r = (run_godot(folder, item, expect, work, godot) if engine == 'godot' else run_unity(folder, item, expect, work) if engine == 'unity'
                     else run_love(folder, item, expect, work) if engine == 'love' else run_defold(folder, item, expect, work)
                     if engine == 'defold' else run_file(folder, item, engine, expect, work) if engine in ('pillow', 'aseprite')
                     else run_web(folder, item, engine, expect, work, port, browser))
            except Exception as e:  # a harness crash is a FAIL with the reason, never a silent pass
                r = Result(engine, item['kind'], str(bundle)); r.errors.append(f'harness error: {type(e).__name__}: {e}')
            r.info['kind'] = item['kind']
            results.append(r)
    if not items:
        r = Result('-', '-', str(bundle)); r.errors.append('nothing loadable detected in the bundle'); results.append(r)
    return results


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('bundle')
    ap.add_argument('--expect')
    ap.add_argument('--engines', default=','.join(ALL))
    ap.add_argument('--out')
    ap.add_argument('--port', type=int, default=4441)
    ap.add_argument('--godot', default=godot_runner.DEFAULT_GODOT)
    ap.add_argument('--json')
    a = ap.parse_args()
    expect = None
    if a.expect:
        expect = _resolve(json.loads(Path(a.expect).read_text(encoding='utf-8')), Path(a.expect).resolve().parent)
    results = verify(a.bundle, expect, [e for e in a.engines.split(',') if e], Path(a.out) if a.out else None, a.port, a.godot)
    for r in results:
        print(f'{r.status:10} {r.engine:8} {r.info.get("kind", ""):24} {r.bundle}')
        for c in r.checks:
            mark = {True: 'ok  ', False: 'FAIL', None: 'n/a '}[c.ok]
            print(f'    {mark} {c.field}: {c.actual!r}' + (f'  (expected {c.expected!r})' if c.ok is False else '') + (f'  - {c.note}' if c.note else ''))
        for e in r.errors:
            print(f'    ERROR {e}')
        if r.na:
            print(f'    n/a  {r.na}')
    if a.json:
        Path(a.json).write_text(json.dumps([r.as_dict() for r in results], indent=1, default=str), encoding='utf-8')
    return 1 if any(r.status == 'FAIL' for r in results) else 0


if __name__ == '__main__':
    sys.exit(main())
