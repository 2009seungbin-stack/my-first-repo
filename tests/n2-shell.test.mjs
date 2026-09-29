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
