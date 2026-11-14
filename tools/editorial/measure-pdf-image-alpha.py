"""Native image-to-PDF controls, measured with an independent Poppler renderer.

Run the committed repository copy with Pillow, pypdf, Playwright and pdftoppm.
Only authored controls are selected in the public tool; no user document is used.
Writes a fresh directory below test-results and never replaces published results.
"""
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlsplit
from PIL import Image
from pypdf import PdfReader
from playwright.sync_api import sync_playwright
import argparse, hashlib, json, math, re, subprocess

ROOT = Path(__file__).resolve().parents[2]
PROTOCOL = 'tools/editorial/measure-pdf-image-alpha.py'
MODULES = ['src/task/pdf-organize.js', 'src/pdf.js', 'src/image.js',
           'src/image-container.js', 'src/core.js']
SIZE = 96
POINTS = {'transparent': (8, 8), 'half': (32, 32), 'opaque': (64, 64)}

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def authored(transparent):
    image = Image.new('RGBA', (SIZE, SIZE), (21, 43, 65, 0 if transparent else 255))
    for y in range(16, 80):
        for x in range(16, 80):
            image.putpixel((x, y), (210, 30, 70, 128 if transparent and x < 48 else 255))
    return image

def inspect_pdf(path):
    pdf = PdfReader(path)
    assert len(pdf.pages) == 1
    page = pdf.pages[0]
    width, height = float(page.mediabox.width), float(page.mediabox.height)
    assert abs(width - 595.28) < .01 and abs(height - 841.89) < .01
    images = []
    for ref in page['/Resources'].get('/XObject', {}).values():
        obj = ref.get_object()
        if obj.get('/Subtype') == '/Image':
            images.append({'filter': str(obj.get('/Filter')), 'softMask': '/SMask' in obj,
                           'width': int(obj['/Width']), 'height': int(obj['/Height'])})
    assert len(images) == 1 and images[0]['width'] == images[0]['height'] == SIZE
    prefix = Path(str(path) + '-poppler')
    subprocess.run(['pdftoppm', '-f', '1', '-singlefile', '-r', '72', '-png',
                    str(path), str(prefix)], check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.PIPE)
    render = Path(str(prefix) + '.png')
    with Image.open(render) as image:
        image = image.convert('RGB')
        assert image.size == (math.ceil(width), math.ceil(height))
        scale = min((width - 48) / SIZE, (height - 48) / SIZE)
        left, top = (width - SIZE * scale) / 2, (height - SIZE * scale) / 2
        samples = {name: list(image.getpixel((round(left + x * scale), round(top + y * scale))))
                   for name, (x, y) in POINTS.items()}
    return {'pagePoints': [width, height], 'images': images, 'samplesRGB': samples,
            'render': render.name, 'renderSHA256': digest(render.read_bytes())}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='https://nerulio.com')
    parser.add_argument('--sha', required=True)
    parser.add_argument('--output', required=True, help='new directory name below test-results')
    args = parser.parse_args()
    assert re.fullmatch(r'[a-f0-9]{40}', args.sha)
    assert re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,100}', args.output)
    base = args.base.rstrip('/')
    url = urlsplit(base)
    assert not (url.username or url.password or url.query or url.fragment or url.path)
    assert (url.scheme == 'https' and (url.hostname == 'nerulio.com' or
            url.hostname.endswith('.nerulio.pages.dev'))) or (
            url.scheme == 'http' and url.hostname in ['127.0.0.1', 'localhost'])
    protocol_commit = git('rev-parse', 'HEAD').decode().strip()
    protocol = (ROOT / PROTOCOL).read_bytes().replace(b'\r\n', b'\n')
    assert protocol == git('show', protocol_commit + ':' + PROTOCOL).replace(b'\r\n', b'\n')
    out = ROOT / 'test-results' / args.output
    assert not out.exists()
    out.mkdir(parents=True)
    controls = []
    for name, transparent, fmt in [('alpha-control.png', True, 'PNG'),
                                  ('alpha-control.webp', True, 'WEBP'),
                                  ('opaque-control.webp', False, 'WEBP'),
                                  ('opaque-control.jpg', False, 'JPEG')]:
        image = authored(transparent)
        options = {'lossless': True, 'exact': True} if fmt == 'WEBP' else (
                  {'quality': 95, 'subsampling': 0} if fmt == 'JPEG' else {})
        if fmt == 'JPEG':
            image = image.convert('RGB')
        image.save(out / name, fmt, **options)
        controls.append({'name': name, 'transparent': transparent,
                         'sha256': digest((out / name).read_bytes())})
    with Image.open(out / 'alpha-control.png') as png, Image.open(out / 'alpha-control.webp') as webp:
        assert png.convert('RGBA').tobytes() == webp.convert('RGBA').tobytes()
    expected = {name: git('show', args.sha + ':' + name).replace(b'\r\n', b'\n') for name in MODULES}
    rows, errors, module_proofs = [], [], []
    def guard(ctx, modules=False):
        assert ctx.request.get(base + '/build.txt').text().strip() == args.sha
        if modules:
            for name in MODULES:
                response = ctx.request.get(base + '/' + name)
                assert response.status == 200
                actual = response.body().replace(b'\r\n', b'\n')
                assert actual == expected[name], name
                module_proofs.append({'path': name, 'normalizedSHA256': digest(actual)})
    with sync_playwright() as pw:
        for engine in ['chromium', 'firefox']:
            browser = getattr(pw, engine).launch()
            try:
                ctx = browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 1000})
                page = ctx.new_page()
                page.set_default_timeout(30000)
                page.on('pageerror', lambda error: errors.append(str(error)))
                guard(ctx, True)
                for control in controls:
                    guard(ctx)
                    response = page.goto(base + '/en/jpg-to-pdf/', wait_until='load')
                    assert response.status in (200, 304)
                    page.locator('html[data-task-ready="1"]').wait_for()
                    with page.expect_file_chooser() as event:
                        page.locator('.dropzone button[data-action="pick"]').click()
                    event.value.set_files(str(out / control['name']))
                    ready = page.locator('#pdfRun:not([disabled])')
                    ready.wait_for()
                    assert page.locator('#pdfPages .pg').count() == 1
                    with page.expect_download() as event:
                        ready.click()
                    pdf = out / f'{engine}-{control["name"]}.pdf'
                    event.value.save_as(pdf)
                    rows.append({'engine': engine, 'browserVersion': browser.version,
                                 'input': control['name'], 'output': pdf.name,
                                 'suggestedFilename': event.value.suggested_filename,
                                 'outputSHA256': digest(pdf.read_bytes()), **inspect_pdf(pdf)})
                    guard(ctx)
                guard(ctx, True)
            finally:
                browser.close()
    assert not errors, errors
    report = {'protocolCommit': protocol_commit, 'protocolSHA256': digest(protocol),
              'sourceCommit': args.sha, 'base': base, 'capturedAtUTC': datetime.now(timezone.utc).isoformat(),
              'settings': {'route': '/en/jpg-to-pdf/', 'paper': 'default A4', 'marginPoints': 24,
                           'rasterizer': 'pdftoppm, first page, 72 dpi, white page', 'sampleInputXY': POINTS},
              'inputs': controls, 'moduleProofs': module_proofs, 'results': rows, 'pageErrors': errors}
    (out / 'measurements.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('Captured', len(rows), 'native PDF downloads; source and five modules guarded')

if __name__ == '__main__':
    main()
