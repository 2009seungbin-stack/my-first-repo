"""Build engine-verify expectation files from the game-asset corpus ground truth.

The expectation never comes from the export under test: frame images are cut out of the ORIGINAL
corpus file with the grid the manifest records (measured by inspection), glyph images out of the
original font sheet, and so on. An exporter that slices, trims, packs or re-orders wrongly then
fails against the source, not against itself.

    python tools/engine-verify/expect_from_corpus.py <corpus-relative path> --out <dir>
        [--animations rows|none] [--fps 12] [--chars "ABC..."]

Library use: sprite_grid(), sprite_frames(), font_grid(), tileset() return the dict and write the
PNGs they reference into `out`.
"""
from __future__ import annotations
import argparse, json, os, sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ev_common import grid_cells, key_to_alpha, rgba  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / 'tests' / 'game-corpus.manifest.json'
CORPUS = Path(os.environ.get('NERULIO_CORPUS', r'C:\Users\2009s\nerulio-asset-corpus'))


def manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding='utf-8'))


def entry(path: str) -> dict:
    for f in manifest()['files']:
        if f['path'] == path:
            return f
    raise KeyError(path)


def _key(truth: dict):
    bg = truth.get('background')
    if isinstance(bg, dict) and bg.get('key'):
        return bg['key']
    return truth.get('keyColor')


def sprite_grid(path: str, out: Path, animations: str = 'none', fps: float | None = None, grid: dict | None = None) -> dict:
    """One expected frame per non-empty grid cell, reading order. animations='rows' adds one
    expected animation per row (only when the truth says rows are animations)."""
    f = entry(path)
    t = f.get('truth', {})
    grid = grid or t['grid']
    im = rgba(CORPUS / path)
    key = _key(t)
    if key:
        im = key_to_alpha(im, key)
    out.mkdir(parents=True, exist_ok=True)
    frames, rows = [], {}
    for c, r, cell in grid_cells(im, grid):
        p = out / f'cell_r{r:02d}_c{c:02d}.png'
        cell.save(p)
        rows.setdefault(r, []).append(len(frames))
        frames.append({'image': str(p), 'cell': [c, r]})
    exp = {'asset': path, 'truth': t.get('verified'), 'sprite': {'frames': frames, 'order': True, 'placement': True, 'tolerance': 2, 'scale': 4}}
    if animations == 'rows':
        exp['sprite']['animations'] = {f'row{r}': {'count': len(ix), 'frames': ix, **({'fps': fps} if fps else {})} for r, ix in rows.items()}
    return exp


def sprite_frames(paths: list[str], out: Path, name: str | None = None, fps: float | None = None) -> dict:
    """Loose frame files (natural order as given)."""
    frames = [{'image': str(CORPUS / p), 'name': Path(p).stem} for p in paths]
    exp = {'asset': paths[0].rsplit('/', 1)[0] + '/', 'sprite': {'frames': frames, 'order': True, 'placement': True, 'tolerance': 2, 'scale': 4}}
    if name:
        exp['sprite']['animations'] = {name: {'count': len(frames), 'frames': list(range(len(frames))), **({'fps': fps} if fps else {})}}
    return exp


def font_grid(path: str, out: Path, chars: str | None = None) -> dict:
    """Expected glyph images from an image-grid font (cell, firstChar, row-major order)."""
    f = entry(path)
    t = f['truth']
    fd = t['font']
    im = rgba(CORPUS / path)
    if t.get('keyColor'):
        im = key_to_alpha(im, t['keyColor'])
    cw, ch = fd['cell']['w'], fd['cell']['h']
    cols = fd.get('cols') or im.width // cw
    first = fd.get('firstChar', 32)
    out.mkdir(parents=True, exist_ok=True)
    chars = chars or ''.join(chr(c) for c in range(33, 127))
    glyphs = {}
    for c in chars:
        i = ord(c) - first
        x, y = (i % cols) * cw, (i // cols) * ch
        g = im.crop((x, y, x + cw, y + ch))
        p = out / f'glyph_{ord(c):04x}.png'
        g.save(p)
        glyphs[c] = str(p)
    return {'asset': path, 'truth': t.get('verified'), 'font': {'chars': glyphs, 'size': ch, 'sample': 'Hello'}}


BLOB_BITS = {'n': 1, 'ne': 2, 'e': 4, 'se': 8, 's': 16, 'sw': 32, 'w': 64, 'nw': 128}


def blob_mask(cells: set, x: int, y: int) -> int:
    has = lambda dx, dy: (x + dx, y + dy) in cells
    n, e, s, w = has(0, -1), has(1, 0), has(0, 1), has(-1, 0)
    m = n * 1 + e * 4 + s * 16 + w * 64
    m += 2 * (n and e and has(1, -1)) + 8 * (s and e and has(1, 1)) + 32 * (s and w and has(-1, 1)) + 128 * (n and w and has(-1, -1))
    return m


def edge_mask(cells: set, x: int, y: int) -> int:
    return blob_mask(cells, x, y) & (1 | 4 | 16 | 64)


PAINT = [  # a shape that reaches every blob-47 class: holes, diagonals, 1-wide arms
    '..............',
    '.#####...###..',
    '.#####..#####.',
    '.##.##..##.##.',
    '.#####..#####.',
    '.#####...###..',
    '...#......#...',
    '..###.#..###..',
    '...#.###......',
    '......#.......',
    '..............',
]


def tileset(path: str, masks: dict | None = None, paint=PAINT) -> dict:
    """Expected Godot TileSet facts from the grid truth, and - when per-tile masks are known -
    the atlas tile each painted cell must get. `masks` maps "col,row" -> cr31 mask."""
    t = entry(path)['truth']
    g = t['grid']
    cells = {(x, y) for y, row in enumerate(paint) for x, ch in enumerate(row) if ch == '#'}
    exp = {'asset': path, 'truth': t.get('verified'), 'tileset': {
        'tileSize': [g['cellW'], g['cellH']], 'margins': [g.get('marginX', 0), g.get('marginY', 0)],
        'separation': [g.get('spacingX', 0), g.get('spacingY', 0)], 'paint': sorted([list(c) for c in cells])}}
    masks = masks or _masks_from_truth(t)
    if masks:
        by_mask = {}
        for k, m in masks.items():
            by_mask.setdefault(int(m), []).append([int(v) for v in k.split(',')])
        side_only = all(int(m) & (2 | 8 | 32 | 128) == 0 for m in masks.values())
        pick = {}
        for (x, y) in cells:
            m = edge_mask(cells, x, y) if side_only else blob_mask(cells, x, y)
            if m in by_mask:
                pick[f'{x},{y}'] = by_mask[m]  # every tile with that mask is acceptable (duplicates)
        exp['tileset']['expectedPick'] = pick
        exp['tileset']['maskKind'] = 'edge16' if side_only else 'blob47'
        exp['tileset']['layout'] = t.get('layout')
    return exp


def _masks_from_truth(t: dict) -> dict | None:
    """The manifest stores masks as rows of cells. Blob layouts use cr31 weights already; the
    edge16 templates use N=1 E=2 S=4 W=8 and are converted. Corner-only (wang-2corner) sets are
    not side/blob masks and are skipped."""
    rows = t.get('masks')
    if not rows:
        return None
    layout = str(t.get('layout', ''))
    if layout.startswith('wang-2corner'):
        return None
    conv = (lambda m: (m & 1) * 1 + ((m >> 1) & 1) * 4 + ((m >> 2) & 1) * 16 + ((m >> 3) & 1) * 64) if layout.startswith('edge16') else (lambda m: m)
    return {f'{c},{r}': conv(m) for r, row in enumerate(rows) for c, m in enumerate(row) if m is not None}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('path')
    ap.add_argument('--out', required=True)
    ap.add_argument('--animations', default='none', choices=['none', 'rows'])
    ap.add_argument('--fps', type=float)
    ap.add_argument('--chars')
    a = ap.parse_args()
    f = entry(a.path)
    out = Path(a.out)
    if f['category'].startswith('font'):
        exp = font_grid(a.path, out, a.chars)
    elif f['category'] == 'tileset':
        exp = tileset(a.path)
    else:
        exp = sprite_grid(a.path, out, a.animations, a.fps)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'expect.json').write_text(json.dumps(exp, indent=1), encoding='utf-8')
    print(out / 'expect.json')


if __name__ == '__main__':
    main()
