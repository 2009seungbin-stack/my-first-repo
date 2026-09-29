#!/usr/bin/env node
/** Test-only server for the admin PWA: serves the app (src/admin as built by tools/admin-build.mjs,
 * with the production CSP and noindex headers) and a mock of every admin endpoint in
 * ADMIN-CONTRACT.md, including the passkey ceremony (challenges and clientDataJSON are checked; the
 * attestation/assertion signature is not), REAUTH, NOT_CONFIGURED and the moderation API.
 * Never part of a build.   node tests/admin-mock-server.mjs [port]  → http://localhost:8795/admin/
 * Test hooks: POST /__mock/state {…} merges into the mock state; GET /__mock/log lists API calls. */
import http from 'node:http';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {adminBundle,ADMIN_CSP} from '../tools/admin-build.mjs';
import {fixtures} from './admin-fixtures.mjs';

const TYPES=/** @type {Record<string,string>} */({'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.html':'text/html; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json'});
const b64u=buf=>Buffer.from(buf).toString('base64url');

export async function createAdminMock({port=8795,now=()=>Date.now()}={}){
 const origin=`http://localhost:${port}`;
 const state={signedIn:false,credentials:[],challenge:null,reauth:0,notConfigured:[],setupCode:'test-setup-code',emptyMod:false,runs:0,actions:[],pushSubs:[],prefs:null,usageShape:'month'};
 const log=[];
 const json=(res,status,body,extra={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra});res.end(JSON.stringify(body));};
 const err=(res,status,code,message,more={})=>json(res,status,{error:{code,message,...more}});
 const cookie=req=>/(?:^|;\s*)nerulio_session=mock/.test(req.headers.cookie||'');
 const setCookie={'set-cookie':'nerulio_session=mock; Path=/; HttpOnly; SameSite=Lax'};
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url||'/',origin),p=url.pathname;
   const raw=req.method!=='GET'&&req.method!=='HEAD'?await new Promise(r=>{const c=[];req.on('data',d=>c.push(d));req.on('end',()=>r(Buffer.concat(c).toString('utf8')));}):'';
   const body=raw?JSON.parse(raw):{};
   if(p==='/__mock/state'){Object.assign(state,body);return json(res,200,state);}
   if(p==='/__mock/log')return json(res,200,log);
   if(p==='/admin'){res.writeHead(301,{location:'/admin/'});return res.end();}
   if(p.startsWith('/admin/')){
    const {files}=await adminBundle();
    const rel=p==='/admin/'?'index.html':decodeURIComponent(p.slice('/admin/'.length));
    const data=files.get(rel);
    if(data===undefined){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'content-type':TYPES[path.extname(rel)]||'application/octet-stream','content-security-policy':ADMIN_CSP,'x-robots-tag':'noindex, nofollow','cache-control':'no-cache'});
    return res.end(data);
   }
   if(!p.startsWith('/api/')){res.writeHead(404);return res.end('Not found');}
   log.push({method:req.method,path:p+url.search,body});
   // Same-origin rule of server/api.js for writes.
   if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==origin)return err(res,403,'FORBIDDEN_ORIGIN','Cross-site request rejected.');
   const f=fixtures(now());
   const nc=k=>state.notConfigured.includes(k);
   if(p==='/api/v1/auth/logout'){state.signedIn=false;return json(res,200,{loggedIn:false},{'set-cookie':'nerulio_session=; Path=/; Max-Age=0'});}
   // ---- passkey ----
   if(p.startsWith('/api/v2/admin/passkey/')&&p!=='/api/v2/admin/passkey/remove'){
    const step=p.slice('/api/v2/admin/passkey/'.length);
    if(step==='register/options'){
     const signed=cookie(req)&&state.signedIn;
     if(!signed){
      if(nc('setup'))return err(res,503,'NOT_CONFIGURED','Admin setup is not configured.',{need:'ADMIN_SETUP_CODE'});
      if(state.credentials.length)return err(res,404,'NOT_FOUND','NOT_FOUND');   // as the backend: the setup path stops existing
      if(body.setupCode!==state.setupCode)return err(res,403,'FORBIDDEN','Setup code rejected.',{field:'setupCode'});
     }
     state.challenge=b64u(randomBytes(32));
     return json(res,200,{challenge:state.challenge,rp:{id:'localhost',name:'Nerulio 관리'},user:{id:b64u(Buffer.from('admin-user-handle')),name:'owner',displayName:'운영자'},
      pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],timeout:60000,attestation:'none',
      authenticatorSelection:{residentKey:'required',userVerification:'required'},excludeCredentials:state.credentials.map(c=>({type:'public-key',id:c.id}))});
    }
    if(step==='register/verify'||step==='login/verify'){
     const cred=body.credential||{};
     let cd;try{cd=JSON.parse(Buffer.from(cred.response?.clientDataJSON||'','base64url').toString('utf8'));}catch{return err(res,400,'BAD_REQUEST','Invalid credential.');}
     const want=step==='register/verify'?'webauthn.create':'webauthn.get';
     if(cd.type!==want||cd.challenge!==state.challenge||cd.origin!==origin)return err(res,400,'BAD_REQUEST','Credential does not match the challenge.');
     if(typeof cred.rawId!=='string'||cred.rawId!==cred.id)return err(res,400,'BAD_REQUEST','Credential id must be base64url.');
     state.challenge=null;
     if(step==='register/verify'){
      if(typeof cred.response.attestationObject!=='string')return err(res,400,'BAD_REQUEST','Missing attestation.');
      state.credentials.push({id:cred.id,name:String(body.name||'기기'),created_at:now(),last_used_at:now()});
     }else{
      const c=state.credentials.find(x=>x.id===cred.id);
      if(!c||typeof cred.response.signature!=='string'||typeof cred.response.authenticatorData!=='string')return err(res,400,'BAD_REQUEST','Unknown credential.');
      c.last_used_at=now();
     }
     state.signedIn=true;state.reauth=0;
     return json(res,200,{ok:true},setCookie);
    }
    if(step==='login/options'){
     state.challenge=b64u(randomBytes(32));
     return json(res,200,{challenge:state.challenge,rpId:'localhost',timeout:60000,userVerification:'required',allowCredentials:state.credentials.map(c=>({type:'public-key',id:c.id}))});
    }
    return err(res,404,'NOT_FOUND','Not found.');
   }
   // ---- everything else needs the admin session ----
   const gated=p.startsWith('/api/v2/admin/')||p.startsWith('/api/v2/mod/');
   if(gated&&!(cookie(req)&&state.signedIn))return err(res,404,'NOT_FOUND','Not found.');
   if(gated&&state.reauth>0){state.reauth--;return json(res,401,{error:'REAUTH'});}   // the contract's shorthand shape
   const key=`${req.method} ${p}`;
   const runsM=/^\/api\/v2\/admin\/collectors\/([^/]+)\/runs$/.exec(p);
   if(req.method==='GET'&&runsM){const id=decodeURIComponent(runsM[1]);if(!f.collectors.items.some(c=>c.id===id))return err(res,404,'NOT_FOUND','No such collector.');return json(res,200,f.runs[id]||{items:[]});}
   switch(key){
    case 'GET /api/v2/admin/me':return json(res,200,{admin:true,name:'운영자',devices:state.credentials.map(c=>({id:c.id,name:c.name,created_at:c.created_at,last_used_at:c.last_used_at})),reauthAt:now()+11*36e5,push:{configured:!nc('push')}});
    case 'POST /api/v2/admin/passkey/remove':{
     if(!state.credentials.some(c=>c.id===body.id))return err(res,404,'NOT_FOUND','No such passkey.');
     if(state.credentials.length<2)return err(res,409,'OPERATION_CONFLICT','The last passkey cannot be removed.');
     state.credentials=state.credentials.filter(c=>c.id!==body.id);return json(res,200,{ok:true});}
    case 'GET /api/v2/admin/push/prefs':return json(res,200,{prefs:state.prefs||f.prefs,subscribed:!!state.prefs,defaults:f.prefs});
    case 'GET /api/v2/admin/overview':{const ov=f.overview;if(nc('usage'))ov.usage=null;if(nc('traffic'))ov.traffic=null;if(state.usageShape==='day')ov.usage=f.usageDaily;return json(res,200,ov);}
    case 'GET /api/v2/admin/collectors':return json(res,200,f.collectors);
    case 'GET /api/v2/admin/usage':return nc('usage')?json(res,503,{need:'CF_ANALYTICS_TOKEN',missing:['CF_ANALYTICS_TOKEN','CF_ACCOUNT_ID'],error:{code:'NOT_CONFIGURED',message:'CF_ANALYTICS_TOKEN is not configured on this deployment.',need:'CF_ANALYTICS_TOKEN'}}):json(res,200,f.usage);
    case 'POST /api/v2/admin/collectors/run':
     if(nc('run'))return json(res,503,{error:'NOT_CONFIGURED',need:'GITHUB_DISPATCH_TOKEN'});   // the contract's shorthand shape, on purpose (both shapes are understood)
     state.runs++;return json(res,200,{ok:true,runUrl:'https://github.com/example/actions/runs/1'});
    case 'GET /api/v2/admin/radar':return json(res,200,url.searchParams.get('cursor')?f.radar2:f.radar);
    case 'POST /api/v2/admin/radar/action':
     if(!body.reason||String(body.reason).length<2)return err(res,400,'BAD_REQUEST','reason must be 2–500 characters.');
     state.actions.push(body);return json(res,200,{ok:true});
    case 'GET /api/v2/admin/community':return json(res,200,f.community);
    case 'GET /api/v2/admin/traffic':return nc('traffic')?json(res,503,{need:'TRAFFIC',missing:['TRAFFIC','CF_ANALYTICS_TOKEN'],error:{code:'NOT_CONFIGURED',message:'Traffic analytics is not configured.',need:'TRAFFIC'}}):json(res,200,{...f.traffic,range:url.searchParams.get('range')||'today'});
    case 'GET /api/v2/admin/push/key':return nc('push')?json(res,503,{need:'VAPID_PUBLIC_KEY',missing:['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY'],error:{code:'NOT_CONFIGURED',message:'VAPID_PUBLIC_KEY is not configured on this deployment.',need:'VAPID_PUBLIC_KEY'}}):json(res,200,{publicKey:'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'});
    case 'POST /api/v2/admin/push/subscribe':state.pushSubs.push(body.subscription);state.prefs=body.prefs;return json(res,200,{ok:true});
    case 'DELETE /api/v2/admin/push/subscribe':state.pushSubs=state.pushSubs.filter(s=>s?.endpoint!==body.endpoint);return json(res,200,{ok:true});
    case 'PUT /api/v2/admin/push/prefs':state.prefs=body.prefs;return json(res,200,{ok:true});
    case 'POST /api/v2/admin/push/test':return json(res,200,{ok:true,sent:state.pushSubs.length});
    case 'GET /api/v2/mod/queue':return json(res,200,state.emptyMod?{items:[],hidden:[],proposals:[],log:[]}:f.modQueue);
    case 'POST /api/v2/mod/action':
     if(!body.reason||[...String(body.reason)].length<2)return err(res,400,'BAD_REQUEST','reason must be 2–500 characters.',{field:'reason'});
     if(body.target==='comment:c9'&&body.action==='hide')return err(res,409,'OPERATION_CONFLICT','Already hidden.');
     state.actions.push(body);return json(res,200,{ok:true});
   }
   return err(res,404,'NOT_FOUND','Not found.');
  }catch(e){res.writeHead(500);res.end(String(e?.stack||e));}
 });
 await new Promise(r=>server.listen(port,()=>r(null)));
 return {server,origin,state};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {origin}=await createAdminMock({port:Number(process.argv[2])||8795});
 console.log(`admin mock: ${origin}/admin/  (setup code: test-setup-code)`);
}
