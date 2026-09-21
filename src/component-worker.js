import {ComponentScan} from './component-scan.js';
let scan;
self.onmessage=({data:m})=>{try{if(m.start){scan=new ComponentScan(m.width,m.options);return;}const result=m.finish?scan.finish():scan.rows(new Uint8ClampedArray(m.buffer),m.height);postMessage({result});}catch(e){postMessage({error:e.message});}};
