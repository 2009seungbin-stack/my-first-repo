import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {configuration} from './site-config.mjs';
/** Deploy-time only. The ownership key file is public by protocol, not an API credential. */
export function submission(config,xml) {
  if(config.preview||!config.siteURL||!config.indexNowKey)throw Error('Production SITE_URL and INDEXNOW_KEY are required');
  const site=new URL(config.siteURL);
  const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
  if(!urls.length||urls.length>10000||urls.some(v=>{const u=new URL(v);return u.origin!==site.origin||!u.pathname.startsWith(site.pathname)||u.search||u.hash;}))throw Error('Invalid sitemap URL set');
  return {host:site.host,key:config.indexNowKey,keyLocation:new URL(config.indexNowKey+'.txt',site).href,urlList:[...new Set(urls)]};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const body=submission(configuration(),await readFile('dist/sitemap.xml','utf8'));
  if(!process.argv.includes('--submit'))console.log(`Dry run: ${body.urlList.length} canonical URLs for ${body.host}. Pass --submit after deployment.`);
  else {
    const key=await fetch(body.keyLocation);if(!key.ok||(await key.text()).trim()!==body.key)throw Error('Deploy and verify the public ownership file first');
    const response=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(![200,202].includes(response.status))throw Error(`IndexNow HTTP ${response.status}`);
    console.log(`IndexNow accepted submission (${response.status}); this does not guarantee indexing.`);
  }
}
