"""Which engines can the harness drive on this machine? Prints one line per engine.

    python tools/engine-verify/engines.py

Godot, Phaser 3/4, PixiJS 8 and Unity have runners (verify.py). Defold and LOVE are probed only:
both were run successfully on the verification machine (see docs/ENGINE-VERIFY.md) but no Nerulio
exporter targets them yet, so there is nothing to verify. GameMaker has no free headless path.
"""
from __future__ import annotations
import os, shutil, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import godot_runner, unity_runner, web_runner  # noqa: E402

CACHE = unity_runner.CACHE


def _out(cmd):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60)
        return (p.stdout + p.stderr).strip().splitlines()[0] if (p.stdout or p.stderr) else f'exit {p.returncode}'
    except Exception as e:
        return f'unavailable ({type(e).__name__})'


def main():
    g = godot_runner.DEFAULT_GODOT
    print(f'godot    {"runner  " if Path(g).exists() else "MISSING "} {g}: {_out([g, "--version"]) if Path(g).exists() else "set GODOT_BIN"}')
    for name, v in web_runner.engines_available().items():
        print(f'{name:8} {"runner  " if v else "MISSING "} {v or "npm ci --prefix tools/engine-verify/web"}')
    u = unity_runner.version()
    print(f'unity    {"runner  " if u else "MISSING "} {u or "set UNITY_BIN"} (batch mode needs a signed-in Unity Hub / Personal entitlement)')
    cached_jdk = CACHE / 'jdk-25' / 'bin' / 'java.exe'
    java = os.environ.get('DEFOLD_JAVA') or (str(cached_jdk) if cached_jdk.exists() else shutil.which('java'))
    bob = os.environ.get('DEFOLD_BOB') or str(CACHE / 'bob.jar')
    print(f'defold   probe    bob.jar {"found" if Path(bob).exists() else "missing"} at {bob}; java: {_out([java, "-version"]) if java else "missing"} '
          '(bob 1.13.x needs Java 25: class file version 69)')
    love = os.environ.get('LOVE_BIN') or str(CACHE / 'love-11.5-win64' / 'lovec.exe')
    print(f'love     probe    {"found" if Path(love).exists() else "missing"} {love}')
    print('gamemaker none     no free headless build or import path (IDE + account login); not attempted')


if __name__ == '__main__':
    main()
