/** Unity Rule Tile job for one corpus bundle: the cells to paint per case and what the Studio
 * expects Unity to draw in every cell.
 *
 *   node tools/engine-verify/tile/make_unity_job.mjs <asset dir>   → <asset dir>/unity-job.json
 *
 * Expectation per terrain cell ("rule"): Unity's RuleTile semantics applied to the EXPORTED rule
 * list — the first rule of that terrain's RuleTile (exported order) whose neighbours all match
 * (This = the neighbour holds the same RuleTile, NotThis = anything else, empty and outside the map
 * included), else the tile's default sprite. "ideal": every sprite whose model pattern fits the
 * neighbourhood (patterns.idealAt). "truth": the same from the corpus manifest masks when the model
 * came straight from a known layout (see corpus_tiles.mjs). Unity cell = (x, -y): Unity's y is up. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,basename,resolve} from 'node:path';
import {idealAt,fits,fromBlob,fromEdge} from '../../../src/game/tiles/patterns.js';
import {standardCases,getter} from './cases.mjs';
const CORPUS=process.env.NERULIO_CORPUS||'C:/Users/2009s/nerulio-asset-corpus';
export function makeJob(dir){
 const model=JSON.parse(readFileSync(join(dir,'model.json'),'utf8'));
 const exp=JSON.parse(readFileSync(join(dir,'unity','nerulio-ruletile.json'),'utf8'));
 const spriteOf=(c,r)=>`tile_${c}_${r}`;
 // manifest truth (only for models laid straight onto a known single-terrain layout)
 let truthTiles=null;
 // the corpus entry this folder came from (same id rule as corpus_tiles.mjs)
 const man=JSON.parse(readFileSync(join(CORPUS,'manifest.json'),'utf8'));
 const idOf=f=>basename(f.path).replace(/\.png$/i,'').replace(/[^\w-]+/g,'_')+'-'+f.source.replace(/[^\w-]+/g,'_').slice(0,20);
 const entry=man.files.find(f=>f.category==='tileset'&&idOf(f)===basename(dir));
 const generated=existsSync(join(dir,'generated.png'));
 if(entry&&!generated&&model.terrains.length===1){
  const t=entry.truth;
  if(t?.masks&&!String(t.layout).startsWith('wang-2corner')){
   const kind=String(t.layout).startsWith('edge16')?'edge':'blob';truthTiles=[];
   t.masks.forEach((r,y)=>r.forEach((m,x)=>{if(m!=null)truthTiles.push({sprite:spriteOf(x,y),pattern:kind==='blob'?fromBlob(m):fromEdge(m)});}));
  }
 }
 const tiles=Object.entries(model.tiles).filter(([,v])=>v.pattern[0]>=0).map(([k,v])=>{const [c,r]=k.split(',').map(Number);return {sprite:spriteOf(c,r),pattern:v.pattern};});
 const byTerrain=new Map(exp.terrains.map(t=>[t.index,t]));
 const cases=[];
 for(const c of standardCases(model.terrains.length)){
  const get=getter(c.grid),cells=[],rule={},ideal={},truth={};
  for(let y=0;y<c.grid.h;y++)for(let x=0;x<c.grid.w;x++){
   const t=get(x,y);if(t<0)continue;const T=byTerrain.get(t);if(!T)continue;
   cells.push([x,y,t]);
   let pick=T.defaultSprite;
   for(const r of T.rules){
    let ok=true;
    for(let i=0;i+2<r.flat.length;i+=3){const nx=x+r.flat[i],ny=y-r.flat[i+1],same=get(nx,ny)===t;if(r.flat[i+2]===1?!same:same){ok=false;break;}}
    if(ok){pick=r.sprite;break;}
   }
   rule[x+','+y]=pick;
   // one RuleTile per terrain: to a RuleTile every other terrain is simply "not this", so the
   // neighbourhood is judged with the other terrains as empty
   const own=(nx,ny)=>get(nx,ny)===t?t:-1,want=idealAt(own,x,y,model.mode);
   ideal[x+','+y]=tiles.filter(tl=>tl.pattern[0]===t&&fits(tl.pattern,want)).map(tl=>tl.sprite);
   if(truthTiles)truth[x+','+y]=truthTiles.filter(tl=>fits(tl.pattern,want)).map(tl=>tl.sprite);
  }
  cases.push({name:c.name,cells,rule,ideal,...(truthTiles?{truth}:{})});
 }
 const job={json:'Assets/Bundle/nerulio-ruletile.json',png:exp.image,terrainOrder:exp.terrains.map(t=>t.index),sprites:exp.sprites,cases};
 writeFileSync(join(dir,'unity-job.json'),JSON.stringify(job));
 return job;
}
if(process.argv[2]){const j=makeJob(resolve(process.argv[2]));console.log(process.argv[2],j.cases.map(c=>`${c.name}:${c.cells.length}`).join(' '));}
