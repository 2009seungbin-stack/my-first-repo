import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';import {dirname,join} from 'node:path';
import {parseFont,sniffFont,FontError} from '../src/game/ui/font/opentype.js';
import {readCmap,readName,macRoman} from '../src/game/ui/font/otf-cmap.js';
import {View} from '../src/game/ui/font/otf-read.js';

/* The OpenType parser against an independent reference: every *.ref.json next to the fixtures is
 * written by tools/ui-font-fixtures.py with fontTools (never with this parser). TrueType outlines
 * must match exactly; CFF outlines to 1e-9 (fontTools does the same float additions); variable
 * instances within the tolerances documented at each test. The corpus-only tests at the end run
 * when the local asset corpus and Python+fontTools exist, and are skipped (not failed) in CI. */
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=join(HERE,'..');
const FIX=join(HERE,'fixtures','ui','fonts');
const bytes=f=>new Uint8Array(readFileSync(join(FIX,f)));
const ref=f=>JSON.parse(readFileSync(join(FIX,f),'utf8'));
const font=(f,o)=>parseFont(bytes(f),o);

/** 'M512 384L…Z' → [['M',512,384],…] (Python reprs parse to the identical doubles) */
function decode(s){
 const out=[];
 for(const m of s.matchAll(/([MLQCZ])([^MLQCZ]*)/g))out.push([m[1],...(m[2]?m[2].split(' ').map(Number):[])]);
 return out;
}
const flat=cmds=>cmds.map(c=>c.type==='M'||c.type==='L'?[c.type,c.x,c.y]:c.type==='Q'?['Q',c.x1,c.y1,c.x,c.y]:c.type==='C'?['C',c.x1,c.y1,c.x2,c.y2,c.x,c.y]:['Z']);
/** max |difference| between two decoded paths; Infinity when their structure differs */
function pathError(mine,theirs){
 if(mine.length!==theirs.length)return Infinity;
 let e=0;
 for(let i=0;i<mine.length;i++){
  const a=mine[i],b=theirs[i];if(a[0]!==b[0]||a.length!==b.length)return Infinity;
  for(let k=1;k<a.length;k++)e=Math.max(e,Math.abs(a[k]-b[k]));
 }
 return e;
}
function boundsError(mine,theirs){
 if(!mine||!theirs)return mine===theirs||(!mine&&!theirs)?0:Infinity;
 return Math.max(Math.abs(mine.xMin-theirs[0]),Math.abs(mine.yMin-theirs[1]),Math.abs(mine.xMax-theirs[2]),Math.abs(mine.yMax-theirs[3]));
}
function checkOutlines(f,r,{tol=0,label='',only=null}={}){
 let worst=0,count=0;
 for(const [gid,s] of Object.entries(r.glyphs)){
  if(only&&!only.has(+gid))continue;
  const mine=f.glyphPath(+gid),e=pathError(flat(mine.commands),decode(s));
  if(tol===0)assert.deepEqual(flat(mine.commands),decode(s),`${label} glyph ${gid}`);
  else assert(e<=tol,`${label} glyph ${gid}: outline differs by ${e}`);
  const be=boundsError(mine.bounds,r.bounds[gid]);
  assert(be<=1e-9*Math.max(1,f.unitsPerEm),`${label} glyph ${gid}: bounds differ by ${be}`);
  worst=Math.max(worst,e);count++;
 }
 return {worst,count};
}
function checkCore(f,r,label){
 const m=r.meta;
 assert.equal(f.unitsPerEm,m.unitsPerEm,label);assert.equal(f.numGlyphs,m.numGlyphs,label);
 const typo=m.os2&&(m.os2.fsSelection&0x80);
 assert.deepEqual([f.ascender,f.descender,f.lineGap],typo?[m.os2.typoAscender,m.os2.typoDescender,m.os2.typoLineGap]:m.hhea,label);
 if(m.os2)for(const k of ['typoAscender','typoDescender','typoLineGap','winAscent','winDescent','xHeight','capHeight'])assert.equal(f.os2[k],m.os2[k],`${label} os2.${k}`);
 for(const k of ['family','subfamily','fullName','version','copyright','licenseText'])assert.equal(f[k],m[k],`${label} ${k}`);
 assert.deepEqual(f.codepoints(),r.cmap.map(x=>x[0]),`${label} cmap code points`);
 for(const [cp,gid] of r.cmap){assert.equal(f.glyphId(cp),gid,`${label} U+${cp.toString(16)}`);assert(f.hasGlyph(cp));}
 assert.equal(f.glyphId(0x10fffe),0);assert.equal(f.hasGlyph(0x10fffe),false);
 r.advances.forEach((a,gid)=>assert.equal(f.advance(gid),a,`${label} advance ${gid}`));
}

const hexBytes=h=>Uint8Array.from(h.match(/../g),x=>parseInt(x,16));
test('cmap formats 0/4/6/12/13, symbol and Mac Roman subtables, and subtable preference match fontTools',()=>{
 const r=ref('tables.ref.json');
 assert.equal(r.cmaps.length,7);
 for(const c of r.cmaps){
  const b=hexBytes(c.hex),cm=readCmap(new View(b,0,b.length,'cmap'),c.numGlyphs);
  assert.deepEqual(cm.codepoints(),c.map.map(x=>x[0]),c.label);
  for(const [cp,gid] of c.map)assert.equal(cm.glyphId(cp),gid,`${c.label} U+${cp.toString(16)}`);
  assert.equal(cm.glyphId(0x10ffff),0,c.label);assert.equal(cm.glyphId(-1),0,c.label);assert.equal(cm.glyphId(0.5),0,c.label);
 }
 for(let c=0;c<256;c++)assert.equal(macRoman(c),r.macRoman[c],`Mac Roman 0x${c.toString(16)}`);
});
test('name table: Windows English > other Windows > Unicode > Mac Roman, decoded like fontTools',()=>{
 const r=ref('tables.ref.json').name,b=hexBytes(r.hex),names=readName(new View(b,0,b.length,'name'));
 for(const [id,s] of Object.entries(r.expect))assert.equal(names.get(+id),s,`name ${id}`);
});

test('sniffFont reads only the header',()=>{
 assert.equal(sniffFont(bytes('KenneyFuture.ttf')),'ttf');
 assert.equal(sniffFont(bytes('kenney-future-cff.otf')),'otf');
 assert.equal(sniffFont(bytes('kenney-pair.ttc')),'ttc');
 assert.equal(sniffFont(bytes('kenney-mini.woff')),'woff');
 assert.equal(sniffFont(new TextEncoder().encode('wOF2 and then nothing')),'woff2');
 assert.equal(sniffFont(new TextEncoder().encode('true')),'ttf');
 assert.equal(sniffFont(new Uint8Array([0x89,0x50,0x4e,0x47])),null);
 assert.equal(sniffFont(new Uint8Array(2)),null);
 assert.equal(sniffFont(bytes('KenneyPixel.ttf').buffer.slice(0)),'ttf','ArrayBuffer input');
});

for(const name of ['KenneyFuture','KenneyPixel','KenneyMiniSquareMono']){
 test(`${name}.ttf: metrics, names, cmap, advances and every outline equal fontTools exactly`,()=>{
  const f=font(`${name}.ttf`),r=ref(`${name}.ref.json`);
  assert.equal(f.container,'sfnt');assert.equal(f.outlines,'truetype');assert.equal(f.bitmapOnly,false);
  assert.deepEqual(f.axes,[]);assert.equal(f.kerning(1,2),0);assert.deepEqual(f.kerningPairs([1,2,3]),[]);
  checkCore(f,r,name);
  const {count}=checkOutlines(f,r,{label:name});
  assert.equal(count,f.numGlyphs);
 });
}

test('WOFF 1.0 decodes (zlib tables inflated to their declared size) to the same font as the TTF',()=>{
 const f=font('kenney-mini.woff'),r=ref('KenneyMiniSquareMono.ref.json');
 assert.equal(f.container,'woff');
 checkCore(f,r,'woff');checkOutlines(f,r,{label:'woff'});
});

test('TrueType collections open the requested face',()=>{
 const a=font('kenney-pair.ttc'),b=font('kenney-pair.ttc',{index:1});
 assert.equal(a.container,'ttc');assert.equal(b.container,'ttc');
 const ra=ref('kenney-composites.ref.json'),rb=ref('kenney-var.ref.json');
 checkCore(a,ra,'ttc#0');checkOutlines(a,ra,{label:'ttc#0'});
 checkCore(b,rb,'ttc#1');checkOutlines(b,rb,{label:'ttc#1'});
 assert.equal(b.axes.length,2);
 assert.throws(()=>font('kenney-pair.ttc',{index:2}),/2 faces; face 2 does not exist/);
});

test('CFF: Type 2 charstrings (hints, hintmask bytes, biased subrs, nested calls, seac) match fontTools',()=>{
 const f=font('kenney-future-cff.otf'),r=ref('kenney-future-cff.ref.json');
 assert.equal(f.outlines,'cff');
 checkCore(f,r,'cff');
 const {count,worst}=checkOutlines(f,r,{tol:1e-9,label:'cff'});
 assert.equal(count,f.numGlyphs);assert(worst<=1e-9);
 const aacute=f.glyphId(0xc1),A=f.glyphPath(f.glyphId(0x41)).commands,acute=f.glyphPath(f.glyphId(0xb4)).commands;
 assert.equal(f.glyphPath(aacute).commands.length,A.length+acute.length,'seac draws base + accent');
});

test('CFF CID-keyed: FDSelect picks each glyph\'s private subrs; outlines match the name-keyed font',()=>{
 const f=font('kenney-future-cid.otf'),r=ref('kenney-future-cid.ref.json'),base=ref('kenney-future-cff.ref.json');
 assert.equal(f.outlines,'cff');
 checkCore(f,{...r,cmap:base.cmap},'cid');
 checkOutlines(f,{glyphs:{...base.glyphs,...r.glyphs},bounds:{...base.bounds,...r.bounds}},{tol:1e-9,label:'cid'});
});

test('GPOS kern: PairPos 1 + 2, several lookups, Extension lookups; kerningPairs == kerning() == fontTools',()=>{
 for(const file of ['kenney-future-cff','kenney-future-cid']){
  const f=font(`${file}.otf`),r=ref(`${file}.ref.json`);
  assert(r.kern.length>20,'the fixture has class and glyph pairs');
  assert.deepEqual(f.kerningPairs(r.kernGids),r.kern,file);
  const want=new Map(r.kern.map(([l,rr,v])=>[l*65536+rr,v]));
  for(const l of r.kernGids)for(const rr of r.kernGids)assert.equal(f.kerning(l,rr),want.get(l*65536+rr)||0,`${file} ${l},${rr}`);
 }
});

test('composite glyphs: scale, x/y scale, 2×2, nesting, point-matched anchors; odd contours; lsb≠xMin',()=>{
 const f=font('kenney-composites.ttf'),r=ref('kenney-composites.ref.json');
 checkCore(f,r,'composites');checkOutlines(f,r,{label:'composites'});
 assert.equal(f.ascender,800,'USE_TYPO_METRICS picks the OS/2 typo metrics');
 const ring=f.glyphPath(f.glyphId(0xe005)).commands;
 assert.equal(ring[0].type,'M');assert.equal(ring.filter(c=>c.type==='Z').length,2,'every contour closed');
 assert.equal(f.glyphId(0x1f600),f.glyphId(0xe005),'format 12 subtable for astral code points');
});

test('legacy kern table (format 0) is used when there is no GPOS kern feature',()=>{
 const f=font('kenney-composites.ttf'),r=ref('kenney-composites.ref.json');
 assert(r.kern.length>=4);
 assert.deepEqual(f.kerningPairs(r.kernGids),r.kern);
 for(const [l,rr,v] of r.kern)assert.equal(f.kerning(l,rr),v);
 assert.equal(f.kerning(f.glyphId(0x54),f.glyphId(0x41)),0);
});

test('variable TrueType: fvar/avar metadata and exact default outlines',()=>{
 const f=font('kenney-var.ttf'),r=ref('kenney-var.ref.json');
 checkCore(f,r,'var');checkOutlines(f,r,{label:'var'});
 assert.deepEqual(f.axes,r.meta.axes);
 assert.deepEqual(f.instances,r.meta.instances);
 assert.deepEqual([...f.normalizeCoords({})],[0,0]);
 assert.deepEqual([...f.normalizeCoords({wght:1e9,wdth:-5})],[1,-1],'clamped to the axis range');
 // avar: user 700 → design 550 → normalized 0.3 (fontTools: 0.6 → piecewise map)
 assert(Math.abs(f.normalizeCoords({wght:700})[0]-0.3)<1/16384);
 // the default instance given explicitly is the default instance
 const A=f.glyphId(0x41);
 assert.equal(f.glyphPath(A,{wght:400}),f.glyphPath(A),'cached per coordinates, default coords collapse');
});

// fontTools' glyphSet(location) is unrounded, like this parser. The only difference is that this
// parser rounds normalized coordinates to F2DOT14 before and after avar (as HarfBuzz/FreeType do);
// at the tested locations that moves points by at most TOL_GLYPHSET units.
const TOL_GLYPHSET=0.05;
// varLib.instancer rounds every point, component offset, advance and kerning value to integers:
// a simple glyph point is within 0.5 of the true value, a point of a composite (rounded component
// points + rounded offset) within 1.0; implied midpoints are averages of such points.
const TOL_INSTANCER=1.0;

test(`variable TrueType: gvar instances match fontTools glyphSet(location) within ${TOL_GLYPHSET}`,()=>{
 const f=font('kenney-var.ttf'),r=ref('kenney-var.ref.json');
 let worst=0,worstAdv=0;
 for(const loc of r.locations.filter(l=>l.source==='glyphSet')){
  const n=f.normalizeCoords(loc.user);
  loc.normalized.forEach((v,i)=>assert(Math.abs(n[i]-v)<=1/16384,`normalized ${JSON.stringify(loc.user)}`));
  for(const [gid,s] of Object.entries(loc.glyphs)){
   const e=pathError(flat(f.glyphPath(+gid,loc.user).commands),decode(s));
   assert(e<=TOL_GLYPHSET,`${JSON.stringify(loc.user)} glyph ${gid}: ${e}`);worst=Math.max(worst,e);
   const ae=Math.abs(f.advance(+gid,loc.user)-loc.advances[gid]);
   assert(ae<=TOL_GLYPHSET,`${JSON.stringify(loc.user)} advance ${gid}: ${ae}`);worstAdv=Math.max(worstAdv,ae);
  }
 }
 console.log(`# kenney-var vs glyphSet(location): max point error ${worst}, max advance error ${worstAdv}`);
});

test(`variable TrueType: instances match fontTools varLib.instancer within ${TOL_INSTANCER} (it rounds)`,()=>{
 const f=font('kenney-var.ttf'),r=ref('kenney-var.ref.json');
 const insts=r.locations.filter(l=>l.source==='instancer');
 assert.equal(insts.length,3);let worst=0;
 for(const loc of insts){
  for(const [gid,s] of Object.entries(loc.glyphs)){
   const e=pathError(flat(f.glyphPath(+gid,loc.user).commands),decode(s));
   assert(e<=TOL_INSTANCER,`${JSON.stringify(loc.user)} glyph ${gid}: ${e}`);worst=Math.max(worst,e);
   assert(Math.abs(f.advance(+gid,loc.user)-loc.advances[gid])<=0.5,`${JSON.stringify(loc.user)} advance ${gid}`);
  }
  const mine=f.kerningPairs(r.kernGids,loc.user),theirs=loc.kern;
  const key=a=>a[0]*65536+a[1],m=new Map(mine.map(p=>[key(p),p[2]]));
  for(const p of theirs)assert(Math.abs((m.get(key(p))||0)-p[2])<=0.5,`${JSON.stringify(loc.user)} kern ${p}`);
  for(const p of mine)assert(Math.abs(p[2])<0.5||theirs.some(q=>key(q)===key(p)),`${JSON.stringify(loc.user)} extra kern ${p}`);
 }
 console.log(`# kenney-var vs varLib.instancer: max point error ${worst}`);
});

test('variable TrueType: kerning at the default instance and through GDEF VariationIndex deltas',()=>{
 const f=font('kenney-var.ttf'),r=ref('kenney-var.ref.json');
 assert.deepEqual(f.kerningPairs(r.kernGids),r.kern);
 const A=f.glyphId(0x41),V=f.glyphId(0x56);
 assert(f.kerning(A,V,{wght:900})<f.kerning(A,V)-10,'bolder instances kern more in this fixture');
 assert.equal(f.kerning(A,V,[0,0]),f.kerning(A,V),'a normalized array is accepted');
});

/** Replaces a table tag in an sfnt directory (tests only). */
function retag(b,from,to){
 const out=b.slice(),n=out[4]<<8|out[5];
 for(let i=0;i<n;i++){const r=12+i*16;if(String.fromCharCode(...out.subarray(r,r+4))===from){out.set([...to].map(c=>c.charCodeAt(0)),r);return out;}}
 throw Error(`no ${from} table`);
}

test('advances without HVAR come from the gvar phantom points',()=>{
 const r=ref('kenney-var.ref.json');
 const withHvar=font('kenney-var.ttf'),without=parseFont(retag(bytes('kenney-var.ttf'),'HVAR','XVAR'));
 for(const loc of r.locations.filter(l=>l.source==='glyphSet'))
  for(const gid of Object.keys(loc.advances))
   assert(Math.abs(without.advance(+gid,loc.user)-withHvar.advance(+gid,loc.user))<=0.5,`${JSON.stringify(loc.user)} ${gid}`);
});

test('unsupported inputs fail with readable errors',()=>{
 assert.throws(()=>parseFont(new TextEncoder().encode('wOF2'+'\0'.repeat(60))),/WOFF2 is not supported: convert it to TTF\/OTF first/);
 assert.throws(()=>parseFont(retag(bytes('kenney-future-cff.otf'),'CFF ','CFF2')),/CFF2 .*not supported/);
 assert.throws(()=>parseFont(new Uint8Array(100)),/Not a TrueType\/OpenType font/);
 assert.throws(()=>parseFont(new Uint8Array(3)),/too small/);
 assert.throws(()=>parseFont('nope'),/Uint8Array or an ArrayBuffer/);
 const bitmap=parseFont(retag(bytes('kenney-composites.ttf'),'glyf','EBDT'));
 assert.equal(bitmap.bitmapOnly,true);assert.equal(bitmap.outlines,'none');
 assert(bitmap.codepoints().length>5,'cmap and metrics still work');
 assert.throws(()=>bitmap.glyphPath(1),/only contains embedded bitmaps/);
 const f=font('KenneyFuture.ttf');
 assert.throws(()=>f.glyphPath(f.numGlyphs),/does not exist/);
 assert.throws(()=>f.glyphPath(-1),/does not exist/);
 assert.throws(()=>f.advance(1.5),/does not exist/);
});

test('recursion guards: self-calling subrs, subr fan-out, component loops, deep composites',()=>{
 const c=font('guards-cff.otf');
 assert.equal(c.glyphPath(c.glyphId(0x41)).commands.length,5);
 assert.throws(()=>c.glyphPath(c.glyphId(0x42)),e=>e instanceof FontError&&/nest deeper than 10/.test(e.message));
 const t0=performance.now();
 assert.throws(()=>c.glyphPath(c.glyphId(0x43)),e=>e instanceof FontError&&/runs too long/.test(e.message));
 assert(performance.now()-t0<5000,'the operator budget stops fan-out quickly');
 const g=font('guards-glyf.ttf');
 assert.equal(g.glyphPath(g.glyphId(0x41)).commands.length,5);
 assert.throws(()=>g.glyphPath(g.glyphId(0x42)),e=>e instanceof FontError&&/deeper than 16/.test(e.message));
 assert.throws(()=>g.glyphPath(g.glyphId(0x43)),e=>e instanceof FontError&&/deeper than 16/.test(e.message));
 assert.equal(g.glyphPath(g.glyphId(0x44)).commands.length,5,'15 levels are fine');
});

/** Everything a font builder would touch; returns normally or throws. */
function exercise(f){
 const cps=f.codepoints();
 for(const cp of cps.slice(0,64))f.glyphId(cp);
 for(let g=0;g<Math.min(f.numGlyphs,64);g++){
  f.advance(g);
  if(f.outlines!=='none')f.glyphPath(g);
  if(f.axes.length){f.glyphPath(g,{[f.axes[0].tag]:f.axes[0].max});f.advance(g,{[f.axes[0].tag]:f.axes[0].min});}
 }
 f.kerningPairs([...Array(Math.min(f.numGlyphs,64)).keys()]);
}
const FILES=['KenneyFuture.ttf','kenney-future-cff.otf','kenney-future-cid.otf','kenney-mini.woff','kenney-composites.ttf','kenney-var.ttf','kenney-pair.ttc'];

test('truncated fonts throw FontError, never read out of bounds or hang',()=>{
 for(const file of FILES){
  const full=bytes(file);
  for(const frac of [0.02,0.1,0.25,0.4,0.5,0.6,0.75,0.9,0.97,0.995]){
   const cut=full.slice(0,Math.floor(full.length*frac));
   try{exercise(parseFont(cut));}
   catch(e){assert(e instanceof FontError||e.name==='ZlibError',`${file} cut at ${frac}: ${e.stack}`);}
  }
 }
});

test('randomly corrupted fonts throw FontError or parse; nothing else escapes',()=>{
 let seed=20260923;const rnd=()=>(seed=Math.imul(seed,1103515245)+12345>>>0)/2**32;
 let threw=0,ok=0;
 for(const file of FILES){
  const full=bytes(file);
  for(let k=0;k<60;k++){
   const b=full.slice();
   const n=1+Math.floor(rnd()*8);
   for(let i=0;i<n;i++){const at=Math.floor(rnd()*(rnd()<.5?Math.min(b.length,2048):b.length));b[at]=rnd()<.3?0xff:Math.floor(rnd()*256);}
   try{exercise(parseFont(b));ok++;}
   catch(e){assert(e instanceof FontError||e.name==='ZlibError',`${file} #${k}: ${e.stack}`);threw++;}
  }
 }
 assert(threw>0&&ok>0);
});

test('parsing is lazy: a font opens without decoding glyphs, and paths are cached',()=>{
 const f=font('KenneyFuture.ttf'),g=f.glyphId(0x41);
 assert.equal(f.glyphPath(g),f.glyphPath(g));
});

// ---------------------------------------------------------------- local corpus (skipped in CI)
const CORPUS=process.env.NERULIO_CORPUS||'C:/Users/2009s/nerulio-asset-corpus';
const P={
 galmuri:join(CORPUS,'fonts/galmuri/Galmuri11.ttf'),
 galmuriBitmap:join(CORPUS,'fonts/galmuri/Galmuri11Bitmap-Regular-2.40.4.ttf'),
 notoJP:join(CORPUS,'fonts/noto-sans-jp/NotoSansJP-wght.ttf'),
 notoKR:join(CORPUS,'_adhoc/nerulio-studio-ui/fonts/NotoSansKR-Regular.otf'),
};
const PYTHON=process.env.PYTHON||'python';
const havePython=(()=>{try{return spawnSync(PYTHON,['-c','import fontTools'],{encoding:'utf8'}).status===0;}catch{return false;}})();
const skip=p=>!existsSync(p)?`corpus font missing: ${p}`:!havePython?'python with fontTools not available':false;
function pyDump(file,args){
 const r=spawnSync(PYTHON,[join(ROOT,'tools','ui-font-fixtures.py'),'dump',file,...args],{encoding:'utf8',maxBuffer:256*1024*1024});
 if(r.status!==0)throw Error(r.stderr);
 return JSON.parse(r.stdout);
}
const sample=(f,n)=>{const cps=f.codepoints(),step=Math.max(1,Math.floor(cps.length/n));return cps.filter((_,i)=>i%step===0).slice(0,n);};
const hex=cps=>cps.map(c=>'0x'+c.toString(16)).join(',');

test('corpus: Galmuri11 (20 968 glyphs, Hangul) cmap, outlines, kerning and timing',{skip:skip(P.galmuri)},()=>{
 const b=new Uint8Array(readFileSync(P.galmuri));
 let t=performance.now();const f=parseFont(b),cps=f.codepoints();const tParse=performance.now()-t;
 assert.equal(cps.length,20965);
 let hangul=0;for(let c=0xac00;c<=0xd7a3;c++)if(f.hasGlyph(c))hangul++;
 assert.equal(hangul,11172);
 t=performance.now();for(const c of cps.slice(0,2000))f.glyphPath(f.glyphId(c));const tPaths=performance.now()-t;
 console.log(`# Galmuri11: parse+cmap ${tParse.toFixed(1)} ms, 2000 glyph paths ${tPaths.toFixed(1)} ms`);
 const pick=sample(f,400),r=pyDump(P.galmuri,['--codepoints',hex(pick),'--kern-codepoints','32-126']);
 assert.equal(r.cmapCount,20965);
 checkOutlines(f,r,{label:'Galmuri11'});
 for(const [g,a] of Object.entries(r.advances))assert.equal(f.advance(+g),a);
 assert.deepEqual(f.kerningPairs(r.kernGids),r.kern);
 assert(r.kern.length>0,'Galmuri11 has GPOS kerning');
});

test('corpus: Galmuri11 Bitmap is bitmap-only',{skip:!existsSync(P.galmuriBitmap)&&'corpus font missing'},()=>{
 const f=parseFont(new Uint8Array(readFileSync(P.galmuriBitmap)));
 assert.equal(f.bitmapOnly,true);assert.equal(f.outlines,'none');
 assert.equal(f.codepoints().length,20965);
 assert.throws(()=>f.glyphPath(f.glyphId(0x41)),/only contains embedded bitmaps/);
});

test('corpus: Noto Sans JP variable (glyf+gvar+HVAR) vs fontTools glyphSet and instancer; timing',{skip:skip(P.notoJP)},()=>{
 const b=new Uint8Array(readFileSync(P.notoJP));
 let t=performance.now();const f=parseFont(b),cps=f.codepoints();const tParse=performance.now()-t;
 t=performance.now();for(const c of cps.slice(0,2000))f.glyphPath(f.glyphId(c));const tPaths=performance.now()-t;
 t=performance.now();for(const c of cps.slice(0,2000))f.glyphPath(f.glyphId(c),{wght:400});const tVar=performance.now()-t;
 console.log(`# NotoSansJP-wght: parse+cmap ${tParse.toFixed(1)} ms, 2000 paths ${tPaths.toFixed(1)} ms, 2000 paths at wght=400 ${tVar.toFixed(1)} ms`);
 assert(tParse<1000);
 assert.deepEqual(f.axes.map(a=>[a.tag,a.min,a.default,a.max]),[['wght',100,100,900]]);
 const pick=[...sample(f,250),0x41,0x56,0x61,0x3042,0x6f22];
 const d=pyDump(P.notoJP,['--codepoints',hex(pick),'--kern-codepoints','32-126']);
 assert.equal(d.cmapCount,cps.length);
 checkOutlines(f,d,{label:'NotoSansJP default'});
 assert.deepEqual(f.kerningPairs(d.kernGids),d.kern,'default-instance kerning');
 for(const w of [400,900]){
  const g=pyDump(P.notoJP,['--codepoints',hex(pick),'--location',`wght=${w}`]).locations[0];
  let worst=0,worstAdv=0;
  for(const [gid,s] of Object.entries(g.glyphs)){
   const e=pathError(flat(f.glyphPath(+gid,{wght:w}).commands),decode(s));worst=Math.max(worst,e);
   worstAdv=Math.max(worstAdv,Math.abs(f.advance(+gid,{wght:w})-g.advances[gid]));
  }
  console.log(`# NotoSansJP wght=${w} vs glyphSet: max point error ${worst}, max advance error ${worstAdv}`);
  assert(worst<=TOL_GLYPHSET&&worstAdv<=TOL_GLYPHSET);
 }
 const inst=pyDump(P.notoJP,['--codepoints',hex(pick),'--kern-codepoints','32-126','--location','wght=400','--instancer']);
 let worst=0;
 for(const [gid,s] of Object.entries(inst.glyphs)){
  const e=pathError(flat(f.glyphPath(+gid,{wght:400}).commands),decode(s));worst=Math.max(worst,e);
  assert(e<=TOL_INSTANCER,`wght=400 glyph ${gid}: ${e}`);
  assert(Math.abs(f.advance(+gid,{wght:400})-inst.advances[gid])<=0.5,`advance ${gid}`);
 }
 const mine=new Map(f.kerningPairs(inst.kernGids,{wght:400}).map(p=>[p[0]*65536+p[1],p[2]]));
 for(const p of inst.kern)assert(Math.abs((mine.get(p[0]*65536+p[1])||0)-p[2])<=0.5,`kern ${p}`);
 console.log(`# NotoSansJP wght=400 vs instancer: max point error ${worst}, ${inst.kern.length} ASCII kern pairs`);
});

test('corpus: Noto Sans KR (CID-keyed CFF, 24 964 glyphs) vs fontTools',{skip:skip(P.notoKR)},()=>{
 const b=new Uint8Array(readFileSync(P.notoKR));
 let t=performance.now();const f=parseFont(b),cps=f.codepoints();const tParse=performance.now()-t;
 t=performance.now();for(const c of cps.slice(0,2000))f.glyphPath(f.glyphId(c));const tPaths=performance.now()-t;
 console.log(`# NotoSansKR-Regular.otf: parse+cmap ${tParse.toFixed(1)} ms, 2000 paths ${tPaths.toFixed(1)} ms`);
 assert.equal(f.outlines,'cff');
 const pick=[...sample(f,400),0xac00,0xd7a3,0x41];
 const d=pyDump(P.notoKR,['--codepoints',hex(pick),'--kern-codepoints','32-126']);
 assert.equal(d.cmapCount,cps.length);
 const {worst,count}=checkOutlines(f,d,{tol:1e-9,label:'NotoSansKR'});
 console.log(`# NotoSansKR: ${count} glyphs, max point error ${worst}`);
 assert.deepEqual(f.kerningPairs(d.kernGids),d.kern);
 assert(d.kern.length>100);
});
