import * as Im from './image.js';
import {abort} from './resources.js';
/** Immutable, in-memory transform graph. Original File bytes are never modified. */
export function appendOperation(current,operation){
 const source=current.document?current.source:current;
 const operations=[...(current.document?current.operations:[]),structuredClone(operation)];
 return Object.freeze({document:true,source,operations:Object.freeze(operations),size:source.size,name:source.name,type:source.type});
}
export async function renderDocument(doc,{signal,progress=()=>{}}={}){
 let c=await Im.decode(doc.source);try{
  for(let i=0;i<doc.operations.length;i++){
   abort(signal);const op=doc.operations[i];progress(`Processing · ${i+1} / ${doc.operations.length}`);let next;
   if(op.type==='resize')next=await Im.resizeQuality(c,op.width,op.height,{nearest:op.nearest,signal,progress});
   else if(op.type==='crop')next=Im.crop(c,op.rect);
   else if(op.type==='rotate')next=Im.rotate(c,op.flip);
   else if(op.type==='fill')next=Im.background(c,op.color);
   else if(op.type==='trim')next=await Im.trimAsync(c,{signal,progress});
   else throw Error('Unknown image operation');
   Im.release(c);c=next;
  }
  abort(signal);const result=c;c=null;return result;
 }finally{Im.release(c);}
}
export function retainedBlobBytes(items){
 const sources=new Set();for(const item of items)for(const b of [item.original,item.blob,...item.history])if(b)sources.add(b.document?b.source:b);
 return [...sources].reduce((n,b)=>n+b.size,0);
}
