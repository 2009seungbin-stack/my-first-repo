/** Keys for the admin app's Web Push and CI notifications (server/push.js, server/platform/admin.js).
 *   node tools/admin-keys.mjs                 → prints the values with where each one goes
 *   node tools/admin-keys.mjs --json          → {"VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY","NOTIFY_TOKEN"} on one line,
 *                                               for piping into `wrangler pages secret put` / `gh secret set`
 *   node tools/admin-keys.mjs --json --only VAPID_PUBLIC_KEY   → just that value (no JSON), e.g. for a variable
 * VAPID_PRIVATE_KEY and NOTIFY_TOKEN are SECRETS. VAPID_PUBLIC_KEY is a plain variable. Use a different
 * set for Preview and Production. Rotating the VAPID pair invalidates every push subscription: the
 * admin app then asks to turn notifications on again. ADMIN_SETUP_CODE is not generated here: the
 * owner picks it (16+ characters) and removes it after registering the first passkey. */
import {base64url} from '../server/crypto.js';
export async function generateVapidKeys(){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
 // Public key: the uncompressed point (65 bytes) that PushManager.subscribe({applicationServerKey}) takes.
 return {publicKey:base64url(await crypto.subtle.exportKey('raw',pair.publicKey)),privateKey:String(jwk.d)};
}
export async function generateAdminKeys(){
 const v=await generateVapidKeys();
 return {VAPID_PUBLIC_KEY:v.publicKey,VAPID_PRIVATE_KEY:v.privateKey,NOTIFY_TOKEN:base64url(crypto.getRandomValues(new Uint8Array(32)))};
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('tools/admin-keys.mjs')){
 const k=await generateAdminKeys(),a=process.argv.slice(2),i=a.indexOf('--only');
 if(i>=0){const name=a[i+1];if(!(name in k)){console.error(`--only takes one of: ${Object.keys(k).join(', ')}`);process.exitCode=2;}else process.stdout.write(k[/** @type {keyof typeof k} */(name)]);}
 else if(a.includes('--json'))console.log(JSON.stringify(k));
 else console.log(`VAPID_PUBLIC_KEY (plain variable):\n${k.VAPID_PUBLIC_KEY}\n\nVAPID_PRIVATE_KEY (secret — Encrypt):\n${k.VAPID_PRIVATE_KEY}\n\nNOTIFY_TOKEN (secret — Encrypt; the same value as the GitHub Actions secret NOTIFY_TOKEN):\n${k.NOTIFY_TOKEN}\n\nAlso set VAPID_SUBJECT (plain variable), e.g. mailto:you@example.com`);
}
