import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const ORIGIN='https://nerulio.com';
export const hash=text=>createHash('sha256').update(text).digest('hex');
export const fingerprint=body=>hash(body.replace(/<!--.*?-->/gs,'').replace(/https:\/\/nerulio\.com\/[^\s)]+/g,'SOURCE').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim());
export function canonical(route){return ORIGIN+route;}
export function validCanonical(value){try{const u=new URL(value);return u.origin===ORIGIN&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/en\/(?:[a-z0-9-]+\/)+$/.test(u.pathname)&&u.href===value;}catch{return false;}}
export function normalizeRoute(value){const p=String(value).replace(/^\/+|\/+$/g,'').replace(/^en\//,'');if(!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(p))throw Error('Invalid source route');return '/en/'+p+'/';}
export function assertNoSecrets(value,env=process.env){
 const text=typeof value==='string'?value:JSON.stringify(value);
 const secrets=Object.entries(env).filter(([k,v])=>/(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(k)&&typeof v==='string'&&v.length>=8).map(([,v])=>v);
 if(secrets.some(s=>text.includes(s))||/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|github_pat_|sk_live_)[A-Za-z0-9_]{12,}|(?:api[-_]?key|access[-_]?token|password)\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}/i.test(text))throw Error('Secret-like content rejected; value withheld');
}
