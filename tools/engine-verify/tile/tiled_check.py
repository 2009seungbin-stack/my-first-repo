"""Tiled check for Studio Tile exports (tiled/<name>.tsx + sample.tmx + PNG).

Everything that matters is read back THROUGH TILED ITSELF (Tiled 1.12.x, portable, in
%LOCALAPPDATA%/nerulio-engine-verify/tiled or TILED_DIR):

  1. `tiled --export-tileset json <tsx>`  Tiled's own parse of the tileset: tile size, margin,
     spacing, the Wang set type, its colours and every tile's wangid. Compared with the Studio
     model (model.json) tile by tile: the wangid Tiled read must be exactly the pattern the Studio
     meant (terrain+1 per position, 0 = no colour; positions the set type ignores are 0).
  2. `tiled --export-map json <tmx>`       Tiled's own parse of the sample map (gids, layer offset).
     The placed map is then checked for a valid Wang tiling in Tiled's model: tiles that share an
     edge or a corner point must carry the same colour there, and a face that touches an empty cell
     must be 0. For corner sets (dual grid) the colours live on grid points shared by 4 tiles.
  3. `tmxrasterizer <tmx> <png>`          Tiled's renderer draws the sample map; compared pixel for
     pixel with an independent Pillow render of the same TMX/TSX (gid → atlas rect with margin and
     spacing, layer offset), so a wrong tile id / margin / spacing / offset shows up as pixels.

Tiled 1.12's `--evaluate` script mode exits 0 without running the script on this Windows build
(no output, no side effects), so the checks use Tiled's command-line exporters instead.

    python tools/engine-verify/tile/tiled_check.py <asset dir> [...]
"""
from __future__ import annotations
import json, os, subprocess, sys, xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image

TILED_DIR = Path(os.environ.get('TILED_DIR', Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'nerulio-engine-verify' / 'tiled' / 'app' / 'PFiles' / 'Tiled'))
TILED = TILED_DIR / 'tiled.exe'
HERE = Path(__file__).resolve().parent
RASTER = TILED_DIR / 'tmxrasterizer.exe'
MODE_KEEP = {'mixed': range(8), 'edge': (0, 2, 4, 6), 'corner': (1, 3, 5, 7)}
STUDIO_TYPE = {'corners-and-sides': 'mixed', 'sides': 'edge', 'corners': 'corner'}
FLIP_MASK = 0x1FFFFFFF


def version() -> str | None:
    news = TILED_DIR / 'NEWS.txt'
    if not TILED.exists():
        return None
    first = news.read_text(encoding='utf-8', errors='replace').splitlines()[0] if news.exists() else ''
    return first.strip('# ').strip() or 'unknown'


def _run(exe: Path, args: list[str], timeout=120) -> int:
    p = subprocess.run([str(exe), *args], capture_output=True, text=True, timeout=timeout,
                       creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    return p.returncode


def _expected_wangid(pattern: list[int], wtype: str) -> list[int]:
    keep = set(MODE_KEEP[wtype])
    return [pattern[i + 1] + 1 if i in keep and pattern[i + 1] >= 0 else 0 for i in range(8)]


def _consistency(W: int, H: int, tile_at, wang_of, wtype: str, wild=frozenset()) -> list[str]:
    """Wang tiling validity in Tiled's model. wangid order: top, top-right, right, bottom-right,
    bottom, bottom-left, left, top-left."""
    problems = []

    WILD = 'wild'

    def w(x, y):
        if (x, y) in wild:
            return WILD  # a cell the Studio itself reports as a gap: anything may face it
        t = tile_at(x, y)
        return None if t is None else wang_of(t)
    for y in range(H):
        for x in range(W):
            a = w(x, y)
            if a is None or a is WILD:
                continue
            # edges: right and bottom neighbours (each shared edge once); left/top empty → 0
            for (dx, dy, mine, theirs) in ((1, 0, 2, 6), (0, 1, 4, 0), (-1, 0, 6, 2), (0, -1, 0, 4)):
                b = w(x + dx, y + dy)
                if b is WILD:
                    continue
                if b is None:
                    if wtype != 'corner' and a[mine] != 0:
                        problems.append(f'{x},{y}: edge {mine} = {a[mine]} next to an empty cell')
                elif (dx, dy) in ((1, 0), (0, 1)) and wtype != 'corner' and a[mine] != b[theirs]:
                    problems.append(f'{x},{y}: edge {mine}={a[mine]} vs neighbour {theirs}={b[theirs]}')
            if wtype == 'edge':
                continue
            # corner points: top-right point of (x,y) is shared by (x,y)TR, (x+1,y)TL, (x,y-1)BR, (x+1,y-1)BL
            for (px, py) in ((x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)):
                # point (px,py) is the top-left corner of cell (px,py)
                shares = ((px - 1, py - 1, 3), (px, py - 1, 5), (px - 1, py, 1), (px, py, 7))
                vals = []
                for cx, cy, pos in shares:
                    t = w(cx, cy)
                    if t is WILD:
                        vals = None
                        break
                    vals.append(None if t is None else t[pos])
                if vals is None:
                    continue
                present = [v for v in vals if v is not None]
                if wtype == 'corner':
                    # an empty dual tile has no colours: every present tile must agree
                    if len(set(present)) > 1:
                        problems.append(f'point {px},{py}: corner colours {vals}')
                else:
                    # mixed (cell based): a corner next to any empty cell must be 0; otherwise all equal
                    if None in vals and any(v != 0 for v in present):
                        problems.append(f'point {px},{py}: corner colours {vals} next to an empty cell')
                    elif None not in vals and len(set(vals)) > 1:
                        problems.append(f'point {px},{py}: corner colours {vals}')
    return sorted(set(problems))


def _render(tmx_json: dict, ts_json: dict, atlas: Image.Image) -> tuple[Image.Image, tuple[int, int]]:
    tw, th = tmx_json['tilewidth'], tmx_json['tileheight']
    W, H = tmx_json['width'], tmx_json['height']
    lay = [l for l in tmx_json['layers'] if l['type'] == 'tilelayer'][0]
    ox, oy = int(lay.get('offsetx', 0)), int(lay.get('offsety', 0))
    cols, m, s = ts_json['columns'], ts_json['margin'], ts_json['spacing']
    firstgid = tmx_json['tilesets'][0]['firstgid']
    # canvas covering everything drawn, origin at the map's (0,0) moved by min offset
    x0, y0 = min(0, ox), min(0, oy)
    out = Image.new('RGBA', (W * tw + max(0, ox) - x0, H * th + max(0, oy) - y0), (0, 0, 0, 0))
    for i, gid in enumerate(lay['data']):
        gid &= FLIP_MASK
        if not gid:
            continue
        t = gid - firstgid
        sx, sy = m + (t % cols) * (tw + s), m + (t // cols) * (th + s)
        tile = atlas.crop((sx, sy, sx + tw, sy + th))
        out.alpha_composite(tile, ((i % W) * tw + ox - x0, (i // W) * th + oy - y0))
    return out, (x0, y0)


def _compare(a: Image.Image, b: Image.Image) -> dict:
    if a.size != b.size:
        return {'ok': False, 'why': f'size {a.size} vs {b.size}'}
    pa, pb = a.tobytes(), b.tobytes()
    diff = worst = 0
    for i in range(0, len(pa), 4):
        if pa[i + 3] == 0 and pb[i + 3] == 0:
            continue
        d = max(abs(pa[i + k] - pb[i + k]) for k in range(4))
        tol = 0 if pa[i + 3] == 255 and pb[i + 3] == 255 else 2  # Qt paints premultiplied: ±2 on translucent texels
        if d > tol:
            diff += 1
            worst = max(worst, d)
    return {'ok': diff == 0, 'differing': diff, 'maxDelta': worst, 'pixels': a.size[0] * a.size[1]}


def check(asset_dir) -> dict:
    d = Path(asset_dir)
    t = d / 'tiled'
    if not TILED.exists() or not RASTER.exists():
        return {'verdict': 'UNVERIFIED', 'summary': f'Tiled not found at {TILED_DIR}', 'details': {}}
    tsx = next(t.glob('*.tsx'))
    tmx = t / 'sample.tmx'
    work = d / '_tiled'
    work.mkdir(exist_ok=True)
    details: dict = {'tiled': version()}
    fails = []
    # 1. tileset through Tiled
    ts_out = work / 'tileset.json'
    ts_out.unlink(missing_ok=True)
    rc = _run(TILED, ['--export-tileset', 'json', str(tsx), str(ts_out)])
    if rc != 0 or not ts_out.exists():
        return {'verdict': 'FAIL', 'summary': f'Tiled could not load {tsx.name} (exit {rc})', 'details': details}
    ts_json = json.loads(ts_out.read_text(encoding='utf-8'))
    model = json.loads((d / 'model.json').read_text(encoding='utf-8'))
    g = model['grid']
    want_type = STUDIO_TYPE[model['mode']]
    ws = ts_json.get('wangsets') or []
    details['tileset'] = {'tilewidth': ts_json['tilewidth'], 'tileheight': ts_json['tileheight'], 'margin': ts_json['margin'],
                          'spacing': ts_json['spacing'], 'columns': ts_json['columns'], 'wangsets': len(ws),
                          'type': ws[0]['type'] if ws else None, 'colors': len(ws[0]['colors']) if ws else 0}
    for k, v in (('tilewidth', g['w']), ('tileheight', g['h']), ('margin', g['ox']), ('spacing', g['sx']), ('columns', g['cols'])):
        if ts_json[k] != v:
            fails.append(f'tileset.{k}: Tiled read {ts_json[k]}, model {v}')
    if not ws:
        fails.append('Tiled read no Wang set')
        return {'verdict': 'FAIL', 'summary': '; '.join(fails), 'details': details}
    if ws[0]['type'] != want_type:
        fails.append(f'wangset type {ws[0]["type"]} (want {want_type})')
    if len(ws[0]['colors']) != len(model['terrains']):
        fails.append(f'{len(ws[0]["colors"])} colours (want {len(model["terrains"])})')
    tiled_wang = {wt['tileid']: wt['wangid'] for wt in ws[0]['wangtiles']}
    compared = bad = 0
    for key, v in model['tiles'].items():
        p = v['pattern']
        if p[0] < 0:
            continue
        c, r = map(int, key.split(','))
        tid = r * g['cols'] + c
        compared += 1
        exp = _expected_wangid(p, want_type)
        if tid not in tiled_wang and exp == [0] * 8:
            continue  # Tiled drops all-zero Wang IDs (reported below as allZeroDropped)
        if tiled_wang.get(tid) != exp:
            bad += 1
            if bad <= 5:
                fails.append(f'tile {tid} ({key}): Tiled wangid {tiled_wang.get(tid)} vs Studio {_expected_wangid(p, want_type)}')
    details['wangids'] = {'compared': compared, 'differ': bad, 'extraInTiled': len(set(tiled_wang) - {int(k.split(",")[1]) * g["cols"] + int(k.split(",")[0]) for k in model['tiles']})}
    # 2. map through Tiled, then Wang-tiling consistency on what Tiled read
    map_out = work / 'map.json'
    map_out.unlink(missing_ok=True)
    rc = _run(TILED, ['--export-map', 'json', str(tmx), str(map_out)])
    if rc != 0 or not map_out.exists():
        fails.append(f'Tiled could not load sample.tmx (exit {rc})')
        return {'verdict': 'FAIL', 'summary': '; '.join(fails), 'details': details}
    tmx_json = json.loads(map_out.read_text(encoding='utf-8'))
    lay = [l for l in tmx_json['layers'] if l['type'] == 'tilelayer'][0]
    W, H, firstgid = tmx_json['width'], tmx_json['height'], tmx_json['tilesets'][0]['firstgid']
    data = [gid & FLIP_MASK for gid in lay['data']]
    placed = sum(1 for gid in data if gid)
    no_wang = sorted({gid - firstgid for gid in data if gid and (gid - firstgid) not in tiled_wang})
    if no_wang:
        fails.append(f'placed tiles without Wang data: {no_wang[:8]}')
    tile_at = lambda x, y: (data[y * W + x] - firstgid) if 0 <= x < W and 0 <= y < H and data[y * W + x] else None
    wang = lambda tid: tiled_wang.get(tid, [0] * 8)
    # the Studio's own Tiled rule on the same sample grid: which tile per cell, and which cells it
    # reports as gaps (no exact Wang tile). Tiled must have read exactly those tiles.
    studio = json.loads(subprocess.run(['node', str(HERE / 'tiled' / 'studio_tiled.mjs'), str(d / 'model.json')], capture_output=True, text=True, check=True).stdout)
    got_cells = {f'{i % W},{i // W}': gid - firstgid for i, gid in enumerate(data) if gid}
    same = got_cells == studio['cells']
    if not same:
        diff = [k for k in set(got_cells) | set(studio['cells']) if got_cells.get(k) != studio['cells'].get(k)]
        fails.append(f'Tiled read {len(diff)} map cells differently from the Studio painter, e.g. {diff[:4]}')
    gaps = {tuple(g2) for g2 in studio['gaps']}
    probs_all = _consistency(W, H, tile_at, wang, ws[0]['type'])
    probs = _consistency(W, H, tile_at, wang, ws[0]['type'], wild=frozenset(gaps))
    details['map'] = {'size': [W, H], 'placed': placed, 'offset': [lay.get('offsetx', 0), lay.get('offsety', 0)], 'sameAsStudio': same,
                      'studioGaps': len(gaps), 'wangProblems': len(probs), 'explainedByGaps': len(probs_all) - len(probs), 'first': probs[:6]}
    if probs:
        fails.append(f'{len(probs)} Wang tiling inconsistencies not explained by a Studio-reported gap, e.g. {probs[:3]}')
    # Tiled does not keep an all-zero Wang ID: such a tile (the isolated blob tile of a one-colour
    # set) is not part of the Wang set, so Tiled's brush can never place it
    dropped = [tid for tid, key in ((int(k.split(',')[1]) * g['cols'] + int(k.split(',')[0]), k) for k, v in model['tiles'].items() if v['pattern'][0] >= 0)
               if tid not in tiled_wang and _expected_wangid(model['tiles'][key]['pattern'], want_type) == [0] * 8]
    details['allZeroDropped'] = dropped
    if want_type == 'corner' and (lay.get('offsetx', 0), lay.get('offsety', 0)) != (-g['w'] // 2, -g['h'] // 2):
        fails.append(f'corner set layer offset {lay.get("offsetx")},{lay.get("offsety")} (want half a tile up-left)')
    # 3. Tiled's renderer vs an independent render
    png = work / 'tmxrasterizer.png'
    png.unlink(missing_ok=True)
    rc = _run(RASTER, [str(tmx), str(png)])
    if rc != 0 or not png.exists():
        fails.append(f'tmxrasterizer failed (exit {rc})')
    else:
        atlas = Image.open(t / Path(ts_json['image']).name).convert('RGBA')
        mine, origin = _render(tmx_json, ts_json, atlas)
        got = Image.open(png).convert('RGBA')
        cmp = _compare(mine, got)
        if not cmp['ok'] and cmp.get('why', '').startswith('size'):
            # tmxrasterizer may clip to the map rectangle: compare the map area only
            W2, H2 = W * g['w'], H * g['h']
            if got.size == (W2, H2):
                cmp = _compare(mine.crop((-origin[0], -origin[1], -origin[0] + W2, -origin[1] + H2)), got)
                cmp['clipped'] = True
        mine.save(work / 'independent.png')
        details['render'] = {**cmp, 'rasterSize': list(got.size), 'independentSize': list(mine.size)}
        if not cmp['ok']:
            fails.append(f'tmxrasterizer render differs: {cmp}')
    summary = (f"Tiled {details['tiled']}: wangids {compared - bad}/{compared} as meant, map {placed} tiles, "
               f"{len(gaps)} Studio-flagged gaps, {len(probs)} unexplained Wang inconsistencies, {len(details['allZeroDropped'])} all-zero tile(s) dropped by Tiled, render {'pixel-exact' if details.get('render', {}).get('ok') else 'DIFFERS'}")
    return {'verdict': 'FAIL' if fails else 'PASS', 'summary': summary + ('; ' + '; '.join(fails[:4]) if fails else ''), 'details': details}


if __name__ == '__main__':
    for a in sys.argv[1:]:
        r = check(a)
        print(Path(a).name, r['verdict'], r['summary'])
