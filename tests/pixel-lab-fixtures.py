"""Reproducible Pixel Lab fixtures: anti-aliased animation frames, upscaled sprites and a
deliberately non-integer bilinear resize. Imported by tests/task-browser.py and by the
verification script; nothing here touches the network or user files.

python tests/pixel-lab-fixtures.py <dir>   writes every fixture as a PNG for inspection.
"""
from PIL import Image, ImageDraw
import io, math, sys
from pathlib import Path

PALETTE = [(26, 28, 44), (93, 39, 93), (177, 62, 83), (239, 125, 87), (255, 205, 117), (167, 240, 112)]


def png(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return b.getvalue()


def aa_frame(index, size=48, frames=8):
    """One animation frame: a bobbing ball drawn with 4x supersampling, so every edge carries
    anti-aliased colours that are NOT in the intended palette. The lower third of the frame is a
    fixed flat band, which is the region a palette lock must reproduce identically in every frame."""
    big = Image.new('RGBA', (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    bob = int(round(math.sin(index / frames * 2 * math.pi) * 3)) * 4
    cx, cy, r = size * 2, size * 2 - 4 * 4 + bob, size * 4 // 3
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=PALETTE[3] + (255,), outline=PALETTE[0] + (255,), width=8)
    d.ellipse([cx - r // 2, cy - r // 2, cx, cy], fill=PALETTE[4] + (255,))
    im = big.resize((size, size), Image.LANCZOS)
    band = Image.new('RGBA', (size, size // 4), PALETTE[2] + (255,))
    im.paste(band, (0, size - size // 4))
    return im


def frames(n=8, size=48):
    return [(f'anim_{i}.png', png(aa_frame(i, size, n))) for i in range(n)]


def flat_sprite(size=16, seed=7):
    """A 1x pixel sprite with single-pixel detail: exactly `len(PALETTE)` colours, hard edges."""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = im.load()
    for y in range(size):
        for x in range(size):
            v = (x * 3 + y * 5 + seed) % (len(PALETTE) + 1)
            px[x, y] = PALETTE[v] + (255,) if v < len(PALETTE) else (0, 0, 0, 0)
    for x in range(size):
        px[x, 0] = PALETTE[0] + (255,)
        px[x, size - 1] = PALETTE[0] + (255,)
    for y in range(size):
        px[0, y] = PALETTE[0] + (255,)
        px[size - 1, y] = PALETTE[0] + (255,)
    px[size // 2, size // 2] = PALETTE[5] + (255,)
    return im


def upscaled(scale, size=16):
    base = flat_sprite(size)
    return base.resize((size * scale, size * scale), Image.NEAREST)


def bilinear(factor=2.5, size=16):
    base = flat_sprite(size)
    w = int(round(size * factor))
    return base.resize((w, w), Image.BILINEAR)


def nearest_non_integer(factor=2.5, size=16):
    base = flat_sprite(size)
    w = int(round(size * factor))
    return base.resize((w, w), Image.NEAREST)


FIXTURES = {
    'anim': lambda: [aa_frame(i) for i in range(8)],
    'flat-1x': lambda: [flat_sprite()],
    'nearest-3x': lambda: [upscaled(3)],
    'nearest-4x': lambda: [upscaled(4)],
    'nearest-2.5x': lambda: [nearest_non_integer()],
    'bilinear-2.5x': lambda: [bilinear()],
}

if __name__ == '__main__':
    out = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
    out.mkdir(parents=True, exist_ok=True)
    for name, make in FIXTURES.items():
        for i, im in enumerate(make()):
            im.save(out / f'{name}-{i}.png')
    print('wrote fixtures to', out)
