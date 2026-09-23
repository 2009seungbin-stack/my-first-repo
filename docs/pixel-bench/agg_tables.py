"""Per-kind aggregate tables (markdown) from scores/<tool>.json written by score.py.

    python agg_tables.py [tool ...]      (default: every scores/*.json)

Columns: n, failed, size_exact %, size_pm1 % (failed = miss), median scale_err (successful cases),
mean acc and mean acc_tol (failed = 0), mean dE and mean fringe % (successful cases), mean time_ms (all cases with a time).
"""
import glob, json, os, statistics, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
KINDS = ['nearest-int', 'nearest-frac', 'smooth-resample', 'jpeg', 'blur', 'ai-sim']


def f(v, p=1):
    return '-' if v is None else ('%.' + str(p) + 'f') % v


def row(name, rows):
    n = len(rows)
    ok = [r for r in rows if not r['failed']]
    mean = lambda k, src: (float(np.mean([r[k] for r in src if r.get(k) is not None])) if any(r.get(k) is not None for r in src) else None)
    se = [r['scale_err'] for r in ok if r.get('scale_err') is not None]
    return '| %s | %d | %d | %s | %s | %s | %s | %s | %s | %s | %s |' % (
        name, n, n - len(ok),
        f(100.0 * sum(1 for r in ok if r.get('size_exact')) / n, 0),
        f(100.0 * sum(1 for r in ok if r.get('size_pm1')) / n, 0),
        f(statistics.median(se) if se else None, 3),
        f(100 * np.mean([0.0 if r['failed'] else r.get('acc', 0.0) for r in rows])),
        f(100 * np.mean([0.0 if r['failed'] else r.get('acc_tol', 0.0) for r in rows])),
        f(mean('dE', ok), 3), f(mean('fringe_pct', ok)), f(mean('time_ms', rows), 0))


def table(tool):
    s = json.load(open(os.path.join(HERE, 'scores', tool + '.json')))
    rows = [r for r in s['cases'] if r['kind'] != 'ai-real']
    out = ['#### %s' % tool, '',
           '| kind | n | fail | size exact % | size ±1 % | median scale_err | mean acc % | mean acc_tol % | mean dE | fringe % | mean ms |',
           '|---|---|---|---|---|---|---|---|---|---|---|',
           row('**overall**', rows)]
    for k in KINDS:
        out.append(row(k, [r for r in rows if r['kind'] == k]))
    out.append(row('phase (tag)', [r for r in rows if 'phase' in r.get('tags', [])]))
    ai = [r for r in s['cases'] if r['kind'] == 'ai-real']
    out += ['', 'ai-real (no truth): ' + ', '.join('%s %s/%sc' % (r['id'][3:], 'x'.join(map(str, r['output'])) if r.get('output') else 'FAIL',
                                                            r.get('out_colours')) for r in ai), '']
    return '\n'.join(out)


if __name__ == '__main__':
    tools = sys.argv[1:] or sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(HERE, 'scores', '*.json')))
    print('\n'.join(table(t) for t in tools))
