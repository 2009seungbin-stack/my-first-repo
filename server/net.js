/** Address helpers shared by the /api/v1 network buckets and anonymous community writing (no imports:
 * server/platform/anon.js depends on it without pulling in the whole API). */
/** Full 8×16-bit groups of an IPv6 address ('::' and an embedded IPv4 tail expanded), or null.
 * Splitting the compressed text form would put host bits into the "/64" of any prefix with zero
 * groups (2001:db8::5 vs 2001:db8::6), letting one /64 rotate through many buckets. */
export function ipv6Groups(ip){
 let s=String(ip||'').toLowerCase().replace(/^\[|\]$/g,'').split('%')[0];
 const v4=/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
 if(v4){const b=v4.slice(1).map(Number);if(b.some(x=>x>255))return null;s=s.slice(0,v4.index)+((b[0]<<8)|b[1]).toString(16)+':'+((b[2]<<8)|b[3]).toString(16);}
 const halves=s.split('::');if(halves.length>2)return null;
 const head=halves[0]?halves[0].split(':'):[],tail=halves.length===2&&halves[1]?halves[1].split(':'):[];
 const fill=8-head.length-tail.length;if(halves.length===1?fill!==0:fill<1)return null;
 const groups=[...head,...Array(halves.length===2?fill:0).fill('0'),...tail];
 if(groups.length!==8||!groups.every(g=>/^[0-9a-f]{1,4}$/.test(g)))return null;
 return groups.map(g=>parseInt(g,16).toString(16));
}
