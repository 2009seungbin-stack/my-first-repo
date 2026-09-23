// Compares real Aseprite's view of each file (dump.lua) with (a) our reader's view of the same
// file and (b) Aseprite's view of our writer's re-encoding. Prints per-file differences.
import {readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const M=await import('../../src/game/aseprite.js');
const [corpus,dumps,report]=process.argv.slice(2);
const BLEND={NORMAL:0,SRC_OVER:0,MULTIPLY:1,SCREEN:2,OVERLAY:3,DARKEN:4,LIGHTEN:5,COLOR_DODGE:6,COLOR_BURN:7,HARD_LIGHT:8,SOFT_LIGHT:9,DIFFERENCE:10,EXCLUSION:11,HSL_HUE:12,HSL_SATURATION:13,HSL_COLOR:14,HSL_LUMINOSITY:15,HUE:12,SATURATION:13,COLOR:14,LUMINOSITY:15,ADDITION:16,SUBTRACT:17,DIVIDE:18};
const normProps=p=>{if(Array.isArray(p)&&!p.length)return {};return JSON.parse(JSON.stringify(p,(k,v)=>typeof v==='bigint'?Number(v):v));};
const col=c=>c?[c.r,c.g,c.b,c.a]:null;
const hexcol=h=>h?[1,3,5,7].map(i=>parseInt(h.slice(i,i+2),16)):null;
function normAse(d){
 const linkOf=new Map();
 const cels=d.cels.map(c=>{const k=`${c.layer}|${c.imageId}`;if(!linkOf.has(k))linkOf.set(k,c.frame);return {layer:c.layer,frame:c.frame,x:c.x,y:c.y,w:c.w,h:c.h,opacity:c.opacity,z:c.z,data:c.data||'',link:linkOf.get(k)};}).sort((a,b)=>a.layer<b.layer?-1:a.layer>b.layer?1:a.frame-b.frame);
 return {width:d.width,height:d.height,colorMode:d.colorMode,transparentColor:d.transparentColor,paletteSize:d.colorMode===2?d.paletteSize:null,frames:d.frames,data:d.data||'',props:normProps(d.props),
  layers:d.layers.map(l=>({name:l.name,group:l.group,tilemap:l.tilemap,visible:l.visible,background:l.background,opacity:l.group?null:l.opacity,blend:l.group?null:BLEND[l.blend],parent:l.parent,data:l.data||'',props:normProps(l.props)})),
  tags:d.tags.map(t=>({name:t.name,from:t.from,to:t.to,dir:t.dir,repeats:t.repeats,data:t.data||'',color:col(t.color),props:normProps(t.props)})).sort((a,b)=>a.name<b.name?-1:1),
  slices:d.slices.map(s=>({name:s.name,bounds:s.bounds,center:s.center??null,pivot:s.pivot??null,data:s.data||'',props:normProps(s.props)})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0),
  tilesets:(d.tilesets||[]).map(t=>({name:t.name,n:t.n,grid:t.grid,tiles:(t.tiles||[]).map(x=>({data:x.data||'',props:normProps(x.props)})),data:t.data||'',props:normProps(t.props)})),cels};
}
function mine(doc){
 const L=doc.layers.filter(l=>l.type!=='unknown');
 const ud=u=>u?.text||'',pp=u=>normProps(M.plainProperties(u)['']??{});
 const cels=[];
 for(const f of doc.frames)for(const c of f.cels){if(!c)continue;const l=doc.layers[c.layer];cels.push({layer:l.name,frame:f.index,x:c.x,y:c.y,w:c.width,h:c.height,opacity:c.opacity,z:c.zIndex,data:ud(c.data.userData),link:c.linkedFrame??c.frame});}
 cels.sort((a,b)=>a.layer<b.layer?-1:a.layer>b.layer?1:a.frame-b.frame);
 const key0=s=>{let k=null;for(const x of s.keys)if(x.frame<=0&&(!k||x.frame>=k.frame))k=x;return k;};
 return {width:doc.width,height:doc.height,colorMode:{rgba:0,grayscale:1,indexed:2}[doc.colorMode],transparentColor:doc.transparentIndex,paletteSize:doc.colorMode==='indexed'?doc.palettes[0].colors.length/4:null,frames:doc.frames.map(f=>f.duration),data:ud(doc.userData),props:pp(doc.userData),
  layers:L.map(l=>({name:l.name,group:l.type==='group',tilemap:l.type==='tilemap',visible:l.visible,background:l.background,opacity:l.type==='group'?null:l.opacity,blend:l.type==='group'?null:l.blendMode,parent:l.parent,data:ud(l.userData),props:pp(l.userData)})),
  tags:doc.tags.map(t=>({name:t.name,from:t.from,to:t.to,dir:t.directionId,repeats:t.repeat,data:ud(t.userData),color:hexcol(t.userData?.color??t.color),props:pp(t.userData)})).sort((a,b)=>a.name<b.name?-1:1),
  slices:doc.slices.map(s=>{const k=key0(s);return {name:s.name,bounds:k?{x:k.x,y:k.y,w:k.w,h:k.h}:null,center:k?.center??null,pivot:k?.pivot??null,data:ud(s.userData),props:pp(s.userData)};}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0),
  tilesets:doc.tilesets.map(t=>({name:t.name,n:t.numTiles,grid:{w:t.tileWidth,h:t.tileHeight},tiles:Array.from({length:Math.max(0,t.numTiles-1)},(_,i)=>({data:ud(t.tileUserData[i+1]),props:pp(t.tileUserData[i+1])})),data:ud(t.userData),props:pp(t.userData)})),cels};
}
function diff(a,b,path='',out=[]){
 if(out.length>6)return out;
 if(a===b)return out;
 if(typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<1e-6)return out;
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);
  for(const k of keys)diff(a[k],b[k],path+'.'+k,out);return out;
 }
 out.push(`${path}: ${JSON.stringify(a)?.slice(0,80)} != ${JSON.stringify(b)?.slice(0,80)}`);return out;
}
const rows=[];
const walk=d=>{for(const n of readdirSync(d,{withFileTypes:true})){const p=join(d,n.name);if(n.isDirectory())walk(p);else if(/\.(ase|aseprite)$/i.test(n.name))files.push(p);}};const files=[];walk(corpus);
for(const f of files){
 const rel=f.slice(corpus.length+1),key=rel.replace(/[\\/]/g,'__');
 const oa=join(dumps,key+'.orig.json'),ob=join(dumps,key+'.rt.json');
 const row={file:rel.replace(/\\/g,'/')};
 if(!existsSync(oa)){row.reader='NO-ASEPRITE-DUMP';rows.push(row);continue;}
 const A=normAse(JSON.parse(readFileSync(oa,'utf8')));
 const me=mine(M.readAseprite(readFileSync(f)));
 const dr=diff(A,me);row.reader=dr.length?'DIFF':'SAME';if(dr.length)row.readerDiff=dr;
 if(existsSync(ob)){
  const B=normAse(JSON.parse(readFileSync(ob,'utf8')));
  // Writer links identical cels on purpose: compare links only where the original had them.
  const A2=structuredClone(A);A2.cels.forEach((c,i)=>{if(B.cels[i]&&c.link!==B.cels[i].link)c.link=B.cels[i].link;});
  const dw=diff(A2,B);row.writer=dw.length?'DIFF':'SAME';if(dw.length)row.writerDiff=dw;
  row.newLinks=B.cels.filter((c,i)=>A.cels[i]&&A.cels[i].link===A.cels[i].frame&&c.link!==c.frame).length;
 }else row.writer='NO-RT-DUMP';
 rows.push(row);
}
writeFileSync(report,JSON.stringify(rows,null,1));
const count=k=>rows.reduce((m,r)=>(m[r[k]]=(m[r[k]]||0)+1,m),{});
console.log('reader',count('reader'),'writer',count('writer'),'cels linked by writer dedupe',rows.reduce((n,r)=>n+(r.newLinks||0),0));
for(const r of rows)if(r.reader==='DIFF'||r.writer==='DIFF')console.log(r.file,'\n  R',(r.readerDiff||[]).join(' ; '),'\n  W',(r.writerDiff||[]).join(' ; '));

