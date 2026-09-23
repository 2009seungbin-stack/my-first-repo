"""Export samurai.aseprite with the real Aseprite 1.3.18 CLI in the two ways the guide discusses."""
import subprocess, json, pathlib, shutil
HERE = pathlib.Path(__file__).parent
A = r'C:\Users\2009s\asebuild\b\bin\aseprite.exe'
(HERE / 'phaser').mkdir(exist_ok=True)
shutil.copy(HERE.parent / 'shared' / 'samurai.aseprite', HERE / 'samurai.aseprite')
cmds = {
    # the command published in the guide (frame keys "0".."11")
    'samurai': [A, '-b', 'samurai.aseprite', '--sheet', 'phaser/samurai.png', '--data', 'phaser/samurai.json',
                '--format', 'json-hash', '--sheet-type', 'packed', '--trim', '--list-tags', '--list-slices',
                '--filename-format', '{frame}'],
    # same without --filename-format: Aseprite's default keys "samurai 0.aseprite"
    'samurai_default': [A, '-b', 'samurai.aseprite', '--sheet', 'phaser/samurai_default.png', '--data', 'phaser/samurai_default.json',
                        '--format', 'json-hash', '--sheet-type', 'packed', '--trim', '--list-tags', '--list-slices'],
    # untrimmed horizontal strip + array, for the Godot script
    'samurai_strip': [A, '-b', 'samurai.aseprite', '--sheet', 'godot/samurai_strip.png', '--data', 'godot/samurai_strip.json',
                      '--format', 'json-array', '--list-tags', '--list-slices', '--filename-format', '{frame}'],
}
(HERE / 'godot').mkdir(exist_ok=True)
for name, cmd in cmds.items():
    r = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True)
    print('$', ' '.join(c if ' ' not in c else f'"{c}"' for c in cmd[1:]), '->', r.returncode, r.stderr.strip()[:200])
for f in ['phaser/samurai.json', 'phaser/samurai_default.json', 'godot/samurai_strip.json']:
    d = json.loads((HERE / f).read_text(encoding='utf-8'))
    fr = d['frames']
    keys = list(fr) if isinstance(fr, dict) else [x['filename'] for x in fr]
    items = list(fr.values()) if isinstance(fr, dict) else fr
    print(f, 'keys', keys[:3], 'n', len(keys), 'size', d['meta']['size'], 'durations', [x['duration'] for x in items],
          'trimmed', sum(1 for x in items if x['trimmed']), 'tags', [(t['name'], t['from'], t['to'], t.get('repeat')) for t in d['meta']['frameTags']])
