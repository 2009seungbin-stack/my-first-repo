"""check_glyphs.py - list characters of charset.txt that a font file cannot draw.

Usage:  python check_glyphs.py charset.txt Galmuri11.ttf [Fallback.ttf ...]
Exit code 1 when anything is missing from every font given (use it in CI).
"""
import sys
from fontTools.ttLib import TTFont

charset = open(sys.argv[1], encoding='utf-8').read().rstrip('\n')
fonts = [(path, TTFont(path, lazy=True).getBestCmap()) for path in sys.argv[2:]]
missing = []
for ch in charset:
    owner = next((path for path, cmap in fonts if ord(ch) in cmap), None)
    if owner is None:
        missing.append(ch)
    elif owner != fonts[0][0]:
        print(f'U+{ord(ch):04X} {ch} comes from fallback {owner}')
for ch in missing:
    print(f'MISSING U+{ord(ch):04X} {ch}')
print(f'{len(charset) - len(missing)}/{len(charset)} characters covered')
sys.exit(1 if missing else 0)
