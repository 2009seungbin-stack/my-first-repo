"""Shared paths for the paid/desktop head-to-head scripts (docs/H2H-PAID.md).

Every location can be overridden by an environment variable, so nothing depends on one machine:

  NERULIO_CORPUS      real-asset corpus (manifest.json with ground truth)
  H2H_WORK            where frame sets, competitor outputs and results are written
                      (default: <repo>/test-results/h2h-paid, git-ignored)
  TEXTUREPACKER_BIN   TexturePacker.exe (command-line client)
  GODOT_BIN           Godot 4 console executable
"""
import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CORPUS = Path(os.environ.get('NERULIO_CORPUS', r'C:\Users\2009s\nerulio-asset-corpus'))
WORK = Path(os.environ.get('H2H_WORK', str(REPO / 'test-results' / 'h2h-paid')))
TEXTUREPACKER = os.environ.get('TEXTUREPACKER_BIN', r'C:\Program Files\CodeAndWeb\TexturePacker\bin\TexturePacker.exe')
GODOT = os.environ.get('GODOT_BIN', r'C:\Users\2009s\Desktop\Godot_v4.7.2-stable_win64_console.exe')

PACK = WORK / 'pack'
SETS = PACK / 'sets'
SETS_EXTRA = PACK / 'sets_extra'
MAIN_SETS = ['ninja', 'archer', 'samurai', 'toon', 'spaceshooter']
