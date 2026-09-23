import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {shapeFromCommands,shapeBounds,normalizeShape,orientContours,contourWinding,windingAt,insideAt,cloneShape,transformShape,reverseContour,edgeCount,shapeDescription,WHITE} from '../src/game/ui/font/shape.js';
import {rasterize} from '../src/game/ui/font/raster.js';
import * as M from '../src/game/ui/font/msdf.js';
import {edgePoint,scanline} from '../src/game/ui/font/msdf-geometry.js';

// msdfgen v1.13 output for 16 shapes (tools/ui-msdf-reference.py). Fields: px, rows top-first.
const REF=JSON.parse(readFileSync(new URL('./fixtures/ui/msdf/reference.json',import.meta.url),'utf8'));
const unpack=b64=>{const b=inflateSync(Buffer.from(b64,'base64'));const q=new Int16Array(b.buffer,b.byteOffset,b.length/2);return Float64Array.from(q,v=>v/2048);};
const bits=(b64,n)=>{const b=inflateSync(Buffer.from(b64,'base64'));return Uint8Array.from({length:n},(_,i)=>b[i>>3]>>(i&7)&1);};
const shapeOf=c=>shapeFromCommands(c.commands,{scale:c.scale,dx:c.dx,dy:c.dy});
const COLOR={3:'y',5:'m',6:'c',7:'w'};
/** max |a-b| over texels where the reference is inside ±15.9 px (the fixture clamps at ±16). */
function maxDiff(mine,ref){
 let m=0;for(let i=0;i<ref.length;i++)if(Math.abs(ref[i])<15.9)m=Math.max(m,Math.abs(mine[i]-ref[i]));
 return m;
}
const TOL=.002;// fixture quantisation is 1/2048 px; the implementation matches msdfgen to float32 rounding

test('SDF, PSDF, MSDF and MTSDF equal msdfgen 1.13 on every reference shape',t=>{
 assert.match(REF.msdfgen.version,/v1\.13/);
 assert.equal(REF.cases.length,16);
 const worst={sdf:0,psdf:0,mtsdf:0,msdf:0,msdfNoScanline:0};
 for(const c of REF.cases){
  const s=shapeOf(c),{w,h,range}=c,r=c.reference;
  const sdf=M.generateSDF(s,w,h,{range}),psdf=M.generatePSDF(s,w,h,{range});
  const mt=M.generateMTSDF(s,w,h,{range}),ms=M.generateMSDF(s,w,h,{range});
  const ns=M.generateMSDF(s,w,h,{range,scanlineSignFix:false});
  const rMt=unpack(r.mtsdf),rMs=new Float64Array(w*h*3);
  for(let i=0;i<w*h;i++)for(let k=0;k<3;k++)rMs[i*3+k]=rMt[i*4+k];
  const d={sdf:maxDiff(sdf,unpack(r.sdf)),psdf:maxDiff(psdf,unpack(r.psdf)),mtsdf:maxDiff(mt,rMt),msdf:maxDiff(ms,rMs),msdfNoScanline:maxDiff(ns,unpack(r.msdfNoScanline))};
  for(const k in d){assert.ok(d[k]<=TOL,`${c.name} ${k}: max |Δ| ${d[k]} px`);worst[k]=Math.max(worst[k],d[k]);}
 }
 t.diagnostic(`worst max |mine − msdfgen| px: ${Object.entries(worst).map(([k,v])=>`${k} ${v.toExponential(1)}`).join(', ')}`);
});

test('edge colouring equals msdfgen edgeColoringSimple (incl. teardrops and 1-/2-edge splitting)',()=>{
 for(const c of REF.cases){
  const p=M.prepareShape(shapeOf(c),{});
  assert.deepEqual(p.contours.map(k=>k.edges.map(e=>COLOR[e.color]).join('')),c.reference.colors,c.name);
 }
 // the 1-edge teardrop is split into thirds by normalisation, the 2-edge one by the colouring
 const tear=REF.cases.find(c=>c.name==='teardrop-2edge'),s=shapeOf(tear);
 assert.equal(edgeCount(s),2);
 const colored=M.edgeColoringSimple(cloneShape(s));
 assert.equal(edgeCount(colored),6);
 assert.deepEqual(colored.contours[0].edges.map(e=>COLOR[e.color]).join(''),tear.reference.colors[0]);
 // ink-trap colouring still gives every corner two channels changing
 const a=M.edgeColoringInkTrap(M.prepareShape(shapeOf(REF.cases.find(c=>c.name==='sharp-a')),{coloring:false}));
 for(const k of a.contours)for(const e of k.edges)assert.ok([3,5,6,7].includes(e.color));
});

test('decoded MSDF matches msdfgen -testrender at 4x and the exact raster at 1x, 4x and 8x',t=>{
 const rows=[];
 for(const c of REF.cases){
  const s=shapeOf(c),{w,h,range}=c;
  const enc=M.encodeField(M.generateMSDF(s,w,h,{range}),w,h,3,{range});
  const rec4=M.reconstructCoverage(enc,w,h,3,{scale:4,range,ramp:'linear'});
  const tr=bits(c.reference.testrender4,16*w*h);
  let agree=0;for(let i=0;i<tr.length;i++)if((rec4[i]>=.5)===(tr[i]===1))agree++;
  const vsMsdfgen=agree/tr.length;
  assert.ok(vsMsdfgen>=.995,`${c.name}: ${vsMsdfgen} of 4x test-render pixels agree`);
  // against the exact raster (coverage ≥ .5) at 1x (field median sign), 4x and 8x
  const exact=k=>rasterize(transformShape(cloneShape(s),{scale:k}),w*k,h*k);
  const f=M.generateMSDF(s,w,h,{range}),e1=exact(1);
  let a1=0;for(let i=0;i<w*h;i++)if((M.median(f[i*3],f[i*3+1],f[i*3+2])>=0)===(e1[i]>=.5))a1++;
  const rate=k=>{const r=M.reconstructCoverage(enc,w,h,3,{scale:k,range}),e=exact(k);let n=0;for(let i=0;i<e.length;i++)if((r[i]>=.5)===(e[i]>=.5))n++;return n/e.length;};
  const r4=rate(4),r8=rate(8);
  rows.push(`${c.name} ${(vsMsdfgen*100).toFixed(2)}/${(a1/(w*h)*100).toFixed(1)}/${(r4*100).toFixed(2)}/${(r8*100).toFixed(2)}`);
  assert.ok(a1/(w*h)>=.97&&r4>=.985&&r8>=.985,`${c.name}: 1x ${a1/(w*h)}, 4x ${r4}, 8x ${r8}`);
 }
 t.diagnostic(`% agreement vs msdfgen testrender@4x / exact@1x / exact@4x / exact@8x: ${rows.join('; ')}`);
});

test('SDF error of the MSDF: 8x reconstruction vs exact coverage, and median vs true distance',t=>{
 const out=[];
 for(const name of ['sharp-a','kenney-future-A','kenney-future-at','noto-jp-ei','noto-jp-a','overlap']){
  const c=REF.cases.find(k=>k.name===name),s=shapeOf(c),{w,h,range}=c;
  const f=M.generateMSDF(s,w,h,{range}),sdf=M.generateSDF(s,w,h,{range});
  const rec=M.reconstructCoverage(M.encodeField(f,w,h,3,{range}),w,h,3,{scale:8,range});
  const exact=rasterize(transformShape(cloneShape(s),{scale:8}),8*w,8*h);
  let bad=0;for(let i=0;i<exact.length;i++)if(Math.abs(rec[i]-exact[i])>.5)bad++;
  let sum=0,n=0;
  for(let i=0;i<w*h;i++)if(Math.abs(sdf[i])<range/2){sum+=Math.abs(M.median(f[i*3],f[i*3+1],f[i*3+2])-sdf[i]);n++;}
  out.push(`${name}: ${(bad/exact.length*100).toFixed(3)}% px off by >.5, mean |median−true| ${(sum/n).toFixed(4)} px`);
  assert.ok(bad/exact.length<.01,`${name}: ${bad} of ${exact.length}`);
  assert.ok(sum/n<.1,`${name}: mean pseudo-distance deviation ${sum/n}`);
 }
 t.diagnostic(out.join('; '));
});

// ---------------------------------------------------------------- rasteriser
let seed=20260924;const rnd=()=>(seed=(seed*1103515245+12345)>>>0)/2**32;
function randomShape(){// 1–3 closed contours of lines, quadratics and cubics, some overlapping
 const cmds=[];
 for(let k=0,K=1+Math.floor(rnd()*3);k<K;k++){
  const cx=4+rnd()*16,cy=4+rnd()*16,n=3+Math.floor(rnd()*5),pts=[];
  for(let i=0;i<n;i++){const a=2*Math.PI*i/n+rnd()*.5,r=2+rnd()*7;pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
  cmds.push({type:'M',x:pts[0][0],y:pts[0][1]});
  for(let i=1;i<=n;i++){
   const [x,y]=pts[i%n],u=rnd();
   if(u<.4)cmds.push({type:'L',x,y});
   else if(u<.7)cmds.push({type:'Q',x1:x+rnd()*6-3,y1:y+rnd()*6-3,x,y});
   else cmds.push({type:'C',x1:x+rnd()*8-4,y1:y+rnd()*8-4,x2:x+rnd()*8-4,y2:y+rnd()*8-4,x,y});
  }
  cmds.push({type:'Z'});
 }
 return shapeFromCommands(cmds,{dy:24});
}
/** Reference coverage straight from the curves: `sub` scanlines per pixel row, each resolved
 * EXACTLY in x with the msdfgen crossing rules (so only y is sampled). */
function scanCoverage(shape,w,h,sub,rule='nonzero'){
 const out=new Float64Array(w*h);
 for(let y=0;y<h;y++)for(let s=0;s<sub;s++){
  const line=scanline(shape.contours,y+(s+.5)/sub),X=line.xs,W=line.winding;
  for(let i=0;i+1<X.length;i++){
   const wn=W[i],on=rule==='nonzero'?wn!==0:(wn&1)!==0;
   if(!on)continue;
   const a=Math.max(0,X[i]),b=Math.min(w,X[i+1]);
   for(let x=Math.floor(a);x<b&&x<w;x++)out[y*w+x]+=(Math.min(b,x+1)-Math.max(a,x))/sub;
  }
 }
 return out;
}
function supersample(shape,w,h,n){// brute-force n×n point samples per pixel, nonzero
 const out=new Float64Array(w*h);
 for(let y=0;y<h;y++)for(let j=0;j<n;j++){
  const line=scanline(shape.contours,y+(j+.5)/n);
  for(let x=0;x<w;x++)for(let i=0;i<n;i++){
   const px=x+(i+.5)/n;let lo=0,hi=line.xs.length;while(lo<hi){const m=lo+hi>>1;if(line.xs[m]<=px)lo=m+1;else hi=m;}
   if(lo&&line.winding[lo-1]!==0)out[y*w+x]+=1/(n*n);
  }
 }
 return out;
}

test('coverage is the exact nonzero area: agrees with curve-exact references on random overlapping shapes',t=>{
 let worst=0,worstSS=0,meanSS=0,count=0;
 for(let k=0;k<25;k++){
  const s=randomShape(),w=24,h=24;
  const mine=rasterize(s,w,h,{tolerance:.001}),ref=scanCoverage(s,w,h,512),ss=supersample(s,w,h,16);
  for(let i=0;i<w*h;i++){
   worst=Math.max(worst,Math.abs(mine[i]-ref[i]));
   const d=Math.abs(mine[i]-ss[i]);worstSS=Math.max(worstSS,d);meanSS+=d;count++;
  }
 }
 meanSS/=count;
 t.diagnostic(`max |Δ| vs 512-line exact-x reference ${worst.toFixed(5)}; vs 16x16 supersampling: mean ${meanSS.toFixed(5)}, max ${worstSS.toFixed(4)}`);
 assert.ok(worst<=1/256,`max ${worst}`);
 assert.ok(meanSS<=1/256,`mean vs 16x16 ${meanSS}`);
 assert.ok(worstSS<=1/16+1/256,`16x16 sampling cannot be off by more than a sample column: ${worstSS}`);
});

test('overlapping same-direction contours are not double counted; even-odd is available',()=>{
 const sq=(x0,y0,x1,y1)=>[{type:'M',x:x0,y:y0},{type:'L',x:x0,y:y1},{type:'L',x:x1,y:y1},{type:'L',x:x1,y:y0},{type:'Z'}];
 // two clockwise squares overlapping by a 3.5-px-wide band, edges on half pixels
 const s=shapeFromCommands([...sq(1.5,1.5,8.5,8.5),...sq(5,1.5,12.5,8.5)],{dy:10});
 const c=rasterize(s,14,10);
 const total=c.reduce((a,b)=>a+b,0);
 assert.ok(Math.abs(total-11*7)<1e-9,`union area ${total}`);
 assert.ok(Math.abs(c[5*14+6]-1)<1e-12,'overlap interior is 1, not 2');
 assert.ok(Math.abs(c[5*14+1]-.5)<1e-12&&Math.abs(c[5*14+12]-.5)<1e-12,'half-covered edge pixels');
 const eo=rasterize(s,14,10,{rule:'evenodd'});
 assert.ok(Math.abs(eo[5*14+6])<1e-12,'even-odd leaves the overlap empty');
 assert.throws(()=>rasterize(s,14,10,{rule:'bogus'}),/Fill rule/);
 assert.throws(()=>rasterize(s,0,10),/positive/);
});

test('insideAt agrees with ray casting on random points and is robust level with vertices',()=>{
 for(let k=0;k<20;k++){
  const s=randomShape(),segs=[];
  for(const c of s.contours)for(const e of c.edges){let a=edgePoint(e,0);for(let i=1;i<=400;i++){const b=edgePoint(e,i/400);segs.push([a[0],a[1],b[0],b[1]]);a=b;}}
  for(let n=0;n<300;n++){
   const x=rnd()*24,y=rnd()*24;
   let wn=0,near=Infinity;
   for(const [x0,y0,x1,y1] of segs){
    const dx=x1-x0,dy=y1-y0,t=Math.max(0,Math.min(1,((x-x0)*dx+(y-y0)*dy)/(dx*dx+dy*dy||1)));
    near=Math.min(near,Math.hypot(x0+t*dx-x,y0+t*dy-y));
    if((y0<=y)!==(y1<=y)&&x0+(y-y0)/dy*dx>x)wn+=y1>y0?1:-1;// ray to +x
   }
   if(near<1e-3)continue;// too close to call with a polyline
   assert.equal(insideAt(s,x,y),wn!==0,`shape ${k} point ${x},${y}`);
  }
 }
 // level with vertices: a diamond and a W shape, probed exactly at vertex heights
 const diamond=shapeFromCommands([{type:'M',x:5,y:0},{type:'L',x:0,y:5},{type:'L',x:5,y:10},{type:'L',x:10,y:5},{type:'Z'}],{flipY:false});
 assert.equal(insideAt(diamond,5,5),true);assert.equal(insideAt(diamond,-1,5),false);assert.equal(insideAt(diamond,11,5),false);
 assert.equal(insideAt(diamond,4,0),false);assert.equal(insideAt(diamond,6,0),false);
 assert.equal(insideAt(diamond,5,0),insideAt(diamond,5,0),'a point on the boundary gets one deterministic answer');
 // a notch whose inner vertex (5,4) lies on the probe line: both crossings there cancel exactly
 const wsh=shapeFromCommands([{type:'M',x:0,y:0},{type:'L',x:0,y:10},{type:'L',x:5,y:4},{type:'L',x:10,y:10},{type:'L',x:10,y:0},{type:'Z'}],{flipY:false});
 for(const [x,want] of [[-1,false],[1,true],[4.9,true],[5.1,true],[9,true],[11,false]])assert.equal(insideAt(wsh,x,4),want,`notch at ${x},4`);
 for(const [x,want] of [[-1,false],[1,true],[5,false],[9,true],[11,false]])assert.equal(insideAt(wsh,x,7),want,`arms at ${x},7`);
 // level with the top corners (y = 0) and bottom tips (y = 10): consistent, never double-counted
 for(const [x,y] of [[-1,0],[11,0],[-1,10],[5,10],[11,10]])assert.equal(insideAt(wsh,x,y),false,`outside at ${x},${y}`);
 assert.equal(windingAt(shapeFromCommands([{type:'M',x:0,y:0},{type:'L',x:0,y:10},{type:'L',x:10,y:10},{type:'L',x:10,y:0},{type:'Z'}],{dy:10}),5,5),1,'TrueType outer contour winds +1');
});

// ---------------------------------------------------------------- shapes
test('shapeFromCommands maps font units to pixels and drops degenerate input like msdfgen',()=>{
 const s=shapeFromCommands([
  {type:'M',x:0,y:0},{type:'L',x:0,y:0},// zero-length line: dropped
  {type:'L',x:0,y:10},{type:'Q',x1:5,y1:10,x:10,y:10},// collinear quadratic → line
  {type:'Q',x1:12,y1:5,x:10,y:10},// quadratic returning to its start: dropped
  {type:'C',x1:12,y1:8,x2:12,y2:2,x:10,y:0},// real cubic
  {type:'C',x1:8,y1:0,x2:4,y2:0,x:3,y:0},// collinear cubic → line
  {type:'C',x1:2,y1:3,x2:1,y2:3,x:0,y:0}// degree-elevated quadratic (1.5·p1−.5·p0 = 1.5·p2−.5·p3) → quadratic
 ],{scale:2,dx:1,dy:30});
 const E=s.contours[0].edges;
 assert.deepEqual(E.map(e=>e.type),[1,1,3,1,2]);
 assert.deepEqual(Array.from(E[0].p),[1,30,1,10],'px = dx + x·scale, py = dy − y·scale');
 assert.deepEqual(Array.from(E[4].p),[7,30,4,21,1,30]);
 assert.ok(E.every(e=>e.color===WHITE));
 assert.deepEqual(s.bounds,shapeBounds(s));
 assert.ok(Math.abs(s.bounds.x1-24)<1e-12,'the cubic bulges to x = 24, short of its control points at 25: exact extrema');
 // an unclosed contour is closed; flipY:false keeps y
 const open=shapeFromCommands([{type:'M',x:0,y:0},{type:'L',x:4,y:0},{type:'L',x:4,y:4}],{flipY:false});
 assert.equal(open.contours[0].edges.length,3);
 assert.deepEqual(Array.from(open.contours[0].edges[2].p),[4,4,0,0]);
 assert.equal(shapeFromCommands([]).bounds,null);
 assert.throws(()=>shapeFromCommands([{type:'M',x:0,y:'a'}]),/non-numeric y/);
 assert.throws(()=>shapeFromCommands([{type:'X'}]),/Unknown glyph command/);
 assert.throws(()=>shapeFromCommands(null),/array/);
});

test('normalizeShape splits one-edge contours and pushes apart convergent edges',()=>{
 const one=normalizeShape(shapeFromCommands([{type:'M',x:0,y:0},{type:'C',x1:10,y1:20,x2:20,y2:-10,x:0,y:0},{type:'Z'}]));
 assert.equal(one.contours[0].edges.length,3);
 const e=one.contours[0].edges;
 assert.deepEqual([e[0].p[6],e[0].p[7]],[e[1].p[0],e[1].p[1]],'thirds stay connected');
 // a cusp: a quadratic comes back along the line it left on
 const cusp=shapeFromCommands([{type:'M',x:0,y:0},{type:'L',x:10,y:0},{type:'Q',x1:0,y1:0,x:0,y:8},{type:'Z'}],{flipY:false});
 const n=normalizeShape(cloneShape(cusp));
 assert.equal(n.contours[0].edges[1].type,3,'the convergent quadratic is raised to a cubic and nudged');
 assert.notDeepEqual(Array.from(n.contours[0].edges[1].p.slice(2,4)),[0,0]);
});

test('orientContours makes the fill positive for TrueType, CFF and mixed windings, keeping overlaps',()=>{
 const ref=REF.cases.find(c=>c.name==='kenney-future-8'),tt=shapeOf(ref),{w,h,range}=ref;
 assert.ok(tt.contours.some(c=>contourWinding(c)===1)&&tt.contours.some(c=>contourWinding(c)===-1),'outer +1, counters −1');
 const cff=cloneShape(tt);for(const c of cff.contours)reverseContour(c);// CFF-style winding
 const fixed=orientContours(cloneShape(cff));
 assert.deepEqual(fixed.contours.map(contourWinding),tt.contours.map(contourWinding));
 const a=M.generateSDF(tt,w,h,{range}),b=M.generateSDF(cff,w,h,{range});
 assert.ok(maxDiff(b,a)<1e-9,'a reversed outline gives the same SDF');
 // one component reversed on its own (a flipped composite): only that one is fixed
 const two=shapeFromCommands([{type:'M',x:1,y:1},{type:'L',x:1,y:5},{type:'L',x:5,y:5},{type:'L',x:5,y:1},{type:'Z'},
  {type:'M',x:8,y:1},{type:'L',x:12,y:1},{type:'L',x:12,y:5},{type:'L',x:8,y:5},{type:'Z'}],{dy:8});
 assert.deepEqual(two.contours.map(contourWinding),[1,-1]);
 assert.deepEqual(orientContours(two).contours.map(contourWinding),[1,1]);
 // overlapping same-direction contours (variable fonts) are left alone
 const ov=shapeOf(REF.cases.find(c=>c.name==='overlap'));
 const before=ov.contours.map(contourWinding);
 assert.deepEqual(orientContours(ov).contours.map(contourWinding),before);
 assert.deepEqual(before,[1,1,1]);
});

test('shapeDescription writes msdfgen text in its y-up frame',()=>{
 const s=M.edgeColoringSimple(shapeFromCommands([{type:'M',x:0,y:0},{type:'L',x:0,y:4},{type:'Q',x1:4,y1:6,x:4,y:0},{type:'Z'}],{dy:8}));
 const d=shapeDescription(s,{height:8,colors:true});
 assert.match(d,/^\{\n 0, 0;\n [cmy];\n 0, 4;\n [cmy]\(4, 6\);\n 4, 0;\n [cmy];\n #\n\}\n$/);
 assert.throws(()=>shapeDescription(s),/height/);
});

// ---------------------------------------------------------------- generators, encoding, sampling
test('generators: transform, MTSDF alpha, sign conventions and option validation',()=>{
 const c=REF.cases.find(k=>k.name==='kenney-future-S'),s=shapeOf(c),{w,h,range}=c;
 const sdf=M.generateSDF(s,w,h,{range}),mt=M.generateMTSDF(s,w,h,{range});
 let alpha=0;for(let i=0;i<w*h;i++)alpha=Math.max(alpha,Math.abs(mt[i*4+3]-sdf[i]));
 assert.ok(alpha<1e-5,'MTSDF alpha is the true SDF (no overlaps here)');
 const cov=rasterize(s,w,h);
 for(let i=0;i<w*h;i++){if(cov[i]>.99)assert.ok(sdf[i]>0);if(cov[i]<.01)assert.ok(sdf[i]<0);}
 // transform: rendering at 2x through `transform` equals rendering the pre-scaled shape
 const big=M.generateSDF(s,2*w,2*h,{range,transform:{scale:2}});
 const pre=M.generateSDF(transformShape(cloneShape(s),{scale:2}),2*w,2*h,{range});
 assert.ok(maxDiff(big,pre)<1e-4);
 const shifted=M.generateSDF(s,w,h,{range,transform:{translate:[1,0]}});
 assert.ok(Math.abs(shifted[10*w+11]-sdf[10*w+10])<1e-4,'translate moves the glyph right');
 assert.throws(()=>M.generateMSDF(s,w,h,{}),/range/);
 assert.throws(()=>M.generateMSDF(s,w,h,{range,errorCorrection:{mode:'magic'}}),/mode/);
 assert.throws(()=>M.generateMSDF(s,w,h,{range,coloring:'rainbow'}),/coloring/);
 assert.throws(()=>M.generateSDF(s,0,h,{range}),/positive/);
 const empty=M.generateSDF(shapeFromCommands([]),4,4,{range});
 assert.ok(empty.every(v=>v===-Infinity),'nothing to be near: −Infinity, not NaN');
 // the input shape is never mutated by a generator
 const before=JSON.stringify(s.contours.map(k=>k.edges.map(e=>[e.type,e.color,...e.p])));
 M.generateMSDF(s,w,h,{range});
 assert.equal(JSON.stringify(s.contours.map(k=>k.edges.map(e=>[e.type,e.color,...e.p]))),before);
});

test('error-correction modes run and the distance-checked mode equals msdfgen (auto-mixed)',()=>{
 const c=REF.cases.find(k=>k.name==='noto-jp-a'),s=shapeOf(c),{w,h,range}=c;
 const raw=M.generateMSDF(s,w,h,{range,errorCorrection:false});
 const changed={};
 for(const mode of ['indiscriminate','edge-priority','edge-only']){
  const f=M.generateMSDF(s,w,h,{range,errorCorrection:{mode}});
  changed[mode]=0;for(let i=0;i<w*h;i++)if(f[i*3]!==raw[i*3]||f[i*3+1]!==raw[i*3+1]||f[i*3+2]!==raw[i*3+2])changed[mode]++;
 }
 // protecting edges can only reduce what gets corrected
 assert.ok(changed.indiscriminate>=changed['edge-priority']&&changed['edge-priority']>0,JSON.stringify(changed));
 assert.ok(changed['edge-only']<=changed['edge-priority'],JSON.stringify(changed));
 const mixed=M.generateMSDF(s,w,h,{range,scanlineSignFix:false});
 assert.ok(maxDiff(mixed,unpack(c.reference.msdfNoScanline))<=TOL);
});

test('encodeField follows the msdfgen byte convention and the channel layouts',()=>{
 const range=4,f=Float32Array.from([-2,-1,0,1,2,5]);
 const e=M.encodeField(f,6,1,1,{range});
 assert.deepEqual([...e].filter((_,i)=>i%4===0),[0,64,127,191,255,255],'byte = 255 − ⌊255.5 − 255·clamp(d/range+½)⌋');
 assert.ok([...e].filter((_,i)=>i%4===3).every(v=>v===255));
 const a=M.encodeField(f,6,1,1,{range,alphaOnly:true});
 assert.deepEqual([a[0],a[1],a[2],a[3]],[255,255,255,0]);
 assert.equal(a[4*4+3],255);
 const m3=M.encodeField(Float32Array.from([0,1,-1]),1,1,3,{range});
 assert.deepEqual([...m3],[127,191,64,255]);
 const m4=M.encodeField(Float32Array.from([0,1,-1,2]),1,1,4,{range});
 assert.deepEqual([...m4],[127,191,64,255]);
 assert.throws(()=>M.encodeField(f,6,1,2,{range}),/channels/);
 assert.throws(()=>M.encodeField(f,5,1,1,{range}),/size/);
 assert.equal(M.median(3,1,2),2);assert.equal(M.median(-1,-1,5),-1);
});

test('sampleField is bilinear with texel centres at i+½ and clamped edges',()=>{
 const f=Float32Array.from([0,10,20,30]);// 2×2, one channel
 assert.equal(M.sampleField(f,2,2,1,.5,.5)[0],0);
 assert.equal(M.sampleField(f,2,2,1,1.5,1.5)[0],30);
 assert.equal(M.sampleField(f,2,2,1,1,1)[0],15);
 assert.equal(M.sampleField(f,2,2,1,1,.5)[0],5);
 assert.equal(M.sampleField(f,2,2,1,-3,.5)[0],0,'clamped outside');
 const rgb=Float32Array.from([1,2,3,5,6,7]);
 assert.deepEqual(Array.from(M.sampleField(rgb,2,1,3,1,.5)),[3,4,5]);
});

test('reconstructCoverage renders an SDF back to the shape (smoothstep and linear ramps)',()=>{
 const c=REF.cases.find(k=>k.name==='circle-quadratic'),s=shapeOf(c),{w,h,range}=c;
 const enc=M.encodeField(M.generateSDF(s,w,h,{range}),w,h,1,{range});
 for(const ramp of ['smoothstep','linear']){
  const r=M.reconstructCoverage(enc,w,h,1,{scale:2,range,ramp}),ex=rasterize(transformShape(cloneShape(s),{scale:2}),2*w,2*h);
  let err=0;for(let i=0;i<r.length;i++)err+=Math.abs(r[i]-ex[i]);
  assert.ok(err/r.length<.02,`${ramp}: mean |coverage error| ${err/r.length}`);
 }
 const alpha=M.encodeField(M.generateSDF(s,w,h,{range}),w,h,1,{range,alphaOnly:true});
 assert.deepEqual(M.reconstructCoverage(alpha,w,h,1,{scale:1,range,alphaOnly:true}),M.reconstructCoverage(enc,w,h,1,{scale:1,range}));
 assert.throws(()=>M.reconstructCoverage(enc,w,h,1,{range,ramp:'cubic'}),/ramp/);
});

test('performance: a CJK glyph in a 64x64 MSDF cell',t=>{
 const c=REF.cases.find(k=>k.name==='noto-jp-ei');
 const s=shapeFromCommands(c.commands,{scale:c.scale*1.6,dx:c.dx*1.6,dy:c.dy*1.6});
 for(let i=0;i<3;i++)M.generateMSDF(s,64,64,{range:4});
 const t0=performance.now(),N=10;
 for(let i=0;i<N;i++)M.generateMSDF(s,64,64,{range:4});
 const ms=(performance.now()-t0)/N;
 t.diagnostic(`${edgeCount(s)} edges, 64x64 MSDF: ${ms.toFixed(1)} ms`);
 assert.ok(ms<500,'sanity bound only; timings are reported, not gated');
});
