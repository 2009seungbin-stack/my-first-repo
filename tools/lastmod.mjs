/** Sitemap <lastmod> from when a page's content really changed — never the build time.
 *
 * Why a ledger: production and CI builds use shallow clones (actions/checkout depth 1, Cloudflare
 * Pages unknown), so per-page `git log` dates are not available there. tools/lastmod-ledger.json
 * records, for every language page, a hash of its visible content and the date that content was
 * committed. The build hashes each page it renders:
 *   - hash equals the ledger's → the ledger date;
 *   - hash differs (content changed and the ledger was not refreshed) → the date of the commit being
 *     built (`git log -1 --format=%cI`, works in shallow clones), or no <lastmod> at all when there is
 *     no git. A missing <lastmod> is honest; a made-up one is not.
 * `npm test` fails while the ledger is stale (tests/sitemap.test.mjs), so a content change ships
 * with its ledger entry: run `node tools/lastmod.mjs --write` and commit the ledger with the change.
 *
 * What counts as content: the <title>, the meta description and the text of <main> (site header,
 * footer, scripts, styles and inline SVG excluded). A new footer link or a new script therefore does
 * not move every page's date; a changed heading, paragraph, FAQ answer or related link does.
 *
 * Modes:
 *   node tools/lastmod.mjs --write       refresh the ledger: changed or new pages get the current time
 *                                        (the moment their new content is committed), unchanged pages
 *                                        keep their date, removed pages are dropped.
 *   node tools/lastmod.mjs --check       exit 1 and list the pages whose content is not in the ledger.
 *   node tools/lastmod.mjs --bootstrap   rebuild the ledger from history: render every first-parent
 *                                        commit of origin/main (each merge is a production deploy) and
 *                                        date each page by the merge from which its current content has
 *                                        been live without interruption; pages whose content differs
 *                                        from origin/main get the current time. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import os from 'node:os';
import path from 'node:path';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const LEDGER_PATH=path.join(ROOT,'tools','lastmod-ledger.json');
const LOCALE_ROUTE=/^(ko|en|ja)(\/|$)/;

const strip=(html,tag)=>html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`,'gi'),' ');
const decode=s=>s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g,(_,e)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'",nbsp:' '}[e]));
/** The visible content of a rendered page: title, description and the text of <main>. */
export function contentText(html){
 const title=(html.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]||'';
 const description=(html.match(/<meta name="description" content="([^"]*)"/i)||[])[1]||'';
 let main=(html.match(/<main\b[\s\S]*<\/main>/i)||[html.replace(/^[\s\S]*?<body[^>]*>/i,'')])[0];
 for(const tag of ['script','style','template','svg','footer'])main=strip(main,tag);
 // Site navigation marked data-chrome (e.g. the "Making a game?" block) is not the page's content.
 main=main.replace(/<(aside|nav|div)\b[^>]*\bdata-chrome\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
 // Link targets are content too (a related link that now points elsewhere is a change).
 main=main.replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>/gi,' [$1] ').replace(/<[^>]+>/g,' ');
 return decode([title,description,main].join('\n')).replace(/\s+/g,' ').trim();
}
export const contentHash=html=>createHash('sha256').update(contentText(html)).digest('hex').slice(0,16);
/** Only language pages carry a date (the language-neutral URL is an x-default alternate, not a <loc>). */
export const isLocaleRoute=route=>LOCALE_ROUTE.test(route);

export function readLedger(file=LEDGER_PATH){
 if(!existsSync(file))return {};
 return JSON.parse(readFileSync(file,'utf8')).pages||{};
}
/** Sorted keys, one page per line: merge conflicts stay line-local and `--write` resolves them. */
export function writeLedger(pages,file=LEDGER_PATH){
 const keys=Object.keys(pages).sort();
 writeFileSync(file,`{"about":"Content hash and last-change date of every language page. Refresh with node tools/lastmod.mjs --write (see the header of tools/lastmod.mjs).",\n"pages":{\n${keys.map(k=>`${JSON.stringify(k)}:${JSON.stringify(pages[k])}`).join(',\n')}\n}}\n`);
}
const git=(args,cwd=ROOT)=>{const r=spawnSync('git',args,{cwd,encoding:'utf8'});return r.status===0?r.stdout.trim():null;};
/** Committer date of the commit being built, W3C datetime; null without git. */
export function headDate(cwd=ROOT){const d=git(['log','-1','--format=%cI'],cwd);return d&&/^\d{4}-\d\d-\d\dT/.test(d)?d:null;}
const nowDate=()=>new Date().toISOString().replace(/\.\d+Z$/,'Z');
/** route → lastmod for the pages of one build: the ledger date when the content is unchanged. */
export function lastmodResolver(hashes,{ledger=readLedger(),fallback=headDate()}={}){
 return route=>{const h=hashes.get(route),e=ledger[route];return h&&e&&e[0]===h?e[1]:h?fallback:null;};
}
/** Hash every language page. The pages are rendered with a fixed site URL and no deploy config, so
 * the hash depends on the content only, not on where or how the build is deployed. */
export function pageHashes(entry,routes,html){
 const out=new Map();
 for(const route of routes)if(isLocaleRoute(route))out.set(route,contentHash(entry(html,route,'https://nerulio.pages.dev/',{})));
 return out;
}
export async function currentHashes(root=ROOT){
 const {entry,ALL_ROUTES}=await import(pathToFileURL(path.join(root,'tools','build.mjs')).href);
 return pageHashes(entry,ALL_ROUTES,readFileSync(path.join(root,'index.html'),'utf8'));
}
/** Pages whose rendered content has no ledger entry (or a different hash). */
export function staleRoutes(hashes,ledger=readLedger()){return [...hashes].filter(([r,h])=>ledger[r]?.[0]!==h).map(([r])=>r);}

function write(hashes,ledger){
 const now=nowDate(),next={};let changed=0,kept=0;
 for(const [route,h] of hashes){if(ledger[route]?.[0]===h){next[route]=ledger[route];kept++;}else{next[route]=[h,now];changed++;}}
 writeLedger(next);
 console.log(`lastmod ledger: ${kept} unchanged, ${changed} new or changed (dated ${now}), ${Object.keys(ledger).filter(r=>!hashes.has(r)).length} removed.`);
}
/** Hashes of one historical commit, rendered from a `git archive` of it (no worktree, no checkout). */
function hashesAt(sha){
 const dir=mkdtempSync(path.join(os.tmpdir(),'nerulio-lastmod-'));
 try{
  // Relative names: GNU tar on Windows would read "C:" in an absolute path as a remote host.
  if(git(['archive','--format=tar','-o',path.join(dir,'src.tar'),sha,'index.html','src','tools'])===null)return null;
  if(spawnSync('tar',['-xf','src.tar'],{cwd:dir}).status!==0)return null;
  const script=`import {contentHash,isLocaleRoute} from ${JSON.stringify(pathToFileURL(fileURLToPath(import.meta.url)).href)};import {entry,ALL_ROUTES} from './tools/build.mjs';import {readFileSync} from 'node:fs';const html=readFileSync('index.html','utf8'),o={};for(const r of ALL_ROUTES)if(isLocaleRoute(r))o[r]=contentHash(entry(html,r,'https://nerulio.pages.dev/',{}));console.log(JSON.stringify(o));`;
  const r=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:dir,encoding:'utf8',maxBuffer:1<<26});
  if(r.status!==0&&process.env.LASTMOD_DEBUG)console.error(r.stderr.slice(0,600));
  return r.status===0?new Map(Object.entries(JSON.parse(r.stdout))):null;
 }finally{rmSync(dir,{recursive:true,force:true});}
}
async function bootstrap(hashes){
 git(['fetch','--quiet','origin','main']);
 const log=git(['log','--first-parent','--reverse','--format=%H %cI','origin/main']);
 if(!log)throw Error('git history of origin/main is needed for --bootstrap');
 const commits=log.split('\n').map(l=>l.split(' ')),rendered=[];
 for(const [sha,date] of commits){const h=hashesAt(sha);console.log(`${sha.slice(0,7)} ${date} ${h?h.size+' pages':'not renderable, skipped'}`);if(h)rendered.push({date,h});}
 const now=nowDate(),next={};let fromHistory=0;
 for(const [route,h] of hashes){
  let since=null;
  for(let i=rendered.length-1;i>=0&&rendered[i].h.get(route)===h;i--)since=rendered[i].date;
  // Content main does not have yet (this branch) is dated now. Content unchanged since the oldest
  // renderable commit gets that commit's date: the earliest date the history can vouch for.
  if(since&&rendered.at(-1).h.get(route)===h){next[route]=[h,since];fromHistory++;}else next[route]=[h,now];
 }
 writeLedger(next);
 console.log(`lastmod ledger bootstrapped: ${fromHistory} pages dated from origin/main history, ${hashes.size-fromHistory} dated ${now} (not on main yet).`);
}
// No top-level await: tools/build.mjs imports this module, and the CLI imports tools/build.mjs; a
// top-level await here would leave that import cycle waiting on itself.
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))(async()=>{
 const hashes=await currentHashes(),ledger=readLedger();
 if(process.argv.includes('--bootstrap'))await bootstrap(hashes);
 else if(process.argv.includes('--write'))write(hashes,ledger);
 else{const stale=staleRoutes(hashes,ledger);if(stale.length){console.error(`${stale.length} pages changed since the lastmod ledger was written, e.g. ${stale.slice(0,5).join(', ')}.\nRun: node tools/lastmod.mjs --write`);process.exit(1);}console.log(`lastmod ledger current (${hashes.size} pages).`);}
})().catch(e=>{console.error(e);process.exit(1);});
