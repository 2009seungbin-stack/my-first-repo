import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TASK_TOOLS,DIRECTORY,SUGGEST,BADGES,kindOf,isTask} from '../src/task/registry.js';
import {UI_STRINGS,ui} from '../src/task/strings.js';
import {INTENTS} from '../src/intents.js';
import {LANDINGS,LANDING_PATHS} from '../src/landings.js';
import {entry} from '../tools/build.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),origin='https://nerulio.example.test/';

test('home directory lists every tool exactly once and nothing unknown',()=>{
 const listed=DIRECTORY.flatMap(([,ids])=>ids);
 assert.equal(new Set(listed).size,listed.length,'no duplicates');
 assert.deepEqual([...listed].sort(),Object.keys(INTENTS).filter(id=>id!=='home').sort());
 for(const id of [...Object.keys(TASK_TOOLS),...Object.values(SUGGEST).flat(),...Object.keys(BADGES),...Object.values(TASK_TOOLS).flatMap(d=>d.next)])assert(INTENTS[id],id);
});
test('task UI copy is complete in ko/en/ja',()=>{
 const keys=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?keys(v,p+k+'.'):[p+k]);
 const en=keys(UI_STRINGS.en).sort();
 for(const l of ['ko','ja'])assert.deepEqual(keys(UI_STRINGS[l]).sort(),en,l);
 assert.equal(ui('ko','files',{n:3}),'3개 파일');assert.equal(ui('xx','pick'),'Choose files');
});
test('file kinds are recognised by type or extension',()=>{
 for(const [name,type,kind] of [['a.PNG','','image'],['x','image/webp','image'],['doc.pdf','','pdf'],['x','application/pdf','pdf'],['clip.MOV','','media'],['s','audio/mpeg','media'],['notes.txt','text/plain','']])assert.equal(kindOf({name,type}),kind,name+type);
});
test('migrated tools and their landing pages render the task page; others keep the editor',()=>{
 const task=entry(html,'ko/image/compress',origin);
 assert(task.includes('src/task/shell.js')&&!task.includes('src/app.js'),'task page does not load the editor bundle');
 assert(task.includes('data-tool="compress"')&&task.includes('data-ad-exclude')&&task.includes('id="siteContent"'));
 assert(task.includes(`rel="canonical" href="${origin}ko/image/compress/"`));
 const landing=LANDING_PATHS.find(p=>isTask(LANDINGS[p].intent)),page=entry(html,`en/${landing}`,origin);
 assert(page.includes(`data-landing="${landing}"`)&&page.includes(`rel="canonical" href="${origin}en/${landing}/"`)&&page.includes('src/task/shell.js'));
 const editor=entry(html,'en/image/crop',origin);assert(editor.includes('src/app.js')&&!editor.includes('src/task/shell.js'));
 const home=entry(html,'ja',origin);assert(home.includes('class="task-page home-page"')&&home.includes(`rel="canonical" href="${origin}ja/"`)&&!home.includes('noindex'));
 assert(entry(html,'',origin).includes('href="image/compress/"'),'language-neutral home links stay language-neutral');
});
