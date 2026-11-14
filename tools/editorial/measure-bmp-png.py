"""Measure native BMP-to-PNG downloads using authored RGBA8 BMP V4 controls.

Requires this repository, Pillow, Playwright and its installed browsers. Writes
only a new output directory. No user image, cookie, credential or upload is used.
"""
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlsplit
from PIL import Image
from playwright.sync_api import sync_playwright, expect
import argparse
import hashlib
import json
import re
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PROTOCOL = 'tools/editorial/measure-bmp-png.py'
MODULES = ['src/task/convert.js', 'src/image.js', 'src/image-container.js', 'src/core.js']
WIDTH, HEIGHT = 128, 96


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def pixels(transparent):
    return [((x * 17 + y * 3) % 256, (x * 5 + y * 19) % 256,
             255 if (x + y) % 2 else 0,
             [0, 64, 128, 255][x // 32] if transparent else 255)
            for y in range(HEIGHT) for x in range(WIDTH)]


def bmp_bytes(rgba):
    # BITMAPV4HEADER, bottom-up BGRA8, BI_BITFIELDS, explicit RGBA masks and sRGB tag.
    body = bytes(channel for y in range(HEIGHT - 1, -1, -1)
                 for x in range(WIDTH) for channel in
                 (rgba[y * WIDTH + x][2], rgba[y * WIDTH + x][1],
                  rgba[y * WIDTH + x][0], rgba[y * WIDTH + x][3]))
    dib = struct.pack('<IiiHHIIiiII', 108, WIDTH, HEIGHT, 1, 32, 3,
                      len(body), 2835, 2835, 0, 0)
    dib += struct.pack('<IIIII', 0x00FF0000, 0x0000FF00, 0x000000FF,
                       0xFF000000, 0x73524742) + bytes(48)
    assert len(dib) == 108
    return struct.pack('<2sIHHI', b'BM', 122 + len(body), 0, 0, 122) + dib + body


def differences(before, after, indices):
    pairs = [(before[i], after[i]) for i in indices]
    return {'pixels': len(pairs),
            'changedRgbPixels': sum(a[:3] != b[:3] for a, b in pairs),
            'maxRgbDelta': max((abs(a[c] - b[c]) for a, b in pairs for c in range(3)), default=0),
            'changedAlphaPixels': sum(a[3] != b[3] for a, b in pairs)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='https://nerulio.com')
    parser.add_argument('--expected-sha', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    base = args.base.rstrip('/')
    url = urlsplit(base)
    if url.username or url.password or url.query or url.fragment or url.path:
        raise ValueError('Use an origin without authentication or a path')
    if url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ['localhost', '127.0.0.1']):
        raise ValueError('HTTPS is required except for a loopback fixture')
    if not re.fullmatch('[a-f0-9]{40}', args.expected_sha):
        raise ValueError('Provide an exact source SHA')
    if git('status', '--porcelain', '--untracked-files=no').strip():
        raise ValueError('Commit tracked changes before measuring')
    protocol_commit = git('rev-parse', 'HEAD').decode().strip()
    protocol = Path(__file__).read_bytes().replace(b'\r\n', b'\n')
    if protocol != git('show', protocol_commit + ':' + PROTOCOL).replace(b'\r\n', b'\n'):
        raise ValueError('The protocol must match its committed bytes')
    out = Path(args.output).resolve()
    out.mkdir(parents=True, exist_ok=False)
    inputs = []
    for transparent in [False, True]:
        name = 'alpha-v4.bmp' if transparent else 'opaque-v4.bmp'
        expected = pixels(transparent)
        path = out / name
        path.write_bytes(bmp_bytes(expected))
        with Image.open(path) as image:
            image.load()
            assert image.format == 'BMP' and image.size == (WIDTH, HEIGHT)
            assert list(image.convert('RGBA').getdata()) == expected
        inputs.append({'name': name, 'sha256': digest(path.read_bytes()),
                       'bytes': path.stat().st_size, 'transparent': transparent})
    rows, code, errors = [], [], []
    with sync_playwright() as pw:
        for engine in ['chromium', 'firefox']:
            browser = getattr(pw, engine).launch()
            ctx = browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 1000})
            page = ctx.new_page()
            page.set_default_timeout(45000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            try:
                assert ctx.request.get(base + '/build.txt').text().strip() == args.expected_sha
                for module in MODULES:
                    response = ctx.request.get(base + '/' + module)
                    expected = git('show', args.expected_sha + ':' + module).replace(b'\r\n', b'\n')
                    assert response.status == 200 and response.body().replace(b'\r\n', b'\n') == expected
                    code.append({'engine': engine, 'path': module, 'sha256Utf8LF': digest(expected)})
                for fixture in inputs:
                    response = page.goto(base + '/en/image/bmp-to-png/', wait_until='load')
                    assert response.status in [200, 304]
                    page.locator('#fileInput').set_input_files(out / fixture['name'])
                    expect(page.locator('#taskDownload')).to_be_enabled()
                    assert page.locator('#convertFormat [aria-pressed=true]').get_attribute('data-format') == 'png'
                    with page.expect_download() as event:
                        page.locator('#taskDownload').click()
                    filename = engine + '-' + fixture['name'].replace('.bmp', '.png')
                    event.value.save_as(out / filename)
                    with Image.open(out / filename) as image:
                        image.load()
                        assert image.format == 'PNG' and image.size == (WIDTH, HEIGHT)
                        actual = list(image.convert('RGBA').getdata())
                    original = pixels(fixture['transparent'])
                    bands = {str(alpha): differences(original, actual, [i for i, p in enumerate(original) if p[3] == alpha])
                             for alpha in sorted({p[3] for p in original})}
                    row = {'engine': engine, 'browserVersion': browser.version,
                           'input': fixture['name'], 'output': filename,
                           'outputSha256': digest((out / filename).read_bytes()),
                           'outputBytes': (out / filename).stat().st_size,
                           'bands': bands, 'note': page.locator('#viewerNote').inner_text()}
                    rows.append(row)
                    print(json.dumps(row), flush=True)
                assert ctx.request.get(base + '/build.txt').text().strip() == args.expected_sha
            finally:
                ctx.close()
                browser.close()
    assert not errors, errors
    result = {'measuredAtUTC': datetime.now(timezone.utc).isoformat(),
              'sourceCommit': args.expected_sha, 'protocolCommit': protocol_commit,
              'protocolSha256Utf8LF': digest(protocol), 'dimensions': [WIDTH, HEIGHT],
              'bmpFormat': 'BITMAPV4HEADER 108 bytes,32bpp,BI_BITFIELDS3,bottom-up BGRA8,RGBA masks,sRGB constant',
              'inputs': inputs, 'code': code, 'observations': rows, 'pageErrors': errors,
              'scope': 'Four actual native BMP-to-PNG downloads, two authored sRGB-tagged RGBA8 BMP V4 patterns. Hidden RGB at alpha0 is not visible quality loss. Does not test all BMP variants, profiles, browsers, perceptual quality or repeated saves.'}
    (out / 'measurements.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print('Completed', len(rows), 'native BMP-to-PNG downloads', flush=True)


if __name__ == '__main__':
    main()
