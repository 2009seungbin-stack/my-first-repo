import {renderLogical} from './render.js';
import {encodeBlinkGif} from './gif.js';

function canvasFromLogical(state,size){
 const logical=renderLogical(state),source=new OffscreenCanvas(16,16);
 source.getContext('2d').putImageData(new ImageData(logical.data,16,16),0,0);
 const output=new OffscreenCanvas(size,size),ctx=output.getContext('2d');
 ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0,size,size);
 return output;
}
function cardCanvas(state){
 const canvas=new OffscreenCanvas(1200,630),ctx=canvas.getContext('2d');
 ctx.fillStyle='#172b43';ctx.fillRect(0,0,1200,630);
 ctx.fillStyle='#24445a';ctx.fillRect(54,72,440,486);
 ctx.imageSmoothingEnabled=false;ctx.drawImage(canvasFromLogical(state,320),114,155);
 ctx.fillStyle='#f8e7c5';ctx.font='bold 62px system-ui,sans-serif';ctx.fillText('PIXEL AVATAR',550,260);
 ctx.fillStyle='#a5d5d1';ctx.font='34px system-ui,sans-serif';ctx.fillText('Made locally with Nerulio',554,322);
 ctx.fillStyle='#d0dce4';ctx.font='26px system-ui,sans-serif';ctx.fillText('Original CC0 parts · 16 px grid',554,388);
 return canvas;
}

self.onmessage=async event=>{
 const {id,kind,state,size=256,delay=125}=event.data||{};
 try{
  self.postMessage({id,type:'progress',phase:'render'});
  let blob;
  if(kind==='gif'){
   const result=encodeBlinkGif(state,{size,delay});
   blob=new Blob([result.bytes],{type:'image/gif'});
  }else if(kind==='card'){
   blob=await cardCanvas(state).convertToBlob({type:'image/png'});
  }else if(kind==='png'){
   if(!Number.isInteger(size)||size<32||size>4096||size%16)throw new RangeError('Invalid PNG size');
   blob=await canvasFromLogical(state,size).convertToBlob({type:'image/png'});
  }else throw new RangeError('Unknown export type');
  self.postMessage({id,type:'result',blob});
 }catch(error){self.postMessage({id,type:'error',message:error?.message||String(error)});}
};
