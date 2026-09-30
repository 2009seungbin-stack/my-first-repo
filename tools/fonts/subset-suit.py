"""Split SUIT Variable into unicode-range chunks for the portal pages (browsers fetch only the chunks a page
uses). The ranges are Pretendard's dynamic-subset ranges: one chunk per group of Korean syllables in
frequency order, then Latin, symbols and CJK.

    pip install fonttools brotli
    python3 tools/fonts/subset-suit.py SUIT-Variable.woff2 pretendardvariable-dynamic-subset.css

Sources: npm @sun-typeface/suit (fonts/variable/woff2/SUIT-Variable.woff2) and npm pretendard
(dist/web/variable/pretendardvariable-dynamic-subset.css). Writes assets/fonts/suit/*.woff2 and
src/platform/fonts.css."""
import re, sys, pathlib
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/fonts/suit'
src, ranges_css = sys.argv[1], pathlib.Path(sys.argv[2]).read_text()

def codepoints(spec):
    out = set()
    for part in spec.split(','):
        part = part.strip().upper().removeprefix('U+')
        a, _, b = part.partition('-')
        out.update(range(int(a, 16), int(b or a, 16) + 1))
    return out

chunks = [codepoints(m) for m in re.findall(r'unicode-range:\s*([^;]+);', ranges_css)]
# Arrows stay with the system font: SUIT draws → like a chevron ("영상 → GIF" would read "영상 > GIF").
cmap = set(TTFont(src)['cmap'].getBestCmap()) - set(range(0x2190, 0x2200))
for f in OUT.glob('SUIT.subset.*.woff2'): f.unlink()
faces, n = [], 0
for cps in chunks:
    have = sorted(cps & cmap)
    if not have: continue
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    font = subset.load_font(src, opts); s = subset.Subsetter(opts); s.populate(unicodes=have); s.subset(font)
    name = f'SUIT.subset.{n}.woff2'; subset.save_font(font, str(OUT / name), opts)
    # the range written is what this chunk really holds
    spans, start = [], have[0]
    for a, b in zip(have, have[1:] + [None]):
        if b != a + 1: spans.append(f'U+{start:x}' + (f'-{a:x}' if a != start else '')); start = b
    faces.append(f"@font-face{{font-family:'SUIT';font-style:normal;font-display:swap;font-weight:100 900;src:url(/assets/fonts/suit/{name}) format('woff2');unicode-range:{','.join(spans)}}}")
    n += 1
mono = [f"@font-face{{font-family:'JetBrains Mono';font-style:normal;font-display:swap;font-weight:{w};src:url(/assets/fonts/jetbrains-mono/jetbrains-mono-latin-{w}-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}}" for w in (400, 700)]
(ROOT / 'src/platform/fonts.css').write_text(
    '/* Portal fonts, served from this site (font-src \'self\'). SUIT (SIL OFL 1.1, sun.fo) split by\n'
    '   tools/fonts/subset-suit.py; JetBrains Mono (SIL OFL 1.1) Latin 400/700 for numbers and labels. */\n'
    + '\n'.join(faces + mono) + '\n')
print(n, 'chunks')
