// Studio Tile workspace engines (src/game/tiles/*): patterns, layouts, the Godot terrain matcher
// port (checked against picks recorded from Godot 4.7.2), identification, suggestion, the art
// check, the generator (pixel exactness) and the Tiled / LDtk / Unity / Godot writers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as P from '../src/game/tiles/patterns.js';
import {LAYOUTS,layoutById,placeLayout,cellPattern} from '../src/game/tiles/layouts.js';
import {GodotTerrainSet,GodotLayer,resolveGodot} from '../src/game/tiles/godot-terrain.js';
import {identifyLayout,suggestBits,artCheck,pairClass,auc,split,blockTerrains} from '../src/game/tiles/identify.js';
import {assembleSource,assembleDual,buildSheet,quadState,remapSheet,asTransition,usesOf} from '../src/game/tiles/generator.js';
import {createTileset,applyLayout,toggleBit,setMode,removeTerrain,normalizeTileset,terrainTiles,withB} from '../src/game/tiles/model.js';
import {tsx,tmx,resolveTiled,wangId} from '../src/game/tiles/tiled.js';
import {ldtkProject,rulePattern,runRules} from '../src/game/tiles/ldtk.js';
import {unityRules,unityJSON} from '../src/game/tiles/unity.js';
import {godotJSON,godotImporter} from '../src/game/tiles/godot-export.js';
import {exportBundle} from '../src/game/tiles/exports.js';
import {standardCases,getter,gridFromRows,SHAPE58} from '../tools/engine-verify/tile/cases.mjs';
import {decodePNG} from '../src/game/texture-png.js';
import {tileSource} from '../src/game/tiles/identify.js';
const fixture=async name=>{const d=await decodePNG(readFileSync(new URL('./fixtures/tile/'+name,import.meta.url)));return {data:new Uint8ClampedArray(d.data),width:d.width,height:d.height};};

test('blob reduction gives exactly 47 masks; pattern ↔ mask conversions round-trip', () => {
 assert.equal(P.BLOB47.length, 47);
 for (let m = 0; m < 256; m++) assert.ok(P.BLOB47.includes(P.reduceBlob(m)));
 for (const m of P.BLOB47) assert.equal(P.blobOf(P.fromBlob(m, 3), 3), m);
 for (let i = 0; i < 16; i++) { assert.equal(P.edgeOf(P.fromEdge(i)), i); assert.equal(P.cornerOf(P.fromCorner(i)), i); }
 assert.deepEqual(P.inMode(P.fromBlob(255), 'sides'), [0, 0, -1, 0, -1, 0, -1, 0, -1]);
 assert.throws(() => P.checkPattern([0, 1]));
});

test('every published layout table is what it claims to be', () => {
 for (const L of LAYOUTS) {
  const masks = L.cells.flat().filter(m => m != null);
  const distinct = new Set(masks);
  if (L.family === 'blob47') { assert.equal(distinct.size, 47, L.id); for (const m of masks) assert.equal(P.reduceBlob(m), m, L.id); }
  if (L.family === 'edge16' || L.family === 'corner16') assert.equal(distinct.size, 16, L.id);
  if (L.id === 'box9') assert.equal(distinct.size, 9);
 }
 // a known cell of each: GameMaker's last cell is the full tile, Godot 3's blank is (10,1)
 assert.equal(layoutById('blob47-gamemaker').cells[5][7], 255);
 assert.equal(layoutById('blob47-godot3-12x4').cells[1][10], null);
 assert.equal(placeLayout(layoutById('blob47-gamemaker')).length, 47);
});

test('completeness: missing, duplicate and invalid-bit reports; never "complete" for nothing', () => {
 const all = P.BLOB47.map((m, i) => ({id: 't' + i, pattern: P.fromBlob(m)}));
 assert.equal(P.completeness('corners-and-sides', all).complete, true);
 const some = all.filter((_, i) => i % 5);
 const c = P.completeness('corners-and-sides', [...some, {id: 'dup', pattern: P.fromBlob(255)}]);
 assert.equal(c.complete, false);
 assert.equal(c.perTerrain[0].missing.length, all.length - some.length);
 assert.equal(c.duplicates.length, P.BLOB47.indexOf(255) % 5 ? 1 : 0);
 assert.equal(P.completeness('corners-and-sides', []).complete, false);
 // a corner bit behind an open side is flagged
 const bad = P.completeness('corners-and-sides', [{id: 'x', pattern: [0, 0, 0, -1, -1, -1, -1, -1, -1]}]);
 assert.equal(bad.invalid.length, 1);
});

test('Godot terrain port reproduces picks recorded from Godot 4.7.2 (incomplete set, 2 and 4 terrains)', () => {
 const fx = JSON.parse(readFileSync(new URL('./fixtures/tile/godot-terrain-picks.json', import.meta.url)));
 let cells = 0;
 for (const [name, f] of Object.entries(fx)) {
  const set = new GodotTerrainSet({mode: f.mode, tiles: Object.entries(f.tiles).map(([id, pattern]) => ({id, pattern}))});
  for (const c of f.cases) {
   const layer = new GodotLayer(set);
   for (const call of c.calls) layer.setCellsTerrainConnect(call.cells, call.terrain, true);
   const mine = Object.fromEntries([...layer.cells].map(([k, id]) => [k, id]));
   const keys = new Set([...Object.keys(mine), ...Object.keys(c.godot)]);
   for (const k of keys) {
    const alts = mine[k] == null ? [] : set.tilesFor(set.tileInfo.get(mine[k]));
    assert.ok(c.godot[k] ? alts.includes(c.godot[k].join(',')) : mine[k] == null, `${name}/${c.name} cell ${k}: studio ${mine[k]} godot ${c.godot[k]}`);
    cells++;
   }
  }
 }
 assert.ok(cells > 500, `compared ${cells} cells`);
});

test('Godot matcher: a missing isolated tile silently becomes an empty cell (the documented engine behaviour)', () => {
 const tiles = P.BLOB47.filter(m => m !== 0).map(m => ({id: 'm' + m, pattern: P.fromBlob(m)}));
 const set = new GodotTerrainSet({mode: 'corners-and-sides', tiles});
 const layer = new GodotLayer(set);
 layer.setCellsTerrainConnect([[5, 5]], 0);
 assert.equal(layer.get(5, 5), null);
 const full = new GodotTerrainSet({mode: 'corners-and-sides', tiles: [...tiles, {id: 'iso', pattern: P.fromBlob(0)}]});
 const l2 = new GodotLayer(full); l2.setCellsTerrainConnect([[5, 5]], 0);
 assert.equal(l2.get(5, 5), 'iso');
});

// ---- synthetic art: an A2 block drawn with flat colours (terrain body, rim, inner-corner rim)
function a2Block(t = 16) {
 const w = t * 2, h = t * 3, data = new Uint8ClampedArray(w * h * 4);
 const put = (x, y, c) => data.set(c, (y * w + x) * 4);
 const BODY = [60, 170, 70, 255], RIM = [30, 90, 40, 255];
 // bottom 2×2 tiles: a box with a 2px rim; top-right tile: inner-corner notches; top-left: preview
 for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (y >= t) { const bx = x, by = y - t, e = 2, W = 2 * t, H = 2 * t; put(x, y, bx < e || by < e || bx >= W - e || by >= H - e ? RIM : BODY); }
  else if (x >= t) { const qx = x - t, qy = y; const near = (qx < 2 || qx >= t - 2) && (qy < 2 || qy >= t - 2); put(x, y, near ? RIM : BODY); }
  else put(x, y, [10, 10, 10, 255]);
 }
 return {data, width: w, height: h};
}
const tileOf = (img, t) => (c, r) => { const out = new Uint8ClampedArray(t * t * 4); for (let y = 0; y < t; y++) out.set(img.data.subarray(((r * t + y) * img.width + c * t) * 4, ((r * t + y) * img.width + c * t + t) * 4), y * t * 4); return {data: out, w: t, h: t}; };

test('generator: every generated quarter is a byte-exact copy of its source quarter', () => {
 const t = 16, img = a2Block(t), tileAt = tileOf(img, t);
 const set = assembleSource('rpgmaker-a2', tileAt, {w: t, h: t});
 assert.equal(set.tiles.length, 47);
 const q = t / 2;
 for (const tile of set.tiles) for (const [quad, prov] of Object.entries(tile.provenance)) {
  const src = tileAt(prov.col, prov.row), dx = quad[1] === 'r' ? q : 0, dy = quad[0] === 'b' ? q : 0;
  for (let y = 0; y < q; y++) for (let x = 0; x < q; x++) for (let k = 0; k < 4; k++)
   assert.equal(tile.image.data[((dy + y) * t + dx + x) * 4 + k], src.data[((prov.qy * q + y) * t + prov.qx * q + x) * 4 + k]);
 }
 // quarter states follow the neighbours
 assert.equal(quadState(0, 'tl'), 'corner'); assert.equal(quadState(P.N | P.W, 'tl'), 'inner'); assert.equal(quadState(P.N | P.W | P.NW, 'tl'), 'full');
 assert.equal(quadState(P.W, 'tl'), 'hedge'); assert.equal(quadState(P.N, 'tl'), 'vedge');
 // edit one source pixel → exactly the tiles that use that quarter change
 const before = set.tiles.map(x => Buffer.from(x.image.data).toString('hex'));
 img.data.set([255, 0, 0, 255], ((t + 4) * img.width + 4) * 4); // bottom-left box tile, its top-left quarter (outer corner TL)
 const after = assembleSource('rpgmaker-a2', tileOf(img, t), {w: t, h: t});
 const changed = after.tiles.map((x, i) => Buffer.from(x.image.data).toString('hex') !== before[i] ? i : -1).filter(i => i >= 0);
 const uses = set.tiles.map((x, i) => x.provenance.tl.col === 0 && x.provenance.tl.row === 1 && x.provenance.tl.qx === 0 && x.provenance.tl.qy === 0 ? i : -1).filter(i => i >= 0);
 assert.deepEqual(changed, uses);
 assert.ok(usesOf(set, {col: 0, row: 1}).length >= uses.length);
});

test('generator: dual-grid set and the five-tile / rim sources; sheet in any layout', () => {
 const t = 16, img = a2Block(t), tileAt = tileOf(img, t);
 const dual = assembleDual('rpgmaker-a2', tileAt, {w: t, h: t});
 assert.equal(dual.tiles.length, 16);
 assert.ok(dual.tiles[0].image.data.every(v => v === 0), 'no corner → empty tile');
 const sheet = buildSheet(assembleSource('rpgmaker-a2', tileAt, {w: t, h: t}).tiles, 'blob47-gamemaker', {w: t, h: t});
 assert.equal(sheet.missing.length, 0);
 assert.equal(sheet.image.width, 8 * t);
 const rim = assembleSource('rim', () => ({data: new Uint8ClampedArray(t * t * 4).fill(200), w: t, h: t}), {w: t, h: t, rim: {rim: 2, color: [1, 2, 3, 255]}});
 const iso = rim.tiles[P.BLOB47.indexOf(0)].image.data, full = rim.tiles[P.BLOB47.indexOf(255)].image.data;
 assert.deepEqual([...iso.subarray(4, 8)], [1, 2, 3, 255]);
 assert.ok(full.every(v => v === 200));
 const tr = asTransition(dual, 1, {data: new Uint8ClampedArray(t * t * 4), w: t, h: t});
 assert.equal(tr.tiles.length, 17);
});

test('identification: a generated set laid out in each blob layout is recognised as that layout', () => {
 const t = 16, img = a2Block(t), set = assembleSource('rpgmaker-a2', tileOf(img, t), {w: t, h: t});
 for (const id of ['blob47-gamemaker', 'blob47-caeles-7x7', 'blob47-godot3-12x4', 'blob47-cr31-ascending']) {
  const sheet = buildSheet(set.tiles, id, {w: t, h: t});
  const r = identifyLayout(sheet.image, {w: t, h: t});
  assert.equal(r.candidates[0].layoutId, id, `${id}: got ${r.candidates.map(c => c.layoutId + ' ' + c.auc.toFixed(2)).join(', ')}`);
  assert.ok(r.candidates[0].auc > 0.95);
 }
 // noise has no layout it is confident about
 const noise = {width: 128, height: 96, data: new Uint8ClampedArray(128 * 96 * 4).map((_, i) => i % 4 === 3 ? 255 : (i * 7919) % 251)};
 const n = identifyLayout(noise, {w: 16, h: 16});
 assert.notEqual(n.candidates[0]?.confidence, 'high');
});

test('pair classes and statistics', () => {
 const full = P.fromBlob(255), iso = P.fromBlob(0), east = P.fromBlob(P.E);
 assert.deepEqual(pairClass('corners-and-sides', full, full, 'h'), {start: 1, mid: 1, end: 1});
 assert.equal(pairClass('corners-and-sides', iso, iso, 'h').mid, null);
 assert.equal(pairClass('corners-and-sides', east, iso, 'h').mid, 0);
 assert.equal(auc([1, 2], [3, 4]), 1); assert.equal(auc([3, 4], [1, 2]), 0);
 const s = split([1, 1, 2, 2, 50, 51, 52, 49]); assert.ok(s.threshold > 2 && s.threshold < 49);
});

test('suggestion and art check on a generated set: exact bits, a swap is caught, no false flags', () => {
 const t = 16, img = a2Block(t), set = assembleSource('rpgmaker-a2', tileOf(img, t), {w: t, h: t});
 const tiles = set.tiles.map(x => x.image), truth = set.tiles.map(x => x.pattern);
 const s = suggestBits(tiles, {mode: 'corners-and-sides'});
 assert.equal(s.measurable, true);
 const exact = s.tiles.filter((x, i) => x && x.pattern.every((v, k) => v === truth[i][k])).length;
 assert.equal(exact, 47);
 assert.equal(artCheck(tiles, truth).mismatches.length, 0);
 const bad = truth.slice(); const a = P.BLOB47.indexOf(17), b = P.BLOB47.indexOf(68); [bad[a], bad[b]] = [bad[b], bad[a]];
 assert.deepEqual(artCheck(tiles, bad).mismatches.map(m => m.index).sort((x, y) => x - y), [a, b].sort((x, y) => x - y));
 // flat art where every piece looks the same: not measurable, never a clean bill
 const flat = tiles.map(x => ({...x, data: new Uint8ClampedArray(x.data.length).fill(128)}));
 assert.equal(artCheck(flat, truth).measurable, false);
});

test('tileset model edits are pure and undo-friendly', () => {
 let ts = createTileset({assetId: 'a', grid: {w: 16, h: 16, cols: 8, rows: 6}});
 const t0 = ts;
 ts = applyLayout(ts, {layoutId: 'blob47-gamemaker', col: 0, row: 0});
 assert.equal(Object.keys(ts.tiles).length, 47);
 assert.equal(Object.keys(t0.tiles).length, 0);
 const t1 = toggleBit(ts, 7, 5, 0, 0); // full tile loses N
 assert.equal(t1.tiles['7,5'].pattern[1], -1);
 assert.equal(ts.tiles['7,5'].pattern[1], 0);
 assert.equal(setMode(t1, 'sides').tiles['7,5'].pattern[2], -1);
 const two = {...ts, terrains: [...ts.terrains, {name: 'B', color: '#000'}]};
 assert.equal(removeTerrain(two, 1).terrains.length, 1);
 assert.deepEqual(withB([0, 0, -1, -1, -1, -1, -1, -1, -1], 'corners', 0, 1)[0], 1);
 const back = normalizeTileset(JSON.parse(JSON.stringify(ts)));
 assert.deepEqual(back.tiles, ts.tiles);
});

test('writers: Godot JSON peering, Tiled Wang IDs + TMX, LDtk rules reproduce the ideal tiles, Unity rules', () => {
 let ts = createTileset({assetId: 'a', name: 'gm', grid: {w: 32, h: 32, cols: 8, rows: 6}});
 ts = applyLayout(ts, {layoutId: 'blob47-gamemaker'});
 const gj = godotJSON(ts, {image: 'x.png', width: 256, height: 192});
 assert.equal(gj.tileSet.tiles.length, 47);
 assert.equal(gj.tileSet.terrainSets[0].mode, 'match_corners_and_sides');
 const fullTile = gj.tileSet.tiles.find(t => t.atlas.x === 7 && t.atlas.y === 5);
 assert.equal(Object.keys(fullTile.peering).length, 8);
 assert.match(godotImporter(), /tile_data\.probability = float/);
 assert.deepEqual(wangId(ts, P.fromBlob(P.N | P.E | P.NE)), [1, 1, 1, 0, 0, 0, 0, 0]);
 const x = tsx(ts, {imageName: 'x.png', width: 256, height: 192});
 // 46: the isolated tile's Wang ID is all zeros, which Tiled drops on load (so it is not written)
 assert.equal((x.match(/<wangtile /g) || []).length, 46);
 const grid = gridFromRows(SHAPE58), sample = {w: grid.w, h: grid.h, get: getter(grid)};
 const tr = resolveTiled(ts, sample);
 assert.equal(tr.cells.filter(c => c.missing).length, 0);
 assert.match(tmx(ts, tr), /<data encoding="csv">/);
 const {project, placed, rules} = ldtkProject(ts, {imageName: 'x.png', width: 256, height: 192, sample});
 assert.equal(rules.length, 47);
 // LDtk rule semantics pick the same tile as the ideal pattern for every painted cell
 const tset = new Map(Object.entries(ts.tiles).map(([k, v]) => [k, v.pattern]));
 for (const p of placed) { const want = P.idealAt(sample.get, p.x, p.y, ts.mode); assert.ok(P.fits(tset.get(p.key), want), `cell ${p.x},${p.y}`); }
 assert.equal(placed.length, 58);
 assert.equal(project.defs.layers[0].autoRuleGroups[0].rules.length, 47);
 const u = unityRules(ts, {imageName: 'x.png', width: 256, height: 192});
 assert.equal(u.terrains[0].rules.length, 47);
 assert.equal(unityJSON(u).terrains[0].rules[0].flat.length % 3, 0);
 // Unity y is up: N is (0,1)
 const nRule = u.terrains[0].rules.find(r => r.col === 4 && r.row === 1 - 1 + 1 && false) || u.terrains[0].rules.find(r => r.neighbors.length === 4 && r.neighbors.some(n => n[0] === 0 && n[1] === 1 && n[2] === 1));
 assert.ok(nRule);
 // dual grid: LDtk corner rules look at the cell and its E, S, SE neighbours
 assert.deepEqual(rulePattern({mode: 'corners'}, P.fromCorner(15)), [0, 0, 0, 0, 1, 1, 0, 1, 1]);
});

test('exportBundle produces every target and notes what a target cannot hold', () => {
 let ts = createTileset({assetId: 'a', name: 'dual', grid: {w: 16, h: 16, cols: 4, rows: 4}, mode: 'corners'});
 ts = applyLayout(ts, {layoutId: 'corner16-cr31'});
 const b = exportBundle(ts, {imageName: 'd.png', width: 64, height: 64, png: new Uint8Array([1]), cases: standardCases(1)});
 assert.ok(b.godot && b.tiled && b.ldtk && b.generic);
 assert.equal(b.unity, undefined);
 assert.match(b.notes.unity, /dual-grid/);
 assert.match(b.tiled['sample.tmx'], /offsetx="-8"/);
});

test('multi-block sheets: plain fills that are the same picture are the same terrain', () => {
 // two 4×4 corner blocks side by side: A over B and C over B (B shared)
 const t = 8, W = 8 * t, H = 4 * t, data = new Uint8ClampedArray(W * H * 4);
 const L = layoutById('corner16-cr31'), col = [[200, 0, 0, 255], [0, 200, 0, 255], [0, 0, 200, 255]];
 for (let blk = 0; blk < 2; blk++) for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
  const m = L.cells[r][c];
  for (let y = 0; y < t; y++) for (let x = 0; x < t; x++) {
   const corner = y < t / 2 ? (x < t / 2 ? 1 : 2) : (x < t / 2 ? 8 : 4);
   const a = blk === 0 ? 0 : 2, v = m & corner ? a : 1;
   data.set(col[v], ((r * t + y) * W + (blk * 4 + c) * t + x) * 4);
  }
 }
 const img = {data, width: W, height: H}, r = identifyLayout(img, {w: t, h: t});
 const blocks = r.blocks.filter(b => b.layoutId === 'corner16-cr31');
 assert.equal(blocks.length, 2);
 const bt = blockTerrains(img, {w: t, h: t}, blocks);
 assert.equal(bt.terrains.length, 3);
 assert.equal(bt.blocks[0].b, bt.blocks[1].b);
});

test('real CC0 art: the cave blob-47 sheet (textured) is identified, and its bits are read from the pixels alone', async () => {
 const img = await fixture('cave-autotile47.png'), L = layoutById('blob47-gamemaker');
 const r = identifyLayout(img, {w: 64, h: 64});
 assert.equal(r.candidates[0].layoutId, 'blob47-gamemaker');
 assert.ok(r.candidates[0].auc > 0.95, 'seam score ' + r.candidates[0].auc);
 const src = tileSource(img, {w: 64, h: 64}), tiles = [], truth = [];
 for (let row = 0; row < 6; row++) for (let col = 0; col < 8; col++) { tiles.push(src.blank(col, row) ? null : src.tile(col, row)); truth.push(cellPattern(L, col, row)); }
 const s = suggestBits(tiles, {mode: 'corners-and-sides'});
 const exact = s.tiles.filter((t, i) => t && truth[i] && t.pattern.every((v, k) => v === truth[i][k])).length;
 assert.equal(exact, 47, 'tiles whose suggested bits equal the GameMaker truth');
 assert.equal(artCheck(tiles, truth).mismatches.length, 0);
 const swapped = truth.slice(); const a = 32, b = 33; [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
 assert.deepEqual(artCheck(tiles, swapped).mismatches.map(m => m.index).sort((x, y) => x - y), [a, b]);
});

test('real CC0 templates: GameMaker 47 and the 2-corner Wang set are recognised with high confidence', async () => {
 const gm = identifyLayout(await fixture('gms-47-template.png'), {w: 32, h: 32});
 assert.equal(gm.candidates[0].layoutId, 'blob47-gamemaker'); assert.equal(gm.candidates[0].confidence, 'high');
 const w = identifyLayout(await fixture('wang-2corner.png'), {w: 32, h: 32});
 assert.equal(w.candidates[0].layoutId, 'corner16-cr31'); assert.equal(w.candidates[0].confidence, 'high');
 // a seamless floor A2 sheet carries no seam information: never "high", but its size is named
 const a2 = identifyLayout(await fixture('coolschool-A2.png'), {w: 48, h: 48});
 assert.notEqual(a2.candidates[0]?.confidence, 'high');
 assert.equal(a2.hints[0]?.layoutId, 'rpgmaker-a2');
});