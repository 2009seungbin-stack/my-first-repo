"""Measure canvas readback and exports on the public conversion page.

Requires a repository checkout, Python, Pillow and installed Playwright browsers.
Writes only a new output directory. Uses authored inputs; no credentials or user files.
Direct exported-code diagnostics are distinct from the earlier native UI downloads.
"""
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlsplit
from PIL import Image
from playwright.sync_api import sync_playwright
import argparse
import hashlib
import json
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PROTOCOL = 'tools/editorial/measure-alpha-roundtrip.py'
INPUTS = ROOT / 'assets/editorial/2026-11-14-convert-encoding'
MODULES = ['src/image.js', 'src/task/convert.js', 'src/image-container.js', 'src/core.js']
MODES = ['decoded-read', 'png-control', 'png-observed', 'webp-control']


def sha(blob):
    return hashlib.sha256(blob).hexdigest()


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def rgba(path):
    with Image.open(path) as image:
        image.load()
        if image.size != (128, 96):
            raise ValueError('Unexpected fixture dimensions')
        converted = image.convert('RGBA')
        try:
            return converted.tobytes()
        finally:
            converted.close()


def comparison(reference, actual):
    if len(reference) != len(actual) or len(reference) != 128 * 96 * 4:
        raise ValueError('Expected a 128 by 96 RGBA8 buffer')
    groups = []
    for alpha in sorted(set(reference[3::4])):
        positions = [i for i in range(0, len(reference), 4) if reference[i + 3] == alpha]
        groups.append({
            'referenceAlpha': alpha, 'pixels': len(positions),
            'rgbChanged': sum(reference[i:i + 3] != actual[i:i + 3] for i in positions),
            'alphaChanged': sum(reference[i + 3] != actual[i + 3] for i in positions),
            'maxRgbDelta': max(abs(reference[i + c] - actual[i + c]) for i in positions for c in range(3)),
        })
    return {'groups': groups, 'allRgbaEqual': reference == actual}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='https://nerulio.com')
    parser.add_argument('--expected-sha', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    base = args.base.rstrip('/')
    url = urlsplit(base)
    if url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ['localhost', '127.0.0.1']):
        raise ValueError('Use HTTPS or a local HTTP fixture')
    if url.username or url.password or url.query or url.fragment or url.path not in ['', '/']:
        raise ValueError('Expected a plain origin without credentials')
    if not re.fullmatch('[a-f0-9]{40}', args.expected_sha):
        raise ValueError('Expected a full source commit SHA')
    if git('status', '--porcelain', '--untracked-files=no').strip():
        raise ValueError('Commit tracked changes before freezing the protocol')
    protocol_commit = git('rev-parse', 'HEAD').decode().strip()
    protocol_bytes = Path(__file__).read_bytes().replace(b'\r\n', b'\n')
    if protocol_bytes != git('show', protocol_commit + ':' + PROTOCOL).replace(b'\r\n', b'\n'):
        raise ValueError('Working protocol differs from its commit')
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=False)
    native_path = INPUTS / 'measurements.json'
    native = json.loads(native_path.read_text(encoding='utf-8'))
    inputs = []
    for name in ['opaque-chart.png', 'alpha-chart.png']:
        entry = next(item for item in native['fixtures'] if item['file'] == name)
        raw = (INPUTS / name).read_bytes()
        if sha(raw) != entry['sha256'] or raw[24:26] != bytes([8, 6]):
            raise ValueError('Authored RGBA8 PNG fixture changed')
        shutil.copyfile(INPUTS / name, output / name)
        inputs.append({'file': name, 'bytes': len(raw), 'sha256': sha(raw),
                       'rgbaSha256': sha(rgba(INPUTS / name)), 'width': 128, 'height': 96,
                       'origin': 'Authored procedural CC0 fixture from the earlier conversion study'})
    rows, code, errors = [], [], []
    with sync_playwright() as playwright:
        for engine in ['chromium', 'firefox']:
            browser = getattr(playwright, engine).launch()
            context = browser.new_context()
            page = context.new_page()
            page.set_default_timeout(30000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            try:
                if context.request.get(base + '/build.txt').text().strip() != args.expected_sha:
                    raise ValueError('Live source changed before observation')
                for module in MODULES:
                    response = context.request.get(base + '/' + module)
                    if response.status != 200:
                        raise ValueError('Source module request failed')
                    served = response.body().replace(b'\r\n', b'\n')
                    if served != git('show', args.expected_sha + ':' + module).replace(b'\r\n', b'\n'):
                        raise ValueError('Served module does not match the expected commit')
                    code.append({'engine': engine, 'path': module, 'sha256Utf8LF': sha(served)})
                if page.goto(base + '/en/image/convert/', wait_until='load').status not in [200, 304]:
                    raise ValueError('Conversion page did not load')
                for item in inputs:
                    name = item['file']
                    source = rgba(output / name)
                    decoded = None
                    control = None
                    for mode in MODES:
                        result = page.evaluate('''async ({bytes,name,mode})=>{
                          const Im=await import('/src/image.js');
                          const file=new File([new Uint8Array(bytes)],name,{type:'image/png'});
                          const canvas=await Im.decode(file);
                          try{
                            const pixels=mode==='decoded-read'||mode==='png-observed'
                              ?Array.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data):null;
                            const type=mode==='webp-control'?'image/webp':'image/png';
                            const blob=mode==='decoded-read'?null:await Im.blobOf(canvas,type,mode==='webp-control'?1:.92);
                            return {width:canvas.width,height:canvas.height,pixels,
                              encoded:blob?Array.from(new Uint8Array(await blob.arrayBuffer())):null,type:blob?.type};
                          }finally{Im.release(canvas);}
                        }''', {'bytes': list((output / name).read_bytes()), 'name': name, 'mode': mode})
                        if (result['width'], result['height']) != (128, 96):
                            raise ValueError('Unexpected decoded dimensions')
                        extension = 'rgba' if mode == 'decoded-read' else 'webp' if mode == 'webp-control' else 'png'
                        target = output / f'{engine}-{Path(name).stem}-{mode}.{extension}'
                        blob = bytes(result['pixels']) if mode == 'decoded-read' else bytes(result['encoded'])
                        target.write_bytes(blob)
                        pixels = blob if mode == 'decoded-read' else rgba(target)
                        row = {'engine': engine, 'browserVersion': browser.version, 'input': name,
                               'mode': mode, 'file': target.name, 'bytes': len(blob), 'sha256': sha(blob),
                               'inputComparison': comparison(source, pixels)}
                        if mode == 'decoded-read':
                            decoded = pixels
                        else:
                            row['decodedReadComparison'] = comparison(decoded, pixels)
                            if mode == 'png-control':
                                control = blob
                            if mode == 'png-observed':
                                observed = bytes(result['pixels'])
                                observed_path = output / f'{engine}-{Path(name).stem}-observed-read.rgba'
                                observed_path.write_bytes(observed)
                                row['observerRead'] = {'file': observed_path.name, 'bytes': len(observed),
                                                       'sha256': sha(observed), 'rgbaEqual': observed == decoded}
                                row['readObserverEncodedBytesEqual'] = blob == control
                            fmt = 'webp' if mode == 'webp-control' else 'png'
                            previous = next(r for r in native['observations'] if r['engine'] == engine
                                            and r['fixture'] == name and r['format'] == fmt
                                            and r['quality'] == (100 if fmt == 'webp' else 92))
                            earlier = INPUTS / previous['download']
                            if sha(earlier.read_bytes()) != previous['sha256']:
                                raise ValueError('Earlier native evidence changed')
                            row['earlierNativeDownload'] = {
                                'url': base + '/assets/editorial/2026-11-14-convert-encoding/' + earlier.name,
                                'sourceCommit': native['sourceCommit'], 'sha256': previous['sha256'],
                                'encodedBytesEqual': blob == earlier.read_bytes(), 'rgbaEqual': pixels == rgba(earlier),
                            }
                        rows.append(row)
                        print(engine, name, mode, flush=True)
                if context.request.get(base + '/build.txt').text().strip() != args.expected_sha:
                    raise ValueError('Live source changed during observation')
            finally:
                context.close()
                browser.close()
    if errors:
        raise ValueError('Browser errors occurred')
    if Path(__file__).read_bytes().replace(b'\r\n', b'\n') != protocol_bytes:
        raise ValueError('Protocol changed during capture')
    report = {'schema': 'nerulio.alpha-roundtrip/1', 'checkedAtUTC': datetime.now(timezone.utc).isoformat(),
              'base': base, 'sourceCommit': args.expected_sha, 'protocolCommit': protocol_commit,
              'protocolPath': PROTOCOL, 'protocolSha256Utf8LF': sha(protocol_bytes),
              'nativeStudySourceCommit': native['sourceCommit'], 'nativeStudyJsonSha256': sha(native_path.read_bytes()),
              'inputs': inputs, 'code': code, 'observations': rows, 'pageErrors': errors,
              'scope': 'Two authored RGBA8 PNGs, direct exported decode/blobOf calls, fresh canvas per case. '
                       'getImageData is readback, not inspection of internal backing-store samples. '
                       'The earlier native UI downloads are a distinct study. No human perception, repeated-save, '
                       'game import, photo, wide-gamut, HDR or 16-bit result is claimed.'}
    (output / 'measurements.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('Completed 16 frozen-protocol direct-code observations', flush=True)


if __name__ == '__main__':
    main()
