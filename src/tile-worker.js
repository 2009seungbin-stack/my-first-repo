import {processTile} from './tile-algorithms.js';
self.onmessage=({data:m})=>{try{const result=processTile(new Uint8ClampedArray(m.buffer),m.w,m.h,m);self.postMessage({result},[result.buffer]);}catch(e){self.postMessage({error:e.message});}};
