"""Renders the admin app's PNG icons from its SVGs (src/admin/icons/*.svg) with Chromium.
   python tools/admin-icons.py      → icon-192/512, maskable-192/512, apple-touch-icon (180), badge-96"""
import os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'src', 'admin', 'icons')
JOBS = [('icon.svg', 'icon-192.png', 192, None), ('icon.svg', 'icon-512.png', 512, None),
        ('maskable.svg', 'maskable-192.png', 192, None), ('maskable.svg', 'maskable-512.png', 512, None),
        ('maskable.svg', 'apple-touch-icon.png', 180, None),
        # Android status-bar badge: a white glyph on transparency (only the alpha channel is used).
        ('monochrome.svg', 'badge-96.png', 96, ('#000', '#fff'))]

with sync_playwright() as p:
    b = p.chromium.launch()
    for src, out, size, swap in JOBS:
        svg = open(os.path.join(DIR, src), encoding='utf-8').read()
        if swap: svg = svg.replace(swap[0], swap[1])
        pg = b.new_page(viewport={'width': size, 'height': size})
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg.replace("<svg ", f"<svg width={size} height={size} ", 1)}</body></html>')
        pg.screenshot(path=os.path.join(DIR, out), omit_background=True, clip={'x': 0, 'y': 0, 'width': size, 'height': size})
        pg.close()
        print('wrote', out)
    b.close()
