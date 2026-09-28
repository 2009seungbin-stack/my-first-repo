import {DEPTH} from '../../src/seo-depth/index.js';
import {validCanonical,assertNoSecrets,hash,fingerprint} from './common.mjs';
import {inventory,recipes} from './inventory.mjs';
const words=s=>s.toLowerCase().match(/[a-z0-9]+/g)||[];
function shingles(text){const w=words(text),s=new Set();for(let i=0;i+8<=w.length;i++)s.add(w.slice(i,i+8).join(' '));return s;}
export function validate(article,ledger={entries:[]},env={}){
 const errors=[],page=inventory(ledger).pages.find(p=>p.route===article.sourceRoute),body=article.body_markdown||'';
 if(!page)errors.push('Source is not an existing indexable English game page');
 if(!validCanonical(article.canonical_url)||article.canonical_url!==page?.canonical)errors.push('Canonical must exactly match the Nerulio source');
 if(!article.title?.trim()||article.title.length>128)errors.push('Title is empty or too long');
 if(!page?.articleReady||article.sourceDigest!==page?.sourceDigest)errors.push('Source adaptation is missing or stale');
 if(!Array.isArray(article.tags)||article.tags.length<1||article.tags.length>4||new Set(article.tags).size!==article.tags.length||article.tags.some(t=>!(/^[a-z0-9]{1,30}$/).test(t)))errors.push('Invalid DEV tags (one to four unique alphanumeric tags)');
 if(page&&JSON.stringify(article.tags)!==JSON.stringify(recipes()[page.route.slice(4,-1)]?.tags))errors.push('Tags do not match the reviewed topic');
 if(page&&!page.sourceEvidence.some(e=>e.exists))errors.push('No existing repository evidence');
 if(/\b(?:TODO|TBD|FIXME|lorem ipsum|insert screenshot|your api key)\b|\{\{|\{%|^---\s*$/im.test(body))errors.push('Placeholder, front matter or executable embed rejected');
 const sections=body.split(/^## /m).slice(1),wc=words(body).length;
 if(wc<300||sections.length<4||!/^## .*Example/im.test(body)||!/^## .*Troubleshoot/im.test(body)||!/^## .*Check/im.test(body)||!(/```[\s\S]+?```|\|[^\n]+\|/).test(body)||!/^1\. /m.test(body))errors.push('Needs substantive explanation, worked example, steps, checks and troubleshooting');
 if(/best tool|guaranteed|works perfectly|millions of users|I (?:used|tested|built)|we (?:tested|benchmarked)/i.test(body))errors.push('Unsupported promotional or experience claim');
 const mentions=[...body.matchAll(/Nerulio/gi)];
 if(mentions.length>2||mentions.some(m=>m.index<body.length*0.70))errors.push('Product mention must be brief and near the end');
 const links=[...body.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(m=>m[1]);
 const own=links.filter(u=>{try{return new URL(u).hostname.endsWith('nerulio.com');}catch{return false;}});
 if(own.length<1||own.length>2||own.some(u=>u!==page?.canonical))errors.push('CTA must point to the exact existing source');
 if(/!\[/.test(body))errors.push('Images require separate editorial approval; text recipes do not embed screenshots');
 if(article.contentHash!==hash(body)||article.fingerprint!==fingerprint(body))errors.push('Content hashes do not match');
 if(ledger.entries.some(e=>e.sourceRoute!==article.sourceRoute&&e.fingerprint===article.fingerprint))errors.push('Fingerprint already exists for another source');
 if(page){
  const a=shingles(body),b=shingles(JSON.stringify(DEPTH[page.route.slice(4,-1)].en));
  const overlap=[...a].filter(s=>b.has(s)).length/(a.size||1);
  if(overlap>0.3)errors.push('Too much source wording copied');
 }
 try{assertNoSecrets(article,env);}catch{errors.push('Secret-like content rejected; value withheld');}
 return {ok:errors.length===0,errors,checks:{words:wc,sections:sections.length,canonical:article.canonical_url,sourceExists:!!page}};
}
export async function checkLiveSource(url,fetchImpl=fetch){
 if(!validCanonical(url))throw Error('Invalid live source URL');
 const r=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(20000)});
 if(r.status!==200||!/text\/html/i.test(r.headers.get('content-type')||'')||/noindex/i.test(r.headers.get('x-robots-tag')||''))throw Error('Live source is not indexable HTML');
 const html=await r.text();
 const metas=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]);
 if(metas.some(m=>/name\s*=\s*["'](?:robots|googlebot)["']/i.test(m)&&/noindex/i.test(m)))throw Error('Live source has noindex');
 const tags=[...html.matchAll(/<link\b[^>]*>/gi)].map(m=>m[0]).filter(t=>/rel\s*=\s*["']canonical["']/i.test(t));
 if(tags.length!==1||tags[0].match(/href\s*=\s*["']([^"']+)["']/i)?.[1]!==url)throw Error('Live source canonical mismatch');
}
