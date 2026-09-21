/** Shared game-asset model. Pure data + pure functions: no DOM, no pixels, no application state.
 * Every Lab keeps its frames/animations in these shapes and BOTH its preview and its exporters
 * read only from them, so what is previewed is what is exported by construction.
 *
 * AssetFrame  {id, name, sourceRect, trimmedRect, canvasWidth, canvasHeight, offsetX, offsetY,
 *              pivotX, pivotY, duration, tag, boxes[], collision[], metadata}
 *   sourceRect   where the frame was cut from its sheet, in sheet pixels
 *   trimmedRect  the opaque part inside sourceRect (sheet pixels), or null when untrimmed
 *   canvas*      the frame's own canvas; offset* is where the (trimmed) pixels sit on it
 *   pivot*       normalised 0..1 on the frame canvas (pixel value = pivot × canvas size)
 *   duration     milliseconds, or null to use the animation's fps
 *   boxes        [{id,type,shape:'rect'|'circle'|'polygon', …}] in frame-canvas pixels
 *   collision    polygons [[x,y],…] in frame-canvas pixels
 * Animation   {id, name, frameIds, fps, direction:'forward'|'reverse'|'pingpong', loop}
 * Atlas       {width, height, padding, extrude, pages, frames:{[frameId]:{page,x,y,w,h,rotated,aliasOf}}} */
export const SCHEMA_VERSION=1;
export const DIRECTIONS=Object.freeze(['forward','reverse','pingpong']);
export const BOX_TYPES=Object.freeze(['hit','hurt','interact']);
export const PIVOT_PRESETS=Object.freeze({center:[.5,.5],'bottom-center':[.5,1],'top-left':[0,0],'top-center':[.5,0],'bottom-left':[0,1]});
const int=(v,name)=>{if(!Number.isSafeInteger(v))throw Error(`${name} must be an integer`);return v;};
const rect=(r,name)=>{if(!r||int(r.x,name+'.x')<0||int(r.y,name+'.y')<0||int(r.w,name+'.w')<1||int(r.h,name+'.h')<1)throw Error(`${name} is not a valid rectangle`);return {x:r.x,y:r.y,w:r.w,h:r.h};};
const unit=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(`${name} must be a number`);return v;};
let seq=0;
export const newId=prefix=>`${prefix}${(++seq).toString(36)}`;
/** Normalises a partial frame; throws on values an exporter could not represent faithfully. */
export function frame(p={}){
 const sourceRect=rect(p.sourceRect,'sourceRect'),trimmedRect=p.trimmedRect?rect(p.trimmedRect,'trimmedRect'):null,inner=trimmedRect||sourceRect;
 if(trimmedRect&&(trimmedRect.x<sourceRect.x||trimmedRect.y<sourceRect.y||trimmedRect.x+trimmedRect.w>sourceRect.x+sourceRect.w||trimmedRect.y+trimmedRect.h>sourceRect.y+sourceRect.h))throw Error('trimmedRect must lie inside sourceRect');
 const canvasWidth=int(p.canvasWidth??sourceRect.w,'canvasWidth'),canvasHeight=int(p.canvasHeight??sourceRect.h,'canvasHeight');
 const offsetX=int(p.offsetX??(trimmedRect?trimmedRect.x-sourceRect.x:0),'offsetX'),offsetY=int(p.offsetY??(trimmedRect?trimmedRect.y-sourceRect.y:0),'offsetY');
 if(canvasWidth<1||canvasHeight<1||offsetX<0||offsetY<0||offsetX+inner.w>canvasWidth||offsetY+inner.h>canvasHeight)throw Error('Frame pixels do not fit its canvas');
 if(p.duration!=null&&!(Number.isFinite(p.duration)&&p.duration>0))throw Error('duration must be positive milliseconds or null');
 return {id:p.id||newId('f'),name:String(p.name??''),sourceRect,trimmedRect,canvasWidth,canvasHeight,offsetX,offsetY,pivotX:unit(p.pivotX??.5,'pivotX'),pivotY:unit(p.pivotY??1,'pivotY'),duration:p.duration??null,tag:String(p.tag??''),
  boxes:(p.boxes||[]).map(box),collision:(p.collision||[]).map(polygon),metadata:{...(p.metadata||{})}};
}
export function box(b){
 const base={id:b.id||newId('b'),type:String(b.type||'hit'),shape:b.shape};
 if(b.shape==='rect')return {...base,x:unit(b.x,'box.x'),y:unit(b.y,'box.y'),w:unit(b.w,'box.w'),h:unit(b.h,'box.h')};
 if(b.shape==='circle')return {...base,cx:unit(b.cx,'box.cx'),cy:unit(b.cy,'box.cy'),r:unit(b.r,'box.r')};
 if(b.shape==='polygon')return {...base,points:polygon(b.points)};
 throw Error('Unknown box shape');
}
export function polygon(points){
 if(!Array.isArray(points)||points.length<3)throw Error('A polygon needs at least three points');
 return points.map(([x,y])=>[unit(x,'point.x'),unit(y,'point.y')]);
}
export function animation(p={},frames=null){
 const fps=unit(p.fps??12,'fps');if(!(fps>0&&fps<=240))throw Error('fps must be between 0 and 240');
 if(!DIRECTIONS.includes(p.direction??'forward'))throw Error('Unknown animation direction');
 const frameIds=[...(p.frameIds||[])];
 if(frames){const known=new Set(frames.map(f=>f.id));for(const id of frameIds)if(!known.has(id))throw Error(`Animation references unknown frame ${id}`);}
 return {id:p.id||newId('a'),name:String(p.name||'animation'),frameIds,fps,direction:p.direction??'forward',loop:p.loop!==false};
}
/** The exact sequence one playback cycle shows. Preview and exporters both call this, so a
 * ping-pong never repeats its end frames in one place and not the other. */
export function playbackOrder(a){
 const ids=a.frameIds;if(ids.length<2||a.direction==='forward')return [...ids];
 if(a.direction==='reverse')return [...ids].reverse();
 return [...ids,...ids.slice(1,-1).reverse()];
}
/** Per-step durations in ms for one cycle, honouring per-frame overrides. */
export function playbackTimes(a,frames){
 const byId=new Map(frames.map(f=>[f.id,f])),base=1000/a.fps;
 return playbackOrder(a).map(id=>byId.get(id)?.duration??base);
}
export const pivotPixels=f=>({x:f.pivotX*f.canvasWidth,y:f.pivotY*f.canvasHeight});
export function setPivot(f,x,y,{pixels=false}={}){return {...f,pivotX:pixels?x/f.canvasWidth:x,pivotY:pixels?y/f.canvasHeight:y};}
/** Horizontal mirror of everything that carries an x coordinate. The pixels themselves are
 * flipped by the caller; this keeps pivot, hitboxes and collision consistent with them.
 * Polygons are reversed so their winding stays the same after the flip. */
export function mirrorFrame(f){
 const W=f.canvasWidth,inner=f.trimmedRect||f.sourceRect;
 return {...f,id:newId('f'),offsetX:W-f.offsetX-inner.w,pivotX:1-f.pivotX,metadata:{...f.metadata,mirroredFrom:f.id},
  boxes:f.boxes.map(b=>b.shape==='rect'?{...b,id:newId('b'),x:W-b.x-b.w}:b.shape==='circle'?{...b,id:newId('b'),cx:W-b.cx}:{...b,id:newId('b'),points:b.points.map(([x,y])=>[W-x,y]).reverse()}),
  collision:f.collision.map(p=>p.map(([x,y])=>[W-x,y]).reverse())};
}
/** Problems an exporter must not paper over. Returns human-readable strings; empty = valid. */
export function validateProject({frames=[],animations=[]}={}){
 const errors=[],ids=new Set();
 for(const f of frames){if(ids.has(f.id))errors.push(`Duplicate frame id ${f.id}`);ids.add(f.id);try{frame(f);}catch(e){errors.push(`${f.id}: ${e.message}`);}}
 const names=new Set();
 for(const a of animations){if(names.has(a.name))errors.push(`Duplicate animation name ${a.name}`);names.add(a.name);for(const id of a.frameIds)if(!ids.has(id))errors.push(`${a.name}: unknown frame ${id}`);if(!a.frameIds.length)errors.push(`${a.name}: no frames`);}
 return errors;
}
