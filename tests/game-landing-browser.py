"""Game landing pages → Studio (tools/game-landing-build.mjs, src/game-landing.js).

Part 1 (Chromium): every game landing, Lab landing, keyword page and the /game/ hub in ko/en/ja is indexable,
has its canonical + reciprocal hreflang (when the build has a SITE_URL), SoftwareApplication and
BreadcrumbList JSON-LD, a real Studio screenshot, engine badges, and fits 390 px; classic Lab
pages are noindex and still mount the Lab; old Lab links forward to them; robots.txt names the
sitemap index and sitemap-game.xml lists every game page with a lastmod.
Part 2 (Chromium AND Firefox): for every Studio-backed intent the file chosen on its landing page
reaches the right Studio workspace, and the job the page promises is done and measured on committed
CC0 fixtures (the checks src/capabilities.js cites as evidence).
Part 3 (Chromium): every keyword page hands its file to the right workspace.
Part 4 (Chromium AND Firefox): every Lab landing hands its files to its Lab and the job is measured.
Part 5 (Chromium AND Firefox): keyword pages whose promise is a Lab flow (Lospec palette, integer
upscale, roughness to smoothness, sheet to PNG frames) do exactly that, measured on the download.
Part 6 (Chromium AND Firefox): the page families (src/game-seo-families.js) — a sample page of every
family (broad, engines, formats, fixes, compare; Studio and Lab targets, a `via` page) is followed from
its own file picker into the Studio and its promise is measured (frames against the sheet, generated
normals, collision in the Godot export, FNF XML → GIFs, .aseprite durations, an unrotated Phaser atlas).
Part 3 already hands a file to every Studio family page in Chromium.
Part 6 also follows every Pixel workspace page (src/game-seo-pixel.js, kind 'pixelart', ?ws=pixel) into
the Studio in both engines: a pencil stroke, a x7 upscale back to the exact 1x original, frames reaching
the Pixel workspace through Sprite (via), an exact indexed conversion, a 1 px outline equal to the
4-connected ring computed here, and a generated image left unsure.

TEST_URL (default http://127.0.0.1:4173); BROWSERS=chromium,firefox (default both).
Results: test-results/game-landing-browser.json ({check: [engines]}).
"""
import io, json, os, re, sys, zipfile, zlib, urllib.request
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
PARTS = os.environ.get('PARTS', '123456')  # for debugging only; the evidence run uses all parts
BROWSERS = [b for b in os.environ.get('BROWSERS', 'chromium,firefox').split(',') if b]
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
OUT = ROOT / 'test-results'; OUT.mkdir(exist_ok=True)
FX = ROOT / 'tests' / 'fixtures'
SAMURAI = FX / 'game' / 'corpus' / 'sprites' / 'samurai.png'    # 288×480, 48 px cells, 10 rows
NINJA = sorted((FX / 'game' / 'corpus' / 'ninja').glob('run_*.png'))  # 6 numbered frames
GIF = FX / 'sprite' / 'trooper_run.gif'                          # 6 frames, 120 ms
ASE = FX / 'aseprite' / 'indexed-features.aseprite'              # 4 frames, tags, slices
CAVE = FX / 'tile' / 'cave-autotile47.png'                       # GameMaker 47, 64 px
DUNGEON = FX / 'kenney' / 'tiny-dungeon-tilemap.png'             # 12×11 tiles of 16 px, 1 px spacing
TORCH_SHEET = FX / 'game' / 'corpus' / 'torch' / 'Torch_Sheet.png'  # 96×64, six 32 px frames (OGA, CC0)
TORCH_JSON = FX / 'game' / 'corpus' / 'torch' / 'Torch_Hash.json'  # Aseprite JSON hash for it (durations 100)
TORCH_TEX = FX / 'texture' / 'torch_sheet.png'                     # the same torch as a texture fixture
CAEL = FX / 'game' / 'cc0' / 'oga-caeles-blob47-16px.png'           # caeles blob-47 template, 16 px, alpha
PXF = FX / 'pixel'                                                  # Pixel workspace CC0 fixtures (LICENSE.md there)
results = {}; errors = []


def ok(name, cond, detail='', engine='chromium'):
    if not cond:
        raise AssertionError(f'[{engine}] {name} {detail}')
    results.setdefault(name, [])
    if engine not in results[name]:
        results[name].append(engine)
    print('PASS', f'[{engine}]', name, flush=True)


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=30) as r:
        body = r.read()
        return r.status, body.decode('utf-8', errors='replace')


def js(p, body, arg=None):
    return p.evaluate('async(arg)=>{const S=window.nerulioStudio;' + body + '}', arg)


def pages():
    script = ("import {GAME_INTENT_PAGES,GAME_LAB_PAGES,GAME_KEYWORD_PAGES,isStudioKind,kindOf} from './src/game-seo.js';import {INTENTS} from './src/intents.js';"
              "import {mayPromote} from './src/capabilities.js';"
              "console.log(JSON.stringify({intents:Object.fromEntries(Object.entries(GAME_INTENT_PAGES).map(([k,p])=>[k,{path:INTENTS[k].path,ws:p.ws,classic:!!p.classic,promote:mayPromote(k)}])),"
              "labs:Object.fromEntries(Object.entries(GAME_LAB_PAGES).map(([k,p])=>[k,{path:INTENTS[k].path,ws:p.ws,classic:false,promote:mayPromote(k),lab:true}])),"
              "keywords:Object.fromEntries(Object.entries(GAME_KEYWORD_PAGES).map(([k,p])=>[k,{path:k,ws:p.ws,promote:mayPromote(p.intent),studio:isStudioKind(p.ws),studioWs:kindOf(p.ws).studioWs||p.ws,via:p.via||'',family:p.family||''}]))}));")
    import subprocess
    out = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)


PAGES = pages()
ALL = [(k, v) for k, v in PAGES['intents'].items()] + [(k, v) for k, v in PAGES['labs'].items()] + [(k, v) for k, v in PAGES['keywords'].items()]


def visible(im):
    im = im.convert('RGBA'); b = bytearray(im.tobytes())
    for i in range(0, len(b), 4):
        if b[i + 3] == 0:
            b[i] = b[i + 1] = b[i + 2] = 0
    return bytes(b)


def frame_rgba(p, index):
    d = js(p, 'const R=await import("/src/studio/sprite/frame-render.js"),a=S.doc.assets.find(x=>x.id===S.activeAssetId)||S.doc.assets[0],f=a.frames[arg],img=await R.frameRGBA(S.images,a,f);return {w:img.width,h:img.height,d:Array.from(img.data)};', index)
    return Image.frombytes('RGBA', (d['w'], d['h']), bytes(d['d']))


def asset(p):
    return js(p, 'const a=S.doc.assets.find(x=>x.id===S.activeAssetId)||S.doc.assets[0];return JSON.parse(JSON.stringify(a));')


def canvas_at(p, ix, iy):
    return js(p, 'const v=S.view,r=v.stage.getBoundingClientRect();return {x:r.left+(v.view.x+arg[0]*v.view.scale)*r.width/v.W,y:r.top+(v.view.y+arg[1]*v.view.scale)*r.height/v.H};', [ix, iy])


def drag(p, a, b):
    s0, s1 = canvas_at(p, *a), canvas_at(p, *b)
    p.mouse.move(s0['x'], s0['y']); p.mouse.down(); p.mouse.move(s1['x'], s1['y'], steps=5); p.mouse.up(); p.wait_for_timeout(150)


def land(ctx, route, files, engine):
    """Open a landing page, choose files with its own picker, and follow it into the Studio."""
    p = ctx.new_page()
    p.on('pageerror', lambda e: errors.append(f'{engine} {route}: {e}'))
    p.goto(BASE + route, wait_until='domcontentloaded')
    p.wait_for_function('()=>document.documentElement.dataset.glReady==="1"', timeout=30000)
    with p.expect_navigation(url=re.compile(r'/game/studio/\?ws='), timeout=30000):
        p.set_input_files('#glFiles', [str(f) for f in files])
    p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"', timeout=60000)
    p.wait_for_function('()=>window.nerulioStudio.doc.assets.length>0', timeout=60000); p.wait_for_timeout(300)
    return p


def apply_sheet(p, n):
    p.wait_for_selector('[data-sp="plan-count"]', timeout=60000)
    p.click('[data-sp="import-apply"]')
    p.wait_for_function('(n)=>window.nerulioStudio.doc.assets[0].frames.length===n', arg=n, timeout=30000); p.wait_for_timeout(200)


def to_pack_export(p, target):
    if js(p, 'return S.workspace;') != 'pack':
        p.click('.st-ws-tab[data-ws="pack"]')
    p.wait_for_selector('[data-pack="efficiency"]', state='attached', timeout=120000)
    p.wait_for_function('()=>!document.querySelector("[data-action=pack-cancel]")', timeout=120000)
    p.wait_for_function('(t)=>{const b=document.querySelector(`[data-export="${t}"]`);return b&&!b.disabled}', arg=target, timeout=120000)
    with p.expect_download(timeout=120000) as d:
        p.click(f'[data-export="{target}"]')
    return zipfile.ZipFile(io.BytesIO(Path(d.value.path()).read_bytes()))


def tile_apply(p):
    p.wait_for_selector('[data-grid-sug="0"]', timeout=60000)
    p.click('[data-action="tile-apply-grid"]'); p.wait_for_selector('[data-cand]', timeout=60000)
    p.locator('[data-cand]').first.click(); p.click('[data-action="tile-apply-preview"]')
    p.wait_for_selector('[data-verdict="complete"]', timeout=60000)


def point_in_poly(x, y, poly):
    inside = False; n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


# ======================================================================= part 1: the pages (Chromium)
def part1(browser):
    E = 'chromium'
    status, root_html = get('/en/game/')
    site = re.search(r'<meta name="site-url" content="([^"]*)"', root_html).group(1)
    titles = {}
    for key, v in ALL + [('game', {'path': 'game', 'ws': 'sprite', 'classic': False, 'promote': True})]:
        for loc in ['ko', 'en', 'ja']:
            st, h = get(f'/{loc}/{v["path"]}/')
            ok('every game page answers 200 in ko/en/ja with its language', st == 200 and f'<html lang="{loc}">' in h, key + loc)
            ok('game pages are indexable exactly when their tool is qualified (mayPromote)', ('noindex' in h) == (not v['promote']), f'{loc}/{key}')
            if key in PAGES['intents'] or v.get('studio'):ok('game pages are indexable: every Studio landing is promoted', v['promote'], key)
            title = re.search(r'<title>([^<]+)</title>', h).group(1)
            ok('each game page has one H1 and a title no other page in its language has', h.count('<h1') == 1 and (loc, title) not in titles, f'{loc}/{key} {title}')
            titles[(loc, title)] = key
            ok('each game page has a description of useful length', 40 <= len(re.search(r'<meta name="description" content="([^"]+)"', h).group(1)) <= 300, key)
            lds = [json.loads(m) for m in re.findall(r'<script data-site-seo type="application/ld\+json">(.*?)</script>', h)]
            app = next((x for x in lds if x.get('@type') == 'SoftwareApplication'), None)
            lab = v.get('lab') or (key in PAGES['keywords'] and not v.get('studio'))
            ok('SoftwareApplication JSON-LD: DeveloperApplication, Web, free offer, a feature list naming verified engines',
               app and app['applicationCategory'] == 'DeveloperApplication' and app['operatingSystem'] == 'Web' and app['offers']['price'] == '0' and len(app['featureList']) >= 5 and (lab or any('Godot' in f for f in app['featureList'])), key)
            if lab:
                ok("a Lab page's feature list names how each output was checked and claims no engine run", any(re.search(r': (Measured|측정 확인|測定確認)', f) for f in app['featureList']) and not any(re.search(r': (Verified|검증됨|検証済み)', f) for f in app['featureList']), key)
            if v.get('lab') or (key in PAGES['keywords'] and not v.get('studio')):
                ok('a Lab page\'s primary action opens its Lab (<route>/app/ or the classic Lab) and the header still links the Studio', 'data-gl-drop' in h and re.search(r'data-target="lab" data-href="(?:\w\w/)?[\w/-]+/(app|classic)/"', h) and 'data-studio-link' in h, key)
            else:
                ok('the primary action opens the Studio (link to /game/studio/ in the drop zone and the header)', 'data-gl-drop' in h and 'href="' in h and re.search(r'href="(?:\w\w/)?game/studio/\?ws=(sprite|pack|tile|texture|pixel)"', h) and 'data-studio-link' in h, key)
            ok('the page shows a real screenshot of the Studio or its Lab (WebP, with its size and alt text)', re.search(r'<img src="assets/studio/[\w-]+\.webp" width="1440" height="900" alt="[^"]{20,}"', h), key)
            ok('engine badges carry their verification label', h.count('class="gl-badge') >= (2 if lab else 3 if v.get('ws') == 'normalmap' else 4) and (lab or 'Godot' in h), key)
            if key != 'game':
                ok('a classic-tool link appears exactly where the Studio does not cover something yet', ('data-gl-classic' in h) == bool(v.get('classic')), key)
            if site:
                can = re.search(r'<link data-site-seo rel="canonical" href="([^"]+)"', h).group(1)
                ok('canonical is the page itself in its language', can == f'{site}{loc}/{v["path"]}/', f'{can}')
                alts = dict(re.findall(r'hreflang="([\w-]+)" href="([^"]+)"', h))
                ok('hreflang: ko, en, ja and x-default (the English page), reciprocal', alts.get('ko') == f'{site}ko/{v["path"]}/' and alts.get('ja') == f'{site}ja/{v["path"]}/' and alts.get('en') == f'{site}en/{v["path"]}/' and alts.get('x-default') == f'{site}en/{v["path"]}/', key)
                crumbs = next((x for x in lds if x.get('@type') == 'BreadcrumbList'), None)
                ok('BreadcrumbList: Nerulio › Game studio › page', crumbs and crumbs['itemListElement'][1]['item'] == f'{site}{loc}/game/' and len(crumbs['itemListElement']) == (2 if key == 'game' else 3), key)
                img = re.search(r'<meta data-site-seo property="og:image" content="([^"]+)"', h).group(1)
                sc, _ = get('/' + img[len(site):])
                ok('the social card exists (1200×630 PNG per page and language)', sc == 200 and Image.open(ROOT / img[len(site):]).size == (1200, 630), img)
    if site:
        st, robots = get('/robots.txt')
        ok('robots.txt lists only the sitemap index', robots.count('Sitemap:') == 1 and f'Sitemap: {site}sitemap.xml' in robots, robots)
        st, index = get('/sitemap.xml')
        ok('sitemap.xml is an index of the game, tools and images sitemaps', '<sitemapindex' in index and all(f'<loc>{site}sitemap-{k}.xml</loc>' in index for k in ['game', 'tools', 'images']), index[:300])
        st, xml = get('/sitemap-game.xml')
        order = [u[len(site):] for u in re.findall(r'<loc>([^<]+)</loc>', xml)]
        want = {f'{loc}/{v["path"]}/' for _, v in ALL for loc in ['ko', 'en', 'ja']} | {f'{loc}/game/' for loc in ['ko', 'en', 'ja']}
        ok('sitemap-game.xml: home, the hub and every game page in ko/en/ja, each with a lastmod; no file tool', order[:3] == ['ko/', 'en/', 'ja/'] and want <= set(order) and xml.count('<lastmod>') == xml.count('<url>') and not any(re.search(r'/(image|pdf|video)/', u) for u in order), f'{len(want - set(order))} missing')
        st, tools = get('/sitemap-tools.xml')
        ok('sitemap-tools.xml lists the file tools', f'<loc>{site}en/image/compress/</loc>' in tools and f'<loc>{site}en/pdf/split/</loc>' in tools)
        st, img = get('/sitemap-images.xml')
        ok('image sitemap lists the Studio and Lab screenshots on the game pages', all(f'assets/studio/{s}.webp' in img for s in ['sprite-sheet', 'sprite-frame', 'pack', 'tile-check', 'tile-map', 'pixel-lab', 'texture-lab', 'ui-lab', 'tile-seams', 'tile-slice', 'sprite-lab']) and f'{site}ja/game/aseprite-to-godot/' in img)
    # ---------------------------------------------------------------- in the browser: layout and assets
    for width in [1440, 390]:
        ctx = browser.new_context(viewport={'width': width, 'height': 900 if width > 500 else 844}, locale='en-US')
        p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
        for key, v in ALL + [('game', {'path': 'game'})]:
            for loc in (['en', 'ko', 'ja'] if width == 390 else ['en']):
                p.goto(f'{BASE}/{loc}/{v["path"]}/', wait_until='load')
                p.wait_for_function('()=>document.documentElement.dataset.glReady==="1"', timeout=20000)
                ok(f'no horizontal scroll at {width} px', p.evaluate('document.documentElement.scrollWidth<=innerWidth'), f'{loc}/{key}')
                if loc == 'en':
                    ok('the screenshot decodes in the browser', p.evaluate('(async()=>{const i=document.querySelector(".gl-shot img");i.loading="eager";await i.decode().catch(()=>{});return i.naturalWidth>0})()'), key)
        ctx.close()
    # ---------------------------------------------------------------- classic pages, old links, language menu
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, locale='en-US'); p = ctx.new_page()
    for key, v in PAGES['intents'].items():
        st, h = get(f'/en/{v["path"]}/classic/')
        ok('every Studio landing keeps its old Lab at <route>/classic/, noindex', st == 200 and 'data-classic-robots name="robots" content="noindex,follow"' in h and 'id="taskApp"' in h, key)
    p.goto(BASE + '/en/game/tile-lab/classic/', wait_until='load'); p.wait_for_function('()=>document.documentElement.dataset.taskReady==="1"', timeout=30000)
    ok('the classic Tile Lab still mounts and keeps its noindex after the page script ran', p.locator('meta[name=robots][content="noindex,follow"]').count() >= 1 and p.locator('#taskApp *').count() > 5)
    p.goto(BASE + '/en/game/tile-lab/?stage=rules', wait_until='load'); p.wait_for_url(re.compile(r'/game/tile-lab/classic/\?stage=rules'), timeout=20000)
    ok('an old Lab link with Lab settings in its query opens the classic Lab with them', True)
    p.goto(BASE + '/en/sprite-slicer/', wait_until='load'); p.wait_for_function('()=>document.documentElement.dataset.glReady==="1"')
    with p.expect_navigation(): p.select_option('#languageSelect', 'ja')
    ok('the language menu opens the same page in that language', p.url.endswith('/ja/sprite-slicer/') and p.locator('html').get_attribute('lang') == 'ja')
    ctx.close()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, locale='ko-KR'); p = ctx.new_page()
    p.goto(BASE + '/game/aseprite-to-godot/', wait_until='load'); p.wait_for_url(re.compile(r'/ko/game/aseprite-to-godot/'), timeout=20000)
    ok('the language-neutral URL sends a Korean browser to the Korean page', p.locator('html').get_attribute('lang') == 'ko')
    ctx.close()


# ======================================================================= part 2: Studio-backed intents, both engines
def part2(browser, E):
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True, locale='en-US')
    sheet = Image.open(SAMURAI).convert('RGBA')
    # sprite-slicer ---------------------------------------------------------------
    p = land(ctx, '/en/sprite-slicer/', [SAMURAI], E)
    ok('sprite-slicer: the chosen sheet arrives in the Studio Sprite workspace with its cut previewed, nothing applied', js(p, 'return S.workspace;') == 'sprite' and asset(p)['frames'] == [] and p.locator('[data-sp="plan-count"]').inner_text().startswith('60 frames'), engine=E)
    apply_sheet(p, 60); a = asset(p)
    ok('sprite-slicer: Apply cuts 60 frames of 48×48 in 10 row animations', len(a['frames']) == 60 and len(a['tags']) == 10 and all(f['sourceRect']['w'] == 48 and f['sourceRect']['h'] == 48 for f in a['frames']), engine=E)
    ok('sprite-slicer: every cut frame equals its cell of the source sheet, pixel for pixel',
       all(visible(frame_rgba(p, i)) == visible(sheet.crop((f['sourceRect']['x'], f['sourceRect']['y'], f['sourceRect']['x'] + 48, f['sourceRect']['y'] + 48))) for i, f in [(i, a['frames'][i]) for i in (0, 7, 33, 59)]), engine=E)
    # sprite-pivot-editor, hitbox-editor, collision-polygon-generator (same page, same sheet)
    p.locator('.sp-fh[data-i="1"]').click(); p.wait_for_timeout(150)
    p.keyboard.press('p'); pt = canvas_at(p, 24.3, 40.2); p.mouse.click(pt['x'], pt['y']); p.wait_for_timeout(150)
    f1 = asset(p)['frames'][1]
    ok('sprite-pivot-editor: a click with the pivot tool puts the pivot on the pixel (24, 40) of that frame only', abs(f1['pivotX'] * 48 - 24) < 1e-9 and abs(f1['pivotY'] * 48 - 40) < 1e-9 and asset(p)['frames'][2]['pivotY'] == 1, engine=E)
    p.keyboard.press('b'); p.select_option('[data-sp="box-type"]', 'hit'); drag(p, (10, 10), (30, 40))
    boxes = asset(p)['frames'][1]['boxes']
    ok('hitbox-editor: a drag with the box tool makes a 20×30 hit box snapped to pixels', len(boxes) == 1 and boxes[0]['type'] == 'hit' and (boxes[0]['x'], boxes[0]['y'], boxes[0]['w'], boxes[0]['h']) == (10, 10, 20, 30), str(boxes), engine=E)
    p.fill('[data-sp="max-vertices"]', '8'); p.press('[data-sp="max-vertices"]', 'Enter')
    p.select_option('[data-sp="scope"]', 'frame'); p.click('[data-sp="auto-collision"]'); p.wait_for_timeout(800)
    col = asset(p)['frames'][1]['collision']
    ok('collision-polygon-generator: Auto from alpha makes a polygon of at most 8 vertices for the frame', len(col) >= 1 and all(3 <= len(poly) <= 8 for poly in col), str(col)[:200], engine=E)
    p.fill('[data-sp="max-vertices"]', '24'); p.press('[data-sp="max-vertices"]', 'Enter'); p.click('[data-sp="auto-collision"]'); p.wait_for_timeout(800)
    col = asset(p)['frames'][1]['collision']
    img = frame_rgba(p, 1); px = img.load(); opaque = [(x, y) for y in range(48) for x in range(48) if px[x, y][3] > 127]
    covered = sum(1 for (x, y) in opaque if any(point_in_poly(x + .5, y + .5, poly) for poly in col))
    ok('collision-polygon-generator: with 24 vertices the polygon stays inside the frame and covers at least 95% of its opaque pixels',
       all(0 <= x <= 48 and 0 <= y <= 48 for poly in col for x, y in poly) and covered >= .95 * len(opaque), f'{covered}/{len(opaque)}', engine=E)
    z = to_pack_export(p, 'aseprite-json'); data = json.loads(z.read(next(n for n in z.namelist() if n.endswith('.json'))))
    slices = data['meta'].get('slices', [])
    ok('sprite-pivot-editor: the pivot is exported (Aseprite JSON slice pivot 24, 40 on frame 1)', any(k.get('frame') == 1 and k.get('pivot') == {'x': 24, 'y': 40} for s in slices for k in s.get('keys', [])), json.dumps(slices)[:300], engine=E)
    ok('hitbox-editor: the box is exported with the drawn bounds (Aseprite JSON slice 10, 10, 20×30 on frame 1)', any(k.get('frame') == 1 and k.get('bounds') == {'x': 10, 'y': 10, 'w': 20, 'h': 30} for s in slices for k in s.get('keys', [])), json.dumps(slices)[:300], engine=E)
    p.close()
    # sprite-lab (.aseprite) ---------------------------------------------------------
    p = land(ctx, '/en/game/sprite-lab/', [ASE], E); a = asset(p)
    ok('sprite-lab: the .aseprite file opens in the Sprite workspace with its 4 frames and its tags', js(p, 'return S.workspace;') == 'sprite' and len(a['frames']) == 4 and len(a['tags']) >= 1, engine=E)
    ref = zlib.decompress((FX / 'aseprite' / 'indexed-features.f0.rgba.z').read_bytes())
    f0 = frame_rgba(p, 0)
    ok('sprite-lab: frame 1 equals Aseprite\'s own render of the file, pixel for pixel', visible(f0) == visible(Image.frombytes('RGBA', f0.size, ref)), engine=E)
    p.close()
    # sprite-animation-preview (GIF) ------------------------------------------------
    p = land(ctx, '/en/game/sprite-animation-preview/', [GIF], E); a = asset(p)
    ok('sprite-animation-preview: the GIF opens as 6 frames in one animation', js(p, 'return S.workspace;') == 'sprite' and len(a['frames']) == 6, engine=E)
    g = Image.open(GIF); delays = []; frames = []
    for i in range(g.n_frames):
        g.seek(i); delays.append(g.info.get('duration')); frames.append(g.convert('RGBA'))
    ok('sprite-animation-preview: each frame keeps the GIF delay as its duration and equals Pillow\'s decode of that frame',
       [f['duration'] for f in a['frames']] == delays and all(visible(frame_rgba(p, i)) == visible(frames[i]) for i in (0, 3, 5)), str([f['duration'] for f in a['frames']]), engine=E)
    p.locator('.sp-fh[data-i="0"]').click(); p.locator('.st-canvas-host .cv-stage').focus(); p.keyboard.press('Enter')
    try:
        p.wait_for_function('()=>Number(document.querySelector(".sp-fh.is-cur")?.dataset.i)>0', timeout=3000)
    except Exception:
        pass
    cur = int(p.locator('.sp-fh.is-cur').get_attribute('data-i')); p.keyboard.press('Enter')
    ok('sprite-animation-preview: Enter plays the animation (the current frame advances)', cur > 0, str(cur), engine=E)
    p.close()
    # frame-normalize (numbered frames) ----------------------------------------------
    p = land(ctx, '/en/normalize-sprite-frames/', NINJA, E); a = asset(p)
    ok('frame-normalize: 6 numbered frame files become one animation of 6 frames', js(p, 'return S.workspace;') == 'sprite' and len(a['frames']) == 6 and len(a['tags']) == 1, engine=E)
    before = [Image.open(f).convert('RGBA') for f in NINJA]
    p.locator('.sp-fh[data-i="0"]').click(); p.select_option('[data-sp="scope"]', 'all'); p.click('[data-sp="align-apply"]'); p.wait_for_timeout(600)
    a = asset(p)
    ok('frame-normalize: Align frames puts all 6 on one canvas size', len({(f['canvasWidth'], f['canvasHeight']) for f in a['frames']}) == 1 and all(f['trimmedRect'] for f in a['frames']), engine=E)
    def art(im):
        bb = im.getbbox(); return visible(im.crop(bb)) if bb else b''
    ok('frame-normalize: aligned frames keep every source pixel (whole-pixel moves, nothing resampled)', all(art(frame_rgba(p, i)) == art(before[i]) for i in range(6)), engine=E)
    p.close()
    # sprite-sheet-maker (frames → Pack & Export) --------------------------------------
    p = land(ctx, '/en/sprite-sheet-maker/', NINJA, E)
    p.wait_for_function('()=>window.nerulioStudio.workspace==="pack"', timeout=30000)
    p.wait_for_selector('[data-pack="totals"]', timeout=60000)
    ok('sprite-sheet-maker: frame files arrive as one animation and open straight in Pack & Export, packed on one page', p.locator('[data-pack="totals"]').inner_text().startswith('6 frames') and '1 page' in p.locator('[data-pack="totals"]').inner_text(), p.locator('[data-pack="totals"]').inner_text(), engine=E)
    z = to_pack_export(p, 'phaser'); names = z.namelist()
    atlas = json.loads(z.read(next(n for n in names if n.endswith('.json') and 'anims' not in n)))
    page = Image.open(io.BytesIO(z.read(next(n for n in names if n.endswith('.png'))))).convert('RGBA')
    restored = []
    for name, fr in atlas['frames'].items():
        f, ss, src = fr['frame'], fr['spriteSourceSize'], fr['sourceSize']
        c = Image.new('RGBA', (src['w'], src['h'])); c.paste(page.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])), (ss['x'], ss['y'])); restored.append(visible(c))
    ok('sprite-sheet-maker: the Phaser atlas gives back every source frame pixel for pixel', sorted(restored) == sorted(visible(im) for im in before), engine=E)
    p.close()
    # tile-lab / autotile-tester / tileset-slicer ---------------------------------------
    p = land(ctx, '/en/game/tile-lab/', [CAVE], E)
    ok('tile-lab: the sheet opens in the Tile workspace with a 64×64 grid suggestion naming GameMaker 47', js(p, 'return S.workspace;') == 'tile' and p.locator('[data-grid-sug="0"]').inner_text().startswith('64×64') and 'GameMaker' in p.locator('[data-grid-sug="0"]').inner_text(), engine=E)
    tile_apply(p)
    ts = js(p, 'const s=S.doc.settings.tile||{};return Object.values(s.tilesets||{}).find(t=>t.assetId===S.activeAssetId);')
    ok('tile-lab: the GameMaker-47 layout gives all 47 tiles their bits and the check says Complete after measuring the art', len(ts['tiles']) == 47 and p.locator('[data-check="art-ok"]').count() == 1, engine=E)
    p.locator('[data-tile-panel="tile-export"]').scroll_into_view_if_needed()
    with p.expect_download(timeout=60000) as d: p.click('[data-action="tile-export"]')
    z = zipfile.ZipFile(io.BytesIO(Path(d.value.path()).read_bytes())); names = z.namelist()
    gj = json.loads(z.read(next(n for n in names if n.startswith('godot/') and n.endswith('nerulio-tileset.json'))))
    ok('tile-lab: the Godot export holds the import script and a tileset of 47 tiles with terrain bits', any(n.endswith('nerulio_tileset_import.gd') for n in names) and len(gj['tileSet']['tiles']) == 47 and sum(1 for t in gj['tileSet']['tiles'] if t['peering']) >= 46 and gj['tileSet']['tileSize'] == {'w': 64, 'h': 64}, str(names[:6]), engine=E)
    p.click('[data-action="tile-new-map"]'); p.wait_for_function('()=>document.querySelector(".studio").dataset.tileMode==="map"', timeout=15000)
    ok('autotile-tester: a new test map is painted with the Godot rule', js(p, 'return Object.values(S.doc.settings.tile.maps)[0].layers[0].cells.replace(/\\./g,"").length;') > 100, engine=E)
    p.wait_for_selector('[data-verdict="map-ok"]', timeout=15000)
    ok('autotile-tester: every painted cell gets a correct tile under the Godot rule (no hole, no substitute)', p.locator('[data-verdict="map-ok"]').count() == 1, engine=E)
    p.close()
    p = land(ctx, '/en/game/autotile-tester/', [CAVE], E)
    ok('autotile-tester: the landing hands the sheet to the Tile workspace', js(p, 'return S.workspace;') == 'tile', engine=E)
    p.close()
    p = land(ctx, '/en/game/tileset-slicer/', [DUNGEON], E)
    p.wait_for_selector('[data-grid-sug="0"]', timeout=60000); sug = p.locator('[data-grid-sug="0"]').inner_text()
    ok('tileset-slicer: the first grid candidate for the Kenney tilemap is 16×16 with a 1 px gap', js(p, 'return S.workspace;') == 'tile' and sug.startswith('16×16') and re.search(r'gap 1|spacing 1', sug, re.I), sug, engine=E)
    p.click('[data-action="tile-apply-grid"]'); p.wait_for_timeout(800)
    ts = js(p, 'const s=S.doc.settings.tile||{};return Object.values(s.tilesets||{}).find(t=>t.assetId===S.activeAssetId);')
    ok('tileset-slicer: Use this grid gives 12×11 tiles of 16 px with spacing 1', ts and ts['grid']['w'] == 16 and ts['grid']['sx'] == 1 and ts['grid']['cols'] == 12 and ts['grid']['rows'] == 11, str(ts and ts['grid']), engine=E)
    p.close()
    ctx.close()


# ======================================================================= part 3: keyword pages (Chromium)
def part3(browser):
    E = 'chromium'
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True, locale='en-US')
    for key, v in PAGES['keywords'].items():
        if not v.get('studio'):
            continue  # Lab keyword pages: their Lab flow is covered in parts 4–6 through the landing
        files = files_for(key, v)
        p = land(ctx, f'/en/{key}/', files, E)
        # A page whose files go through another workspace first (via) lands there; a pack page lands
        # in Pack & Export once its frames exist; every other page lands in its own workspace.
        want = v['via'] or {'sprite': 'sprite', 'tile': 'tile', 'pack': 'pack', 'normalmap': 'texture', 'pixelart': 'pixel'}[v['ws']]
        if want == 'pack':
            p.wait_for_function('()=>window.nerulioStudio.workspace==="pack"', timeout=30000)
        ok('every game keyword page hands its file to the Studio workspace it names', js(p, 'return S.workspace;') == want, key, engine=E)
        p.close()
    ctx.close()


def files_for(key, v):
    """A committed CC0 file of the kind the page asks for."""
    if 'fnf' in key:
        return [TORCH_SHEET, GS / 'torch-sparrow.xml']
    if 'texturepacker' in key or 'atlas-viewer' in key:
        return [TORCH_SHEET, GS / 'torch-texturepacker.json']
    if 'aseprite-json' in key:
        return [TORCH_SHEET, TORCH_JSON]
    if 'aseprite' in key:
        return [ASE]
    if 'gif-to' in key:
        return [GIF]
    if v['ws'] == 'pixelart':
        return [PXF / ('gosoythoth_frame0.png' if 'ai-pixel' in key or 'snapper' in key else 'old_hero__nn_x7.png')]
    if v['ws'] == 'pack':
        return NINJA
    if v['ws'] == 'tile':
        return [CAVE]
    if v['ws'] == 'normalmap':
        return [TORCH_TEX]
    return [SAMURAI]



# ======================================================================= part 4: Lab landings, both engines
GS = FX / 'game-seo'
import importlib.util
_spec = importlib.util.spec_from_file_location('plab_fx', ROOT / 'tests' / 'pixel-lab-fixtures.py')
pfx = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(pfx)


def buf(name, data, mime='image/png'):
    return {'name': name, 'mimeType': mime, 'buffer': data}


def png_bytes(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()


def near(a, b):
    """UI Lab images go through a browser canvas. Firefox keeps canvas pixels premultiplied by alpha,
    so the straight colour of a semi-transparent pixel comes back within one premultiplied level
    (measured on the Kenney button in Firefox 155: blue 138 -> 134 at alpha 63, i.e. 34.09 -> 33.11
    once multiplied by alpha; 3 levels at alpha 79, 2 at alpha 111). Chromium returns the bytes.
    Every alpha value and every opaque pixel must match exactly; the colour under alpha 0 is not
    visible and a canvas does not keep it."""
    a, b = a.convert('RGBA'), b.convert('RGBA')
    if a.size != b.size:
        return False
    for x, y in zip(a.getdata(), b.getdata()):
        if x[3] != y[3]:
            return False
        if x[3] == 255 and x != y:
            return False
        if 0 < x[3] < 255 and max(abs(x[i] - y[i]) * x[3] / 255 for i in range(3)) > 1:
            return False
    return True


def diff_note(a, b):
    """Short description of how two images differ, for a failing check."""
    a, b = a.convert('RGBA'), b.convert('RGBA')
    if a.size != b.size:
        return f'size {a.size} != {b.size}'
    d = [(i % a.width, i // a.width, x, y) for i, (x, y) in enumerate(zip(a.getdata(), b.getdata())) if x != y]
    return f'{len(d)} pixels differ, first {d[:4]}'


def lab_open(ctx, route, files, ready_sel, engine):
    """Landing page → its own file picker → the Lab at <route>/app/ with the files."""
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(f'{engine} {route}: {e}'))
    p.goto(BASE + route, wait_until='domcontentloaded')
    p.wait_for_function('()=>document.documentElement.dataset.glReady==="1"', timeout=30000)
    with p.expect_navigation(url=re.compile(r'/(app|classic)/'), timeout=30000):
        p.set_input_files('#glFiles', files)
    p.wait_for_function('()=>document.documentElement.dataset.taskReady==="1"', timeout=60000)
    p.wait_for_selector(ready_sel, timeout=60000); p.wait_for_timeout(600)
    return p


def download(p, selector):
    with p.expect_download(timeout=120000) as d:
        p.locator(selector).first.click()
    return Path(d.value.path())


def task_ready(p):
    p.wait_for_function('()=>{const b=document.querySelector("#taskDownload");return b&&!b.disabled}', timeout=120000)


def plab_zip(p):
    z = zipfile.ZipFile(download(p, '[data-action="plab-export"]'))
    meta = json.loads(z.read('pixel-lab.json'))
    pal = {tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in meta['meta']['palette']}
    ims = [Image.open(io.BytesIO(z.read(n))).convert('RGBA') for n in sorted(x for x in z.namelist() if x.endswith('.png'))]
    union = set()
    for im in ims:
        union |= {px[:3] for px in im.getdata() if px[3] > 0}
    return z, meta, pal, union, ims


def part4(browser, E):
    ctx = browser.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True, locale='en-US')
    ninja = [str(f) for f in NINJA]
    # ---------------------------------------------------------------- Pixel Lab
    p = lab_open(ctx, '/en/game/pixel-lab/', ninja, '#plabCanvas', E)
    ok('pixel-lab: the 6 CC0 frames chosen on the landing open in the Pixel Lab, one palette for all', p.locator('.frame-chip').count() == 6 and 'colour' in p.locator('#plabSummary').inner_text(), engine=E)
    z, meta, pal, union, ims = plab_zip(p)
    ok('pixel-lab: the export holds one PNG per frame, a .gpl palette and the JSON, and every exported colour lies in the locked palette',
       len(ims) == 6 and any(n.endswith('.gpl') for n in z.namelist()) and union <= pal, f'{len(union - pal)} outside', engine=E)
    p.close()
    p = lab_open(ctx, '/en/game/palette-extractor/', ninja, '#plabCanvas', E)
    ok('palette-extractor: the Lab opens at its Palette stage with every colour listed', p.locator('[data-action="plab-stage"][data-stage="palette"]').get_attribute('aria-current') == 'page' and p.locator('.plab-swatch').count() >= 2, engine=E)
    n0 = p.locator('.plab-swatch').count()
    p.locator('#plabBudget').fill('4'); p.wait_for_timeout(700)
    p.locator('[data-action="plab-merge"]').click(); p.wait_for_timeout(900)
    _, _, pal4, union4, _ = plab_zip(p)
    ok('palette-extractor: merging the rarest colours to a budget of 4 really exports at most 4 colours, all in the palette', len(union4) <= 4 and union4 <= pal4, f'{n0} → {len(union4)}', engine=E)
    p.close()
    p = lab_open(ctx, '/en/game/palette-swap-ramp/', [buf(n, b) for n, b in pfx.frames(4)], '#plabCanvas', E)
    ok('palette-swap-ramp: the Lab opens at its Recolour stage', p.locator('[data-action="plab-stage"][data-stage="recolor"]').get_attribute('aria-current') == 'page', engine=E)
    _, _, palA, _, before = plab_zip(p)
    p.locator('[data-action="plab-recolor"][data-value="status"]').click(); p.wait_for_timeout(400)
    p.locator('[data-action="plab-apply-recolor"]').click(); p.wait_for_timeout(700)
    _, _, palB, unionB, after = plab_zip(p)
    alpha_same = all([a.split()[3].tobytes() == b.split()[3].tobytes() for a, b in zip(before, after)])
    ok('palette-swap-ramp: a status recolour rewrites the palette (same number of slots), keeps every alpha pixel, and the frames stay inside the new palette',
       len(palB) == len(palA) and palB != palA and unionB <= palB and alpha_same, engine=E)
    p.close()
    p = lab_open(ctx, '/en/game/pixel-art-cleanup/', [buf(n, b) for n, b in pfx.frames(2)], '#plabCanvas', E)
    ok('pixel-art-cleanup: candidates are counted before anything changes', 'Stray pixels:' in p.locator('#plabCleanupOut').inner_text(), engine=E)
    p.locator('#plabAA').check(); p.wait_for_timeout(800)
    _, _, pal3, union3, ims3 = plab_zip(p)
    src = Image.open(io.BytesIO(pfx.frames(2)[0][1])).convert('RGBA')
    moved = sum(1 for a, b in zip(src.split()[3].point(lambda v: 255 if v else 0).getdata(), ims3[0].split()[3].point(lambda v: 255 if v else 0).getdata()) if a != b)
    ok('pixel-art-cleanup: the anti-alias remover puts every pixel in the palette and moves no silhouette pixel', union3 <= pal3 and moved == 0, f'moved {moved}', engine=E)
    p.close()
    up3 = pfx.upscaled(3)
    p = lab_open(ctx, '/en/game/pixel-perfect-checker/', [buf('up3.png', png_bytes(up3))], '#plabReport', E)
    ok('pixel-perfect-checker: a 3× nearest sprite is read as 3× with logical size 16×16', '3× · logical size 16×16' in p.locator('#plabReport').inner_text(), p.locator('#plabReport').inner_text()[:120], engine=E)
    with p.expect_download(timeout=60000) as d:
        p.locator('[data-action="plab-recover"]').click(); p.wait_for_timeout(500); p.locator('[data-action="plab-export-one"]').click()
    rec = Image.open(d.value.path()).convert('RGBA')
    ok('pixel-perfect-checker: recovering the 1× source gives back the original sprite pixel for pixel', rec.size == (16, 16) and visible(rec) == visible(pfx.flat_sprite()), engine=E)
    p.close()
    # ---------------------------------------------------------------- Texture Lab
    maps = [str(GS / n) for n in ['bricks076c_color.png', 'bricks076c_roughness.png', 'bricks076c_ao.png', 'bricks076c_height.png']]
    p = lab_open(ctx, '/en/game/texture-lab/', maps, '#texFiles .file', E)
    p.wait_for_function('()=>document.querySelectorAll("#texFiles .file").length===4', timeout=60000)
    roles = p.locator('#texFiles select').evaluate_all('els=>els.map(e=>e.value)')
    ok('texture-lab: the four ambientCG maps are classified by filename into albedo, roughness, AO and height', sorted(roles) == sorted(['albedo', 'roughness', 'ao', 'height']), str(roles), engine=E)
    task_ready(p); report = json.loads(download(p, '#taskDownload').read_text(encoding='utf-8'))
    ok('texture-lab: the check report measures every map (128×128, exact PNG channels)', report['meta']['schemaVersion'] == 1 and len(report['textures']) == 4 and all(t.get('exactChannels') for t in report['textures']), engine=E)
    p.close()
    p = lab_open(ctx, '/en/game/pbr-texture-validator/', maps, '#texFiles .file', E)
    p.wait_for_function('()=>document.querySelectorAll("#texFiles .file").length===4', timeout=60000)
    issues = p.locator('.tex-issues').inner_text()
    ok('pbr-texture-validator: the set is checked slot by slot against the workflow', p.locator('.tex-slots li').count() >= 4, engine=E)
    ok('pbr-texture-validator: a missing normal map is reported with the set it belongs to', 'normal' in issues.lower(), issues[:200], engine=E)
    p.close()
    normal = Image.open(GS / 'bricks076c_normal.png').convert('RGBA')
    p = lab_open(ctx, '/en/game/channel-unpacker/', [str(GS / 'bricks076c_normal.png')], '.tex-channel canvas', E)
    p.wait_for_function('()=>document.querySelectorAll(".tex-channel canvas").length===4', timeout=60000)
    ok('channel-unpacker: the Lab opens at Channels with all four channels previewed', p.locator('.tex-channel').count() == 4, engine=E)
    task_ready(p); z = zipfile.ZipFile(download(p, '#taskDownload'))
    planes = {n.split('-')[-2]: Image.open(io.BytesIO(z.read(n))) for n in z.namelist()}
    ok('channel-unpacker: each channel PNG is byte-identical to that channel of the source', all(planes[c].tobytes() == normal.getchannel(i).tobytes() for i, c in enumerate('rgba')), engine=E)
    p.close()
    height = str(GS / 'bricks076c_height.png')
    p = lab_open(ctx, '/en/normal-map-generator/', [height], '#texNormalOut', E)
    ok('texture-map: the Lab opens at its Normal stage and names the convention it writes', p.locator('[data-action="tex-normal-set"][data-value="opengl"][aria-pressed="true"]').count() == 1, engine=E)
    task_ready(p); gl = Image.open(download(p, '#taskDownload')).convert('RGBA'); a = list(gl.getdata())
    lengths = [((r / 255 * 2 - 1) ** 2 + (g / 255 * 2 - 1) ** 2 + (bb / 255 * 2 - 1) ** 2) ** .5 for r, g, bb, _ in a]
    ok('texture-map: the normal map from the ambientCG height decodes to unit vectors (mean length within 2 %) with blue never below 128', gl.size == (128, 128) and abs(sum(lengths) / len(lengths) - 1) < .02 and min(px[2] for px in a) >= 128, f'{sum(lengths) / len(lengths):.4f}', engine=E)
    p.close()
    src_n = Image.open(GS / 'bricks076c_normal.png').convert('RGBA')
    p = lab_open(ctx, '/en/game/normal-map-converter/', [str(GS / 'bricks076c_normal.png')], '#texNormalOut', E)
    p.locator('[data-action="tex-normal-set"][data-key="mode"][data-value="convert"]').click(); p.wait_for_timeout(800)
    ok('normal-map-converter: the ambientCG OpenGL normal map opens in the Normal stage, convert mode', p.locator('[data-action="tex-normal-set"][data-key="mode"][data-value="convert"][aria-pressed="true"]').count() == 1, engine=E)
    task_ready(p); dx = Image.open(download(p, '#taskDownload')).convert('RGBA')
    a, b = list(src_n.getdata()), list(dx.getdata())
    ok('normal-map-converter: the converted map differs from the source in green (255 − g) and nowhere else', [(x[0], x[2], x[3]) for x in a] == [(y[0], y[2], y[3]) for y in b] and [255 - x[1] for x in a] == [y[1] for y in b], f'{sum(1 for x,y in zip(a,b) if 255-x[1]!=y[1])} green mismatches', engine=E)
    p.close()
    button = Image.open(GS / 'kenney-blue-button.png').convert('RGBA')
    p = lab_open(ctx, '/en/game/texture-edge-bleed/', [str(GS / 'kenney-blue-button.png')], '#texFixOut', E)
    ok('texture-edge-bleed: the Lab opens at its Fix stage', p.locator('[data-action="tex-stage"][data-stage="fix"][aria-selected="true"]').count() >= 1, engine=E)
    task_ready(p); bled = Image.open(download(p, '#taskDownload')).convert('RGBA')
    changed = [(x, y) for y in range(button.height) for x in range(button.width) if bled.getpixel((x, y)) != button.getpixel((x, y))]
    ok('texture-edge-bleed: on the Kenney button only fully transparent texels change and no alpha byte changes', bled.split()[3].tobytes() == button.split()[3].tobytes() and all(button.getpixel(c)[3] == 0 for c in changed) and len(changed) > 0, f'{len(changed)} changed', engine=E)
    p.close()
    greys = [str(GS / n) for n in ['bricks076c_ao.png', 'bricks076c_roughness.png', 'bricks076c_height.png']]
    p = lab_open(ctx, '/en/texture-mask-packer/', greys, '#maskPreviews canvas', E)
    p.wait_for_function('()=>document.querySelectorAll("#maskPreviews canvas").length===4', timeout=60000)
    ok('mask-packer: the three ambientCG grey maps arrive in the packer', p.locator('[data-channel="0"]').count() == 1, engine=E)
    for ch, value in enumerate(['input0', 'input1', 'input2', 'zero']):
        p.locator(f'[data-channel="{ch}"]').select_option(value)
    p.wait_for_timeout(500); task_ready(p)
    packed = Image.open(download(p, '#taskDownload')).convert('RGBA')
    srcs = [Image.open(f).convert('L') for f in greys]
    ok('mask-packer: each packed channel is byte-identical to the grey map mapped to it', all(packed.getchannel(i).tobytes() == srcs[i].tobytes() for i in range(3)) and set(packed.getchannel(3).getdata()) == {0}, engine=E)
    p.close()
    # ---------------------------------------------------------------- UI Lab
    panel = Image.open(GS / 'kenney-blue-panel.png').convert('RGBA')
    p = lab_open(ctx, '/en/game/9-slice-editor/', [str(GS / 'kenney-blue-panel.png')], '#nsCanvas', E)
    ok('9-slice-editor: the Kenney panel opens at the 9-Slice stage with border suggestions', p.locator('[data-action="ui-stage"][data-stage="slice"]').get_attribute('aria-selected') == 'true', engine=E)
    for side in ['left', 'right', 'top', 'bottom']:
        p.fill('#ns-' + side, '12')
    p.wait_for_timeout(300)
    z = zipfile.ZipFile(download(p, '[data-action="ui-export-slice"]'))
    src = Image.open(io.BytesIO(z.read('kenney-blue-panel.png' if 'kenney-blue-panel.png' in z.namelist() else [n for n in z.namelist() if n.endswith('.png') and '/' not in n][0]))).convert('RGBA')
    good = True
    for n in [x for x in z.namelist() if x.startswith('previews/')]:
        im = Image.open(io.BytesIO(z.read(n))).convert('RGBA'); W, H = im.size
        for d, s2 in [((0, 0, 12, 12), (0, 0, 12, 12)), ((W - 12, 0, W, 12), (52, 0, 64, 12)), ((0, H - 12, 12, H), (0, 52, 12, 64)), ((W - 12, H - 12, W, H), (52, 52, 64, 64))]:
            good = good and near(im.crop(d), panel.crop(s2))
    ok('9-slice-editor: every exported size keeps the four 12×12 corners of the Kenney panel (alpha and opaque pixels exact)', good and near(src, panel), engine=E)
    p.close()
    p = lab_open(ctx, '/en/game/button-state-generator/', [str(GS / 'kenney-blue-button.png')], '.ui-state canvas', E)
    ok('button-state-generator: five states of the Kenney button are previewed', p.locator('.ui-state').count() == 5, engine=E)
    z = zipfile.ZipFile(download(p, '[data-action="ui-export-states"]'))
    states = json.loads(z.read('states.json'))
    strip = Image.open(io.BytesIO(z.read([n for n in z.namelist() if n.endswith('-states.png')][0]))).convert('RGBA')
    normal_state = Image.open(io.BytesIO(z.read('states/normal.png'))).convert('RGBA')
    ok('button-state-generator: normal equals the source (alpha and opaque pixels exact) and every rect in states.json cuts its state from the strip',
       near(normal_state, button) and all(near(strip.crop((f['rect']['x'], f['rect']['y'], f['rect']['x'] + f['rect']['w'], f['rect']['y'] + f['rect']['h'])), Image.open(io.BytesIO(z.read(f'states/{k}.png')))) for k, f in states['frames'].items()), diff_note(normal_state, button), engine=E)
    p.close()
    sheet = Image.new('RGBA', (300, 90), (0, 0, 0, 0)); sheet.paste(button, (4, 4)); sheet.paste(panel, (220, 10))
    p = lab_open(ctx, '/en/game/ui-lab/', [buf('kenney-ui-sheet.png', png_bytes(sheet))], '#nsCanvas', E)
    p.locator('[data-action="ui-stage"][data-stage="atlas"]').click(); p.locator('.ui-element').first.wait_for(timeout=60000); p.wait_for_timeout(400)
    ok('ui-lab: the two Kenney elements on the sheet are detected as two elements', p.locator('.ui-element').count() == 2, str(p.locator('.ui-element').count()), engine=E)
    z = zipfile.ZipFile(download(p, '[data-action="ui-export-atlas"]'))
    atlas = Image.open(io.BytesIO(z.read('ui-atlas.png'))).convert('RGBA'); data = json.loads(z.read('ui-atlas.json'))
    pieces = sorted((atlas.crop((f['rect']['x'], f['rect']['y'], f['rect']['x'] + f['rect']['w'], f['rect']['y'] + f['rect']['h'])) for f in data['frames'].values()), key=lambda im: im.size)
    want = sorted([button.crop(button.getbbox()), panel.crop(panel.getbbox())], key=lambda im: im.size)
    ok('ui-lab: the packed atlas holds both elements (alpha and opaque pixels exact)', len(pieces) == 2 and all(near(a, b) for a, b in zip(pieces, want)), engine=E)
    p.close()
    p = lab_open(ctx, '/en/game/ui-scale-preview/', [str(GS / 'kenney-blue-panel.png')], '.ui-screen canvas', E)
    p.locator('[data-key="check.screen"][data-value="4k"]').click(); p.wait_for_timeout(300)
    p.select_option('[data-opt="check.anchor"]', 'top-left'); p.wait_for_timeout(300)
    p.select_option('[data-opt="check.safe"]', 'title-safe'); p.wait_for_timeout(300)
    summary = p.locator('#sizeSummary').inner_text()
    ok('ui-scale-preview: the Kenney panel is placed by its anchor on a simulated 4K screen', 'at 64, 64' in summary, summary[:160], engine=E)
    ok('ui-scale-preview: the 90 % title-safe area at 3840×2160 is 192, 108 · 3456×1944', '192, 108 · 3456' in summary, summary[:160], engine=E)
    p.close()
    glyphs = Image.new('RGBA', (32, 8), (0, 0, 0, 0))
    for i in range(4):
        for y in range(1, 7):
            for x in range(i * 8 + 1, i * 8 + 2 + i):
                glyphs.putpixel((x, y), (255, 255, 255, 255))
    p = lab_open(ctx, '/en/bitmap-font-maker/', [buf('glyphs.png', png_bytes(glyphs))], '#rc-chars', E)
    for field, value in [('#rc-cellW', '8'), ('#rc-cellH', '8'), ('#rc-baseline', '6'), ('#rc-chars', 'ABCD')]:
        p.locator(field).fill(value)
    p.wait_for_timeout(400)
    z = zipfile.ZipFile(download(p, '[data-action="ui-export-font"]'))
    fnt = z.read('font.fnt').decode('utf-8'); fjson = json.loads(z.read('font.json'))
    chars = [dict(kv.split('=', 1) for kv in line.split()[1:]) for line in fnt.splitlines() if line.startswith('char ')]
    ok('bitmap-font: the landing opens the Font stage and exports font.png, font.fnt and font.json', len(chars) == 4 and 'font.png' in z.namelist(), engine=E)
    ok('bitmap-font: every .fnt glyph record, read by a separate parser, equals the JSON', [(int(c['id']), int(c['x']), int(c['y']), int(c['width']), int(c['height'])) for c in chars] == [(g['codepoint'], g['x'], g['y'], g['w'], g['h']) for g in fjson['glyphs']], engine=E)
    p.close()
    fnt_text = ('info face="Test" size=8 bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=0,0\n'
                'common lineHeight=8 base=6 scaleW=64 scaleH=8 pages=1 packed=0\npage id=0 file="font.png"\nchars count=4\n'
                + '\n'.join(f'char id={ord(c)} x=0 y=0 width=4 height=8 xoffset=0 yoffset=0 xadvance=5 page=0 chnl=15' for c in 'Str가') + '\n')
    p = lab_open(ctx, '/en/game/missing-glyph-checker/', [str(GS / 'kenney-blue-panel.png')], '[data-key="check.source"]', E)
    p.locator('[data-action="ui-set"][data-key="check.source"][data-value="fnt"]').click(); p.wait_for_timeout(200)
    p.locator('#fntFile').set_input_files({'name': 'ui.fnt', 'mimeType': 'text/plain', 'buffer': fnt_text.encode()}); p.wait_for_timeout(300)
    p.locator('#localeFile').set_input_files({'name': 'ko.po', 'mimeType': 'text/plain', 'buffer': 'msgid "start"\nmsgstr "Start 시작"\n\nmsgid "quit"\nmsgstr "끝내기"\n'.encode()}); p.wait_for_timeout(600)
    rows = p.locator('.ui-table tbody tr')
    missing = {rows.nth(i).locator('td').first.inner_text(): rows.nth(i).locator('td').nth(2).inner_text() for i in range(rows.count())}
    ok('missing-glyph-checker: a .po file is compared with a .fnt', rows.count() > 0, engine=E)
    ok('missing-glyph-checker: exactly the characters the .fnt lacks are listed, with their counts', set(missing) == set('a시작끝내기') and missing['기'] == '1', json.dumps(missing, ensure_ascii=False), engine=E)
    p.close()
    # ---------------------------------------------------------------- Tile Lab routes
    ground = str(GS / 'ground054_color.png')
    p = lab_open(ctx, '/en/game/seamless-tile-checker/', [ground], '#tlSeamSummary', E)
    ok('seamless-tile-checker: the ambientCG ground texture is measured as one 128×128 tile', '128×128' in p.locator('#tlSeamInfo').inner_text(), engine=E)
    ok('seamless-tile-checker: a tileable ambientCG texture is reported without a visible seam', 'without a visible seam' in p.locator('#tlSeamSummary .summary-line').inner_text(), p.locator('#tlSeamSummary .summary-line').inner_text(), engine=E)
    p.close()
    crop = Image.open(GS / 'bricks076c_color.png').convert('RGBA').crop((0, 0, 96, 96))
    p = lab_open(ctx, '/en/game/seamless-tile-checker/', [buf('bricks-crop.png', png_bytes(crop))], '#tlSeamSummary', E)
    ok('seamless-tile-checker: a crop of the brick texture (not tileable) is reported as a seam', 'shows a seam' in p.locator('#tlSeamSummary .summary-line').inner_text(), engine=E)
    p.close()
    dungeon = Image.open(DUNGEON).convert('RGBA')
    for route, name in [('/en/tile-grid-slicer/', 'tile-helper'), ('/en/atlas-padding/', 'atlas-padding')]:
        p = lab_open(ctx, route, [str(DUNGEON)], '.tl-stages', E)
        top = p.locator('.tl-cand').first.inner_text().replace('×', 'x')
        ok('tile-helper: the Kenney tilemap arrives in the Tile Lab with 16×16 tiles and a 1 px gap measured first' if name == 'tile-helper' else
           'atlas-padding: the Kenney tilemap arrives in the Tile Lab with 16×16 tiles and a 1 px gap measured first', '16x16' in top and [p.locator(f'[data-option="{k}"]').input_value() for k in ['tileWidth', 'spacingX']] == ['16', '1'], top, engine=E)
        task_ready(p); z = zipfile.ZipFile(download(p, '#taskDownload')); meta = json.loads(z.read('metadata.json'))
        if name == 'tile-helper':
            f5 = meta['frames']['tile-005.png']['rect'] if 'tile-005.png' in meta['frames'] else next(iter(meta['frames'].values()))['rect']
            name5 = 'tile-005.png' if 'tile-005.png' in meta['frames'] else next(iter(meta['frames']))
            tile = Image.open(io.BytesIO(z.read('tiles/' + name5))).convert('RGBA')
            ok('tile-helper: a sliced tile is its exact region of the sheet, and every non-blank tile is written', tile.tobytes() == dungeon.crop((f5['x'], f5['y'], f5['x'] + 16, f5['y'] + 16)).tobytes() and len([n for n in z.namelist() if n.startswith('tiles/')]) + meta['tileSet'].get('skippedBlank', 0) == 132, engine=E)
        else:
            ok('atlas-padding: the Tile Lab opens with extrusion on and writes a padded atlas', 'padded-atlas.png' in z.namelist(), str(z.namelist()[:5]), engine=E)
        p.close()
    ctx.close()


# ======================================================================= part 5: keyword pages whose promise is a Lab flow, both engines
def part5(browser, E):
    ctx = browser.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True, locale='en-US')
    ninja = [str(f) for f in NINJA]
    pico8 = ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa']
    p = lab_open(ctx, '/en/game/lospec-palette/', ninja, '#plabCanvas', E)
    p.locator('[data-action="plab-stage"][data-stage="palette"]').click(); p.wait_for_selector('#plabPaletteText', state='attached', timeout=30000)
    p.locator('details[data-panel="io"]').evaluate('d=>d.open=true')
    p.fill('#plabPaletteText', ', '.join(c.upper() for c in pico8)); p.locator('[data-action="plab-import-text"]').click(); p.wait_for_timeout(1200)
    _, _, palL, unionL, imsL = plab_zip(p)
    want = {tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in pico8}
    ok('lospec-palette: a pasted Lospec HEX list (PICO-8, 16 colours) becomes the palette and every colour of the 6 exported frames is one of those 16',
       palL == want and unionL <= want and len(imsL) == 6, f'{len(palL)} colours, {len(unionL - want)} outside', engine=E)
    p.close()
    p = lab_open(ctx, '/en/game/pixel-art-upscaler/', [buf('sprite.png', png_bytes(pfx.flat_sprite()))], '#plabReport', E)
    with p.expect_download(timeout=60000) as d:
        p.locator('[data-action="plab-export-one"]').click()
    one = Image.open(d.value.path()).convert('RGBA')
    p.locator('#plabScale').fill('4'); p.locator('#plabScale').dispatch_event('change'); p.wait_for_timeout(900)
    with p.expect_download(timeout=60000) as d:
        p.locator('[data-action="plab-export-one"]').click()
    four = Image.open(d.value.path()).convert('RGBA')
    ok('pixel-art-upscaler: the 4× export is the 1× export with every pixel an exact 4×4 block (nearest, nothing new)',
       one.size == (16, 16) and four.size == (64, 64) and visible(four) == visible(one.resize((64, 64), Image.NEAREST)), f'{one.size} {four.size}', engine=E)
    p.close()
    rough = Image.open(GS / 'bricks076c_roughness.png')
    p = lab_open(ctx, '/en/game/roughness-to-smoothness/', [str(GS / 'bricks076c_roughness.png')], '.tex-channel canvas', E)
    inv = p.locator('[data-action="tex-channel-invert"]').first
    ch = inv.get_attribute('data-channel'); inv.click(); p.wait_for_timeout(800)
    with p.expect_download(timeout=60000) as d:
        p.locator(f'[data-action="tex-channel-save"][data-channel="{ch}"]').click()
    smooth = Image.open(d.value.path())
    src_plane = rough.convert('RGBA').getchannel('RGBA'.index(ch.upper()))
    ok('roughness-to-smoothness: the inverted channel saved from the roughness map is exactly 255 − roughness at every texel',
       smooth.size == src_plane.size and list(smooth.convert('L').getdata()) == [255 - v for v in src_plane.getdata()], f'channel {ch}, mode {smooth.mode}', engine=E)
    p.close()
    samurai = Image.open(SAMURAI).convert('RGBA')
    p = lab_open(ctx, '/en/game/sprite-sheet-to-png-frames/', [str(SAMURAI)], '.slicer-box', E)
    p.wait_for_function('()=>document.querySelectorAll(".slicer-box").length>1', timeout=60000); p.wait_for_timeout(800)
    rects = p.eval_on_selector_all('.slicer-box rect', 'ns=>ns.map(n=>["x","y","width","height"].map(k=>Math.round(+n.getAttribute(k))))')
    p.locator('[data-action="lab-stage"][data-stage="export"]').click(); p.wait_for_timeout(1000)
    p.locator('#optionsAdvanced').evaluate('d=>d.open=true')
    with p.expect_download(timeout=120000) as d:
        p.locator('[data-action="lab-frames-zip"]').click()
    z = zipfile.ZipFile(d.value.path()); pngs = [n for n in z.namelist() if n.endswith('.png')]
    got = sorted(visible(Image.open(io.BytesIO(z.read(n)))) for n in pngs)
    cut = sorted(visible(samurai.crop((x, y, x + w, y + h))) for x, y, w, h in rects)
    ok('sprite-sheet-to-png-frames: the classic Lab writes one PNG per outlined frame and each PNG is its outlined region of the sheet, pixel for pixel',
       len(pngs) == len(rects) > 1 and got == cut, f'{len(pngs)} PNGs, {len(rects)} boxes, {sum(1 for a, b in zip(got, cut) if a != b)} differ', engine=E)
    p.close()
    ctx.close()


# ======================================================================= part 6: the page families, a sample per family, both engines
def texture_ready(p):
    p.wait_for_function('()=>{const T=window.nerulioTexture;return T&&T.S.gen&&!T.S.busy}', timeout=60000); p.wait_for_timeout(200)


def normals_ok(p):
    """Every opaque pixel's decoded normal is a unit vector facing the viewer (blue ≥ 128)."""
    return js(p, '''const T=window.nerulioTexture,g=T.S.gen.normal,a=T.S.pic.rgba;let n=0,bad=0;
      for(let i=0;i<a.length;i+=4){if(a[i+3]<255)continue;n++;const x=g[i]/127.5-1,y=g[i+1]/127.5-1,z=g[i+2]/127.5-1,l=Math.hypot(x,y,z);if(g[i+2]<128||Math.abs(l-1)>0.03)bad++;}
      return {n,bad};''')


def part6(browser, E):
    """Page families (src/game-seo-families.js): one page per family is followed from its own file picker
    into the Studio, and the job it promises is measured on committed CC0 fixtures."""
    fam = {k: v for k, v in PAGES['keywords'].items() if v.get('family')}
    if not fam:
        return
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True, locale='en-US')
    sheet = Image.open(TORCH_SHEET).convert('RGBA')
    # broad: a PNG with its TexturePacker JSON ------------------------------------------------
    if 'game/sprite-atlas-viewer' in fam:
        p = land(ctx, '/en/game/sprite-atlas-viewer/', [TORCH_SHEET, GS / 'torch-texturepacker.json'], E); a = asset(p)
        ok('family broad (sprite-atlas-viewer): a sheet with its TexturePacker JSON opens as 6 frames grouped by name into one animation', js(p, 'return S.workspace;') == 'sprite' and len(a['frames']) == 6 and [t['name'] for t in a['tags']] == ['torch'], str([t['name'] for t in a['tags']]), engine=E)
        ok('family broad (sprite-atlas-viewer): every frame equals its rectangle of the sheet, pixel for pixel',
           all(visible(frame_rgba(p, i)) == visible(sheet.crop(((i % 3) * 32, (i // 3) * 32, (i % 3) * 32 + 32, (i // 3) * 32 + 32))) for i in range(6)), engine=E)
        p.close()
    # broad: a sprite straight into the Texture workspace --------------------------------------
    if 'game/sprite-normal-map' in fam:
        p = land(ctx, '/en/game/sprite-normal-map/', [TORCH_TEX], E); texture_ready(p)
        ok('family broad (sprite-normal-map): the sprite opens in the Texture workspace with a normal map generated at once', js(p, 'return S.workspace;') == 'texture', engine=E)
        r = normals_ok(p)
        ok('family broad (sprite-normal-map): every opaque pixel of the generated map decodes to a unit normal facing the viewer', r['n'] > 100 and r['bad'] == 0, str(r), engine=E)
        p.close()
    # engines: collision shapes from alpha, exported for Godot -----------------------------------
    if 'game/godot-tileset-collision' in fam:
        p = land(ctx, '/en/game/godot-tileset-collision/', [CAVE], E); tile_apply(p)
        # Select the tiles from (1,0) to (7,5) with the select tool (the panel acts for the first
        # selected tile, which must hold terrain bits; the cave sheet's tile 0,0 is blank).
        p.keyboard.press('v'); p.wait_for_timeout(100)
        drag(p, (1 * 64 + 32, 32), (7 * 64 + 32, 5 * 64 + 32)); p.wait_for_timeout(300)
        p.wait_for_selector('[data-action="tile-col-outline"]:not([disabled])', timeout=20000)
        p.click('[data-action="tile-col-outline"]')
        p.wait_for_function('()=>{const S=window.nerulioStudio,t=Object.values(S.doc.settings.tile.tilesets)[0];return Object.values(t.tiles).filter(x=>x.collision&&x.collision.length).length>=35}', timeout=60000)
        p.locator('[data-tile-panel="tile-export"]').scroll_into_view_if_needed()
        p.select_option('[data-tile="collision"]', 'edited')  # the Export panel's Collision (Godot): the traced shapes as they are
        with p.expect_download(timeout=60000) as d:
            p.click('[data-action="tile-export"]')
        z = zipfile.ZipFile(io.BytesIO(Path(d.value.path()).read_bytes()))
        tiles = json.loads(z.read('godot/nerulio-tileset.json'))['tileSet']['tiles']
        polys = [poly for t in tiles for poly in (t.get('collision') or [])]
        ok('family engines (godot-tileset-collision): Outline polygon traces a collision shape for the terrain tiles and the Godot export carries them inside each 64 px tile',
           len([t for t in tiles if t.get('collision')]) >= 35 and all(-0.01 <= c <= 64.01 for poly in polys for pt in poly for c in pt), f'{len(polys)} polygons', engine=E)
        p.close()
    # formats: an FNF-style Sparrow XML with trimmed frames, to GIF --------------------------------
    if 'game/fnf-spritesheet-to-gif' in fam:
        p = land(ctx, '/en/game/fnf-spritesheet-to-gif/', [TORCH_SHEET, GS / 'torch-sparrow.xml'], E); a = asset(p)
        ok('family formats (fnf-spritesheet-to-gif): SubTexture name prefixes become the animations ("torch flame", "torch dim"), trim offsets kept on a 32 px canvas',
           sorted(t['name'] for t in a['tags']) == ['torch dim', 'torch flame'] and all((f['canvasWidth'], f['canvasHeight']) == (32, 32) for f in a['frames']), str([t['name'] for t in a['tags']]), engine=E)
        ok('family formats (fnf-spritesheet-to-gif): each trimmed frame, placed back on its canvas, equals its 32 px cell of the sheet',
           all(visible(frame_rgba(p, i)) == visible(sheet.crop(((i % 3) * 32, (i // 3) * 32, (i % 3) * 32 + 32, (i // 3) * 32 + 32))) for i in range(6)), engine=E)
        z = to_pack_export(p, 'gif')
        gifs = [n for n in z.namelist() if n.endswith('.gif')]
        counts = sorted(Image.open(io.BytesIO(z.read(n))).n_frames for n in gifs)
        ok('family formats (fnf-spritesheet-to-gif): one animated GIF per animation, each with its 3 frames', len(gifs) == 2 and counts == [3, 3], str(gifs), engine=E)
        p.close()
    # formats: .aseprite opened without Aseprite ------------------------------------------------
    if 'game/aseprite-viewer' in fam:
        p = land(ctx, '/en/game/aseprite-viewer/', [ASE], E); a = asset(p)
        ok('family formats (aseprite-viewer): the .aseprite file opens with its 4 frames, per-frame durations 100/150/50/250 ms and 4 tags',
           len(a['frames']) == 4 and [f['duration'] for f in a['frames']] == [100, 150, 50, 250] and len(a['tags']) == 4, str([f['duration'] for f in a['frames']]), engine=E)
        p.close()
    # formats (via): a sheet cut in Sprite, then lit frame by frame in Texture ----------------------
    if 'game/normal-map-sprite-sheet' in fam:
        p = land(ctx, '/en/game/normal-map-sprite-sheet/', [TORCH_TEX], E)
        ok('family formats (normal-map-sprite-sheet): the sheet arrives in the Sprite workspace first, to be cut into frames', js(p, 'return S.workspace;') == 'sprite', engine=E)
        apply_sheet(p, 6); p.click('.st-ws-tab[data-ws="texture"]'); texture_ready(p)
        reg = js(p, 'const r=window.nerulioTexture.region();return [r.w,r.h];')
        ok('family formats (normal-map-sprite-sheet): in the Texture workspace each of the 6 frames is its own region (at most 32×32) with a generated map', js(p, 'return S.workspace;') == 'texture' and 0 < reg[0] <= 32 and 0 < reg[1] <= 32 and p.locator('.tx-frame').count() == 6 and normals_ok(p)['bad'] == 0, str(reg), engine=E)
        p.close()
    # fixes: the Phaser export never rotates a frame ------------------------------------------------
    if 'game/phaser-atlas-frames-wrong' in fam:
        p = land(ctx, '/en/game/phaser-atlas-frames-wrong/', NINJA, E)
        p.wait_for_function('()=>window.nerulioStudio.workspace==="pack"', timeout=30000)
        z = to_pack_export(p, 'phaser')
        atlas = json.loads(z.read(next(n for n in z.namelist() if n.endswith('.json') and 'anims' not in n)))
        frames = atlas['frames'] if isinstance(atlas['frames'], list) else list(atlas['frames'].values()) if 'frames' in atlas else [f for t in atlas.get('textures', []) for f in t['frames']]
        ok('family fixes (phaser-atlas-frames-wrong): the Phaser export writes every frame unrotated, with its trim offset', len(frames) == 6 and all(f.get('rotated') is False for f in frames) and all('spriteSourceSize' in f for f in frames), json.dumps(frames[0])[:200], engine=E)
        p.close()
    # compare: the same sprite in the Texture workspace, lit with the Godot model -----------------------
    if 'game/laigter-alternative' in fam:
        p = land(ctx, '/en/game/laigter-alternative/', [TORCH_TEX], E); texture_ready(p)
        ok('family compare (laigter-alternative): the sprite opens in the Texture workspace with a generated normal map and a light', js(p, 'return S.workspace;') == 'texture' and len(js(p, 'return window.nerulioTexture.entry().scene.lights;')) >= 1, engine=E)
        p.close()
    # engines, a Lab page: the classic Sprite Lab writes one PNG per frame (GDevelop takes frame images) -
    if 'game/gdevelop-sprite-sheet' in fam:
        p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(f'{E} gdevelop: {e}'))
        p.goto(BASE + '/en/game/gdevelop-sprite-sheet/'); p.wait_for_function('()=>document.documentElement.dataset.glReady==="1"', timeout=30000)
        with p.expect_navigation(url=re.compile(r'/classic/'), timeout=30000):
            p.set_input_files('#glFiles', [str(SAMURAI)])
        p.wait_for_function('()=>document.documentElement.dataset.taskReady==="1"', timeout=60000)
        p.wait_for_function('()=>document.querySelectorAll(".slicer-box").length===60', timeout=60000)
        ok('family engines (gdevelop-sprite-sheet): the sheet chosen on the page arrives in the classic Sprite Lab with its 60 frames outlined', True, engine=E)
        p.close()
    pixel_family(ctx, E)
    ctx.close()


def pxjs(p, body, arg=None):
    return p.evaluate('async(arg)=>{const S=window.nerulioStudio,W=window.__pixel;' + body + '}', arg)


def px_frame(p):
    """The current Pixel sprite's first frame (or its picture), composed the way the Pixel workspace shows it."""
    d = pxjs(p, '''const a=W.asset(),{rgbaGetter}=await import("/src/studio/sprite/frame-render.js"),{composeFrame,composeCanvas}=await import("/src/studio/sprite/frame-image.js");
      await W.commitChain();const f=a.frames[0],g=await rgbaGetter(S.images,a,f?[f]:[{id:"*"}]);const img=f?composeFrame(a,f,g):composeCanvas(a,{id:"*"},g);return {w:img.width,h:img.height,d:Array.from(img.data)};''')
    return Image.frombytes('RGBA', (d['w'], d['h']), bytes(d['d']))


def px_clean(p, states):
    p.wait_for_function('s=>s.includes(document.querySelector("[data-px=cleanup]").dataset.state)', arg=states, timeout=90000); p.wait_for_timeout(200)


def pixel_family(ctx, E):
    """Every Pixel workspace page: its own file picker, the Studio, and the promise measured."""
    fam = {k: v for k, v in PAGES['keywords'].items() if v.get('ws') == 'pixelart'}
    if not fam:
        return
    hero = Image.open(PXF / 'old_hero.png').convert('RGBA')
    if 'game/pixel-art-editor' in fam:
        p = land(ctx, '/en/game/pixel-art-editor/', [PXF / 'old_hero.png'], E)
        ok('family broad (pixel-art-editor): the PNG opens in the Pixel workspace as one 64×48 picture to paint on', js(p, 'return S.workspace;') == 'pixel' and pxjs(p, 'const a=W.asset();return [a.width,a.height];') == [64, 48], engine=E)
        pxjs(p, "W.setColor('fg',[255,0,255,255]);"); p.locator('.st-canvas-host .cv-stage').focus(); p.keyboard.press('b')
        n0 = js(p, 'return S.history.index;')
        a, b = canvas_at(p, 10.5, 40.5), canvas_at(p, 20.5, 40.5)
        p.mouse.move(a['x'], a['y']); p.mouse.down(); p.mouse.move(b['x'], b['y'], steps=6); p.mouse.up(); p.wait_for_timeout(300)
        got = px_frame(p)
        ok('family broad (pixel-art-editor): a pencil stroke paints the foreground colour along the drag and is one undo step',
           js(p, 'return S.history.index;') == n0 + 1 and got.getpixel((15, 40)) == (255, 0, 255, 255) and got.getpixel((15, 20)) == hero.getpixel((15, 20)), str(got.getpixel((15, 40))), engine=E)
        p.close()
    if 'game/pixel-art-downscaler' in fam:
        p = land(ctx, '/en/game/pixel-art-downscaler/', [PXF / 'old_hero__nn_x7.png'], E)
        p.click('[data-px="clean-measure"]'); px_clean(p, ['measured', 'error'])
        ok('family fixes (pixel-art-downscaler): Measure reads the x7 upscale as an exact x7 grid, sure, 64×48, and changes nothing',
           js(p, 'return S.workspace;') == 'pixel' and 'Upscaled ×7' in p.inner_text('[data-px="clean-verdict"]') and p.locator('[data-px="clean-verdict"] .st-conf.is-high').count() == 1 and '64×48' in p.inner_text('[data-px="clean-size"]') and js(p, 'return S.doc.assets.length;') == 1, p.inner_text('[data-px="clean-verdict"]'), engine=E)
        if p.locator('.px-clean-opts').get_attribute('open') is None:
            p.click('.px-clean-opts summary')
        p.select_option('[data-px="clean-background"]', 'keep')
        p.click('[data-px="clean-preview"]'); px_clean(p, ['done', 'error']); p.click('[data-px="clean-apply"]'); p.wait_for_timeout(1200)
        ok('family fixes (pixel-art-downscaler): Apply adds a new sprite equal to the original 64×48 art pixel for pixel; the upscale stays',
           js(p, 'return S.doc.assets.length;') == 2 and visible(px_frame(p)) == visible(hero), engine=E)
        p.close()
    if 'game/pixel-art-animation' in fam:
        frames = [PXF / f'ninja_run_{i}.png' for i in range(6)]
        p = land(ctx, '/en/game/pixel-art-animation/', frames, E)
        p.wait_for_function('()=>window.nerulioStudio.workspace==="pixel"', timeout=30000)
        a = asset(p)
        ok('family broad, via (pixel-art-animation): six frame files are imported through Sprite as one animation and the Pixel workspace opens on them',
           len(a['frames']) == 6 and len(a['tags']) == 1 and pxjs(p, 'return W.asset().frames.length;') == 6, engine=E)
        p.locator('.st-canvas-host .cv-stage').focus(); p.keyboard.press('F3'); p.wait_for_timeout(400)
        ok('family broad, via (pixel-art-animation): F3 turns on onion skin in the Pixel workspace', pxjs(p, 'return !!W.session.onion;'), engine=E)
        p.close()
    if 'game/pixel-art-palette-editor' in fam:
        frames = [PXF / f'ninja_run_{i}.png' for i in range(6)]
        p = land(ctx, '/en/game/pixel-art-palette-editor/', frames, E)
        before = px_frame(p)
        colours = set()
        for f in frames:
            raw = Image.open(f).convert('RGBA').tobytes()
            colours |= {raw[i:i + 3] for i in range(0, len(raw), 4) if raw[i + 3] > 0}
        js(p, "S.runCommand('pixel.colorMode')"); p.wait_for_selector('dialog [data-px="mode-palette"]')
        p.click('dialog .st-btn.primary'); p.wait_for_timeout(1200)
        mode = pxjs(p, 'const a=W.asset();return [a.colorMode,a.palette.colors.length,a.transparentIndex];')
        ok('family broad (pixel-art-palette-editor): Colour mode › Indexed from the exact colours makes an indexed sprite whose palette holds every colour plus the transparent index, and frame 1 keeps every pixel',
           mode[0] == 'indexed' and mode[1] == len(colours) + 1 and mode[2] == 0 and visible(px_frame(p)) == visible(before), str(mode), engine=E)
        p.close()
    if 'game/pixel-art-outline' in fam:
        p = land(ctx, '/en/game/pixel-art-outline/', [PXF / 'ninja_run_0.png'], E)
        p.keyboard.press('Control+Alt+c'); p.wait_for_selector('dialog.px-canvas'); p.click('dialog .st-btn.primary'); p.wait_for_timeout(700)
        src = px_frame(p)
        pxjs(p, "W.setColor('fg',[255,236,39,255]);"); js(p, "S.runCommand('pixel.outline')"); p.wait_for_timeout(600)
        out = px_frame(p)
        w, h = src.size; sp, op = src.load(), out.load()
        ring = {(x, y) for y in range(h) for x in range(w) if sp[x, y][3] == 0 and any(0 <= x + dx < w and 0 <= y + dy < h and sp[x + dx, y + dy][3] > 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
        changed = {(x, y) for y in range(h) for x in range(w) if op[x, y] != sp[x, y]}
        ok('family broad (pixel-art-outline): after Canvas size +1, Outline paints exactly the 4-connected ring outside the sprite in the foreground colour and leaves the art unchanged',
           (w, h) == (42, 31) and changed == ring and all(op[x, y] == (255, 236, 39, 255) for x, y in ring), f'{len(changed)} changed, {len(ring)} expected', engine=E)
        p.close()
    for key in ['game/pixel-snapper-alternative', 'game/fix-ai-pixel-art']:
        if key not in fam:
            continue
        p = land(ctx, f'/en/{key}/', [PXF / 'gosoythoth_frame0.png'], E)
        p.click('[data-px="clean-measure"]'); px_clean(p, ['measured', 'error'])
        ok(f'{fam[key].get("family") or "keyword"} ({key.split("/")[1]}): a generated image is measured as unsure — no sure grid, nothing applied',
           js(p, 'return S.workspace;') == 'pixel' and p.locator('[data-px="clean-verdict"] .st-conf.is-high').count() == 0 and pxjs(p, 'return W.cleanupUI.state().analysis.grid===null;') and js(p, 'return S.doc.assets.length;') == 1, p.inner_text('[data-px="clean-verdict"]'), engine=E)
        p.close()


with sync_playwright() as pw:
    if 'chromium' in BROWSERS:
        b = pw.chromium.launch()
        if '1' in PARTS: part1(b)
        if '3' in PARTS: part3(b)
        if '2' in PARTS: part2(b, 'chromium')
        if '4' in PARTS: part4(b, 'chromium')
        if '5' in PARTS: part5(b, 'chromium')
        if '6' in PARTS: part6(b, 'chromium')
        b.close()
    if 'firefox' in BROWSERS:
        b = pw.firefox.launch()
        if '2' in PARTS: part2(b, 'firefox')
        if '4' in PARTS: part4(b, 'firefox')
        if '5' in PARTS: part5(b, 'firefox')
        if '6' in PARTS: part6(b, 'firefox')
        b.close()
ok('no uncaught page errors', not errors, str(errors[:3]))
(OUT / 'game-landing-browser.json').write_text(json.dumps({'checks': results, 'errors': errors}, ensure_ascii=False, indent=1), encoding='utf-8')
print('PASS TOTAL', sum(len(v) for v in results.values()), 'checks,', len(results), 'distinct')
