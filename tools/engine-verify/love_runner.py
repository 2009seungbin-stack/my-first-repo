"""LÖVE 11 side of the engine-verify harness (Studio "LÖVE" export: a Lua table of quads plus the
nerulio_atlas.lua helper it ships).

LÖVE has no atlas format of its own, so the test is the shipped helper itself: a probe main.lua
`require`s the bundle's nerulio_atlas.lua, loads the exported table with `Atlas.load`, and draws
every frame with `atlas:draw(key, x, y)` into a Canvas (1x, each frame in its own slot, pivot at
slot + pivot so the frame canvas starts at the slot), then one frame at 4x the way a game draws
it, and steps every animation through the helper's own player (`atlas:play(name)`). The canvas is
read back with ImageData:encode and judged like every other engine (alpha blending onto a
transparent canvas leaves premultiplied colour, undone before comparison).

LÖVE 11.5 portable (lovec.exe) is cached in NERULIO_ENGINE_CACHE/love-11.5-win64. A window opens
for a moment (LÖVE needs a GL context to draw).
"""
from __future__ import annotations
import json, os, re, shutil, subprocess
from pathlib import Path
from ev_common import unpremultiply

CACHE = Path(os.environ.get('NERULIO_ENGINE_CACHE', Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'nerulio-engine-verify'))
LOVE = Path(os.environ.get('LOVE_BIN', CACHE / 'love-11.5-win64' / 'lovec.exe'))

PROBE = r'''
-- Nerulio engine-verify probe for LÖVE (NOT shipped). Drives the bundle's own nerulio_atlas.lua.
local Atlas = require("nerulio_atlas")
local JOB = %s
local function q(s) return '"' .. tostring(s):gsub('\\', '\\\\'):gsub('"', '\\"') .. '"' end
local function enc(v)
  local t = type(v)
  if t == "table" then
    if #v > 0 or next(v) == nil then local p = {} for i, x in ipairs(v) do p[i] = enc(x) end return "[" .. table.concat(p, ",") .. "]" end
    local p = {} for k, x in pairs(v) do p[#p + 1] = q(k) .. ":" .. enc(x) end return "{" .. table.concat(p, ",") .. "}"
  elseif t == "string" then return q(v) elseif t == "boolean" then return v and "true" or "false" elseif v == nil then return "null" end
  return tostring(v)
end
function love.load()
  love.filesystem.setIdentity(JOB.identity)
  local report = { version = table.concat({love.getVersion()}, "."), errors = {}, frames = {}, animations = {}, slots = {} }
  local ok, err = pcall(function()
    local atlas = Atlas.load(JOB.lua)
    local data = atlas.data
    local keys = data.order
    local gap, maxw, maxh = 0, 1, 1
    for _, k in ipairs(keys) do local f = data.frames[k]; maxw = math.max(maxw, f.sw); maxh = math.max(maxh, f.sh) end
    gap = math.max(maxw, maxh)
    local cols = math.max(1, math.floor(4096 / (maxw + gap)))
    local W = gap + math.min(#keys, cols) * (maxw + gap)
    local H = gap + math.ceil(#keys / cols) * (maxh + gap)
    local canvas = love.graphics.newCanvas(W, H)
    love.graphics.setCanvas(canvas); love.graphics.clear(0, 0, 0, 0); love.graphics.setColor(1, 1, 1, 1)
    for i, k in ipairs(keys) do
      local f = data.frames[k]
      local x = gap + ((i - 1) %% cols) * (maxw + gap)
      local y = gap + math.floor((i - 1) / cols) * (maxh + gap)
      atlas:draw(k, x + f.px, y + f.py)
      report.slots[i] = { x = x, y = y, w = f.sw, h = f.sh }
      report.frames[i] = { name = k, sourceSize = { f.sw, f.sh }, region = { f.x, f.y, f.w, f.h } }
    end
    love.graphics.setCanvas()
    canvas:newImageData():encode("png", "frames.png")
    -- the helper's player: step each animation through one cycle with its own durations
    for name, a in pairs(data.animations) do
      local p = atlas:play(name)
      local seq = {}
      for s = 1, #a.frames do
        seq[s] = { name = a.frames[p.i], durationMs = a.durations[p.i] * 1000 }
        p:update(a.durations[p.i])
      end
      report.animations[name] = { loop = a.loop, frames = seq, wrapped = (p.i == 1) }
    end
    -- one frame at 4x, drawn the way a game draws it (pivot at the draw point)
    local first = JOB.first or keys[1]
    local f = data.frames[first]
    local S = JOB.scale
    local big = love.graphics.newCanvas(f.sw * S, f.sh * S)
    love.graphics.setCanvas(big); love.graphics.clear(0, 0, 0, 0)
    atlas:draw(first, f.px * S, f.py * S, S)
    love.graphics.setCanvas()
    big:newImageData():encode("png", "scaled.png")
    report.scaled = { name = first, scale = S, png = "scaled.png" }
  end)
  if not ok then report.errors[#report.errors + 1] = tostring(err) end
  love.filesystem.write("report.json", enc(report))
  print("NERULIO_SAVE_DIR=" .. love.filesystem.getSaveDirectory())
  love.event.quit(0)
end
'''


def version() -> str | None:
    return '11.5' if LOVE.exists() else None


def run(folder: Path, item: dict, work: Path, scale: int = 4) -> dict:
    if not LOVE.exists():
        return {'errors': [f'UNVERIFIED: no LÖVE at {LOVE}'], 'frames': []}
    lua = folder / item['lua']
    proj = work / 'love-proj'
    if proj.exists():
        shutil.rmtree(proj)
    shutil.copytree(lua.parent, proj)
    if (proj / 'main.lua').exists():
        (proj / 'main.lua').rename(proj / '_shipped_main.lua')
    identity = f'nerulio-verify-{os.getpid()}'
    job = {'identity': identity, 'lua': lua.name, 'scale': scale}
    jl = '{' + ','.join(f'{k} = {json.dumps(v)}' for k, v in job.items()) + '}'
    (proj / 'main.lua').write_text(PROBE % jl, encoding='utf-8')
    p = subprocess.run([str(LOVE), str(proj)], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=300)
    (work / 'love.log').write_text(p.stdout + '\n' + p.stderr, encoding='utf-8')
    m = re.search(r'NERULIO_SAVE_DIR=(.+)', p.stdout)
    if not m:
        return {'errors': [f'LÖVE printed no save directory (exit {p.returncode}); see {work / "love.log"}'], 'frames': []}
    save = Path(m.group(1).strip())
    rep = json.loads((save / 'report.json').read_text(encoding='utf-8'))
    dest = work / 'love'
    dest.mkdir(parents=True, exist_ok=True)
    from PIL import Image
    if (save / 'frames.png').exists():
        full = unpremultiply(Image.open(save / 'frames.png'))
        full.save(dest / '_canvas.png')
        for i, (slot, fr) in enumerate(zip(rep.get('slots', []), rep.get('frames', []))):
            out = dest / f'slot_{i:04d}.png'
            full.crop((slot['x'], slot['y'], slot['x'] + slot['w'], slot['y'] + slot['h'])).save(out)
            fr['png'] = str(out)
    if (save / 'scaled.png').exists():
        unpremultiply(Image.open(save / 'scaled.png')).save(dest / 'scaled.png')
        rep['scaled']['png'] = str(dest / 'scaled.png')
    shutil.rmtree(save, ignore_errors=True)
    return rep


def normalise(rep: dict) -> dict:
    frames = [{'name': f['name'], 'png': f.get('png'), 'sourceSize': f.get('sourceSize'), 'region': f.get('region')} for f in rep.get('frames', [])]
    by = {f['name']: f for f in frames}
    anims = {n: {'fps': None, 'loop': a.get('loop'), 'frames': [{'name': s['name'], 'png': by.get(s['name'], {}).get('png'), 'durationMs': s['durationMs']} for s in a['frames']]}
             for n, a in (rep.get('animations') or {}).items()}
    scaled = None
    sc = rep.get('scaled')
    if sc and sc.get('png') and by.get(sc['name'], {}).get('png'):
        scaled = {'png': sc['png'], 'scale': sc['scale'], 'base_png': by[sc['name']]['png'], 'note': 'nerulio_atlas.lua sets setDefaultFilter("nearest")'}
    return {'frames': frames, 'animations': anims, 'scaled': scaled}
