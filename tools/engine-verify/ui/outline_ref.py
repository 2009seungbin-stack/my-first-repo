"""Exact outline reference for font checks: a glyph's TrueType outline (fontTools, no hinting)
filled with the nonzero winding rule on an 8x8 supersampled grid per pixel.

glyph_coverage(ttf, char, px) -> (coverage HxW float 0..1, (ox, oy)) where (ox, oy) is the pixel
position of the pen origin on the baseline inside the array (x right, y down).
"""
from __future__ import annotations
from functools import lru_cache
import numpy as np
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

SS = 8


class _Flat(BasePen):
    def __init__(self, gs, steps=12):
        super().__init__(gs)
        self.contours, self.cur, self.steps = [], [], steps

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            a = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3
            self.cur.append((a[0] * p0[0] + a[1] * p1[0] + a[2] * p2[0] + a[3] * p3[0], a[0] * p0[1] + a[1] * p1[1] + a[2] * p2[1] + a[3] * p3[1]))

    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            self.cur.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]))

    def _closePath(self):
        if len(self.cur) > 2:
            self.contours.append(self.cur)
        self.cur = []

    _endPath = _closePath


@lru_cache(maxsize=8)
def _font(path: str):
    f = TTFont(path)
    return f, f.getGlyphSet(), f.getBestCmap(), f['head'].unitsPerEm


def advance(path: str, char: str, px: float) -> float:
    f, gs, cmap, upem = _font(path)
    g = cmap.get(ord(char))
    return gs[g].width * px / upem if g else 0.0


def glyph_coverage(path: str, char: str, px: float, pad: int = 2):
    f, gs, cmap, upem = _font(path)
    g = cmap.get(ord(char))
    if g is None:
        raise KeyError(f'{char!r} is not in {path}')
    pen = _Flat(gs)
    gs[g].draw(pen)
    k = px / upem
    contours = [np.array([(x * k, -y * k) for x, y in c], dtype=np.float64) for c in pen.contours]
    if not contours:
        return np.zeros((1, 1)), (0, 0)
    allp = np.concatenate(contours)
    x0, y0 = np.floor(allp.min(axis=0)).astype(int) - pad
    x1, y1 = np.ceil(allp.max(axis=0)).astype(int) + pad
    W, H = x1 - x0, y1 - y0
    xs = x0 + (np.arange(W * SS) + 0.5) / SS
    ys = y0 + (np.arange(H * SS) + 0.5) / SS
    wind = np.zeros((H * SS, W * SS + 1), dtype=np.int32)
    for c in contours:
        a, b = c, np.roll(c, -1, axis=0)
        for (ax, ay), (bx, by) in zip(a, b):
            if ay == by:
                continue
            d = 1 if by > ay else -1
            lo, hi = min(ay, by), max(ay, by)
            rows = np.nonzero((ys >= lo) & (ys < hi))[0]
            if rows.size == 0:
                continue
            t = (ys[rows] - ay) / (by - ay)
            xc = ax + t * (bx - ax)
            # samples LEFT of the crossing get +d (ray cast to the right)
            col = np.clip(np.ceil((xc - x0) * SS - 0.5).astype(int), 0, W * SS)
            np.add.at(wind, (rows, np.zeros_like(rows)), d)
            np.add.at(wind, (rows, col), -d)
    inside = np.cumsum(wind[:, :-1], axis=1) != 0
    cov = inside.reshape(H, SS, W, SS).mean(axis=(1, 3))
    return cov, (-x0, -y0)
