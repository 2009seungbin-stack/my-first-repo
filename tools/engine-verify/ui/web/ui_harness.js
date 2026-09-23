/* Nerulio UI engine-verify (web): draws every nine-slice case of plan.json with the REAL engine
 * (Phaser 3.90 / Phaser 4 `add.nineslice`, PixiJS 8 `NineSliceSprite`, or the browser's own CSS
 * `border-image`) into one canvas, each case in its own slot, and hands the pixels back to
 * tools/engine-verify/ui/web_ui.py. Borders come from the bundle's own files (the atlas JSON's
 * `scale9Borders` for Phaser, `borders` for Pixi, the stylesheet for CSS): nothing is re-derived
 * here. Nothing here judges. Also draws bitmap-font text (mode "font"). */
(function(){
'use strict';
const params=new URLSearchParams(location.search),ENGINE=params.get('engine');
const out={engine:ENGINE,errors:[],warnings:[],info:{},canvas:null,cases:{}};
window.addEventListener('error',e=>out.errors.push(String(e.message||e)));
window.addEventListener('unhandledrejection',e=>out.errors.push(String(e.reason&&e.reason.message||e.reason)));
const done=()=>{if(!window.__result)window.__result=out;};
setTimeout(()=>{if(!window.__result){out.errors.push('the engine never finished (60 s)');done();}},60000);
const plan=async()=>(await fetch('plan.json')).json();

// ------------------------------------------------------------------ Phaser 3 / 4
function phaser(p){
 const P=window.Phaser;out.version=P.VERSION;
 return new Promise(resolve=>{
  const scene={
   preload(){
    this.load.on('loaderror',f=>out.errors.push(`loader error: ${f.key} ${f.url}`));
    if(p.mode==='font'){for(const f of p.fonts)this.load.bitmapFont(f.key,f.image,f.data);return;}
    for(const a of p.atlases)this.load.atlas(a.key,a.image,a.json);
   },
   create(){
    try{
     this.scale.resize(p.canvas[0],p.canvas[1]);
     if(p.mode==='font')phaserFont.call(this,p);
     else for(const c of p.cases){
      const tex=this.textures.get(c.key),fr=tex&&tex.get(c.element);
      if(!fr||fr.name!==c.element){out.cases[c.id]={error:`no frame ${c.element} in ${c.key}`};continue;}
      const s=c.scale,ns=this.add.nineslice(c.slot[0],c.slot[1],c.key,c.element,c.w/s,c.h/s);
      ns.setOrigin(0,0);ns.setScale(s);
      out.cases[c.id]={scale9:!!fr.scale9,is3Slice:!!(fr.data&&fr.data.is3Slice),slices:[ns.leftWidth,ns.rightWidth,ns.topHeight,ns.bottomHeight],
       size:[ns.width,ns.height],display:[ns.displayWidth,ns.displayHeight]};
      if(c.setSize){ns.setSize(c.w/s,c.h/s);out.cases[c.id].afterSetSize=[ns.width,ns.height];}
     }
     this.game.events.once('postrender',()=>this.game.renderer.snapshot(img=>{out.canvas=img.src;resolve();}));
    }catch(e){out.errors.push(String(e&&e.stack||e));resolve();}
   }};
  new P.Game({type:P.WEBGL,width:64,height:64,transparent:true,pixelArt:true,banner:false,audio:{noAudio:true},
   render:{preserveDrawingBuffer:true},scene});
 });
}
function phaserFont(p){
 for(const t of p.texts){
  const data=this.cache.bitmapFont.get(t.font);
  if(!data){out.errors.push(`Phaser did not register the bitmap font ${t.font}`);continue;}
  out.info[t.font]={size:data.data.size,lineHeight:data.data.lineHeight,glyphs:Object.keys(data.data.chars).length,
   kerning:Object.values(data.data.chars).reduce((n,c)=>n+Object.keys(c.kerning||{}).length,0),
   pages:(this.textures.get(t.font).source||[]).length};
  const bt=this.add.bitmapText(t.slot[0],t.slot[1],t.font,t.text,t.size);
  out.cases[t.id]={width:bt.width,height:bt.height,missing:[...t.text].filter(ch=>ch!=='\n'&&!data.data.chars[ch.codePointAt(0)]).length};
 }
}

// ------------------------------------------------------------------ PixiJS 8
async function pixi(p){
 const X=window.PIXI;out.version=X.VERSION;
 X.TextureSource.defaultOptions.scaleMode='nearest';
 const app=new X.Application();
 await app.init({width:p.canvas[0],height:p.canvas[1],backgroundAlpha:0,preference:'webgl',antialias:false});
 const root=new X.Container();
 if(p.mode==='font'){await pixiFont(X,p,root);}
 else{
  const sheets={};
  for(const a of p.atlases){
   try{sheets[a.key]=await X.Assets.load(a.json);}catch(e){out.errors.push(`Assets.load(${a.json}): ${e&&e.message||e}`);}
  }
  for(const c of p.cases){
   const t=sheets[c.key]&&sheets[c.key].textures[c.element];
   if(!t){out.cases[c.id]={error:`no texture ${c.element}`};continue;}
   const s=c.scale,n=new X.NineSliceSprite({texture:t,width:c.w/s,height:c.h/s});
   n.position.set(c.slot[0],c.slot[1]);n.scale.set(s);root.addChild(n);
   out.cases[c.id]={borders:t.defaultBorders||null,slices:[n.leftWidth,n.rightWidth,n.topHeight,n.bottomHeight]};
  }
 }
 out.canvas=app.renderer.extract.canvas({target:root,frame:new X.Rectangle(0,0,p.canvas[0],p.canvas[1])}).toDataURL('image/png');
}
async function pixiFont(X,p,root){
 const fonts={};
 for(const f of p.fonts){
  try{fonts[f.key]=await X.Assets.load(f.data);}catch(e){out.errors.push(`Assets.load(${f.data}): ${e&&e.message||e}`);continue;}
  const bf=fonts[f.key];
  out.info[f.key]={family:bf.fontFamily,size:bf.fontMetrics&&bf.fontMetrics.fontSize,baseSize:bf.baseMeasurementFontSize,lineHeight:bf.lineHeight,
   glyphs:Object.keys(bf.chars||{}).length,distanceField:bf.distanceField||null,pages:(bf.pages||[]).length,
   kerning:Object.values(bf.chars||{}).reduce((n,c)=>n+Object.keys(c.kerning||{}).length,0)};
 }
 for(const t of p.texts){
  const bf=fonts[t.font];if(!bf)continue;
  const bt=new X.BitmapText({text:t.text,style:{fontFamily:bf.fontFamily,fontSize:t.size}});
  bt.position.set(t.slot[0],t.slot[1]);root.addChild(bt);
  out.cases[t.id]={width:bt.width,height:bt.height,missing:[...t.text].filter(ch=>ch!=='\n'&&!(bf.chars||{})[ch]).length};
 }
}

// ------------------------------------------------------------------ CSS border-image (the browser)
async function cssRun(p){
 out.version=navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0]||'browser';
 if(p.mode==='font'){out.errors.push('CSS has no bitmap-font loader');return;}
 for(const href of p.stylesheets){
  const link=document.createElement('link');link.rel='stylesheet';link.href=href;
  await new Promise((res,rej)=>{link.onload=res;link.onerror=()=>rej(Error(`stylesheet ${href} did not load`));document.head.append(link);});
 }
 document.body.style.cssText=`margin:0;width:${p.canvas[0]}px;height:${p.canvas[1]}px;position:relative;background:transparent`;
 const els=[];
 for(const c of p.cases){
  const el=document.createElement('div');els.push(el);el.className=c.className||`nui-${c.element}`;
  el.style.cssText=`position:absolute;left:${c.slot[0]}px;top:${c.slot[1]}px;width:${c.w}px;height:${c.h}px;--nui-scale:${c.scale};${c.style||''}`;
  document.body.append(el);
  const cs=getComputedStyle(el);
  out.cases[c.id]={borderImageWidth:cs.borderImageWidth,borderImageRepeat:cs.borderImageRepeat,borderImageSlice:cs.borderImageSlice,
   padding:[cs.borderLeftWidth,cs.borderRightWidth,cs.borderTopWidth,cs.borderBottomWidth]};
 }
 for(let i=0;i<els.length;i++){const r=els[i].getBoundingClientRect();out.cases[p.cases[i].id].box=[r.width,r.height];}
 // wait until every border image is decoded
 const urls=[...new Set(els.map(e=>getComputedStyle(e).borderImageSource))];
 await Promise.all(urls.map(u=>{const m=/url\("?([^")]+)"?\)/.exec(u);if(!m)return;const i=new Image();i.src=m[1];return i.decode().catch(()=>out.errors.push(`${m[1]} did not decode`));}));
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 await new Promise(r=>setTimeout(r,300));
 out.screenshot={width:p.canvas[0],height:p.canvas[1]};
}

(async()=>{
 try{
  const p=await plan();
  if(ENGINE==='pixi8')await pixi(p);else if(ENGINE==='css')await cssRun(p);else await phaser(p);
 }catch(e){out.errors.push(String(e&&e.stack||e));}
 done();
})();
})();
