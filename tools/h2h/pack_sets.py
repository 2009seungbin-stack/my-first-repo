"""Build the five real CC0 frame sets of docs/STUDIO-PACK-H2H.md (plus the duplicate and multipack
sets) from the corpus into $H2H_WORK/pack/sets*. Same frames and names as the free-packer run.

  python tools/h2h/pack_sets.py
"""
import json
import shutil
import xml.etree.ElementTree as ET
from PIL import Image
from h2h_paths import CORPUS, SETS, SETS_EXTRA, MAIN_SETS, PACK


def fresh(root, name):
    p = root / name
    if p.is_dir():
        shutil.rmtree(p)
    p.mkdir(parents=True)
    return p


def grid(src, cols, rows, cw, ch, out, prefix):
    im = Image.open(src).convert('RGBA')
    assert im.size == (cols * cw, rows * ch), im.size
    k = 0
    for r in range(rows):
        for c in range(cols):
            im.crop((c * cw, r * ch, c * cw + cw, r * ch + ch)).save(out / f'{prefix}_{k:02d}.png')
            k += 1


def main():
    p = fresh(SETS, 'ninja')
    for i in range(6):
        shutil.copy(CORPUS / 'sprites/oga-ninja/1x' / f'run_{i}.png', p / f'run_{i}.png')
    p = fresh(SETS, 'archer')
    for i in range(1, 11):
        shutil.copy(CORPUS / 'sprites/oga-skeleton-archer/attack-frames' / f'attack ({i}).png', p / f'attack_{i:02d}.png')
    grid(CORPUS / 'sprites/oga-samurai/samurai.png', 6, 10, 48, 48, fresh(SETS, 'samurai'), 'samurai')
    grid(CORPUS / 'sprites/kenney-toon-characters/character_femaleAdventurer_sheet.png', 9, 5, 96, 128, fresh(SETS, 'toon'), 'toon')
    p = fresh(SETS, 'spaceshooter')
    base = CORPUS / 'sprites/kenney-space-shooter-remastered'
    im = Image.open(base / 'sheet.png').convert('RGBA')
    for st in ET.parse(base / 'sheet.xml').getroot().iter('SubTexture'):
        x, y, w, h = (int(st.get(a)) for a in ('x', 'y', 'width', 'height'))
        im.crop((x, y, x + w, y + h)).save(p / st.get('name'))
    # duplicates: the ninja run three times; multipack: the archer attack eight times
    p = fresh(SETS_EXTRA, 'ninja_dup3')
    for c in range(1, 4):
        for f in sorted((SETS / 'ninja').glob('*.png')):
            shutil.copy(f, p / f'c{c}_{f.name}')
    p = fresh(SETS_EXTRA, 'archer_x8')
    for c in range(1, 9):
        for f in sorted((SETS / 'archer').glob('*.png')):
            shutil.copy(f, p / f'c{c}_{f.name}')
    stats = {}
    for s in MAIN_SETS:
        fs = sorted((SETS / s).glob('*.png'))
        full = bbox = 0
        sizes = set()
        for f in fs:
            im = Image.open(f).convert('RGBA')
            sizes.add(im.size)
            full += im.size[0] * im.size[1]
            bb = im.getchannel('A').getbbox()
            if bb:
                bbox += (bb[2] - bb[0]) * (bb[3] - bb[1])
        stats[s] = {'count': len(fs), 'full_area': full, 'bbox_area': bbox, 'distinct_sizes': len(sizes)}
        print(s, stats[s])
    (PACK / 'set_stats.json').write_text(json.dumps(stats, indent=1))


if __name__ == '__main__':
    main()
