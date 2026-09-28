"""Render a small, original 16px avatar art-direction gate.

All geometry below was drawn for this prototype. No competitor or game art is used.
Run: python docs/avatar-prototype/render_lineup.py
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output"
OUT.mkdir(exist_ok=True)

# Each ramp is outline, shadow, base, highlight. Transparent is index zero.
RAMPS = {
    "ink": (24, 28, 48, 255),
    "skin": ((96, 49, 53, 255), (189, 113, 93, 255), (238, 174, 137, 255), (255, 213, 174, 255)),
    "hair-dark": ((24, 28, 48, 255), (45, 53, 79, 255), (79, 99, 117, 255), (139, 164, 163, 255)),
    "hair-red": ((77, 35, 55, 255), (135, 52, 69, 255), (200, 80, 83, 255), (246, 147, 112, 255)),
    "coat-blue": ((23, 45, 77, 255), (34, 83, 125, 255), (58, 139, 164, 255), (127, 208, 202, 255)),
    "coat-gold": ((75, 51, 48, 255), (153, 93, 62, 255), (222, 156, 83, 255), (255, 217, 136, 255)),
    "eye": ((24, 28, 48, 255), (38, 65, 89, 255), (65, 119, 129, 255), (221, 243, 219, 255)),
}


def rect(draw, xy, color):
    draw.rectangle(xy, fill=color)


def render(face, hair, eyes, outfit):
    image = Image.new("RGBA", (16, 16))
    d = ImageDraw.Draw(image)
    skin = RAMPS["skin"]
    hc = RAMPS["hair-red" if hair == "swept" else "hair-dark"]
    cloth = RAMPS["coat-gold" if outfit == "jacket" else "coat-blue"]

    # Back hair silhouette, including a second shape that remains visible at 32px.
    if hair == "swept":
        rect(d, (2, 4, 13, 10), hc[0]); rect(d, (2, 8, 4, 12), hc[1])
        rect(d, (11, 7, 13, 12), hc[1])
    else:
        rect(d, (3, 3, 12, 10), hc[0]); rect(d, (3, 8, 4, 11), hc[1])
        rect(d, (11, 8, 12, 11), hc[1])

    # Round face has stepped cheeks; angular face has a broad chin.
    if face == "round":
        rect(d, (4, 4, 11, 9), skin[0]); rect(d, (5, 10, 10, 11), skin[0])
        rect(d, (4, 5, 11, 8), skin[2]); rect(d, (5, 9, 10, 10), skin[2])
        rect(d, (5, 5, 9, 6), skin[3]); rect(d, (10, 7, 11, 8), skin[1])
    else:
        rect(d, (3, 4, 12, 10), skin[0]); rect(d, (4, 11, 11, 11), skin[0])
        rect(d, (4, 5, 11, 9), skin[2]); rect(d, (5, 10, 10, 10), skin[2])
        rect(d, (4, 5, 9, 6), skin[3]); rect(d, (11, 7, 11, 9), skin[1])
    rect(d, (7, 11, 8, 12), skin[1])

    if eyes == "bright":
        rect(d, (5, 7, 5, 8), RAMPS["eye"][0]); rect(d, (10, 7, 10, 8), RAMPS["eye"][0])
        d.point((5, 7), fill=RAMPS["eye"][3]); d.point((10, 7), fill=RAMPS["eye"][3])
    else:
        rect(d, (5, 8, 6, 8), RAMPS["eye"][0]); rect(d, (9, 8, 10, 8), RAMPS["eye"][0])
    d.point((7, 10), fill=skin[0]); d.point((8, 10), fill=skin[0])

    # Visible torso silhouette and center seam at even the smallest export.
    rect(d, (4, 12, 11, 15), cloth[0]); rect(d, (3, 13, 12, 15), cloth[0])
    rect(d, (4, 13, 11, 15), cloth[2]); rect(d, (7, 13, 8, 15), cloth[1])
    if outfit == "jacket":
        rect(d, (5, 13, 5, 15), cloth[3]); rect(d, (10, 13, 10, 15), cloth[3])
        d.point((7, 14), fill=cloth[3])
    else:
        rect(d, (4, 13, 5, 13), cloth[3]); rect(d, (10, 13, 11, 13), cloth[3])
        rect(d, (6, 13, 9, 13), cloth[0])

    # Front hair comes last and makes the two styles unmistakable.
    if hair == "swept":
        rect(d, (3, 2, 11, 3), hc[0]); rect(d, (2, 4, 12, 4), hc[1])
        rect(d, (3, 5, 8, 5), hc[2]); rect(d, (3, 6, 5, 6), hc[2])
        rect(d, (5, 3, 8, 3), hc[3]); rect(d, (12, 5, 13, 8), hc[1])
    else:
        rect(d, (4, 2, 11, 2), hc[0]); rect(d, (3, 3, 12, 4), hc[1])
        rect(d, (4, 5, 6, 5), hc[2]); rect(d, (9, 5, 11, 5), hc[2])
        rect(d, (7, 4, 8, 6), hc[2]); rect(d, (5, 3, 9, 3), hc[3])
    return image


COMBOS = [
    ("round", "bob", "bright", "hoodie"),
    ("angular", "swept", "sleepy", "jacket"),
    ("round", "swept", "bright", "jacket"),
    ("angular", "bob", "sleepy", "hoodie"),
]

font = ImageFont.load_default()
sheet = Image.new("RGB", (780, 414), (231, 235, 238))
sd = ImageDraw.Draw(sheet)
sd.text((20, 14), "16px logical grid | nearest integer export | original CC0 study", font=font, fill=(25, 32, 46))
for row, size in enumerate((32, 48, 64)):
    sd.text((20, 52 + row * 116), f"{size} px", font=font, fill=(25, 32, 46))
    for col, combo in enumerate(COMBOS):
        source = render(*combo)
        if row == 0:
            source.save(OUT / f"avatar-{col + 1}-16.png")
        scaled = source.resize((size, size), Image.Resampling.NEAREST)
        scaled.save(OUT / f"avatar-{col + 1}-{size}.png")
        # Independently assert every output pixel is an exact replicated source pixel.
        factor = size // 16
        for y in range(size):
            for x in range(size):
                assert scaled.getpixel((x, y)) == source.getpixel((x // factor, y // factor))
        x = 90 + col * 168 + (64 - size) // 2
        y = 40 + row * 116
        sd.rectangle((x - 4, y - 4, x + 67, y + 67), fill=(255, 255, 255))
        sheet.paste(scaled, (x, y), scaled)
        if row == 0:
            sd.text((90 + col * 168, 378), "/".join(combo), font=font, fill=(25, 32, 46))
sheet.save(OUT / "lineup-32-48-64.png")
print(OUT / "lineup-32-48-64.png")
