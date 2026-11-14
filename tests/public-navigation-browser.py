"""Keyboard navigation on the real public shell, in Chromium and Firefox.

By default owns a local seeded public server. --base and --expected-sha allow the
same read-only checks against a frozen deployment without touching account data.
"""
import argparse,json,os,socket,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--base');parser.add_argument('--expected-sha');args=parser.parse_args()
OUT=ROOT/'test-results'/'public-navigation'/('production' if args.base else 'local');OUT.mkdir(parents=True,exist_ok=True)
proc=None;checks=[];errors=[]
if args.base:BASE=args.base.rstrip('/')
else:
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    BASE=f'http://localhost:{port}'
    log=(OUT/'server.log').open('w')
    proc=subprocess.Popen(['node','tools/platform/dev-server.mjs',str(port)],cwd=ROOT,env={**os.environ,'PUBLIC_SITE':'on'},stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))

def focus_inside(page):return page.evaluate('()=>!!document.activeElement.closest("#lnav")')
def focused_end(page,which):
    return page.evaluate('''which=>{const items=[...document.querySelector('#lnav').querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].filter(e=>e.tabIndex>=0&&!e.disabled&&e.getClientRects().length);return document.activeElement===items[which==='first'?0:items.length-1]}''',which)
def closed(page):
    expect(page.locator('[data-drawer-open]')).to_have_attribute('aria-expanded','false')
    assert page.locator('#lnav').get_attribute('role') is None
    assert page.locator('#lnav').evaluate('(e)=>getComputedStyle(e).visibility')=='hidden'
    assert page.locator('.app > .col').evaluate('(e)=>!e.inert')
    assert page.locator('body > .skip').evaluate('(e)=>!e.inert')
def opened(page):
    expect(page.locator('#lnav')).to_have_attribute('role','dialog')
    expect(page.locator('#lnav')).to_have_attribute('aria-modal','true')
    expect(page.locator('[data-drawer-open]')).to_have_attribute('aria-expanded','true')
    assert page.locator('.app > .col').evaluate('(e)=>e.inert')
    assert page.locator('body > .skip').evaluate('(e)=>e.inert')
    assert focus_inside(page)
    page.wait_for_function('()=>document.querySelector("#lnav").getBoundingClientRect().x>=0')

try:
    if proc:
        for _ in range(100):
            try:urllib.request.urlopen(BASE+'/',timeout=2).close();break
            except OSError:
                if proc.poll() is not None:raise RuntimeError('Owned public fixture server exited')
                time.sleep(.2)
        else:raise RuntimeError('Owned public fixture server did not start')
    with sync_playwright() as p:
        for engine in ['chromium','firefox']:
            browser=getattr(p,engine).launch()
            ctx=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
            if args.expected_sha:assert ctx.request.get(BASE+'/build.txt').text().strip()==args.expected_sha
            page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            paths=['/','/en/','/ko/ai/digest/sfx-sample-channels/','/en/ai/digest/sfx-sample-channels/']
            for number,path in enumerate(paths):
                assert page.goto(BASE+path,wait_until='networkidle').status==200
                closed(page)
                page.keyboard.press('Tab');expect(page.locator('.skip')).to_be_focused()
                page.keyboard.press('Tab');expect(page.locator('[data-drawer-open]')).to_be_focused()
                assert not focus_inside(page)
                page.keyboard.press('Enter');opened(page)
                page.screenshot(path=str(OUT/f'{engine}-{number}-menu.png'))
                assert focused_end(page,'first')
                page.keyboard.press('Shift+Tab');assert focused_end(page,'last')
                page.keyboard.press('Tab');assert focused_end(page,'first')
                # Closing groups must remove their hidden children from the focus loop.
                for summary in page.locator('#lnav details > summary').all():
                    summary.focus();page.keyboard.press('Space')
                page.locator('#lnav a').first.focus()
                page.keyboard.press('Shift+Tab')
                expect(page.locator('#lnav details > summary').last).to_be_focused()
                page.keyboard.press('Tab');assert focused_end(page,'first')
                page.keyboard.press('Escape');closed(page);expect(page.locator('[data-drawer-open]')).to_be_focused()
                page.keyboard.press('Enter');opened(page)
                page.locator('#lnav [data-drawer-close]').focus();page.keyboard.press('Enter')
                closed(page);expect(page.locator('[data-drawer-open]')).to_be_focused()
                page.keyboard.press('Enter');opened(page)
                page.locator('.scrim').click(position={'x':375,'y':400})
                closed(page);expect(page.locator('[data-drawer-open]')).to_be_focused()
                page.evaluate('()=>location.hash="lnav"');opened(page)
                page.evaluate('()=>location.hash="main"');closed(page)
                expect(page.locator('[data-drawer-open]')).to_be_focused()
                # A no-script hash can already be present when JS initializes.
                page.goto(BASE+path+'#lnav',wait_until='networkidle')
                assert page.reload(wait_until='networkidle').status==200
                opened(page);page.evaluate('()=>history.replaceState({keyboardProbe:true},"",location.pathname+"?keyboard=probe#lnav")')
                page.keyboard.press('Escape');closed(page)
                assert page.url==BASE+path+'?keyboard=probe',(page.url,BASE+path+'?keyboard=probe')
                assert page.evaluate('history.state.keyboardProbe') is True
                page.keyboard.press('Enter');opened(page)
                page.set_viewport_size({'width':1440,'height':1000})
                expect(page.locator('[data-drawer-open]')).to_have_attribute('aria-expanded','false')
                assert page.locator('#lnav').get_attribute('role') is None
                assert page.locator('.app > .col').evaluate('(e)=>!e.inert')
                assert page.locator('#lnav').evaluate('(e)=>getComputedStyle(e).visibility')=='visible'
                page.locator('#lnav a').first.focus()
                page.set_viewport_size({'width':390,'height':844})
                closed(page);expect(page.locator('[data-drawer-open]')).to_be_focused()
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                checks.append({'engine':engine,'path':path,'case':'JS: closed tab order, dialog focus loop, collapsed groups, Escape/close/scrim, hash/history, desktop/mobile resize'})
            # Exercise the animated drawer in dark mode while a reader is midway through an article.
            page.emulate_media(reduced_motion='no-preference')
            page.goto(BASE+paths[-1],wait_until='networkidle')
            page.locator('[data-theme-toggle]').click()
            assert page.evaluate('document.documentElement.dataset.theme')=='dark'
            page.evaluate('()=>scrollTo(0,800)');position=page.evaluate('scrollY');assert position>0
            page.locator('[data-drawer-open]').click();opened(page)
            page.screenshot(path=str(OUT/f'{engine}-dark-menu.png'))
            page.keyboard.press('Escape');closed(page)
            assert abs(page.evaluate('scrollY')-position)<=1
            checks.append({'engine':engine,'path':paths[-1],'case':'Dark mode, normal motion and preserved article scroll position'})
            if args.expected_sha:assert ctx.request.get(BASE+'/build.txt').text().strip()==args.expected_sha
            ctx.close()
            # CSS-only fallback must remain usable and closed links must not be tab stops.
            ctx=browser.new_context(viewport={'width':390,'height':844},java_script_enabled=False,reduced_motion='reduce');page=ctx.new_page()
            for path in ['/',paths[-1]]:
                assert page.goto(BASE+path).status==200
                assert page.locator('#lnav').evaluate('(e)=>getComputedStyle(e).visibility')=='hidden'
                page.keyboard.press('Tab');page.keyboard.press('Tab')
                expect(page.locator('[data-drawer-open]')).to_be_focused()
                page.keyboard.press('Enter')
                assert page.url.endswith('#lnav')
                assert page.locator('#lnav').evaluate('(e)=>getComputedStyle(e).visibility')=='visible'
                page.locator('#lnav [data-drawer-close]').focus();page.keyboard.press('Enter')
                assert page.locator('#lnav').evaluate('(e)=>getComputedStyle(e).visibility')=='hidden'
                checks.append({'engine':engine,'path':path,'case':'No JS: closed tab order and hash open/close'})
            ctx.close();browser.close()
    assert not errors,errors
    (OUT/'results.json').write_text(json.dumps({'expectedLiveCommit':args.expected_sha,'checks':checks,'pageErrors':errors,'scope':'Desktop browser engines with desktop/mobile viewports, keyboard and DOM accessibility states. Not physical-device or continuous screen-reader testing.'},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Public navigation passed: {len(checks)} scenarios in Chromium and Firefox; keyboard, resize and no-script fallback.')
finally:
    if proc:
        proc.terminate()
        try:proc.wait(timeout=5)
        except subprocess.TimeoutExpired:proc.kill();proc.wait()
        log.close()
