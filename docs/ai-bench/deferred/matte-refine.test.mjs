import test from 'node:test';
import assert from 'node:assert/strict';
import {boxFilter,resizePlane,guidedAlpha,detectBackdrop,sheetEdges,estimateForeground,refineMatte} from './matte-refine.js';

// A sticker on a white sheet: dark disc (radius R) with a 1-px anti-aliased rim, centred in a W x W image.
function sticker(W=96,R=28,ink=[20,40,200]){
 const rgba=new Uint8ClampedArray(W*W*4),truth=new Float32Array(W*W),c=(W-1)/2;
 for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x,a=Math.max(0,Math.min(1,R+.5-Math.hypot(x-c,y-c)));truth[i]=a;
  for(let k=0;k<3;k++)rgba[i*4+k]=Math.round(ink[k]*a+255*(1-a));rgba[i*4+3]=255;}
 return {rgba,truth,W};
}
// What a segmentation model hands back: the shape, softened and spilling a 3-px halo of 0.3 onto the sheet.
function modelGuess(truth,W,{halo=3,hole=null}={}){
 const p=new Float32Array(W*W),c=(W-1)/2,R=Math.sqrt(truth.reduce((s,v)=>s+v,0)/Math.PI);
 for(let y=0;y<W;y++)for(let x=0;x<W;x++){const r=Math.hypot(x-c,y-c);p[y*W+x]=r<=R?1:r<=R+halo?.3:0;
  if(hole&&Math.hypot(x-hole[0],y-hole[1])<hole[2])p[y*W+x]=0;}
 return p;
}
test('boxFilter is a clipped mean and resizePlane keeps an equal-size plane',()=>{
 const a=Float32Array.from([1,2,3,4,5,6,7,8,9]),m=boxFilter(a,3,3,1);
 assert.equal(m[4],5);assert.equal(m[0],(1+2+4+5)/4);
 assert.deepEqual([...resizePlane(a,3,3,3,3)],[...a]);
});
test('a flat white sheet is detected; a photo-like border is not',()=>{
 const {rgba,W}=sticker(),alpha=new Float32Array(W*W);
 assert.deepEqual(detectBackdrop(rgba,W,W,alpha).color,[255,255,255]);
 const noisy=Uint8ClampedArray.from(rgba,(v,i)=>i%4===3?255:(v+((i*7919)%97))%256);
 assert.equal(detectBackdrop(noisy,W,W,alpha),null);
});
test('known-backdrop edges remove the white halo and keep the anti-aliased rim',()=>{
 const {rgba,truth,W}=sticker(),alpha=modelGuess(truth,W),before=alpha.reduce((s,v,i)=>s+(truth[i]===0?v:0),0);
 sheetEdges(rgba,W,W,alpha,[255,255,255]);
 const after=alpha.reduce((s,v,i)=>s+(truth[i]===0?v:0),0);
 assert.ok(before>20,'the model guess has a halo');assert.equal(after,0,'no alpha left on the white sheet');
 let err=0,n=0;for(let i=0;i<W*W;i++)if(truth[i]>0&&truth[i]<1){err+=Math.abs(alpha[i]-truth[i]);n++;}
 assert.ok(n>0&&err/n<.05,`rim alpha follows the drawing (mean error ${(err/n).toFixed(3)})`);
});
test('holes the model punched into a coloured subject are filled; backdrop-coloured holes stay',()=>{
 const {rgba,truth,W}=sticker(),c=(W-1)/2;
 const a1=modelGuess(truth,W,{hole:[c,c,6]});sheetEdges(rgba,W,W,a1,[255,255,255]);
 assert.equal(a1[Math.round(c)*W+Math.round(c)],1,'blue hole filled');
 // paint a white window into the disc: the model is right to cut it out, and it must stay cut
 const win=Uint8ClampedArray.from(rgba);for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++){const i=(Math.round(c)+y)*W+Math.round(c)+x;win[i*4]=win[i*4+1]=win[i*4+2]=255;}
 const a2=modelGuess(truth,W,{hole:[c,c,6]});sheetEdges(win,W,W,a2,[255,255,255]);
 assert.equal(a2[Math.round(c)*W+Math.round(c)],0,'white window kept transparent');
});
test('edge colours are un-mixed from a flat backdrop',()=>{
 const rgba=Uint8ClampedArray.from([128,128,255,255]),alpha=Float32Array.from([.5]),out=new Uint8ClampedArray(rgba);
 estimateForeground(rgba,1,1,alpha,out,{backdrop:[255,255,255]});
 assert.deepEqual([...out.slice(0,3)],[1,1,255]);
});
test('guided alpha upsamples a coarse mask to the picture edges',()=>{
 const {rgba,truth,W}=sticker(128,40),S=32,small=new Float32Array(S*S);
 for(let y=0;y<S;y++)for(let x=0;x<S;x++)small[y*S+x]=truth[(y*4+2)*128+x*4+2]>.5?1:0;
 const g=guidedAlpha(rgba,128,128,small,S,S,{radius:3,eps:1e-3}),b=resizePlane(small,S,S,128,128);
 const err=a=>a.reduce((s,v,i)=>s+Math.abs(v-truth[i]),0)/a.length;
 assert.ok(err(g)<err(b),`guided ${err(g).toFixed(4)} < bilinear ${err(b).toFixed(4)}`);
});
test('refineMatte reports what it did and never changes opaque colours',()=>{
 const {rgba,truth,W}=sticker(),r=refineMatte(rgba,W,W,modelGuess(truth,W),W,W,{guided:false});
 assert.equal(r.report.backdrop.color.join(),'255,255,255');assert.equal(r.report.cleanup,'known backdrop');
 const mid=((W>>1)*W+(W>>1))*4;assert.deepEqual([...r.rgba.slice(mid,mid+4)],[...rgba.slice(mid,mid+3),255]);
 assert.equal(r.rgba[3],0,'corner is transparent');
});
