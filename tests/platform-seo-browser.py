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
const {server,origin}=await createDevServer({port:Number(process.argv[1])});
const template=await readFile('index.html','utf8');setPortal(true);
const [dynamic]=server.listeners('request');server.removeAllListeners('request');
server.on('request',(req,res)=>{
 if(/^\\/(ko|en)\\/tools\\/$/.test(req.url)){
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  res.end(entry(template,req.url.slice(1,-1),origin+'/',{platform:true,metering:false}));
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
                    section = page.locator('[data-search-discovery]')
                    assert section.count() == 1 and section.is_visible()
                    assert section.locator('ul > li').count() == 5
                    assert page.locator('link[rel=canonical]').get_attribute('href') == origin + route
                    graph = json.loads(page.locator('script[type="application/ld+json"]').inner_text())['@graph']
                    assert len([n for n in graph if n.get('@id') == origin + route + '#webpage']) == 1
                    assert page.locator('.lnav a[href="/' + locale + '/bracket/"]').count() == 1
                    assert page.evaluate('document.documentElement.scrollWidth') <= width
                    for href in section.locator('a').evaluate_all('(links)=>links.map(a=>a.getAttribute("href"))'):
                        assert href.startswith('/' + locale + '/')
                        if href not in visited:
                            assert page.request.get(origin + href).status == 200, href
                            visited.add(href)
                    section.scroll_into_view_if_needed()
                    page.screenshot(path=str(OUT / f'{locale}-{width}.png'))
                    checks.append(f'{locale}: SSR discovery, canonical graph, links and layout at {width}px')
                    page.close()
            browser.close()
        (OUT / 'results.json').write_text(json.dumps({'checks': checks, 'links': sorted(visited)}, indent=2), encoding='utf-8')
        print(f'PASS portal discovery: {len(checks)} viewports, {len(visited)} working links')
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
