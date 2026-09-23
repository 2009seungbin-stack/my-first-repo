"""Defold side of the engine-verify harness: BUILDS the Studio Defold export with Defold's own
command-line builder (bob.jar 1.13.1 on a portable JDK 25, both cached in NERULIO_ENGINE_CACHE).

A throw-away project gets game.project, a collection with one game object whose Sprite component
uses the exported .atlas (or .tilesource) and its first animation, plus the bundle's own
`assets/<name>/` folder. `bob.jar build` must succeed. The built texture set (`.texturesetc`, a
protobuf) is then decoded field by field: every animation's id and frame count, and — from the
built texture (`.texturec`, raw RGBA when no texture profile compresses it) and the texture set's
per-frame UV rectangles — every frame's pixels as the Defold runtime would sample them. Defold is
not started (there is no headless renderer), so this is "built and read back", not "drawn".
"""
from __future__ import annotations
import json, os, re, shutil, subprocess, struct
from pathlib import Path

CACHE = Path(os.environ.get('NERULIO_ENGINE_CACHE', Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'nerulio-engine-verify'))
BOB = CACHE / 'bob.jar'
JAVA = CACHE / 'jdk-25' / 'bin' / ('java.exe' if os.name == 'nt' else 'java')


def version() -> str | None:
    return '1.13.1' if BOB.exists() and JAVA.exists() else None


# ---------------------------------------------------------------- protobuf (wire format only)

def _varint(b: bytes, i: int):
    v = s = 0
    while True:
        c = b[i]; i += 1
        v |= (c & 0x7f) << s; s += 7
        if c < 0x80:
            return v, i


def fields(b: bytes) -> list[tuple[int, int, object]]:
    """Top-level (field number, wire type, value) of a protobuf message; length-delimited values are bytes."""
    out, i = [], 0
    while i < len(b):
        key, i = _varint(b, i)
        f, wt = key >> 3, key & 7
        if wt == 0:
            v, i = _varint(b, i)
        elif wt == 1:
            v = b[i:i + 8]; i += 8
        elif wt == 2:
            n, i = _varint(b, i); v = b[i:i + n]; i += n
        elif wt == 5:
            v = b[i:i + 4]; i += 4
        else:
            raise ValueError(f'wire type {wt}')
        out.append((f, wt, v))
    return out


def _floats(v) -> list[float]:
    if isinstance(v, bytes) and len(v) % 4 == 0:
        return list(struct.unpack(f'<{len(v) // 4}f', v))
    return []


# ---------------------------------------------------------------- run

GAME_PROJECT = '''[project]
title = nerulio-engine-verify

[bootstrap]
main_collection = /main/main.collectionc

[input]
game_binding = /builtins/input/all.input_bindingc
'''


def run(folder: Path, item: dict, work: Path) -> dict:
    if not version():
        return {'errors': [f'UNVERIFIED: bob.jar or JDK 25 missing under {CACHE}'], 'built': False}
    res_file = folder / item['file']
    rel = '/' + res_file.relative_to(folder).as_posix()
    text = res_file.read_text(encoding='utf-8')
    anims = re.findall(r'animations \{\s*id: "([^"]+)"', text)
    proj = work / 'defold-proj'
    if proj.exists():
        shutil.rmtree(proj)
    shutil.copytree(folder, proj)
    (proj / 'game.project').write_text(GAME_PROJECT, encoding='utf-8')
    main = proj / 'main'
    main.mkdir(exist_ok=True)
    (main / 'v.sprite').write_text(f'tile_set: "{rel}"\ndefault_animation: "{anims[0] if anims else ""}"\n'
                                   'material: "/builtins/materials/sprite.material"\nblend_mode: BLEND_MODE_ALPHA\n', encoding='utf-8')
    (main / 'v.go').write_text('components {\n  id: "sprite"\n  component: "/main/v.sprite"\n}\n', encoding='utf-8')
    (main / 'main.collection').write_text('name: "main"\ninstances {\n  id: "v"\n  prototype: "/main/v.go"\n}\nscale_along_z: 0\n', encoding='utf-8')
    p = subprocess.run([str(JAVA), '-jar', str(BOB), '-r', str(proj), 'build'], capture_output=True, text=True, encoding='utf-8', errors='replace',
                       timeout=600, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    (work / 'bob.log').write_text(p.stdout + '\n' + p.stderr, encoding='utf-8')
    out = {'version': '1.13.1', 'errors': [], 'built': False, 'animations': {}}
    if p.returncode != 0:
        errs = [l for l in (p.stdout + p.stderr).splitlines() if 'ERROR' in l or 'error' in l.lower()][:8]
        out['errors'].append(f'bob.jar build failed (exit {p.returncode}): ' + ' | '.join(errs)[:900])
        return out
    stem = res_file.stem
    suffix = '.a.texturesetc' if res_file.suffix == '.atlas' else '.t.texturesetc'
    built = proj / 'build' / 'default' / res_file.relative_to(folder).parent / (stem + suffix)
    if not built.exists():
        cand = list((proj / 'build').rglob('*' + suffix))
        built = cand[0] if cand else built
    if not built.exists():
        out['errors'].append(f'bob.jar reported success but wrote no {suffix}')
        return out
    out['built'] = built.relative_to(proj).as_posix()
    ts = fields(built.read_bytes())
    # TextureSet (texture_set_ddf.proto): 1 texture path, 2 width? … animations are the repeated
    # sub-messages whose field 1 is an animation id; start/end are fields 4/5.
    tex_path = next((v.decode() for f, wt, v in ts if f == 1 and wt == 2), None)
    for f, wt, v in ts:
        if wt != 2:
            continue
        try:
            sub = fields(v)
        except Exception:
            continue
        ids = [x for (ff, ww, x) in sub if ff == 1 and ww == 2]
        if not ids:
            continue
        try:
            name = ids[0].decode('utf-8')
        except UnicodeDecodeError:
            continue
        if name in anims:
            nums = {ff: x for (ff, ww, x) in sub if ww == 0}
            out['animations'][name] = {'start': nums.get(4), 'end': nums.get(5), 'frames': (nums.get(5) or 0) - (nums.get(4) or 0),
                                       'fps': nums.get(6), 'playback': nums.get(7)}
    out['texture'] = tex_path
    try:
        _frames(proj, ts, tex_path, out, work)
    except Exception as e:  # the build result stands; the pixel read-back is reported as missing
        out['errors'].append(f'could not read the built texture back: {type(e).__name__}: {e}')
    return out


def _frames(proj: Path, ts, tex_path: str, out: dict, work: Path) -> None:
    """Cut every animation frame out of the BUILT texture with the built UVs.

    Measured on bob.jar 1.13.1 output: `.texturec` = u32 LE header length, a TextureImage header
    (width, height, format 2 = RGBA, data size) and then raw RGBA rows stored bottom-up (OpenGL
    order). TextureSet field 13 is frame_indices, field 14 tex_coords (4 UV corners per frame in the
    order bottom-left, top-left, top-right, bottom-right of the sprite, v up). A frame is sampled by
    mapping each sprite pixel through those corners, so rotated placements come back upright."""
    from PIL import Image
    b = (proj / 'build' / 'default' / tex_path.lstrip('/')).read_bytes()
    n = struct.unpack('<I', b[:4])[0]
    img = dict((f, v) for f, wt, v in fields(next(v for f, wt, v in fields(b[4:4 + n]) if f == 1)) if wt == 0)
    W, H = img[1], img[2]
    if img.get(7) != 2:
        raise ValueError(f'texture format {img.get(7)} is not raw RGBA')
    tex = Image.frombytes('RGBA', (W, H), b[4 + n:4 + n + W * H * 4]).transpose(Image.FLIP_TOP_BOTTOM)
    indices = [v for f, wt, v in ts if f == 13 and wt == 0]
    packed = [v for f, wt, v in ts if f == 13 and wt == 2]
    if packed:
        for v in packed:
            i = 0
            while i < len(v):
                x, i = _varint(v, i); indices.append(x)
    uv = []
    for f, wt, v in ts:
        if f == 14 and wt == 2:
            uv.extend(_floats(v))
    dest = work / 'defold'
    dest.mkdir(parents=True, exist_ok=True)
    frames, pngs, anims = [], {}, {}
    entries = []
    for f, wt, v in ts:
        if f != 5 or wt != 2:
            continue
        sub = fields(v)
        name = next(x for ff, ww, x in sub if ff == 1).decode()
        nums = {ff: x for ff, ww, x in sub if ww == 0}
        entries.append((name, nums))
    for name, nums in entries:
        if name not in out['animations']:
            continue
        steps = []
        for k in range(nums[4], nums[5]):
            fi = indices[k]
            if fi not in pngs:
                w, h = nums[2], nums[3]
                c = uv[fi * 8:fi * 8 + 8]
                (blx, bly), (tlx, tly), (trx, try_) = (c[0], c[1]), (c[2], c[3]), (c[4], c[5])
                cut = Image.new('RGBA', (w, h))
                px, src = cut.load(), tex.load()
                for yy in range(h):
                    for xx in range(w):
                        fx, fy = (xx + .5) / w, (yy + .5) / h
                        u = tlx + fx * (trx - tlx) + fy * (blx - tlx)
                        vv = tly + fx * (try_ - tly) + fy * (bly - tly)
                        sx, sy = min(W - 1, int(u * W)), min(H - 1, int((1 - vv) * H))
                        px[xx, yy] = src[sx, sy]
                p = dest / f'frame_{fi:04d}.png'
                cut.save(p)
                pngs[fi] = str(p)
                frames.append({'name': f'#{fi}', 'png': str(p)})
            steps.append({'name': f'#{fi}', 'png': pngs[fi], 'durationMs': 1000 / nums[6] if nums.get(6) else None})
        anims[name] = {'fps': nums.get(6), 'loop': nums.get(7) in (3, 4, 5), 'frames': steps}
    out['frames'] = frames
    out['engine_animations'] = anims
