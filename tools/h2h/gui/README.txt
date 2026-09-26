GUI drivers for the competitor tools that have no command line (docs/H2H-PAID.md). They move the
real mouse and keyboard, or talk to the app's DevTools port, so run them on a desktop nobody is
using. Competitor binaries and outputs are never committed.

SpriteIlluminator (Qt, UI Automation). Needs `pip install pywinauto` and SPRITEILLUMINATOR_BIN.
  python si_step.py start
  python si_step.py click "Add sprites" Button     then type the folder path + Enter in the file
                                                   dialog, click a file, Ctrl+A, Enter
  python si_apply.py <row> Bevel|Emboss [tile]     select a list row and apply the effect with its
                                                   default settings
  python si_step.py click "Export normals" Button && python si_step.py click OK Button
  python ../collect_normals.py <sprite folder> <h2h dir> spriteilluminator

Tilesetter Lite (Electron 10, raw DevTools protocol; Playwright's CDP attach is too new for it).
Start it with --remote-debugging-port=9555, then:
  node cdp.mjs shot|eval|click|rclick|shiftclick|drag|wheel|key|type ...
Images: require('electron').clipboard.writeImage(nativeImage.createFromPath(...)), then Ctrl+V in
the Set View. Native dialogs are answered by replacing remote.dialog.showOpenDialogSync or
showSaveDialogSync in the page.
