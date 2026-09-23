"""Pixelorama web (Godot HTML5 build embedded on itch.io): find the iframe URL, load it directly, screenshot."""
import json, os, sys, time
from playwright.sync_api import sync_playwright

WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(WORK, "shots")
info = {}
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1400, "height": 900})
    pg.goto("https://orama-interactive.itch.io/pixelorama", wait_until="load", timeout=60000)
    html = pg.content()
    import re
    m = re.findall(r'https?://[^"\'\s]*itch\.zone/html/[^"\'\s]*', html)
    info["iframe_candidates_in_html"] = list(dict.fromkeys(m))[:10]
    try:
        pg.click("text=Run tool", timeout=10000)
        pg.wait_for_timeout(5000)
    except Exception as e:
        info["click_err"] = str(e)[:200]
    info["frames_after_click"] = [f.url for f in pg.frames]
    pg.screenshot(path=os.path.join(SHOTS, "pixelorama_itch_run.png"))
    src = [u for u in info["frames_after_click"] + info["iframe_candidates_in_html"] if "itch.zone" in u]
    info["game_url"] = src[0] if src else None
    if info["game_url"]:
        g = b.new_page(viewport={"width": 1600, "height": 1000})
        logs = []
        g.on("console", lambda m: logs.append(m.text[:300]))
        t = time.time()
        g.goto(info["game_url"], wait_until="load", timeout=120000)
        # Godot boots: wait for the canvas and for loading to finish
        for i in range(24):
            g.wait_for_timeout(5000)
            g.screenshot(path=os.path.join(SHOTS, "pixelorama_boot.png"))
            if any("Pixelorama" in l or "Godot Engine" in l for l in logs) and i >= 4:
                break
        info["boot_s"] = round(time.time() - t, 1)
        info["console"] = logs[:60]
        g.screenshot(path=os.path.join(SHOTS, "pixelorama_loaded.png"))
    b.close()
json.dump(info, open(os.path.join(WORK, "jobd", "probe_pixelorama.json"), "w"), indent=1)
print(json.dumps(info, indent=1)[:4000])
