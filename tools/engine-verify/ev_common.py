"""Shared pieces of the engine-verify harness: bundle unpacking and detection, field checks, and
pixel comparison. No engine code lives here.

A *bundle* is whatever an exporter hands a user (a ZIP or a folder). Detection only looks at file
names and JSON/XML shapes; it never trusts a bundle's own claims about which engine it is for,
except to decide which loader to try first.
"""
from __future__ import annotations
import json, shutil, zipfile, xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
SOFT_TOLERANCE = 8  # see diff()


# ---------------------------------------------------------------- report

@dataclass
class Check:
    field: str
    ok: bool | None          # None = not applicable / could not be measured (never counted as a pass)
    expected: object = None
    actual: object = None
    note: str = ''

    def as_dict(self):
        return {'field': self.field, 'ok': self.ok, 'expected': self.expected, 'actual': self.actual, 'note': self.note}


@dataclass
class Result:
    engine: str
    loader: str
    bundle: str
    checks: list[Check] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    info: dict = field(default_factory=dict)
    na: str | None = None     # set when this engine is not a target of this bundle at all

    def check(self, name, ok, expected=None, actual=None, note=''):
        self.checks.append(Check(name, ok, expected, actual, note))
        return ok

    @property
    def status(self) -> str:
        if self.na and not self.errors:
            return 'N/A'
        if self.errors:
            return 'FAIL'
        if any(c.ok is False for c in self.checks):
            return 'FAIL'
        if not any(c.ok for c in self.checks):
            return 'UNVERIFIED'
        return 'PASS'

    def failures(self):
        return self.errors + [f'{c.field}: expected {c.expected!r}, got {c.actual!r}{" (" + c.note + ")" if c.note else ""}' for c in self.checks if c.ok is False]

    def as_dict(self):
        return {'engine': self.engine, 'loader': self.loader, 'bundle': self.bundle, 'status': self.status,
                'na': self.na, 'errors': self.errors, 'checks': [c.as_dict() for c in self.checks], 'info': self.info}


# ---------------------------------------------------------------- bundles

def unpack(bundle: str | Path, dest: Path) -> Path:
    """Copy a ZIP's contents or a folder into dest (fresh). Returns dest."""
    bundle = Path(bundle)
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    if bundle.is_dir():
        shutil.copytree(bundle, dest, dirs_exist_ok=True)
    elif zipfile.is_zipfile(bundle):
        with zipfile.ZipFile(bundle) as z:
            for name in z.namelist():
                if name.endswith('/') or '..' in Path(name).parts:
                    continue
                target = dest / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(z.read(name))
    else:
        shutil.copy2(bundle, dest / bundle.name)
    return dest


def _json(path: Path):
    try:
        return json.loads(path.read_text(encoding='utf-8-sig'))
    except Exception:
        return None


def detect(folder: Path) -> list[dict]:
    """Every loadable thing in an unpacked bundle, as {kind, files...}. Kinds:
    nerulio-sprite-godot   Sprite Lab Godot bundle (JSON + addons/nerulio_sprite helper)
    nerulio-envelope       Sprite Lab generic/unity JSON envelope (frames[].rect)
    nerulio-godot-json     sprite-sheet-maker's "Godot 4" JSON (frames[].region), no helper
    nerulio-tileset-godot  Tile Lab Godot pack (nerulio-tileset.json + nerulio_tileset_import.gd)
    texturepacker-hash / texturepacker-array   JSON with frames{}/frames[] of {frame:{x,y,w,h}}
    aseprite-hash / aseprite-array             the same plus meta.frameTags
    starling-xml           <TextureAtlas><SubTexture .../>
    bmfont-text / bmfont-xml                   AngelCode BMFont .fnt
    godot-spriteframes-tres  a native Godot 4 SpriteFrames .tres (+ the .tscn that uses it, if any)
    phaser-multiatlas      Phaser multiatlas JSON ({textures:[{image, frames:[...]}]})
    love-quads             a Lua table of quads (Studio LÖVE export: images/frames/animations)
    defold-atlas           Defold .atlas / .tilesource text (built with bob.jar)
    image                  any PNG (texture)
    Phaser animation files ({anims:[...]}) are not items: they are attached to the atlas item
    in the same folder as `anims`.
    """
    found = []
    files = sorted(p for p in folder.rglob('*') if p.is_file() and '_verify' not in p.parts and '.godot' not in p.parts)
    rel = lambda p: p.relative_to(folder).as_posix()
    for p in files:
        suffix = p.suffix.lower()
        if suffix == '.json':
            data = _json(p)
            if not isinstance(data, dict):
                continue
            meta = data.get('meta') if isinstance(data.get('meta'), dict) else {}
            frames = data.get('frames')
            if 'tileSet' in data and meta.get('engineTarget') == 'godot-4':
                imp = next((q for q in files if q.name.endswith('_import.gd') and 'tileset' in q.name), None)
                found.append({'kind': 'nerulio-tileset-godot', 'json': rel(p), 'importer': rel(imp) if imp else None,
                              'image': meta.get('image'), 'data': data})
            elif meta.get('engineTarget') == 'godot-4' and isinstance(frames, dict) and frames and 'rect' in next(iter(frames.values())):
                helper = folder / 'addons' / 'nerulio_sprite' / 'nerulio_sprite_frames.gd'
                found.append({'kind': 'nerulio-sprite-godot' if helper.exists() else 'nerulio-envelope', 'json': rel(p),
                              'images': meta.get('images') or [meta.get('image')], 'data': data})
            elif meta.get('engineTarget') == 'godot-4' and isinstance(frames, dict):
                found.append({'kind': 'nerulio-godot-json', 'json': rel(p), 'images': [meta.get('image')], 'data': data})
            elif meta.get('engineTarget') == 'unity-2022' and 'unity' in data:
                cs = next((q for q in files if q.name == 'NerulioSpriteImporter.cs'), None)
                found.append({'kind': 'nerulio-sprite-unity' if cs else 'nerulio-envelope', 'json': rel(p),
                              'images': meta.get('images') or [meta.get('image')], 'data': data})
            elif isinstance(data.get('textures'), list) and data['textures'] and isinstance(data['textures'][0], dict) and 'frames' in data['textures'][0]:
                found.append({'kind': 'phaser-multiatlas', 'json': rel(p), 'images': [t.get('image') for t in data['textures']], 'data': data})
            elif isinstance(data.get('anims'), list):
                continue
            elif data.get('engineTarget') == 'gamemaker' and isinstance(data.get('sprites'), list):
                found.append({'kind': 'gamemaker-strips', 'json': rel(p), 'images': [(Path(rel(p)).parent / s['file']).as_posix() for s in data['sprites']], 'data': data})
            elif isinstance(frames, dict) and frames and isinstance(next(iter(frames.values())), dict) and 'rect' in next(iter(frames.values())):
                found.append({'kind': 'nerulio-envelope', 'json': rel(p), 'images': meta.get('images') or [meta.get('image')], 'data': data})
            elif isinstance(frames, (dict, list)) and frames:
                first = next(iter(frames.values())) if isinstance(frames, dict) else frames[0]
                if isinstance(first, dict) and 'frame' in first:
                    aseprite = 'frameTags' in meta or 'aseprite' in str(meta.get('app', '')).lower()
                    kind = ('aseprite-' if aseprite else 'texturepacker-') + ('hash' if isinstance(frames, dict) else 'array')
                    found.append({'kind': kind, 'json': rel(p), 'images': [meta.get('image')], 'data': data})
            elif 'sprites' in data and 'texture' in data:
                found.append({'kind': 'unity-json', 'json': rel(p), 'images': [data.get('texture')], 'data': data})
        elif suffix == '.xml':
            try:
                root = ET.parse(p).getroot()
            except Exception:
                continue
            if root.tag == 'TextureAtlas':
                found.append({'kind': 'starling-xml', 'xml': rel(p), 'images': [root.get('imagePath')]})
            elif root.tag == 'font':
                found.append({'kind': 'bmfont-xml', 'fnt': rel(p)})
        elif suffix == '.fnt':
            head = p.read_bytes()[:64]
            if head.startswith(b'BMF'):
                found.append({'kind': 'bmfont-binary', 'fnt': rel(p)})
            elif head.lstrip().startswith(b'<'):
                found.append({'kind': 'bmfont-xml', 'fnt': rel(p)})
            else:
                found.append({'kind': 'bmfont-text', 'fnt': rel(p)})
        elif suffix in ('.ttf', '.otf'):
            found.append({'kind': 'font-file', 'font': rel(p)})
        elif suffix == '.gif':
            found.append({'kind': 'anim-gif', 'file': rel(p)})
        elif suffix == '.png' and b'acTL' in p.read_bytes()[:200]:
            found.append({'kind': 'apng', 'file': rel(p), 'images': [rel(p)]})
        elif suffix in ('.aseprite', '.ase'):
            found.append({'kind': 'aseprite-file', 'file': rel(p)})
        elif suffix == '.tres':
            head = p.read_text(encoding='utf-8', errors='replace')
            if head.startswith('[gd_resource type="SpriteFrames"'):
                import re as _re
                pages = _re.findall(r'\[ext_resource type="Texture2D" path="([^"]+)"', head)
                scene = next((q for q in files if q.suffix == '.tscn' and q.parent == p.parent and f'path="{p.name}"' in q.read_text(encoding='utf-8', errors='replace')), None)
                found.append({'kind': 'godot-spriteframes-tres', 'tres': rel(p), 'scene': rel(scene) if scene else None,
                              'images': [(Path(rel(p)).parent / x).as_posix() if not x.startswith('res://') else x[6:] for x in pages]})
        elif suffix == '.lua' and p.read_text(encoding='utf-8', errors='replace').lstrip().startswith('-- ') and 'animations = {' in p.read_text(encoding='utf-8', errors='replace') and 'frames = {' in p.read_text(encoding='utf-8', errors='replace'):
            found.append({'kind': 'love-quads', 'lua': rel(p)})
        elif suffix == '.atlas' and _spine_atlas(p):
            found.append({'kind': 'spine-atlas', 'atlas': rel(p), 'images': _spine_atlas(p)})
        elif suffix == '.css' and '.sprite-page-' in p.read_text(encoding='utf-8', errors='replace'):
            html = p.with_suffix('.html')
            found.append({'kind': 'css-sprites', 'css': rel(p), 'html': rel(html) if html.exists() else None,
                          'images': __import__('re').findall(r'url\("([^"]+)"\)', p.read_text(encoding='utf-8'))})
        elif suffix in ('.atlas', '.tilesource') and ('images {' in p.read_text(encoding='utf-8', errors='replace') or 'tile_width:' in p.read_text(encoding='utf-8', errors='replace')):
            found.append({'kind': 'defold-' + suffix[1:], 'file': rel(p)})
    import re
    used = set()
    # Phaser animation JSON beside an atlas: attach it (it is loaded with the atlas, not alone).
    anims = [p for p in files if p.suffix.lower() == '.json' and isinstance(_json(p), dict) and isinstance(_json(p).get('anims'), list)]
    for d in found:
        if d['kind'] in ('texturepacker-hash', 'texturepacker-array', 'phaser-multiatlas', 'nerulio-envelope') and d.get('json'):
            mine = next((a for a in anims if a.parent == (folder / d['json']).parent), None)
            if mine:
                d['anims'] = rel(mine)
    for d in found:
        used.update(Path(n).name for n in (d.get('images') or []) if n)
        if d.get('image'):
            used.add(Path(d['image']).name)
        if d.get('fnt'):
            used.update(Path(n).name for n in re.findall(r'file="([^"]+)"', (folder / d['fnt']).read_text(encoding='utf-8', errors='replace')))
    for p in files:
        if p.suffix.lower() == '.png' and p.name not in used:
            found.append({'kind': 'image', 'image': rel(p)})
    return found


def _spine_atlas(p: Path):
    """Page image names of a Spine/libGDX text atlas, or None: a page line is a file name followed by
    `size:`; regions carry `bounds:` (Spine 4 / libGDX 1.10+) or `xy:` (older libGDX)."""
    text = p.read_text(encoding='utf-8', errors='replace')
    if 'images {' in text or not ('bounds:' in text or 'xy:' in text):
        return None
    lines = [l.strip() for l in text.splitlines()]
    pages = [lines[i] for i in range(len(lines) - 1) if lines[i] and ':' not in lines[i] and lines[i + 1].startswith('size:')]
    return pages or None


# ---------------------------------------------------------------- pixels

def rgba(path_or_image) -> Image.Image:
    im = path_or_image if isinstance(path_or_image, Image.Image) else Image.open(path_or_image)
    return im.convert('RGBA')


def alpha_bbox(im: Image.Image, threshold: int = 1):
    a = im.getchannel('A').point(lambda v: 255 if v >= threshold else 0)
    return a.getbbox()


def trim(im: Image.Image, threshold: int = 1) -> Image.Image:
    box = alpha_bbox(im, threshold)
    return im.crop(box) if box else Image.new('RGBA', (0, 0))


def diff(expected: Image.Image, actual: Image.Image, tolerance: int = 2) -> dict:
    """Pixel comparison that ignores the colour of fully transparent pixels (engines do not keep it)
    and treats premultiplication round-off within `tolerance` as equal."""
    e, a = rgba(expected), rgba(actual)
    if e.size != a.size:
        return {'ok': False, 'size': [list(e.size), list(a.size)], 'differing': None, 'maxDelta': None}
    if e.size[0] == 0 or e.size[1] == 0:
        return {'ok': True, 'size': [list(e.size)] * 2, 'differing': 0, 'maxDelta': 0, 'pixels': 0}
    import numpy as np
    # Compare what is visible: premultiplied colour plus alpha. A GPU engine stores premultiplied
    # texels, so a 10%-alpha edge pixel legitimately comes back with its RGB off by 10+ levels;
    # after premultiplying, that is within 1-2 levels, while a wrong pixel is still far off.
    ea = np.asarray(e, dtype=np.float32)
    aa = np.asarray(a, dtype=np.float32)
    pe = np.concatenate([ea[..., :3] * ea[..., 3:4] / 255.0, ea[..., 3:4]], axis=2)
    pa = np.concatenate([aa[..., :3] * aa[..., 3:4] / 255.0, aa[..., 3:4]], axis=2)
    m = np.abs(pe - pa).max(axis=2)
    # Semi-transparent pixels get a looser bound (8 levels, premultiplied): Phaser 3 premultiplies
    # on upload and again on read-back, which measurably moves a 12%-alpha texel by up to 8 levels.
    # Opaque pixels - all of classic pixel art - stay at the strict tolerance.
    soft = (np.minimum(ea[..., 3], aa[..., 3]) < 255) & (np.maximum(ea[..., 3], aa[..., 3]) > 0)
    limit = np.where(soft, max(tolerance, SOFT_TOLERANCE), tolerance) + 0.5
    # Nearly invisible texels (alpha < 16, i.e. < 6 % opacity) lose their colour in GPU round trips
    # (measured: (196,177,177,13) comes back as (255,0,0,13) from Phaser 3 and Pixi 8). Their alpha
    # is still compared exactly; their colour may differ by at most their own premultiplied weight.
    faint = np.maximum(ea[..., 3], aa[..., 3]) < 16
    limit = np.where(faint, np.maximum(limit, np.maximum(ea[..., 3], aa[..., 3]) + 0.5), limit)
    alpha_off = np.abs(ea[..., 3] - aa[..., 3]) > tolerance + 0.5
    m = np.where(faint & ~alpha_off, np.minimum(m, np.maximum(ea[..., 3], aa[..., 3])), m)
    differing = int((m > limit).sum())
    return {'ok': differing == 0, 'size': [list(e.size)] * 2, 'differing': differing,
            'maxDelta': int(round(float(m.max()))) if m.size else 0, 'pixels': e.size[0] * e.size[1]}


def compare_art(expected: Image.Image, actual: Image.Image, tolerance: int = 2) -> dict:
    """Compare the drawn art (trimmed to alpha) and, separately, its placement in the frame."""
    e, a = rgba(expected), rgba(actual)
    art = diff(trim(e), trim(a), tolerance)
    eb, ab = alpha_bbox(e), alpha_bbox(a)
    return {'art': art, 'placement': {'ok': eb == ab and e.size == a.size, 'expected': eb, 'actual': ab,
                                      'frameSize': [list(e.size), list(a.size)]}}


def unpremultiply(im: Image.Image) -> Image.Image:
    """Undo premultiplied colour in a capture. Drawing a sprite with ordinary alpha blending onto a
    TRANSPARENT target leaves rgb*a in the framebuffer (Godot's viewport, Phaser 3's snapshot and
    Pixi 8's extract all do; measured). Composited onto any opaque background that is exactly what a
    player sees, so dividing by alpha recovers the colours the engine really drew."""
    import numpy as np
    a = np.asarray(im.convert('RGBA'), dtype=np.float32).copy()
    alpha = a[..., 3:4]
    a[..., :3] = np.where(alpha > 0, np.clip(a[..., :3] * 255.0 / np.maximum(alpha, 1), 0, 255), 0)
    return Image.fromarray(np.round(a).astype('uint8'), 'RGBA')


def nearest(im: Image.Image, k: int) -> Image.Image:
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def key_to_alpha(im: Image.Image, key) -> Image.Image:
    """Turn a colour-keyed image into RGBA (exact key match -> transparent)."""
    im = im.convert('RGBA')
    solid = Image.new('RGB', im.size, tuple(key[:3]))
    r, g, b = ImageChops.difference(im.convert('RGB'), solid).split()
    exact = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 0 if v == 0 else 255)
    alpha = ImageChops.multiply(im.getchannel('A'), exact)
    out = Image.composite(im, Image.new('RGBA', im.size, (0, 0, 0, 0)), exact)
    out.putalpha(alpha)
    return out


def grid_cells(im: Image.Image, grid: dict, skip_empty: bool = True):
    """Cells of a uniform grid, reading order, as (col, row, image). `grid` uses the corpus truth keys."""
    cw, ch = grid['cellW'], grid['cellH']
    mx, my = grid.get('marginX', 0), grid.get('marginY', 0)
    sx, sy = grid.get('spacingX', 0), grid.get('spacingY', 0)
    cols = grid.get('cols') or (im.width - 2 * mx + sx) // (cw + sx)
    rows = grid.get('rows') or (im.height - 2 * my + sy) // (ch + sy)
    out = []
    for r in range(rows):
        for c in range(cols):
            x, y = mx + c * (cw + sx), my + r * (ch + sy)
            cell = im.crop((x, y, x + cw, y + ch))
            if skip_empty and alpha_bbox(cell) is None:
                continue
            out.append((c, r, cell))
    return out
