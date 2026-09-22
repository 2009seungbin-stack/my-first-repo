/** Deterministic sprite fixtures for the Sprite Lab engine tests. Everything here is generated
 * from a seeded PRNG so a failure is reproducible, and every helper returns plain RGBA
 * ({data,width,height}) — the same shape src/game/pixels.js accepts. */
export const rand=seed=>()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
export function canvas(width,height,fill=[0,0,0,0]){
 const data=new Uint8ClampedArray(width*height*4);
 if(fill[3])for(let i=0;i<data.length;i+=4)data.set(fill,i);
 return {data,width,height};
}
export const put=(img,x,y,c)=>{if(x<0||y<0||x>=img.width||y>=img.height)return;img.data.set(c,(y*img.width+x)*4);};
export const at=(img,x,y)=>img.data.subarray((y*img.width+x)*4,(y*img.width+x)*4+4);
export function box(img,x,y,w,h,c){for(let j=0;j<h;j++)for(let i=0;i<w;i++)put(img,x+i,y+j,c);return img;}
export function disc(img,cx,cy,r,c){for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++)if((x-cx)**2+(y-cy)**2<=r*r)put(img,x,y,c);return img;}
export function blit(dest,src,dx,dy){
 for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){const a=src.data[(y*src.width+x)*4+3];if(a)put(dest,dx+x,dy+y,at(src,x,y));}
 return dest;
}
export const opaque=(img,threshold=8)=>{let n=0;for(let i=3;i<img.data.length;i+=4)if(img.data[i]>threshold)n++;return n;};
export function bbox(img,threshold=8){
 let x0=img.width,y0=img.height,x1=-1,y1=-1;
 for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){if(img.data[(y*img.width+x)*4+3]<=threshold)continue;
  if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
/** A little humanoid: head, torso, two arms, two legs. `legLift` swings the legs and `armLift` the
 * arms, in opposite directions and with equal masses, and the four limb bands never overlap each
 * other or the body. So the silhouette changes shape every frame while the opaque pixel count —
 * and therefore the alpha centroid — stays exactly the same. That makes it a fixture where a
 * measured jitter of zero is the right answer. */
export function walker(w=24,h=40,{legLift=0,armLift=0,skin=[230,180,140,255],shirt=[60,120,220,255],pants=[40,40,70,255]}={}){
 if(w<24||h<40)throw Error('the walker needs at least 24×40');
 const img=canvas(w,h),cx=w>>1;
 disc(img,cx,6,5,skin);                                              // head   y 1…11, x cx-5…cx+5
 box(img,cx-4,13,9,8,shirt);                                         // torso  y 13…20
 box(img,cx-8,14+armLift,3,8,skin);box(img,cx+6,14-armLift,3,8,skin);// arms   y 11…24 outside the torso columns
 box(img,cx-4,24+legLift,4,10,pants);box(img,cx+1,24-legLift,4,10,pants);// legs y 21…36
 return img;
}
/** Frames drawn at one size. `jitter(i)` shifts the whole body by whole pixels (the wobble to be
 * removed); `motion(i)` shifts it deliberately (the movement that must survive). */
export function walkCycle(count=8,{width=24,height=40,pad=8,jitter=()=>[0,0],amplitude=3,motion=null}={}){
 return Array.from({length:count},(_,i)=>{
  const lift=Math.round(Math.sin(i/count*Math.PI*2)*amplitude);
  const body=walker(width,height,{legLift:lift,armLift:-lift});
  const [jx,jy]=jitter(i),[mx,my]=motion?motion(i):[0,0];
  const out=canvas(width+pad*2,height+pad*2);
  blit(out,body,pad+jx+mx,pad+jy+my);
  return out;
 });
}
/** Stacks images down one sheet with a transparent gap, and gives back the rectangle of each. */
export function stack(images,gap=2){
 const width=Math.max(...images.map(i=>i.width)),height=images.reduce((s,i)=>s+i.height+gap,0)-gap;
 const sheet=canvas(width,height),rects=[];let y=0;
 for(const img of images){blit(sheet,img,0,y);rects.push({x:0,y,w:img.width,h:img.height});y+=img.height+gap;}
 return {sheet,rects};
}
/** Uniform grid sheet: every cell drawn by `draw(cellCanvas,index)`. */
export function gridSheet({cellW=32,cellH=32,cols=4,rows=2,margin=0,spacing=0,marginY=margin,spacingY=spacing,draw}={}){
 const width=margin*2+cols*cellW+(cols-1)*spacing,height=marginY*2+rows*cellH+(rows-1)*spacingY,sheet=canvas(width,height);
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const cell=canvas(cellW,cellH);draw(cell,r*cols+c,c,r);
  blit(sheet,cell,margin+c*(cellW+spacing),marginY+r*(cellH+spacingY));
 }
 return {...sheet,spec:{cellWidth:cellW,cellHeight:cellH,marginX:margin,marginY,spacingX:spacing,spacingY,columns:cols,rows,cells:cols*rows}};
}
/** Sprites of different sizes dropped at hand-picked places with generous gaps — the case a grid
 * cannot describe and component detection has to handle. */
export function irregularSheet(seed=3){
 const r=rand(seed),sheet=canvas(200,140),placed=[];
 const shapes=[[30,40],[18,18],[52,24],[24,60],[40,40],[12,30]];
 const spots=[[6,6],[60,10],[100,8],[8,60],[60,50],[160,70]];
 shapes.forEach(([w,h],i)=>{
  const [x,y]=spots[i],s=canvas(w,h),c=[Math.floor(r()*200)+40,Math.floor(r()*200)+40,Math.floor(r()*200)+40,255];
  box(s,1,1,w-2,h-2,c);blit(sheet,s,x,y);placed.push({x:x+1,y:y+1,w:w-2,h:h-2});
 });
 return {...sheet,placed};
}
/** One character whose limbs do not touch the body: five islands that belong to one frame. */
export function disconnectedSprite(){
 const img=canvas(40,48),c=[200,60,60,255];
 disc(img,20,7,5,c);            // head
 box(img,14,16,13,16,c);        // torso
 box(img,6,18,5,12,c);          // left arm, 3px gap
 box(img,30,18,5,12,c);         // right arm, 3px gap
 box(img,14,36,5,10,c);box(img,22,36,5,10,c); // legs, 4px gap
 return img;
}
/** A sprite whose semi-transparent edge was composited over white — the classic halo. */
export function haloedSprite({size=32,halo=[255,255,255],body=[30,90,40]}={}){
 const img=canvas(size,size),cx=size/2-.5,r=size/2-3;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const d=Math.hypot(x-cx,y-cx);
  const cov=d<=r-1?1:d>=r+1?0:(r+1-d)/2;
  if(cov<=0)continue;
  // the edge RGB still holds the matte it was flattened against: body over halo, alpha re-applied
  put(img,x,y,[Math.round(body[0]*cov+halo[0]*(1-cov)),Math.round(body[1]*cov+halo[1]*(1-cov)),Math.round(body[2]*cov+halo[2]*(1-cov)),Math.round(cov*255)]);
 }
 return img;
}
/** A solid, convex-ish blob plus a hole — the contour fixture. */
export function blobWithHole(size=48){
 const img=canvas(size,size),c=[80,160,240,255];
 disc(img,size/2,size/2,size/2-4,c);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(Math.hypot(x-size/2,y-size/2)<6)put(img,x,y,[0,0,0,0]);
 return img;
}
/** A 100-frame animation of differently sized frames, 20 of which repeat earlier pixels exactly. */
export function hundredFrames(seed=11){
 const r=rand(seed),out=[];
 for(let i=0;i<80;i++){
  const w=16+Math.floor(r()*40),h=16+Math.floor(r()*40),img=canvas(w,h);
  box(img,1,1,w-2,h-2,[40+i*2%200,90,200-i%150,255]);
  disc(img,w/2,h/2,Math.min(w,h)/3,[255,240,120,255]);
  out.push(img);
 }
 for(let i=0;i<20;i++)out.push({...out[i*4],data:new Uint8ClampedArray(out[i*4].data)});
 return out;
}
/** The defect fixture: six characters of six different sizes, each drawn as three alpha islands —
 * body, a hat 1–2px above it and a sword 1–2px beside it. Auto slicing must return six frames, not
 * seventeen. The same sheet is in tests/fixtures/game/irregular-characters.png for browser checks. */
export function charactersSheet(){
 const sheet=canvas(320,180),chars=[
  {x:8,y:27,w:32,h:50,gap:1,hat:[4,23,9],sword:[8,4,34]},
  {x:55,y:102,w:34,h:61,gap:2,hat:null,sword:[18,4,37]},
  {x:101,y:21,w:33,h:49,gap:2,hat:[4,25,8],sword:[8,4,35]},
  {x:155,y:117,w:32,h:31,gap:2,hat:[4,24,8],sword:[8,4,17]},
  {x:208,y:23,w:27,h:48,gap:2,hat:[4,19,8],sword:[8,4,34]},
  {x:256,y:117,w:26,h:53,gap:2,hat:[4,18,8],sword:[8,4,39]}];
 chars.forEach((c,i)=>{
  const tint=[60+i*30,110+i*20,220-i*25,255];
  box(sheet,c.x,c.y,c.w,c.h,tint);
  if(c.hat){const [dx,w,h]=c.hat;box(sheet,c.x+dx,c.y-c.gap-h,w,h,[220,70,70,255]);}
  const [dy,w,h]=c.sword;box(sheet,c.x+c.w+c.gap,c.y+dy,w,h,[230,230,240,255]);
 });
 return {...sheet,characters:chars.length};
}
