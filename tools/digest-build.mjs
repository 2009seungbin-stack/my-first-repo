// AI weekly digest sources (docs/AI-DIGEST.md): content/ai-digest/YYYY-MM-DD-slug.{ko,en}.md with a
// small frontmatter block. Every file is validated (a broken draft fails the build early), but only
// `status: published` articles are written into the Worker's platform/digest-data.js.
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const DIGEST_DIR=fileURLToPath(new URL('../content/ai-digest/',import.meta.url));
export const DIGEST_FILE=/^(\d{4}-\d{2}-\d{2})-([a-z0-9][a-z0-9-]{0,80})\.(ko|en)\.md$/;
export const DIGEST_STATUSES=Object.freeze(['draft','published']);
const DATE=/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** "quoted", 'quoted' or bare scalar. @param {string} v */
function scalar(v){
 v=v.trim();
 if(v.startsWith('"')&&v.endsWith('"')&&v.length>=2)return JSON.parse(v);
 if(v.startsWith("'")&&v.endsWith("'")&&v.length>=2)return v.slice(1,-1).replace(/''/g,"'");
 return v;
}
/** @param {string} v */
const httpUrl=v=>{try{const u=new URL(v);return (u.protocol==='https:'||u.protocol==='http:')&&!u.username&&!u.password;}catch{return false;}};

/**
 * Parse and validate one digest file. Throws with the file name on any problem.
 * @param {string} name the file name (YYYY-MM-DD-slug.ko.md) @param {string} text
 * @returns {import('../platform/digest.js').DigestArticle}
 */
export function parseDigest(name,text){
 const fail=(/** @type {string} */ m)=>{throw new Error(`content/ai-digest/${name}: ${m}`);};
 const file=DIGEST_FILE.exec(name);if(!file)fail('the name must be YYYY-MM-DD-slug.ko.md or .en.md');
 const [,fileDate,slug,locale]=/** @type {RegExpExecArray} */(file);
 const src=text.replace(/^﻿/,'').replace(/\r\n?/g,'\n');
 const m=/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src);if(!m)fail('missing the --- frontmatter --- block');
 const [,head,body]=/** @type {RegExpExecArray} */(m);
 /** @type {Record<string,any>} */const fm={};/** @type {Record<string,string>[]|null} */let list=null;
 for(const line of head.split('\n')){
  if(!line.trim()||/^\s*#/.test(line))continue;
  const item=/^\s+-\s+([a-z]+):\s*(.*)$/.exec(line),cont=/^\s{3,}([a-z]+):\s*(.*)$/.exec(line),top=/^([a-z_]+):\s*(.*)$/.exec(line);
  if(item&&list){list.push({[item[1]]:scalar(item[2])});continue;}
  if(cont&&list&&list.length){list[list.length-1][cont[1]]=scalar(cont[2]);continue;}
  if(top){
   if(Object.prototype.hasOwnProperty.call(fm,top[1]))fail(`duplicate key ${top[1]}`);
   if(top[1]==='sources'&&!top[2].trim()){list=[];fm.sources=list;continue;}
   list=null;fm[top[1]]=scalar(top[2]);continue;
  }
  fail(`cannot read frontmatter line: ${line}`);
 }
 for(const k of Object.keys(fm))if(!['title','date','updated','summary','status','sources'].includes(k))fail(`unknown key ${k}`);
 for(const k of ['title','summary'])if(typeof fm[k]!=='string'||!fm[k].trim())fail(`${k} is required`);
 if(fm.date!==fileDate)fail(`date (${fm.date}) must match the file name (${fileDate})`);
 if(!DATE.test(fileDate))fail('invalid date');
 const updated=fm.updated===undefined||fm.updated===''?fileDate:fm.updated;
 if(!DATE.test(updated)||updated<fileDate)fail('updated must be a date on or after date');
 if(!DIGEST_STATUSES.includes(fm.status))fail('status must be draft or published');
 const sources=Array.isArray(fm.sources)?fm.sources:[];
 if(!sources.length)fail('sources must list at least one {title,url}');
 for(const s of sources){
  if(Object.keys(s).some(k=>k!=='title'&&k!=='url'))fail('a source has only title and url');
  if(typeof s.title!=='string'||!s.title.trim())fail('every source needs a title');
  if(typeof s.url!=='string'||!httpUrl(s.url))fail(`source url must be http(s): ${s.url}`);
 }
 if(!body.trim())fail('the article body is empty');
 return {slug,locale,date:fileDate,updated,title:fm.title.trim(),summary:fm.summary.trim(),status:fm.status,sources:sources.map(s=>({title:s.title.trim(),url:s.url.trim()})),body:body.trim()+'\n'};
}

/** Every digest file of a folder (drafts included), validated; a missing folder is an empty digest.
 * @param {string} [dir] */
export async function loadDigest(dir=DIGEST_DIR){
 let names=[];try{names=(await readdir(dir)).filter(n=>n.endsWith('.md')&&n.toLowerCase()!=='readme.md');}catch(e){if(/** @type {any} */(e)?.code==='ENOENT')return [];throw e;}
 const out=[],seen=new Map();
 for(const name of names.sort()){
  const a=parseDigest(name,await readFile(path.join(dir,name),'utf8'));
  const key=`${a.locale}:${a.slug}`;
  if(seen.has(key))throw new Error(`content/ai-digest/${name}: slug "${a.slug}" is already used by ${seen.get(key)}`);
  seen.set(key,name);out.push(a);
 }
 return out;
}
/** Only what may be public. @param {import('../platform/digest.js').DigestArticle[]} list */
export const publishedDigest=list=>list.filter(a=>a.status==='published');
/** The Worker module that replaces platform/digest-data.js in the build. @param {import('../platform/digest.js').DigestArticle[]} list */
export const digestDataModule=list=>`export default Object.freeze(${JSON.stringify(publishedDigest(list))});\n`;
