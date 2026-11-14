"""Image-to-PDF must preserve decoded transparency, including late rows and empty MIME."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import importlib.util, json, os, subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
OUT = ROOT / 'test-results' / os.environ.get('PDF_ALPHA_REPORT', 'pdf-image-alpha-browser')
OUT.mkdir(parents=True, exist_ok=True)
SHA = os.environ.get('EXPECTED_BUILD_SHA')
name = 'src/task/pdf-organize.js'
module = (subprocess.check_output(['git', 'show', SHA + ':' + name], cwd=ROOT) if SHA
          else (ROOT / name).read_bytes()).replace(b'\r\n', b'\n')
spec = importlib.util.spec_from_file_location('pdf_alpha_protocol', ROOT / 'tools/editorial/measure-pdf-image-alpha.py')
protocol = importlib.util.module_from_spec(spec)
spec.loader.exec_module(protocol)
controls = []
for filename, transparent, fmt in [('alpha-control.png', True, 'PNG'),
                                  ('alpha-control.webp', True, 'WEBP'),
                                  ('opaque-control.webp', False, 'WEBP'),
                                  ('opaque-control.jpg', False, 'JPEG')]:
    image = protocol.authored(transparent)
    options = {'lossless': True, 'exact': True} if fmt == 'WEBP' else (
              {'quality': 95, 'subsampling': 0} if fmt == 'JPEG' else {})
    if fmt == 'JPEG':
        image = image.convert('RGB')
    image.save(OUT / filename, fmt, **options)
    controls.append({'name': filename, 'transparent': transparent, 'late': False})
late = protocol.authored(False)
for y in range(80, 96):
    for x in range(96):
        late.putpixel((x, y), (21, 43, 65, 0))
late.save(OUT / 'late-alpha.png', 'PNG')
controls.append({'name': 'late-alpha.png', 'transparent': True, 'late': True})
rows, errors = [], []

def guard(ctx):
    if SHA:
        assert ctx.request.get(BASE + '/build.txt').text().strip() == SHA
    response = ctx.request.get(BASE + '/' + name)
    assert response.status == 200 and response.body().replace(b'\r\n', b'\n') == module

with sync_playwright() as pw:
    for engine in ['chromium', 'firefox']:
        browser = getattr(pw, engine).launch()
        try:
            ctx = browser.new_context(accept_downloads=True)
            page = ctx.new_page()
            page.set_default_timeout(30000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            guard(ctx)
            for index, control in enumerate(controls):
                locale = ['ko', 'en', 'ja'][index % 3]
                response = page.goto(BASE + f'/{locale}/jpg-to-pdf/', wait_until='load')
                assert response.status in (200, 304)
                page.locator('html[data-task-ready="1"]').wait_for()
                if control['late']:
                    page.locator('#fileInput').set_input_files({'name': control['name'], 'mimeType': '',
                                                              'buffer': (OUT / control['name']).read_bytes()})
                else:
                    with page.expect_file_chooser() as event:
                        page.locator('.dropzone button[data-action="pick"]').click()
                    event.value.set_files(str(OUT / control['name']))
                ready = page.locator('#pdfRun:not([disabled])')
                ready.wait_for()
                assert page.locator('#pdfPages .pg').count() == 1
                with page.expect_download() as event:
                    ready.click()
                pdf = OUT / f'{engine}-{control["name"]}.pdf'
                event.value.save_as(pdf)
                result = protocol.inspect_pdf(pdf)
                image = result['images'][0]
                assert image['softMask'] == control['transparent'], (engine, control, image)
                assert image['filter'] == ('/FlateDecode' if control['transparent'] else '/DCTDecode')
                if control['late']:
                    # This transparent region starts after the first 64 scanlines.
                    render = Image.open(OUT / result['render']).convert('RGB')
                    width, height = result['pagePoints']
                    scale = min((width - 48) / 96, (height - 48) / 96)
                    xy = (round((width - 96 * scale) / 2 + 8 * scale),
                          round((height - 96 * scale) / 2 + 88 * scale))
                    assert render.getpixel(xy) == (255, 255, 255)
                    render.close()
                else:
                    expected = [255, 255, 255] if control['transparent'] else [21, 43, 65]
                    assert max(abs(a - b) for a, b in zip(result['samplesRGB']['transparent'], expected)) <= 3
                    expected = [232, 142, 162] if control['transparent'] else [210, 30, 70]
                    assert max(abs(a - b) for a, b in zip(result['samplesRGB']['half'], expected)) <= 3
                rows.append({'engine': engine, 'locale': locale, 'input': control['name'],
                             'emptyMime': control['late'], **result})
            guard(ctx)
        finally:
            browser.close()
assert not errors, errors
(OUT / 'results.json').write_text(json.dumps({'build': SHA, 'base': BASE, 'cases': rows,
                                            'pageErrors': errors}, indent=2), encoding='utf-8')
print('PDF IMAGE ALPHA PASSED', len(rows), 'native PDF downloads; masks, page sizes and Poppler pixels')
