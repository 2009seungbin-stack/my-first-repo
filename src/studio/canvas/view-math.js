/** Canvas view math for the Studio. Pure: no DOM, no state.
 *
 * Units. Everything here is in DEVICE pixels (canvas backing-store pixels), never CSS pixels, so
 * a zoom of 3 means one image pixel covers exactly 3×3 physical pixels on any screen. That is the
 * only way pixel art stays crisp on 125 %/150 % Windows scaling, where "300 % of a CSS pixel" is
 * 3.75 device pixels and every fourth column would be one pixel wider than its neighbours.
 * "100 %" in the Studio therefore means 1 image pixel = 1 screen pixel (as in Photoshop).
 *
 * View {scale, x, y}: `scale` device px per image px, always an integer (≥1) or 1/n (<1);
 * (x, y) is where image pixel (0, 0)'s top-left corner lands, in whole device pixels. Because both
 * are integers, every image pixel edge lands on a device pixel edge: nearest-neighbour is exact. */
export const ZOOMS=Object.freeze([1/32,1/24,1/16,1/12,1/8,1/6,1/4,1/3,1/2,1,2,3,4,5,6,8,10,12,16,20,24,32,40,48,64,96,128]);
export const MIN_ZOOM=ZOOMS[0],MAX_ZOOM=ZOOMS[ZOOMS.length-1];
/** Aseprite's number-key zoom levels (1 → 100 %, 2 → 200 %, 3 → 400 %, 4 → 800 %, 5 → 1600 %, 6 → 3200 %). */
export const KEY_ZOOMS=Object.freeze({1:1,2:2,3:4,4:8,5:16,6:32});
const EPS=1e-9;
export const isValidZoom=s=>Number.isFinite(s)&&s>0&&(s>=1?Math.abs(s-Math.round(s))<EPS:Math.abs(1/s-Math.round(1/s))<EPS);
/** Nearest allowed zoom at or below `s` (so "fit" never overflows). */
export function floorZoom(s){
 if(!(s>0))return MIN_ZOOM;
 let best=MIN_ZOOM;for(const z of ZOOMS)if(z<=s+EPS)best=z;return best;
}
/** Next zoom level in `dir` (+1 in, −1 out); stays put at the ends. */
export function stepZoom(s,dir){
 const i=ZOOMS.findIndex(z=>Math.abs(z-s)<EPS);
 if(i<0){// an off-list value (should not happen) snaps to the neighbour in the asked direction
  return dir>0?(ZOOMS.find(z=>z>s+EPS)??MAX_ZOOM):([...ZOOMS].reverse().find(z=>z<s-EPS)??MIN_ZOOM);
 }
 return ZOOMS[Math.max(0,Math.min(ZOOMS.length-1,i+(dir>0?1:-1)))];
}
/** Percentage label: 1/3 → "33.3", 4 → "400". */
export function zoomPercent(s){const p=s*100;return Math.abs(p-Math.round(p))<.05?String(Math.round(p)):p.toFixed(1);}
export const view=(scale=1,x=0,y=0)=>({scale,x,y});
export const toImage=(v,sx,sy)=>({x:(sx-v.x)/v.scale,y:(sy-v.y)/v.scale});
export const toScreen=(v,ix,iy)=>({x:v.x+ix*v.scale,y:v.y+iy*v.scale});
/** The image pixel under a screen point (integer), or null when outside the image. */
export function pixelAt(v,sx,sy,w,h){
 const p=toImage(v,sx,sy),x=Math.floor(p.x),y=Math.floor(p.y);
 return x>=0&&y>=0&&x<w&&y<h?{x,y}:null;
}
/** Zoom to `scale` keeping the image point under (ax, ay) fixed on screen. The origin is rounded,
 * so the anchored point may drift by < 1 device pixel — never by a whole image pixel. */
export function zoomAt(v,scale,ax,ay){
 if(!isValidZoom(scale))scale=floorZoom(scale);
 const ix=(ax-v.x)/v.scale,iy=(ay-v.y)/v.scale;
 return {scale,x:Math.round(ax-ix*scale),y:Math.round(ay-iy*scale)};
}
export const panBy=(v,dx,dy)=>({...v,x:Math.round(v.x+dx),y:Math.round(v.y+dy)});
/** Largest allowed zoom showing the whole image inside (vw − 2·pad) × (vh − 2·pad), capped at `max`. */
export function fitZoom(iw,ih,vw,vh,{pad=0,max=MAX_ZOOM}={}){
 const aw=Math.max(1,vw-2*pad),ah=Math.max(1,vh-2*pad);
 return Math.min(floorZoom(max),floorZoom(Math.min(aw/iw,ah/ih)));
}
export function centered(iw,ih,vw,vh,scale){return {scale,x:Math.round((vw-iw*scale)/2),y:Math.round((vh-ih*scale)/2)};}
export const fitView=(iw,ih,vw,vh,opt)=>centered(iw,ih,vw,vh,fitZoom(iw,ih,vw,vh,opt));
/** Keep at least `keep` device px of the image on screen, so a fling can't lose it. */
export function clampView(v,iw,ih,vw,vh,keep=48){
 const w=iw*v.scale,h=ih*v.scale,kx=Math.min(keep,w),ky=Math.min(keep,h);
 return {...v,x:Math.round(Math.min(vw-kx,Math.max(kx-w,v.x))),y:Math.round(Math.min(vh-ky,Math.max(ky-h,v.y)))};
}
/** Image-space rectangle visible in a vw × vh viewport, clipped to the image, in whole pixels. */
export function visibleRect(v,vw,vh,iw=Infinity,ih=Infinity){
 const a=toImage(v,0,0),b=toImage(v,vw,vh);
 const x0=Math.max(0,Math.floor(a.x)),y0=Math.max(0,Math.floor(a.y)),x1=Math.min(iw,Math.ceil(b.x)),y1=Math.min(ih,Math.ceil(b.y));
 return {x:x0,y:y0,w:Math.max(0,x1-x0),h:Math.max(0,y1-y0)};
}
/** Snap an image-space point: 'pixel' → nearest pixel edge (for corners), 'center' → pixel centre, 'floor' → pixel containing it. */
export function snapPoint(p,mode='pixel'){
 if(mode==='none')return {x:p.x,y:p.y};
 if(mode==='floor')return {x:Math.floor(p.x),y:Math.floor(p.y)};
 if(mode==='center')return {x:Math.floor(p.x)+.5,y:Math.floor(p.y)+.5};
 return {x:Math.round(p.x),y:Math.round(p.y)};
}
/** Opacity of the automatic pixel grid: hidden below 8 device px per pixel, fading in up to 16. */
export const PIXEL_GRID_MIN=8;
export function pixelGridAlpha(scale){return scale<PIXEL_GRID_MIN?0:Math.min(1,.45+(scale-PIXEL_GRID_MIN)/16);}
/** Custom grid spec {w, h, ox, oy, sx, sy}: cell size, offset of the first cell, spacing between cells. */
export function normalizeGrid(g={}){
 const n=(v,min,def)=>{v=Math.round(Number(v));return Number.isFinite(v)?Math.max(min,v):def;};
 return {w:n(g.w,1,16),h:n(g.h,1,16),ox:n(g.ox,0,0),oy:n(g.oy,0,0),sx:n(g.sx,0,0),sy:n(g.sy,0,0)};
}
/** Columns/rows of a custom grid touching an image-space rect; empty ranges when none. */
export function gridRange(g,rect){
 const px=g.w+g.sx,py=g.h+g.sy;
 const c0=Math.max(0,Math.floor((rect.x-g.ox)/px)),r0=Math.max(0,Math.floor((rect.y-g.oy)/py));
 const c1=Math.floor((rect.x+rect.w-g.ox-1)/px),r1=Math.floor((rect.y+rect.h-g.oy-1)/py);
 return {c0,c1,r0,r1,count:Math.max(0,c1-c0+1)*Math.max(0,r1-r0+1)};
}
export const gridCell=(g,c,r)=>({x:g.ox+c*(g.w+g.sx),y:g.oy+r*(g.h+g.sy),w:g.w,h:g.h});
/** Whole cells of a custom grid that fit in a w × h image (what "Apply grid" would cut). */
export function gridCellsIn(g,w,h){
 const cols=Math.max(0,Math.floor((w-g.ox+g.sx)/(g.w+g.sx))),rows=Math.max(0,Math.floor((h-g.oy+g.sy)/(g.h+g.sy)));
 return {cols,rows,count:cols*rows};
}
/** Ruler tick spacing in image px: the smallest 1-2-5 step whose ticks are ≥ minPx device px apart. */
export function rulerStep(scale,minPx=48){
 for(let m=1;;m*=10)for(const k of [1,2,5]){const s=k*m;if(s*scale>=minPx)return s;}
}
/** Accumulates wheel deltas into whole zoom steps, so a trackpad pinch (dozens of tiny ctrl+wheel
 * events) moves one level per `threshold` of travel instead of racing to 12 800 %. */
export function wheelSteps(acc,delta,threshold=60){
 const total=acc+delta,steps=Math.trunc(total/threshold);
 return {steps,rest:total-steps*threshold};
}
/** Mouse wheel vs trackpad scroll, from one WheelEvent's numbers. Line/page mode, or a pure
 * vertical delta that is a whole multiple of a notch, is a mouse wheel; fractional or 2-axis
 * deltas are a trackpad (which pans). Heuristic, so the user can force either in View settings. */
export function looksLikeMouseWheel({deltaMode=0,deltaX=0,deltaY=0}){
 if(deltaMode!==0)return true;
 if(deltaX!==0||!Number.isInteger(deltaY))return false;
 return Math.abs(deltaY)>=50;// one notch is 100–125 CSS px in Chromium, 3 lines in Firefox
}
