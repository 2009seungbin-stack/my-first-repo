"""Load each web editor headless, screenshot, dump visible UI text / titles for feature inspection."""
import json, os, sys, time
from playwright.sync_api import sync_playwright

WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(WORK, "shots")
os.makedirs(SHOTS, exist_ok=True)
URLS = {
    "piskel": "https://www.piskelapp.com/p/create/sprite",
    "lospec": "https://apps.lospec.com/pixel-editor/",
    "pixelorama_itch": "https://orama-interactive.itch.io/pixelorama",
}
which = sys.argv[1:] or list(URLS)
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=["--use-gl=angle", "--enable-unsafe-swiftshader"])
    for k in which:
        pg = b.new_page(viewport={"width": 1400, "height": 900})
        logs = []
        pg.on("console", lambda m: logs.append(m.text[:200]))
        t = time.time()
        try:
            pg.goto(URLS[k], wait_until="load", timeout=60000)
            pg.wait_for_timeout(6000)
            info = {"url": pg.url, "title": pg.title(), "load_s": round(time.time() - t, 1)}
            info["titles"] = pg.eval_on_selector_all("[title]", "els => els.map(e => e.getAttribute('title')).filter(Boolean)")[:400]
            info["text"] = pg.inner_text("body")[:6000]
            info["iframes"] = [f.url for f in pg.frames]
        except Exception as e:
            info = {"error": str(e)[:500]}
        pg.screenshot(path=os.path.join(SHOTS, f"{k}_loaded.png"))
        info["console"] = logs[:40]
        json.dump(info, open(os.path.join(WORK, "jobd", f"probe_{k}.json"), "w"), indent=1)
        print(k, info.get("title"), info.get("load_s"), info.get("error", ""), len(info.get("titles", [])))
    b.close()
