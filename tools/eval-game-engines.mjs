#!/usr/bin/env node
/** Runs the game-asset engines over a corpus of real (CC0) game assets and prints what each one
 * detected next to the hand-recorded ground truth in tools/eval-game-engines.json.
 *
 *   node tools/eval-game-engines.mjs [corpus-dir] [--json out.json] [--only grid,auto,…]
 *
 * corpus-dir defaults to %USERPROFILE%/nerulio-asset-corpus/_adhoc/nerulio-trust-fixes. Build the
 * derived cases first with `python tools/eval-game-assets.py`. The engines are imported from
 * src/game exactly as the Labs import them; a feature an older engine lacks is reported as "—"
 * so the same script produces the before and after tables. */
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i>=0?args.splice(i,2)[1]:null;};
const jsonOut=flag('--json'),only=(flag('--only')||'').split(',').filter(Boolean);
const corpus=args[0]||join(homedir(),'nerulio-asset-corpus','_adhoc','nerulio-trust-fixes');
const truth=JSON.parse(await readFile(join(here,'eval-game-engines.json'),'utf8'));
const load=async p=>import(new URL('../src/game/'+p,import.meta.url));
const {decodePNG}=await load('texture-png.js');
const Grid=await load('grid-detect.js'),Frames=await load('frame-ops.js'),Tile=await load('tile-grid.js'),Check=await load('pixel-check.js');
const optional=async p=>{try{return await load(p);}catch{return {};}};
const Key=await optional('color-key.js'),Font=await optional('font-grid.js'),TexSet=await load('texture-set.js'),Normal=await load('texture-normal.js');
const Islands=await optional('islands.js');

const decoded=new Map();
async function image(file){
 if(!decoded.has(file)){
  const bytes=new Uint8Array(await readFile(join(corpus,file)));
  const png=await decodePNG(bytes);
  decoded.set(file,{data:new Uint8ClampedArray(png.data.buffer,png.data.byteOffset,png.data.byteLength),width:png.width,height:png.height});
 }
 return decoded.get(file);
}
const same=(a,b)=>a&&b&&a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];
const near=(a,b,t=6)=>a&&b&&Math.abs(a[0]-b[0])<=t&&Math.abs(a[1]-b[1])<=t&&Math.abs(a[2]-b[2])<=t;
const hex=c=>c?'#'+c.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join(''):'none';
const ms=t=>`${Math.round(t)}ms`;
const rows={},score={};
const record=(section,row,ok)=>{(rows[section]||=[]).push(row);const s=score[section]||={ok:0,n:0};s.n++;if(ok)s.ok++;};
/** What the Sprite/Tile Lab would read: the sheet with its colour key applied when the engine
 * offers key detection and it is confident enough to apply by itself. */
function keyed(img){
 if(!Key.detectColorKey)return {src:img,key:null,note:'no key detection'};
 const k=Key.detectColorKey(img);
 if(!k||!k.apply)return {src:img,key:k,note:k?`${hex(k.color)} ${k.confidence} (not applied)`:'none'};
 return {src:Key.applyColorKey(img,k.color,{tolerance:k.tolerance}),key:k,note:`${hex(k.color)} ${k.confidence}`};
}
const want=s=>!only.length||only.includes(s);

for(const [suffix,list] of [['',truth.grid],['-holdout',truth.holdout||[]]])if(want('grid'))for(const c of list){
 const img=await image(c.file),{src,key,note}=keyed(img);
 const keyOk=c.key?!!key?.apply&&near(key.color,c.key):!key?.apply;
 if(c.labs.includes('sprite')){
  const t0=performance.now(),out=(Grid.detectGridWithColour||Grid.detectGrid)(src,{limit:5}),top=out.suggestions[0],dt=performance.now()-t0;
  const ok=!!top&&top.cellWidth===c.cell[0]&&top.cellHeight===c.cell[1]&&top.spacingX===c.spacing&&top.spacingY===c.spacing&&top.marginX===c.margin&&top.marginY===c.margin;
  record('sprite-grid'+suffix,{file:c.file,synthetic:!!c.synthetic,truth:`${c.cell.join('×')} m${c.margin} s${c.spacing}${c.key?' key '+hex(c.key):''}`,
   got:top?`${top.cellWidth}×${top.cellHeight} m${top.marginX}/${top.marginY} s${top.spacingX}/${top.spacingY}`:'none',confidence:top?`${top.confidence} ${Math.round(top.score*100)}%`:'—',
   key:note,keyOk,ok:ok&&keyOk,time:ms(dt)},ok&&keyOk);
 }
 if(c.labs.includes('tile')){
  const t0=performance.now(),cands=Tile.detectGrid(src.data,src.width,src.height),top=cands[0],dt=performance.now()-t0;
  // Before this branch the Lab applied the top candidate unconditionally.
  const applied=Tile.suggestedGrid?Tile.suggestedGrid(cands):top;
  const ok=!!top&&top.tileWidth===c.cell[0]&&top.tileHeight===c.cell[1]&&top.spacingX===c.spacing&&top.spacingY===c.spacing&&top.marginX===c.margin&&top.marginY===c.margin;
  // Trust: a wrong top guess is only harmless when the Lab does not apply it by itself.
  const safe=ok||!applied;
  record('tile-grid'+suffix,{file:c.file,synthetic:!!c.synthetic,truth:`${c.cell.join('×')} m${c.margin} s${c.spacing}`,
   got:top?`${top.tileWidth}×${top.tileHeight} m${top.marginX}/${top.marginY} s${top.spacingX}/${top.spacingY}`:'none',
   confidence:top?`${top.confidence??''} ${Math.round(top.score*100)}%`:'—',autoApplied:applied?(applied.confirm?'ask':'yes'):'no',ok,safe,time:ms(dt)},ok);
  const trust='tile-grid-trust'+suffix;(score[trust]||={ok:0,n:0}).n++;if(safe)score[trust].ok++;
 }
}

if(want('auto'))for(const c of truth.auto){
 const img=await image(c.file),{src,note}=keyed(img);
 let got='',ok=false,lost=null,dt=0,extra='';
 try{
  const t0=performance.now();
  const found=Frames.detectFrames(src,{minArea:16,distance:'auto'});
  dt=performance.now()-t0;
  got=String(found.rects.length);
  // Every opaque pixel must be inside a frame or listed as unassigned.
  let inFrames=0,total=0;
  const {data,width,height}=src;
  const cover=new Uint8Array(width*height);
  for(const r of found.rects)for(let y=r.y;y<r.y+r.h;y++)cover.fill(1,y*width+r.x,y*width+r.x+r.w);
  for(let p=0;p<width*height;p++)if(data[p*4+3]>8){total++;if(cover[p])inFrames++;}
  const reported=found.unassigned?found.unassigned.reduce((s,u)=>s+u.area,0):0;
  lost=total-inFrames-reported;
  extra=found.unassigned?`${found.unassigned.length} unassigned / ${found.attached?.length??0} attached`:'';
  // Frames that touch cannot be separated by islands; the Lab then offers the grid it detected.
  const grid=(Grid.detectGridWithColour||Grid.detectGrid)(src,{limit:3}).suggestions[0];
  const hint=Frames.autoVersusGrid?Frames.autoVersusGrid(found.rects,grid):null;
  if(hint?.recommend)extra+=` · offers ${hint.cell.w}×${hint.cell.h} grid (${hint.gridFrames} frames)`;
  const count=hint?.recommend?hint.gridFrames:found.rects.length;
  ok=(c.frames==null||count===c.frames)&&lost===0;
 }catch(e){got='error: '+e.message.slice(0,60);}
 record('auto',{file:c.file,synthetic:!!c.synthetic,truth:c.frames??'any',got,key:note,silentlyLostPixels:lost,islands:extra,ok,time:ms(dt)},ok);
}

if(want('scale'))for(const c of truth.scale){
 const img=await image(c.file),t0=performance.now(),r=Check.inspect(img),dt=performance.now()-t0;
 const est=r.resample?.scale??(r.verdict==='integer'?r.scale.scale:r.verdict==='unit'?1:r.scale.estimate);
 const says=r.resample?`${r.resample.kind} ${est.toFixed(2)}× (${r.resample.confidence})`:`${r.verdict} ${r.verdict==='integer'?r.scale.scale+'×':r.verdict==='unit'?'1×':'≈'+r.scale.estimate+'×'}${r.blurred?' blurred':''}`;
 const scaleOk=Math.abs(est-c.scale)<=Math.max(.06,c.scale*.03);
 const kindOk=r.resample?(c.integer?r.resample.integer:!r.resample.integer)&&(!!r.resample.smoothed===c.smoothed||c.scale===1):
  (c.integer&&!c.smoothed?r.verdict==='integer'||c.scale===1&&r.verdict==='unit':false);
 record('scale',{file:c.file,synthetic:!!c.synthetic,truth:`${c.scale}× ${c.integer?'integer':'non-integer'}${c.smoothed?' smoothed':''}`,got:says,ok:scaleOk&&kindOk,time:ms(dt)},scaleOk&&kindOk);
}

for(const [suffix,list] of [['',truth.font],['-holdout',truth.fontHoldout||[]]])if(want('font'))for(const c of list){
 const img=await image(c.file),{src,note}=keyed(img);
 let got='—',ok=false;
 if(Font.detectFontGrid){
  const r=Font.detectFontGrid(src);
  got=r?`${r.cellW}×${r.cellH} ${r.cols}×${r.rows}=${r.cells} → ${r.preset} (${r.glyphs} glyphs, ${r.confidence})`:'none';
  ok=!!r&&r.cellW===c.cell[0]&&r.cellH===c.cell[1]&&r.cells===c.cells&&(c.first==null||r.first===c.first);
 }else got='default 8×8, no character order → 0 glyphs';
 record('font'+suffix,{file:c.file,synthetic:!!c.synthetic,truth:`${c.cell.join('×')} ${c.cells} cells${c.first==null?' (order unknown)':' from '+c.first}`,got,key:note,ok},ok);
}

if(want('texture'))for(const c of truth.texture){
 const dir=join(corpus,c.set),roles=[c.albedo,c.height,c.normal].map(n=>TexSet.classifyTextureName(n).role);
 const height=await image(join(c.set,c.height)),albedo=await image(join(c.set,c.albedo)),ref=await image(join(c.set,c.normal));
 const plane=img=>{const out=new Uint8Array(img.width*img.height);for(let p=0;p<out.length;p++){const i=p*4;out[p]=Math.round(img.data[i]*.2126+img.data[i+1]*.7152+img.data[i+2]*.0722);}return out;};
 const corr=gen=>{let sx=0,sy=0,sxx=0,syy=0,sxy=0,n=0;for(const ch of [0,1])for(let p=0;p<ref.width*ref.height;p+=7){const a=gen[p*4+ch],b=ref.data[p*4+ch];sx+=a;sy+=b;sxx+=a*a;syy+=b*b;sxy+=a*b;n++;}return (sxy-sx*sy/n)/Math.sqrt((sxx-sx*sx/n)*(syy-sy*sy/n));};
 const fromHeight=corr(Normal.heightToNormal(plane(height),height.width,height.height,{wrap:true}));
 const fromAlbedo=corr(Normal.heightToNormal(plane(albedo),albedo.width,albedo.height,{wrap:true}));
 const ok=roles[1]==='height'&&roles[0]==='albedo'&&roles[2]==='normal'&&fromHeight>fromAlbedo;
 record('texture',{set:c.set,roles:roles.join('/'),normalFromHeight:fromHeight.toFixed(3),normalFromAlbedo:fromAlbedo.toFixed(3),ok},ok);
 void dir;
}

const table=(list)=>{
 if(!list?.length)return '';
 const keys=Object.keys(list[0]);
 const cell=v=>String(v===true?'✓':v===false?'✗':v??'').replace(/\|/g,'/');
 return ['| '+keys.join(' | ')+' |','|'+keys.map(()=>'---').join('|')+'|',...list.map(r=>'| '+keys.map(k=>cell(r[k])).join(' | ')+' |')].join('\n');
};
for(const [section,list] of Object.entries(rows)){
 console.log(`\n## ${section}  ${score[section].ok}/${score[section].n} correct`);
 console.log(table(list));
}
console.log('\n## summary');
for(const [section,s] of Object.entries(score))console.log(`${section.padEnd(16)} ${s.ok}/${s.n}`);
if(jsonOut)await writeFile(jsonOut,JSON.stringify({corpus,rows,score},null,1));
if(!existsSync(corpus))console.error('corpus folder missing:',corpus);
