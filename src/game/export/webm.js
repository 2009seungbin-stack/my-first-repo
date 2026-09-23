/** WebM preview video: the browser's own VideoEncoder (WebCodecs, VP9 or VP8) and a minimal
 * Matroska/WebM muxer (EBML header, Segment Info, one video Track, Clusters of SimpleBlocks, Cues).
 * For sharing and marketing, NOT for engines: video is lossy and 4:2:0, so frames are scaled up by
 * an integer factor (nearest) first and composited on a solid background (VP9 alpha in WebM needs
 * BlockAdditions, which most players ignore). Frame times are the frames' own durations. */
const enc=new TextEncoder();
function vint(n){// EBML variable-size integer (data sizes)
 for(let len=1;len<=8;len++){if(n<2**(7*len)-1){const out=new Uint8Array(len);let v=n;for(let i=len-1;i>=0;i--){out[i]=v&255;v=Math.floor(v/256);}out[0]|=1<<(8-len);return out;}}
 throw Error('EBML size too large');
}
function uint(n){const b=[];do{b.unshift(n&255);n=Math.floor(n/256);}while(n>0);return new Uint8Array(b);}
function float64(v){const b=new Uint8Array(8);new DataView(b.buffer).setFloat64(0,v);return b;}
const idBytes=id=>{const b=[];while(id>0){b.unshift(id&255);id=Math.floor(id/256);}return new Uint8Array(b);};
function cat(parts){const n=parts.reduce((a,p)=>a+p.length,0),o=new Uint8Array(n);let k=0;for(const p of parts){o.set(p,k);k+=p.length;}return o;}
const el=(id,...children)=>{const body=cat(children.map(c=>typeof c==='string'?enc.encode(c):c));return cat([idBytes(id),vint(body.length),body]);};
const E={EBML:0x1A45DFA3,EBMLVersion:0x4286,EBMLReadVersion:0x42F7,EBMLMaxIDLength:0x42F2,EBMLMaxSizeLength:0x42F3,DocType:0x4282,DocTypeVersion:0x4287,DocTypeReadVersion:0x4285,
 Segment:0x18538067,Info:0x1549A966,TimecodeScale:0x2AD7B1,Duration:0x4489,MuxingApp:0x4D80,WritingApp:0x5741,
 Tracks:0x1654AE6B,TrackEntry:0xAE,TrackNumber:0xD7,TrackUID:0x73C5,TrackType:0x83,CodecID:0x86,FlagLacing:0x9C,Video:0xE0,PixelWidth:0xB0,PixelHeight:0xBA,DefaultDuration:0x23E383,
 Cluster:0x1F43B675,Timecode:0xE7,SimpleBlock:0xA3,Cues:0x1C53BB6B,CuePoint:0xBB,CueTime:0xB3,CueTrackPositions:0xB7,CueTrack:0xF7,CueClusterPosition:0xF1};
/** chunks: [{data:Uint8Array, timestampMs, key:boolean}] */
export function muxWebM(chunks,{width,height,codec='V_VP9',durationMs,app='Nerulio Studio'}){
 const header=el(E.EBML,el(E.EBMLVersion,uint(1)),el(E.EBMLReadVersion,uint(1)),el(E.EBMLMaxIDLength,uint(4)),el(E.EBMLMaxSizeLength,uint(8)),el(E.DocType,'webm'),el(E.DocTypeVersion,uint(2)),el(E.DocTypeReadVersion,uint(2)));
 const info=el(E.Info,el(E.TimecodeScale,uint(1000000)),el(E.Duration,float64(durationMs)),el(E.MuxingApp,app),el(E.WritingApp,app));
 const tracks=el(E.Tracks,el(E.TrackEntry,el(E.TrackNumber,uint(1)),el(E.TrackUID,uint(1)),el(E.TrackType,uint(1)),el(E.FlagLacing,uint(0)),el(E.CodecID,codec),el(E.Video,el(E.PixelWidth,uint(width)),el(E.PixelHeight,uint(height)))));
 // Clusters start at every key frame (and at least every 30 s, the SimpleBlock int16 limit).
 const clusters=[];let cur=null;
 for(const c of chunks){
  if(!cur||c.key||c.timestampMs-cur.t>=30000){cur={t:Math.round(c.timestampMs),blocks:[]};clusters.push(cur);}
  const rel=Math.round(c.timestampMs)-cur.t,b=new Uint8Array(4+c.data.length);
  b[0]=0x81;b[1]=(rel>>8)&255;b[2]=rel&255;b[3]=c.key?0x80:0;b.set(c.data,4);cur.blocks.push(b);
 }
 const clusterBytes=clusters.map(k=>el(E.Cluster,el(E.Timecode,uint(k.t)),...k.blocks.map(b=>el(E.SimpleBlock,b))));
 let offset=info.length+tracks.length;const cues=[];
 clusters.forEach((k,i)=>{cues.push(el(E.CuePoint,el(E.CueTime,uint(k.t)),el(E.CueTrackPositions,el(E.CueTrack,uint(1)),el(E.CueClusterPosition,uint(offset)))));offset+=clusterBytes[i].length;});
 const segment=el(E.Segment,info,tracks,...clusterBytes,el(E.Cues,...cues));
 return cat([header,segment]);
}
/** Browser only. frames: [{width,height,data RGBA,delayMs}] (same size). */
export async function encodeWebM(frames,{scale=4,background=[32,34,40],bitrate=0}={}){
 if(typeof VideoEncoder==='undefined')throw Error('This browser has no WebCodecs VideoEncoder; WebM needs Chrome, Edge or Firefox 130+.');
 const W0=frames[0].width,H0=frames[0].height;
 let k=Math.max(1,Math.floor(scale));while(k>1&&(W0*k>1920||H0*k>1920))k--;
 const W=W0*k+(W0*k%2),H=H0*k+(H0*k%2);
 const tryCodecs=[['vp09.00.10.08','V_VP9'],['vp8','V_VP8']];
 let chosen=null;
 for(const [codec,id] of tryCodecs){const cfg={codec,width:W,height:H,bitrate:bitrate||Math.max(500_000,W*H*8),framerate:30,latencyMode:'quality'};
  try{if((await VideoEncoder.isConfigSupported(cfg)).supported){chosen={cfg,id};break;}}catch{}}
 if(!chosen)throw Error('This browser cannot encode VP9 or VP8 video.');
 const chunks=[];let error=null;
 const encoder=new VideoEncoder({output:(chunk)=>{const d=new Uint8Array(chunk.byteLength);chunk.copyTo(d);chunks.push({data:d,timestampMs:chunk.timestamp/1000,key:chunk.type==='key'});},error:e=>{error=e;}});
 encoder.configure(chosen.cfg);
 let t=0;const rgba=new Uint8Array(W*H*4);
 for(let i=0;i<frames.length;i++){
  const f=frames[i];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   const sx=Math.min(W0-1,Math.floor(x/k)),sy=Math.min(H0-1,Math.floor(y/k)),s=(sy*W0+sx)*4,d=(y*W+x)*4,a=f.data[s+3]/255;
   const inside=x<W0*k&&y<H0*k;
   rgba[d]=Math.round(inside?f.data[s]*a+background[0]*(1-a):background[0]);rgba[d+1]=Math.round(inside?f.data[s+1]*a+background[1]*(1-a):background[1]);rgba[d+2]=Math.round(inside?f.data[s+2]*a+background[2]*(1-a):background[2]);rgba[d+3]=255;
  }
  const frame=new VideoFrame(rgba,{format:'RGBA',codedWidth:W,codedHeight:H,timestamp:Math.round(t*1000),duration:Math.round(f.delayMs*1000)});
  encoder.encode(frame,{keyFrame:i===0});frame.close();t+=f.delayMs;
 }
 await encoder.flush();encoder.close();
 if(error)throw error;
 return {bytes:muxWebM(chunks,{width:W,height:H,codec:chosen.id,durationMs:t}),notes:[`WebM ${chosen.id==='V_VP9'?'VP9':'VP8'} ${W}×${H} (${k}× nearest), lossy, background rgb(${background.join(',')}).`],scale:k};
}
