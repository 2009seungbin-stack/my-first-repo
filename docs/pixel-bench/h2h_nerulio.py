"""Head-to-head, Nerulio column: the Job D edit tasks (H2H.md §4) done in the Studio's Pixel workspace
through its UI (Playwright, Chromium) on the same real CC0 asset as the Aseprite / Piskel / Lospec runs:
Sumo Hulk by Eris (OpenGameArt, CC0) — 96x144 sheet, its x4 nearest and x3.78 bilinear versions.

    PORT=4501 node tools/serve.mjs
    TEST_URL=http://127.0.0.1:4501 python docs/pixel-bench/h2h_nerulio.py [--online]

--online also makes the one real Lospec request (T13); without it Lospec is mocked like in the tests.
Writes <WORK>/nerulio-h2h/results.json (+ PNG / .aseprite outputs); WORK = $PIXEL_BENCH_WORK or
C:/Users/2009s/nerulio-handoff/scratch/p2/competitors. Scores use jobd/compare.py (same as Aseprite)."""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright
import numpy as np
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
WORK = os.environ.get('PIXEL_BENCH_WORK', 'C:/Users/2009s/nerulio-handoff/scratch/p2/competitors')
sys.path.insert(0, os.path.join(WORK, 'jobd'))
from compare import score
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4501').rstrip('/')
C = 'C:/Users/2009s/nerulio-asset-corpus'
TRUTH = C + '/pixel/oga-sumo-hulk/sumoHulk_spriteSheet.png'
X4 = C + '/pixel/oga-sumo-hulk/sumoHulk_spriteSheet_x4.png'
X378 = C + '/pixel/derived/sumoHulk_x3.78_bilinear.png'
PICO_GPL = C + '/palettes/lospec/pico-8.gpl'
ASE = os.environ.get('ASEPRITE', r'C:\Users\2009s\asebuild\b\bin\aseprite.exe')
OUT = os.path.join(WORK, 'nerulio-h2h'); os.makedirs(OUT, exist_ok=True)
ONLINE = '--online' in sys.argv
R = {}
def js(p, body, arg=None): return p.evaluate('async(arg)=>{const S=window.nerulioStudio,W=window.__pixel;' + body + '}', arg)
def settle(p, ms=200): p.wait_for_timeout(ms)
def scr(p, ix, iy): return js(p, 'const v=S.view,r=v.stage.getBoundingClientRect();return {x:r.left+(v.view.x+(arg[0]+.5)*v.view.scale)*r.width/v.W,y:r.top+(v.view.y+(arg[1]+.5)*v.view.scale)*r.height/v.H};', [ix, iy])
def drag(p, pts, button='left'):
    a = scr(p, *pts[0]); p.mouse.move(a['x'], a['y']); p.mouse.down(button=button)
    for q in pts[1:]:
        b = scr(p, *q); p.mouse.move(b['x'], b['y'], steps=4)
    p.mouse.up(button=button); js(p, 'await W.commitChain();'); settle(p, 80)
def hist(p): return js(p, 'return S.history.entries.slice(0,S.history.index).map(e=>e.label);')
def fresh(p):
    js(p, "S.runCommand('file.new')"); settle(p, 300)
    if p.locator('dialog .st-btn.primary').count(): p.click('dialog .st-btn.primary'); settle(p, 300)
def imp(p, path):
    n = js(p, 'return S.doc.assets.length;'); p.set_input_files('input[type=file][multiple]', path)
    p.wait_for_function('n=>window.nerulioStudio.doc.assets.length>n', arg=n, timeout=30000); settle(p, 600)
def export_png(p, name):
    with p.expect_download() as d: js(p, "S.runCommand('pixel.exportPNG')")
    path = os.path.join(OUT, name); d.value.save_as(path); return path
def clean(p, background=None):
    p.click('[data-px="clean-measure"]'); p.wait_for_function('()=>["measured","error"].includes(document.querySelector("[data-px=cleanup]").dataset.state)', timeout=120000)
    verdict = p.inner_text('[data-px="clean-verdict"]')
    if background:
        if p.locator('.px-clean-opts').get_attribute('open') is None: p.click('.px-clean-opts summary')
        p.select_option('[data-px="clean-background"]', background)
    p.click('[data-px="clean-preview"]'); p.wait_for_function('()=>["done","error"].includes(document.querySelector("[data-px=cleanup]").dataset.state)', timeout=120000)
    p.click('[data-px="clean-apply"]'); settle(p, 1200)
    return verdict
def rgb_counts(path):
    a = np.asarray(Image.open(path).convert('RGBA')); return a
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); p = ctx.new_page()
    errors = []; p.on('pageerror', lambda e: errors.append(str(e)))
    if not ONLINE:
        ctx.route('https://lospec.com/**', lambda r: r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps({'name': 'PICO-8', 'author': '', 'colors': ['%02x%02x%02x' % tuple(map(int, l.split()[:3])) for l in open(PICO_GPL) if l.strip() and l.strip()[0].isdigit()]})))
    p.goto(BASE + '/en/game/studio/?ws=pixel'); p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"'); settle(p, 400)
    # ---------------- T9: x4 nearest → 1x (no size typed)
    imp(p, X4); t = time.time(); v = clean(p); ms = round((time.time() - t) * 1000)
    o = export_png(p, 'T9_x4_to_1x.png')
    R['T9'] = dict(score(o, TRUTH), verdict=v, ms=ms, steps='import, Measure, Preview, Apply as new sprite, Export PNG (5); size found by the tool')
    # ---------------- T10: x3.78 bilinear → 1x (no size typed)
    fresh(p); imp(p, X378); t = time.time(); v = clean(p); ms = round((time.time() - t) * 1000)
    o = export_png(p, 'T10_x3.78_to_1x.png')
    R['T10'] = dict(score(o, TRUTH), verdict=v, ms=ms, steps='import, Measure, Preview, Apply, Export PNG (5); size and colours found by the tool')
    # ---------------- T5: RGB sheet → indexed PICO-8, no dither
    fresh(p); imp(p, TRUTH)
    # palette import through the UI: Palette ⋯ › Import palette… (file picker) › Replace
    with p.expect_file_chooser() as fc:
        p.click('[data-px="pal-menu"]'); settle(p); p.get_by_text('Import palette…').click()
    fc.value.set_files(PICO_GPL); p.wait_for_selector('dialog'); p.click('dialog .st-btn.primary'); settle(p, 600)
    js(p, "S.runCommand('pixel.colorMode')"); p.wait_for_selector('dialog [data-px="mode-palette"]')
    p.select_option('dialog [data-px="mode-palette"]', 'current'); p.click('dialog .st-btn.primary'); settle(p, 1200)
    o = export_png(p, 'T5_pico8_indexed.png')
    a = np.asarray(Image.open(TRUTH).convert('RGBA')).astype(int); q = np.asarray(Image.open(o).convert('RGBA')).astype(int)
    pico = np.array([[int(x) for x in l.split()[:3]] for l in open(PICO_GPL) if l.strip() and l.strip()[0].isdigit()])
    op = a[..., 3] >= 128; src = a[op][:, :3]; got = q[op][:, :3]
    near_rgb = pico[np.argmin(((src[:, None, :] - pico[None]) ** 2).sum(-1), axis=1)]
    oklab = js(p, '''const {oklab}=await import("/src/pixel-engine.js");return arg.map(c=>oklab(c[0],c[1],c[2]));''', [list(map(int, c)) for c in pico])
    lab = lambda arr: np.array(js(p, '''const {oklab}=await import("/src/pixel-engine.js");return arg.map(c=>oklab(c[0],c[1],c[2]));''', [list(map(int, c)) for c in arr]))
    uniq = np.unique(src, axis=0); ul = lab(uniq); pl = np.array(oklab)
    near_ok_u = pico[np.argmin(((ul[:, None, :] - pl[None]) ** 2).sum(-1), axis=1)]
    m = {tuple(u): tuple(n) for u, n in zip(uniq.tolist(), near_ok_u.tolist())}; near_ok = np.array([m[tuple(c)] for c in src.tolist()])
    R['T5'] = dict(opaque=int(op.sum()), nearest_rgb_pct=round(100 * float((got == near_rgb).all(1).mean()), 1), nearest_oklab_pct=round(100 * float((got == near_ok).all(1).mean()), 1),
                   black_kept=int(((src == 0).all(1) & (got == 0).all(1)).sum()), black_total=int((src == 0).all(1).sum()), alpha_same=bool(((q[..., 3] >= 128) == op).all()),
                   mode=js(p, 'const a=W.asset();return [a.colorMode,a.palette.colors.length,a.transparentIndex];'), steps='Palette ⋯ › Import palette… › file › Replace; Pixel › Colour mode… › Current palette › Convert (≈6)')
    # ---------------- T7: team colour #84d652 → red / blue / green on every frame (indexed: one palette edit)
    fresh(p); imp(p, TRUTH)
    js(p, "S.runCommand('pixel.colorMode')"); p.wait_for_selector('dialog [data-px="mode-palette"]'); p.click('dialog .st-btn.primary'); settle(p, 1200)
    i = js(p, 'return W.asset().palette.colors.findIndex(c=>c[0]===0x84&&c[1]===0xd6&&c[2]===0x52);')
    p.dblclick(f'.px-pal-sw[data-i="{i}"]'); p.wait_for_selector('[data-px="edit-hex"]'); p.fill('[data-px="edit-hex"]', '#d63a3a'); p.click('dialog .st-btn.primary'); settle(p, 1200)
    o = export_png(p, 'T7_team_red.png')
    a = np.asarray(Image.open(TRUTH).convert('RGBA')).astype(int); q = np.asarray(Image.open(o).convert('RGBA')).astype(int)
    team = (a[..., :3] == [0x84, 0xd6, 0x52]).all(-1) & (a[..., 3] >= 128)
    changed = (a != q).any(-1)
    R['T7'] = dict(team_px=int(team.sum()), recoloured=int(((q[..., :3] == [0xd6, 0x3a, 0x3a]).all(-1) & team).sum()), other_px_changed=int((changed & ~team).sum()), undo_steps=1,
                   steps='indexed sheet: double-click the palette entry, type the colour, OK (3); every frame and layer follows. RGB sprites: Pixel › Team-colour variants… makes red/blue/green sprites in one dialog')
    # ---------------- T8: outline + drop shadow on the whole sheet
    fresh(p); imp(p, TRUTH)
    js(p, "W.setColor('fg',[0,0,0,255]);W.setColor('bg',[40,20,60,255]);")
    before = np.asarray(Image.open(TRUTH).convert('RGBA')).astype(int)
    js(p, "S.runCommand('pixel.outline')"); settle(p, 800); o1 = export_png(p, 'T8_outline.png')
    js(p, "S.runCommand('pixel.shadow')"); settle(p, 800); o2 = export_png(p, 'T8_outline_shadow.png')
    q1 = np.asarray(Image.open(o1).convert('RGBA')).astype(int); q2 = np.asarray(Image.open(o2).convert('RGBA')).astype(int)
    R['T8'] = dict(outline_px=int(((q1[..., 3] >= 128) & (before[..., 3] < 128)).sum()), originals_unchanged=bool(((before[..., 3] >= 128) <= ((q1 == before).all(-1))).all()),
                   shadow_px=int(((q2[..., 3] >= 128) & (q1[..., 3] < 128)).sum()), size=list(q1.shape[1::-1]), undo=hist(p)[-2:],
                   steps='Pixel › Outline (1), Pixel › Drop shadow (1); canvas NOT grown (pixels at the sheet border get no outline outside the canvas)')
    # ---------------- T11: .aseprite with 2 layers, multiply at opacity 160, indexed
    fresh(p); imp(p, TRUTH)
    js(p, "S.runCommand('pixel.colorMode')"); p.wait_for_selector('dialog [data-px="mode-palette"]'); p.click('dialog .st-btn.primary'); settle(p, 1200)
    p.keyboard.press('Shift+n'); settle(p, 300)
    js(p, "S.view.zoomTo(4);S.view.reveal({x:0,y:0,w:96,h:144});"); settle(p, 200)
    js(p, "W.setColor('fg',[0x84,0xd6,0x52,255])"); p.keyboard.press('u'); js(p, "W.setPref('shapeFill',true)"); drag(p, [(2, 2), (40, 40)])
    p.select_option('[data-px="layer-blend"]', 'multiply'); settle(p, 300)
    p.eval_on_selector('[data-px="layer-opacity"]', 'e=>{e.value="160";e.dispatchEvent(new Event("change"))}'); settle(p, 300)
    with p.expect_download() as d: js(p, "S.runCommand('pixel.exportAseprite')")
    ase = os.path.join(OUT, 'T11_two_layers_indexed.aseprite'); d.value.save_as(ase)
    lua = os.path.join(OUT, 't11_verify.lua'); open(lua, 'w').write('''local s=app.activeSprite
local m={[ColorMode.RGB]="RGB",[ColorMode.INDEXED]="INDEXED"}
print("colorMode="..m[s.colorMode].." size="..s.width.."x"..s.height.." palette="..#s.palettes[1])
for i,l in ipairs(s.layers) do local b="?" for k,v in pairs(BlendMode) do if v==l.blendMode and (b=="?" or k=="NORMAL") then b=k end end print("layer "..i.." name="..l.name.." blend="..b.." opacity="..l.opacity) end''')
    ver = subprocess.run([ASE, '-b', ase, '--script', lua], capture_output=True, text=True, timeout=120).stdout.strip() if os.path.exists(ASE) else 'Aseprite not found'
    R['T11'] = dict(verify=ver, steps='Colour mode › Indexed, Shift+N, draw, Blend = Multiply, Opacity 160, Pixel › Export .aseprite (≈6)')
    # ---------------- T4 shading ink along a ramp, T3 custom axis, T1/T2 (behaviour checked in tests/studio-pixel-browser.py)
    fresh(p); js(p, "S.runCommand('pixel.newSprite')"); p.wait_for_selector('dialog [data-px="new-w"]'); p.click('dialog .st-btn.primary'); settle(p, 500)
    js(p, "S.view.zoomTo(12);S.view.reveal({x:0,y:0,w:32,h:32});"); settle(p, 200)
    ramp = js(p, 'const c=W.asset().palette.colors;return [c[1],c[2],c[3],c[4]];')
    js(p, "W.setColor('fg',arg)", ramp[1]); p.keyboard.press('u'); js(p, "W.setPref('shapeFill',true)"); drag(p, [(0, 0), (31, 10)])
    js(p, "W.S.rampSel=[1,2,3,4];W.setPref('ink','shading')"); p.keyboard.press('b'); drag(p, [(2, 5), (8, 5)])
    shade = js(p, 'await W.commitChain();return [...W.session.compose({x:5,y:5,w:1,h:1},{onion:false})].slice(0,3);')
    R['T4'] = dict(ok=shade == ramp[2][:3], from_=ramp[1][:3], to=shade, steps='select ramp colours with Shift+click in the palette, Ink = Shading, paint (≈3)')
    js(p, "W.setPref('ink','simple');W.setPref('symmetry',{mode:'x',axisX:10,axisY:null})"); js(p, "W.setColor('fg',[255,0,0,255])"); drag(p, [(3, 20), (4, 20)])
    mir = js(p, 'await W.commitChain();return [...W.session.compose({x:15,y:20,w:2,h:1},{onion:false})];')
    R['T3'] = dict(ok=mir[:3] == [255, 0, 0] and mir[4:7] == [255, 0, 0], axis=10, steps='Symmetry = vertical, type axis position 10 (2)')
    # ---------------- T13 Lospec search by name
    js(p, "localStorage.removeItem('nerulio.studio.lospec.consent.v1')")
    js(p, "S.runCommand('pixel.lospec')"); p.wait_for_selector('dialog.px-lospec-consent'); p.click('dialog .st-btn.primary'); p.wait_for_selector('[data-px="lospec-name"]')
    p.fill('[data-px="lospec-name"]', 'PICO-8'); p.click('[data-px="lospec-go"]'); p.wait_for_selector('[data-px="lospec-out"] .px-pal-grid, [data-px="lospec-out"] .st-error', timeout=30000)
    R['T13'] = dict(online=ONLINE, result=p.inner_text('[data-px="lospec-out"]')[:120], swatches=p.locator('[data-px="lospec-out"] .px-pal-sw').count(), steps='Pixel › Lospec palette…, allow once, type name, Load, Replace (5)')
    p.click('dialog.px-lospec .st-btn:not(.primary)'); settle(p)
    # ---------------- T14 palette files: read Aseprite's exports + a real Adobe .ase; write each format and read it back
    t14 = js(p, '''const PIO=await import("/src/studio/pixel/palette-io.js"),out={};
      for(const [name,url] of arg.files){try{const b=new Uint8Array(await fetch(url).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}));const q=PIO.readPalette(b,name);out[name]=q.colors.length;}catch(e){out[name]='ERR '+e.message;}}
      const pal=PIO.readPalette(new TextEncoder().encode(arg.gpl),"pico-8.gpl").colors,rt={};
      for(const f of Object.keys(PIO.PALETTE_WRITERS)){const spec=PIO.PALETTE_WRITERS[f],data=spec.write(pal,{name:"pico-8"}),bytes=typeof data==="string"?new TextEncoder().encode(data):new Uint8Array(data instanceof ArrayBuffer?data:data.buffer||data);
       const back=PIO.readPalette(bytes,"x."+spec.ext).colors;rt[f]=back.length>=16&&pal.every((c,i)=>c[0]===back[i][0]&&c[1]===back[i][1]&&c[2]===back[i][2]);}
      return {read:out,roundTrip:rt};''', {'gpl': open(PICO_GPL, encoding='utf-8').read(), 'files': []})
    R['T14'] = dict(t14, steps='Palette ⋯ › Import palette… / Export palette as … (2)')
    R['page_errors'] = errors
    b.close()
# T14: the files Aseprite wrote and a real Adobe Swatch Exchange file, read by the same module in Node
node = subprocess.run(['node', '-e', '''
const {readFileSync}=require("fs");import("./src/studio/pixel/palette-io.js").then(P=>{const out={};
for(const f of process.argv.slice(1)){try{out[f.split(/[\\\\/]/).pop()]=P.readPalette(new Uint8Array(readFileSync(f)),f).colors.length;}catch(e){out[f.split(/[\\\\/]/).pop()]="ERR "+e.message;}}
console.log(JSON.stringify(out));});''', *[os.path.join(WORK, 'aseprite', f) for f in ['T14_pico8.gpl', 'T14_pico8.pal', 'T14_pico8.hex', 'T14_pico8.act', 'pico8_adobe_swatch.ase']]], capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
R['T14']['read_aseprite_and_adobe_files'] = json.loads(node.stdout.strip() or '{}') if node.returncode == 0 else node.stderr[-300:]
json.dump(R, open(os.path.join(OUT, 'results.json'), 'w'), indent=1, default=str)
print(json.dumps(R, indent=1, default=str))
