import {installAvcMetadataRepair} from './avc-metadata.js';
import * as B from '../assets/vendor/mediabunny-1.58.1/mediabunny.min.mjs';
const metadataRepairs=installAvcMetadataRepair();
let conversion,canceled=false;
const check=()=>{if(canceled)throw new DOMException('Canceled','AbortError');};
const progress=(stage,fraction)=>postMessage({progress:stage,fraction});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const inputOf=file=>new B.Input({source:new B.BlobSource(file,{maxCacheSize:8*1024**2}),formats:B.ALL_FORMATS});
async function inspect(input){const video=await input.getPrimaryVideoTrack(),audio=await input.getPrimaryAudioTrack();return {duration:await input.computeDuration(),w:video?await video.getDisplayWidth():0,h:video?await video.getDisplayHeight():0,videoCodec:video?await video.getCodec():null,audioCodec:audio?await audio.getCodec():null,audio:!!audio,container:(await input.getFormat()).name};}
async function storage(name,format,preferMemory=false){let root,handle,writer;if(!preferMemory&&navigator.storage?.getDirectory){try{root=await navigator.storage.getDirectory();handle=await root.getFileHandle(name,{create:true});writer=await handle.createWritable();}catch(e){if(e.name==='QuotaExceededError')throw Error('Temporary storage is full. Free browser storage or use a shorter section.');root=null;}}
 if(writer){let closed=false;const writable=new WritableStream({write:chunk=>writer.write(chunk),close:async()=>{await writer.close();closed=true;},abort:async()=>{await writer.abort().catch(()=>{});closed=true;}});return {target:new B.StreamTarget(writable,{chunked:true,chunkSize:1024**2}),backend:'opfs',finish:async()=>({blob:await handle.getFile(),temp:name}),cleanup:async()=>{if(!closed)await writer.abort().catch(()=>{});await root.removeEntry(name).catch(()=>{});}};}
 const target=new B.BufferTarget();return {target,backend:'memory',finish:async()=>({blob:new Blob([target.buffer],{type:format.mimeType})}),cleanup:async()=>{}};
}
async function probe(file){const input=file?inputOf(file):null;try{const metadata=input?await inspect(input):{};const codecs=await B.getEncodableVideoCodecs(['avc','vp9','vp8','av1']);return {...metadata,codecs,mp4:codecs.includes('avc'),audioCodecs:await B.getEncodableAudioCodecs(['aac','opus','mp3','vorbis','pcm-s16']),webCodecs:typeof VideoEncoder!=='undefined',opfs:!!navigator.storage?.getDirectory};}finally{input?.dispose();}}
/** Loudest sample in the section, so "normalise" scales by a measured peak instead of a guess. */
async function audioPeak(file,start,end){const input=inputOf(file);try{const track=await input.getPrimaryAudioTrack();if(!track)return 0;const sink=new B.AudioSampleSink(track);let peak=0;for await(const sample of sink.samples(start,end)){check();const n=sample.numberOfFrames*sample.numberOfChannels,data=new Float32Array(n);sample.copyTo(data,{planeIndex:0,format:'f32'});sample.close();for(let i=0;i<n;i++){const v=Math.abs(data[i]);if(v>peak)peak=v;}}return peak;}finally{input.dispose();}}
/** Per-sample gain: constant volume/normalise scaling plus linear fades measured from the first
 * sample of the section, because trimmed samples keep their source timestamps. */
function gainProcessor(scale,fadeIn,fadeOut,duration){
 let base=null;
 return sample=>{
  if(base===null)base=sample.timestamp;
  const rate=sample.sampleRate,channels=sample.numberOfChannels,frames=sample.numberOfFrames,data=new Float32Array(frames*channels);
  sample.copyTo(data,{planeIndex:0,format:'f32'});const from=sample.timestamp-base;
  for(let i=0;i<frames;i++){
   const at=from+i/rate;let g=scale;
   if(fadeIn>0&&at<fadeIn)g*=at/fadeIn;
   if(fadeOut>0&&at>duration-fadeOut)g*=clamp((duration-at)/fadeOut,0,1);
   if(g!==1)for(let c=0;c<channels;c++)data[i*channels+c]*=g;
  }
  const out=new B.AudioSample({data,format:'f32',numberOfChannels:channels,sampleRate:rate,timestamp:sample.timestamp});sample.close();return out;
 };
}
const cropRect=(w,h,ratio)=>{
 const [a,b]=String(ratio||'').split(':').map(Number);if(!(a>0&&b>0))return null;
 const want=a/b,cw=want>w/h?w:Math.max(2,Math.round(h*want)),ch=want>w/h?Math.max(2,Math.round(w/want)):h;
 return cw>=w&&ch>=h?null:{left:Math.floor((w-cw)/2),top:Math.floor((h-ch)/2),width:cw,height:ch};
};
/** What an encode actually spent per track, so the next target pass corrects measured bytes
 * instead of the bitrate the encoder was asked for — Firefox's AVC encoder exceeds it by ~10%
 * and its Opus encoder by ~9%, which no duration formula can predict. */
async function trackBytes(blob){
 const input=inputOf(blob);
 try{
  let video=0,audio=0;
  for(const [track,add]of [[await input.getPrimaryVideoTrack(),n=>video+=n],[await input.getPrimaryAudioTrack(),n=>audio+=n]]){
   if(!track)continue;const sink=new B.EncodedPacketSink(track);
   for await(const packet of sink.packets(undefined,undefined,{metadataOnly:true})){check();add(packet.byteLength);}
  }
  return {video,audio,overhead:Math.max(0,blob.size-video-audio)};
 }finally{input.dispose();}
}
/** One encode at a fixed bitrate. The caller measures the result and may run another pass. */
async function encodePass(file,options,temp,plan){
 const input=inputOf(file);let store;
 try{
  const {meta,ext,audioOnly,mute,bitrate,audioBitrate,gain,fadeIn,fadeOut,duration,label}=plan;
  const format=ext==='webm'?new B.WebMOutputFormat():ext==='mp3'?new B.Mp3OutputFormat():ext==='wav'?new B.WavOutputFormat():new B.Mp4OutputFormat({fastStart:'fragmented'});
  store=await storage(temp,format,options.memory);const output=new B.Output({format,target:store.target}),fast=options.mode==='fast'&&!audioOnly;
  const crop=audioOnly||fast?null:cropRect(meta.w,meta.h,options.crop);
  const box=crop?{w:crop.width,h:crop.height}:{w:meta.w,h:meta.h};
  const width=options.width?Math.max(2,Math.floor(Math.min(box.w,options.width)/2)*2):crop?Math.max(2,Math.floor(box.w/2)*2):undefined,height=width?Math.max(2,Math.round(width*box.h/box.w/2)*2):undefined;
  const quality=bitrate>0?new B.Quality({bitrate}):new B.Quality(options.preset==='best'?'high':options.preset==='small'?'low':'medium');
  const video=audioOnly?{discard:true}:fast?{}:{width,height,fit:'contain',...(crop?{crop}:{}),frameRate:Number(options.fps)||undefined,quality,forceTranscode:true};
  if(!audioOnly&&!fast){const candidates=options.codec&&options.codec!=='auto'?[options.codec]:ext==='mp4'?['avc']:['vp9','vp8','av1'];video.codec=await B.getFirstEncodableVideoCodec(candidates,{width:width||box.w,height:height||box.h,quality,frameRate:Number(options.fps)||30});if(!video.codec)throw Error(`No supported ${ext.toUpperCase()} encoder for these dimensions. Try WebM, a smaller resolution, or Fast cut.`);}
  const audio=mute?{discard:true}:fast?{}:{...(audioOnly?{codec:ext==='mp3'?'mp3':ext==='wav'?'pcm-s16':'aac',forceTranscode:true}:{}),quality:new B.Quality({bitrate:audioBitrate}),...(options.sampleRate?{sampleRate:Number(options.sampleRate)}:{}),...(gain!==1||fadeIn>0||fadeOut>0?{process:gainProcessor(gain,fadeIn,fadeOut,duration),forceTranscode:true}:{})};
  conversion=await B.Conversion.init({input,output,tracks:'primary',trim:{start:options.start,end:options.end},video,audio,copy:fast?{mode:'forced',boundaryPolicy:'shrink',shiftTolerance:Infinity}:undefined,showWarnings:false});check();
  const lost=conversion.discardedTracks.filter(d=>(d.track.type==='audio'&&!mute)||(!audioOnly&&d.track.type==='video'));
  if(!conversion.isValid||lost.length)throw Error('A required video/audio track cannot be preserved: '+lost.map(d=>d.reason).join(', ')+'. Try another container or Precise cut.');
  conversion.onProgress=f=>progress((fast?'Remuxing':'Encoding')+label,f);await conversion.execute();check();
  return {store,result:await store.finish(),crop,width:width||box.w};
 }catch(error){await store?.cleanup();throw error;}finally{input.dispose();conversion=null;}
}
async function convert(file,options,temp){
 const started=performance.now(),first=inputOf(file);let meta;
 try{meta=await inspect(first);}finally{first.dispose();}
 const duration=options.end-options.start;
 if(!(duration>0)||options.start<0||options.end>meta.duration+.1)throw Error('Check the start and end times.');check();
 const ext=options.format||'webm',audioOnly=['mp3','wav','m4a'].includes(ext);
 if(audioOnly&&!meta.audio)throw Error('This file has no audio track.');if(!audioOnly&&!meta.w)throw Error('This file has no video track.');
 if(ext==='mp3'&&!(await B.canEncodeAudio('mp3'))){const {registerMp3Encoder}=await import('../assets/vendor/mediabunny-mp3-encoder-1.58.1/mediabunny-mp3-encoder.min.mjs');registerMp3Encoder();}
 const mute=!!options.mute&&!audioOnly,keepsAudio=meta.audio&&!mute,audioBitrate=(Number(options.audioBitrate)||192)*1000;
 const fadeIn=keepsAudio?clamp(Number(options.fadeIn)||0,0,duration/2):0,fadeOut=keepsAudio?clamp(Number(options.fadeOut)||0,0,duration/2):0;
 let gain=Number(options.volume)>0?Number(options.volume):1,peak=0;
 if(options.normalize&&keepsAudio){progress('Measuring the audio level',0);peak=await audioPeak(file,options.start,options.end);if(peak>0)gain*=clamp(.98/peak,.05,32);}
 // Target size is measured, not predicted: the first bitrate is a duration budget, and every
 // later pass corrects it by the bytes the encoder and container actually produced.
 const budget=Number(options.targetMB)>0?Number(options.targetMB)*1024**2:0,audioBytes=keepsAudio&&!audioOnly?audioBitrate*duration/8:0,floor=50000;
 let bitrate=Number(options.bitrate)||0;
 if(budget){const room=budget*.95-audioBytes;if(room*8/duration<floor)throw Error('Target size leaves less than 50 kbit/s for video. Increase the target or shorten the section.');bitrate=Math.floor(room*8/duration);}
 const passes=budget&&!audioOnly?4:1,attempts=[];let store=null,out=null,pass=0,shape=null,width=Number(options.width)||0,previous=0;
 try{
  for(pass=1;pass<=passes;pass++){
   const encoded=await encodePass(file,{...options,width},`${temp}-${pass}`,{meta,ext,audioOnly,mute,bitrate,audioBitrate,gain,fadeIn,fadeOut,duration,label:passes>1?` · pass ${pass}/${passes}`:''});
   store=encoded.store;out=encoded.result;shape=encoded;
   if(!budget||out.blob.size<=budget||pass===passes)break;
   const bytes=out.blob.size,spent=await trackBytes(out.blob),room=budget*.97-spent.audio-spent.overhead;
   attempts.push({bitrate,width:shape.width,bytes,videoBytes:spent.video});
   const stuck=previous>0&&bytes>previous*.98;previous=bytes;
   await store.cleanup();store=null;out=null;
   if(room<=0)throw Error(`The audio track alone needs ${Math.round((spent.audio+spent.overhead)/1024)} KB. Raise the target, shorten the section, mute the audio or lower the audio bitrate.`);
   const ratio=room/Math.max(1,spent.video),next=Math.max(floor,Math.floor(bitrate*ratio));
   // Every encoder has a practical floor for a given frame size: when lowering the bitrate stops
   // paying off, the frame itself has to get smaller.
   if(ratio<.95||next>=bitrate||stuck)width=Math.max(160,Math.round(shape.width*Math.min(.9,Math.sqrt(clamp(ratio,.35,1)))/2)*2);
   bitrate=next;
  }
  const verify=inputOf(out.blob);let actual;try{actual=await inspect(verify);}finally{verify.dispose();}
  if(keepsAudio&&!actual.audio)throw Error('Output verification failed: audio track is missing.');
  const report={encoderMetadataRepairs:metadataRepairs(),engine:'Mediabunny 1.58.1 / WebCodecs',mode:options.mode==='fast'&&!audioOnly?'keyframe-shrink':'decode-encode',requestedStart:options.start,requestedEnd:options.end,requestedDuration:duration,durationError:actual.duration-duration,...actual,originalBytes:file.size,outputBytes:out.blob.size,bitrate:Math.round(out.blob.size*8/actual.duration),targetMB:options.targetMB||0,targetMet:budget?out.blob.size<=budget:null,passes:pass,attempts,videoBitrate:bitrate||null,requestedWidth:Number(options.width)||0,muted:mute,crop:shape.crop,audioPeak:peak||null,audioGain:gain,storage:store.backend,elapsedMs:performance.now()-started,format:ext};
  const result={...out,report};store=null;return result;
 }finally{await store?.cleanup();}
}
async function extract(file,options){const input=inputOf(file);try{const track=await input.getPrimaryVideoTrack();if(!track)throw Error('This file has no video track.');const sink=new B.CanvasSink(track,{...(options.width?{width:options.width}:{}),poolSize:1}),frame=await sink.getCanvas(options.time);check();if(!frame)throw Error('No frame at this timestamp.');const format=['png','jpeg','webp'].includes(options.format)?options.format:'png',blob=await frame.canvas.convertToBlob({type:'image/'+format,quality:.94});return {blob,report:{w:frame.canvas.width,h:frame.canvas.height,timestamp:frame.timestamp,engine:'WebCodecs',format:blob.type}};}finally{input.dispose();}}
/** Timeline strip: several frames of one decode pass, so scrubbing has something to aim at. */
async function thumbs(file,options){const input=inputOf(file);try{const track=await input.getPrimaryVideoTrack();if(!track)return {thumbs:[],report:{frames:0}};const n=clamp(Math.round(options.count)||8,1,24),width=clamp(Math.round(options.width)||160,32,640),sink=new B.CanvasSink(track,{width,poolSize:1}),span=Math.max(0,(options.end??await input.computeDuration())-(options.start||0)),out=[];
 function* times(){for(let i=0;i<n;i++)yield (options.start||0)+span*(i+.5)/n;}
 for await(const frame of sink.canvasesAtTimestamps(times())){check();if(frame)out.push({at:frame.timestamp,blob:await frame.canvas.convertToBlob({type:'image/jpeg',quality:.6})});}
 return {thumbs:out,report:{frames:out.length,width}};}finally{input.dispose();}}
/** Byte output for encoders without a Mediabunny target: an OPFS file when available, otherwise Blob
 * parts consolidated every 8 MiB so encoded bytes leave the JS heap instead of accumulating there. */
async function byteStore(name,type){
 if(name&&navigator.storage?.getDirectory){try{
  const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle(name,{create:true}),writer=await handle.createWritable();let closed=false;
  return {backend:'opfs',write:bytes=>writer.write(bytes),finish:async()=>{await writer.close();closed=true;return {blob:new Blob([await handle.getFile()],{type}),temp:name};},
   cleanup:async()=>{if(!closed)await writer.abort().catch(()=>{});await root.removeEntry(name).catch(()=>{});}};
 }catch(e){if(e.name==='QuotaExceededError')throw Error('Temporary storage is full. Free browser storage or use a shorter section.');}}
 let blob=new Blob([]),parts=[],pending=0;
 return {backend:'memory',write:bytes=>{parts.push(bytes);pending+=bytes.length;if(pending>=8*1024**2){blob=new Blob([blob,...parts]);parts=[];pending=0;}},finish:async()=>({blob:new Blob([blob,...parts],{type})}),cleanup:async()=>{}};
}
/** GIF plan: speed changes which source instants are sampled, never the frame delay, so a
 * 2x GIF is half as long at the same smoothness. */
function gifPlan(options){
 const speed=clamp(Number(options.speed)||1,.25,4),fps=clamp(Math.round(Number(options.fps)||12),1,60),span=options.end-options.start;
 if(!(span>0))throw Error('Invalid GIF interval.');
 const total=clamp(Math.round(span/speed*fps),1,3000);
 return {speed,fps,total,width:clamp(Math.round(Number(options.width)||640),16,4096),colors:clamp(Math.round(Number(options.colors)||256),2,256),dither:clamp(Number(options.dither)||0,0,1)};
}
/** Decodes the planned instants once, ascending, and hands each frame's pixels to `each`. */
async function gifFrames(file,options,plan,each){
 const input=inputOf(file);
 try{
  const track=await input.getPrimaryVideoTrack();if(!track)throw Error('No video track.');
  const sink=new B.CanvasSink(track,{width:Math.min(await track.getDisplayWidth(),plan.width),poolSize:1});let crop,scratch=null,index=0;
  const times=plan.times||function*(){for(let i=0;i<plan.total;i++)yield options.start+i*plan.speed/plan.fps;};
  for await(const frame of sink.canvasesAtTimestamps(times())){
   check();if(!frame)throw Error('No decoded video frame.');
   let c=frame.canvas;
   if(crop===undefined)crop=cropRect(c.width,c.height,options.crop);
   if(crop){scratch??=new OffscreenCanvas(crop.width,crop.height);scratch.getContext('2d').drawImage(c,crop.left,crop.top,crop.width,crop.height,0,0,crop.width,crop.height);c=scratch;}
   await each(c.getContext('2d').getImageData(0,0,c.width,c.height).data,c.width,c.height,index++);
  }
  if(!index)throw Error('No decoded video frame.');
 }finally{input.dispose();}
}
async function gifPass(file,options,plan,temp,label){
 const {GIFEncoder,quantize,applyPalette}=await import('../assets/vendor/gifenc-1.0.3/gifenc.esm.js');
 const store=await byteStore(temp,'image/gif'),encoder=GIFEncoder({auto:false}),delay=n=>Math.round((n+1)*100/plan.fps)*10-Math.round(n*100/plan.fps)*10;
 let success=false,size={w:0,h:0},held=[],bytes=0;
 try{
  await gifFrames(file,options,plan,async(rgba,w,h,i)=>{
   size={w,h};const palette=quantize(rgba,plan.colors);let data=rgba;
   if(plan.dither){const {quantizePerceptual}=await import('./pixel-engine.js');data=quantizePerceptual(rgba,w,h,palette.length,plan.dither,{palette,ditherMode:'floyd-steinberg'});}
   const index=applyPalette(data,palette);
   if(options.reverse){bytes+=index.length;if(bytes>64*1024**2)throw Error('Reversed GIFs are held in memory while they are built. Use a shorter section or a smaller width.');held.push({index,palette});}
   else{if(i===0)encoder.writeHeader();encoder.writeFrame(index,w,h,{palette,first:i===0,delay:delay(i),repeat:options.loop===false?-1:0});await store.write(encoder.bytes());encoder.reset();}
   progress(`GIF frame ${i+1} / ${plan.total}${label}`,(i+1)/plan.total);
  });
  if(options.reverse){held.reverse();encoder.writeHeader();
   for(let i=0;i<held.length;i++){encoder.writeFrame(held[i].index,size.w,size.h,{palette:held[i].palette,first:i===0,delay:delay(i),repeat:options.loop===false?-1:0});await store.write(encoder.bytes());encoder.reset();held[i]=null;}}
  encoder.finish();await store.write(encoder.bytes());
  const {blob,temp:stored}=await store.finish();success=true;return {blob,temp:stored,store,...size};
 }finally{held=null;if(!success)await store.cleanup();}
}
/** How much smaller the next GIF pass must be, spent on the cheapest quality first: a coarser
 * palette (measures ~18% for 256→64), then frame rate and frame size together, because GIF
 * bytes scale with frames × pixels. */
function shrinkGif(plan,bytes,budget){
 let need=budget*.9/bytes,colors=plan.colors,{width,fps}=plan;
 if(colors>64){colors=64;need/=.82;}else if(colors>32){colors=32;need/=.9;}
 if(need<1){const k=clamp(Math.cbrt(need),.4,.97);width=Math.max(120,Math.round(width*k));fps=Math.max(5,Math.round(fps*k));}
 return {colors,width,fps};
}
async function gif(file,options,temp){
 const started=performance.now(),budget=Number(options.targetMB)>0?Number(options.targetMB)*1024**2:0;
 let plan=gifPlan(options),out=null,attempts=[],pass=0;
 try{
  // A three-frame estimate first, so a size target usually costs one encode instead of four.
  if(budget){const {report}=await gifEstimate(file,{...options,...plan});attempts.push({bytes:report.bytes,estimate:true,colors:plan.colors,fps:plan.fps,width:plan.width});if(report.bytes>budget)plan=gifPlan({...options,...plan,...shrinkGif(plan,report.bytes,budget)});}
  for(pass=1;;pass++){
   const made=await gifPass(file,options,plan,`${temp}-${pass}`,budget?` · pass ${pass}`:'');
   if(!budget||made.blob.size<=budget||pass>=4){out=made;break;}
   attempts.push({bytes:made.blob.size,colors:plan.colors,fps:plan.fps,width:plan.width});
   await made.store.cleanup();
   plan=gifPlan({...options,...plan,...shrinkGif(plan,made.blob.size,budget)});
  }
  const report={engine:'WebCodecs / gifenc',frames:plan.total,width:out.w,height:out.h,fps:plan.fps,colors:plan.colors,speed:plan.speed,reversed:!!options.reverse,loop:options.loop!==false,elapsedMs:performance.now()-started,outputBytes:out.blob.size,targetMB:options.targetMB||0,targetMet:budget?out.blob.size<=budget:null,passes:pass,attempts,streamingFrames:!options.reverse,streamingOutput:out.store.backend==='opfs',outputBackend:out.store.backend};
  const result={blob:out.blob,temp:out.temp,report};out=null;return result;
 }finally{if(out)await out.store.cleanup();}
}
/** Size estimate before a run: three real encoded frames, extrapolated over the planned count. */
async function gifEstimate(file,options){
 const {GIFEncoder,quantize,applyPalette}=await import('../assets/vendor/gifenc-1.0.3/gifenc.esm.js');
 const plan=gifPlan(options),samples=Math.min(3,plan.total),encoder=GIFEncoder({auto:false});let bytes=0,size={w:0,h:0};
 const times=function*(){for(let i=0;i<samples;i++)yield options.start+(plan.total>1?(plan.total-1)*i/Math.max(1,samples-1):0)*plan.speed/plan.fps;};
 await gifFrames(file,options,{...plan,times},async(rgba,w,h,i)=>{
  size={w,h};const palette=quantize(rgba,plan.colors),index=applyPalette(rgba,palette);
  if(i===0)encoder.writeHeader();encoder.writeFrame(index,w,h,{palette,first:i===0,delay:10});bytes+=encoder.bytes().length;encoder.reset();
 });
 return {report:{bytes:Math.round(800+bytes/samples*plan.total),frames:plan.total,width:size.w,height:size.h,fps:plan.fps,colors:plan.colors,sampled:samples,estimate:true}};
}
self.onmessage=async({data})=>{if(data.action==='cancel'){canceled=true;await conversion?.cancel();return;}canceled=false;try{const result=data.action==='probe'?await probe(data.file):data.action==='frame'?await extract(data.file,data.options):data.action==='thumbs'?await thumbs(data.file,data.options):data.action==='estimate'?await gifEstimate(data.file,data.options):data.action==='gif'?await gif(data.file,data.options,data.temp):await convert(data.file,data.options,data.temp);postMessage({result});}catch(e){postMessage({error:e.message,name:canceled?'AbortError':e.name});}};
