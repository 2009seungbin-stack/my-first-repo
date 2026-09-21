import test,{mock} from 'node:test';
import assert from 'node:assert/strict';

// Minimal window/document stand-ins: only what ai-host.js touches.
function environment(){
 const listeners=new Set(),frames=[],posted=[];
 globalThis.location={origin:'https://site.test'};
 globalThis.addEventListener=(type,fn)=>{if(type==='message')listeners.add(fn);};
 globalThis.removeEventListener=(type,fn)=>listeners.delete(fn);
 globalThis.Worker=class{constructor(url){this.url=String(url);this.plain=true;}};
 globalThis.document={body:{append(frame){frame.isConnected=true;frames.push(frame);}},createElement(){
  const load=[];const frame={style:{},setAttribute(){},isConnected:false,contentWindow:{postMessage:(...args)=>posted.push(args)},
   addEventListener:(type,fn)=>{if(type==='load')load.push(fn);},remove(){frame.isConnected=false;},load:()=>load.forEach(fn=>fn())};
  return frame;
 }};
 const ready=(frame,isolated)=>{for(const fn of[...listeners])fn({source:frame.contentWindow,origin:location.origin,data:{type:'ai-runtime-ready',isolated}});};
 return {frames,posted,ready};
}

test('isolated runtime frame survives the fallback timers once it reported ready',async()=>{
 mock.timers.enable({apis:['setTimeout']});
 try{
  const env=environment(),{aiWorker}=await import('../src/ai-host.js?ready');
  const pending=aiWorker('sr',new URL('https://site.test/src/sr-worker.js'));
  const [frame]=env.frames;frame.load();env.ready(frame,true);
  const handle=await pending;assert.equal(handle.isolated,true);
  mock.timers.tick(60000);
  assert.equal(frame.isConnected,true,'a stale timer removed the frame and killed its worker');
  assert.equal(env.posted.length,1);assert.equal(env.posted[0][0].name,'sr');handle.terminate();
 }finally{mock.timers.reset();}
});

test('a runtime page that loads without isolation falls back to a plain worker',async()=>{
 mock.timers.enable({apis:['setTimeout']});
 try{
  const env=environment(),{aiWorker}=await import('../src/ai-host.js?plain');
  const pending=aiWorker('matte',new URL('https://site.test/src/matte-worker.js'));
  const [frame]=env.frames;frame.load();mock.timers.tick(1500);
  const worker=await pending;assert.equal(worker.plain,true);assert.equal(frame.isConnected,false);
 }finally{mock.timers.reset();}
});

test('bitmaps cross the isolated-frame boundary as transferable RGBA, other fields untouched',async()=>{
 const saved={ImageBitmap:globalThis.ImageBitmap,OffscreenCanvas:globalThis.OffscreenCanvas,ImageData:globalThis.ImageData,createImageBitmap:globalThis.createImageBitmap};
 const closed=[];
 globalThis.ImageBitmap=class{constructor(w,h){this.width=w;this.height=h;}close(){closed.push(this);}};
 globalThis.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return {drawImage(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(7)})};}};
 globalThis.ImageData=class{constructor(data,w,h){Object.assign(this,{data,width:w,height:h});}};
 globalThis.createImageBitmap=async(image,options)=>({decoded:image,options});
 try{
  environment();const {packBitmaps,unpackBitmaps}=await import('../src/ai-host.js?pack');
  const bitmap=new ImageBitmap(2,3),extra=new ArrayBuffer(4);
  const {data,transfer}=packBitmaps({bitmap,scale:4,extra},[bitmap,extra]);
  assert.deepEqual(closed,[bitmap],'the GPU-backed original is released after readback');
  assert.equal(data.scale,4);assert.equal(data.bitmap.width,2);assert.equal(data.bitmap.rgba.byteLength,24);
  assert(transfer.includes(extra)&&transfer.includes(data.bitmap.rgba)&&!transfer.some(v=>v instanceof ImageBitmap));
  assert.deepEqual(packBitmaps({progress:'x'}),{data:{progress:'x'},transfer:[]});
  const unpacked=await unpackBitmaps(data);
  assert.equal(unpacked.bitmap.decoded.width,2);assert.equal(unpacked.bitmap.decoded.data[0],7);assert.equal(unpacked.bitmap.options.premultiplyAlpha,'none');
 }finally{Object.assign(globalThis,saved);}
});
