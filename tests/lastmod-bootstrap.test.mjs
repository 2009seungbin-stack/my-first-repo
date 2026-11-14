import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,copyFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('historical lastmod includes platform imports and leaves the ledger intact when latest main cannot render',()=>{
 const temp=path.resolve(os.tmpdir()),root=mkdtempSync(path.join(temp,'nerulio-lastmod-test-'));
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 const put=(name,text)=>{mkdirSync(path.dirname(path.join(root,name)),{recursive:true});writeFileSync(path.join(root,name),text);};
 const commit=()=>{git('add','.');git('-c','user.name=Lastmod fixture','-c','user.email=lastmod@example.invalid','-c','core.hooksPath=','commit','-qm','Fixture content');};
 const bootstrap=()=>spawnSync(process.execPath,['tools/lastmod.mjs','--bootstrap'],{cwd:root,encoding:'utf8'});
 try{
  git('init','-q','--initial-branch=main');git('remote','add','origin','.');
  put('package.json','{"type":"module"}');put('index.html','<main>Template</main>');
  put('src/seo.js','export function withPortal(on,render){return render();}');
  put('platform/content.js','export const body="A real archived platform paragraph";');
  put('tools/build.mjs','import {body} from "../platform/content.js"; export const ALL_ROUTES=["en/a"]; export const entry=()=>`<title>Fixture</title><main>${body}</main>`;');
  copyFileSync(new URL('../tools/lastmod.mjs',import.meta.url),path.join(root,'tools','lastmod.mjs'));
  commit();
  const first=bootstrap();assert.equal(first.status,0,first.stderr);assert.match(first.stdout,/1 pages dated from origin\/main history, 0 dated/);
  const ledger=path.join(root,'tools','lastmod-ledger.json'),before=readFileSync(ledger,'utf8');
  assert.equal(JSON.parse(before).pages['en/a'][1],git('log','-1','--format=%cI'));
  // The working tree can import this folder, but it is deliberately absent from the archive inputs.
  put('unarchived/content.js','export const body="New content outside supported archive inputs";');
  put('tools/build.mjs','import {body} from "../unarchived/content.js"; export const ALL_ROUTES=["en/a"]; export const entry=()=>`<title>Fixture</title><main>${body}</main>`;');
  commit();
  const incomplete=bootstrap();assert.notEqual(incomplete.status,0);assert.match(incomplete.stderr,/Latest origin\/main could not be rendered; lastmod ledger was not changed/);
  assert.equal(readFileSync(ledger,'utf8'),before,'a failed historical import must not redate existing pages');
 }finally{
  const resolved=path.resolve(root);assert.equal(path.dirname(resolved),temp);assert.ok(path.basename(resolved).startsWith('nerulio-lastmod-test-'));
  rmSync(resolved,{recursive:true,force:true});
 }
});
