"""Piskel web (piskelapp.com editor): T9/T10 retry — import image with 'Resize to' 96x144, smooth resize OFF,
then export the frame as PNG via pskl.app.getFirstFrameAsPng-equivalent (the same data the Export > PNG tab downloads).
Usage: python jobd/piskel_t9t10.py"""
import base64, json, os, sys, time
from playwright.sync_api import sync_playwright

WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = r"C:\Users\2009s\nerulio-asset-corpus"
DL = os.path.join(WORK, "jobd", "dl_piskel")
os.makedirs(DL, exist_ok=True)
JOBS = [("T9", os.path.join(C, r"pixel\oga-sumo-hulk\sumoHulk_spriteSheet_x4.png")),
        ("T10", os.path.join(C, r"pixel\derived\sumoHulk_x3.78_bilinear.png"))]
log = []
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 1600, "height": 1000}, locale="en-US")
    # block ad hosts so the editor loads fast
    ctx.route("**/*", lambda r: r.abort() if any(h in r.request.url for h in ("doubleclick", "googlesyndication", "googletag", "adservice", "amazon-adsystem", "prebid", "pubmatic", "rubicon", "criteo")) else r.continue_())
    for tag, src in JOBS:
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: log.append("pageerror " + str(e)[:200]))
        t = time.time()
        pg.goto("https://www.piskelapp.com/p/create/sprite", wait_until="domcontentloaded", timeout=120000)
        pg.wait_for_function("window.pskl && pskl.app && pskl.app.piskelController", timeout=120000)
        log.append(f"{tag} editor ready {time.time() - t:.1f}s")
        pg.click("[data-setting=import]", timeout=10000)
        with pg.expect_file_chooser() as fc:
            pg.click(".file-input-button")
        fc.value.set_files(src)
        pg.wait_for_selector("#dialog-container .resize-width, #dialog-container [name=resize-width]", timeout=15000)
        w = pg.locator("#dialog-container [name=resize-width]").first
        w.fill("96"); w.press("Tab")
        h = pg.locator("#dialog-container [name=resize-height]").first
        if h.input_value() != "144":
            h.fill("144"); h.press("Tab")
        sm = pg.locator("#dialog-container [name=smooth-resize-checkbox]").first
        if sm.is_checked():
            sm.uncheck()
        vals = pg.evaluate("[...document.querySelectorAll('#dialog-container input')].filter(e=>e.offsetParent!==null).map(e=>(e.name||e.className)+'='+(e.type==='checkbox'||e.type==='radio'?e.checked:e.value)).slice(0,4)")
        log.append(f"{tag} wizard {vals}")
        pg.locator("#dialog-container .current-step .import-next-button").first.click()
        pg.wait_for_timeout(1500)
        for _ in range(3):  # later steps (insert location / combine-replace) if shown
            step = pg.evaluate("(document.querySelector('#dialog-container .current-step')||{}).className||'none'")
            log.append(f"{tag} step: {step}")
            if step == 'none':
                break
            rep = pg.locator("#dialog-container .current-step .import-mode-replace-button")
            if rep.count():
                rep.first.click()
            else:
                pg.locator("#dialog-container .current-step .import-next-button").first.click()
            pg.wait_for_timeout(1500)
        info = pg.evaluate("pskl.app.piskelController.getWidth()+'x'+pskl.app.piskelController.getHeight()+' frames='+pskl.app.piskelController.getFrameCount()")
        log.append(f"{tag} piskel now {info}")
        url = pg.evaluate("(()=>{const c=pskl.utils.FrameUtils.toImage(pskl.app.piskelController.getCurrentFrame()); return c.toDataURL('image/png')})()")
        out = os.path.join(DL, f"{tag}_piskel_import_resize96x144_nosmooth.png")
        open(out, "wb").write(base64.b64decode(url.split(",", 1)[1]))
        log.append(f"{tag} saved {out}")
        pg.close()
    b.close()
print("\n".join(log))
json.dump(log, open(os.path.join(WORK, "jobd", "piskel_t9t10_log.json"), "w"), indent=1)
