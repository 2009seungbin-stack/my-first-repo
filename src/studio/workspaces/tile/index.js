/** Tile workspace (P3): tilesets → layout → peering bits → check → generator → map test bench →
 * engine exports. Uses only the workspace plug-in API (docs/STUDIO.md). Pixel work runs in
 * tile-worker.js; the rules are src/game/tiles/*. Document state lives in settings.tile
 * (state.js), so every edit is one undoable command and autosaves with the project.
 *
 * Two views on one canvas: the TILESET (the sheet itself, with bits painted on the tiles) and the
 * MAP (a painted test map, drawn exactly as Godot's matcher or Tiled's Wang brush would draw it).
 * Choosing a tool switches the view that tool works on. */
import './strings.js';
import * as P from '../../core/project.js';
import {h} from '../../ui/dom.js';
import {ICONS} from '../../ui/icons.js';
import {zip} from '../../../core.js';
import * as TS from '../../../game/tiles/model.js';
import {LAYOUTS,layoutById,placeLayout} from '../../../game/tiles/layouts.js';
import {POS,MODE_IDX,MODES,completeness,describe,samePattern,inMode,CORNER_SIDES,OFFSETS} from '../../../game/tiles/patterns.js';
import {exportBundle,TARGETS} from '../../../game/tiles/exports.js';
import * as St from './state.js';
import {resolveLayer} from './resolve.js';
import {VERIFY} from './verify-status.js';
const CSS_ID='tile-ws-css';
const svg=b=>`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${b}</svg>`;
Object.assign(ICONS,{
 tileSel:svg('<rect x="2.5" y="2.5" width="5" height="5"/><rect x="8.5" y="8.5" width="5" height="5" stroke-dasharray="1.5 1.5"/>'),
 bits:svg('<rect x="2" y="2" width="12" height="12"/><rect x="6" y="6" width="4" height="4" fill="currentColor"/><path d="M2 6h12M2 10h12M6 2v12M10 2v12" stroke-width=".8"/>'),
 brush:svg('<path d="M10.5 2.5l3 3-6 6-3-3z"/><path d="M4.5 8.5l-2 5 5-2"/>'),
 eraser:svg('<path d="M6 13.5h7.5M3 10l6.5-6.5 4 4L7 14H5z"/><path d="M6.5 6.5l4 4"/>'),
 bucket:svg('<path d="M3 7l5-5 5.5 5.5-5 5z"/><path d="M13.5 10.5s1.5 2 1.5 3a1.5 1.5 0 01-3 0c0-1 1.5-3 1.5-3z"/>'),
 picker:svg('<path d="M9.5 2.5l4 4-1.5 1.5-4-4z"/><path d="M8 5.5L2.5 11v2.5H5L10.5 8"/>'),
 map:svg('<path d="M2 4l4-1.5 4 1.5 4-1.5v9.5L10 13l-4-1.5L2 13z"/><path d="M6 2.5v9M10 4v9"/>')
});
let worker=null,seq=0;const waiting=new Map();
function work(msg,transfer=[]){
 worker||=Object.assign(new Worker(new URL('./tile-worker.js',import.meta.url),{type:'module'}),{onmessage:({data})=>{const w=waiting.get(data.id);if(!w)return;waiting.delete(data.id);data.ok?w.resolve(data.result):w.reject(Error(data.error));}});
 const id=++seq;return new Promise((resolve,reject)=>{waiting.set(id,{resolve,reject});worker.postMessage({...msg,id},transfer);});
}
const gridOf=ts=>({w:ts.grid.w,h:ts.grid.h,ox:ts.grid.ox,oy:ts.grid.oy,sx:ts.grid.sx,sy:ts.grid.sy,cols:ts.grid.cols,rows:ts.grid.rows});
const cellRect=(g,c,r)=>({x:g.ox+c*(g.w+g.sx),y:g.oy+r*(g.h+g.sy),w:g.w,h:g.h});
const key=(c,r)=>c+','+r;
const unkey=k=>k.split(',').map(Number);
// zone of a point inside a tile: 'c' centre or a position index 0…7 (n,ne,e,se,s,sw,w,nw)
const ZONES=[[7,0,1],[6,'c',2],[5,4,3]];
function zoneAt(g,lx,ly){const zx=Math.min(2,Math.floor(lx*3/g.w)),zy=Math.min(2,Math.floor(ly*3/g.h));return ZONES[zy][zx];}
function zoneRect(g,z){for(let zy=0;zy<3;zy++)for(let zx=0;zx<3;zx++)if(ZONES[zy][zx]===z)return {x:Math.floor(zx*g.w/3),y:Math.floor(zy*g.h/3),w:Math.floor((zx+1)*g.w/3)-Math.floor(zx*g.w/3),h:Math.floor((zy+1)*g.h/3)-Math.floor(zy*g.h/3)};return null;}
const rgba=(hex,a)=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex||'');const n=m?parseInt(m[1],16):0x4cc2ff;return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;};
/** Rotate a pattern 90° clockwise (positions move two steps round the ring). */
const rotate=p=>[p[0],...Array.from({length:8},(_,i)=>p[1+((i+6)%8)])];
const mirror=p=>[p[0],p[1],p[8],p[7],p[6],p[5],p[4],p[3],p[2]];
export default {
 id:'tile',title:'ws.tile',status:'ready',summary:'ws.tileSummary',
 activate(ctx){
  const {t,view}=ctx;
  if(!document.getElementById(CSS_ID))document.head.append(h('link',{id:CSS_ID,rel:'stylesheet',href:new URL('./tile.css',import.meta.url).href}));
  // ---------------------------------------------------------------- view state (not in the document)
  let assetId=null,mode='tileset',selection=[],hoverZone=null,terrain=0,brushSize=1,clipboard=null;
  let preview=null;// {kind:'layout'|'suggest', label, patterns:{key:pattern}, confidence}
  const detect=new Map(),ident=new Map(),blanks=new Map(),art=new Map(),suggest=new Map();
  let drafts=new Map();// assetId → draft grid before a tileset exists
  let mapView=null,mapBitmap=null,mapCanvas=null,mapToken=0,hoverCell=null;
  const S=()=>St.tileState(ctx.doc);
  const asset=()=>P.assetById(ctx.doc,assetId);
  const tileset=()=>assetId?St.tilesetForAsset(S(),assetId):null;
  const tilesetById=id=>S().tilesets?.[id]||null;
  const activeMap=()=>{const s=S();return s.maps?.[s.activeMap]||null;};
  const edit=(label,fn,opts)=>ctx.execute(ctx.edit(label,d=>St.withTileState(d,fn),opts));
  const editTs=(label,fn,opts)=>{const ts=tileset();if(!ts)return;edit(label,s=>St.updateTileset(s,ts.id,fn),opts);};
  const blobOf=a=>{const id=P.primaryBlob(a);return {id,blob:ctx.images.get(id)?.blob};};
  // ---------------------------------------------------------------- overlay on the sheet
  const sheetLayer={z:30,view:null,visible:true,hit:()=>null,draw(g){if(mode!=='tileset')return;drawSheet(g);}};
  const mapLayer={z:31,view:null,visible:true,hit:()=>null,draw(g){if(mode!=='map')return;drawMapOverlay(g);}};
  ctx.layer(sheetLayer);ctx.layer(mapLayer);
  function drawSheet({ctx:c,view:v,dpr,visible}){
   const ts=tileset(),a=asset();if(!a)return;
   const g=ts?ts.grid:draftGrid();if(!g)return;
   const s=v.scale,X=x=>Math.round(v.x+x*s),Y=y=>Math.round(v.y+y*s),px=g.w*s;
   const c0=Math.max(0,Math.floor((visible.x-g.ox)/(g.w+g.sx))),r0=Math.max(0,Math.floor((visible.y-g.oy)/(g.h+g.sy)));
   const c1=Math.min(g.cols-1,Math.ceil((visible.x+visible.w-g.ox)/(g.w+g.sx))),r1=Math.min(g.rows-1,Math.ceil((visible.y+visible.h-g.oy)/(g.h+g.sy)));
   const blank=new Set(blanks.get(a.id)?.blank||[]);
   const terrains=ts?.terrains||[];const bad=new Set((art.get(ts?.id)?.mismatches||[]).map(m=>key(m.col,m.row)));
   const dupes=new Set();if(ts){const cmp=checkOf(ts);for(const d of cmp.duplicates)for(const id of d.ids)dupes.add(id);}
   const detailed=px>=18;
   for(let r=r0;r<=r1;r++)for(let q=c0;q<=c1;q++){
    const k=key(q,r),rc=cellRect(g,q,r),x=X(rc.x),y=Y(rc.y),w=X(rc.x+rc.w)-x,hh=Y(rc.y+rc.h)-y;
    c.lineWidth=1;c.strokeStyle='rgba(255,255,255,.14)';c.strokeRect(x+.5,y+.5,w-1,hh-1);
    if(blank.has(k)){c.fillStyle='rgba(0,0,0,.28)';c.fillRect(x,y,w,hh);continue;}
    const p=preview?.patterns?.[k]??(ts?.tiles[k]?.pattern);if(!p)continue;const isPrev=!!preview?.patterns?.[k];
    const alpha=isPrev?.34:.5;
    if(detailed){
     for(const z of ['c',...MODE_IDX[ts?.mode||preview?.mode||'corners-and-sides']]){
      const val=z==='c'?p[0]:p[z+1];if(val<0)continue;const zr=zoneRect(g,z);
      c.fillStyle=rgba(terrains[val]?.color||'#4cc2ff',alpha);
      c.fillRect(X(rc.x+zr.x)+1,Y(rc.y+zr.y)+1,Math.max(1,X(rc.x+zr.x+zr.w)-X(rc.x+zr.x)-2),Math.max(1,Y(rc.y+zr.y+zr.h)-Y(rc.y+zr.y)-2));
     }
    }else if(p[0]>=0){c.fillStyle=rgba(terrains[p[0]]?.color||'#4cc2ff',alpha);const d=Math.max(2,Math.round(w/3));c.fillRect(x+(w-d)/2,y+(hh-d)/2,d,d);}
    if(isPrev){c.setLineDash([3*dpr,3*dpr]);c.strokeStyle='rgba(255,255,255,.7)';c.strokeRect(x+1.5,y+1.5,w-3,hh-3);c.setLineDash([]);}
    if(!isPrev&&bad.has(k)){c.lineWidth=Math.max(2,dpr*2);c.strokeStyle='#ff6b6b';c.strokeRect(x+1,y+1,w-2,hh-2);}
    else if(!isPrev&&dupes.has(k)){c.lineWidth=Math.max(1,dpr);c.setLineDash([2*dpr,2*dpr]);c.strokeStyle='#f0b43c';c.strokeRect(x+1.5,y+1.5,w-3,hh-3);c.setLineDash([]);}
   }
   // generator source block
   const gen=genState.origin&&genState.assetId===a.id?genState:null;
   if(gen){const K=SOURCE_SIZE[gen.kind];const r0c=cellRect(g,gen.origin.col,gen.origin.row),r1c=cellRect(g,gen.origin.col+K[0]-1,gen.origin.row+K[1]-1);c.lineWidth=Math.max(2,2*dpr);c.strokeStyle='#b48cff';c.setLineDash([6*dpr,3*dpr]);c.strokeRect(X(r0c.x)-1,Y(r0c.y)-1,X(r1c.x+r1c.w)-X(r0c.x)+2,Y(r1c.y+r1c.h)-Y(r0c.y)+2);c.setLineDash([]);}
   for(const k of selection){const [q,r]=unkey(k);const rc=cellRect(g,q,r);c.lineWidth=Math.max(2,2*dpr);c.strokeStyle='#ffc83d';c.strokeRect(X(rc.x)+1,Y(rc.y)+1,X(rc.x+rc.w)-X(rc.x)-2,Y(rc.y+rc.h)-Y(rc.y)-2);}
   if(hoverZone&&ts&&detailed&&ctxTool()==='bits'){const rc=cellRect(g,hoverZone.col,hoverZone.row),zr=zoneRect(g,hoverZone.zone);c.lineWidth=Math.max(1,dpr);c.strokeStyle='#fff';c.strokeRect(X(rc.x+zr.x)+.5,Y(rc.y+zr.y)+.5,X(rc.x+zr.x+zr.w)-X(rc.x+zr.x)-1,Y(rc.y+zr.y+zr.h)-Y(rc.y+zr.y)-1);}
  }
  function draftGrid(){const a=asset();if(!a)return null;const d=drafts.get(a.id);if(!d)return null;return {...d,cols:Math.max(0,Math.floor((a.width-d.ox+d.sx)/(d.w+d.sx))),rows:Math.max(0,Math.floor((a.height-d.oy+d.sy)/(d.h+d.sy)))};}
  const ctxTool=()=>currentTool;let currentTool='';
  // ---------------------------------------------------------------- tileset tools
  function cellAt(info){
   const ts=tileset();if(!ts)return null;const g=ts.grid;
   const q=Math.floor((info.x-g.ox)/(g.w+g.sx)),r=Math.floor((info.y-g.oy)/(g.h+g.sy));
   if(q<0||r<0||q>=g.cols||r>=g.rows)return null;
   const rc=cellRect(g,q,r),lx=info.x-rc.x,ly=info.y-rc.y;if(lx<0||ly<0||lx>=g.w||ly>=g.h)return null;
   return {col:q,row:r,zone:zoneAt(g,lx,ly)};
  }
  let dragSel=null;
  const selectTool={
   cursor(){currentTool='select';wantMode('tileset');return 'default';},
   down(i){const c=cellAt(i);if(!c){if(!i.shift)setSelection([]);return false;}dragSel={from:c,add:i.shift||i.mod,base:i.shift||i.mod?[...selection]:[]};pickRect(c,c);return true;},
   move(i){if(!dragSel)return;const c=cellAt(i);if(c)pickRect(dragSel.from,c);},
   up(){dragSel=null;},cancel(){dragSel=null;},
   hover(i){const c=cellAt(i);statusTile(c);}
  };
  function pickRect(a,b){const out=new Set(dragSel?.base||[]);for(let r=Math.min(a.row,b.row);r<=Math.max(a.row,b.row);r++)for(let q=Math.min(a.col,b.col);q<=Math.max(a.col,b.col);q++)out.add(key(q,r));setSelection([...out]);}
  let stroke=null,strokeN=0;
  const bitsTool={
   cursor(){currentTool='bits';wantMode('tileset');return 'crosshair';},
   down(i){
    const ts=tileset();if(!ts){ctx.toast(t('tile.needTileset'),{error:true});return false;}
    const c=cellAt(i);if(!c)return false;
    const p=ts.tiles[key(c.col,c.row)]?.pattern;
    const erase=i.button===2||i.alt;
    const cur=c.zone==='c'?(p?p[0]:-1):(p?p[c.zone+1]:-1);
    // the first zone decides: paint the active terrain, or clear if it already has it (or right-click)
    const value=erase?-1:cur===terrain?-1:terrain;
    stroke={key:'bits'+(++strokeN),value,done:new Set()};paintZone(c,stroke);return true;
   },
   move(i){if(!stroke)return;const c=cellAt(i);if(c)paintZone(c,stroke);hoverZone=c;sheetLayer.view?.invalidate();},
   up(){if(stroke)ctx.history.close(stroke.key);stroke=null;},
   cancel(){if(stroke&&ctx.history.abort(stroke.key)){stroke=null;return;}stroke=null;},
   hover(i){const c=cellAt(i);if(c?.col!==hoverZone?.col||c?.row!==hoverZone?.row||c?.zone!==hoverZone?.zone){hoverZone=c;sheetLayer.view?.invalidate();}statusTile(c);},
   leave(){hoverZone=null;sheetLayer.view?.invalidate();}
  };
  function paintZone(c,st){
   const k=key(c.col,c.row)+':'+c.zone;if(st.done.has(k))return;st.done.add(k);
   const ts=tileset();if(c.zone!=='c'&&!MODE_IDX[ts.mode].includes(c.zone))return;
   editTs(t('tile.cmd.bits'),x=>TS.toggleBit(x,c.col,c.row,c.zone,terrain,st.value),{mergeKey:st.key,open:true});
  }
  ctx.tool({id:'tile-select',title:'tile.tool.select',icon:'tileSel',key:'V',order:10,hint:'tile.tool.selectHint',impl:selectTool});
  ctx.tool({id:'tile-bits',title:'tile.tool.bits',icon:'bits',key:'B',order:11,hint:'tile.tool.bitsHint',impl:bitsTool});
  // ---------------------------------------------------------------- map tools
  function mapCellAt(info){const m=activeMap(),ts=layerTileset();if(!m||!ts)return null;const x=Math.floor(info.x/ts.grid.w),y=Math.floor(info.y/ts.grid.h);return x>=0&&y>=0&&x<m.w&&y<m.h?{x,y}:null;}
  let mapStroke=null;
  const paintTool=kind=>({
   cursor(){currentTool=kind;wantMode('map');return kind==='picker'?'copy':'crosshair';},
   down(i){
    const m=activeMap();if(!m){ctx.toast(t('tile.map.none'),{error:true});return false;}
    const c=mapCellAt(i);if(!c)return false;const L=activeLayer();if(!L)return false;
    if(kind==='picker'){const v=St.layerGet(m,L)(c.x,c.y);if(v>=0)setTerrain(v);return false;}
    if(kind==='bucket'){const cells=St.floodCells(m,L,c.x,c.y),val=i.button===2?-1:terrain;paintMap(t('tile.cmd.fill'),cells,val);return false;}
    const val=kind==='eraser'||i.button===2?-1:terrain;
    mapStroke={key:'map'+(++strokeN),val,last:c};paintMap(t(val<0?'tile.cmd.erase':'tile.cmd.paint'),St.brushCells(c.x,c.y,brushSize),val,{mergeKey:mapStroke.key,open:true});return true;
   },
   move(i){if(!mapStroke)return;const c=mapCellAt(i);if(!c)return;hoverCell=c;
    // fill the cells between two pointer events so a fast stroke has no gaps
    const pts=line(mapStroke.last,c).flatMap(p=>St.brushCells(p.x,p.y,brushSize));mapStroke.last=c;
    paintMap(t(mapStroke.val<0?'tile.cmd.erase':'tile.cmd.paint'),pts,mapStroke.val,{mergeKey:mapStroke.key,open:true});},
   up(){if(mapStroke)ctx.history.close(mapStroke.key);mapStroke=null;},
   cancel(){if(mapStroke&&ctx.history.abort(mapStroke.key)){mapStroke=null;return;}mapStroke=null;},
   hover(i){const c=mapCellAt(i);if(c?.x!==hoverCell?.x||c?.y!==hoverCell?.y){hoverCell=c;mapLayer.view?.invalidate();statusCell(c);}},
   leave(){hoverCell=null;mapLayer.view?.invalidate();}
  });
  const line=(a,b)=>{const out=[],n=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y));for(let i=0;i<=n;i++)out.push({x:Math.round(a.x+(b.x-a.x)*i/(n||1)),y:Math.round(a.y+(b.y-a.y)*i/(n||1))});return out;};
  ctx.tool({id:'tile-brush',title:'tile.tool.brush',icon:'brush',key:'P',order:20,hint:'tile.tool.brushHint',impl:paintTool('brush')});
  ctx.tool({id:'tile-eraser',title:'tile.tool.eraser',icon:'eraser',key:'E',order:21,hint:'tile.tool.eraserHint',impl:paintTool('eraser')});
  ctx.tool({id:'tile-bucket',title:'tile.tool.bucket',icon:'bucket',key:'G',order:22,hint:'tile.tool.bucketHint',impl:paintTool('bucket')});
  ctx.tool({id:'tile-picker',title:'tile.tool.picker',icon:'picker',key:'I',order:23,hint:'tile.tool.pickerHint',impl:paintTool('picker')});
  const activeLayer=()=>{const m=activeMap();if(!m)return null;return m.layers.find(l=>l.id===layerSel)||m.layers[0];};
  let layerSel=null;
  const layerTileset=()=>{const L=activeLayer();return L?.tilesetId?tilesetById(L.tilesetId):null;};
  function paintMap(label,cells,val,opts){
   const m=activeMap(),L=activeLayer();if(!m||!L)return;
   edit(label,s=>St.updateMap(s,m.id,mm=>St.updateLayer(mm,L.id,l=>St.paintCells(mm,l,cells,val))),opts);
  }
  // ---------------------------------------------------------------- mode switching
  let modeSwitchQueued=false;
  function wantMode(m){if(m===mode||modeSwitchQueued)return;modeSwitchQueued=true;queueMicrotask(()=>{modeSwitchQueued=false;setMode(m);});}
  async function setMode(m){
   if(m===mode)return;mode=m;ctx.status('selection','');
   root?.setAttribute('data-tile-mode',mode);
   if(mode==='tileset'){view.set({grid:null});await ctx.showAsset(assetId,{restoreView:true});applyGridView();}
   else{view.set({gridVisible:false});await renderMap(true);}
   if(mode==='map'&&!['brush','eraser','bucket','picker'].includes(currentTool))ctx.setTool('tile-brush');
   if(mode==='tileset'&&!['select','bits'].includes(currentTool))ctx.setTool('tile-bits');
   refreshAll();
  }
  const root=document.querySelector('.studio');
  // ---------------------------------------------------------------- map rendering
  async function renderMap(fit=false){
   const m=activeMap();const token=++mapToken;
   if(!m){if(mode==='map'){const c=document.createElement('canvas');c.width=c.height=1;await view.setImage(c,1,1);}return;}
   const base=m.layers.map(L=>L.tilesetId?tilesetById(L.tilesetId):null).find(Boolean);
   const tw=base?.grid.w||16,th=base?.grid.h||16,W=m.w*tw,H=m.h*th;
   const c=mapCanvas&&mapCanvas.width===W&&mapCanvas.height===H?mapCanvas:Object.assign(document.createElement('canvas'),{width:W,height:H});
   const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,W,H);
   for(const L of m.layers){
    if(!L.visible)continue;const ts=L.tilesetId?tilesetById(L.tilesetId):null;if(!ts)continue;
    const a=P.assetById(ctx.doc,ts.assetId);if(!a)continue;
    let bmp;try{bmp=await ctx.images.bitmap(P.primaryBlob(a));}catch{continue;}
    if(token!==mapToken)return;
    const r=resolveLayer(m,L,ts,m.rule),g=ts.grid,off=r.offset?-tw/2:0;
    for(const [k,v] of r.cells){const [cx,cy]=unkey(k),[ac,ar]=unkey(v.id),s=cellRect(g,ac,ar);x.drawImage(bmp,s.x,s.y,s.w,s.h,cx*tw+off,cy*th+(r.offset?-th/2:0),tw,th);}
   }
   mapCanvas=c;
   if(mode!=='map')return;
   const keep=!fit&&view.image&&view.image.src===c?view.view:null;
   await view.setImage(c,W,H,{view:keep||(fit?mapView:null)});
   if(token!==mapToken)return;
   mapLayer.view?.invalidate();renderMapPanel();renderCheck();
  }
  function drawMapOverlay({ctx:c,view:v,dpr}){
   const m=activeMap(),ts=layerTileset();if(!m||!ts)return;
   const tw=ts.grid.w,th=ts.grid.h,s=v.scale,X=x=>Math.round(v.x+x*s),Y=y=>Math.round(v.y+y*s);
   if(showCells||tw*s>=8){c.lineWidth=1;c.strokeStyle='rgba(255,255,255,.08)';c.beginPath();for(let q=0;q<=m.w;q++){c.moveTo(X(q*tw)+.5,Y(0));c.lineTo(X(q*tw)+.5,Y(m.h*th));}for(let r=0;r<=m.h;r++){c.moveTo(X(0),Y(r*th)+.5);c.lineTo(X(m.w*tw),Y(r*th)+.5);}c.stroke();}
   for(const L of m.layers){
    if(!L.visible)continue;const lts=L.tilesetId?tilesetById(L.tilesetId):null;
    if(showCells){const get=St.layerGet(m,L);for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){const v2=get(x,y);if(v2<0)continue;c.fillStyle=rgba(lts?.terrains[v2]?.color||'#4cc2ff',.28);const d=Math.max(2,Math.round(tw*s/4));c.fillRect(X(x*tw+tw/2)-d/2,Y(y*th+th/2)-d/2,d,d);}}
    if(!lts||L.id!==activeLayer()?.id)continue;
    const r=resolveLayer(m,L,lts,m.rule),off=r.offset?-.5:0;
    for(const p of r.problems){
     const x0=X((p.x+off)*tw),y0=Y((p.y+off)*th),w=X((p.x+off+1)*tw)-x0,hh=Y((p.y+off+1)*th)-y0;
     c.lineWidth=Math.max(2,2*dpr);c.strokeStyle=p.kind==='wrong'?'#f0b43c':'#ff6b6b';c.strokeRect(x0+1,y0+1,w-2,hh-2);
     if(p.kind!=='wrong'){c.beginPath();c.moveTo(x0+3,y0+3);c.lineTo(x0+w-3,y0+hh-3);c.moveTo(x0+w-3,y0+3);c.lineTo(x0+3,y0+hh-3);c.stroke();}
    }
   }
   if(hoverCell){const n=brushSize,r0=Math.floor((n-1)/2);c.lineWidth=Math.max(1,dpr);c.strokeStyle='#fff';c.strokeRect(X((hoverCell.x-r0)*tw)+.5,Y((hoverCell.y-r0)*th)+.5,X(n*tw)-X(0)-1,Y(n*th)-Y(0)-1);}
  }
  let showCells=false;
  // ---------------------------------------------------------------- status helpers
  function statusTile(c){
   if(!c){ctx.status('selection',selection.length?t('tile.status.sel',{n:selection.length}):'');return;}
   const ts=tileset(),p=ts?.tiles[key(c.col,c.row)]?.pattern;
   ctx.status('selection',t('tile.status.tile',{c:c.col,r:c.row,what:p?describe(p):t('tile.notTerrain'),zone:c.zone==='c'?t('tile.zone.c'):POS[c.zone].toUpperCase()}));
  }
  function statusCell(c){
   if(!c){ctx.status('selection','');return;}
   const m=activeMap(),L=activeLayer(),ts=layerTileset();if(!m||!L||!ts)return;
   const r=resolveLayer(m,L,ts,m.rule),hit=r.cells.get(c.x+','+c.y),prob=r.problems.find(p=>p.x===c.x&&p.y===c.y);
   ctx.status('selection',t('tile.status.cell',{x:c.x,y:c.y,tile:hit?hit.id:'—',what:hit?.pattern?describe(hit.pattern):'',problem:prob?t('tile.problem.'+prob.kind):''}));
  }
  // ---------------------------------------------------------------- selection + terrain
  function setSelection(list){selection=list;sheetLayer.view?.invalidate();renderTilePanel();statusTile(null);}
  function setTerrain(i){const ts=tileset()||layerTileset();const n=ts?.terrains.length||1;terrain=Math.max(0,Math.min(n-1,i));renderTerrains();renderMapPanel();}
  // ---------------------------------------------------------------- checks (cached per tileset object)
  const checks=new WeakMap();
  function checkOf(ts){
   let c=checks.get(ts);if(c)return c;
   const entries=Object.entries(ts.tiles).map(([id,v])=>({id,pattern:v.pattern}));
   const pairs=ts.pairs||[];
   c=completeness(ts.mode,entries,{terrains:ts.terrains.length,pairs});checks.set(ts,c);return c;
  }
  // ---------------------------------------------------------------- panels
  const panels={};
  const mk=(id,dock,order,titleKey,badge)=>{const box=h('div.tl-panel',{'data-panel':id});panels[id]=box;ctx.panel({id,title:()=>t(titleKey),dock,order,badge,render(body){body.append(box);}});return box;};
  mk('tile-set','right',10,'tile.panel.set');
  mk('tile-layout','right',20,'tile.panel.layout');
  mk('tile-tile','right',30,'tile.panel.tile');
  mk('tile-map','right',40,'tile.panel.map');
  mk('tile-gen','right',50,'tile.panel.gen');
  mk('tile-export','right',60,'tile.panel.export');
  mk('tile-check','bottom',5,'tile.panel.check',()=>{const ts=tileset();if(!ts)return '';const c=checkOf(ts);const miss=c.perTerrain.reduce((s,x)=>s+x.missing.length,0);return miss?String(miss):'';});
  const sec=(title,...kids)=>h('div.st-sec',{},title?h('div.st-sec-head',{},...[].concat(title)):null,...kids);
  const btn=(label,run,{primary=false,disabled=false,action=null,title=null}={})=>{const b=h('button.st-btn'+(primary?'.primary':''),{type:'button',disabled,'data-action':action,title});b.textContent=label;b.addEventListener('click',run);return b;};
  const conf=c=>h('span.st-conf.is-'+c,{},t('grid.conf.'+c));
  // ---- Tileset panel
  function renderSet(){
   const box=panels['tile-set'],a=asset();
   if(!a){box.replaceChildren(h('p.st-muted.st-pad',{},t('tile.noImage')));return;}
   const ts=tileset();
   const list=St.tilesetsOf(S());
   const listSec=list.length?sec(t('tile.set.list',{n:list.length}),h('div.tl-setlist',{},list.map(x=>{const on=x.assetId===a.id;const b=h('button.tl-setitem',{type:'button','aria-pressed':String(on),'data-tileset':x.id},h('b',{},x.name),h('small',{},`${x.grid.w}×${x.grid.h} · ${Object.keys(x.tiles).length} ${t('tile.tiles')} · ${t('tile.mode.'+x.mode)}`));b.addEventListener('click',()=>ctx.showAsset(x.assetId));return b;}))):null;
   if(!ts){
    const d=detect.get(a.id),g=drafts.get(a.id);
    const sug=h('div.st-sugs',{});
    if(!d||d.status==='running')sug.append(h('p.st-muted',{},t('grid.detecting')));
    else if(d.status==='error')sug.append(h('p.st-error',{},d.error));
    else{
     const fits=d.fits||[];
     const all=[...fits.map(f=>({...f.grid,fit:f})),...d.candidates.filter(c=>!fits.some(f=>f.grid.w===c.w&&f.grid.h===c.h&&f.grid.ox===c.ox&&f.grid.sx===c.sx))];
     if(!all.length)sug.append(h('p.st-muted',{},t('tile.set.noGrid')));
     all.slice(0,6).forEach((c,i)=>{
      const on=g&&g.w===c.w&&g.h===c.h&&g.ox===c.ox&&g.oy===c.oy&&g.sx===c.sx&&g.sy===c.sy;
      const b=h('button.st-sug',{type:'button','aria-pressed':String(!!on),'data-grid-sug':String(i)},h('b',{},`${c.w}×${c.h}`),
       h('span.st-sug-meta',{},[c.ox||c.oy?t('grid.margin',{v:c.ox}):'',c.sx||c.sy?t('grid.gap',{v:c.sx}):''].filter(Boolean).join(' · ')),
       c.fit?h('span.st-conf.is-high',{},t('tile.set.fits',{layout:layoutName(c.fit.layoutId)})):i===(fits.length)?h('span.st-conf.is-'+c.confidence,{},t('grid.conf.'+c.confidence)+' '+Math.round(c.score*100)+'%'):h('span.st-conf.is-alt',{},t('grid.alt')+' '+Math.round((c.score||0)*100)+'%'));
      b.addEventListener('click',()=>setDraft({w:c.w,h:c.h,ox:c.ox,oy:c.oy,sx:c.sx,sy:c.sy}));sug.append(b);
     });
    }
    const f=(k,label,min)=>{const i=h('input.st-input.st-num',{type:'number',min:String(min),step:'1',value:g?String(g[k]):'','data-tile-grid':k,'aria-label':t(label)});i.addEventListener('change',()=>{const cur=drafts.get(a.id)||{w:16,h:16,ox:0,oy:0,sx:0,sy:0};setDraft({...cur,[k]:Math.max(min,Math.round(Number(i.value)||0))});});return h('label.st-field.st-field-inline',{},h('span',{},t(label)),i);};
    const dg=draftGrid();
    box.replaceChildren(
     sec([h('span',{},t('tile.set.setup')),btn(t('grid.detect'),()=>runDetect(true),{action:'tile-detect'})],h('p.st-muted.tl-lead',{},t('tile.set.lead')),sug),
     sec(t('grid.cellTitle'),h('div.st-grid-fields',{},f('w','grid.w',1),f('h','grid.h',1),f('ox','grid.ox',0),f('oy','grid.oy',0),f('sx','grid.sx',0),f('sy','grid.sy',0)),
      h('p.st-muted',{},dg?t('tile.set.count',{c:dg.cols,r:dg.rows,n:dg.cols*dg.rows}):t('tile.set.pick')),
      h('p.st-grid-state.is-preview',{},g?t('grid.statePreview'):t('grid.stateNone')),
      h('div.st-row',{},btn(t('tile.set.apply'),()=>applyGrid(),{primary:true,disabled:!dg||!dg.cols||!dg.rows,action:'tile-apply-grid'}))),
     listSec);
    return;
   }
   const blank=blanks.get(a.id)?.blank?.length??null,n=Object.keys(ts.tiles).length,g=ts.grid;
   const name=h('input.st-input',{type:'text',value:ts.name,'aria-label':t('tile.set.name'),'data-tile':'name'});name.addEventListener('change',()=>editTs(t('tile.cmd.rename'),x=>({...x,name:name.value.trim().slice(0,80)||x.name})));
   const modeSel=h('select.st-input',{'data-tile':'mode','aria-label':t('tile.set.mode')},MODES.map(m=>h('option',{value:m,selected:m===ts.mode},t('tile.mode.'+m))));
   modeSel.addEventListener('change',()=>editTs(t('tile.cmd.mode'),x=>TS.setMode(x,modeSel.value)));
   box.replaceChildren(
    sec(t('tile.set.this'),h('label.st-field',{},h('span',{},t('tile.set.name')),name),
     h('p.st-muted',{},t('tile.set.summary',{w:g.w,h:g.h,c:g.cols,r:g.rows,n,blank:blank??'…',m:g.ox,s:g.sx})),
     h('label.st-field',{},h('span',{},t('tile.set.mode')),modeSel),h('p.st-muted.tl-small',{},t('tile.modeHelp.'+ts.mode)),
     h('div.st-row',{},btn(t('tile.set.regrid'),()=>{drafts.set(a.id,{w:g.w,h:g.h,ox:g.ox,oy:g.oy,sx:g.sx,sy:g.sy});edit(t('tile.cmd.removeTs'),s=>St.removeTileset(s,ts.id));},{action:'tile-regrid'}))),
    terrainSec(ts),listSec);
  }
  function terrainSec(ts){
   const rows=ts.terrains.map((tr,i)=>{
    const on=i===terrain;
    const pick=h('button.tl-terrain-pick',{type:'button','aria-pressed':String(on),'data-terrain':String(i),title:t('tile.terrain.use')},h('span.tl-swatch',{style:{background:tr.color}}),String(i+1));
    pick.addEventListener('click',()=>setTerrain(i));
    const col=h('input.tl-color',{type:'color',value:tr.color,'aria-label':t('tile.terrain.color')});col.addEventListener('change',()=>editTs(t('tile.cmd.terrain'),x=>TS.updateTerrain(x,i,{color:col.value})));
    const nm=h('input.st-input',{type:'text',value:tr.name,'aria-label':t('tile.terrain.name')});nm.addEventListener('change',()=>editTs(t('tile.cmd.terrain'),x=>TS.updateTerrain(x,i,{name:nm.value.trim()||tr.name})));
    const del=h('button.st-icon-btn',{type:'button',title:t('tile.terrain.remove'),'aria-label':t('tile.terrain.remove'),disabled:ts.terrains.length<=1});del.innerHTML=ICONS.trash;del.addEventListener('click',()=>{editTs(t('tile.cmd.terrain'),x=>TS.removeTerrain(x,i));setTerrain(0);});
    return h('div.tl-terrain',{},pick,col,nm,del);
   });
   const add=btn(t('tile.terrain.add'),()=>{editTs(t('tile.cmd.terrain'),x=>TS.addTerrain(x));setTerrain(ts.terrains.length);},{disabled:ts.terrains.length>=16,action:'tile-add-terrain'});
   return sec([h('span',{},t('tile.terrain.title')),add],h('div.tl-terrains',{},rows),h('p.st-muted.tl-small',{},t('tile.terrain.hint')));
  }
  const renderTerrains=()=>{renderSet();};
  function setDraft(g){const a=asset();if(!a)return;drafts.set(a.id,g);applyGridView();renderSet();loadBlanks(g);}
  function applyGridView(){const ts=tileset(),g=ts?ts.grid:draftGrid();if(mode!=='tileset')return;view.set({grid:null,gridVisible:false});sheetLayer.view?.invalidate();}
  async function runDetect(force=false){
   const a=asset();if(!a)return;const b=blobOf(a),k=a.id+':'+b.id;
   const cur=detect.get(a.id);if(cur&&!force&&cur.key===k)return;
   detect.set(a.id,{key:k,status:'running'});renderSet();
   try{const r=await work({op:'detect',key:b.id,blob:b.blob});detect.set(a.id,{key:k,status:'done',...r});
    // pre-fill the best reading as a PREVIEW only: nothing is applied until "Use this grid"
    const first=r.fits?.[0]?.grid||r.candidates[0];if(first&&!drafts.get(a.id)&&!tileset())setDraft({w:first.w,h:first.h,ox:first.ox,oy:first.oy,sx:first.sx,sy:first.sy});
   }catch(e){detect.set(a.id,{key:k,status:'error',error:String(e.message||e)});}
   if(a.id===assetId)renderSet();
  }
  async function loadBlanks(g){const a=asset();if(!a||!g)return;const b=blobOf(a);try{const r=await work({op:'blank',key:b.id,blob:b.blob,grid:g});blanks.set(a.id,{grid:g,blank:r.blank});sheetLayer.view?.invalidate();renderSet();}catch{}}
  function applyGrid(){
   const a=asset(),dg=draftGrid();if(!a||!dg)return;
   const ts=TS.createTileset({assetId:a.id,name:a.name.replace(/\.[^.]+$/,''),grid:dg});
   edit(t('tile.cmd.makeTs',{w:dg.w,h:dg.h}),s=>St.putTileset(s,ts));
   drafts.delete(a.id);loadBlanks(ts.grid);runIdentify(true);
   ctx.toast(t('tile.toast.tileset',{n:dg.cols*dg.rows}));
  }
  // ---- Layout panel
  const layoutName=id=>{const L=layoutById(id);if(L)return L.names[0];return t('tile.source.'+id);};
  async function runIdentify(force=false){
   const a=asset(),ts=tileset();if(!a||!ts)return;const b=blobOf(a),k=b.id+JSON.stringify(ts.grid);
   const cur=ident.get(ts.id);if(cur&&!force&&cur.key===k)return;
   ident.set(ts.id,{key:k,status:'running'});renderLayout();
   try{const r=await work({op:'identify',key:b.id,blob:b.blob,grid:gridOf(ts)});ident.set(ts.id,{key:k,status:'done',...r});}
   catch(e){ident.set(ts.id,{key:k,status:'error',error:String(e.message||e)});}
   renderLayout();
  }
  function previewCandidate(c,terrainsFromBlocks=null){
   const ts=tileset();if(!ts)return;
   if(c.source){preview=null;sheetLayer.view?.invalidate();startGenerator(c.layoutId==='rpgmaker-a4-wall'?'rpgmaker-a4-wall':c.layoutId,{col:c.col,row:c.row});return;}
   const L=layoutById(c.layoutId),patterns={};
   if(terrainsFromBlocks){for(const b of terrainsFromBlocks.blocks){const LL=layoutById(b.layoutId);for(const cell of placeLayout(LL,b.col,b.row,b.a))patterns[key(cell.col,cell.row)]=TS.withB(cell.pattern,LL.mode,b.a,b.b);}}
   else for(const cell of placeLayout(L,c.col,c.row))patterns[key(cell.col,cell.row)]=cell.pattern;
   preview={kind:'layout',layoutId:c.layoutId,mode:L.mode,patterns,candidate:c,blocks:terrainsFromBlocks};
   sheetLayer.view?.invalidate();renderLayout();
  }
  function applyPreview(){
   const ts=tileset();if(!ts||!preview)return;const pv=preview;
   if(pv.kind==='layout'){
    edit(t('tile.cmd.applyLayout',{name:layoutName(pv.layoutId)}),s=>St.updateTileset(s,ts.id,x=>{
     let y=TS.setMode(x,pv.mode);
     if(pv.blocks){const need=pv.blocks.terrains.length;while(y.terrains.length<need)y=TS.addTerrain(y);}
     y=TS.setPatterns(y,Object.entries(pv.patterns).map(([k,p])=>{const [col,row]=unkey(k);return {col,row,pattern:p};}));
     return {...y,layoutId:pv.layoutId};
    }));
   }else if(pv.kind==='suggest'){
    edit(t('tile.cmd.applySuggest',{n:Object.keys(pv.patterns).length}),s=>St.updateTileset(s,ts.id,x=>TS.setPatterns(x,Object.entries(pv.patterns).map(([k,p])=>{const [col,row]=unkey(k);return {col,row,pattern:p};}))));
   }
   preview=null;sheetLayer.view?.invalidate();renderLayout();runArt();
   ctx.toast(t('tile.toast.applied'));
  }
  async function runSuggest(){
   const a=asset(),ts=tileset();if(!a||!ts)return;const b=blobOf(a);
   const full=selection.length===1?(()=>{const [col,row]=unkey(selection[0]);return {col,row};})():null;
   suggest.set(ts.id,{status:'running'});renderLayout();
   try{
    const r=await work({op:'suggest',key:b.id,blob:b.blob,grid:gridOf(ts),mode:ts.mode,terrain,full});
    suggest.set(ts.id,{status:'done',...r});
    if(r.measurable){const patterns={};for(const x of r.tiles)patterns[key(x.col,x.row)]=x.pattern;preview={kind:'suggest',mode:ts.mode,patterns,result:r};sheetLayer.view?.invalidate();}
   }catch(e){suggest.set(ts.id,{status:'error',error:String(e.message||e)});}
   renderLayout();
  }
  function renderLayout(){
   const box=panels['tile-layout'],ts=tileset();
   if(!ts){box.replaceChildren(h('p.st-muted.st-pad',{},t('tile.needTileset')));return;}
   const d=ident.get(ts.id),list=h('div.st-sugs',{'data-tile':'candidates'});
   if(!d||d.status==='running')list.append(h('p.st-muted',{},t('tile.layout.running')));
   else if(d.status==='error')list.append(h('p.st-error',{},d.error));
   else{
    if(d.reason==='too-many-tiles')list.append(h('p.st-muted',{},t('tile.layout.tooMany')));
    for(const hint of d.hints||[]){
     const b=btn(t('tile.layout.useHint'),()=>startGenerator(hint.layoutId==='rpgmaker-a4'?'rpgmaker-a2':hint.layoutId,{col:0,row:0}),{action:'tile-hint'});
     list.append(h('div.tl-cand.is-hint',{},h('div.tl-cand-head',{},h('b',{},t('tile.source.'+hint.layoutId)),h('span.st-conf.is-medium',{},t('tile.layout.bySize'))),h('p.st-muted.tl-small',{},hint.detail),b));
    }
    const top=d.candidates.filter(c=>c.confidence!=='low'||d.candidates.indexOf(c)<3).slice(0,5);
    if(!top.length&&!(d.hints||[]).length)list.append(h('p.st-muted',{},t('tile.layout.none')));
    top.forEach((c,i)=>{
     const multi=i===0&&d.blockTerrains&&d.blockTerrains.blocks.length>1;
     const on=preview?.kind==='layout'&&preview.layoutId===c.layoutId&&preview.candidate?.col===c.col&&preview.candidate?.row===c.row;
     const b=h('button.tl-cand',{type:'button','aria-pressed':String(on),'data-cand':c.layoutId},
      h('div.tl-cand-head',{},h('b',{},layoutName(c.layoutId)),i===0?conf(c.confidence):h('span.st-conf.is-alt',{},t('grid.alt'))),
      h('span.st-sug-meta',{},t('tile.layout.meta',{score:(c.auc*100).toFixed(1),col:c.col,row:c.row,cells:c.cells,missing:c.missing,extra:c.extra})+(multi?' · '+t('tile.layout.blocks',{n:d.blockTerrains.blocks.length,t:d.blockTerrains.terrains.length}):'')));
     b.addEventListener('click',()=>previewCandidate(c,multi?d.blockTerrains:null));list.append(b);
    });
    if(d.candidates[0]&&d.candidates[0].confidence!=='high')list.append(h('p.st-close',{},t('tile.layout.unsure')));
   }
   const sg=suggest.get(ts.id);
   const pv=preview?h('div.tl-preview',{'data-tile':'preview'},h('p',{},preview.kind==='layout'?t('tile.layout.previewLayout',{name:layoutName(preview.layoutId),n:Object.keys(preview.patterns).length}):t('tile.layout.previewSuggest',{n:Object.keys(preview.patterns).length,sep:Math.round((preview.result?.separation||0)*100)})),
    h('div.st-row',{},btn(t('tile.layout.apply'),applyPreview,{primary:true,action:'tile-apply-preview'}),btn(t('tile.layout.discard'),()=>{preview=null;sheetLayer.view?.invalidate();renderLayout();},{action:'tile-discard'}))):null;
   const tmpl=h('select.st-input',{'data-tile':'template','aria-label':t('tile.layout.template')},h('option',{value:''},t('tile.layout.templatePick')),LAYOUTS.map(L=>h('option',{value:L.id},`${L.names[0]} (${L.cols}×${L.rows})`)));
   tmpl.addEventListener('change',()=>{if(!tmpl.value)return;const L=layoutById(tmpl.value);const at=selection.length?unkey(selection.slice().sort()[0]):[0,0];previewCandidate({layoutId:L.id,col:Math.min(at[0],Math.max(0,ts.grid.cols-L.cols)),row:Math.min(at[1],Math.max(0,ts.grid.rows-L.rows)),auc:0,cells:L.cols*L.rows,missing:0,extra:0});});
   box.replaceChildren(
    sec([h('span',{},t('tile.layout.found')),btn(t('tile.layout.rerun'),()=>runIdentify(true),{action:'tile-identify'})],list),
    pv,
    sec(t('tile.layout.other'),h('label.st-field',{},h('span',{},t('tile.layout.template')),tmpl),h('p.st-muted.tl-small',{},t('tile.layout.templateHint')),
     h('div.st-row',{},btn(sg?.status==='running'?t('tile.layout.suggesting'):t('tile.layout.suggest'),runSuggest,{action:'tile-suggest',disabled:sg?.status==='running'})),
     sg?.status==='done'&&!sg.measurable?h('p.st-error.tl-small',{},t('tile.layout.notMeasurable.'+(sg.reason||'x'))):null,
     h('p.st-muted.tl-small',{},t('tile.layout.suggestHint'))));
  }
  // ---- Tile panel
  function renderTilePanel(){
   const box=panels['tile-tile'],ts=tileset();
   if(!ts){box.replaceChildren(h('p.st-muted.st-pad',{},t('tile.needTileset')));return;}
   if(!selection.length){box.replaceChildren(h('p.st-muted.st-pad',{},t('tile.tile.none',{v:'V',b:'B'})));return;}
   const k=selection[0],[col,row]=unkey(k),p=ts.tiles[k]?.pattern||null;
   const grid=h('div.tl-bitgrid',{role:'group','aria-label':t('tile.tile.bits')});
   for(const rowZ of ZONES)for(const z of rowZ){
    const val=p?(z==='c'?p[0]:p[z+1]):-1,used=z==='c'||MODE_IDX[ts.mode].includes(z);
    const b=h('button.tl-bit',{type:'button',disabled:!used,'data-zone':String(z),'aria-pressed':String(val>=0),title:z==='c'?t('tile.zone.c'):POS[z].toUpperCase(),style:val>=0?{background:ts.terrains[val]?.color}:{}},z==='c'?(val>=0?String(val+1):'·'):'');
    b.addEventListener('click',e=>{const erase=e.altKey;const cur=val;const v=erase?-1:cur===terrain?-1:terrain;editTs(t('tile.cmd.bits'),x=>{let y=x;for(const kk of selection){const [q,r]=unkey(kk);y=TS.toggleBit(y,q,r,z,terrain,v);}return y;});});
    grid.append(b);
   }
   const prob=h('input.st-input.st-num',{type:'number',min:'0',step:'0.1',value:String(ts.tiles[k]?.probability??1),'aria-label':t('tile.tile.prob'),disabled:!p});
   prob.addEventListener('change',()=>editTs(t('tile.cmd.prob'),x=>{const tiles={...x.tiles};for(const kk of selection)if(tiles[kk])tiles[kk]={...tiles[kk],probability:Math.max(0,Number(prob.value)||0)};return {...x,tiles};}));
   box.replaceChildren(sec(selection.length===1?t('tile.tile.one',{c:col,r:row}):t('tile.tile.many',{n:selection.length}),
    h('div.tl-tilerow',{},grid,h('div.tl-tileinfo',{},h('p',{},p?describe(p):t('tile.notTerrain')),h('p.st-muted.tl-small',{},t('tile.tile.help')))),
    h('label.st-field.st-field-inline',{},h('span',{},t('tile.tile.prob')),prob),
    h('div.st-row',{},btn(t('tile.tile.full'),()=>setSel(()=>{const q=[terrain,-1,-1,-1,-1,-1,-1,-1,-1];for(const i of MODE_IDX[ts.mode])q[i+1]=terrain;return q;}),{action:'tile-full'}),
     btn(t('tile.tile.clear'),()=>setSel(()=>null),{action:'tile-clear'}),btn(t('tile.tile.rotate'),()=>setSel(q=>q&&rotate(q)),{title:'R'}),btn(t('tile.tile.mirror'),()=>setSel(q=>q&&mirror(q))),
     btn(t('tile.tile.copy'),copyPattern,{title:ctx.shortcutOf('tile.copy')}),btn(t('tile.tile.paste'),pastePattern,{disabled:!clipboard,title:ctx.shortcutOf('tile.paste')}))));
  }
  function setSel(fn){const ts=tileset();if(!ts||!selection.length)return;editTs(t('tile.cmd.bits'),x=>{let y=x;for(const kk of selection){const [q,r]=unkey(kk);y=TS.setPattern(y,q,r,fn(y.tiles[kk]?.pattern||null));}return y;});}
  function copyPattern(){const ts=tileset();if(!ts||!selection.length)return;clipboard=ts.tiles[selection[0]]?.pattern||null;ctx.toast(clipboard?t('tile.toast.copied',{what:describe(clipboard)}):t('tile.notTerrain'));renderTilePanel();}
  function pastePattern(){if(!clipboard)return;setSel(()=>clipboard.slice());}
  // ---- Check panel
  function runArt(){
   const a=asset(),ts=tileset();if(!a||!ts)return;const b=blobOf(a),k=b.id+JSON.stringify(ts.grid)+JSON.stringify(ts.tiles)+ts.mode;
   const cur=art.get(ts.id);if(cur?.key===k)return;art.set(ts.id,{key:k,status:'running'});
   const patterns=Object.fromEntries(Object.entries(ts.tiles).map(([kk,v])=>[kk,v.pattern]));
   clearTimeout(runArt.timer);runArt.timer=setTimeout(async()=>{
    try{const r=await work({op:'art',key:b.id,blob:b.blob,grid:gridOf(ts),mode:ts.mode,patterns});if(art.get(ts.id)?.key!==k)return;art.set(ts.id,{key:k,status:'done',...r});}
    catch(e){art.set(ts.id,{key:k,status:'error',error:String(e.message||e)});}
    renderCheck();sheetLayer.view?.invalidate();
   },250);
  }
  function renderCheck(){
   const box=panels['tile-check'];ctx.badge('tile-check');
   const ts=mode==='map'?layerTileset():tileset();
   if(mode==='map'){renderMapProblems(box);return;}
   if(!ts){box.replaceChildren(h('p.st-muted.st-pad',{},t('tile.needTileset')));return;}
   const c=checkOf(ts),a=art.get(ts.id),n=Object.keys(ts.tiles).length;
   const items=[];
   if(!n)items.push(h('p.tl-state.is-none',{'data-check':'empty'},t('tile.check.empty')));
   for(const pt of c.perTerrain){
    if(!pt.used)continue;
    const tr=ts.terrains[pt.terrain];
    const head=h('div.tl-check-head',{},h('span.tl-swatch',{style:{background:tr?.color}}),h('b',{},tr?.name||'?'),h('span',{},t('tile.check.have',{a:pt.present,b:pt.expected})));
    const ghosts=h('div.tl-ghosts',{},pt.missing.slice(0,64).map(p=>ghost(p,ts)));
    items.push(h('div.tl-check-block',{'data-check':'missing','data-missing':String(pt.missing.length)},head,pt.missing.length?h('p.tl-state.is-bad',{},t('tile.check.missing',{n:pt.missing.length})):h('p.tl-state.is-ok',{},t('tile.check.allPatterns')),ghosts));
   }
   if(c.duplicates.length)items.push(h('div.tl-check-block',{'data-check':'dupes'},h('p.tl-state.is-warn',{},t('tile.check.dupes',{n:c.duplicates.length})),h('div.tl-links',{},c.duplicates.slice(0,20).map(d=>{const b=h('button.st-link',{type:'button'},describe(d.pattern)+' ×'+d.ids.length);b.addEventListener('click',()=>setSelection(d.ids));return b;})),h('p.st-muted.tl-small',{},t('tile.check.dupesHint'))));
   if(c.invalid.length)items.push(h('div.tl-check-block',{'data-check':'invalid'},h('p.tl-state.is-bad',{},t('tile.check.invalid',{n:c.invalid.length})),h('div.tl-links',{},c.invalid.slice(0,20).map(x=>{const b=h('button.st-link',{type:'button'},x.id+' '+x.position.toUpperCase());b.addEventListener('click',()=>setSelection([x.id]));return b;}))));
   // art vs bits: only a measured result can be clean
   let artEl;
   if(!n)artEl=null;
   else if(!a||a.status==='running')artEl=h('p.tl-state.is-none',{'data-check':'art-running'},t('tile.check.artRunning'));
   else if(a.status==='error')artEl=h('p.st-error',{},a.error);
   else if(!a.measurable)artEl=h('p.tl-state.is-none',{'data-check':'art-unmeasurable'},t('tile.check.artNot.'+(a.reason||'x')));
   else if(a.mismatches.length)artEl=h('div',{'data-check':'art-bad'},h('p.tl-state.is-bad',{},t('tile.check.artBad',{n:a.mismatches.length})),h('div.tl-links',{},a.mismatches.slice(0,30).map(m=>{const b=h('button.st-link',{type:'button'},`${m.col},${m.row}: `+m.positions.map(p=>POS[p.pos].toUpperCase()+(p.expected==='connected'?'✗':'○')).join(' '));b.addEventListener('click',()=>setSelection([key(m.col,m.row)]));return b;})));
   else artEl=h('p.tl-state.is-ok',{'data-check':'art-ok'},t('tile.check.artOk',{auc:((a.side?.auc??0)*100).toFixed(0)}));
   const complete=n&&c.complete&&!c.duplicates.length&&!c.invalid.length&&a?.status==='done'&&a.measurable&&!a.mismatches.length;
   const verdict=h('p.tl-verdict'+(complete?'.is-ok':'.is-open'),{'data-verdict':complete?'complete':'open'},complete?t('tile.check.verdictOk'):t('tile.check.verdictOpen'));
   box.replaceChildren(h('div.tl-check',{},verdict,...items,artEl?h('div.tl-check-block',{},h('div.tl-check-head',{},h('b',{},t('tile.check.art'))),artEl):null));
  }
  function ghost(p,ts){
   const c=h('canvas.tl-ghost',{width:24,height:24,title:describe(p)}),x=c.getContext('2d');
   x.fillStyle='rgba(255,255,255,.06)';x.fillRect(0,0,24,24);
   for(const z of ['c',...MODE_IDX[ts.mode]]){const v=z==='c'?p[0]:p[z+1];if(v<0)continue;const zr=zoneRect({w:24,h:24},z);x.fillStyle=ts.terrains[v]?.color||'#4cc2ff';x.fillRect(zr.x+1,zr.y+1,zr.w-2,zr.h-2);}
   return c;
  }
  function renderMapProblems(box){
   const m=activeMap(),L=activeLayer(),ts=layerTileset();
   if(!m||!L||!ts){box.replaceChildren(h('p.st-muted.st-pad',{},t('tile.map.none')));return;}
   const r=resolveLayer(m,L,ts,m.rule),miss=r.problems.filter(p=>p.kind!=='wrong'),wrong=r.problems.filter(p=>p.kind==='wrong');
   const ok=r.painted>0&&!r.problems.length;
   box.replaceChildren(h('div.tl-check',{},
    h('p.tl-verdict'+(ok?'.is-ok':'.is-open'),{'data-verdict':ok?'map-ok':'map-open','data-wrong':String(wrong.length),'data-missing':String(miss.length)},!r.painted?t('tile.map.paintFirst'):ok?t('tile.map.ok',{n:r.painted,rule:t('tile.rule.'+m.rule)}):t('tile.map.bad',{w:wrong.length,m:miss.length,rule:t('tile.rule.'+m.rule)})),
    h('p.st-muted.tl-small',{},t('tile.map.ruleHelp.'+m.rule)),
    h('div.tl-links',{},r.problems.slice(0,40).map(p=>{const b=h('button.st-link',{type:'button'},`${p.x},${p.y} ${t('tile.problem.'+p.kind)}${p.want?' → '+describe(p.want):''}`);b.addEventListener('click',()=>{view.reveal({x:p.x*ts.grid.w,y:p.y*ts.grid.h,w:ts.grid.w,h:ts.grid.h});hoverCell={x:p.x,y:p.y};mapLayer.view?.invalidate();statusCell(hoverCell);});return b;}))));
  }
  // ---- Map panel
  function renderMapPanel(){
   const box=panels['tile-map'],s=S(),maps=Object.values(s.maps||{}),m=activeMap(),sets=St.tilesetsOf(s);
   const create=btn(t('tile.map.new'),()=>{const ts=tileset()||sets[0];const map=St.createMap({name:t('tile.map.defaultName',{n:maps.length+1}),tilesetId:ts?.id||null});edit(t('tile.cmd.newMap'),x=>St.putMap(x,map));layerSel=null;setMode('map');},{primary:!m,action:'tile-new-map',disabled:!sets.length});
   if(!m){box.replaceChildren(sec(t('tile.map.title'),h('p.st-muted',{},sets.length?t('tile.map.intro'):t('tile.map.needSet')),h('div.st-row',{},create)));return;}
   const pickMap=h('select.st-input',{'aria-label':t('tile.map.title'),'data-tile':'map'},maps.map(x=>h('option',{value:x.id,selected:x.id===m.id},x.name)));
   pickMap.addEventListener('change',()=>{edit(t('tile.cmd.pickMap'),x=>({...x,activeMap:pickMap.value}));layerSel=null;renderMap(true);});
   const num=(k,label)=>{const i=h('input.st-input.st-num',{type:'number',min:'2',max:String(St.MAX_MAP),value:String(m[k]),'aria-label':t(label),'data-map':k});i.addEventListener('change',()=>edit(t('tile.cmd.resize'),x=>St.updateMap(x,m.id,mm=>St.resizeMap(mm,k==='w'?Number(i.value):mm.w,k==='h'?Number(i.value):mm.h))));return h('label.st-field.st-field-inline',{},h('span',{},t(label)),i);};
   const rule=h('div.tl-seg',{role:'radiogroup','aria-label':t('tile.map.rule')},['godot','tiled'].map(r=>{const b=h('button.tl-segbtn',{type:'button',role:'radio','aria-checked':String(m.rule===r),'data-rule':r},t('tile.rule.'+r));b.addEventListener('click',()=>edit(t('tile.cmd.rule'),x=>St.updateMap(x,m.id,mm=>({...mm,rule:r}))));return b;}));
   const L=activeLayer();
   const layers=h('div.tl-layers',{role:'listbox','aria-label':t('tile.map.layers')},m.layers.slice().reverse().map(l=>{
    const on=l.id===L?.id;const eye=h('button.st-icon-btn',{type:'button','aria-pressed':String(l.visible),title:t('tile.map.visible'),'aria-label':t('tile.map.visible')});eye.innerHTML=ICONS.eye;eye.addEventListener('click',e=>{e.stopPropagation();edit(t('tile.cmd.layer'),x=>St.updateMap(x,m.id,mm=>St.updateLayer(mm,l.id,ll=>({...ll,visible:!ll.visible}))));});
    const tsSel=h('select.st-input.tl-layer-ts',{'aria-label':t('tile.map.layerTileset')},h('option',{value:''},'—'),sets.map(x=>h('option',{value:x.id,selected:x.id===l.tilesetId},x.name)));
    tsSel.addEventListener('click',e=>e.stopPropagation());tsSel.addEventListener('change',()=>edit(t('tile.cmd.layer'),x=>St.updateMap(x,m.id,mm=>St.updateLayer(mm,l.id,ll=>({...ll,tilesetId:tsSel.value||null})))));
    const row=h('div.tl-layer',{role:'option','aria-selected':String(on),'data-layer':l.id,tabindex:'-1'},eye,h('span.tl-layer-name',{},l.name),tsSel);
    row.addEventListener('click',()=>{layerSel=l.id;renderMapPanel();renderCheck();mapLayer.view?.invalidate();});
    row.addEventListener('dblclick',()=>{const n=prompt(t('dialog.name'),l.name);if(n)edit(t('tile.cmd.layer'),x=>St.updateMap(x,m.id,mm=>St.updateLayer(mm,l.id,ll=>({...ll,name:n.slice(0,40)}))));});
    return row;}));
   const addL=btn(t('tile.map.addLayer'),()=>edit(t('tile.cmd.layer'),x=>St.updateMap(x,m.id,mm=>St.addLayer(mm,{tilesetId:L?.tilesetId||null}))),{action:'tile-add-layer'});
   const delL=btn(t('tile.map.removeLayer'),()=>edit(t('tile.cmd.layer'),x=>St.updateMap(x,m.id,mm=>St.removeLayer(mm,L.id))),{disabled:m.layers.length<=1});
   const up=btn('▲',()=>edit(t('tile.cmd.layer'),x=>St.updateMap(x,m.id,mm=>St.moveLayer(mm,L.id,1))),{title:t('panel.up')}),dn=btn('▼',()=>edit(t('tile.cmd.layer'),x=>St.updateMap(x,m.id,mm=>St.moveLayer(mm,L.id,-1))),{title:t('panel.down')});
   const ts=layerTileset();
   const pal=ts?h('div.tl-palette',{role:'radiogroup','aria-label':t('tile.terrain.title')},ts.terrains.map((tr,i)=>{const b=h('button.tl-terrain-pick',{type:'button',role:'radio','aria-checked':String(i===terrain),'data-terrain':String(i),title:tr.name},h('span.tl-swatch',{style:{background:tr.color}}),tr.name);b.addEventListener('click',()=>setTerrain(i));return b;})):h('p.st-muted',{},t('tile.map.layerNoSet'));
   const size=h('div.tl-seg',{role:'radiogroup','aria-label':t('tile.map.brush')},[1,2,3,5].map(n=>{const b=h('button.tl-segbtn',{type:'button',role:'radio','aria-checked':String(brushSize===n)},n+'×'+n);b.addEventListener('click',()=>{brushSize=n;renderMapPanel();});return b;}));
   const cellsChk=h('input',{type:'checkbox',checked:showCells});cellsChk.addEventListener('change',()=>{showCells=cellsChk.checked;mapLayer.view?.invalidate();});
   const rand=btn(t('tile.map.random'),()=>{const n=ts?.terrains.length||1;edit(t('tile.cmd.random'),x=>St.updateMap(x,m.id,mm=>St.updateLayer(mm,L.id,ll=>({...ll,cells:St.randomCells(mm,(Date.now()%100000)+1,n,n>1?.8:.55)}))));},{action:'tile-random'});
   const clear=btn(t('tile.map.clear'),()=>edit(t('tile.cmd.clearMap'),x=>St.updateMap(x,m.id,mm=>St.updateLayer(mm,L.id,ll=>({...ll,cells:'.'.repeat(mm.w*mm.h)})))),{action:'tile-clear-map'});
   const view2=btn(mode==='map'?t('tile.map.showSheet'):t('tile.map.showMap'),()=>setMode(mode==='map'?'tileset':'map'),{primary:mode!=='map',action:'tile-toggle-view',title:ctx.shortcutOf('tile.view')});
   const del=btn(t('tile.map.remove'),()=>{edit(t('tile.cmd.removeMap'),x=>St.removeMap(x,m.id));renderMap(true);});
   box.replaceChildren(
    sec([h('span',{},t('tile.map.title')),create],h('div.st-row',{},pickMap),h('div.st-grid-fields',{},num('w','tile.map.w'),num('h','tile.map.h')),h('div.st-row',{},view2,del)),
    sec(t('tile.map.rule'),rule,h('p.st-muted.tl-small',{},t('tile.map.ruleHelp.'+m.rule))),
    sec(t('tile.terrain.title'),pal,h('p.st-muted.tl-small',{},t('tile.map.paletteHint'))),
    sec(t('tile.map.brush'),size,h('label.st-check',{},cellsChk,' ',t('tile.map.showCells')),h('div.st-row',{},rand,clear)),
    sec([h('span',{},t('tile.map.layers')),h('span.tl-inline',{},up,dn)],layers,h('div.st-row',{},addL,delL)));
  }
  // ---- Generator
  const SOURCE_SIZE={'rpgmaker-a2':[2,3],blobsmith:[2,3],'rpgmaker-a4-wall':[2,2],five:[5,1],rim:[1,1]};
  const genState={assetId:null,kind:'rpgmaker-a2',origin:null,dual:false,layout:'blob47-cr31-ascending',background:null,rim:{rim:2,color:'#2a2018',round:true},busy:false,colour:'#ffffff'};
  function startGenerator(kind,origin){
   const a=asset();if(!a)return;genState.assetId=a.id;genState.kind=SOURCE_SIZE[kind]?kind:'rpgmaker-a2';genState.origin=origin;ctx.showPanel('tile-gen');renderGen();sheetLayer.view?.invalidate();
   ctx.toast(t('tile.gen.sourceSet',{kind:t('tile.source.'+genState.kind)}));
  }
  function renderGen(){
   const box=panels['tile-gen'],a=asset(),ts=tileset(),link=S().links?.[assetId];
   if(link){
    const src=P.assetById(ctx.doc,link.sourceAssetId);
    const changed=src&&P.primaryBlob(src)!==link.sourceBlob;
    box.replaceChildren(sec(t('tile.gen.linked'),h('p',{},t('tile.gen.linkedFrom',{name:src?.name||'?',kind:t('tile.source.'+link.kind)})),
     changed?h('p.tl-state.is-warn',{},t('tile.gen.stale')):h('p.tl-state.is-ok',{},t('tile.gen.fresh')),
     h('div.st-row',{},btn(t('tile.gen.openSource'),()=>ctx.showAsset(link.sourceAssetId)),changed?btn(t('tile.gen.regen'),()=>regenerate(assetId),{primary:true,action:'tile-regen'}):null)),
     srcEditor(link));
    return;
   }
   if(!a||!ts){box.replaceChildren(h('p.st-muted.st-pad',{},t('tile.gen.needSet')));return;}
   const kind=h('select.st-input',{'data-tile':'gen-kind','aria-label':t('tile.gen.kind')},Object.keys(SOURCE_SIZE).map(k=>h('option',{value:k,selected:k===genState.kind},t('tile.source.'+k))));
   kind.addEventListener('change',()=>{genState.kind=kind.value;renderGen();sheetLayer.view?.invalidate();});
   const K=SOURCE_SIZE[genState.kind];
   const useSel=btn(t('tile.gen.useSelection'),()=>{if(!selection.length){ctx.toast(t('tile.gen.pickFirst'),{error:true});return;}const cs=selection.map(unkey);genState.assetId=a.id;genState.origin={col:Math.min(...cs.map(c=>c[0])),row:Math.min(...cs.map(c=>c[1]))};renderGen();sheetLayer.view?.invalidate();},{action:'tile-gen-origin'});
   const fitsSheet=genState.origin&&genState.assetId===a.id&&genState.origin.col+K[0]<=ts.grid.cols&&genState.origin.row+K[1]<=ts.grid.rows;
   const dual=h('input',{type:'checkbox',checked:genState.dual,'data-tile':'gen-dual',disabled:genState.kind==='rpgmaker-a4-wall'});dual.addEventListener('change',()=>{genState.dual=dual.checked;renderGen();});
   const lay=h('select.st-input',{'aria-label':t('tile.gen.layout'),disabled:genState.dual||genState.kind==='rpgmaker-a4-wall','data-tile':'gen-layout'},LAYOUTS.filter(L=>L.family==='blob47').map(L=>h('option',{value:L.id,selected:L.id===genState.layout},L.names[0])));
   lay.addEventListener('change',()=>{genState.layout=lay.value;});
   const bg=genState.background?t('tile.gen.bgTile',{c:genState.background.col,r:genState.background.row}):t('tile.gen.bgNone');
   const bgBtn=btn(t('tile.gen.bgUse'),()=>{if(selection.length!==1){ctx.toast(t('tile.gen.bgPick'),{error:true});return;}const [col,row]=unkey(selection[0]);genState.background={col,row};renderGen();});
   const bgClr=btn(t('tile.gen.bgClear'),()=>{genState.background=null;renderGen();},{disabled:!genState.background});
   const rim=genState.kind==='rim'?h('div.st-grid-fields',{},(()=>{const i=h('input.st-input.st-num',{type:'number',min:'1',max:'8',value:String(genState.rim.rim)});i.addEventListener('change',()=>{genState.rim.rim=Math.max(1,Math.min(8,Number(i.value)||2));});return h('label.st-field.st-field-inline',{},h('span',{},t('tile.gen.rimWidth')),i);})(),(()=>{const i=h('input.tl-color',{type:'color',value:genState.rim.color});i.addEventListener('change',()=>{genState.rim.color=i.value;});return h('label.st-field.st-field-inline',{},h('span',{},t('tile.gen.rimColor')),i);})()):null;
   box.replaceChildren(sec(t('tile.gen.title'),h('p.st-muted.tl-lead',{},t('tile.gen.lead')),
    h('label.st-field',{},h('span',{},t('tile.gen.kind')),kind),h('p.st-muted.tl-small',{},t('tile.gen.kindHelp.'+genState.kind,{w:K[0],h:K[1]})),
    h('div.st-row',{},useSel),h('p'+(fitsSheet?'.st-muted':'.st-error')+'.tl-small',{},genState.origin&&genState.assetId===a.id?t(fitsSheet?'tile.gen.origin':'tile.gen.originBad',{c:genState.origin.col,r:genState.origin.row,w:K[0],h:K[1]}):t('tile.gen.noOrigin',{w:K[0],h:K[1]})),
    rim,
    h('label.st-check',{},dual,' ',t('tile.gen.dual')),h('label.st-field',{},h('span',{},t('tile.gen.layout')),lay),
    h('p.st-muted.tl-small',{},t('tile.gen.bg')+' '+bg),h('div.st-row',{},bgBtn,bgClr),
    h('div.st-row',{},btn(genState.busy?t('tile.gen.busy'):t('tile.gen.go'),()=>generate(),{primary:true,disabled:!fitsSheet||genState.busy,action:'tile-generate'}))));
  }
  const hexRGBA=hex=>{const n=parseInt(String(hex).slice(1),16);return [n>>16&255,n>>8&255,n&255,255];};
  async function runGenerate(sourceAsset,spec,sourceBlob){
   const ts=St.tilesetForAsset(S(),sourceAsset.id);
   return work({op:'generate',key:sourceBlob.id,blob:sourceBlob.blob,grid:gridOf(ts),kind:spec.kind,origin:spec.origin,dual:spec.dual,layout:spec.layout,background:spec.background,rim:{...spec.rim,color:hexRGBA(spec.rim.color)}});
  }
  function tilesetFromGenerated(newAssetId,name,r,spec,twoTerrains){
   let ts=TS.createTileset({assetId:newAssetId,name,grid:r.grid,mode:r.mode});
   if(twoTerrains)ts=TS.addTerrain({...ts,terrains:[{...ts.terrains[0],name:'A'}]},'B');
   ts=TS.setPatterns(ts,r.cells.map(c=>({col:c.col,row:c.row,pattern:c.pattern})));
   return {...ts,layoutId:r.layoutId};
  }
  async function generate(){
   const a=asset(),ts=tileset();if(!a||!ts||genState.busy)return;
   genState.busy=true;renderGen();
   try{
    const b=blobOf(a),spec={kind:genState.kind,origin:genState.origin,dual:genState.dual,layout:genState.layout,background:genState.background,rim:{...genState.rim}};
    const r=await runGenerate(a,spec,b);
    const rec=await ctx.images.put(new Blob([r.png],{type:'image/png'}),{width:r.width,height:r.height});
    const name=a.name.replace(/\.[^.]+$/,'')+(spec.dual?'-dual16':r.mode==='sides'?'-edge16':'-blob47')+'.png';
    const na=P.imageAsset({name,width:r.width,height:r.height,blob:rec.id,source:{name,type:'image/png',size:r.png.size||0,lastModified:Date.now()}});
    const nts=tilesetFromGenerated(na.id,name.replace(/\.png$/,''),r,spec,!!spec.background);
    ctx.execute(ctx.edit(t('tile.cmd.generate',{n:r.cells.length}),d=>St.withTileState(P.addAssets(d,[na]),s=>({...St.putTileset(s,nts),links:{...(s.links||{}),[na.id]:{sourceAssetId:a.id,sourceBlob:b.id,...spec}}}))));
    await ctx.showAsset(na.id);
    ctx.toast(t('tile.toast.generated',{n:r.cells.length,name}));
   }catch(e){ctx.toast(String(e.message||e),{error:true});}
   finally{genState.busy=false;renderGen();}
  }
  /** Re-assemble a generated sheet from its (possibly edited) source. With `edited` the source's
   * new PNG and the regenerated sheet change in ONE undoable step. */
  async function regenerate(genAssetId,edited=null){
   const link=S().links?.[genAssetId],src=P.assetById(ctx.doc,link?.sourceAssetId),gen=P.assetById(ctx.doc,genAssetId);if(!link||!src||!gen)return;
   const srcBlob=edited||blobOf(src);
   const r=await runGenerate(src,link,srcBlob);
   const rec=await ctx.images.put(new Blob([r.png],{type:'image/png'}),{width:r.width,height:r.height});
   const setBlob=(d,id,blob)=>({...d,assets:d.assets.map(x=>x.id===id?{...x,cels:x.cels.map((c,i)=>i===0?{...c,blob}:c)}:x)});
   ctx.execute(ctx.edit(edited?t('tile.cmd.editSource'):t('tile.cmd.regen'),d=>{
    let out=setBlob(d,gen.id,rec.id);if(edited)out=setBlob(out,src.id,edited.id);
    return St.withTileState(out,s=>({...s,links:{...s.links,[gen.id]:{...s.links[gen.id],sourceBlob:srcBlob.id}}}));
   },edited?{mergeKey:'srcedit',open:false}:{}));
   lastProvenance=r.provenance;
  }
  let lastProvenance=null,srcPixels=null,srcKey='';
  /** A small pixel editor over the generator's source block: every stroke re-assembles the linked
   * set, so a fix to one quarter shows up in every tile that uses it at once. */
  function srcEditor(link){
   const src=P.assetById(ctx.doc,link.sourceAssetId),sts=src&&St.tilesetForAsset(S(),src.id);
   if(!src||!sts)return h('p.st-error.st-pad',{},t('tile.gen.sourceGone'));
   const K=SOURCE_SIZE[link.kind],g=sts.grid,W=K[0]*g.w,H=K[1]*g.h,z=Math.max(1,Math.floor(264/W));
   const cv=h('canvas.tl-srced',{width:W*z,height:H*z,'data-tile':'source-editor',style:{width:(W*z)+'px',height:(H*z)+'px'}}),x2=cv.getContext('2d');
   const colour=h('input.tl-color',{type:'color',value:genState.colour,'aria-label':t('tile.gen.colour')});colour.addEventListener('change',()=>{genState.colour=colour.value;});
   const info=h('p.st-muted.tl-small',{},t('tile.gen.editHint'));
   const b=blobOf(src),o=cellRect(g,link.origin.col,link.origin.row);
   const load=async()=>{
    const k=b.id;if(srcKey!==k||!srcPixels){const bmp=await createImageBitmap(b.blob,{premultiplyAlpha:'none',colorSpaceConversion:'none'});const c=new OffscreenCanvas(src.width,src.height),cx=c.getContext('2d');cx.drawImage(bmp,0,0);srcPixels=cx.getImageData(0,0,src.width,src.height);srcKey=k;}
    paint();
   };
   const paint=()=>{const img=new ImageData(W,H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=o.x+(x%g.w)+Math.floor(x/g.w)*(g.w+g.sx),sy=o.y+(y%g.h)+Math.floor(y/g.h)*(g.h+g.sy),i=(sy*src.width+sx)*4;img.data.set(srcPixels.data.subarray(i,i+4),(y*W+x)*4);}
    const tmp=new OffscreenCanvas(W,H);tmp.getContext('2d').putImageData(img,0,0);x2.imageSmoothingEnabled=false;x2.clearRect(0,0,cv.width,cv.height);x2.drawImage(tmp,0,0,W*z,H*z);
    x2.strokeStyle='rgba(255,255,255,.25)';x2.lineWidth=1;for(let q=0;q<=K[0]*2;q++){x2.beginPath();x2.moveTo(q*g.w/2*z+.5,0);x2.lineTo(q*g.w/2*z+.5,H*z);x2.stroke();}for(let r=0;r<=K[1]*2;r++){x2.beginPath();x2.moveTo(0,r*g.h/2*z+.5);x2.lineTo(W*z,r*g.h/2*z+.5);x2.stroke();}};
   let down=false,dirty=false;
   const at=e=>{const r=cv.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*W),y=Math.floor((e.clientY-r.top)/r.height*H);return x>=0&&y>=0&&x<W&&y<H?{x,y}:null;};
   const setPx=p=>{if(!p||!srcPixels)return;const sx=o.x+(p.x%g.w)+Math.floor(p.x/g.w)*(g.w+g.sx),sy=o.y+(p.y%g.h)+Math.floor(p.y/g.h)*(g.h+g.sy),i=(sy*src.width+sx)*4;srcPixels.data.set(hexRGBA(genState.colour),i);dirty=true;paint();};
   const quarterInfo=p=>{if(!p)return;const tc=Math.floor(p.x/g.w),tr=Math.floor(p.y/g.h),qx=Math.floor((p.x%g.w)/(g.w/2)),qy=Math.floor((p.y%g.h)/(g.h/2));const uses=(lastProvenance||[]).filter(pv=>Object.values(pv).some(q=>q.col===tc&&q.row===tr&&q.qx===qx&&q.qy===qy)).length;info.textContent=lastProvenance?t('tile.gen.uses',{n:uses}):t('tile.gen.editHint');};
   cv.addEventListener('pointerdown',e=>{if(e.altKey||e.button===2){const p=at(e);if(p&&srcPixels){const sx=o.x+(p.x%g.w)+Math.floor(p.x/g.w)*(g.w+g.sx),sy=o.y+(p.y%g.h)+Math.floor(p.y/g.h)*(g.h+g.sy),i=(sy*src.width+sx)*4;const d=srcPixels.data;genState.colour='#'+[d[i],d[i+1],d[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');colour.value=genState.colour;}e.preventDefault();return;}down=true;cv.setPointerCapture(e.pointerId);setPx(at(e));});
   cv.addEventListener('pointermove',e=>{const p=at(e);quarterInfo(p);if(down)setPx(p);});
   cv.addEventListener('contextmenu',e=>e.preventDefault());
   const commit=async()=>{if(!down)return;down=false;if(!dirty)return;dirty=false;
    const c=new OffscreenCanvas(src.width,src.height);c.getContext('2d').putImageData(srcPixels,0,0);
    // exact bytes: encode with the project's own PNG writer, not the browser's colour-managed one
    const {encodeRGBAPNG}=await import('../../../game/texture-png.js');
    const png=await encodeRGBAPNG(new Uint8Array(srcPixels.data.buffer),src.width,src.height);
    const blob=png instanceof Blob?png:new Blob([png],{type:'image/png'});
    const rec=await ctx.images.put(blob,{width:src.width,height:src.height});srcKey=rec.id;
    await regenerate(assetId,{id:rec.id,blob:rec.blob});renderGen();};
   cv.addEventListener('pointerup',commit);cv.addEventListener('pointercancel',commit);
   if(!lastProvenance)runGenerate(src,link,b).then(r=>{lastProvenance=r.provenance;}).catch(()=>{});
   load();
   return sec(t('tile.gen.editTitle'),h('div.tl-srced-wrap',{},cv),h('div.st-row',{},h('label.st-field.st-field-inline',{},h('span',{},t('tile.gen.colour')),colour)),info);
  }
  // ---- Export
  const exportOpts={targets:new Set(['godot','tiled','ldtk','unity','generic']),collision:'none',sample:'map'};
  function renderExport(){
   const box=panels['tile-export'],ts=tileset();
   if(!ts){box.replaceChildren(h('p.st-muted.st-pad',{},t('tile.needTileset')));return;}
   const rows=TARGETS.map(tg=>{const v=VERIFY[tg];const cb=h('input',{type:'checkbox',checked:exportOpts.targets.has(tg),'data-target':tg});cb.addEventListener('change',()=>{cb.checked?exportOpts.targets.add(tg):exportOpts.targets.delete(tg);});
    const na=tg==='unity'&&ts.mode==='corners';
    return h('label.tl-target'+(na?'.is-na':''),{},cb,h('span.tl-target-name',{},t('tile.export.t.'+tg)),h('span.st-conf.is-'+(na?'alt':v.status==='verified'?'high':'medium'),{title:v.detail},na?t('tile.export.na'):t('tile.export.'+v.status)));});
   const col=h('select.st-input',{'aria-label':t('tile.export.collision'),'data-tile':'collision'},['none','box','rects','outline'].map(m=>h('option',{value:m,selected:exportOpts.collision===m},t('tile.export.col.'+m))));
   col.addEventListener('change',()=>{exportOpts.collision=col.value;});
   const n=Object.keys(ts.tiles).filter(k=>ts.tiles[k].pattern[0]>=0).length;
   box.replaceChildren(sec(t('tile.export.title'),h('div.tl-targets',{},rows),
    h('label.st-field',{},h('span',{},t('tile.export.collision')),col),h('p.st-muted.tl-small',{},t('tile.export.colHelp')),
    h('p.st-muted.tl-small',{},t('tile.export.sample')),
    h('div.st-row',{},btn(t('tile.export.go',{n}),()=>doExport(),{primary:true,disabled:!n,action:'tile-export'})),
    h('p.st-muted.tl-small',{},t('tile.export.local'))));
  }
  async function doExport(){
   const ts=tileset(),a=asset();if(!ts||!a)return;
   let out=ts;
   if(exportOpts.collision!=='none'){
    const b=blobOf(a),keys=Object.keys(ts.tiles).filter(k=>ts.tiles[k].pattern[0]>=0);
    const r=await work({op:'collision',key:b.id,blob:b.blob,grid:gridOf(ts),keys,mode:exportOpts.collision});
    out={...ts,collisionMode:exportOpts.collision,tiles:Object.fromEntries(Object.entries(ts.tiles).map(([k,v])=>[k,r.collision[k]?{...v,collision:r.collision[k]}:v]))};
   }
   const png=new Uint8Array(await blobOf(a).blob.arrayBuffer());
   const imageName=(a.name.replace(/\.[^.]+$/,'')||'tileset').replace(/[^\w.-]+/g,'_')+'.png';
   // the sample map: the active map's first layer that uses this tileset, else a built-in test shape
   const m=activeMap(),L=m?.layers.find(l=>l.tilesetId===ts.id);
   const sample=L?{w:m.w,h:m.h,get:St.layerGet(m,L)}:{w:14,h:11,get:(x,y)=>x<0||y<0||x>=14||y>=11?-1:SHAPE[y][x]==='#'?0:-1};
   const bundle=exportBundle(out,{imageName,width:a.width,height:a.height,png,sample,targets:[...exportOpts.targets]});
   const entries=[];
   for(const [tg,files] of Object.entries(bundle))for(const [name,content] of Object.entries(files))entries.push({name:`${tg}/${name}`,blob:new Blob([content])});
   if(!entries.length){ctx.toast(t('tile.export.nothing'),{error:true});return;}
   const notes=bundle.notes||{};
   entries.push({name:'NOTES.txt',blob:new Blob([[`Nerulio Studio (Tile) export — ${ts.name}`,'',...Object.entries(VERIFY).filter(([k])=>exportOpts.targets.has(k)).map(([k,v])=>`${k}: ${v.status.toUpperCase()} — ${v.detail}`),'',...Object.entries(notes).map(([k,v])=>`${k}: ${v}`),''].join('\n')])});
   const zipped=await zip(entries,{paths:true});
   const url=URL.createObjectURL(new Blob([zipped],{type:'application/zip'}));
   const link=h('a',{href:url,download:imageName.replace(/\.png$/,'')+'-tileset.zip'});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   ctx.toast(t('tile.toast.exported',{n:Object.keys(bundle).length}));
  }
  const SHAPE=['..............','.#####...###..','.#####..#####.','.##.##..##.##.','.#####..#####.','.#####...###..','...#......#...','..###.#..###..','...#.###......','......#.......','..............'];
  // ---------------------------------------------------------------- commands + menu
  ctx.command({id:'tile.view',group:'tile',keys:['M'],label:()=>mode==='map'?t('tile.map.showSheet'):t('tile.map.showMap'),run:()=>setMode(mode==='map'?'tileset':'map')});
  ctx.command({id:'tile.identify',group:'tile',label:()=>t('tile.layout.rerun'),enabled:()=>!!tileset(),run:()=>{ctx.showPanel('tile-layout');runIdentify(true);}});
  ctx.command({id:'tile.suggest',group:'tile',label:()=>t('tile.layout.suggest'),enabled:()=>!!tileset(),run:()=>{ctx.showPanel('tile-layout');runSuggest();}});
  ctx.command({id:'tile.apply',group:'tile',keys:['Enter'],label:()=>t('tile.layout.apply'),enabled:()=>!!preview,run:applyPreview});
  ctx.command({id:'tile.export',group:'tile',keys:['Mod+E'],label:()=>t('tile.export.title'),enabled:()=>!!tileset(),run:()=>{ctx.showPanel('tile-export');doExport();}});
  ctx.command({id:'tile.copy',group:'tile',keys:['Mod+C'],label:()=>t('tile.tile.copy'),enabled:()=>mode==='tileset'&&selection.length>0,run:copyPattern});
  ctx.command({id:'tile.paste',group:'tile',keys:['Mod+V'],label:()=>t('tile.tile.paste'),enabled:()=>mode==='tileset'&&!!clipboard&&selection.length>0,run:pastePattern});
  ctx.command({id:'tile.rotate',group:'tile',keys:['R'],label:()=>t('tile.tile.rotate'),enabled:()=>mode==='tileset'&&selection.length>0,run:()=>setSel(q=>q&&rotate(q))});
  ctx.command({id:'tile.terrainNext',group:'tile',keys:[']'],label:()=>t('tile.terrain.next'),run:()=>setTerrain(terrain+1)});
  ctx.command({id:'tile.terrainPrev',group:'tile',keys:['['],label:()=>t('tile.terrain.prev'),run:()=>setTerrain(terrain-1)});
  ctx.command({id:'tile.newMap',group:'tile',label:()=>t('tile.map.new'),enabled:()=>St.tilesetsOf(S()).length>0,run:()=>{const ts=tileset()||St.tilesetsOf(S())[0];edit(t('tile.cmd.newMap'),x=>St.putMap(x,St.createMap({name:t('tile.map.defaultName',{n:Object.keys(x.maps||{}).length+1}),tilesetId:ts?.id})));layerSel=null;setMode('map');}});
  ctx.command({id:'tile.brushBigger',group:'tile',keys:['Shift+]'],label:()=>t('tile.map.bigger'),run:()=>{brushSize=Math.min(9,brushSize+1);renderMapPanel();}});
  ctx.command({id:'tile.brushSmaller',group:'tile',keys:['Shift+['],label:()=>t('tile.map.smaller'),run:()=>{brushSize=Math.max(1,brushSize-1);renderMapPanel();}});
  ctx.menu({id:'tile',title:'tile.menu',items:()=>['tile.view','-','tile.identify','tile.suggest','tile.apply','-','tile.copy','tile.paste','tile.rotate','tile.terrainPrev','tile.terrainNext','-','tile.newMap','tile.brushSmaller','tile.brushBigger','-','tile.export','-','tool.tile-select','tool.tile-bits','tool.tile-brush','tool.tile-eraser','tool.tile-bucket','tool.tile-picker']});
  // ---------------------------------------------------------------- document / asset events
  function refreshAll(){renderSet();renderLayout();renderTilePanel();renderCheck();renderMapPanel();renderGen();renderExport();sheetLayer.view?.invalidate();}
  let lastTs=null,lastMap=null;
  ctx.on('doc',(doc,prev,ev)=>{
   const ts=tileset();
   if(ts!==lastTs){lastTs=ts;if(ts){runArt();loadBlanks(ts.grid);}
    if(preview&&ev?.type!=='change')preview=null;}
   const m=activeMap();
   if(mode==='map'&&(m!==lastMap||ev?.type==='undo'||ev?.type==='redo'))renderMap(m?.id!==lastMap?.id);
   lastMap=m;
   refreshAll();
  });
  ctx.on('asset',id=>{
   if(mode==='map'&&id){// the app shows the asset: follow it back to the sheet view
    mode='tileset';root?.setAttribute('data-tile-mode','tileset');
   }
   assetId=id;selection=[];preview=null;hoverZone=null;
   const ts=tileset();
   if(id&&!ts){runDetect();const d=drafts.get(id);if(d)loadBlanks(d);}
   if(ts){loadBlanks(ts.grid);runIdentify();runArt();}
   refreshAll();
  });
  ctx.on('view',v=>{if(mode==='map')mapView=v;});
  ctx.on('locale',()=>{refreshAll();});
  ctx.setTool('tile-bits');
  return {
   selectAll(){const ts=tileset();if(!ts||mode!=='tileset')return;const out=[];for(let r=0;r<ts.grid.rows;r++)for(let c=0;c<ts.grid.cols;c++)out.push(key(c,r));setSelection(out);},
   deselect(){if(preview){preview=null;sheetLayer.view?.invalidate();renderLayout();return;}setSelection([]);},
   hasSelection:()=>mode==='tileset'&&selection.length>0,
   deleteSelection(){setSel(()=>null);},
   nudge(dx,dy){const ts=tileset();if(!ts||!selection.length)return;const [c,r]=unkey(selection[selection.length-1]);const q=Math.max(0,Math.min(ts.grid.cols-1,c+Math.sign(dx))),rr=Math.max(0,Math.min(ts.grid.rows-1,r+Math.sign(dy)));setSelection([key(q,rr)]);},
   step(dir){const ts=tileset();if(!ts)return;const keys=Object.keys(ts.tiles).sort((a,b)=>{const [c1,r1]=unkey(a),[c2,r2]=unkey(b);return r1-r2||c1-c2;});if(!keys.length)return;const i=keys.indexOf(selection[0]);setSelection([keys[(i+dir+keys.length)%keys.length]]);},
   onAsset(id){assetId=id;const ts=tileset();if(id&&!ts)runDetect();if(ts){loadBlanks(ts.grid);runIdentify();runArt();}refreshAll();},
   deactivate(){root?.removeAttribute('data-tile-mode');if(mode==='map'){mode='tileset';ctx.showAsset(assetId,{restoreView:true});}}
  };
 }
};
