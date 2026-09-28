import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMarkdown,safeHref,plainExcerpt} from '../platform/markdown.js';

const XSS=[
 '<script>alert(1)</script>','<img src=x onerror=alert(1)>','[x](javascript:alert(1))','[x](JaVaScRiPt:alert(1))',
 '[x](data:text/html,<script>alert(1)</script>)','![a](https://evil.example/x.png)','[x](//evil.example)',
 '"><svg onload=alert(1)>','[a](https://ok.example/"onmouseover="alert(1))','<a href="javascript:x">y</a>','`<b>`','```\n<script>\n```',
 '[x](https://user:pw@evil.example/)','**<i>x</i>**','[<img src=x>](https://ok.example)'
];
test('no user input can produce markup, handlers or unsafe URLs',()=>{
 for(const input of XSS){
  const html=renderMarkdown(input);
  assert.doesNotMatch(html,/<(script|svg|iframe|object|style)/i,input);
  const tags=html.match(/<[^>]+>/g)||[];
  for(const tag of tags)assert.doesNotMatch(tag,/\son\w+=/i,input);
  assert.doesNotMatch(html,/href="(javascript|data|vbscript):/i,input);
  assert.doesNotMatch(html,/href="\/\//,input);
  assert.doesNotMatch(html,/<img(?![^>]*src="\/u\/)/,input);
  assert.doesNotMatch(html,/<(?!\/?(p|br|strong|em|del|code|pre|a|ul|ol|li|h\d|blockquote|img)\b)[a-z]/i,input);
 }
});
test('markdown subset renders',()=>{
 assert.equal(renderMarkdown('**b** *i* `c`'),'<p><strong>b</strong> <em>i</em> <code>c</code></p>');
 assert.equal(renderMarkdown('- a\n- b'),'<ul><li>a</li><li>b</li></ul>');
 assert.equal(renderMarkdown('## Title'),'<h4>Title</h4>');
 assert.match(renderMarkdown('[docs](https://example.com/a?b=1&c=2)'),/href="https:\/\/example.com\/a\?b=1&amp;c=2" rel="nofollow ugc noopener noreferrer" target="_blank">docs<\/a>/);
 assert.match(renderMarkdown('![shot](/u/abcdef123456/medium.webp)'),/<img src="\/u\/abcdef123456\/medium.webp" alt="shot"/);
 assert.equal(renderMarkdown('see /ko/ai/'),'<p>see /ko/ai/</p>');
});
test('safeHref and excerpts',()=>{
 assert.equal(safeHref('javascript:alert(1)'),null);assert.equal(safeHref('/ko/games/x/'),'/ko/games/x/');assert.equal(safeHref('//x.example'),null);
 assert.equal(plainExcerpt('## Hi\n**there** [link](https://x.example)',50),'Hi there link');
});
