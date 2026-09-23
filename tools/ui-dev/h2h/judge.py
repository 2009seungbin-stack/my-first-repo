"""Generic judge runner: python judge.py <tool-subdir> [name ...]; reads <subdir>/judge_jobs.json [{name,font,atlas,charset,args}]"""
import subprocess, os, sys, json
sys.stdout.reconfigure(encoding='utf-8')
H2H = os.path.dirname(os.path.abspath(__file__))
TOOL = r'C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-a8be6c03441cb4b55\tools\font-quality.py'
FONT = {
 'galmuri11': r'C:\Users\2009s\nerulio-asset-corpus\fonts\galmuri\Galmuri11.ttf',
 'notosanskr': r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\fonts\NotoSansKR-Regular.otf',
 'kenneyfuture': r'C:\Users\2009s\nerulio-asset-corpus\fonts\kenney-fonts\KenneyFuture.ttf',
}
sub = sys.argv[1]
names = set(sys.argv[2:])
D = os.path.join(H2H, sub)
jobs = json.load(open(os.path.join(D, 'judge_jobs.json'), encoding='utf-8'))
for j in jobs:
    if names and j['name'] not in names: continue
    out = os.path.join(D, 'q_%s.json' % j['name'])
    if os.path.exists(out) and not names: continue
    cmd = [sys.executable, TOOL, '--font', FONT[j['font']], '--atlas', os.path.join(D, j['atlas']), '--json', out]
    if j.get('charset'): cmd += ['--charset', os.path.join(H2H, j['charset'])]
    cmd += j.get('args', [])
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', cwd=D)
    print(j['name'], '|', r.stdout.strip(), r.stderr.strip()[-800:], flush=True)
