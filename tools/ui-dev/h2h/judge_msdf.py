import subprocess, os, sys, json
sys.stdout.reconfigure(encoding='utf-8')
H2H = os.path.dirname(os.path.abspath(__file__))
TOOL = r'C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-a8be6c03441cb4b55\tools\font-quality.py'
FONTS = {
 'galmuri11': (r'C:\Users\2009s\nerulio-asset-corpus\fonts\galmuri\Galmuri11.ttf', 'charset_ko_game.txt'),
 'notosanskr': (r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\fonts\NotoSansKR-Regular.otf', 'charset_ko_game.txt'),
 'kenneyfuture': (r'C:\Users\2009s\nerulio-asset-corpus\fonts\kenney-fonts\KenneyFuture.ttf', 'charset_ascii.txt'),
}
D = os.path.join(H2H, 'msdf-atlas-gen')
for fk, (font, cs) in FONTS.items():
    for typ in ('msdf', 'mtsdf', 'sdf', 'psdf'):
        n = '%s_%s' % (fk, typ)
        out = os.path.join(D, 'q_%s.json' % n)
        if os.path.exists(out) and '--force' not in sys.argv: continue
        r = subprocess.run([sys.executable, TOOL, '--font', font, '--atlas', os.path.join(D, n + '.json'), '--image', os.path.join(D, n + '.png'),
                            '--charset', os.path.join(H2H, cs), '--json', out], capture_output=True, text=True, encoding='utf-8')
        print(r.stdout.strip(), r.stderr.strip()[-500:], flush=True)
    # negative control on msdf
    n = '%s_msdf' % fk
    out = os.path.join(D, 'q_%s_NEG_blur1_shift1.json' % n)
    if not os.path.exists(out):
        r = subprocess.run([sys.executable, TOOL, '--font', font, '--atlas', os.path.join(D, n + '.json'), '--image', os.path.join(D, n + '.png'),
                            '--degrade', 'blur=1.0,shift=1', '--json', out], capture_output=True, text=True, encoding='utf-8')
        print('NEG', r.stdout.strip(), r.stderr.strip()[-500:], flush=True)
    out = os.path.join(D, 'q_%s_NEG_blur0.7.json' % n)
    if not os.path.exists(out):
        r = subprocess.run([sys.executable, TOOL, '--font', font, '--atlas', os.path.join(D, n + '.json'), '--image', os.path.join(D, n + '.png'),
                            '--degrade', 'blur=0.7', '--json', out], capture_output=True, text=True, encoding='utf-8')
        print('NEG', r.stdout.strip(), r.stderr.strip()[-500:], flush=True)
