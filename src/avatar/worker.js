import {renderLogical,withLocalBackground} from './render.js';
import {encodeAvatarGif} from './gif.js';

async function localPixels(blob){
 if(!blob)return null;
 const bitmap=await createImageBitmap(blob);
 try{
  if(bitmap.width>8192||bitmap.height>8192)throw new RangeError('Background exceeds 8192 pixels per side');
  const canvas=new OffscreenCanvas(16,16),ctx=canvas.getContext('2d');
  const scale=Math.max(16/bitmap.width,16/bitmap.height),w=bitmap.width*scale,h=bitmap.height*scale;
  ctx.drawImage(bitmap,(16-w)/2,(16-h)/2,w,h);
  return ctx.getImageData(0,0,16,16).data;
 }finally{bitmap.close();}
}
function canvasFromLogical(state,size,backgroundPixels){
 const logical=backgroundPixels?withLocalBackground(state,backgroundPixels):renderLogical(state),source=new OffscreenCanvas(16,16);
 source.getContext('2d').putImageData(new ImageData(logical.data,16,16),0,0);
 const output=new OffscreenCanvas(size,size),ctx=output.getContext('2d');
 ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0,size,size);
 return output;
}
function cardCanvas(state,backgroundPixels,locale){
 const canvas=new OffscreenCanvas(1200,630),ctx=canvas.getContext('2d');
 ctx.fillStyle='#172b43';ctx.fillRect(0,0,1200,630);
 ctx.fillStyle='#24445a';ctx.fillRect(54,72,440,486);
 ctx.imageSmoothingEnabled=false;ctx.drawImage(canvasFromLogical(state,320,backgroundPixels),114,155);
 const copy={en:['PIXEL AVATAR','Made locally with Nerulio','Original CC0 parts · 16 px grid'],ko:['픽셀 아바타','Nerulio에서 로컬 제작','오리지널 CC0 파츠 · 16px 격자'],ja:['ピクセルアバター','Nerulioで端末内制作','オリジナルCC0パーツ · 16pxグリッド']}[locale]||['PIXEL AVATAR','Made locally with Nerulio','Original CC0 parts · 16 px grid'];
 ctx.fillStyle='#f8e7c5';ctx.font='bold 60px system-ui,sans-serif';ctx.fillText(copy[0],550,260);
 ctx.fillStyle='#a5d5d1';ctx.font='32px system-ui,sans-serif';ctx.fillText(copy[1],554,322);
 ctx.fillStyle='#d0dce4';ctx.font='26px system-ui,sans-serif';ctx.fillText(copy[2],554,388);
 return canvas;
}

self.onmessage=async event=>{
 const {id,kind,state,size=256,delay=125,motion='blink',background=null,locale='en'}=event.data||{};
 try{
  self.postMessage({id,type:'progress',phase:'render'});
  const backgroundPixels=await localPixels(background);
  let blob;
  if(kind==='gif'){
   const result=encodeAvatarGif(state,{size,delay,motion,backgroundPixels});
   blob=new Blob([result.bytes],{type:'image/gif'});
  }else if(kind==='card'){
   blob=await cardCanvas(state,backgroundPixels,locale).convertToBlob({type:'image/png'});
  }else if(kind==='png'){
   if(!Number.isInteger(size)||size<32||size>4096||size%16)throw new RangeError('Invalid PNG size');
   blob=await canvasFromLogical(state,size,backgroundPixels).convertToBlob({type:'image/png'});
  }else throw new RangeError('Unknown export type');
  self.postMessage({id,type:'result',blob});
 }catch(error){self.postMessage({id,type:'error',message:error?.message||String(error)});}
};
