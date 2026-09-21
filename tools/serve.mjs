import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {ROOT,ALL_ROUTES,entry} from './build.mjs';
import {nonce,adCSP,transformHTML} from './ads-worker.mjs';
const base=process.argv.includes('--dist')?path.resolve(process.env.DIST_DIR||path.join(ROOT,'dist')):path.resolve(ROOT);
const port=Number(process.env.PORT||4173);
const mount=process.env.BASE_PATH||'';
const headerText=await readFile(path.join(base,'_headers'),'utf8');
// Cloudflare Pages _headers semantics: path blocks apply in order, repeated names join with a
// comma, and "! Name" detaches a header set by an earlier matching block.
const headerRules=[];for(const line of headerText.split(/\r?\n/)){
 if(/^\S/.test(line))headerRules.push({match:new RegExp('^'+line.trim().replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*')+'$'),lines:[]});
 else if(line.trim()&&headerRules.length)headerRules.at(-1).lines.push(line.trim());
}
function responseHeaders(pathname){
 const out=new Map();
 for(const rule of headerRules)if(rule.match.test(pathname))for(const line of rule.lines){
  if(line.startsWith('!')){out.delete(line.slice(1).trim().toLowerCase());continue;}
  const i=line.indexOf(':'),name=line.slice(0,i).trim(),value=line.slice(i+1).trim(),key=name.toLowerCase();
  out.set(key,[name,out.has(key)?out.get(key)[1]+', '+value:value]);
 }
 return [...out.values()];
}
const adsWorker=await stat(path.join(base,'_worker.js')).then(()=>true).catch(()=>false);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf','.json':'application/json','.xml':'application/xml'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(mount&&!url.pathname.startsWith(mount+'/'))throw Error('Not found');
  const p=decodeURIComponent(url.pathname.slice(mount.length)),route=p.replace(/^\/+|\/+$/g,'');
  for(const [name,value]of responseHeaders(p))res.setHeader(name,value);
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  if(base===path.resolve(ROOT)&&ALL_ROUTES.includes(route)){
   if(!p.endsWith('/')){res.writeHead(302,{Location:mount+p+'/'+url.search});res.end();return;}
   res.setHeader('Content-Type',mime['.html']);res.end(entry(await readFile(path.join(ROOT,'index.html'),'utf8'),route));return;
  }
  let file=path.resolve(base,'.'+p);if((file!==base&&!file.startsWith(base+path.sep))||p.split('/').some(s=>s.startsWith('.')))throw Error('Forbidden');
  if((await stat(file)).isDirectory()){
   if(!p.endsWith('/')){res.writeHead(301,{Location:mount+p+'/'+url.search});res.end();return;}
   file=path.join(file,'index.html');
  }
  let data=await readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  if(adsWorker&&path.extname(file)==='.html'){const value=nonce();res.setHeader('Content-Security-Policy',adCSP(value));data=transformHTML(data.toString(),value);}
  res.end(data);
 }catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(path.join(base,'404.html'),'utf8').catch(()=>'<h1>404 · Not found</h1>'));}
}).listen(port,'127.0.0.1',()=>console.log(`FileForge http://127.0.0.1:${port}`));
