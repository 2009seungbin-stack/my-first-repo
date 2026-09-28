import {buildPack} from './render.js';
self.onmessage=async({data})=>{
 try{const result=await buildPack({artFile:data.artFile,logoFile:data.logoFile,rawSettings:data.settings,onProgress:p=>self.postMessage({id:data.id,progress:p})});self.postMessage({id:data.id,ok:true,archive:result.archive,report:result.report});}
 catch(e){self.postMessage({id:data.id,ok:false,error:String(e?.message||e)});}
};
