"""Offline image-to-PDF evidence verification. Requires Pillow, pypdf and pdftoppm.

Reads the expected local package only. Poppler PNG output is held in memory;
this program makes no network requests and does not modify the evidence files.
"""
from pathlib import Path
from PIL import Image
from pypdf import PdfReader
from collections import Counter
import argparse, hashlib, io, json, subprocess, zipfile

CONTROLS = ['alpha-control.png', 'alpha-control.webp', 'opaque-control.webp', 'opaque-control.jpg']
ENGINES = ['chromium', 'firefox']
EXTRAS = {'paired-analysis.json', 'fixed-environment.json', 'README.md', 'LICENSE.txt',
          'measure-pdf-image-alpha.py', 'verify-pdf-image-alpha.py',
          'before-chromium.png', 'after-chromium.png'}
ARCHIVE = 'pdf-image-alpha-evidence.zip'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def expected_files():
    files = set(EXTRAS)
    for state in ['before', 'after']:
        files.add(state + '/measurements.json')
        for name in CONTROLS:
            files.add(state + '/' + name)
            for engine in ENGINES:
                pdf = f'{state}/{engine}-{name}.pdf'
                files.update([pdf, pdf + '-poppler.png'])
    return files

def verify(root):
    root = root.resolve()
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    entries = manifest['files']
    assert len(entries) == len({e['path'] for e in entries})
    assert {e['path'] for e in entries} == expected_files()
    for entry in entries:
        path = (root / entry['path']).resolve()
        assert path.is_relative_to(root)
        data = path.read_bytes()
        assert len(data) == entry['bytes'] and sha(data) == entry['sha256'], entry['path']
    actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
    wanted = expected_files() | {'manifest.json'}
    archive_present = ARCHIVE in actual
    if archive_present:
        actual.remove(ARCHIVE)
        with zipfile.ZipFile(root / ARCHIVE) as archive:
            assert archive.testzip() is None
            names = archive.namelist()
            assert len(names) == len(set(names)) == len(wanted) and set(names) == wanted
            for name in names:
                assert archive.read(name) == (root / name).read_bytes(), name
    assert actual == wanted
    reports = {state: json.loads((root / state / 'measurements.json').read_text(encoding='utf-8'))
               for state in ['before', 'after']}
    for state in ['before', 'after']:
        assert (root / f'{state}-chromium.png').read_bytes() == (root / state / 'chromium-alpha-control.webp.pdf-poppler.png').read_bytes()
    assert reports['before']['inputs'] == reports['after']['inputs']
    assert reports['before']['protocolSHA256'] == reports['after']['protocolSHA256']
    assert reports['before']['protocolSHA256'] == sha((root / 'measure-pdf-image-alpha.py').read_bytes())
    rows, versions, jpeg_streams = [], {}, {}
    for state, report in reports.items():
        folder = root / state
        assert {item['name'] for item in report['inputs']} == set(CONTROLS)
        with Image.open(folder / CONTROLS[0]) as png, Image.open(folder / CONTROLS[1]) as webp:
            assert png.convert('RGBA').tobytes() == webp.convert('RGBA').tobytes()
        seen = set()
        for row in report['results']:
            engine, name = row['engine'], row['input']
            assert engine in ENGINES and name in CONTROLS and (engine, name) not in seen
            seen.add((engine, name)); versions.setdefault(engine, set()).add(row['browserVersion'])
            assert row['output'] == f'{engine}-{name}.pdf'
            assert row['render'] == row['output'] + '-poppler.png'
            source, pdf, render = folder / name, folder / row['output'], folder / row['render']
            declared = next(x for x in report['inputs'] if x['name'] == name)
            assert sha(source.read_bytes()) == declared['sha256']
            assert sha(pdf.read_bytes()) == row['outputSHA256']
            assert sha(render.read_bytes()) == row['renderSHA256']
            with Image.open(source) as image:
                assert image.size == (96, 96)
                alpha = image.convert('RGBA').getchannel('A').tobytes()
            assert Counter(alpha) == ({0:5120, 128:2048, 255:2048} if name.startswith('alpha-') else {255:9216})
            doc = PdfReader(pdf); assert len(doc.pages) == 1
            page = doc.pages[0]
            assert [float(page.mediabox.width), float(page.mediabox.height)] == [595.28, 841.89]
            objects = [ref.get_object() for ref in page['/Resources']['/XObject'].values()
                       if ref.get_object().get('/Subtype') == '/Image']
            assert len(objects) == 1 and '/Mask' not in objects[0]
            obj = objects[0]; assert obj['/Width'] == obj['/Height'] == 96
            if name.startswith('opaque-'):
                jpeg_streams[state, engine, name] = obj.get_data()
            mask = obj.get('/SMask')
            if mask:
                m = mask.get_object()
                assert m['/Width'] == m['/Height'] == 96 and m['/BitsPerComponent'] == 8 and m['/ColorSpace'] == '/DeviceGray'
                decoded = m.get_data(); assert len(decoded) == 9216
            else:
                decoded = bytes([255]) * 9216
            differences = sum(a != b for a, b in zip(alpha, decoded))
            assert differences == (7168 if state == 'before' and name == 'alpha-control.webp' else 0)
            replay = subprocess.run(['pdftoppm','-f','1','-singlefile','-r','72','-png',str(pdf)],
                                    check=True, capture_output=True, timeout=30).stdout
            with Image.open(io.BytesIO(replay)) as a, Image.open(render) as b:
                assert a.size == b.size and a.convert('RGB').tobytes() == b.convert('RGB').tobytes(), 'Renderer pixels differ; check the Poppler version in fixed-environment.json'
                image = a.convert('RGB'); width, height = 595.28, 841.89
                scale = min((width-48)/96, (height-48)/96)
                left, top = (width-96*scale)/2, (height-96*scale)/2
                samples = {key:list(image.getpixel((round(left+x*scale), round(top+y*scale))))
                           for key,(x,y) in {'transparent':(8,8),'half':(32,32),'opaque':(64,64)}.items()}
                assert samples == row['samplesRGB']
            rows.append({'state':state,'engine':engine,'input':name,'softMask':bool(mask),
                         'alphaMismatchPixels':differences,'sourceNonOpaquePixels':sum(x<255 for x in alpha),
                         'filter':str(obj['/Filter']),'samplesRGB':samples,'independentRenderPixelsMatch':True})
        assert len(seen) == 8
    assert all(len(v) == 1 for v in versions.values())
    analysis = json.loads((root / 'paired-analysis.json').read_text(encoding='utf-8'))
    assert analysis['rows'] == rows
    assert analysis['beforeSource'] == reports['before']['sourceCommit'] == manifest['beforeSource']
    assert analysis['afterSource'] == reports['after']['sourceCommit'] == manifest['afterSource']
    negative_controls = []
    for engine in ENGINES:
        for name in ['opaque-control.jpg', 'opaque-control.webp']:
            before = jpeg_streams['before', engine, name]
            after = jpeg_streams['after', engine, name]
            assert before == after
            negative_controls.append({'engine':engine,'input':name,'sameEmbeddedJPEGStream':True,
                                      'beforeSHA256':sha(before),'afterSHA256':sha(after)})
    assert analysis['opaqueJPEGStreams'] == negative_controls
    return {'verifiedFiles':len(entries),'pdfs':len(rows),'fullRenderReplays':len(rows),
            'alphaSamplesPerImage':9216,'opaqueJPEGStreamsUnchanged':len(negative_controls),
            'archivePresent':archive_present}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', nargs='?', type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    print(json.dumps(verify(args.directory), indent=2))
