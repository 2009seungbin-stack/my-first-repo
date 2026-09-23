-- Builds CC0 fixture sprites with real Aseprite (batch mode) + reference renders.
-- usage: aseprite -b --script-param out=<dir> --script make-fixtures.lua
local out = app.params["out"]
local function px(img, x, y, c) img:drawPixel(x, y, c) end
local function rgba(r, g, b, a) return app.pixelColor.rgba(r, g, b, a) end

-- 1) Every blend mode (RGB): colourful backdrop + one stripe per mode with varying alpha.
do
  local W, H = 19 * 6, 32
  local spr = Sprite(W, H, ColorMode.RGB)
  local bg = spr.layers[1]; bg.name = "backdrop"
  local img = Image(W, H, ColorMode.RGB)
  for y = 0, H - 1 do for x = 0, W - 1 do
    local a = (y < 4) and 0 or ((y < 8) and 120 or 255)
    px(img, x, y, rgba((x * 7) % 256, (y * 8 + x * 3) % 256, (255 - x * 2) % 256, a))
  end end
  spr:newCel(bg, 1, img, Point(0, 0))
  local modes = { BlendMode.NORMAL, BlendMode.MULTIPLY, BlendMode.SCREEN, BlendMode.OVERLAY, BlendMode.DARKEN,
    BlendMode.LIGHTEN, BlendMode.COLOR_DODGE, BlendMode.COLOR_BURN, BlendMode.HARD_LIGHT, BlendMode.SOFT_LIGHT,
    BlendMode.DIFFERENCE, BlendMode.EXCLUSION, BlendMode.HSL_HUE, BlendMode.HSL_SATURATION, BlendMode.HSL_COLOR,
    BlendMode.HSL_LUMINOSITY, BlendMode.ADDITION, BlendMode.SUBTRACT, BlendMode.DIVIDE }
  for i, m in ipairs(modes) do
    local l = spr:newLayer(); l.name = "mode" .. (i - 1); l.blendMode = m; l.opacity = (i % 3 == 0) and 180 or 255
    local c = Image(6, H, ColorMode.RGB)
    for y = 0, H - 1 do for x = 0, 5 do
      local a = ({ 255, 200, 128, 60, 255, 0 })[(y % 6) + 1]
      px(c, x, y, rgba((y * 37 + x * 50) % 256, (y * 13 + 90) % 256, (x * 40 + y * 5) % 256, a))
    end end
    local cel = spr:newCel(l, 1, c, Point((i - 1) * 6, 0))
    if i % 4 == 0 then cel.opacity = 150 end
  end
  spr:saveAs(out .. "/blend-rgba.aseprite"); spr:close()
end

-- 2) Grayscale with blend modes (incl. Addition, which Aseprite maps to Exclusion for gray).
do
  local W, H = 8 * 5, 16
  local spr = Sprite(W, H, ColorMode.GRAY)
  local bg = spr.layers[1]; bg.name = "base"
  local img = Image(W, H, ColorMode.GRAY)
  for y = 0, H - 1 do for x = 0, W - 1 do px(img, x, y, app.pixelColor.graya((x * 6 + y * 3) % 256, y < 3 and 0 or 255)) end end
  spr:newCel(bg, 1, img, Point(0, 0))
  local modes = { BlendMode.MULTIPLY, BlendMode.SCREEN, BlendMode.ADDITION, BlendMode.DIFFERENCE, BlendMode.HSL_HUE }
  for i, m in ipairs(modes) do
    local l = spr:newLayer(); l.name = "g" .. i; l.blendMode = m; l.opacity = 200
    local c = Image(8, H, ColorMode.GRAY)
    for y = 0, H - 1 do for x = 0, 7 do px(c, x, y, app.pixelColor.graya((y * 29 + x * 17) % 256, ({ 255, 128, 40 })[(y % 3) + 1])) end end
    spr:newCel(l, 1, c, Point((i - 1) * 8, 0))
  end
  spr:saveAs(out .. "/gray-blend.aseprite"); spr:close()
end

-- 3) Indexed: transparent index 3, background layer, groups, hidden layer, linked cels, tags
--    in all four directions with repeats, slices (9-patch + pivot), user data everywhere.
do
  local W, H = 16, 12
  local spr = Sprite(W, H, ColorMode.INDEXED)
  local pal = Palette(8)
  local cols = { {0,0,0,255}, {255,0,0,255}, {0,255,0,255}, {255,0,255,255}, {0,0,255,255}, {255,255,0,255}, {20,40,60,128}, {255,255,255,255} }
  for i, c in ipairs(cols) do pal:setColor(i - 1, Color{ r = c[1], g = c[2], b = c[3], a = c[4] }) end
  spr:setPalette(pal)
  spr.transparentColor = 3
  for f = 2, 4 do spr:newEmptyFrame(f) end
  for f = 1, 4 do spr.frames[f].duration = ({ 0.1, 0.15, 0.05, 0.25 })[f] end
  local bg = spr.layers[1]; bg.name = "bg"
  local grp = spr:newGroup(); grp.name = "hero"
  local body = spr:newLayer(); body.name = "body"; body.parent = grp
  local hat = spr:newLayer(); hat.name = "hat"; hat.parent = grp
  local hidden = spr:newLayer(); hidden.name = "hidden"; hidden.isVisible = false
  local still = spr:newLayer(); still.name = "still"
  for f = 1, 4 do
    local b = Image(W, H, ColorMode.INDEXED); b:clear(3)
    for y = 0, H - 1 do for x = 0, W - 1 do px(b, x, y, (x + y + f) % 2 == 0 and 7 or 0) end end
    spr:newCel(bg, f, b, Point(0, 0))
    local c = Image(5, 6, ColorMode.INDEXED); c:clear(3)
    for y = 0, 5 do for x = 0, 4 do px(c, x, y, (x == 0 or y == 0) and 1 or ((x + y) % 3 == 0 and 3 or 6)) end end
    spr:newCel(body, f, c, Point(2 + f, 4))
    local h = Image(3, 2, ColorMode.INDEXED); h:clear(3); px(h, 0, 0, 5); px(h, 1, 0, 5); px(h, 2, 1, 4)
    spr:newCel(hat, f, h, Point(3 + f, 2))
    local hd = Image(W, H, ColorMode.INDEXED); hd:clear(2)
    spr:newCel(hidden, f, hd, Point(0, 0))
  end
  local s = Image(4, 4, ColorMode.INDEXED); s:clear(2); px(s, 1, 1, 0)
  local first = spr:newCel(still, 1, s, Point(11, 7))
  first.data = "still cel"
  app.activeLayer = still
  app.range.frames = { spr.frames[1], spr.frames[2], spr.frames[3], spr.frames[4] }
  app.range.layers = { still }
  for f = 2, 4 do spr:newCel(still, f, s, Point(11, 7)) end
  app.range.frames = { spr.frames[1], spr.frames[2], spr.frames[3], spr.frames[4] }
  app.range.layers = { still }
  app.command.LinkCels()
  local t1 = spr:newTag(1, 2); t1.name = "fwd"; t1.aniDir = AniDir.FORWARD; t1.repeats = 0
  local t2 = spr:newTag(2, 3); t2.name = "rev"; t2.aniDir = AniDir.REVERSE; t2.repeats = 3
  local t3 = spr:newTag(1, 4); t3.name = "pp"; t3.aniDir = AniDir.PING_PONG; t3.repeats = 2; t3.color = Color{ r = 10, g = 200, b = 30 }
  local t4 = spr:newTag(3, 4); t4.name = "ppr"; t4.aniDir = AniDir.PING_PONG_REVERSE; t4.data = "tag text"
  t4.properties.speed = 2.5
  local sl = spr:newSlice(Rectangle(1, 1, 10, 8)); sl.name = "panel"; sl.center = Rectangle(2, 2, 6, 4); sl.data = "nine"
  local pv = spr:newSlice(Rectangle(4, 2, 6, 9)); pv.name = "pivot"; pv.pivot = Point(3, 8)
  pv.properties.kind = "origin"
  local hb = spr:newSlice(Rectangle(5, 5, 4, 5)); hb.name = "hitbox"; hb.color = Color{ r = 255, g = 0, b = 0, a = 255 }
  spr.data = "sprite text"; spr.color = Color{ r = 1, g = 2, b = 3, a = 255 }
  spr.properties.int = 42; spr.properties.neg = -70000; spr.properties.flag = true; spr.properties.num = 1.25
  spr.properties.str = "héllo"; spr.properties.pt = Point(3, -4); spr.properties.sz = Size(5, 6); spr.properties.rc = Rectangle(1, 2, 3, 4)
  spr.properties.vec = { 1, 2, 300 }; spr.properties.mixed = { 1, "two", true }; spr.properties.map = { a = 1, b = { c = "deep" } }
  spr.properties("nerulio/test").ext = 7
  body.data = "body layer"; body.color = Color{ r = 0, g = 0, b = 255, a = 255 }; body.properties.hp = 3
  grp.data = "group"
  spr:saveAs(out .. "/indexed-features.aseprite"); spr:close()
end

-- 4) Tilemap with flipped tiles (RGB) and cel z-index.
do
  local spr = Sprite(12, 8, ColorMode.RGB)
  app.command.NewLayer{ tilemap = true, gridBounds = Rectangle(0, 0, 4, 4) }
  local tl = app.activeLayer; tl.name = "map"
  local ts = tl.tileset
  local function tileImg(seed)
    local im = Image(4, 4, ColorMode.RGB)
    for y = 0, 3 do for x = 0, 3 do px(im, x, y, rgba((x * 60 + seed * 40) % 256, (y * 60) % 256, seed * 50 % 256, (x + y) % 5 == 0 and 0 or 255)) end end
    return im
  end
  for i = 1, 3 do local t = spr:newTile(ts); t.image = tileImg(i); t.properties.n = i end
  local map = Image(ImageSpec{ colorMode = ColorMode.TILEMAP, width = 3, height = 2 })
  local XF, YF, DF = 0x80000000, 0x40000000, 0x20000000
  local vals = { 1, 2 | XF, 3 | YF, 1 | DF, 0, 2 | XF | YF }
  for i, v in ipairs(vals) do map:drawPixel((i - 1) % 3, (i - 1) // 3, v) end
  spr:newCel(tl, 1, map, Point(0, 0))
  local over = spr.layers[1]; over.name = "under"
  local im = Image(2, 8, ColorMode.RGB); im:clear(rgba(200, 30, 30, 255))
  local c = spr:newCel(over, 1, im, Point(10, 0))
  c.zIndex = 2 -- draws above the tilemap layer
  spr:saveAs(out .. "/tilemap-flips.aseprite"); spr:close()
end

-- 5) Group opacity/blend with "compose groups" on (header flag 2).
do
  app.preferences.experimental.compose_groups = true
  local spr = Sprite(10, 6, ColorMode.RGB)
  local base = spr.layers[1]; base.name = "base"
  local im = Image(10, 6, ColorMode.RGB); im:clear(rgba(40, 90, 200, 255)); spr:newCel(base, 1, im, Point(0, 0))
  local g = spr:newGroup(); g.name = "grp"; g.opacity = 128; g.blendMode = BlendMode.MULTIPLY
  local a = spr:newLayer(); a.name = "a"; a.parent = g
  local ia = Image(6, 6, ColorMode.RGB); ia:clear(rgba(250, 200, 20, 255)); spr:newCel(a, 1, ia, Point(0, 0))
  local b = spr:newLayer(); b.name = "b"; b.parent = g; b.blendMode = BlendMode.SCREEN
  local ib = Image(6, 6, ColorMode.RGB); ib:clear(rgba(20, 250, 120, 160)); spr:newCel(b, 1, ib, Point(4, 0))
  spr:saveAs(out .. "/compose-groups.aseprite")
  -- reference render with group composition (what the editor shows with the preference on)
  local r = Image(spr.spec); r:drawSprite(spr, 1)
  r:saveAs(out .. "/compose-groups.composed.png")
  spr:close()
  app.preferences.experimental.compose_groups = false
end
print("ok")

