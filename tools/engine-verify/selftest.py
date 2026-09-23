"""Self-test of the harness: known-good data must PASS and deliberately broken copies must FAIL,
in every engine the harness drives. Run this before trusting a baseline.

    python tools/engine-verify/selftest.py [--engines godot,phaser3,phaser4,pixi8] [--port 4441] [--out <dir>]

Cases (all real corpus files):
  web   Aseprite JSON hash (OGA pixel torch, made by Aseprite)       -> PASS
  web   the same JSON with one frame shifted 1 px                    -> FAIL (frames.art)
  godot a TileSet JSON written from the corpus blob-47 masks, built
        by the shipped Tile Lab importer, terrain-painted by Godot   -> PASS (every painted cell right)
  godot the same with two tiles' peering bits swapped                -> FAIL (terrain.paint.picks)
  godot BMFont text .fnt (Cozette) as a FontFile                     -> PASS
"""
from __future__ import annotations
import argparse, json, shutil, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import verify as V  # noqa: E402
import expect_from_corpus as X  # noqa: E402

ROOT = HERE.parents[1]
C = X.CORPUS
NAMES = {1: 'top_side', 2: 'top_right_corner', 4: 'right_side', 8: 'bottom_right_corner', 16: 'bottom_side',
         32: 'bottom_left_corner', 64: 'left_side', 128: 'top_left_corner'}


def torch(out: Path, broken: bool) -> Path:
    b = out / ('torch-broken' if broken else 'torch')
    b.mkdir(parents=True, exist_ok=True)
    shutil.copy2(C / 'sprites-normal/oga-pixel-torch/Torch_Sheet.png', b / 'Torch_Sheet.png')
    data = json.loads((C / 'sprites-normal/oga-pixel-torch/Torch_Hash.json').read_text(encoding='utf-8'))
    if broken:
        first = next(iter(data['frames'].values()))
        first['frame']['x'] += 1
    (b / 'Torch_Hash.json').write_text(json.dumps(data), encoding='utf-8')
    return b


def tileset(out: Path, broken: bool) -> Path:
    asset = 'tiles/oga-gms-autotile-templates/gms_47autotile_template.png'
    t = X.entry(asset)['truth']
    b = out / ('tiles-broken' if broken else 'tiles')
    b.mkdir(parents=True, exist_ok=True)
    shutil.copy2(C / asset, b / 'terrain.png')
    script = subprocess.run(['node', '-e', "import('./src/game/godot-tileset.js').then(m=>process.stdout.write(m.godotScript()))"],
                            cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout
    (b / 'nerulio_tileset_import.gd').write_text(script, encoding='utf-8')
    tiles = []
    for r, row in enumerate(t['masks']):
        for c, m in enumerate(row):
            if m is None:
                continue
            tiles.append({'atlas': {'x': c, 'y': r}, 'terrainSet': 0, 'terrain': 0, 'peering': {n: 0 for bit, n in NAMES.items() if m & bit}})
    if broken:  # swap the peering of two tiles: the engine must then paint the wrong art
        tiles[1]['peering'], tiles[2]['peering'] = tiles[2]['peering'], tiles[1]['peering']
    g = t['grid']
    data = {'meta': {'tool': 'engine-verify selftest', 'schemaVersion': 1, 'engineTarget': 'godot-4', 'image': 'terrain.png'},
            'tileSet': {'tileSize': {'w': g['cellW'], 'h': g['cellH']}, 'margins': {'x': 0, 'y': 0}, 'separation': {'x': 0, 'y': 0},
                        'terrainSets': [{'mode': 'match_corners_and_sides', 'terrains': [{'name': 'Terrain', 'color': '#4caf50'}]}], 'tiles': tiles}}
    (b / 'nerulio-tileset.json').write_text(json.dumps(data), encoding='utf-8')
    return b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--engines', default='godot,phaser3,phaser4,pixi8')
    ap.add_argument('--port', type=int, default=4441)
    ap.add_argument('--out')
    a = ap.parse_args()
    engines = a.engines.split(',')
    web = [e for e in engines if e != 'godot']
    out = Path(a.out or tempfile.mkdtemp(prefix='nerulio-selftest-'))
    cases = []
    if web:
        exp = X.sprite_grid('sprites-normal/oga-pixel-torch/Torch_Sheet.png', out / 'exp-torch')
        cases += [('aseprite torch', torch(out, False), exp, web, 'PASS'), ('aseprite torch, frame shifted 1 px', torch(out, True), exp, web, 'FAIL')]
    if 'godot' in engines:
        exp = X.tileset('tiles/oga-gms-autotile-templates/gms_47autotile_template.png')
        cases += [('blob-47 TileSet from corpus masks', tileset(out, False), exp, ['godot'], 'PASS'),
                  ('blob-47 TileSet, two tiles swapped', tileset(out, True), exp, ['godot'], 'FAIL')]
        fnt = out / 'cozette'; fnt.mkdir(exist_ok=True)
        for n in ('Cozette-standard.fnt', 'Cozette-standard.png'):
            shutil.copy2(C / 'fonts/cozette-bmfont' / n, fnt / n)
        chars = {}
        import re
        from PIL import Image
        text = (fnt / 'Cozette-standard.fnt').read_text(encoding='utf-8')
        page = Image.open(fnt / 'Cozette-standard.png').convert('RGBA')
        (out / 'exp-font').mkdir(exist_ok=True)
        for m in re.finditer(r'char id=(\d+)\s+x=(\d+)\s+y=(\d+)\s+width=(\d+)\s+height=(\d+)', text):
            cid, x, y, w, h = map(int, m.groups())
            if 0x41 <= cid <= 0x5a:
                p = out / 'exp-font' / f'{cid}.png'; page.crop((x, y, x + w, y + h)).save(p); chars[chr(cid)] = str(p)
        cases.append(('BMFont text (Cozette) as FontFile', fnt, {'font': {'chars': chars, 'size': 13}}, ['godot'], 'PASS'))
    bad = 0
    for name, bundle, exp, eng, want in cases:
        for r in V.verify(bundle, exp, eng, out / 'runs' / bundle.name, a.port):
            good = r.status == want
            bad += not good
            print(f'{"ok  " if good else "BAD "} want {want:4} got {r.status:10} {r.engine:8} {name}' + ('' if good else f'  {r.failures()[:3]}'), flush=True)
    print('SELFTEST PASSED' if not bad else f'SELFTEST FAILED ({bad})')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
