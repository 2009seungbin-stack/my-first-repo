"""Run msdf-atlas-gen v1.4 on the three inputs x four types; record commands, times, outputs."""
import subprocess, time, json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
EXE = r'C:\Users\2009s\AppData\Local\nerulio-engine-verify\msdfgen\msdf-atlas-gen-1.4\msdf-atlas-gen\msdf-atlas-gen.exe'
H2H = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(H2H, 'msdf-atlas-gen')
os.makedirs(OUT, exist_ok=True)
FONTS = {
 'galmuri11': (r'C:\Users\2009s\nerulio-asset-corpus\fonts\galmuri\Galmuri11.ttf', 'charset_ko_game.msdf.txt'),
 'notosanskr': (r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\fonts\NotoSansKR-Regular.otf', 'charset_ko_game.msdf.txt'),
 'kenneyfuture': (r'C:\Users\2009s\nerulio-asset-corpus\fonts\kenney-fonts\KenneyFuture.ttf', 'charset_ascii.msdf.txt'),
}
only = sys.argv[1:] or None
runs = []
for fk, (font, cs) in FONTS.items():
    for typ in ('msdf', 'mtsdf', 'sdf', 'psdf'):
        name = '%s_%s' % (fk, typ)
        if only and name not in only: continue
        cmd = [EXE, '-font', font, '-charset', os.path.join(H2H, cs), '-type', typ, '-size', '32', '-pxrange', '4',
               '-format', 'png', '-imageout', os.path.join(OUT, name + '.png'), '-json', os.path.join(OUT, name + '.json')]
        t = time.time()
        r = subprocess.run(cmd, capture_output=True, text=True)
        dt = time.time() - t
        meta = json.load(open(os.path.join(OUT, name + '.json'))) if r.returncode == 0 else {}
        A = meta.get('atlas', {})
        runs.append({'name': name, 'cmd': ' '.join('"%s"' % c if ' ' in c else c for c in cmd), 'rc': r.returncode, 'seconds': round(dt, 2),
                     'stdout': (r.stdout + r.stderr)[-600:], 'atlas': A, 'glyphs': len(meta.get('glyphs', [])), 'kerning_pairs': len(meta.get('kerning', []))})
        print(name, r.returncode, round(dt, 2), A.get('width'), A.get('height'), len(meta.get('glyphs', [])), len(meta.get('kerning', [])), (r.stdout + r.stderr).strip()[-200:])
old = []
p = os.path.join(OUT, 'runs.json')
if os.path.exists(p) and only:
    old = [x for x in json.load(open(p)) if x['name'] not in {r['name'] for r in runs}]
json.dump(old + runs, open(p, 'w'), indent=1)
