"""Focused T8 browser export and independent Pillow/ZIP oracle. Run with WEBTOON_BASE."""
import io
import json
import os
from pathlib import Path
from zipfile import ZipFile

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('WEBTOON_BASE', 'http://127.0.0.1:4708')
SAMPLE = ROOT / 'test-results' / 't8' / 'kenney-comparison-strip.png'
assert SAMPLE.exists(), 'CC0 Kenney comparison strip is required for this focused test'

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(accept_downloads=True, viewport={'width': 1440, 'height': 900})
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.goto(BASE + '/en/image/webtoon-manga-toolkit/', wait_until='networkidle')
    page.locator('#fileInput').set_input_files(str(SAMPLE))
    page.locator('.webtoon-preview img').wait_for(timeout=30000)
    assert page.locator('[data-cut]').count() == 2
    with page.expect_download(timeout=60000) as dl:
        page.locator('#webtoonRun').click()
    out = ROOT / 'test-results' / 't8' / 'nerulio-webtoon-first.zip'
    dl.value.save_as(out)
    with ZipFile(out) as z:
        names = z.namelist()
        assert names == ['episode-01.jpg', 'episode-02.jpg', 'episode-03.jpg', 'export-report.json'], names
        report = json.loads(z.read('export-report.json'))
        assert report['profile'] == 'canvas'
        images = [Image.open(io.BytesIO(z.read(name))) for name in names[:3]]
        assert [x.size for x in images] == [(800, 1280), (800, 1280), (800, 440)]
        assert all(x.format == 'JPEG' and x.mode == 'RGB' for x in images)
        assert sum(x.height for x in images) == 3000
        assert [p['sourceY'] for p in report['parts']] == [0, 1280, 2560]
        assert sum(p['sourceHeight'] for p in report['parts']) == 3000
        assert all(p['bytes'] <= 2_000_000 for p in report['parts'])
        assert report['total'] <= 20_000_000
    assert not errors, errors
    print('T8 browser split + independent ZIP/Pillow: PASS', out.stat().st_size, 'bytes')
    # Join is PNG-exact and follows the visible input order.
    a = ROOT / 'test-results' / 't8' / 'join-red.png'
    b = ROOT / 'test-results' / 't8' / 'join-blue.png'
    Image.new('RGBA', (24, 17), (245, 22, 25, 255)).save(a)
    Image.new('RGBA', (24, 11), (5, 35, 245, 255)).save(b)
    page.goto(BASE + '/en/image/webtoon-manga-toolkit/', wait_until='networkidle')
    page.locator('#fileInput').set_input_files([str(a), str(b)])
    page.locator('.webtoon-files li').nth(1).wait_for(timeout=30000)
    page.locator('[data-mode="join"]').click()
    with page.expect_download(timeout=60000) as dl:
        page.locator('#webtoonRun').click()
    joined = ROOT / 'test-results' / 't8' / 'nerulio-joined.zip'
    dl.value.save_as(joined)
    with ZipFile(joined) as z:
        image = Image.open(io.BytesIO(z.read('episode-01.png'))).convert('RGBA')
        assert image.size == (24, 28)
        assert image.getpixel((7, 3)) == (245, 22, 25, 255)
        assert image.getpixel((7, 20)) == (5, 35, 245, 255)
    assert not errors, errors
    print('T8 browser join + independent pixel oracle: PASS', joined.stat().st_size, 'bytes')
    browser.close()
