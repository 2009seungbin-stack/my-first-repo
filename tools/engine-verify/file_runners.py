"""Runners for exported FILES rather than engines: animated GIF / APNG decoded by Pillow, and
`.aseprite` opened by the real Aseprite CLI (ASEPRITE_BIN, default the local build below).

* GIF / APNG: Pillow decodes every frame (composited as a viewer shows it) and its duration.
* .aseprite: `aseprite -b <file> --sheet s.png --data s.json --format json-array --list-tags
  --list-slices` — Aseprite itself renders every frame into a sheet and lists tags and durations;
  each frame is cut back out of that sheet. So "Aseprite opens it and draws these pixels".
Both produce the engine-neutral report judge.py reads.
"""
from __future__ import annotations
import json, os, subprocess
from pathlib import Path
from PIL import Image, ImageSequence

ASEPRITE = Path(os.environ.get('ASEPRITE_BIN', r'C:\Users\2009s\asebuild\b\bin\aseprite.exe'))


def decode_animation(path: Path, dest: Path) -> dict:
    """Frames and durations of a GIF or APNG as Pillow shows them."""
    dest.mkdir(parents=True, exist_ok=True)
    im = Image.open(path)
    frames, steps = [], []
    for i, fr in enumerate(ImageSequence.Iterator(im)):
        p = dest / f'frame_{i:04d}.png'
        fr.convert('RGBA').save(p)
        name = f'#{i}'
        frames.append({'name': name, 'png': str(p)})
        steps.append({'name': name, 'png': str(p), 'durationMs': float(fr.info.get('duration', 0))})
    loop = im.info.get('loop')
    return {'format': im.format, 'size': list(im.size), 'frames': frames,
            'animations': {path.stem.split('_', 1)[-1]: {'fps': None, 'loop': loop == 0 if loop is not None else None, 'frames': steps}}}


def cut_strips(folder: Path, item: dict, dest: Path) -> dict:
    """GameMaker strips cut the way GameMaker's importer does: `<name>_strip<N>.png` = N equal
    frames side by side (the frame width is the image width / N). Every strip is one animation,
    and gamemaker.json must name the same N and frame size. GameMaker itself does not run here."""
    import re
    dest.mkdir(parents=True, exist_ok=True)
    data = item['data']
    base = (folder / item['json']).parent
    frames, anims, errors = [], {}, []
    for s in data['sprites']:
        path = base / s['file']
        m = re.search(r'_strip(\d+)\.png$', s['file'])
        if not m or not path.exists():
            errors.append(f'{s["file"]}: not a name_stripN.png file in the bundle')
            continue
        n = int(m.group(1))
        im = Image.open(path).convert('RGBA')
        if im.width % n or im.width // n != s['width'] or im.height != s['height'] or n != s['frames']:
            errors.append(f'{s["file"]}: {im.width}x{im.height} is not {n} frames of {s["width"]}x{s["height"]}')
            continue
        w = im.width // n
        steps = []
        for k in range(n):
            p = dest / f'{Path(s["file"]).stem}_{k:03d}.png'
            im.crop((k * w, 0, (k + 1) * w, im.height)).save(p)
            name = f'{s["name"]}#{k}'
            frames.append({'name': name, 'png': str(p)})
            steps.append({'name': name, 'png': str(p), 'durationMs': s['durationsMs'][k]})
        anims[s.get('animation') or s['name']] = {'fps': s['playbackSpeed'], 'loop': s['loop'], 'frames': steps}
    return {'errors': errors, 'frames': frames, 'animations': anims}


def aseprite_version() -> str | None:
    if not ASEPRITE.exists():
        return None
    try:
        return subprocess.run([str(ASEPRITE), '--version'], capture_output=True, text=True, timeout=60).stdout.strip()
    except Exception:
        return None


def open_aseprite(path: Path, dest: Path) -> dict:
    dest.mkdir(parents=True, exist_ok=True)
    sheet, data = dest / 'sheet.png', dest / 'sheet.json'
    p = subprocess.run([str(ASEPRITE), '-b', str(path), '--sheet', str(sheet), '--data', str(data), '--format', 'json-array',
                        '--list-tags', '--list-slices', '--sheet-pack'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=300)
    if p.returncode != 0 or not data.exists():
        return {'errors': [f'Aseprite could not open {path.name} (exit {p.returncode}): {p.stderr[-400:]}'], 'frames': [], 'animations': {}}
    d = json.loads(data.read_text(encoding='utf-8'))
    im = Image.open(sheet).convert('RGBA')
    frames = []
    for i, f in enumerate(d['frames']):
        r, ss, src = f['frame'], f['spriteSourceSize'], f['sourceSize']
        canvas = Image.new('RGBA', (src['w'], src['h']))
        canvas.paste(im.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), (ss['x'], ss['y']))
        p = dest / f'frame_{i:04d}.png'
        canvas.save(p)
        frames.append({'name': f'#{i}', 'png': str(p), 'durationMs': f['duration']})
    anims = {}
    for t in d['meta'].get('frameTags', []):
        idx = list(range(t['from'], t['to'] + 1))
        if t['direction'] == 'reverse':
            idx.reverse()
        elif t['direction'] == 'pingpong' and len(idx) > 2:
            idx = idx + idx[-2:0:-1]
        anims[t['name']] = {'fps': None, 'loop': 'repeat' not in t, 'direction': t['direction'],
                            'frames': [{'name': frames[i]['name'], 'png': frames[i]['png'], 'durationMs': frames[i]['durationMs']} for i in idx]}
    return {'errors': [], 'frames': [{'name': f['name'], 'png': f['png']} for f in frames], 'animations': anims,
            'slices': [s['name'] for s in d['meta'].get('slices', [])], 'version': aseprite_version()}
