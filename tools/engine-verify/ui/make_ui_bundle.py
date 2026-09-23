"""Reference nerulio-ui bundle, built from the Kenney UI packs in the asset corpus (CC0), with every
engine file the Studio's UI export is expected to write. This is the executable spec of that export
until the Studio's own exporter exists: verify_ui.py runs the same engines on either.

    python tools/engine-verify/ui/make_ui_bundle.py <out folder> [--corrupt unity-order|tres-margins]

Layout of a bundle (all paths relative to nerulio-ui.json):

    nerulio-ui.json                     the schema in the module docstring of verify_ui.py
    <image>.png                         the source images, unchanged
    godot/<element>.tres                StyleBoxTexture per element (ext_resource path "../<image>.png")
    godot/<button>_theme.tres           Theme with Button/styles/normal|hover|pressed|disabled|focus
    godot/nerulio_ui_import.gd          helper: builds the same StyleBoxTextures/Theme from the JSON
    unity/Editor/NerulioUIImporter.cs   helper: sprite borders, import settings, button prefabs
    web/nerulio-ui.css                  one class per element (border-image)
    web/<element>.png                   the element cut out, for CSS only (border-image cannot crop)
    web/<image stem>.atlas.json         TexturePacker JSON hash per image with Phaser `scale9Borders`
                                        and Pixi `borders` on every frame

`--corrupt` writes a deliberately broken bundle for the negative controls (the verifier must FAIL it):
  unity-order   the Unity importer is given borders in L,T,R,B instead of L,B,R,T
  tres-margins  every .tres swaps its left/right texture margins
"""
from __future__ import annotations
import json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent

UI = Path.home() / 'nerulio-asset-corpus' / 'ui'
HELPERS = HERE / 'helpers'


def _calib() -> Image.Image:
    # 16x14, every texel a different colour, so any wrong texel anywhere is visible
    a = np.zeros((14, 16, 4), dtype=np.uint8)
    for y in range(14):
        for x in range(16):
            a[y, x] = (x * 15 + 10, y * 17 + 8, ((x + y) % 3) * 80 + 40, 255)
    return Image.fromarray(a, 'RGBA')


def _derive(base: Image.Image, kind: str) -> Image.Image:
    a = np.asarray(base.convert('RGBA')).astype(np.int32).copy()
    vis = a[..., 3] > 0
    if kind == 'hover':
        a[..., :3] = np.where(vis[..., None], np.clip(a[..., :3] + 30, 0, 255), a[..., :3])
    elif kind == 'disabled':
        g = (a[..., 0] * 299 + a[..., 1] * 587 + a[..., 2] * 114) // 1000
        a[..., 0] = a[..., 1] = a[..., 2] = g
        a[..., 3] = a[..., 3] // 2
    elif kind == 'focus':
        # a 3 px ring on the button's outline, transparent inside: an overlay, like Godot's focus box
        h, w = vis.shape
        yy, xx = np.mgrid[0:h, 0:w]
        edge = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)) < 3
        ring = vis & edge
        a[...] = 0
        a[ring] = (255, 214, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def build(out: Path, corrupt: str | None = None) -> Path:
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    rpg, pack = UI / 'kenney-ui-pack-rpg-expansion', UI / 'kenney-ui-pack'
    images = []

    def add_image(name, im: Image.Image | Path):
        if isinstance(im, Path):
            shutil.copy2(im, out / name)
            im = Image.open(im)
        else:
            im.save(out / name)
        images.append({'file': name, 'width': im.width, 'height': im.height})
        return len(images) - 1

    calib = add_image('calib.png', _calib())
    panel = add_image('panel_beige.png', rpg / 'panel_beige.png')
    normal_src = pack / 'blue_button_rectangle_depth_flat.png'
    normal = add_image('blue_button_rectangle_depth_flat.png', normal_src)
    pressed = add_image('blue_button_rectangle_flat.png', pack / 'blue_button_rectangle_flat.png')
    base = Image.open(normal_src)
    hover = add_image('blue_button_hover.png', _derive(base, 'hover'))
    disabled = add_image('blue_button_disabled.png', _derive(base, 'disabled'))
    focus = add_image('blue_button_focus.png', _derive(base, 'focus'))
    gradient = add_image('blue_button_rectangle_depth_gradient.png', pack / 'blue_button_rectangle_depth_gradient.png')
    sheet = add_image('uipack_rpg_sheet.png', rpg / 'uipack_rpg_sheet.png')

    def el(image, border, *, h='stretch', v='stretch', center=True, padding=None, rect=None):
        img = images[image]
        L, R, T, B = border
        return {'image': image, 'rect': rect or {'x': 0, 'y': 0, 'w': img['width'], 'h': img['height']},
                'nineSlice': {'left': L, 'right': R, 'top': T, 'bottom': B},
                'padding': None if padding is None else dict(zip(('left', 'right', 'top', 'bottom'), padding)),
                'stretch': {'horizontal': h, 'vertical': v}, 'drawCenter': center}

    cb = (3, 5, 2, 4)  # asymmetric on purpose: a swapped side or a flipped axis cannot pass
    btn = (6, 6, 5, 9)  # corpus truth for button_rectangle_depth_flat (bottom includes the 4 px lip)
    elements = {
        'calib_stretch': el(calib, cb, padding=(4, 6, 3, 5)),
        'calib_tile': el(calib, cb, h='tile', v='tile'),
        'calib_fit': el(calib, cb, h='tile-fit', v='tile-fit'),
        'calib_mixed': el(calib, cb, h='tile', v='stretch'),
        'calib_nocenter': el(calib, cb, center=False),
        'panel': el(panel, (12, 12, 12, 12), padding=(10, 10, 10, 10)),
        'panel_tile': el(panel, (12, 12, 12, 12), h='tile', v='tile'),
        'panel_fit': el(panel, (12, 12, 12, 12), h='tile-fit', v='tile-fit'),
        'btn_normal': el(normal, btn, padding=(12, 12, 8, 12)),
        'btn_hover': el(hover, btn, padding=(12, 12, 8, 12)),
        'btn_pressed': el(pressed, (6, 6, 5, 5), padding=(12, 12, 10, 10)),
        'btn_disabled': el(disabled, btn, padding=(12, 12, 8, 12)),
        'btn_focus': el(focus, btn, center=False),
        'gradient_3slice': el(gradient, (6, 6, 0, 0)),
        # atlas elements: a region of a 512x512 sheet (Unity: Multiple sprites, bottom-left origin)
        'atlas_panel_blue': el(sheet, (12, 12, 12, 12), h='tile', v='tile', rect={'x': 190, 'y': 0, 'w': 100, 'h': 100}),
        'atlas_button_brown': el(sheet, (10, 10, 8, 12), rect={'x': 0, 'y': 49, 'w': 190, 'h': 49}),
    }
    data = {'format': 'nerulio-ui', 'version': 1, 'images': images, 'elements': elements,
            'buttons': {'blue': {'normal': 'btn_normal', 'hover': 'btn_hover', 'pressed': 'btn_pressed',
                                 'disabled': 'btn_disabled', 'focus': 'btn_focus'}},
            'previews': [{'element': 'btn_normal', 'w': 300, 'h': 80, 'scale': 1},
                         {'element': 'panel', 'w': 250, 'h': 150, 'scale': 2}]}
    (out / 'nerulio-ui.json').write_text(json.dumps(data, indent=1), encoding='utf-8')
    write_engine_files(out, data, corrupt)
    return out


# ---------------------------------------------------------------- Godot

GODOT_AXIS = {'stretch': 0, 'tile': 1, 'tile-fit': 2}  # StyleBoxTexture.AxisStretchMode / NinePatchRect.AXIS_STRETCH_MODE_*


def _stylebox_props(data: dict, name: str, corrupt=None) -> list[str]:
    e = data['elements'][name]
    ns, r = e['nineSlice'], e['rect']
    img = data['images'][e['image']]
    L, R = (ns['right'], ns['left']) if corrupt == 'tres-margins' else (ns['left'], ns['right'])
    lines = []
    pad = e.get('padding')
    if pad:  # content_margin_* default to -1 = "use the texture margins"
        for side in ('left', 'top', 'right', 'bottom'):
            lines.append(f'content_margin_{side} = {float(pad[side])!r}')
    lines += [f'texture_margin_left = {float(L)!r}', f'texture_margin_top = {float(ns["top"])!r}',
              f'texture_margin_right = {float(R)!r}', f'texture_margin_bottom = {float(ns["bottom"])!r}']
    st = e.get('stretch') or {}
    h, v = GODOT_AXIS[st.get('horizontal', 'stretch')], GODOT_AXIS[st.get('vertical', 'stretch')]
    if h:
        lines.append(f'axis_stretch_horizontal = {h}')
    if v:
        lines.append(f'axis_stretch_vertical = {v}')
    if (r['x'], r['y'], r['w'], r['h']) != (0, 0, img['width'], img['height']):
        lines.append(f'region_rect = Rect2({r["x"]}, {r["y"]}, {r["w"]}, {r["h"]})')
    if not e.get('drawCenter', True):
        lines.append('draw_center = false')
    return lines


def godot_stylebox_tres(data: dict, name: str, corrupt=None) -> str:
    """One StyleBoxTexture resource, Godot 4 text format, texture referenced relatively."""
    img = data['images'][data['elements'][name]['image']]
    return ('[gd_resource type="StyleBoxTexture" format=3]\n\n'
            f'[ext_resource type="Texture2D" path="../{img["file"]}" id="1_tex"]\n\n'
            '[resource]\n' + '\n'.join(['texture = ExtResource("1_tex")'] + _stylebox_props(data, name, corrupt)) + '\n')


GODOT_STATES = {'normal': 'normal', 'hover': 'hover', 'pressed': 'pressed', 'disabled': 'disabled', 'focus': 'focus'}


def godot_theme_tres(data: dict, button: str, corrupt=None) -> str:
    """A Theme for Button with one StyleBoxTexture per state (Godot draws `focus` ON TOP of the state box)."""
    states = data['buttons'][button]
    imgs, ext = [], {}
    for st, elname in states.items():
        f = data['images'][data['elements'][elname]['image']]['file']
        if f not in ext:
            ext[f] = f'{len(ext) + 1}_tex'
    out = ['[gd_resource type="Theme" format=3]', '']
    for f, i in ext.items():
        out.append(f'[ext_resource type="Texture2D" path="../{f}" id="{i}"]')
    out.append('')
    for st, elname in states.items():
        f = data['images'][data['elements'][elname]['image']]['file']
        out.append(f'[sub_resource type="StyleBoxTexture" id="StyleBoxTexture_{st}"]')
        out.append(f'texture = ExtResource("{ext[f]}")')
        out += _stylebox_props(data, elname, corrupt)
        out.append('')
    out.append('[resource]')
    for st in states:
        out.append(f'Button/styles/{GODOT_STATES[st]} = SubResource("StyleBoxTexture_{st}")')
    return '\n'.join(out) + '\n'


# ---------------------------------------------------------------- CSS

CSS_REPEAT = {'stretch': 'stretch', 'tile': 'repeat', 'tile-fit': 'round', 'space': 'space'}


def css(data: dict) -> str:
    """One class per element. Set --nui-scale on the element (or an ancestor) for 2x/3x pixel art.
    border-image-width draws the slices; border-width only sets the content inset (the padding), so
    the two are independent. `fill` draws the centre (drawCenter)."""
    out = ['/* nerulio-ui: one class per element; size the element with width/height (border-box). */',
           '[class^="nui-"],[class*=" nui-"]{box-sizing:border-box;border-style:solid;border-color:transparent;image-rendering:pixelated}']
    for name, e in data['elements'].items():
        ns = e['nineSlice']
        pad = e.get('padding') or ns
        st = e.get('stretch') or {}
        px = lambda v: f'calc({v}px * var(--nui-scale, 1))'
        img = data['images'][e['image']]
        whole = (e['rect']['x'], e['rect']['y'], e['rect']['w'], e['rect']['h']) == (0, 0, img['width'], img['height'])
        src = f'../{img["file"]}' if whole else f'{name}.png'
        out.append(f'.nui-{name}{{border-width:{px(pad["top"])} {px(pad["right"])} {px(pad["bottom"])} {px(pad["left"])};'
                   f'border-image-source:url("{src}");'
                   f'border-image-slice:{ns["top"]} {ns["right"]} {ns["bottom"]} {ns["left"]}{" fill" if e.get("drawCenter", True) else ""};'
                   f'border-image-width:{px(ns["top"])} {px(ns["right"])} {px(ns["bottom"])} {px(ns["left"])};'
                   f'border-image-repeat:{CSS_REPEAT[st.get("horizontal", "stretch")]} {CSS_REPEAT[st.get("vertical", "stretch")]}}}')
    return '\n'.join(out) + '\n'


# ---------------------------------------------------------------- Phaser / Pixi atlas JSON

def atlas_json(data: dict, image_index: int) -> dict:
    img = data['images'][image_index]
    frames = {}
    for name, e in data['elements'].items():
        if e['image'] != image_index:
            continue
        r, ns = e['rect'], e['nineSlice']
        frames[name] = {'frame': {'x': r['x'], 'y': r['y'], 'w': r['w'], 'h': r['h']}, 'rotated': False, 'trimmed': False,
                        'spriteSourceSize': {'x': 0, 'y': 0, 'w': r['w'], 'h': r['h']}, 'sourceSize': {'w': r['w'], 'h': r['h']},
                        # Phaser 3.70+/4 (Frame.setScale9): the CENTRE rectangle
                        'scale9Borders': {'x': ns['left'], 'y': ns['top'], 'w': r['w'] - ns['left'] - ns['right'], 'h': r['h'] - ns['top'] - ns['bottom']},
                        # PixiJS 8 (Texture.defaultBorders, used by NineSliceSprite)
                        'borders': {'left': ns['left'], 'top': ns['top'], 'right': ns['right'], 'bottom': ns['bottom']}}
    return {'frames': frames, 'meta': {'app': 'nerulio-ui', 'image': f'../{img["file"]}', 'size': {'w': img['width'], 'h': img['height']}, 'scale': '1'}}


def write_engine_files(out: Path, data: dict, corrupt=None):
    g = out / 'godot'
    g.mkdir()
    for name in data['elements']:
        (g / f'{name}.tres').write_text(godot_stylebox_tres(data, name, corrupt), encoding='utf-8')
    for b in data.get('buttons') or {}:
        (g / f'{b}_theme.tres').write_text(godot_theme_tres(data, b, corrupt), encoding='utf-8')
    shutil.copy2(HELPERS / 'nerulio_ui_import.gd', g / 'nerulio_ui_import.gd')
    u = out / 'unity' / 'Editor'
    u.mkdir(parents=True)
    cs = (HELPERS / 'NerulioUIImporter.cs').read_text(encoding='utf-8')
    if corrupt == 'unity-order':
        needle = 'new Vector4(L, B, R, T)'
        assert needle in cs, 'NerulioUIImporter.cs no longer builds its border with new Vector4(L, B, R, T)'
        cs = cs.replace(needle, 'new Vector4(L, T, R, B)')
    (u / 'NerulioUIImporter.cs').write_text(cs, encoding='utf-8')
    w = out / 'web'
    w.mkdir()
    (w / 'nerulio-ui.css').write_text(css(data), encoding='utf-8')
    for name, e in data['elements'].items():
        img = data['images'][e['image']]
        r = e['rect']
        if (r['x'], r['y'], r['w'], r['h']) != (0, 0, img['width'], img['height']):
            Image.open(out / img['file']).convert('RGBA').crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])).save(w / f'{name}.png')
    for i, img in enumerate(data['images']):
        (w / f'{Path(img["file"]).stem}.atlas.json').write_text(json.dumps(atlas_json(data, i), indent=1), encoding='utf-8')


if __name__ == '__main__':
    corrupt = sys.argv[sys.argv.index('--corrupt') + 1] if '--corrupt' in sys.argv else None
    print(build(Path(sys.argv[1]), corrupt))
