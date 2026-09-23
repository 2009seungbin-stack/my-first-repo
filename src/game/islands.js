/** Alpha islands (8-connected components) of a whole sheet, read band by band.
 *
 * Replaces the one-shot `primitives.components` for the Sprite Lab, for two reasons:
 *  1. Size. The old labeller needed the whole sheet as one RGBA copy plus a Uint32 queue per
 *     pixel, so it was capped at 4 MP. This one walks the sheet one band at a time through a
 *     source (src/game/pixels.js) and keeps only the previous row's runs and the islands that
 *     are still open, so a 4096² sheet costs one band plus the run list.
 *  2. Honesty. Islands under `minArea` used to vanish. Here they are kept in `small` (with their
 *     bounds and area), so a caller can attach them to a frame or report them — never lose them.
 *
 * Run-based union–find: each row is split into opaque runs; a run joins every run of the row
 * above that overlaps it or touches it diagonally (x-1 … x+1), which is exactly 8-connectivity.
 * An island is closed when a row passes with no run continuing it. */
import {source,ALPHA_THRESHOLD,BAND_PIXELS} from './pixels.js';
import {MAX_FRAMES} from '../primitives.js';
export const MAX_SMALL_ISLANDS=200_000;
class Node{constructor(x0,x1,y){this.parent=null;this.x0=x0;this.x1=x1;this.y0=y;this.y1=y;this.area=x1-x0+1;this.open=true;}}
const root=n=>{let r=n;while(r.parent)r=r.parent;while(n.parent){const next=n.parent;n.parent=r;n=next;}return r;};
function union(a,b){
 a=root(a);b=root(b);if(a===b)return a;
 if(a.area<b.area)[a,b]=[b,a];
 b.parent=a;a.x0=Math.min(a.x0,b.x0);a.x1=Math.max(a.x1,b.x1);a.y0=Math.min(a.y0,b.y0);a.y1=Math.max(a.y1,b.y1);a.area+=b.area;b.open=false;
 return a;
}
/** Incremental scanner: feed rows top to bottom with `rows(rgba,width,height)`, then `finish()`. */
export class IslandScan{
 constructor(width,{threshold=ALPHA_THRESHOLD,minArea=1,maxIslands=MAX_FRAMES,maxSmall=MAX_SMALL_ISLANDS}={}){
  this.width=width;this.threshold=threshold;this.minArea=Math.max(1,minArea|0);this.maxIslands=maxIslands;this.maxSmall=maxSmall;
  this.previous=[];this.open=new Set();this.islands=[];this.small=[];this.smallCount=0;this.smallPixels=0;this.y=0;
 }
 close(n){
  n.open=false;this.open.delete(n);
  const rect={x:n.x0,y:n.y0,w:n.x1-n.x0+1,h:n.y1-n.y0+1,area:n.area};
  if(n.area>=this.minArea){
   if(this.islands.length>=this.maxIslands)throw Error(`More than ${this.maxIslands} islands: raise the minimum area or use a grid`);
   this.islands.push(rect);
  }else{
   this.smallCount++;this.smallPixels+=n.area;
   if(this.small.length<this.maxSmall)this.small.push(rect);
  }
 }
 rows(data,height){
  const w=this.width,t=this.threshold;
  if(data.length!==w*height*4)throw Error('Band size does not match the sheet width');
  for(let row=0;row<height;row++,this.y++){
   const y=this.y,runs=[],prev=this.previous;let cursor=0;
   for(let x=0;x<w;){
    if(data[(row*w+x)*4+3]<=t){x++;continue;}
    const start=x;while(x<w&&data[(row*w+x)*4+3]>t)x++;
    const end=x-1;
    while(cursor<prev.length&&prev[cursor].end<start-1)cursor++;
    let node=null;
    for(let i=cursor;i<prev.length&&prev[i].start<=end+1;i++)node=node?union(node,prev[i].node):root(prev[i].node);
    if(node){node.x0=Math.min(node.x0,start);node.x1=Math.max(node.x1,end);node.y1=y;node.area+=end-start+1;}
    else{node=new Node(start,end,y);this.open.add(node);}
    runs.push({start,end,node});
   }
   // Runs keep pointing at the node they were created with; resolve them to roots so the next
   // row joins the island, not a stale branch of it.
   for(const r of runs)r.node=root(r.node);
   for(const n of this.open)if(!n.open||n.parent)this.open.delete(n);else if(n.y1<y)this.close(n);
   this.previous=runs;
  }
 }
 finish(){
  for(const n of [...this.open])if(!n.parent)this.close(n);
  this.open.clear();this.previous=[];
  const order=(a,b)=>a.y-b.y||a.x-b.x;
  return {islands:this.islands.sort(order),small:this.small.sort(order),smallCount:this.smallCount,smallPixels:this.smallPixels,
   smallTruncated:this.smallCount>this.small.length};
 }
}
/** Generator form: yields after every band so a UI can `await` a frame between bands. */
export function* scanIslands(src,{threshold=ALPHA_THRESHOLD,minArea=1,maxIslands=MAX_FRAMES,bandPixels=BAND_PIXELS,signal}={}){
 const s=source(src),scan=new IslandScan(s.width,{threshold,minArea,maxIslands});
 const rows=Math.max(1,Math.min(s.height,Math.floor(bandPixels/s.width)||1));
 for(let y=0;y<s.height;y+=rows){
  signal?.throwIfAborted?.();
  const h=Math.min(rows,s.height-y),band=s.read({x:0,y,w:s.width,h});
  scan.rows(band.data,h);
  yield {done:y+h,total:s.height};
 }
 return scan.finish();
}
function drain(it){for(;;){const step=it.next();if(step.done)return step.value;}}
/** All islands of a sheet. `islands` are at least `minArea` pixels; `small` are the rest. */
export const labelIslands=(src,options)=>drain(scanIslands(src,options));
/** Same, but gives the event loop a turn between bands (`pause` is e.g. resources.yieldUI). */
export async function labelIslandsAsync(src,{pause,progress,...options}={}){
 const it=scanIslands(src,options);
 for(;;){const step=it.next();if(step.done)return step.value;progress?.(step.value);if(pause)await pause();}
}
