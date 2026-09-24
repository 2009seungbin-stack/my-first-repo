import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {STUDIO_ACTIONS,STUDIO_METERED,QUOTA_CLASSES,QUOTA_CLASS_NAMES,quotaClass,meteredTool,isMetered,freeStudioLimit,DEFAULT_FREE_DAILY_STUDIO_EXPORTS,counterSubject,STUDIO_SUBJECT_SUFFIX} from '../src/quota.js';
import {configuration} from '../tools/site-config.mjs';
import {studioPage,studioMonetizationHead} from '../tools/studio-build.mjs';
import {adUnitSize,adsForSession,rectDistance,clampLeftOfColumn,waitParts,AD_MIN_WIDTH,AD_MIN_HEIGHT,AD_WIDE_WIDTH} from '../src/studio/monetize/layout.js';
import {MONETIZE_STRINGS,mt} from '../src/studio/monetize/strings.js';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
async function jsFiles(dir){
 const out=[];
 for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await jsFiles(p));else if(e.name.endsWith('.js'))out.push(p);}
 return out;
}
const AD={ADSENSE_CLIENT:'ca-pub-3141592653589793',SITE_URL:'https://nerulio.test'};

test('Studio quota classification: every action has a class; only engine export bundles are metered',()=>{
 assert(QUOTA_CLASS_NAMES.includes('studio'));
 for(const [id,cls] of Object.entries(STUDIO_ACTIONS)){
  assert(id.startsWith('studio-'),id);assert(['none','studio'].includes(cls),id);
  assert.equal(quotaClass(id),cls,id);
  assert(!Object.hasOwn(QUOTA_CLASSES,id),'Studio ids stay out of the INTENTS table: '+id);
 }
 assert.deepEqual([...STUDIO_METERED].sort(),['studio-pack-export','studio-texture-export','studio-tile-export']);
 // light actions are never counted: no metered id → the client never calls the API for them
 for(const id of Object.keys(STUDIO_ACTIONS).filter(id=>STUDIO_ACTIONS[id]==='none')){assert.equal(meteredTool(id),'',id);assert.equal(isMetered(id),false,id);}
 for(const id of ['studio-import','studio-open-project','studio-save-project','studio-autosave','studio-edit','studio-undo','studio-preview','studio-aseprite-export','studio-texture-quick-png','studio-texture-channel-pack'])assert.equal(STUDIO_ACTIONS[id],'none',id);
 for(const id of STUDIO_METERED)assert.equal(meteredTool(id),id);
 assert.equal(quotaClass('studio-nope'),null);assert.equal(quotaClass(undefined),null);assert.equal(quotaClass('__proto__'),null);
});
test('every meter() call in the Studio uses a metered, classified action id',async()=>{
 const calls=[];
 for(const f of await jsFiles(path.join(ROOT,'src/studio'))){
  const src=await readFile(f,'utf8');
  for(const m of src.matchAll(/\bmeter\(\s*(['"`])([^'"`]*)\1\s*\)/g))calls.push({file:path.relative(ROOT,f),id:m[2]});
  // no dynamic ids: a call site must name its action literally so this test can see it
  assert(!/\bmeter\(\s*[^'"`\s)]/.test(src.replace(/function meter\(|export async function meter\(action\)/g,'')),`dynamic meter() id in ${f}`);
 }
 const ids=new Set(calls.map(c=>c.id));
 for(const c of calls)assert.equal(STUDIO_ACTIONS[c.id],'studio',`${c.file}: ${c.id}`);
 for(const id of STUDIO_METERED)assert(ids.has(id),`metered action ${id} has no call site`);
});
test('Studio export limit: default, validation and separate counter subject',()=>{
 assert.equal(DEFAULT_FREE_DAILY_STUDIO_EXPORTS,10);
 assert.equal(freeStudioLimit('3'),3);assert.equal(freeStudioLimit('10000'),10000);
 for(const v of [undefined,'','0','-2','x','1.5','10001'])assert.equal(freeStudioLimit(v),10,String(v));
 assert.equal(counterSubject('a:x','studio'),'a:x'+STUDIO_SUBJECT_SUFFIX);assert.equal(counterSubject('a:x','heavy'),'a:x');
 assert.equal(configuration({FREE_DAILY_STUDIO_EXPORTS:'25'}).freeDailyStudio,25);assert.equal(configuration({}).freeDailyStudio,10);
});
test('ADSENSE_SLOT_STUDIO: validated like content slots, needs the CMP flag, off in previews, never a content slot',()=>{
 assert.equal(configuration({}).studioAd,null);
 assert.throws(()=>configuration({...AD,ADSENSE_SLOT_STUDIO:'12345'}),/ADSENSE_SLOT_STUDIO must be the 10-digit/);
 assert.throws(()=>configuration({...AD,ADSENSE_SLOT_STUDIO:'12345678901'}),/ADSENSE_SLOT_STUDIO/);
 assert.throws(()=>configuration({...AD,ADSENSE_SLOT_STUDIO:'1234567890'}),/ADSENSE_CMP_READY/);
 const on=configuration({...AD,ADSENSE_SLOT_STUDIO:'1234567890',ADSENSE_CMP_READY:'true'});
 assert.deepEqual(on.studioAd,{client:AD.ADSENSE_CLIENT,slot:'1234567890'});assert.deepEqual(on.slots,{},'the Studio unit is not a content slot');
 assert.equal(configuration({ADSENSE_SLOT_STUDIO:'1234567890'}).studioAd,null,'no client, no unit');
 assert.equal(configuration({...AD,ADSENSE_SLOT_STUDIO:'1234567890',ADSENSE_CMP_READY:'true',CF_PAGES_BRANCH:'feature'}).studioAd,null,'previews never serve ads');
 const both=configuration({...AD,ADSENSE_SLOT_STUDIO:'1234567890',ADSENSE_SLOT_CONTENT_1:'1111111111',ADSENSE_CMP_READY:'true'});
 assert.deepEqual(both.slots,{'content-1':'1111111111'});
});
test('Studio page head: nothing extra by default; config metas only, never a Google tag or inline script',()=>{
 const plain=studioPage({locale:'en',base:'../../'});
 assert(!plain.includes('monetize')&&!plain.includes('nerulio-service')&&!plain.includes('nerulio-studio-ad'),'unchanged when monetization is off');
 assert.equal(studioMonetizationHead({}),'');
 const ad=studioPage({locale:'ko',base:'../../../',config:configuration({...AD,ADSENSE_SLOT_STUDIO:'1234567890',ADSENSE_CMP_READY:'true'})});
 assert(ad.includes('<meta name="nerulio-studio-ad"')&&ad.includes('1234567890')&&ad.includes('src/studio/monetize/monetize.css')&&ad.includes('src/studio/monetize/boot.js'));
 assert(!ad.includes('googlesyndication')&&!ad.includes('adsbygoogle'),'the Google tag is requested only after the plan is known');
 assert(!/<script(?![^>]*\bsrc=)/.test(ad),'no inline script');
 assert(ad.indexOf('monetize.css')<ad.indexOf('src/studio/main.js')&&ad.indexOf('boot.js')<ad.indexOf('src/studio/main.js'),'css + early /me before the editor');
 const svc=studioPage({locale:'ja',base:'../../../',config:configuration({SERVICE_API:'on',FREE_DAILY_STUDIO_EXPORTS:'7'})});
 assert(svc.includes('<meta name="nerulio-service"')&&svc.includes('&quot;freeDailyStudio&quot;:7')&&!svc.includes('nerulio-studio-ad'));
});
test('ad column geometry: desktop-only, fixed unit chosen once by viewport',()=>{
 assert.equal(adUnitSize(390,844),null);assert.equal(adUnitSize(768,1024),null);assert.equal(adUnitSize(1279,900),null);assert.equal(adUnitSize(1440,699),null);
 assert.deepEqual(adUnitSize(1280,720),{width:160,height:600,column:200});
 assert.deepEqual(adUnitSize(1440,900),{width:160,height:600,column:200});
 assert.deepEqual(adUnitSize(1920,1080),{width:300,height:600,column:340});
 assert.equal(AD_MIN_WIDTH,1280);assert.equal(AD_MIN_HEIGHT,700);assert.equal(AD_WIDE_WIDTH,1600);
 assert.equal(rectDistance({left:0,top:0,right:10,bottom:10},{left:13,top:0,right:20,bottom:10}),3);
 assert.equal(rectDistance({left:0,top:0,right:10,bottom:10},{left:5,top:5,right:20,bottom:20}),0);
 assert.equal(clampLeftOfColumn(1100,220,1248),1024);assert.equal(clampLeftOfColumn(100,220,1248),100);
 assert.deepEqual(waitParts(3*3600e3+61e3),{h:3,m:2});assert.deepEqual(waitParts(-5),{h:0,m:0});
});
test('ad session decision: Pro, outage and timeout never request ads (entitlement gating)',()=>{
 const cfg={client:'ca-pub-3141592653589793',slot:'1234567890'};
 assert.deepEqual(adsForSession(null,{enabled:true,status:'ready',me:{ads:true}}),{ads:false,reason:'not-configured'});
 assert.equal(adsForSession(cfg,{enabled:false}).ads,true,'no accounts: every visitor is Free');
 assert.equal(adsForSession(cfg,{enabled:true,status:'unconfigured'}).ads,true);
 assert.deepEqual(adsForSession(cfg,{enabled:true,status:'ready',me:{plan:'free',ads:true}}),{ads:true,reason:'free'});
 assert.deepEqual(adsForSession(cfg,{enabled:true,status:'ready',me:{plan:'pro',ads:false}}),{ads:false,reason:'pro'});
 assert.deepEqual(adsForSession(cfg,{enabled:true,status:'offline',me:null}),{ads:false,reason:'unreachable'});
 assert.deepEqual(adsForSession(cfg,{enabled:true,status:'timeout',me:null}),{ads:false,reason:'timeout'});
 assert.equal(adsForSession(cfg,{enabled:true,status:'ready',me:{plan:'free'}}).ads,false,'only an explicit ads:true from the server shows ads');
});
test('monetization strings: ko/en/ja parity, same placeholders, no Hangul in ja',()=>{
 const en=Object.keys(MONETIZE_STRINGS.en).sort();
 for(const l of ['ko','ja']){
  assert.deepEqual(Object.keys(MONETIZE_STRINGS[l]).sort(),en,l);
  for(const k of en){const slots=s=>[...String(s).matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join();assert.equal(slots(mt(l,k)),slots(mt('en',k)),`${l}:${k}`);
   assert(!/[가-힣]/.test(mt('ja',k)),`ja ${k}`);}
  assert.equal(mt(l,'limit.bullets').split('|').length,mt('en','limit.bullets').split('|').length);
 }
 assert.equal(mt('ko','ad.label'),'광고');assert.equal(mt('en','ad.label'),'Advertisement');assert.equal(mt('ja','ad.label'),'広告');
 assert.equal(mt('en','meter.left',{n:2}),'Free Studio exports left today: 2');
});
