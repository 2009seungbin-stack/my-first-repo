"""Runs game/ with LÖVE 11.5 (lovec.exe), copies render.png / bleed.png / report.txt next to this file."""
import os, re, shutil, subprocess
from pathlib import Path
HERE = Path(__file__).parent
LOVE = Path(os.environ['LOCALAPPDATA']) / 'nerulio-engine-verify' / 'love-11.5-win64' / 'lovec.exe'
p = subprocess.run([str(LOVE), str(HERE / 'game')], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
(HERE / 'love.log').write_text(p.stdout + '\n' + p.stderr, encoding='utf-8')
print(p.stdout[-4000:], p.stderr[-2000:])
m = re.search(r'SAVE_DIR=(.+)', p.stdout)
if m:
    save = Path(m.group(1).strip())
    for f in ('render.png', 'bleed.png', 'report.txt'):
        if (save / f).exists():
            shutil.copy(save / f, HERE / f)
    shutil.rmtree(save, ignore_errors=True)
