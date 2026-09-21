import * as Im from '../src/image.js';
import {imageMetrics} from '../src/quality.js';
import {deviceCapabilities} from '../src/resources.js';

const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
function fixture(w=512,h=384){
 const c=Im.canvas(w,h),ctx=c.getContext('2d'),d=ctx.createImageData(w,h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,r=Math.hypot(x-w/2,y-h/2),a=Math.max(0,Math.min(255,(Math.min(w,h)*.43-r)*32));
  d.data.set([110+90*Math.sin(x*.08),120+90*Math.cos(y*.08),130+80*Math.sin((x+y)*.04),a],i);
 }
 ctx.putImageData(d,0,0);return c;
}
export async function run({full=false}={}){
 const rows=[],checks=[],check=(name,value)=>{checks.push({name,passed:!!value});if(!value)throw Error(name);};
 const source=fixture();let ticks=0;const timer=setInterval(()=>ticks++,10);
 try{
  for(const filter of ['mks2013','lanczos3']){
   const start=performance.now(),a=await Im.resizeQuality(source,1536,1152,{filter,tile:512}),b=await Im.resizeQuality(source,1536,1152,{filter,tile:1024});
   const metric=imageMetrics(pixels(a),pixels(b),a.width,a.height);
   check(`${filter}: tile-grid-independent output`,metric.mse<.02&&metric.alphaRMSE<.2);
   const d=pixels(a);check(`${filter}: opaque/transparent and partial alpha`,d[3]===0&&d[(576*1536+768)*4+3]===255&&d.some((v,i)=>i%4===3&&v>0&&v<255));
   rows.push({case:'transparent-illustration',operation:'3x resize / tile seam comparison',filter,input:[512,384],output:[1536,1152],elapsedMs:performance.now()-start,...metric,...a.processingReport});Im.release(a);Im.release(b);
  }
  const controller=new AbortController();const pending=Im.resizeQuality(source,4096,3072,{signal:controller.signal});setTimeout(()=>controller.abort(),25);
  let cancelled=false;try{Im.release(await pending);}catch(e){cancelled=e.name==='AbortError';}check('abort propagates through resampling',cancelled);
  const repeat=[];
  for(let i=0;i<10;i++){
   const start=performance.now(),out=await Im.resizeQuality(source,1024,768);Im.release(out);
   repeat.push({ms:performance.now()-start,jsHeapBytes:performance.memory?.usedJSHeapSize??null});
  }
  rows.push({case:'10-repeat-lifecycle',samples:repeat,memoryNote:'JS heap samples only, not browser/GPU peak or proof of no leaks'});
  check('UI timers advance during async processing',ticks>5);
  const original=await Im.blobOf(source);
  const compressed=await Im.encode(source,{format:'auto',kb:40,allowShrink:true});
  check('compression respects target',compressed.met&&compressed.blob.size<=40960);
  check('compression preserves alpha-aware choice',compressed.format!=='jpeg');
  check('compression quality on illustration fixture',compressed.report.ssim>.97);
  const magic=new Uint8Array(await compressed.blob.slice(0,16).arrayBuffer());
  check('encoder MIME matches selected format',compressed.blob.type===`image/${compressed.format}`);
  rows.push({case:'transparent-illustration-compression',originalBytes:original.size,...compressed.report,magic:[...magic]});
  const graph=await import('../src/image-document.js');
  const doc=graph.appendOperation(graph.appendOperation(original,{type:'rotate',flip:false}),{type:'rotate',flip:false});
  const inputDecoded=await Im.decode(original),rendered=await Im.decode(doc),expected=Im.rotate(inputDecoded),twice=Im.rotate(expected);Im.release(inputDecoded);Im.release(expected);
  check('operation history replays without re-encoding source',imageMetrics(pixels(twice),pixels(rendered),source.width,source.height).exact);Im.release(twice);Im.release(rendered);
  const trimmed=await Im.trimAsync(source),oldTrim=Im.trim(source);
  check('incremental worker bounds matches full scan',trimmed.width===oldTrim.width&&trimmed.height===oldTrim.height&&imageMetrics(pixels(trimmed),pixels(oldTrim),trimmed.width,trimmed.height).exact);Im.release(trimmed);Im.release(oldTrim);
  const outline=await Im.processPixels(source,'outline',{radius:4}),referenceOutline=(await import('../src/core.js')).addOutline(pixels(source),source.width,source.height,4);
  check('overlapped outline tiles equal whole-image reference',imageMetrics(referenceOutline,pixels(outline),source.width,source.height).exact);Im.release(outline);
  const tiledSource=Im.canvas(1350,1100),tileContext=tiledSource.getContext('2d'),tileGradient=tileContext.createLinearGradient(0,0,1350,1100);tileGradient.addColorStop(0,'#102045');tileGradient.addColorStop(1,'#eeddbb');tileContext.fillStyle=tileGradient;tileContext.fillRect(0,0,1350,1100);
  const {outlineTiled}=await import('../src/image-tiles.js'),primitives=await import('../src/primitives.js');for(const mode of ['normal','gray']){const tiled=await outlineTiled(tiledSource,{kind:'texture',options:{mode,strength:3}}),reference=primitives.mapTexture(pixels(tiledSource),1350,1100,{mode,strength:3});check(`texture ${mode} overlap has no tile seams`,imageMetrics(reference,pixels(tiled),1350,1100).exact);Im.release(tiled);}Im.release(tiledSource);
  const {extrudeAtlas}=await import('../src/atlas.js'),atlasSource=Im.canvas(32,32);atlasSource.getContext('2d').drawImage(source,0,0,32,32);const padded=await extrudeAtlas(atlasSource,16,16,3),expectedAtlas=primitives.extrude(pixels(atlasSource),32,32,16,16,3);check('direct atlas blits match reference padding and coordinates',imageMetrics(expectedAtlas.data,pixels(padded.canvas),padded.width,padded.height).exact);Im.release(padded.canvas);Im.release(atlasSource);
  for(const [cw,ch] of [[1,1],[1,16],[16,1]]){const tiny=Im.canvas(cw*2,ch*2);tiny.getContext('2d').fillStyle='#987654';tiny.getContext('2d').fillRect(0,0,tiny.width,tiny.height);const actual=await extrudeAtlas(tiny,cw,ch,2),expected=primitives.extrude(pixels(tiny),tiny.width,tiny.height,cw,ch,2);check(`single-pixel atlas ${cw}x${ch} preserves edge padding`,imageMetrics(expected.data,pixels(actual.canvas),actual.width,actual.height).exact);Im.release(actual.canvas);Im.release(tiny);}
  const {packMasks}=await import('../src/mask-packer.js');
  const maskSource=Im.canvas(full?7680:64,full?4320:48);maskSource.getContext('2d').fillStyle='#205080';maskSource.getContext('2d').fillRect(0,0,maskSource.width,maskSource.height);
  const maskStart=performance.now(),maskBlob=await packMasks([{blob:await Im.blobOf(maskSource)}],maskSource.width,maskSource.height,[0,'one',0,'zero']);
  const maskBytes=new Uint8Array(await maskBlob.arrayBuffer()),maskView=new DataView(maskBytes.buffer),idats=[];
  for(let at=8;at<maskBytes.length;){const length=maskView.getUint32(at);if(String.fromCharCode(...maskBytes.subarray(at+4,at+8))==='IDAT')idats.push(maskBytes.subarray(at+8,at+8+length));at+=length+12;}
  const raw=new Uint8Array(await new Response(new Blob(idats).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()),stride=maskSource.width*4+1,luma=Math.round(.2126*32+.7152*80+.0722*128);
  check('mask channels retain nonzero RGB under alpha zero',raw.length===stride*maskSource.height&&raw.every((v,i)=>i%stride===0?v===0:(i%stride-1)%4===0||(i%stride-1)%4===2?v===luma:(i%stride-1)%4===1?v===255:v===0));
  rows.push({case:full?'8K sequential mask packing / independently inflated channels':'sequential mask packing',width:maskSource.width,height:maskSource.height,bytes:maskBlob.size,elapsedMs:performance.now()-maskStart});Im.release(maskSource);
  if(full){
   const large=Im.canvas(3840,2160),ctx=large.getContext('2d'),g=ctx.createLinearGradient(0,0,3840,2160);g.addColorStop(0,'#123456');g.addColorStop(1,'#efbd79');ctx.fillStyle=g;ctx.fillRect(0,0,3840,2160);
   const start=performance.now(),out=await Im.resizeQuality(large,7680,4320);check('actual 4K to 8K canvas',out.width===7680&&out.height===4320);
   const blob=await Im.blobOf(out),decoded=await createImageBitmap(blob);check('actual 8K PNG decode',decoded.width===7680&&decoded.height===4320);decoded.close();
   const center=out.getContext('2d').getImageData(3840,2160,1,1).data;check('8K output contains gradient pixels',center[3]===255&&center[0]>80&&center[0]<190);
   rows.push({case:'4K-to-8K-gradient',input:[3840,2160],output:[7680,4320],bytes:blob.size,elapsedMs:performance.now()-start,...out.processingReport});Im.release(out);Im.release(large);
  }
 }finally{clearInterval(timer);Im.release(source);}
 const compression=await(await import('./compression-browser.mjs')).run();checks.push(...compression.checks);rows.push(...compression.rows);
 return {environment:{userAgent:navigator.userAgent,...deviceCapabilities()},checks,rows,qualityScope:'Deterministic illustration, text UI, transparent logo, noise, NASA public-domain portrait and already-compressed JPEG. Anime/hair/fur acceptance and 8K ML remain UNVERIFIED.'};
}
