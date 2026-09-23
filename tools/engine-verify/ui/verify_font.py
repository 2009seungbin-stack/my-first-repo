"""Font verification of a Nerulio font export in real engines.

    python tools/engine-verify/ui/verify_font.py <bundle folder|zip> [--engines godot,unity,phaser3,phaser4,pixi8]
                                                 [--font font.ttf] [--json out.json] [--work dir] [--port 4521]

A bundle holds one or more fonts (a folder of folders is fine), each as any of:
  msdf-atlas-gen JSON + PNG (atlas.type sdf|psdf|msdf|mtsdf|hardmask|softmask)
  BMFont text .fnt / XML .xml (or XML under .fnt) / binary .fnt, with its PNG page(s)
The outline truth is --font, else `ttf` in a source.json beside the files (make_font_refs.py).

What each engine loads (the standard path, or the helper the Studio ships):
  godot    JSON through helpers/nerulio_font_import.gd (FontFile, MSDF or bitmap); every .fnt
           through Godot's own importer (text, binary, XML-in-.fnt)
  unity    JSON (sdf, psdf, mtsdf alpha, hardmask) through helpers/NerulioTMPFontImporter.cs -> TMP_FontAsset
  phaser*  XML BMFont through load.bitmapFont (bitmap fonts only: Phaser draws a field as a picture)
  pixi8    text and XML BMFont through Assets.load (with distanceField for fields)

Every character is drawn at several sizes (fields: 0.5x, 1x, 3x and 4x the atlas size; bitmaps: 1x
and 2x) and compared as a coverage mask (alpha >= 128):
  * against the exact outline of the TTF (outline_ref.py) - `wrong%` = XOR pixels / outline ink
    pixels, after one common alignment per font and size (the engine's baseline convention) with
    at most 1 px of per-glyph jitter;
  * for bitmap fonts, also against the glyph bitmap in the file itself, which must be PIXEL EXACT.
Kerning: for each pair the ink width of the pair is compared with the width the file's own advance
and kerning give, and with the width without the kerning.

PASS rules: bitmap vs its file bitmap exact; a field's mean wrong% <= FIELD_LIMIT at every size and
no glyph above GLYPH_LIMIT; every character present; kerning applied when the file has it.
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
import font_formats as F  # noqa: E402
import outline_ref as O  # noqa: E402

GODOT = __import__('os').environ.get('GODOT_BIN', r'C:\Users\2009s\Desktop\Godot_v4.7.2-stable_win64_console.exe')
FIELD_LIMIT = 6.0     # mean wrong % against the outline for a distance field, per size
GLYPH_LIMIT = 25.0    # worst single glyph, % of its ink
FIELDS = ('sdf', 'psdf', 'msdf', 'mtsdf')


# ---------------------------------------------------------------- bundle

def find_fonts(root: Path, ttf: str | None) -> list[dict]:
    fonts = []
    for folder in sorted({p.parent for p in root.rglob('*') if p.suffix.lower() in ('.json', '.fnt', '.xml')}):
        src = folder / 'source.json'
        meta = json.loads(src.read_text(encoding='utf-8')) if src.exists() else {}
        for js in sorted(folder.glob('*.json')):
            try:
                d = F.load_atlas_json(js)
            except Exception:
                continue
            png = js.with_suffix('.png')
            fonts.append({'id': js.stem, 'folder': folder, 'json': js, 'png': png if png.exists() else None, 'type': d['atlas']['type'],
                          'size': d['atlas']['size'], 'data': d, 'ttf': ttf or meta.get('ttf'), 'chars': meta.get('chars'), 'bmfonts': []})
        for p in sorted(list(folder.glob('*.fnt')) + list(folder.glob('*.xml'))):
            try:
                bm = F.read_bmfont(p)
            except Exception:
                continue
            raw = p.read_bytes()
            fmt = 'binary' if raw.startswith(b'BMF') else ('xml' if raw.lstrip().startswith(b'<') else 'text')
            owner = next((f for f in fonts if f['folder'] == folder and p.name.startswith(f['id'])), None)
            entry = {'path': p, 'format': fmt, 'font': bm, 'ext': p.suffix.lower()}
            if owner:
                owner['bmfonts'].append(entry)
            else:
                fonts.append({'id': p.name.split('.')[0].replace('-xml', ''), 'folder': folder, 'json': None, 'png': None, 'data': None,
                              'type': bm['distanceField']['fieldType'] if bm.get('distanceField') else 'bitmap-bmfont',
                              'size': int(bm['info'].get('size', 16)), 'ttf': ttf or meta.get('ttf'), 'chars': meta.get('chars'), 'bmfonts': [entry]})
    # one font per id (BMFont files of a JSON-less font are merged)
    merged = {}
    for f in fonts:
        if f['id'] in merged and not f['json']:
            merged[f['id']]['bmfonts'] += f['bmfonts']
        else:
            merged.setdefault(f['id'], f)
    return list(merged.values())


def font_chars(f: dict) -> list[str]:
    if f.get('chars'):
        return [c for c in dict.fromkeys(f['chars']) if c.strip()]
    if f['data']:
        return [chr(g['unicode']) for g in f['data']['glyphs'] if chr(g['unicode']).strip()]
    bm = f['bmfonts'][0]['font']
    return [chr(c['id']) for c in bm['chars'] if 0x21 <= c['id'] < 0x7f]


def font_pairs(f: dict) -> list[str]:
    if f['data'] and f['data'].get('kerning'):
        return [chr(k['unicode1']) + chr(k['unicode2']) for k in f['data']['kerning']][:6]
    if f['bmfonts'] and f['bmfonts'][0]['font']['kernings']:
        return [chr(k['first']) + chr(k['second']) for k in f['bmfonts'][0]['font']['kernings']][:6]
    return []


def sizes_for(f: dict) -> list[int]:
    S = int(f['size'])
    return [S // 2, S, 3 * S, 4 * S] if f['type'] in FIELDS else [S, 2 * S]


# ---------------------------------------------------------------- truth

def file_bitmap(f: dict, ch: str) -> tuple[np.ndarray, tuple[int, int]] | None:
    """Glyph bitmap from the BMFont file itself (alpha, pen-relative origin like outline_ref)."""
    if not f['bmfonts']:
        return None
    e = next((b for b in f['bmfonts'] if b['format'] == 'text'), f['bmfonts'][0])
    bm = e['font']
    c = next((c for c in bm['chars'] if c['id'] == ord(ch)), None)
    if not c or not c['width']:
        return None
    page = Image.open(e['path'].parent / bm['pages'][c['page']]).convert('RGBA')
    a = np.asarray(page.crop((c['x'], c['y'], c['x'] + c['width'], c['y'] + c['height'])))[..., 3].astype(np.float32) / 255
    base = bm['common']['base']
    return a, (-c['xoffset'], base - c['yoffset'])


def ref_mask(f: dict, ch: str, sz: int, truth: str):
    if truth == 'file':
        fb = file_bitmap(f, ch)
        if fb is None:
            return None
        a, (ox, oy) = fb
        k = sz // int(f['size'])
        if k < 1 or k * int(f['size']) != sz:
            return None
        big = np.kron(a, np.ones((k, k)))
        return big >= 0.5, (ox * k, oy * k)
    cov, o = O.glyph_coverage(f['ttf'], ch, sz)
    return cov >= 0.5, o


def _place(mask, origin, pen, shape):
    out = np.zeros(shape, dtype=bool)
    x0, y0 = int(round(pen[0])) - origin[0], int(round(pen[1])) - origin[1]
    h, w = mask.shape
    sx0, sy0 = max(0, -x0), max(0, -y0)
    dx0, dy0 = max(0, x0), max(0, y0)
    dx1, dy1 = min(shape[1], x0 + w), min(shape[0], y0 + h)
    if dx1 > dx0 and dy1 > dy0:
        out[dy0:dy1, dx0:dx1] = mask[sy0:sy0 + dy1 - dy0, sx0:sx0 + dx1 - dx0]
    return out


def _shifted(m, dx, dy):
    out = np.zeros_like(m)
    h, w = m.shape
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = m[ys, xs]
    return out


def judge_glyphs(f, slots, canvas, sz, truth, search) -> dict:
    """slots: [{text, pen:[x,y], box:[x,y,w,h]}]. Returns per-glyph wrong% at one common shift."""
    alpha = canvas[..., 3] >= 128
    per, cand = [], []
    for s in slots:
        if len(s['text']) != 1:
            continue
        r = ref_mask(f, s['text'], sz, truth)
        if r is None:
            continue
        x, y, w, h = s['box']
        eng = alpha[y:y + h, x:x + w]
        ref = _place(r[0], r[1], (s['pen'][0] - x, s['pen'][1] - y), eng.shape)
        ink = int(ref.sum())
        if ink == 0:
            continue
        best = min(((int((_shifted(ref, dx, dy) ^ eng).sum()), dx, dy) for dx in range(-search, search + 1) for dy in range(-search, search + 1)))
        cand.append((best[1], best[2]))
        per.append({'ch': s['text'], 'ref': ref, 'eng': eng, 'ink': ink})
    if not per:
        return {'glyphs': 0}
    mx = int(np.median([c[0] for c in cand]))
    my = int(np.median([c[1] for c in cand]))
    rows, exact = [], 0
    for p in per:
        errs = [(int((_shifted(p['ref'], mx + dx, my + dy) ^ p['eng']).sum()), dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
        e0 = int((_shifted(p['ref'], mx, my) ^ p['eng']).sum())
        best = min(errs)
        exact += e0 == 0
        rows.append({'ch': p['ch'], 'wrong': best[0], 'wrongAtCommon': e0, 'ink': p['ink'], 'pct': round(100 * best[0] / p['ink'], 2), 'jitter': [best[1], best[2]]})
    pcts = [r['pct'] for r in rows]
    worst = sorted(rows, key=lambda r: -r['pct'])[:5]
    return {'glyphs': len(rows), 'shift': [mx, my], 'meanPct': round(float(np.mean(pcts)), 2), 'maxPct': max(pcts), 'exactAtCommonShift': exact,
            'worst': [{k: r[k] for k in ('ch', 'pct', 'wrong', 'ink', 'jitter')} for r in worst]}


def judge_pairs(f, slots, canvas, sz, fmt) -> list[dict]:
    """Kerning: the pair's ink width against the file's own advance + kerning (see module doc)."""
    if not f.get('ttf'):
        return []
    alpha = canvas[..., 3] >= 128
    out = []
    kern = {}
    if fmt == 'json' and f['data']:
        S = f['data']['atlas']['size']
        adv = {g['unicode']: g['advance'] * S for g in f['data']['glyphs']}
        kern = {(k['unicode1'], k['unicode2']): k['advance'] * S for k in f['data'].get('kerning', [])}
        base = S
    else:
        bm = f['bmfonts'][0]['font']
        adv = {c['id']: c['xadvance'] for c in bm['chars']}
        kern = {(k['first'], k['second']): k['amount'] for k in bm['kernings']}
        base = int(bm['info'].get('size', f['size']))
    k = sz / base
    for s in slots:
        if len(s['text']) != 2:
            continue
        a, b = s['text']
        x, y, w, h = s['box']
        cols = np.nonzero(alpha[y:y + h, x:x + w].any(axis=0))[0]
        if cols.size == 0:
            out.append({'pair': s['text'], 'ok': False, 'note': 'nothing drawn'})
            continue
        measured = int(cols[-1] - cols[0] + 1)
        ca, oa = O.glyph_coverage(f['ttf'], a, sz)
        cb, ob = O.glyph_coverage(f['ttf'], b, sz)
        la = np.nonzero((ca >= 0.5).any(axis=0))[0][0] - oa[0]
        rb = np.nonzero((cb >= 0.5).any(axis=0))[0][-1] - ob[0] + 1
        kv = kern.get((ord(a), ord(b)), 0)
        with_k = adv[ord(a)] * k + kv * k + rb - la
        without = adv[ord(a)] * k + rb - la
        applied = abs(measured - with_k) <= 1.5 and (kv == 0 or abs(measured - with_k) < abs(measured - without))
        out.append({'pair': s['text'], 'kerningPx': round(kv * k, 2), 'measured': measured, 'expectedWith': round(with_k, 2), 'expectedWithout': round(without, 2),
                    'ok': bool(applied)})
    return out


# ---------------------------------------------------------------- Godot

PROJECT = '''config_version=5

[application]

config/name="nerulio-font-verify"
config/features=PackedStringArray("4.4")

[display]

window/size/viewport_width=64
window/size/viewport_height=64
window/size/borderless=true

[rendering]

renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
'''


def godot_runs(fonts) -> list[dict]:
    runs = []
    for f in fonts:
        field = f['type'] in FIELDS
        if f['json']:
            runs.append({'font': f, 'via': 'helper', 'format': 'json', 'file': f['json']})
        for b in f['bmfonts']:
            if b['ext'] == '.fnt':
                runs.append({'font': f, 'via': 'import', 'format': b['format'], 'file': b['path']})
        for r in runs:
            r.setdefault('filter', 'linear' if r['font']['type'] in FIELDS else 'nearest')
    return runs


def run_godot(bundle: Path, fonts, work: Path, log) -> dict:
    proj = work / 'godot-font-proj'
    if proj.exists():
        shutil.rmtree(proj)
    shutil.copytree(bundle, proj / 'bundle')
    (proj / 'project.godot').write_text(PROJECT, encoding='utf-8')
    v = proj / '_verify'
    v.mkdir()
    shutil.copy2(HERE / 'godot' / 'font_probe.gd', v / 'font_probe.gd')
    helper = proj / 'bundle' / 'nerulio_font_import.gd'
    shipped = next(iter(bundle.rglob('nerulio_font_import.gd')), None)
    if shipped is None:
        shutil.copy2(HERE / 'helpers' / 'nerulio_font_import.gd', helper)
        helper_note = 'the bundle ships no nerulio_font_import.gd: the verifier used helpers/nerulio_font_import.gd'
    else:
        helper = proj / 'bundle' / shipped.relative_to(bundle)
        helper_note = None
    res = lambda p: 'res://bundle/' + Path(p).relative_to(bundle).as_posix()
    runs = godot_runs(fonts)
    job = {'helper': 'res://' + helper.relative_to(proj).as_posix(), 'fonts': []}
    for i, r in enumerate(runs):
        f = r['font']
        r['rid'] = f'{f["id"]}__{r["via"]}_{r["format"]}_{i}'
        job['fonts'].append({'id': r['rid'], 'via': r['via'], 'path': res(r['file']), 'chars': font_chars(f), 'pairs': font_pairs(f),
                             'sizes': sizes_for(f), 'filter': r['filter'], 'sample': 'Hello 새 게임' if any(ord(c) > 0xAC00 for c in font_chars(f)) else 'Hello, World'})
    (v / 'job.json').write_text(json.dumps(job, ensure_ascii=False), encoding='utf-8')
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    t0 = time.time()
    imp = subprocess.run([GODOT, '--headless', '--path', str(proj), '--import'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900, creationflags=flags)
    log.write(f'$ godot --import (exit {imp.returncode})\n{imp.stdout[-3000:]}\n{imp.stderr[-3000:]}\n')
    run = subprocess.run([GODOT, '--path', str(proj), '--script', 'res://_verify/font_probe.gd', '--rendering-driver', 'opengl3',
                          '--window-position', '0,0', '--resolution', '64x64'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900, creationflags=flags)
    log.write(f'$ godot font_probe (exit {run.returncode})\n{run.stdout[-6000:]}\n{run.stderr[-6000:]}\n')
    rep_path = v / 'out' / 'report.json'
    out = {'engine': 'godot', 'seconds': round(time.time() - t0, 1), 'errors': [], 'rows': [], 'notes': [helper_note] if helper_note else []}
    if not rep_path.exists():
        out['errors'].append('the Godot font probe wrote no report; see the log')
        return out
    rep = json.loads(rep_path.read_text(encoding='utf-8'))
    out['version'] = rep['godot'].get('string')
    out['errors'] += rep.get('errors', [])
    out['stderr'] = [l for l in (run.stdout + run.stderr).splitlines() if l.startswith(('ERROR', 'SCRIPT ERROR'))][:15]
    for r in runs:
        info = rep['fonts'].get(r['rid'], {})
        out['rows'].append(judge_run('godot', r, info, v / 'out', premultiplied=True))
    return out


def judge_run(engine, r, info, outdir: Path, premultiplied: bool) -> dict:
    f = r['font']
    row = {'engine': engine, 'font': f['id'], 'type': f['type'], 'via': r['via'], 'format': r['format'], 'file': Path(r['file']).name}
    if info.get('error') or not info.get('sizes'):
        row.update(status='FAIL', note=info.get('error', 'nothing rendered'), info=info)
        return row
    row['engineInfo'] = {k: v for k, v in info.items() if k not in ('sizes', 'helper_log')}
    missing = info.get('missing') or []
    sizes, ok = {}, not missing
    truths = []
    if f['type'] in ('hardmask', 'softmask', 'bitmap-bmfont') and f['bmfonts']:
        truths.append('file')
    if f.get('ttf'):
        truths.append('outline')
    for sz, s in info['sizes'].items():
        sz = int(sz)
        canvas = U.to_array(outdir / s['png'])
        if premultiplied:
            canvas = U.unpremultiply(canvas)
        e = {}
        for t in truths:
            j = judge_glyphs(f, s['slots'], canvas, sz, t, search=max(3, sz // 3))
            if not j.get('glyphs'):
                continue
            e[t] = j
            if t == 'file' and j['exactAtCommonShift'] != j['glyphs']:
                ok = False
            if t == 'outline' and f['type'] in FIELDS and (j['meanPct'] > FIELD_LIMIT or j['maxPct'] > GLYPH_LIMIT):
                ok = False
        pairs = judge_pairs(f, s['slots'], canvas, sz, 'json' if r['format'] == 'json' else 'bmfont')
        if pairs:
            e['kerning'] = pairs
            if not all(p['ok'] for p in pairs):
                ok = False
        sizes[sz] = e
    row['sizes'] = sizes
    row['missing'] = missing
    row['status'] = 'PASS' if ok else 'FAIL'
    return row


# ---------------------------------------------------------------- main

def summarize(row) -> str:
    parts = []
    for sz, e in row.get('sizes', {}).items():
        bits = []
        if 'file' in e:
            bits.append(f'file {e["file"]["exactAtCommonShift"]}/{e["file"]["glyphs"]} exact')
        if 'outline' in e:
            bits.append(f'outline {e["outline"]["meanPct"]}% (max {e["outline"]["maxPct"]}% {e["outline"]["worst"][0]["ch"]})')
        if 'kerning' in e:
            bits.append('kern ' + ','.join(f'{p["pair"]}:{"ok" if p["ok"] else "NO"}' for p in e['kerning']))
        parts.append(f'{sz}px ' + ' '.join(bits))
    return '; '.join(parts)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('bundle')
    ap.add_argument('--engines', default='godot,unity,phaser3,phaser4,pixi8')
    ap.add_argument('--font')
    ap.add_argument('--json')
    ap.add_argument('--work')
    ap.add_argument('--port', type=int, default=4521)
    ap.add_argument('--only', help='comma list of font ids')
    a = ap.parse_args(argv)
    from ev_common import unpack
    import tempfile
    work = Path(a.work) if a.work else Path(tempfile.mkdtemp(prefix='nerulio-font-verify-'))
    work.mkdir(parents=True, exist_ok=True)
    bundle = unpack(a.bundle, work / 'bundle')
    fonts = find_fonts(bundle, a.font)
    if a.only:
        fonts = [f for f in fonts if f['id'] in a.only.split(',')]
    print('fonts:', ', '.join(f'{f["id"]} ({f["type"]}, {len(f["bmfonts"])} BMFont file(s))' for f in fonts))
    log = open(work / 'verify_font.log', 'w', encoding='utf-8')
    results = {}
    for eng in [e for e in a.engines.split(',') if e]:
        if eng == 'godot':
            res = run_godot(bundle, fonts, work, log)
        elif eng == 'unity':
            import unity_font
            res = unity_font.verify(bundle, fonts, work, log)
        elif eng in ('phaser3', 'phaser4', 'pixi8'):
            import web_font
            res = web_font.verify(eng, bundle, fonts, work, a.port, log)
        else:
            continue
        results[eng] = res
        print(f'== {eng} {res.get("version") or ""} {res.get("errors") or ""}', flush=True)
        for r in res['rows']:
            print(f'  {r["status"]:10} {r["font"]:10} {r["via"]:7} {r["format"]:7} {r.get("file", ""):18} {r.get("note", "") or summarize(r)}', flush=True)
    log.close()
    if a.json:
        Path(a.json).write_text(json.dumps({'bundle': str(a.bundle), 'engines': results}, indent=1, default=str, ensure_ascii=False), encoding='utf-8')
    return 1 if any(r['status'] == 'FAIL' for res in results.values() for r in res['rows']) or any(res.get('errors') for res in results.values()) else 0


if __name__ == '__main__':
    sys.exit(main())
