"""libGDX Hiero (runnable-hiero.jar, nightly 2026-09-09) batch mode: java -jar runnable-hiero.jar -i X.hiero -o X.fnt -b"""
import subprocess, os, sys, time, json, glob, re
sys.stdout.reconfigure(encoding='utf-8')
JAVA = r'C:\Users\2009s\AppData\Local\nerulio-engine-verify\jdk-25\bin\java.exe'
JAR = r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\tools\hiero\runnable-hiero.jar'
H2H = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(H2H, 'hiero')
os.makedirs(OUT, exist_ok=True)
F = {
 'galmuri11': (r'C:\Users\2009s\nerulio-asset-corpus\fonts\galmuri\Galmuri11.ttf', 'charset_ko_game.txt'),
 'notosanskr': (r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\fonts\NotoSansKR-Regular.otf', 'charset_ko_game.txt'),
 'kenneyfuture': (r'C:\Users\2009s\nerulio-asset-corpus\fonts\kenney-fonts\KenneyFuture.ttf', 'charset_ascii.txt'),
}
# name, font key, size, render_type (0 Java, 1 Native, 2 FreeType), distance field (spread) or None, df scale
RUNS = [
 ('galmuri11_12px_java', 'galmuri11', 12, 0, None),
 ('galmuri11_12px_native', 'galmuri11', 12, 1, None),
 ('galmuri11_24px_java', 'galmuri11', 24, 0, None),
 ('notosanskr_32px_java', 'notosanskr', 32, 0, None),
 ('notosanskr_32px_native', 'notosanskr', 32, 1, None),
 ('notosanskr_32px_df', 'notosanskr', 32, 0, 2.0),
 ('galmuri11_32px_df', 'galmuri11', 32, 0, 2.0),
 ('kenneyfuture_32px_df', 'kenneyfuture', 32, 0, 2.0),
 ('kenneyfuture_32px_freetype', 'kenneyfuture', 32, 2, None),
]

def settings(font, size, rt, spread, text):
    pad = int(spread) if spread else 1
    lines = ['font.name=%s' % os.path.splitext(os.path.basename(font))[0], 'font.size=%d' % size, 'font.bold=false', 'font.italic=false',
             'font.gamma=1.8', 'font.mono=false', '', 'font2.file=%s' % font, 'font2.use=true', '',
             'pad.top=%d' % pad, 'pad.right=%d' % pad, 'pad.bottom=%d' % pad, 'pad.left=%d' % pad,
             'pad.advance.x=%d' % (-2 * pad), 'pad.advance.y=%d' % (-2 * pad), '',
             'glyph.native.rendering=false', 'glyph.page.width=512', 'glyph.page.height=512', 'glyph.text=' + text, '',
             'render_type=%d' % rt, '']
    if spread:
        lines += ['effect.class=com.badlogic.gdx.tools.hiero.unicodefont.effects.DistanceFieldEffect', 'effect.Color=ffffff',
                  'effect.Scale=32', 'effect.Spread=%s' % spread, '']
    else:
        lines += ['effect.class=com.badlogic.gdx.tools.hiero.unicodefont.effects.ColorEffect', 'effect.Color=ffffff', '']
    return '\n'.join(lines)

only = sys.argv[1:]
res = []
for name, fk, size, rt, spread in RUNS:
    if only and name not in only: continue
    font, cs = F[fk]
    text = open(os.path.join(H2H, cs), encoding='utf-8').read()
    for old in glob.glob(os.path.join(OUT, name + '[._]*')): os.remove(old)
    cfg = os.path.join(OUT, name + '.hiero')
    open(cfg, 'w', encoding='utf-8', newline='\n').write(settings(font, size, rt, spread, text))
    cmd = [JAVA, '-jar', JAR, '-i', cfg, '-o', os.path.join(OUT, name + '.fnt'), '-b']
    t = time.time()
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900)
        rc, log = r.returncode, (r.stdout + r.stderr)
    except subprocess.TimeoutExpired as e:
        rc, log = 'timeout', str(e)
    dt = time.time() - t
    files = sorted(os.path.basename(p) for p in glob.glob(os.path.join(OUT, name + '*')))
    fnt = os.path.join(OUT, name + '.fnt'); info = {}
    if os.path.exists(fnt):
        t_ = open(fnt, encoding='utf-8', errors='replace').read()
        info = {'chars': len(re.findall(r'^char ', t_, re.M)), 'kernings': len(re.findall(r'^kerning ', t_, re.M)),
                'pages': len(re.findall(r'^page ', t_, re.M)), 'head': t_.splitlines()[:3]}
    res.append({'name': name, 'cmd': subprocess.list2cmdline(cmd), 'rc': rc, 'seconds': round(dt, 2), 'files': files, 'log': log[-1500:], 'spread': spread, **info})
    print(name, rc, round(dt, 2), info, files[:5], log[-300:].replace('\n', ' | '), flush=True)
p = os.path.join(OUT, 'runs.json')
old = json.load(open(p)) if os.path.exists(p) and only else []
old = [x for x in old if x['name'] not in {r['name'] for r in res}]
json.dump(old + res, open(p, 'w'), indent=1, ensure_ascii=False)
