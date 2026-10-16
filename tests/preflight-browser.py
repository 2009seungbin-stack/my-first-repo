"""Real HTTP / CSP / storage / downloads / keyboard / responsive Preflight E2E.
Uses the static build. No vendor account, production API or install inventory upload.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, Error
import json, os, socket, subprocess, time, urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/preflight'
OUT.mkdir(parents=True, exist_ok=True)


def capture(page, **options):
    # Chromium on Windows can briefly reject capture before its first painted frame.
    # Retry only that transport error; assertion failures and other errors still fail.
    page.evaluate('()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))')
    for attempt in range(3):
        try:
            return page.screenshot(animations='disabled', **options)
        except Error as error:
            if 'Unable to capture screenshot' not in str(error) or attempt==2: raise
            print('Chromium first-frame capture retry', attempt+1, flush=True)
            page.wait_for_timeout(150)


def run():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
    mount = os.environ.get('PREFLIGHT_TEST_BASE_PATH','').rstrip('/')
    base = f'http://127.0.0.1:{port}'+mount
    env = dict(os.environ, PORT=str(port), BASE_PATH=mount)
    with open(OUT/'server.log', 'w', encoding='utf8') as log:
        proc = subprocess.Popen(['node', 'tools/serve.mjs', '--dist'], cwd=ROOT, env=env, stdout=log, stderr=log)
        try:
            for _ in range(100):
                try:
                    urllib.request.urlopen(base+'/en/preflight/obs/', timeout=2); break
                except Exception:
                    if proc.poll() is not None: raise RuntimeError('server exited')
                    time.sleep(.15)
            else: raise RuntimeError('server did not start')
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN') or None)
                ctx = browser.new_context(viewport={'width':1600,'height':1000}, permissions=['clipboard-read','clipboard-write'])
                page = ctx.new_page()
                errors, uploads, failed_responses = [], [], []
                page.on('pageerror', lambda err: errors.append(str(err)))
                page.on('request', lambda req: uploads.append(req.url) if req.method in ('POST','PUT') and 'Demo' in (req.post_data or '') else None)
                # The static test server does not execute the existing production traffic Worker.
                # Its hit endpoint is independent of Preflight; all page/module/font failures count.
                page.on('response', lambda response: failed_responses.append(response.url) if response.status>=400 and response.url.startswith(f'http://127.0.0.1:{port}/') and '/api/v2/hit' not in response.url else None)
                page.goto(base+'/en/preflight/')
                canonical = page.locator('link[rel=canonical]').get_attribute('href')
                assert canonical.startswith('https://') and canonical.endswith('/en/preflight/')
                canonical_root = canonical[:-len('en/preflight/')]
                assert page.locator('.pf-verticals>a').count()==4
                print('Landing geometry:', page.evaluate('({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewport:innerHeight})'), flush=True)
                capture(page, path=str(OUT/'landing-desktop.png'), full_page=True)
                page.locator('.pf-verticals>a').first.click()
                page.locator('#preflight[aria-busy=false]').wait_for()
                assert 'CAUTION' in page.locator('#pf-verdict').inner_text()
                assert 'No components' in page.locator('#pf-verdict').inner_text()
                # No giant data bundle on entry; only OBS data imports here.
                resources = page.evaluate('performance.getEntriesByType("resource").map(r=>r.name)')
                assert any('/data/obs.js' in r for r in resources)
                assert not any('/data/studio.js' in r or '/data/blender.js' in r or '/data/godot.js' in r for r in resources)
                page.locator('#pf-sample').click()
                page.evaluate('document.fonts.ready')
                assert page.evaluate('document.fonts.check("14px SUIT", "Nerulio") && document.fonts.check("14px JetBrains Mono", "33.0")')
                assert '16 components' in page.locator('#pf-verdict').inner_text()
                assert 'CAUTION' in page.locator('#pf-verdict').inner_text()
                assert 'SAMPLE DATA' in page.locator('#pf-provenance').inner_text()
                assert 'SAMPLE DATA' in page.locator('#pf-verdict').inner_text()
                page.evaluate('scrollTo(0,0)')
                capture(page, path=str(OUT/'obs-desktop-light.png'), full_page=True)
                capture(page, path=str(OUT/'obs-desktop-viewport.png'))
                page.locator('[data-theme-toggle]').click()
                assert page.locator('html').get_attribute('data-theme')=='dark'
                page.evaluate('scrollTo(0,0)');capture(page, path=str(OUT/'obs-desktop-dark.png'), full_page=True)
                page.locator('[data-filter=updates]').click()
                assert page.locator('#pf-results>tr[data-component]').count()==2
                page.locator('[data-filter=unknown]').click()
                assert page.locator('#pf-results>tr[data-component]').count()==1
                page.locator('[data-filter=ready]').click()
                assert page.locator('#pf-results>tr[data-component]').count()>1
                page.locator('[data-filter=all]').click()
                page.fill('#pf-report-search','Legacy Overlay')
                assert page.locator('#pf-results>tr[data-component]').count()==1
                page.locator('#pf-results [data-detail]').first.click()
                assert 'SAMPLE DATA' in page.locator('.pf-row-detail:visible').inner_text()
                assert 'Last verified' in page.locator('.pf-row-detail:visible').inner_text()
                page.fill('#pf-report-search','')
                # Dependency navigation and exclusion must preserve detail/focus and re-evaluate parents.
                page.locator('[data-detail="demo-obs-13"]').first.click()
                page.locator('[data-dependency="demo-obs-12"]').click()
                assert page.locator('#pf-report-search').input_value()=='id:demo-obs-12'
                assert page.locator('#pf-results>tr[data-component]').count()==1
                page.locator('#pf-results [data-ignore]').check()
                assert 'WAIT' in page.locator('#pf-verdict').inner_text()
                page.locator('#pf-results [data-ignore]').uncheck()
                assert 'CAUTION' in page.locator('#pf-verdict').inner_text()
                page.fill('#pf-report-search','')
                page.locator('.pf-comparison>summary').click()
                page.locator('#pf-compare button').click()
                assert 'BLOCKED' in page.locator('#pf-diff').inner_text()
                assert 'Demo Canvas Switch' in page.locator('#pf-diff').inner_text()
                # Current setup remains at the original target.
                assert page.locator('#pf-environment input[name=target]').input_value()=='33.0'
                page.locator('.pf-setups>summary').click()
                page.fill('#pf-setup-name','Streaming PC QA')
                page.locator('#pf-save').click()
                assert 'Streaming PC QA' == page.locator('[data-saved-name]').input_value()
                page.fill('[data-saved-name]','Renamed PC QA')
                page.locator('[data-rename]').click()
                page.reload();page.locator('#preflight[aria-busy=false]').wait_for()
                page.locator('.pf-setups>summary').click()
                page.locator('[data-load]').click()
                assert page.locator('#pf-setup-name').input_value()=='Renamed PC QA'
                assert '16 components' in page.locator('#pf-verdict').inner_text()
                # Exports must be real parseable files, preserving sample provenance.
                with page.expect_download() as dl: page.locator('#pf-export').click()
                dl.value.save_as(str(OUT/'report.json'))
                report=json.loads((OUT/'report.json').read_text(encoding='utf8'))
                assert report['report']['sample'] and len(report['environment']['components'])==16
                with page.expect_download() as dl: page.locator('#pf-export-report').click()
                dl.value.save_as(str(OUT/'report.html'))
                assert 'SAMPLE DATA' in (OUT/'report.html').read_text(encoding='utf8')
                page.locator('#pf-copy').click()
                clipboard=page.evaluate('navigator.clipboard.readText()')
                assert 'SAMPLE DATA' in clipboard and 'CAUTION' in clipboard
                # Print exports all rows/evidence even when the visible table is filtered.
                page.evaluate('window.print=()=>{window.__printed=true}')
                page.locator('[data-filter=unknown]').click()
                page.locator('#pf-print').click()
                assert page.evaluate('window.__printed')
                assert page.locator('.pf-print-full table tbody tr').count()==16
                page.emulate_media(media='print')
                capture(page, path=str(OUT/'print.png'), full_page=True)
                page.emulate_media(media='screen')
                page.evaluate('dispatchEvent(new Event("afterprint"))')
                # Clear / JSON round trip, and atomic invalid imports.
                page.locator('.pf-inventory>summary').click()
                page.locator('#pf-clear').click()
                page.locator('#pf-file').set_input_files(str(OUT/'report.json'))
                page.wait_for_function('()=>document.querySelector("#pf-inventory-count").textContent==="16"')
                page.locator('#pf-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"schemaVersion":99}'})
                assert 'Unsupported schemaVersion' in page.locator('#pf-notice').inner_text()
                assert page.locator('#pf-inventory-count').inner_text()=='16'
                page.locator('#pf-clear').click()
                # Keyboard picker and manual add; unknown is honest, source-backed min-host fail.
                page.fill('#pf-picker','Move')
                page.locator('#pf-picker').press('ArrowDown');page.locator('#pf-picker').press('Enter')
                assert page.locator('#pf-picker').input_value()=='Move Transition'
                page.fill('#pf-add input[name=version]','3.2.0')
                page.locator('#pf-add button[type=submit]').click()
                page.locator('[data-filter=all]').click()
                assert page.locator('#pf-inventory-count').inner_text()=='1'
                assert 'Unknown' in page.locator('#pf-results').inner_text()
                page.fill('#pf-environment input[name=target]','31.0')
                page.locator('#pf-environment input[name=target]').blur()
                page.wait_for_function('()=>document.querySelector("#pf-verdict").textContent.includes("BLOCKED")')
                page.locator('#pf-results [data-detail]').first.click()
                assert page.locator('.pf-row-detail a').filter(has_text='Move 3.2.0').count()==1
                page.fill('#pf-environment input[name=target]','33')
                page.locator('[data-mode=paste]').click()
                page.fill('#pf-paste textarea','StreamFX @ 1.0\nAitum Vertical @ 1.5\nUnique QA Plugin @ 2.0'.replace('\\n','\n'))
                page.locator('#pf-paste button[type=submit]').click()
                assert page.locator('#pf-inventory-count').inner_text()=='4'
                page.locator('.pf-inventory>summary').click()
                # the details was closed by clear only if browser retains it; normalize.
                page.evaluate('document.querySelector(".pf-inventory").open=true')
                page.locator('[data-remove]').first.click()
                assert page.locator('#pf-inventory-count').inner_text()=='3'
                # Cross-vertical samples, responsive states and real unknown inventory.
                for vertical, verdict in [('studio','BLOCKED'),('blender','WAIT'),('godot','WAIT')]:
                    page.goto(base+'/ko/preflight/'+vertical+'/')
                    page.locator('#preflight[aria-busy=false]').wait_for()
                    page.locator('#pf-sample').click()
                    assert verdict in page.locator('#pf-verdict').inner_text(), (vertical,page.locator('#pf-verdict').inner_text())
                    assert 'SAMPLE DATA' in page.locator('#pf-provenance').inner_text()
                    if vertical=='studio':
                        page.locator('#pf-environment select[name=platform]').select_option('windows')
                        assert 'Windows' in page.locator('.pf-route').inner_text()
                        assert 'CAUTION' in page.locator('#pf-verdict').inner_text()
                        page.locator('#pf-sample').click()
                    page.evaluate('scrollTo(0,0)');capture(page, path=str(OUT/(vertical+'-desktop.png')),full_page=True)
                    for width in [320,390,768,1440]:
                        page.set_viewport_size({'width':width,'height':900})
                        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), (vertical,width)
                    page.set_viewport_size({'width':390,'height':844})
                    page.wait_for_function('()=>document.querySelector(".lnav").getBoundingClientRect().right<=1')
                    page.evaluate('scrollTo(0,0)');capture(page, path=str(OUT/(vertical+'-mobile.png')),full_page=True)
                    capture(page, path=str(OUT/(vertical+'-mobile-viewport.png')))
                    page.set_viewport_size({'width':1600,'height':1000})
                # Japanese route and no-JS indexable content.
                page.goto(base+'/en/preflight/studio/')
                page.locator('#preflight[aria-busy=false]').wait_for()
                page.locator('.pf-setups>summary').click()
                page.locator('[data-load]').first.click()
                page.wait_for_url('**/en/preflight/obs/')
                page.locator('#preflight[aria-busy=false]').wait_for()
                page.wait_for_function('()=>document.querySelector("#pf-inventory-count").textContent==="16"')
                page.goto(base+'/ja/preflight/obs/')
                page.locator('#preflight[aria-busy=false]').wait_for()
                assert page.locator('html').get_attribute('lang')=='ja'
                page.locator('#pf-sample').click()
                assert 'SAMPLE DATA' in page.locator('#pf-provenance').inner_text()
                page.set_viewport_size({'width':320,'height':800})
                page.wait_for_function('()=>document.querySelector(".lnav").getBoundingClientRect().right<=1')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                page.evaluate('scrollTo(0,0)');capture(page, path=str(OUT/'obs-mobile.png'),full_page=True)
                nojs=browser.new_context(java_script_enabled=False)
                for vertical in ['obs','studio','blender','godot']:
                    pg=nojs.new_page();pg.goto(base+'/en/preflight/'+vertical+'/')
                    assert pg.locator('h1').inner_text() and len(' '.join(pg.locator('.pf-explain').all_inner_texts()))>300
                    assert pg.locator('link[rel=canonical]').get_attribute('href')==canonical_root+'en/preflight/'+vertical+'/'
                    pg.close()
                nojs.close()
                assert not errors, errors
                assert not uploads, uploads
                assert not failed_responses, failed_responses
                (OUT/'browser-result.json').write_text(json.dumps({'passed':True,'mount':mount,'canonicalRoot':canonical_root,'flows':['all verticals','manual','keyboard picker','paste','scanner JSON','atomic invalid import','filters','search','evidence','dependency navigation','exclusion propagation','Studio OS host mapping','compare','save rename reload','cross-vertical load','JSON export reimport','HTML export','clipboard','print all rows','light dark','320/390/768/1440','ja','no-JS SEO'],'pageErrors':errors,'inventoryUploads':uploads},indent=2),encoding='utf8')
                browser.close()
        finally:
            proc.terminate()
            try:proc.wait(timeout=10)
            except subprocess.TimeoutExpired:proc.kill();proc.wait()
    print('Preflight browser flows passed.')

if __name__=='__main__':run()
