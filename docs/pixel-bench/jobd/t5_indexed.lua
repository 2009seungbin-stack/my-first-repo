-- T5: RGB sprite -> indexed with the PICO-8 palette, no dithering.
-- UI equivalent: Palette menu > Load Palette (pico-8.gpl); Sprite > Color Mode > Indexed (dithering: none).
-- optional params: rgbmap (default|octree|rgb5a3), fit (default|rgb|linearizedRGB|ciexyz|cielab)
local p = app.params
local spr = app.open(p["in"])
local pal = Palette{ fromFile = p.pal }
print("palette entries: " .. #pal)
if p.fixmask == "1" then
  -- workaround: add a 17th transparent entry and make it the mask index so black (index 0) stays usable
  pal:resize(17)
  pal:setColor(16, Color{ r=0, g=0, b=0, a=0 })
  spr.transparentColor = 16
end
spr:setPalette(pal)
local args = { ui=false, format="indexed", dithering="none" }
if p.rgbmap and p.rgbmap ~= "" then args.rgbmap = p.rgbmap end
if p.fit and p.fit ~= "" then args.fitCriteria = p.fit end
app.command.ChangePixelFormat(args)
print("colorMode=" .. tostring(spr.colorMode == ColorMode.INDEXED and "indexed" or spr.colorMode)
      .. " transparentColor=" .. spr.transparentColor .. " palette=" .. #spr.palettes[1]
      .. " rgbmap=" .. tostring(p.rgbmap) .. " fit=" .. tostring(p.fit))
spr:saveCopyAs(p.out)
if p.outase and p.outase ~= "" then spr:saveCopyAs(p.outase) end
