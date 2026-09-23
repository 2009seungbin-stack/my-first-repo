-- Dumps what real Aseprite understood from a file, as JSON.
-- usage: aseprite -b --script-param in=<file> --script-param out=<json> --script dump.lua
local function enc(v, ind)
  local t = type(v)
  if t == "nil" then return "null" end
  if t == "boolean" then return v and "true" or "false" end
  if t == "number" then if v ~= v then return "null" end return (math.type(v) == "integer") and tostring(v) or string.format("%.17g", v) end
  if t == "string" then return '"' .. v:gsub('[%c"\\]', function(c) return string.format("\\u%04x", c:byte()) end) .. '"' end
  if t == "table" then
    if #v > 0 or next(v) == nil then local p = {} for i, x in ipairs(v) do p[i] = enc(x) end return "[" .. table.concat(p, ",") .. "]" end
    local keys = {} for k in pairs(v) do keys[#keys + 1] = tostring(k) end table.sort(keys)
    local p = {} for _, k in ipairs(keys) do p[#p + 1] = enc(k) .. ":" .. enc(v[k]) end
    return "{" .. table.concat(p, ",") .. "}"
  end
  if t == "userdata" then
    local ok, x = pcall(function() return v.x end)
    local ok2, w = pcall(function() return v.width end)
    if ok and x ~= nil and ok2 and w ~= nil then return enc({ x = v.x, y = v.y, w = v.width, h = v.height }) end
    if ok and x ~= nil then return enc({ x = v.x, y = v.y }) end
    if ok2 and w ~= nil then return enc({ w = v.width, h = v.height }) end
    local okr, r = pcall(function() return v.red end)
    if okr and r ~= nil then return enc({ r = v.red, g = v.green, b = v.blue, a = v.alpha }) end
    return enc(tostring(v))
  end
  return enc(tostring(v))
end
local function props(p)
  local o = {}
  local ok = pcall(function() for k, v in pairs(p) do o[k] = v end end)
  return o
end
local spr = app.open(app.params["in"])
local modes = {}
for k, v in pairs(BlendMode) do modes[v] = k end
local d = { width = spr.width, height = spr.height, colorMode = spr.colorMode, transparentColor = spr.transparentColor,
  paletteSize = #spr.palettes[1], frames = {}, layers = {}, tags = {}, slices = {}, cels = {}, data = spr.data, props = props(spr.properties),
  tilesets = {} }
for i, f in ipairs(spr.frames) do d.frames[i] = math.floor(f.duration * 1000 + 0.5) end
local idx = 0
local function walk(layers, parent)
  for _, l in ipairs(layers) do
    local me = idx; idx = idx + 1
    d.layers[#d.layers + 1] = { name = l.name, group = l.isGroup, tilemap = l.isTilemap, visible = l.isVisible, background = l.isBackground,
      opacity = l.opacity, blend = modes[l.blendMode], parent = parent, data = l.data, props = props(l.properties) }
    if l.isGroup then walk(l.layers, me) end
  end
end
walk(spr.layers, -1)
for _, t in ipairs(spr.tags) do
  d.tags[#d.tags + 1] = { name = t.name, from = t.fromFrame.frameNumber - 1, to = t.toFrame.frameNumber - 1, dir = t.aniDir, repeats = t.repeats, data = t.data, color = t.color, props = props(t.properties) }
end
for _, s in ipairs(spr.slices) do
  d.slices[#d.slices + 1] = { name = s.name, bounds = s.bounds, center = s.center, pivot = s.pivot, data = s.data, props = props(s.properties) }
end
for _, c in ipairs(spr.cels) do
  d.cels[#d.cels + 1] = { layer = c.layer.name, frame = c.frameNumber - 1, x = c.position.x, y = c.position.y, w = c.image.width, h = c.image.height,
    opacity = c.opacity, z = c.zIndex, imageId = c.image.id, data = c.data }
end
for i, ts in ipairs(spr.tilesets) do
  local tiles = {}
  -- tile 0 is the empty tile; in Lua tile(0).properties aliases the tileset's own properties
  for k = 1, #ts - 1 do local t = ts:tile(k); tiles[k] = { data = t and t.data or "", props = t and props(t.properties) or {} } end
  d.tilesets[i] = { name = ts.name, n = #ts, grid = ts.grid.tileSize, tiles = tiles, props = props(ts.properties), data = ts.data }
end
local f = io.open(app.params["out"], "w"); f:write(enc(d)); f:close()
