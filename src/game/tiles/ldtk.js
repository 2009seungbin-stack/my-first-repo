/** LDtk export: a project (JSON 1.5.3) with one IntGrid layer whose auto-layer rules are made from
 * the tile patterns, plus one level painted with a sample map. Pure.
 *
 * Every terrain is an IntGrid value (terrain t → value t+1). Every tile becomes one 3×3 rule:
 * pattern entries are v (must be value v), -v (must not be v) or 0 (anything), row by row from the
 * top-left; the rule draws the tile on the centre cell. Positions a mode ignores, and corner
 * positions behind an open side, are 0. Corner (dual-grid) sets use LDtk's tile offset: the rule
 * looks at the cell, its right, bottom and bottom-right neighbours (the four cells meeting at the
 * cell's bottom-right point) and draws the tile shifted by half a tile.
 *
 * The level's autoLayerTiles are computed with the same rule semantics (first matching rule in
 * order wins, breakOnMatch), so a loader that does not run rules still gets the tiles. */
import {MODE_IDX,CORNER_SIDES} from './patterns.js';
import {tileId} from './tiled.js';
// Cells outside the level count as empty (IntGrid value 0) for every rule.
const OUT_OF_BOUNDS=0;
// our position index → offset in the 3×3 pattern (row-major, y down)
const POS_TO_CELL=[1,2,5,8,7,6,3,0];
export function rulePattern(ts,p){
 const t=p[0],v=t+1,pat=new Array(9).fill(0);
 if(ts.mode==='corners'){
  // dual grid: centre = this cell = the tile's top-left corner, E = top-right, S = bottom-left,
  // SE = bottom-right (the tile is drawn at the cell's bottom-right grid point)
  const val=x=>x>=0?x+1:-1000001;
  pat[4]=val(p[8]);pat[5]=val(p[2]);pat[7]=val(p[6]);pat[8]=val(p[4]);
  return pat;
 }
 pat[4]=v;
 for(const i of MODE_IDX[ts.mode]){
  const q=p[i+1];
  if(i%2===1&&ts.mode==='corners-and-sides'){const [s1,s2]=CORNER_SIDES[i];if(p[s1+1]!==t||p[s2+1]!==t)continue;}
  pat[POS_TO_CELL[i]]=q===t?v:q>=0?q+1:-v;
 }
 return pat;
}
function matches(pattern,get,x,y){
 for(let k=0;k<9;k++){
  const want=pattern[k];if(!want)continue;
  const got=get(x+(k%3)-1,y+Math.floor(k/3)-1);// 0 = empty
  if(want===1000001){if(got===0)return false;}
  else if(want===-1000001){if(got!==0)return false;}
  else if(want>0){if(got!==want)return false;}
  else if(got===-want)return false;
 }
 return true;
}
/** Run the rules on an IntGrid (values 0 = empty, t+1 = terrain t). */
export function runRules(rules,grid,{half=false}={}){
 const get=(x,y)=>x<0||y<0||x>=grid.w||y>=grid.h?0:grid.get(x,y)+1;
 const out=[];
 for(let y=0;y<grid.h;y++)for(let x=0;x<grid.w;x++){
  for(const r of rules){if(matches(r.pattern,get,x,y)){out.push({x,y,rule:r.uid,tile:r.tile,key:r.key});break;}}
 }
 return out;
}
const iid=(seed,n)=>{// deterministic UUID-shaped ids (LDtk only needs uniqueness)
 const h=(s=>{let v=2166136261;for(const ch of s)v=Math.imul(v^ch.charCodeAt(0),16777619)>>>0;return v;})(seed+':'+n);
 const hex=(v,l)=>v.toString(16).padStart(l,'0').slice(-l);
 return `${hex(h,8)}-${hex(h>>>16^n,4)}-4${hex(h>>>4,3)}-8${hex(h>>>8^n*7,3)}-${hex(h*31>>>0,8)}${hex(n*977,4)}`;
};
export function ldtkProject(ts,{imageName,width,height,sample,name='Nerulio tileset'}){
 const g=ts.grid,gs=g.w,seed=ts.id||name;
 if(g.w!==g.h)throw Error('LDtk needs square tiles');
 if(g.ox!==g.oy||g.sx!==g.sy)throw Error('LDtk has one padding and one spacing value');
 let uid=1;const U=()=>uid++;
 const tilesetUid=U(),layerUid=U(),groupUid=U(),levelUid=U(),worldIid=iid(seed,0);
 const half=ts.mode==='corners';
 const rules=[];
 for(const [k,v] of Object.entries(ts.tiles)){
  const p=v.pattern;if(p[0]<0)continue;const [c,r]=k.split(',').map(Number);
  const pattern=rulePattern(ts,p);if(pattern.every(x=>x===0||x===-1000001))continue;// an all-empty dual tile draws nothing
  rules.push({uid:U(),key:k,tile:tileId(ts,c,r),pattern,chance:1});
 }
 // most specific first so a looser rule never hides a stricter one (they are disjoint for full sets)
 rules.sort((a,b)=>b.pattern.filter(Boolean).length-a.pattern.filter(Boolean).length||a.tile-b.tile);
 const ruleDef=r=>({uid:r.uid,active:true,size:3,tileRectsIds:[[r.tile]],alpha:1,chance:1,breakOnMatch:true,pattern:r.pattern,flipX:false,flipY:false,
  xModulo:1,yModulo:1,xOffset:0,yOffset:0,tileXOffset:half?gs/2:0,tileYOffset:half?gs/2:0,tileRandomXMin:0,tileRandomXMax:0,tileRandomYMin:0,tileRandomYMax:0,
  checker:'None',tileMode:'Single',pivotX:0,pivotY:0,outOfBoundsValue:OUT_OF_BOUNDS,invalidated:false,perlinActive:false,perlinSeed:1234,perlinScale:0.2,perlinOctaves:2});
 const W=sample.w,H=sample.h,csv=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const t=sample.get(x,y);csv.push(t>=0?t+1:0);}
 const placed=runRules(rules,sample,{half});
 const autoLayerTiles=placed.map((p,i)=>{const id=p.tile,cx=id%g.cols,cy=Math.floor(id/g.cols);
  return {px:[p.x*gs+(half?gs/2:0),p.y*gs+(half?gs/2:0)],src:[g.ox+cx*(g.w+g.sx),g.oy+cy*(g.h+g.sy)],f:0,t:id,d:[p.rule,p.y*W+p.x],a:1};});
 const layerDef={__type:'IntGrid',identifier:'Terrain',type:'IntGrid',uid:layerUid,doc:null,uiColor:null,gridSize:gs,guideGridWid:0,guideGridHei:0,
  displayOpacity:1,inactiveOpacity:1,hideInList:false,hideFieldsWhenInactive:true,canSelectWhenInactive:true,renderInWorldView:true,pxOffsetX:0,pxOffsetY:0,
  parallaxFactorX:0,parallaxFactorY:0,parallaxScaling:true,requiredTags:[],excludedTags:[],autoTilesKilledByOtherLayerUid:null,uiFilterTags:[],useAsyncRender:false,
  intGridValues:ts.terrains.map((t,i)=>({value:i+1,identifier:ident(t.name,i),color:t.color,tile:null,groupUid:0})),intGridValuesGroups:[],
  autoRuleGroups:[{uid:groupUid,name:'Nerulio terrain',color:null,icon:null,active:true,isOptional:false,rules:rules.map(ruleDef),usesWizard:false,requiredBiomeValues:[],biomeRequirementMode:0}],
  autoSourceLayerDefUid:null,tilesetDefUid:tilesetUid,tilePivotX:0,tilePivotY:0,biomeFieldUid:null};
 const tilesetDef={__cWid:g.cols,__cHei:g.rows,identifier:ident(name,0),uid:tilesetUid,relPath:imageName,embedAtlas:null,pxWid:width,pxHei:height,tileGridSize:gs,
  spacing:g.sx,padding:g.ox,tags:[],tagsSourceEnumUid:null,enumTags:[],customData:[],savedSelections:[],cachedPixelData:null};
 const level={identifier:'Sample',iid:iid(seed,1),uid:levelUid,worldX:0,worldY:0,worldDepth:0,pxWid:W*gs,pxHei:H*gs,__bgColor:'#40465B',bgColor:null,useAutoIdentifier:false,
  bgRelPath:null,bgPos:null,bgPivotX:0.5,bgPivotY:0.5,__smartColor:'#ADADB5',__bgPos:null,externalRelPath:null,fieldInstances:[],__neighbours:[],
  layerInstances:[{__identifier:'Terrain',__type:'IntGrid',__cWid:W,__cHei:H,__gridSize:gs,__opacity:1,__pxTotalOffsetX:0,__pxTotalOffsetY:0,__tilesetDefUid:tilesetUid,
   __tilesetRelPath:imageName,iid:iid(seed,2),levelId:levelUid,layerDefUid:layerUid,pxOffsetX:0,pxOffsetY:0,visible:true,optionalRules:[],intGridCsv:csv,
   autoLayerTiles,seed:1234,overrideTilesetUid:null,gridTiles:[],entityInstances:[]}]};
 const project={__header__:{fileType:'LDtk Project JSON',app:'Nerulio Studio',doc:'https://ldtk.io/json',schema:'https://ldtk.io/files/JSON_SCHEMA.json',appAuthor:'Nerulio',appVersion:'1.5.3',url:'https://ldtk.io'},
  iid:iid(seed,3),jsonVersion:'1.5.3',appBuildId:473702,nextUid:uid,identifierStyle:'Capitalize',toc:[],worldLayout:'Free',worldGridWidth:256,worldGridHeight:256,
  defaultLevelWidth:W*gs,defaultLevelHeight:H*gs,defaultPivotX:0,defaultPivotY:0,defaultGridSize:gs,defaultEntityWidth:gs,defaultEntityHeight:gs,bgColor:'#40465B',
  defaultLevelBgColor:'#696A79',minifyJson:false,externalLevels:false,exportTiled:false,simplifiedExport:false,imageExportMode:'None',exportLevelBg:true,pngFilePattern:null,
  backupOnSave:false,backupLimit:10,backupRelPath:null,levelNamePattern:'Level_%idx',tutorialDesc:null,customCommands:[],flags:[],
  defs:{layers:[layerDef],entities:[],tilesets:[tilesetDef],enums:[],externalEnums:[],levelFields:[]},levels:[level],worlds:[],dummyWorldIid:worldIid};
 return {project,placed,rules};
}
function ident(s,i){const x=String(s||'').normalize('NFKD').replace(/[^A-Za-z0-9_]+/g,'_').replace(/^_+|_+$/g,'');return /^[A-Za-z]/.test(x)?x[0].toUpperCase()+x.slice(1):'Terrain_'+(i+1);}
