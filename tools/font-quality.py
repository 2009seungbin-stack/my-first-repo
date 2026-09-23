#!/usr/bin/env python3
"""Independent font-atlas quality judge (no Nerulio JS involved).

Compares every glyph of a font atlas with the exact coverage of the glyph outline
taken straight from the font file with fontTools.

Atlas inputs
  * msdf-atlas-gen JSON  {atlas:{type,distanceRange,size,width,height,yOrigin},metrics,glyphs:[...],kerning:[...]}
    plus the atlas PNG (--image).
  * BMFont text (.fnt), BMFont XML (.fnt/.xml) or BMFont JSON (msdf-bmfont / Snowb style), with pages
    from the file (or --image). The optional msdf-bmfont-xml extension
    `distanceField fieldType=msdf distanceRange=4` marks an SDF atlas; --field/--range override it.

Reconstruction (what a GPU shader does)
  bilinear sample of the page (texel centres at i+0.5, clamp to edge) ->
  signed value: median(R,G,B) for msdf/mtsdf, one channel for sdf/psdf ->
  screen distance d = (v - 0.5) * distanceRange * S  (S = screen px per atlas px) ->
  coverage = smoothstep over one screen pixel: t = clamp(d + 0.5, 0, 1); t*t*(3-2t).
  Rendered at S = 4 and 8 (configurable). Bitmap (non-SDF) atlases are compared at S = 1
  with the stored coverage channel.

Ground truth
  Glyph outline -> flattened polygon (curves subdivided to <= 1/4 output px chords) -> exact
  nonzero-winding coverage: analytic span coverage along x, 16 sub-scanlines per output pixel in y.
  The truth pixel grid is the same grid the reconstruction uses:
    msdf-atlas-gen: the planeBounds quad (em units * unitsPerEm).
    BMFont:         pen-space rectangle (xoffset, yoffset, width, height) at em_px/unitsPerEm; baseline
                    at `base` px below the line top. The em size in px is not stored unambiguously in
                    .fnt (BMFont uses signed size / cell height, Hiero uses Java point size), so the tool
                    tries the known conventions and a small global sub-pixel registration (reported).

Metrics (per atlas, over "ink" pixels = truth > 0 or reconstruction > 0 inside each glyph quad)
  mean |err|, p95 |err|, wrong_pct (% pixels with |err| > 0.5), plus the same over all quad pixels.
  Atlas: pages, page size, glyph count, glyph-rect area / page area (efficiency), used area
  (bounding box of placed rects / page area), inked pixel fraction, kerning pairs,
  missing glyphs vs --charset (split into "not in font" and "font has it, atlas does not").

CLI
  python tools/font-quality.py --font F --atlas atlas.json|font.fnt [--image page.png ...]
         [--charset chars.txt] [--json out.json] [--scales 4,8] [--sample N]
         [--field msdf|mtsdf|sdf|psdf|bitmap] [--range PX] [--channel r|g|b|a|l|median] [--em-px PX]
         [--no-register] [--degrade blur=1.0,shift=1] (negative control: degrade the page images first)
"""
import argparse, json, math, os, re, sys, time
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageFilter
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

SUB = 16  # sub-scanlines per output pixel for the exact reference


# ----------------------------------------------------------------------------- outline -> segments
class FlattenPen(BasePen):
    def __init__(self, glyphSet, tol_units):
        super().__init__(glyphSet)
        self.tol = max(tol_units, 1e-6)
        self.segs = []
        self.start = None
        self.cur = None

    def _moveTo(self, p):
        self.start = self.cur = p

    def _lineTo(self, p):
        self.segs.append((self.cur[0], self.cur[1], p[0], p[1]))
        self.cur = p

    def _n(self, pts):
        L = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))
        return int(min(256, max(2, math.ceil(L / self.tol))))

    def _qCurveToOne(self, p1, p2):
        p0 = self.cur
        n = self._n([p0, p1, p2])
        t = np.linspace(0, 1, n + 1)[1:]
        xs = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        ys = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        for x, y in zip(xs, ys):
            self._lineTo((float(x), float(y)))

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur
        n = self._n([p0, p1, p2, p3])
        t = np.linspace(0, 1, n + 1)[1:]
        mt = 1 - t
        xs = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0]
        ys = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1]
        for x, y in zip(xs, ys):
            self._lineTo((float(x), float(y)))

    def _closePath(self):
        if self.cur is not None and self.start is not None and self.cur != self.start:
            self._lineTo(self.start)
        self.cur = self.start

    _endPath = _closePath


class Font:
    def __init__(self, path):
        self.tt = TTFont(path, lazy=True)
        self.upem = self.tt['head'].unitsPerEm
        self.cmap = self.tt.getBestCmap() or {}
        self.gs = self.tt.getGlyphSet()
        os2 = self.tt['OS/2'] if 'OS/2' in self.tt else None
        hhea = self.tt['hhea']
        self.win = (os2.usWinAscent, os2.usWinDescent) if os2 else (hhea.ascent, -hhea.descent)
        self.hhea = (hhea.ascent, hhea.descent)
        self.typo = (os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap) if os2 else None
        self._cache = {}

    def segments(self, cp, tol_units):
        key = (cp, round(tol_units, 4))
        if key in self._cache:
            return self._cache[key]
        name = self.cmap.get(cp)
        if name is None:
            return None
        pen = FlattenPen(self.gs, tol_units)
        self.gs[name].draw(pen)
        segs = np.array(pen.segs, dtype=np.float64).reshape(-1, 4)
        if len(self._cache) > 4096:
            self._cache.clear()
        self._cache[key] = segs
        return segs

    def advance(self, cp):
        name = self.cmap.get(cp)
        return self.tt['hmtx'][name][0] if name else None


def exact_coverage(segs, X0, Ytop, ux, uy, W, H, sub=SUB):
    """Exact nonzero coverage of pixel (i,j) covering X in [X0+i*ux, X0+(i+1)*ux], Y in [Ytop-(j+1)*uy, Ytop-j*uy]."""
    out = np.zeros((H, W), dtype=np.float64)
    if segs is None or len(segs) == 0 or W <= 0 or H <= 0:
        return out
    x0 = (segs[:, 0] - X0) / ux
    x1 = (segs[:, 2] - X0) / ux
    y0 = (Ytop - segs[:, 1]) / uy * sub  # in sub-row units, y down
    y1 = (Ytop - segs[:, 3]) / uy * sub
    keep = y0 != y1
    x0, x1, y0, y1 = x0[keep], x1[keep], y0[keep], y1[keep]
    d = np.where(y1 > y0, 1, -1).astype(np.int32)
    ya, yb = np.minimum(y0, y1), np.maximum(y0, y1)
    slope = (x1 - x0) / (y1 - y0)
    R = H * sub
    acc = np.zeros((R, W), dtype=np.float64)
    diff = np.zeros((R, W + 1), dtype=np.float64)
    CH = 64
    for r0 in range(0, R, CH):
        r1 = min(R, r0 + CH)
        yc = np.arange(r0, r1) + 0.5
        sel = (yb > yc[0]) & (ya <= yc[-1])
        if not sel.any():
            continue
        e_ya, e_yb, e_x0, e_y0, e_s, e_d = ya[sel], yb[sel], x0[sel], y0[sel], slope[sel], d[sel]
        Y = yc[:, None]
        cross = (e_ya[None, :] <= Y) & (Y < e_yb[None, :])
        X = np.where(cross, e_x0[None, :] + (Y - e_y0[None, :]) * e_s[None, :], np.inf)
        D = np.where(cross, e_d[None, :], 0)
        order = np.argsort(X, axis=1, kind='stable')
        Xs = np.take_along_axis(X, order, 1)
        Ds = np.take_along_axis(D, order, 1)
        wind = np.cumsum(Ds, axis=1)
        if Xs.shape[1] < 2:
            continue
        xa, xb = Xs[:, :-1], Xs[:, 1:]
        on = (wind[:, :-1] != 0) & np.isfinite(xb)
        rows = np.broadcast_to(np.arange(r0, r1)[:, None], xa.shape)[on]
        xa, xb = np.clip(xa[on], 0, W), np.clip(xb[on], 0, W)
        ok = xb > xa
        rows, xa, xb = rows[ok], xa[ok], xb[ok]
        if not len(rows):
            continue
        ia = np.minimum(np.floor(xa).astype(np.int64), W - 1)
        ib = np.floor(xb).astype(np.int64)
        same = ia == ib
        np.add.at(acc, (rows[same], ia[same]), xb[same] - xa[same])
        dif = ~same
        r_, ia_, ib_, xa_, xb_ = rows[dif], ia[dif], ib[dif], xa[dif], xb[dif]
        np.add.at(acc, (r_, ia_), (ia_ + 1) - xa_)
        tail = ib_ < W
        np.add.at(acc, (r_[tail], ib_[tail]), xb_[tail] - ib_[tail])
        np.add.at(diff, (r_, ia_ + 1), 1.0)
        np.add.at(diff, (r_, ib_), -1.0)
    acc += np.cumsum(diff, axis=1)[:, :W]
    out = acc.reshape(H, sub, W).mean(axis=1)
    return np.clip(out, 0.0, 1.0)


# ----------------------------------------------------------------------------- atlas readers
def _kv(line):
    return {m.group(1): (m.group(2)[1:-1] if m.group(2).startswith('"') else m.group(2))
            for m in re.finditer(r'(\w+)=("[^"]*"|\S+)', line)}


def read_bmfont(path):
    raw = open(path, 'rb').read()
    txt = raw.decode('utf-8-sig', errors='replace')
    fnt = {'info': {}, 'common': {}, 'pages': {}, 'chars': [], 'kernings': [], 'distanceField': None, 'format': None}
    s = txt.lstrip()
    if s.startswith('{'):
        d = json.loads(s)
        fnt['format'] = 'bmfont-json'
        fnt['info'] = d.get('info', {})
        fnt['common'] = d.get('common', {})
        pages = d.get('pages', [])
        fnt['pages'] = {i: p for i, p in enumerate(pages)}
        fnt['chars'] = d.get('chars', [])
        fnt['kernings'] = d.get('kernings', [])
        fnt['distanceField'] = d.get('distanceField')
    elif s.startswith('<'):
        fnt['format'] = 'bmfont-xml'
        root = ET.fromstring(s)
        fnt['info'] = dict(root.find('info').attrib) if root.find('info') is not None else {}
        fnt['common'] = dict(root.find('common').attrib) if root.find('common') is not None else {}
        for p in root.iter('page'):
            fnt['pages'][int(p.get('id'))] = p.get('file')
        fnt['chars'] = [dict(c.attrib) for c in root.iter('char')]
        fnt['kernings'] = [dict(k.attrib) for k in root.iter('kerning')]
        df = root.find('distanceField')
        if df is not None:
            fnt['distanceField'] = dict(df.attrib)
    elif raw[:3] == b'BMF':
        raise SystemExit('binary BMFont is not supported; export text or XML')
    else:
        fnt['format'] = 'bmfont-text'
        for line in txt.splitlines():
            tag = line.split(' ', 1)[0].strip()
            kv = _kv(line)
            if tag == 'info':
                fnt['info'] = kv
            elif tag == 'common':
                fnt['common'] = kv
            elif tag == 'page':
                fnt['pages'][int(kv['id'])] = kv['file']
            elif tag == 'char':
                fnt['chars'].append(kv)
            elif tag == 'kerning':
                fnt['kernings'].append(kv)
            elif tag == 'distanceField':
                fnt['distanceField'] = kv
    num = lambda v: float(v) if v not in (None, '') else 0.0
    fnt['chars'] = [{k: (num(v) if k in ('id', 'x', 'y', 'width', 'height', 'xoffset', 'yoffset', 'xadvance', 'page', 'chnl') else v)
                     for k, v in c.items()} for c in fnt['chars']]
    return fnt


def load_pages(files, base_dir, degrade=None):
    pages = {}
    for pid, f in files.items():
        p = f if os.path.isabs(f) else os.path.join(base_dir, f)
        im = Image.open(p)
        im.load()
        mode = im.mode
        if mode == 'P':
            im = im.convert('RGBA'); mode = 'RGBA'
        if mode in ('I;16', 'I'):
            im = im.point(lambda v: v / 257).convert('L'); mode = 'L'
        if mode == 'LA':
            im = im.convert('RGBA'); mode = 'RGBA'
        if mode not in ('L', 'RGB', 'RGBA'):
            im = im.convert('RGBA'); mode = 'RGBA'
        if degrade:
            if degrade.get('blur'):
                im = im.filter(ImageFilter.GaussianBlur(degrade['blur']))
            if degrade.get('shift'):
                s = int(degrade['shift'])
                im = im.transform(im.size, Image.AFFINE, (1, 0, -s, 0, 1, -s), resample=Image.NEAREST)
        a = np.asarray(im).astype(np.float32) / 255.0
        if a.ndim == 2:
            a = a[:, :, None]
        pages[pid] = {'arr': a, 'mode': mode, 'path': p, 'w': im.size[0], 'h': im.size[1]}
    return pages


def bilinear(arr, tx, ty):
    """arr HxWxC; tx,ty in texel units (x right, y down, texel centres at +0.5). Clamp to edge."""
    H, W = arr.shape[:2]
    fx = np.clip(tx - 0.5, 0, W - 1)
    fy = np.clip(ty - 0.5, 0, H - 1)
    x0 = np.floor(fx).astype(np.int64); y0 = np.floor(fy).astype(np.int64)
    x1 = np.minimum(x0 + 1, W - 1); y1 = np.minimum(y0 + 1, H - 1)
    ax = (fx - x0)[..., None]; ay = (fy - y0)[..., None]
    return ((arr[y0, x0] * (1 - ax) + arr[y0, x1] * ax) * (1 - ay) + (arr[y1, x0] * (1 - ax) + arr[y1, x1] * ax) * ay)


def pick_channel(samples, field, channel, mode):
    C = samples.shape[-1]
    if channel == 'median' or (channel == 'auto' and field in ('msdf', 'mtsdf')):
        r, g, b = samples[..., 0], samples[..., 1], samples[..., 2]
        return np.maximum(np.minimum(r, g), np.minimum(np.maximum(r, g), b))
    idx = {'r': 0, 'g': 1, 'b': 2, 'a': 3, 'l': 0}
    if channel != 'auto':
        return samples[..., min(idx[channel], C - 1)]
    return samples[..., 0]


def auto_channel(page, field, chnl=None):
    """Decide which channel carries coverage/distance for single-channel content."""
    if field in ('msdf', 'mtsdf'):
        return 'median'
    if chnl is not None and int(chnl) in (1, 2, 4, 8):
        return {1: 'b', 2: 'g', 4: 'r', 8: 'a'}[int(chnl)]
    a = page['arr']
    if a.shape[2] == 1:
        return 'l'
    if a.shape[2] == 4:
        alpha_var = float(a[..., 3].std())
        rgb_var = float(a[..., :3].std())
        if alpha_var > 1e-3 and (rgb_var < 1e-3 or alpha_var >= rgb_var * 0.5):
            return 'a'
    return 'r'


def smooth_cov(v, rng_px, S):
    d = (v - 0.5) * rng_px * S
    t = np.clip(d + 0.5, 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------------------- glyph jobs
class Job:
    """One glyph: page region -> output grid, and the font-space rectangle of that grid."""
    __slots__ = ('cp', 'page', 'aL', 'aT', 'aW', 'aH', 'X0', 'Ytop', 'uxS', 'uyS', 'rect')


def jobs_from_msdf(meta, font):
    A = meta['atlas']
    size = float(A['size'])
    yo = A.get('yOrigin', 'bottom')
    H = float(A['height'])
    jobs, placed = [], []
    for g in meta['glyphs']:
        if 'unicode' not in g:
            continue
        ab, pb = g.get('atlasBounds'), g.get('planeBounds')
        if not ab or not pb:
            continue
        if yo == 'bottom':
            top, bot = H - ab['top'], H - ab['bottom']
            ptop, pbot = pb['top'], pb['bottom']
        else:
            top, bot = ab['top'], ab['bottom']
            ptop, pbot = -pb['top'], -pb['bottom']
        j = Job()
        j.cp = int(g['unicode']); j.page = int(g.get('page', 0)) if 'page' in g else 0
        j.aL, j.aT, j.aW, j.aH = ab['left'], top, ab['right'] - ab['left'], bot - top
        j.X0 = pb['left'] * font.upem
        j.Ytop = ptop * font.upem
        j.uxS = (pb['right'] - pb['left']) * font.upem / j.aW  # font units per atlas px
        j.uyS = (ptop - pbot) * font.upem / j.aH
        j.rect = (ab['left'], top, ab['right'], bot)
        jobs.append(j)
    return jobs, size


def jobs_from_bmfont(fnt, font, em_px, dx=0.0, dy=0.0):
    base = float(fnt['common'].get('base', 0))
    u = font.upem / em_px  # font units per px
    jobs = []
    for c in fnt['chars']:
        w, h = c.get('width', 0), c.get('height', 0)
        if w <= 0 or h <= 0:
            continue
        cp = int(c['id'])
        j = Job()
        j.cp = cp; j.page = int(c.get('page', 0))
        j.aL, j.aT, j.aW, j.aH = c['x'], c['y'], w, h
        # pen space (px): x right from pen origin, y down from line top; baseline at y = base
        j.X0 = (c['xoffset'] + dx) * u
        j.Ytop = (base - (c['yoffset'] + dy)) * u
        j.uxS = u; j.uyS = u
        j.rect = (c['x'], c['y'], c['x'] + w, c['y'] + h)
        jobs.append(j)
    return jobs


def eval_job(j, font, pages, field, rng, S, channel_for_page):
    W = int(round(j.aW * S)); H = int(round(j.aH * S))
    if W <= 0 or H <= 0:
        return None
    ux, uy = j.uxS / S, j.uyS / S
    segs = font.segments(j.cp, min(ux, uy) / 4.0)
    if segs is None:
        return None
    truth = exact_coverage(segs, j.X0, j.Ytop, ux, uy, W, H)
    pg = pages[j.page]
    xs = j.aL + (np.arange(W) + 0.5) * (j.aW / W)
    ys = j.aT + (np.arange(H) + 0.5) * (j.aH / H)
    TX, TY = np.meshgrid(xs, ys)
    smp = bilinear(pg['arr'], TX, TY)
    v = pick_channel(smp, field, channel_for_page[j.page], pg['mode'])
    rec = v if field == 'bitmap' else smooth_cov(v, rng, S)
    return truth, rec


def summarize(errs_ink, errs_all, n_glyphs):
    if not len(errs_ink):
        return None
    e = np.concatenate(errs_ink); ea = np.concatenate(errs_all)
    return {
        'glyphs': n_glyphs,
        'ink_pixels': int(e.size),
        'mean_abs_err': round(float(e.mean()), 5),
        'p95_abs_err': round(float(np.percentile(e, 95)), 5),
        'wrong_pct': round(float((e > 0.5).mean() * 100), 4),
        'all_quad_pixels': int(ea.size),
        'mean_abs_err_all_quad': round(float(ea.mean()), 5),
        'wrong_pct_all_quad': round(float((ea > 0.5).mean() * 100), 4),
    }


def run_scale(jobs, font, pages, field, rng, S, chan):
    ink, allp, n = [], [], 0
    per_glyph = []
    for j in jobs:
        r = eval_job(j, font, pages, field, rng, S, chan)
        if r is None:
            continue
        truth, rec = r
        err = np.abs(rec - truth)
        m = (truth > 1e-6) | (rec > 1e-6)
        if m.any():
            ink.append(err[m]); per_glyph.append((j.cp, float(err[m].mean())))
        allp.append(err.ravel()); n += 1
    s = summarize(ink, allp, n)
    if s:
        per_glyph.sort(key=lambda t: -t[1])
        s['worst_glyphs'] = [{'char': chr(cp), 'cp': 'U+%04X' % cp, 'mean_abs_err': round(v, 4)} for cp, v in per_glyph[:8]]
    return s


def register_bmfont(fnt, font, pages, field, rng, chan, sample_ids):
    """Find em_px and a global sub-pixel offset. Returns (em_px, dx, dy, convention, table)."""
    size = abs(float(fnt['info'].get('size', 0) or 0))
    cands = {}
    if size:
        cands['em = |size|'] = size
        wa, wd = font.win
        cands['cell = winAscent+winDescent'] = size * font.upem / (wa + wd)
        ha, hd = font.hhea
        cands['cell = hhea ascent-descent'] = size * font.upem / (ha - hd)
    base = float(fnt['common'].get('base', 0))
    if base:
        cands['base = winAscent'] = base * font.upem / font.win[0]
    S = 1 if field == 'bitmap' else 2
    sub = [c for c in fnt['chars'] if int(c['id']) in sample_ids]

    def score(em, dx, dy):
        fake = dict(fnt); fake['chars'] = sub
        js = jobs_from_bmfont(fake, font, em, dx, dy)
        tot, cnt = 0.0, 0
        for j in js:
            r = eval_job(j, font, pages, field, rng, S, chan)
            if r is None:
                continue
            t, rec = r
            m = (t > 1e-6) | (rec > 1e-6)
            tot += float(np.abs(rec - t)[m].sum()); cnt += int(m.sum())
        return tot / max(cnt, 1)

    table = {k: round(score(v, 0, 0), 5) for k, v in cands.items()}
    best = min(table, key=table.get)
    em, dx, dy = cands[best], 0.0, 0.0
    cur = table[best]
    for step in (0.5, 0.25, 0.125):
        for _ in range(3):
            improved = False
            for ddx, ddy, dem in ((step, 0, 0), (-step, 0, 0), (0, step, 0), (0, -step, 0), (0, 0, step / 16), (0, 0, -step / 16)):
                e2 = em * (1 + dem)
                sc = score(e2, dx + ddx, dy + ddy)
                if sc < cur - 1e-6:
                    cur, em, dx, dy, improved = sc, e2, dx + ddx, dy + ddy, True
            if not improved:
                break
    return em, dx, dy, best, table, cur


# ----------------------------------------------------------------------------- main
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--font', required=True)
    ap.add_argument('--atlas', required=True)
    ap.add_argument('--image', action='append', help='page image(s) in page order (required for msdf-atlas-gen JSON)')
    ap.add_argument('--charset', help='UTF-8 text file; every non-control character is requested')
    ap.add_argument('--json', help='write the report here')
    ap.add_argument('--scales', default='4,8')
    ap.add_argument('--sample', type=int, default=0, help='evaluate only N glyphs spread evenly over the atlas (0 = all)')
    ap.add_argument('--field', choices=['auto', 'msdf', 'mtsdf', 'sdf', 'psdf', 'bitmap'], default='auto')
    ap.add_argument('--range', type=float, help='distance range in atlas px (overrides the file)')
    ap.add_argument('--channel', default='auto', choices=['auto', 'r', 'g', 'b', 'a', 'l', 'median'])
    ap.add_argument('--em-px', type=float, help='BMFont: font size as px per em (skips convention search)')
    ap.add_argument('--no-register', action='store_true', help='BMFont: no sub-pixel registration search')
    ap.add_argument('--degrade', help='negative control, e.g. blur=1.0,shift=1')
    a = ap.parse_args(argv)
    t0 = time.time()
    font = Font(a.font)
    degrade = None
    if a.degrade:
        degrade = {k: float(v) for k, v in (kv.split('=') for kv in a.degrade.split(','))}
    base_dir = os.path.dirname(os.path.abspath(a.atlas))
    raw = open(a.atlas, 'rb').read().decode('utf-8-sig', errors='replace').lstrip()
    rep = {'tool': 'font-quality.py', 'font': os.path.abspath(a.font), 'atlas': os.path.abspath(a.atlas),
           'units_per_em': font.upem, 'degrade': degrade}
    kerning = 0
    if raw.startswith('{') and '"atlas"' in raw[:400] and '"glyphs"' in raw:
        meta = json.loads(raw)
        rep['format'] = 'msdf-atlas-gen-json'
        A = meta['atlas']
        field = a.field if a.field != 'auto' else A.get('type', 'msdf')
        if field in ('softmask', 'hardmask'):
            field = 'bitmap'
        rng = a.range if a.range else float(A.get('distanceRange', 0) or 0)
        if not a.image:
            ap.error('--image is required for msdf-atlas-gen JSON')
        pages = load_pages({i: p for i, p in enumerate(a.image)}, os.getcwd(), degrade)
        jobs, size = jobs_from_msdf(meta, font)
        rep['atlas_info'] = {'type': A.get('type'), 'distanceRange': A.get('distanceRange'), 'size_px_per_em': size,
                             'width': A.get('width'), 'height': A.get('height'), 'yOrigin': A.get('yOrigin')}
        kerning = len(meta.get('kerning', []))
        atlas_cps = [int(g['unicode']) for g in meta['glyphs'] if 'unicode' in g]
        chan = {pid: (a.channel if a.channel != 'auto' else auto_channel(p, field)) for pid, p in pages.items()}
        registration = {'method': 'planeBounds (exact, no search)'}
    else:
        fnt = read_bmfont(a.atlas)
        rep['format'] = fnt['format']
        df = fnt['distanceField'] or {}
        field = a.field if a.field != 'auto' else (df.get('fieldType') or 'bitmap')
        rng = a.range if a.range else float(df.get('distanceRange', 0) or 0)
        if field != 'bitmap' and not rng:
            ap.error('SDF atlas without distanceRange: pass --range')
        files = dict(fnt['pages'])
        if a.image:
            files = {i: p for i, p in enumerate(a.image)}
            base_pages = os.getcwd()
        else:
            base_pages = base_dir
        pages = load_pages(files, base_pages, degrade)
        kerning = len(fnt['kernings'])
        atlas_cps = [int(c['id']) for c in fnt['chars']]
        chnl0 = next((c.get('chnl') for c in fnt['chars'] if c.get('width', 0) > 0), None)
        chan = {pid: (a.channel if a.channel != 'auto' else auto_channel(p, field, chnl0 if chnl0 not in (15, 0) else None)) for pid, p in pages.items()}
        rep['atlas_info'] = {'info': fnt['info'], 'common': fnt['common'], 'distanceField': fnt['distanceField']}
        inked = [c for c in fnt['chars'] if c.get('width', 0) > 0 and int(c['id']) in font.cmap]
        step = max(1, len(inked) // 24)
        sample_ids = {int(c['id']) for c in inked[::step][:24]}
        if a.em_px:
            em, dx, dy, conv, table, sc = a.em_px, 0.0, 0.0, '--em-px', {}, None
            registration = {'method': 'fixed em px from CLI', 'em_px': em}
        else:
            em, dx, dy, conv, table, sc = register_bmfont(fnt, font, pages, field, rng, chan, sample_ids)
            if a.no_register:
                dx = dy = 0.0
                em = {'em = |size|': abs(float(fnt['info'].get('size', 0)))}.get(conv, em)
            registration = {'method': 'size-convention search + global sub-pixel registration on %d glyphs' % len(sample_ids),
                            'convention': conv, 'convention_scores_mean_abs_err': table,
                            'em_px': round(em, 4), 'dx_px': dx, 'dy_px': dy}
        jobs = jobs_from_bmfont(fnt, font, em, dx, dy)
        jobs_asplaced = jobs_from_bmfont(fnt, font, abs(float(fnt['info'].get('size', 0) or em)), 0, 0)
    rep['field'] = field
    rep['distance_range_px'] = rng if field != 'bitmap' else None
    rep['channel'] = chan
    rep['registration'] = registration

    # --- sample
    ev = [j for j in jobs if j.cp in font.cmap]
    if a.sample and len(ev) > a.sample:
        step = len(ev) / a.sample
        ev = [ev[int(i * step)] for i in range(a.sample)]
    rep['evaluated_glyphs'] = len(ev)

    # --- quality
    q = {}
    scales = [1] if field == 'bitmap' else [float(s) for s in a.scales.split(',')]
    for S in scales:
        key = 'x%g' % S
        q[key] = run_scale(ev, font, pages, field, rng, S, chan)
    if rep['format'] != 'msdf-atlas-gen-json' and not a.em_px:
        evp = [j for j in jobs_asplaced if j.cp in {e.cp for e in ev}]
        q['x%g_as_placed_em_eq_abs_size_no_offset' % scales[0]] = run_scale(evp, font, pages, field, rng, scales[0], chan)
    rep['quality'] = q

    # --- atlas stats
    page_area = sum(p['w'] * p['h'] for p in pages.values())
    rect_area = 0.0
    used = {}
    for j in jobs:
        L, T, R, B = j.rect
        rect_area += (R - L) * (B - T)
        u = used.setdefault(j.page, [1e9, 1e9, -1e9, -1e9])
        u[0] = min(u[0], L); u[1] = min(u[1], T); u[2] = max(u[2], R); u[3] = max(u[3], B)
    used_area = sum((u[2] - u[0]) * (u[3] - u[1]) for u in used.values())
    inked_px = 0
    for pid, p in pages.items():
        ch = chan[pid]
        arr = p['arr']
        if ch == 'median':
            r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
            v = np.maximum(np.minimum(r, g), np.minimum(np.maximum(r, g), b))
            inked_px += int((v > 0.5).sum())
        else:
            v = arr[..., min({'r': 0, 'g': 1, 'b': 2, 'a': 3, 'l': 0}[ch], arr.shape[2] - 1)]
            inked_px += int((v > (0.5 if field != 'bitmap' else 0.0)).sum())
    rep['atlas'] = {
        'pages': len(pages),
        'page_sizes': sorted({'%dx%d' % (p['w'], p['h']) for p in pages.values()}),
        'glyphs_in_atlas': len(set(atlas_cps)),
        'glyph_rects_with_pixels': len(jobs),
        'efficiency_glyph_rect_area_over_page_area': round(rect_area / page_area, 4) if page_area else None,
        'used_area_bbox_over_page_area': round(used_area / page_area, 4) if page_area else None,
        'inked_pixel_fraction': round(inked_px / page_area, 4) if page_area else None,
        'kerning_pairs': kerning,
    }
    if a.charset:
        req = [c for c in open(a.charset, encoding='utf-8-sig').read() if not (ord(c) < 0x20 or 0x7F <= ord(c) < 0xA0 or c in '​﻿')]
        req = sorted(set(ord(c) for c in req))
        have = set(atlas_cps)
        miss = [c for c in req if c not in have]
        nf = [c for c in miss if c not in font.cmap]
        tool = [c for c in miss if c in font.cmap]
        rep['charset'] = {'requested': len(req), 'present': len(req) - len(miss), 'missing': len(miss),
                          'missing_not_in_font': len(nf), 'missing_but_font_has_glyph': len(tool),
                          'missing_not_in_font_chars': ''.join(chr(c) for c in nf[:80]),
                          'missing_but_font_has_glyph_chars': ''.join(chr(c) for c in tool[:80])}
    rep['seconds'] = round(time.time() - t0, 2)
    out = json.dumps(rep, ensure_ascii=False, indent=1)
    if a.json:
        open(a.json, 'w', encoding='utf-8').write(out)
    sys.stdout.reconfigure(encoding='utf-8')
    head = q.get('x%g' % scales[-1]) or {}
    print('%s | field=%s range=%s | glyphs=%d pages=%d eff=%.3f kern=%d | %s' % (
        os.path.basename(a.atlas), field, rng, rep['evaluated_glyphs'], len(pages),
        rep['atlas']['efficiency_glyph_rect_area_over_page_area'] or 0, kerning,
        ' '.join('%s: mean=%.4f p95=%.4f wrong=%.3f%%' % (k, v['mean_abs_err'], v['p95_abs_err'], v['wrong_pct']) for k, v in q.items() if v)))
    if 'charset' in rep:
        print('  charset: requested=%(requested)d present=%(present)d missing=%(missing)d (not in font %(missing_not_in_font)d)' % rep['charset'])
    return rep


if __name__ == '__main__':
    main()
