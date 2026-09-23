-- T11: .aseprite with 2 layers (one with a blend mode) in indexed mode.
local p = app.params
local spr = app.open(p["in"])
spr:setPalette(Palette{ fromFile = p.pal })
app.command.ChangePixelFormat{ ui=false, format="indexed", dithering="none" }
spr.layers[1].name = "base"
local l2 = spr:newLayer()
l2.name = "shade-multiply"
l2.blendMode = BlendMode.MULTIPLY
l2.opacity = 160
-- paint a band of index 1 (dark blue) into layer 2 on frame 1
local img = Image(spr.width, 16, ColorMode.INDEXED)
for y = 0, 15 do for x = 0, spr.width - 1 do img:drawPixel(x, y, 1) end end
spr:newCel(l2, 1, img, Point(0, 0))
spr:saveAs(p.out)
print("saved " .. p.out)
