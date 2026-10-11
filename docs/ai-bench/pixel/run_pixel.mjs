// Runs the Studio cleanup engine (src/studio/pixel/cleanup.js: analyse + runCleanup, defaults) on cached AI-300 pixel items.
// Usage: node run_pixel.mjs <cache> <out-dir> <name> '<options json>'  -> <out>/<name>/<id>.png (result at 1x) + report.json
import fs from 'node:fs';import path from 'node:path';
import {analyse,runCleanup} from '../../../src/studio/pixel/cleanup.js';
import {png} from '../png.mjs';
const [cache,out,name,json='{}']=process.argv.slice(2),opts=JSON.parse(json),od=path.join(out,name);fs.mkdirSync(od,{recursive:true});const report={};
for(const row of JSON.parse(fs.readFileSync(path.join(cache,'index.json'),'utf8'))){
 const img={data:new Uint8Array(fs.readFileSync(path.join(cache,row.id+'.rgba'))),width:row.w,height:row.h};
 const t=performance.now(),A=analyse([img],opts),r=runCleanup([img],opts,A),ms=performance.now()-t,f=r.frames[0];
 fs.writeFileSync(path.join(od,row.id+'.png'),png(new Uint8ClampedArray(f.data.buffer,f.data.byteOffset,f.data.length),f.width,f.height));
 const g=A.grid||A.candidate;
 report[row.id]={ms,in:[row.w,row.h],out:[f.width,f.height],colors:r.report.colors,trusted:!!A.grid,kind:g?.kind,scale:g?.scale,scaleX:g?.scaleX,scaleY:g?.scaleY,confidence:g?.confidence,coherence:g?.coherence,verdict:A.check?.verdict,noisy:A.noise?.noisy,candidates:g?.candidates,steps:r.report.steps.map(s=>s.id)};
 console.log(row.id.padEnd(16),String(row.w+'x'+row.h).padEnd(10),'->',String(f.width+'x'+f.height).padEnd(9),'grid',(g?.kind||'-').padEnd(8),'s',(g?.scale??'-').toString().slice(0,6).padEnd(7),(g?.confidence||'-').padEnd(7),A.grid?'APPLIED':'unchanged',Math.round(ms)+'ms');
}
fs.writeFileSync(path.join(od,'report.json'),JSON.stringify(report,null,1));
