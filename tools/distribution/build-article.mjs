import {readFileSync} from 'node:fs';
import path from 'node:path';
import {ROOT,hash,fingerprint} from './common.mjs';
import {recipes,sourceDigest} from './inventory.mjs';
export function buildArticle(page){
 const key=page.route.slice(4,-1),r=recipes()[key];
 if(!r||r.sourceDigest!==sourceDigest(key))throw Error('No current reviewed adaptation for source');
 const text=readFileSync(path.join(ROOT,'tools/distribution/articles',r.file),'utf8').replace(/\r\n?/g,'\n').trim();
 const title=text.split('\n')[0].replace(/^# /,'').trim();
 const body=text.slice(text.indexOf('\n')).trim()+`\n\n## Browser workflow\n\n${r.cta} [Read the source guide](${page.canonical}).\n`;
 return {title,body_markdown:body,tags:r.tags,canonical_url:page.canonical,published:false,sourceRoute:page.route,topicCluster:page.topicCluster,
  sourceDigest:page.sourceDigest,contentHash:hash(body),fingerprint:fingerprint(body),evidence:page.sourceEvidence};
}
