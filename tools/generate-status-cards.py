"""Share cards of the AI status pages (assets/social/<l>-status-<slug>-<state>.png, 1200x630): one per
home status service (Claude, ChatGPT, Gemini) x state (bad, warn, ok, unk) x language (ko, en).

Workers cannot draw images, so the cards are drawn here once and committed; the status page picks the
file for the state it shows (platform/status-card.js). Words, services and icons come from the site's
own modules (cardLabel/cardNote, RAIL_SERVICES, icons.js), so a card and its page cannot drift apart.
Drawn by Chromium (Playwright) from an HTML template: lime brand (#c6f24e) on ink (#15171a).

Usage: python tools/generate-status-cards.py [--fonts DIR] [--force]
  --fonts DIR  a folder with Pretendard-Bold.otf / Pretendard-ExtraBold.otf / Pretendard-Medium.otf
               (OFL; github.com/orioncactus/pretendard). Without it: Noto Sans KR / Malgun Gothic if
               installed, else the system sans-serif.
Existing files are kept unless --force is given. CHROMIUM=/path/to/chrome picks the browser."""
import base64, io, json, os, subprocess, sys
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'social'
COLOR = {'bad': '#f07474', 'warn': '#ffb35c', 'ok': '#4ade80', 'unk': '#aeb5c1'}


def site_words():
    script = ("import {CARD_SERVICES,CARD_STATES,CARD_LOCALES,cardLabel,cardNote,statusCardPath} from './platform/status-card.js';"
              "import {icon,STATUS_ICON} from './platform/render/icons.js';"
              "const out=[];for(const s of CARD_SERVICES)for(const st of CARD_STATES)for(const l of CARD_LOCALES)"
              "out.push({...s,state:st,l,label:cardLabel(st,l),note:cardNote(st,l),path:statusCardPath(s.id,st,l),icon:String(icon(STATUS_ICON[st],92))});"
              "console.log(JSON.stringify(out));")
    out = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)


def font_css(folder):
    if not folder:
        return ''
    faces = []
    for weight, name in [(500, 'Medium'), (700, 'Bold'), (800, 'ExtraBold')]:
        f = Path(folder) / f'Pretendard-{name}.otf'
        if f.exists():
            # Inline (a data: URL): the template page has no origin that may read file: URLs.
            data = base64.b64encode(f.read_bytes()).decode()
            faces.append(f"@font-face{{font-family:Card;font-weight:{weight};src:url(data:font/otf;base64,{data}) format('opentype')}}")
    return ''.join(faces)


LOGO = ('<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="20" fill="#c6f24e"/>'
        '<path d="M21 47V31a11 11 0 0 1 22 0v16" fill="none" stroke="#15171a" stroke-width="9" stroke-linecap="round"/>'
        '<circle cx="48" cy="15" r="5.5" fill="#15171a"/></svg>')


def page(c, fonts):
    ko = c['l'] == 'ko'
    alias = f'<span class="al">{c["ko"]}</span>' if ko and c.get('ko') else ''
    color = COLOR[c['state']]
    head = 'AI 서비스 상태' if ko else 'AI service status'
    ask = '실시간 장애·접속 오류 확인' if ko else 'Live outage and error check'
    return f"""<!doctype html><html lang="{c['l']}"><head><meta charset="utf-8"><style>{fonts}
*{{box-sizing:border-box}}html,body{{margin:0}}
body{{width:1200px;height:630px;background:#15171a;color:#fff;font-family:Card,Pretendard,'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif;overflow:hidden}}
.c{{position:relative;width:1200px;height:630px;padding:60px 72px 0;display:flex;flex-direction:column}}
.top{{display:flex;align-items:center;gap:18px;font-size:40px;font-weight:800;letter-spacing:-.5px}}
.chip{{margin-left:auto;font-size:26px;font-weight:700;color:#c6f24e;border:2px solid #c6f24e;border-radius:999px;padding:8px 22px}}
.main{{margin-top:78px;display:flex;align-items:center;gap:44px}}
.b{{flex:none;width:176px;height:176px;border-radius:48px;display:grid;place-items:center;color:{color};background:{color}24;box-shadow:inset 0 0 0 3px {color}55}}
.b svg{{width:104px;height:104px}}
.nm{{font-size:100px;font-weight:800;letter-spacing:-3px;line-height:1.02;white-space:nowrap}}
.al{{font-size:44px;font-weight:700;letter-spacing:-1px;color:#aeb5c1;margin-left:22px;vertical-align:14px}}
.st{{font-size:70px;font-weight:800;letter-spacing:-1.5px;color:{color};line-height:1.1;margin-top:10px;white-space:nowrap}}
.note{{margin-top:54px;font-size:31px;font-weight:500;color:#c9ced6;letter-spacing:-.3px}}
.foot{{position:absolute;left:72px;right:72px;bottom:44px;display:flex;justify-content:space-between;font-size:27px;font-weight:700;color:#8a929f}}
.foot b{{color:#c6f24e}}
.bar{{position:absolute;left:0;right:0;bottom:0;height:14px;background:#c6f24e}}
</style></head><body><div class="c">
<div class="top">{LOGO}<span>nerulio</span><span class="chip">{head}</span></div>
<div class="main"><div class="b">{c['icon']}</div><div><div class="nm">{c['short']}{alias}</div><div class="st">{c['label']}</div></div></div>
<div class="note">{c['note']}</div>
<div class="foot"><span><b>{ask}</b></span><span>nerulio.com</span></div>
<div class="bar"></div></div></body></html>"""


def main():
    args = sys.argv[1:]
    force = '--force' in args
    folder = args[args.index('--fonts') + 1] if '--fonts' in args else os.environ.get('NERULIO_CARD_FONTS')
    fonts = font_css(folder)
    cards = site_words()
    exe = os.environ.get('CHROMIUM') or ('/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else None)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        pg = b.new_page(viewport={'width': 1200, 'height': 630})
        for c in cards:
            path = ROOT / c['path'].lstrip('/')
            if path.exists() and not force:
                print('kept', path.name); continue
            pg.set_content(page(c, fonts), wait_until='load')
            pg.evaluate('document.fonts.ready')
            if fonts and not pg.evaluate("document.fonts.check('800 40px Card')"):
                raise SystemExit('the card font did not load')
            png = pg.screenshot(clip={'x': 0, 'y': 0, 'width': 1200, 'height': 630})
            # Flat colors quantize without visible loss and keep each card small in the repository.
            Image.open(io.BytesIO(png)).convert('RGB').quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(path, optimize=True)
            print('wrote', path.name, path.stat().st_size)
        b.close()


if __name__ == '__main__':
    main()
