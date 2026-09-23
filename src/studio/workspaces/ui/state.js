/** UI workspace document state (pure). Everything lives in doc.settings.ui, so the shared project
 * format needs no new asset kind: settings are kept as JSON by normalizeProject, autosaved and
 * written into .nerulio files. Font and translation FILES are attached blobs (settings.files, see
 * src/studio/core/project.js), referenced here by their SHA-256.
 *
 *   settings.ui = {
 *    elements: {id: {id, name, assetId, rect:{x,y,w,h}, nine:null|{border,padding,stretch,drawCenter},
 *                    origin:'image'|'detected'|'drawn'|'9png'|'aseprite'}}
 *    buttons:  {id: {id, name, states:{normal|hover|pressed|disabled|focus:
 *                    {element:id} | {from:'normal'|…, ops:{brightness,contrast,saturation,overlayColor,overlayAlpha,offsetX,offsetY,outline,outlineColor,alpha}}}}}
 *    fonts:    {id: FontDoc}   (see newFont())
 *    kit:      {name, previewSizes:[[w,h]…], scales:[…], engine}
 *   }
 * Every function returns a new state (or the same one when nothing changed). */
import {normalizeNine} from '../../../game/ui/nine-patch.js';
import {DEFAULT_FONT_SETTINGS} from '../../../game/ui/font/build.js';
export const EMPTY=Object.freeze({elements:{},buttons:{},fonts:{},kit:{}});
export const STATE_NAMES=Object.freeze(['normal','hover','pressed','disabled','focus']);
export const uiState=doc=>doc?.settings?.ui||EMPTY;
export function withUi(doc,fn){
 const cur=uiState(doc),next=fn(cur);
 return next===cur?doc:{...doc,settings:{...(doc.settings||{}),ui:next}};
}
export const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const nameOf=s=>String(s||'').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_.-]+/gu,'_').replace(/^_+|_+$/g,'')||'element';
/** A unique name among existing ones: panel, panel_2, … */
export function uniqueName(taken,base){const set=new Set(taken);let n=nameOf(base);if(!set.has(n))return n;let k=2;while(set.has(`${n}_${k}`))k++;return `${n}_${k}`;}
// ------------------------------------------------------------------ elements
export const elementsOf=s=>Object.values(s.elements||{});
export const elementsForAsset=(s,assetId)=>elementsOf(s).filter(e=>e.assetId===assetId);
export function newElement(s,{assetId,rect,name,nine=null,origin='image',id=uid('e')}){
 if(!(rect?.w>0&&rect?.h>0))throw Error('An element needs a size');
 return {id,name:uniqueName(elementsOf(s).map(e=>e.name),name),assetId,rect:{x:rect.x|0,y:rect.y|0,w:rect.w|0,h:rect.h|0},nine:nine?normalizeNine(nine,rect.w,rect.h):null,origin};
}
export const putElements=(s,list)=>list.length?{...s,elements:{...s.elements,...Object.fromEntries(list.map(e=>[e.id,e]))}}:s;
export function updateElement(s,id,fn){const e=s.elements?.[id];if(!e)return s;const n=fn(e);return n===e?s:{...s,elements:{...s.elements,[id]:n}};}
export function setNine(s,id,nine){return updateElement(s,id,e=>{const n=nine?normalizeNine(nine,e.rect.w,e.rect.h):null;return JSON.stringify(n)===JSON.stringify(e.nine)?e:{...e,nine:n};});}
export function renameElement(s,id,name){return updateElement(s,id,e=>{const n=uniqueName(elementsOf(s).filter(x=>x.id!==id).map(x=>x.name),name);return n===e.name?e:{...e,name:n};});}
/** Removing elements also clears the button states that pointed at them. */
export function removeElements(s,ids){
 const gone=new Set(ids);if(!elementsOf(s).some(e=>gone.has(e.id)))return s;
 const elements=Object.fromEntries(Object.entries(s.elements).filter(([k])=>!gone.has(k)));
 const buttons=Object.fromEntries(Object.entries(s.buttons||{}).map(([k,b])=>[k,{...b,states:Object.fromEntries(Object.entries(b.states).filter(([,st])=>!gone.has(st.element)))}]).filter(([,b])=>b.states.normal));
 return {...s,elements,buttons};
}
/** Elements of assets that no longer exist are dropped (an image was removed from the project). */
export function pruneForAssets(s,assetIds){
 const have=new Set(assetIds),dead=elementsOf(s).filter(e=>!have.has(e.assetId)).map(e=>e.id);
 let out=dead.length?removeElements(s,dead):s;
 const fonts=Object.entries(out.fonts||{}).filter(([,f])=>f.source.kind!=='grid'||have.has(f.source.assetId));
 if(fonts.length!==Object.keys(out.fonts||{}).length)out={...out,fonts:Object.fromEntries(fonts)};
 return out;
}
// ------------------------------------------------------------------ buttons (UI states)
export const DEFAULT_STATE_OPS=Object.freeze({
 hover:{brightness:.1,saturation:.08},pressed:{brightness:-.1,offsetY:1},disabled:{saturation:-1,alpha:.5},focus:{outline:2,outlineColor:'#3182f6'}});
export function newButton(s,{normal,name,generate=true,id=uid('b')}){
 const e=s.elements?.[normal];if(!e)throw Error('A button needs its normal-state element');
 const states={normal:{element:normal}};
 if(generate)for(const k of STATE_NAMES.slice(1))states[k]={from:'normal',ops:{...DEFAULT_STATE_OPS[k]}};
 return {id,name:uniqueName(Object.values(s.buttons||{}).map(b=>b.name),name||e.name),states};
}
export const putButton=(s,b)=>({...s,buttons:{...(s.buttons||{}),[b.id]:b}});
export function setButtonState(s,id,state,value){
 const b=s.buttons?.[id];if(!b)return s;
 if(state==='normal'&&!value?.element)throw Error('The normal state must be an element');
 const states={...b.states};if(value)states[state]=value;else delete states[state];
 return putButton(s,{...b,states});
}
export const removeButton=(s,id)=>{if(!s.buttons?.[id])return s;const buttons={...s.buttons};delete buttons[id];return {...s,buttons};};
/** Pairs images whose names say they are states of one button: button_hover, buttonLong_blue_pressed,
 * btn-disabled, ok_focus … → suggestions {base, states:{hover:elementId,…}}; applied only on request. */
const STATE_WORDS={hover:['hover','over','highlight','highlighted','hot'],pressed:['pressed','press','down','active','clicked'],disabled:['disabled','disable','inactive','grey','gray','off'],focus:['focus','focused','selected']};
export function suggestButtons(s){
 const els=elementsOf(s),byName=new Map(els.map(e=>[e.name.toLowerCase(),e])),out=[];
 const strip=n=>{for(const [st,words] of Object.entries(STATE_WORDS))for(const w of words){const m=new RegExp(`^(.+?)[_. -]?${w}$`,'i').exec(n);if(m)return {base:m[1].replace(/[_. -]+$/,''),state:st,word:w};}return null;};
 const groups=new Map();
 for(const e of els){const m=strip(e.name);if(!m)continue;const base=byName.get(m.base.toLowerCase())||byName.get((m.base+'_normal').toLowerCase())||byName.get((m.base+'_default').toLowerCase());if(!base)continue;
  let g=groups.get(base.id);if(!g)groups.set(base.id,g={normal:base.id,states:{}});g.states[m.state]=e.id;}
 for(const g of groups.values())if(!Object.values(s.buttons||{}).some(b=>b.states.normal?.element===g.normal))out.push(g);
 return out;
}
// ------------------------------------------------------------------ fonts
/** FontDoc: {id, name,
 *   source: {kind:'file', blob, fileName, family, coords:null|{wght:…}} |
 *           {kind:'grid', assetId, grid:{cellW,cellH,cols,rows,ox,oy,sx,sy}, chars, measure:'ink'|'fixed',
 *            baseline, lineHeight, spacing, spaceAdvance, keyColor:null|'#rrggbb', white:false},
 *   charset: {sources:[{id,kind:'preset',preset}|{id,kind:'text',text}|{id,kind:'file',blob,name,format,columns,locales}],
 *             exclude:'', strip:true, order:'frequency'},
 *   render: {mode,size,range,padding,spacing,pageWidth,pageHeight,sizeMode,kerning,threshold,alphaOnly},
 *   kerning: {"first,second": amount, …}   hand-made pairs (px) on top of (or replacing) the font's own
 *   overrides: {codepoint: {xadvance,xoffset,yoffset}}, exportName} */
export function newFont(s,{name,source,id=uid('f')}){
 const presets=source.kind==='grid'?[]:[{id:uid('c'),kind:'preset',preset:'ascii'}];
 return {id,name:uniqueName(Object.values(s.fonts||{}).map(f=>f.name),name||'font'),source,
  charset:{sources:presets,exclude:'',strip:true,order:'frequency'},
  render:{...DEFAULT_FONT_SETTINGS,mode:source.kind==='grid'?'bitmap':'bitmap',coords:undefined,file:undefined,order:undefined},
  kerning:{},overrides:{},exportName:uniqueName([],name||'font')};
}
export const putFont=(s,f)=>({...s,fonts:{...(s.fonts||{}),[f.id]:f}});
export function updateFont(s,id,fn){const f=s.fonts?.[id];if(!f)return s;const n=fn(f);return n===f?s:putFont(s,n);}
export const removeFont=(s,id)=>{if(!s.fonts?.[id])return s;const fonts={...s.fonts};delete fonts[id];return {...s,fonts};};
/** Every attached-file id the UI state still uses (fonts and translation files). */
export function usedFiles(s){
 const out=new Set();
 for(const f of Object.values(s.fonts||{})){if(f.source.kind==='file')out.add(f.source.blob);for(const c of f.charset.sources)if(c.kind==='file')out.add(c.blob);}
 return out;
}
export const kerningKey=(a,b)=>a+','+b;
export const kerningList=f=>Object.entries(f.kerning||{}).map(([k,amount])=>{const [first,second]=k.split(',').map(Number);return {first,second,amount};});
