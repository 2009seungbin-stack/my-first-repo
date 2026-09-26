"""Tool-agnostic scoring harness for the Nerulio Studio pixel-cleanup benchmark.

    python score.py <tool-name> <out-dir> [--data DATA_DIR] [--quiet]

<out-dir> must contain <case-id>.png (the tool's 1x result) and optionally <case-id>.json with any of
{detected_scale: number | [sx, sy], time_ms: number, error: string|null}. Missing PNG = failed case.
Writes scores/<tool-name>.json next to this file and prints a table.

Per case with truth (DATA/cases.json, kind != 'ai-real'):
  size_exact   output w x h == width1x x height1x (or one of altSizes: phase-cropped cases may drop the partial first cell)
  size_pm1     |dw| <= 1 and |dh| <= 1 (against width1x/height1x or any altSize)
  scale_err    |est - true| / true, est = detected_scale from the json when given, else input size / output size
               (mean of x and y); true = scaleX/scaleY
  acc          exact-pixel accuracy: best over integer shifts (dx, dy) in [-2, 2]^2 of
               (#matching pixels in the overlap) / (width1x * height1x). Pixels match when both are transparent
               (alpha < 128) or both opaque with identical RGB. If the output has no alpha channel (tool drops
               alpha) the truth is composited on the case background (or, for transparent cases, on the RGB the
               degraded input stores under alpha=0, i.e. what an alpha-blind tool sees).
  acc_tol      same, but opaque pixels also match when Oklab deltaE <= 0.02 (perceptually identical; useful for
               jpeg / ai-sim where the exact truth RGB cannot be recovered). Best shift chosen separately.
  alpha_err    % of overlap pixels whose opaque/transparent state differs (at the best shift)
  colour_ratio opaque output colours / truth colours
  dE           mean Oklab deltaE (Euclidean, L in 0..1) over pixels opaque in both, at the best shift
  fringe       output opaque pixels whose colour is farther than deltaE 0.02 from every truth colour (count and %)
For 'ai-real' cases only output size, colour count and time are reported.
"""
import argparse, json, os, statistics, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATA = r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-pixel'
KINDS = ['nearest-int', 'nearest-frac', 'smooth-resample', 'jpeg', 'blur', 'ai-sim']
FRINGE_DE = 0.02
SCALE_OK = 0.03


def srgb_to_oklab(rgb):
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    lms = np.cbrt(c @ M1.T)
    return lms @ M2.T


def load_rgba(path):
    im = Image.open(path)
    has_alpha = im.mode in ('RGBA', 'LA', 'PA', 'RGBa') or (im.mode == 'P' and 'transparency' in im.info) or \
        (im.mode in ('RGB', 'L') and 'transparency' in im.info)
    return np.array(im.convert('RGBA')), has_alpha


def implicit_bg(case, data):
    if case.get('background'):
        return tuple(case['background'])
    a = np.array(Image.open(os.path.join(data, case['path'])).convert('RGBA'))
    m = a[..., 3] == 0
    if m.any():
        return tuple(int(v) for v in np.median(a[m][:, :3], axis=0))
    return (0, 0, 0)


def composite(t, bg):
    a = t[..., 3:4].astype(np.float64) / 255.0
    rgb = t[..., :3] * a + np.array(bg, np.float64) * (1 - a)
    out = np.empty_like(t)
    out[..., :3] = np.rint(rgb).astype(np.uint8)
    out[..., 3] = 255
    return out


def opaque_colours(a):
    p = a.reshape(-1, 4)
    p = p[p[:, 3] >= 128][:, :3]
    return np.unique(p, axis=0) if len(p) else np.zeros((0, 3), np.uint8)


def compare(t, o):
    """Best integer shift in [-2,2]^2. Returns dict of metrics at that shift."""
    th, tw = t.shape[:2]
    oh, ow = o.shape[:2]
    tt = t[..., 3] >= 128
    oo = o[..., 3] >= 128
    best = None
    best_tol = 0
    lab_t = srgb_to_oklab(t[..., :3])
    lab_o = srgb_to_oklab(o[..., :3])
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            # truth (y, x) <-> output (y + dy, x + dx)
            y0, y1 = max(0, -dy), min(th, oh - dy)
            x0, x1 = max(0, -dx), min(tw, ow - dx)
            if y1 <= y0 or x1 <= x0:
                continue
            ts = t[y0:y1, x0:x1]
            os_ = o[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
            to = tt[y0:y1, x0:x1]
            oo_ = oo[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
            both_t = ~to & ~oo_
            both_o = to & oo_
            eq = both_o & (ts[..., :3] == os_[..., :3]).all(-1)
            m = int(both_t.sum() + eq.sum())
            d = np.sqrt(((lab_t[y0:y1, x0:x1] - lab_o[y0 + dy:y1 + dy, x0 + dx:x1 + dx]) ** 2).sum(-1))
            best_tol = max(best_tol, int(both_t.sum() + (both_o & (d <= FRINGE_DE)).sum()))
            if best is None or m > best[0]:
                best = (m, dx, dy, ts, os_, both_o, to != oo_)
    if best is None:
        return dict(matches=0, shift=None, acc=0.0, acc_tol=0.0, alpha_err=None, dE=None)
    m, dx, dy, ts, os_, both_o, amis = best
    dE = None
    if both_o.any():
        la = srgb_to_oklab(ts[..., :3][both_o])
        lb = srgb_to_oklab(os_[..., :3][both_o])
        dE = float(np.sqrt(((la - lb) ** 2).sum(-1)).mean())
    return dict(matches=m, shift=[dx, dy], acc=m / float(th * tw), acc_tol=best_tol / float(th * tw), alpha_err=float(amis.mean() * 100), dE=dE)


def fringe(o, truth_pal):
    oc, counts = np.unique(o.reshape(-1, 4)[o.reshape(-1, 4)[:, 3] >= 128][:, :3], axis=0, return_counts=True)
    if len(oc) == 0:
        return 0, 0.0
    if len(truth_pal) == 0:
        return int(counts.sum()), 100.0
    lo = srgb_to_oklab(oc)
    lt = srgb_to_oklab(truth_pal)
    d = np.sqrt(((lo[:, None, :] - lt[None, :, :]) ** 2).sum(-1)).min(1)
    bad = int(counts[d > FRINGE_DE].sum())
    return bad, bad / float(counts.sum()) * 100


def score_case(case, data, outdir):
    r = dict(id=case['id'], kind=case['kind'], tags=case.get('tags', []))
    png = os.path.join(outdir, case['id'] + '.png')
    meta = {}
    mj = os.path.join(outdir, case['id'] + '.json')
    if os.path.exists(mj):
        try:
            meta = json.load(open(mj))
        except Exception:
            meta = {}
    r['time_ms'] = meta.get('time_ms')
    r['tool_error'] = meta.get('error')
    if not os.path.exists(png):
        r['failed'] = True
        return r
    o, has_alpha = load_rgba(png)
    oh, ow = o.shape[:2]
    r['failed'] = False
    r['output'] = [ow, oh]
    r['out_colours'] = int(len(opaque_colours(o)))
    r['drops_alpha'] = not has_alpha
    if case['kind'] == 'ai-real':
        return r
    t, _ = load_rgba(os.path.join(data, case['source1x']))
    t = t.copy()
    t[t[..., 3] < 128] = 0
    t[t[..., 3] >= 128, 3] = 255
    if not has_alpha and (t[..., 3] < 128).any():
        bg = implicit_bg(case, data)
        t = composite(t, bg)
        r['compared_on_bg'] = list(bg)
    w1, h1 = case['width1x'], case['height1x']
    sizes = [[w1, h1]] + [s for s in case.get('altSizes', []) if s != [w1, h1]]
    r['size_exact'] = [ow, oh] in sizes
    r['size_pm1'] = any(abs(ow - s[0]) <= 1 and abs(oh - s[1]) <= 1 for s in sizes)
    ds = meta.get('detected_scale')
    if isinstance(ds, (int, float)) and ds:
        est = (float(ds), float(ds)); r['scale_src'] = 'tool'
    elif isinstance(ds, (list, tuple)) and len(ds) == 2 and all(isinstance(v, (int, float)) for v in ds):
        est = (float(ds[0]), float(ds[1])); r['scale_src'] = 'tool'
    else:
        est = (case['width'] / ow, case['height'] / oh); r['scale_src'] = 'inferred'
    r['scale_est'] = [round(est[0], 4), round(est[1], 4)]
    r['scale_err'] = (abs(est[0] - case['scaleX']) / case['scaleX'] + abs(est[1] - case['scaleY']) / case['scaleY']) / 2
    r['scale_ok'] = r['scale_err'] <= SCALE_OK
    cm = compare(t, o)
    r.update(acc=cm['acc'], acc_tol=cm['acc_tol'], shift=cm['shift'], alpha_err=cm['alpha_err'], dE=cm['dE'])
    tp = opaque_colours(t)
    r['truth_colours'] = int(len(tp))
    r['colour_ratio'] = r['out_colours'] / max(1, len(tp))
    fb, fp = fringe(o, tp)
    r['fringe_px'] = fb
    r['fringe_pct'] = fp
    return r


def agg(rows):
    n = len(rows)
    ok = [r for r in rows if not r['failed']]

    def mean(key, src=ok):
        v = [r[key] for r in src if r.get(key) is not None]
        return float(np.mean(v)) if v else None

    def med(key, src=ok):
        v = [r[key] for r in src if r.get(key) is not None]
        return float(statistics.median(v)) if v else None
    return dict(
        n=n, failed=n - len(ok),
        acc_mean=float(np.mean([r.get('acc', 0.0) if not r['failed'] else 0.0 for r in rows])) if n else None,
        acc_median=float(statistics.median([r.get('acc', 0.0) if not r['failed'] else 0.0 for r in rows])) if n else None,
        acc_tol_mean=float(np.mean([r.get('acc_tol', 0.0) if not r['failed'] else 0.0 for r in rows])) if n else None,
        perfect=sum(1 for r in ok if r.get('acc') == 1.0),
        size_exact_pct=100.0 * sum(1 for r in ok if r.get('size_exact')) / n if n else None,
        size_pm1_pct=100.0 * sum(1 for r in ok if r.get('size_pm1')) / n if n else None,
        scale_ok_pct=100.0 * sum(1 for r in ok if r.get('scale_ok')) / n if n else None,
        scale_err_median=med('scale_err'),
        colour_ratio_mean=mean('colour_ratio'),
        dE_mean=mean('dE'),
        fringe_pct_mean=mean('fringe_pct'),
        alpha_err_mean=mean('alpha_err'),
        time_ms_median=med('time_ms', rows),
    )


def fmt(v, p=1, pct=False):
    if v is None:
        return '-'
    return ('%.' + str(p) + 'f') % (v * 100 if pct else v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('tool')
    ap.add_argument('outdir')
    ap.add_argument('--data', default=DEFAULT_DATA)
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args()
    cases = json.load(open(os.path.join(a.data, 'cases.json')))['cases']
    rows = [score_case(c, a.data, a.outdir) for c in cases]
    truth_rows = [r for r in rows if r['kind'] != 'ai-real']
    aggs = {k: agg([r for r in truth_rows if r['kind'] == k]) for k in KINDS}
    aggs['phase(tag)'] = agg([r for r in truth_rows if 'phase' in r['tags']])
    aggs['overall'] = agg(truth_rows)
    ai = [dict(id=r['id'], output=r.get('output'), out_colours=r.get('out_colours'), time_ms=r.get('time_ms'), failed=r['failed'],
               error=r.get('tool_error')) for r in rows if r['kind'] == 'ai-real']
    os.makedirs(os.path.join(HERE, 'scores'), exist_ok=True)
    res = dict(tool=a.tool, outdir=os.path.abspath(a.outdir), data=os.path.abspath(a.data), n_cases=len(rows),
               aggregates=aggs, ai_real=ai, cases=rows,
               metric_notes=__doc__.strip().split('\n\n', 2)[-1])
    json.dump(res, open(os.path.join(HERE, 'scores', a.tool + '.json'), 'w'), indent=1)

    if not a.quiet:
        for r in truth_rows:
            print('%-40s %-15s out=%-9s acc=%6s tol=%6s size=%s scale_err=%6s dE=%6s cr=%5s fringe=%5s%% %s' % (
                r['id'][:40], r['kind'], 'x'.join(map(str, r['output'])) if r.get('output') else 'FAIL',
                fmt(r.get('acc'), 1, True), fmt(r.get('acc_tol'), 1, True), 'Y' if r.get('size_exact') else ('~' if r.get('size_pm1') else 'N'),
                fmt(r.get('scale_err'), 3), fmt(r.get('dE'), 3), fmt(r.get('colour_ratio'), 2), fmt(r.get('fringe_pct'), 1),
                ('err:' + str(r['tool_error'])[:40]) if r.get('tool_error') else ''))
    print('\n== %s ==' % a.tool)
    print('%-16s %4s %5s %8s %8s %8s %6s %7s %7s %8s %9s %7s %8s %9s %8s' % (
        'kind', 'n', 'fail', 'acc_mean', 'acc_med', 'accTol', 'perf', 'size=%', 'size±1%', 'scaleOK%', 'scaleErrMd', 'colRat', 'dE_mean', 'fringe%', 'ms_med'))
    for k, g in aggs.items():
        print('%-16s %4d %5d %8s %8s %8s %6d %7s %7s %8s %9s %7s %8s %9s %8s' % (
            k, g['n'], g['failed'], fmt(g['acc_mean'], 1, True), fmt(g['acc_median'], 1, True), fmt(g['acc_tol_mean'], 1, True), g['perfect'],
            fmt(g['size_exact_pct'], 0), fmt(g['size_pm1_pct'], 0), fmt(g['scale_ok_pct'], 0), fmt(g['scale_err_median'], 3),
            fmt(g['colour_ratio_mean'], 2), fmt(g['dE_mean'], 3), fmt(g['fringe_pct_mean'], 1), fmt(g['time_ms_median'], 0)))
    if ai:
        print('ai-real:')
        for r in ai:
            print('  %-22s out=%-9s colours=%-5s ms=%s %s' % (r['id'], 'x'.join(map(str, r['output'])) if r['output'] else 'FAIL',
                                                         r['out_colours'], r['time_ms'], r['error'] or ''))


if __name__ == '__main__':
    main()
