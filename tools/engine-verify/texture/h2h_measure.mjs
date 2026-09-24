// Head-to-head measurement: Nerulio's Texture pipeline against other normal-map generators on the
// same real CC0 assets, each compared with a REAL reference normal map for that asset.
//
//   node tools/engine-verify/texture/h2h_measure.mjs <h2h dir> [--json out.json]
//
// <h2h dir>/in/        asteroids.png + truth_asteroids_n.png  (OGA "Asteroids pack", Jarusca, CC0;
//                                                             normals rendered from the 3D models, OpenGL)
//                      torch.png + truth_torch_n.png          (OGA "Animated pixel torch", XLIVE99, CC0;
//                                                             hand-painted normals, DirectX in the pack,
//                                                             green flipped to OpenGL for the truth)
//                      bricks.png (+ _rolled), bricksheight.png (+ _rolled), truth_bricks_n.png
//                                                            (ambientCG Bricks, CC0: Color, Displacement
//                                                             as 8-bit, NormalGL)
// <h2h dir>/out/<tool>/<input>/<input>_n.png   what each tool produced (scripts: run_nmo.py,
//                      run_pbrforge.py, Laigter 1.14 CLI). Nerulio's output is generated here with the
//                      same pure modules the Studio runs, with the parameters the Studio suggests on
//                      opening the picture (suggestParams) - no tuning per asset.
//
// Per output: convention (sign of the green correlation with the truth, and what
// src/game/normals/convention.js says about the file), mean angle to the truth (as exported, and
// after the best single strength factor on x/y - strength is a slider in every tool, the shape is
// not), Lambert N.L difference in 8-bit levels for four lights at 45 deg elevation (the lighting
// term of the Godot 2D light model the Studio preview reproduces to <= 1/255 in Godot 4.7.2), and
// for the tileable bricks the seam: |step| across the wrap border / |step| inside, and the
// roll-consistency (output of the texture rolled by half, rolled back, vs the output) on the
// 2-px border band. 0 = wrap-correct.
import {readFileSync,existsSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {decodePNG,encodeRGBAPNG} from '../../../src/game/texture-png.js';
import {generate,suggestParams,normalizeParams} from '../../../src/game/normals/pipeline.js';
import {detectConvention} from '../../../src/game/normals/convention.js';
import {seamError,rollConsistency,roll} from '../../../src/game/normals/normal.js';
const dir=process.argv[2];if(!dir){console.error('usage: h2h_measure.mjs <h2h dir> [--json out.json]');process.exit(2);}
const jsonOut=process.argv.includes('--json')?process.argv[process.argv.indexOf('--json')+1]:null;
const load=async f=>{const i=await decodePNG(new Uint8Array(readFileSync(f)),{maxPixels:268e6});return i;};
const bytes=async blob=>new Uint8Array(await blob.arrayBuffer());
// --- Nerulio outputs (Studio defaults) ------------------------------------------------------
async function nerulio(name,{asHeight=false}={}){
 const img=await load(join(dir,'in',name+'.png')),{width:w,height:h,data}=img;
 let params=suggestParams(data,w,h,{pixelArt:Math.max(w,h)<=128});
 let heightPlane=null;
 if(asHeight){const s8=new Uint8Array(w*h);for(let p=0;p<w*h;p++)s8[p]=data[p*4];heightPlane={samples:s8,max:255};params=normalizeParams({...params,heightMap:{...params.heightMap,assetId:'h'},luma:{...params.luma,on:false}});}
 const t0=performance.now(),g=generate(data,w,h,params,{heightPlane});const ms=performance.now()-t0;
 const tool=asHeight?'nerulio-heightmap':'nerulio',o=join(dir,'out',tool,name);mkdirSync(o,{recursive:true});
 writeFileSync(join(o,name+'_n.png'),await bytes(await encodeRGBAPNG(g.normal,w,h)));
 return {ms,params};
}
const timings={};
for(const n of ['torch','asteroids','bricks','bricks_rolled','bricksheight','bricksheight_rolled'])timings['nerulio/'+n]=await nerulio(n);
for(const n of ['bricksheight','bricksheight_rolled'])timings['nerulio-heightmap/'+n]=await nerulio(n,{asHeight:true});
// --- measurements -----------------------------------------------------------------------------
const dec=(d,p)=>{let x=d[p*4]/127.5-1,y=d[p*4+1]/127.5-1,z=d[p*4+2]/127.5-1;const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};
const LIGHTS=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{const v=[x,-y,Math.SQRT2];const l=Math.hypot(...v);return v.map(c=>c/l);});// y up (GL)
function compare(out,truth,mask,n){
 let sumA=0,cnt=0,cg=0,gg=0,tt=0,lam=0;const pairs=[];
 for(let p=0;p<n;p++){if(!mask[p])continue;const a=dec(out,p),b=dec(truth,p);pairs.push([a,b]);
  sumA+=Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])));cnt++;cg+=a[1]*b[1];gg+=a[1]*a[1];tt+=b[1]*b[1];
  for(const L of LIGHTS)lam+=Math.abs(Math.max(0,a[0]*L[0]+a[1]*L[1]+a[2]*L[2])-Math.max(0,b[0]*L[0]+b[1]*L[1]+b[2]*L[2]))*255;}
 let best={s:1,deg:Infinity};
 for(let i=0;i<=60;i++){const s=Math.pow(10,-1.5+i*3/60);let e=0;for(const [a,b] of pairs){let x=a[0]*s,y=a[1]*s,z=a[2];const l=Math.hypot(x,y,z)||1;e+=Math.acos(Math.max(-1,Math.min(1,(x*b[0]+y*b[1]+z*b[2])/l)));}e=e/pairs.length*180/Math.PI;if(e<best.deg)best={s,deg:e};}
 return {pixels:cnt,meanDeg:sumA/cnt*180/Math.PI,bestScaleDeg:best.deg,bestScale:best.s,greenCorr:cg/Math.sqrt(gg*tt||1),lambertLevels:lam/cnt/LIGHTS.length};
}
const truths={torch:'truth_torch_n.png',asteroids:'truth_asteroids_n.png',bricks:'truth_bricks_n.png',bricksheight:'truth_bricks_n.png'};
const rows=[];
const tools=readdirSync(join(dir,'out')).filter(t=>existsSync(join(dir,'out',t))&&!t.includes('.'));
for(const tool of tools)for(const input of Object.keys(truths)){
 const f=join(dir,'out',tool,input,input+'_n.png');if(!existsSync(f))continue;
 const out=await load(f),truth=await load(join(dir,'in',truths[input])),src=await load(join(dir,'in',input+'.png'));
 const {width:w,height:h}=src;if(out.width!==w||out.height!==h){rows.push({tool,input,error:`size ${out.width}x${out.height} != ${w}x${h}`});continue;}
 const n=w*h,mask=new Uint8Array(n);for(let p=0;p<n;p++)mask[p]=src.data[p*4+3]===255?1:0;
 const det=detectConvention(out.data.map((v,i)=>i%4===3?src.data[i]:v),w,h);
 const row={tool,input,...compare(out.data,truth.data,mask,n),detected:det.convention,confidence:det.confidence};
 if(input.startsWith('bricks')){
  const s=seamError(out.data,w,h);row.seamRatio=s.ratio;row.seamMax=s.maxSeam;
  const rf=join(dir,'out',tool,input+'_rolled',input+'_rolled_n.png');
  if(existsSync(rf)){const r=await load(rf),back=roll(r.data,w,h,-(w>>1),-(h>>1));const rc=rollConsistency(out.data,back,w,h,{band:2});row.rollBorder=rc.border;row.rollInterior=rc.interior;row.rollMax=rc.maxBorder;}
 }
 rows.push(row);
}
const f=v=>v==null?'-':typeof v==='number'?(Math.abs(v)>=100?v.toFixed(0):v.toFixed(2)):String(v);
console.log('tool'.padEnd(20),'input'.padEnd(13),'deg'.padStart(6),'deg@best'.padStart(9),'scale'.padStart(6),'gCorr'.padStart(6),'lambert'.padStart(8),'detected'.padStart(18),'seam'.padStart(6),'rollB'.padStart(6),'rollMax'.padStart(7));
for(const r of rows){if(r.error){console.log(r.tool.padEnd(20),r.input.padEnd(13),r.error);continue;}
 console.log(r.tool.padEnd(20),r.input.padEnd(13),f(r.meanDeg).padStart(6),f(r.bestScaleDeg).padStart(9),f(r.bestScale).padStart(6),f(r.greenCorr).padStart(6),f(r.lambertLevels).padStart(8),`${r.detected||'none'}/${r.confidence}`.padStart(18),f(r.seamRatio).padStart(6),f(r.rollBorder).padStart(6),f(r.rollMax).padStart(7));}
if(jsonOut)writeFileSync(jsonOut,JSON.stringify({rows,timings:Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,{ms:Math.round(v.ms)}]))},null,1));
