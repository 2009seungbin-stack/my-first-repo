// Runs src/matte-refine.js on cached model probabilities (prep_raw.py) and writes RGBA PNGs for score_matte.py.
// Usage: node refine_bench.mjs <cache> <out-dir> <model> <variant-name> '<options json>'
import fs from 'node:fs';import path from 'node:path';
import {png} from '../png.mjs';
import {refineMatte} from '../../../src/matte-refine.js';
const [cache,out,model,name,json='{}']=process.argv.slice(2),opts=JSON.parse(json),od=path.join(out,name);fs.mkdirSync(od,{recursive:true});
const times={};
for(const row of JSON.parse(fs.readFileSync(path.join(cache,'index.json'),'utf8'))){
 if(!row.prob[model])continue;
 const rgba=new Uint8ClampedArray(fs.readFileSync(path.join(cache,row.id+'.rgba'))),[ph,pw]=row.prob[model];
 const b=fs.readFileSync(path.join(cache,model,row.id+'.f32')),prob=new Float32Array(b.buffer,b.byteOffset,b.length/4);
 const t=performance.now(),r=refineMatte(rgba,row.w,row.h,Float32Array.from(prob),pw,ph,opts);times[row.id]=(performance.now()-t)/1000;
 fs.writeFileSync(path.join(od,row.id+'.png'),png(r.rgba,row.w,row.h));
}
fs.writeFileSync(path.join(od,'timing.json'),JSON.stringify({model,opts,seconds:times},null,1));
console.log(name,Object.keys(times).length,'mean refine s',(Object.values(times).reduce((a,b)=>a+b,0)/Math.max(1,Object.keys(times).length)).toFixed(3));
