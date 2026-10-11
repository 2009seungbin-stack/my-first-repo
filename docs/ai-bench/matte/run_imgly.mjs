// @imgly/background-removal-node 1.4.5 (AGPL-3.0: reference only, never shipped). Library defaults (model "medium").
// Usage (from a folder where the package is installed): node run_imgly.mjs <corpus> <out-dir> <cases.json>
// cases.json = [{id,input}] (docs/ai-bench/matte/cases.py)
import {removeBackground} from '@imgly/background-removal-node';
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const [root,out,list]=process.argv.slice(2),od=path.join(out,'imgly');fs.mkdirSync(od,{recursive:true});const times={};
for(const c of JSON.parse(fs.readFileSync(list,'utf8'))){
 const t=performance.now();const blob=await removeBackground(pathToFileURL(path.resolve(root,c.input)).href);times[c.id]=(performance.now()-t)/1000;
 fs.writeFileSync(path.join(od,c.id+'.png'),Buffer.from(await blob.arrayBuffer()));
}
fs.writeFileSync(path.join(od,'timing.json'),JSON.stringify({provider:'node CPU (library default)',seconds:times},null,1));console.log('imgly',Object.keys(times).length);
