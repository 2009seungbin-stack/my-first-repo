/** Minimal in-memory Cloudflare R2 bucket binding for tests and the local platform dev server: the subset
 * server/platform/uploads.js uses (put, get, head, delete of one key or a list). Real R2 is never contacted. */
export class R2Shim{
 constructor(){this.objects=new Map();this.puts=0;this.deletes=0;}
 async put(key,value,options={}){
  const bytes=value instanceof Uint8Array?new Uint8Array(value):new Uint8Array(await new Response(value).arrayBuffer());
  this.objects.set(key,{bytes,httpMetadata:{...(options.httpMetadata||{})},customMetadata:{...(options.customMetadata||{})}});this.puts++;
  return {key,size:bytes.length};
 }
 async head(key){const o=this.objects.get(key);return o?{key,size:o.bytes.length,httpMetadata:o.httpMetadata}:null;}
 async get(key){
  const o=this.objects.get(key);if(!o)return null;
  return {key,size:o.bytes.length,httpMetadata:o.httpMetadata,customMetadata:o.customMetadata,
   get body(){return new Response(o.bytes).body;},arrayBuffer:async()=>o.bytes.buffer.slice(o.bytes.byteOffset,o.bytes.byteOffset+o.bytes.byteLength)};
 }
 async delete(keys){for(const k of Array.isArray(keys)?keys:[keys]){if(this.objects.delete(k))this.deletes++;}}
}
