"""LDtk check for Studio Tile exports (ldtk/<name>.ldtk + PNG).

  1. Schema: the project validates against LDtk's own JSON schema for 1.5.3
     (https://ldtk.io/files/JSON_SCHEMA.json, cached in the corpus _adhoc folder or LDTK_SCHEMA).
  2. Loader: LDtk's official QuickType Python loader (LdtkJson.py from the LDtk repository,
     docs/quicktype; cached in %LOCALAPPDATA%/nerulio-engine-verify/ldtk) parses the whole project.
  3. Rules: the level's auto-layer is re-run here from intGridCsv with LDtk's rule semantics
     (rules in order, breakOnMatch, pattern v / -v / 1000001 anything / -1000001 nothing,
     outOfBoundsValue, tileXOffset/YOffset) and compared cell by cell with the exported
     autoLayerTiles (rule uid, tile id, px, src rect).
  4. Intent: every tile a rule places is the tile the Studio model defines for that neighbourhood
     (the painted IntGrid), and every painted cell (every grid point for corner sets) that has a
     fitting tile in the model gets one.
The LDtk application itself (Electron, no command line) is NOT run: whether LDtk's editor re-applies
the rules identically when the project is opened is UNVERIFIED.

    python tools/engine-verify/tile/ldtk_check.py <asset dir> [...]
"""
from __future__ import annotations
import importlib.util, json, os, sys, urllib.request
from pathlib import Path

CACHE = Path(os.environ.get('NERULIO_ENGINE_CACHE', Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'nerulio-engine-verify')) / 'ldtk'
SCHEMA = Path(os.environ.get('LDTK_SCHEMA', r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-tile\ldtk-JSON_SCHEMA.json'))
LOADER_URL = 'https://raw.githubusercontent.com/deepnight/ldtk/master/docs/quicktype/LdtkJson.py'
ANYTHING, NOTHING = 1000001, -1000001


def _schema_errors(doc: dict) -> list[str] | None:
    try:
        import jsonschema
    except ImportError:
        return None
    if not SCHEMA.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve('https://ldtk.io/files/JSON_SCHEMA.json', SCHEMA)
    schema = json.loads(SCHEMA.read_text(encoding='utf-8'))
    # the file names draft-07 by a URL jsonschema does not recognise; it is a draft-07 schema
    cls = jsonschema.Draft7Validator
    return [f'{"/".join(map(str, e.absolute_path))}: {e.message[:200]}' for e in cls(schema).iter_errors(doc)]


def _loader():
    path = CACHE / 'LdtkJson.py'
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(LOADER_URL, path)
    spec = importlib.util.spec_from_file_location('LdtkJson', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _matches(rule: dict, get, cx: int, cy: int) -> bool:
    size, pat, radius = rule['size'], rule['pattern'], rule['size'] // 2
    for k, want in enumerate(pat):
        if not want:
            continue
        x, y = cx + k % size - radius, cy + k // size - radius
        v = get(x, y)
        if v is None:  # outside the level
            if rule.get('outOfBoundsValue') is None:
                return False
            v = rule['outOfBoundsValue']
        if want == ANYTHING:
            if v == 0:
                return False
        elif want == NOTHING:
            if v != 0:
                return False
        elif want > 0:
            if v != want:
                return False
        elif v == -want:
            return False
    return True


def run_rules(layer_def: dict, li: dict) -> list[dict]:
    W, H, gs = li['__cWid'], li['__cHei'], li['__gridSize']
    csv = li['intGridCsv']
    get = lambda x, y: csv[y * W + x] if 0 <= x < W and 0 <= y < H else None
    out = []
    rules = [r for g in layer_def['autoRuleGroups'] if g['active'] for r in g['rules'] if r['active']]
    for cy in range(H):
        for cx in range(W):
            for r in rules:
                if r['chance'] < 1 or r.get('perlinActive') or r['xModulo'] != 1 or r['yModulo'] != 1:
                    raise ValueError(f'rule {r["uid"]} uses randomness/modulo; this checker only covers deterministic rules')
                if _matches(r, get, cx, cy):
                    t = r['tileRectsIds'][0][0]
                    out.append({'cell': (cx, cy), 'rule': r['uid'], 't': t, 'px': [cx * gs + r['tileXOffset'], cy * gs + r['tileYOffset']]})
                    if r['breakOnMatch']:
                        break
    return out


# ---- Studio intent (patterns.idealAt, re-implemented independently)
OFF = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]
MODE_IDX = {'corners-and-sides': range(8), 'sides': (0, 2, 4, 6), 'corners': (1, 3, 5, 7)}


def ideal(get, x, y, mode):
    t = get(x, y)
    want = [[t]]
    for i in range(8):
        if i not in MODE_IDX[mode]:
            want.append([-1])
            continue
        dx, dy = OFF[i]
        cells = [get(x + dx, y + dy)] if i % 2 == 0 else [get(x + dx, y), get(x, y + dy), get(x + dx, y + dy)]
        allv = {t, *cells}
        if len(allv) == 1:
            want.append([t])
        elif -1 in allv and len(allv) == 2:
            want.append([-1])
        else:
            want.append([v for v in allv if v >= 0])
    return want


def check(asset_dir) -> dict:
    d = Path(asset_dir)
    f = next((d / 'ldtk').glob('*.ldtk'))
    doc = json.loads(f.read_text(encoding='utf-8'))
    model = json.loads((d / 'model.json').read_text(encoding='utf-8'))
    details, fails = {}, []
    # 1. schema
    errs = _schema_errors(doc)
    if errs is None:
        details['schema'] = 'jsonschema not installed'
    else:
        details['schema'] = {'errors': len(errs), 'first': errs[:5]}
        if errs:
            fails.append(f'{len(errs)} schema error(s): {errs[:2]}')
    # 2. official loader
    try:
        mod = _loader()
        proj = mod.ldtk_json_from_dict(doc)
        lvl = proj.levels[0]
        details['loader'] = {'ok': True, 'jsonVersion': proj.json_version, 'levels': len(proj.levels), 'layers': len(lvl.layer_instances),
                             'autoTiles': len(lvl.layer_instances[0].auto_layer_tiles), 'rules': sum(len(g.rules) for g in proj.defs.layers[0].auto_rule_groups)}
    except Exception as e:  # noqa: BLE001
        details['loader'] = {'ok': False, 'error': f'{type(e).__name__}: {e}'[:300]}
        fails.append(f'official LDtk loader rejected the file: {details["loader"]["error"]}')
    # 3. rules re-run vs exported autoLayerTiles
    ld, li = doc['defs']['layers'][0], doc['levels'][0]['layerInstances'][0]
    tsd = doc['defs']['tilesets'][0]
    mine = run_rules(ld, li)
    exported = {(t['d'][1] % li['__cWid'], t['d'][1] // li['__cWid']): t for t in li['autoLayerTiles']}
    mismatch = []
    for m in mine:
        e = exported.get(m['cell'])
        src = [tsd['padding'] + (m['t'] % tsd['__cWid']) * (tsd['tileGridSize'] + tsd['spacing']), tsd['padding'] + (m['t'] // tsd['__cWid']) * (tsd['tileGridSize'] + tsd['spacing'])]
        if not e or e['t'] != m['t'] or e['d'][0] != m['rule'] or e['px'] != m['px'] or e['src'] != src:
            mismatch.append({'cell': m['cell'], 'rerun': m, 'exported': e, 'src': src})
    extra = [k for k in exported if k not in {m['cell'] for m in mine}]
    details['rules'] = {'rerunTiles': len(mine), 'exportedTiles': len(exported), 'mismatch': len(mismatch), 'extra': len(extra), 'first': mismatch[:3]}
    if mismatch or extra:
        fails.append(f'auto-layer re-run differs from the exported tiles: {len(mismatch)} mismatched, {len(extra)} extra')
    # 4. intent: the tile each rule placed is the one the model defines for that neighbourhood
    W, H, csv, mode = li['__cWid'], li['__cHei'], li['intGridCsv'], model['mode']
    get = lambda x, y: csv[y * W + x] - 1 if 0 <= x < W and 0 <= y < H else -1
    by_tile = {}
    g = model['grid']
    for k, v in model['tiles'].items():
        c, r = map(int, k.split(','))
        by_tile[r * g['cols'] + c] = v['pattern']
    wrong, missing = [], []
    placed = {m['cell']: m['t'] for m in mine}
    if mode == 'corners':
        # rule at cell (x,y) draws the tile of the grid point below-right: corners (x,y),(x+1,y),(x,y+1),(x+1,y+1)
        for y in range(H):
            for x in range(W):
                corners = [get(x, y), get(x + 1, y), get(x + 1, y + 1), get(x, y + 1)]  # tl,tr,br,bl
                if all(v < 0 for v in corners):
                    continue
                want = {'nw': corners[0], 'ne': corners[1], 'se': corners[2], 'sw': corners[3]}
                fitting = [t for t, p in by_tile.items() if p[0] >= 0 and [p[8], p[2], p[4], p[6]] == [want['nw'], want['ne'], want['se'], want['sw']]]
                t = placed.get((x, y))
                if t is None:
                    if fitting:
                        missing.append((x, y))
                elif t not in fitting:
                    wrong.append((x, y))
    else:
        for y in range(H):
            for x in range(W):
                if get(x, y) < 0:
                    if (x, y) in placed:
                        wrong.append((x, y))
                    continue
                want = ideal(get, x, y, mode)
                fitting = [t for t, p in by_tile.items() if all(p[i] in want[i] for i in range(9))]
                t = placed.get((x, y))
                if t is None:
                    if fitting:
                        missing.append((x, y))
                elif t not in fitting:
                    wrong.append((x, y))
    details['intent'] = {'placed': len(placed), 'wrong': wrong[:6], 'wrongCount': len(wrong), 'missingWithTile': len(missing)}
    if wrong or missing:
        fails.append(f'{len(wrong)} cell(s) got a tile the model does not define for them, {len(missing)} fitting cell(s) got none')
    summary = (f"schema {'OK' if errs == [] else ('?' if errs is None else f'{len(errs)} errors')}, official loader {'OK' if details['loader']['ok'] else 'FAILED'}, "
               f"rules re-run {len(mine)} tiles = export {'yes' if not mismatch and not extra else 'NO'}, intent wrong {len(wrong)} / missing {len(missing)}; LDtk app not run")
    return {'verdict': 'FAIL' if fails else 'PASS', 'summary': summary + ('; ' + '; '.join(fails[:3]) if fails else ''), 'details': details}


if __name__ == '__main__':
    for a in sys.argv[1:]:
        r = check(a)
        print(Path(a).name, r['verdict'], r['summary'])
