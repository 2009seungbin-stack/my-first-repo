"""Godot 4 side of the engine-verify harness.

Builds a throw-away Godot project around an unpacked bundle, runs `--import`, then runs
godot/probe.gd with a real renderer (a small window opens for a few seconds: a --headless run uses
a dummy renderer that cannot draw). The probe loads the export through the helper the bundle
ships and writes report.json + PNGs; this module turns that into field-level checks.
"""
from __future__ import annotations
import json, os, shutil, subprocess
from pathlib import Path
from ev_common import HERE, Result, unpremultiply

DEFAULT_GODOT = os.environ.get('GODOT_BIN', r'C:\Users\2009s\Desktop\Godot_v4.7.2-stable_win64_console.exe')

PROJECT = '''config_version=5

[application]

config/name="nerulio-engine-verify"
config/features=PackedStringArray("4.4")

[display]

window/size/viewport_width={w}
window/size/viewport_height={h}
window/size/borderless=true

[rendering]

renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
'''
# Nothing else is set: the texture filter and import defaults are what a new project gets, because
# that is what the person who downloads the bundle will have.


def godot_version(godot: str) -> str:
    try:
        return subprocess.run([godot, '--version'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60).stdout.strip()
    except Exception as e:
        return f'unavailable ({e})'


def run_probe(project: Path, godot: str, job: dict, log, window=(512, 512), timeout=600) -> dict | None:
    """Writes the probe and job into an already-populated project folder and runs it."""
    (project / 'project.godot').write_text(PROJECT.format(w=window[0], h=window[1]), encoding='utf-8')
    verify = project / '_verify'
    verify.mkdir(exist_ok=True)
    shutil.copy2(HERE / 'godot' / 'probe.gd', verify / 'probe.gd')
    (verify / 'job.json').write_text(json.dumps(job, indent=1), encoding='utf-8')
    out = verify / 'out'
    if out.exists():
        shutil.rmtree(out)
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    imp = subprocess.run([godot, '--headless', '--path', str(project), '--import'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout, creationflags=flags)
    log.write(f'$ godot --headless --path {project} --import  (exit {imp.returncode})\n{imp.stdout[-4000:]}\n{imp.stderr[-4000:]}\n')
    run = subprocess.run([godot, '--path', str(project), '--script', 'res://_verify/probe.gd', '--rendering-driver', 'opengl3',
                          '--window-position', '0,0', '--resolution', f'{window[0]}x{window[1]}'],
                         capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout, creationflags=flags)
    log.write(f'$ godot --path {project} --script res://_verify/probe.gd  (exit {run.returncode})\n{run.stdout[-8000:]}\n{run.stderr[-8000:]}\n')
    report = out / 'report.json'
    if not report.exists():
        return None
    data = json.loads(report.read_text(encoding='utf-8'))
    data['_out'] = str(out)
    # The viewport is cleared to transparent, so blended texels come back premultiplied: undo that
    # (see ev_common.unpremultiply). Opaque pixels are untouched.
    from PIL import Image
    for png in out.glob('*.png'):
        unpremultiply(Image.open(png)).save(png)
    data['_stderr_errors'] = [l for l in (run.stdout + run.stderr).splitlines() if l.startswith(('ERROR', 'SCRIPT ERROR'))][:20]
    return data


def job_for(item: dict, expect: dict) -> dict | None:
    kind = item['kind']
    if kind == 'nerulio-sprite-godot':
        return {'mode': 'spriteframes', 'json': 'res://' + item['json'], 'scale': (expect.get('sprite') or {}).get('scale', 4)}
    if kind == 'nerulio-tileset-godot':
        return {'mode': 'tileset', 'json': 'res://' + item['json'], 'importer': 'res://' + item['importer'] if item.get('importer') else 'res://nerulio_tileset_import.gd',
                'paint': (expect.get('tileset') or {}).get('paint', [])}
    if kind in ('bmfont-text', 'bmfont-xml', 'bmfont-binary', 'font-file'):
        f = expect.get('font') or {}
        return {'mode': 'font', 'font': 'res://' + item.get('fnt', item.get('font')), 'chars': list(f.get('chars', {}).keys()),
                'size': f.get('size', 16), 'sample': f.get('sample', 'Hello')}
    if kind == 'image':
        return {'mode': 'texture', 'texture': 'res://' + item['image'], 'scale': (expect.get('texture') or {}).get('scale', 1)}
    return None


NOT_GODOT = {
    'nerulio-godot-json': ('FAIL', 'the bundle is labelled Godot 4 but ships no importer; Godot has no built-in loader for this JSON'),
    'nerulio-envelope': ('N/A', 'Nerulio generic/Unity envelope: no Godot importer is claimed'),
    'texturepacker-hash': ('N/A', 'Godot 4 has no built-in TexturePacker JSON importer'),
    'texturepacker-array': ('N/A', 'Godot 4 has no built-in TexturePacker JSON importer'),
    'aseprite-hash': ('N/A', 'Godot 4 has no built-in Aseprite JSON importer'),
    'aseprite-array': ('N/A', 'Godot 4 has no built-in Aseprite JSON importer'),
    'starling-xml': ('N/A', 'Godot 4 has no built-in Starling XML importer'),
    'unity-json': ('N/A', 'Unity target'),
    'nerulio-sprite-unity': ('N/A', 'Sprite Lab Unity target'),
}
