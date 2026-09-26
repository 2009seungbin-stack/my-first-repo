"""Judge atlases written as TexturePacker JSON hash (any tool) against the source frames.

Each frame is restored from the sheet with TexturePacker semantics (frame rect, rotated = stored 90°
clockwise with frame w/h unrotated, spriteSourceSize/sourceSize for trim) and compared with its
source PNG pixel for pixel; RGB under alpha 0 is ignored. Polygon frames (vertices/triangles) are
restored through their triangle mask: pixels outside the mask must be transparent in the source,
pixels inside must equal it (anything else = not exact).

  python tools/h2h/atlas_verify.py            -> $H2H_WORK/pack/judged.json
"""
import json
import re
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageChops, ImageDraw
from h2h_paths import PACK, SETS, SETS_EXTRA, MAIN_SETS


def norm(im):
    im = im.convert('RGBA')
    mask = im.getchannel('A').point(lambda v: 255 if v else 0)
    z = Image.new('RGBA', im.size, (0, 0, 0, 0))
    z.paste(im, (0, 0), mask)
    return z


def ndiff(a, b):
    if a.size != b.size:
        return None
    d = ImageChops.difference(a, b)
    bands = d.split()
    m = bands[0]
    for bd in bands[1:]:
        m = ImageChops.lighter(m, bd)
    hist = m.histogram()
    return sum(hist[1:]), max(bd.getextrema()[1] for bd in bands)


def restore(sheet, fr):
    f = fr['frame']
    x, y, w, h = f['x'], f['y'], f['w'], f['h']
    if fr.get('rotated'):
        reg = sheet.crop((x, y, x + h, y + w)).transpose(Image.ROTATE_90)  # stored clockwise
        occ = (x, y, h, w)
    else:
        reg = sheet.crop((x, y, x + w, y + h))
        occ = (x, y, w, h)
    ss = fr.get('spriteSourceSize', {'x': 0, 'y': 0})
    src = fr.get('sourceSize', {'w': reg.size[0], 'h': reg.size[1]})
    canvas = Image.new('RGBA', (src['w'], src['h']), (0, 0, 0, 0))
    canvas.paste(reg, (ss['x'], ss['y']))
    return canvas, occ


def restore_polygon(sheet, fr):
    """Rasterise the triangles: sheet pixel at verticesUV, placed at vertices (source coordinates)."""
    src = fr['sourceSize']
    V, UV = fr['vertices'], fr['verticesUV']
    # a pixel belongs to the mesh when its centre is inside a triangle (edges included), which is
    # what a GPU rasteriser draws
    gy, gx = np.mgrid[0:src['h'], 0:src['w']]
    px, py = gx + .5, gy + .5
    m = np.zeros((src['h'], src['w']), bool)
    for t in fr['triangles']:
        (x0, y0), (x1, y1), (x2, y2) = (V[i] for i in t)
        d0 = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0)
        d1 = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)
        d2 = (x0 - x2) * (py - y2) - (y0 - y2) * (px - x2)
        m |= ((d0 >= 0) & (d1 >= 0) & (d2 >= 0)) | ((d0 <= 0) & (d1 <= 0) & (d2 <= 0))
    mask = Image.fromarray(m.astype(np.uint8) * 255, 'L')
    # vertices (source px) -> verticesUV (sheet px) is one rigid map per frame: a translation, or a
    # 90° turn plus translation for rotated frames. Fit it and require it to be exact.
    A = np.array([[v[0], v[1], 1] for v in V], float)
    M, *_ = np.linalg.lstsq(A, np.array(UV, float), rcond=None)
    if np.abs(A @ M - np.array(UV, float)).max() > 1e-6:
        return None, mask
    ys, xs = np.nonzero(m)
    uv = np.column_stack([xs + .5, ys + .5, np.ones(len(xs))]) @ M
    u, v = np.floor(uv[:, 0]).astype(int), np.floor(uv[:, 1]).astype(int)
    S = np.array(sheet)
    ok = (u >= 0) & (v >= 0) & (u < S.shape[1]) & (v < S.shape[0])
    out = np.zeros((src['h'], src['w'], 4), np.uint8)
    out[ys[ok], xs[ok]] = S[v[ok], u[ok]]
    canvas = Image.fromarray(out, 'RGBA')
    return canvas, mask


def verify(src_dir, jsons):
    sources = {f.name: norm(Image.open(f)) for f in sorted(Path(src_dir).glob('*.png'))}
    res = {'frames_total': len(sources), 'exact': 0, 'mismatch': [], 'rotated': 0, 'overlaps': 0, 'polygon': 0,
           'polygon_unsupported': 0, 'sheets': [], 'max_diff': 0}
    seen = set()
    for jp in jsons:
        d = json.loads(Path(jp).read_text())
        sheet = norm(Image.open(Path(jp).parent / d['meta']['image']))
        res['sheets'].append(list(sheet.size))
        rects = []
        for name, fr in d['frames'].items():
            key = name if name in sources else name + '.png'
            src = sources.get(key)
            if src is None:
                res['mismatch'].append([name, 'no such source'])
                continue
            seen.add(key)
            res['rotated'] += bool(fr.get('rotated'))
            if 'triangles' in fr:
                res['polygon'] += 1
                out, mask = restore_polygon(sheet, fr)
                if out is None:
                    res['polygon_unsupported'] += 1
                    res['mismatch'].append([name, 'rotated/transformed polygon not restored by this judge'])
                    continue
                # opaque source pixels outside the polygon would be lost
                lost = ImageChops.multiply(src.getchannel('A').point(lambda v: 255 if v else 0), ImageChops.invert(mask)).histogram()
                lost = sum(lost[1:])
                dd = ndiff(out, src)
                if dd and dd[0] == 0 and lost == 0:
                    res['exact'] += 1
                else:
                    res['mismatch'].append([name, f'{dd[0] if dd else "size"} px differ, {lost} opaque px outside the polygon'])
                continue
            out, occ = restore(sheet, fr)
            rects.append(occ)
            dd = ndiff(out, src)
            if dd is None:
                res['mismatch'].append([name, f'size {out.size} vs {src.size}'])
            elif dd[0] == 0:
                res['exact'] += 1
            else:
                res['mismatch'].append([name, f'{dd[0]} px differ, max channel diff {dd[1]}'])
                res['max_diff'] = max(res['max_diff'], dd[1])
        # aliases share one rect: count only distinct rects that overlap
        uniq = sorted(set(rects))
        for i in range(len(uniq)):
            ax, ay, aw, ah = uniq[i]
            for j in range(i + 1, len(uniq)):
                bx, by, bw, bh = uniq[j]
                if ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah:
                    res['overlaps'] += 1
    res['missing'] = sorted(set(sources) - seen)
    res['mismatch_count'] = len(res['mismatch'])
    res['mismatch'] = res['mismatch'][:5]
    return res


def main():
    stats = json.loads((PACK / 'set_stats.json').read_text())
    rows = []
    for tool in ('tp', 'nerulio'):
        runs = json.loads((PACK / tool / 'runs.json').read_text())['runs']
        for r in runs:
            is_extra = r['set'] not in MAIN_SETS
            d = PACK / tool / ('extra' if is_extra else r['set']) / (r['set'] if is_extra else r['config'])
            src = SETS_EXTRA / r['set'].split('-')[0] if is_extra else SETS / r['set']
            jsons = sorted(d.glob('sheet-*.json'), key=lambda p: int(re.search(r'-(\d+)\.json$', p.name).group(1)))
            v = verify(src, jsons)
            area = sum(w * h for w, h in v['sheets'])
            bbox = stats[r['set']]['bbox_area'] if r['set'] in stats else None
            row = {'tool': tool, 'set': r['set'], 'config': r['config'], 'sheets': v['sheets'], 'area': area,
                   'eff': round(bbox / area, 4) if bbox else None, 'ms': r.get('ms', r.get('ms_total')), 'ms_pack': r.get('ms_pack'),
                   'aspect': round(max(max(w / h, h / w) for w, h in v['sheets']), 2), **{k: v[k] for k in (
                       'frames_total', 'exact', 'rotated', 'overlaps', 'polygon', 'polygon_unsupported', 'missing', 'mismatch_count', 'mismatch', 'max_diff')}}
            rows.append(row)
            print(tool, r['set'], r['config'], ' + '.join(f'{w}x{h}' for w, h in v['sheets']), area, row['eff'], f"{v['exact']}/{v['frames_total']}",
                  'rot', v['rotated'], 'ovl', v['overlaps'], v['mismatch'][:2], flush=True)
    (PACK / 'judged.json').write_text(json.dumps(rows, indent=1))


if __name__ == '__main__':
    sys.exit(main())
