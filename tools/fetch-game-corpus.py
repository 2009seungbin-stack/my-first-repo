"""Fetch the Nerulio game-asset test corpus from the URLs in its manifest and check every hash.

The corpus lives OUTSIDE the repository (default C:/Users/2009s/nerulio-asset-corpus, or
$NERULIO_CORPUS, or --root). Only the manifest is committed, as tests/game-corpus.manifest.json.
Most files are CC0; some are CC-BY/OFL and marked `"committable": false` - those may be used for
local testing but must never be committed. See docs/GAME-CORPUS.md.

    python tools/fetch-game-corpus.py                  # download what is missing, verify all
    python tools/fetch-game-corpus.py --verify         # hash-check what is on disk, no network
    python tools/fetch-game-corpus.py --only tileset   # one category (or a source id)
    python tools/fetch-game-corpus.py --record         # authoring: fill in sha256/bytes/size

Manifest schema (schemaVersion 1):
  sources: {id: {url, page, type: zip|file, author, licence, licenceUrl, committable, sha256?}}
  files:   [{path, category, source, member?, derive?, sha256, bytes, size?, truth?, tags?}]
    - `source` + `member` : the file is `member` inside the `source` archive (type zip)
    - `source` alone      : the source is the file itself (type file)
    - `derive`            : {from: <corpus path>, op: ...} regenerated locally with Pillow, see DERIVE_OPS
  references: [{path, note}]  files owned by other agents, listed but not fetched

Exit code 0 only when every selected file exists and matches its SHA-256.
"""
from __future__ import annotations
import argparse, hashlib, io, json, os, sys, time, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / 'tests' / 'game-corpus.manifest.json'
DEFAULT_CORPUS = Path(os.environ.get('NERULIO_CORPUS', r'C:\Users\2009s\nerulio-asset-corpus'))
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) nerulio-corpus-fetch/1'


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def download(url: str, dest: Path, attempts: int = 3) -> bytes:
    """Download once into the archive cache; later runs reuse the cached copy."""
    if dest.exists() and dest.stat().st_size > 0:
        return dest.read_bytes()
    dest.parent.mkdir(parents=True, exist_ok=True)
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            tmp = dest.with_suffix(dest.suffix + '.part')
            tmp.write_bytes(data)
            tmp.replace(dest)
            return data
        except Exception as e:  # network errors are retried, then reported
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f'download failed: {url}: {last}')


def image_size(data: bytes):
    try:
        from PIL import Image
        with Image.open(io.BytesIO(data)) as im:
            return {'w': im.width, 'h': im.height, 'mode': im.mode}
    except Exception:
        return None


# Derived files: deterministic transforms of corpus files, for cases no real CC0 file covers
# (e.g. a known-scale nearest upscale whose ground truth is exact by construction).
def _derive(op: dict, corpus: Path) -> bytes:
    from PIL import Image, ImageFilter
    src = Image.open(corpus / op['from'])
    src.load()
    kind = op['op']
    if kind == 'nearest':
        f = int(op['factor'])
        out = src.resize((src.width * f, src.height * f), Image.NEAREST)
    elif kind == 'resample':  # non-integer or smooth resample: the "blurred upscale" case
        w, h = op['size']
        out = src.convert('RGBA').resize((int(w), int(h)), {'bilinear': Image.BILINEAR, 'bicubic': Image.BICUBIC, 'lanczos': Image.LANCZOS}[op['filter']])
    elif kind == 'key':  # flatten transparency onto a key colour, the way old sheets ship
        rgba = src.convert('RGBA')
        bg = Image.new('RGBA', rgba.size, tuple(op['color']) + (255,))
        a = rgba.getchannel('A').point(lambda v: 255 if v >= int(op.get('threshold', 128)) else 0)
        bg.paste(rgba.convert('RGB'), (0, 0), a)
        out = bg.convert('RGB')
    elif kind == 'crop':
        x, y, w, h = op['box']
        out = src.crop((x, y, x + w, y + h))
    elif kind == 'grid-repack':  # re-lay a uniform grid with a new margin/spacing (exact by construction)
        cw, ch = op['cell']; cols, rows = op['grid']; m0, s0 = op.get('srcMargin', 0), op.get('srcSpacing', 0)
        m1, s1 = op['margin'], op['spacing']
        rgba = src.convert('RGBA')
        bg = tuple(op.get('background', [0, 0, 0, 0]))
        out = Image.new('RGBA', (2 * m1 + cols * cw + (cols - 1) * s1, 2 * m1 + rows * ch + (rows - 1) * s1), bg)
        for r in range(rows):
            for c in range(cols):
                x0, y0 = m0 + c * (cw + s0), m0 + r * (ch + s0)
                cell = rgba.crop((x0, y0, x0 + cw, y0 + ch))
                at = (m1 + c * (cw + s1), m1 + r * (ch + s1))
                if bg[3] == 0:
                    out.paste(cell, at)  # exact RGBA copy
                else:  # opaque key background: binary alpha so the key stays a single colour
                    out.paste(cell, at, cell.getchannel('A').point(lambda v: 255 if v >= 128 else 0))
        if bg[3] == 255:
            out = out.convert('RGB')
    elif kind == 'tile':  # repeat to a large sheet
        w, h = op['size']
        out = Image.new(src.mode, (w, h))
        for y in range(0, h, src.height):
            for x in range(0, w, src.width):
                out.paste(src, (x, y))
    elif kind == 'blur':
        out = src.filter(ImageFilter.GaussianBlur(float(op['radius'])))
    else:
        raise ValueError(f'unknown derive op {kind}')
    buf = io.BytesIO()
    out.save(buf, 'PNG', optimize=False, compress_level=6)
    return buf.getvalue()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--manifest', default=str(DEFAULT_MANIFEST))
    ap.add_argument('--root', default=str(DEFAULT_CORPUS))
    ap.add_argument('--only', action='append', default=[], help='category, source id or path prefix (repeatable)')
    ap.add_argument('--verify', action='store_true', help='no network: hash-check files already on disk')
    ap.add_argument('--record', action='store_true', help='authoring: write sha256/bytes/size for entries that lack them')
    ap.add_argument('--force', action='store_true', help='rewrite files even when they exist')
    args = ap.parse_args()

    manifest_path = Path(args.manifest)
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    corpus = Path(args.root)
    cache = corpus / '_downloads'
    sources = manifest.get('sources', {})
    files = manifest.get('files', [])

    def selected(f):
        if not args.only:
            return True
        return any(f.get('category') == o or f.get('source') == o or f['path'].startswith(o) for o in args.only)

    chosen = [f for f in files if selected(f)]
    # Derived files depend on their inputs, so do sourced files first.
    chosen.sort(key=lambda f: 1 if 'derive' in f else 0)
    archives: dict[str, zipfile.ZipFile] = {}
    ok = bad = missing = recorded = 0
    for f in chosen:
        target = corpus / f['path']
        try:
            if args.verify:
                if not target.exists():
                    print(f'MISSING  {f["path"]}'); missing += 1; continue
                data = target.read_bytes()
            elif target.exists() and not args.force:
                data = target.read_bytes()
            elif 'derive' in f:
                data = _derive(f['derive'], corpus)
            else:
                src = sources[f['source']]
                name = src.get('cacheName') or (f['source'] + ('.zip' if src['type'] == 'zip' else Path(src['url'].split('?')[0]).suffix))
                blob = download(src['url'], cache / name)
                if src['type'] == 'zip':
                    if f['source'] not in archives:
                        archives[f['source']] = zipfile.ZipFile(io.BytesIO(blob))
                    data = archives[f['source']].read(f['member'])
                else:
                    data = blob
            if not target.exists() or args.force:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        except Exception as e:
            print(f'ERROR    {f["path"]}: {e}'); bad += 1; continue
        digest = sha256(data)
        if args.record and not f.get('sha256'):
            f['sha256'] = digest; f['bytes'] = len(data)
            size = image_size(data) if target.suffix.lower() in ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tga') else None
            if size:
                f['size'] = {'w': size['w'], 'h': size['h']}
                f.setdefault('mode', size['mode'])
            recorded += 1
            print(f'RECORDED {f["path"]} {digest[:12]}'); ok += 1; continue
        if f.get('sha256') == digest:
            ok += 1
        else:
            print(f'HASH     {f["path"]}: expected {f.get("sha256")}, got {digest}'); bad += 1
    if args.record and recorded:
        manifest_path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    for ref in manifest.get('references', []):
        if selected({'path': ref['path'], 'category': ref.get('category')}) and not (corpus / ref['path']).exists():
            print(f'REFERENCE MISSING (owned elsewhere) {ref["path"]}')
    print(f'{ok} ok, {bad} failed, {missing} missing, of {len(chosen)} selected ({len(files)} in manifest) -> {corpus}')
    return 0 if bad == 0 and missing == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
