/** Full-canvas GIF89a export with one palette for every frame. GIF has binary transparency and
 * centisecond delays; callers must show those limits before offering the download. */
import {paletteFromFrames,quantizeFrames} from './converter.js';

export async function encodePixelGIF(frames,{durations=[],loop=true,palette=null}={}){
 if(!frames.length||frames.length>4096)throw Error('GIF needs 1–4096 frames');
 const {width,height}=frames[0];
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||frames.length*width*height>268e6)throw Error('GIF dimensions exceed the frame budget');
 if(frames.some(f=>f.width!==width||f.height!==height||f.data.length!==width*height*4))throw Error('GIF frames must share a canvas');
 const transparent=frames.some(f=>{for(let i=3;i<f.data.length;i+=4)if(f.data[i]<128)return true;return false;});
 const colors=palette?.length?palette.map(c=>c.slice(0,3)):paletteFromFrames(frames,transparent?255:256);
 if(colors.length>256-(transparent?1:0))throw Error('GIF palette exceeds 256 entries');
 const pal=transparent?[[0,0,0],...colors]:colors;
 const repeat=typeof loop==='boolean'?(loop?0:-1):Number(loop);
 if(!Number.isInteger(repeat)||repeat< -1||repeat>65535)throw Error('GIF repeat count must be -1 to 65535');
 const mapped=quantizeFrames(frames,colors,{dither:'none'});
 const {GIFEncoder}=await import('../../../assets/vendor/gifenc-1.0.3/gifenc.esm.js');
 const enc=GIFEncoder({auto:false});enc.writeHeader();
 const indexFrames=[];
 for(let f=0;f<frames.length;f++){
  const src=frames[f].data,d=mapped[f].data,idx=new Uint8Array(width*height);
  const lookup=new Map(colors.map((c,i)=>[`${c[0]},${c[1]},${c[2]}`,i+(transparent?1:0)]));
  for(let p=0;p<idx.length;p++){const i=p*4;idx[p]=transparent&&src[i+3]<128?0:lookup.get(`${d[i]},${d[i+1]},${d[i+2]}`)??0;}
  const delay=Math.max(20,Math.min(655350,Math.round((Number(durations[f])||100)/10)*10));
  enc.writeFrame(idx,width,height,{palette:pal,first:f===0,delay,repeat,transparent,transparentIndex:0,dispose:2});
  indexFrames.push(idx);
 }
 enc.finish();return {bytes:enc.bytes(),palette:pal,indices:indexFrames,transparent,repeat};
}
