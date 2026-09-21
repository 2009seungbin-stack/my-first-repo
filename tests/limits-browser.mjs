/** Raised game-asset and GIF limits exercised through the real recipe and media workers.
 * Archives are handed back to the runner, which reopens them with Python zipfile / Pillow. */
import {runRecipe} from '../src/recipes.js';
import {imageComponents} from '../src/image-components.js';
import {canvas,blobOf,release} from '../src/image.js';
import {modernMedia,releaseOutput} from '../src/media-modern.js';

const stash=new Map();
export async function chunk(key,offset,size){const b=stash.get(key);const bytes=new Uint8Array(await b.slice(offset,offset+size).arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
export function drop(key){stash.delete(key);}
const keep=(key,blob)=>(stash.set(key,blob),{key,bytes:blob.size});

export async function run({video}={}){
 const checks=[],rows=[],check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
 // 1. Sprite detection: 32 × 32 = 1024 separated sprites (old cap: 256).
 const sheet=canvas(2048,2048),g=sheet.getContext('2d');
 for(let i=0;i<1024;i++){g.fillStyle=`hsl(${i*7%360} 80% 50%)`;g.fillRect(i%32*64+8,Math.floor(i/32)*64+8,40+i%9,40+i%7);}
 let t=performance.now();const rects=await imageComponents(sheet,{threshold:8,minArea:16});check('1024 candidates detected (old cap 256)',rects.length===1024);
 const sliced=await runRecipe('sprite-slicer',{source:sheet,items:[],rects,options:{}});
 check('1024 sprites detected and exported',sliced.outputCount===1025);rows.push({case:'sprite-slicer 1024',ms:performance.now()-t|0,...keep('slicer',sliced.blob)});release(sheet);release(sliced.canvas);
 // 2. Grid: 8192² noise into 4096 tiles of 128 px; total output well over the old 128 MiB cap.
 const noise=canvas(8192,8192),n=noise.getContext('2d'),row=new ImageData(8192,64);
 for(let y=0;y<8192;y+=64){for(let i=0;i<row.data.length;i+=65536)crypto.getRandomValues(row.data.subarray(i,i+65536));for(let i=3;i<row.data.length;i+=4)row.data[i]=255;n.putImageData(row,0,y);}
 t=performance.now();const tiles=await runRecipe('tile-helper',{source:noise,items:[],options:{cellW:128,cellH:128}});
 check('4096 tiles exported',tiles.outputCount===4097);check('output exceeds the old 128 MiB cap',tiles.blob.size>128*1024**2);
 rows.push({case:'tile-helper 4096 × 128px noise',ms:performance.now()-t|0,...keep('tiles',tiles.blob)});release(noise);release(tiles.canvas);
 // 3. Sprite sheet from 300 separate inputs (old input cap: 24).
 const items=[];for(let i=0;i<300;i++){const c=canvas(24,32);const x=c.getContext('2d');x.fillStyle=`hsl(${i} 70% 50%)`;x.fillRect(2,4+i%6,20,24-i%6);items.push({name:`walk-${i}.png`,blob:await blobOf(c)});release(c);}
 t=performance.now();const sheetOut=await runRecipe('sprite-sheet-maker',{source:items[0].blob,items,options:{columns:20,padding:1,align:'bottom',anchor:.5}});
 check('300-frame sheet exported',sheetOut.outputCount===2);rows.push({case:'sprite-sheet-maker 300 inputs',ms:performance.now()-t|0,...keep('sheet',sheetOut.blob)});release(sheetOut.canvas);
 // 4. GIF frames stream into temporary storage instead of accumulating in the worker heap.
 if(video&&typeof VideoDecoder==='undefined')rows.push({case:'GIF skipped: no WebCodecs VideoDecoder in this browser'});
 else if(video){
  t=performance.now();const r=await modernMedia('gif',video,{start:0,end:6,width:480,fps:15,colors:128});
  check('GIF output streamed to OPFS',r.report.outputBackend==='opfs'&&r.report.streamingOutput===true);check('GIF frame count',r.report.frames===90);
  rows.push({case:'GIF 6 s × 15 fps',ms:performance.now()-t|0,report:r.report,...keep('gif',new Blob([await r.blob.arrayBuffer()],{type:'image/gif'}))});await releaseOutput(r.blob);
  const root=await navigator.storage.getDirectory(),left=[];for await(const [name] of root.entries())if(name.startsWith('nerulio-media-'))left.push(name);
  check('released GIF leaves no temporary file',left.length===0);
 }
 return {checks,rows};
}
