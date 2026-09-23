/** Every Tile workspace export for one tileset, as {target: {fileName: string|Uint8Array}}. Pure.
 *
 *   godot    PNG + nerulio-tileset.json + nerulio_tileset_import.gd (builds the TileSet in the
 *            editor through the engine API) + README.txt
 *   tiled    PNG + <name>.tsx (Wang set) + sample.tmx (a sample map painted with Tiled's rule)
 *   ldtk     PNG + <name>.ldtk (IntGrid layer, auto-layer rules, a sample level)
 *   unity    PNG + nerulio-ruletile.json + Editor/NerulioRuleTileImporter.cs (builds RuleTile assets)
 *   generic  PNG + tileset.json (patterns, cr31 masks, Tiled Wang IDs, Godot peering names)
 * `sample` is a terrain grid {w,h,get(x,y)} used for the sample maps. */
import {godotJSON,godotImporter,godotReadme} from './godot-export.js';
import {tsx,tmx,resolveTiled,wangId,tileId} from './tiled.js';
import {ldtkProject} from './ldtk.js';
import {unityRules,unityJSON,UNITY_RULETILE_SCRIPT} from './unity.js';
import {blobOf,edgeOf,cornerOf,GODOT_NAMES,MODE_IDX,describe} from './patterns.js';
const enc=s=>typeof s==='string'?s:s;
export const TARGETS=Object.freeze(['godot','tiled','ldtk','unity','generic']);
export function exportBundle(ts,{imageName='tileset.png',width,height,png,sample=null,cases=null,targets=TARGETS}={}){
 const base=imageName.replace(/\.[^.]+$/,'').replace(/[^\w.-]+/g,'_')||'tileset';
 // A set whose tiles never border "nothing" (a multi-terrain dual grid) is shown on a multi-terrain
 // sample; a one-terrain shape would leave most of its grid points without a tile.
 const bordersEmpty=Object.values(ts.tiles).some(v=>v.pattern[0]>=0&&MODE_IDX[ts.mode].some(i=>v.pattern[i+1]<0));
 const pickCase=cases?.length?(!bordersEmpty&&cases.find(c=>c.name.startsWith('multi'))||cases[0]):null;
 const grid=sample||(pickCase?{w:pickCase.grid.w,h:pickCase.grid.h,get:(x,y)=>x<0||y<0||x>=pickCase.grid.w||y>=pickCase.grid.h?-1:pickCase.grid.cells[y*pickCase.grid.w+x]}:null);
 const out={},notes={};
 if(targets.includes('godot')){
  const json=godotJSON(ts,{image:imageName,width,height});
  out.godot={[imageName]:png,'nerulio-tileset.json':JSON.stringify(json,null,1),'nerulio_tileset_import.gd':godotImporter(),'README.txt':godotReadme(json)};
 }
 if(targets.includes('tiled')){
  const files={[imageName]:png,[base+'.tsx']:tsx(ts,{imageName,width,height,name:base})};
  if(ts.grid.ox!==ts.grid.oy||ts.grid.sx!==ts.grid.sy)notes.tiled='Tiled has one margin and one spacing value; the x values were written.';
  if(grid){const r=resolveTiled(ts,grid);files['sample.tmx']=tmx(ts,r,{tsxName:base+'.tsx'});notes.tiledMissing=r.cells.filter(c=>c.missing).length;}
  files['README.txt']=tiledReadme(ts,base);
  out.tiled=files;
 }
 if(targets.includes('ldtk')){
  try{
   if(!grid)throw Error('no sample map');
   const {project,placed}=ldtkProject(ts,{imageName,width,height,sample:grid,name:base});
   out.ldtk={[imageName]:png,[base+'.ldtk']:JSON.stringify(project,null,1),'README.txt':ldtkReadme(ts,base,placed.length)};
  }catch(e){notes.ldtk=String(e.message||e);}
 }
 if(targets.includes('unity')){
  const rules=unityRules(ts,{imageName,width,height});
  if(rules.skipped)notes.unity=rules.skipped;
  else out.unity={[imageName]:png,'nerulio-ruletile.json':JSON.stringify(unityJSON(rules),null,1),'Editor/NerulioRuleTileImporter.cs':UNITY_RULETILE_SCRIPT,'README.txt':unityReadme(rules)};
 }
 if(targets.includes('generic'))out.generic={[imageName]:png,'tileset.json':JSON.stringify(genericJSON(ts,{imageName,width,height}),null,1)};
 Object.defineProperty(out,'notes',{value:notes,enumerable:false});
 return out;
}
export function genericJSON(ts,{imageName,width,height}){
 const g=ts.grid;
 return {meta:{tool:'nerulio-studio-tile',schemaVersion:1,engineTarget:'generic',image:imageName,size:{w:width,h:height}},
  tileSet:{tileSize:{w:g.w,h:g.h},margins:{x:g.ox,y:g.oy},separation:{x:g.sx,y:g.sy},columns:g.cols,rows:g.rows,mode:ts.mode,layout:ts.layoutId||null,
   bitOrder:{pattern:'[terrain, n, ne, e, se, s, sw, w, nw]; -1 = no terrain',cr31:'N1 NE2 E4 SE8 S16 SW32 W64 NW128',edge:'N1 E2 S4 W8',corner:'NW1 NE2 SE4 SW8'},
   terrains:ts.terrains.map((t,i)=>({index:i,name:t.name,color:t.color})),
   tiles:Object.entries(ts.tiles).filter(([,v])=>v.pattern[0]>=0).map(([k,v])=>{
    const [col,row]=k.split(',').map(Number),p=v.pattern;
    return {col,row,id:tileId(ts,col,row),rect:{x:g.ox+col*(g.w+g.sx),y:g.oy+row*(g.h+g.sy),w:g.w,h:g.h},terrain:p[0],pattern:p,name:describe(p),
     masks:{cr31:blobOf(p),edge:edgeOf(p),corner:cornerOf(p)},tiledWangId:wangId(ts,p),
     godotPeering:Object.fromEntries(MODE_IDX[ts.mode].filter(i=>p[i+1]>=0).map(i=>[GODOT_NAMES[i],p[i+1]])),...(v.probability!=null?{probability:v.probability}:{})};
   }).sort((a,b)=>a.id-b.id)}};
}
function tiledReadme(ts,base){
 return ['Nerulio Studio — Tiled tileset with a Wang set','',
  `Open ${base}.tsx in Tiled (1.8 or later). The Terrain Sets panel lists "${base}" (${ts.mode==='corners'?'corner':ts.mode==='sides'?'edge':'mixed'}) with ${ts.terrains.length} colour(s).`,
  'sample.tmx is a small map drawn with that set, so you can see it work before painting your own.',
  ts.mode==='corners'?'Corner sets sit on grid points: the sample layer is offset by half a tile (layer offset), the usual dual-grid setup.':'',
  'Wang IDs follow Tiled\'s order: top, top-right, right, bottom-right, bottom, bottom-left, left, top-left; 0 = no colour.',''].filter(s=>s!=='').join('\n');
}
function ldtkReadme(ts,base,placed){
 return ['Nerulio Studio — LDtk project','',`Open ${base}.ldtk in LDtk 1.5. The IntGrid layer "Terrain" has one value per terrain and one rule per tile in the group "Nerulio terrain".`,
  `The sample level already carries the ${placed} tiles the rules place; paint the IntGrid and LDtk re-runs them.`,
  ts.mode==='corners'?'Corner (dual-grid) rules read the cell, its right, bottom and bottom-right neighbours and draw half a tile down-right.':'',
  'Checked against the LDtk 1.5.3 JSON schema; see docs/STUDIO-TILE.md for what was and was not run in LDtk itself.',''].filter(s=>s!=='').join('\n');
}
function unityReadme(rules){
 return ['Nerulio Studio — Unity Rule Tiles','','Needs the 2D Tilemap Extras package (com.unity.2d.tilemap.extras).',
  '1. Copy the PNG and nerulio-ruletile.json into your Assets folder (same folder), and Editor/NerulioRuleTileImporter.cs into any Editor folder.',
  '2. Select nerulio-ruletile.json and run Tools > Nerulio > Build Rule Tiles.',
  `3. It writes ${rules.terrains.length} RuleTile asset(s) next to the JSON (${rules.terrains.map(t=>t.name).join(', ')}). Drag one into a Tile Palette and paint.`,
  'Neighbour rules use Unity\'s grid (y up): This where the tile connects, NotThis where it does not, nothing where it does not matter.',''].join('\n');
}
export {enc};
