"""Step-wise SpriteIlluminator driver. Usage:
  si_step.py start
  si_step.py click <control title> [ctype]     (mouse click on a control of the main window)
  si_step.py keys <pywinauto keys>
  si_step.py shot <name>
  si_step.py list [ctype]                       (list controls of the main window, fast)
"""
import os, sys, time, subprocess
from pywinauto import Application, Desktop, keyboard
from PIL import ImageGrab
EXE = os.environ.get('SPRITEILLUMINATOR_BIN', r'C:\Program Files\CodeAndWeb\SpriteIlluminator\bin\SpriteIlluminator.exe')
SHOTS = os.environ.get('H2H_SHOTS', '.')


def app():
    return Application(backend='uia').connect(path=EXE, timeout=10)


def main_win():
    return app().top_window()


cmd = sys.argv[1]
if cmd == 'start':
    subprocess.Popen([EXE] + sys.argv[2:])
    time.sleep(10)
    print(main_win().window_text())
elif cmd == 'click':
    w = main_win()
    kw = {'title': sys.argv[2]}
    if len(sys.argv) > 3:
        kw['control_type'] = sys.argv[3]
    c = w.child_window(**kw)
    c.wrapper_object().click_input()
    print('clicked', sys.argv[2])
elif cmd == 'dclick':
    w = main_win()
    c = w.child_window(title=sys.argv[2])
    c.wrapper_object().double_click_input()
elif cmd == 'keys':
    keyboard.send_keys(sys.argv[2], with_spaces=True, pause=0.02)
elif cmd == 'shot':
    ImageGrab.grab(all_screens=True).save(f'{SHOTS}\\{sys.argv[2]}.png')
    w = main_win()
    r = w.rectangle()
    ImageGrab.grab(bbox=(r.left, r.top, r.right, r.bottom), all_screens=True).save(f'{SHOTS}\\{sys.argv[2]}_win.png')
    print(w.window_text(), r)
elif cmd == 'list':
    w = main_win()
    print('TOP', repr(w.window_text()))
    for c in w.descendants(control_type=sys.argv[2]) if len(sys.argv) > 2 else w.descendants():
        try:
            print(c.element_info.control_type, repr(c.window_text()[:80]), c.rectangle())
        except Exception:
            pass
elif cmd == 'windows':
    for w in Desktop(backend='uia').windows():
        if w.window_text():
            print(repr(w.window_text()), w.rectangle(), w.process_id())
