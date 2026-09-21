import test from 'node:test';import assert from 'node:assert/strict';
import {dilateEdges,mipChain,potPlan,seamMetrics,blurPlane,heightFromLuminance,heightFromEdges,occlusionApprox,emissionMask,maskExtract,POT_SIZES,BLEED_STEPS} from '../src/game/texture-fix.js';
/** An 8x8 sprite: a red square in the middle, fully transparent black around it. */
function sprite(w=8,h=8,inset=2){
 const data=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const inside=x>=inset&&y>=inset&&x<w-inset&&y<h-inset;
  data.set(inside?[200,40,30,255]:[0,0,0,0],(y*w+x)*4);
 }
 return {data,w,h};
}
test('edge dilation writes RGB only where alpha is zero, and never touches alpha',()=>{
 const {data,w,h}=sprite(12,12,4);
 const {data:out,filled}=dilateEdges(data,w,h,{pixels:2});
 for(let p=0;p<w*h;p++){
  assert.equal(out[p*4+3],data[p*4+3],`alpha at ${p} is untouched`);
  if(data[p*4+3])assert.deepEqual([...out.subarray(p*4,p*4+3)],[...data.subarray(p*4,p*4+3)],`opaque texel ${p} is untouched`);
 }
 assert.equal(filled,48,'two rings around a 4x4 block: 20 + 28 texels');
 const px=(d,x,y)=>[...d.subarray((y*w+x)*4,(y*w+x)*4+4)];
 assert.deepEqual(px(out,3,3),[200,40,30,0],'the ring next to the block took its colour, with alpha still 0');
 assert.deepEqual(px(out,2,2),[200,40,30,0],'the second ring took the colour of the first');
 assert.deepEqual(px(out,1,1),[0,0,0,0],'nothing beyond the requested width is touched');
 const one=dilateEdges(data,w,h,{pixels:1}).data;
 assert.deepEqual(px(one,2,2),[0,0,0,0],'one round only reaches the first ring');
 assert.equal(one.filter((_,i)=>i%4===3).every((v,p)=>v===data[p*4+3]),true);
 assert.equal(dilateEdges(data,w,h,{pixels:16}).filled,w*h-16,'the whole transparent area fills eventually');
 assert.deepEqual(BLEED_STEPS,[2,4,8,16]);
 assert.throws(()=>dilateEdges(data,w,h,{pixels:0}),/1–64/);
 const opaque=new Uint8Array(16).fill(255);
 assert.equal(dilateEdges(opaque,2,2,{pixels:4}).filled,0,'nothing to do on an opaque texture');
});
test('dilation is what stops a mipmap from darkening the sprite edge',()=>{
 // Inset 3 puts the sprite across a 2x2 block boundary, which is where a half-covered mip texel appears.
 const {data,w,h}=sprite(8,8,3);
 const raw=mipChain(data,w,h,{levels:1})[1],fixed=mipChain(dilateEdges(data,w,h,{pixels:4}).data,w,h,{levels:1})[1];
 const edge=(1*(w/2)+1)*4;
 assert.equal(raw.data[edge+3],fixed.data[edge+3],'alpha shrinks the same way either way');
 assert.equal(raw.data[edge+3],64,'that texel is a quarter covered');
 assert.equal(raw.data[edge],50,'without bleed its RGB is three quarters black');
 assert.equal(fixed.data[edge],200,'with bleed it keeps the sprite colour');
});
test('the mipmap chain halves down to 1x1 with a box filter',()=>{
 const {data,w,h}=sprite(8,8);
 const chain=mipChain(data,w,h,{levels:4});
 assert.deepEqual(chain.map(m=>`${m.width}x${m.height}`),['8x8','4x4','2x2','1x1']);
 assert.equal(chain[0].data,data,'level 0 is the source itself');
 const last=chain.at(-1).data;
 assert.equal(last[3],Math.round(255*16/64),'1x1 alpha is the mean coverage of the sprite');
 const odd=mipChain(new Uint8Array(3*3*4).fill(128),3,3,{levels:2});
 assert.deepEqual(odd.map(m=>`${m.width}x${m.height}`),['3x3','1x1','1x1'].slice(0,odd.length));
 assert.throws(()=>mipChain(data,w,h,{levels:0}),/1–12/);
});
test('power-of-two planning per mode',()=>{
 assert.deepEqual(potPlan(500,300,{mode:'nearest'}),{width:512,height:256,changed:true,mode:'nearest'});
 assert.deepEqual(potPlan(500,300,{mode:'down'}).width,256);
 assert.deepEqual(potPlan(500,300,{mode:'up'}).width,512);
 assert.deepEqual(potPlan(3000,1000,{mode:'fit',max:1024}),{width:1024,height:256,changed:true,mode:'fit'});
 assert.deepEqual(potPlan(1024,1024,{mode:'nearest'}).changed,false);
 assert.deepEqual(potPlan(700,300,{mode:'nearest',square:true}),{width:512,height:512,changed:true,mode:'nearest'});
 assert.equal(potPlan(9000,9000,{mode:'up',max:4096}).width,4096,'the cap wins');
 assert.equal(potPlan(3,3,{mode:'down',min:16}).width,16,'the floor wins');
 assert.throws(()=>potPlan(10,10,{mode:'sideways'}),/Unknown power-of-two mode/);
 assert.throws(()=>potPlan(10,10,{max:5000}),/POT_SIZES/);
 assert(POT_SIZES.includes(4096));
});
test('seam measurement compares the texels that become neighbours when tiled',()=>{
 const w=8,h=8,seamless=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)seamless.set([Math.round(128+100*Math.sin(x/w*Math.PI*2)),80,60,255],(y*w+x)*4);
 const good=seamMetrics(seamless,w,h);
 assert(good.vertical.ratio<1.5&&good.horizontal.ratio<1.5,`a wrapping pattern has no seam: ${good.vertical.ratio}`);
 assert(good.vertical.mean>20,'its absolute edge difference is large — only the ratio tells the truth');
 const ramp=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)ramp.set([x*30,y*30,0,255],(y*w+x)*4);
 const bad=seamMetrics(ramp,w,h);
 assert.equal(Math.round(bad.vertical.mean),70,'a left-to-right ramp jumps by 7 steps of 30 over three channels');
 assert(bad.vertical.ratio>5&&bad.horizontal.ratio>5,'the jump is far larger than the variation one texel inside');
 assert.equal(bad.vertical.profile.length,h);assert.equal(bad.horizontal.profile.length,w);
 assert.equal(bad.seamless,false);assert.equal(good.seamless,true);
});
test('approximations are honest functions: luminance height, edge relief, occlusion, masks',()=>{
 const w=4,h=4,data=new Uint8Array(w*h*4);
 for(let p=0;p<w*h;p++)data.set([p*16,p*16,p*16,255],p*4);
 const height=heightFromLuminance(data,w,h);
 assert.deepEqual([...height].slice(0,3),[0,16,32]);
 assert.deepEqual([...heightFromLuminance(data,w,h,{invert:true})].slice(0,3),[255,239,223]);
 assert.equal(heightFromLuminance(data,w,h,{smooth:1}).length,w*h);
 const edges=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)edges.set(x<2?[0,0,0,255]:[255,255,255,255],(y*w+x)*4);
 const relief=heightFromEdges(edges,w,h,{smooth:0});
 assert(relief[1]>relief[0]&&relief[1]>200,'the step shows up as relief at the boundary');
 assert.equal(blurPlane(new Uint8Array([0,0,0,255]),2,2,1).length,4);
 const bump=new Uint8Array(w*h);for(let p=0;p<w*h;p++)bump[p]=p===5?255:0;
 const ao=occlusionApprox(bump,w,h,{radius:2,strength:1});
 assert.equal(ao[5],255,'the highest texel is not occluded');
 assert(ao[4]<255&&ao[6]<255,'its neighbours are darkened');
 assert.throws(()=>occlusionApprox(bump,w,h,{radius:99}),/1–32/);
 const bright=new Uint8Array([250,250,250,255,10,10,10,255]);
 assert.deepEqual([...emissionMask(bright,2,1,{mode:'threshold',threshold:200,soft:0})],[255,0]);
 assert.deepEqual([...emissionMask(bright,2,1,{mode:'luminance'})],[250,10]);
 assert.deepEqual([...emissionMask(bright,2,1,{mode:'color',color:[250,250,250],tolerance:5,soft:0})],[255,0]);
 assert.deepEqual([...maskExtract(new Uint8Array([9,9,9,40,9,9,9,255]),2,1,{source:'alpha'})],[40,255]);
 assert.deepEqual([...maskExtract(new Uint8Array([9,9,9,40]),1,1,{source:'alpha',invert:true})],[215]);
 assert.throws(()=>maskExtract(bright,2,1,{source:'vibes'}),/Unknown mask source/);
 assert.throws(()=>emissionMask(bright,2,1,{mode:'threshold',threshold:900}),/0–255/);
});
