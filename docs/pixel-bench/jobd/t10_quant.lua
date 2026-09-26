-- T10 best manual Aseprite workflow: Sprite Size (nearest, typed true size) then
-- Palette > Create palette from current sprite (N colours) and Color Mode > Indexed (no dither, fit rgb).
local p = app.params
local spr = app.open(p["in"])
app.command.SpriteSize{ ui=false, width=tonumber(p.w), height=tonumber(p.h), lockRatio=false, method="nearest" }
app.command.ColorQuantization{ ui=false, maxColors=tonumber(p.n), withAlpha=true }
app.command.ChangePixelFormat{ ui=false, format="indexed", dithering="none", fitCriteria="rgb" }
spr:saveCopyAs(p.out)
print("quantized to " .. #spr.palettes[1] .. " entries")
