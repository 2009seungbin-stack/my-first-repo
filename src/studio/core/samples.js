/** Built-in sample images for the empty state. They are drawn by code (no files, no requests), so
 * a first-time visitor can see the Studio working before picking a file of their own. Pure
 * functions returning RGBA buffers; app.js encodes one as a PNG and imports it like a dropped file.
 *   sampleImage(id) → {width, height, data: Uint8ClampedArray}   (deterministic) */
export const SAMPLES=[
 {id:'walk',file:'sample-walk-cycle.png',cell:32,cols:4,rows:2},
 {id:'tiles',file:'sample-tileset.png',cell:16,cols:4,rows:4},
 {id:'gem',file:'sample-gem.png',cell:32,cols:1,rows:1}
];
export const sampleById=id=>SAMPLES.find(s=>s.id===id)||null;
const hex=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16),255];
/** Small integer hash → 0..1 (speckle patterns must be identical on every run). */
export function hash01(x,y,seed=0){let n=(x*374761393+y*668265263+seed*2246822519)>>>0;n=((n^(n>>>13))*1274126177)>>>0;return ((n^(n>>>16))>>>0)/4294967296;}
function surface(width,height){
 const data=new Uint8ClampedArray(width*height*4);
 const set=(x,y,c)=>{if(x<0||y<0||x>=width||y>=height)return;const i=(y*width+x)*4;data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];data[i+3]=c[3]??255;};
 const alpha=(x,y)=>x<0||y<0||x>=width||y>=height?0:data[(y*width+x)*4+3];
 const rect=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)set(x+i,y+j,c);};
 return {width,height,data,set,alpha,rect};
}
/** One-pixel dark outline around everything opaque inside the cell at (ox,oy). */
function outline(s,ox,oy,size,c){
 const add=[];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  if(s.alpha(ox+x,oy+y)===255)continue;
  const near=(dx,dy)=>{const nx=x+dx,ny=y+dy;return nx>=0&&ny>=0&&nx<size&&ny<size&&s.alpha(ox+nx,oy+ny)===255;};
  if(near(1,0)||near(-1,0)||near(0,1)||near(0,-1))add.push([ox+x,oy+y]);
 }
 for(const [x,y]of add)s.set(x,y,c);
}
// ------------------------------------------------------------------ walk cycle: 8 frames of 32×32
const WALK={skin:hex('#f2c9a0'),hair:hex('#5b3a29'),shirt:hex('#3fa7d6'),shirtDark:hex('#2b7fa8'),pants:hex('#4a4e69'),boot:hex('#2f3040'),eye:hex('#22223b'),line:hex('#1b1c26')};
function walkFrame(s,ox,oy,f){
 const p=f/8*Math.PI*2,bob=f%4===1||f%4===2?-1:0,stride=Math.round(Math.sin(p)*3),liftA=Math.max(0,Math.round(Math.cos(p)*2)),liftB=Math.max(0,Math.round(-Math.cos(p)*2)),swing=Math.round(Math.sin(p)*2);
 // soft ground shadow (drawn first, so the outline pass ignores it: it is not fully opaque)
 for(let x=9;x<=22;x++)for(let y=29;y<=30;y++)if(!((x===9||x===22)&&y===30))s.set(ox+x,oy+y,[0,0,0,70]);
 // legs: the far leg is darker; each lifts while it swings forward
 s.rect(ox+16-stride,oy+22,4,6-liftB,WALK.boot);s.rect(ox+16-stride,oy+22,4,3,[58,61,84,255]);
 s.rect(ox+12+stride,oy+22,4,6-liftA,WALK.boot);s.rect(ox+12+stride,oy+22,4,3,WALK.pants);
 // far arm, body, near arm
 s.rect(ox+20,oy+14+bob+swing,3,6,WALK.shirtDark);
 s.rect(ox+11,oy+13+bob,10,9,WALK.shirt);s.rect(ox+11,oy+20+bob,10,2,WALK.shirtDark);
 s.rect(ox+9,oy+14+bob-swing,3,6,WALK.shirt);s.rect(ox+9,oy+19+bob-swing,3,2,WALK.skin);
 // head, hair, eye
 s.rect(ox+11,oy+4+bob,10,9,WALK.skin);s.rect(ox+11,oy+4+bob,10,3,WALK.hair);s.rect(ox+11,oy+7+bob,2,3,WALK.hair);
 s.rect(ox+17,oy+8+bob,2,2,WALK.eye);
 outline(s,ox,oy,32,WALK.line);
}
// ------------------------------------------------------------------ tileset: 16 tiles of 16×16
const T=(base,dark,light,pattern)=>({base:hex(base),dark:hex(dark),light:hex(light),pattern});
const TILES=[
 T('#5aa64b','#478a3c','#7cc266','noise'),T('#5aa64b','#478a3c','#f6e27a','flowers'),T('#9b6b43','#7f5533','#b5835a','noise'),T('#e3cf8e','#cdb774','#f1e3b0','noise'),
 T('#3f88c5','#2f6ea6','#8fc7ee','wave'),T('#285f9c','#1e4c80','#5d9bd3','wave'),T('#d9541e','#a8320f','#ffb347','wave'),T('#bfe6f2','#9fd0e0','#ffffff','noise'),
 T('#b5523b','#d8c9b8','#cf6e55','brick'),T('#8a8f98','#5f646d','#a7acb5','brick'),T('#a87444','#7c5330','#c08e5a','plank'),T('#b98a4e','#7a5a30','#d8ab6c','crate'),
 T('#8d9199','#676b73','#b0b4bc','cobble'),T('#eef3f7','#d5dee6','#ffffff','noise'),T('#9b6b43','#7f5533','#5aa64b','path'),T('#5aa64b','#2f6b2c','#4c9a40','bush')
];
function tile(s,ox,oy,k){
 const d=TILES[k],N=16;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const r=hash01(x,y,k+1);let c=r<.14?d.dark:r>.9&&d.pattern==='noise'?d.light:d.base;
  if(d.pattern==='flowers'){if(r>.955)c=d.light;else if(r>.93)c=[255,255,255,255];}
  else if(d.pattern==='wave'){const w=(y+Math.round(Math.sin((x+k*3)/N*Math.PI*2)*1.5)+N)%5;c=w===0?d.light:r<.1?d.dark:d.base;}
  else if(d.pattern==='brick'){const row=y>>2,shift=row%2?4:0;c=y%4===3||(x+shift)%8===7?d.dark:r>.86?d.light:d.base;}
  else if(d.pattern==='plank'){c=y%4===3||(y>>2)%2===0&&x===5||(y>>2)%2===1&&x===11?d.dark:r>.88?d.light:d.base;}
  else if(d.pattern==='crate'){const edge=x===0||y===0||x===N-1||y===N-1,inner=x===2||y===2||x===N-3||y===N-3;c=edge?d.dark:inner||x===y||x===N-1-y?(x>1&&y>1&&x<N-2&&y<N-2?d.dark:d.base):r>.85?d.light:d.base;}
  else if(d.pattern==='cobble'){const cx=(x+(y>>3)%2*4)%8,cy=y%8,rim=cx===0||cy===0||(cx===1||cx===7)&&(cy===1||cy===7);c=rim?d.dark:cx<4&&cy<3?d.light:d.base;}
  else if(d.pattern==='path'){c=y<3+(hash01(x,0,k)>.5?1:0)?(r<.2?hex('#478a3c'):d.light):r<.14?d.dark:d.base;}
  else if(d.pattern==='bush'){const dx=x-7.5,dy=y-8,in2=dx*dx+dy*dy;c=in2<34?(dx+dy<-3?d.light:r<.25?hex('#245524'):d.dark):r<.14?hex('#478a3c'):d.base;}
  s.set(ox+x,oy+y,c);
 }
}
// ------------------------------------------------------------------ gem: one 32×32 pixel-art image
const GEM={top:hex('#b8f3ff'),left:hex('#5fd4f4'),mid:hex('#2aa7d8'),right:hex('#1b6fa8'),deep:hex('#124d7a'),line:hex('#0c2740'),white:hex('#ffffff')};
function gem(s){
 for(let y=6;y<=27;y++){
  const half=y<=11?6+(y-6):Math.round(11*(27-y)/16);
  for(let x=16-half;x<16+half;x++){
   const u=(x-16+.5)/Math.max(1,half);let c;
   if(y<=11)c=u<-.45?GEM.left:u>.45?GEM.mid:GEM.top;
   else c=u<-.4?GEM.left:u<.15?GEM.mid:u<.6?GEM.right:GEM.deep;
   s.set(x,y,c);
  }
 }
 for(let x=5;x<27;x++)if(s.alpha(x,12)===255)s.set(x,12,x<16?GEM.top:GEM.left);// girdle highlight
 s.set(12,8,GEM.white);s.set(13,8,GEM.white);s.set(12,9,GEM.white);s.set(9,15,GEM.white);
 outline(s,0,0,32,GEM.line);
 // sparkle
 for(const [x,y]of [[25,4],[24,5],[25,5],[26,5],[25,6],[5,22],[4,23],[5,23],[6,23],[5,24]])s.set(x,y,GEM.white);
}
export function sampleImage(id){
 const def=sampleById(id);if(!def)throw Error('Unknown sample: '+id);
 const s=surface(def.cell*def.cols,def.cell*def.rows);
 if(id==='walk')for(let f=0;f<8;f++)walkFrame(s,(f%4)*32,(f>>2)*32,f);
 else if(id==='tiles')for(let k=0;k<16;k++)tile(s,(k%4)*16,(k>>2)*16,k);
 else gem(s);
 return {width:s.width,height:s.height,data:s.data};
}
