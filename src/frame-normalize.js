import * as Im from './image.js';
import {imageBounds} from './image-bounds.js';
import {boxOf,layoutFrames} from './sprite-frames.js';
/** Canvas side of the frame model: one frame of one source canvas onto its output canvas.
 * The normaliser and the slicer's "same canvas for every frame" export share this, so both
 * put a frame at exactly the same place. Nothing here decides *which* rectangles exist. */
export async function trimmedRect(source,box,options={}){
 const {x,y,w,h}=box;
 if(w===source.width&&h===source.height&&!x&&!y){const b=await imageBounds(source,options);return b?{...b}:null;}
 const c=Im.canvas(w,h);
 try{c.getContext('2d').drawImage(source,x,y,w,h,0,0,w,h);const b=await imageBounds(c,options);return b?{x:x+b.x,y:y+b.y,w:b.w,h:b.h}:null;}
 finally{Im.release(c);}
}
/** Nearest-neighbour by design: a frame is copied, never resampled. */
export function paintFrame(ctx,source,frame,dx=0,dy=0){
 const b=boxOf(frame);ctx.imageSmoothingEnabled=false;
 ctx.drawImage(source,b.x,b.y,b.w,b.h,dx+frame.offsetX,dy+frame.offsetY,b.w,b.h);
}
export function renderFrame(source,frame){
 const c=Im.canvas(frame.canvasWidth,frame.canvasHeight);
 paintFrame(c.getContext('2d'),source,frame);return c;
}
/** All frames side by side at one cell size: the strip PNG engines and spritesheet importers read. */
export function stripSheet(sourceOf,frames,options={}){
 const {frames:laid,width,height,uniform}=layoutFrames(frames,{...options,mode:'common'});
 if(!uniform||!width||!height)throw Error('A strip needs a common frame size');
 const c=Im.canvas(width*laid.length,height),ctx=c.getContext('2d');
 laid.forEach((f,i)=>paintFrame(ctx,sourceOf(f,i),f,i*width,0));
 return {canvas:c,cellWidth:width,cellHeight:height};
}
/** RGBA buffers for the GIF encoder: one equally sized frame per animation step. */
export function frameBuffers(sourceOf,frames,options={}){
 const {frames:laid,width,height,uniform}=layoutFrames(frames,{...options,mode:'common'});
 if(!uniform||!width||!height)throw Error('An animation needs a common frame size');
 const c=Im.canvas(width,height),ctx=c.getContext('2d');
 try{
  return {width,height,buffers:laid.map((f,i)=>{ctx.clearRect(0,0,width,height);paintFrame(ctx,sourceOf(f,i),f);return ctx.getImageData(0,0,width,height).data;})};
 }finally{Im.release(c);}
}
