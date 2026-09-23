"""Reference font bundles for verify_font.py, made with the real msdf-atlas-gen CLI (Chlumsky
msdf-atlas-gen v1.4, Windows release, cached in %LOCALAPPDATA%/nerulio-engine-verify/msdfgen) from
the corpus fonts, plus the Cozette BMFont as shipped.

    python tools/engine-verify/ui/make_font_refs.py <out folder> [--only kf-msdf,...]

One folder per font id, each a bundle as the Studio would export it:

    <id>.json / <id>.png     msdf-atlas-gen JSON + atlas (as the CLI wrote them)
    <id>.fnt                 BMFont text   (+ distanceField line for sdf/psdf/msdf/mtsdf)
    <id>.xml                 BMFont XML    (+ <distanceField/>)
    <id>-xml.fnt             the same XML under a .fnt name (what Godot's importer is given)
    <id>.bin.fnt             BMFont binary v3 (bitmaps only: the format has no distance-field block)
    <id>_<n>.png             BMFont pages (bitmaps: white + alpha; fields: opaque channels)
    source.json              the TTF and characters (the outline truth for verify_font.py)

Font ids: kf-{msdf,mtsdf,sdf,bitmap} = Kenney Future, ASCII, 32 px/em, pxrange 4, y origin bottom;
gm-{msdf,mtsdf,sdf} = Galmuri11, ASCII + Korean UI words, 32 px/em, y origin top; gm-bitmap =
Galmuri11 hardmask at 24 px/em (its 12 px pixel grid x2) repacked into 128x128 pages (multi-page
Hangul); cozette = the corpus Cozette BMFont text file and page, also written as XML and binary.

Kenney Future has no kerning table (msdf-atlas-gen finds 0 pairs), so the kf-* JSON gets four
SYNTHETIC pairs (A-V, V-A, T-o, A-W) to prove that engines apply the pairs a file carries.
"""
from __future__ import annotations
import json, os, shutil, subprocess, sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import font_formats as F  # noqa: E402

CACHE = Path(os.environ.get('NERULIO_ENGINE_CACHE', Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'nerulio-engine-verify'))
MSDF = CACHE / 'msdfgen' / 'msdf-atlas-gen-1.4' / 'msdf-atlas-gen' / 'msdf-atlas-gen.exe'
FONTS = Path.home() / 'nerulio-asset-corpus' / 'fonts'
KOREAN = '새 게임 계속하기 설정 종료 확인 취소 레벨 체력 공격'
SYNTHETIC_KERNING = [('A', 'V', -0.1), ('V', 'A', -0.1), ('T', 'o', -0.08), ('A', 'W', -0.06)]

SPECS = {
    'kf-msdf': dict(font='kenney-fonts/KenneyFuture.ttf', type='msdf', size=32, pxrange=4, yorigin='bottom', korean=False),
    'kf-mtsdf': dict(font='kenney-fonts/KenneyFuture.ttf', type='mtsdf', size=32, pxrange=4, yorigin='bottom', korean=False),
    'kf-sdf': dict(font='kenney-fonts/KenneyFuture.ttf', type='sdf', size=32, pxrange=4, yorigin='bottom', korean=False),
    'kf-bitmap': dict(font='kenney-fonts/KenneyFuture.ttf', type='hardmask', size=32, pxrange=2, yorigin='bottom', korean=False),
    'gm-msdf': dict(font='galmuri/Galmuri11.ttf', type='msdf', size=32, pxrange=4, yorigin='top', korean=True),
    'gm-mtsdf': dict(font='galmuri/Galmuri11.ttf', type='mtsdf', size=32, pxrange=4, yorigin='top', korean=True),
    'gm-sdf': dict(font='galmuri/Galmuri11.ttf', type='sdf', size=32, pxrange=4, yorigin='top', korean=True),
    'gm-bitmap': dict(font='galmuri/Galmuri11.ttf', type='hardmask', size=24, pxrange=2, yorigin='top', korean=True, pages=128),
}


def msdf_ready():
    if not MSDF.exists():
        raise FileNotFoundError(f'msdf-atlas-gen is not at {MSDF} (Chlumsky/msdf-atlas-gen v1.4 Windows release)')
    return MSDF


def chars_of(spec) -> str:
    s = ''.join(chr(c) for c in range(0x20, 0x7f))
    if spec['korean']:
        s += ''.join(dict.fromkeys(ch for ch in KOREAN if ch != ' '))
    return s


def make(fid: str, spec: dict, out: Path):
    d = out / fid
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)
    chars = chars_of(spec)
    cs = d / '_charset.txt'
    cs.write_text('[0x20, 0x7e]\n' + (json.dumps(''.join(dict.fromkeys(KOREAN.replace(' ', '')))) + '\n' if spec['korean'] else ''), encoding='utf-8')
    cmd = [str(msdf_ready()), '-font', str(FONTS / spec['font']), '-charset', str(cs), '-type', spec['type'], '-size', str(spec['size']),
           '-pxrange', str(spec['pxrange']), '-pxalign', 'on', '-yorigin', spec['yorigin'], '-json', str(d / f'{fid}.json'), '-imageout', str(d / f'{fid}.png')]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if p.returncode != 0 or not (d / f'{fid}.json').exists():
        raise RuntimeError(f'msdf-atlas-gen failed for {fid}: {p.stdout[-800:]} {p.stderr[-800:]}')
    cs.unlink()
    data = F.load_atlas_json(d / f'{fid}.json')
    if fid.startswith('kf-'):
        data['kerning'] = data.get('kerning', []) + [{'unicode1': ord(a), 'unicode2': ord(b), 'advance': v} for a, b, v in SYNTHETIC_KERNING]
        (d / f'{fid}.json').write_text(json.dumps(data, indent=1), encoding='utf-8')
    atlas = F.page_rgba(Image.open(d / f'{fid}.png'), spec['type'])
    font, pages = F.bmfont_from_atlas(data, spec.get('pages'), atlas, name=fid, face=Path(spec['font']).stem)
    for i, pg in enumerate(pages):
        pg.save(d / f'{fid}_{i}.png')
    (d / f'{fid}.fnt').write_text(F.write_text(font), encoding='utf-8')
    xml = F.write_xml(font)
    (d / f'{fid}.xml').write_text(xml, encoding='utf-8')
    (d / f'{fid}-xml.fnt').write_text(xml, encoding='utf-8')
    if not font['distanceField']:
        (d / f'{fid}.bin.fnt').write_bytes(F.write_binary(font))
    (d / 'source.json').write_text(json.dumps({'ttf': str(FONTS / spec['font']), 'chars': chars, 'type': spec['type'], 'size': spec['size'],
                                               'pxrange': spec['pxrange'], 'yOrigin': spec['yorigin'], 'pages': len(pages),
                                               'bmfontRoundingError': font['roundingError'],
                                               'syntheticKerning': fid.startswith('kf-')}, ensure_ascii=False, indent=1), encoding='utf-8')
    return d


def make_cozette(out: Path):
    d = out / 'cozette'
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)
    src = FONTS / 'cozette-bmfont'
    shutil.copy2(src / 'Cozette-standard.fnt', d / 'cozette.fnt')
    font = F.read_bmfont(src / 'Cozette-standard.fnt')
    Image.open(src / 'Cozette-standard.png').save(d / 'cozette_0.png')
    font['pages'] = ['cozette_0.png']
    txt = (d / 'cozette.fnt').read_text(encoding='utf-8')
    (d / 'cozette.fnt').write_text(txt.replace('file="Cozette-standard.png"', 'file="cozette_0.png"'), encoding='utf-8')
    font['info'] = {'face': 'Cozette', 'size': font['info'].get('size', 13), 'bold': 0, 'italic': 0, 'charset': '', 'unicode': 1, 'stretchH': 100,
                    'smooth': 0, 'aa': 1, 'padding': [2, 2, 2, 2], 'spacing': [0, 0]}
    font['common'] = {k: font['common'][k] for k in ('lineHeight', 'base', 'scaleW', 'scaleH', 'pages')} | {'packed': 0}
    xml = F.write_xml(font)
    (d / 'cozette.xml').write_text(xml, encoding='utf-8')
    (d / 'cozette-xml.fnt').write_text(xml, encoding='utf-8')
    (d / 'cozette.bin.fnt').write_bytes(F.write_binary(font))
    ascii_chars = ''.join(chr(c['id']) for c in font['chars'] if 0x21 <= c['id'] < 0x7f)
    (d / 'source.json').write_text(json.dumps({'ttf': None, 'chars': ascii_chars, 'type': 'bitmap-bmfont', 'size': font['info']['size'], 'pages': 1},
                                              indent=1), encoding='utf-8')
    return d


def main():
    out = Path(sys.argv[1])
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
    out.mkdir(parents=True, exist_ok=True)
    for fid, spec in SPECS.items():
        if only and fid not in only:
            continue
        d = make(fid, spec, out)
        src = json.loads((d / 'source.json').read_text(encoding='utf-8'))
        print(fid, 'pages', src['pages'], 'rounding', round(src['bmfontRoundingError'], 3))
    if not only or 'cozette' in only:
        make_cozette(out)
        print('cozette')


if __name__ == '__main__':
    main()
