"""Job D: drive the real Aseprite CLI (-b --script) for the scriptable tasks and measure results.
Usage: python jobd/run_aseprite.py [task ...]   (default: all)"""
import json, os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from compare import score

ASE = r"C:\Users\2009s\asebuild\b\bin\aseprite.exe"
C = r"C:\Users\2009s\nerulio-asset-corpus"
WORK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(WORK, "aseprite")
J = os.path.join(WORK, "jobd")
TRUTH = os.path.join(C, r"pixel\oga-sumo-hulk\sumoHulk_spriteSheet.png")
os.makedirs(OUT, exist_ok=True)


def ase(script, **params):
    args = [ASE, "-b"]
    for k, v in params.items():
        args += ["--script-param", f"{k}={v}"]
    args += ["--script", os.path.join(J, script)]
    t = time.time()
    r = subprocess.run(args, capture_output=True, text=True, timeout=300)
    ms = round((time.time() - t) * 1000)
    txt = (r.stdout + r.stderr).strip()
    print(f"[{script} rc={r.returncode} {ms}ms] {txt}")
    return txt, ms, r.returncode


results = {}
tasks = sys.argv[1:] or ["T9", "T10", "T5", "T8", "T11", "T6", "T7", "T14"]

if "T9" in tasks:
    o = os.path.join(OUT, "T9_sumoHulk_x4_to_1x_nearest.png")
    _, ms, rc = ase("t9_t10.lua", **{"in": os.path.join(C, r"pixel\oga-sumo-hulk\sumoHulk_spriteSheet_x4.png")}, out=o, w=96, h=144, method="nearest")
    results["T9"] = dict(score(o, TRUTH), ms=ms, rc=rc, how="Sprite > Sprite Size 96x144 (25%), method nearest")

if "T10" in tasks:
    src = os.path.join(C, r"pixel\derived\sumoHulk_x3.78_bilinear.png")
    for m in ["nearest", "bilinear", "rotsprite"]:
        o = os.path.join(OUT, f"T10_x3.78_to_96x144_{m}.png")
        _, ms, rc = ase("t9_t10.lua", **{"in": src}, out=o, w=96, h=144, method=m)
        results[f"T10_{m}_known_size"] = dict(score(o, TRUTH), ms=ms, rc=rc, how=f"Sprite Size typed to 96x144 (user must know the true size), method {m}")
    o = os.path.join(OUT, "T10_x3.78_to_96x144_nearest_quant10.png")
    _, ms, rc = ase("t10_quant.lua", **{"in": src}, out=o, w=96, h=144, n=10)
    results["T10_nearest_known_size_quant10"] = dict(score(o, TRUTH), ms=ms, rc=rc, how="Sprite Size 96x144 nearest + Create palette from sprite (10 colours) + Indexed (fit rgb, no dither)")
    # what a user typing the naive 1/4 or 1/3.78 percentage gets
    o = os.path.join(OUT, "T10_x3.78_scale_div4_nearest.png")
    _, ms, rc = ase("t9_t10.lua", **{"in": src}, out=o, w=round(363 / 4), h=round(544 / 4), method="nearest")
    results["T10_nearest_guess_x4"] = dict(score(o, TRUTH), ms=ms, rc=rc, how="user guesses 4x (25%) -> 91x136")

if "T5" in tasks:
    o = os.path.join(OUT, "T5_sumoHulk_pico8_indexed.png")
    oa = os.path.join(OUT, "T5_sumoHulk_pico8_indexed.aseprite")
    txt, ms, rc = ase("t5_indexed.lua", **{"in": TRUTH}, pal=os.path.join(C, r"palettes\lospec\pico-8.gpl"), out=o, outase=oa)
    results["T5"] = dict(log=txt, ms=ms, rc=rc)

if "T8" in tasks:
    src = os.path.join(C, r"sprites\oga-sprite-boy\sprite-boy-32.png")
    if not os.path.exists(src):
        src = TRUTH
    txt, ms, rc = ase("t8_outline.lua", **{"in": TRUTH}, out=os.path.join(OUT, "T8_sumoHulk_outline.png"),
                      out2=os.path.join(OUT, "T8_sumoHulk_outline_shadow.png"))
    results["T8"] = dict(log=txt, ms=ms, rc=rc)

if "T11" in tasks:
    oa = os.path.join(OUT, "T11_two_layers_indexed.aseprite")
    txt, ms, rc = ase("t11_save.lua", **{"in": TRUTH}, pal=os.path.join(C, r"palettes\lospec\pico-8.gpl"), out=oa)
    txt2, ms2, rc2 = ase("t11_verify.lua", **{"in": oa})
    results["T11"] = dict(log=txt, verify=txt2, ms=ms + ms2, rc=rc or rc2)

if "T6" in tasks or "T7" in tasks or "T14" in tasks:
    txt, ms, rc = ase("t6_t7_t14.lua", **{"in": TRUTH}, pal=os.path.join(C, r"palettes\lospec\pico-8.gpl"), outdir=OUT)
    results["T6_T7_T14"] = dict(log=txt, ms=ms, rc=rc)

rp = os.path.join(OUT, "results.json")
old = json.load(open(rp)) if os.path.exists(rp) else {}
old.update(results)
json.dump(old, open(rp, "w"), indent=1)
print(json.dumps(results, indent=1))
