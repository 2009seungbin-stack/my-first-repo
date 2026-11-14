"""Native sample/picker actions must remain separate, including keyboard activation."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import io, json, os

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
OUT = ROOT / 'test-results' / os.environ.get('INTAKE_REPORT', 'task-intake-browser')
OUT.mkdir(parents=True, exist_ok=True)
SHA = os.environ.get('EXPECTED_BUILD_SHA')
fixture = io.BytesIO()
Image.new('RGB', (96, 64), (57, 106, 181)).save(fixture, 'PNG')
payload = {'name': 'intake-control.png', 'mimeType': 'image/png', 'buffer': fixture.getvalue()}
rows, errors = [], []

def build_guard(ctx):
    if SHA:
        assert ctx.request.get(BASE + '/build.txt').text().strip() == SHA

with sync_playwright() as pw:
    for engine in ['chromium', 'firefox']:
        browser = getattr(pw, engine).launch()
        try:
            ctx = browser.new_context(accept_downloads=True)
            try:
                build_guard(ctx)
                page = ctx.new_page()
                page.set_default_timeout(30000)
                page.on('pageerror', lambda e: errors.append(str(e)))
                choosers = []
                page.on('filechooser', lambda c: choosers.append(c))
                for locale, activation in [('ko', 'click'), ('en', 'Enter'), ('ja', 'Space')]:
                    page.set_viewport_size({'width': 390 if locale == 'ko' else 1440, 'height': 900})
                    response = page.goto(BASE + f'/{locale}/image/compress/', wait_until='load')
                    assert response.status == 200
                    page.locator('html[data-task-ready="1"]').wait_for()
                    zone = page.locator('.dropzone')
                    # A button container would hide/nest the two independent native controls.
                    assert zone.get_attribute('role') != 'button'
                    assert zone.get_by_role('button').count() == 2
                    assert zone.locator('button button, [role="button"] button').count() == 0
                    sample = zone.locator('[data-action="task-sample"]')
                    before = len(choosers)
                    if activation == 'click':
                        sample.click()
                    else:
                        sample.focus()
                        page.keyboard.press(activation)
                    page.locator('#taskDownload:not([disabled])').wait_for(timeout=120000)
                    assert len(choosers) == before, (engine, locale, 'sample opened picker')
                    assert page.locator('.file').count() == 1
                    page.locator('[data-action="task-clear"]').click()
                    pick = page.locator('.dropzone button[data-action="pick"]')
                    pick.focus()
                    with page.expect_file_chooser() as event:
                        page.keyboard.press('Enter')
                    event.value.set_files([payload])
                    page.locator('#taskDownload:not([disabled])').wait_for()
                    assert len(choosers) == before + 1
                    with page.expect_download() as event:
                        page.locator('#taskDownload').click()
                    with Image.open(event.value.path()) as image:
                        assert image.size == (96, 64)
                    page.locator('[data-action="task-clear"]').click()
                    # The larger pointer target remains available outside the buttons.
                    with page.expect_file_chooser() as event:
                        page.locator('.dropzone strong').click()
                    event.value.set_files([])
                    assert len(choosers) == before + 2
                    pick = page.locator('.dropzone button[data-action="pick"]')
                    pick.focus()
                    with page.expect_file_chooser() as event:
                        page.keyboard.press('Space')
                    event.value.set_files([])
                    assert len(choosers) == before + 3
                    assert page.locator('.dropzone').is_visible()
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                    if locale == 'ko':
                        assert page.locator('.dropzone strong').inner_text() == '이미지 파일을 여기에 놓으세요'
                        page.screenshot(path=str(OUT / f'{engine}-ko-mobile.png'), full_page=True)
                    rows.append({'engine': engine, 'locale': locale, 'sampleActivation': activation,
                                 'samplePickers': 0, 'explicitPickers': 3, 'decodedDownload': [96, 64]})
                build_guard(ctx)
            finally:
                ctx.close()
            ctx = browser.new_context(java_script_enabled=False)
            try:
                build_guard(ctx)
                page = ctx.new_page()
                page.goto(BASE + '/ko/image/compress/', wait_until='load')
                zone = page.locator('.dropzone')
                assert zone.get_attribute('role') != 'button'
                assert zone.get_by_role('button').count() == 1
                assert zone.locator('strong').inner_text() == '이미지 파일을 여기에 놓으세요'
                build_guard(ctx)
            finally:
                ctx.close()
        finally:
            browser.close()
assert not errors, errors
(OUT / 'results.json').write_text(json.dumps({'build': SHA, 'base': BASE, 'cases': rows,
                                            'pageErrors': errors}, indent=2), encoding='utf-8')
print('TASK INTAKE PASSED', len(rows), 'sample actions; 18 explicit pickers; 6 decoded downloads')
