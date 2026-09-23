/** Import decisions for the Sprite workspace. Pure: numbers and names in, plans out.
 *
 * Every automatic choice an import makes is a *decision*:
 *   {id, label, chosen, confidence:'high'|'medium'|'low', score?, reasons:[…], alternatives:[{id,label}]}
 * The Import panel shows each with its confidence and offers every alternative as one click; the
 * importer re-runs with that choice. Nothing is decided silently. */
import {naturalCompare} from '../../game/animation-names.js';
// ------------------------------------------------------------------ loose frame files
/** walk_01, walk-2, "attack 3", "attack (10)", hero_run_0, player_walk1, run/0003 → {base, index}.
 * A bare number takes its folder's name ("walk/0003.png" → walk). */
export function frameKey(path){
 const parts=String(path).replace(/\\/g,'/').split('/').filter(Boolean),file=parts.pop()||'',folder=parts.pop()||'';
 const stem=file.replace(/\.[a-z0-9]{1,5}$/i,'');
 const m=/^(.*?)[\s_.\-]*[([{]?\s*(\d+)\s*[)\]}]?$/.exec(stem);
 if(!m)return {base:stem,index:null,stem,folder};
 const base=m[1].replace(/[\s_.\-([{]+$/,'');
 return {base:base||folder||'frames',index:Number(m[2]),stem,folder};
}
/** Groups file paths into animations: frames sharing a base name, ordered by their number as a
 * number (walk_2 before walk_10), groups in first-appearance order.
 * @returns {groups:[{name, items:[position…]}], decision} */
export function groupFrameFiles(paths,{mode='auto'}={}){
 const keys=paths.map(frameKey),numbered=keys.filter(k=>k.index!=null).length;
 const byName=new Map();
 keys.forEach((k,position)=>{const id=(k.folder&&k.base===k.folder?k.folder:k.base).toLowerCase();if(!byName.has(id))byName.set(id,{name:k.base,items:[]});byName.get(id).items.push({position,index:k.index,stem:k.stem});});
 const groups=[...byName.values()].map(g=>({name:g.name,items:g.items.sort((a,b)=>a.index!=null&&b.index!=null?a.index-b.index||naturalCompare(a.stem,b.stem):naturalCompare(a.stem,b.stem)).map(i=>i.position)}));
 const all=[...paths.keys()].sort((a,b)=>naturalCompare(paths[a],paths[b]));
 const share=paths.length?numbered/paths.length:0;
 // one-frame "groups" everywhere mean the names are not a sequence: grouping by name would scatter them
 const singles=groups.filter(g=>g.items.length===1).length;
 const auto=groups.length>1&&singles<groups.length?'names':'single';
 const chosen=mode==='auto'?auto:mode;
 const confidence=chosen==='names'?(share>=.9&&singles===0?'high':share>=.6?'medium':'low'):(groups.length===1&&share>=.9?'high':'medium');
 const reasons=[`${numbered} of ${paths.length} file names end in a frame number`,`${groups.length} distinct name(s): ${groups.slice(0,6).map(g=>`${g.name} (${g.items.length})`).join(', ')}${groups.length>6?'…':''}`];
 const decision={id:'grouping',label:'animations',chosen,confidence,reasons,alternatives:['names','single','none'].filter(x=>x!==chosen)};
 const out=chosen==='names'?groups:chosen==='single'?[{name:commonName(paths),items:all}]:[];
 // frame order in the timeline: grouped animations one after another, else natural order
 const order=chosen==='names'?groups.flatMap(g=>g.items):all;
 return {groups:out,order,decision};
}
function commonName(paths){const k=paths.map(frameKey);const b=k[0]?.base||'animation';return k.every(x=>x.base===b)?b:'animation';}
/** Frames of different sizes on one canvas. Returns per-frame {x,y} and the decision. */
export function placeFrames(sizes,{mode='auto'}={}){
 const W=Math.max(1,...sizes.map(s=>s.w)),H=Math.max(1,...sizes.map(s=>s.h));
 const same=sizes.every(s=>s.w===W&&s.h===H);
 const chosen=same?'same':mode==='auto'?'bottom-center':mode;
 const at=s=>chosen==='top-left'||chosen==='same'?{x:0,y:0}:chosen==='center'?{x:Math.floor((W-s.w)/2),y:Math.floor((H-s.h)/2)}:{x:Math.floor((W-s.w)/2),y:H-s.h};
 return {width:W,height:H,offsets:sizes.map(at),decision:same?null:{id:'placement',label:'placement',chosen,confidence:'medium',
  reasons:[`frames range from ${Math.min(...sizes.map(s=>s.w))}×${Math.min(...sizes.map(s=>s.h))} to ${W}×${H}`,'feet usually stay on the bottom edge, so frames are bottom-centred'],
  alternatives:['bottom-center','center','top-left'].filter(x=>x!==chosen)}};
}
// ------------------------------------------------------------------ sheets
const pct=v=>Math.round((v||0)*100);
export const gridLabel=g=>`${g.cellWidth}×${g.cellHeight}${g.marginX||g.marginY?` m${g.marginX===g.marginY?g.marginX:g.marginX+','+g.marginY}`:''}${g.spacingX||g.spacingY?` s${g.spacingX===g.spacingY?g.spacingX:g.spacingX+','+g.spacingY}`:''}`;
export const gridSpec=g=>({w:g.cellWidth,h:g.cellHeight,ox:g.marginX,oy:g.marginY,sx:g.spacingX,sy:g.spacingY});
/** Cells of a grid in reading order with row/col. */
export function gridCellsOf(g,width,height){
 const px=g.w+g.sx,py=g.h+g.sy,cols=Math.max(0,Math.floor((width-g.ox+g.sx)/px)),rows=Math.max(0,Math.floor((height-g.oy+g.sy)/py)),out=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)out.push({x:g.ox+c*px,y:g.oy+r*py,w:g.w,h:g.h,row:r,col:c});
 return out;
}
/** How a sheet becomes frames. `analysis` = what the worker measured:
 *   {key:{color,confidence,score,reasons,applied}|null, grids:[suggestion…], cells:{[gridIndex]:[{…,empty}]},
 *    auto:{rects:[{x,y,w,h,row}], reason, reasonCode, unassigned, attached}|null}
 * `choice` overrides {slice:'grid:0'|'grid:1'|…|'auto'|'custom', grid?:{w,h,ox,oy,sx,sy}, animations:'rows'|'single'|'none'}.
 * @returns {rects:[{x,y,w,h,row,col}], tags:[{name, positions:[…]}], grid, decisions} */
export function sheetPlan(analysis,choice={}){
 const decisions=[],grids=analysis.grids||[];
 // --- key colour
 const k=analysis.key;
 if(k)decisions.push({id:'key',label:'key',chosen:k.applied?k.hex:'none',confidence:k.confidence,score:k.score,reasons:k.reasons||[],
  alternatives:k.applied?['none']:[k.hex]});
 // --- slicing
 const top=grids[0],auto=analysis.auto;
 let slice=choice.slice;
 if(!slice||slice==='auto'&&!auto){
  const gridOk=top&&top.confidence!=='low';
  slice=gridOk?'grid:0':auto&&auto.rects.length?'auto':top?'grid:0':'none';
 }
 let rects=[],grid=null,sliceDecision;
 if(slice.startsWith('grid:')||slice==='custom'){
  const gi=slice==='custom'?-1:Number(slice.slice(5)),g=slice==='custom'?choice.grid:gridSpec(grids[gi]);
  grid=g;
  const cells=gi>=0&&analysis.cells?.[gi]?analysis.cells[gi]:gi<0&&choice.cells?choice.cells:null;
  const all=cells||gridCellsOf(g,analysis.width,analysis.height).map(c=>({...c,empty:false}));
  rects=all.filter(c=>!c.empty).map(({x,y,w,h,row,col})=>({x,y,w,h,row,col}));
  const s=gi>=0?grids[gi]:null,filled=rects.length,empty=all.length-filled;
  sliceDecision={id:'slice',label:'slice',chosen:slice,value:s?gridLabel(s):`${g.w}×${g.h}`,confidence:s?s.confidence:'high',score:s?.score,
   reasons:s?[...(s.reasons||[]).slice(0,4),`${filled} of ${all.length} cells hold pixels${empty?`; ${empty} empty cells skipped`:''}`]:['typed by you'],
   alternatives:[...grids.map((x,i)=>'grid:'+i).filter(x=>x!==slice),...(auto&&auto.rects.length?['auto']:[]),'custom']};
  if(auto&&analysis.hint?.recommend===false&&analysis.hint?.spanning)sliceDecision.reasons.push(`islands found ${auto.rects.length} frames`);
 }else if(slice==='auto'){
  rects=auto.rects.map(r=>({x:r.x,y:r.y,w:r.w,h:r.h,row:r.row??0,col:0}));
  const rowCounts=new Map();for(const r of rects){r.col=rowCounts.get(r.row)||0;rowCounts.set(r.row,r.col+1);}
  const conf=auto.reasonCode==='uniform'?'high':auto.reasonCode==='merged'?'medium':'low';
  sliceDecision={id:'slice',label:'slice',chosen:'auto',value:`${rects.length} islands`,confidence:top&&top.confidence==='high'?'low':conf,
   reasons:[auto.reason||'',...(auto.attached?[`${auto.attached} small pieces (sparks, effects) joined to the nearest frame`]:[]),...(auto.unassigned?[`${auto.unassigned} small pieces could not be placed and are shown in red`]:[])].filter(Boolean),
   alternatives:grids.map((_,i)=>'grid:'+i).concat('custom')};
 }else sliceDecision={id:'slice',label:'slice',chosen:'none',confidence:'low',reasons:['no grid or islands were found'],alternatives:['custom']};
 decisions.push(sliceDecision);
 // --- animations
 const rows=[...new Set(rects.map(r=>r.row))].sort((a,b)=>a-b);
 const counts=rows.map(r=>rects.filter(x=>x.row===r).length);
 const auto2=rows.length>1?'rows':'single';
 const anim=choice.animations||auto2;
 const varying=new Set(counts).size>1;
 const conf=anim==='rows'?(varying&&counts.every(c=>c>=2)?'high':counts.every(c=>c>=2)?'medium':'low'):anim==='single'?(rows.length<=1?'high':'medium'):'high';
 decisions.push({id:'animations',label:'animations',chosen:anim,confidence:rects.length?conf:'low',
  reasons:[`${rows.length} row(s) of frames: ${counts.slice(0,12).join(', ')}${counts.length>12?'…':''} frames per row`,...(varying?['rows hold different frame counts, as a sheet with one animation per row does']:[])],
  alternatives:['rows','single','none'].filter(x=>x!==anim)});
 let tags=[];
 const order=rects.map((_,i)=>i);
 if(anim==='rows')tags=rows.map((r,i)=>({name:`row_${i+1}`,positions:order.filter(j=>rects[j].row===r)}));
 else if(anim==='single'&&rects.length)tags=[{name:'animation',positions:order}];
 // --- timing: a PNG carries none
 decisions.push({id:'timing',label:'timing',chosen:String(choice.duration||100),confidence:'low',reasons:['a sheet image stores no frame timing; 100 ms per frame (10 fps) is Aseprite\'s default'],alternatives:['83','67','50','125','150'].filter(x=>x!==String(choice.duration||100))});
 return {rects,tags,grid,decisions,duration:choice.duration||100};
}
/** Which way a GIF/APNG's delays go: as the browser plays them, or the raw file values. */
export function delayDecision(frames,{mode='browser'}={}){
 const fast=frames.filter(f=>f.rawDelay<=10).length;
 if(!fast)return null;
 return {id:'delays',label:'delays',chosen:mode,confidence:'high',reasons:[`${fast} frame(s) have a delay of ${frames.find(f=>f.rawDelay<=10).rawDelay} ms; browsers play those as 100 ms`],alternatives:[mode==='browser'?'raw':'browser']};
}
export const confidenceRank=c=>({high:3,medium:2,low:1}[c]||0);
export {pct};
