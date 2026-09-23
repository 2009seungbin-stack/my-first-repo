/* Nerulio engine-verify: loads an exported bundle with the REAL engine library (Phaser 3, Phaser 4
 * or PixiJS 8 from npm), asks the engine what it understood, lets the engine draw every frame /
 * glyph, and hands the pixels back to tools/engine-verify/web_runner.py. Nothing here judges; it
 * only reports. Loaded by harness.html?engine=<id> with plan.json next to it.
 *
 * Every frame is drawn at an integer position in its own slot of one canvas, at 1x, in a single
 * render; the runner crops the slots. Frames are drawn at their full source size (trim restored by
 * the engine itself), so a wrong spriteSourceSize/trim shows up as misplaced art. */
(function(){
'use strict';
const params=new URLSearchParams(location.search),ENGINE=params.get('engine');
const out={engine:ENGINE,loaded:false,errors:[],warnings:[],frames:[],animations:{},glyphs:{},slots:[],canvas:null};
window.addEventListener('error',e=>out.errors.push(String(e.message||e)));
window.addEventListener('unhandledrejection',e=>out.errors.push(String(e.reason&&e.reason.message||e.reason)));
const done=()=>{if(window.__result)return;window.__result=out;document.title='done';};
// An engine that throws inside its own loader never calls back; report that instead of hanging.
setTimeout(()=>{if(!window.__result){out.errors.push('the engine never finished loading (20 s); its own errors are listed above');done();}},20000);
function layout(sizes,maxW=4096,gap=null){
 // Slots sit one largest-frame-side apart, so a frame an engine draws with swapped width/height
 // (a mis-declared rotated region) cannot spill into its neighbour's slot and fail it too.
 if(gap==null)gap=Math.max(2,...sizes.map(([w,h])=>Math.max(w,h)));
 maxW=Math.max(maxW,gap*4);
 let x=gap,y=gap,row=0,W=0;const slots=[];
 for(const [w,h] of sizes){
  if(x+w+gap>maxW&&x>gap){x=gap;y+=row+gap;row=0;}
  slots.push({x,y,w,h});x+=w+gap;row=Math.max(row,h);W=Math.max(W,x);
 }
 return {slots,width:Math.max(8,W),height:Math.max(8,y+row+gap)};
}
async function plan(){return (await fetch('plan.json')).json();}

// ------------------------------------------------------------------ Phaser 3 / 4
function phaser(p){
 const P=window.Phaser;out.version=P.VERSION;
 return new Promise(resolve=>{
  const scene={
   preload(){
    this.load.on('loaderror',f=>out.errors.push(`loader error: ${f.key} ${f.url}`));
    const f=p.files,K=p.textureKey||'a';
    if(f.anims)this.load.json('__anims',f.anims);
    if(p.loader==='atlas-json')this.load.atlas(K,f.image,f.data);
    else if(p.loader==='multiatlas')this.load.multiatlas(K,f.data,f.path);
    else if(p.loader==='aseprite')this.load.aseprite('a',f.image,f.data);
    else if(p.loader==='atlas-xml')this.load.atlasXML('a',f.image,f.data);
    else if(p.loader==='spritesheet')this.load.spritesheet('a',f.image,p.grid);
    else if(p.loader==='bmfont')this.load.bitmapFont('f',f.image,f.data);
    else out.errors.push(`no Phaser loader for ${p.loader}`);
   },
   create(){
    try{
     if(p.loader==='bmfont')return phaserFont.call(this,p,resolve);
     const K=(p.loader==='atlas-json'||p.loader==='multiatlas')?(p.textureKey||'a'):'a';
     if(!this.textures.exists(K)){out.errors.push('the texture was not created');return resolve();}
     const tex=this.textures.get(K),names=tex.getFrameNames();
     out.loaded=names.length>0;
     const frames=names.map(n=>tex.get(n));
     frames.forEach((fr,i)=>out.frames.push({name:names[i],region:[fr.cutX,fr.cutY,fr.cutWidth,fr.cutHeight],
      sourceSize:[fr.realWidth,fr.realHeight],trimmed:!!fr.customData?.trimmed||fr.trimmed||false,offset:[fr.x,fr.y],rotated:!!fr.rotated}));
     if(p.files.anims){
      const made=this.anims.fromJSON(this.cache.json.get('__anims'))||[];
      if(!made.length)out.errors.push('anims.fromJSON created no animation');
      for(const a of made)out.animations[a.key]={fps:a.frameRate,loop:a.repeat===-1,repeat:a.repeat,yoyo:!!a.yoyo,
       frames:a.frames.map(f=>({name:String(f.textureFrame),durationMs:f.duration||a.msPerFrame,texture:f.textureKey}))};
     }
     if(p.loader==='aseprite'){
      const made=this.anims.createFromAseprite('a')||[];
      for(const a of made)out.animations[a.key]={fps:a.frameRate,loop:a.repeat===-1,repeat:a.repeat,
       frames:a.frames.map(f=>({name:String(f.textureFrame),durationMs:f.duration||a.msPerFrame}))};
     }
     const L=layout(frames.map(f=>[f.realWidth,f.realHeight]));
     this.scale.resize(L.width,L.height);
     frames.forEach((fr,i)=>{const s=L.slots[i];this.add.image(s.x,s.y,K,names[i]).setOrigin(0,0);});
     out.slots=L.slots;
     this.game.events.once('postrender',()=>{
      this.game.renderer.snapshot(img=>{out.canvas=img.src;resolve();});
     });
    }catch(e){out.errors.push(String(e&&e.stack||e));resolve();}
   }};
  new P.Game({type:P.AUTO,width:64,height:64,transparent:true,pixelArt:true,banner:false,audio:{noAudio:true},
   render:{preserveDrawingBuffer:true},scene});
 });
}
function phaserFont(p,resolve){
 const data=this.cache.bitmapFont.get('f');
 if(!data){out.errors.push('Phaser did not register the bitmap font');return resolve();}
 out.loaded=true;out.font={size:data.data.size,lineHeight:data.data.lineHeight,glyphs:Object.keys(data.data.chars).length};
 const chars=p.chars||[],size=Math.max(8,data.data.lineHeight||0,data.data.size||0);
 const L=layout(chars.map(()=>[size*3,size*3]));this.scale.resize(L.width,L.height);
 chars.forEach((ch,i)=>{const s=L.slots[i];out.glyphs[ch]={has:!!data.data.chars[ch.codePointAt(0)]};this.add.bitmapText(s.x+size,s.y+size,'f',ch);});
 out.slots=L.slots;
 this.game.events.once('postrender',()=>this.game.renderer.snapshot(img=>{out.canvas=img.src;resolve();}));
}

// ------------------------------------------------------------------ PixiJS 8
async function pixi(p){
 const X=window.PIXI;out.version=X.VERSION;
 const app=new X.Application();
 await app.init({width:64,height:64,backgroundAlpha:0,preference:'webgl',antialias:false});
 // What a pixel-art project sets; Pixi's default is linear, but at 1x integer positions it does not matter.
 X.TextureSource.defaultOptions.scaleMode='nearest';
 const f=p.files;
 if(p.loader==='bmfont'){
  let font;
  try{font=await X.Assets.load(f.data);}catch(e){out.errors.push(`Assets.load(${f.data}): ${e&&e.message||e}`);return;}
  out.loaded=!!font;
  const fam=font?.fontFamily||font?.fontName;out.font={family:fam,size:font?.fontMetrics?.fontSize||font?.baseMeasurementFontSize,lineHeight:font?.lineHeight,glyphs:font?Object.keys(font.chars||{}).length:0};
  const chars=p.chars||[],size=Math.max(8,out.font.lineHeight||0,out.font.size||0),c=new X.Container();
  const L=layout(chars.map(()=>[size*3,size*3]));
  chars.forEach((ch,i)=>{const s=L.slots[i];out.glyphs[ch]={has:!!(font.chars&&font.chars[ch])};
   const t=new X.BitmapText({text:ch,style:{fontFamily:fam,fontSize:out.font.size||size}});t.position.set(s.x+size,s.y+size);c.addChild(t);});
  out.slots=L.slots;
  out.canvas=app.renderer.extract.canvas({target:c,frame:new X.Rectangle(0,0,L.width,L.height)}).toDataURL('image/png');
  return;
 }
 let sheet;
 try{sheet=await X.Assets.load({src:f.data,data:{imageFilename:f.imageName}});}
 catch(e){out.errors.push(`Assets.load(${f.data}): ${e&&e.message||e}`);return;}
 if(!sheet||!sheet.textures){out.errors.push(`Pixi did not produce a Spritesheet from ${f.data} (got ${sheet&&sheet.constructor&&sheet.constructor.name})`);return;}
 // Pages linked with meta.related_multi_packs arrive as linkedSheets of the first one.
 const all={...sheet.textures};for(const l of sheet.linkedSheets||[])Object.assign(all,l.textures);
 const names=Object.keys(all);out.loaded=names.length>0;
 if(!names.length)out.errors.push(`Pixi parsed ${f.data} as ${sheet.constructor&&sheet.constructor.name} with 0 textures`);
 if((sheet.linkedSheets||[]).length)out.warnings.push(`${sheet.linkedSheets.length} linked page(s) loaded through meta.related_multi_packs`);
 const tex=names.map(n=>all[n]);
 tex.forEach((t,i)=>out.frames.push({name:names[i],region:[t.frame.x,t.frame.y,t.frame.width,t.frame.height],
  sourceSize:[t.orig.width,t.orig.height],trimmed:!!t.trim,offset:t.trim?[t.trim.x,t.trim.y]:[0,0],rotated:!!t.rotate,
  anchor:t.defaultAnchor?[t.defaultAnchor.x,t.defaultAnchor.y]:null}));
 const byTex=new Map(tex.map((t,i)=>[t,names[i]]));
 for(const [name,list] of Object.entries(sheet.animations||{}))
  out.animations[name]={fps:null,loop:null,frames:list.map(t=>({name:byTex.get(t)||null,durationMs:null}))};
 if(sheet.data?.meta?.frameTags&&!Object.keys(sheet.animations||{}).length)out.warnings.push('meta.frameTags present but Pixi builds no animations from them');
 const L=layout(tex.map(t=>[t.orig.width,t.orig.height])),c=new X.Container();
 // Drawn at the slot's top-left: a texture's default anchor (its pivot) is reported above, not applied.
 tex.forEach((t,i)=>{const s=new X.Sprite(t);s.anchor.set(0,0);s.position.set(L.slots[i].x,L.slots[i].y);c.addChild(s);});
 out.slots=L.slots;
 out.canvas=app.renderer.extract.canvas({target:c,frame:new X.Rectangle(0,0,L.width,L.height)}).toDataURL('image/png');
}

// ------------------------------------------------------------------ Spine 4.2 (spine-canvas runtime)
// The official spine-ts runtime parses the .atlas (TextureAtlas) and draws every region as a
// RegionAttachment through its own SkeletonRenderer, which applies the atlas offsets and the
// 90° rotation itself. A skeleton with one bone + slot per region is built from JSON, each slot
// centred in its own layout slot, world y down (Skeleton.yDown, the runtime's switch for y-down
// canvases). Unrotated, untrimmed regions coming out upright calibrate the set-up.
async function spineRun(p){
 const S=window.spine;out.version=(S.Skeleton&&'4.2 spine-canvas')||'';
 const text=await (await fetch(p.files.data)).text();
 const atlas=new S.TextureAtlas(text),base=p.files.data.replace(/[^/]*$/,'');
 for(const page of atlas.pages){
  const img=new Image();img.src=base+page.name;await img.decode();
  page.setTexture(new S.CanvasTexture(img));
 }
 const regions=atlas.regions;out.loaded=regions.length>0;
 const L=layout(regions.map(r=>[r.originalWidth,r.originalHeight]));
 const json={skeleton:{spine:'4.2.00'},bones:[{name:'root'}],slots:[],skins:[{name:'default',attachments:{}}]};
 regions.forEach((r,i)=>{const s=L.slots[i];
  // Skeleton space is y up; with Skeleton.yDown the runtime flips it onto the y-down canvas
  json.bones.push({name:'b'+i,parent:'root',x:s.x+r.originalWidth/2,y:-(s.y+r.originalHeight/2)});
  json.slots.push({name:'s'+i,bone:'b'+i,attachment:r.name});
  json.skins[0].attachments['s'+i]={[r.name]:{width:r.originalWidth,height:r.originalHeight}};
  out.frames.push({name:r.name,region:[r.x,r.y,r.width,r.height],sourceSize:[r.originalWidth,r.originalHeight],offset:[r.offsetX,r.offsetY],rotated:r.degrees===90,degrees:r.degrees});
 });
 S.Skeleton.yDown=true;
 const data=new S.SkeletonJson(new S.AtlasAttachmentLoader(atlas)).readSkeletonData(json);
 const sk=new S.Skeleton(data);sk.setToSetupPose();sk.updateWorldTransform(S.Physics?S.Physics.update:undefined);
 const c=document.createElement('canvas');c.width=L.width;c.height=L.height;document.body.append(c);
 const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
 const r=new S.SkeletonRenderer(ctx);r.triangleRendering=false;r.draw(sk);
 out.slots=L.slots;out.canvas=c.toDataURL('image/png');
}
// ------------------------------------------------------------------ CSS sprites (the browser)
// The exported stylesheet is linked as is; one element per `.sprite-<key>` rule is placed in its
// own slot (the classes the exported HTML uses: base class + page class + frame class) and the
// runner screenshots the page. Nothing here computes positions from the CSS itself.
async function cssRun(p){
 out.version=navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0]||'browser';
 const text=await (await fetch(p.files.data)).text();
 const link=document.createElement('link');link.rel='stylesheet';link.href=p.files.data;
 await new Promise((res,rej)=>{link.onload=res;link.onerror=()=>rej(Error('stylesheet did not load'));document.head.append(link);});
 const base=(/^\.([\w-]+)\{display/m.exec(text)||[])[1]||'sprite';
 const rules=[...text.matchAll(new RegExp(`^\\.(${base}-(?!page-)[\\w-]+)\\{width:(\\d+)px;height:(\\d+)px`,'gm'))].map(m=>({cls:m[1],w:+m[2],h:+m[3]}));
 const html=p.files.html?await (await fetch(p.files.html)).text():'';
 const pageOf=cls=>{const m=new RegExp(`class="${base} (${base}-page-\\d+) ${cls}"`).exec(html);return m?m[1]:`${base}-page-0`;};
 const L=layout(rules.map(r=>[r.w,r.h]));
 document.body.style.cssText=`margin:0;width:${L.width}px;height:${L.height}px;position:relative;background:transparent`;
 rules.forEach((r,i)=>{const s=L.slots[i],el=document.createElement('i');el.className=`${base} ${pageOf(r.cls)} ${r.cls}`;
  el.style.cssText=`position:absolute;left:${s.x}px;top:${s.y}px`;document.body.append(el);
  out.frames.push({name:r.cls.slice(base.length+1),sourceSize:[r.w,r.h]});});
 await Promise.all([...document.images].map(i=>i.decode?.()));
 await new Promise(r=>setTimeout(r,300));
 out.loaded=rules.length>0;out.slots=L.slots;out.screenshot={width:L.width,height:L.height};
}

(async()=>{
 try{
  const p=await plan();
  if(ENGINE==='pixi8')await pixi(p);else if(ENGINE==='spine')await spineRun(p);else if(ENGINE==='css')await cssRun(p);else await phaser(p);
 }catch(e){out.errors.push(String(e&&e.stack||e));}
 done();
})();
})();
