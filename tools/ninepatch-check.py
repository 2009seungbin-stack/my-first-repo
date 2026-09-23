#!/usr/bin/env python3
"""Independent Android nine-patch (.9.png) reader and validator.

Reads the 1-px frame the way aapt/aapt2 do and reports what an engine would get:
  top row      black ticks  -> horizontal stretch regions (x divs)
  left column  black ticks  -> vertical stretch regions (y divs)
  bottom row   black ticks  -> horizontal content area (padding left/right)
  right column black ticks  -> vertical content area (padding top/bottom)
  bottom/right red (255,0,0,255) ticks -> layout (optical) bounds insets
Frame pixels must be neutral, opaque black (0,0,0,255) or, on bottom/right only, opaque red. Neutral is
alpha 0 (any RGB); if the top-left corner is opaque white, opaque white is neutral instead (aapt2 rule).
Content (padding) lines must be one contiguous run each.
Validated against aapt2 37.0.0 (`aapt2 compile`, npTc/npLb chunks): same stretch regions, padding,
layout bounds and accept/reject decisions on the AOSP and synthetic samples in the P5 scratch area.

It also flags "bad patches" (draw9patch's "Show bad patches"): a stretch region whose pixels are not
uniform along the stretch direction, which smears when stretched. Uniformity is measured as the max
channel difference between each column (x) / row (y) inside a region and the region's first column/row.

Usage:
  python tools/ninepatch-check.py file.9.png [more.9.png ...] [--json out.json] [--tolerance 0]
Exit code 1 if any file has errors.
"""
import argparse, json, sys
import numpy as np
from PIL import Image


def runs(mask):
    """[start, end) runs of True in a 1-D bool array."""
    out, i, n = [], 0, len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j < n and mask[j]:
                j += 1
            out.append([i, j]); i = j
        else:
            i += 1
    return out


def classify(px, allow_red, white_neutral=False):
    """px: (N,4) uint8 -> labels: 't' neutral (transparent, or opaque white when the top-left corner is
    opaque white, as aapt2 allows), 'k' black, 'r' red, 'x' invalid."""
    r, g, b, a = px[:, 0].astype(int), px[:, 1].astype(int), px[:, 2].astype(int), px[:, 3].astype(int)
    lab = np.full(len(px), 'x', dtype='<U1')
    if white_neutral:
        lab[(a == 255) & (r == 255) & (g == 255) & (b == 255)] = 't'
    else:
        lab[a == 0] = 't'
    lab[(a == 255) & (r == 0) & (g == 0) & (b == 0)] = 'k'
    if allow_red:
        lab[(a == 255) & (r == 255) & (g == 0) & (b == 0)] = 'r'
    return lab


def check(path, tol=0):
    rep = {'file': path, 'errors': [], 'warnings': []}
    im = Image.open(path)
    rep['png_mode'] = im.mode
    a = np.asarray(im.convert('RGBA'))
    H, W = a.shape[:2]
    rep['png_size'] = [W, H]
    if W < 3 or H < 3:
        rep['errors'].append('image must be at least 3x3 (1-px frame + content)')
        return rep
    iw, ih = W - 2, H - 2
    rep['image_size'] = [iw, ih]
    if im.mode not in ('RGBA', 'LA', 'P') and not (im.mode == 'RGB'):
        rep['warnings'].append('unusual PNG mode %s' % im.mode)
    if im.mode == 'RGB':
        rep['errors'].append('no alpha channel: the frame cannot be transparent (aapt rejects this)')
    corners = [a[0, 0], a[0, W - 1], a[H - 1, 0], a[H - 1, W - 1]]
    white_neutral = tuple(int(v) for v in a[0, 0]) == (255, 255, 255, 255)
    if white_neutral:
        rep['warnings'].append('opaque-white frame (legacy form accepted by aapt2): white is the neutral frame colour')
    if tuple(int(v) for v in a[0, 0]) != (255, 255, 255, 255) and a[0, 0][3] != 0:
        rep['errors'].append('top-left corner pixel must be transparent or opaque white')
    edges = {
        'top': (a[0, 1:W - 1], False),
        'left': (a[1:H - 1, 0], False),
        'bottom': (a[H - 1, 1:W - 1], True),
        'right': (a[1:H - 1, W - 1], True),
    }
    lab = {}
    for k, (px, red) in edges.items():
        l = classify(px, red, white_neutral)
        lab[k] = l
        bad = np.nonzero(l == 'x')[0]
        if len(bad):
            sample = [list(map(int, px[i])) for i in bad[:4]]
            rep['errors'].append('%s frame: %d pixel(s) neither transparent nor opaque black%s, e.g. at %s = %s'
                                 % (k, len(bad), '/red' if red else '', bad[:4].tolist(), sample))
    sx = runs(lab['top'] == 'k')
    sy = runs(lab['left'] == 'k')
    rep['stretch_x'] = sx
    rep['stretch_y'] = sy
    if not sx:
        rep['warnings'].append('no horizontal stretch marks (top): aapt treats it as one div over the full width')
    if not sy:
        rep['warnings'].append('no vertical stretch marks (left): aapt treats it as one div over the full height')
    if len(sx) > 1:
        rep['warnings'].append('multiple horizontal stretch regions (%d): extra width is shared proportionally between them' % len(sx))
    if len(sy) > 1:
        rep['warnings'].append('multiple vertical stretch regions (%d)' % len(sy))
    if (lab['top'] == 'r').any() or (lab['left'] == 'r').any():
        rep['errors'].append('red layout-bound ticks are only valid on the bottom and right edges')
    # content padding
    px_ = runs(lab['bottom'] == 'k')
    py_ = runs(lab['right'] == 'k')
    pad = {}
    if len(px_) > 1:
        rep['errors'].append('bottom content line must be one contiguous run, found %d' % len(px_))
    if len(py_) > 1:
        rep['errors'].append('right content line must be one contiguous run, found %d' % len(py_))
    if px_:
        pad['left'], pad['right'] = px_[0][0], iw - px_[-1][1]
    elif sx:
        pad['left'], pad['right'] = sx[0][0], iw - sx[-1][1]
        rep['warnings'].append('no bottom content line: padding falls back to the horizontal stretch region')
    if py_:
        pad['top'], pad['bottom'] = py_[0][0], ih - py_[-1][1]
    elif sy:
        pad['top'], pad['bottom'] = sy[0][0], ih - sy[-1][1]
        rep['warnings'].append('no right content line: padding falls back to the vertical stretch region')
    rep['content_padding'] = pad
    rep['content_padding_explicit'] = bool(px_ or py_)
    # layout bounds (optical insets): red ticks from the ends of bottom/right
    lb = {}
    rb = lab['bottom'] == 'r'
    rr = lab['right'] == 'r'
    if rb.any() or rr.any():
        def inset(m):
            s = 0
            while s < len(m) and m[s]: s += 1
            e = 0
            while e < len(m) and m[len(m) - 1 - e]: e += 1
            return s, e
        lb['left'], lb['right'] = inset(rb)
        lb['top'], lb['bottom'] = inset(rr)
        mid = rb[lb['left']:len(rb) - lb['right']].any() or rr[lb['top']:len(rr) - lb['bottom']].any()
        if mid:
            rep['errors'].append('layout-bound (red) ticks must touch the ends of the bottom/right edges')
    rep['layout_bounds'] = lb or None
    # fixed (non-stretch) sizes
    rep['fixed_x'] = iw - sum(e - s for s, e in sx)
    rep['fixed_y'] = ih - sum(e - s for s, e in sy)
    rep['min_size'] = [rep['fixed_x'], rep['fixed_y']]
    # bad patches
    img = a[1:H - 1, 1:W - 1].astype(int)
    bad = []
    for s, e in sx:
        ref = img[:, s:s + 1]
        dev = int(np.abs(img[:, s:e] - ref).max()) if e > s else 0
        if dev > tol:
            bad.append({'axis': 'x', 'region': [s, e], 'max_channel_diff': dev})
    for s, e in sy:
        ref = img[s:s + 1, :]
        dev = int(np.abs(img[s:e, :] - ref).max()) if e > s else 0
        if dev > tol:
            bad.append({'axis': 'y', 'region': [s, e], 'max_channel_diff': dev})
    rep['bad_patches'] = bad
    if bad:
        rep['warnings'].append('%d stretch region(s) are not uniform along the stretch direction (bad patches)' % len(bad))
    # engine-style border values (left, top, right, bottom) from the first/last stretch runs
    if sx and sy:
        rep['borders_ltrb'] = [sx[0][0], sy[0][0], iw - sx[-1][1], ih - sy[-1][1]]
    rep['valid'] = not rep['errors']
    return rep


def main(argv=None):
    ap = argparse.ArgumentParser(description='Android .9.png validator')
    ap.add_argument('files', nargs='+')
    ap.add_argument('--json')
    ap.add_argument('--tolerance', type=int, default=0, help='channel difference allowed inside a stretch region')
    a = ap.parse_args(argv)
    reps = [check(f, a.tolerance) for f in a.files]
    for r in reps:
        print('%s: %s  image=%s stretch_x=%s stretch_y=%s padding=%s layout=%s bad=%d' % (
            r['file'], 'OK' if r.get('valid') else 'INVALID', r.get('image_size'), r.get('stretch_x'), r.get('stretch_y'),
            r.get('content_padding'), r.get('layout_bounds'), len(r.get('bad_patches', []))))
        for e in r['errors']:
            print('  error:', e)
        for w in r['warnings']:
            print('  warn :', w)
    if a.json:
        json.dump(reps if len(reps) > 1 else reps[0], open(a.json, 'w'), indent=1)
    return 1 if any(r['errors'] for r in reps) else 0


if __name__ == '__main__':
    sys.exit(main())
