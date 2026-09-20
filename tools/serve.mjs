import http from 'node:http';
import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {ROOT,ALL_ROUTES,entry} from './build.mjs';
const base=process.argv.includes('--dist')?path.join(ROOT,'dist'):ROOT;
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf','.json':'application/json','.xml':'application/xml'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),p=decodeURIComponent(url.pathname),route=p.replace(/^\/+|\/+$/g,'');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  if(base===ROOT&&ALL_ROUTES.includes(route)){
   if(!p.endsWith('/')){res.writeHead(302,{Location:p+'/'+url.search});res.end();return;}
   res.setHeader('Content-Type',mime['.html']);res.end(entry(await readFile(path.join(ROOT,'index.html'),'utf8'),route));return;
  }
  let file=path.resolve(base,'.'+p);if((file!==base&&!file.startsWith(base+path.sep))||p.split('/').some(s=>s.startsWith('.')))throw Error('Forbidden');
  if((await stat(file)).isDirectory())file=path.join(file,'index.html');
  const data=await readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`FileForge http://127.0.0.1:${port}`));
