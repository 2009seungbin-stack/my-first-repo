"""Brand files from the Nerulio mark (src/logo.js): favicons, the apple-touch icon, the 512 px logo that
Organization data points at (src/seo.js LOGO_PATH), and the portal share cards
(assets/social/<ko|en>-tools-news.png, 1200x630: the site card of every public page without its own).

    python3 tools/brand-assets.py            (needs Playwright's Chromium and Pillow)
    python3 tools/brand-assets.py --social-only

The cards are drawn in SUIT (assets/fonts/suit) with the portal's branch line."""
import argparse, asyncio, io, pathlib, subprocess, tempfile
from PIL import Image
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
BRAND = ROOT / 'assets/brand'
MARK = subprocess.run(['node', '-e', "import('./src/logo.js').then(m=>process.stdout.write(m.faviconSVG()))"], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True).stdout
FONTS = (ROOT / 'src/platform/fonts.css').read_text(encoding='utf-8').replace('url(/assets/', f'url({ROOT.as_uri()}/assets/').replace('url(../../assets/', f'url({ROOT.as_uri()}/assets/')

CARD = {
 'ko': ('게임 에셋·파일 도구와 실측·해설', ['입력·결과·검증 자료를 공개하는 실측·해설', '공식 출처로 연결되는 출시·업데이트 뉴스', '브라우저의 이미지·PDF·게임 에셋 도구']),
 'en': ('Game assets, file tools & original tests', ['Original tests with inputs, outputs and verification', 'Release news linked to official sources', 'Image, PDF and game asset tools in your browser']),
}

def card_html(l):
    title, lines = CARD[l]
    rows = ''.join(f'<li><span class="e"></span>{x}</li>' for x in lines)
    return f'''<!doctype html><meta charset="utf-8"><style>{FONTS}
*{{box-sizing:border-box}}body{{margin:0}}
.c{{width:1200px;height:630px;background:#fff;font-family:SUIT,sans-serif;color:#15171a;padding:72px 80px;position:relative;overflow:hidden}}
.b{{display:flex;align-items:center;gap:18px;font-weight:800;font-size:44px;letter-spacing:-1px}}.b svg{{width:72px;height:72px}}
h1{{margin:44px 0 0;font-size:{58 if l=='ko' else 50}px;line-height:1.2;font-weight:800;letter-spacing:-1.5px;max-width:980px}}
ul{{list-style:none;margin:36px 0 0 6px;padding:0;position:relative}}
li{{position:relative;padding:10px 0 10px 50px;font-size:30px;font-weight:600;color:#40464e}}
li .e{{position:absolute;left:0;top:0;width:34px;height:31px;border-left:3px solid #d6dacf;border-bottom:3px solid #d6dacf;border-bottom-left-radius:18px}}
li:not(:last-child)::after{{content:"";position:absolute;left:0;top:0;bottom:0;border-left:3px solid #d6dacf}}
li:last-child .e{{border-color:#a9cf45}}
.u{{position:absolute;right:80px;bottom:64px;font-size:28px;font-weight:700;color:#3d6608}}
.bar{{position:absolute;left:0;right:0;bottom:0;height:16px;background:#c6f24e}}
</style><div class="c"><div class="b">{MARK}<span>nerulio</span></div><h1>{title}</h1><ul>{rows}</ul><span class="u">nerulio.com</span><span class="bar"></span></div>'''

async def main(social_only=False):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1200, 'height': 630})
        async def mark(size, pad=0, bg='transparent'):
            await pg.set_viewport_size({'width': size, 'height': size})
            inner = size - 2 * pad
            svg = MARK.replace('<svg ', f'<svg style="width:{inner}px;height:{inner}px;display:block" ', 1)
            await pg.set_content(f'<html><body style="margin:0;background:{bg}"><div style="width:{size}px;height:{size}px;display:flex;align-items:center;justify-content:center">{svg}</div></body></html>')
            return Image.open(io.BytesIO(await pg.screenshot(omit_background=bg == 'transparent')))
        if not social_only:
            for s in (48, 96, 192): (await mark(s)).save(BRAND / f'favicon-{s}.png', optimize=True)
            (await mark(512)).save(BRAND / 'nerulio-logo-512.png', optimize=True)
            # iOS rounds the corners itself: a full-bleed lime square with the mark inside.
            (await mark(180, 14, '#c6f24e')).convert('RGB').save(BRAND / 'apple-touch-icon.png', optimize=True)
            (await mark(256)).save(BRAND / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
        await pg.set_viewport_size({'width': 1200, 'height': 630})
        for l in CARD:
            # a file page, so the file:// font URLs load (a blank page may not read local files)
            with tempfile.TemporaryDirectory(prefix='nerulio-brand-') as folder:
                owned = pathlib.Path(folder).resolve()
                assert owned.parent == pathlib.Path(tempfile.gettempdir()).resolve() and owned.name.startswith('nerulio-brand-')
                tmp = owned / 'card.html'; tmp.write_text(card_html(l), encoding='utf-8')
                await pg.goto(tmp.as_uri()); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(300)
                assert await pg.evaluate("[...document.fonts].some(f=>f.family==='SUIT'&&f.status==='loaded')"), 'SUIT did not load'
                assert await pg.evaluate("![...document.fonts].some(f=>f.status==='error')"), 'A requested brand font failed'
                Image.open(io.BytesIO(await pg.screenshot())).convert('RGB').save(ROOT / f'assets/social/{l}-tools-news.png', optimize=True)
                await pg.goto('about:blank')
        await b.close()
    if not social_only: (ROOT / 'favicon.svg').write_text(MARK, encoding='utf-8')
    print('ok')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--social-only', action='store_true', help='Render share cards without rewriting logos or icons')
    args = parser.parse_args()
    asyncio.run(main(social_only=args.social_only))
