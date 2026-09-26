-- T14: palette import/export in every format Aseprite knows; T7: palette-swap variants across all frames.
local p = app.params
local out = p.outdir

-- ---------- T14 ----------
local pal = Palette{ fromFile = p.pal }
print("T14 loaded pico-8.gpl entries=" .. #pal)
for _, ext in ipairs({ "gpl", "pal", "hex", "act", "col", "png" }) do
  local f = out .. "/T14_pico8." .. ext
  local ok, err = pcall(function() pal:saveAs(f) end)
  local n = -1
  if ok then
    local ok2, back = pcall(function() return Palette{ fromFile = f } end)
    if ok2 and back then
      n = #back
      local same = true
      for i = 0, math.min(#back, #pal) - 1 do
        if back:getColor(i).rgbaPixel ~= pal:getColor(i).rgbaPixel then same = false end
      end
      print(string.format("T14 %s save=ok reload entries=%d roundtrip_identical_first16=%s", ext, n, tostring(same)))
    else
      print("T14 " .. ext .. " save=ok reload=FAILED")
    end
  else
    print("T14 " .. ext .. " save FAILED " .. tostring(err))
  end
end
-- Adobe Swatch Exchange (.ase) is not a palette format in Aseprite: ".ase" is Aseprite's own sprite extension.
-- a real Adobe Swatch Exchange file written by jobd/make_adobe_ase.py
local okA, resA = pcall(function() return Palette{ fromFile = out .. "/pico8_adobe_swatch.ase" } end)
print("T14 adobe .ase load (Palette{fromFile}) -> ok=" .. tostring(okA) .. " result=" .. tostring(resA) ..
      (okA and resA and (" entries=" .. #resA) or ""))
local okB, resB = pcall(function() return app.open(out .. "/pico8_adobe_swatch.ase") end)
print("T14 adobe .ase via app.open -> ok=" .. tostring(okB) .. " result=" .. tostring(resB))

-- ---------- T7 ----------
local spr = app.open(p["in"])
app.command.ImportSpriteSheet{ ui=false, type=SpriteSheetType.ROWS,
  frameBounds=Rectangle(0, 0, 16, 16) }
print("T7 imported sheet as animation: frames=" .. #spr.frames .. " size=" .. spr.width .. "x" .. spr.height)
-- histogram over all frames to pick the 'team colour' (most used saturated colour)
local hist = {}
for _, cel in ipairs(spr.cels) do
  for it in cel.image:pixels() do
    local px = it()
    if app.pixelColor.rgbaA(px) >= 128 then hist[px] = (hist[px] or 0) + 1 end
  end
end
local best, bestScore = nil, -1
for px, n in pairs(hist) do
  local c = Color(px)
  local s = c.hsvSaturation * c.hsvValue * n
  if s > bestScore then best, bestScore = px, s end
end
local src = Color(best)
print(string.format("T7 team colour picked: #%02x%02x%02x used %d px", src.red, src.green, src.blue, hist[best]))
local variants = { red = Color{ r=200, g=40, b=40 }, blue = Color{ r=40, g=80, b=220 }, green = Color{ r=40, g=170, b=60 } }
local base = spr.filename
for name, col in pairs(variants) do
  -- RGB route: Edit > Replace Color applied to every frame (select all frames in timeline first)
  local changedFrames, changedPx = 0, 0
  app.transaction("swap " .. name, function()
    for _, cel in ipairs(spr.cels) do
      local img = cel.image:clone()
      local n = 0
      for it in img:pixels() do if it() == best then it(col.rgbaPixel); n = n + 1 end end
      if n > 0 then changedFrames = changedFrames + 1; changedPx = changedPx + n end
      cel.image = img
    end
  end)
  app.command.ExportSpriteSheet{ ui=false, type=SpriteSheetType.ROWS, columns=6,
    textureFilename = out .. "/T7_variant_" .. name .. ".png", dataFilename = out .. "/T7_variant_" .. name .. ".json" }
  print(string.format("T7 variant %s: frames changed=%d px=%d", name, changedFrames, changedPx))
  app.undo()  -- revert pixel changes before next variant
  -- verify undo restored
  local cnt = 0
  for _, cel in ipairs(spr.cels) do for it in cel.image:pixels() do if it() == best then cnt = cnt + 1 end end end
  print("T7 after undo team-colour px=" .. cnt)
end

-- Indexed route (the idiomatic Aseprite way): convert to indexed, edit ONE palette entry -> all frames change
app.command.ChangePixelFormat{ ui=false, format="indexed", dithering="none" }
local ipal = spr.palettes[1]
local idx = -1
for i = 0, #ipal - 1 do if ipal:getColor(i).rgbaPixel == best then idx = i end end
print("T7 indexed: palette size=" .. #ipal .. " team index=" .. idx)
if idx >= 0 then
  ipal:setColor(idx, variants.red)
  app.command.ExportSpriteSheet{ ui=false, type=SpriteSheetType.ROWS, columns=6,
    textureFilename = out .. "/T7_indexed_palette_edit_red.png", dataFilename = out .. "/T7_indexed_palette_edit_red.json" }
  print("T7 indexed route: 1 palette-entry edit recoloured all frames")
end
