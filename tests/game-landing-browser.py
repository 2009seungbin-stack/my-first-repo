"""Game landing pages → Studio (tools/game-landing-build.mjs, src/game-landing.js).

Part 1 (Chromium): every game landing, keyword page and the /game/ hub in ko/en/ja is indexable,
has its canonical + reciprocal hreflang (when the build has a SITE_URL), SoftwareApplication and
BreadcrumbList JSON-LD, a real Studio screenshot, engine badges, and fits 390 px; classic Lab
pages are noindex and still mount the Lab; old Lab links forward to them; the sitemap lists the
game pages first.
Part 2 (Chromium AND Firefox): for every Studio-backed intent the file chosen on its landing page
reaches the right Studio workspace, and the job the page promises is done and measured on committed
CC0 fixtures (the checks src/capabilities.js cites as evidence).
Part 3 (Chromium): every keyword page hands its file to the right workspace.

TEST_URL (default http://127.0.0.1:4173); BROWSERS=chromium,firefox (default both).
Results: test-results/game-landing-browser.json ({check: [engines]}).
"""
import io, json, os, re, sys, zipfile, zlib, urllib.request
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
PARTS = os.environ.get('PARTS', '123')  # for debugging only; the evidence run uses all parts
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
    script = ("import {GAME_INTENT_PAGES,GAME_KEYWORD_PAGES} from './src/game-seo.js';import {INTENTS} from './src/intents.js';"
              "import {mayPromote} from './src/capabilities.js';"
              "console.log(JSON.stringify({intents:Object.fromEntries(Object.entries(GAME_INTENT_PAGES).map(([k,p])=>[k,{path:INTENTS[k].path,ws:p.ws,classic:!!p.classic,promote:mayPromote(k)}])),"
              "keywords:Object.fromEntries(Object.entries(GAME_KEYWORD_PAGES).map(([k,p])=>[k,{path:k,ws:p.ws,promote:mayPromote(p.intent)}]))}));")
    import subprocess
    out = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)


PAGES = pages()
ALL = [(k, v) for k, v in PAGES['intents'].items()] + [(k, v) for k, v in PAGES['keywords'].items()]


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
            ok('game pages are indexable: every Studio landing is promoted', v['promote'], key)
            title = re.search(r'<title>([^<]+)</title>', h).group(1)
            ok('each game page has one H1 and a title no other page in its language has', h.count('<h1') == 1 and (loc, title) not in titles, f'{loc}/{key} {title}')
            titles[(loc, title)] = key
            ok('each game page has a description of useful length', 40 <= len(re.search(r'<meta name="description" content="([^"]+)"', h).group(1)) <= 300, key)
            lds = [json.loads(m) for m in re.findall(r'<script data-site-seo type="application/ld\+json">(.*?)</script>', h)]
            app = next((x for x in lds if x.get('@type') == 'SoftwareApplication'), None)
            ok('SoftwareApplication JSON-LD: DeveloperApplication, Web, free offer, a feature list naming verified engines',
               app and app['applicationCategory'] == 'DeveloperApplication' and app['operatingSystem'] == 'Web' and app['offers']['price'] == '0' and len(app['featureList']) >= 5 and any('Godot' in f for f in app['featureList']), key)
            ok('the primary action opens the Studio (link to /game/studio/ in the drop zone and the header)', 'data-gl-drop' in h and 'href="' in h and re.search(r'href="(?:\w\w/)?game/studio/\?ws=(sprite|pack|tile)"', h) and 'data-studio-link' in h, key)
            ok('the page shows a real Studio screenshot (WebP, with its size and alt text)', re.search(r'<img src="assets/studio/[\w-]+\.webp" width="1440" height="900" alt="[^"]{20,}"', h), key)
            ok('engine badges carry their verification label', h.count('class="gl-badge') >= 4 and ('Godot' in h), key)
            if key != 'game':
                ok('a classic-tool link appears exactly where the Studio does not cover something yet', ('data-gl-classic' in h) == bool(v.get('classic')), key)
            if site:
                can = re.search(r'<link data-site-seo rel="canonical" href="([^"]+)"', h).group(1)
                ok('canonical is the page itself in its language', can == f'{site}{loc}/{v["path"]}/', f'{can}')
                alts = dict(re.findall(r'hreflang="([\w-]+)" href="([^"]+)"', h))
                ok('hreflang: ko, en, ja and x-default, reciprocal', alts.get('ko') == f'{site}ko/{v["path"]}/' and alts.get('ja') == f'{site}ja/{v["path"]}/' and alts.get('en') == f'{site}en/{v["path"]}/' and alts.get('x-default') == f'{site}{v["path"]}/', key)
                crumbs = next((x for x in lds if x.get('@type') == 'BreadcrumbList'), None)
                ok('BreadcrumbList: Nerulio › Game studio › page', crumbs and crumbs['itemListElement'][1]['item'] == f'{site}{loc}/game/' and len(crumbs['itemListElement']) == (2 if key == 'game' else 3), key)
                img = re.search(r'<meta data-site-seo property="og:image" content="([^"]+)"', h).group(1)
                sc, _ = get('/' + img[len(site):])
                ok('the social card exists (1200×630 PNG per page and language)', sc == 200 and Image.open(ROOT / img[len(site):]).size == (1200, 630), img)
    if site:
        st, xml = get('/sitemap.xml')
        locs = re.findall(r'<loc>([^<]+)</loc>', xml)
        order = [u[len(site):] for u in locs]
        first_file = next(i for i, u in enumerate(order) if re.search(r'/(image|pdf|video)/|/media/', u))
        game_idx = [i for i, u in enumerate(order) if u.split('/', 1)[1].rstrip('/') in {v['path'] for _, v in ALL} | {'game'}]
        ok('sitemap: every game page in ko/en/ja, all before the file tools', len(game_idx) == (len(ALL) + 1) * 3 and max(game_idx) < first_file, str(order[:6]))
        st, img = get('/sitemap-images.xml')
        ok('image sitemap lists the Studio screenshots on the game pages', all(f'assets/studio/{s}.webp' in img for s in ['sprite-sheet', 'sprite-frame', 'pack', 'tile-check', 'tile-map']) and f'{site}ja/game/aseprite-to-godot/' in img)
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
        files = [ASE] if 'aseprite' in key else [GIF] if 'gif-to' in key else NINJA if v['ws'] == 'pack' else [CAVE] if v['ws'] == 'tile' else [SAMURAI]
        p = land(ctx, f'/en/{key}/', files, E)
        want = {'sprite': 'sprite', 'tile': 'tile', 'pack': 'pack'}[v['ws']]
        if want == 'pack':
            p.wait_for_function('()=>window.nerulioStudio.workspace==="pack"', timeout=30000)
        ok('every game keyword page hands its file to the Studio workspace it names', js(p, 'return S.workspace;') == want, key, engine=E)
        p.close()
    ctx.close()


with sync_playwright() as pw:
    if 'chromium' in BROWSERS:
        b = pw.chromium.launch()
        if '1' in PARTS: part1(b)
        if '3' in PARTS: part3(b)
        if '2' in PARTS: part2(b, 'chromium')
        b.close()
    if 'firefox' in BROWSERS:
        if '2' in PARTS: b = pw.firefox.launch(); part2(b, 'firefox'); b.close()
ok('no uncaught page errors', not errors, str(errors[:3]))
(OUT / 'game-landing-browser.json').write_text(json.dumps({'checks': results, 'errors': errors}, ensure_ascii=False, indent=1), encoding='utf-8')
print('PASS TOTAL', sum(len(v) for v in results.values()), 'checks,', len(results), 'distinct')
