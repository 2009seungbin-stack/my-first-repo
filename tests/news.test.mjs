import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseNews} from '../platform/news.js';
import {renderMarkdown} from '../platform/markdown.js';

const now=Date.parse('2026-11-14T00:00:00Z');
const release=(id,at=now-1000,url='https://example.com/release',verification='OFFICIAL')=>({entity:{id,names:{ko:'도구 '+id,en:'Tool '+id}},version:'2.0',released_at:at,notes_url:url,verification});

test('official release feed excludes unsafe sources, future, stale and unverified records, and keeps the newest per entity',()=>{
 const rows=[release('a',now-5000),release('a'),release('b'),release('stale',now-31*864e5),release('future',now+1),
  release('http',now-1000,'http://example.com'),release('js',now-1000,'javascript:alert(1)'),
  release('credentials',now-1000,'https://user:pass@example.com'),release('unknown',now-1000,'https://example.com','COMMUNITY')];
 const out=releaseNews(rows,'ko',now);
 assert.deepEqual(out.map(r=>r.id),['release:a:2.0','release:b:2.0']);
 assert.equal(out[0].created_at,now-1000);assert.match(out[0].title,/도구 a/);
 assert.match(releaseNews([release('a')],'en',now)[0].title,/Tool a/);
});

test('editorial figures are opt-in, local assets only, with escaped alt text',()=>{
 const md='![local](/assets/editorial/2026-11-14-png/logo-input.png)\n\n![remote](https://example.com/tracker.png)\n\n![traversal](/assets/editorial/../secret.png)\n\n![<script>](/assets/editorial/example/ok.webp)';
 assert(!renderMarkdown(md).includes('<img'));
 const out=renderMarkdown(md,{editorialImages:true});
 assert.equal((out.match(/<img /g)||[]).length,2);
 assert(out.includes('alt="&lt;script&gt;"'));assert(!out.includes('src="https://')&&!out.includes('src="/assets/editorial/../'));
});
