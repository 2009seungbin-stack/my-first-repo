// @ts-check
/** Server-side image check for community uploads (no dependencies, no decoding of pixels).
 * The browser already re-encodes every picked image (canvas → WebP, or JPEG where WebP encoding is
 * missing), which drops EXIF/GPS. This module does not trust that: it
 *  - accepts JPEG, PNG and WebP by their magic bytes only (never by the declared type or file name);
 *    GIF and animated PNG/WebP are refused (the picker turns a GIF into a still WebP of its first frame);
 *  - walks the container structure and rebuilds the file from the parts an image needs, which strips
 *    metadata (JPEG APP1 EXIF/XMP, APP13 IPTC, comments; PNG text/eXIf/tIME chunks; WebP EXIF/XMP chunks)
 *    and drops anything after the image's end marker (the classic image+ZIP/HTML polyglot);
 *  - reads the pixel size from the header and enforces the limits;
 *  - refuses files whose kept bytes still contain markup (`<script `, `<html>`, `<?php `, `<!doctype `).
 * The Worker serves the result with its own Content-Type and `nosniff`, so even a file that slipped
 * through could not be interpreted as a page. */

export const IMAGE_LIMITS=Object.freeze({maxBytes:5*1024*1024,maxSide:4096,maxPixels:4096*4096,minSide:1});
/** @typedef {{mime:'image/jpeg'|'image/png'|'image/webp',ext:'jpg'|'png'|'webp',width:number,height:number,bytes:Uint8Array,stripped:string[]}} CleanImage */
export class ImageError extends Error{
 /** @param {string} code @param {string} message */
 constructor(code,message){super(message);this.code=code;}
}
const bad=(/** @type {string} */ m)=>new ImageError('BAD_IMAGE',m);

/** @param {Uint8Array} b @returns {'jpeg'|'png'|'webp'|'gif'|null} */
export function sniff(b){
 if(b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'jpeg';
 if(b.length>=8&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47&&b[4]===0x0d&&b[5]===0x0a&&b[6]===0x1a&&b[7]===0x0a)return 'png';
 if(b.length>=12&&ascii(b,0,4)==='RIFF'&&ascii(b,8,4)==='WEBP')return 'webp';
 if(b.length>=6&&(ascii(b,0,6)==='GIF87a'||ascii(b,0,6)==='GIF89a'))return 'gif';
 return null;
}
/** @param {Uint8Array} b @param {number} o @param {number} n */
function ascii(b,o,n){let s='';for(let i=o;i<o+n&&i<b.length;i++)s+=String.fromCharCode(b[i]);return s;}
/** @param {Uint8Array[]} parts */
function concat(parts){let n=0;for(const p of parts)n+=p.length;const out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
const u16be=(/** @type {Uint8Array} */ b,/** @type {number} */ o)=>(b[o]<<8)|b[o+1];
const u32be=(/** @type {Uint8Array} */ b,/** @type {number} */ o)=>((b[o]<<24)>>>0)+(b[o+1]<<16)+(b[o+2]<<8)+b[o+3];
const u32le=(/** @type {Uint8Array} */ b,/** @type {number} */ o)=>b[o]+(b[o+1]<<8)+(b[o+2]<<16)+((b[o+3]<<24)>>>0);
const u24le=(/** @type {Uint8Array} */ b,/** @type {number} */ o)=>b[o]+(b[o+1]<<8)+(b[o+2]<<16);

/* ---------- JPEG ---------- */
/** Segments an image needs: APP0 (JFIF), APP2 (ICC profile), APP14 (Adobe colour transform), tables, frames, scans. */
const JPEG_KEEP_APP=new Set([0xe0,0xe2,0xee]);
const SOF=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
/** @param {Uint8Array} b */
function cleanJpeg(b){
 const out=[b.subarray(0,2)],stripped=[];let o=2,width=0,height=0,frames=0;
 for(;;){
  if(o+4>b.length)throw bad('JPEG ends before its image data.');
  if(b[o]!==0xff)throw bad('Broken JPEG structure.');
  let m=b[o+1];
  if(m===0xff){o++;continue;}                        // fill byte
  if(m===0xd8||m===0x01||(m>=0xd0&&m<=0xd7)){o+=2;continue;}
  if(m===0xd9)throw bad('JPEG has no image data.');
  const len=u16be(b,o+2);if(len<2||o+2+len>b.length)throw bad('Broken JPEG segment.');
  const seg=b.subarray(o,o+2+len);
  if(SOF.has(m)){height=u16be(b,o+5);width=u16be(b,o+7);frames++;}
  const app=m>=0xe0&&m<=0xef;
  if(m===0xfe||(app&&!JPEG_KEEP_APP.has(m)))stripped.push(m===0xfe?'COM':m===0xe1?'EXIF/XMP':`APP${m-0xe0}`);
  else out.push(seg);
  o+=2+len;
  if(m!==0xda)continue;
  // Entropy-coded data after a scan header: up to the next marker that is not a stuffed 0xFF00 or a restart.
  let p=o;
  for(;;){
   if(p+1>=b.length)throw bad('JPEG ends inside its image data.');
   if(b[p]===0xff){const n=b[p+1];if(n===0x00||(n>=0xd0&&n<=0xd7)||n===0xff){p+=n===0xff?1:2;continue;}break;}
   p++;
  }
  out.push(b.subarray(o,p));o=p;
  if(b[o+1]===0xd9){out.push(b.subarray(o,o+2));if(o+2<b.length)stripped.push('trailing data');break;}
 }
 if(!frames||!width||!height)throw bad('JPEG has no frame header.');
 return {bytes:concat(out),width,height,stripped};
}

/* ---------- PNG ---------- */
const PNG_KEEP=new Set(['IHDR','PLTE','IDAT','IEND','tRNS','gAMA','cHRM','sRGB','iCCP','sBIT','pHYs','bKGD']);
/** @param {Uint8Array} b */
function cleanPng(b){
 const out=[b.subarray(0,8)],stripped=[];let o=8,width=0,height=0,end=false,idat=false;
 while(o+12<=b.length){
  const len=u32be(b,o),type=ascii(b,o+4,4);
  if(len>b.length||o+12+len>b.length)throw bad('Broken PNG chunk.');
  if(!/^[A-Za-z]{4}$/.test(type))throw bad('Broken PNG chunk.');
  if(o===8&&type!=='IHDR')throw bad('PNG must start with IHDR.');
  if(type==='acTL'||type==='fcTL'||type==='fdAT')throw new ImageError('ANIMATED','Animated images are not accepted.');
  if(type==='IHDR'){width=u32be(b,o+8);height=u32be(b,o+12);}
  if(type==='IDAT')idat=true;
  if(PNG_KEEP.has(type))out.push(b.subarray(o,o+12+len));else stripped.push(type);
  o+=12+len;
  if(type==='IEND'){end=true;break;}
 }
 if(!end||!idat)throw bad('PNG ends before IEND.');
 if(o<b.length)stripped.push('trailing data');
 return {bytes:concat(out),width,height,stripped};
}

/* ---------- WebP ---------- */
/** @param {Uint8Array} b */
function cleanWebp(b){
 const riff=u32le(b,4);
 if(riff<4||riff+8>b.length)throw bad('Broken WebP header.');
 const endAt=8+riff,stripped=[],chunks=[];let o=12,width=0,height=0,vp8x=null,image=false;
 while(o+8<=endAt){
  const type=ascii(b,o,4),len=u32le(b,o+4),padded=len+(len&1);
  if(o+8+len>endAt)throw bad('Broken WebP chunk.');
  const data=b.subarray(o+8,o+8+len);
  if(type==='ANIM'||type==='ANMF')throw new ImageError('ANIMATED','Animated images are not accepted.');
  if(type==='VP8X'){if(len<10)throw bad('Broken WebP header.');if(data[0]&0x02)throw new ImageError('ANIMATED','Animated images are not accepted.');width=u24le(data,4)+1;height=u24le(data,7)+1;vp8x=b.slice(o,o+8+padded);chunks.push(vp8x);}
  else if(type==='VP8 '){if(len<10||data[3]!==0x9d||data[4]!==0x01||data[5]!==0x2a)throw bad('Broken WebP image data.');if(!vp8x){width=(data[6]|(data[7]<<8))&0x3fff;height=(data[8]|(data[9]<<8))&0x3fff;}image=true;chunks.push(b.subarray(o,Math.min(endAt,o+8+padded)));}
  else if(type==='VP8L'){if(len<5||data[0]!==0x2f)throw bad('Broken WebP image data.');if(!vp8x){const bits=data[1]|(data[2]<<8)|(data[3]<<16)|(data[4]<<24);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}image=true;chunks.push(b.subarray(o,Math.min(endAt,o+8+padded)));}
  else if(type==='ALPH'||type==='ICCP')chunks.push(b.subarray(o,Math.min(endAt,o+8+padded)));
  else stripped.push(type.trim());
  o+=8+padded;
 }
 if(!image)throw bad('WebP has no image data.');
 // The extended header's EXIF (0x08) and XMP (0x04) flags must match the chunks that are left.
 if(vp8x)vp8x[8]&=~(0x08|0x04);
 if(endAt<b.length)stripped.push('trailing data');
 const body=concat(chunks),head=new Uint8Array(12);
 head.set([0x52,0x49,0x46,0x46]);const size=body.length+4;head[4]=size&255;head[5]=(size>>8)&255;head[6]=(size>>16)&255;head[7]=(size>>>24)&255;head.set([0x57,0x45,0x42,0x50],8);
 return {bytes:concat([head,body]),width,height,stripped};
}

// Long tokens with a delimiter, so random compressed bytes practically never match (about 1e-6 per 5 MB).
const MARKUP=/<(script|html|body|iframe|\?php)[\s>]|<!doctype\s/i;
/** Latin-1 view for the markup scan (one char per byte). @param {Uint8Array} b */
function latin1(b){let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return s;}

/**
 * Validate and clean one uploaded image. Throws ImageError (code BAD_IMAGE, UNSUPPORTED, ANIMATED,
 * TOO_LARGE, TOO_BIG_DIMENSIONS, MARKUP).
 * @param {Uint8Array} input @param {{maxBytes?:number,maxSide?:number,maxPixels?:number}} [o] @returns {CleanImage}
 */
export function cleanImage(input,o={}){
 const maxBytes=o.maxBytes??IMAGE_LIMITS.maxBytes,maxSide=o.maxSide??IMAGE_LIMITS.maxSide,maxPixels=o.maxPixels??IMAGE_LIMITS.maxPixels;
 if(!input||!input.length)throw bad('Empty file.');
 if(input.length>maxBytes)throw new ImageError('TOO_LARGE',`Images must be at most ${Math.round(maxBytes/1048576)} MB.`);
 const kind=sniff(input);
 if(kind==='gif')throw new ImageError('UNSUPPORTED','GIF files are not accepted; the picker converts them to a still image.');
 if(!kind)throw new ImageError('UNSUPPORTED','Only JPEG, PNG and WebP images are accepted.');
 const r=kind==='jpeg'?cleanJpeg(input):kind==='png'?cleanPng(input):cleanWebp(input);
 if(r.width<IMAGE_LIMITS.minSide||r.height<IMAGE_LIMITS.minSide)throw bad('The image has no size.');
 if(r.width>maxSide||r.height>maxSide||r.width*r.height>maxPixels)throw new ImageError('TOO_BIG_DIMENSIONS',`Images must be at most ${maxSide}×${maxSide} pixels.`);
 if(MARKUP.test(latin1(r.bytes)))throw new ImageError('MARKUP','This file does not look like a plain image.');
 const mime=kind==='jpeg'?'image/jpeg':kind==='png'?'image/png':'image/webp';
 return {mime,ext:kind==='jpeg'?'jpg':kind,width:r.width,height:r.height,bytes:r.bytes,stripped:r.stripped};
}
