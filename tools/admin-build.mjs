/** The owner-only admin app (src/admin → dist/admin), built only when SERVICE_API=on and PLATFORM=on
 * (tools/service-build.mjs calls emitAdmin). Static files served straight from Pages (never the
 * Worker: _routes.json leaves /admin/* out), with their own strict CSP and noindex headers.
 * The service worker gets the app's file list and a content hash, so each deploy replaces its cache. */
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ADMIN_SRC=fileURLToPath(new URL('../src/admin/',import.meta.url));
/** Scripts only from this origin, no inline script or style; IBM Plex from Google Fonts (the SW
 * caches it, hence connect-src). */
export const ADMIN_CSP="default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
/** Appended to _headers in admin builds. */
export const ADMIN_HEADERS=`/admin/*
  ! Content-Security-Policy
  Content-Security-Policy: ${ADMIN_CSP}
  ! X-Robots-Tag
  X-Robots-Tag: noindex, nofollow
  Cross-Origin-Opener-Policy: same-origin
`;
/** True for a path inside src/admin (the generic src/ copy leaves it out). @param {string} p */
export const isAdminSource=p=>{const rel=path.relative(ADMIN_SRC,p);return rel===''||(!rel.startsWith('..')&&!path.isAbsolute(rel));};

/** Every file of the app, as paths relative to src/admin (forward slashes, sorted). @param {string} [dir] */
export async function adminFiles(dir=ADMIN_SRC){
 const out=[];
 for(const e of await readdir(dir,{withFileTypes:true})){
  const p=path.join(dir,e.name);
  if(e.isDirectory())out.push(...await adminFiles(p));else out.push(p);
 }
 return dir===ADMIN_SRC?out.map(p=>path.relative(ADMIN_SRC,p).split(path.sep).join('/')).sort():out;
}
/** sw.js with its version and app-shell list filled in. @param {string} source @param {string[]} files @param {string} version */
export function prepareServiceWorker(source,files,version){
 const shell=['/admin/',...files.filter(f=>f!=='sw.js'&&f!=='index.html').map(f=>'/admin/'+f)];
 const out=source.replace("const VERSION='dev';",`const VERSION='${version}';`).replace('const SHELL=[];',`const SHELL=${JSON.stringify(shell)};`);
 if(out===source)throw Error('sw.js placeholders not found');
 return out;
}
/** Content hash of the app (10 hex). @param {{file:string,data:Buffer}[]} entries */
export const versionOf=entries=>{const h=createHash('sha256');for(const e of entries){h.update(e.file);h.update(e.data);}return h.digest('hex').slice(0,10);};
/** Reads the app and returns every output file (relative path → contents). */
export async function adminBundle(){
 const files=await adminFiles();
 const entries=await Promise.all(files.map(async file=>({file,data:await readFile(path.join(ADMIN_SRC,file))})));
 const version=versionOf(entries);
 /** @type {Map<string,Buffer|string>} */const out=new Map();
 for(const {file,data} of entries){
  if(file==='sw.js')out.set(file,prepareServiceWorker(data.toString('utf8'),files,version));
  else if(file==='index.html')out.set(file,data.toString('utf8').replace('<meta name="admin-version" content="dev">',`<meta name="admin-version" content="${version}">`));
  else out.set(file,data);
 }
 return {version,files:out};
}
/** Writes dist/admin. @param {string} dist */
export async function emitAdmin(dist){
 const {version,files}=await adminBundle();
 for(const [file,data] of files){const to=path.join(dist,'admin',...file.split('/'));await mkdir(path.dirname(to),{recursive:true});await writeFile(to,data);}
 return version;
}
