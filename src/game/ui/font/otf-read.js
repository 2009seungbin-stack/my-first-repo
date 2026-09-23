/** Bounds-checked big-endian reads for the OpenType parser. Pure; no DOM, no Node APIs.
 *
 * Every table is read through a View: a window [start,end) over the font bytes plus a label
 * used in error messages. Offsets are relative to the window, and every read checks that it
 * stays inside it, so a truncated or corrupt font throws a readable FontError ("glyf: read of
 * 2 bytes at 812 is outside the 800-byte table") instead of reading a neighbouring table or
 * returning undefined. Nothing here loops on data it has not bounds-checked. */
export class FontError extends Error{constructor(message){super(message);this.name='FontError';}}
export const fail=message=>{throw new FontError(message);};

export class View{
 constructor(bytes,start=0,end=bytes.length,label='font'){
  if(start<0||end>bytes.length||start>end)fail(`${label}: table lies outside the file (offset ${start}, length ${end-start}, file ${bytes.length} bytes) — the font is truncated or corrupt`);
  this.b=bytes;this.s=start;this.length=end-start;this.label=label;
 }
 check(o,n){if(!(o>=0&&o+n<=this.length))fail(`${this.label}: read of ${n} byte${n===1?'':'s'} at ${o} is outside the ${this.length}-byte table — the font is truncated or corrupt`);return this.s+o;}
 u8(o){return this.b[this.check(o,1)];}
 i8(o){return this.b[this.check(o,1)]<<24>>24;}
 u16(o){const p=this.check(o,2),b=this.b;return b[p]<<8|b[p+1];}
 i16(o){const p=this.check(o,2),b=this.b;return (b[p]<<8|b[p+1])<<16>>16;}
 u24(o){const p=this.check(o,3),b=this.b;return b[p]<<16|b[p+1]<<8|b[p+2];}
 u32(o){const p=this.check(o,4),b=this.b;return (b[p]<<24|b[p+1]<<16|b[p+2]<<8|b[p+3])>>>0;}
 i32(o){const p=this.check(o,4),b=this.b;return b[p]<<24|b[p+1]<<16|b[p+2]<<8|b[p+3];}
 /** F2DOT14 as a float: the exact value int/16384 (fontTools computes it the same way). */
 f2(o){return this.i16(o)/16384;}
 /** 16.16 Fixed. */
 fixed(o){return this.i32(o)/65536;}
 tag(o){const p=this.check(o,4),b=this.b;return String.fromCharCode(b[p],b[p+1],b[p+2],b[p+3]);}
 /** Raw bytes (a subarray, not a copy). */
 bytes(o,n){const p=this.check(o,n);return this.b.subarray(p,p+n);}
 /** A child window; `n` defaults to "to the end of this one". */
 sub(o,n=this.length-o,label=this.label){this.check(o,n);return new View(this.b,this.s+o,this.s+o+n,label);}
 /** Checks that `count` records of `size` bytes fit at `o` before a loop reads them. */
 need(o,count,size,what){if(!(count>=0&&o>=0&&o+count*size<=this.length))fail(`${this.label}: ${what||'array'} of ${count} × ${size} bytes at ${o} runs past the ${this.length}-byte table — the font is truncated or corrupt`);}
}
export const tagOf=v=>String.fromCharCode(v>>>24&255,v>>>16&255,v>>>8&255,v&255);
