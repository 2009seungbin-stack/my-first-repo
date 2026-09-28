import {GIFEncoder} from '../../assets/vendor/gifenc-1.0.3/gifenc.esm.js';
import {renderLogical,renderMotionFrame,nearest,withLocalBackground} from './render.js';

/** Fixed eight-frame blink with an exact shared palette. No quantizer is involved. */
export function encodeAvatarGif(state,{size=256,delay=125,motion='blink',backgroundPixels=null}={}){
 if(!Number.isInteger(size)||size<32||size>1024||size%16)throw new RangeError('GIF size must be a multiple of 16 from 32 to 1024');
 if(!Number.isInteger(delay)||delay<80||delay>500)throw new RangeError('GIF frame delay must be 80–500 ms');
 if(!['blink','breathe'].includes(motion))throw new RangeError('Unknown motion');
 const logical=[backgroundPixels?withLocalBackground(state,backgroundPixels):renderLogical(state),backgroundPixels?withLocalBackground(state,backgroundPixels,motion):renderMotionFrame(state,motion)];
 const palette=[[0,0,0]],lookup=new Map();
 for(const frame of logical)for(let i=0;i<frame.data.length;i+=4){
  if(frame.data[i+3]<128)continue;
  const key=(frame.data[i]<<16)|(frame.data[i+1]<<8)|frame.data[i+2];
  if(!lookup.has(key)){
   if(palette.length>=256)throw new RangeError('GIF palette exceeds 256 colors');
   lookup.set(key,palette.length);palette.push([frame.data[i],frame.data[i+1],frame.data[i+2]]);
  }
 }
 const gif=GIFEncoder();
 for(let frameNo=0;frameNo<8;frameNo++){
  const active=motion==='blink'?(frameNo===3||frameNo===4):(frameNo>=2&&frameNo<=5);
  const image=nearest(logical[active?1:0],size),indexes=new Uint8Array(size*size);
  for(let i=0,j=0;i<image.data.length;i+=4,j++){
   if(image.data[i+3]<128)continue;
   const key=(image.data[i]<<16)|(image.data[i+1]<<8)|image.data[i+2];
   indexes[j]=lookup.get(key);
  }
  gif.writeFrame(indexes,size,size,{palette,transparent:true,transparentIndex:0,delay,repeat:0,dispose:2});
 }
 gif.finish();
 return {bytes:gif.bytes(),palette,frames:8,delay};
}
export const encodeBlinkGif=(state,options={})=>encodeAvatarGif(state,{...options,motion:'blink'});
