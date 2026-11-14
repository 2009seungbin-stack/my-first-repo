"""Recompute packaged RGBA comparisons with Pillow. No network or file writes.
Usage: python verify-alpha-roundtrip.py PATH_TO_EXTRACTED_PACKAGE
"""
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit
from PIL import Image
import argparse
import hashlib
import io
import json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', nargs='?', default=str(Path(__file__).resolve().parent))
    folder = Path(parser.parse_args().folder).resolve()

    def read(name):
        if Path(name).name != name or ':' in name or '..' in name:
            raise ValueError('Expected a package basename')
        target = (folder / name).resolve()
        if target.parent != folder:
            raise ValueError('Refusing a path outside the package')
        return target.read_bytes()

    def sha(blob):
        return hashlib.sha256(blob).hexdigest()

    def pixels(name):
        if name.endswith('.rgba'):
            blob = read(name)
        else:
            with Image.open(io.BytesIO(read(name))) as image:
                image.load()
                if image.size != (128, 96) or image.format not in ['PNG', 'WEBP']:
                    raise ValueError('Unexpected image dimensions or format')
                converted = image.convert('RGBA')
                try:
                    blob = converted.tobytes()
                finally:
                    converted.close()
        if len(blob) != 49152:
            raise ValueError('Expected tightly packed 128 by 96 RGBA8 samples')
        return blob

    def compare(reference, actual):
        result = []
        for alpha in sorted(set(reference[3::4])):
            indexes = [i for i in range(0, len(reference), 4) if reference[i + 3] == alpha]
            changes = sum(reference[i:i + 3] != actual[i:i + 3] for i in indexes)
            alpha_changes = sum(reference[i + 3] != actual[i + 3] for i in indexes)
            largest = max(abs(reference[i + c] - actual[i + c]) for i in indexes for c in range(3))
            result.append({'referenceAlpha': alpha, 'pixels': len(indexes), 'rgbChanged': changes,
                           'alphaChanged': alpha_changes, 'maxRgbDelta': largest})
        return {'groups': result, 'allRgbaEqual': reference == actual}

    report = json.loads(read('measurements.json'))
    if report['schema'] != 'nerulio.alpha-roundtrip/1' or len(report['observations']) != 16:
        raise ValueError('Unexpected measurement schema')
    manifest = json.loads(read('manifest.json'))
    for name, entry in manifest.items():
        blob = read(name)
        if len(blob) != entry['bytes'] or sha(blob) != entry['sha256']:
            raise ValueError('Manifest mismatch: ' + name)
    references = {}
    for item in report['inputs']:
        blob = read(item['file'])
        if sha(blob) != item['sha256'] or len(blob) != item['bytes']:
            raise ValueError('Input changed')
        references[item['file']] = pixels(item['file'])
        if sha(references[item['file']]) != item['rgbaSha256']:
            raise ValueError('Input pixel samples changed')
    rows = report['observations']
    buffers = {(r['engine'], r['input'], r['mode']): pixels(r['file']) for r in rows}
    files = {(r['engine'], r['input'], r['mode']): read(r['file']) for r in rows}
    for row in rows:
        key = row['engine'], row['input'], row['mode']
        raw = buffers[key]
        if sha(files[key]) != row['sha256'] or len(files[key]) != row['bytes']:
            raise ValueError('Observation file changed')
        if compare(references[row['input']], raw) != row['inputComparison']:
            raise ValueError('Source comparison changed')
        if row['mode'] != 'decoded-read':
            decoded = buffers[(row['engine'], row['input'], 'decoded-read')]
            if compare(decoded, raw) != row['decodedReadComparison']:
                raise ValueError('Readback comparison changed')
            earlier = row['earlierNativeDownload']
            name = 'native-' + PurePosixPath(urlsplit(earlier['url']).path).name
            old = read(name)
            if sha(old) != earlier['sha256']:
                raise ValueError('Earlier native reference changed')
            if (old == files[key]) != earlier['encodedBytesEqual'] or (pixels(name) == raw) != earlier['rgbaEqual']:
                raise ValueError('Earlier native comparison changed')
        if row['mode'] == 'png-observed':
            observer = row['observerRead']
            observed = read(observer['file'])
            if len(observed) != observer['bytes'] or sha(observed) != observer['sha256']:
                raise ValueError('Observer buffer changed')
            if (observed == decoded) != observer['rgbaEqual']:
                raise ValueError('Observer read comparison changed')
            control = files[(row['engine'], row['input'], 'png-control')]
            if (control == files[key]) != row['readObserverEncodedBytesEqual']:
                raise ValueError('Observer export comparison changed')
        if row['mode'] == 'webp-control':
            blob = files[key]
            if blob[:4] != b'RIFF' or blob[8:12] != b'WEBP' or int.from_bytes(blob[4:8], 'little') != len(blob) - 8:
                raise ValueError('Invalid WebP container')
            at, chunks = 12, []
            while at + 8 <= len(blob):
                chunks.append(blob[at:at + 4])
                size = int.from_bytes(blob[at + 4:at + 8], 'little')
                at += 8 + size + (size % 2)
            if at != len(blob) or b'VP8L' not in chunks or b'VP8 ' in chunks:
                raise ValueError('Expected lossless VP8L output')
        print(row['engine'], row['input'], row['mode'], 'verified')
    print('Verified 16 observations, observer buffers and earlier native references. No network was used.')


if __name__ == '__main__':
    main()
