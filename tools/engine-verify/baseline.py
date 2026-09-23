"""Baseline: today's Nerulio exporters, fed REAL corpus assets through their own UI, imported into
real engines by tools/engine-verify, judged against the corpus ground truth.

    python tools/engine-verify/baseline.py [--port 4441] [--out test-results/engine-baseline]
                                          [--only <case-id-prefix>] [--skip-export] [--engines ...]

Phase 1 starts `node tools/serve.mjs` on --port and drives each Lab in Chromium the way a person
would (drop the file, keep the defaults unless the case says otherwise, press the download
button); every ZIP is kept in <out>/bundles. The server is stopped. Phase 2 runs verify.py on
every bundle (Godot opens a small window per run) with expectations cut from the ORIGINAL asset.
Phase 3 writes <out>/baseline.json and <out>/baseline.md (the table in docs/ENGINE-VERIFY.md).

Needs: the corpus (python tools/fetch-game-corpus.py), `npm ci --prefix tools/engine-verify/web`,
Godot 4 (GODOT_BIN), Python Playwright + Pillow.
"""
from __future__ import annotations
import argparse, json, os, shutil, subprocess, sys, time, urllib.request, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import verify as V  # noqa: E402
import expect_from_corpus as X  # noqa: E402

C = X.CORPUS
ASCII = ''.join(chr(c) for c in range(0x20, 0x7f))


# ---------------------------------------------------------------- the cases
# Each case: which Lab, which corpus file(s), how the Lab is driven, what the engines should see.
# `drive` is the UI recipe; `expect` builds the expectation from the source asset's truth.

def sprite_lab_case(cid, asset, target, *, grid=None, animate=True, engines=None, note=''):
    return {'id': cid, 'exporter': f'Sprite Lab ({target})', 'asset': asset, 'lab': 'sprite-lab', 'target': target,
            'grid': grid, 'animate': animate,
            'engines': engines or (['godot'] if target == 'godot' else ['unity'] if target == 'unity' else ['phaser3', 'phaser4', 'pixi8']),
            'note': note}


def ssm_case(cid, frames, fmt, *, rotate=False, engines=None, note=''):
    return {'id': cid, 'exporter': f'sprite-sheet-maker ({fmt}{", rotate" if rotate else ""})', 'asset': frames[0].rsplit('/', 1)[0] + '/',
            'frames': frames, 'lab': 'ssm', 'format': fmt, 'rotate': rotate,
            'engines': engines or (['godot'] if fmt == 'godot' else ['phaser3', 'phaser4'] if fmt in ('xml', 'json-array') else ['phaser3', 'phaser4', 'pixi8']),
            'note': note}


def tile_case(cid, asset, kind, note=''):
    return {'id': cid, 'exporter': f'Tile Lab Godot pack ({kind})', 'asset': asset, 'lab': 'tile-lab', 'kind': kind, 'engines': ['godot'], 'note': note}


def font_case(cid, asset, cell, baseline, note=''):
    return {'id': cid, 'exporter': 'UI Lab bitmap font (grid)', 'asset': asset, 'lab': 'font', 'cell': cell, 'baseline': baseline,
            'engines': ['godot', 'phaser3', 'pixi8'], 'note': note}


def reference_case(cid, folder_files, expect_asset, kind_note):
    """Known-good data made by real tools (Aseprite, TexturePacker, BMFont): the harness itself must
    PASS on these, otherwise its FAILs mean nothing."""
    return {'id': cid, 'exporter': f'reference: {kind_note}', 'asset': expect_asset, 'lab': 'reference', 'files': folder_files,
            'engines': ['phaser3', 'phaser4', 'pixi8'] if not expect_asset.startswith('fonts/') else ['godot', 'pixi8', 'phaser3']}


NINJA = [f'sprites/oga-ninja/1x/run_{i}.png' for i in range(6)]
ARCHER = [f'sprites/oga-skeleton-archer/attack-frames/attack ({i}).png' for i in range(1, 11)]
CASES = [
    reference_case('ref-aseprite-torch', ['sprites-normal/oga-pixel-torch/Torch_Hash.json', 'sprites-normal/oga-pixel-torch/Torch_Sheet.png'],
                   'sprites-normal/oga-pixel-torch/Torch_Sheet.png', 'Aseprite JSON hash (torch, 6 frames)'),
    reference_case('ref-starling-toon', ['sprites/kenney-toon-characters/character_femaleAdventurer_sheet.xml', 'sprites/kenney-toon-characters/character_femaleAdventurer_sheet.png'],
                   'sprites/kenney-toon-characters/character_femaleAdventurer_sheet.png', 'Kenney Starling XML (toon, 45 frames)'),
    sprite_lab_case('sl-samurai-auto-godot', 'sprites/oga-samurai/samurai.png', 'godot', note='48 px grid, 60 frames, 1-px detached blood; Auto slice, default animation'),
    sprite_lab_case('sl-samurai-grid-godot', 'sprites/oga-samurai/samurai.png', 'godot', grid={'cellW': 48, 'cellH': 48}, note='grid typed by hand (best case)'),
    sprite_lab_case('sl-samurai-grid-noanim-godot', 'sprites/oga-samurai/samurai.png', 'godot', grid={'cellW': 48, 'cellH': 48}, animate=False,
                    note='slice then export directly, never opening Animate'),
    sprite_lab_case('sl-samurai-grid-generic', 'sprites/oga-samurai/samurai.png', 'generic', grid={'cellW': 48, 'cellH': 48}, note='the Generic JSON handed to web engines'),
    sprite_lab_case('sl-samurai-grid-unity', 'sprites/oga-samurai/samurai.png', 'unity', grid={'cellW': 48, 'cellH': 48},
                    note='the Unity target (C# importer) run in Unity batch mode'),
    sprite_lab_case('sl-toon-auto-godot', 'sprites/kenney-toon-characters/character_femaleAdventurer_sheet.png', 'godot', note='96x128 cells, 45 frames'),
    sprite_lab_case('sl-samurai-magenta-grid-godot', 'sprites/derived/samurai_magenta_m4_s2.png', 'godot',
                    grid={'cellW': 48, 'cellH': 48, 'offsetX': 4, 'offsetY': 4, 'spacingX': 2, 'spacingY': 2, 'key': 'auto'},
                    note='magenta key + margin 4 + spacing 2, all typed, key = Auto'),
    sprite_lab_case('sl-rogue-magenta-auto-godot', 'sprites/kenney-roguelike-characters/roguelikeChar_magenta.png', 'godot', note='real magenta-keyed 16 px sheet, 448 frames, defaults'),
    sprite_lab_case('sl-hit-4096-auto-godot', 'sprites/oga-hit-effect/hit-yellow.png', 'godot', note='4096x4096 FX sheet, 14 frames with detached sparks'),
    ssm_case('ssm-ninja-hash', NINJA, 'json-hash', note='6 loose frames run_0..5'),
    ssm_case('ssm-ninja-array', NINJA, 'json-array'),
    ssm_case('ssm-ninja-xml', NINJA, 'xml'),
    ssm_case('ssm-ninja-godot', NINJA, 'godot'),
    ssm_case('ssm-ninja-hash-rotate', NINJA, 'json-hash', rotate=True, note='rotation allowed'),
    ssm_case('ssm-archer-hash', list(reversed(sorted(ARCHER))), 'json-hash', note='10 frames of 381x554 given in reverse-lexicographic order; natural order expected after "sort by name"'),
    ssm_case('ssm-archer-hash-rotate', list(reversed(sorted(ARCHER))), 'json-hash', rotate=True, note='the same 10 frames with rotation allowed'),
    ssm_case('ssm-archer-xml', list(reversed(sorted(ARCHER))), 'xml', note='Starling/Sparrow XML of the same frames'),
    tile_case('tl-gms47-blob', 'tiles/oga-gms-autotile-templates/gms_47autotile_template.png', 'blob47', 'GameMaker 47 order'),
    tile_case('tl-cave47-blob', 'tiles/oga-cave-platformer-47/autotile47.png', 'blob47', 'real art, GameMaker order, 64 px'),
    tile_case('tl-caeles7x7-blob', 'tiles/oga-seamless-template-ii/template7x7_with_indices.png', 'blob47', 'caeles 7x7 order'),
    tile_case('tl-wangblob-blob', 'tiles/tiled-wangblob/wangblob.png', 'blob47', 'cr31 wang-blob 7x7 order'),
    tile_case('tl-edge16', 'tiles/oga-tileset-templates/Wang S-E2.png', 'edge16', '2-edge Wang template'),
    tile_case('tl-tinydungeon-blob', 'maps/kenney-tiny-dungeon/Tilemap/tilemap.png', 'blob47', 'Kenney 16 px + 1 px spacing (not an autotile sheet): structural fields only'),
    font_case('font-bellanger', 'fonts/oga-bitmap-font-bellanger/font.png', (8, 12), 9, 'ASCII 8x12 grid, white glyphs with outline'),
    font_case('font-intrepid', 'fonts/oga-intrepid-font/intrepid.png', (8, 8), 7, 'ASCII 8x8 grid, black on opaque white (needs keying)'),
    reference_case('ref-bmfont-cozette', ['fonts/cozette-bmfont/Cozette-standard.fnt', 'fonts/cozette-bmfont/Cozette-standard.png'],
                   'fonts/cozette-bmfont/Cozette-standard.fnt', 'BMFont text .fnt (Cozette)'),
]


# ---------------------------------------------------------------- Studio Pack & Export (P1b)
# The same corpus assets and engines as the Sprite Lab / sprite-sheet-maker rows above, driven
# through /game/studio/: import → (Viewer grid for sheets) → Pack & Export tab → Export for <target>.
# `before` names the baseline row(s) the case answers.

def studio_case(cid, target, *, files=None, sheet=None, grid=None, engines, before='', note='', expect_anim=None):
    return {'id': cid, 'exporter': f'Studio Pack & Export ({target})', 'asset': sheet or files[0].rsplit('/', 1)[0] + '/', 'lab': 'studio-pack',
            'target': target, 'files': files, 'sheet': sheet, 'grid': grid, 'engines': engines, 'before': before, 'note': note, 'expect_anim': expect_anim}


SAMURAI, TOON = 'sprites/oga-samurai/samurai.png', 'sprites/kenney-toon-characters/character_femaleAdventurer_sheet.png'
G48 = {'w': 48, 'h': 48}
STUDIO_CASES = [
    studio_case('sp-samurai-godot', 'godot4', sheet=SAMURAI, grid=G48, engines=['godot'], before='sl-samurai-auto-godot, sl-samurai-grid-godot', note='Viewer grid 48, no tags (implicit animation)'),
    studio_case('sp-samurai-noanim-godot', 'godot4', sheet=SAMURAI, grid=G48, engines=['godot'], before='sl-samurai-grid-noanim-godot', note='export straight after cutting: the implicit animation is shown before export'),
    studio_case('sp-samurai-json', 'json', sheet=SAMURAI, grid=G48, engines=['phaser3', 'phaser4', 'pixi8'], before='sl-samurai-grid-generic'),
    studio_case('sp-samurai-unity', 'unity', sheet=SAMURAI, grid=G48, engines=['unity'], before='sl-samurai-grid-unity'),
    studio_case('sp-toon-godot', 'godot4', sheet=TOON, grid={'w': 96, 'h': 128}, engines=['godot'], before='sl-toon-auto-godot'),
    studio_case('sp-samurai-magenta-godot', 'godot4', sheet='sprites/derived/samurai_magenta_m4_s2.png', grid={'w': 48, 'h': 48, 'ox': 4, 'oy': 4, 'sx': 2, 'sy': 2},
                engines=['godot'], before='sl-samurai-magenta-grid-godot', note='margin/spacing typed; the colour key belongs to the Sprite import (P1a), not applied here'),
    studio_case('sp-hit-4096-godot', 'godot4', sheet='sprites/oga-hit-effect/hit-yellow.png', grid={'w': 1024, 'h': 1024}, engines=['godot'], before='sl-hit-4096-auto-godot', note='4096² sheet, 1024 px cells'),
    studio_case('sp-ninja-phaser', 'phaser', files=NINJA, engines=['phaser3', 'phaser4'], before='ssm-ninja-hash (phaser)'),
    studio_case('sp-ninja-pixi', 'pixi', files=NINJA, engines=['pixi8'], before='ssm-ninja-hash (pixi8), ssm-ninja-hash-rotate (pixi8)', note='Pixi preset allows rotation'),
    studio_case('sp-ninja-aseprite-array', 'aseprite-json-array', files=NINJA, engines=['phaser3', 'phaser4'], before='ssm-ninja-array'),
    studio_case('sp-ninja-starling', 'starling', files=NINJA, engines=['phaser3', 'phaser4'], before='ssm-ninja-xml', note='trimmed XML'),
    studio_case('sp-ninja-sparrow-p3', 'sparrow-phaser3', files=NINJA, engines=['phaser3', 'phaser4'], before='ssm-ninja-xml', note='Phaser 3 preset (trim off)'),
    studio_case('sp-ninja-godot', 'godot4', files=NINJA, engines=['godot'], before='ssm-ninja-godot'),
    studio_case('sp-ninja-aseprite-hash', 'aseprite-json', files=NINJA, engines=['phaser3', 'phaser4', 'pixi8'], before='(reference-style Aseprite JSON)'),
    studio_case('sp-archer-phaser', 'phaser', files=ARCHER, engines=['phaser3', 'phaser4'], before='ssm-archer-hash, ssm-archer-hash-rotate (phaser)', note='files given in natural order'),
    studio_case('sp-archer-pixi', 'pixi', files=ARCHER, engines=['pixi8'], before='ssm-archer-hash, ssm-archer-hash-rotate (pixi8)', note='rotation allowed'),
    studio_case('sp-archer-starling', 'starling', files=ARCHER, engines=['phaser3', 'phaser4'], before='ssm-archer-xml'),
    studio_case('sp-archer-sparrow-p3', 'sparrow-phaser3', files=ARCHER, engines=['phaser3', 'phaser4'], before='ssm-archer-xml'),
    studio_case('sp-ninja-unity', 'unity', files=NINJA, engines=['unity'], before='(new: Unity clips)'),
    studio_case('sp-ninja-love', 'love', files=NINJA, engines=['love'], before='(new: no LÖVE exporter before)'),
    studio_case('sp-ninja-defold', 'defold', files=NINJA, engines=['defold'], before='(new: no Defold exporter before)'),
    studio_case('sp-samurai-defold', 'defold', sheet=SAMURAI, grid=G48, engines=['defold'], before='(new)'),
    studio_case('sp-ninja-aseprite-file', 'aseprite', files=NINJA, engines=['aseprite'], before='(new: .aseprite opened by the Aseprite CLI)'),
    studio_case('sp-ninja-gif', 'gif', files=NINJA, engines=['pillow'], before='(new)', expect_anim={'durationsMs': [80] * 6}),
    studio_case('sp-ninja-apng', 'apng', files=NINJA, engines=['pillow'], before='(new)', expect_anim={'durationsMs': [83] * 6}),
]
CASES += STUDIO_CASES


# ---------------------------------------------------------------- phase 1: drive the Labs

def start_server(port: int):
    env = {**os.environ, 'PORT': str(port)}
    log = open(OUT / 'server.log', 'w')
    proc = subprocess.Popen(['node', 'tools/serve.mjs'], cwd=ROOT, env=env, stdout=log, stderr=log,
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    for _ in range(150):
        try:
            urllib.request.urlopen(f'http://127.0.0.1:{port}/en/', timeout=1)
            return proc
        except OSError:
            time.sleep(0.2)
    proc.kill()
    raise RuntimeError(f'the site server did not start on {port}')


def _download(page, selector, dest: Path, timeout=180000):
    with page.expect_download(timeout=timeout) as d:
        page.locator(selector).click()
    shutil.copy(d.value.path(), dest)
    return dest


def drive(case, page, base, dest: Path) -> dict:
    lab = case['lab']
    info = {}
    if lab == 'reference':
        with zipfile.ZipFile(dest, 'w') as z:
            for f in case['files']:
                z.write(C / f, Path(f).name)
        return {'made': 'zipped from the corpus as-is'}
    if lab == 'sprite-lab':
        page.goto(base + '/en/game/sprite-lab/', wait_until='networkidle')
        page.locator('#fileInput').set_input_files(str(C / case['asset']))
        page.locator('#labCanvas').wait_for(timeout=120000)
        g = case.get('grid')
        if g:
            page.locator('[data-action="lab-set"][data-key="mode"][data-value="grid"]').click(); page.wait_for_timeout(600)
            page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
            for k in ('cellW', 'cellH', 'offsetX', 'offsetY', 'spacingX', 'spacingY'):
                if k in g:
                    page.locator(f'[data-num="{k}"]').fill(str(g[k])); page.locator(f'[data-num="{k}"]').dispatch_event('change'); page.wait_for_timeout(250)
            if g.get('key'):
                page.select_option('[data-select="key"]', g['key']); page.wait_for_timeout(600)
        try:
            page.wait_for_function('()=>document.querySelectorAll(".slicer-box").length>0', timeout=90000)
        except Exception:
            info['slice'] = 'no frames after 90 s: ' + page.locator('#labInfo').inner_text()[:200]
        page.wait_for_timeout(800)
        info['frames_in_ui'] = page.locator('.slicer-box').count()
        if case.get('animate', True):
            page.locator('[data-action="lab-stage"][data-stage="animate"]').click(); page.wait_for_timeout(900)
        page.locator('[data-action="lab-stage"][data-stage="export"]').click(); page.wait_for_timeout(1500)
        page.locator(f'[data-key="target"][data-value="{case["target"]}"]').click(); page.wait_for_timeout(800)
        page.wait_for_function('()=>{const b=document.querySelector("#taskDownload");return b&&!b.disabled}', timeout=180000)
        _download(page, '#taskDownload', dest)
        return info
    if lab == 'ssm':
        page.goto(base + '/en/sprite-sheet-maker/', wait_until='networkidle')
        page.locator('#fileInput').set_input_files([str(C / f) for f in case['frames']])
        page.locator('#atlasCanvas').wait_for(timeout=60000); page.wait_for_timeout(500)
        page.locator('[data-action="atlas-sort"]').click(); page.wait_for_timeout(300)
        page.locator('.options-advanced').evaluate('d=>d.open=true')
        page.select_option('#atlasFormat', case['format']); page.wait_for_timeout(300)
        if case.get('rotate'):
            page.locator('#atlasRotate').check(); page.wait_for_timeout(500)
        page.wait_for_function('()=>{const b=document.querySelector("#atlasRun");return b&&!b.disabled}', timeout=60000)
        _download(page, '#atlasRun', dest)
        return info
    if lab == 'tile-lab':
        page.goto(base + f'/en/game/tile-lab/?stage=export&kind={case["kind"]}', wait_until='networkidle')
        page.locator('#fileInput').set_input_files(str(C / case['asset']))
        page.wait_for_function("()=>!!document.querySelector('.tl-stages')", timeout=60000); page.wait_for_timeout(1200)
        info['grid_in_ui'] = [page.locator(f'[data-option="{k}"]').input_value() for k in ('tileWidth', 'tileHeight', 'marginX', 'spacingX')] \
            if page.locator('[data-option="tileWidth"]').count() else None
        page.wait_for_function('()=>{const b=document.querySelector("#taskDownload");return b&&!b.disabled}', timeout=120000)
        _download(page, '#taskDownload', dest)
        return info
    if lab == 'font':
        page.goto(base + '/en/bitmap-font-maker/', wait_until='networkidle')
        page.locator('#fileInput').set_input_files(str(C / case['asset']))
        page.locator('#rc-chars').wait_for(timeout=60000); page.wait_for_timeout(300)
        cw, ch = case['cell']
        for field, value in [('#rc-cellW', str(cw)), ('#rc-cellH', str(ch)), ('#rc-baseline', str(case['baseline'])), ('#rc-chars', ASCII)]:
            page.locator(field).fill(value)
        page.wait_for_timeout(600)
        _download(page, '[data-action="ui-export-font"]', dest)
        return info
    if lab == 'studio-pack':
        return drive_studio(case, page, base, dest)
    raise ValueError(lab)


def drive_studio(case, page, base, dest: Path) -> dict:
    """The Studio as a user drives it: drop the file(s); for a sheet type the grid in the Viewer's
    grid panel and press Apply; open the Pack & Export tab; press Export next to the target."""
    info = {}
    page.goto(base + '/en/game/studio/', wait_until='networkidle')
    page.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"', timeout=60000)
    files = [str(C / f) for f in (case['files'] or [case['sheet']])]
    page.locator('input[type=file][multiple]').set_input_files(files)
    page.wait_for_function(f'()=>document.querySelectorAll(".st-asset").length>={len(files)}', timeout=120000)
    if case.get('grid'):
        g = {'ox': 0, 'oy': 0, 'sx': 0, 'sy': 0, **case['grid']}
        page.wait_for_selector('[data-grid="w"]', timeout=60000)
        page.wait_for_timeout(800)
        for k in ('w', 'h', 'ox', 'oy', 'sx', 'sy'):
            page.locator(f'[data-grid="{k}"]').fill(str(g[k]))
            page.locator(f'[data-grid="{k}"]').dispatch_event('change')
            page.wait_for_timeout(150)
        page.wait_for_function('()=>{const b=document.querySelector("[data-action=grid-apply]");return b&&!b.disabled}', timeout=60000)
        page.locator('[data-action="grid-apply"]').click()
        page.wait_for_selector('.st-grid-state[data-state="applied"]', timeout=180000)
        info['frames_cut'] = page.locator('.st-grid-state').inner_text()[:80]
    page.locator('[data-ws="pack"]').click()
    page.wait_for_selector('[data-pack="efficiency"]', timeout=300000)
    page.wait_for_function('()=>!document.querySelector("[data-action=pack-cancel]")', timeout=300000)
    info['atlas'] = page.locator('[data-pack="totals"]').inner_text()[:200]
    if page.locator('[data-pack="implicit"]').count():
        info['implicit'] = page.locator('[data-pack="implicit"]').inner_text()[:200]
    btn = page.locator(f'[data-export="{case["target"]}"]')
    page.wait_for_function(f'()=>{{const b=document.querySelector("[data-export=\\"{case["target"]}\\"]");return b&&!b.disabled}}', timeout=300000)
    _download(page, f'[data-export="{case["target"]}"]', dest, timeout=600000)
    page.wait_for_timeout(300)
    if page.locator('[data-pack="last-export"]').count():
        info['export_notes'] = page.locator('[data-pack="last-export"]').inner_text()[:400]
    return info


# ---------------------------------------------------------------- phase 2: expectations + engines

def expectation(case, work: Path) -> dict:
    lab = case['lab']
    if lab == 'sprite-lab' or (lab == 'reference' and case['asset'].endswith('.png')):
        e = X.sprite_grid(case['asset'], work / 'expected')
        e['sprite']['requireAnimations'] = lab == 'sprite-lab' and case['target'] == 'godot'
        if lab == 'reference':
            e['sprite']['order'] = False  # atlas files list frames by name, not in sheet reading order
        return e
    if lab == 'ssm':
        e = X.sprite_frames(sorted(case['frames'], key=lambda p: [int(t) if t.isdigit() else t for t in __import__('re').split(r'(\d+)', p)]), work / 'expected')
        return e
    if lab == 'tile-lab':
        return X.tileset(case['asset'])
    if lab == 'font':
        return X.font_grid(case['asset'], work / 'expected', ''.join(chr(c) for c in range(0x21, 0x7f)))
    if lab == 'reference' and case['asset'].endswith('.fnt'):
        return {'font': {'chars': _cozette_glyphs(work / 'expected'), 'size': 13}}
    if lab == 'studio-pack':
        return studio_expectation(case, work)
    return {}


# Which (target, engine) pairs carry animations the engine itself builds.
_ANIM = {'godot4': {'godot'}, 'unity': {'unity'}, 'phaser': {'phaser3', 'phaser4'}, 'pixi': {'pixi8'}, 'aseprite-json': {'phaser3', 'phaser4'},
         'aseprite-json-array': {'phaser3', 'phaser4'}, 'love': {'love'}, 'defold': {'defold'}, 'aseprite': {'aseprite'}, 'gif': {'pillow'}, 'apng': {'pillow'}}


def studio_expectation(case, work: Path) -> dict:
    """Frames cut from the ORIGINAL asset; with no tags the Studio exports one implicit animation of
    every frame (named after what the frame names share), which engines that read animations must play."""
    import re
    if case['sheet']:
        grid = None
        if case.get('grid'):
            g = case['grid']
            t = X.entry(case['sheet'])['truth']['grid']
            grid = {**t, 'cellW': g['w'], 'cellH': g['h'], 'marginX': g.get('ox', 0), 'marginY': g.get('oy', 0), 'spacingX': g.get('sx', 0), 'spacingY': g.get('sy', 0)}
        e = X.sprite_grid(case['sheet'], work / 'expected', grid=grid)
        name = re.sub(r'[^\w.-]+', '_', Path(case['sheet']).stem)
    else:
        e = X.sprite_frames(case['files'], work / 'expected')
        stems = [Path(f).stem for f in case['files']]
        p = stems[0]
        for s in stems:
            while p and not s.startswith(p):
                p = p[:-1]
        name = re.sub(r'[\s_\-.(]*\d*$', '', p).rstrip(' _-.(') or 'default'
    n = len(e['sprite']['frames'])
    if all(eng in _ANIM.get(case['target'], set()) for eng in case['engines']):
        e['sprite']['requireAnimations'] = True
        e['sprite']['animations'] = {name: {'count': n, 'frames': list(range(n)), **(case.get('expect_anim') or {})}}
    return e


def _cozette_glyphs(out: Path) -> dict:
    """Reference glyphs straight from the .fnt rectangles (the BMFont file is the ground truth)."""
    import re
    from PIL import Image
    fnt = (C / 'fonts/cozette-bmfont/Cozette-standard.fnt').read_text(encoding='utf-8')
    page = Image.open(C / 'fonts/cozette-bmfont/Cozette-standard.png').convert('RGBA')
    out.mkdir(parents=True, exist_ok=True)
    glyphs = {}
    for m in re.finditer(r'char id=(\d+)\s+x=(\d+)\s+y=(\d+)\s+width=(\d+)\s+height=(\d+)', fnt):
        cid, x, y, w, h = map(int, m.groups())
        if 0x41 <= cid <= 0x5a or 0x61 <= cid <= 0x7a or 0x30 <= cid <= 0x39:
            p = out / f'glyph_{cid:04x}.png'
            page.crop((x, y, x + w, y + h)).save(p)
            glyphs[chr(cid)] = str(p)
    return glyphs


def main():
    global OUT
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--port', type=int, default=4441)
    ap.add_argument('--out', default=str(ROOT / 'test-results' / 'engine-baseline'))
    ap.add_argument('--only', action='append', default=[])
    ap.add_argument('--skip-export', action='store_true')
    ap.add_argument('--engines')
    ap.add_argument('--report-only', action='store_true', help='rewrite baseline.md from baseline.json')
    a = ap.parse_args()
    OUT = Path(a.out); (OUT / 'bundles').mkdir(parents=True, exist_ok=True)
    if a.report_only:
        return write_report(json.loads((OUT / 'baseline.json').read_text(encoding='utf-8')))
    cases = [c for c in CASES if not a.only or any(c['id'].startswith(o) for o in a.only)]
    made = json.loads((OUT / 'made.json').read_text(encoding='utf-8')) if (OUT / 'made.json').exists() else {}
    from playwright.sync_api import sync_playwright
    if not a.skip_export:
        server = start_server(a.port)
        try:
            with sync_playwright() as pw:
                b = pw.chromium.launch()
                for c in cases:
                    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
                    page = ctx.new_page()
                    dest = OUT / 'bundles' / f'{c["id"]}.zip'
                    t0 = time.time()
                    try:
                        made[c['id']] = {'ok': True, **drive(c, page, f'http://127.0.0.1:{a.port}', dest), 'seconds': round(time.time() - t0, 1)}
                    except Exception as e:
                        made[c['id']] = {'ok': False, 'error': f'{type(e).__name__}: {str(e)[:300]}', 'seconds': round(time.time() - t0, 1)}
                        dest.unlink(missing_ok=True)
                    print('EXPORT', c['id'], made[c['id']], flush=True)
                    ctx.close()
                b.close()
        finally:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
        (OUT / 'made.json').write_text(json.dumps(made, indent=1), encoding='utf-8')
    rows = json.loads((OUT / 'baseline.json').read_text(encoding='utf-8')) if (OUT / 'baseline.json').exists() and a.only else []
    rows = [r for r in rows if not any(r['case'] == c['id'] for c in cases)]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'])
        for c in cases:
            bundle = OUT / 'bundles' / f'{c["id"]}.zip'
            base_row = {'case': c['id'], 'exporter': c['exporter'], 'asset': c['asset'], 'note': c.get('note', ''), 'export': made.get(c['id'])}
            if not bundle.exists():
                rows.append({**base_row, 'engine': '-', 'status': 'FAIL', 'details': ['export failed: ' + str((made.get(c['id']) or {}).get('error'))]})
                print(f'FAIL       {c["id"]:32} -        {rows[-1]["details"][0]}', flush=True)
                continue
            work = OUT / 'runs' / c['id']
            if work.exists():
                shutil.rmtree(work)
            work.mkdir(parents=True)
            exp = expectation(c, work)
            (work / 'expect.json').write_text(json.dumps(exp, indent=1), encoding='utf-8')
            engines = a.engines.split(',') if a.engines else c['engines']
            for r in V.verify(bundle, exp, engines, work, a.port, browser=browser):
                details = r.failures() or [f'{ch.field}: {ch.actual}' for ch in r.checks if ch.ok][:6]
                if r.na:
                    details = [r.na]
                rows.append({**base_row, 'engine': r.engine, 'kind': r.info.get('kind'), 'status': r.status, 'details': details,
                             'checks': [ch.as_dict() for ch in r.checks], 'info': {k: v for k, v in r.info.items() if k in ('version', 'kind', 'renderer', 'frames', 'animations', 'font', 'tileset')}})
                print(f'{r.status:10} {c["id"]:32} {r.engine:8} {"; ".join(map(str, details))[:220]}', flush=True)
        browser.close()
    write_report(rows)


def write_report(rows):
    order = {c['id']: i for i, c in enumerate(CASES)}
    rows.sort(key=lambda r: order.get(r['case'], len(order)))  # stable: engines keep their order
    (OUT / 'baseline.json').write_text(json.dumps(rows, indent=1, default=str), encoding='utf-8')
    lines = ['| # | Asset | Export | Engine | Result | Details |', '|---|---|---|---|---|---|']
    for i, r in enumerate(rows, 1):
        det = '; '.join(str(d) for d in r['details'])[:300].replace('|', '\\|')
        lines.append(f'| {i} | `{r["asset"]}` | {r["exporter"]} | {r["engine"]} | **{r["status"]}** | {det} |')
    (OUT / 'baseline.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    counts = {}
    for r in rows:
        counts[r['status']] = counts.get(r['status'], 0) + 1
    print('BASELINE', json.dumps(counts), '->', OUT / 'baseline.md')


if __name__ == '__main__':
    main()
