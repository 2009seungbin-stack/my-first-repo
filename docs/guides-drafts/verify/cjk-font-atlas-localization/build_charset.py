"""build_charset.py - collect every character your game's strings use.

Usage:  python build_charset.py loc/strings.csv loc/ko.json loc/ja.po > charset.txt
Reads CSV (all columns except the first, which holds the key), JSON (every string value)
and gettext PO (msgstr only). Always adds printable ASCII, because numbers, names and
formatted values are inserted at runtime and never appear in the string table.
"""
import csv, io, json, sys, unicodedata
from pathlib import Path

def from_csv(text):
    rows = list(csv.reader(io.StringIO(text)))
    for row in rows[1:]:              # row 0 is the header
        yield from row[1:]            # column 0 is the key

def from_json(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from from_json(v)
    elif isinstance(value, list):
        for v in value:
            yield from from_json(v)

def from_po(text):
    in_msgstr = False
    for line in text.splitlines():
        line = line.strip()
        if line.startswith('msgstr'):
            in_msgstr = True
            line = line.split(None, 1)[1] if ' ' in line else '""'
        elif line.startswith(('msgid', 'msgctxt', '#')) or not line:
            in_msgstr = False
            continue
        if in_msgstr and line.startswith('"'):
            yield json.loads(line)    # a PO string literal is a JSON-compatible literal

chars = {chr(c) for c in range(0x20, 0x7F)}
for name in sys.argv[1:]:
    path = Path(name)
    text = path.read_text(encoding='utf-8-sig')
    source = {'.csv': from_csv, '.po': from_po}.get(path.suffix)
    strings = source(text) if source else from_json(json.loads(text))
    for s in strings:
        chars.update(ch for ch in s if unicodedata.category(ch)[0] != 'C')  # drop \n, tabs, controls

sys.stdout.reconfigure(encoding='utf-8')
print(''.join(sorted(chars)))
counts = {}
for ch in chars:
    n = ord(ch)
    kind = ('Hangul' if 0xAC00 <= n <= 0xD7A3 else 'Kana' if 0x3040 <= n <= 0x30FF
            else 'Han' if 0x4E00 <= n <= 0x9FFF else 'ASCII' if n < 0x80 else 'Other')
    counts[kind] = counts.get(kind, 0) + 1
print(len(chars), 'characters:', counts, file=sys.stderr)
