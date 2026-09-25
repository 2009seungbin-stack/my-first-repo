"""Select a sprite row in SpriteIlluminator's list (by row index) and apply an effect with its
default settings (optionally ticking Tile mode). Rows: 0 asteroids, 1 bricks, 2 bricks_rolled,
3 bricksheight, 4 bricksheight_rolled, 5 torch (main window at its launch position)."""
import os, sys, time
from pywinauto import Application, mouse
EXE = os.environ.get('SPRITEILLUMINATOR_BIN', r'C:\Program Files\CodeAndWeb\SpriteIlluminator\bin\SpriteIlluminator.exe')
row, effect = int(sys.argv[1]), sys.argv[2]
tile = len(sys.argv) > 3 and sys.argv[3] == 'tile'
app = Application(backend='uia').connect(path=EXE, timeout=10)
# the main window is the largest one (message boxes and effect dialogs share its title)
w = max(app.windows(), key=lambda x: x.rectangle().width() * x.rectangle().height())
r = w.rectangle()
mouse.click(coords=(r.left + 80, r.top + 127 + 34 * row))
time.sleep(1)
w.child_window(title=effect, control_type='CheckBox').wrapper_object().click_input()
time.sleep(2)
top = app.top_window()
if tile:
    top.child_window(title='Tile mode', control_type='CheckBox').wrapper_object().click_input()
    time.sleep(.5)
top.child_window(title='Apply', control_type='Button').wrapper_object().click_input()
time.sleep(4 if row == 0 else 2)
print('applied', effect, 'row', row, 'tile' if tile else '')
