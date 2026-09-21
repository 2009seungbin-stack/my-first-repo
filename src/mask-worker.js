import {maskBuffer,applyMaskRows} from './mask-packer.js';
import {pngRGBACompressed} from './png-stream.js';
let output,w,h,invert;
self.onmessage=async({data:m})=>{try{
 if(m.start){w=m.w;h=m.h;invert=m.invert||[];output=maskBuffer(w,h,m.mapping,invert);self.postMessage({result:true});}
 else if(m.finish){const blob=await pngRGBACompressed(output,w,h,{progress:value=>self.postMessage({progress:value})});output=null;self.postMessage({result:blob});}
 else{applyMaskRows(output,new Uint8ClampedArray(m.buffer),m.offset,m.channels,invert);self.postMessage({result:true});}
}catch(e){output=null;self.postMessage({error:e.message||String(e)});}};
