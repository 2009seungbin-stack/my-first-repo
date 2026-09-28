"""Character Counter Pro live UI checks. Run against port 4704 in Chromium and Firefox."""
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('COUNTER_BASE', 'http://127.0.0.1:4704')
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 'character-counter'
OUT.mkdir(parents=True, exist_ok=True)

def check(browser_type):
    browser = browser_type.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + '/en/character-counter/', wait_until='networkidle')
    page.locator('html[data-task-ready="1"]').wait_for()
    page.locator('#characterInput').fill('A 한 😀')
    expect(page.locator('#characterPrimary')).to_have_text('5')
    assert page.locator('#characterQuick').inner_text().find('10') >= 0
    page.locator('.cc-details summary').click()
    assert page.locator('#characterMetrics').inner_text().find('6') >= 0
    assert 'Cannot encode' in page.locator('#characterBytes').inner_text()
    assert 'twitter-text 3.1.0' in page.locator('.cc-details').inner_text()
    page.locator('#characterInput').fill('뷁')
    expect(page.locator('#characterPrimary')).to_have_text('1')
    byte_rows = page.locator('#characterBytes .cc-metric').all_inner_texts()
    assert '—' in byte_rows[1] and 'Cannot encode' in byte_rows[1], byte_rows
    assert '2' in byte_rows[2] and 'Cannot encode' not in byte_rows[2], byte_rows
    page.locator('#characterForbidden').fill('뷁')
    expect(page.locator('#characterFlagged')).to_contain_text('뷁 ×1')
    page.locator('#characterForbidden').fill('')
    page.locator('#characterInput').fill('A 한 😀')
    expect(page.locator('#characterPrimary')).to_have_text('5')
    page.screenshot(path=str(OUT / f'{browser_type.name}-desktop.png'), full_page=True)
    page.locator('#characterUndo').click()
    expect(page.locator('#characterInput')).to_have_value('뷁')
    page.locator('#characterRedo').click()
    expect(page.locator('#characterInput')).to_have_value('A 한 😀')
    page.locator('#characterInclude').uncheck()
    expect(page.locator('#characterPrimary')).to_have_text('3')
    assert 'spaces=0' in page.url and 'A%20' not in page.url
    page.reload(wait_until='networkidle')
    page.locator('html[data-task-ready="1"]').wait_for()
    assert page.locator('#characterInput').input_value() == ''
    assert page.locator('#characterInclude').is_checked() is False
    page.locator('#fileInput').set_input_files({'name':'notes.txt','mimeType':'text/plain','buffer':'한글 글쓰기\n둘째 줄'.encode()})
    expect(page.locator('#characterInput')).to_have_value('한글 글쓰기\n둘째 줄')
    assert not errors, errors
    page.close()
    phone = browser.new_page(viewport={'width':390,'height':844}, device_scale_factor=1)
    phone.goto(BASE + '/ko/character-counter/', wait_until='networkidle')
    phone.locator('#fileInput').set_input_files(str(ROOT / 'tests/fixtures/character-corpus/korean-constitution-excerpt.txt'))
    expect(phone.locator('#characterPrimary')).not_to_have_text('0')
    assert phone.locator('body').evaluate('(e) => e.scrollWidth <= innerWidth')
    phone.screenshot(path=str(OUT / f'{browser_type.name}-mobile.png'), full_page=True)
    phone.goto(BASE + '/ja/character-counter/', wait_until='networkidle')
    phone.locator('#fileInput').set_input_files(str(ROOT / 'tests/fixtures/character-corpus/rashomon-excerpt.txt'))
    expect(phone.locator('#characterPrimary')).not_to_have_text('0')
    expect(phone.locator('#characterStatus')).to_contain_text('書記素')
    browser.close()

with sync_playwright() as playwright:
    for name in ('chromium','firefox'):
        start = time.perf_counter()
        check(getattr(playwright, name))
        print(f'{name}: PASS ({time.perf_counter()-start:.2f}s)')
