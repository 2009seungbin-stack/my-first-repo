import {canvas,release} from './image.js';
import {grid,sheetLayout} from './primitives.js';
import {abort,yieldUI} from './resources.js';
/** Nine direct blits per tile — the tile, its four edges stretched outwards and its four corner
 * pixels — over any set of source rectangles, so a sheet with margins or separation extrudes
 * exactly the way an evenly divided one does. Avoids whole-atlas RGBA arrays and duplicate
 * working buffers. */
export async function extrudeRegions(source,rects,{cellW,cellH,padding,columns,signal,progress=()=>{}}={}){
 const layout=sheetLayout(rects.length,cellW,cellH,columns,padding),out=canvas(layout.width,layout.height),ctx=out.getContext('2d');
 ctx.imageSmoothingEnabled=false;let success=false;
 try{
  for(let i=0;i<rects.length;i++){
   abort(signal);
   const s=rects[i],d=layout.frames[i];
   ctx.drawImage(source,s.x,s.y,s.w,s.h,d.x,d.y,d.w,d.h);
   if(padding){
    for(const [sx,sw,dx,dw]of [[s.x,1,d.x-padding,padding],[s.x,s.w,d.x,s.w],[s.x+s.w-1,1,d.x+d.w,padding]])
     for(const [sy,sh,dy,dh]of [[s.y,1,d.y-padding,padding],[s.y,s.h,d.y,s.h],[s.y+s.h-1,1,d.y+d.h,padding]]){
      if(dx===d.x&&dy===d.y)continue;
      ctx.drawImage(source,sx,sy,sw,sh,dx,dy,dw,dh);
     }
   }
   progress(`Extruding tile ${i+1} / ${rects.length}`);await yieldUI();
  }
  success=true;return {canvas:out,...layout};
 }finally{if(!success)release(out);}
}
export const extrudeAtlas=(source,cellW,cellH,padding,options={})=>
 extrudeRegions(source,grid(source.width,source.height,cellW,cellH),{cellW,cellH,padding,columns:source.width/cellW,...options});
