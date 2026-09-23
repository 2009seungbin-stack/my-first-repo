#!/usr/bin/env python3
"""Regenerates tests/fixtures/ui/msdf/reference.json: msdfgen's own SDF / PSDF / MSDF / MTSDF
fields for a fixed set of shapes, used by tests/studio-ui-msdf.test.mjs to check
src/game/ui/font/{shape,raster,msdf}.js against the reference implementation.

Needs: the official msdfgen Windows binary (v1.13, github.com/Chlumsky/msdfgen/releases,
msdfgen-1.13-win64.zip) unpacked under %LOCALAPPDATA%/nerulio-engine-verify/msdfgen/ (or set
MSDFGEN=path/to/msdfgen.exe), Python with fontTools and Node >= 20. Every shape is synthetic or
comes from the committed CC0 Kenney fonts in tests/fixtures/ui/fonts (the fixture must stay
CC0). CI needs none of this: the committed JSON is all the tests read. Non-CC0 glyphs (Noto
Sans JP kanji with overlapping contours) are checked by a local-only test that calls msdfgen
itself and writes nothing into the repo.

What it does, per case:
 1. outline commands (font units, y-up) come from the synthetic list below or from a font via
    fontTools (TrueType quadratics split at implied on-curve points, like opentype.js);
 2. node runs shapeFromCommands + prepareShape (normalise + orient, no colouring) and writes an
    msdfgen shape description with Y = h - y, so msdfgen samples exactly our pixel centres;
 3. msdfgen is run with the flags recorded in MSDFGEN_ARGS (no Skia preprocessing, overlap
    support, scanline sign pass — the pipeline msdf.js reproduces) and, once more, with
    -noscanline (error correction with the exact-distance check at edges);
 4. fields are stored as px distances, rows top-first, int16 at 1/2048 px (clamped to ±16 px),
    deflated + base64; msdfgen's edge colouring (-exportshape) as one letter per edge; its
    8-bit -testrender at 4x as a deflated bit mask.
"""
import base64, json, os, struct, subprocess, sys, tempfile, zlib, hashlib, re
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'fixtures', 'ui', 'msdf', 'reference.json')
MSDFGEN = os.environ.get('MSDFGEN') or os.path.join(os.environ.get('LOCALAPPDATA', ''), 'nerulio-engine-verify', 'msdfgen', 'msdfgen-1.13', 'msdfgen', 'msdfgen.exe')
MSDFGEN_ARGS = ['-nopreprocess', '-overlap', '-scanline']  # + mode, -shapedesc, -dimensions, -pxrange, -format binfloat
QUANT = 2048


class CommandPen(BasePen):
    def __init__(self, glyphSet):
        super().__init__(glyphSet)
        self.cmds = []
    def _moveTo(self, p): self.cmds.append({'type': 'M', 'x': p[0], 'y': p[1]})
    def _lineTo(self, p): self.cmds.append({'type': 'L', 'x': p[0], 'y': p[1]})
    def _qCurveToOne(self, a, b): self.cmds.append({'type': 'Q', 'x1': a[0], 'y1': a[1], 'x': b[0], 'y': b[1]})
    def _curveToOne(self, a, b, c): self.cmds.append({'type': 'C', 'x1': a[0], 'y1': a[1], 'x2': b[0], 'y2': b[1], 'x': c[0], 'y': c[1]})
    def _closePath(self): self.cmds.append({'type': 'Z'})
    def _endPath(self): self.cmds.append({'type': 'Z'})


def M(x, y): return {'type': 'M', 'x': x, 'y': y}
def L(x, y): return {'type': 'L', 'x': x, 'y': y}
def Q(x1, y1, x, y): return {'type': 'Q', 'x1': x1, 'y1': y1, 'x': x, 'y': y}
def C(x1, y1, x2, y2, x, y): return {'type': 'C', 'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'x': x, 'y': y}
Z = {'type': 'Z'}


def circle_quads(cx, cy, r, n=8, cw=True):
    import math
    pts = []
    k = 1 / math.cos(math.pi / n)
    out = [M(cx + r, cy)]
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        s = -1 if cw else 1  # clockwise in y-up = positive (TrueType outer)
        am = (a0 + a1) / 2
        out.append(Q(round(cx + r * k * math.cos(s * am), 3), round(cy + r * k * math.sin(s * am), 3),
                     round(cx + r * math.cos(s * a1), 3), round(cy + r * math.sin(s * a1), 3)))
    out.append(Z)
    return out


def circle_cubics(cx, cy, r, cw=True):
    k = 0.5522847498 * r
    s = -1 if cw else 1
    return [M(cx + r, cy),
            C(cx + r, cy + s * k, cx + k, cy + s * r, cx, cy + s * r),
            C(cx - k, cy + s * r, cx - r, cy + s * k, cx - r, cy),
            C(cx - r, cy - s * k, cx - k, cy - s * r, cx, cy - s * r),
            C(cx + k, cy - s * r, cx + r, cy - s * k, cx + r, cy), Z]


SYNTHETIC = [
    # name, commands (units, y-up; outer contours clockwise like TrueType), scale, w, h
    ('square', [M(4, 4), L(4, 24), L(24, 24), L(24, 4), Z], 1, 28, 28),
    ('circle-quadratic', circle_quads(16, 16, 10.5), 1, 32, 32),
    ('ring-cubic', circle_cubics(16, 16, 11) + circle_cubics(16, 16, 5.5, cw=False), 1, 32, 32),
    ('cubic-s', [M(6, 5), C(20, 3, 26, 10, 20, 16), C(14, 21, 10, 22, 13, 26), C(15, 28, 22, 27, 25, 25),
                 L(26, 28), C(20, 31, 12, 31, 9, 27), C(5, 22, 12, 17, 16, 13), C(20, 9, 15, 6, 7, 8), Z], 1, 32, 32),
    ('sharp-a', [M(3, 3), L(14.5, 29), L(17.5, 29), L(29, 3), L(24.5, 3), L(21.5, 10), L(10.5, 10), L(7.5, 3), Z,
                 M(12, 13.5), L(20, 13.5), L(16, 23), Z], 1, 32, 32),
    # one cubic leaving and returning to its start: a one-edge contour with one corner
    ('teardrop-1edge', [M(6, 16), C(30, 34, 34, 2, 6, 16), Z], 1, 32, 32),
    # two quadratics, smooth where they meet (24,22) and a corner at (5,16)
    ('teardrop-2edge', [M(5, 16), Q(14, 30, 24, 22), Q(32, 15.6, 5, 16), Z], 1, 32, 32),
    ('overlap', [M(4, 6), L(4, 20), L(22, 20), L(22, 6), Z, M(12, 12), L(12, 27), L(27, 27), L(27, 12), Z]
     + circle_quads(9, 22, 6), 1, 32, 32),
]


def band(p0, c, p1, w):
    """A curved stroke of width w along the quadratic centre line p0-c-p1, as one closed contour
    (orientation is whatever falls out; orientContours fixes it before msdfgen sees it)."""
    import math
    def nrm(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dy); return (-dy / l, dx / l)
    n0, n1 = nrm(p0, c), nrm(c, p1)
    nc = (n0[0] + n1[0], n0[1] + n1[1]); l = math.hypot(*nc); cosh = (nc[0] * n0[0] + nc[1] * n0[1]) / l
    nc = (nc[0] / l / cosh, nc[1] / l / cosh)
    h = w / 2
    P = lambda p, n, s: (round(p[0] + s * h * n[0], 3), round(p[1] + s * h * n[1], 3))
    a0, ac, a1, b1, bc, b0 = P(p0, n0, 1), P(c, nc, 1), P(p1, n1, 1), P(p1, n1, -1), P(c, nc, -1), P(p0, n0, -1)
    return [M(*a0), Q(*ac, *a1), L(*b1), Q(*bc, *b0), Z]


def bar(x0, y0, x1, y1): return [M(x0, y0), L(x0, y1), L(x1, y1), L(x1, y0), Z]


# A dense, kanji-like synthetic glyph: 11 separate stroke contours that cross each other the way
# variable-font CJK outlines do (winding 2 at every crossing), plus curved sweeps and a dot.
DENSE = (bar(6, 30.5, 34, 32.7) + bar(8, 24.5, 32, 26.5) + bar(8, 18.5, 32, 20.5) + bar(5, 12.5, 35, 14.5)
         + bar(18.8, 3, 21.2, 36.5) + bar(9, 9, 11, 29) + bar(29, 9, 31, 29)
         + band((19, 19), (13, 12), (4, 4.5), 2.4) + band((21, 19), (27, 11), (36, 4), 2.6)
         + band((12, 35), (20, 38), (27, 34), 1.8) + [M(17.5, 37), Q(20, 40.5, 22.5, 37.5), Q(20, 35.5, 17.5, 37), Z])
SYNTHETIC.append(('dense-strokes', DENSE, 1, 40, 40))

FONTS = os.path.join(ROOT, 'tests', 'fixtures', 'ui', 'fonts')  # committed CC0 Kenney fonts
GLYPHS = [
    # name, font (relative to tests/fixtures/ui/fonts), [(char, x offset in units)], cell size
    ('kenney-future-A', 'KenneyFuture.ttf', [('A', 0)], 32),
    ('kenney-future-S', 'KenneyFuture.ttf', [('S', 0)], 32),
    ('kenney-future-g', 'KenneyFuture.ttf', [('g', 0)], 32),
    ('kenney-future-8', 'KenneyFuture.ttf', [('8', 0)], 32),
    ('kenney-future-at', 'KenneyFuture.ttf', [('@', 0)], 32),
    ('kenney-pixel-k', 'KenneyPixel.ttf', [('k', 0)], 24),
    # real curved outlines overlapping like a variable font's: 'O' laid over 'A' (both clockwise,
    # the O's counter anticlockwise), so the combiner meets winding 0, 1 and 2 with holes
    ('kenney-overlap-AO', 'KenneyFuture.ttf', [('A', 0), ('O', 330)], 40),
    ('kenney-overlap-8g', 'KenneyFuture.ttf', [('8', 0), ('g', 260)], 40),
    ('kenney-pixel-dense-8', 'KenneyPixel.ttf', [('8', 0)], 20),
]
LICENCE = 'Kenney fonts, CC0 1.0 (kenney.nl), tests/fixtures/ui/fonts/LICENSE-kenney.txt'
RANGE = 4


def bounds(cmds):
    xs = [v for c in cmds for k, v in c.items() if k in ('x', 'x1', 'x2')]
    ys = [v for c in cmds for k, v in c.items() if k in ('y', 'y1', 'y2')]
    return min(xs), min(ys), max(xs), max(ys)


def cases():
    out = []
    for name, cmds, scale, w, h in SYNTHETIC:
        out.append({'name': name, 'source': 'synthetic', 'commands': cmds, 'scale': scale, 'dx': 0, 'dy': h, 'w': w, 'h': h, 'range': RANGE})
    for name, font, parts, size in GLYPHS:
        f = TTFont(os.path.join(FONTS, font))
        gs = f.getGlyphSet()
        cmds = []
        for ch, ox in parts:
            pen = CommandPen(gs)
            gs[f.getBestCmap()[ord(ch)]].draw(pen)
            cmds += [{k: (v + ox if k in ('x', 'x1', 'x2') else v) for k, v in c.items()} for c in pen.cmds]
        x0, y0, x1, y1 = bounds(cmds)
        pad = RANGE / 2 + 1
        scale = min((size - 2 * pad) / (x1 - x0), (size - 2 * pad) / (y1 - y0))
        scale = round(scale * 4096) / 4096
        dx = round(((size - (x1 - x0) * scale) / 2 - x0 * scale) * 64) / 64
        dy = round(((size - (y1 - y0) * scale) / 2 + y1 * scale) * 64) / 64
        src = ' + '.join(f'U+{ord(ch):04X}' + (f' shifted {ox} units' if ox else '') for ch, ox in parts)
        out.append({'name': name, 'source': f'{font} {src}', 'licence': LICENCE,
                    'commands': cmds, 'scale': scale, 'dx': dx, 'dy': dy, 'w': size, 'h': size, 'range': RANGE})
    return out


NODE_EXPORT = r"""
import {shapeFromCommands,shapeDescription} from './src/game/ui/font/shape.js';
import {prepareShape} from './src/game/ui/font/msdf.js';
let s='';for await(const c of process.stdin)s+=c;
const out=JSON.parse(s).map(c=>{
 const shape=shapeFromCommands(c.commands,{scale:c.scale,dx:c.dx,dy:c.dy});
 const p=prepareShape(shape,{coloring:false},false);
 return shapeDescription(p,{height:c.h});
});
process.stdout.write(JSON.stringify(out));
"""


def run(args):
    r = subprocess.run([MSDFGEN] + args, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f'msdfgen failed: {" ".join(args)}\n{r.stderr}')
    return r.stdout + r.stderr


def read_field(path, w, h, n, rng):
    data = open(path, 'rb').read()
    vals = struct.unpack(f'<{w * h * n}f', data)
    # binfloat rows are msdfgen bitmap rows: bottom row first (y-up). Flip to top-first.
    rows = [vals[r * w * n:(r + 1) * w * n] for r in range(h)][::-1]
    return [(v - 0.5) * rng for row in rows for v in row]


def pack_field(vals):
    q = [max(-32767, min(32767, round(max(-1e6, min(1e6, v)) * QUANT))) for v in vals]
    return base64.b64encode(zlib.compress(struct.pack(f'<{len(q)}h', *q), 9)).decode()


def colours(path):
    per = []
    for block in re.findall(r'\{(.*?)\}', open(path).read(), re.S):
        per.append(''.join(re.findall(r';\s*([cmyw])\s*[;(]', block)))
    return per


def main():
    if not os.path.isfile(MSDFGEN):
        raise SystemExit(f'msdfgen not found at {MSDFGEN}')
    version = run(['-version']).strip().splitlines()[0]
    cs = cases()
    r = subprocess.run(['node', '--input-type=module', '-e', NODE_EXPORT], input=json.dumps(cs), capture_output=True, text=True, cwd=ROOT)
    if r.returncode:
        raise SystemExit(r.stderr)
    descs = json.loads(r.stdout)
    from PIL import Image
    tmp = os.environ.get('MSDFREF_TMP') or tempfile.mkdtemp(prefix='msdfref-')  # keep the raw binfloat outputs by setting MSDFREF_TMP
    os.makedirs(tmp, exist_ok=True)
    for c, desc in zip(cs, descs):
        w, h, rng = c['w'], c['h'], c['range']
        d = os.path.join(tmp, c['name'] + '.txt')
        open(d, 'w').write(desc)
        base = ['-shapedesc', d, '-dimensions', str(w), str(h), '-pxrange', str(rng)] + MSDFGEN_ARGS
        fields = {}
        for mode, n in (('sdf', 1), ('psdf', 1), ('mtsdf', 4), ('msdf', 3)):
            o = os.path.join(tmp, f"{c['name']}.{mode}.bin")
            extra = ['-exportshape', os.path.join(tmp, c['name'] + '.colored.txt')] if mode == 'msdf' else []
            run([mode] + base + ['-format', 'binfloat', '-o', o] + extra)
            fields[mode] = read_field(o, w, h, n, rng)
        msdf, mt = fields.pop('msdf'), fields['mtsdf']
        assert all(msdf[i * 3 + k] == mt[i * 4 + k] for i in range(w * h) for k in range(3)), 'msdf != mtsdf rgb'
        o = os.path.join(tmp, c['name'] + '.ns.bin')
        run(['msdf'] + base[:-1] + ['-noscanline', '-format', 'binfloat', '-o', o])
        fields['msdfNoScanline'] = read_field(o, w, h, 3, rng)
        png, tr = os.path.join(tmp, c['name'] + '.png'), os.path.join(tmp, c['name'] + '.tr.png')
        run(['msdf'] + base + ['-format', 'png', '-o', png, '-testrender', tr, str(4 * w), str(4 * h)])
        im = Image.open(tr).convert('L')
        bits = bytearray((im.width * im.height + 7) // 8)
        for i, v in enumerate(im.tobytes()):
            if v >= 128:
                bits[i >> 3] |= 1 << (i & 7)
        c['reference'] = {k: pack_field(v) for k, v in fields.items()}
        c['reference']['colors'] = colours(os.path.join(tmp, c['name'] + '.colored.txt'))
        c['reference']['testrender4'] = base64.b64encode(zlib.compress(bytes(bits), 9)).decode()
        c['reference']['estimatedError'] = run(['msdf'] + base + ['-format', 'binfloat', '-o', os.path.join(tmp, 'x.bin'), '-estimateerror']).strip()
    doc = {
        'generator': 'tools/ui-msdf-reference.py',
        'msdfgen': {'version': version, 'binary': 'msdfgen-1.13-win64.zip (official release)',
                    'sha256': hashlib.sha256(open(MSDFGEN, 'rb').read()).hexdigest(),
                    'commands': [f'msdfgen <sdf|psdf|msdf|mtsdf> -shapedesc <case>.txt -dimensions <w> <h> -pxrange <range> {" ".join(MSDFGEN_ARGS)} -format binfloat -o <out>',
                                 'msdfgen msdf ... -nopreprocess -overlap -noscanline -format binfloat (msdfNoScanline)',
                                 'msdfgen msdf ... -exportshape <colored>.txt (colors)',
                                 'msdfgen msdf ... -format png -testrender <tr>.png <4w> <4h> (testrender4, threshold 128, LSB-first bits)']},
        'encoding': {'fields': f'int16 LE of round(px*{QUANT}), clamped to +-16 px, rows top-first, zlib, base64', 'range': 'total ramp width in px'},
        'cases': cs,
    }
    json.dump(doc, open(OUT, 'w'), separators=(',', ':'))
    print(f'{OUT}: {os.path.getsize(OUT)} bytes, {len(cs)} cases, {version}')


if __name__ == '__main__':
    main()
