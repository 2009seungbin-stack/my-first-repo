"""compare.py <out.png> <truth.png>  -> exact-pixel % (best integer shift in [-2,2]^2),
RGBA with alpha<128 == transparent on both sides, RGB ignored under transparency.
Denominator = truth pixel count; out-of-bounds pixels count as mismatches."""
import sys, json
import numpy as np
from PIL import Image


def load(p):
    a = np.asarray(Image.open(p).convert('RGBA')).astype(np.int32)
    op = a[..., 3] >= 128
    return a[..., :3], op


def score(out, truth):
    orgb, oop = load(out)
    trgb, top = load(truth)
    H, W = top.shape
    best = None
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            ok = 0
            ys0, ys1 = max(0, -dy), min(H, orgb.shape[0] - dy)
            xs0, xs1 = max(0, -dx), min(W, orgb.shape[1] - dx)
            if ys1 > ys0 and xs1 > xs0:
                t_op = top[ys0:ys1, xs0:xs1]
                o_op = oop[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
                t_c = trgb[ys0:ys1, xs0:xs1]
                o_c = orgb[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
                same = (t_op == o_op) & ((~t_op) | np.all(t_c == o_c, axis=-1))
                ok = int(same.sum())
                okop = int((same & t_op).sum())
            else:
                okop = 0
            if best is None or ok > best[0]:
                best = (ok, dx, dy, okop)
    ocols = len({tuple(c) for c in orgb[oop].tolist()})
    tcols = len({tuple(c) for c in trgb[top].tolist()})
    return {'out_size': [int(orgb.shape[1]), int(orgb.shape[0])], 'truth_size': [W, H],
            'size_ok': [int(orgb.shape[1]), int(orgb.shape[0])] == [W, H],
            'exact_pct': round(100.0 * best[0] / (W * H), 3), 'shift': list(best[1:3]),
            'opaque_exact_pct': round(100.0 * best[3] / max(1, int(top.sum())), 3),
            'colours_out': ocols, 'colours_truth': tcols}


if __name__ == '__main__':
    print(json.dumps(score(sys.argv[1], sys.argv[2])))
