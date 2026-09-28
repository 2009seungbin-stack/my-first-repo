/** Upstream jsfxr 1.4.1 format adapter. Its Base58 is not native sfxr .sfs.
 * https://github.com/chr15m/jsfxr/blob/master/sfxr.js (Unlicense). */
import '../../assets/vendor/jsfxr-1.4.1/riffwave.js';
import '../../assets/vendor/jsfxr-1.4.1/sfxr.js';
const upstream=globalThis.jsfxr;
const ORDER=upstream.parameters.order;
export function parseJsfxr(value){let o;if(typeof value==='string'){const s=value.trim().replace(/^https?:\/\/sfxr\.me\/#/,'').replace(/^#/,'');if(s.startsWith('{'))o=JSON.parse(s);else if(/^[1-9A-HJ-NP-Za-km-z]{20,512}$/.test(s))o=upstream.sfxr.b58decode(s);else throw Error('Unrecognized jsfxr JSON or Base58 code');}else o=value;if(!o||typeof o!=='object'||Array.isArray(o))throw Error('Invalid jsfxr parameters');const p=new upstream.Params();for(const k of ORDER)if(o[k]!==undefined){const v=Number(o[k]);if(!Number.isFinite(v)||Math.abs(v)>10)throw Error('Invalid jsfxr parameter '+k);p[k]=v;}for(const k of ['sound_vol','sample_rate','sample_size'])if(o[k]!==undefined)p[k]=Number(o[k]);if(![44100,22050,11025,8000].includes(p.sample_rate)||![8,16].includes(p.sample_size)||p.sound_vol<0||p.sound_vol>1)throw Error('Invalid jsfxr output settings');return p;}
export function toJsfxrJSON(p){const q=parseJsfxr(p);return JSON.stringify(Object.fromEntries([...ORDER,'sound_vol','sample_rate','sample_size'].map(k=>[k,q[k]])),null,2);}
export function toJsfxrBase58(p){return parseJsfxr(p).toB58();}
export function renderJsfxr(p){const q=parseJsfxr(p);return {pcm:upstream.sfxr.toBuffer(q),rate:q.sample_rate};}
export function originalJsfxr(){return upstream;}
