"""SFX Generator UI and independently reopened output. TEST_URL=http://127.0.0.1:4706 python tests/sfx-browser.py"""
import io
import base64
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave
import zipfile

from playwright.sync_api import sync_playwright
from playwright.sync_api import expect

BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
BROWSER = os.environ.get('SFX_BROWSER', 'chromium')
CORPUS = Path(os.environ.get('NERULIO_CORPUS', r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-tool-t6-sfx\back_001.ogg'))


def probe(path):
    exe = shutil.which('ffprobe')
    if not exe:
        return None
    return json.loads(subprocess.check_output([exe, '-v', 'error', '-show_entries', 'format=format_name,duration:stream=codec_name,sample_rate,channels,bits_per_raw_sample', '-of', 'json', str(path)], text=True))


def make_wav(path):
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(44100)
        import array
        samples = array.array('h', [int(9000 * math.sin(2 * math.pi * 330 * i / 44100)) for i in range(11025)])
        w.writeframes(samples.tobytes())


def run():
    checks = 0
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        temp = Path(tmp)
        browser = getattr(p, BROWSER).launch(headless=True)
        options={'viewport': {'width': 1440, 'height': 900}, 'accept_downloads': True}
        if BROWSER == 'chromium': options['permissions']=['clipboard-read', 'clipboard-write']
        context = browser.new_context(**options)
        page = context.new_page(); errors = []; external = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda req: external.append(req.url) if not req.url.startswith(BASE) and not req.url.startswith('data:') else None)
        page.goto(BASE + '/en/game/sfx-generator/', wait_until='domcontentloaded')
        page.locator('#metrics').filter(has_text='Duration').wait_for()
        assert page.locator('.sfx-preset').count() == 8; checks += 1
        page.locator('[data-preset="laser"]').click(); page.locator('#metrics').filter(has_text='Duration').wait_for(); checks += 1
        page.locator('#advanced').evaluate('(x) => x.open = true')
        page.locator('#addLayer').click(); assert page.locator('.sfx-layer').count() == 2; checks += 1
        page.locator('#addNote').click(); assert page.locator('#sequence .sfx-note').count() == 1; checks += 1
        page.locator('#undo').click(); assert page.locator('#sequence .sfx-note').count() == 0; checks += 1
        page.locator('#redo').click(); assert page.locator('#sequence .sfx-note').count() == 1; checks += 1
        page.locator('#keep').click(); assert page.locator('#collection .sfx-note').count() == 1; checks += 1

        # Real CC0 Kenney audio when the local corpus is present, with a generated fallback for CI.
        sample = CORPUS if CORPUS.exists() else temp / 'input.wav'
        if not CORPUS.exists(): make_wav(sample)
        page.locator('#sampleFile').set_input_files(str(sample))
        page.locator('#layers select[data-field="kind"]').first.wait_for()
        expect(page.locator('#layers select[data-field="kind"]').first).to_have_value('sample')
        assert 'Sample' in page.locator('#layers').inner_text(); checks += 1
        page.locator('#undo').click(); page.wait_for_timeout(200); checks += 1
        if BROWSER == 'chromium':
            fallback=temp/'drop.wav'; make_wav(fallback)
            b64=base64.b64encode(fallback.read_bytes()).decode()
            page.evaluate('''(b64) => {const raw=atob(b64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const file=new File([bytes],'dropped.wav',{type:'audio/wav'}),dt=new DataTransfer();dt.items.add(file);window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));}''', b64)
            expect(page.locator('#layers select[data-field="kind"] option[value="sample"]').first).to_contain_text('local-2'); checks += 1
            page.evaluate('''(b64) => {const raw=atob(b64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const file=new File([bytes],'pasted.wav',{type:'audio/wav'}),dt=new DataTransfer();dt.items.add(file);window.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}''', b64)
            expect(page.locator('#layers select[data-field="kind"] option[value="sample"]').first).to_contain_text('local-3'); checks += 1
        page.locator('#format').select_option('wav'); page.locator('#bits').select_option('24')
        with page.expect_download() as item: page.locator('#saveAudio').click()
        wav = temp / 'effect-24.wav'; item.value.save_as(wav)
        with wave.open(str(wav), 'rb') as w:
            assert w.getframerate() == 44100 and w.getsampwidth() == 3 and w.getnchannels() == 2 and w.getnframes() > 1000
        checks += 1
        for fmt, codec in [('ogg', 'vorbis'), ('mp3', 'mp3')]:
            page.locator('#format').select_option(fmt)
            with page.expect_download(timeout=30000) as item: page.locator('#saveAudio').click()
            target = temp / ('effect.' + fmt); item.value.save_as(target)
            info = probe(target)
            assert target.stat().st_size > 1000
            if info:
                assert info['streams'][0]['codec_name'] == codec, info
                assert info['streams'][0]['sample_rate'] == '44100', info
            checks += 1
        page.locator('#format').select_option('wav')
        with page.expect_download(timeout=30000) as item: page.locator('#batch').click()
        zpath = temp / 'variants.zip'; item.value.save_as(zpath)
        with zipfile.ZipFile(zpath) as z:
            names = z.namelist(); assert len([n for n in names if n.endswith('.wav')]) == 4 and 'settings.json' in names
            assert json.loads(z.read('settings.json'))['variations'] == 4
        checks += 1
        code='5EoyNVSymuxD8s7HP1ixqdaCn5uVGEgwQ3kJBR7bSoApFQzm7E4zZPW2EcXm3jmNdTtTPeDuvwjY8z4exqaXz3NGBHRKBx3igYfBBMRBxDALhBSvzkF6VE2Pv'
        page.locator('#foreign').fill(code); page.locator('#useLegacy').click()
        expect(page.locator('#foreignStatus')).to_contain_text('reference')
        assert 'reference' in page.locator('#foreignStatus').inner_text().lower(); checks += 1
        page.locator('#returnOwn').click(); checks += 1
        page.locator('#exportJsfxr').click()
        expect(page.locator('#status')).to_contain_text('different sound model'); checks += 1
        page.locator('#foreign').fill('not-a-native-sfs-file'); page.locator('#useLegacy').click()
        expect(page.locator('#status')).to_contain_text('Unrecognized'); checks += 1
        page.locator('#share').click(); expect(page.locator('#status')).to_contain_text('?s=')
        link=page.locator('#status').inner_text().split()[-1]; page.goto(link); page.locator('#metrics').filter(has_text='Duration').wait_for(); checks += 1
        assert not errors, errors; assert not external, external; checks += 1
        context.close(); browser.close()
        mobile = getattr(p, BROWSER).launch(headless=True)
        for locale in ('ko','ja'):
            q=mobile.new_page(viewport={'width':390,'height':844});q.goto(BASE+f'/{locale}/game/sfx-generator/');q.locator('#metrics').filter(has_text='').wait_for()
            assert q.locator('html').get_attribute('lang') == locale and q.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), locale
            assert q.locator('h1').inner_text() and q.locator('.sfx-seo .sd-block').count() >= 3
            checks += 1;q.close()
        mobile.close()
    print(f'SFX browser checks passed: {checks}; engine: {BROWSER}; real CC0 sample: {CORPUS.exists()}; ffprobe: {bool(shutil.which("ffprobe"))}')


if __name__ == '__main__': run()
