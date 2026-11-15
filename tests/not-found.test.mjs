// The 404 page: one static file for every missing address (tools/growth-build.mjs notFound) and
// the pure logic of src/not-found.js that picks the language, suggests a tool and filters the list.
import test from 'node:test';
import assert from 'node:assert/strict';
import {notFound,notFoundData,NOT_FOUND_COPY} from '../tools/growth-build.mjs';
import {localeFor,wantedPath,distance,suggest,filterTools,NF_LOCALES} from '../src/not-found.js';
import {INTENTS} from '../src/intents.js';
import {LOCALES} from '../src/i18n.js';
import {mayPromote} from '../src/capabilities.js';

test('language comes from the missing address, then the browser, then English',()=>{
 assert.equal(localeFor('/ko/image/compres/'),'ko');assert.equal(localeFor('/JA/x'),'ja');
 assert.equal(localeFor('/nope/',['fr-FR','ja-JP','ko']),'ja');assert.equal(localeFor('/nope/',['fr']),'en');assert.equal(localeFor('/nope/'),'en');
 assert.equal(localeFor('/preview/ko/x','', '/preview/'),'ko','a site served under a sub-path');
 assert.equal(localeFor('/%E0%A4%A/ko'),'en','an undecodable address does not throw');
 assert.deepEqual([...NF_LOCALES].sort(),[...LOCALES].sort());
});
test('wantedPath drops base, language, index.html and slashes',()=>{
 assert.equal(wantedPath('/en/image/compress/'),'image/compress');assert.equal(wantedPath('/en/Image/Compress/index.html'),'image/compress');
 assert.equal(wantedPath('/image/compress.html'),'image/compress');assert.equal(wantedPath('/site/ko/pdf/split/','/site/'),'pdf/split');assert.equal(wantedPath('/ko/'),'');
});
test('distance is plain edit distance',()=>{
 assert.equal(distance('compress','compress'),0);assert.equal(distance('compres','compress'),1);assert.equal(distance('','abc'),3);assert.equal(distance('kitten','sitting'),3);
});
test('suggest finds typos, wrong folders and missing language prefixes, and stays quiet otherwise',()=>{
 const tools=notFoundData('').locales.en.tools;
 const path=p=>suggest(p,tools)?.[1];
 assert.equal(path('/en/image/compres/'),'en/image/compress/');
 assert.equal(path('/en/pdf/editer'),'en/pdf/editor/');
 assert.equal(path('/image/convert'),'en/image/convert/','no language prefix');
 assert.equal(path('/en/tools/sprite-sheet-maker/'),'en/sprite-sheet-maker/','right name, wrong folder');
 assert.equal(path('/en/video/to-gif/index.html'),'en/video/to-gif/');
 assert.equal(path('/en/totally-unknown-thing/'),undefined);assert.equal(path('/en/'),undefined);assert.equal(path('/wp-login.php'),undefined);
 assert.equal(suggest('/ko/image/compres/',notFoundData('').locales.ko.tools)[1],'ko/image/compress/','the suggestion stays in the visitor language');
});
test('filterTools matches every word in the name or address, names first',()=>{
 const tools=[['Compress image','en/image/compress/'],['Compress PDF','en/pdf/compress/'],['Video to GIF','en/video/to-gif/'],['Shrink video','en/video/compress/']];
 assert.deepEqual(filterTools('compress',tools).map(t=>t[1]),['en/image/compress/','en/pdf/compress/','en/video/compress/']);
 assert.deepEqual(filterTools('  PDF  Compress ',tools).map(t=>t[0]),['Compress PDF']);
 assert.deepEqual(filterTools('to-gif',tools).map(t=>t[0]),['Video to GIF']);
 assert.deepEqual(filterTools('',tools),[]);assert.deepEqual(filterTools('zzz',tools),[]);
 assert.equal(filterTools('e',tools,2).length,2);
 assert.deepEqual(filterTools('압축',[['이미지 압축','ko/image/compress/']]).map(t=>t[0]),['이미지 압축']);
});
test('the page carries every promotable tool in all three languages and no inline code',()=>{
 const html=notFound('https://example.com/'),data=JSON.parse(/<script type="application\/json" id="nfData">([\s\S]*?)<\/script>/.exec(html)[1]);
 assert.deepEqual(data,JSON.parse(JSON.stringify(notFoundData('https://example.com/'))));
 const promotable=Object.keys(INTENTS).filter(id=>INTENTS[id].path&&mayPromote(id)).length;assert(promotable>20);
 for(const l of LOCALES){
  const L=data.locales[l];assert.equal(L.tools.length,promotable,l);assert.equal(L.popular.length,6,l);
  for(const [name,path] of L.tools){assert(name&&!name.startsWith('intent.'),path);assert(path.startsWith(l+'/')&&path.endsWith('/'),path);}
  assert.deepEqual(Object.keys(L.s).sort(),Object.keys(NOT_FOUND_COPY.en).sort(),l+' copy has every key');
  assert(L.s.many.includes('{n}'));for(const v of Object.values(L.s))assert(v.trim());
  assert(html.includes(`href="/${L.links.home}" lang="${l}"`));
 }
 assert.notEqual(data.locales.ko.s.title,data.locales.en.s.title);assert.notEqual(data.locales.ja.s.title,data.locales.en.s.title);
 assert(/<h1>.*Tool not found.*<\/h1>/.test(html),'English is the no-script default');assert(html.includes('<meta name="robots" content="noindex">'));
 assert(html.includes('lang="ko" data-nf-fallback')&&html.includes('lang="ja" data-nf-fallback'),'Korean and Japanese lines without script');
 const scripts=html.match(/<script[^>]*>/g);assert.deepEqual(scripts,['<script type="module" src="/src/not-found.js">','<script type="application/json" id="nfData">'],"script-src 'self': no inline script");
 assert(!/\son[a-z]+=/.test(html.replace(/<script type="application\/json"[\s\S]*?<\/script>/,'')),'no inline handlers');assert(!html.includes('<form'),"form-action 'none'");
 assert(!/https?:\/\//.test(html.replace(/xmlns="[^"]*"/g,'')),'no external request');
 assert(notFound('https://example.com/sub/').includes('src="/sub/src/not-found.js"')&&notFound('https://example.com/sub/').includes('href="/sub/en/image/compress/"'),'absolute links under a sub-path');
});
