-- Test for the LÖVE guide: every snippet of the guide, run in LÖVE 11.5, plus checks.
-- Writes render.png, bleed.png and report.txt to the save directory, prints the checks, quits.
local anim8 = require("anim8")

-- test harness only: print errors and quit instead of showing the error screen
function love.errorhandler(msg)
  print("ERROR " .. tostring(msg), debug.traceback())
  return nil
end

local checks, lines = {}, {}
local function check(name, ok, detail)
  checks[#checks + 1] = name
  lines[#lines + 1] = (ok and "PASS " or "FAIL ") .. name .. "  " .. tostring(detail)
end

------------------------------------------------------------------ guide snippet 1: quads from a grid
-- Cuts a sheet into quads, left to right, top to bottom.
-- margin = empty border around the sheet, spacing = gap between cells.
local function gridQuads(image, frameW, frameH, margin, spacing)
  margin, spacing = margin or 0, spacing or 0
  local iw, ih = image:getDimensions()
  local quads = {}
  for y = margin, ih - margin - frameH, frameH + spacing do
    for x = margin, iw - margin - frameW, frameW + spacing do
      quads[#quads + 1] = love.graphics.newQuad(x, y, frameW, frameH, iw, ih)
    end
  end
  return quads
end

------------------------------------------------------------------ guide snippet 2: a tiny animator
local Anim = {}
Anim.__index = Anim

-- frames: list of quads; durations: seconds per frame (one number or a list)
function Anim.new(frames, durations, loop)
  if type(durations) == "number" then
    local d = durations
    durations = {}
    for i = 1, #frames do durations[i] = d end
  end
  return setmetatable({ frames = frames, durations = durations, loop = loop ~= false,
                        index = 1, timer = 0, done = false }, Anim)
end

function Anim:update(dt)
  if self.done then return end
  self.timer = self.timer + dt
  while self.timer >= self.durations[self.index] do
    self.timer = self.timer - self.durations[self.index]
    if self.index < #self.frames then
      self.index = self.index + 1
    elseif self.loop then
      self.index = 1
    else
      self.done = true
      break
    end
  end
end

function Anim:draw(image, x, y, scale)
  -- math.floor keeps the sprite on whole pixels (no shimmer, no bleeding)
  love.graphics.draw(image, self.frames[self.index], math.floor(x), math.floor(y), 0, scale, scale)
end

------------------------------------------------------------------ run
function love.load()
  io.stdout:setvbuf("no")
  love.filesystem.setIdentity("nerulio-guide-love")
  -- pixel art: must run BEFORE newImage, it only affects images created afterwards
  love.graphics.setDefaultFilter("nearest", "nearest")
  local sheet = love.graphics.newImage("characters.png") -- 224x74, 24x24 cells, 1 px spacing
  check("filter.nearest", select(1, sheet:getFilter()) == "nearest", table.concat({sheet:getFilter()}, ","))

  local quads = gridQuads(sheet, 24, 24, 0, 1)
  check("grid.count", #quads == 27, #quads)
  local qx, qy = quads[10]:getViewport()
  check("grid.quad10", qx == 0 and qy == 25, qx .. "," .. qy)
  local qx9 = quads[9]:getViewport()
  check("grid.quad9", qx9 == 200, qx9)

  -- tiny animator timing: 0.2 s + 0.1 s frames, stepped at 1/60
  local walk = Anim.new({ quads[1], quads[2] }, { 0.2, 0.1 })
  local seq, t = {}, 0
  for i = 1, 36 do walk:update(1 / 60); seq[#seq + 1] = walk.index end
  -- after 12 steps (0.2 s) index 2, after 18 steps (0.3 s) back to 1
  -- float steps: 12 x (1/60) is a hair under 0.2, so frame 2 starts on step 13
  check("anim.timing", seq[12] == 1 and seq[13] == 2 and seq[18] == 2 and seq[19] == 1, table.concat(seq, ""))
  local once = Anim.new({ quads[1], quads[2] }, 0.1, false)
  for i = 1, 30 do once:update(1 / 60) end
  check("anim.once", once.done and once.index == 2, tostring(once.done) .. "," .. once.index)

  ---------------------------------------------------------------- guide snippet 3: anim8
  -- anim8 puts `border` pixels BEFORE every frame (frame 1 starts at left + border),
  -- so a sheet with a 1 px gap between cells and no outer margin needs left = top = -1.
  local g = anim8.newGrid(24, 24, sheet:getWidth(), sheet:getHeight(), -1, -1, 1)
  local green = anim8.newAnimation(g('1-2', 1), 0.15)
  local pink = anim8.newAnimation(g('5-6', 1), { 0.2, 0.1 })
  local spike = anim8.newAnimation(g('7-9', 2, 8, 2), 0.12)   -- 7,8,9 then 8 again
  local robot = anim8.newAnimation(g('1-3', 3), 0.15, 'pauseAtEnd')
  local beige = anim8.newAnimation(g('1-2', 2), 0.15):flipH()
  local ax, ay = g(1, 2)[1]:getViewport()
  check("anim8.grid.1,2", ax == 0 and ay == 25, ax .. "," .. ay)
  local bx = g(9, 1)[1]:getViewport()
  check("anim8.grid.9,1", bx == 200, bx)
  local wrongGrid = anim8.newGrid(24, 24, sheet:getWidth(), sheet:getHeight(), 0, 0, 1)
  local wx, wy = wrongGrid(1, 1)[1]:getViewport()
  check("anim8.border.before.first", wx == 1 and wy == 1, wx .. "," .. wy)
  pink:update(0.19); local p1 = pink.position
  pink:update(0.02); local p2 = pink.position
  pink:update(0.1); local p3 = pink.position
  check("anim8.durations", p1 == 1 and p2 == 2 and p3 == 1, p1 .. p2 .. p3)
  robot:update(0.5)
  check("anim8.pauseAtEnd", robot.status == "paused" and robot.position == 3, robot.status .. "," .. robot.position)
  check("anim8.version", anim8._VERSION == "anim8 v2.3.1", anim8._VERSION)

  print("stage: batch")
  ---------------------------------------------------------------- SpriteBatch
  local batch = love.graphics.newSpriteBatch(sheet, 200)
  for i = 0, 199 do batch:add(quads[(i % 27) + 1], (i % 20) * 24, math.floor(i / 20) * 24) end
  check("batch.count", batch:getCount() == 200, batch:getCount())
  local scratch = love.graphics.newCanvas(480, 240)
  love.graphics.setCanvas(scratch); love.graphics.clear(0, 0, 0, 1)
  local s0 = love.graphics.getStats().drawcalls
  love.graphics.draw(batch)
  local s1 = love.graphics.getStats().drawcalls
  for i = 0, 199 do love.graphics.draw(sheet, quads[(i % 27) + 1], (i % 20) * 24, math.floor(i / 20) * 24) end
  local s2 = love.graphics.getStats().drawcalls
  love.graphics.setCanvas()
  check("batch.drawcalls", (s1 - s0) == 1, "batch=" .. (s1 - s0) .. " separate=" .. (s2 - s1))

  print("stage: bleed")
  ---------------------------------------------------------------- bleeding experiment
  -- Two 16x16 cells packed with no gap: left = blue, right = red. We draw only the LEFT cell.
  local function makeSheet(pad)
    -- pad = 0: no gap; pad = 1: each cell extruded by 1 px (its edge pixels repeated)
    local cw = 16 + 2 * pad
    local id = love.image.newImageData(cw * 2, cw)
    id:mapPixel(function(x, y)
      if x < cw then return 0.2, 0.45, 1, 1 else return 1, 0.15, 0.15, 1 end
    end)
    return love.graphics.newImage(id), cw
  end
  local function redPixels(canvas)
    local d, n = canvas:newImageData(), 0
    d:mapPixel(function(x, y, r, g, b, a) if r > 0.25 then n = n + 1 end return r, g, b, a end)
    return n
  end
  local function trial(filter, pad, x, y, sc, rot)
    local img, cw = makeSheet(pad)
    img:setFilter(filter, filter)
    local q = love.graphics.newQuad(pad, pad, 16, 16, img:getDimensions())
    local c = love.graphics.newCanvas(96, 96)
    love.graphics.setCanvas(c); love.graphics.clear(0, 0, 0, 1)
    love.graphics.draw(img, q, x, y, rot or 0, sc, sc)
    love.graphics.setCanvas()
    local n = redPixels(c)
    img:release()
    return n, c
  end
  local cases = {
    { "linear, no gap, x=10.5 scale 3", "linear", 0, 10.5, 10.5, 3 },
    { "nearest, no gap, x=10.37 scale 2.7", "nearest", 0, 10.37, 10.37, 2.7 },
    { "nearest, no gap, x=10.5 scale 3", "nearest", 0, 10.5, 10.5, 3 },
    { "nearest, no gap, floor(x) scale 3", "nearest", 0, 10, 10, 3 },
    { "linear, 1px extrude, x=10.5 scale 3", "linear", 1, 10.5, 10.5, 3 },
    { "nearest, 1px extrude, x=10.37 scale 2.7", "nearest", 1, 10.37, 10.37, 2.7 },
  }
  local bleedCanvases = {}
  for i, cs in ipairs(cases) do
    local n, c = trial(cs[2], cs[3], cs[4], cs[5], cs[6])
    bleedCanvases[i] = c
    lines[#lines + 1] = ("BLEED %-42s red pixels: %d"):format(cs[1], n)
    cases[i].red = n
  end
  -- sweep: nearest, no gap, many fractional offsets and scales
  local sweepBleed, sweepTotal, sweepFloorBleed = 0, 0, 0
  local linearBleed = 0
  for fx = 0, 9 do
    for _, sc in ipairs({ 1, 2, 3, 4, 1.5, 2.5, 3.3, 0.5, 0.75 }) do
      local n = trial("nearest", 0, 10 + fx / 10, 10 + fx / 10, sc)
      if trial("linear", 0, 10 + fx / 10, 10 + fx / 10, sc) > 0 then linearBleed = linearBleed + 1 end
      sweepTotal = sweepTotal + 1
      if n > 0 then sweepBleed = sweepBleed + 1 end
      if sc == math.floor(sc) then
        local nf = trial("nearest", 0, 10, 10, sc)
        if nf > 0 then sweepFloorBleed = sweepFloorBleed + 1 end
      end
    end
  end
  local rotBleed = 0
  for k = 1, 12 do if trial("nearest", 0, 40.3, 30.6, 2.3, k * 0.13) > 0 then rotBleed = rotBleed + 1 end end
  lines[#lines + 1] = ("SWEEP linear/no gap: %d of %d cases showed red; nearest rotated: %d of 12"):format(linearBleed, sweepTotal, rotBleed)
  lines[#lines + 1] = ("SWEEP nearest/no gap: %d of %d fractional cases showed red; integer position + integer scale: %d"):format(sweepBleed, sweepTotal, sweepFloorBleed)
  check("bleed.linear.nogap", cases[1].red > 0, cases[1].red)
  check("bleed.floor.integer", cases[4].red == 0, cases[4].red)
  check("bleed.extrude.linear", cases[5].red == 0, cases[5].red)

  print("stage: shot")
  ---------------------------------------------------------------- the screenshot
  local W, H = 720, 310
  local shot = love.graphics.newCanvas(W, H)
  love.graphics.setCanvas(shot)
  love.graphics.clear(0.106, 0.125, 0.188, 1)
  love.graphics.setColor(0.81, 0.84, 0.89, 1)
  love.graphics.print("gridQuads(sheet, 24, 24, 0, 1): quads 1-9, drawn at math.floor positions, scale 3", 8, 6)
  love.graphics.setColor(1, 1, 1, 1)
  for i = 1, 9 do love.graphics.draw(sheet, quads[i], 8 + (i - 1) * 78, 26, 0, 3, 3) end
  love.graphics.setColor(0.81, 0.84, 0.89, 1)
  love.graphics.print("anim8: newGrid(24, 24, w, h, -1, -1, 1) - walk, per-frame durations, ping-pong list, pauseAtEnd, flipH", 8, 106)
  love.graphics.setColor(1, 1, 1, 1)
  green:draw(sheet, 8, 126, 0, 3, 3)
  pink:draw(sheet, 108, 126, 0, 3, 3)
  spike:draw(sheet, 208, 126, 0, 3, 3)
  robot:draw(sheet, 308, 126, 0, 3, 3)
  beige:draw(sheet, 408, 126, 0, 3, 3)
  walk:draw(sheet, 508, 126, 3)
  love.graphics.setColor(0.81, 0.84, 0.89, 1)
  love.graphics.print("Right edge of the blue cell, 4x zoom (a red neighbour is packed right next to it on the sheet):", 8, 204)
  local panels = { { 1, "linear filter\nno gap: red fringe" }, { 2, "nearest filter\nno gap, x.37, scale 2.7" }, { 5, "linear filter\n1 px extruded border" } }
  for k, pnl in ipairs(panels) do
    local cs = cases[pnl[1]]
    local edge = cs[4] + 16 * cs[6]
    local cx = math.floor(edge) - 14
    local crop = love.graphics.newQuad(cx, 20, 24, 20, 96, 96)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(bleedCanvases[pnl[1]], crop, 8 + (k - 1) * 240, 224, 0, 4, 4)
    love.graphics.setColor(0.81, 0.84, 0.89, 1)
    love.graphics.print(pnl[2], 112 + (k - 1) * 240, 240)
  end
  love.graphics.setCanvas()
  shot:newImageData():encode("png", "render.png")

  -- a zoomed crop of the bleeding cases for inspection
  local zoom = love.graphics.newCanvas(96 * 6, 96)
  love.graphics.setCanvas(zoom); love.graphics.clear(0, 0, 0, 1)
  for i, c in ipairs(bleedCanvases) do love.graphics.draw(c, (i - 1) * 96, 0) end
  love.graphics.setCanvas()
  zoom:newImageData():encode("png", "bleed.png")

  local fails = 0
  for _, l in ipairs(lines) do if l:sub(1, 4) == "FAIL" then fails = fails + 1 end end
  lines[#lines + 1] = ("LOVE %s, %d checks, %d failed"):format(table.concat({ love.getVersion() }, ".", 1, 3), #checks, fails)
  local report = table.concat(lines, "\n")
  love.filesystem.write("report.txt", report)
  print(report)
  print("SAVE_DIR=" .. love.filesystem.getSaveDirectory())
  love.event.quit(0)
end
