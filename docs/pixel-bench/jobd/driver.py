"""Tiny persistent Playwright driver. Usage: python driver.py <name> <url>
Reads commands appended to jobd/cmd_<name>.txt (one per line), executes them, logs to jobd/log_<name>.txt.
Commands: click X Y | dbl X Y | rclick X Y | key K | type TEXT | upload PATH (arms next file chooser)
          wait MS | shot NAME | eval JS | drag X1 Y1 X2 Y2 | move X Y | quit
Downloads are saved to shots/../jobd/dl_<name>/."""
import os, sys, time, traceback
from playwright.sync_api import sync_playwright

name, url = sys.argv[1], sys.argv[2]
WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = os.path.join(WORK, "jobd")
SH = os.path.join(WORK, "shots")
DL = os.path.join(J, f"dl_{name}")
os.makedirs(DL, exist_ok=True)
cmdf = os.path.join(J, f"cmd_{name}.txt")
logf = os.path.join(J, f"log_{name}.txt")
open(cmdf, "w").close()
log = open(logf, "w", buffering=1, encoding="utf-8")
pending = {"file": None}


def L(*a):
    log.write(" ".join(str(x) for x in a) + "\n")


with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = b.new_context(viewport={"width": 1600, "height": 1000}, locale="en-US", accept_downloads=True)
    pg = ctx.new_page()
    pg.on("console", lambda m: L("console:", m.text[:300]))

    def on_fc(fc):
        L("filechooser opened, multiple=", fc.is_multiple())
        if pending["file"]:
            fc.set_files(pending["file"])
            L("set_files", pending["file"])
            pending["file"] = None

    def on_dl(d):
        p = os.path.join(DL, d.suggested_filename)
        d.save_as(p)
        L("download saved", p)

    pg.on("filechooser", on_fc)
    pg.on("download", on_dl)
    t = time.time()
    pg.goto(url, wait_until="load", timeout=120000)
    L("loaded", url, round(time.time() - t, 1), "s")
    pos = 0
    while True:
        lines = open(cmdf, encoding="utf-8").read().splitlines()
        if len(lines) <= pos:
            pg.wait_for_timeout(300)
            continue
        for line in lines[pos:]:
            pos += 1
            if not line.strip():
                continue
            c, _, arg = line.partition(" ")
            L(">", line)
            try:
                if c == "quit":
                    b.close(); L("bye"); sys.exit(0)
                elif c == "click":
                    x, y = map(float, arg.split()); pg.mouse.click(x, y)
                elif c == "dbl":
                    x, y = map(float, arg.split()); pg.mouse.dblclick(x, y)
                elif c == "rclick":
                    x, y = map(float, arg.split()); pg.mouse.click(x, y, button="right")
                elif c == "move":
                    x, y = map(float, arg.split()); pg.mouse.move(x, y)
                elif c == "drag":
                    x1, y1, x2, y2 = map(float, arg.split())
                    pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move(x2, y2, steps=15); pg.mouse.up()
                elif c == "key":
                    pg.keyboard.press(arg)
                elif c == "type":
                    pg.keyboard.type(arg, delay=30)
                elif c == "upload":
                    pending["file"] = arg
                elif c == "wait":
                    pg.wait_for_timeout(int(arg))
                elif c == "shot":
                    pg.screenshot(path=os.path.join(SH, f"{name}_{arg}.png")); L("shot", arg)
                elif c == "eval":
                    L("eval ->", str(pg.evaluate(arg))[:3000])
                elif c == "setinput":  # setinput CSS PATH : set files on an <input type=file> directly
                    sel, path = arg.split(" ", 1); pg.set_input_files(sel, path)
                elif c == "clicksel":
                    pg.click(arg, timeout=5000)
                elif c == "goto":
                    pg.goto(arg, wait_until="load", timeout=120000)
            except Exception as e:
                L("ERR", repr(e)[:500])
            L("done", line[:60])
