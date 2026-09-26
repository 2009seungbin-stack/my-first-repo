"""Write PICO-8 as a genuine Adobe Swatch Exchange (ASEF v1.0) file to test T14 import."""
import os, struct
C = r"C:\Users\2009s\nerulio-asset-corpus\palettes\lospec\pico-8.gpl"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "aseprite", "pico8_adobe_swatch.ase")
cols = []
for line in open(C):
    parts = line.split()
    if len(parts) >= 3 and all(p.isdigit() for p in parts[:3]):
        cols.append(tuple(int(p) for p in parts[:3]))
blocks = b""
for i, (r, g, b) in enumerate(cols):
    name = f"c{i}\0".encode("utf-16-be")
    body = struct.pack(">H", len(name) // 2) + name + b"RGB " + struct.pack(">fff", r / 255, g / 255, b / 255) + struct.pack(">H", 2)
    blocks += struct.pack(">HI", 0x0001, len(body)) + body
data = b"ASEF" + struct.pack(">HHI", 1, 0, len(cols)) + blocks
open(OUT, "wb").write(data)
print(OUT, len(cols), "swatches", len(data), "bytes")
