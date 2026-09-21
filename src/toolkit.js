import {imageLabel} from './image-controls.js';
import {BRAND} from './brand.js';
import {track} from './analytics.js';
import {parsePreset,serializePreset} from './presets.js';
import {SEARCH_TERMS} from './search-terms.js';
import {TOOLS} from './tool-registry.js';
import {INTENTS} from './intents.js';
import {t,getLocale} from './i18n.js';
import {esc,icon,button} from './ui.js';
import * as Im from './image.js';
import {defaults,detect,runRecipe,shareCard} from './recipes.js';
const $=selector=>document.querySelector(selector), tr=key=>t('kit.'+key);
const field=(key,html)=>`<label class="field"><span>${esc(tr(key))}</span>${html}</label>`;
const btn=(action,key,extra='')=>`<button type="button" class="kit-button" data-action="${action}" ${extra}>${esc(tr(key))}</button>`;
const prefKey='fileforge.tools.v1';
function readPrefs(){try{const p=JSON.parse(window.localStorage.getItem(prefKey)||'{}');return {favorites:Array.isArray(p.favorites)?p.favorites.filter(id=>INTENTS[id]):[],recent:Array.isArray(p.recent)?p.recent.filter(id=>INTENTS[id]).slice(0,3):[]};}catch{return {favorites:[],recent:[]};}}
/** Adds recipes without replacing the existing editors or their state. */
export class Toolkit{
  constructor(ux){
    this.u=ux;this.o=defaults('');this.rects=[];this.selected=new Set();this.frame=0;this.advanced=false;this.prefs=readPrefs();this.category='all';this.dragIndex=null;
    const d=document.createElement('dialog');d.id='toolsDialog';d.setAttribute('data-ad-exclude','');d.setAttribute('aria-labelledby','toolsTitle');d.innerHTML='<div class="dialog-heading"><h2 id="toolsTitle"></h2><button type="button" data-action="kit-close" class="icon-button">×</button></div><input id="toolSearch" type="search" autocomplete="off"><div id="toolCategories" class="kit-categories"></div><div id="toolResults"></div>';document.body.append(d);
    $('#toolSearch').addEventListener('input',()=>this.searchResults());
    d.addEventListener('close',()=>this.returnFocus?.focus({preventScroll:true}));
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!this.u.s.busy)this.openSearch();}});
    $('#panel').addEventListener('input',()=>{if(this.active)this.read();});
    $('#panel').addEventListener('change',e=>{
      if(!this.active)return;this.read();if(e.target.matches('[data-rect],[data-option="platform"],[data-option="mode"]')){this.u.invalidate();this.u.a.refresh();this.u.a.paint().catch(error=>this.u.a.message(error.message,true));}
    });
    $('#panel').addEventListener('toggle',e=>{if(e.target.id==='kitAdvanced')this.advanced=e.target.open;},true);
    $('#fileStrip').addEventListener('dragstart',e=>{if(this.active){const el=e.target.closest('[data-index]');if(el){this.dragIndex=Number(el.dataset.index);e.dataTransfer.setData('application/x-fileforge-image',el.dataset.index);}}});
    $('#fileStrip').addEventListener('dragover',e=>{if(this.active&&[...e.dataTransfer.types].includes('application/x-fileforge-image'))e.preventDefault();});
    $('#fileStrip').addEventListener('drop',e=>{if(!this.active||this.u.s.busy)return;const v=e.dataTransfer.getData('application/x-fileforge-image'),target=e.target.closest('[data-index]');if(v!==''&&target){e.preventDefault();e.stopPropagation();this.moveInput(Number(v),Number(target.dataset.index));}});
    const overlay=document.createElement('div');overlay.id='frameOverlay';overlay.setAttribute('aria-hidden','true');$('#canvasWrap').append(overlay);
  }
  get active(){return !!TOOLS[this.u.id];}
  query(){return serializePreset(this.u.id,this.o);}
  get pixelView(){return ['refiner','sprite-slicer','frame-normalize','sprite-sheet-maker','palette-swap','bitmap-font','tile-helper'].includes(this.u.id);}
  configure(id,query=''){this.o=parsePreset(id,query);this.rects=[];this.selected.clear();this.frame=0;this.advanced=false;this.sourceRef=null;this.palette=[];}
  remember(id){if(!INTENTS[id])return;this.prefs.recent=[id,...this.prefs.recent.filter(x=>x!==id)].slice(0,3);this.savePrefs();}
  savePrefs(){try{window.localStorage.setItem(prefKey,JSON.stringify(this.prefs));}catch{/* Session-only favorites remain usable. */}}
  num(key,min=0,max=8192,step=1){return field(key,`<input id="kit-${key}" data-option="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${esc(this.o[key])}">`);}
  color(key){return field(key,`<input id="kit-${key}" data-option="${key}" type="color" value="${esc(this.o[key])}">`);}
  select(key,choices){return field(key,`<select id="kit-${key}" data-option="${key}">${choices.map(([value,label])=>`<option value="${value}" ${String(this.o[key])===String(value)?'selected':''}>${esc(label)}</option>`).join('')}</select>`);}
  checkbox(key){return `<label class="checks"><input id="kit-${key}" data-option="${key}" type="checkbox" ${this.o[key]?'checked':''}>${esc(tr(key))}</label>`;}
  read(){
    if(!this.active)return;
    for(const el of $('#panel').querySelectorAll('[data-option]'))this.o[el.dataset.option]=el.type==='checkbox'?el.checked:el.type==='number'||el.type==='range'?el.valueAsNumber:el.value;
    for(const el of $('#panel').querySelectorAll('[data-channel]'))this.o.mapping[Number(el.dataset.channel)]=/^input\d+$/.test(el.value)?Number(el.value.slice(5)):el.value;
    if(this.rects[this.frame])for(const el of $('#panel').querySelectorAll('[data-rect]'))this.rects[this.frame][el.dataset.rect]=el.valueAsNumber;
  }
  presets(){if(this.u.id!=='refiner')return '';return [16,32,64,128].map(n=>`<button type="button" class="chip ${this.o.n===n?'selected':''}" data-action="kit-size:${n}" aria-pressed="${this.o.n===n}">${n}×${n}</button>`).join('');}
  controls(){
    const id=this.u.id;let basic='',advanced='';
    const align=()=>this.select('align',['bottom','center','top'].map(v=>[v,tr(v)]));
    if(id==='refiner'){
      basic=this.num('n',8,512)+this.num('colors',2,256);
      advanced=this.num('dither',0,1,.1)+this.num('outline',0,4)+this.num('padding',0,64)+this.checkbox('cleanup')+this.color('background')+this.num('tolerance',0,441)+this.checkbox('pack')+`<label class="field"><span>${esc(imageLabel('palette'))}</span><textarea data-option="palette" rows="4" maxlength="8192">${esc(this.o.palette||'')}</textarea></label><label class="field"><span>${esc(imageLabel('ditherMode'))}</span><select data-option="ditherMode"><option value="floyd-steinberg" ${this.o.ditherMode!=='ordered'?'selected':''}>Floyd–Steinberg</option><option value="ordered" ${this.o.ditherMode==='ordered'?'selected':''}>Bayer 4×4</option></select></label>`;
    }else if(id==='sprite-slicer'){
      basic=this.rects.length?`<p class="hint">${esc(tr('review'))}</p>`+this.frames():'';
      advanced=this.num('threshold',0,254)+this.num('minArea',1,4000000)+btn('kit-detect','redetect')+btn('kit-add','add');
    }else if(id==='frame-normalize'||id==='sprite-sheet-maker'){
      basic=(id==='sprite-sheet-maker'?this.num('columns',1,128):'')+align();
      advanced=this.num('width',0,8192)+this.num('height',0,8192)+this.num('padding',0,64)+this.num('anchor',0,1,.05)+`<p class="hint">${esc(tr('autoSize'))}</p>`;
      basic+=this.inputOrder();
    }else if(id==='palette-swap'){
      basic=`<div class="kit-palette">${(this.palette||[]).map(color=>`<button type="button" data-action="kit-color:${color}" style="--swatch:${color}" aria-label="${color}" data-tip="${color}"></button>`).join('')}</div>`+this.color('from')+this.color('to');
      advanced=this.num('tolerance',0,441)+this.checkbox('shading');
    }else if(id==='marketplace-pack'||id==='print-pack'){
      basic=id==='marketplace-pack'?this.select('platform',[['all','Etsy + Shopify'],['etsy','Etsy'],['shopify','Shopify'],['custom',tr('custom')]]):this.num('longSide',64,4096);
      if(id==='marketplace-pack'&&this.o.platform==='custom')basic+=this.num('width',1,8192)+this.num('height',1,8192);
      basic+=this.select('fit',[['contain',tr('fit')],['cover',tr('crop')]]);advanced=this.color('background');
    }else if(id==='logo-bg'){
      basic=this.num('tolerance',0,441);advanced=this.color('background');
    }else if(id==='bitmap-font'){
      basic=this.num('cellW',1)+this.num('cellH',1)+field('chars',`<textarea id="kit-chars" data-option="chars" rows="3" spellcheck="false">${esc(this.o.chars)}</textarea>`);
      advanced=this.num('baseline',0);
    }else if(id==='mask-packer'){
      basic=`<p class="hint">${esc(tr('mapping'))}</p>`+['R','G','B','A'].map((ch,i)=>`<label class="field"><span>${ch}</span><select id="kit-channel-${i}" data-channel="${i}">${[["zero","0"],["one","255"],...this.u.s.images.slice(0,4).map((f,j)=>['input'+j,`${j+1}. ${f.name}`])].map(([value,label])=>`<option value="${value}" ${(typeof this.o.mapping[i]==='number'?'input'+this.o.mapping[i]:this.o.mapping[i])===String(value)?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`).join('');
    }else if(id==='tile-helper'||id==='atlas-padding'){
      basic=this.num('cellW',1)+this.num('cellH',1)+(id==='atlas-padding'?this.num('padding',1,8):'');
    }else if(id==='texture-map'){
      basic=this.select('mode',[['normal',tr('normal')],['gray',tr('gray')],['invert',tr('invert')],['alpha',tr('alphaMap')]]);
      advanced=this.num('strength',0,10,.1)+this.checkbox('invertY');
    }else if(id==='scan-split'){
      basic=this.num('divider',.01,.99,.01)+this.select('order',[['LR','L → R'],['RL','R → L']]);
    }else if(id==='margin-crop')advanced=this.num('threshold',0,255)+this.num('padding',0,64);
    return basic+(advanced?`<details id="kitAdvanced" ${this.advanced?'open':''}><summary>${esc(tr('advanced'))}</summary>${advanced}</details>`:'');
  }
  frames(){
    const r=this.rects[this.frame]||this.rects[0];
    return `<div class="kit-frame-list">${this.rects.map((r,i)=>`<div class="kit-frame-row"><input type="checkbox" data-frame-select="${i}" aria-label="${esc(tr('frame'))} ${i+1}" ${this.selected.has(i)?'checked':''}><button type="button" data-action="kit-frame:${i}" aria-pressed="${i===this.frame}">${String(i+1).padStart(2,'0')} · ${r.w}×${r.h}</button></div>`).join('')}</div><div class="kit-mini-actions">${btn('kit-delete','delete')+btn('kit-merge','merge')+btn('kit-add','add')}</div><details><summary>${esc(tr('frame'))} ${this.frame+1}</summary><div class="kit-rect">${['x','y','w','h'].map(key=>`<label>${key.toUpperCase()}<input id="kit-rect-${key}" data-rect="${key}" type="number" min="${key==='w'||key==='h'?1:0}" value="${r[key]}"></label>`).join('')}</div><div class="kit-mini-actions">${btn('kit-frame-move:-1','up')+btn('kit-frame-move:1','down')}</div></details>`;
  }
  inputOrder(){return `<details><summary>${esc(tr('frameOrder'))}</summary><div class="kit-inputs">${this.u.s.images.map((f,i)=>`<div><span>${i+1}. ${esc(f.name)}</span>${button(`kit-input:${i}:-1`,'left',tr('up'),i===0?'disabled':'')}${button(`kit-input:${i}:1`,'right',tr('down'),i===this.u.s.images.length-1?'disabled':'')}</div>`).join('')}</div></details>`;}
  render(){
    const u=this.u,has=!!u.a.ready();
    if(!$('#exploreButton')){const b=document.createElement('button');b.id='exploreButton';b.className='kit-explore';b.dataset.action='kit-explore';$('.header-end').prepend(b);}
    $('#exploreButton').innerHTML=icon('search',18);$('#exploreButton').setAttribute('aria-label',tr('explore'));$('#exploreButton').dataset.tip=tr('search')+' · Ctrl/⌘ K';
    $('#frameOverlay').hidden=true;
    document.body.classList.toggle('recipe-active',this.active);document.body.classList.toggle('home-empty',u.id==='home'&&!has);
    if(this.active){
      const source=u.s.c;
      if(this.sourceRef!==source){this.sourceRef=source;this.rects=[];this.selected.clear();this.frame=0;
        this.palette=[];
        if(source&&u.id==='palette-swap'){
          const sample=Im.resize(source,Math.min(source.width,128),Math.min(source.height,128),true),data=sample.getContext('2d').getImageData(0,0,sample.width,sample.height).data,map=new Map();
          for(let i=0;i<data.length;i+=4)if(data[i+3]>127){const hex='#'+Array.from(data.slice(i,i+3),v=>v.toString(16).padStart(2,'0')).join('');map.set(hex,(map.get(hex)||0)+1);}
          this.palette=[...map].sort((a,b)=>b[1]-a[1]).slice(0,16).map(x=>x[0]);Im.release(sample);if(this.palette.length)this.o.from=this.palette[0];
        }
      }
      if(has){
        const primary=$('#intentControls .intent-primary');if(primary&&!u.result)primary.querySelector('span').textContent=u.id==='sprite-slicer'&&!this.rects.length?tr('detect'):tr('run');
        const panel=$('#panel');panel.hidden=u.s.tool!=='recipe';
        if(!panel.hidden){panel.innerHTML=`<div class="panel-header"><h2>${esc(t(`intent.${u.id}.title`))}</h2>${button('intent-settings','close',tr('close'))}</div><div class="panel-content kit-settings">${this.controls()}<p class="hint">${esc(TOOLS[u.id].limit[{ko:0,en:1,ja:2}[getLocale()]])}</p><p class="hint">${esc(tr('limit'))}</p></div>`;
          panel.querySelectorAll('[data-frame-select]').forEach(el=>el.addEventListener('change',()=>{el.checked?this.selected.add(Number(el.dataset.frameSelect)):this.selected.delete(Number(el.dataset.frameSelect));}));
        }
        $('#toolDock').innerHTML=button('intent-settings','sliders',tr('advanced'))+button('kit-explore','search',tr('explore'));
        if(u.id==='sprite-slicer'&&this.rects.length&&!u.result){
          const el=$('#frameOverlay');el.hidden=false;el.innerHTML=this.rects.map((r,i)=>`<span class="${i===this.frame?'selected':''}" style="left:${r.x/source.width*100}%;top:${r.y/source.height*100}%;width:${r.w/source.width*100}%;height:${r.h/source.height*100}%"><b>${i+1}</b></span>`).join('');
        }
        if(['frame-normalize','sprite-sheet-maker'].includes(u.id))$('#fileStrip').querySelectorAll('[data-index]').forEach(el=>el.draggable=true);
        if(u.result?.outputCount){const p=document.createElement('p');p.className='hint kit-output-note';p.textContent=tr('inspect');$('#intentControls').append(p);}
      }
      $('#editorKicker').textContent=TOOLS[u.id].category==='game'?({ko:'게임 에셋',en:'GAME ASSETS',ja:'ゲーム素材'})[getLocale()]:({ko:'이미지',en:'IMAGE',ja:'画像'})[getLocale()];
      $('#landingPresets').innerHTML=this.presets();
    }
    if(u.result?.canvas&&u.s.c){const row=$('#intentControls .intent-action-row');if(row&&!row.querySelector('[data-action="kit-share"]'))row.insertAdjacentHTML('beforeend',button('kit-share','share',tr('share'))+button('copy-tool-link','link',({ko:'도구 링크 복사',en:'Copy tool link',ja:'ツールリンクをコピー'})[getLocale()]));}
    if($('#toolsDialog').open)this.searchResults();
  }
  async run(){
    const u=this.u;if(!u.s.c){u.a.message(tr('inputFirst'));return;}
    this.read();this.remember(u.id);
    if(u.id==='sprite-slicer'&&!this.rects.length){await this.findFrames();return;}
    u.s.runIntent=u.id;track('tool_run');u.invalidate();await u.a.task(tr('preparing'),async(progress,signal)=>{
      let r;try{r=await runRecipe(u.id,{source:u.s.c,items:u.s.images,options:this.o,rects:this.rects,signal,progress});}catch(error){if(error.name!=='AbortError')error.message=t(error.message);throw error;}
      try{u.a.check(signal);u.result={...r,beforeW:u.s.c.width,beforeH:u.s.c.height,beforeSize:u.a.file()?.blob.size||0};u.s.tool='';}catch(e){Im.release(r.canvas);throw e;}
    });
  }
  async findFrames(){
    const u=this.u;this.read();u.invalidate();await u.a.task(tr('preparing'),async(_,signal)=>{try{this.rects=await detect(u.s.c,this.o,signal);}catch(error){if(error.name!=='AbortError')error.message=t(error.message);throw error;}this.frame=0;this.selected.clear();u.s.tool='recipe';if(!this.rects.length)u.a.message(tr('none'));});
  }
  moveInput(from,to){const s=this.u.s;if(from===to||from<0||to<0||from>=s.images.length||to>=s.images.length)return;this.read();const selected=s.images[s.index],[item]=s.images.splice(from,1);s.images.splice(to,0,item);s.index=s.images.indexOf(selected);this.u.invalidate();this.u.a.refresh();this.u.a.paint().catch(e=>this.u.a.message(e.message,true));}
  openSearch(){this.returnFocus=document.activeElement;$('#toolsTitle').textContent=tr('search');$('#toolSearch').placeholder=tr('search');$('#toolSearch').setAttribute('aria-label',tr('search'));$('#toolsDialog [data-action="kit-close"]').setAttribute('aria-label',tr('close'));$('#toolSearch').value='';this.category='all';this.searchResults();if(!$('#toolsDialog').open)$('#toolsDialog').showModal();$('#toolSearch').focus();}
  searchResults(){
    const query=$('#toolSearch').value.toLocaleLowerCase().trim();
    $('#toolCategories').innerHTML=['all','image','game','pdf','media'].map(id=>`<button type="button" data-action="kit-category:${id}" aria-pressed="${this.category===id}">${esc(tr(id))}</button>`).join('');
    const keys=Object.keys(INTENTS).filter(id=>!['home','image','pdf','media'].includes(id));
    const category=id=>TOOLS[id]?.category||(INTENTS[id].editor==='pixel'?'game':INTENTS[id].editor);
    const matches=id=>(this.category==='all'||this.category===category(id))&&(!query||[id,INTENTS[id].path,...(SEARCH_TERMS[id]||[]),...(TOOLS[id]?.title||[]),t(`intent.${id}.title`),t(`intent.${id}.description`)].join(' ').toLocaleLowerCase().includes(query));
    const rows=ids=>ids.filter(matches).map(id=>`<div class="kit-tool-row"><button type="button" data-action="kit-open:${id}">${icon(INTENTS[id].icon,22)}<span><strong>${esc(t(`intent.${id}.title`))}</strong><small>${esc(t(`intent.${id}.description`))}</small></span></button><button type="button" class="kit-star" data-action="kit-star:${id}" aria-label="${esc(tr('favorite'))}" aria-pressed="${this.prefs.favorites.includes(id)}">${this.prefs.favorites.includes(id)?'★':'☆'}</button></div>`).join('');
    const favorite=this.prefs.favorites.filter(matches),recent=this.prefs.recent.filter(id=>matches(id)&&!favorite.includes(id));
    $('#toolResults').innerHTML=(!query&&favorite.length?`<h3>${esc(tr('favorites'))}</h3>${rows(favorite)}`:'')+(!query&&recent.length?`<h3>${esc(tr('recent'))}</h3>${rows(recent)}`:'')+rows(keys.filter(id=>query||!favorite.includes(id)&&!recent.includes(id)))||`<p>${esc(tr('noMatches'))}</p>`;
  }
  async action(action){
    const u=this.u;
    if(action==='kit-explore'){this.openSearch();return true;}
    if(action==='kit-close'){$('#toolsDialog').close();return true;}
    if(action.startsWith('kit-category:')){this.category=action.split(':')[1];this.searchResults();return true;}
    if(action.startsWith('kit-star:')){const id=action.split(':')[1];this.prefs.favorites=this.prefs.favorites.includes(id)?this.prefs.favorites.filter(x=>x!==id):[...this.prefs.favorites,id];this.savePrefs();this.searchResults();return true;}
    if(action.startsWith('kit-open:')){$('#toolsDialog').close();const id=action.split(':')[1];this.remember(id);await u.enter(id,{consume:false});return true;}
    if(action==='kit-share'){
      if(!u.s.c||!u.result?.canvas)return true;
      const blob=await shareCard(u.s.c,u.result.canvas,getLocale()),file=new File([blob],BRAND.name.toLowerCase()+'-share.png',{type:'image/png'});
      if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file]});track('share_result',{method:'native'});}catch(e){if(e.name!=='AbortError'){Im.download(blob,file.name,{measure:false});track('share_result',{method:'download'});}}}else {Im.download(blob,file.name,{measure:false});track('share_result',{method:'download'});}return true;
    }
    if(!this.active)return false;
    if(action.startsWith('select:')){this.rects=[];this.selected.clear();}
    if(action==='kit-detect'){await this.findFrames();return true;}
    if(action.startsWith('kit-input:')){const [,i,d]=action.split(':');this.moveInput(Number(i),Number(i)+Number(d));return true;}
    if(action.startsWith('kit-size:')){this.read();this.o.n=Number(action.split(':')[1]);u.invalidate();u.a.refresh();await u.a.paint();return true;}
    if(action.startsWith('kit-color:')){this.read();this.o.from=action.split(':')[1];u.invalidate();u.a.refresh();await u.a.paint();return true;}
    if(action.startsWith('kit-frame:')){this.read();this.frame=Number(action.split(':')[1]);u.a.refresh();await u.a.paint();return true;}
    if(['kit-add','kit-delete','kit-merge'].includes(action)||action.startsWith('kit-frame-move:')){
      this.read();u.invalidate();
      if(action==='kit-add'&&this.rects.length<4096)this.rects.push({x:0,y:0,w:Math.min(32,u.s.c.width),h:Math.min(32,u.s.c.height)}),this.frame=this.rects.length-1;
      if(action==='kit-delete')this.rects=this.rects.filter((_,i)=>this.selected.size?!this.selected.has(i):i!==this.frame);
      if(action==='kit-merge'&&this.selected.size>1){const chosen=this.rects.filter((_,i)=>this.selected.has(i)),x=Math.min(...chosen.map(r=>r.x)),y=Math.min(...chosen.map(r=>r.y));const box={x,y,w:Math.max(...chosen.map(r=>r.x+r.w))-x,h:Math.max(...chosen.map(r=>r.y+r.h))-y},first=Math.min(...this.selected);this.rects=this.rects.flatMap((r,i)=>i===first?[box]:this.selected.has(i)?[]:[r]);}
      if(action.startsWith('kit-frame-move:')){const to=this.frame+Number(action.split(':')[1]);if(to>=0&&to<this.rects.length){const [r]=this.rects.splice(this.frame,1);this.rects.splice(to,0,r);this.frame=to;}}
      this.frame=Math.max(0,Math.min(this.frame,this.rects.length-1));this.selected.clear();u.s.tool='recipe';u.a.refresh();await u.a.paint();return true;
    }
    return false;
  }
}
