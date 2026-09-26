import {readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
const slash=s=>s.split(String.fromCharCode(92)).join('/');
const WORK=slash(process.env.PIXEL_BENCH_WORK||'C:/Users/2009s/nerulio-handoff/scratch/p2/competitors'),REPO=slash(fileURLToPath(new URL('../..',import.meta.url))).replace(/\/$/,'');
const ROOT=REPO;const imp=p=>import(pathToFileURL(ROOT+'/'+p).href);
const {decodePNG}=await imp('src/game/texture-png.js');const {analyse}=await imp('src/studio/pixel/cleanup.js');
const DATA='C:/Users/2009s/nerulio-asset-corpus/_adhoc/nerulio-studio-pixel';
const cases=JSON.parse(readFileSync(DATA+'/cases.json','utf8')).cases,re=new RegExp(process.argv[2]||'.');
for(const c of cases){if(!re.test(c.id))continue;
 const file=/\.png$/i.test(c.path)?DATA+'/'+c.path:WORK+'/_pngcache/'+c.id+'.png';
 const img=await decodePNG(new Uint8Array(readFileSync(file)),{maxPixels:1e8});
 const A=analyse([{data:img.data,width:img.width,height:img.height}]),g=A.grid||A.candidate;
 console.log(c.id,'true',c.scaleX?.toFixed?.(3),'| verdict',A.check.verdict,'noisy',A.noise.noisy,A.noise.share,'| grid',g.kind,g.scale,g.order,g.confidence,g.coherence,g.prominence,'| trusted',!!A.grid);
 if(g.candidates)console.log('   ',JSON.stringify(g.candidates));
}
