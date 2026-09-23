// Aseprite corpus harness: parses every .ase/.aseprite under a folder with src/game/aseprite.js,
// renders every frame and writes raw RGBA + a JSON summary so an independent tool (Python/Pillow
// comparing against Aseprite's own exports) can check the pixels. No network, no DOM.
//   node tools/aseprite-corpus.mjs <corpusDir> <outDir> [--roundtrip]
// With --roundtrip every file is also re-written with writeAseprite, re-read, and compared.
import {readdirSync,statSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,relative,dirname} from 'node:path';
import {readAseprite,renderFrame,writeAseprite} from '../src/game/aseprite.js';
const [dir,out]=process.argv.slice(2);const roundtrip=process.argv.includes('--roundtrip');
if(!dir||!out){console.error('usage: node tools/aseprite-corpus.mjs <corpusDir> <outDir> [--roundtrip]');process.exit(2);}
const files=[];const walk=d=>{for(const n of readdirSync(d)){const p=join(d,n);if(statSync(p).isDirectory())walk(p);else if(/\.(ase|aseprite)$/i.test(n))files.push(p);}};walk(dir);
files.sort();mkdirSync(out,{recursive:true});
const summary=[];
for(const file of files){
 const rel=relative(dir,file).replace(/\\/g,'/'),bytes=readFileSync(file),row={file:rel,bytes:bytes.length};
 try{
  let t=performance.now();const doc=readAseprite(bytes);row.parseMs=+(performance.now()-t).toFixed(2);
  Object.assign(row,{width:doc.width,height:doc.height,colorMode:doc.colorMode,frames:doc.frames.length,layers:doc.layers.length,
   groups:doc.layers.filter(l=>l.type==='group').length,tilemapLayers:doc.layers.filter(l=>l.type==='tilemap').length,tilesets:doc.tilesets.length,
   tags:doc.tags.map(t=>`${t.name}:${t.from}-${t.to}:${t.direction}:${t.repeat}`),slices:doc.slices.map(s=>s.name),
   blendModes:[...new Set(doc.layers.map(l=>l.blendMode))],linkedCels:doc.frames.reduce((n,f)=>n+f.cels.filter(c=>c&&c.linkedFrame!=null).length,0),
   composeGroups:doc.composeGroups,userData:!!doc.userData||doc.layers.some(l=>l.userData)||doc.tags.some(t=>t.userData&&(t.userData.text||t.userData.properties)),
   unknownChunks:doc.unknownChunks.map(c=>c.type.toString(16)),warnings:doc.warnings,transparentIndex:doc.transparentIndex});
  t=performance.now();const base=join(out,rel);mkdirSync(dirname(base),{recursive:true});
  for(let f=0;f<doc.frames.length;f++){const {rgba}=renderFrame(doc,f);writeFileSync(`${base}.f${f}.rgba`,rgba);}
  row.renderMs=+(performance.now()-t).toFixed(2);
  if(roundtrip){
   t=performance.now();const again=writeAseprite(doc);row.writeMs=+(performance.now()-t).toFixed(2);
   writeFileSync(`${base}.rt.aseprite`,again);
   const doc2=readAseprite(again,{strict:true});let diff=0;
   for(let f=0;f<doc.frames.length;f++){const a=renderFrame(doc,f).rgba,b=renderFrame(doc2,f).rgba;for(let i=0;i<a.length;i+=4){if(a[i+3]===0&&b[i+3]===0)continue;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3]){diff++;}}}
   row.roundtripDiffPixels=diff;row.roundtripBytes=again.length;
   row.roundtripMeta=JSON.stringify([doc.tags.map(t=>[t.name,t.from,t.to,t.direction,t.repeat]),doc.slices.map(s=>[s.name,s.keys]),doc.frames.map(f=>f.duration),doc.layers.filter(l=>l.type!=='unknown').map(l=>[l.name,l.type,l.visible,l.opacity,l.blendMode,l.parent])])===
    JSON.stringify([doc2.tags.map(t=>[t.name,t.from,t.to,t.direction,t.repeat]),doc2.slices.map(s=>[s.name,s.keys]),doc2.frames.map(f=>f.duration),doc2.layers.map(l=>[l.name,l.type,l.visible,l.opacity,l.blendMode,l.parent])]);
  }
 }catch(e){row.error=`${e.name}: ${e.message}`;if(!(e.name==='AsepriteError'))row.crash=e.stack;}
 summary.push(row);
}
writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,1));
const ok=summary.filter(r=>!r.error).length;
console.log(`${files.length} files, ${ok} parsed, ${summary.filter(r=>r.crash).length} crashes`);
for(const r of summary.filter(r=>r.error))console.log('ERR',r.file,r.error);
if(roundtrip)for(const r of summary.filter(r=>!r.error&&(r.roundtripDiffPixels||!r.roundtripMeta)))console.log('RT',r.file,r.roundtripDiffPixels,r.roundtripMeta);
