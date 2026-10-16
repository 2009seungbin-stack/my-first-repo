"""Check portal discovery as rendered HTML at desktop/mobile sizes, without client JavaScript."""
from pathlib import Path
import json, socket, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 'platform-seo-browser'
OUT.mkdir(parents=True, exist_ok=True)
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
origin = f'http://localhost:{port}'
checks = []
# The platform dev server owns dynamic routes; production serves the generated tools
# directory as a static asset. Use the actual entry renderer for those two static routes.
server_script = '''
import {createDevServer} from './tools/platform/dev-server.mjs';
import {entry} from './tools/build.mjs';
import {setPortal} from './src/seo.js';
import {readFile} from 'node:fs/promises';
const {server,origin,db}=await createDevServer({port:Number(process.argv[1])});
// Reproduce a quiet site: examples and useful routes must work without sample activity.
await db.prepare('DELETE FROM discussions').run();
const template=await readFile('index.html','utf8');setPortal(true);
const [dynamic]=server.listeners('request');server.removeAllListeners('request');
server.on('request',(req,res)=>{
 if(/^\\/(ko|en|ja)\\/(tools|image\\/compress|game\\/sprite-slicer|preflight|about|privacy)\\/$/.test(req.url)){
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  res.end(entry(template,req.url.slice(1,-1),origin+'/',{platform:true,service:true,metering:false}));
 }else if(['/styles.css','/content.css'].includes(req.url)){
  readFile('.'+req.url).then(data=>{res.writeHead(200,{'content-type':'text/css'});res.end(data);});
 }else dynamic(req,res);
});
'''
with (OUT / 'server.log').open('w', encoding='utf-8') as log:
    proc = subprocess.Popen(['node', '--input-type=module', '-e', server_script, str(port)], cwd=ROOT, stdout=log, stderr=log,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    try:
        for _ in range(150):
            try:
                urllib.request.urlopen(origin + '/', timeout=1)
                break
            except OSError:
                if proc.poll() is not None:
                    raise RuntimeError('Platform test server exited')
                time.sleep(.2)
        else:
            raise RuntimeError('Platform test server did not start')
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            context = browser.new_context(java_script_enabled=False)
            visited = set()
            for locale, route in [('ko', '/'), ('en', '/en/')]:
                for width, height in [(1440, 900), (390, 844), (320, 844)]:
                    page = context.new_page()
                    page.set_viewport_size({'width': width, 'height': height})
                    assert page.goto(origin + route).status == 200
                    start = page.locator('[data-home-start]')
                    assert start.is_visible()
                    assert page.locator('h1').count() == 1
                    assert start.bounding_box()['y'] < 400
                    assert page.locator('[data-home-start] .home-workflows > li').count() == 3
                    assert page.locator('[data-home-example]').bounding_box()['y'] < page.locator('#home-community').bounding_box()['y']
                    image = page.locator('[data-home-example] img')
                    image.scroll_into_view_if_needed()
                    image_path = image.get_attribute('src')
                    assert page.request.get(origin + image_path).status == 200
                    section = page.locator('[data-search-discovery]')
                    assert section.count() == 1 and section.is_visible()
                    assert section.locator('ul > li').count() == 5
                    assert page.locator('link[rel=canonical]').get_attribute('href') == origin + route
                    graph = json.loads(page.locator('script[type="application/ld+json"]').inner_text())['@graph']
                    assert len([n for n in graph if n.get('@id') == origin + route + '#webpage']) == 1
                    assert page.locator('.lnav a[href="/' + locale + '/bracket/"]').count() == 1
                    assert page.evaluate('document.documentElement.scrollWidth') <= width
                    for href in page.locator('[data-home-start] a, [data-home-example] a, [data-search-discovery] a').evaluate_all('(links)=>links.map(a=>a.getAttribute("href"))'):
                        assert href.startswith('/' + locale + '/')
                        if href not in visited:
                            assert page.request.get(origin + href).status == 200, href
                            visited.add(href)
                    page.evaluate('window.scrollTo(0,0)')
                    page.screenshot(path=str(OUT / f'{locale}-{width}.png'), full_page=True)
                    checks.append(f'{locale}: useful home without posts, SSR links, canonical graph and layout at {width}px')
                    page.close()
                page = context.new_page()
                page.set_viewport_size({'width': 390, 'height': 844})
                assert page.goto(origin + f'/{locale}/community/ai/').status == 200
                assert page.locator('[data-board-resources]').is_visible()
                assert page.locator('meta[name="robots"]').get_attribute('content') == 'noindex,follow'
                assert page.evaluate('document.documentElement.scrollWidth') <= 390
                page.screenshot(path=str(OUT / f'{locale}-empty-board.png'), full_page=True)
                page.close()
            live = browser.new_context()
            policy = live.new_page()
            errors = []
            policy.on('pageerror', lambda error: errors.append(str(error)))
            for locale in ['ko', 'en', 'ja']:
                assert policy.goto(origin + f'/{locale}/privacy/').status == 200
                policy.locator('.community-privacy').first.wait_for()
                assert policy.locator('.community-privacy').count() == 2
                assert policy.locator('.traffic-status').count() == 0
                target = 'en' if locale == 'ko' else 'ko'
                policy.locator(f'.policy-languages a[lang="{target}"]').click()
                policy.wait_for_function('(l)=>document.documentElement.lang===l', arg=target)
                assert policy.locator('.community-privacy').count() == 2
                assert 'Cloudflare R2' in policy.locator('main').inner_text()
                assert policy.goto(origin + f'/{locale}/about/').status == 200
                policy.locator('main nav').wait_for()
                directory = 'ja/' if locale == 'ja' else f'{locale}/tools/'
                assert policy.locator(f'main nav a[href="{directory}"]').count() == 1
                checks.append(f'{locale}: current about resources and community privacy survive client rendering and language switch')
            assert not errors, errors
            live.close()
            browser.close()
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'links': sorted(visited)}, indent=2), encoding='utf-8')
        print(f'PASS portal discovery: {len(checks)} checks, {len(visited)} working links')
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
