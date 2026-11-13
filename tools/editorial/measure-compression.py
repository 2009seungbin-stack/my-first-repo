"""Reproduce the PNG case study using Nerulio's real browser encoder, not a substitute codec.

Run from the checkout: python tools/editorial/measure-compression.py
Requires the same Python Playwright installation as tests/service-browser.py.
Public evidence files are written under assets/editorial/2026-11-14-png/.
"""
import hashlib
import json
import shutil
import socket
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/editorial/2026-11-14-png'
SAMPLES = [
    ('logo', 'tests/fixtures/store-art/alloy-transparent-logo.png',
     'Original test-corpus geometry, CC0; tests/fixtures/store-art/SOURCES.md'),
    ('tiles', 'tests/fixtures/kenney/tiny-dungeon-tilemap.png',
     'Kenney Tiny Dungeon 1.0, CC0; https://kenney.nl/assets/tiny-dungeon'),
]

def digest(data):
    return hashlib.sha256(data).hexdigest()

OUT.mkdir(parents=True, exist_ok=True)
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
import os
server = subprocess.Popen(['node', 'tools/serve.mjs'], cwd=ROOT,
                          env={**os.environ, 'PORT': str(port)},
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
origin = f'http://127.0.0.1:{port}'
try:
    for _ in range(100):
        try:
            urllib.request.urlopen(origin + '/ko/image/compress/', timeout=1).close()
            break
        except Exception:
            time.sleep(.1)
    else:
        raise RuntimeError('Source preview did not start')
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(origin + '/ko/image/compress/', wait_until='networkidle')
        records = []
        for key, source, license_note in SAMPLES:
            data = (ROOT / source).read_bytes()
            shutil.copyfile(ROOT / source, OUT / f'{key}-input.png')
            result = page.evaluate('''async ({source}) => {
                const Im = await import('/src/image.js');
                const input = await (await fetch('/' + source)).blob();
                const canvas = await Im.decode(input), rows = [];
                const settings = [
                    ['auto', {format:'auto'}], ['png', {format:'png'}],
                    ['webp', {format:'webp'}], ['jpeg', {format:'jpeg'}],
                    ['target-1k', {format:'auto',kb:1}],
                    ['target-1k-shrink', {format:'auto',kb:1,allowShrink:true}],
                ];
                for (const [name, extra] of settings) {
                    const options={quality:.8,minSSIM:extra.kb?0:.965,bg:'#ffffff',original:input,...extra};
                    const r=await Im.encode(canvas,options);
                    const keep=r.blob.size>=input.size&&!options.width&&(options.format==='auto'||input.type==='image/'+options.format);
                    const blob=keep?input:r.blob;
                    rows.push({name,options:{...options,original:undefined},report:r.report,met:r.met,
                        outputType:blob.type,outputBytes:blob.size,keptByTask:keep,
                        width:keep?canvas.width:r.w,height:keep?canvas.height:r.h,
                        bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))});
                }
                Im.release(canvas); return rows;
            }''', {'source': source})
            for row in result:
                raw = bytes(row.pop('bytes'))
                ext = row['outputType'].split('/')[1].replace('jpeg', 'jpg')
                output = f'{key}-{row["name"]}.{ext}'
                (OUT / output).write_bytes(raw)
                records.append({'sample': key, 'inputFile': f'{key}-input.png',
                                'inputBytes': len(data), 'inputSha256': digest(data),
                                'license': license_note, 'outputFile': output,
                                'outputSha256': digest(raw), **row})
        evidence = {'measuredAtUTC': datetime.now(timezone.utc).isoformat(),
                    'browser': browser.version, 'userAgent': page.evaluate('navigator.userAgent'),
                    'encoderCommit': subprocess.check_output(
                        ['git','log','-1','--format=%H','--','src/compression.js'],cwd=ROOT,text=True).strip(),
                    'method': 'Actual src/image.js encode; task/compress.js original-retention rule. One run per setting. Not a speed benchmark. SSIM is a <=512px proxy, not pixel equality.',
                    'reproduce': 'python tools/editorial/measure-compression.py', 'records': records}
        (OUT / 'measurements.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        browser.close()
    for r in records:
        print(r['sample'],r['name'],r['inputBytes'],'->',r['outputBytes'],r['width'],r['height'],
              'SSIM',round(r['report']['ssim'],6),'met',r['met'],'kept',r['keptByTask'])
finally:
    server.terminate()
    server.wait(timeout=10)
