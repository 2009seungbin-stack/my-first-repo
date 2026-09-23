/** Off-main-thread pixel work for the Tile workspace.
 * {id, op, key, blob, ...} → {id, ok, result|error}. The decoded RGBA of the last sheet is kept.
 * PNGs are decoded byte-exact (no colour management), other formats through the browser.
 *   detect   ranked grid candidates (src/game/tile-grid.js), plus which sizes an autotile layout fits
 *   identify layout candidates for a grid (src/game/tiles/identify.js)
 *   suggest  bits from pixels for every tile          art   art-vs-bits check
 *   blank    which cells are fully transparent       collision  polygons per tile from alpha
 *   generate assemble a set from a source block and lay it out as a sheet (PNG bytes back) */
import {decodePNG} from '../../../game/texture-png.js';
import {detectGrid} from '../../../game/tile-grid.js';
import {identifyLayout,suggestBits,artCheck,tileSource,blockTerrains} from '../../../game/tiles/identify.js';
import {assembleSource,assembleDual,buildSheet,asTransition} from '../../../game/tiles/generator.js';
import {encodeRGBAPNG} from '../../../game/texture-png.js';
import {tileCollision} from '../../../game/tile-collision.js';
let cache={key:'',img:null};
async function pixels(key,blob){
 if(cache.key===key&&cache.img)return cache.img;
 let img;
 try{const d=await decodePNG(new Uint8Array(await blob.arrayBuffer()));img={data:new Uint8ClampedArray(d.data.buffer,d.data.byteOffset,d.data.length),width:d.width,height:d.height};}
 catch{
  const bmp=await createImageBitmap(blob,{premultiplyAlpha:'none',colorSpaceConversion:'none'}),c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(bmp,0,0);bmp.close();const d=x.getImageData(0,0,c.width,c.height);img={data:d.data,width:c.width,height:c.height};
 }
 cache={key,img};return img;
}
const tilesOf=(img,grid)=>{const src=tileSource(img,grid),g=src.grid,list=[];for(let r=0;r<g.rows;r++)for(let c=0;c<g.cols;c++)list.push(src.blank(c,r)?null:src.tile(c,r));return {src,g,list};};
self.onmessage=async({data})=>{
 const {id,op,key,blob}=data;
 try{
  const img=blob?await pixels(key,blob):null;let result;
  if(op==='detect'){
   const t0=performance.now();
   let list=[];if(img.width*img.height<=16e6)list=detectGrid(img.data,img.width,img.height,{limit:6});
   // Layout-aware check: a size at which a published autotile layout fits exactly is shown as
   // evidence next to the pixel-period candidates (2×, ½× and ¼× of the top sizes too).
   const sizes=new Map();
   for(const c of list.slice(0,3))for(const k of [1,2,4,.5,.25]){const w=c.tileWidth*k,h=c.tileHeight*k;if(!Number.isInteger(w)||!Number.isInteger(h)||w<8||h<8)continue;const g={w,h,ox:k===1?c.marginX:0,oy:k===1?c.marginY:0,sx:k===1?c.spacingX:0,sy:k===1?c.spacingY:0};sizes.set(JSON.stringify(g),g);}
   const fits=[];
   for(const g of sizes.values()){
    const cols=Math.floor((img.width-g.ox+g.sx)/(g.w+g.sx)),rows=Math.floor((img.height-g.oy+g.sy)/(g.h+g.sy));
    if(cols<2||rows<2||cols*rows>256)continue;
    const r=identifyLayout(img,g,{maxTiles:600,sources:false});const top=r.candidates[0];
    if(top&&top.confidence==='high')fits.push({grid:g,layoutId:top.layoutId,auc:top.auc});
   }
   result={ms:performance.now()-t0,candidates:list.map(c=>({w:c.tileWidth,h:c.tileHeight,ox:c.marginX,oy:c.marginY,sx:c.spacingX,sy:c.spacingY,cols:c.cols,rows:c.rows,score:c.score,confidence:c.confidence,content:c.content?{reason:c.content.reason,layout:c.content.layout||null}:null})),fits,width:img.width,height:img.height};
  }else if(op==='identify'){
   const r=identifyLayout(img,data.grid,{maxTiles:4096});
   const bt=r.blocks.length>1?blockTerrains(img,data.grid,r.blocks.filter(b=>!b.source&&b.layoutId===r.candidates[0]?.layoutId)):null;
   result={candidates:r.candidates,blocks:r.blocks,hints:r.hints,grid:r.grid,reason:r.reason||'',blockTerrains:bt};
  }else if(op==='blank'){
   const {src,g}=tilesOf(img,data.grid),blank=[];for(let r=0;r<g.rows;r++)for(let c=0;c<g.cols;c++)if(src.blank(c,r))blank.push(c+','+r);
   result={grid:g,blank};
  }else if(op==='suggest'){
   const {g,list}=tilesOf(img,data.grid),full=data.full?data.full.row*g.cols+data.full.col:null;
   const s=suggestBits(list,{full,mode:data.mode,terrain:data.terrain||0});
   result={measurable:s.measurable,reason:s.reason||'',full:s.full!=null?{col:s.full%g.cols,row:Math.floor(s.full/g.cols)}:null,
    separation:s.sideSplit?.separation??null,tiles:(s.tiles||[]).map((t,i)=>t&&{col:i%g.cols,row:Math.floor(i/g.cols),pattern:t.pattern,confidence:t.confidence}).filter(Boolean)};
  }else if(op==='art'){
   const {g,list}=tilesOf(img,data.grid);const pats=list.map((_,i)=>data.patterns[(i%g.cols)+','+Math.floor(i/g.cols)]||null);
   const a=artCheck(list,pats,{mode:data.mode});
   result={...a,mismatches:(a.mismatches||[]).map(m=>({...m,col:m.index%g.cols,row:Math.floor(m.index/g.cols)})),full:a.full!=null?{col:a.full%g.cols,row:Math.floor(a.full/g.cols)}:null};
  }else if(op==='collision'){
   const {g,list}=tilesOf(img,data.grid),out={};
   list.forEach((t,i)=>{const k=(i%g.cols)+','+Math.floor(i/g.cols);if(!t||!data.keys.includes(k))return;const shapes=tileCollision(t.data,t.w,t.h,{mode:data.mode||'outline',threshold:data.threshold??0,epsilon:data.epsilon??0});if(shapes.length)out[k]=shapes;});
   result={collision:out};
  }else if(op==='generate'){
   const {w,h}=data.grid,src=tileSource(img,data.grid),at=(c,r)=>src.tile(data.origin.col+c,data.origin.row+r);
   const bg=data.background?src.tile(data.background.col,data.background.row):null;
   let set=data.dual?assembleDual(data.kind,at,{w,h,rim:data.rim||{}}):assembleSource(data.kind,at,{w,h,rim:data.rim||{}});
   if(bg)set=asTransition({...set,tiles:set.tiles.map(t=>({...t,image:overBg(t.image,bg)}))},1,bg);
   const layout=data.dual?'corner16-cr31':set.mode==='sides'?'edge16-binary':data.layout||'blob47-cr31-ascending';
   const sheet=buildSheet(set.tiles,layout,{w,h,terrain:0});
   const png=await encodeRGBAPNG(sheet.image.data,sheet.image.width,sheet.image.height);
   result={png,width:sheet.image.width,height:sheet.image.height,grid:sheet.grid,cells:sheet.cells,layoutId:layout,mode:set.mode,transition:!!bg,
    provenance:set.tiles.map(t=>t.provenance)};
  }else throw Error('unknown op '+op);
  self.postMessage({id,ok:true,result});
 }catch(e){self.postMessage({id,ok:false,error:String(e?.message||e)});}
};
function overBg(img,bg){
 const out={data:new Uint8ClampedArray(bg.data),w:img.w,h:img.h},d=out.data,s=img.data;
 for(let i=0;i<d.length;i+=4){const a=s[i+3];if(!a)continue;if(a===255){d.set(s.subarray(i,i+4),i);continue;}const b=d[i+3],oa=a+b*(255-a)/255;for(let k=0;k<3;k++)d[i+k]=Math.round((s[i+k]*a+d[i+k]*b*(255-a)/255)/oa);d[i+3]=Math.round(oa);}
 return out;
}
