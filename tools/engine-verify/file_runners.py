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
