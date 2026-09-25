// Runs Sprite Fusion Pixel Snapper headless in Node on every case of DATA/cases.json.
// No Rust toolchain here, so we use the WASM build the public site ships
// (https://www.spritefusion.com/_app/immutable/workers/assets/spritefusion_pixel_snapper_bg-DfSbmZKz.wasm,
// fetched 2026-09-23, saved as _snapweb/snapper_bg.wasm) with a re-implementation of the site's
// wasm-bindgen glue (_snapweb/worker.js). Signature matches src/lib.rs process_image(bytes, k_colors?, pixel_size?, palette?).
// Defaults: k_colors = 16 (CLI + lib default; the site slider also starts at 16), auto pixel size, no palette.
// Usage: node run_snapper.mjs [DATA_DIR] [OUT_DIR]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// the snapper wasm build and outputs live outside the repo (PIXEL_BENCH_WORK)
const WORK = process.env.PIXEL_BENCH_WORK || 'C:/Users/2009s/nerulio-handoff/scratch/p2/competitors';
const DATA = process.argv[2] || 'C:/Users/2009s/nerulio-asset-corpus/_adhoc/nerulio-studio-pixel';
const OUT = process.argv[3] || path.join(WORK, 'out', 'snapper');
const K_COLORS = process.env.K_COLORS ? Number(process.env.K_COLORS) : undefined; // undefined -> wasm default (16)
fs.mkdirSync(OUT, { recursive: true });

const wasmBytes = fs.readFileSync(path.join(WORK, '_snapweb', 'snapper_bg.wasm'));
const wasmSha = crypto.createHash('sha256').update(wasmBytes).digest('hex');
const mod = new WebAssembly.Module(wasmBytes);
let f; // exports
let u8 = null;
const mem = () => ((u8 === null || u8.byteLength === 0) && (u8 = new Uint8Array(f.memory.buffer)), u8);
const dec = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
const str = (p, n) => dec.decode(mem().subarray(p >>> 0, (p >>> 0) + n));
const imports = { wbg: {} };
for (const imp of WebAssembly.Module.imports(mod)) {
  if (imp.name.startsWith('__wbg___wbindgen_throw')) imports.wbg[imp.name] = (p, n) => { throw new Error(str(p, n)); };
  else if (imp.name.startsWith('__wbindgen_cast')) imports.wbg[imp.name] = (p, n) => str(p, n);
  else if (imp.name === '__wbindgen_init_externref_table') imports.wbg[imp.name] = () => {
    const t = f.__wbindgen_externrefs; const o = t.grow(4);
    t.set(0, undefined); t.set(o + 0, undefined); t.set(o + 1, null); t.set(o + 2, true); t.set(o + 3, false);
  };
  else throw new Error('unknown wasm import ' + imp.module + '.' + imp.name);
}
const inst = new WebAssembly.Instance(mod, imports);
f = inst.exports; u8 = null; f.__wbindgen_start();

function processImage(bytes, kColors) {
  const p = f.__wbindgen_malloc(bytes.length, 1) >>> 0;
  mem().set(bytes, p);
  const r = f.process_image(p, bytes.length, kColors == null ? 4294967297 : kColors >>> 0, 0, 0, 0, 0);
  if (r[3]) { const e = f.__wbindgen_externrefs.get(r[2]); f.__externref_table_dealloc(r[2]); throw new Error(String(e)); }
  const out = mem().subarray(r[0] >>> 0, (r[0] >>> 0) + r[1]).slice();
  f.__wbindgen_free(r[0], r[1], 1);
  return out;
}
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];

const cases = JSON.parse(fs.readFileSync(path.join(DATA, 'cases.json'), 'utf8')).cases;
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
for (const c of cases) {
  if (only && !only.test(c.id)) continue;
  const inp = fs.readFileSync(path.join(DATA, c.path));
  const meta = { tool: 'spritefusion-pixel-snapper', build: 'spritefusion.com site WASM sha256:' + wasmSha.slice(0, 16), settings: { k_colors: K_COLORS ?? 16, pixel_size: 'auto', palette: null }, input: [c.width, c.height] };
  const t0 = performance.now();
  try {
    const out = Buffer.from(processImage(inp, K_COLORS));
    meta.time_ms = Math.round((performance.now() - t0) * 10) / 10;
    fs.writeFileSync(path.join(OUT, c.id + '.png'), out);
    const [w, h] = pngSize(out);
    meta.output = [w, h];
    meta.detected_scale = null; // not exposed by the WASM API
    meta.inferred_scale = [c.width / w, c.height / h];
    meta.error = null;
  } catch (e) {
    meta.time_ms = Math.round((performance.now() - t0) * 10) / 10;
    meta.error = String(e.message || e);
  }
  fs.writeFileSync(path.join(OUT, c.id + '.json'), JSON.stringify(meta, null, 1));
  console.log(c.id, meta.output || meta.error, meta.time_ms + 'ms');
}
