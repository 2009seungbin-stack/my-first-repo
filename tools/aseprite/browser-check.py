"""Loads src/game/aseprite.js in Chromium (main thread + module worker) from the repo's own dev
server on port 4431 and checks the committed fixtures against Aseprite's reference frames."""
import json, os, sys
from playwright.sync_api import sync_playwright
BASE = 'http://127.0.0.1:' + os.environ.get('PORT', '4431')
JS = r"""
async () => {
  const run = async () => {
    const O = self.location.origin; const M = await import(O + '/src/game/aseprite.js');
    const Z = await import(O + '/src/game/zlib.js');
    const manifest = await (await fetch(O + '/tests/fixtures/aseprite/manifest.json')).json();
    const out = [];
    for (const m of manifest) {
      const bytes = new Uint8Array(await (await fetch(O + '/tests/fixtures/aseprite/' + m.file)).arrayBuffer());
      const t0 = performance.now();
      const doc = M.readAseprite(bytes, {strict: true});
      let maxDiff = 0;
      for (const f of m.frames) {
        const z = new Uint8Array(await (await fetch(O + '/tests/fixtures/aseprite/' + f.rgba)).arrayBuffer());
        // decode the reference with the browser's own zlib (DecompressionStream), not ours
        const ref = new Uint8Array(await new Response(new Blob([z]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
        const got = M.renderFrame(doc, f.frame).rgba;
        for (let i = 0; i < ref.length; i += 4) { if (!ref[i+3] && !got[i+3]) continue; for (let c = 0; c < 4; c++) maxDiff = Math.max(maxDiff, Math.abs(ref[i+c] - got[i+c])); }
      }
      const written = M.writeAseprite(doc);
      // our deflate output must be accepted by the browser's zlib too
      let browserInflateOk = true;
      for (const fr of doc.frames) for (const c of fr.cels) if (c && c.pixels && c.linkedFrame == null) {
        const d = Z.deflateZlib(c.pixels);
        const back = new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
        if (back.length !== c.pixels.length || back.some((v, i) => v !== c.pixels[i])) browserInflateOk = false;
      }
      const again = M.readAseprite(written, {strict: true});
      let rtSame = true;
      for (let f = 0; f < doc.frames.length; f++) { const a = M.renderFrame(doc, f).rgba, b = M.renderFrame(again, f).rgba; if (a.some((v, i) => v !== b[i])) rtSame = false; }
      out.push({file: m.file, maxDiff, rtSame, browserInflateOk, ms: +(performance.now() - t0).toFixed(1)});
    }
    return out;
  };
  const main = await run();
  // same code inside a module worker
  const src = `self.onmessage = async () => { try { const run = ${run.toString()}; postMessage({ok: true, res: await run()}); } catch (e) { postMessage({ok: false, err: String(e && e.stack || e)}); } };`;
  let worker;
  try {
    const w = new Worker(URL.createObjectURL(new Blob([src], {type: 'text/javascript'})), {type: 'module'});
    worker = await new Promise(r => { w.onmessage = e => r(e.data); w.onerror = e => r({ok: false, err: e.message}); w.postMessage(1); });
  } catch (e) { worker = {ok: false, err: String(e)}; }
  return {main, worker};
}
"""
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(BASE + '/')
    res = page.evaluate(JS)
    print(json.dumps(res, indent=1))
    print('console errors:', errors)
    b.close()
