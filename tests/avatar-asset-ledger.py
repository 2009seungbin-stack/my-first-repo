"""Independently reopen and hash every published original avatar part preview."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
assets=ROOT/'assets/avatar-parts'
ledger=json.loads((assets/'manifest.json').read_text(encoding='utf-8'))
assert ledger['sourceSha256']==hashlib.sha256((ROOT/ledger['sourceRenderer']).read_bytes()).hexdigest()
assert ledger['catalogSha256']==hashlib.sha256((ROOT/'src/avatar/catalog.js').read_bytes()).hexdigest()
assert len(ledger['parts'])==14
for part in ledger['parts']:
    path=assets/part['preview']
    assert path.is_file() and part['sha256']==hashlib.sha256(path.read_bytes()).hexdigest()
    assert part['license']=='CC0-1.0' and part['sourceUrl'].startswith('https://github.com/')
    with Image.open(path) as image:
        assert image.mode=='RGBA' and image.size==(64,64)
        for y in range(64):
            for x in range(64):
                assert image.getpixel((x,y))==image.getpixel((x//4*4,y//4*4))
print('14 CC0 part previews: SHA-256, pinned source, RGBA and exact 4x pixel blocks verified.')
