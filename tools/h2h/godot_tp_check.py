"""TexturePacker's Godot path in the real engine: the .tpsheet export + TexturePacker's own importer
plugin (github.com/CodeAndWeb/texturepacker-godot-plugin, MIT) in a throw-away Godot 4 project.
Godot imports it (--import runs the plugin), then godot_tp_probe.gd draws every AtlasTexture at 1x;
the drawings are compared with the source frames using the engine-verify pixel rules.

  TP_GODOT_PLUGIN=<folder containing addons/codeandweb.texturepacker> python tools/h2h/godot_tp_check.py

Writes $H2H_WORK/engine/godot-tp.json.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from PIL import Image
from h2h_paths import REPO, SETS, WORK, GODOT

sys.path.insert(0, str(REPO / 'tools' / 'engine-verify'))
from ev_common import diff, unpremultiply  # noqa: E402

PLUGIN = Path(os.environ.get('TP_GODOT_PLUGIN', str(WORK.parent / 'godot-tp' / 'plugin')))
PROJECT = '''config_version=5

[application]

config/name="h2h-texturepacker"
config/features=PackedStringArray("4.4")

[display]

window/size/viewport_width=256
window/size/viewport_height=256
window/size/borderless=true

[editor_plugins]

enabled=PackedStringArray("res://addons/codeandweb.texturepacker/plugin.cfg")

[rendering]

renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
'''


def run_set(s, case):
    src = WORK / 'engine' / 'tp' / s / case
    proj = WORK / 'engine' / 'godot-tp' / s / case
    if proj.exists():
        shutil.rmtree(proj)
    proj.mkdir(parents=True)
    shutil.copytree(PLUGIN / 'addons', proj / 'addons')
    for f in ('atlas.png', 'atlas.tpsheet'):
        shutil.copy2(src / f, proj / f)
    (proj / 'project.godot').write_text(PROJECT, encoding='utf-8')
    (proj / '_verify').mkdir()
    shutil.copy2(Path(__file__).with_name('godot_tp_probe.gd'), proj / '_verify' / 'godot_tp_probe.gd')
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    log = []
    # two import passes: the first registers the plugin's importer, the second imports the sheet with it
    for _ in range(2):
        r = subprocess.run([GODOT, '--headless', '--path', str(proj), '--import'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600, creationflags=flags)
        log.append(r.stdout[-1500:] + r.stderr[-1500:])
    r = subprocess.run([GODOT, '--path', str(proj), '--script', 'res://_verify/godot_tp_probe.gd', '--rendering-driver', 'opengl3',
                        '--window-position', '0,0', '--resolution', '256x256'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600, creationflags=flags)
    log.append(r.stdout[-1500:] + r.stderr[-1500:])
    rep_path = proj / '_verify' / 'out' / 'report.json'
    if not rep_path.exists():
        return {'set': s, 'case': case, 'error': 'no probe report', 'log': log}
    rep = json.loads(rep_path.read_text(encoding='utf-8'))
    imp = (proj / 'atlas.png.import').read_text() if (proj / 'atlas.png.import').exists() else ''
    sources = {f.stem: f for f in sorted((SETS / s).glob('*.png'))}
    exact = within = 0
    bad = []
    for sp in rep['sprites']:
        cap = unpremultiply(Image.open(proj / '_verify' / 'out' / sp['png']))
        want = Image.open(sources[sp['name']]).convert('RGBA')
        strict = diff(want, cap, tolerance=0)
        loose = diff(want, cap, tolerance=2)
        exact += strict['ok']
        within += loose['ok']
        if not loose['ok']:
            bad.append({'name': sp['name'], 'size': strict['size'], 'differing': loose['differing'], 'maxDelta': loose['maxDelta']})
    return {'set': s, 'case': case, 'sprites': len(rep['sprites']), 'frames': len(sources), 'exact_strict': exact, 'within_harness_tolerance': within,
            'bad': bad[:5], 'animations': rep['animations'], 'errors': rep['errors'],
            'fix_alpha_border': 'process/fix_alpha_border=true' in imp, 'filter_note': 'project default (Linear)', 'godot': rep.get('godot', {}).get('string')}


def main():
    res = []
    for s in ['ninja', 'archer', 'samurai', 'toon']:
        r = run_set(s, 'godot')
        res.append(r)
        print(s, {k: r.get(k) for k in ('sprites', 'frames', 'exact_strict', 'within_harness_tolerance', 'fix_alpha_border', 'error')},
              [a['name'] for a in r.get('animations', [])], r.get('bad', [])[:2], flush=True)
    (WORK / 'engine' / 'godot-tp.json').write_text(json.dumps(res, indent=1))


if __name__ == '__main__':
    main()
