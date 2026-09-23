-- Renders frame 1 of a sprite with "compose groups" on (Image:drawSprite uses the preference).
app.preferences.experimental.compose_groups = true
local spr = app.open(app.params["in"])
local r = Image(spr.spec); r:drawSprite(spr, 1)
r:saveAs(app.params["out"])
