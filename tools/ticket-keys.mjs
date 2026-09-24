/** Generates the ECDSA P-256 key pair for signed service answers (server/tickets.js).
 *   node tools/ticket-keys.mjs          → prints the two values to paste into Cloudflare Pages
 *   node tools/ticket-keys.mjs --json   → {"privateKey":"…","publicKey":"…"} (tests)
 * TICKET_PRIVATE_KEY is a SECRET (Worker only). TICKET_PUBLIC_KEY is a plain variable: it is baked
 * into the pages at build time. Use a different pair for Preview and Production. */
import {publicKeyFromJwk} from '../server/tickets.js';
import {base64url} from '../server/crypto.js';
export async function generateTicketKeys(){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
 const priv={kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y,d:jwk.d};
 return {privateKey:base64url(new TextEncoder().encode(JSON.stringify(priv))),publicKey:publicKeyFromJwk(priv)};
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('tools/ticket-keys.mjs')){
 const k=await generateTicketKeys();
 if(process.argv.includes('--json'))console.log(JSON.stringify(k));
 else console.log(`TICKET_PRIVATE_KEY (secret — Encrypt):\n${k.privateKey}\n\nTICKET_PUBLIC_KEY (plain variable, used at build time):\n${k.publicKey}`);
}
