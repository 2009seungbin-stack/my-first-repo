"""Pack the head-to-head frame sets with the TexturePacker command-line client (Pro features need a
licence or the 7-day trial; in Essential mode TexturePacker paints sprites red when a Pro feature
is used, and this script refuses to run then).

  python tools/h2h/tp_pack.py [--sets ninja,archer] [--configs rot1-best,...]

Writes $H2H_WORK/pack/tp/<set>/<config>/{sheet*.png,sheet*.json} and $H2H_WORK/pack/tp/runs.json.
"""
import argparse
import json
import subprocess
import time
from pathlib import Path
from h2h_paths import TEXTUREPACKER, SETS, SETS_EXTRA, MAIN_SETS, PACK

# The free-packer run used trim, padding 2 and max 4096. Border padding and extrude are 0 in the
# Studio defaults, so they are 0 here too; "defaults" is what the CLI does when told nothing.
COMMON = ['--format', 'json', '--trim-mode', 'Trim', '--shape-padding', '2', '--border-padding', '0',
          '--extrude', '0', '--max-size', '4096', '--size-constraints', 'AnySize', '--multipack']
BEST = ['--algorithm', 'MaxRects', '--maxrects-heuristics', 'Best', '--pack-mode', 'Best']
CONFIGS = {
    'rot1-best': COMMON + BEST + ['--enable-rotation'],
    'rot0-best': COMMON + BEST + ['--disable-rotation'],
    'rot1-good': COMMON + ['--algorithm', 'MaxRects', '--maxrects-heuristics', 'Best', '--pack-mode', 'Good', '--enable-rotation'],
    'rot1-square': COMMON + BEST + ['--enable-rotation', '--force-squared'],
    'rot0-pot': COMMON[:-3] + ['--size-constraints', 'POT', '--multipack'] + BEST + ['--disable-rotation'],
    'polygon': ['--format', 'json', '--algorithm', 'Polygon', '--trim-mode', 'Polygon', '--shape-padding', '2', '--border-padding', '0',
                '--extrude', '0', '--max-size', '4096', '--size-constraints', 'AnySize', '--multipack', '--pack-mode', 'Best', '--enable-rotation'],
    'defaults': ['--format', 'json'],
}
EXTRA = {
    'ninja_dup3': ('rot0-best', []),
    'archer_x8': ('rot0-best', ['--max-size', '2048']),
    'archer_x8-noalias': ('rot0-best', ['--max-size', '2048', '--disable-auto-alias']),
}


def tp(args, log):
    t0 = time.perf_counter()
    r = subprocess.run([TEXTUREPACKER, *args], capture_output=True, text=True)
    ms = round((time.perf_counter() - t0) * 1000)
    out = (r.stdout or '') + (r.stderr or '')
    log.write_text(out)
    if 'Essential (lite) mode' in out or 'colored red' in out:
        raise SystemExit('TexturePacker runs in Essential mode: Pro features would paint sprites red. Activate the trial first.')
    if r.returncode:
        raise SystemExit(f'TexturePacker failed ({r.returncode}): {out[-800:]}')
    return ms, out


def run(src, dst, args):
    dst.mkdir(parents=True, exist_ok=True)
    for f in dst.glob('sheet*'):
        f.unlink()
    # {n} keeps multipack names predictable: sheet-0.png, sheet-1.png ...
    ms, out = tp([str(src), '--sheet', str(dst / 'sheet-{n}.png'), '--data', str(dst / 'sheet-{n}.json'), *args, '--force-publish'], dst / 'tp.log')
    sheets = sorted(dst.glob('sheet-*.json'))
    return {'ms': ms, 'jsons': [s.name for s in sheets], 'out_tail': out.strip().splitlines()[-3:]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sets', default=','.join(MAIN_SETS))
    ap.add_argument('--configs', default=','.join(CONFIGS))
    ap.add_argument('--no-extra', action='store_true')
    a = ap.parse_args()
    root = PACK / 'tp'
    ver = subprocess.run([TEXTUREPACKER, '--version'], capture_output=True, text=True).stdout.strip().splitlines()[0]
    lic = subprocess.run([TEXTUREPACKER, '--license-info'], capture_output=True, text=True).stdout
    # process start-up alone (licence check included): subtract nothing, report it next to the times
    t0 = time.perf_counter(); subprocess.run([TEXTUREPACKER, '--version'], capture_output=True); startup = round((time.perf_counter() - t0) * 1000)
    runs = []
    for s in a.sets.split(','):
        for c in a.configs.split(','):
            r = run(SETS / s, root / s / c, CONFIGS[c])
            runs.append({'set': s, 'config': c, 'args': CONFIGS[c], **r})
            print(s, c, r['ms'], 'ms', r['jsons'], flush=True)
    if not a.no_extra:
        for name, (base, more) in EXTRA.items():
            src = SETS_EXTRA / name.split('-')[0]
            r = run(src, root / 'extra' / name, CONFIGS[base] + more)
            runs.append({'set': name, 'config': base, 'args': CONFIGS[base] + more, **r})
            print(name, r['ms'], 'ms', r['jsons'], flush=True)
    # merge with earlier runs of other sets/configs
    prev = json.loads((root / 'runs.json').read_text())['runs'] if (root / 'runs.json').exists() else []
    done = {(r['set'], r['config']) for r in runs}
    runs = [r for r in prev if (r['set'], r['config']) not in done] + runs
    (root / 'runs.json').write_text(json.dumps({'version': ver, 'license': lic, 'startup_ms': startup, 'runs': runs}, indent=1))


if __name__ == '__main__':
    main()
