-- T8: 1-px outline (Edit > FX > Outline, Shift+O) and a manual drop shadow
-- (Aseprite 1.3.18 has no Drop Shadow command; we emulate the usual manual workflow:
--  duplicate layer, recolour silhouette, move 1px down-right, put it below).
local p = app.params
local spr = app.open(p["in"])
-- give the outline room (Sprite > Canvas Size +1 px each side)
app.command.CanvasSize{ ui=false, left=1, top=1, right=1, bottom=1 }
app.command.Outline{ ui=false, color=Color{ r=0, g=0, b=0, a=255 }, matrix="circle", place="outside" }
spr:saveCopyAs(p.out)
print("outline done " .. spr.width .. "x" .. spr.height)

-- drop shadow: duplicate layer, fill silhouette with shadow colour, offset +1,+1, move below
local base = spr.layers[1]
app.activeLayer = base
app.command.DuplicateLayer()
local sh = app.activeLayer
sh.name = "shadow"
local shadow = Color{ r=40, g=20, b=60, a=255 }
for _, cel in ipairs(sh.cels) do
  local img = cel.image:clone()
  for it in img:pixels() do
    local px = it()
    if app.pixelColor.rgbaA(px) >= 128 then it(shadow.rgbaPixel) end
  end
  cel.image = img
  cel.position = Point(cel.position.x + 1, cel.position.y + 1)
end
sh.stackIndex = 1  -- below the original
app.command.FlattenLayers()
spr:saveCopyAs(p.out2)
print("shadow done, layers after flatten=" .. #spr.layers)
