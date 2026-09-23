"""Shared pieces of the UI engine verifiers (nine-slice and fonts): the nerulio-ui bundle reader,
the reference nine-slice renderer and the pixel comparison.

Reference renderer
==================
Every engine here draws a nine-slice with NEAREST filtering, so each destination pixel shows exactly
one source texel. Which texel is decided per axis: the pixel centre `c = x + 0.5` is mapped to a
source coordinate `u` and the texel is `floor(u)`. An axis is described by *segments*
`(lo, hi, clip_lo, clip_hi, s_lo, s_hi, region)`: destination `[lo, hi)` maps linearly onto source
`[s_lo, s_hi)`, but only the part inside `[clip_lo, clip_hi)` is drawn (a partial tile). Segments
are listed in priority order and the first one that covers `c` wins, which models both a shader
that tests `pixel < margin_begin` first (Godot) and geometry drawn in order where the last quad
wins (Phaser). `region` is 0 (begin border), 1 (middle) or 2 (end border); a pixel whose two axes
are both in the middle is the centre and is left transparent when drawCenter is false.

A *profile* says how an engine builds the segments: how corners are squashed when the target is
smaller than the two borders, where partial tiles go, how tile-fit rounds, and which segment wins
where they overlap. The profiles below were first written from each engine's source or spec and
then confirmed (or corrected) by the measurements in verify_ui.py; the docstring of PROFILES says
which is which.

Ties: a pixel centre that lies exactly on a segment or texel boundary (e.g. corners at 1.5x end at
x = 7.5) is decided by the rasteriser's fill rule or float round-off, which differs between GPUs.
The reference is therefore also rendered with the pixel centre moved by +-TIE_EPS on each axis,
and an engine pixel counts as right if it equals any of those renders. The number of such pixels
is reported separately (`tiePixels`).
"""
from __future__ import annotations
import json, math
from dataclasses import dataclass, field
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
EV = HERE.parent
TIE_EPS = 0.01

# ---------------------------------------------------------------- bundle


def find_bundle_json(folder: Path) -> Path | None:
    for p in sorted(folder.rglob('nerulio-ui.json')):
        return p
    return None


def load_bundle(folder: Path) -> tuple[Path, dict]:
    """(json path, data). Accepts the folder or the json itself."""
    folder = Path(folder)
    js = folder if folder.suffix == '.json' else find_bundle_json(folder)
    if js is None:
        raise FileNotFoundError(f'no nerulio-ui.json under {folder}')
    data = json.loads(js.read_text(encoding='utf-8-sig'))
    if data.get('format') != 'nerulio-ui':
        raise ValueError(f'{js} is not a nerulio-ui bundle (format={data.get("format")!r})')
    return js, data


def element_pixels(js: Path, data: dict, name: str) -> np.ndarray:
    """The element's source rect as an RGBA uint8 array (rows top-down)."""
    el = data['elements'][name]
    img = data['images'][el['image']]
    im = Image.open(js.parent / img['file']).convert('RGBA')
    r = el['rect']
    return np.asarray(im.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), dtype=np.uint8).copy()


def sides(d: dict | None) -> tuple[int, int, int, int]:
    d = d or {}
    return int(d.get('left', 0)), int(d.get('right', 0)), int(d.get('top', 0)), int(d.get('bottom', 0))


# ---------------------------------------------------------------- profiles

@dataclass
class Profile:
    name: str
    squash: str                      # 'floor' | 'prop' | 'uniform' | 'none'
    priority: str                    # 'first' (begin, end, middle) | 'last' (end, middle, begin) - see module doc
    align: tuple = ('start', 'start')  # partial-tile placement per axis (x, y) in top-left image coordinates
    modes: tuple = ('stretch', 'tile', 'tile-fit')  # what the engine can express
    center_optional: bool = True     # can the engine skip the centre (drawCenter false)?
    per_axis_modes: bool = True      # can horizontal and vertical modes differ?
    notes: str = ''


PROFILES: dict[str, Profile] = {
    # The Studio's own plan (src/game/nine-slice.js): corners squash to floor(D*L/(L+R)), tiles start
    # at the top-left border and the last one is clipped. tile-fit is defined like Godot's TILE_FIT.
    'plan': Profile('plan', 'floor', 'first', ('start', 'start')),
    # Godot 4 canvas shader map_ninepatch_axis(): begin margin tested first, then end, then middle;
    # margins are never squashed (a too-small target clips the end border); TILE starts at the begin
    # margin; TILE_FIT uses max(1, floor(area/tile + 0.5)) tiles, stretched to fit.
    'godot': Profile('godot', 'none', 'first', ('start', 'start')),
    # Unity UI Image: GetAdjustedBorders scales both borders of an axis by rect/(L+R) (float) when they
    # do not fit; Tiled starts at the rect's xMin/yMin, i.e. at the BOTTOM-left, so vertically the
    # partial tile is at the top. No tile-fit, one Image.Type for both axes.
    'unity': Profile('unity', 'prop', 'first', ('start', 'end'), modes=('stretch', 'tile'), per_axis_modes=False),
    # PixiJS 8 NineSliceGeometry: one scale min(w/(L+R), h/(T+B), 1) for all four borders; no tiling,
    # the centre is always drawn.
    'pixi8': Profile('pixi8', 'uniform', 'first', modes=('stretch',), center_optional=False, per_axis_modes=False),
    # Phaser NineSlice: nine quads drawn TL,T,TR,L,C,R,BL,B,BR, borders never squashed (a too-small
    # object overlaps its quads; the middle quad turns inside out); no tiling; centre always drawn.
    'phaser3': Profile('phaser3', 'none', 'last', modes=('stretch',), center_optional=False, per_axis_modes=False),
    'phaser4': Profile('phaser4', 'none', 'last', modes=('stretch',), center_optional=False, per_axis_modes=False),
    # CSS border-image (css-backgrounds-3): all four widths scaled by one factor when they overlap;
    # `repeat` centres the tiles in the area, `round` rounds the count, `space` distributes gaps.
    'css': Profile('css', 'uniform', 'first', ('center', 'center'), modes=('stretch', 'tile', 'tile-fit', 'space')),
}


# ---------------------------------------------------------------- reference renderer

def _squash(profile: Profile, S, b0, b1, D, k):
    """Per-axis destination border sizes (A, B) for one axis."""
    A, B = b0 * k, b1 * k
    if A + B <= D or profile.squash == 'none':
        return A, B
    if profile.squash == 'floor':
        A = math.floor(D * A / (A + B)) if A + B else 0
        return A, D - A
    if profile.squash == 'prop':
        s = D / (A + B)
        return A * s, B * s
    return A, B  # 'uniform' is applied in two dimensions by the caller


def axis_segments(profile: Profile, S, b0, b1, D, k, mode, align, A=None, B=None, tile_scale=None):
    if A is None:
        A, B = _squash(profile, S, b0, b1, D, k)
    ts = k if tile_scale is None else tile_scale
    M = S - b0 - b1
    begin = (0.0, A, 0.0, A, 0.0, float(b0), 0)
    end = (D - B, float(D), D - B, float(D), float(S - b1), float(S), 2)
    mid = []
    lo, hi = A, D - B
    W = hi - lo
    if M > 0 and W != 0:
        if mode == 'stretch' or W < 0:
            mid.append((lo, hi, min(lo, hi), max(lo, hi), float(b0), float(S - b1), 1))
        else:
            T = M * ts
            if mode == 'tile-fit':
                n = max(1, math.floor(W / T + 0.5))
                T2 = W / n
                for i in range(n):
                    mid.append((lo + i * T2, lo + (i + 1) * T2, lo, hi, float(b0), float(S - b1), 1))
            elif mode == 'space':
                n = math.floor(W / T + 1e-9)
                if n > 0:
                    gap = (W - n * T) / (n + 1)
                    for i in range(n):
                        t0 = lo + gap + i * (T + gap)
                        mid.append((t0, t0 + T, lo, hi, float(b0), float(S - b1), 1))
            else:
                if align == 'start':
                    first = lo
                elif align == 'end':
                    first = hi - math.ceil(W / T - 1e-9) * T
                elif align == 'center':
                    first = lo + (W - T) / 2
                    first -= math.ceil((first - lo) / T - 1e-9) * T
                else:
                    raise ValueError(align)
                t0 = first
                while t0 < hi - 1e-9:
                    mid.append((t0, t0 + T, lo, hi, float(b0), float(S - b1), 1))
                    t0 += T
    if profile.priority == 'first':
        return [begin, end] + mid
    return [end] + mid + [begin]


def _eval_axis(segs, centres, S):
    """For each pixel centre: (texel index or -1, region or -1)."""
    tex = np.full(centres.shape, -1, dtype=np.int64)
    reg = np.full(centres.shape, -1, dtype=np.int64)
    done = np.zeros(centres.shape, dtype=bool)
    for lo, hi, clo, chi, s0, s1, region in segs:
        if chi <= clo or hi == lo:
            continue
        inside = (~done) & (centres >= clo) & (centres < chi) & (centres >= min(lo, hi)) & (centres < max(lo, hi))
        if not inside.any():
            continue
        u = s0 + (centres[inside] - lo) / (hi - lo) * (s1 - s0)
        tex[inside] = np.clip(np.floor(u + 1e-9), 0, S - 1).astype(np.int64)
        reg[inside] = region
        done |= inside
    return tex, reg


def render(src: np.ndarray, border, W: int, H: int, scale: float, mode_h: str, mode_v: str, draw_center: bool,
           profile: Profile, offset=(0.0, 0.0)) -> np.ndarray:
    """Reference image (H, W, 4) uint8 of one nine-slice. `border` = (left, right, top, bottom) in source
    pixels, `scale` multiplies the border (and tile) size on screen, `offset` moves every pixel centre
    (used for tie handling)."""
    h, w = src.shape[:2]
    L, R, T, Bm = border
    Ax, Bx = _squash(profile, w, L, R, W, scale)
    Ay, By = _squash(profile, h, T, Bm, H, scale)
    tsx = tsy = scale
    if profile.squash == 'uniform':
        f = min(1.0, W / ((L + R) * scale) if L + R else 1.0, H / ((T + Bm) * scale) if T + Bm else 1.0)
        Ax, Bx, Ay, By = L * scale * f, R * scale * f, T * scale * f, Bm * scale * f
        tsx = tsy = scale * f
    sx = axis_segments(profile, w, L, R, W, scale, mode_h, profile.align[0], Ax, Bx, tsx)
    sy = axis_segments(profile, h, T, Bm, H, scale, mode_v, profile.align[1], Ay, By, tsy)
    tx, rx = _eval_axis(sx, np.arange(W) + 0.5 + offset[0], w)
    ty, ry = _eval_axis(sy, np.arange(H) + 0.5 + offset[1], h)
    out = src[np.clip(ty, 0, h - 1)][:, np.clip(tx, 0, w - 1)].copy()
    hole = (ty[:, None] < 0) | (tx[None, :] < 0)
    if not draw_center:
        hole |= (ry[:, None] == 1) & (rx[None, :] == 1)
    out[hole] = 0
    return out


def render_variants(src, border, W, H, scale, mode_h, mode_v, draw_center, profile):
    """The reference at the pixel centre and nudged by +-TIE_EPS (see module doc)."""
    base = render(src, border, W, H, scale, mode_h, mode_v, draw_center, profile)
    vs = [base]
    for dx in (-TIE_EPS, TIE_EPS):
        for dy in (-TIE_EPS, TIE_EPS):
            vs.append(render(src, border, W, H, scale, mode_h, mode_v, draw_center, profile, (dx, dy)))
    return base, vs


# ---------------------------------------------------------------- comparison

def _premul(a: np.ndarray) -> np.ndarray:
    f = a.astype(np.float32)
    return np.concatenate([f[..., :3] * f[..., 3:4] / 255.0, f[..., 3:4]], axis=-1)


def pixel_ok(expected: np.ndarray, actual: np.ndarray, tol=2, soft_tol=8) -> np.ndarray:
    """Per-pixel equality in premultiplied space (ev_common.diff's rules: opaque pixels within `tol`,
    semi-transparent within `soft_tol`, colour of invisible pixels ignored)."""
    pe, pa = _premul(expected), _premul(actual)
    m = np.abs(pe - pa).max(axis=-1)
    ea, aa = expected[..., 3].astype(np.float32), actual[..., 3].astype(np.float32)
    soft = (np.minimum(ea, aa) < 255) & (np.maximum(ea, aa) > 0)
    limit = np.where(soft, soft_tol, tol) + 0.5
    faint = np.maximum(ea, aa) < 16
    limit = np.where(faint, np.maximum(limit, np.maximum(ea, aa) + 0.5), limit)
    return m <= limit


def compare(variants: list[np.ndarray], actual: np.ndarray, tol=2, soft_tol=8) -> dict:
    base = variants[0]
    if actual.shape != base.shape:
        return {'ok': False, 'size': [list(base.shape[1::-1]), list(actual.shape[1::-1])], 'wrong': None}
    strict = pixel_ok(base, actual, tol, soft_tol)
    anyok = strict.copy()
    for v in variants[1:]:
        anyok |= pixel_ok(v, actual, tol, soft_tol)
    wrong = int((~anyok).sum())
    d = np.abs(_premul(base) - _premul(actual)).max(axis=-1)
    out = {'ok': wrong == 0, 'pixels': int(base.shape[0] * base.shape[1]), 'wrong': wrong,
           'tiePixels': int((anyok & ~strict).sum()), 'maxDelta': int(round(float(d[~anyok].max()))) if wrong else 0}
    if wrong:
        ys, xs = np.nonzero(~anyok)
        out['firstWrong'] = [int(xs[0]), int(ys[0])]
        out['wrongBox'] = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
    return out


def to_array(path_or_image) -> np.ndarray:
    im = path_or_image if isinstance(path_or_image, Image.Image) else Image.open(path_or_image)
    return np.asarray(im.convert('RGBA'), dtype=np.uint8).copy()


def unpremultiply(a: np.ndarray) -> np.ndarray:
    f = a.astype(np.float32)
    al = f[..., 3:4]
    f[..., :3] = np.where(al > 0, np.clip(f[..., :3] * 255.0 / np.maximum(al, 1), 0, 255), 0)
    return np.round(f).astype(np.uint8)


# ---------------------------------------------------------------- cases

def standard_sizes(w: int, h: int, border) -> list[tuple[int, int, float, str]]:
    """Target sizes (device pixels) and scales every element is drawn at: (W, H, scale, label)."""
    L, R, T, B = border
    out = [(w, h, 1, 'equal'),
           (max(1, L + R + 3), max(1, T + B + 5), 1, 'small'),
           (3 * w + 7, 2 * h + 3, 1, 'large-odd'),
           (2 * w + 9, 2 * h + 5, 2, '2x-odd'),
           (3 * w + 10, 3 * h + 2, 3, '3x'),
           (int(1.5 * w) + 7, int(1.5 * h) + 3, 1.5, '1.5x')]
    if L + R > 2 and T + B > 2:
        out.append((max(1, (L + R) * 6 // 10), max(1, (T + B) * 7 // 10), 1, 'squash'))
    elif L + R > 2:
        out.append((max(1, (L + R) * 6 // 10), h, 1, 'squash'))
    return out


def cases_for(data: dict, js: Path | None = None) -> list[dict]:
    """Every (element, size, scale) the verifier draws: the standard sizes plus the bundle's previews."""
    cases = []
    for name, el in data['elements'].items():
        b = sides(el.get('nineSlice'))
        for W, H, s, label in standard_sizes(el['rect']['w'], el['rect']['h'], b):
            cases.append({'id': f'{name}@{W}x{H}@{s:g}', 'element': name, 'w': W, 'h': H, 'scale': s, 'label': label})
    for p in data.get('previews') or []:
        s = p.get('scale', 1)
        cid = f'{p["element"]}@{p["w"]}x{p["h"]}@{s:g}'
        if not any(c['id'] == cid for c in cases):
            cases.append({'id': cid, 'element': p['element'], 'w': int(p['w']), 'h': int(p['h']), 'scale': s, 'label': 'preview'})
    return cases


def element_modes(el: dict) -> tuple[str, str]:
    st = el.get('stretch') or {}
    return st.get('horizontal', 'stretch'), st.get('vertical', 'stretch')


def expected_for(js: Path, data: dict, case: dict, profile: Profile, cache: dict | None = None):
    el = data['elements'][case['element']]
    key = case['element']
    if cache is not None and key in cache:
        src = cache[key]
    else:
        src = element_pixels(js, data, case['element'])
        if cache is not None:
            cache[key] = src
    mh, mv = element_modes(el)
    return render_variants(src, sides(el.get('nineSlice')), case['w'], case['h'], case['scale'], mh, mv,
                           el.get('drawCenter', True), profile)


def supported(profile: Profile, el: dict) -> str | None:
    """None when the engine can express the element's settings, else why not."""
    mh, mv = element_modes(el)
    for m in (mh, mv):
        if m not in profile.modes:
            return f'{profile.name} has no "{m}" nine-slice mode'
    if mh != mv and not profile.per_axis_modes:
        return f'{profile.name} cannot use different horizontal/vertical modes'
    if not el.get('drawCenter', True) and not profile.center_optional:
        return f'{profile.name} always draws the centre'
    return None
