"""Guides (/guides/, /guides/<slug>/) in Chromium: every guide in every language renders with one h1,
canonical + hreflang, JSON-LD that parses and matches the visible FAQ and steps, images that load,
no sideways scroll on a phone, and a "Do it in Nerulio" button that really opens the Studio
workspace (or the Lab) it names. Also: the language switch, the language-neutral URL, the
footer link from the home page and the index grouped by topic and engine.

Runs inside tools/regression.py (port 4173, a dist build with SITE_URL). Standalone, against a
dist build you serve yourself:
  SITE_URL=https://example.test/ node tools/build.mjs
  PORT=<port> node tools/serve.mjs --dist   then   TEST_URL=http://127.0.0.1:<port> python tests/guides-browser.py
SHOTS=<dir> also writes screenshots at 1440x900 and 390x844."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, subprocess, sys
ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
SHOTS = os.environ.get('SHOTS', '')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
LOCALES = ['ko', 'en', 'ja']
REG = json.loads(subprocess.run(['node', '--input-type=module', '-e',
    "import {GUIDES} from './src/guides.js';import {INTENTS} from './src/intents.js';"
    "console.log(JSON.stringify(GUIDES.map(g=>({slug:g.slug,open:g.open,toolPath:g.open.tool?INTENTS[g.open.tool].path:null,engines:g.engines}))))"],
    cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout)
checks = []; errors = []


def ok(name, cond, detail=''):
    if not cond: raise AssertionError(f'{name} {detail}')
    checks.append(name); print('PASS', name, flush=True)


def shot(p, name):
    if SHOTS: Path(SHOTS).mkdir(parents=True, exist_ok=True); p.screenshot(path=str(Path(SHOTS) / name), full_page=False)


def watch(p, label):
    p.on('pageerror', lambda e: errors.append(f'{label}: {e}'))
    p.on('console', lambda m: m.type == 'error' and errors.append(f'{label}: {m.text[:300]}'))


PAGE_FACTS = '''()=>{
 const ld=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent));
 const faq=document.getElementById('faq');let visibleFaq=0;
 if(faq){let n=faq.nextElementSibling;while(n&&n.tagName!=='H2'){if(n.tagName==='H3')visibleFaq++;n=n.nextElementSibling;}}
 return {h1:document.querySelectorAll('h1').length,lang:document.documentElement.lang,
  canonical:document.querySelector('link[rel=canonical]')?.href||'',
  alternates:Object.fromEntries([...document.querySelectorAll('link[rel=alternate][hreflang]')].map(l=>[l.hreflang,l.href])),
  types:ld.map(d=>d['@type']),faqData:(ld.find(d=>d['@type']==='FAQPage')||{mainEntity:[]}).mainEntity.length,visibleFaq,
  steps:(ld.find(d=>d['@type']==='HowTo')||{step:[]}).step.length,visibleSteps:document.querySelectorAll('.guide-steps>li').length,
  updated:document.querySelector('.guide-meta time')?.getAttribute('datetime')||'',modified:(ld.find(d=>d['@type']==='Article')||{}).dateModified||'',
  images:[...document.querySelectorAll('.guide-article img')].map(i=>i.getAttribute('src')),
  copy:document.querySelectorAll('.guide-code .guide-copy').length,codes:document.querySelectorAll('.guide-code').length,
  cta:document.querySelector('.guide-open')?.getAttribute('href')||'',overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}}'''

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, locale='en-US'); p = ctx.new_page(); watch(p, 'desktop')
    phone_ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='en-US')
    m = phone_ctx.new_page(); watch(m, 'phone')
    # ------------------------------------------------------------ index
    for l in LOCALES:
        r = p.goto(f'{BASE}/{l}/guides/'); ok(f'{l} index answers 200', r.status == 200)
        f = p.evaluate(PAGE_FACTS)
        ok(f'{l} index: one h1, canonical and four hreflang links', f['h1'] == 1 and f['canonical'].endswith(f'/{l}/guides/') and set(f['alternates']) == {'ko', 'en', 'ja', 'x-default'}, str(f))
        ok(f'{l} index: CollectionPage + BreadcrumbList data', 'CollectionPage' in f['types'] and 'BreadcrumbList' in f['types'])
        cards = p.locator('.guide-section .guide-cards a').count()
        ok(f'{l} index lists every guide by topic ({cards}) and has an engine filter', cards == len(REG) and p.locator('.guide-engine-nav a').count() >= 6)
        if l == 'en': shot(p, 'guides-index-1440.png')
    first = REG[0]
    p.goto(f'{BASE}/en/guides/'); p.locator('.guide-engine-nav a').first.click(); p.wait_for_timeout(200)
    ok('an engine chip jumps to that engine\'s list', '#engine-' in p.url and p.locator(f'#{p.url.split("#")[1]} li').count() >= 1)
    # ------------------------------------------------------------ every guide, every language
    for g in REG:
        for l in LOCALES:
            url = f'{BASE}/{l}/guides/{g["slug"]}/'
            r = p.goto(url); f = p.evaluate(PAGE_FACTS)
            label = f'{l}/{g["slug"]}'
            assert r.status == 200, label
            assert f['h1'] == 1 and f['lang'] == l, (label, f)
            assert f['canonical'].endswith(f'/{l}/guides/{g["slug"]}/') and set(f['alternates']) == {'ko', 'en', 'ja', 'x-default'} and f['alternates']['x-default'].endswith(f'/guides/{g["slug"]}/') and '/en/guides' not in f['alternates']['x-default'], (label, f)
            assert {'Article', 'BreadcrumbList', 'FAQPage'} <= set(f['types']), (label, f['types'])
            assert f['faqData'] == f['visibleFaq'] >= 3, (label, 'FAQ data must match the visible FAQ', f['faqData'], f['visibleFaq'])
            assert f['steps'] == f['visibleSteps'], (label, 'HowTo only for the visible steps', f['steps'], f['visibleSteps'])
            assert f['updated'] and f['updated'] == f['modified'], (label, 'visible Updated date = dateModified')
            assert f['copy'] == f['codes'], (label, 'every code block has a copy button')
            expect = f'{l}/game/studio/?ws={g["open"]["ws"]}' if g['open'].get('ws') else f'{l}/{g["toolPath"]}/'
            assert f['cta'] == expect, (label, f['cta'], expect)
            for src in f['images']:
                resp = p.request.get(f'{BASE}/{src}')
                assert resp.status == 200 and resp.headers['content-type'].startswith('image/') and len(resp.body()) > 1000, (label, src)
            m.goto(url); mf = m.evaluate(PAGE_FACTS)
            assert mf['overflow'] <= 0, (label, 'no sideways scroll at 390 px', mf['overflow'])
    ok(f'{len(REG)} guides × 3 languages: one h1, canonical/hreflang, Article/Breadcrumb/FAQ data matching the page, steps, dates, CTA, images, 390 px', True)
    p.goto(f'{BASE}/en/guides/{first["slug"]}/'); shot(p, 'guide-1440.png'); m.goto(f'{BASE}/en/guides/{first["slug"]}/'); shot(m, 'guide-390.png')
    m.goto(f'{BASE}/ko/guides/{REG[-1]["slug"]}/'); shot(m, 'guide-ko-390.png')
    # ------------------------------------------------------------ the Nerulio button hands off
    for ws in ['sprite', 'pack', 'tile']:
        g = next((x for x in REG if x['open'].get('ws') == ws), None)
        if not g: continue
        p.goto(f'{BASE}/ja/guides/{g["slug"]}/'); p.locator('.guide-open').click()
        p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"', timeout=30000)
        ok(f'"Do it in Nerulio" on {g["slug"]} opens the Studio {ws} workspace in Japanese', p.evaluate('()=>window.nerulioStudio.workspace') == ws and '/ja/game/studio/' in p.url)
    g = next((x for x in REG if x['open'].get('tool')), None)
    if g:
        p.goto(f'{BASE}/en/guides/{g["slug"]}/'); p.locator('.guide-open').click(); p.wait_for_load_state()
        ok(f'"Do it in Nerulio" on {g["slug"]} opens {g["open"]["tool"]}', p.url.endswith(f'/en/{g["toolPath"]}/') and p.locator('h1').count() == 1)
    # ------------------------------------------------------------ language switch, neutral URL, footer link, copy
    p.goto(f'{BASE}/en/guides/{first["slug"]}/'); p.select_option('#guideLanguage', 'ko'); p.wait_for_url(f'**/ko/guides/{first["slug"]}/')
    ok('the language switch goes to the same guide in Korean', p.evaluate('()=>document.documentElement.lang') == 'ko')
    ko_ctx = browser.new_context(locale='ko-KR'); k = ko_ctx.new_page(); watch(k, 'neutral-ko')
    k.goto(f'{BASE}/guides/{first["slug"]}/'); k.wait_for_url(f'**/ko/guides/{first["slug"]}/', timeout=10000)
    ok('the language-neutral URL sends a Korean browser to the Korean guide', k.evaluate('()=>document.documentElement.lang') == 'ko'); ko_ctx.close()
    en = browser.new_context(locale='en-US'); e = en.new_page(); e.goto(f'{BASE}/guides/{first["slug"]}/'); e.wait_for_timeout(400)
    ok('the language-neutral URL keeps English for an English browser (x-default)', e.url.endswith(f'/guides/{first["slug"]}/') and '/en/' not in e.url and e.evaluate('()=>document.documentElement.lang') == 'en'); en.close()
    p.goto(f'{BASE}/en/'); link = p.locator('#siteContent a[data-guides-link]')
    ok('the home footer links to the guides', link.count() == 1)
    link.click(); p.wait_for_url('**/en/guides/'); ok('…and the link opens the index', p.locator('.guide-section').count() >= 3)
    for g in REG:
        p.goto(f'{BASE}/en/guides/{g["slug"]}/')
        if p.locator('.guide-copy').count():
            ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
            p.locator('.guide-copy').first.click(); p.wait_for_timeout(150)
            ok('a code block copies its code', p.evaluate('()=>navigator.clipboard.readText()') == p.locator('.guide-code code').first.text_content()); break
    ok('no page errors or console errors', not errors, '\n'.join(errors[:10]))
    browser.close()
out = ROOT / 'test-results'; out.mkdir(exist_ok=True)
(out / 'guides-browser-results.json').write_text(json.dumps({'checks': checks}, indent=2), encoding='utf-8')
print(f'GUIDES BROWSER PASSED {len(checks)} checks')
