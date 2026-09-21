import {test} from 'node:test';
import assert from 'node:assert/strict';
import {INTENTS} from '../src/intents.js';
import {CAPABILITIES,MATURITY,mayPromote,qualifies} from '../src/capabilities.js';
import {imageMetrics} from '../src/quality.js';
import {deviceCapabilities,imagePlan} from '../src/resources.js';
import {blobCRC,crc32,zip} from '../src/core.js';
import {appendOperation,retainedBlobBytes} from '../src/image-document.js';
import {inspectImage} from '../src/image-container.js';
import {parsePalette,quantizePerceptual} from '../src/pixel-engine.js';
import {ComponentScan} from '../src/component-scan.js';
import {components} from '../src/primitives.js';
test('streaming components match independent flood fill across strip boundaries and random masks',()=>{
 let seed=991;for(let trial=0;trial<30;trial++){const w=37,h=41,data=new Uint8ClampedArray(w*h*4);for(let i=3;i<data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed%100<(trial%2?65:20)?255:0;}const expected=components(data,w,h,{minArea:2}),scan=new ComponentScan(w,{minArea:2});for(let y=0;y<h;y+=7)scan.rows(data.subarray(y*w*4,Math.min(h,y+7)*w*4),Math.min(7,h-y));assert.deepEqual(scan.finish(),expected);}
});
test('every public tool has a complete contract and no unearned maturity',()=>{
 assert.deepEqual(Object.keys(CAPABILITIES),Object.keys(INTENTS));
 for(const c of Object.values(CAPABILITIES)){
  for(const key of ['maturity','engine','maxInput','maxOutput','supportedFormats','preservesAlpha','preservesMetadata','lossless','ai','hardwareAcceleration','streaming','tiled','limitations','verifiedBrowsers'])assert.notEqual(c[key],undefined,key);
  assert(MATURITY.includes(c.maturity));if(MATURITY.indexOf(c.maturity)<2)assert.equal(c.seoPromotable,false);assert(c.engine);if(MATURITY.indexOf(c.maturity)>=2)assert(c.qualityEvidence.length);
 }
});
test('metric identity, known constant RGB offset and separate alpha errors',()=>{
 const a=new Uint8Array(8*8*4).fill(100),b=new Uint8Array(a);assert(imageMetrics(a,b,8,8).exact);
 for(let i=0;i<b.length;i+=4)b[i]+=10,b[i+1]+=10,b[i+2]+=10;
 const m=imageMetrics(a,b,8,8);assert.equal(m.mse,100);assert(Math.abs(m.psnr-28.1308036086791)<1e-9);assert(m.ssim<1&&m.ssim>.99);assert.equal(m.alphaRMSE,0);
 b.set(a);b[3]=110;assert.equal(imageMetrics(a,b,8,8).alphaRMSE,1.25);assert.throws(()=>imageMetrics(a,b,9,8));
});
test('resource hints select bounded tiles without imposing a global 16MP cap',()=>{
 const low=deviceCapabilities({navigator:{deviceMemory:1,hardwareConcurrency:2}}),high=deviceCapabilities({navigator:{deviceMemory:8,hardwareConcurrency:16},Worker:class {}});
 assert.equal(imagePlan(3840,2160,7680,4320,{capabilities:low}).tile,512);
 assert.equal(imagePlan(3840,2160,7680,4320,{capabilities:high}).concurrency,2);
 assert(imagePlan(16384,2048).estimatedBytes>0);assert.equal(deviceCapabilities({}).webgpu,false);
 assert.throws(()=>imagePlan(NaN,3));
});
test('transform history retains one original blob and immutable operation snapshots',()=>{
 const source=new Blob(['source']),rect={x:0,y:0,w:.5,h:1};const a=appendOperation(source,{type:'crop',rect}),b=appendOperation(a,{type:'rotate',flip:false});
 rect.w=1;assert.equal(a.operations[0].rect.w,.5);assert.equal(a.operations.length,1);assert.equal(b.operations.length,2);assert.equal(b.source,source);
 assert.equal(retainedBlobBytes([{original:source,blob:b,history:[source,a]}]),source.size);
});
test('incremental ZIP CRC never requests the whole input and cancellation is observed',async()=>{
 const data=new Uint8Array(2500000);for(let i=0;i<data.length;i++)data[i]=i%251;const blob=new Blob([data]);
 blob.arrayBuffer=()=>{throw Error('Whole input read forbidden');};assert.equal(await blobCRC(blob),crc32(data));
 assert((await zip([{name:'large.bin',blob}])).size>blob.size);
 const c=new AbortController();await assert.rejects(blobCRC(blob,{signal:c.signal,progress:()=>c.abort()}),e=>e.name==='AbortError');
});
test('animation containers are detected before the browser silently flattens them',async()=>{
 const webp=new Uint8Array(32);webp.set(new TextEncoder().encode('RIFF'),0);webp.set(new TextEncoder().encode('WEBPVP8X'),8);webp[20]=2;
 assert.equal((await inspectImage(new Blob([webp]))).animation,true);webp[20]=0;assert.equal((await inspectImage(new Blob([webp]))).animation,false);
 const png=new Uint8Array(28);png.set([137,80,78,71,13,10,26,10]);new DataView(png.buffer).setUint32(8,8);png.set(new TextEncoder().encode('acTL'),12);
 assert.equal((await inspectImage(new Blob([png]))).animation,true);
 assert.equal((await inspectImage(new Blob(['GIF89a']))).animation,'unsupported');
});
test('custom/GIMP palettes, alpha and deterministic dithering across frames',()=>{
 assert.deepEqual(parsePalette('#ff0000\n00ff00'),[[255,0,0],[0,255,0]]);assert.deepEqual(parsePalette('GIMP Palette\nName: test\n255 0 0 red'),[[255,0,0]]);assert.throws(()=>parsePalette('invalid'));
 const data=new Uint8ClampedArray(16*16*4);for(let i=0;i<256;i++)data.set([i,255-i,50,i],i*4);
 const palette=[[255,0,0],[0,255,0],[0,0,0]];
 for(const ditherMode of ['ordered','floyd-steinberg']){
  const out=quantizePerceptual(data,16,16,3,1,{palette,ditherMode});assert.deepEqual(out,quantizePerceptual(data,16,16,3,1,{palette,ditherMode}));
  for(let i=0;i<256;i++){assert.equal(out[i*4+3],data[i*4+3]);if(i)assert(palette.some(c=>c.every((v,k)=>v===out[i*4+k])));}
 }
});

import {repairAvcDescription} from '../src/avc-metadata.js';
test('Firefox duplicated AVC parameter headers are repaired without changing valid or unknown records',()=>{
 const bad=Uint8Array.from(Buffer.from('0164001e0301001c676764001eac2cac0a02ff961000000300100000030300da088453800100056868ce3c30','hex'));
 const fixed=repairAvcDescription(bad);assert.equal(fixed.length,bad.length-2);assert.equal(fixed[4],255);assert.equal(fixed[8],0x67);assert.equal(fixed[9],100);assert.equal(fixed.at(-4),0x68);
 assert.equal(repairAvcDescription(fixed),fixed);assert.deepEqual(bad.subarray(8,10),new Uint8Array([0x67,0x67]));
 for(let length=0;length<bad.length;length++){const truncated=bad.slice(0,length);assert.equal(repairAvcDescription(truncated),truncated);}
});

test('unqualified public tools are usable but cannot be actively promoted',()=>{assert(mayPromote('home'));for(const [id,c]of Object.entries(CAPABILITIES))if(id!=='home'&&c.maturity==='basic')assert.equal(mayPromote(id),false);});
test('Advanced needs workflow and quality evidence passing in Chromium and Firefox',()=>{
 const w={kind:'workflow',suite:'s',check:'c',engines:['chromium','firefox']},q={kind:'quality',suite:'s',check:'q',engines:['chromium']};
 assert.equal(qualifies([w,q]),true);assert.equal(qualifies([w]),false,'workflow alone');assert.equal(qualifies([{...w,engines:['chromium']},q]),false,'Chromium only');
 assert.equal(qualifies([w,{...q,check:''}]),false,'every entry must name its check');assert.equal(qualifies(),false);
 for(const [id,c] of Object.entries(CAPABILITIES)){assert.equal(c.maturity==='advanced',qualifies(c.evidence),id);assert.equal(mayPromote(id),id==='home'||qualifies(c.evidence),id);}
});
