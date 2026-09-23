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

(async()=>{
 try{
  const p=await plan();
  if(ENGINE==='pixi8')await pixi(p);else await phaser(p);
 }catch(e){out.errors.push(String(e&&e.stack||e));}
 done();
})();
})();
