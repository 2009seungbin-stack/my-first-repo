import {gamePageFor} from '../tools/game-landing-build.mjs';
import {HUB} from '../src/game-seo.js';
import {DIRECTORY,isTask} from '../src/task/registry.js';
import {ui} from '../src/task/strings.js';
import {landingText} from '../src/landings.js';
import {BRAND} from '../src/brand.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MESSAGES} from '../src/messages.js';
import {LOCALES,t,setLocale,normalizeLocale,chooseLocale,readPreference,savePreference,locationParts,localizedURL,localeFromEnvironment} from '../src/i18n.js';
import {INTENTS,ROUTES,intentFor,intentDefaults,accepts} from '../src/intents.js';
import {ALL_ROUTES,entry} from '../tools/build.mjs';
import {wait} from '../src/media.js';
const slots=s=>[...new Set([...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]))].sort();
for(const [key,values]of Object.entries(MESSAGES))test(`translation completeness: ${key}`,()=>{
 assert.equal(values.length,3);for(let i=0;i<3;i++){assert.equal(typeof values[i],'string');assert(values[i].trim().length>0);assert.deepEqual(slots(values[i]),slots(values[0]));}
 assert(!/[가-힣]/.test(values[1]));assert(!/[가-힣]/.test(values[2]));
});
test('BCP 47 region normalization',()=>{assert.equal(normalizeLocale('en-US'),'en');assert.equal(normalizeLocale('ja-JP'),'ja');assert.equal(normalizeLocale('KO_kr'),'ko');assert.equal(normalizeLocale('zh-Hans'),null);assert.equal(normalizeLocale('<script>en'),null);});
test('language priority: query > path > saved > browser > English',()=>{
 const env={query:'ja',pathname:'en',saved:'ko',languages:['en-US']};assert.equal(chooseLocale(env),'ja');delete env.query;assert.equal(chooseLocale(env),'en');delete env.pathname;assert.equal(chooseLocale(env),'ko');delete env.saved;assert.equal(chooseLocale(env),'en');env.languages=['zh','ja-JP'];assert.equal(chooseLocale(env),'ja');env.languages=['fr-FR'];assert.equal(chooseLocale(env),'en');
});
test('invalid explicit language does not suppress a valid preference',()=>assert.equal(chooseLocale({query:'../../es',pathname:'ko'}),'ko'));
test('denied localStorage cannot crash app',()=>{const storage={getItem(){throw Error('denied');},setItem(){throw Error('denied');},removeItem(){throw Error('denied');}};assert.equal(readPreference(storage),null);assert.equal(savePreference('ja',storage),false);assert.equal(savePreference(null,storage),false);assert.equal(readPreference(null),null);});
test('automatic mode deletes preference',()=>{const m=new Map(),s={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};assert(savePreference('ja',s));assert.equal(readPreference(s),'ja');assert(savePreference(null,s));assert.equal(readPreference(s),null);});
test('source text keys are translated explicitly, not by scanning user input',()=>{setLocale('en');assert.equal(t('저장'),'Export');assert.equal(t('{0} 여는 중…',{0:'사진-한국어.png'}),'Opening 사진-한국어.png…');assert.equal(t('unknown-code'),'unknown-code');setLocale('ko');assert.equal(t('저장'),'저장');setLocale('en');});
test('locale-aware routing below repository base',()=>assert.deepEqual(locationParts('/my-first-repo/ja/image/upscale/','/my-first-repo/'),{locale:'ja',path:'image/upscale'}));
test('index filename is normalized',()=>assert.deepEqual(locationParts('/ko/pdf/merge/index.html'),{locale:'ko',path:'pdf/merge'}));
test('localized links preserve explicit settings, not lang overrides',()=>{const u=localizedURL('image/upscale','ja',new URL('https://example.test/my-first-repo/'),'?scale=4&lang=en');assert.equal(u.href,'https://example.test/my-first-repo/ja/image/upscale/?scale=4');assert.throws(()=>localizedURL('../escape','en',new URL('https://example.test/')));});
test('environment never uses IP or location',()=>{const u=new URL('https://example.test/en/pixel/?lang=ja');assert.equal(localeFromEnvironment(u,new URL('https://example.test/'),{storage:null,languages:['ko']}),'ja');});
for(const [id,c]of Object.entries(INTENTS))test(`intent config and copy: ${id}`,()=>{assert.equal(intentFor(c.path),id);for(const field of ['title','headline','description','action'])assert(MESSAGES[`intent.${id}.${field}`]);for(const next of c.next)assert(INTENTS[next]);});
test('conversion aliases select the target format',()=>{assert.equal(intentFor('png-to-webp'),'convert');assert.equal(intentDefaults('convert','png-to-webp').format,'webp');assert.equal(intentDefaults('convert','webp-to-jpg').format,'jpeg');assert.equal(intentDefaults('heic').format,'jpeg');});
test('URL preset validation',()=>{const d=intentDefaults('upscale','','?scale=99&n=1000&w=-5&kb=900000&format=exe');assert.equal(d.scale,4);assert.equal(d.n,512);assert.equal(d.width,0);assert.equal(d.kb,32768);assert.equal(d.format,'png');});
test('purpose-specific input rejection',()=>{assert(accepts('pdf-merge',['pdf','pdf']));assert(!accepts('pdf-merge',['image']));assert(accepts('jpg-to-pdf',['image']));assert(!accepts('upscale',['pdf']));assert(!accepts('home',[null]));});
test('media errors localize without timer/translator shadowing',async()=>{setLocale('ja');const e=new EventTarget();await assert.rejects(wait(e,'loaded',null,1),err=>err.message==='メディアの読み込みがタイムアウトしました。');setLocale('en');});
test('abort errors localize',async()=>{setLocale('en');const c=new AbortController();c.abort();await assert.rejects(wait(new EventTarget(),'loaded',c.signal,10),err=>err.name==='AbortError'&&err.message==='Cancelled.');});
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const locale of LOCALES)for(const route of ['',...ROUTES])test(`static HTML ${locale}/${route}`,()=>{
 // Landing pages (src/landings.js) carry their own title and headline; everything else uses the tool's.
 const output=entry(html,`${locale}${route?'/'+route:''}`),id=intentFor(route),land=landingText(route,locale),title=land?.title||t(`intent.${id}.title`,{},locale);
 assert(output.includes(`<html lang="${locale}">`));assert(output.includes('id="languageSelect"'));
 if(!route){// Home is the tool directory: every tool is a real link before JavaScript runs.
  assert(output.includes(`<title>${BRAND.name} — ${ui(locale,'homeTitle')}</title>`));
  for(const [,ids] of DIRECTORY)for(const tool of ids)assert(output.includes(`href="${locale}/${INTENTS[tool].path}/"`),tool);
  assert(output.includes('id="toolQuery"')&&output.includes('data-action="pick"'));
 }else if(gamePageFor(route)){// Game landing (src/game-seo.js): its own keyword title and H1, a drop zone that opens the Studio.
  const g=gamePageFor(route),gt=g.kind==='hub'?HUB[locale].title:g.page.copy[locale].title;
  assert(output.includes(`<title>${gt.replaceAll('&','&amp;').replaceAll("'",'&#39;')} · ${BRAND.name}</title>`),route);
  assert(output.includes('<h1>')&&output.includes('data-gl-drop')&&output.includes('id="glFiles"')&&output.includes('game/studio/?ws='));
 }else if(isTask(id)){// Single-task page: heading, drop zone and picker are static HTML.
  assert(output.includes(`<title>${title.replaceAll('&','&amp;')} · ${BRAND.name}</title>`));
  assert(output.includes(`<h1 id="taskTitle">${title.replaceAll('&','&amp;')}</h1>`));assert(output.includes('class="dropzone"')&&output.includes('data-action="pick"')&&output.includes('id="fileInput"'));
 }else{
  assert(output.includes(`<title>${title.replaceAll('&','&amp;')} · ${BRAND.name}</title>`));
  assert(output.includes(`id="emptyTitle">${(land?.headline||t(`intent.${id}.headline`,{},locale)).replaceAll('&','&amp;')}</h2>`));assert(output.includes('id="emptySubtitle"'));assert(output.includes('data-action="open"'));
 }
 assert(output.includes('<base href="'+'../'.repeat(route?route.split('/').length+1:1)+'">'));
});
test('no canonical domain is invented before deployment',()=>assert(!entry(html,'en/image/upscale').includes('rel="canonical"')));
test('production base generates absolute language alternates',()=>{const h=entry(html,'ja/image/upscale','https://example.test/my-first-repo/');assert(h.includes('href="https://example.test/my-first-repo/ja/image/upscale/"'));for(const l of [...LOCALES,'x-default'])assert(h.includes(`hreflang="${l}"`));});
test('all generated routes are unique',()=>assert.equal(new Set(ALL_ROUTES).size,ALL_ROUTES.length));
