local spr = app.open(app.params["in"])
local modes = {}
for k, v in pairs(BlendMode) do modes[v] = k end
print("reopened colorMode=" .. (spr.colorMode == ColorMode.INDEXED and "INDEXED" or tostring(spr.colorMode))
      .. " size=" .. spr.width .. "x" .. spr.height .. " palette=" .. #spr.palettes[1])
for i, l in ipairs(spr.layers) do
  print(string.format("layer %d name=%s blend=%s opacity=%d cels=%d", i, l.name, modes[l.blendMode] or tostring(l.blendMode), l.opacity, #l.cels))
end
