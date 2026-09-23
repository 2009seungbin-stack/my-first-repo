#!/usr/bin/env node
/** Builds a Studio "Pack & Export" bundle from corpus files with the SAME modules the Studio runs
 * (src/game/pack + src/game/export), without a browser. Used to iterate on engine verification;
 * the baseline itself drives the Studio UI (tools/engine-verify/baseline.py, lab "studio-pack").
 *
 *   node tools/engine-verify/studio_pack_bundle.mjs --target godot4 --out bundle.zip
 *        (--files a.png b.png … | --sheet sheet.png --grid 48x48[+mx,my][/sx,sy] [--rows-as-tags] [--key r,g,b])
 *        [--name hero] [--settings '{"allowRotation":true}'] [--tags '[{"name":"run","frames":[0,1,2],"fps":10}]']
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {basename} from 'node:path';
import {decodePNG} from '../../src/game/texture-png.js';
import {packAtlas} from '../../src/game/pack/packer.js';
import {buildBundle} from '../../src/game/export/bundle.js';
import {settingsFor,TARGETS} from '../../src/game/export/targets.js';
import {commonName} from '../../src/game/export/project-model.js';
import {zip} from '../../src/core.js';

const args=process.argv.slice(2),opt={files:[]};
for(let i=0;i<args.length;i++){const a=args[i];
 if(a==='--files'){while(args[i+1]&&!args[i+1].startsWith('--'))opt.files.push(args[++i]);}
 else if(a.startsWith('--'))opt[a.slice(2)]=args[i+1]&&!args[i+1].startsWith('--')?args[++i]:true;}
const target=opt.target||'json';if(!TARGETS[target])throw Error(`unknown target ${target}`);
const sources=new Map(),frames=[],model={name:opt.name||'sprite',frames:[],animations:[]};
const load=async p=>{const d=await decodePNG(readFileSync(p));return {width:d.width,height:d.height,data:d.data};};
if(opt.files.length){
 for(const [i,p] of opt.files.entries()){
  const img=await load(p),id=`f${i}`,name=basename(p).replace(/\.[^.]+$/,'');
  sources.set(id,img);
  frames.push({id,name,src:id,rect:{x:0,y:0,w:img.width,h:img.height},canvasW:img.width,canvasH:img.height,offX:0,offY:0,pivotX:.5,pivotY:1});
  model.frames.push({id,name,canvasW:img.width,canvasH:img.height,pivotX:.5,pivotY:1,duration:opt.ms?Number(opt.ms):null,boxes:[],collision:[]});
 }
}else if(opt.sheet){
 const img=await load(opt.sheet);sources.set('sheet',img);
 if(opt.key){const [r,g,b]=opt.key.split(',').map(Number);for(let i=0;i<img.data.length;i+=4)if(img.data[i]===r&&img.data[i+1]===g&&img.data[i+2]===b)img.data.set([0,0,0,0],i);}
 const m=/^(\d+)x(\d+)(?:\+(\d+),(\d+))?(?:\/(\d+),(\d+))?$/.exec(opt.grid);if(!m)throw Error('--grid WxH[+mx,my][/sx,sy]');
 const [cw,ch,mx=0,my=0,sx=0,sy=0]=m.slice(1).map(v=>v==null?0:Number(v));
 const cols=Math.floor((img.width-2*mx+sx)/(cw+sx)),rows=Math.floor((img.height-2*my+sy)/(ch+sy));
 const stem=basename(opt.sheet).replace(/\.[^.]+$/,'');
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const x=mx+c*(cw+sx),y=my+r*(ch+sy);let any=false;
  for(let yy=y;yy<y+ch&&!any;yy++)for(let xx=x;xx<x+cw;xx++)if(img.data[(yy*img.width+xx)*4+3]){any=true;break;}
  if(!any)continue;
  const id=`c${r}_${c}`,name=`${stem}_${frames.length}`;
  frames.push({id,name,src:'sheet',rect:{x,y,w:cw,h:ch},canvasW:cw,canvasH:ch,offX:0,offY:0,pivotX:.5,pivotY:1,row:r});
  model.frames.push({id,name,canvasW:cw,canvasH:ch,pivotX:.5,pivotY:1,duration:null,boxes:[],collision:[]});
 }
 if(opt['rows-as-tags']){const byRow=new Map();for(const f of frames){if(!byRow.has(f.row))byRow.set(f.row,[]);byRow.get(f.row).push(f.id);}
  for(const [r,ids] of byRow)model.animations.push({id:`row${r}`,name:`row${r}`,frameIds:ids,fps:Number(opt.fps||10),direction:'forward',loop:true});}
}else throw Error('--files or --sheet');
if(opt.tags)for(const t of JSON.parse(opt.tags))model.animations.push({id:t.name,name:t.name,frameIds:t.frames.map(i=>model.frames[i].id),fps:t.fps||12,direction:t.direction||'forward',loop:t.loop!==false});
if(opt.boxes)for(const b of JSON.parse(opt.boxes))model.frames[b.frame].boxes.push({id:b.id||`box${b.frame}`,type:b.type||'hit',shape:'rect',x:b.x,y:b.y,w:b.w,h:b.h});
if(opt.durations){const d=JSON.parse(opt.durations);model.frames.forEach((f,i)=>{if(d[i]!=null)f.duration=d[i];});}
if(!model.animations.length){const name=commonName(model.frames.map(f=>f.name));model.animations.push({id:'implicit',name,frameIds:model.frames.map(f=>f.id),fps:Number(opt.fps||12),direction:'forward',loop:true});model.implicitAnimation={name};}
const base={...TARGETS[target].preset,...(opt.settings?JSON.parse(opt.settings):{})};
const {settings,changed}=settingsFor(target,base);
const t0=Date.now();
const packed=packAtlas(frames,sources,settings);
const bundle=await buildBundle(target,model,packed,{base:opt.name||'sprite'});
const entries=bundle.files.map(f=>({name:`${bundle.root}/${f.name}`,blob:new Blob([f.bytes])}));
const out=await zip(entries,{paths:true});
writeFileSync(opt.out||`${target}.zip`,Buffer.from(await out.arrayBuffer()));
console.log(JSON.stringify({target,root:bundle.root,files:bundle.files.map(f=>f.name),notes:bundle.notes,changed,
 pages:packed.variants.map(v=>v.pages.map(p=>[p.width,p.height,+p.efficiency.toFixed(3)])),ms:Date.now()-t0}));
