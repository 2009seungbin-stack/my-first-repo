/** Studio Tile — corpus run: for every autotile sheet in the game-asset corpus, do what the Tile
 * workspace does (identify the layout from the pixels, build the tileset model), write every
 * export bundle, and write engine jobs with the Studio's own prediction per cell plus the truth
 * from the corpus manifest (never from the export).
 *
 *   node tools/engine-verify/tile/corpus_tiles.mjs <out dir> [filter]
 *
 * Output per asset: <out>/<id>/{identify.json, model.json, godot/…, tiled/…, ldtk/…, unity/…, generic/…,
 * godot-job.json}; <out>/summary.json. The engines are run by run_all.py. */
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,basename} from 'node:path';
import {decodePNG} from '../../../src/game/texture-png.js';
import {identifyLayout,blockTerrains} from '../../../src/game/tiles/identify.js';
import {createTileset,applyLayout,terrainTiles,patternsList,TERRAIN_COLORS} from '../../../src/game/tiles/model.js';
import {GodotTerrainSet,resolveGodot} from '../../../src/game/tiles/godot-terrain.js';
import {fromBlob,fromEdge,fromCorner,idealAt,samePattern} from '../../../src/game/tiles/patterns.js';
import {exportBundle} from '../../../src/game/tiles/exports.js';
import {standardCases,getter,godotCalls} from './cases.mjs';
const CORPUS=process.env.NERULIO_CORPUS||'C:/Users/2009s/nerulio-asset-corpus';
const [out,filter]=process.argv.slice(2);
if(!out)throw Error('usage: corpus_tiles.mjs <out> [filter]');
const man=JSON.parse(readFileSync(join(CORPUS,'manifest.json'),'utf8'));
const summary=[];
for(const f of man.files){
 if(f.category!=='tileset')continue;
 if(filter&&!f.path.includes(filter))continue;
 const t=f.truth||{},g=t.grid;if(!g)continue;
 const id=basename(f.path).replace(/\.png$/i,'').replace(/[^\w-]+/g,'_')+'-'+f.source.replace(/[^\w-]+/g,'_').slice(0,20);
 const dir=join(out,id);mkdirSync(dir,{recursive:true});
 const bytes=readFileSync(join(CORPUS,f.path)),img=await decodePNG(bytes);
 const grid={w:g.cellW,h:g.cellH,ox:g.marginX||0,oy:g.marginY||0,sx:g.spacingX||0,sy:g.spacingY||0};
 const t0=performance.now(),idr=identifyLayout(img,grid),ms=performance.now()-t0;
 const top=idr.candidates[0];
 const row={asset:f.path,truthLayout:t.layout||'',grid:`${g.cellW}x${g.cellH}`,identifyMs:Math.round(ms),
  detected:top?{layoutId:top.layoutId,col:top.col,row:top.row,auc:+top.auc.toFixed(3),confidence:top.confidence,margin:+top.margin.toFixed(3)}:null,
  hints:idr.hints,blocks:idr.blocks.filter(b=>!b.source).map(b=>`${b.layoutId}@${b.col},${b.row}`)};
 writeFileSync(join(dir,'identify.json'),JSON.stringify({...idr,candidates:idr.candidates},null,1));
 summary.push(row);
 // Only sheets whose top candidate is a real layout (not a sub-tile source) get a model + exports.
 if(!top||top.source||top.confidence==='low'){row.exported=false;console.log(f.path,'→',top?`${top.layoutId} ${top.confidence}`:'none','(no export)');continue;}
 const sameLayout=idr.blocks.filter(b=>b.layoutId===top.layoutId&&!b.source);
 const multi=sameLayout.length>1;
 let ts=createTileset({assetId:id,name:basename(f.path),grid:{...grid,cols:idr.grid.cols,rows:idr.grid.rows},mode:top.mode});
 if(multi){
  const bt=blockTerrains(img,grid,sameLayout);
  ts={...ts,terrains:bt.terrains.map((_,i)=>({name:'Terrain '+(i+1),color:TERRAIN_COLORS[i%TERRAIN_COLORS.length]}))};
  for(const b of bt.blocks)ts=applyLayout(ts,b,{a:b.a,b:b.b});
  row.terrains=bt.terrains.length;row.blocksUsed=bt.blocks.map(b=>`${b.col},${b.row}:${b.a}/${b.b}`);
 }else ts=applyLayout(ts,top);
 writeFileSync(join(dir,'model.json'),JSON.stringify(ts,null,1));
 // ---- truth from the manifest (independent of the model)
 const truthTiles=[];
 if(t.masks){
  const L=String(t.layout),kind=L.startsWith('edge16')?'edge':L.startsWith('wang-2corner')?'corner':'blob';
  t.masks.forEach((r,y)=>r.forEach((m,x)=>{if(m!=null)truthTiles.push({col:x,row:y,pattern:kind==='blob'?fromBlob(m):kind==='edge'?fromEdge(m):fromCorner(m)});}));
  // model vs truth, tile by tile
  let same=0;for(const tt of truthTiles){const mp=ts.tiles[tt.col+','+tt.row]?.pattern;if(mp&&samePattern(mp,tt.pattern))same++;}
  row.modelVsTruth=`${same}/${truthTiles.length}`;
 }
 if(t.cornerTerrains){
  // dual-grid truth: corner terrains per tile (names) vs the model's corner terrains (indexes):
  // a consistent relabelling must exist
  const map=new Map();let ok=0,n=0;
  for(const [k,names] of Object.entries(t.cornerTerrains)){
   const p=ts.tiles[k]?.pattern;n++;if(!p)continue;
   const mine=[p[8],p[2],p[6],p[4]];// top_left, top_right, bottom_left, bottom_right
   let good=true;names.forEach((nm,i)=>{if(!map.has(nm))map.set(nm,mine[i]);if(map.get(nm)!==mine[i])good=false;});
   if(good)ok++;
  }
  row.modelVsTruth=`${ok}/${n} tiles' corner terrains (relabelled ${[...map].map(([a,b])=>a+'='+b).join(' ')})`;
 }
 // ---- exports
 const png=basename(f.path);
 const cases=standardCases(ts.terrains.length);
 const bundle=exportBundle(ts,{imageName:png,width:img.width,height:img.height,cases,png:bytes});
 for(const [target,files] of Object.entries(bundle)){
  const d=join(dir,target);mkdirSync(d,{recursive:true});
  for(const [name,content] of Object.entries(files)){const p=join(d,name);mkdirSync(join(p,'..'),{recursive:true});writeFileSync(p,content);}
 }
 // ---- Godot job: the Studio prediction for every case, and the truth where the manifest has masks
 const set=new GodotTerrainSet({mode:ts.mode,tiles:terrainTiles(ts)});
 const job={json:'res://nerulio-tileset.json',importer:'res://nerulio_tileset_import.gd',cases:[]};
 for(const c of cases){
  const r=resolveGodot(set,{w:c.grid.w,h:c.grid.h,get:getter(c.grid)});
  const predict={};for(const [k,v] of r.cells)predict[k]=v.alternatives.map(a=>a.split(',').map(Number));
  const jc={name:c.name,calls:godotCalls(c.grid),predict};
  if(truthTiles.length&&ts.terrains.length===1){
   const truth={},get=getter(c.grid);
   for(let y=0;y<c.grid.h;y++)for(let x=0;x<c.grid.w;x++){
    if(get(x,y)<0)continue;const want=idealAt(get,x,y,ts.mode);
    const ok=truthTiles.filter(tt=>want.every((vals,i)=>vals.includes(tt.pattern[i])));
    if(ok.length)truth[x+','+y]=ok.map(tt=>[tt.col,tt.row]);else truth[x+','+y]=[];
   }
   jc.truth=truth;
  }
  job.cases.push(jc);
 }
 writeFileSync(join(dir,'godot-job.json'),JSON.stringify(job));
 row.exported=true;row.mode=ts.mode;row.tiles=Object.keys(ts.tiles).length;
 console.log(f.path,'→',top.layoutId,top.confidence,'auc',top.auc.toFixed(3),row.modelVsTruth||'',multi?`(${sameLayout.length} blocks, ${ts.terrains.length} terrains)`:'');
}
writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,1));
