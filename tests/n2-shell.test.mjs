import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FILE_TOOLS,GAME_TOOLS,toolHref,toolsHome} from '../platform/tools-nav.js';
import {INTENTS} from '../src/intents.js';
import {DIRECTORY} from '../src/task/registry.js';
import {page,homeUrl,profilePath,hasProfile} from '../platform/render/ui.js';
import {statusState,statusText} from '../platform/render/rail.js';

test('the menu\'s file and game tools are real tool pages of the right family',()=>{
 const game=new Set(DIRECTORY.find(([c])=>c==='game')?.[1]||[]);
 for(const x of [...FILE_TOOLS,...GAME_TOOLS]){
  assert(INTENTS[x.id],`${x.id} is a tool`);
  assert.equal(x.path,INTENTS[x.id].path,`${x.id} path`);
  assert(x.ko&&x.en&&x.ic,`${x.id} names`);
 }
 for(const x of GAME_TOOLS)assert(game.has(x.id),`${x.id} is a game tool`);
 for(const x of FILE_TOOLS)assert(!game.has(x.id),`${x.id} is a file tool`);
 assert.equal(toolHref('ko',FILE_TOOLS[0]),'/ko/image/compress/');assert.equal(toolsHome('en'),'/en/tools/');
});

test('shell: portal home addresses, profile links, dark-mode button and the menu drawer',async()=>{
 assert.equal(homeUrl('ko'),'/');assert.equal(homeUrl('en'),'/en/');
 assert.equal(profilePath('ko','코드장인'),'/ko/community/u/%EC%BD%94%EB%93%9C%EC%9E%A5%EC%9D%B8');
 assert(hasProfile('코드장인')&&!hasProfile('ㅇㅇ')&&!hasProfile('user-3fa9c2')&&!hasProfile(null));
 const out=String(page({l:'ko',title:'t',description:'d',canonical:'https://nerulio.com/ko/community/ai/',channels:[],body:'<p>x</p>'}));
 assert(out.indexOf('/src/platform/theme.js')<out.indexOf('/src/platform/n2.css'),'the theme applies before the stylesheet paints');
 assert(out.includes('data-theme-toggle')&&out.includes('id="lnav"')&&out.includes('data-drawer-open'));
 assert(out.includes('<details class="lg" id="nav-file" open>')&&out.includes('<details class="lg" id="nav-game">'),'file tools open, game tools folded');
 assert(!out.includes('data-theme="dark"'),'white unless the reader chose dark');
 const css=await readFile(new URL('../src/platform/n2.css',import.meta.url),'utf8');
 assert(!css.includes('prefers-color-scheme:dark'),'the OS setting does not turn the pages dark');
 assert(css.includes(':root[data-theme="dark"]'));
});

test('AI status wording: incident, report spike, checked, or only the report count',()=>{
 assert.equal(statusState({open:true,spike:true,checked:true,total24:9}),'bad');
 assert.equal(statusState({open:false,spike:true,checked:true,total24:9}),'warn');
 assert.equal(statusState({open:false,spike:false,checked:true,total24:2}),'ok');
 assert.equal(statusState({open:false,spike:false,checked:false,total24:0}),'unk');
 assert.equal(statusText('warn',9,'ko'),'리포트 급증');assert.equal(statusText('ok',0,'ko'),'정상');
 assert.equal(statusText('unk',0,'ko'),'리포트 없음');assert.equal(statusText('unk',3,'ko'),'리포트 3건');assert.equal(statusText('bad',0,'en'),'Incident');
});

test('icons: every name used by the menu, channels, tiers and status exists; avatars are stable per name',async()=>{
 const {icon,ICON_NAMES,CHANNEL_ICON,TIER_ICON,STATUS_ICON,REPORT_ICON,FEED_ICON,identicon}=await import('../platform/render/icons.js');
 assert(ICON_NAMES.includes(REPORT_ICON)&&ICON_NAMES.includes(FEED_ICON),'the 안 돼요 and feed icons');
 const {CHANNELS}=await import('../platform/channels.js');
 for(const n of [...FILE_TOOLS,...GAME_TOOLS].map(x=>x.svg))assert(ICON_NAMES.includes(n),n);
 for(const c of CHANNELS)assert(ICON_NAMES.includes(CHANNEL_ICON[c.id]),c.id);
 for(const n of [...Object.values(TIER_ICON),...Object.values(STATUS_ICON)])assert(ICON_NAMES.includes(n),n);
 const svg=String(icon('eye'));assert(svg.includes('aria-hidden="true"')&&svg.includes('stroke="currentColor"'));
 assert.throws(()=>icon('nope'));
 assert.equal(String(identicon('코드장인')),String(identicon('코드장인')));assert.notEqual(String(identicon('코드장인')),String(identicon('측정러')));
});

test('fonts: SUIT and JetBrains Mono are served from this site, every file the CSS names exists',async()=>{
 const {access}=await import('node:fs/promises');
 const out=String(page({l:'ko',title:'t',description:'d',canonical:'https://nerulio.com/',channels:[],body:''}));
 assert(out.indexOf('/src/platform/fonts.css')>0&&out.indexOf('/src/platform/fonts.css')<out.indexOf('/src/platform/n2.css'),'fonts before the stylesheet');
 const css=await readFile(new URL('../src/platform/fonts.css',import.meta.url),'utf8');
 const urls=[...css.matchAll(/url\((\/assets\/fonts\/[^)]+)\)/g)].map(m=>m[1]);
 assert(urls.length>=50,'SUIT is split into chunks');
 for(const u of urls)await access(new URL('..'+u,import.meta.url));
 assert(!/https?:/.test(css.replace(/\/\*[\s\S]*?\*\//g,'')),'no font CDN (font-src \'self\')');
 const n2=await readFile(new URL('../src/platform/n2.css',import.meta.url),'utf8');
 assert(/body\.n2\{[^}]*font-family:SUIT,/.test(n2));
});
