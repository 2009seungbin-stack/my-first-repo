"""Design checks of the game home, the /game/ hub and the game landing template (src/game-site.css,
src/game-home.css, src/game-landing.css; docs/HANDOFF-DESIGN.md).

At 390, 768, 1440 and 1920 px in ko/en/ja: no horizontal scroll, the hero picture loads, the primary
action is above the fold, one H1 and no skipped heading level, every image has alt text, text tokens
meet WCAG AA contrast, small layout shift, no console errors. Also: the live sprite demo plays and
stops under prefers-reduced-motion, keyboard focus is visible, and a language switch on the home swaps
the product shots to that language's captures.
Usage: TEST_URL=http://127.0.0.1:4173 python tests/design-browser.py   (served by tools/regression.py)
"""
import os, sys
from playwright.sync_api import sync_playwright

BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
checks = []; errors = []
sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def ok(name, cond, detail=''):
    assert cond, f'{name} {detail}'
    checks.append(name); print('PASS', name, detail, flush=True)


PAGES = ['{l}/', '{l}/sprite-slicer/', '{l}/sprite-sheet-maker/', '{l}/game/tile-lab/', '{l}/game/pixel-lab/', '{l}/game/']
SIZES = [(390, 844), (768, 1024), (1440, 900), (1920, 1080)]
CLS = '''()=>new Promise(r=>{let v=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)v+=e.value;}).observe({type:'layout-shift',buffered:true});setTimeout(()=>r(v),500);})'''
HEADINGS = '''()=>{const hs=[...document.querySelectorAll('h1,h2,h3,h4')].filter(h=>h.offsetParent||h.closest('details'));let prev=0,bad=[];for(const h of hs){const n=+h.tagName[1];if(prev&&n>prev+1)bad.push(h.tagName+':'+h.textContent.trim().slice(0,30));prev=n;}return {h1:document.querySelectorAll('h1').length,bad};}'''
CONTRAST = '''()=>{const cs=getComputedStyle(document.body),v=n=>cs.getPropertyValue(n).trim();
 const rgb=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);};
 const lum=c=>{const [r,g,b]=rgb(c).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
 const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
 const out={};for(const t of ['--gs-text','--gs-text-2','--gs-text-3','--gs-accent-2','--gs-ok','--gs-warn','--gs-built','--gs-partial'])for(const b of ['--gs-bg','--gs-bg-2','--gs-panel'])out[t+' on '+b]=+ratio(v(t),v(b)).toFixed(2);
 out['button ink on accent']=+ratio(v('--gs-accent-ink'),v('--gs-accent')).toFixed(2);return out;}'''

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for w, h in SIZES:
        ctx = browser.new_context(viewport={'width': w, 'height': h}, locale='en-US')
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: m.type == 'error' and errors.append(m.text[:200]))
        for tpl in PAGES:
            for loc in (['ko', 'en', 'ja'] if w in (390, 1440) else ['en']):
                url = tpl.format(l=loc); tag = f'{w} {url}'
                page.goto(f'{BASE}/{url}', wait_until='load')
                page.wait_for_function('()=>document.documentElement.dataset.glReady==="1"||!document.querySelector("[data-game-landing]")', timeout=20000)
                home = page.locator('#heroShot').count() > 0
                img = '#heroShot' if home else '.gl-shot img'
                ok('hero picture loads', page.evaluate(f'(async()=>{{const i=document.querySelector({img!r});await i.decode().catch(()=>{{}});return i.naturalWidth>0&&i.getBoundingClientRect().width>200}})()'), tag)
                ok('layout shift under 0.1', page.evaluate(CLS) < 0.1, tag)
                ok('no horizontal scroll', page.evaluate('document.documentElement.scrollWidth<=innerWidth'), tag)
                cta = page.locator('.gh-open' if home else '.gl-drop [data-gl-pick]').first.bounding_box()
                ok('the primary action is above the fold', cta and cta['y'] + cta['height'] <= h, tag)
                hs = page.evaluate(HEADINGS)
                ok('one H1 and no skipped heading level', hs['h1'] == 1 and not hs['bad'], f'{tag} {hs}')
                ok('every image has alt text', page.evaluate('[...document.images].every(i=>i.hasAttribute("alt"))'), tag)
                ok('the header keeps the brand, the language menu and the Studio button visible', page.locator('.gs-header .gs-brand').is_visible() and page.locator('#languageSelect').is_visible() and page.locator('.gs-header [data-studio-link]').is_visible(), tag)
                if w == 1440 and loc == 'en' and home:
                    c = page.evaluate(CONTRAST)
                    ok('text tokens meet WCAG AA (4.5:1) on every surface', all(v >= 4.5 for v in c.values()), str({k: v for k, v in c.items() if v < 4.5}))
        ctx.close()
    # The live demo: plays, and holds one frame under reduced motion.
    for motion, playing in [('no-preference', True), ('reduce', False)]:
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion=motion); page = ctx.new_page()
        page.goto(BASE + '/en/', wait_until='load'); page.locator('.gh-demo').scroll_into_view_if_needed()
        names = page.evaluate('[".gh-demo-sprite",".gh-demo-cursor"].map(s=>getComputedStyle(document.querySelector(s)).animationName)')
        ok(f'sprite demo animation with prefers-reduced-motion: {motion}', all((n != 'none') == playing for n in names), str(names))
        ok('the demo sheet and preview use the committed CC0 art', page.evaluate('(async()=>{const i=document.querySelector(".gh-demo-grid img");i.loading="eager";await i.decode().catch(()=>{});return i.naturalWidth===96&&getComputedStyle(document.querySelector(".gh-demo-sprite")).backgroundImage.includes("classic-hero-frames.png")})()'))
        ctx.close()
    # Keyboard: the skip link and a visible focus ring on the primary action.
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}); page = ctx.new_page()
    page.goto(BASE + '/en/', wait_until='load')
    page.keyboard.press('Tab')
    ok('the first Tab lands on a visible "skip to content" link', page.evaluate('document.activeElement.classList.contains("gs-skip")') and page.locator('.gs-skip').bounding_box()['y'] >= 0)
    page.focus('.gh-open'); page.keyboard.press('Shift+Tab'); page.keyboard.press('Tab')
    ok('keyboard focus is visible on the primary action', page.evaluate('(()=>{const s=getComputedStyle(document.activeElement);return document.activeElement.classList.contains("gh-open")&&s.outlineStyle!=="none"&&parseFloat(s.outlineWidth)>=2})()'))
    # Language switch on the home: the copy and the product shots change together, in place.
    page.locator('#languageSelect').select_option('ja'); page.wait_for_timeout(300)
    ok('a language switch on the home swaps the product shots to that language', page.url.endswith('/ja/') and '-ja-' in page.locator('#heroShot').get_attribute('src') and all('-ja-' in s for s in page.locator('img[data-shot]').evaluate_all('ns=>ns.map(n=>n.getAttribute("src"))')))
    ok('the workflow copy is relabelled too', page.locator('#flowTitle').inner_text() == 'スプライトシートからエンジンまで、ひとつのスタジオで')
    ctx.close()
    browser.close()
ok('no page errors or console errors', not errors, str(errors[:5]))
print(f'design-browser: {len(checks)} checks passed')
