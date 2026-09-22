/** Off-main-thread pixel work for the Studio: grid suggestions and "which cells hold pixels".
 * Messages: {id, op:'detect'|'cells', key, blob, spec?} → {id, ok, result|error}.
 * The decoded RGBA of the last image is kept, so trying several grids does not re-decode. */
import {detectGrid,cellRect} from '../game/grid-detect.js';
import {ALPHA_THRESHOLD} from '../game/pixels.js';
let cache={key:'',img:null};
async function pixels(key,blob){
 if(cache.key===key&&cache.img)return cache.img;
 const bmp=await createImageBitmap(blob,{premultiplyAlpha:'none'}),c=new OffscreenCanvas(bmp.width,bmp.height),x=c.getContext('2d',{willReadFrequently:true});
 x.drawImage(bmp,0,0);bmp.close();
 const d=x.getImageData(0,0,c.width,c.height);cache={key,img:{data:d.data,width:c.width,height:c.height}};return cache.img;
}
function nonEmpty(img,r){
 const {data,width}=img;
 for(let y=r.y;y<r.y+r.h;y++){let i=(y*width+r.x)*4+3;for(let x=0;x<r.w;x++,i+=4)if(data[i]>ALPHA_THRESHOLD)return true;}
 return false;
}
self.onmessage=async({data})=>{
 const {id,op,key,blob,spec}=data;
 try{
  const img=await pixels(key,blob);let result;
  if(op==='detect'){
   const t0=performance.now(),r=detectGrid(img,{limit:4});
   result={ms:performance.now()-t0,reason:r.reason||'',opaque:r.profile?.opaque??0,suggestions:r.suggestions.map(s=>({cellWidth:s.cellWidth,cellHeight:s.cellHeight,marginX:s.marginX,marginY:s.marginY,spacingX:s.spacingX,spacingY:s.spacingY,columns:s.columns,rows:s.rows,cells:s.cells,score:s.score,confidence:s.confidence,evidence:s.evidence}))};
  }else if(op==='cells'){
   const out=[];
   for(let row=0;row<spec.rows;row++)for(let col=0;col<spec.cols;col++){
    const r=cellRect({cellWidth:spec.w,cellHeight:spec.h,marginX:spec.ox,marginY:spec.oy,spacingX:spec.sx,spacingY:spec.sy},col,row);
    if(r.x+r.w>img.width||r.y+r.h>img.height)continue;
    out.push({...r,empty:!nonEmpty(img,r)});
   }
   result={cells:out};
  }else throw Error('unknown op '+op);
  self.postMessage({id,ok:true,result});
 }catch(e){self.postMessage({id,ok:false,error:String(e?.message||e)});}
};
