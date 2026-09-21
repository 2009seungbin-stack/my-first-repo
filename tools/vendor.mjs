/** Reproducible pinned runtime assets; Cloudflare's build needs no npm install. */
import {cp,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const packages={pica:{version:'10.0.3',files:['dist/pica_main.mjs','dist/pica_worker.js','LICENSE']},'pdf-lib':{version:'1.17.1',files:['dist/pdf-lib.esm.min.js','LICENSE.md']},'pdfjs-dist':{version:'6.3.289',files:['build/pdf.mjs','build/pdf.worker.mjs','cmaps','standard_fonts','wasm','iccs','LICENSE']},'@pdf-lib/fontkit':{version:'1.1.1',files:['dist/fontkit.es.min.js','README.md']},mediabunny:{version:'1.58.1',files:['dist/bundles/mediabunny.min.mjs','LICENSE','src']}};
packages['@pdf-lib/fontkit'].files=['dist/fontkit.umd.min.js','README.md'];
packages['@mediabunny/mp3-encoder']={version:'1.58.1',files:['dist/bundles/mediabunny-mp3-encoder.min.mjs','LICENSE','README.md','src']};
packages.gifenc={version:'1.0.3',files:['dist/gifenc.esm.js','LICENSE.md']};
const manifest=[];
for(const [name,{version,files}] of Object.entries(packages)){
 const root=`node_modules/${name}`,pkg=JSON.parse(await readFile(`${root}/package.json`));
 if(pkg.version!==version)throw Error(`Unexpected ${name} version`);
 const dest=`assets/vendor/${name.replace('@','').replaceAll('/','-')}-${version}`;await mkdir(dest,{recursive:true});
 async function record(path){const entries=await readdir(path,{withFileTypes:true});for(const entry of entries){const p=`${path}/${entry.name}`;if(entry.isDirectory())await record(p);else{const bytes=await readFile(p);manifest.push({path:p,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),license:/lame-3\.100|LAME-COPYING/.test(p)?'LGPL-2.0-or-later':pkg.license,source:`https://www.npmjs.com/package/${pkg.name}/v/${version}`});}}}
 for(const file of files){const base=file.split('/').at(-1);await cp(`${root}/${file}`,`${dest}/${base}`,{recursive:true});}
 if(name==='@mediabunny/mp3-encoder'){const file=`${dest}/mediabunny-mp3-encoder.min.mjs`,source=await readFile(file,'utf8');await writeFile(file,source.replaceAll('from"mediabunny"','from"../mediabunny-1.58.1/mediabunny.min.mjs"'));}
 await record(dest);
}
// Embedded Pica math implementations retain their own permissive notices.
for(const name of ['glur','multimath']){const pkg=JSON.parse(await readFile(`node_modules/${name}/package.json`));await cp(`node_modules/${name}/LICENSE`,`assets/vendor/pica-10.0.3/${name}-LICENSE`);manifest.push({dependency:name,version:pkg.version,license:pkg.license});}
await writeFile('assets/vendor/manifest.json',JSON.stringify(manifest,null,2)+'\n');
