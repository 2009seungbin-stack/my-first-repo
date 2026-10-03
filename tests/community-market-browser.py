"""Actual Worker renderer with isolated D1 synthetic facts; no external collector traffic."""
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
    output = ROOT / 'test-results/community-browser'; output.mkdir(parents=True, exist_ok=True)
    with open(output / 'server.log', 'w', encoding='utf8') as log:
        proc = subprocess.Popen(['node', 'tests/community-market-server.mjs', str(port)], cwd=ROOT, stdout=log, stderr=log)
        try:
            for _ in range(200):
                try:
                    urllib.request.urlopen(base + '/ko/hardware/used-prices/', timeout=1); break
                except Exception:
                    if proc.poll() is not None: raise RuntimeError('fixture server exited')
                    time.sleep(.1)
            else: raise RuntimeError('fixture server did not start')
            with sync_playwright() as p:
                b = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN') or None)
                ctx = b.new_context(java_script_enabled=False)
                pg = ctx.new_page()
                for country, q, count in [('KR','RTX 4060',4),('US','RTX 4060',5),('FR','RTX 5070 Ti 16GB',5)]:
                    pg.goto(base + f'/ko/hardware/used-prices/?country={country}&q={q}')
                    assert pg.locator('[data-market-status]').get_attribute('data-market-status') == 'available'
                    assert pg.locator('.hw-listings li').count() == count
                    assert pg.locator('textarea').count() == 0
                    assert pg.locator('.hw-stats').count() == (0 if country == 'KR' else 1)
                pg.goto(base + '/ko/hardware/used-prices/?country=KR&q=RTX+4060')
                pg.select_option('select[name=basis]', 'sold'); pg.select_option('select[name=days]', '7')
                pg.locator('.hw-form button[type=submit]').click()
                assert pg.locator('.hw-listings li').count() == 1
                assert 'basis=sold' in pg.url and 'days=7' in pg.url
                pg.goto(base + '/ko/hardware/used-prices/?country=FR&q=RTX+5070')
                assert pg.locator('[data-market-status]').get_attribute('data-market-status') == 'no_results'
                ctx.close()
                ctx = b.new_context(viewport={'width':1440,'height':900}); pg = ctx.new_page()
                errors=[];pg.on('pageerror', lambda e: errors.append(str(e)))
                for lang in ['ko','en']:
                    for width in [1440,390,320]:
                        pg.set_viewport_size({'width':width,'height':900})
                        pg.goto(base + f'/{lang}/hardware/used-prices/?country=US&q=RTX+4060+8GB')
                        assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth'), (lang,width)
                        assert pg.locator('.hw-photo img').first.evaluate('(el)=>el.complete && el.naturalWidth>=960')
                        pg.screenshot(path=str(output/f'{lang}-{width}.png'),full_page=True)
                    pg.locator('.thm').click();pg.screenshot(path=str(output/f'{lang}-dark.png'),full_page=True)
                assert not errors, errors
                b.close()
        finally:
            proc.terminate()
            try: proc.wait(timeout=10)
            except subprocess.TimeoutExpired: proc.kill();proc.wait(timeout=5)
    print('Community market SSR, filters, statistics, variants, GPU photos and ko/en responsive views passed.')

if __name__ == '__main__': run()
