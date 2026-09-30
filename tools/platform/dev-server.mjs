#!/usr/bin/env node
/** Local Nerulio 2.0 server: the Worker's platform handlers (pages + /api/v2) over a node:sqlite
 * database with every seed file and the SAMPLE boards, plus the repository's static files.
 *   node tools/platform/dev-server.mjs [port]      → http://localhost:8788/ko/community/
 * Sign in locally with /__dev/login?as=<name>[&role=moderator] (creates a test account and a session cookie; this
 * route exists only in this dev server, never in the Worker). DEV_SIGNIN_PROVIDERS=github,discord shows those
 * providers' sign-in buttons (placeholder credentials: the buttons render, the provider round trip does not).
 * Community images go to an in-memory R2 bucket (tests/r2-shim.mjs; DEV_UPLOADS=off leaves UPLOADS unbound).
 * Anonymous writing runs without a bot check here (no Turnstile keys: the stricter limits apply);
 * DEV_TURNSTILE=testing uses Cloudflare's always-pass testing keys instead (needs network). A request
 * header cf-connecting-ip stands for the client address (tests use it to act from different networks). */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {D1Shim} from '../../tests/d1-shim.mjs';
import {seedDatabase} from './seed-db.mjs';
import {insertDemoContent} from './demo-posts.mjs';
import {handlePlatformPage} from '../../server/platform/pages.js';
import {handlePlatformApi} from '../../server/platform/api.js';
import {sha256,base64url} from '../../server/crypto.js';
import {configuredProviders,providerCredentials} from '../../server/oauth/providers.js';
import {adminBundle,ADMIN_CSP} from '../admin-build.mjs';
import {R2Shim} from '../../tests/r2-shim.mjs';
import {serveUpload} from '../../server/platform/uploads.js';
import {isModeratorRequest} from '../../server/platform/api.js';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const VERIFY_HTML=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Verification</title><style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center;padding:4px}</style><script type="module" src="/src/verify-page.js"></script></head><body><div id="turnstile"></div></body></html>`;
const VERIFY_CSP="default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
const TYPES=/** @type {Record<string,string>} */({'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.html':'text/html; charset=utf-8','.json':'application/json'});

export async function createDevServer({port=8788,now=Date.now()}={}){
 const db=D1Shim.migrated();
 await seedDatabase(db,undefined,now-2*864e5);
 await insertDemoContent(db,now);
 const origin=`http://localhost:${port}`;
 const env={DB:db,SESSION_SECRET:'dev-only-session-secret-0123456789abcdef-0123',NERULIO_ENV:'development',SITE_URL:origin,
  ...(process.env.DEV_UPLOADS==='off'?{}:{UPLOADS:new R2Shim()}),
  ...(process.env.DEV_TURNSTILE==='testing'?{TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA'}:{}),
  ...Object.fromEntries(String(process.env.DEV_SIGNIN_PROVIDERS||'').split(',').map(p=>p.trim().toUpperCase()).filter(p=>['GOOGLE','GITHUB','DISCORD'].includes(p)).flatMap(p=>[[`${p}_OAUTH_CLIENT_ID`,`dev-${p.toLowerCase()}`],[`${p}_OAUTH_CLIENT_SECRET`,'dev-placeholder']]))};
 const providers=configuredProviders({oauth:providerCredentials(env)});
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url||'/',origin);
   if(url.pathname==='/__dev/login'){
    const name=(url.searchParams.get('as')||'tester').replace(/[^\w-]/g,'').slice(0,20)||'tester';
    const id='dev-'+name,token=base64url(crypto.getRandomValues(new Uint8Array(32)));
    await db.prepare("INSERT OR IGNORE INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?1,NULL,?2,'dev',?1,?3)").bind(id,name,Date.now()-30*864e5).run();
    await db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),id,Date.now(),Date.now()+864e5).run();
    const role=url.searchParams.get('role');
    if(role==='moderator'||role==='admin')await db.prepare("INSERT INTO user_profiles (user_id,display_name,role,created_at,updated_at) VALUES (?1,?2,?3,?4,?4) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role").bind(id,name,role,Date.now()).run();
    res.writeHead(302,{'set-cookie':`nerulio_session=${token}; Path=/; HttpOnly; SameSite=Lax`,location:url.searchParams.get('next')||'/ko/community/'});return res.end();
   }
   const body=req.method!=='GET'&&req.method!=='HEAD'?await new Promise(r=>{const c=[];req.on('data',d=>c.push(d));req.on('end',()=>r(Buffer.concat(c)));}):undefined;
   const request=new Request(url,{method:req.method,headers:/** @type {any} */(req.headers),body});
   let response=null;
   if(url.pathname.startsWith('/api/v2/'))response=await handlePlatformApi(request,env,null);
   else if(url.pathname.startsWith('/u/'))response=await serveUpload(request,env,null,{isModerator:()=>isModeratorRequest(request,env)});
   else if(url.pathname==='/verify/')response=new Response(VERIFY_HTML,{headers:{'content-type':'text/html; charset=utf-8','content-security-policy':VERIFY_CSP}});
   else response=await handlePlatformPage(request,env,null,{origin,providers});
   // The admin PWA (src/admin, as built for PLATFORM=on) with its production CSP; its API comes from the handlers above.
   if(!response&&(url.pathname==='/admin'||url.pathname.startsWith('/admin/'))){
    const {files}=await adminBundle(),rel=url.pathname==='/admin'||url.pathname==='/admin/'?'index.html':decodeURIComponent(url.pathname.slice(7)),data=files.get(rel);
    response=data===undefined?new Response('Not found',{status:404}):new Response(data,{headers:{'content-type':TYPES[path.extname(rel)]||(rel.endsWith('.webmanifest')?'application/manifest+json':'application/octet-stream'),'content-security-policy':ADMIN_CSP,'x-robots-tag':'noindex, nofollow'}});
   }
   if(!response){
    // The build copies these two from assets/brand to the site root (tools/build.mjs).
    const rootIcon=url.pathname==='/favicon.ico'||url.pathname==='/apple-touch-icon.png';
    const file=path.join(ROOT,rootIcon?'assets/brand'+url.pathname:decodeURIComponent(url.pathname));
    if(!file.startsWith(ROOT)||!(rootIcon||/^\/(src|assets)\/|^\/favicon\.svg$/.test(url.pathname)))response=new Response('Not found',{status:404});
    else response=await readFile(file).then(b=>new Response(b,{headers:{'content-type':TYPES[path.extname(file)]||'application/octet-stream'}}),()=>new Response('Not found',{status:404}));
   }
   const headers=Object.fromEntries(response.headers);const cookies=response.headers.getSetCookie?.()||[];
   if(cookies.length)/** @type {any} */(headers)['set-cookie']=cookies;
   res.writeHead(response.status,headers);res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){res.writeHead(500);res.end(String(/** @type {any} */(e)?.stack||e));}
 });
 await new Promise(r=>server.listen(port,()=>r(null)));
 return {server,db,origin,env};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {origin}=await createDevServer({port:Number(process.argv[2])||8788});
 console.log(`Nerulio 2.0 dev server: ${origin}/ko/community/  (sign in: ${origin}/__dev/login?as=tester)`);
}
