/** Texture-atlas packing and export formats. Pure functions (no DOM) so they are unit-tested
 * in Node and shared by the sprite-sheet tool.
 *
 * packRects: MaxRects, best-short-side-fit, optional 90° rotation, grows the bin until
 * everything fits (power-of-two sizes when asked). Each input is {id,w,h}; padding is added
 * around every sprite so neighbours never touch. */
export function packRects(rects,{maxSize=4096,padding=0,pot=false,rotate=false,layout='packed',columns=0}={}){
 if(!rects.length)throw Error('Add at least one image.');
 const items=rects.map(r=>({...r,pw:r.w+padding*2,ph:r.h+padding*2}));
 for(const r of items)if(Math.min(r.pw,r.ph)>maxSize||Math.max(r.pw,r.ph)>maxSize)throw Error(`"${r.id}" (${r.w}×${r.h}) is larger than the ${maxSize}px atlas limit.`);
 const next=n=>{let p=1;while(p<n)p*=2;return p;},finish=(placed,w,h)=>({width:pot?next(w):w,height:pot?next(h):h,placements:placed});
 if(layout!=='packed'){
  const cols=layout==='row'?items.length:layout==='column'?1:Math.max(1,columns||Math.ceil(Math.sqrt(items.length))),cw=Math.max(...items.map(r=>r.pw)),ch=Math.max(...items.map(r=>r.ph));
  const placed=items.map((r,i)=>({id:r.id,x:(i%cols)*cw+padding,y:Math.floor(i/cols)*ch+padding,w:r.w,h:r.h,rotated:false,cellW:cw,cellH:ch}));
  const w=Math.min(items.length,cols)*cw,h=Math.ceil(items.length/cols)*ch;if(Math.max(w,h)>maxSize)throw Error(`This layout needs ${w}×${h}px, above the ${maxSize}px limit. Use packed layout or a larger limit.`);
  return finish(placed,w,h);
 }
 const order=[...items].sort((a,b)=>Math.max(b.pw,b.ph)-Math.max(a.pw,a.ph)||b.pw*b.ph-a.pw*a.ph),area=items.reduce((s,r)=>s+r.pw*r.ph,0);
 // The first guess is clamped to the limit: unclamped, a set whose total area exceeds maxSize²
 // could be packed into that oversized first guess and returned, quietly ignoring the limit.
 let side=Math.min(maxSize,Math.max(Math.ceil(Math.sqrt(area)),...items.map(r=>Math.min(r.pw,r.ph))));if(pot)side=next(side);
 for(let w=side,h=side;;){
  const placed=tryPack(order,w,h,rotate);
  if(placed){const usedW=Math.max(...placed.map(p=>p.x+(p.rotated?p.h:p.w)+padding*2)),usedH=Math.max(...placed.map(p=>p.y+(p.rotated?p.w:p.h)+padding*2));return finish(placed.map(p=>({...p,x:p.x+padding,y:p.y+padding})),pot?w:usedW,pot?h:usedH);}
  if(w>=maxSize&&h>=maxSize)throw Error(`These images do not fit in one ${maxSize}×${maxSize} atlas. Raise the size limit or pack fewer images.`);
  if(pot){if(w<=h)w=Math.min(maxSize,w*2);else h=Math.min(maxSize,h*2);}else{const grow=Math.ceil(Math.max(w,h)*.12)+1;if(w<=h)w=Math.min(maxSize,w+grow);else h=Math.min(maxSize,h+grow);}
 }
}
function tryPack(order,W,H,rotate){
 let free=[{x:0,y:0,w:W,h:H}];const placed=[];
 for(const r of order){
  let best=null;
  for(const f of free)for(const rot of rotate&&r.pw!==r.ph?[false,true]:[false]){const w=rot?r.ph:r.pw,h=rot?r.pw:r.ph;if(w>f.w||h>f.h)continue;const short=Math.min(f.w-w,f.h-h),long=Math.max(f.w-w,f.h-h);if(!best||short<best.short||short===best.short&&long<best.long)best={x:f.x,y:f.y,w,h,rot,short,long};}
  if(!best)return null;
  placed.push({id:r.id,x:best.x,y:best.y,w:r.w,h:r.h,rotated:best.rot});
  const used={x:best.x,y:best.y,w:best.w,h:best.h},split=[];
  for(const f of free){
   if(used.x>=f.x+f.w||used.x+used.w<=f.x||used.y>=f.y+f.h||used.y+used.h<=f.y){split.push(f);continue;}
   if(used.x>f.x)split.push({x:f.x,y:f.y,w:used.x-f.x,h:f.h});
   if(used.x+used.w<f.x+f.w)split.push({x:used.x+used.w,y:f.y,w:f.x+f.w-used.x-used.w,h:f.h});
   if(used.y>f.y)split.push({x:f.x,y:f.y,w:f.w,h:used.y-f.y});
   if(used.y+used.h<f.y+f.h)split.push({x:f.x,y:used.y+used.h,w:f.w,h:f.y+f.h-used.y-used.h});
  }
  free=split.filter((a,i)=>!split.some((b,j)=>i!==j&&a.x>=b.x&&a.y>=b.y&&a.x+a.w<=b.x+b.w&&a.y+a.h<=b.y+b.h&&(a.w!==b.w||a.h!==b.h||a.x!==b.x||a.y!==b.y||i>j)));
 }
 return placed;
}
/** frames: [{name,x,y,w,h,rotated,trimmed,sourceW,sourceH,offsetX,offsetY}] in atlas pixels. */
export const ATLAS_FORMATS=Object.freeze({'json-hash':{ext:'json',label:'JSON (Hash) — Phaser · PixiJS'},'json-array':{ext:'json',label:'JSON (Array) — TexturePacker'},xml:{ext:'xml',label:'XML — Starling · Sparrow'},godot:{ext:'tres.txt',label:'Godot — AtlasTexture regions'},unity:{ext:'json',label:'Unity — JSON for sprite importers'},css:{ext:'css',label:'CSS sprites'},csv:{ext:'csv',label:'CSV'}});
const xmlEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function atlasData(format,frames,{image='atlas.png',width,height,app='Nerulio'}={}){
 const tp=f=>({frame:{x:f.x,y:f.y,w:f.rotated?f.h:f.w,h:f.rotated?f.w:f.h},rotated:!!f.rotated,trimmed:!!f.trimmed,spriteSourceSize:{x:f.offsetX||0,y:f.offsetY||0,w:f.w,h:f.h},sourceSize:{w:f.sourceW??f.w,h:f.sourceH??f.h}});
 const meta={app,version:'1.0',image,format:'RGBA8888',size:{w:width,h:height},scale:'1'};
 if(format==='json-hash')return JSON.stringify({frames:Object.fromEntries(frames.map(f=>[f.name,tp(f)])),meta},null,2);
 if(format==='json-array')return JSON.stringify({frames:frames.map(f=>({filename:f.name,...tp(f)})),meta},null,2);
 if(format==='unity')return JSON.stringify({texture:image,width,height,sprites:frames.map(f=>({name:f.name.replace(/\.[^.]+$/,''),rect:{x:f.x,y:height-f.y-(f.rotated?f.w:f.h),width:f.rotated?f.h:f.w,height:f.rotated?f.w:f.h},pivot:{x:.5,y:.5},rotated:!!f.rotated}))},null,2);
 if(format==='xml')return `<?xml version="1.0" encoding="UTF-8"?>\n<TextureAtlas imagePath="${xmlEsc(image)}" width="${width}" height="${height}">\n${frames.map(f=>`  <SubTexture name="${xmlEsc(f.name.replace(/\.[^.]+$/,''))}" x="${f.x}" y="${f.y}" width="${f.rotated?f.h:f.w}" height="${f.rotated?f.w:f.h}"${f.rotated?' rotated="true"':''}${f.trimmed?` frameX="${-(f.offsetX||0)}" frameY="${-(f.offsetY||0)}" frameWidth="${f.sourceW}" frameHeight="${f.sourceH}"`:''}/>`).join('\n')}\n</TextureAtlas>\n`;
 if(format==='godot')return `; Godot 4 — one AtlasTexture region per sprite. Create AtlasTexture resources with these regions\n; (atlas = ${image}). Rotated sprites are not supported by AtlasTexture: pack without rotation.\n${frames.map(f=>`[${f.name.replace(/\.[^.]+$/,'')}]\nregion = Rect2(${f.x}, ${f.y}, ${f.w}, ${f.h})\nmargin = Rect2(${f.offsetX||0}, ${f.offsetY||0}, ${(f.sourceW??f.w)-f.w}, ${(f.sourceH??f.h)-f.h})`).join('\n\n')}\n`;
 if(format==='css')return `.sprite{display:inline-block;background-image:url('${image}');background-repeat:no-repeat}\n${frames.map(f=>`.sprite-${f.name.replace(/\.[^.]+$/,'').replace(/[^\w-]+/g,'-')}{width:${f.w}px;height:${f.h}px;background-position:-${f.x}px -${f.y}px}`).join('\n')}\n`;
 if(format==='csv')return `name,x,y,width,height,rotated,offsetX,offsetY,sourceWidth,sourceHeight\n${frames.map(f=>[JSON.stringify(f.name),f.x,f.y,f.w,f.h,!!f.rotated,f.offsetX||0,f.offsetY||0,f.sourceW??f.w,f.sourceH??f.h].join(',')).join('\n')}\n`;
 throw Error('Unknown atlas format');
}
