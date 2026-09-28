import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {sitemapGroups} from '../sitemaps.mjs';
import {gamePageFor} from '../game-landing-build.mjs';
import {gameIndexable} from '../game-seo-build.mjs';
import {DEPTH,GROUPS} from '../../src/seo-depth/index.js';
import {SHOTS} from '../../src/game-seo.js';
import {ROOT,canonical,hash} from './common.mjs';

export function sourceDigest(p){return hash(JSON.stringify({depth:DEPTH[p]?.en,intent:DEPTH[p]?.intent,copy:gamePageFor(p)?.page?.copy.en}));}
export const recipes=()=>JSON.parse(readFileSync(path.join(ROOT,'tools/distribution/articles/manifest.json'),'utf8'));
export function classification(p,d,group){
 if(d.type==='troubleshoot')return ['troubleshooting',1,'Concrete symptom, diagnosis and checks'];
 if(d.type==='compare')return ['comparison',10,'Comparison requires explicit scope and limitations'];
 if(/unity/i.test(p))return ['engine workflow',8,'Unity import/export workflow'];
 if(d.type==='engine'||/to-godot|godot-sprite|to-phaser|texturepacker-to/.test(p))return ['engine workflow',2,'Specific engine handoff'];
 if(/aseprite/.test(p))return ['file-format conversion',3,'Aseprite metadata and timing workflow'];
 if(/sprite|pack/.test(group))return ['sprite workflow',4,'Concrete frame or atlas task'];
 if(/pixel/.test(group))return ['pixel-art workflow',5,'Pixel editing or cleanup task'];
 if(/tile/.test(group))return ['tileset/autotile workflow',6,'Tile layout, terrain or collision task'];
 if(/texture/.test(group))return ['texture/normal-map workflow',7,'Texture channels or lighting task'];
 return [d.type==='format'?'technical explanation':'practical tutorial',9,'Format/reference or supporting art workflow'];
}
export function inventory(ledger={entries:[]}){
 const groups=sitemapGroups(),catalog=recipes();
 const pages=groups.game.filter(p=>{const game=gamePageFor(p);return p&&p!=='game'&&DEPTH[p]?.en&&game&&gameIndexable(game);}).map(p=>{
  const d=DEPTH[p],g=gamePageFor(p),group=Object.entries(GROUPS).find(([,ps])=>ps.includes(p))?.[0];
  const [contentType,priority,priorityReason]=classification(p,d,group),route='/en/'+p+'/';
  const recipe=catalog[p],digest=sourceDigest(p),articleReady=!!recipe&&recipe.sourceDigest===digest;
  const evidence=(d.intent.evidence||[]).map(label=>({label,path:label.match(/^(?:src|docs|tests|tools)\/[\w./-]+/)?.[0]})).map(e=>({...e,exists:!!e.path&&existsSync(path.join(ROOT,e.path))}));
  const shot=SHOTS[g.page.shot],assets=shot?[{path:`assets/studio/${shot.file}.webp`,alt:shot.alt.en,kind:'existing screenshot'}, {path:`assets/social/en-${g.kind==='intent'?g.key:g.key.replaceAll('/','-')}.png`,kind:'social card'}].filter(a=>existsSync(path.join(ROOT,a.path))):[];
  const entry=ledger.entries.find(e=>e.sourceRoute===route&&e.platform==='devto');
  return {route,canonical:canonical(route),title:g.page.copy.en.title,primaryTopic:d.intent.primary,contentType,sourceType:d.type,target:d.intent.target||null,problem:d.intent.goal||d.intent.primary,group,
   topicCluster:recipe?.topicCluster||group,alreadyDistributed:!!entry?.publishedAt,status:entry?.status||'candidate',suitablePlatforms:['devto'],priority,priorityReason,
   sourceEvidence:evidence,assets,sourceDigest:digest,articleReady,readinessReason:articleReady?'Reviewed standalone adaptation matches source':recipe?'Source changed: adaptation needs review':'Editorial adaptation required',sourceFile:`src/seo-depth/${group}.js`};
 });
 return {schemaVersion:1,source:'tools/sitemaps.mjs + src/seo-depth + gamePageFor (English only)',pages,
  excluded:{generalTools:groups.tools.length,guides:groups.guides.length,reason:'No generic file utilities, policy pages, hubs, application/noindex routes or fabricated guides in game-dev distribution'}};
}
