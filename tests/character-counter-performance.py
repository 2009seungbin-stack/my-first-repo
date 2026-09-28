"""1 MiB real-prose browser acceptance. Download Gutenberg #2600 into test-results first."""
import time
import statistics
import json
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
        for width in (1440,390):
            page = browser.new_page(viewport={'width':width,'height':844})
            page.goto('http://127.0.0.1:4704/en/character-counter/',wait_until='networkidle')
            page.locator('html[data-task-ready="1"]').wait_for()
            page.locator('#fileInput').set_input_files(str(fixture))
            expect(page.locator('#characterStatus')).to_contain_text('Grapheme clusters',timeout=120000)
            times=[];components=[];profiles=[]
            for run in range(10):
                start = time.perf_counter()
                page.locator('#fileInput').set_input_files(str(fixture))
                expect(page.locator('#characterStatus')).to_contain_text('Counting',timeout=120000)
                expect(page.locator('#characterStatus')).to_contain_text('Grapheme clusters',timeout=120000)
                times.append(time.perf_counter()-start)
                status=page.locator('#characterStatus')
                components.append({key:float(status.get_attribute('data-'+key+'-ms') or 0) for key in ('file-read','quick','schedule-to-quick','worker','render','schedule-to-visible')})
                profiles.append(json.loads(status.get_attribute('data-profile') or '{}'))
            p95=sorted(times)[-1]
            quick_p95=max(row['schedule-to-quick'] for row in components)
            pieces=', '.join(f'{key} median {statistics.median(row[key] for row in components):.1f} ms' for key in components[0])
            print(f'{name} {width}px: 10 runs, full median {statistics.median(times):.2f}s, full p95 upper bound {p95:.2f}s, core-count p95 upper bound {quick_p95:.1f} ms; {pieces}; {len(text.encode()):,} UTF-8 bytes; {page.locator("#characterPrimary").inner_text()} graphemes')
            print('  worker phases:',{key:round(statistics.median(row[key] for row in profiles),1) for key in profiles[0]})
            assert quick_p95 < (250 if width==1440 else 750), f'{name} {width}px core-count acceptance failed'
            assert p95 < 2, f'{name} {width}px detailed-count acceptance failed'
            page.close()
        browser.close()
