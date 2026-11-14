"""Offline verification of the authored BMP/PNG study; requires Pillow.

Reads only the expected files in a supplied directory. No network or writes.
"""
from pathlib import Path
from PIL import Image
import argparse
import hashlib
import json
import struct
import zlib


def sha(data):
    return hashlib.sha256(data).hexdigest()


def png_chunks(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    at, result = 8, []
    while at < len(data):
        size = int.from_bytes(data[at:at + 4], 'big')
        kind = data[at + 4:at + 8]
        payload = data[at + 8:at + 8 + size]
        crc = int.from_bytes(data[at + 8 + size:at + 12 + size], 'big')
        assert len(payload) == size and zlib.crc32(kind + payload) & 0xffffffff == crc
        result.append(kind.decode('ascii'))
        at += size + 12
    assert at == len(data) and result[-1] == 'IEND'
    return result


def compare(before, after, alpha):
    pairs = [(a, b) for a, b in zip(before, after) if a[3] == alpha]
    return {'pixels': len(pairs),
            'changedRgbPixels': sum(a[:3] != b[:3] for a, b in pairs),
            'maxRgbDelta': max((abs(a[c] - b[c]) for a, b in pairs for c in range(3)), default=0),
            'changedAlphaPixels': sum(a[3] != b[3] for a, b in pairs)}


def analyze(directory):
    root = Path(directory).resolve()

    def read(name):
        assert isinstance(name, str) and name == Path(name).name and '/' not in name and '\\' not in name
        target = (root / name).resolve()
        assert target.parent == root
        return target.read_bytes()

    report = json.loads(read('measurements.json'))
    assert report['dimensions'] == [128, 96] and len(report['observations']) == 4
    protocol = read('measure-bmp-png.py')
    assert sha(protocol.replace(b'\r\n', b'\n')) == report['protocolSha256Utf8LF']
    inputs, source_metadata = {}, []
    assert {i['name'] for i in report['inputs']} == {'opaque-v4.bmp', 'alpha-v4.bmp'}
    for item in report['inputs']:
        data = read(item['name'])
        assert sha(data) == item['sha256'] and len(data) == item['bytes'] == 49274
        magic, size, reserved1, reserved2, offset = struct.unpack_from('<2sIHHI', data)
        assert (magic, size, reserved1, reserved2, offset) == (b'BM', len(data), 0, 0, 122)
        header = struct.unpack_from('<IiiHHIIiiII', data, 14)
        assert header == (108, 128, 96, 1, 32, 3, 49152, 2835, 2835, 0, 0)
        assert struct.unpack_from('<IIIII', data, 54) == (0xff0000, 0xff00, 0xff, 0xff000000, 0x73524742)
        raw = data[offset:]
        rgba = [tuple(raw[(95 - y) * 512 + x * 4 + c] for c in [2, 1, 0, 3])
                for y in range(96) for x in range(128)]
        inputs[item['name']] = rgba
        source_metadata.append({'file': item['name'], 'bitsPerPixel': 32,
                                'dpiFromPixelsPerMetre': [2835 * .0254, 2835 * .0254]})
    seen, rows = set(), []
    from io import BytesIO
    for record in report['observations']:
        engine, name = record['engine'], record['input']
        assert engine in ['chromium', 'firefox'] and name in inputs
        assert (engine, name) not in seen
        seen.add((engine, name))
        assert record['output'] == engine + '-' + name.replace('.bmp', '.png')
        data = read(record['output'])
        assert sha(data) == record['outputSha256'] and len(data) == record['outputBytes']
        with Image.open(BytesIO(data)) as image:
            image.load()
            assert image.format == 'PNG' and image.size == (128, 96)
            actual = list(image.convert('RGBA').getdata())
            metadata_keys = sorted(image.info)
        original = inputs[name]
        bands = {str(alpha): compare(original, actual, alpha) for alpha in sorted({p[3] for p in original})}
        assert bands == record['bands']
        rows.append({'engine': engine, 'input': name, 'output': record['output'],
                     'pngChunks': png_chunks(data), 'metadataKeys': metadata_keys, 'bands': bands})
    assert len(seen) == 4
    return {'sourceCommit': report['sourceCommit'], 'protocolCommit': report['protocolCommit'],
            'inputs': source_metadata, 'observations': rows,
            'verified': 'All four native outputs match recorded hashes, dimensions and recomputed alpha-band differences. PNG chunk CRCs checked; original BMP samples parsed directly. Hidden RGB at alpha0 is not visible quality loss.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', nargs='?', default=str(Path(__file__).resolve().parent))
    print(json.dumps(analyze(parser.parse_args().directory), indent=2))
