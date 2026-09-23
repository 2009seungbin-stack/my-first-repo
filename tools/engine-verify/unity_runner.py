"""Unity side of the engine-verify harness (Editor, batch mode).

Unity 6 is installed on the verification machine (UNITY_BIN, default the Hub path below) and batch
mode starts with the signed-in Hub's Personal entitlement; on a machine without a signed-in Hub
this runner reports UNVERIFIED instead of failing.

A template project is created once (-createProject, plus com.unity.2d.sprite, which every Unity 2D
template ships and which the exported importer's `UnityEditor.U2D.Sprites` namespace needs) under
the engine cache (NERULIO_ENGINE_CACHE, default %LOCALAPPDATA%/nerulio-engine-verify). Each run
copies it, drops the bundle into Assets/Bundle/ and unity/NerulioVerifyProbe.cs into an Editor
folder, and runs `-executeMethod NerulioVerifyProbe.Run`.
"""
from __future__ import annotations
import json, os, shutil, subprocess
from pathlib import Path
from ev_common import HERE

UNITY = os.environ.get('UNITY_BIN', r'C:\Program Files\Unity\Hub\Editor\6000.5.3f1\Editor\Unity.exe')
CACHE = Path(os.environ.get('NERULIO_ENGINE_CACHE', Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'nerulio-engine-verify'))
SPRITE_PACKAGE = ('com.unity.2d.sprite', '1.0.0')


def _run(args, log: Path, timeout=1800):
    p = subprocess.run([UNITY, '-batchmode', '-quit', *args, '-logFile', str(log)], capture_output=True, text=True,
                       encoding='utf-8', errors='replace', timeout=timeout, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    return p.returncode


def template() -> Path:
    t = CACHE / 'unity-template'
    if (t / 'Library').exists() and (t / '.ready').exists():
        return t
    if t.exists():
        shutil.rmtree(t)
    CACHE.mkdir(parents=True, exist_ok=True)
    if _run(['-nographics', '-createProject', str(t)], CACHE / 'unity-template-create.log') != 0:
        raise RuntimeError(f'Unity could not create a project (see {CACHE / "unity-template-create.log"}; is the Hub signed in?)')
    manifest = t / 'Packages' / 'manifest.json'
    m = json.loads(manifest.read_text(encoding='utf-8'))
    m['dependencies'][SPRITE_PACKAGE[0]] = SPRITE_PACKAGE[1]
    manifest.write_text(json.dumps(m, indent=2), encoding='utf-8')
    if _run(['-nographics', '-projectPath', str(t)], CACHE / 'unity-template-resolve.log') != 0:
        raise RuntimeError(f'Unity could not resolve {SPRITE_PACKAGE[0]} (see {CACHE / "unity-template-resolve.log"})')
    (t / '.ready').write_text('ok')
    return t


def version() -> str | None:
    if not Path(UNITY).exists():
        return None
    return Path(UNITY).parents[1].name


def run_probe(folder: Path, work: Path) -> dict | None:
    proj = work / 'unity-proj'
    if proj.exists():
        shutil.rmtree(proj)
    shutil.copytree(template(), proj, ignore=shutil.ignore_patterns('Temp', 'Logs', '.ready'))
    shutil.copytree(folder, proj / 'Assets' / 'Bundle')
    ed = proj / 'Assets' / 'VerifyEditor' / 'Editor'
    ed.mkdir(parents=True)
    shutil.copy2(HERE / 'unity' / 'NerulioVerifyProbe.cs', ed / 'NerulioVerifyProbe.cs')
    log = work / 'unity.log'
    code = _run(['-projectPath', str(proj), '-executeMethod', 'NerulioVerifyProbe.Run'], log)
    rep = proj / '_verify' / 'report.json'
    if not rep.exists():
        text = log.read_text(encoding='utf-8', errors='replace') if log.exists() else ''
        errs = [l for l in text.splitlines() if 'error CS' in l][:10]
        return {'errors': [f'the Unity probe produced no report (exit {code}); see {log}'] + errs, 'pages': [], 'sprites': []}
    data = json.loads(rep.read_text(encoding='utf-8'))
    data['_out'] = str(proj / '_verify')
    return data
