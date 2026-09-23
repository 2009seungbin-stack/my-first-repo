// Accuracy of the OpenGL/DirectX detection (src/game/normals/convention.js) on real normal maps
// whose convention is known: every ambientCG material ships *_NormalGL and *_NormalDX, Poly Haven
// ships nor_gl / nor_dx, and the corpus sprites carry a verified convention (docs/GAME-CORPUS.md).
//
//   node tools/engine-verify/texture/convention_eval.mjs [--json out.json] [--crops 256,64]
//
// Samples: every full map, plus crops (4 per size, fixed positions) to see how it degrades on
// small textures and sprite-sized pieces. Reported: coverage (a verdict was given), accuracy of the
// verdicts, and the wrong verdicts per confidence level — a wrong "high" is the failure that matters.
import {readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {decodePNG} from '../../../src/game/texture-png.js';
import {detectConvention} from '../../../src/game/normals/convention.js';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(v.startsWith('--'))a.push([v.slice(2),all[i+1]&&!all[i+1].startsWith('--')?all[i+1]:true]);return a;},[]));
const CORPUS=process.env.NERULIO_CORPUS||'C:/Users/2009s/nerulio-asset-corpus';
const crops=String(args.crops||'256,64').split(',').map(Number).filter(Boolean);
const items=[];// {name, file, truth, alphaFrom?}
const addDir=(dir,label)=>{if(!existsSync(dir))return;for(const f of readdirSync(dir)){const low=f.toLowerCase();const truth=/normalgl|nor_gl/.test(low)?'opengl':/normaldx|nor_dx/.test(low)?'directx':null;if(truth&&low.endsWith('.png'))items.push({name:`${label}/${f}`,file:join(dir,f),truth});}};
for(const d of ['ambientcg-bricks076c','ambientcg-metalplates006','polyhaven-brick-wall-001'])addDir(join(CORPUS,'textures',d),d);
const adhoc=join(CORPUS,'_adhoc','nerulio-studio-texture','ambientcg');
if(existsSync(adhoc))for(const d of readdirSync(adhoc))addDir(join(adhoc,d),'acg/'+d);
items.push({name:'oga-asteroids/normal',file:join(CORPUS,'sprites-normal/oga-asteroids/asteroids_spritesheet_normal.png'),truth:'opengl',sprite:true});
items.push({name:'oga-pixel-torch/normal',file:join(CORPUS,'sprites-normal/oga-pixel-torch/Torch_Sheet_Normal.png'),truth:'directx',alphaFrom:join(CORPUS,'sprites-normal/oga-pixel-torch/Torch_Sheet.png'),sprite:true});
const rows=[];
const crop=(img,x,y,s)=>{const o=new Uint8Array(s*s*4);for(let j=0;j<s;j++)o.set(img.data.subarray(((y+j)*img.width+x)*4,((y+j)*img.width+x+s)*4),j*s*4);return o;};
for(const it of items){
 if(!existsSync(it.file))continue;
 const img=await decodePNG(new Uint8Array(readFileSync(it.file)),{maxPixels:268e6});
 if(it.alphaFrom){const a=await decodePNG(new Uint8Array(readFileSync(it.alphaFrom)));for(let p=0;p<img.width*img.height;p++)img.data[p*4+3]=a.data[p*4+3];}
 const run=(data,w,h,size)=>{const t0=performance.now(),r=detectConvention(data,w,h);
  // the naive rule some tools imply ("mostly green-high = OpenGL") as a baseline
  let up=0,n=0;for(let p=0;p<w*h;p++){if(data[p*4+3]===0)continue;n++;if(data[p*4+1]>128)up++;}
  rows.push({name:it.name,size,truth:it.truth,said:r.convention,confidence:r.confidence,reason:r.reason,ms:Math.round(performance.now()-t0),naive:up/n>.5?'opengl':'directx',sprite:!!it.sprite});};
 run(img.data,img.width,img.height,'full');
 if(!it.sprite)for(const s of crops){if(s>img.width||s>img.height)continue;
  for(const [fx,fy] of [[.1,.1],[.6,.15],[.2,.6],[.55,.55]]){const x=Math.min(img.width-s,Math.round(img.width*fx)),y=Math.min(img.height-s,Math.round(img.height*fy));run(crop(img,x,y,s),s,s,String(s));}}
}
const sum=list=>{const decided=list.filter(r=>r.said),right=decided.filter(r=>r.said===r.truth);const by=c=>{const d=decided.filter(r=>r.confidence===c);return {n:d.length,wrong:d.filter(r=>r.said!==r.truth).length};};
 return {samples:list.length,decided:decided.length,coverage:list.length?decided.length/list.length:0,accuracy:decided.length?right.length/decided.length:0,high:by('high'),medium:by('medium'),low:by('low'),naiveAccuracy:list.length?list.filter(r=>r.naive===r.truth).length/list.length:0};};
const groups={all:rows,full:rows.filter(r=>r.size==='full'),...Object.fromEntries(crops.map(s=>[String(s),rows.filter(r=>r.size===String(s))])),sprites:rows.filter(r=>r.sprite)};
const report=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,sum(v)]));
for(const [k,v] of Object.entries(report))console.log(k.padEnd(8),`${v.samples} samples · verdict on ${(v.coverage*100).toFixed(1)}% · accuracy ${(v.accuracy*100).toFixed(1)}% · high ${v.high.n} (wrong ${v.high.wrong}) · medium ${v.medium.n} (wrong ${v.medium.wrong}) · low ${v.low.n} (wrong ${v.low.wrong}) · naive green rule ${(v.naiveAccuracy*100).toFixed(1)}%`);
const wrong=rows.filter(r=>r.said&&r.said!==r.truth);if(wrong.length)console.log('wrong:',wrong.map(r=>`${r.name}@${r.size} ${r.confidence}`).join('; '));
const none=rows.filter(r=>!r.said&&r.size==='full');if(none.length)console.log('no verdict (full maps):',none.map(r=>`${r.name} (${r.reason})`).join('; '));
if(args.json)writeFileSync(args.json,JSON.stringify({report,rows},null,1));
