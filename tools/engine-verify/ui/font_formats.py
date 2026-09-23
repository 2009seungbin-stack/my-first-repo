"""Font file formats for the UI verifiers: msdf-atlas-gen JSON reading, BMFont writers (text, XML,
binary v3) and readers, multi-page repacking. This is also the reference for the Studio's font
exporter: a bundle written by these functions is what verify_font.py expects to pass.

Conventions (all measured against the engines, see verify_font.py):
* msdf-atlas-gen `atlasBounds` are the glyph box edges in atlas pixels, inset by half a pixel
  (e.g. 164.5..189.5); `planeBounds` are the same box in ems. The BMFont glyph rect is the whole
  texels around it, and xoffset/yoffset absorb the half pixel. With `-pxalign on` the result is an
  integer, as BMFont needs; otherwise it is rounded (<= 0.5 px error, reported).
* BMFont `base` = ascender in px, `yoffset` = distance from the line top to the glyph rect top.
* Distance fields: `distanceField fieldType=msdf|mtsdf|sdf|psdf distanceRange=N` (text) and
  `<distanceField fieldType="" distanceRange=""/>` (XML) - the msdf-bmfont-xml convention that
  PixiJS 8 reads. Binary BMFont v3 has no block for it (so binary is written for bitmaps only).
"""
from __future__ import annotations
import json, math, struct
from pathlib import Path
import numpy as np
from PIL import Image


# ---------------------------------------------------------------- msdf-atlas-gen JSON

def load_atlas_json(path: Path) -> dict:
    d = json.loads(Path(path).read_text(encoding='utf-8'))
    if not ('atlas' in d and 'glyphs' in d and 'metrics' in d):
        raise ValueError(f'{path} is not msdf-atlas-gen JSON')
    return d


def glyph_boxes(d: dict) -> dict:
    """unicode -> dict(adv px, box (x0,y0,x1,y1) whole texels top-down or None, off (x,y) px of the
    box's top-left relative to the pen on the baseline, y DOWN; exact float values)."""
    a, m = d['atlas'], d['metrics']
    S, H = a['size'], a['height']
    top = a.get('yOrigin', 'bottom') == 'top'
    out = {}
    for g in d['glyphs']:
        e = {'adv': g['advance'] * S, 'box': None, 'off': None, 'unicode': g['unicode']}
        ab, pb = g.get('atlasBounds'), g.get('planeBounds')
        if ab and pb:
            if top:
                at, abot = ab['top'], ab['bottom']          # already top-down
                ptop_up = -pb['top']                         # y-up em of the box top
            else:
                at, abot = H - ab['top'], H - ab['bottom']
                ptop_up = pb['top']
            x0, x1 = math.floor(ab['left']), math.ceil(ab['right'])
            y0, y1 = math.floor(at), math.ceil(abot)
            offx = pb['left'] * S - (ab['left'] - x0)
            offy = -ptop_up * S - (at - y0)
            e.update(box=(x0, y0, x1, y1), off=(offx, offy), exact={'uv': (ab['left'], at, ab['right'] - ab['left'], abot - at),
                                                                    'plane': (pb['left'] * S, -ptop_up * S, (pb['right'] - pb['left']) * S, abs(pb['top'] - pb['bottom']) * S)})
        out[g['unicode']] = e
    return out


def metrics_px(d: dict) -> dict:
    a, m = d['atlas'], d['metrics']
    S = a['size']
    sign = -1 if a.get('yOrigin', 'bottom') == 'top' else 1
    return {'size': S, 'ascender': sign * m['ascender'] * S, 'descender': sign * m['descender'] * S, 'lineHeight': m['lineHeight'] * S}


# ---------------------------------------------------------------- BMFont model

def bmfont_from_atlas(d: dict, page_size: int | None = None, image: Image.Image | None = None, name='font', face='font'):
    """Returns (font dict, [page images]). With page_size, glyph rects are repacked into as many
    page_size x page_size pages as needed (multi-page, e.g. CJK)."""
    a = d['atlas']
    mp = metrics_px(d)
    S = a['size']
    boxes = glyph_boxes(d)
    chars, worst = [], 0.0
    for u, e in sorted(boxes.items()):
        c = {'id': u, 'x': 0, 'y': 0, 'width': 0, 'height': 0, 'xoffset': 0, 'yoffset': 0, 'xadvance': round(e['adv']), 'page': 0, 'chnl': 15}
        if e['box']:
            x0, y0, x1, y1 = e['box']
            xo, yo = e['off'][0], mp['ascender'] + e['off'][1]
            worst = max(worst, abs(xo - round(xo)), abs(yo - round(yo)))
            c.update(x=x0, y=y0, width=x1 - x0, height=y1 - y0, xoffset=round(xo), yoffset=round(yo))
        chars.append(c)
    pages = [image] if image is not None else []
    if page_size and image is not None:
        pages = _repack(chars, image, page_size)
    kern = [{'first': k['unicode1'], 'second': k['unicode2'], 'amount': round(k['advance'] * S)} for k in d.get('kerning', [])]
    font = {'info': {'face': face, 'size': S, 'bold': 0, 'italic': 0, 'charset': '', 'unicode': 1, 'stretchH': 100, 'smooth': 1, 'aa': 1,
                     'padding': [0, 0, 0, 0], 'spacing': [1, 1]},
            'common': {'lineHeight': round(mp['lineHeight']), 'base': round(mp['ascender']), 'scaleW': (pages[0].width if pages else a['width']),
                       'scaleH': (pages[0].height if pages else a['height']), 'pages': max(1, len(pages)), 'packed': 0},
            'pages': [f'{name}_{i}.png' for i in range(max(1, len(pages)))], 'chars': chars, 'kernings': kern,
            'distanceField': None if a['type'] in ('hardmask', 'softmask') else {'fieldType': a['type'], 'distanceRange': a['distanceRange']},
            'roundingError': worst}
    return font, pages


def _repack(chars, image: Image.Image, P: int):
    """Shelf-pack every glyph rect into P x P pages (1 px gap), copying pixels; updates chars in place."""
    order = sorted([c for c in chars if c['width'] and c['height']], key=lambda c: (-c['height'], c['id']))
    pages, x, y, row, page = [Image.new(image.mode, (P, P), 0 if image.mode in ('L', 'RGB') else (0, 0, 0, 0))], 1, 1, 0, 0
    for c in order:
        w, h = c['width'], c['height']
        if w + 2 > P or h + 2 > P:
            raise ValueError(f'glyph {c["id"]} ({w}x{h}) does not fit a {P}px page')
        if x + w + 1 > P:
            x, y, row = 1, y + row + 1, 0
        if y + h + 1 > P:
            pages.append(Image.new(image.mode, (P, P), 0 if image.mode in ('L', 'RGB') else (0, 0, 0, 0)))
            page += 1
            x, y, row = 1, 1, 0
        pages[page].paste(image.crop((c['x'], c['y'], c['x'] + w, c['y'] + h)), (x, y))
        c.update(x=x, y=y, page=page)
        x += w + 1
        row = max(row, h)
    return pages


def page_rgba(img: Image.Image, atlas_type: str) -> Image.Image:
    """What a BMFont page holds: a bitmap (hardmask/softmask) becomes white with the mask as alpha;
    distance fields keep their channels, opaque (sdf/psdf grey in RGB, msdf in RGB, mtsdf RGBA)."""
    if atlas_type in ('hardmask', 'softmask'):
        m = img.convert('L')
        out = Image.new('RGBA', img.size, (255, 255, 255, 0))
        out.putalpha(m)
        return out
    if atlas_type in ('sdf', 'psdf'):
        return img.convert('L').convert('RGBA')
    if atlas_type == 'msdf':
        return img.convert('RGB').convert('RGBA')
    return img.convert('RGBA')


# ---------------------------------------------------------------- writers

def _q(v):
    return f'"{v}"' if isinstance(v, str) else (','.join(map(str, v)) if isinstance(v, (list, tuple)) else str(v))


def write_text(font: dict) -> str:
    i, c = font['info'], font['common']
    lines = ['info ' + ' '.join(f'{k}={_q(v)}' for k, v in i.items()),
             'common ' + ' '.join(f'{k}={v}' for k, v in c.items())]
    lines += [f'page id={n} file="{f}"' for n, f in enumerate(font['pages'])]
    if font.get('distanceField'):
        df = font['distanceField']
        lines.append(f'distanceField fieldType={df["fieldType"]} distanceRange={df["distanceRange"]}')
    lines.append(f'chars count={len(font["chars"])}')
    keys = ('id', 'x', 'y', 'width', 'height', 'xoffset', 'yoffset', 'xadvance', 'page', 'chnl')
    lines += ['char ' + ' '.join(f'{k}={ch[k]}' for k in keys) for ch in font['chars']]
    if font['kernings']:
        lines.append(f'kernings count={len(font["kernings"])}')
        lines += [f'kerning first={k["first"]} second={k["second"]} amount={k["amount"]}' for k in font['kernings']]
    return '\n'.join(lines) + '\n'


def write_xml(font: dict) -> str:
    from xml.sax.saxutils import quoteattr
    i, c = font['info'], font['common']
    a = lambda d: ' '.join(f'{k}={quoteattr(_q(v).strip(chr(34)) if not isinstance(v, str) else v)}' for k, v in d.items())
    out = ['<?xml version="1.0"?>', '<font>', f'  <info {a(i)}/>', f'  <common {a(c)}/>', '  <pages>']
    out += [f'    <page id="{n}" file={quoteattr(f)}/>' for n, f in enumerate(font['pages'])]
    out.append('  </pages>')
    if font.get('distanceField'):
        df = font['distanceField']
        out.append(f'  <distanceField fieldType="{df["fieldType"]}" distanceRange="{df["distanceRange"]}"/>')
    out.append(f'  <chars count="{len(font["chars"])}">')
    keys = ('id', 'x', 'y', 'width', 'height', 'xoffset', 'yoffset', 'xadvance', 'page', 'chnl')
    out += ['    <char ' + ' '.join(f'{k}="{ch[k]}"' for k in keys) + '/>' for ch in font['chars']]
    out.append('  </chars>')
    if font['kernings']:
        out.append(f'  <kernings count="{len(font["kernings"])}">')
        out += [f'    <kerning first="{k["first"]}" second="{k["second"]}" amount="{k["amount"]}"/>' for k in font['kernings']]
        out.append('  </kernings>')
    out.append('</font>')
    return '\n'.join(out) + '\n'


def write_binary(font: dict) -> bytes:
    """AngelCode BMFont binary, version 3 (no distance-field block exists in this format)."""
    i, c = font['info'], font['common']
    name = i['face'].encode('utf-8') + b'\0'
    bits = (1 if i.get('smooth') else 0) | (2 if i.get('unicode') else 0) | (4 if i.get('italic') else 0) | (8 if i.get('bold') else 0)
    pad, sp = i.get('padding', [0, 0, 0, 0]), i.get('spacing', [0, 0])
    info = struct.pack('<hBBHBBBBBBBB', i['size'], bits, 0, i.get('stretchH', 100), i.get('aa', 1), *pad, *sp, 0) + name
    common = struct.pack('<HHHHHBBBBB', c['lineHeight'], c['base'], c['scaleW'], c['scaleH'], c['pages'], 0, 0, 0, 0, 0)
    n = max(len(p) for p in font['pages'])
    pages = b''.join(p.encode('utf-8').ljust(n, b'\0') + b'\0' for p in font['pages'])
    chars = b''.join(struct.pack('<IHHHHhhhBB', ch['id'], ch['x'], ch['y'], ch['width'], ch['height'], ch['xoffset'], ch['yoffset'], ch['xadvance'], ch['page'], ch['chnl'])
                     for ch in font['chars'])
    blocks = [(1, info), (2, common), (3, pages), (4, chars)]
    if font['kernings']:
        blocks.append((5, b''.join(struct.pack('<IIh', k['first'], k['second'], k['amount']) for k in font['kernings'])))
    return b'BMF\x03' + b''.join(struct.pack('<BI', t, len(b)) + b for t, b in blocks)


# ---------------------------------------------------------------- readers

def read_bmfont(path: Path) -> dict:
    """Text, XML or binary BMFont -> the same dict shape the writers take."""
    raw = Path(path).read_bytes()
    if raw.startswith(b'BMF'):
        return _read_binary(raw)
    text = raw.decode('utf-8-sig', errors='replace')
    if text.lstrip().startswith('<'):
        import xml.etree.ElementTree as ET
        root = ET.fromstring(text)
        font = {'info': dict(root.find('info').attrib), 'common': {k: int(v) for k, v in root.find('common').attrib.items() if v.lstrip('-').isdigit()},
                'pages': [p.get('file') for p in root.find('pages')], 'chars': [], 'kernings': [], 'distanceField': None}
        for ch in root.find('chars'):
            font['chars'].append({k: int(v) for k, v in ch.attrib.items()})
        k = root.find('kernings')
        for kk in (k if k is not None else []):
            font['kernings'].append({x: int(v) for x, v in kk.attrib.items()})
        df = root.find('distanceField')
        if df is not None:
            font['distanceField'] = {'fieldType': df.get('fieldType'), 'distanceRange': int(df.get('distanceRange'))}
        font['info']['size'] = int(font['info'].get('size', 0))
        return font
    import shlex
    font = {'info': {}, 'common': {}, 'pages': [], 'chars': [], 'kernings': [], 'distanceField': None}
    for line in text.splitlines():
        if not line.strip():
            continue
        parts = shlex.split(line, posix=True)
        tag, kv = parts[0], dict(p.split('=', 1) for p in parts[1:] if '=' in p)
        num = lambda v: int(v) if v.lstrip('-').isdigit() else v
        if tag == 'info':
            font['info'] = {k: num(v) for k, v in kv.items()}
        elif tag == 'common':
            font['common'] = {k: num(v) for k, v in kv.items()}
        elif tag == 'page':
            font['pages'].append(kv['file'])
        elif tag == 'char':
            font['chars'].append({k: int(v) for k, v in kv.items() if v.lstrip('-').isdigit()})
        elif tag == 'kerning':
            font['kernings'].append({k: int(v) for k, v in kv.items()})
        elif tag == 'distanceField':
            font['distanceField'] = {'fieldType': kv.get('fieldType'), 'distanceRange': int(kv.get('distanceRange', 0))}
    return font


def _read_binary(raw: bytes) -> dict:
    assert raw[:4] == b'BMF\x03', 'only BMFont binary v3'
    font = {'info': {}, 'common': {}, 'pages': [], 'chars': [], 'kernings': [], 'distanceField': None}
    p = 4
    while p < len(raw):
        t, n = struct.unpack_from('<BI', raw, p)
        b = raw[p + 5:p + 5 + n]
        p += 5 + n
        if t == 1:
            size, bits = struct.unpack_from('<hB', b)
            font['info'] = {'size': size, 'face': b[14:].split(b'\0')[0].decode('utf-8'), 'unicode': 1 if bits & 2 else 0}
        elif t == 2:
            lh, base, sw, sh, pages = struct.unpack_from('<HHHHH', b)
            font['common'] = {'lineHeight': lh, 'base': base, 'scaleW': sw, 'scaleH': sh, 'pages': pages}
        elif t == 3:
            font['pages'] = [s.decode('utf-8') for s in b.split(b'\0') if s]
        elif t == 4:
            for q in range(0, n, 20):
                v = struct.unpack_from('<IHHHHhhhBB', b, q)
                font['chars'].append(dict(zip(('id', 'x', 'y', 'width', 'height', 'xoffset', 'yoffset', 'xadvance', 'page', 'chnl'), v)))
        elif t == 5:
            for q in range(0, n, 10):
                f, s, amt = struct.unpack_from('<IIh', b, q)
                font['kernings'].append({'first': f, 'second': s, 'amount': amt})
    return font
