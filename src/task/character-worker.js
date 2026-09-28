import {countText,quickCountText} from './character-core.js';
self.onmessage=e=>{const {revision,text,settings}=e.data;
 try{const start=performance.now(),quick=quickCountText(text,settings.locale);self.postMessage({revision,quick,quickMs:performance.now()-start});
  const fullStart=performance.now(),result=countText(text,settings,quick);self.postMessage({revision,result,workerMs:performance.now()-fullStart});
 }catch(error){self.postMessage({revision,error:String(error?.message||error)});}
};
