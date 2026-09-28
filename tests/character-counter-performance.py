"""1 MiB real-prose browser acceptance. Download Gutenberg #2600 into test-results first."""
import time
import statistics
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

SOURCE = Path(__file__).resolve().parents[1] / 'test-results/character-counter/war-and-peace.txt'
assert SOURCE.exists(), 'Download https://www.gutenberg.org/cache/epub/2600/pg2600.txt to ' + str(SOURCE)
whole = SOURCE.read_text(encoding='utf-8-sig')
text = whole[:1024*1024]
assert len(text.encode()) >= 1024*1024, 'fixture must be at least 1 MiB of actual prose'
fixture = SOURCE.parent / 'war-and-peace-1mib.txt'
fixture.write_text(text, encoding='utf-8')
for name in ('chromium','firefox'):
    with sync_playwright() as playwright:
        browser = getattr(playwright,name).launch()
        page = browser.new_page()
        page.goto('http://127.0.0.1:4704/en/character-counter/',wait_until='networkidle')
        page.locator('html[data-task-ready="1"]').wait_for()
        times=[]
        for run in range(10):
            start = time.perf_counter()
            page.locator('#fileInput').set_input_files(str(fixture))
            expect(page.locator('#characterStatus')).to_contain_text('Counting',timeout=120000)
            expect(page.locator('#characterStatus')).to_contain_text('Grapheme clusters',timeout=120000)
            times.append(time.perf_counter()-start)
        p95=sorted(times)[-1]
        print(f'{name}: 10 runs, median {statistics.median(times):.2f}s, p95 upper bound {p95:.2f}s; {len(text.encode()):,} UTF-8 bytes; {page.locator("#characterPrimary").inner_text()} graphemes')
        assert p95 < 2, f'{name} exceeded 2-second 1 MiB acceptance'
        browser.close()
