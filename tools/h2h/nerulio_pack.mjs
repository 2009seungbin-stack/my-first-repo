// Packs the head-to-head frame sets with the Studio packer (the same modules the Pack & Export
// worker runs) and writes TexturePacker JSON hash + PNG per config, so atlas_verify.py judges both
// tools the same way.
//   node tools/h2h/nerulio_pack.mjs            (H2H_WORK as in tools/h2h/h2h_paths.py)
import {readFileSync,writeFileSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodePNG} from '../../src/game/texture-png.js';
import {packAtlas,publicResult} from '../../src/game/pack/packer.js';
import {renderPage} from '../../src/game/pack/sprites.js';
import {encodePNG} from '../../src/game/pack/png.js';
import {tpFrame,frameRows} from '../../src/game/export/common.js';

const REPO=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const WORK=process.env.H2H_WORK||join(REPO,'test-results','h2h-paid');
const PACK=join(WORK,'pack');
const SETS=['ninja','archer','samurai','toon','spaceshooter'];
const base={trimMode:'trim',shapePadding:2,borderPadding:0,extrude:0,maxWidth:4096,maxHeight:4096,dedupe:true};
export const CONFIGS={
 'rot1-best':{allowRotation:true,effort:'best'},
 'rot0-best':{allowRotation:false,effort:'best'},
 'rot1-normal':{allowRotation:true},
 'rot0-normal':{allowRotation:false},
 'rot1-square':{allowRotation:true,sizeMode:'square',effort:'best'},
 'rot0-pot':{allowRotation:false,sizeMode:'pot',effort:'best'},
};
const EXTRA={
 'ninja_dup3':['ninja_dup3',{allowRotation:false,effort:'best'}],
 'archer_x8':['archer_x8',{allowRotation:false,effort:'best',maxWidth:2048,maxHeight:2048}],
 'archer_x8-noalias':['archer_x8',{allowRotation:false,effort:'best',maxWidth:2048,maxHeight:2048,dedupe:false}],
};

async function load(dir){
 const files=readdirSync(dir).filter(f=>f.endsWith('.png')).sort(),sources=new Map(),frames=[];
 for(const f of files){const d=await decodePNG(readFileSync(join(dir,f)));sources.set(f,{width:d.width,height:d.height,data:d.data});
  frames.push({id:f,name:f.replace(/\.png$/,''),src:f,rect:{x:0,y:0,w:d.width,h:d.height},canvasW:d.width,canvasH:d.height,offX:0,offY:0});}
 return {frames,sources};
}

async function packOne(name,dir,outDir,settings){
 const t0=performance.now();
 const {frames,sources}=await load(dir);
 const t1=performance.now();
 const packed=packAtlas(frames,sources,{...base,...settings});
 const t2=performance.now();
 const v=publicResult(packed).variants[0];
 const model={name,frames:frames.map(f=>({id:f.id,name:f.name,canvasW:f.canvasW,canvasH:f.canvasH,pivotX:.5,pivotY:1,duration:100})),animations:[]};
 const rows=frameRows(model,v,{base:'sheet'});
 rmSync(outDir,{recursive:true,force:true});mkdirSync(outDir,{recursive:true});
 for(const pg of packed.variants[0].pages){
  const img=renderPage(pg,packed.variants[0].sprites);const file=`sheet-${pg.index}.png`;
  writeFileSync(join(outDir,file),await encodePNG(img));
  const fr=Object.fromEntries(rows.filter(r=>r.page===pg.index).map(r=>[r.frame.name,tpFrame(r)]));
  writeFileSync(join(outDir,`sheet-${pg.index}.json`),JSON.stringify({frames:fr,meta:{image:file,size:{w:pg.width,h:pg.height}}},null,1));
 }
 const t3=performance.now();
 return {ms_pack:Math.round(t2-t1),ms_total:Math.round(t3-t0),pages:v.pages.map(p=>[p.width,p.height]),area:v.pages.reduce((n,p)=>n+p.width*p.height,0),
  rotated:Object.values(v.frames).filter(e=>e.rotated).length,unique:v.stats.unique,frames:v.stats.frames,combo:v.pages[0].combo};
}

const runs=[];
for(const set of SETS)for(const [tag,s] of Object.entries(CONFIGS)){
 const r=await packOne(set,join(PACK,'sets',set),join(PACK,'nerulio',set,tag),s);
 runs.push({set,config:tag,settings:{...base,...s},...r});
 console.log(set,tag,r.pages.map(p=>p.join('x')).join('+'),`${r.ms_pack} ms pack, ${r.ms_total} ms total`);
}
for(const [name,[dir,s]] of Object.entries(EXTRA)){
 const r=await packOne(name,join(PACK,'sets_extra',dir),join(PACK,'nerulio','extra',name),s);
 runs.push({set:name,config:'extra',settings:{...base,...s},...r});
 console.log(name,r.frames,'frames →',r.unique,'stored',r.pages.map(p=>p.join('x')).join('+'),`${r.ms_total} ms`);
}
writeFileSync(join(PACK,'nerulio','runs.json'),JSON.stringify({node:process.version,runs},null,1));
