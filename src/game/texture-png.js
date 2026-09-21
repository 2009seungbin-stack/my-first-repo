import {crc32} from '../core.js';
import {pngRGBACompressed} from '../png-stream.js';
/** Raw PNG in and out, because a canvas cannot be trusted with channel bytes: browsers keep
 * canvas pixels premultiplied, so RGB under alpha 0 comes back as 0 and packed masks lose a
 * channel. Everything in Texture Lab that must be byte-exact goes through here; only previews
 * and non-PNG inputs go through the canvas. No DOM: usable in a worker and in node:test. */
export const MAX_TEXTURE_PIXELS=67_108_864;
const SIGNATURE=[137,80,78,71,13,10,26,10];
const BYTES_PER_PIXEL=Object.freeze({0:1,2:3,3:1,4:2,6:4});
export const isPNG=bytes=>bytes.length>8&&SIGNATURE.every((v,i)=>bytes[i]===v);
/** Chunk walk with length/CRC validation: a truncated or edited file fails here, not later. */
export function pngChunks(bytes){
 if(!isPNG(bytes))throw Error('Not a PNG file');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=[];
 for(let at=8;at+8<=bytes.length;){
  const length=view.getUint32(at);
  if(length>0x7fffffff||at+12+length>bytes.length)throw Error('Truncated PNG chunk');
  const type=String.fromCharCode(bytes[at+4],bytes[at+5],bytes[at+6],bytes[at+7]);
  if(crc32(bytes.subarray(at+4,at+8+length))!==view.getUint32(at+8+length))throw Error(`PNG chunk ${type} failed its CRC`);
  out.push({type,data:bytes.subarray(at+8,at+8+length)});at+=12+length;
  if(type==='IEND')break;
 }
 if(!out.length||out[0].type!=='IHDR')throw Error('PNG is missing its header');
 return out;
}
async function inflate(parts){
 const stream=new DecompressionStream('deflate'),writer=stream.writable.getWriter(),reader=stream.readable.getReader(),blocks=[];
 let total=0;
 const read=(async()=>{for(;;){const {value,done}=await reader.read();if(done)break;blocks.push(value);total+=value.length;}})();
 for(const part of parts)await writer.write(part);
 await writer.close();await read;
 const out=new Uint8Array(total);let at=0;for(const block of blocks){out.set(block,at);at+=block.length;}
 return out;
}
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
/** PNG scanline filters are reversed in place, one row at a time, into the row store itself. */
function unfilter(raw,width,height,bpp,stride){
 const out=new Uint8Array(height*stride);
 for(let y=0,at=0;y<height;y++){
  const filter=raw[at++],row=y*stride,prev=row-stride;
  if(at+stride>raw.length)throw Error('PNG pixel data is shorter than its header promises');
  out.set(raw.subarray(at,at+stride),row);at+=stride;
  if(filter===0)continue;
  for(let i=0;i<stride;i++){
   const left=i>=bpp?out[row+i-bpp]:0,up=y?out[prev+i]:0,upLeft=y&&i>=bpp?out[prev+i-bpp]:0;
   out[row+i]=filter===1?out[row+i]+left:filter===2?out[row+i]+up:filter===3?out[row+i]+((left+up)>>1):filter===4?out[row+i]+paeth(left,up,upLeft):(()=>{throw Error(`Unsupported PNG filter ${filter}`);})();
  }
 }
 return out;
}
/** Raw integer samples of one scanline, still at the file's own bit depth. */
function rowSamples(row,count,depth){
 const out=new Uint16Array(count);
 if(depth===8)for(let i=0;i<count;i++)out[i]=row[i];
 else if(depth===16)for(let i=0;i<count;i++)out[i]=row[i*2]<<8|row[i*2+1];
 else{const perByte=8/depth,mask=(1<<depth)-1;for(let i=0;i<count;i++)out[i]=(row[Math.floor(i/perByte)]>>(8-depth*(i%perByte+1)))&mask;}
 return out;
}
/** Expands one row of any supported colour type / bit depth into exact 8-bit RGBA.
 * 16-bit samples keep their high byte (the rest of the pipeline is 8-bit); palette entries and
 * tRNS transparency are applied verbatim, so RGB under alpha 0 survives. */
function expandRow(row,width,{colorType,depth,palette,trns}){
 const channels=BYTES_PER_PIXEL[colorType],raw=rowSamples(row,width*channels,depth),out=new Uint8Array(width*4);
 const mask=(1<<depth)-1,to8=v=>depth===16?v>>8:depth===8?v:Math.round(v*255/mask);
 for(let x=0;x<width;x++){
  const s=x*channels;
  if(colorType===0){const v=to8(raw[s]);out.set([v,v,v,trns?.gray===raw[s]?0:255],x*4);}
  else if(colorType===2)out.set([to8(raw[s]),to8(raw[s+1]),to8(raw[s+2]),trns?.rgb&&trns.rgb.every((v,c)=>v===raw[s+c])?0:255],x*4);
  else if(colorType===3){const i=raw[s];if(i*3+2>=palette.length)throw Error('PNG palette index is out of range');out.set([palette[i*3],palette[i*3+1],palette[i*3+2],trns?.[i]??255],x*4);}
  else if(colorType===4){const v=to8(raw[s]);out.set([v,v,v,to8(raw[s+1])],x*4);}
  else out.set([to8(raw[s]),to8(raw[s+1]),to8(raw[s+2]),to8(raw[s+3])],x*4);
 }
 return out;
}
/** Decoded PNG: {width,height,data (RGBA, exact), colorType, depth, interlaced:false,
 * hadAlphaChannel, srgb, gamma}. Interlaced files are rejected rather than silently approximated. */
export async function decodePNG(source,{maxPixels=MAX_TEXTURE_PIXELS}={}){
 const bytes=source instanceof Uint8Array?source:new Uint8Array(source);
 const chunks=pngChunks(bytes),header=new DataView(chunks[0].data.buffer,chunks[0].data.byteOffset,chunks[0].data.byteLength);
 const width=header.getUint32(0),height=header.getUint32(4),depth=chunks[0].data[8],colorType=chunks[0].data[9],interlace=chunks[0].data[12];
 if(!width||!height)throw Error('PNG has no pixels');
 if(width*height>maxPixels)throw Error(`This PNG is ${width}×${height}; the exact-byte path is limited to ${maxPixels} pixels`);
 if(!BYTES_PER_PIXEL[colorType])throw Error(`Unsupported PNG colour type ${colorType}`);
 if(![1,2,4,8,16].includes(depth)||depth<8&&![0,3].includes(colorType))throw Error(`Unsupported PNG bit depth ${depth}`);
 if(interlace)throw Error('Interlaced (Adam7) PNG is not supported by the exact-byte path. Re-save without interlacing.');
 let palette=null,trns=null,srgb=false,gamma=null;const idat=[];
 for(const {type,data} of chunks){
  if(type==='PLTE')palette=data;
  else if(type==='IDAT')idat.push(data);
  else if(type==='sRGB')srgb=true;
  else if(type==='gAMA')gamma=new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(0)/100000;
  else if(type==='tRNS')trns=colorType===3?data:colorType===0?{gray:data[0]<<8|data[1]}:{rgb:[data[0]<<8|data[1],data[2]<<8|data[3],data[4]<<8|data[5]]};
 }
 if(!idat.length)throw Error('PNG has no image data');
 if(colorType===3&&!palette)throw Error('Indexed PNG without a palette');
 const samples=BYTES_PER_PIXEL[colorType],bpp=Math.max(1,Math.ceil(samples*depth/8)),stride=Math.ceil(width*samples*depth/8);
 const rows=unfilter(await inflate(idat),width,height,bpp,stride),data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)data.set(expandRow(rows.subarray(y*stride,(y+1)*stride),width,{colorType,depth,palette,trns}),y*width*4);
 return {width,height,data,colorType,depth,interlaced:false,hadAlphaChannel:colorType===4||colorType===6||!!trns,srgb,gamma};
}
const chunk=(type,data)=>{
 const out=new Uint8Array(data.length+12),view=new DataView(out.buffer);
 view.setUint32(0,data.length);out.set(new TextEncoder().encode(type),4);out.set(data,8);
 view.setUint32(out.length-4,crc32(out.subarray(4,out.length-4)));return out;
};
async function deflate(rows){
 const stream=new CompressionStream('deflate'),writer=stream.writable.getWriter(),reader=stream.readable.getReader(),parts=[];
 const read=(async()=>{for(;;){const {value,done}=await reader.read();if(done)break;parts.push(value);}})();
 for(const row of rows)await writer.write(row);
 await writer.close();await read;return parts;
}
/** Greyscale (colour type 0) PNG from one channel plane: one byte per pixel, no colour
 * conversion, so an unpacked channel re-opens as the very bytes that were in the source. */
export async function encodeGrayPNG(plane,w,h){
 if(plane.length!==w*h)throw Error('Plane size does not match the image');
 const header=new Uint8Array(13),view=new DataView(header.buffer);
 view.setUint32(0,w);view.setUint32(4,h);header.set([8,0,0,0,0],8);
 const rows=[];for(let y=0;y<h;y++){const row=new Uint8Array(w+1);row.set(plane.subarray(y*w,(y+1)*w),1);rows.push(row);}
 return new Blob([new Uint8Array(SIGNATURE),chunk('IHDR',header),...(await deflate(rows)).map(part=>chunk('IDAT',part)),chunk('IEND',new Uint8Array())],{type:'image/png'});
}
/** Exact RGBA PNG (keeps RGB under alpha 0); the streamed encoder is shared with mask packing. */
export const encodeRGBAPNG=(data,w,h,options={})=>pngRGBACompressed(data,w,h,options);
