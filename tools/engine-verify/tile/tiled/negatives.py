"""Negative controls: the Tiled and LDtk checks must FAIL on broken copies of a good bundle.

    python tools/engine-verify/tile/tiled/negatives.py <asset dir>
Cases: (tiled) two wangids swapped in the TSX · one gid changed in the TMX · spacing changed in the
TSX; (ldtk) a required field removed · one exported auto-tile id changed · one rule's pattern
changed (the exported tiles no longer follow the rules)."""
from __future__ import annotations
import json, re, shutil, sys, tempfile
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import tiled_check, ldtk_check  # noqa: E402


def copy(src: Path) -> Path:
    d = Path(tempfile.mkdtemp(prefix='nerulio-neg-')) / src.name
    shutil.copytree(src, d, ignore=shutil.ignore_patterns('_*'))
    return d


def edit(p: Path, fn):
    p.write_text(fn(p.read_text(encoding='utf-8')), encoding='utf-8')


def main():
    src = Path(sys.argv[1])
    rows = []
    good = tiled_check.check(src)['verdict'], ldtk_check.check(src)['verdict']
    rows.append(('good bundle', 'tiled', good[0], 'PASS'))
    rows.append(('good bundle', 'ldtk', good[1], 'PASS'))

    d = copy(src)
    tsx = next((d / 'tiled').glob('*.tsx'))
    ids = re.findall(r'wangid="([^"]+)"', tsx.read_text(encoding='utf-8'))
    a, b = next((x, y) for x in ids for y in ids if x != y)
    edit(tsx, lambda s: s.replace(f'wangid="{a}"', 'wangid="TMP"', 1).replace(f'wangid="{b}"', f'wangid="{a}"', 1).replace('wangid="TMP"', f'wangid="{b}"', 1))
    rows.append(('tsx: two wangids swapped', 'tiled', tiled_check.check(d)['verdict'], 'FAIL'))

    d = copy(src)
    tmx = d / 'tiled' / 'sample.tmx'

    def bump(s):
        head, data = s.split('<data encoding="csv">')
        nums = data.split('</data>')[0]
        vals = nums.replace('\n', '').split(',')
        i = next(k for k, v in enumerate(vals) if v.strip() not in ('0', ''))
        vals[i] = str(int(vals[i]) % 40 + 1 if int(vals[i]) % 40 + 1 != int(vals[i]) else int(vals[i]) + 1)
        return head + '<data encoding="csv">\n' + ','.join(vals) + '\n</data>' + data.split('</data>')[1]
    edit(tmx, bump)
    rows.append(('tmx: one gid changed', 'tiled', tiled_check.check(d)['verdict'], 'FAIL'))

    d = copy(src)
    tsx = next((d / 'tiled').glob('*.tsx'))
    edit(tsx, lambda s: re.sub(r'spacing="(\d+)"', lambda m: f'spacing="{int(m.group(1)) + 1}"', s, count=1))
    rows.append(('tsx: spacing +1', 'tiled', tiled_check.check(d)['verdict'], 'FAIL'))

    d = copy(src)
    ld = next((d / 'ldtk').glob('*.ldtk'))
    edit(ld, lambda s: json.dumps({k: v for k, v in json.loads(s).items() if k != 'defaultGridSize'}))
    rows.append(('ldtk: required field removed', 'ldtk', ldtk_check.check(d)['verdict'], 'FAIL'))

    d = copy(src)
    ld = next((d / 'ldtk').glob('*.ldtk'))

    def tile_id(s):
        j = json.loads(s)
        t = j['levels'][0]['layerInstances'][0]['autoLayerTiles'][0]
        t['t'] = t['t'] + 1
        return json.dumps(j)
    edit(ld, tile_id)
    rows.append(('ldtk: one auto-tile id changed', 'ldtk', ldtk_check.check(d)['verdict'], 'FAIL'))

    d = copy(src)
    ld = next((d / 'ldtk').glob('*.ldtk'))

    def rule(s):
        j = json.loads(s)
        r = j['defs']['layers'][0]['autoRuleGroups'][0]['rules'][0]
        r['pattern'] = [(-v if v not in (0,) and k != 4 else v) for k, v in enumerate(r['pattern'])]
        return json.dumps(j)
    edit(ld, rule)
    rows.append(('ldtk: one rule pattern inverted', 'ldtk', ldtk_check.check(d)['verdict'], 'FAIL'))

    ok = all(got == want for *_, got, want in rows)
    for case, eng, got, want in rows:
        print(f'{case:34s} {eng:6s} got {got:5s} want {want:5s} {"ok" if got == want else "WRONG"}')
    print('NEGATIVES', 'PASSED' if ok else 'FAILED')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
