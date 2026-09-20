import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {ROOT,ALL_ROUTES,entry} from './build.mjs';
import {nonce,adCSP,transformHTML} from './ads-worker.mjs';
const base=process.argv.includes('--dist')?path.resolve(process.env.DIST_DIR||path.join(ROOT,'dist')):ROOT;
const port=Number(process.env.PORT||4173);
const mount=process.env.BASE_PATH||'';
const headerText=await readFile(path.join(base,'_headers'),'utf8');
const responseHeaders=Object.fromEntries(headerText.split(/\r?\n/).filter(l=>/^\s+[A-Za-z-]+:/.test(l)).map(l=>{const i=l.indexOf(':');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const adsWorker=await stat(path.join(base,'_worker.js')).then(()=>true).catch(()=>false);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf','.json':'application/json','.xml':'application/xml'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(mount&&!url.pathname.startsWith(mount+'/'))throw Error('Not found');
  const p=decodeURIComponent(url.pathname.slice(mount.length)),route=p.replace(/^\/+|\/+$/g,'');
  for(const [name,value]of Object.entries(responseHeaders))res.setHeader(name,value);
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  if(base===ROOT&&ALL_ROUTES.includes(route)){
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
