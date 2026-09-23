-- T9: 4x nearest -> 1x ; T10: 3.78x bilinear -> 1x.
-- Params: in, out, w, h, method (nearest|bilinear|rotsprite)
local p = app.params
local spr = app.open(p["in"])
app.command.SpriteSize{ ui=false, width=tonumber(p.w), height=tonumber(p.h),
                        lockRatio=false, method=p.method or "nearest" }
spr:saveCopyAs(p.out)
print("resized " .. p["in"] .. " -> " .. spr.width .. "x" .. spr.height .. " method=" .. (p.method or "nearest"))
