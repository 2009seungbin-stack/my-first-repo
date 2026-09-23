"""Engine-neutral judging: compares what an engine reported and drew (normalised by each runner)
with an expectation file built from the ORIGINAL asset's ground truth, not from the export.

Normalised engine report (every runner produces this shape):
  frames:     [{name, png, sourceSize?, region?}]      unique frames, in the engine's own order
  animations: {name: {fps, loop, frames: [{name, png, durationMs}]}}
  scaled:     {png, scale, base_png}                   one frame drawn at an integer zoom, as shipped
  glyphs:     {char: {has, png}}                        font glyphs drawn one by one
  tileset / paint                                       Godot TileSet facts and a terrain paint

Expectation file (docs/ENGINE-VERIFY.md describes every field):
  sprite:  {frames:[{image, name?}], animations:{name:{count,fps,loop,frames:[i...]}},
            order:true, placement:true, requireAnimations:false, scale:4, tolerance:2}
  tileset: {tileSize, margins, separation, tiles, mode, paint:[[x,y]...], expectedPick:{"x,y":[ax,ay]},
            sheet, grid}
  font:    {chars:{ch: image}, size, sample}
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image
from ev_common import Result, rgba, trim, diff, compare_art, nearest, alpha_bbox


def _norm_key(im: Image.Image) -> bytes:
    t = trim(rgba(im))
    if t.width == 0:
        return b'empty'
    px = bytearray(t.tobytes())
    for i in range(0, len(px), 4):
        if px[i + 3] == 0:
            px[i] = px[i + 1] = px[i + 2] = 0
    return bytes(t.size[0].to_bytes(4, 'little') + t.size[1].to_bytes(4, 'little') + px)


def _match(expected: list[Image.Image], actual: list[Image.Image], tolerance: int, shared: bool = False) -> list[int | None]:
    """For each expected image, the index of an actual image with the same art (trimmed).
    `shared`: the engine lists each stored texture once (Godot SpriteFrames, where pixel-identical
    source frames share one AtlasTexture), so a later identical source frame may match the same one."""
    keys = {}
    for i, im in enumerate(actual):
        keys.setdefault(_norm_key(im), []).append(i)
    used, out, seen = set(), [], {}
    for e in expected:
        ek = _norm_key(e)
        if shared and ek in seen:
            out.append(seen[ek]); continue
        cands = [i for i in keys.get(ek, []) if i not in used]
        if not cands and tolerance:
            te = trim(rgba(e))
            cands = [i for i, a in enumerate(actual) if i not in used and trim(rgba(a)).size == te.size and diff(te, trim(rgba(a)), tolerance)['ok']]
        if cands:
            used.add(cands[0]); out.append(cands[0]); seen[ek] = cands[0]
        else:
            out.append(None)
    return out


def _odd_size_shift(p: dict) -> bool:
    """Phaser 3.90 draws a trimmed frame 1 px right (down) when its source width (height) is odd,
    with pixelArt/roundPixels on. Only that exact pattern is tolerated, and only for phaser3."""
    e, a = p.get('expected'), p.get('actual')
    (w, h), size2 = p['frameSize']
    if not e or not a or [w, h] != size2:
        return False
    dx, dy = a[0] - e[0], a[1] - e[1]
    return (a[2] - e[2], a[3] - e[3]) == (dx, dy) and dx in (0, 1) and dy in (0, 1) and (dx or dy) \
        and (not dx or w % 2 == 1) and (not dy or h % 2 == 1)


def judge_sprite(res: Result, eng: dict, exp: dict) -> None:
    tol = exp.get('tolerance', 2)
    frames = eng.get('frames') or []
    shared = bool(eng.get('sharedTextures'))
    want_n = len(exp.get('frames', []))
    if shared and exp.get('frames'):
        want_n = len({_norm_key(rgba(Path(f['image']))) for f in exp['frames']})
    res.check('frames.count', len(frames) == want_n if exp.get('frames') else None, want_n, len(frames),
              'pixel-identical source frames share one engine texture' if shared and want_n != len(exp.get('frames', [])) else '')
    if exp.get('frames'):
        want = [rgba(Path(f['image'])) for f in exp['frames']]
        got = [rgba(Path(f['png'])) for f in frames if f.get('png')]
        m = _match(want, got, tol, shared)
        present = sum(1 for i in m if i is not None)
        missing = [exp['frames'][k].get('name') or k for k, i in enumerate(m) if i is None]
        res.check('frames.art', present == len(want), f'{len(want)} frames drawn exactly', f'{present} matched',
                  f'unmatched: {missing[:8]}' if missing else '')
        if exp.get('order', True):
            in_order = all(i == k for k, i in enumerate(m)) if not shared else \
                all(i is not None for i in m) and all(a <= b for a, b in zip(m, m[1:]))
            res.check('frames.order', in_order, 'engine order == source order', 'same' if in_order else f'{m[:12]}...')
        if exp.get('placement', True):
            bad, quirk = [], 0
            for k, i in enumerate(m):
                if i is None:
                    continue
                c = compare_art(want[k], got[i], tol)
                if not c['placement']['ok']:
                    p = c['placement']
                    if res.engine == 'phaser3' and _odd_size_shift(p):
                        quirk += 1
                        continue
                    bad.append((k, p))
            note = f'first difference: frame {bad[0][0]}: {bad[0][1]}' if bad else ''
            if quirk:
                note = (note + '; ' if note else '') + (f'{quirk} frame(s) drawn 1 px right/down by Phaser 3 itself: trimmed frames whose source '
                                                          'size is odd on that axis (engine behaviour, measured identically on every exporter)')
            res.check('frames.placement', not bad and present > 0, 'art sits where it sat in the source frame, same frame size',
                      f'{present - len(bad)}/{present} placed identically', note)
    anims = eng.get('animations') or {}
    if exp.get('requireAnimations'):
        res.check('animations.present', bool(anims), 'animation data the engine can play', f'{len(anims)} animations',
                  'the export carries no animation data this engine reads' if not anims else '')
    for name, want in (exp.get('animations') or {}).items():
        got = anims.get(name) or next((v for k, v in anims.items() if k.lower() == name.lower()), None)
        if got is None:
            res.check(f'anim[{name}]', False, 'present', sorted(anims)[:10])
            continue
        if 'count' in want:
            res.check(f'anim[{name}].count', len(got['frames']) == want['count'], want['count'], len(got['frames']))
        if want.get('fps') is not None:
            res.check(f'anim[{name}].fps', got.get('fps') is not None and abs(float(got['fps']) - want['fps']) < 1e-3, want['fps'], got.get('fps'))
        if want.get('loop') is not None:
            res.check(f'anim[{name}].loop', got.get('loop') == want['loop'], want['loop'], got.get('loop'))
        if want.get('durationsMs'):
            d = [f.get('durationMs') for f in got['frames']]
            res.check(f'anim[{name}].durations', len(d) == len(want['durationsMs']) and all(x is not None and abs(x - y) < 0.5 for x, y in zip(d, want['durationsMs'])),
                      want['durationsMs'], d)
        if want.get('frames') is not None and exp.get('frames'):
            imgs = [rgba(Path(exp['frames'][i]['image'])) for i in want['frames']]
            bad = []
            for k, (e, f) in enumerate(zip(imgs, got['frames'])):
                if not f.get('png') or not diff(trim(e), trim(rgba(Path(f['png']))), tol)['ok']:
                    bad.append(k)
            res.check(f'anim[{name}].art', not bad and len(imgs) == len(got['frames']), 'each step draws the expected source frame',
                      f'{len(imgs) - len(bad)}/{len(imgs)} steps match', f'mismatched steps {bad[:10]}' if bad else '')
    sc = eng.get('scaled')
    if sc and sc.get('png') and sc.get('base_png'):
        base = rgba(Path(sc['base_png']))
        d = diff(nearest(base, sc['scale']), rgba(Path(sc['png'])), tol)
        res.check(f'render.{sc["scale"]}x.sharp', d['ok'], f'nearest-neighbour {sc["scale"]}x of the 1x frame',
                  f'{d["differing"]} of {d.get("pixels")} pixels differ (max delta {d["maxDelta"]})' if d['differing'] is not None else f'size {d["size"]}',
                  sc.get('note', ''))


# ---------------------------------------------------------------- tiles

def judge_tileset(res: Result, eng: dict, exp: dict, data: dict | None) -> None:
    ts = eng.get('tileset') or {}
    want = exp or {}
    if not ts:
        res.check('tileset.loaded', False, 'TileSet built and reloaded', 'nothing')
        return
    if want.get('tileSize'):
        res.check('tileset.tile_size', ts.get('tile_size') == list(want['tileSize']), list(want['tileSize']), ts.get('tile_size'))
    if want.get('margins') is not None:
        res.check('tileset.margins', ts.get('margins') == list(want['margins']), list(want['margins']), ts.get('margins'))
    if want.get('separation') is not None:
        res.check('tileset.separation', ts.get('separation') == list(want['separation']), list(want['separation']), ts.get('separation'))
    if want.get('tiles') is not None:
        res.check('tileset.tiles', len(ts.get('tiles', {})) == want['tiles'], want['tiles'], len(ts.get('tiles', {})))
    if want.get('mode') is not None:
        modes = {'match_corners_and_sides': 0, 'match_corners': 1, 'match_sides': 2}
        got = (ts.get('terrain_sets') or [{}])[0].get('mode')
        res.check('tileset.terrain_mode', got == modes[want['mode']], want['mode'], {v: k for k, v in modes.items()}.get(got, got))
    # Peering bits against the bundle's own JSON: the importer must carry what the exporter wrote.
    if data:
        names = ['right_side', 'bottom_right_corner', 'bottom_side', 'bottom_left_corner', 'left_side', 'top_left_corner', 'top_side', 'top_right_corner']
        bad = compared = 0
        for tile in data['tileSet']['tiles']:
            got = (ts.get('tiles') or {}).get(f'{tile["atlas"]["x"]},{tile["atlas"]["y"]}')
            if got is None:
                bad += 1; continue
            for n in names:
                if n not in got['peering']:
                    continue
                compared += 1
                if got['peering'][n] != tile['peering'].get(n, -1):
                    bad += 1
        res.check('tileset.peering_vs_export', bad == 0 and compared > 0, 'engine peering bits == exported JSON', f'{compared} compared, {bad} differ')
    paint = eng.get('paint')
    if want.get('expectedPick') and paint:
        picked = paint.get('picked', {})
        wrong = {k: [picked.get(k), v] for k, v in want['expectedPick'].items() if picked.get(k) not in v}
        res.check('terrain.paint.picks', not wrong, 'the tile the source layout defines for each neighbourhood',
                  f'{len(want["expectedPick"]) - len(wrong)}/{len(want["expectedPick"])} cells right',
                  f'first wrong cells (got, want): {dict(list(wrong.items())[:6])}' if wrong else '')
    if want.get('expectedPaint') and paint and paint.get('png'):
        d = diff(rgba(Path(want['expectedPaint'])), rgba(Path(paint['png'])), want.get('tolerance', 2))
        res.check('terrain.paint.pixels', d['ok'], 'painted map drawn with the source tiles', f'{d["differing"]} pixels differ' if d['differing'] is not None else f'size {d["size"]}')


# ---------------------------------------------------------------- fonts

def judge_font(res: Result, eng: dict, exp: dict) -> None:
    glyphs = eng.get('glyphs') or {}
    chars = exp.get('chars') or {}
    if not chars:
        return
    has = [c for c in chars if glyphs.get(c, {}).get('has')]
    res.check('font.chars', len(has) == len(chars), f'{len(chars)} characters', f'{len(has)} present',
              f'missing: {"".join(c for c in chars if c not in has)[:40]}' if len(has) != len(chars) else '')
    wrong = []
    for c, path in chars.items():
        g = glyphs.get(c)
        if not g or not g.get('png'):
            continue
        e = trim(rgba(Path(path)))
        a = trim(rgba(Path(g['png'])))
        # Shape only: engines tint glyphs with the label colour, so compare coverage masks.
        em = e.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
        am = a.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
        if em.size != am.size or list(em.getdata()) != list(am.getdata()):
            wrong.append(c)
    res.check('font.glyph_shapes', not wrong and bool(has), 'each glyph drawn with the source glyph shape',
              f'{len(has) - len(wrong)}/{len(has)} glyphs match', f'wrong: {"".join(wrong)[:40]!r}' if wrong else '')
