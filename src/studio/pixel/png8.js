/** Indexed PNG (colour type 3) in and out, pure JS (no canvas: a canvas would expand the palette
 * and premultiply). The Pixel workspace stores the cels of an INDEXED sprite as 8-bit indexed PNGs
 * whose PLTE/tRNS is the sprite palette, so the index of every pixel survives autosave, .nerulio
 * files and every other workspace (which decode them to the same RGBA as always).
 * The transparent index is written with alpha 0 in tRNS. */
import {crc32} from '../../core.js';
import {pngChunks} from '../../game/texture-png.js';
import {deflateZlib,inflateZlib} from '../../game/zlib.js';
const SIG=[137,80,78,71,13,10,26,10];
function chunk(type,data){
 const out=new Uint8Array(12+data.length),v=new DataView(out.buffer);v.setUint32(0,data.length);
 for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);out.set(data,8);v.setUint32(8+data.length,crc32(out.subarray(4,8+data.length)));return out;
}
/** @param indices Uint8Array w*h  @param colors [[r,g,b,a]] 1…256  @param transparentIndex index shown as alpha 0 (or -1)
 * @returns Uint8Array PNG bytes (deterministic: same input, same bytes) */
export function encodeIndexedPNG(indices,w,h,colors,{transparentIndex=0,level=6}={}){
 if(!colors?.length||colors.length>256)throw Error('An indexed PNG needs 1…256 palette colours');
 if(indices.length!==w*h)throw Error('Index buffer does not match the size');
 const ihdr=new Uint8Array(13),v=new DataView(ihdr.buffer);v.setUint32(0,w);v.setUint32(4,h);ihdr.set([8,3,0,0,0],8);
 const plte=new Uint8Array(colors.length*3),alpha=colors.map((c,i)=>i===transparentIndex?0:(c[3]??255));
 colors.forEach((c,i)=>plte.set([c[0]&255,c[1]&255,c[2]&255],i*3));
 let last=-1;alpha.forEach((a,i)=>{if(a!==255)last=i;});
 const raw=new Uint8Array((w+1)*h);
 for(let y=0;y<h;y++){raw[y*(w+1)]=0;raw.set(indices.subarray(y*w,(y+1)*w),y*(w+1)+1);}
 const parts=[new Uint8Array(SIG),chunk('IHDR',ihdr),chunk('PLTE',plte)];
 if(last>=0)parts.push(chunk('tRNS',Uint8Array.from(alpha.slice(0,last+1))));
 parts.push(chunk('IDAT',deflateZlib(raw,{level})),chunk('IEND',new Uint8Array(0)));
 const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}
 return out;
}
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
/** Raw palette indices of an indexed PNG (any bit depth 1/2/4/8, not interlaced), with its palette
 * as [[r,g,b,a]]; null when the PNG is not colour type 3 (the caller maps RGBA instead). */
export function decodeIndexedPNG(bytes){
 const chunks=pngChunks(bytes),hd=chunks[0].data,v=new DataView(hd.buffer,hd.byteOffset,hd.byteLength);
 const w=v.getUint32(0),h=v.getUint32(4),depth=hd[8],type=hd[9],interlace=hd[12];
 if(type!==3||interlace)return null;
 let pal=null,trns=null;const idat=[];
 for(const c of chunks){if(c.type==='PLTE')pal=c.data;else if(c.type==='tRNS')trns=c.data;else if(c.type==='IDAT')idat.push(c.data);}
 if(!pal)throw Error('Indexed PNG without a palette');
 const zipped=new Uint8Array(idat.reduce((n,p)=>n+p.length,0));let at=0;for(const p of idat){zipped.set(p,at);at+=p.length;}
 const stride=Math.ceil(w*depth/8),raw=inflateZlib(zipped,{maxOutput:(stride+1)*h+16}).data,rows=new Uint8Array(stride*h);
 for(let y=0,p=0;y<h;y++){const f=raw[p++],row=y*stride;rows.set(raw.subarray(p,p+stride),row);p+=stride;
  if(f)for(let i=0;i<stride;i++){const left=i?rows[row+i-1]:0,up=y?rows[row-stride+i]:0,ul=y&&i?rows[row-stride+i-1]:0;
   rows[row+i]=(rows[row+i]+(f===1?left:f===2?up:f===3?((left+up)>>1):paeth(left,up,ul)))&255;}}
 const indices=new Uint8Array(w*h),per=8/depth,mask=(1<<depth)-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)indices[y*w+x]=depth===8?rows[y*stride+x]:(rows[y*stride+Math.floor(x/per)]>>(8-depth*(x%per+1)))&mask;
 const colors=[];for(let i=0;i<pal.length/3;i++)colors.push([pal[i*3],pal[i*3+1],pal[i*3+2],trns&&i<trns.length?trns[i]:255]);
 return {width:w,height:h,indices,colors};
}
