import {writePixelTtf} from './font-ttf.js';

self.onmessage=event=>{
 try{
  const bytes=writePixelTtf(event.data);
  self.postMessage({buffer:bytes.buffer},[bytes.buffer]);
 }catch(error){self.postMessage({error:error?.message||String(error)});}
};
