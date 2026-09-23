/** The game-asset corpus manifest (tests/game-corpus.manifest.json) and its committed CC0 subset
 * (tests/fixtures/game/corpus/). The corpus itself lives outside the repo; these checks keep the
 * manifest honest without it: every file has a source with a licence, only CC0/public-domain
 * sources are marked committable, hashes are well-formed, and every committed fixture is a
 * byte-identical copy of a committable corpus file. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const root=new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const manifest=JSON.parse(readFileSync(join(root,'tests/game-corpus.manifest.json'),'utf8'));
const FIX=join(root,'tests/fixtures/game/corpus');
const PUBLIC=/^(CC0|public domain)/i;

test('every corpus file names a source with a URL and a licence, or a derivation',()=>{
 assert.equal(manifest.schemaVersion,1);
 assert.ok(manifest.files.length>=60,`${manifest.files.length} files`);
 const paths=new Set();
 for(const f of manifest.files){
  assert.ok(!paths.has(f.path),`duplicate ${f.path}`);paths.add(f.path);
  assert.match(f.sha256,/^[0-9a-f]{64}$/,f.path);
  assert.ok(f.category,f.path);
  if(f.derive){assert.ok(paths.has(f.derive.from)||manifest.files.some(g=>g.path===f.derive.from),`${f.path} derives from a listed file`);continue;}
  const s=manifest.sources[f.source];
  assert.ok(s,`${f.path}: unknown source ${f.source}`);
  assert.match(s.url,/^https:\/\//,f.source);
  assert.ok(s.licence&&typeof s.committable==='boolean',f.source);
  if(s.type==='zip')assert.ok(f.member,`${f.path} needs the archive member`);
 }
});

test('only CC0 / public-domain sources are marked committable',()=>{
 for(const [id,s] of Object.entries(manifest.sources))
  if(s.committable)assert.match(s.licence,PUBLIC,`${id} is committable with licence ${s.licence}`);
});

test('ground truth grids add up to the recorded image size',()=>{
 let checked=0;
 for(const f of manifest.files){
  const g=f.truth?.grid;
  if(!g||!f.size||g.cols==null||g.rows==null||/extra|not equal|does not/i.test(f.truth.notes||''))continue;
  const w=2*(g.marginX||0)+g.cols*g.cellW+(g.cols-1)*(g.spacingX||0),h=2*(g.marginY||0)+g.rows*g.cellH+(g.rows-1)*(g.spacingY||0);
  if(w===f.size.w&&h===f.size.h)checked++;
  else assert.ok(Math.abs(w-f.size.w)<=g.cellW+(g.spacingX||0)&&Math.abs(h-f.size.h)<=g.cellH+(g.spacingY||0),`${f.path}: grid ${w}x${h} vs image ${f.size.w}x${f.size.h}`);
 }
 assert.ok(checked>=20,`${checked} grids add up exactly`);
});

test('the committed CI subset is byte-identical CC0 corpus files and stays under 2 MB',()=>{
 const index=JSON.parse(readFileSync(join(FIX,'index.json'),'utf8'));
 let total=0;
 for(const [file,info] of Object.entries(index)){
  const bytes=readFileSync(join(FIX,file));total+=bytes.length;
  assert.equal(createHash('sha256').update(bytes).digest('hex'),info.sha256,file);
  const entry=manifest.files.find(f=>f.path===info.corpusPath);
  assert.ok(entry,`${file}: ${info.corpusPath} is not in the manifest`);
  assert.equal(entry.sha256,info.sha256,file);
  assert.ok(manifest.sources[entry.source].committable,`${file} comes from a non-committable source`);
 }
 const onDisk=[];const walk=d=>{for(const n of readdirSync(d)){const p=join(d,n);statSync(p).isDirectory()?walk(p):onDisk.push(p);}};walk(FIX);
 const extra=onDisk.map(p=>p.slice(FIX.length+1).replaceAll('\\','/')).filter(p=>!(p in index)&&!['index.json','LICENSES.md','kenney-License.txt'].includes(p));
 assert.deepEqual(extra,[],'every fixture file is listed in index.json');
 assert.ok(total<2*1024*1024,`${total} bytes`);
});
