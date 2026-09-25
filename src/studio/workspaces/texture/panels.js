/** Texture workspace panels. Rendering only: every change goes through the controller `C`
 * (index.js), which turns it into one undoable document edit. */
import {h} from '../../ui/dom.js';
import {meter} from '../../monetize/meter.js';
import {ICONS} from '../../ui/icons.js';
import * as St from './state.js';
import {ENGINE_PRESETS,PRESET_IDS} from '../../../game/texture-presets.js';
import {packPlanes,luminancePlane} from '../../../game/texture-channels.js';
import {encodeRGBAPNG,encodeGrayPNG} from '../../../game/texture-png.js';
import {VERIFIED,safeBase} from '../../../game/normals/export.js';
import {FALLOFFS} from '../../../game/normals/lighting.js';
import {normalMipChain} from '../../../game/normals/normal.js';
import * as P from '../../core/project.js';
const put=(el,...kids)=>el.replaceChildren(...kids.flat(Infinity).filter(k=>k!=null&&k!==false));
const fmt=(v,step)=>{const d=step>=1?0:step>=.1?1:2;return Number(v).toFixed(d);};
export function createPanels(C){
 const {t,ctx}=C;
 const boxes={};let dragging=false,pending=false,merge=0;
 const mk=(id,dock,order,key,badge)=>{const box=h('div.tx-panel',{'data-tex-panel':id});boxes[id]=box;
  box.addEventListener('pointerdown',e=>{if(e.target.matches('input[type=range]'))dragging=true;});
  ctx.panel({id,title:()=>t(key),dock,order,badge,render(body){body.append(box);}});return box;};
 const endDrag=()=>{if(!dragging)return;dragging=false;if(pending){pending=false;render();}};
 addEventListener('pointerup',endDrag,true);addEventListener('pointercancel',endDrag,true);
 mk('tex-normal','right',10,'tex.panel.normal');
 mk('tex-light','right',20,'tex.panel.light');
 mk('tex-maps','right',30,'tex.panel.maps');
 mk('tex-check','right',40,'tex.panel.check',()=>{const d=C.S.detect?.detect;return d&&d.convention?d.convention==='opengl'?'GL':'DX':'';});
 mk('tex-export','right',50,'tex.panel.export');
 mk('tex-frames','bottom',5,'tex.panel.frames',()=>{const n=C.frameRects().length;return n?String(n):'';});
 mk('tex-3d','bottom',10,'tex.panel.preview3d');
 // ---------------------------------------------------------------- small widgets
 const sec=(title,...kids)=>h('div.st-sec',{},title?h('div.st-sec-head',{},...[].concat(title)):null,...kids);
 const btn=(label,run,{primary=false,disabled=false,action=null,title=null}={})=>{const b=h('button.st-btn'+(primary?'.primary':''),{type:'button',disabled,'data-action':action,title});b.textContent=label;b.addEventListener('click',run);return b;};
 const note=(text,cls='')=>h('p.tx-note'+(cls?'.'+cls:''),{},text);
 /** Slider + number: a drag is ONE undo step (merge key per drag). */
 function slider(k,label,value,{min,max,step=1,unit=''},set,{disabled=false,hint=null}={}){
  const range=h('input.tx-range',{type:'range',min,max,step,value,'data-k':k,'aria-label':label,disabled});
  const num=h('input.st-input.st-num.tx-num',{type:'number',min,max,step,value:fmt(value,step),'data-k':k+'-num','aria-label':label,disabled});
  let key=null;
  range.addEventListener('input',()=>{key||=k+':'+(++merge);num.value=fmt(range.value,step);set(+range.value,{mergeKey:key,open:true});});
  range.addEventListener('change',()=>{if(key)ctx.history.close(key);key=null;});
  num.addEventListener('change',()=>{const v=Math.max(min,Math.min(max,+num.value||0));set(v,{});});
  return h('label.tx-slider',{title:hint||null},h('span.tx-slider-label',{},label,unit?h('small',{},' '+unit):null),range,num);
 }
 const check=(k,label,on,set,{disabled=false}={})=>{const i=h('input',{type:'checkbox','data-k':k,checked:on,disabled});i.addEventListener('change',()=>set(i.checked));return h('label.st-check',{},i,h('span',{},label));};
 const select=(k,label,value,options,set,{disabled=false}={})=>{const s=h('select.st-input',{'data-k':k,'aria-label':label,disabled},options.map(([v,l])=>h('option',{value:v,selected:String(v)===String(value)},l)));s.addEventListener('change',()=>set(s.value));return h('label.st-field.tx-field',{},h('span',{},label),s);};
 const seg=(k,label,value,options,set)=>h('div.tx-segrow',{},label?h('span.tx-seg-label',{},label):null,h('div.tx-seg',{role:'radiogroup','aria-label':label||k},options.map(([v,l,title])=>{const b=h('button.tx-segbtn',{type:'button',role:'radio','aria-checked':String(v===value),'data-k':k+'-'+v,title:title||null},l);b.addEventListener('click',()=>set(v));return b;})));
 const color=(k,label,value,set)=>{const i=h('input.tx-color',{type:'color',value,'data-k':k,'aria-label':label});let key=null;i.addEventListener('input',()=>{key||=k+':'+(++merge);set(i.value,{mergeKey:key,open:true});});i.addEventListener('change',()=>{if(key)ctx.history.close(key);key=null;});return h('label.tx-colorrow',{},h('span',{},label),i);};
 const setP=(label,patch,opts={})=>C.edit(label,(s,id,size)=>St.setParams(s,id,patch,size),opts);
 const conf=c=>h('span.st-conf.is-'+(c==='none'?'low':c),{},t('tex.conf.'+c));
 // ---------------------------------------------------------------- Normal map
 function renderNormal(){
  const box=boxes['tex-normal'],a=C.asset(),e=C.entry();
  if(!a||!e){put(box,h('p.st-muted.st-pad',{},t('tex.noImage')));return;}
  const p=e.params,S=C.S,imported=!!e.normalFrom;
  const members=C.setMembers().filter(m=>m.asset.id!==a.id);
  const normals=members.filter(m=>m.role==='normal'||m.role==='unknown'&&/norm|nrm|_n\b/i.test(m.asset.name));
  const heights=members.filter(m=>m.role==='height');
  const source=select('normalFrom',t('tex.normal.source'),e.normalFrom||'',[['',t('tex.normal.generate')],...normals.map(m=>[m.asset.id,t('tex.normal.useMap',{name:m.asset.name})])],v=>C.edit(t('tex.cmd.source'),(s,id,size)=>St.setNormalFrom(s,id,v,size)));
  const kids=[sec(t('tex.normal.sourceTitle'),source,imported?note(t('tex.normal.importedHint')):null)];
  if(!imported){
   const suggested=!St.texState(ctx.doc).assets?.[a.id];
   kids.push(sec(t('tex.normal.kindTitle'),
    seg('kind','',p.kind,[['sprite',t('tex.kind.sprite'),t('tex.kind.spriteHint')],['texture',t('tex.kind.texture'),t('tex.kind.textureHint')]],v=>setP(t('tex.cmd.kind'),{kind:v,bevel:{on:v==='sprite'},normal:{edge:v==='texture'?'tile':'clamp'}})),
    suggested?note(t(p.kind==='sprite'?'tex.kind.suggestedSprite':'tex.kind.suggestedTexture'),'is-guess'):null));
   if(p.kind==='sprite')kids.push(sec([check('bevel.on',t('tex.bevel.title'),p.bevel.on,v=>setP(t('tex.cmd.bevel'),{bevel:{on:v}}))],
    slider('bevel.width',t('tex.bevel.width'),p.bevel.width,{min:.5,max:32,step:.5,unit:'px'},(v,o)=>setP(t('tex.cmd.bevel'),{bevel:{width:v}},o),{disabled:!p.bevel.on}),
    slider('bevel.depth',t('tex.bevel.depth'),p.bevel.depth,{min:0,max:32,step:.5,unit:'px'},(v,o)=>setP(t('tex.cmd.bevel'),{bevel:{depth:v}},o),{disabled:!p.bevel.on}),
    seg('bevel.shape',t('tex.bevel.shape'),p.bevel.shape,['round','linear','smooth','concave','step'].map(s=>[s,t('tex.shape.'+s)]),v=>setP(t('tex.cmd.bevel'),{bevel:{shape:v}})),
    seg('bevel.metric',t('tex.bevel.metric'),p.bevel.metric,[['euclidean',t('tex.metric.euclidean'),t('tex.metric.euclideanHint')],['chebyshev',t('tex.metric.chebyshev'),t('tex.metric.chebyshevHint')],['manhattan',t('tex.metric.manhattan'),t('tex.metric.manhattanHint')]],v=>setP(t('tex.cmd.bevel'),{bevel:{metric:v}}))));
   kids.push(sec([check('luma.on',t('tex.luma.title'),p.luma.on,v=>setP(t('tex.cmd.luma'),{luma:{on:v}}))],
    note(t('tex.luma.approx'),'is-approx'),
    slider('luma.depth',t('tex.luma.depth'),p.luma.depth,{min:0,max:16,step:.25,unit:'px'},(v,o)=>setP(t('tex.cmd.luma'),{luma:{depth:v}},o),{disabled:!p.luma.on}),
    slider('luma.detail',t('tex.luma.detail'),p.luma.detail,{min:0,max:64,step:1,unit:'px'},(v,o)=>setP(t('tex.cmd.luma'),{luma:{detail:v}},o),{disabled:!p.luma.on,hint:t('tex.luma.detailHint')}),
    slider('luma.smooth',t('tex.luma.smooth'),p.luma.smooth,{min:0,max:8,step:.5,unit:'px'},(v,o)=>setP(t('tex.cmd.luma'),{luma:{smooth:v}},o),{disabled:!p.luma.on}),
    check('luma.invert',t('tex.luma.invert'),p.luma.invert,v=>setP(t('tex.cmd.luma'),{luma:{invert:v}}),{disabled:!p.luma.on})));
   if(heights.length||p.heightMap.assetId)kids.push(sec(t('tex.hmap.title'),
    select('heightMap',t('tex.hmap.source'),p.heightMap.assetId||'',[['',t('tex.hmap.none')],...heights.map(m=>[m.asset.id,m.asset.name])],v=>setP(t('tex.cmd.hmap'),{heightMap:{assetId:v||null}})),
    slider('hmap.depth',t('tex.hmap.depth'),p.heightMap.depth,{min:0,max:64,step:.5,unit:'px'},(v,o)=>setP(t('tex.cmd.hmap'),{heightMap:{depth:v}},o),{disabled:!p.heightMap.assetId}),
    note(t('tex.hmap.hint'))));
   kids.push(sec(t('tex.nrm.title'),
    slider('normal.strength',t('tex.nrm.strength'),p.normal.strength,{min:0,max:8,step:.05},(v,o)=>setP(t('tex.cmd.strength'),{normal:{strength:v}},o)),
    seg('normal.kernel',t('tex.nrm.kernel'),p.normal.kernel,[['central',t('tex.kernel.central'),t('tex.kernel.centralHint')],['sobel3','Sobel'],['scharr','Scharr'],['sobel5','Sobel 5×5']],v=>setP(t('tex.cmd.kernel'),{normal:{kernel:v}})),
    seg('normal.edge',t('tex.nrm.edge'),p.normal.edge,[['clamp',t('tex.edge.clamp'),t('tex.edge.clampHint')],['tile',t('tex.edge.tile'),t('tex.edge.tileHint')],['mirror',t('tex.edge.mirror'),t('tex.edge.mirrorHint')]],v=>setP(t('tex.cmd.edge'),{normal:{edge:v}})),
    seg('normal.convention',t('tex.nrm.convention'),p.normal.convention,[['opengl',t('tex.conv.opengl'),t('tex.conv.openglHint')],['directx',t('tex.conv.directx'),t('tex.conv.directxHint')]],v=>setP(t('tex.cmd.convention'),{normal:{convention:v}}))));
   kids.push(sec([check('pixel.on',t('tex.pixel.title'),p.pixel.on,v=>setP(t('tex.cmd.pixel'),{pixel:{on:v}}))],
    note(t('tex.pixel.hint')),
    seg('pixel.directions',t('tex.pixel.directions'),p.pixel.directions,[[4,'4'],[8,'8'],[16,'16']],v=>setP(t('tex.cmd.pixel'),{pixel:{directions:+v}})),
    seg('pixel.tiers',t('tex.pixel.tiers'),p.pixel.tiers,[[1,'1'],[2,'2'],[3,'3']],v=>setP(t('tex.cmd.pixel'),{pixel:{tiers:+v}}))));
   const b=C.prefs.brush;
   kids.push(sec([h('span',{},t('tex.brush.title')),btn(t('tex.brush.use'),()=>ctx.setTool('tex-brush'),{action:'tex-brush-tool'})],
    seg('brush.mode','',b.mode,['raise','lower','smooth','flatten','erase'].map(m=>[m,t('tex.brush.mode.'+m)]),v=>{b.mode=v;C.savePrefs();render();}),
    slider('brush.r',t('tex.brush.size'),b.r,{min:1,max:128,step:1,unit:'px'},v=>{b.r=v;C.savePrefs();},{}),
    slider('brush.s',t('tex.brush.strength'),b.s,{min:.05,max:4,step:.05},v=>{b.s=v;C.savePrefs();}),
    slider('brush.hard',t('tex.brush.hard'),b.hard,{min:0,max:.95,step:.05},v=>{b.hard=v;C.savePrefs();}),
    h('div.st-row',{},h('span.st-muted',{'data-tex':'stroke-count'},t('tex.brush.count',{n:e.strokes.length})),btn(t('tex.cmd.clearPaint'),()=>ctx.runCommand('tex.resetStrokes'),{disabled:!e.strokes.length,action:'tex-clear-paint'})),
    note(t('tex.brush.hint'))));
  }
  put(box,kids);
 }
 // ---------------------------------------------------------------- Lighting
 function renderLight(){
  const box=boxes['tex-light'],a=C.asset(),e=C.entry();
  if(!a||!e){put(box,h('p.st-muted.st-pad',{},t('tex.noImage')));return;}
  const sc=e.scene,S=C.S,sel=sc.lights.find(l=>l.id===S.selLight)||null;
  const setL=(id,patch,o={})=>C.edit(t('tex.cmd.light'),(s,aid,size)=>St.setLight(s,aid,id,patch,size),o);
  const rows=sc.lights.map((l,i)=>{
   const on=l.id===S.selLight;
   const pick=h('button.tx-light',{type:'button','aria-pressed':String(on),'data-light':l.id},h('span.tl-swatch',{style:{background:l.color}}),t('tex.light.n',{n:i+1}),h('small',{},`${Math.round(l.x)}, ${Math.round(l.y)} · z ${Math.round(l.z)}`));
   pick.addEventListener('click',()=>{S.selLight=on?null:l.id;render();C.present2d();});
   const en=h('input',{type:'checkbox',checked:l.enabled,'aria-label':t('tex.light.enabled'),title:t('tex.light.enabled')});en.addEventListener('change',()=>setL(l.id,{enabled:en.checked}));
   const del=h('button.st-icon-btn',{type:'button','aria-label':t('tex.cmd.removeLight'),title:t('tex.cmd.removeLight'),'data-action':'tex-remove-light'});del.innerHTML=ICONS.trash;del.addEventListener('click',()=>{if(S.selLight===l.id)S.selLight=null;C.edit(t('tex.cmd.removeLight'),(s,aid,size)=>St.removeLight(s,aid,l.id,size));});
   return h('div.tx-lightrow',{},en,pick,del);
  });
  const add=btn(t('tex.cmd.addLight'),()=>ctx.runCommand('tex.addLight'),{disabled:sc.lights.length>=St.MAX_LIGHTS,action:'tex-add-light'});
  const detail=sel?sec(t('tex.light.selected',{n:sc.lights.indexOf(sel)+1}),
   color('light.color',t('tex.light.color'),sel.color,(v,o)=>setL(sel.id,{color:v},o)),
   slider('light.energy',t('tex.light.energy'),sel.energy,{min:0,max:4,step:.05},(v,o)=>setL(sel.id,{energy:v},o)),
   slider('light.z',t('tex.light.height'),sel.z,{min:0,max:512,step:1,unit:'px'},(v,o)=>setL(sel.id,{z:v},o),{hint:t('tex.light.heightHint')}),
   slider('light.radius',t('tex.light.radius'),sel.radius,{min:4,max:4096,step:1,unit:'px'},(v,o)=>setL(sel.id,{radius:v},o)),
   seg('light.falloff',t('tex.light.falloff'),sel.falloff,FALLOFFS.map(f=>[f,t('tex.falloff.'+f)]),v=>setL(sel.id,{falloff:v})),
   h('div.tx-xy',{},slider('light.x',t('tex.light.x'),sel.x,{min:-512,max:2048,step:.5,unit:'px'},(v,o)=>setL(sel.id,{x:v},o)),slider('light.y',t('tex.light.y'),sel.y,{min:-512,max:2048,step:.5,unit:'px'},(v,o)=>setL(sel.id,{y:v},o))))
   :sec(null,note(t('tex.light.pick')));
  const setS=(patch,o={})=>C.edit(t('tex.cmd.scene'),(s,id,size)=>St.setScene(s,id,patch,size),o);
  put(box,
   sec([h('span',{},t('tex.light.lights')),add],h('div.tx-lights',{},rows),note(t('tex.light.hint'))),
   detail,
   sec(t('tex.light.ambientTitle'),color('ambient',t('tex.light.ambient'),sc.ambient,(v,o)=>setS({ambient:v},o)),note(t('tex.light.ambientHint'))),
   sec(t('tex.light.specTitle'),slider('spec.strength',t('tex.light.specStrength'),sc.specular.strength,{min:0,max:1,step:.05},(v,o)=>setS({specular:{...sc.specular,strength:v}},o)),
    slider('spec.shininess',t('tex.light.shininess'),sc.specular.shininess,{min:0,max:1,step:.05},(v,o)=>setS({specular:{...sc.specular,shininess:v}},o)),note(t('tex.light.specHint'))),
   sec(t('tex.light.rimTitle'),slider('rim.strength',t('tex.light.rimStrength'),sc.rim.strength,{min:0,max:2,step:.05},(v,o)=>setS({rim:{...sc.rim,strength:v}},o)),
    color('rim.color',t('tex.light.rimColor'),sc.rim.color,(v,o)=>setS({rim:{...sc.rim,color:v}},o)),
    slider('rim.power',t('tex.light.rimPower'),sc.rim.power,{min:.5,max:8,step:.25},(v,o)=>setS({rim:{...sc.rim,power:v}},o)),note(t('tex.light.rimHint'),'is-approx')));
 }
 // ---------------------------------------------------------------- Maps, set, channels
 const packState={preset:'godot-orm',src:{}};
 function renderMaps(){
  const box=boxes['tex-maps'],a=C.asset(),e=C.entry(),S=C.S;
  if(!a||!e){put(box,h('p.st-muted.st-pad',{},t('tex.noImage')));return;}
  const g=S.gen,imported=!!g?.imported;
  const mapPick=seg('map.kind',t('tex.maps.show'),C.prefs.view==='maps'?C.prefs.map:C.prefs.view==='ao'?'ao':C.prefs.view==='height'?'height':'',
   [['height',t('tex.view.height')],['ao',t('tex.map.ao')],['cavity',t('tex.map.cavity')],['curvature',t('tex.map.curvature')],['roughness',t('tex.map.roughness')],['specular',t('tex.map.specular')]],
   v=>{if(v==='height'||v==='ao')C.setView(v);else{C.prefs.map=v;C.savePrefs();C.S.maps[v]?null:C.ensureMap(v);C.setView('maps');}});
  const approx=['roughness','specular'].includes(C.prefs.map)&&C.prefs.view==='maps';
  const aoSec=sec(t('tex.map.aoTitle'),
   slider('ao.radius',t('tex.map.aoRadius'),e.params.ao.radius,{min:1,max:64,step:1,unit:'px'},(v,o)=>setP(t('tex.cmd.ao'),{ao:{radius:v}},o),{disabled:imported}),
   slider('ao.power',t('tex.map.aoPower'),e.params.ao.power,{min:.25,max:4,step:.05},(v,o)=>setP(t('tex.cmd.ao'),{ao:{power:v}},o),{disabled:imported}),
   note(t('tex.map.aoHint')));
  const add=sec(t('tex.maps.addTitle'),h('div.tx-btnrow',{},
   btn(t('tex.maps.addNormal'),()=>C.addToProject(['normal']),{disabled:!g,action:'tex-add-normal'}),
   btn(t('tex.maps.addHeight'),()=>C.addToProject(['height']),{disabled:!g||imported,action:'tex-add-height'}),
   btn(t('tex.maps.addAO'),()=>C.addToProject(['ao']),{disabled:!g||imported,action:'tex-add-ao'}),
   C.prefs.view==='maps'&&S.maps[C.prefs.map]?btn(t('tex.maps.addThis',{name:t('tex.map.'+C.prefs.map)}),()=>C.addToProject([C.prefs.map]),{action:'tex-add-map'}):null),note(t('tex.maps.addHint')));
  // the PBR set this picture belongs to (by file name; every role can be corrected)
  const members=C.setMembers();
  const roles=['albedo','normal','height','roughness','smoothness','metallic','ao','orm','emission','opacity','specular','unknown'];
  const setRows=members.filter(m=>m.same||m.asset.id===a.id).map(m=>{
   const s=h('select.st-input.tx-role',{'aria-label':t('tex.set.role',{name:m.asset.name}),'data-role':m.asset.id},roles.map(r=>h('option',{value:r,selected:r===m.role},t('tex.role.'+r))));
   s.addEventListener('change',()=>C.edit(t('tex.cmd.role'),s2=>St.setRole(s2,m.asset.id,s.value)));
   return h('div.tx-setrow',{},h('span.tx-setname',{title:m.asset.name},m.asset.name),s,m.declared?h('small.st-muted',{},t('tex.set.set')):h('small.st-muted',{},t('tex.set.byName')));
  });
  put(box,sec(t('tex.maps.title'),mapPick,approx?note(t('tex.map.approx'),'is-approx'):null,C.prefs.view==='maps'&&['cavity','curvature'].includes(C.prefs.map)?note(t('tex.map.fromHeight')):null),
   aoSec,add,
   sec(t('tex.set.title'),setRows.length?h('div.tx-set',{},setRows):note(t('tex.set.none')),note(t('tex.set.hint'))),
   packSection(members),unpackSection());
 }
 function packSources(members){
  const out=[['const:0',t('tex.pack.zero')],['const:255',t('tex.pack.one')]];
  const g=C.S.gen;
  if(g&&!g.imported)out.push(['gen:ao',t('tex.pack.genAO')],['gen:height',t('tex.pack.genHeight')]);
  out.push(['gen:roughness',t('tex.pack.genRough')],['gen:specular',t('tex.pack.genSpec')]);
  for(const m of members)for(const c of ['l','r','g','b','a'])out.push([`asset:${m.asset.id}:${c}`,`${m.asset.name} · ${c==='l'?t('tex.pack.gray'):c.toUpperCase()}`]);
  return out;
 }
 function defaultSource(role,members){
  const find=r=>members.find(m=>m.role===r);
  if(role==='ao'){const m=find('ao');return m?`asset:${m.asset.id}:l`:C.S.gen&&!C.S.gen.imported?'gen:ao':'const:255';}
  if(role==='roughness'){const m=find('roughness');return m?`asset:${m.asset.id}:l`:'gen:roughness';}
  if(role==='smoothness'){const m=find('smoothness')||find('roughness');return m?`asset:${m.asset.id}:l${m.role==='roughness'?'!':''}`:'gen:roughness!';}
  if(role==='metallic'){const m=find('metallic');return m?`asset:${m.asset.id}:l`:'const:0';}
  if(role==='ignored')return 'const:0';
  return 'const:255';// detail mask (apply everywhere), unused alpha (opaque)
 }
 function packSection(members){
  const preset=ENGINE_PRESETS[packState.preset],loc=ctx.locale;
  const presetSel=select('pack.preset',t('tex.pack.preset'),packState.preset,PRESET_IDS.map(id=>[id,ENGINE_PRESETS[id].label[loc]||ENGINE_PRESETS[id].label.en]),v=>{packState.preset=v;packState.src={};render();});
  const opts=packSources(members);
  const rows=preset.channels.map(ch=>{
   let v=packState.src[ch.channel]??defaultSource(ch.role,members);const inv=v.endsWith('!');const base=inv?v.slice(0,-1):v;
   const s=h('select.st-input',{'data-pack':ch.channel,'aria-label':ch.channel.toUpperCase()},opts.map(([k,l])=>h('option',{value:k,selected:k===base},l)));
   const iv=h('input',{type:'checkbox',checked:inv,'aria-label':t('tex.pack.invert')});
   const sync=()=>{packState.src[ch.channel]=s.value+(iv.checked?'!':'');};s.addEventListener('change',sync);iv.addEventListener('change',sync);
   return h('div.tx-packrow',{title:ch.tooltip[loc]||ch.tooltip.en},h('b',{},ch.channel.toUpperCase()),h('span.tx-packrole',{},ch.label[loc]||ch.label.en),s,h('label.st-check',{},iv,h('small',{},t('tex.pack.invert'))));
  });
  return sec(t('tex.pack.title'),presetSel,h('p.tx-note',{},preset.summary[loc]||preset.summary.en),h('div.tx-pack',{},rows),
   h('div.tx-btnrow',{},btn(t('tex.pack.make'),()=>makePack(members).catch(err=>ctx.toast(String(err.message||err),{error:true})),{primary:true,action:'tex-pack'})),
   note(t('tex.pack.hint')));
 }
 async function planeFor(src,members){
  const S=C.S,pic=S.pic,n=pic.w*pic.h,inv=src.endsWith('!'),key=inv?src.slice(0,-1):src;let plane;
  if(key.startsWith('const:'))plane=new Uint8Array(n).fill(+key.slice(6));
  else if(key==='gen:ao')plane=await C.ensureAO();
  else if(key==='gen:height'){const {heightToBytes}=await import('../../../game/normals/maps.js');plane=heightToBytes(S.gen.height);}
  else if(key==='gen:roughness'||key==='gen:specular'){const k=key.slice(4);await C.ensureMap(k);plane=S.maps[k];}
  else{const [,id,c]=key.split(':'),m=P.assetById(ctx.doc,id);const blob=ctx.images.get(P.primaryBlob(m))?.blob;const d=await C.work({op:'decode',bytes:new Uint8Array(await blob.arrayBuffer())});
   plane=c==='l'?(d.gray&&d.gray.depth===16?Uint8Array.from(d.gray.samples,v=>v>>8):luminancePlane(d.data,d.width,d.height)):Uint8Array.from({length:n},(_,p)=>d.data[p*4+'rgba'.indexOf(c)]);}
  if(!plane)throw Error(t('tex.pack.missing'));
  return inv?plane.map(v=>255-v):plane;
 }
 async function makePack(members){
  const S=C.S,a=C.asset();if(!S.pic)return;const preset=ENGINE_PRESETS[packState.preset];
  const planes=[];for(const ch of preset.channels)planes.push(await planeFor(packState.src[ch.channel]??defaultSource(ch.role,members),members));
  const rgba=packPlanes(planes,S.pic.w,S.pic.h,[0,1,2,3]);
  const name=`${safeBase(a.name)}_${packState.preset}.png`,blob=await encodeRGBAPNG(rgba,S.pic.w,S.pic.h);
  C.download(blob,name);
  const keep=a.id;await ctx.importFiles([new File([blob],name,{type:'image/png'})],{from:'texture'});await ctx.showAsset(keep,{restoreView:true});
  ctx.toast(t('tex.pack.done',{name}));
 }
 function unpackSection(){
  const a=C.asset();
  return sec(t('tex.unpack.title'),note(t('tex.unpack.hint')),h('div.tx-btnrow',{},btn(t('tex.unpack.go',{name:a.name}),async()=>{
   try{const blob=ctx.images.get(P.primaryBlob(a))?.blob,d=await C.work({op:'decode',bytes:new Uint8Array(await blob.arrayBuffer())}),files=[];
    for(const [i,c] of ['r','g','b','a'].entries()){const pl=Uint8Array.from({length:d.width*d.height},(_,p)=>d.data[p*4+i]);files.push(new File([await encodeGrayPNG(pl,d.width,d.height)],`${safeBase(a.name)}_${c}.png`,{type:'image/png'}));}
    const keep=a.id;const added=await ctx.importFiles(files,{from:'texture'});await ctx.showAsset(keep,{restoreView:true});ctx.toast(t('tex.toast.added',{n:added.length}));}
   catch(err){ctx.toast(String(err.message||err),{error:true});}
  },{action:'tex-unpack'})));
 }
 // ---------------------------------------------------------------- Check: convention, seams, mips
 function renderCheck(){
  const box=boxes['tex-check'],a=C.asset(),e=C.entry(),S=C.S;
  if(!a||!e){put(box,h('p.st-muted.st-pad',{},t('tex.noImage')));return;}
  const kids=[];const d=S.detect;
  if(d){
   const v=d.detect,name=d.source==='imported'?(S.gen?.importedName||''):a.name,claim=C.roleOf(d.source==='imported'?P.assetById(ctx.doc,e.normalFrom)||a:a).convention;
   const verdict=v.convention?h('p.tx-verdict.is-'+v.confidence,{'data-tex':'convention','data-convention':v.convention,'data-confidence':v.confidence},t('tex.conv.verdict',{name,conv:t('tex.conv.'+v.convention)}),' ',conf(v.confidence))
    :h('p.tx-verdict.is-none',{'data-tex':'convention','data-convention':'none','data-confidence':'none'},t('tex.conv.cannot',{name}),' ',h('small',{},t('tex.conv.reason.'+v.reason)));
   const ev=v.evidence.map(x=>h('li',{},x.test==='curl'?t('tex.conv.curl',{rho:x.rho??0,agree:Math.round((x.agree||0)*100),n:x.informative??0,b:x.blocks??0}):t('tex.conv.sil',{rho:x.rhoY,red:x.rhoX,n:x.edgePixels}),' → ',x.says?t('tex.conv.'+x.says):t('tex.conv.nothing')));
   const declared=d.source==='imported'?e.normalDeclared:null;
   const decl=d.source==='imported'?h('div.tx-btnrow',{},
    ['opengl','directx'].map(c=>{const b=h('button.st-btn'+(declared===c?'.primary':''),{type:'button','data-action':'tex-declare-'+c,'aria-pressed':String(declared===c)},t('tex.conv.declare',{conv:t('tex.conv.'+c)}));b.addEventListener('click',()=>C.edit(t('tex.cmd.declare'),(s,id,size)=>St.setDeclared(s,id,declared===c?null:c,size)));return b;}))
    :null;
   const redFlipped=d.source==='imported'&&!!e.normalRedFlipped;
   // red: measured on sprites (silhouette); on a picture without a silhouette only the handedness
   // is known, so a flipped red would also read as DirectX - say so, and keep the manual fix at hand
   const flipBtn=d.source==='imported'?(()=>{const b=h('button.st-btn'+(redFlipped?'.primary':''),{type:'button','data-action':'tex-flip-red','aria-pressed':String(redFlipped)},t('tex.conv.flipRed'));b.addEventListener('click',()=>C.edit(t('tex.cmd.flipRed'),(s,id,size)=>St.setRedFlipped(s,id,!redFlipped,size)));return b;})():null;
   const redRow=[v.red==='flipped'&&!redFlipped?note(t('tex.conv.redFlipped'),'is-warn'):null,redFlipped?note(t('tex.conv.redFixed'),'is-ok'):null,
    !v.red&&v.convention==='directx'?note(t('tex.conv.redUnknown')):null,flipBtn];
   kids.push(sec(t('tex.conv.title'),verdict,redRow,claim?note(t(claim===v.convention||!v.convention?'tex.conv.nameSays':'tex.conv.nameDisagrees',{conv:t('tex.conv.'+claim)}),claim===v.convention||!v.convention?'':'is-warn'):null,
    h('ul.tx-evidence',{},ev),decl,d.source==='imported'?note(t(declared?'tex.conv.declared':'tex.conv.notApplied',{conv:declared?t('tex.conv.'+declared):''})):note(t('tex.conv.selfHint')),
    d.valid&&!d.valid.looksLikeNormalMap?note(t('tex.conv.notNormal'),'is-warn'):null));
  }else kids.push(sec(t('tex.conv.title'),note(e.normalFrom?t('tex.conv.running'):t('tex.conv.generated',{conv:t('tex.conv.'+e.params.normal.convention)}))));
  if(e.params.kind==='texture'){
   const s=S.seam;
   kids.push(sec(t('tex.seam.title'),s?[
    h('p',{'data-tex':'seam-roll','data-border':String(Math.round(s.roll.border*1000)/1000)},t('tex.seam.roll',{b:s.roll.border.toFixed(2),m:s.roll.maxBorder.toFixed(1),edge:t('tex.edge.'+e.params.normal.edge)})),
    note(s.roll.border<.01?t('tex.seam.rollOk'):t('tex.seam.rollBad'),s.roll.border<.01?'is-ok':'is-warn'),
    h('p',{'data-tex':'seam-albedo'},t('tex.seam.albedo',{r:Number.isFinite(s.albedoSeam.vertical.ratio)?((s.albedoSeam.vertical.ratio+s.albedoSeam.horizontal.ratio)/2).toFixed(2):'∞'})),
    note(s.albedoSeam.seamless?t('tex.seam.albedoOk'):t('tex.seam.albedoBad'),s.albedoSeam.seamless?'is-ok':'is-warn')
   ]:note(t('tex.seam.running')),note(t('tex.seam.hint'))));
  }
  // mip preview of the normal map: vectors averaged and renormalised vs a colour average
  const mipBtn=btn(S.mips?t('tex.mip.refresh'):t('tex.mip.show'),()=>{if(!S.gen)return;const pic=S.pic,r=C.region();const crop=new Uint8Array(r.w*r.h*4);for(let y=0;y<r.h;y++)crop.set(S.gen.normal.subarray(((r.y+y)*pic.w+r.x)*4,((r.y+y)*pic.w+r.x+r.w)*4),y*r.w*4);S.mips={chain:normalMipChain(crop,r.w,r.h,{levels:4}),w:r.w,h:r.h};render();},{disabled:!S.gen,action:'tex-mips'});
  const mips=S.mips?h('div.tx-mips',{},S.mips.chain.slice(1).map(m=>{const c=h('canvas.tx-mip',{width:m.width,height:m.height,title:`${m.width}×${m.height}`});const x=c.getContext('2d');x.putImageData(new ImageData(new Uint8ClampedArray(m.data),m.width,m.height),0,0);return h('figure',{},c,h('figcaption',{},`${m.width}×${m.height}`));})):null;
  kids.push(sec(t('tex.mip.title'),note(t('tex.mip.hint')),mipBtn,mips));
  put(box,kids);
 }
 // ---------------------------------------------------------------- Export
 const exp={targets:{godot:true,unity:true,generic:true},height:true,ao:true,bleed:0};
 function renderExport(){
  const box=boxes['tex-export'],a=C.asset(),S=C.S;
  if(!a){put(box,h('p.st-muted.st-pad',{},t('tex.noImage')));return;}
  const row=k=>{const v=VERIFIED[k];const i=h('input',{type:'checkbox',checked:exp.targets[k],'data-target':k});i.addEventListener('change',()=>{exp.targets[k]=i.checked;});
   return h('label.tx-target',{},i,h('span',{},h('b',{},t('tex.export.target.'+k)),h('small.tx-verify.is-'+v.status,{},v.status==='verified'?t('tex.export.verified',{engine:v.engine}):v.status==='unverified'?t('tex.export.unverified'):t('tex.export.plain')),h('small.st-muted',{},t('tex.export.what.'+k))));};
  const go=btn(t('tex.export.go'),async()=>{
   const targets=Object.keys(exp.targets).filter(k=>exp.targets[k]);if(!targets.length){ctx.toast(t('tex.export.none'),{error:true});return;}
   go.disabled=true;
   // Free daily Studio export (docs/PRICING-MODEL.md); a refusal leaves everything as it was.
   try{if(!await meter('studio-texture-export'))return;const r=await C.exportZip({targets,includeHeight:exp.height,includeAO:exp.ao,bleed:exp.bleed});C.download(r.blob,r.name);ctx.toast(t('tex.export.done',{n:r.files.length}));}
   catch(err){ctx.toast(String(err.message||err),{error:true});}finally{go.disabled=false;}
  },{primary:true,disabled:!S.gen,action:'tex-export'});
  const quick=(conv)=>btn(t('tex.export.quick',{conv:t('tex.conv.'+conv)}),async()=>{const {flipGreen}=await import('../../../game/texture-normal.js');const pic=S.pic,g=S.gen;let n=g.normal;const dx=C.isDX();if(dx!==(conv==='directx'))n=flipGreen(n,pic.w,pic.h);C.download(await encodeRGBAPNG(n,pic.w,pic.h),`${safeBase(a.name)}_n${conv==='directx'?'_dx':''}.png`);},{disabled:!S.gen,action:'tex-quick-'+conv});
  const bleed=h('input.st-input.st-num',{type:'number',min:0,max:16,step:1,value:exp.bleed,'data-k':'export.bleed','aria-label':t('tex.export.bleed')});bleed.addEventListener('change',()=>{exp.bleed=Math.max(0,Math.min(16,Math.round(+bleed.value||0)));});
  const ho=h('input',{type:'checkbox',checked:exp.height});ho.addEventListener('change',()=>{exp.height=ho.checked;});
  const ao=h('input',{type:'checkbox',checked:exp.ao});ao.addEventListener('change',()=>{exp.ao=ao.checked;});
  put(box,sec(t('tex.export.targets'),h('div.tx-targets',{},['godot','unity','generic'].map(row))),
   sec(t('tex.export.options'),h('label.st-check',{},ho,h('span',{},t('tex.export.height16'))),h('label.st-check',{},ao,h('span',{},t('tex.export.ao'))),
    h('label.st-field.st-field-inline',{},h('span',{},t('tex.export.bleed')),bleed),note(t('tex.export.bleedHint'))),
   sec(null,h('div.tx-btnrow',{},go),h('div.tx-btnrow',{},quick('opengl'),quick('directx')),note(t('tex.export.hint'))));
 }
 // ---------------------------------------------------------------- Frames
 const thumbs=new Map();
 function renderFrames(){
  const box=boxes['tex-frames'],a=C.asset(),S=C.S,rects=C.frameRects();
  if(!a||!S.pic){put(box,h('p.st-muted.st-pad',{},t('tex.noImage')));return;}
  if(!rects.length){put(box,h('p.st-muted.st-pad',{},t('tex.frames.none')));return;}
  const tags=a.tags||[];
  const tagSel=h('select.st-input',{'data-k':'frames.tag','aria-label':t('tex.frames.tag')},[h('option',{value:''},t('tex.frames.all')),...tags.map(g=>h('option',{value:g.id,selected:g.id===S.tagId},g.name))]);
  tagSel.addEventListener('change',()=>{S.tagId=tagSel.value||null;if(S.playing){C.play(false);C.play(true);}const tg=tags.find(x=>x.id===S.tagId);if(tg){const i=a.frames.findIndex(f=>f.id===tg.frameIds[0]);if(i>=0)C.setFrame(i);}});
  const play=h('button.st-btn',{type:'button','data-action':'tex-play'},S.playing?t('tex.frames.pause'):t('tex.frames.play'));play.addEventListener('click',()=>C.play());
  const strip=h('div.tx-strip',{role:'listbox','aria-label':t('tex.panel.frames')},rects.map((r,i)=>{
   const c=h('canvas.tx-thumb',{width:Math.min(64,r.w),height:Math.min(64,r.h)});drawThumb(c,r);
   const b=h('button.tx-frame',{type:'button',role:'option','aria-selected':String(i===S.frame),'data-frame':String(i),title:a.frames[i]?.name||String(i)},c,h('small',{},String(i+1)));
   b.addEventListener('click',()=>{C.play(false);C.setFrame(i);});return b;}));
  put(box,h('div.tx-frames',{},h('div.tx-frames-bar',{},play,tagSel,h('span.st-muted.st-keys',{},h('kbd',{},','),' ',h('kbd',{},'.'),' ',t('tex.frames.hint'))),strip));
 }
 function drawThumb(c,r){
  const S=C.S,pic=S.pic,k=`${pic.key}:${r.x},${r.y},${r.w},${r.h}`;let img=thumbs.get(k);
  if(!img){const d=new Uint8ClampedArray(r.w*r.h*4);for(let y=0;y<r.h;y++)d.set(pic.rgba.subarray(((r.y+y)*pic.w+r.x)*4,((r.y+y)*pic.w+r.x+r.w)*4),y*r.w*4);img=new ImageData(d,r.w,r.h);if(thumbs.size>512)thumbs.clear();thumbs.set(k,img);}
  const tmp=new OffscreenCanvas(r.w,r.h);tmp.getContext('2d').putImageData(img,0,0);const x=c.getContext('2d'),s=Math.min(c.width/r.w,c.height/r.h);x.imageSmoothingEnabled=false;x.drawImage(tmp,(c.width-r.w*s)/2,(c.height-r.h*s)/2,r.w*s,r.h*s);
 }
 function markFrame(){for(const b of boxes['tex-frames'].querySelectorAll('.tx-frame'))b.setAttribute('aria-selected',String(+b.dataset.frame===C.S.frame));}
 // ---------------------------------------------------------------- 3D
 function render3d(){const box=boxes['tex-3d'];if(!box.firstChild)box.append(C.threeD.root);C.threeD.renderControls();}
 // ---------------------------------------------------------------- render all (deferred while a slider is dragged)
 let raf=0;
 function render(){
  if(dragging){pending=true;return;}
  if(raf)return;raf=requestAnimationFrame(()=>{raf=0;
   const f=document.activeElement,k=f?.dataset?.k,panel=f?.closest?.('[data-tex-panel]')?.dataset.texPanel;
   renderNormal();renderLight();renderMaps();renderCheck();renderExport();renderFrames();render3d();
   for(const id of ['tex-check','tex-frames'])ctx.badge(id);
   if(k&&panel){const n=boxes[panel]?.querySelector(`[data-k="${CSS.escape(k)}"]`);n?.focus();}
  });
 }
 render();
 return {render,renderFrames:()=>{renderFrames();ctx.badge('tex-frames');},markFrame,focusExport(){boxes['tex-export'].querySelector('[data-action="tex-export"]')?.focus();},
  destroy(){cancelAnimationFrame(raf);removeEventListener('pointerup',endDrag,true);removeEventListener('pointercancel',endDrag,true);}};
}
