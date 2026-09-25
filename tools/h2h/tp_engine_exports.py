"""TexturePacker's own engine exports of the head-to-head frame sets, for tools/engine-verify.

Each format keeps TexturePacker's per-format defaults (rotation is whatever that exporter enables
by default); trim, MaxRects Best and padding 2 as in tp_pack.py. A second copy with rotation forced
on shows how the engine copes with rotated frames from TexturePacker itself.

  python tools/h2h/tp_engine_exports.py  -> $H2H_WORK/engine/tp/<set>/<format>[-rot]/
"""
import json
import subprocess
from h2h_paths import TEXTUREPACKER, SETS, WORK

FORMATS = {
    # id: (TexturePacker --format, data file name)
    'phaser': ('phaser', 'atlas.json'),
    'pixijs': ('pixijs4', 'atlas.json'),
    'spine': ('spine', 'atlas.atlas'),
    'godot': ('godot-spritesheet', 'atlas.tpsheet'),
    'unity': ('unity-texture2d', 'atlas.tpsheet'),
}
BASE = ['--trim-mode', 'Trim', '--algorithm', 'MaxRects', '--maxrects-heuristics', 'Best', '--pack-mode', 'Best',
        '--shape-padding', '2', '--border-padding', '0', '--extrude', '0', '--max-size', '4096', '--size-constraints', 'AnySize']


def main():
    out = []
    for s in ['ninja', 'archer', 'samurai', 'toon']:
        for fid, (fmt, data) in FORMATS.items():
            for rot in ('', '-rot'):
                d = WORK / 'engine' / 'tp' / s / (fid + rot)
                d.mkdir(parents=True, exist_ok=True)
                for f in d.iterdir():
                    if f.is_file():
                        f.unlink()
                args = [TEXTUREPACKER, str(SETS / s), '--format', fmt, '--data', str(d / data), '--sheet', str(d / 'atlas.png'),
                        *BASE, *(['--enable-rotation'] if rot else []), '--force-publish']
                r = subprocess.run(args, capture_output=True, text=True)
                log = (r.stdout + r.stderr).strip()
                if 'Essential' in log:
                    raise SystemExit('TexturePacker is in Essential mode')
                files = sorted(f.name for f in d.iterdir())
                rotated = None
                if data.endswith('.json'):
                    j = json.loads((d / data).read_text())
                    fr = j['textures'][0]['frames'] if 'textures' in j else j['frames']
                    fr = fr if isinstance(fr, list) else list(fr.values())
                    rotated = sum(1 for x in fr if x.get('rotated'))
                out.append({'set': s, 'format': fid + rot, 'rc': r.returncode, 'files': files, 'rotated': rotated, 'log': log[-300:]})
                print(s, fid + rot, r.returncode, files, 'rotated', rotated, flush=True)
    (WORK / 'engine' / 'tp' / 'exports.json').write_text(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
