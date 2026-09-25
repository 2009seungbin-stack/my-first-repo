// Runs the Nerulio Studio cleanup engine (src/studio/pixel/cleanup.js, default options) on every
// benchmark case and writes <WORK>/out/nerulio/<id>.png + .json for score.py.
// usage: node run_nerulio.mjs [repo-root] [out-name] [id-regex]   (WORK = $PIXEL_BENCH_WORK or scratch/p2/competitors)
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
const slash=s=>s.split(String.fromCharCode(92)).join('/');
const WORK=slash(process.env.PIXEL_BENCH_WORK||'C:/Users/2009s/nerulio-handoff/scratch/p2/competitors'),REPO=slash(fileURLToPath(new URL('../..',import.meta.url))).replace(/\/$/,'');
const ROOT=process.argv[2]||REPO,NAME=process.argv[3]||'nerulio';
const imp=p=>import(pathToFileURL(ROOT+'/'+p).href);
const {decodePNG,encodeRGBAPNG}=await imp('src/game/texture-png.js');
const {runCleanup}=await imp('src/studio/pixel/cleanup.js');
const DATA='C:/Users/2009s/nerulio-asset-corpus/_adhoc/nerulio-studio-pixel',OUT=pathToFileURL(WORK+'/out/'+NAME+'/');
mkdirSync(OUT,{recursive:true});
const cases=JSON.parse(readFileSync(DATA+'/cases.json','utf8')).cases;
const only=process.argv[4]?new RegExp(process.argv[4]):null;
for(const c of cases){
 if(only&&!only.test(c.id))continue;
 const t0=performance.now();let meta={};
 try{
  const file=/\.png$/i.test(c.path)?DATA+'/'+c.path:WORK+'/_pngcache/'+c.id+'.png';
  const img=await decodePNG(new Uint8Array(readFileSync(file)),{maxPixels:1e8});
  const r=runCleanup([{data:img.data,width:img.width,height:img.height}],JSON.parse(process.env.PIXEL_BENCH_OPTS||'{}'));
  const f=r.frames[0],png=await encodeRGBAPNG(f.data,f.width,f.height);
  writeFileSync(new URL(c.id+'.png',OUT),Buffer.from(await png.arrayBuffer()));
  const snap=r.report.steps.find(s=>s.id==='snap');
  meta={detected_scale:snap?[snap.scaleX,snap.scaleY]:1,grid:r.analysis.grid?{kind:r.analysis.grid.kind,order:r.analysis.grid.order,confidence:r.analysis.grid.confidence}:null,verdict:r.analysis.check.verdict,steps:r.report.steps.map(s=>s.id),colors:r.report.colors,time_ms:Math.round(performance.now()-t0),error:null};
 }catch(e){meta={error:String(e.stack||e),time_ms:Math.round(performance.now()-t0)};}
 writeFileSync(new URL(c.id+'.json',OUT),JSON.stringify(meta));
 console.log(c.id,meta.error?'ERROR '+meta.error.split('\n')[0]:`${JSON.stringify(meta.detected_scale)} ${meta.grid?.kind||'-'} ${meta.time_ms}ms`);
}
