import {countText} from './character-core.js';
self.onmessage=e=>{const {revision,text,settings}=e.data;
 try{self.postMessage({revision,result:countText(text,settings)});}catch(error){self.postMessage({revision,error:String(error?.message||error)});}
};
