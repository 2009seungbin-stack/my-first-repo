"""Real browser PC-tool flows, eight currencies, SSR without JS, phone/desktop overflow and QA PNGs."""
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def run():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
    base = f'http://localhost:{port}'
    output = ROOT / 'test-results/hardware-tools'; output.mkdir(parents=True, exist_ok=True)
    with open(output / 'server.log', 'w', encoding='utf8') as log:
        proc = subprocess.Popen(['node', 'tests/hardware-market-server.mjs', str(port)], cwd=ROOT, stdout=log, stderr=log)
        try:
            for _ in range(80):
                try:
                    urllib.request.urlopen(base + '/ko/hardware/used-prices/', timeout=2); break
                except Exception:
                    if proc.poll() is not None: raise RuntimeError('dev server exited')
                    time.sleep(.25)
            else: raise RuntimeError('dev server did not start')
            with sync_playwright() as p:
                b = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN') or None)
                errors = []
                ctx = b.new_context(viewport={'width': 1440, 'height': 900})
                pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
                pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
                for country in ['KR','JP','US','GB','DE','FR','CA','AU']:
                    pg.goto(base + f'/ko/hardware/used-prices/?country={country}&q=RTX+4060+8GB')
                    assert pg.locator('textarea[name=prices]').count() == 0
                    assert pg.locator('.hw-market-links a').count() >= 1
                    result = pg.locator('[data-market-status]')
                    if country in ['KR','JP']:
                        assert result.get_attribute('data-market-status') == 'not_connected'
                        assert pg.locator('.hw-listings li').count() == 0
                    else:
                        assert result.get_attribute('data-market-status') == 'available'
                        assert pg.locator('.hw-listings li').count() == 5
                        assert '300' in pg.locator('.hw-stats').inner_text()
                        assert '2개 제외' in result.text_content()
                        assert pg.locator('time[datetime]').count() == 1
                pg.goto(base + '/ko/hardware/used-prices/?country=US&q=RTX+4070')
                assert pg.locator('[data-market-status]').get_attribute('data-market-status') == 'no_results'
                assert pg.locator('.hw-listings li').count() == 0
                pg.goto(base + '/ko/hardware/used-prices/?country=US&q=RTX+9999')
                assert pg.locator('[data-market-status]').get_attribute('data-market-status') == 'upstream_error'
                assert pg.locator('.hw-stats').count() == 0
                pg.goto(base + '/ko/hardware/used-prices/?country=US&q=shoes')
                assert pg.locator('[data-market-status]').get_attribute('data-market-status') == 'invalid_query'
                pg.goto(base + '/ko/hardware/used-prices/?country=DE&q=RTX+4060')
                pg.evaluate('scrollTo(0,0)');pg.screenshot(path=str(output / 'prices-desktop.png'), full_page=True)
                pg.goto(base + '/ko/hardware/performance/')
                assert 'RTX 3060' in pg.locator('.hw-comparison').inner_text() and 'RTX 4060' in pg.locator('.hw-comparison').inner_text()
                photos = pg.locator('.hw-comparison .hw-photo img')
                assert photos.count() == 2
                for img in photos.all():
                    img.wait_for(state='visible')
                    assert img.evaluate('(el)=>el.complete && el.naturalWidth >= 960'), img.get_attribute('src')
                pg.evaluate('scrollTo(0,0)'); pg.screenshot(path=str(output / 'performance-gpu-desktop.png'), full_page=True)
                pg.locator('.hw-credits summary').click()
                assert 'CC BY-SA 4.0' in pg.locator('.hw-credits').inner_text() and 'CC BY 3.0' in pg.locator('.hw-credits').inner_text()
                pg.locator('.hw-credits summary').click()
                for model, asset in [('RX 6600 XT','rx-6600-xt.jpg'),('Arc(TM) A770','arc-a770.jpg'),('RTX 4090 · OPTIX','rtx-4090.jpg')]:
                    option = pg.locator('select[name=a] option').filter(has_text=model).first
                    pg.select_option('select[name=a]', option.get_attribute('value'))
                    pg.locator('.hw-compare-action button').click()
                    assert asset in pg.locator('.hw-comparison img').first.get_attribute('src')
                    assert pg.locator('.hw-comparison img').first.evaluate('(el)=>el.complete && el.naturalWidth >= 960')
                pg.fill('[data-hw-filter=a]', 'RTX 4070');assert pg.locator('select[name=a] option').count() < 20
                pg.fill('[data-hw-filter=a]', 'no-such-device');assert not pg.locator('[data-hw-filter=a]').evaluate('(el)=>el.checkValidity()')
                pg.fill('[data-hw-filter=a]', '')
                pg.select_option('[data-hw-type]', 'cpu');pg.locator('button[data-hw-reset]').click()
                assert 'Ryzen 5 5600' in pg.locator('.hw-comparison').inner_text() and 'Ryzen 5 7600' in pg.locator('.hw-comparison').inner_text()
                assert 'RTX 4060' not in pg.locator('.hw-comparison').inner_text()
                pg.fill('input[name=price-a]', '100000');pg.fill('input[name=price-b]', '200000');pg.locator('[data-island=hardware-value] button').click();assert 'A가' in pg.locator('[data-value-result]').inner_text()
                pg.evaluate('scrollTo(0,0)');pg.screenshot(path=str(output / 'performance-desktop.png'), full_page=True)
                for l in ['ko','en']:
                    for tool in ['used-prices','performance']:
                        pg.goto(base + f'/{l}/hardware/{tool}/' + ('?country=US&q=RTX+4060' if tool == 'used-prices' else ''))
                        assert pg.locator('h1').is_visible()
                        assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth'), (l, tool, 'desktop overflow')
                        pg.evaluate('scrollTo(0,0)'); pg.screenshot(path=str(output / f'{tool}-{l}-desktop.png'), full_page=True)
                        pg.set_viewport_size({'width':390, 'height':844});pg.evaluate('scrollTo(0,0)');pg.wait_for_timeout(300)
                        assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth'), (l, tool, 'mobile overflow')
                        if tool == 'performance':
                            assert pg.locator('.hw-comparison .hw-photo img').count() == 2
                            assert pg.locator('.hw-comparison').evaluate('(el)=>getComputedStyle(el).display') == 'table'
                        pg.locator('.thm').click(); assert pg.locator('html').get_attribute('data-theme') == 'dark'
                        pg.screenshot(path=str(output / f'{tool}-{l}-dark-mobile.png'), full_page=True)
                        pg.locator('.thm').click()
                        pg.screenshot(path=str(output / f'{tool}-{l}-mobile.png'), full_page=True)
                        pg.set_viewport_size({'width':320, 'height':720});pg.wait_for_timeout(100)
                        assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth'), (l, tool, 'small phone overflow')
                        pg.set_viewport_size({'width':1440, 'height':900});pg.wait_for_timeout(300)
                nojs = b.new_context(java_script_enabled=False); plain = nojs.new_page()
                plain.goto(base + '/en/hardware/used-prices/?country=GB&q=RTX+4060');assert plain.locator('textarea').count() == 0;assert plain.locator('.hw-listings li').count() == 5;assert plain.locator('.hw-market-links a').count() == 2
                plain.goto(base + '/en/hardware/performance/?type=cpu');assert 'Ryzen 5 5600' in plain.locator('.hw-comparison').inner_text()
                nojs.close();ctx.close();b.close()
                assert not errors, errors
            print('Hardware tools browser: 8 market states, automatic upstream fixtures, no manual price input, CPU/GPU, value, decoded photos, credits, SSR, ko/en desktop, 390/320px phones and dark mode passed')
        finally:
            proc.terminate();proc.wait(timeout=10)


if __name__ == '__main__':
    run()
