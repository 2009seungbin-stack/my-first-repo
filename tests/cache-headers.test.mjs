// Caching policy of the deployed site (_headers through tools/site-config.mjs headers()):
// HTML and app code never outlive a release; only version-named vendor folders are kept for long.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {headers} from '../tools/site-config.mjs';

const source=readFileSync(new URL('../_headers',import.meta.url),'utf8');
const rules=out=>out.split(/\n(?=\S)/).filter(b=>b.startsWith('/')).map(b=>{const [pattern,...lines]=b.split('\n');return {pattern,lines:lines.map(l=>l.trim()).filter(Boolean)};});
/** Cloudflare Pages path matching: :name is one path segment, * is the rest of the path. */
const matcher=pattern=>new RegExp('^'+pattern.split(/(:[A-Za-z0-9_]+|\*)/).map(part=>part==='*'?'.*':part.startsWith(':')?'[^/]+':part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('')+'$');
/** Cache-Control a path ends up with: rules apply in file order, "! Cache-Control" drops what earlier rules set. */
function cacheControl(out,path){
 let value=[];
 for(const {pattern,lines} of rules(out))if(matcher(pattern).test(path))for(const line of lines){
  if(/^!\s*Cache-Control$/i.test(line))value=[];else if(/^Cache-Control:/i.test(line))value.push(line.replace(/^Cache-Control:\s*/i,''));
 }
 return value.join(', ');
}
test('version-named vendor folders are cached for a year; everything that can change is not',()=>{
 for(const config of [{},{preview:true},{webAnalytics:true}]){
  const out=headers(source,config);
  for(const path of ['/assets/vendor/pdfjs-dist-6.3.289/build/pdf.min.mjs','/assets/vendor/mediabunny-1.58.1/mediabunny.min.mjs','/assets/vendor/pdfjs-dist-6.3.289/wasm/openjpeg.wasm'])
   assert.equal(cacheControl(out,path),'public, max-age=31536000, immutable',path);
  for(const path of ['/','/ko/','/en/image/compress/','/404.html','/assets/vendor/NOTICES.txt','/assets/vendor/manifest.json','/assets/home/shot-hero-ko-1280.webp','/assets/fonts/suit/SUIT.subset.1.woff2','/favicon.svg'])
   assert.equal(cacheControl(out,path),'public, max-age=0, must-revalidate',path);
  for(const path of ['/src/app.js','/src/not-found.js','/src/studio/main.js','/styles.css','/experience.css','/content.css','/ai-runtime/runtime.js'])
   assert.equal(cacheControl(out,path),'no-store',path);
 }
});
test('every vendor folder carries the exact version in its name, so a year-long cache cannot go stale',()=>{
 const entries=readdirSync(new URL('../assets/vendor/',import.meta.url),{withFileTypes:true}),folders=entries.filter(e=>e.isDirectory()).map(e=>e.name);
 assert(folders.length>=5);
 for(const name of folders)assert.match(name,/-\d+\.\d+\.\d+$/,`${name}: put the library version in the folder name (it is cached as immutable)`);
 const rule=rules(source).find(r=>r.pattern==='/assets/vendor/:library/*');
 assert.deepEqual(rule?.lines,['! Cache-Control','Cache-Control: public, max-age=31536000, immutable']);
 assert.equal(rules(source).filter(r=>r.lines.some(l=>/immutable|max-age=[1-9]/.test(l))).length,1,'no other long-lived rule');
 for(const {pattern} of rules(source))assert((pattern.match(/\*/g)||[]).length<=1,'one splat per rule');
});
