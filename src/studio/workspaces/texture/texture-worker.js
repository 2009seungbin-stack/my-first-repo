/** Texture workspace worker: the pixel work (src/game/normals/*) off the main thread. Pictures
 * are sent once per key and kept (a few), so a slider move only sends parameters. */
import {generate,occlusionMap,normalizeParams} from '../../../game/normals/pipeline.js';
import {detectConvention} from '../../../game/normals/convention.js';
import {cavity,curvature,roughnessFromAlbedo,specularFromAlbedo} from '../../../game/normals/maps.js';
import {roll,rollConsistency,seamError,normalMipChain} from '../../../game/normals/normal.js';
import {decodePNG} from '../../../game/texture-png.js';
import {decodeGrayPNG} from '../../../game/normals/png16.js';
import {validateNormalMap} from '../../../game/texture-normal.js';
import {seamMetrics} from '../../../game/texture-fix.js';
const pictures=new Map();// key → {rgba,w,h}
const keep=(key,v)=>{pictures.delete(key);pictures.set(key,v);while(pictures.size>6)pictures.delete(pictures.keys().next().value);};
const ops={
 put({key,rgba,w,h}){keep(key,{rgba:new Uint8Array(rgba),w,h});return {ok:true};},
 has({key}){return {has:pictures.has(key)};},
 generate({key,regions,params,strokes,heightPlane,ao}){
  const p=pictures.get(key);if(!p)throw Error('missing picture '+key);
  const t0=performance.now(),g=generate(p.rgba,p.w,p.h,params,{regions,strokes,heightPlane});
  const out={height:g.height,base:g.base,normal:g.normal,mask:g.mask,params:g.params,ms:0};
  if(ao)out.ao=occlusionMap(g.height,p.w,p.h,g.params,{regions:g.regions,mask:g.mask});
  out.ms=Math.round(performance.now()-t0);
  return out;
 },
 ao({height,w,h,params,regions,mask}){return {ao:occlusionMap(height,w,h,params,{regions,mask})};},
 maps({key,height,params,regions,which}){
  const p=pictures.get(key);if(!p)throw Error('missing picture '+key);const P=normalizeParams(params),e=P.normal.edge;
  const out={};
  if(which.includes('cavity'))out.cavity=cavity(height,p.w,p.h,{radius:3,gain:Math.max(.25,P.bevel.depth/4),edge:e});
  if(which.includes('curvature'))out.curvature=curvature(height,p.w,p.h,{gain:1,edge:e});
  if(which.includes('roughness'))out.roughness=roughnessFromAlbedo(p.rgba,p.w,p.h);
  if(which.includes('specular'))out.specular=specularFromAlbedo(p.rgba,p.w,p.h);
  return out;
 },
 detect({rgba,w,h,key}){
  const src=rgba?new Uint8Array(rgba):pictures.get(key)?.rgba;if(!src)throw Error('nothing to inspect');
  const W=w??pictures.get(key).w,H=h??pictures.get(key).h;
  return {detect:detectConvention(src,W,H),valid:validateNormalMap(src,W,H,{maxSamples:400000})};
 },
 /** Wrap-correctness of the generated normal map on this picture: generate, generate from the
  * picture rolled by half, roll back, compare the border band. Also the albedo's own seam. */
 seam({key,params,normal}){
  const p=pictures.get(key);if(!p)throw Error('missing picture '+key);const {w,h,rgba}=p;
  const dx=w>>1,dy=h>>1,rolled=roll(rgba,w,h,dx,dy),b=roll(generate(rolled,w,h,params).normal,w,h,-dx,-dy);
  return {roll:rollConsistency(normal,b,w,h,{band:2}),normalSeam:seamError(normal,w,h),albedoSeam:seamMetrics(rgba,w,h)};
 },
 mips({normal,w,h,levels}){return {chain:normalMipChain(normal,w,h,{levels})};},
 async decode({bytes}){
  const u=new Uint8Array(bytes),img=await decodePNG(u,{maxPixels:268e6});let gray=null;
  if(img.depth===16&&(img.colorType===0||img.colorType===4)){const g=await decodeGrayPNG(u);if(g)gray={samples:g.samples,max:65535,depth:16};}
  return {width:img.width,height:img.height,data:img.data,depth:img.depth,colorType:img.colorType,gray};
 }
};
const transfers=v=>{const out=[];const walk=x=>{if(!x||typeof x!=='object')return;if(ArrayBuffer.isView(x)){if(!out.includes(x.buffer))out.push(x.buffer);return;}if(Array.isArray(x))x.forEach(walk);else for(const k of Object.keys(x))walk(x[k]);};walk(v);return out;};
self.onmessage=async({data})=>{
 try{const result=await ops[data.op](data);self.postMessage({id:data.id,ok:true,result},transfers(result));}
 catch(e){self.postMessage({id:data.id,ok:false,error:String(e?.message||e)});}
};
